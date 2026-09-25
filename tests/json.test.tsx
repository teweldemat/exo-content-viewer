import assert from 'node:assert/strict'
import { test } from 'node:test'
import { installDom, renderClient, renderStatic, changeValue, click } from './helpers/dom.js'
import { fixtureSource } from './helpers/fixtures.js'
import { createStaticContentSource } from '../src/content-source.js'
import JsonRenderer, { JsonView, isJsonLines, parseJsonDocument } from '../src/renderers/json.js'
import { formatTreePath, searchTree } from '../src/shared/TreeView.js'

installDom()

test('json renders a collapsible tree with keys, values and copy-path buttons', () => {
  const text = '{"name":"wumis","ports":[8080,8443],"nested":{"deep":{"deeper":true}},"none":null}'
  const source = createStaticContentSource({ name: 'config.json', mediaType: 'application/json', text })
  const html = renderStatic(<JsonView text={text} source={source} colorMode="light" />)
  assert.match(html, /data-parse="ok"/)
  assert.match(html, /class="cv-tree-key">&quot;name&quot;<\/span>/)
  assert.match(html, /class="cv-tree-value cv-tree-string">&quot;wumis&quot;<\/span>/)
  assert.match(html, /class="cv-tree-value cv-tree-number">8080<\/span>/)
  assert.match(html, /class="cv-tree-value cv-tree-null">null<\/span>/)
  assert.match(html, /aria-label="Copy path \$\.ports\[1\]"/)
  assert.match(html, /data-path="\$\.nested\.deep"[^>]*>.*aria-expanded="false"/, 'depth 2 starts collapsed')
  assert.doesNotMatch(html, /&quot;deeper&quot;/, 'collapsed children are not rendered')
  assert.match(html, /aria-label="Search keys and values"/)
})

test('json falls back to the code view when parsing fails', () => {
  const source = fixtureSource('invalid.json', { mediaType: 'application/json' })
  const html = renderStatic(<JsonView text={'{ "unterminated": [1, 2,\n'} source={source} colorMode="light" />)
  assert.match(html, /data-parse="failed"/)
  assert.match(html, /Could not parse JSON/)
  assert.match(html, /class="cv-code-view"/)
})

test('json lines parses row by row and reports the failing line', () => {
  const source = fixtureSource('sample.jsonl')
  assert.equal(isJsonLines(source), true)
  assert.equal(isJsonLines(createStaticContentSource({ name: 'x', mediaType: 'application/x-ndjson' })), true)
  const parsed = parseJsonDocument('{"id":1}\n\n{"id":2,"tags":["a"]}\n', true)
  assert.deepEqual(parsed, { ok: true, value: [{ id: 1 }, { id: 2, tags: ['a'] }] })
  const failed = parseJsonDocument('{"id":1}\n{oops}\n', true)
  assert.equal(failed.ok, false)
  assert.match((failed as { error: string }).error, /^line 2:/)
  const html = renderStatic(<JsonView text={'{"id":1}\n{"id":2}\n'} source={source} colorMode="light" />)
  assert.match(html, /class="cv-tree-summary">\[2\]<\/span>/)
})

test('json raw toggle switches to the code view and search expands matching paths', async () => {
  const source = fixtureSource('sample.jsonl')
  const rendered = await renderClient(<JsonRenderer source={source} colorMode="light" />)
  await rendered.waitFor(() => rendered.container.querySelector('.cv-tree'))
  const search = rendered.container.querySelector<HTMLInputElement>('input[aria-label="Search keys and values"]')!
  changeValue(search, 'second')
  await rendered.flush()
  assert.ok(rendered.container.querySelector('[data-path="$[1].name"]'), 'match is expanded into view')
  assert.ok(!rendered.container.querySelector('[data-path="$[0].name"]'), 'non-matching siblings are hidden')
  const raw = Array.from(rendered.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find((input) => input.parentElement?.textContent?.includes('Raw'))!
  click(raw)
  await rendered.flush()
  assert.ok(rendered.container.querySelector('.cv-code-view'), 'raw view delegates to the code renderer')
  await rendered.unmount()
})

test('tree helpers format paths and search values and keys', () => {
  assert.equal(formatTreePath(['a', 0, 'b c']), '$.a[0]["b c"]')
  const found = searchTree({ items: [{ name: 'x' }, { name: 'target' }] }, 'TARGET')
  assert.ok(found.matches.has('$.items[1].name'))
  assert.ok(found.ancestors.has('$.items[1]'))
  assert.ok(found.ancestors.has('$'))
  assert.ok(!found.matches.has('$.items[0].name'))
})
