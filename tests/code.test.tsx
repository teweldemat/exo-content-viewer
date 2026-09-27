import assert from 'node:assert/strict'
import { test } from 'node:test'
import { installDom, renderClient, renderStatic, changeValue, click } from './helpers/dom.js'
import { fixtureSource, readFixture } from './helpers/fixtures.js'
import { createStaticContentSource } from '../src/content-source.js'
import CodeRenderer, { CodeView } from '../src/renderers/code.js'
import { formatLineHash, parseLineHash, shouldUsePlainView } from '../src/shared/code-helpers.js'
import { resolveLanguage } from '../src/shared/highlighter.js'
import { clearPreferences } from '../src/shared/preferences.js'

installDom()

test('code highlights a TypeScript snippet with shiki tokens', async () => {
  const source = fixtureSource('sample.ts')
  const rendered = await renderClient(<CodeRenderer source={source} colorMode="light" />)
  const block = await rendered.waitFor(() => rendered.container.querySelector('pre.cv-code[data-highlighted="true"]'))
  assert.equal(block.getAttribute('data-language'), 'typescript')
  const colored = block.querySelectorAll('span[style*="color"]')
  assert.ok(colored.length > 5, 'tokens are rendered as colored spans')
  assert.equal(rendered.container.querySelector('.cv-code-view')?.getAttribute('data-cv-code-mode'), 'highlighted')
  assert.equal(rendered.container.querySelectorAll('.cv-code-ln').length, readFixture('sample.ts').trimEnd().split('\n').length)
  assert.match(rendered.container.querySelector('.cv-bar')?.textContent ?? '', /7 lines · typescript/)
  await rendered.unmount()
})

test('code selects lines from clicks and go-to-line and mirrors them in the hash', async () => {
  const source = fixtureSource('sample.ts')
  window.history.replaceState(null, '', '#L2-L3')
  const rendered = await renderClient(<CodeView text={readFixture('sample.ts')} source={source} colorMode="light" />)
  assert.deepEqual(Array.from(rendered.container.querySelectorAll('.cv-code-row-selected')).map((row) => row.getAttribute('data-line')), ['2', '3'])
  click(rendered.container.querySelector('[data-line-number="5"]')!)
  await rendered.flush()
  assert.deepEqual(Array.from(rendered.container.querySelectorAll('.cv-code-row-selected')).map((row) => row.getAttribute('data-line')), ['5'])
  assert.equal(window.location.hash, '#L5')
  const input = rendered.container.querySelector<HTMLInputElement>('input[aria-label="Go to line"]')!
  changeValue(input, '7')
  await rendered.flush()
  input.form!.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  await rendered.flush()
  assert.equal(window.location.hash, '#L7')
  assert.equal(rendered.container.querySelector('.cv-code-row-selected')?.getAttribute('data-line'), '7')
  window.history.replaceState(null, '', '#')
  await rendered.unmount()
})

test('code falls back to the plain virtualized view for very large files', () => {
  const lines = Array.from({ length: 20_001 }, (_, index) => `line ${index + 1}`)
  const text = lines.join('\n')
  assert.equal(shouldUsePlainView(text, text.length, lines.length), true, 'line count above 20,000')
  assert.equal(shouldUsePlainView('short', 600 * 1024, 1), true, 'bytes above 512 KiB')
  assert.equal(shouldUsePlainView('short', 100, 1), false)
  const source = createStaticContentSource({ name: 'big.log', text })
  const html = renderStatic(<CodeView text={text} source={source} colorMode="light" />)
  assert.match(html, /data-cv-code-mode="plain"/)
  assert.match(html, /data-virtualized="true"/)
  assert.match(html, /data-line="1"/, 'the first rows are rendered')
  assert.doesNotMatch(html, /data-line="20001"/, 'rows past the viewport are not rendered')
  assert.match(html, /large file, plain view/)
})

test('code helpers parse line hashes and map file names to grammars', () => {
  assert.deepEqual(parseLineHash('#L12-L20'), { start: 12, end: 20 })
  assert.deepEqual(parseLineHash('#L20-12'), { start: 12, end: 20 })
  assert.deepEqual(parseLineHash('L7'), { start: 7, end: 7 })
  assert.equal(parseLineHash('#section'), null)
  assert.equal(parseLineHash('#L0'), null)
  assert.equal(formatLineHash({ start: 3, end: 3 }), '#L3')
  assert.equal(formatLineHash({ start: 3, end: 9 }), '#L3-L9')
  assert.equal(resolveLanguage('app.tsx'), 'tsx')
  assert.equal(resolveLanguage('Dockerfile'), 'dockerfile')
  assert.equal(resolveLanguage('a/b/script.py'), 'python')
  assert.equal(resolveLanguage('mermaid'), 'mermaid')
  assert.equal(resolveLanguage('notes.unknownext'), null)
})

test('the wrap toggle is remembered across files and sessions', async () => {
  clearPreferences()
  const first = await renderClient(<CodeView text={readFixture('sample.ts')} source={fixtureSource('sample.ts')} colorMode="light" />)
  const toggle = first.container.querySelector<HTMLInputElement>('.cv-bar-toggle input')!
  assert.equal(toggle.checked, false)
  assert.ok(!first.container.querySelector('.cv-code-wrap'))
  toggle.click()
  await first.flush()
  assert.equal(toggle.checked, true)
  assert.ok(first.container.querySelector('.cv-code-wrap'))
  await first.unmount()

  const second = await renderClient(<CodeView text="a\nb" source={createStaticContentSource({ name: 'other.txt', text: 'a\nb' })} colorMode="light" />)
  assert.equal(second.container.querySelector<HTMLInputElement>('.cv-bar-toggle input')?.checked, true, 'a new file opens with the remembered wrap')
  assert.ok(second.container.querySelector('.cv-code-wrap'))
  await second.unmount()
  clearPreferences()
})
