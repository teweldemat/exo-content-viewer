import Papa from 'papaparse'

export type ParsedTable = {
  header: string[]
  rows: string[][]
  delimiter: string
  errors: string[]
}

const TAB = String.fromCharCode(9)
export const TABLE_DELIMITERS = [',', TAB, ';', '|']

/** Parses delimited text. The delimiter is auto-detected unless the name says `.tsv`/`.tab`. */
export function parseDelimited(text: string, name?: string | null): ParsedTable {
  const lower = (name ?? '').toLowerCase()
  const forced = lower.endsWith('.tsv') || lower.endsWith('.tab') ? TAB : undefined
  const result = Papa.parse<string[]>(text, {
    delimiter: forced,
    delimitersToGuess: TABLE_DELIMITERS,
    skipEmptyLines: 'greedy',
  })
  const data = result.data.map((row) => row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))))
  const header = data.length > 0 ? data[0]! : []
  const width = data.reduce((max, row) => Math.max(max, row.length), header.length)
  const normalizedHeader = Array.from({ length: width }, (_, index) => header[index] ?? `Column ${index + 1}`)
  const rows = data.slice(1).map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ''))
  return {
    header: normalizedHeader,
    rows,
    delimiter: result.meta.delimiter ?? forced ?? ',',
    errors: result.errors.map((error) => `${error.code}: ${error.message}${error.row !== undefined ? ` (row ${error.row})` : ''}`),
  }
}

const numericPattern = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i

/** Numeric-aware comparison; falls back to a locale string compare. Empty cells sort last. */
export function compareCells(left: string, right: string): number {
  if (left === right) return 0
  if (left === '') return 1
  if (right === '') return -1
  const leftTrim = left.trim()
  const rightTrim = right.trim()
  if (numericPattern.test(leftTrim) && numericPattern.test(rightTrim)) {
    return Number.parseFloat(leftTrim) - Number.parseFloat(rightTrim)
  }
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
}

export type SortDirection = 'asc' | 'desc'

export function sortRows(rows: string[][], column: number, direction: SortDirection): string[][] {
  const sign = direction === 'asc' ? 1 : -1
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftCell = left.row[column] ?? ''
      const rightCell = right.row[column] ?? ''
      const leftEmpty = leftCell === ''
      const rightEmpty = rightCell === ''
      if (leftEmpty !== rightEmpty) return leftEmpty ? 1 : -1
      const delta = leftEmpty ? 0 : compareCells(leftCell, rightCell) * sign
      return delta !== 0 ? delta : left.index - right.index
    })
    .map((entry) => entry.row)
}

/** Keeps rows whose cell in each filtered column contains the filter text (case-insensitive). */
export function filterRows(rows: string[][], filters: ReadonlyArray<string | undefined>): string[][] {
  const active = filters
    .map((filter, column) => ({ column, needle: (filter ?? '').trim().toLowerCase() }))
    .filter((entry) => entry.needle.length > 0)
  if (active.length === 0) return rows
  return rows.filter((row) => active.every((entry) => (row[entry.column] ?? '').toLowerCase().includes(entry.needle)))
}
