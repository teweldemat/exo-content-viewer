import assert from 'node:assert/strict'
import { test } from 'node:test'
import { installDom, renderClient, changeValue, click } from './helpers/dom.js'
import { fixtureSource } from './helpers/fixtures.js'
import { ContentViewer } from '../src/ContentViewer.js'
import { createStaticContentSource, type ContentSource } from '../src/content-source.js'
import type { ContentRenderer } from '../src/renderers/types.js'

installDom()

test('ContentViewer picks the best renderer, lists every match in "View as" and switches on change', async () => {
  const source = fixtureSource('frontmatter.md', { mediaType: 'text/markdown', url: (options) => (options?.download ? '/download/frontmatter.md' : null) })
  const rendered = await renderClient(<ContentViewer source={source} colorMode="light" />)
  await rendered.waitFor(() => rendered.container.querySelector('.cv-markdown'))
  const root = rendered.container.querySelector('.cv-root')!
  assert.equal(root.getAttribute('data-renderer'), 'markdown')
  assert.equal(root.getAttribute('data-color-mode'), 'light')
  assert.equal(rendered.container.querySelector('.cv-toolbar-label')?.textContent, 'Markdown')
  assert.match(rendered.container.querySelector('.cv-toolbar-meta')?.textContent ?? '', /B · text\/markdown/)
  assert.equal(rendered.container.querySelector('a[download="frontmatter.md"]')?.getAttribute('href'), '/download/frontmatter.md')
  const select = rendered.container.querySelector<HTMLSelectElement>('select[aria-label="View as"]')!
  assert.deepEqual(Array.from(select.options).map((option) => option.value), ['markdown', 'code', 'hex', 'binary'])
  changeValue(select, 'code')
  await rendered.waitFor(() => rendered.container.querySelector('.cv-code-view'))
  assert.equal(root.getAttribute('data-renderer'), 'code')
  assert.ok(!rendered.container.querySelector('.cv-markdown'))
  changeValue(select, 'binary')
  await rendered.waitFor(() => rendered.container.querySelector('.cv-binary'))
  await rendered.unmount()
})

test('ContentViewer honors initialRendererId, custom renderers and the toolbar modes', async () => {
  const custom: ContentRenderer = {
    id: 'shout',
    label: 'Shout',
    match: (source) => (source.name.endsWith('.md') ? 100 : null),
    load: async () => ({ source }) => <div className="shout">{source.name.toUpperCase()}</div>,
  }
  const source = fixtureSource('frontmatter.md')
  const rendered = await renderClient(<ContentViewer source={source} renderers={[custom]} colorMode="dark" toolbar="compact" />)
  await rendered.waitFor(() => rendered.container.querySelector('.shout'))
  assert.equal(rendered.container.querySelector('.cv-root')?.getAttribute('data-renderer'), 'shout', 'custom renderer wins the tie with the built-in')
  assert.ok(!rendered.container.querySelector('.cv-toolbar-label'), 'compact toolbar has no label')
  assert.ok(rendered.container.querySelector('select[aria-label="View as"]'))
  await rendered.unmount()

  const initial = await renderClient(<ContentViewer source={source} initialRendererId="code" colorMode="light" toolbar="none" />)
  await initial.waitFor(() => initial.container.querySelector('.cv-code-view'))
  assert.ok(!initial.container.querySelector('.cv-toolbar'))
  await initial.unmount()
})

test('ContentViewer resets the chosen renderer when the source changes', async () => {
  const first = fixtureSource('frontmatter.md')
  const second = createStaticContentSource({ name: 'other.md', text: '# other' })
  const rendered = await renderClient(<ContentViewer source={first} colorMode="light" />)
  await rendered.waitFor(() => rendered.container.querySelector('.cv-markdown'))
  changeValue(rendered.container.querySelector<HTMLSelectElement>('select[aria-label="View as"]')!, 'code')
  await rendered.waitFor(() => rendered.container.querySelector('.cv-code-view'))
  await (async () => { await rendered.flush(); rendered.root.render(<ContentViewer source={second} colorMode="light" />) })()
  await rendered.waitFor(() => rendered.container.querySelector('.cv-markdown'))
  assert.equal(rendered.container.querySelector('.cv-root')?.getAttribute('data-renderer'), 'markdown')
  await rendered.unmount()
})

test('ContentViewer catches renderer errors and offers plain text and binary escapes', async () => {
  const silence = console.error
  console.error = () => undefined
  try {
    const broken: ContentRenderer = {
      id: 'broken',
      label: 'Broken',
      match: () => 200,
      load: async () => () => { throw new Error('kaboom') },
    }
    const source = createStaticContentSource({ name: 'notes.txt', mediaType: 'text/plain', text: 'plain text body' })
    const rendered = await renderClient(<ContentViewer source={source} renderers={[broken]} colorMode="light" />)
    const alert = await rendered.waitFor(() => rendered.container.querySelector('.cv-renderer-error'))
    assert.match(alert.textContent ?? '', /The Broken view failed: kaboom/)
    const buttons = Array.from(alert.querySelectorAll('button')).map((button) => button.textContent)
    assert.deepEqual(buttons, ['View as plain text', 'View as binary'])
    click(alert.querySelector('button')!)
    await rendered.waitFor(() => rendered.container.querySelector('.cv-code-view'))
    assert.ok(!rendered.container.querySelector('.cv-renderer-error'))
    assert.match(rendered.container.textContent ?? '', /plain text body/)
    changeValue(rendered.container.querySelector<HTMLSelectElement>('select[aria-label="View as"]')!, 'broken')
    await rendered.waitFor(() => rendered.container.querySelector('.cv-renderer-error'))
    click(Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'View as binary')!)
    await rendered.waitFor(() => rendered.container.querySelector('.cv-binary'))
    await rendered.unmount()
  } finally {
    console.error = silence
  }
})

test('ContentViewer falls through to the binary view when nothing else accepts the source', async () => {
  const opaque: ContentSource = createStaticContentSource({ name: 'blob', textual: false, bytes: 2 * 1024 * 1024, url: () => '/dl/blob' })
  const rendered = await renderClient(<ContentViewer source={opaque} renderers={[]} colorMode="light" />)
  await rendered.waitFor(() => rendered.container.querySelector('.cv-binary'))
  assert.ok(!rendered.container.querySelector('select[aria-label="View as"]'), 'a single match shows no menu')
  assert.equal(rendered.container.querySelector('.cv-toolbar-label')?.textContent, 'File')
  await rendered.unmount()
})
