import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mermaidMock } from './mocks/mermaid.js'
import { installDom, renderClient, renderStatic, click } from './helpers/dom.js'
import { fixtureSource, readFixture } from './helpers/fixtures.js'
import { createStaticContentSource, type ContentSource } from '../src/content-source.js'
import { MarkdownView } from '../src/renderers/markdown.js'
import { extractHeadings, safeUrl } from '../src/shared/markdown-helpers.js'

installDom()

const sibling = createStaticContentSource({ name: 'sibling.md', path: '/docs/sibling.md', text: '# sibling', url: () => '/files/docs/sibling.md' })
const diagram = createStaticContentSource({
  name: 'diagram.png',
  path: '/docs/diagram.png',
  mediaType: 'image/png',
  blob: new Blob([new Uint8Array([1, 2, 3])]),
  url: (options) => (options?.preview ? '/preview/docs/diagram.png' : '/raw/docs/diagram.png'),
})

function hostileSource(): ContentSource {
  return fixtureSource('hostile.md', {
    resolve: (relative) => {
      if (relative === './sibling.md') return sibling
      if (relative === './diagram.png') return diagram
      if (relative === '../other.txt') return '/files/other.txt'
      return null
    },
  })
}

function render(source: ContentSource, allowRawHtml = false, onNavigate?: (target: ContentSource | string) => void) {
  return renderStatic(<MarkdownView text={readFixture(source.name)} source={source} colorMode="light" allowRawHtml={allowRawHtml} onNavigate={onNavigate} />)
}

test('markdown renders GFM tables, task lists, footnotes and front matter', () => {
  const html = render(hostileSource())
  assert.match(html, /<table class="cv-frontmatter">/, 'front matter table')
  assert.match(html, /<td>title<\/td><td>Hostile fixture<\/td>/)
  assert.match(html, /<td>tags<\/td><td>\[&quot;alpha&quot;,&quot;beta&quot;\]<\/td>/)
  assert.match(html, /<th>Name<\/th>/, 'GFM table')
  assert.match(html, /<input type="checkbox" (checked="" disabled=""|disabled="" checked="")/, 'task list')
  assert.match(html, /class="footnotes"/, 'footnotes section')
  assert.match(html, /The footnote text\./)
})

test('markdown renders math through KaTeX with trust disabled', () => {
  const html = render(hostileSource())
  assert.match(html, /class="katex"/)
  assert.match(html, /class="katex-display"/)
  assert.match(html, /<annotation encoding="application\/x-tex">E = mc\^2<\/annotation>/)
})

test('markdown strips raw HTML by default', () => {
  const html = render(hostileSource())
  assert.doesNotMatch(html, /<script/i)
  assert.doesNotMatch(html, /onerror/i)
  assert.doesNotMatch(html, /onclick/i)
  assert.doesNotMatch(html, /<iframe/i)
  assert.match(html, /bold html/, 'text inside dropped inline tags survives')
  assert.match(html, /data-raw-html="off"/)
})

test('markdown sanitizes raw HTML when it is allowed', () => {
  const html = render(hostileSource(), true)
  assert.match(html, /data-raw-html="sanitized"/)
  assert.match(html, /<b>bold html<\/b>/, 'harmless inline html is kept')
  assert.doesNotMatch(html, /<script/i)
  assert.doesNotMatch(html, /raw block script/, 'script content is stripped, not unwrapped')
  assert.doesNotMatch(html, /onerror/i)
  assert.doesNotMatch(html, /onclick/i)
  assert.doesNotMatch(html, /<iframe/i)
  assert.doesNotMatch(html, /evil\.example/)
  assert.doesNotMatch(html, /javascript:/i)
})

test('markdown drops javascript:, data: and vbscript: links but keeps safe ones', () => {
  const html = render(hostileSource())
  assert.doesNotMatch(html, /href="javascript:/i)
  assert.doesNotMatch(html, /href="data:/i)
  assert.doesNotMatch(html, /href="vbscript:/i)
  assert.doesNotMatch(html, /src="data:/i, 'data: images are dropped too')
  assert.match(html, /<span class="cv-link-disabled">javascript link<\/span>/)
  assert.match(html, /<a href="https:\/\/example.com\/page" target="_blank" rel="noopener noreferrer">external<\/a>/)
  assert.match(html, /<a href="#intro">anchor<\/a>/)
  assert.equal(safeUrl('JAVASCRIPT:alert(1)'), '')
  assert.equal(safeUrl('java\tscript:alert(1)'), '')
  assert.equal(safeUrl('  https://ok.example/x '), 'https://ok.example/x')
  assert.equal(safeUrl('./relative.md'), './relative.md')
  assert.equal(safeUrl('mailto:a@b.c'), 'mailto:a@b.c')
})

test('markdown resolves relative links and images through source.resolve', () => {
  const html = render(hostileSource())
  assert.match(html, /<a href="\/files\/docs\/sibling.md" data-cv-navigate="\/docs\/sibling.md">sibling doc<\/a>/, 'ContentSource result')
  assert.match(html, /<a href="\/files\/other.txt#frag">string sibling<\/a>/, 'string result keeps the fragment')
  assert.match(html, /<span class="cv-link-disabled">missing<\/span>/, 'null result disables the link')
  assert.match(html, /<img src="\/preview\/docs\/diagram.png" alt="relative image" loading="lazy"/, 'relative image uses url({ preview: true })')
  assert.match(html, /<img src="https:\/\/example.com\/pic.png" alt="external image"/)
})

test('markdown builds a table of contents from headings when there are at least three', () => {
  const headings = extractHeadings(readFixture('hostile.md'))
  assert.deepEqual(headings.map((heading) => heading.id), ['intro', 'links', 'tables-and-tasks', 'math', 'code'])
  const html = render(hostileSource())
  assert.match(html, /<details class="cv-toc" open="">/)
  assert.match(html, /<a href="#tables-and-tasks">Tables and tasks<\/a>/)
  assert.match(html, /<h2 id="tables-and-tasks">/, 'rehype-slug ids match the generated table of contents')
  const few = renderStatic(<MarkdownView text={readFixture('frontmatter.md')} source={fixtureSource('frontmatter.md')} colorMode="light" />)
  assert.doesNotMatch(few, /cv-toc/)
  assert.match(few, /<td>title<\/td><td>TOML front matter<\/td>/, 'TOML front matter')
  assert.match(few, /<td>draft<\/td><td>false<\/td>/)
})

test('markdown renders code fences with the code block and mermaid fences fall back to code on error', async () => {
  mermaidMock.calls.length = 0
  const rendered = await renderClient(<MarkdownView text={readFixture('hostile.md')} source={hostileSource()} colorMode="dark" />)
  const image = await rendered.waitFor(() => rendered.container.querySelector<HTMLImageElement>('img[alt="Mermaid diagram"]'))
  assert.match(image.src, /^data:image\/svg\+xml/, 'the diagram is shown through an img, never inlined')
  assert.ok(!rendered.container.querySelector('svg:not(.lucide)'), 'no inline svg anywhere (icons excluded)')
  const failed = await rendered.waitFor(() => rendered.container.querySelector('.cv-mermaid-error'))
  assert.match(failed.textContent ?? '', /Parse error/)
  assert.ok(failed.querySelector('pre.cv-code[data-language="mermaid"]'), 'invalid diagram falls back to a code block')
  assert.equal(mermaidMock.lastConfig?.securityLevel, 'strict')
  assert.equal(mermaidMock.calls.length, 2)
  const tsBlock = rendered.container.querySelector('pre.cv-code[data-language="ts"]')
  assert.ok(tsBlock, 'ts fence uses the code block')
  await rendered.waitFor(() => tsBlock.getAttribute('data-highlighted') === 'true')
  assert.ok(tsBlock.querySelector('span[style*="color"]'), 'shiki tokens carry colors')
  await rendered.unmount()
})

test('markdown navigates through onNavigate when a resolved link is clicked', async () => {
  const targets: Array<ContentSource | string> = []
  const rendered = await renderClient(<MarkdownView text="[go](./sibling.md)" source={hostileSource()} colorMode="light" onNavigate={(target) => targets.push(target)} />)
  const link = rendered.container.querySelector('a[data-cv-navigate]')!
  const event = click(link)
  assert.equal(event.defaultPrevented, true)
  assert.equal(targets[0], sibling)
  await rendered.unmount()
})
