import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createStaticContentSource } from '../src/content-source.js'

test('createStaticContentSource caches text() and derives bytes, textual and blob', async () => {
  const source = createStaticContentSource({ name: 'hello.txt', text: 'héllo', mediaType: 'text/plain' })
  assert.equal(source.bytes, 6, 'utf-8 byte length')
  assert.equal(source.textual, true)
  const first = source.text()
  const second = source.text()
  assert.equal(first, second, 'the same promise is returned for every call')
  assert.equal(await first, 'héllo')
  const blob = await source.blob()
  assert.equal(blob.type, 'text/plain')
  assert.equal(await blob.text(), 'héllo')
  assert.equal(source.blob(), source.blob(), 'blob() is cached too')
})

test('createStaticContentSource reads text from a blob once and supports url/resolve', async () => {
  let reads = 0
  const blob = new Blob(['{"a":1}'], { type: 'application/json' })
  const original = blob.text.bind(blob)
  blob.text = () => { reads += 1; return original() }
  const sibling = createStaticContentSource({ name: 'sibling.md', text: '# s' })
  const source = createStaticContentSource({
    name: 'data.json',
    blob,
    url: (options) => (options?.download ? '/dl/data.json' : '/raw/data.json'),
    resolve: (relative) => (relative === 'sibling.md' ? sibling : relative === 'other.txt' ? '/files/other.txt' : null),
  })
  assert.equal(source.bytes, 7)
  assert.equal(source.textual, null, 'unknown until the server says so')
  assert.equal(await source.text(), '{"a":1}')
  assert.equal(await source.text(), '{"a":1}')
  assert.equal(reads, 1)
  assert.equal(source.url(), '/raw/data.json')
  assert.equal(source.url({ download: true }), '/dl/data.json')
  assert.equal(source.resolve!('sibling.md'), sibling)
  assert.equal(source.resolve!('other.txt'), '/files/other.txt')
  assert.equal(source.resolve!('nope'), null)
})

test('createStaticContentSource rejects text() when no content was given and defaults url to null', async () => {
  const source = createStaticContentSource({ name: 'empty.bin', bytes: 0, textual: false })
  await assert.rejects(source.text(), /No text content/)
  assert.equal(source.url(), null)
  assert.equal(source.resolve, undefined)
})
