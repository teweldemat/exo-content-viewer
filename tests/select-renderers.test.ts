import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createStaticContentSource } from '../src/content-source.js'
import { builtInRenderers, mergeRenderers } from '../src/renderers/builtin.js'
import { extensionOf, isTextual, mediaTypeOf } from '../src/renderers/matching.js'
import { selectRenderers, type ContentRenderer } from '../src/renderers/types.js'

const noop = async () => () => null

function renderer(id: string, score: number | null, extra: Partial<ContentRenderer> = {}): ContentRenderer {
  return { id, label: id, match: () => score, load: noop, ...extra }
}

test('selectRenderers sorts by score descending and keeps binary last', () => {
  const source = createStaticContentSource({ name: 'a.bin', bytes: 10 })
  const ordered = selectRenderers(source, [renderer('binary', 500), renderer('low', 10), renderer('high', 100), renderer('declined', null)])
  assert.deepEqual(ordered.map((entry) => entry.id), ['high', 'low', 'binary'])
})

test('selectRenderers gives ties to the earlier (caller) renderer and drops duplicate ids', () => {
  const source = createStaticContentSource({ name: 'a.md', text: '# hi' })
  const custom = renderer('custom', 100)
  const customMarkdown = renderer('markdown', 100)
  const ordered = selectRenderers(source, mergeRenderers([custom, customMarkdown]))
  assert.equal(ordered[0], custom)
  assert.equal(ordered[1], customMarkdown, 'caller renderer with a built-in id replaces the built-in')
  assert.equal(ordered.filter((entry) => entry.id === 'markdown').length, 1)
  assert.equal(ordered[ordered.length - 1]!.id, 'binary')
})

test('selectRenderers excludes renderers whose maxBytes is below the source size', () => {
  const big = createStaticContentSource({ name: 'a.json', mediaType: 'application/json', bytes: 9 * 1024 * 1024, textual: true })
  const ids = selectRenderers(big, builtInRenderers).map((entry) => entry.id)
  assert.ok(!ids.includes('json'), 'json declines above 8 MiB')
  assert.ok(!ids.includes('hex'), 'hex declines above 1 MiB')
  assert.deepEqual(ids, ['code', 'binary'])
  const unknownSize = createStaticContentSource({ name: 'a.json', mediaType: 'application/json', textual: true })
  assert.equal(selectRenderers(unknownSize, builtInRenderers)[0]!.id, 'json', 'unknown byte counts are not excluded')
})

test('built-in matching prefers the media type, then the extension, and never sniffs bytes', () => {
  const byMedia = createStaticContentSource({ name: 'weird.bin', mediaType: 'text/markdown; charset=utf-8', text: '# x' })
  assert.equal(selectRenderers(byMedia, builtInRenderers)[0]!.id, 'markdown')
  const byExtension = createStaticContentSource({ name: 'README.md', text: '# x' })
  assert.deepEqual(selectRenderers(byExtension, builtInRenderers).map((entry) => entry.id), ['markdown', 'code', 'hex', 'binary'])
  const png = createStaticContentSource({ name: 'photo.png', mediaType: 'image/png', bytes: 100, textual: false })
  assert.deepEqual(selectRenderers(png, builtInRenderers).map((entry) => entry.id), ['image', 'hex', 'binary'])
  const looksLikeText = createStaticContentSource({ name: 'blob', bytes: 10, textual: null, blob: new Blob(['hello']) })
  assert.deepEqual(selectRenderers(looksLikeText, builtInRenderers).map((entry) => entry.id), ['hex', 'binary'], 'no type information means no text renderer')
  const explicitlyBinary = createStaticContentSource({ name: 'x.txt', textual: false, bytes: 5 })
  assert.ok(!selectRenderers(explicitlyBinary, builtInRenderers).some((entry) => entry.id === 'code'), 'server textual=false wins over the extension')
})

test('matching helpers normalize media types and extensions', () => {
  assert.equal(mediaTypeOf(createStaticContentSource({ name: 'x', mediaType: 'Text/CSV; header=present' })), 'text/csv')
  assert.equal(extensionOf(createStaticContentSource({ name: 'Archive.TAR.GZ' })), 'gz')
  assert.equal(extensionOf(createStaticContentSource({ name: 'Dockerfile' })), 'dockerfile')
  assert.equal(extensionOf(createStaticContentSource({ name: '.env' })), null)
  assert.equal(extensionOf(createStaticContentSource({ name: '', path: '/a/b/notes.yaml' })), 'yaml')
  assert.equal(isTextual(createStaticContentSource({ name: 'x', mediaType: 'application/vnd.api+json' })), true)
  assert.equal(isTextual(createStaticContentSource({ name: 'x.exe' })), false)
})

test('every built-in renderer accepts the media types from the design table', () => {
  const expectations: Array<[string, string | null, string]> = [
    ['a.md', 'text/markdown', 'markdown'],
    ['a.json', 'application/json', 'json'],
    ['a.jsonl', null, 'json'],
    ['a.yml', null, 'yaml-toml'],
    ['a.toml', 'application/toml', 'yaml-toml'],
    ['a.csv', 'text/csv', 'table'],
    ['a.tsv', null, 'table'],
    ['a.webp', 'image/webp', 'image'],
    ['a.svg', 'image/svg+xml', 'svg'],
    ['a.pdf', 'application/pdf', 'pdf'],
    ['a.mp4', 'video/mp4', 'media'],
    ['a.mp3', 'audio/mpeg', 'media'],
    ['a.html', 'text/html', 'html'],
    ['a.ipynb', null, 'notebook'],
    ['a.patch', 'text/x-diff', 'diff'],
  ]
  for (const [name, mediaType, expected] of expectations) {
    const source = createStaticContentSource({ name, mediaType, bytes: 100, textual: true })
    assert.equal(selectRenderers(source, builtInRenderers)[0]!.id, expected, `${name} (${mediaType ?? 'no media type'})`)
  }
})
