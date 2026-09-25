import assert from 'node:assert/strict'
import { test } from 'node:test'
import { installDom, renderClient, renderStatic } from './helpers/dom.js'
import { createStaticContentSource } from '../src/content-source.js'
import { BinaryView } from '../src/renderers/binary.js'
import { builtInRenderers, hexRenderer } from '../src/renderers/builtin.js'
import HexRenderer, { HexView } from '../src/renderers/hex.js'
import { selectRenderers } from '../src/renderers/types.js'
import { HEX_DUMP_LIMIT, hexDump } from '../src/shared/hex.js'

installDom()

test('hexDump formats offsets, grouped bytes and an ascii gutter', () => {
  const bytes = new TextEncoder().encode('Hello, world! ÿ extra')
  const lines = hexDump(bytes).split('\n')
  assert.equal(lines[0], '00000000  48 65 6c 6c 6f 2c 20 77  6f 72 6c 64 21 20 01 c3  |Hello, world! ..|')
  assert.equal(lines[1], '00000010  bf 20 65 78 74 72 61                              |. extra|')
  assert.equal(hexDump(new Uint8Array(0)), '')
  const big = new Uint8Array(HEX_DUMP_LIMIT + 32)
  assert.equal(hexDump(big).split('\n').length, HEX_DUMP_LIMIT / 16, 'capped at 64 KiB')
})

test('hex renderer shows the dump for small binaries and declines above 1 MiB', async () => {
  const source = createStaticContentSource({ name: 'blob.bin', bytes: 3, textual: false, blob: new Blob([new Uint8Array([0xde, 0xad, 0xbe])]) })
  const html = renderStatic(<HexView bytes={new Uint8Array([0xde, 0xad, 0xbe])} />)
  assert.match(html, /00000000  de ad be/)
  assert.match(html, /\|\.\.\.\|/)
  const rendered = await renderClient(<HexRenderer source={source} colorMode="light" />)
  const dump = await rendered.waitFor(() => rendered.container.querySelector('.cv-hex-dump'))
  assert.match(dump.textContent ?? '', /de ad be/)
  await rendered.unmount()
  assert.equal(hexRenderer.maxBytes, 1024 * 1024)
  const large = createStaticContentSource({ name: 'blob.bin', bytes: 2 * 1024 * 1024, textual: false })
  assert.deepEqual(selectRenderers(large, builtInRenderers).map((renderer) => renderer.id), ['binary'])
})

test('binary renderer is the last fallback and shows metadata plus a download link', () => {
  const source = createStaticContentSource({
    name: 'firmware.bin',
    path: '/state/firmware.bin',
    mediaType: 'application/octet-stream',
    bytes: 2048,
    textual: false,
    sha256: 'abc123',
    modifiedAt: '2026-09-25T00:00:00Z',
    url: (options) => (options?.download ? '/download/firmware.bin' : null),
  })
  const ordered = selectRenderers(source, builtInRenderers)
  assert.equal(ordered[ordered.length - 1]!.id, 'binary')
  const html = renderStatic(<BinaryView source={source} colorMode="light" />)
  assert.match(html, /<dt>Name<\/dt><dd>firmware.bin<\/dd>/)
  assert.match(html, /<dd>2.0 KiB \(2,048 bytes\)<\/dd>/)
  assert.match(html, /application\/octet-stream/)
  assert.match(html, /<dd class="cv-mono">abc123<\/dd>/)
  assert.match(html, /href="\/download\/firmware.bin" download="firmware.bin"/)
  const noDownload = renderStatic(<BinaryView source={createStaticContentSource({ name: 'x', textual: false })} colorMode="light" />)
  assert.match(noDownload, /No preview or download/)
})
