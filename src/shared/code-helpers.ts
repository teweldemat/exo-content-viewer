export const CODE_MAX_HIGHLIGHT_BYTES = 512 * 1024
export const CODE_MAX_HIGHLIGHT_LINES = 20_000

export function splitLines(text: string): string[] {
  const lines = text.split(/\r\n|\r|\n/)
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

/** True when the file is too large for the highlighted view and the plain virtualized view is used instead. */
export function shouldUsePlainView(text: string, bytes: number | null | undefined, lineCount: number): boolean {
  const size = bytes ?? text.length
  return size > CODE_MAX_HIGHLIGHT_BYTES || lineCount > CODE_MAX_HIGHLIGHT_LINES
}

export type LineSelection = { start: number; end: number }

/** Parses `#L12` or `#L12-L20` (also `#L12-20`) into a 1-based inclusive selection. */
export function parseLineHash(hash: string | null | undefined): LineSelection | null {
  if (!hash) return null
  const match = /^#?L(\d+)(?:-L?(\d+))?$/i.exec(hash.trim())
  if (!match) return null
  const start = Number.parseInt(match[1]!, 10)
  const end = match[2] ? Number.parseInt(match[2], 10) : start
  if (!Number.isFinite(start) || start < 1) return null
  return start <= end ? { start, end } : { start: end, end: start }
}

export function formatLineHash(selection: LineSelection): string {
  return selection.start === selection.end ? `#L${selection.start}` : `#L${selection.start}-L${selection.end}`
}
