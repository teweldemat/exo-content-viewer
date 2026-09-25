import assert from 'node:assert/strict'
import { test } from 'node:test'
import { installDom, renderClient, renderStatic, changeValue, click, stubVirtualizedRects } from './helpers/dom.js'
import { fixtureSource, readFixture } from './helpers/fixtures.js'
import TableRenderer, { TableView } from '../src/renderers/table.js'
import { compareCells, filterRows, parseDelimited, sortRows } from '../src/shared/table-helpers.js'

installDom()
stubVirtualizedRects()

test('table detects the delimiter and normalizes ragged rows', () => {
  const csv = parseDelimited(readFixture('sample.csv'), 'sample.csv')
  assert.equal(csv.delimiter, ',')
  assert.deepEqual(csv.header, ['name', 'age', 'city'])
  assert.equal(csv.rows.length, 3)
  const tsv = parseDelimited(readFixture('sample.tsv'), 'sample.tsv')
  assert.equal(tsv.delimiter, '\t')
  assert.deepEqual(tsv.rows[1], ['2', 'two', '1.5'])
  const semicolon = parseDelimited('a;b;c\n1;2;3\n4;5', 'x.txt')
  assert.equal(semicolon.delimiter, ';')
  assert.deepEqual(semicolon.rows[1], ['4', '5', ''], 'short rows are padded')
  const guessedTab = parseDelimited('a\tb\n1\t2', 'unknown.dat')
  assert.equal(guessedTab.delimiter, '\t', 'tabs are guessed without a hint')
})

test('table helpers sort numerically when possible and filter per column', () => {
  const rows = [['b', '10'], ['a', '9'], ['c', ''], ['A', '100']]
  assert.deepEqual(sortRows(rows, 1, 'asc').map((row) => row[1]), ['9', '10', '100', ''])
  assert.deepEqual(sortRows(rows, 1, 'desc').map((row) => row[1]), ['100', '10', '9', ''], 'empty cells stay last')
  assert.deepEqual(sortRows(rows, 0, 'asc').map((row) => row[0]), ['a', 'A', 'b', 'c'], 'stable, case-insensitive')
  assert.ok(compareCells('2', '10') < 0)
  assert.ok(compareCells('file2', 'file10') < 0)
  assert.deepEqual(filterRows(rows, [undefined, '10']), [['b', '10'], ['A', '100']])
  assert.deepEqual(filterRows(rows, ['A', '10']), [['A', '100']], 'filters combine with AND')
  assert.equal(filterRows(rows, ['', '  ']), rows, 'blank filters are ignored')
})

test('table view shows the row summary, sortable headers and virtualized rows', async () => {
  const source = fixtureSource('sample.csv', { mediaType: 'text/csv' })
  const html = renderStatic(<TableView text={readFixture('sample.csv')} source={source} colorMode="light" />)
  assert.match(html, /Showing 3 of 3 rows/)
  assert.match(html, /3 columns · comma delimited/)
  assert.match(html, /role="columnheader"[^>]*aria-sort="none"[^>]*>name/)
  assert.match(html, /data-virtualized="true"/)
  assert.match(html, /title="Addis Ababa"/)

  const rendered = await renderClient(<TableRenderer source={source} colorMode="light" />)
  await rendered.waitFor(() => rendered.container.querySelector('[data-cv-table-summary]'))
  const ageFilter = rendered.container.querySelector<HTMLInputElement>('input[aria-label="Filter age"]')!
  changeValue(ageFilter, '2')
  await rendered.flush()
  assert.match(rendered.container.querySelector('[data-cv-table-summary]')!.textContent!, /Showing 1 of 3 rows/)
  changeValue(ageFilter, '')
  await rendered.flush()
  const ageHeader = Array.from(rendered.container.querySelectorAll('[role="columnheader"]')).find((header) => header.textContent?.startsWith('age'))!
  click(ageHeader)
  await rendered.flush()
  assert.equal(ageHeader.getAttribute('aria-sort'), 'ascending')
  const firstCells = () => Array.from(rendered.container.querySelectorAll('[role="row"].cv-table-row')).map((row) => row.querySelector('[role="cell"]')!.textContent)
  assert.deepEqual(firstCells(), ['Bob', 'Alice', 'carol'])
  click(ageHeader)
  await rendered.flush()
  assert.deepEqual(firstCells(), ['carol', 'Alice', 'Bob'])
  await rendered.unmount()
})
