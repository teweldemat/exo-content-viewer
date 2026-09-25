import assert from 'node:assert/strict'
import { test } from 'node:test'
import { installDom, renderClient, renderStatic, click } from './helpers/dom.js'
import { fixtureSource, readFixture } from './helpers/fixtures.js'
import DiffRenderer, { DiffView, pairBlockLines, parseUnifiedDiff } from '../src/renderers/diff.js'

installDom()

test('diff parses files and hunks with diff2html', () => {
  const files = parseUnifiedDiff(readFixture('sample.diff'))
  assert.equal(files.length, 2)
  assert.equal(files[0]!.newName, 'src/app.ts')
  assert.equal(files[0]!.addedLines, 2)
  assert.equal(files[0]!.deletedLines, 1)
  assert.equal(files[1]!.isNew, true)
  const pairs = pairBlockLines(files[0]!.blocks[0]!)
  assert.deepEqual(pairs.map((pair) => [pair.left?.type ?? null, pair.right?.type ?? null]), [
    ['context', 'context'],
    ['delete', 'insert'],
    [null, 'insert'],
    ['context', 'context'],
  ])
})

test('diff renders line-by-line markup with d2h classes and no injected html', () => {
  const source = fixtureSource('sample.diff')
  const html = renderStatic(<DiffView text={readFixture('sample.diff')} source={source} colorMode="light" />)
  assert.match(html, /data-mode="line-by-line"/)
  assert.match(html, /d2h-light-color-scheme/)
  assert.match(html, /class="d2h-file-name">src\/app.ts</)
  assert.match(html, /d2h-changed-tag">CHANGED</)
  assert.match(html, /d2h-added-tag">ADDED</)
  assert.match(html, /class="d2h-code-line">@@ -1,4 \+1,5 @@</)
  assert.match(html, /<td class="d2h-del"><div class="d2h-code-line"><span class="d2h-code-line-prefix">-<\/span><span class="d2h-code-line-ctn">const port = 3000<\/span>/)
  assert.match(html, /<td class="d2h-ins"><div class="d2h-code-line"><span class="d2h-code-line-prefix">\+<\/span><span class="d2h-code-line-ctn">const host = &#x27;0.0.0.0&#x27;<\/span>/, 'content is escaped by React')
  assert.match(html, /<div class="line-num1">2<\/div><div class="line-num2"><\/div>/)
  assert.doesNotMatch(html, /d2h-files-diff/)
})

test('diff renders side-by-side markup and toggles between modes', async () => {
  const source = fixtureSource('sample.diff')
  const html = renderStatic(<DiffView text={readFixture('sample.diff')} source={source} colorMode="dark" initialMode="side-by-side" />)
  assert.match(html, /data-mode="side-by-side"/)
  assert.match(html, /d2h-dark-color-scheme/)
  assert.equal((html.match(/d2h-file-side-diff/g) ?? []).length, 4, 'two sides per file')
  assert.match(html, /d2h-code-side-emptyplaceholder/, 'unmatched insert leaves a placeholder on the left')
  assert.match(html, /class="d2h-code-side-linenumber d2h-del">2</)

  const rendered = await renderClient(<DiffRenderer source={source} colorMode="light" />)
  await rendered.waitFor(() => rendered.container.querySelector('.cv-diff'))
  assert.equal(rendered.container.querySelector('.cv-diff')?.getAttribute('data-mode'), 'line-by-line')
  click(Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'Side by side')!)
  await rendered.flush()
  assert.equal(rendered.container.querySelector('.cv-diff')?.getAttribute('data-mode'), 'side-by-side')
  assert.ok(rendered.container.querySelector('.d2h-files-diff'))
  await rendered.unmount()
})
