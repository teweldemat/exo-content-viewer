import assert from 'node:assert/strict'
import { test } from 'node:test'
import { installDom, renderStatic } from './helpers/dom.js'
import { fixtureSource, readFixture } from './helpers/fixtures.js'
import { createStaticContentSource } from '../src/content-source.js'
import { NotebookView, parseNotebook } from '../src/renderers/notebook.js'

installDom()

test('notebook parses cells and the kernel language', () => {
  const parsed = parseNotebook(readFixture('hostile.ipynb'))
  assert.equal(parsed.language, 'python')
  assert.deepEqual(parsed.cells.map((cell) => cell.cell_type), ['markdown', 'code', 'raw'])
  assert.throws(() => parseNotebook('{"notCells": []}'), /missing cells array/)
})

test('notebook renders markdown cells, code cells with prompts, and every output kind safely', () => {
  const source = fixtureSource('hostile.ipynb')
  const html = renderStatic(<NotebookView text={readFixture('hostile.ipynb')} source={source} colorMode="light" />)
  assert.match(html, /data-parse="ok"/)
  assert.match(html, /<h1 id="notebook-title">Notebook title<\/h1>/, 'markdown cell')
  assert.match(html, /<strong>markdown<\/strong>/)
  assert.match(html, /In \[2\]:/, 'execution count prompt')
  assert.match(html, /<pre class="cv-code" data-language="python"/, 'code cell uses the kernel language')
  assert.match(html, /import pandas as pd/)
  assert.match(html, /cv-nb-stream-stdout">hello from stdout/, 'stream output')
  assert.match(html, /<div class="cv-nb-html"><div><table><tbody><tr><th>a<\/th><\/tr><tr><td>1<\/td><\/tr><\/tbody><\/table><span>bad<\/span><img src="x"\/><p>styled<\/p><\/div><\/div>/, 'html output is sanitized')
  assert.match(html, /<img class="cv-nb-image" alt="Notebook output" src="data:image\/png;base64,iVBOR/, 'base64 image output')
  assert.match(html, /cv-nb-error/, 'error output')
  assert.match(html, /ValueError: bad value/)
  assert.ok(!html.includes(String.fromCharCode(27)), 'ansi codes are stripped')
  assert.match(html, /cv-nb-raw"><pre class="cv-nb-text">raw cell text/, 'raw cell')
})

test('notebook outputs never carry script, handlers, frames, styles or javascript links', () => {
  const source = fixtureSource('hostile.ipynb')
  const html = renderStatic(<NotebookView text={readFixture('hostile.ipynb')} source={source} colorMode="dark" />)
  assert.doesNotMatch(html, /<script/i)
  assert.doesNotMatch(html, /html output/, 'script content is removed, not unwrapped')
  assert.doesNotMatch(html, /onclick/i)
  assert.doesNotMatch(html, /onerror/i)
  assert.doesNotMatch(html, /<iframe/i)
  assert.doesNotMatch(html, /evil\.example/)
  assert.doesNotMatch(html, /javascript:/i)
  assert.doesNotMatch(html, /style="/i)
  assert.doesNotMatch(html, /alert\('md'\)/, 'markdown cell raw html is dropped')
})

test('notebook falls back to the code view when the file is not valid JSON', () => {
  const source = createStaticContentSource({ name: 'broken.ipynb', text: '{ nope' })
  const html = renderStatic(<NotebookView text="{ nope" source={source} colorMode="light" />)
  assert.match(html, /data-parse="failed"/)
  assert.match(html, /Could not parse notebook/)
  assert.match(html, /cv-code-view/)
})
