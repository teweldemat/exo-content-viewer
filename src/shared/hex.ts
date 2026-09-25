export const HEX_DUMP_LIMIT = 64 * 1024
export const HEX_BYTES_PER_LINE = 16

/** Classic hex dump: offset, sixteen hex bytes split in two groups, and an ASCII gutter. */
export function hexDump(bytes: Uint8Array, limit = HEX_DUMP_LIMIT): string {
  const end = Math.min(bytes.length, limit)
  const lines: string[] = []
  for (let offset = 0; offset < end; offset += HEX_BYTES_PER_LINE) {
    const slice = bytes.subarray(offset, Math.min(offset + HEX_BYTES_PER_LINE, end))
    const hex: string[] = []
    let ascii = ''
    for (let index = 0; index < HEX_BYTES_PER_LINE; index += 1) {
      if (index === HEX_BYTES_PER_LINE / 2) hex.push('')
      if (index < slice.length) {
        const byte = slice[index]!
        hex.push(byte.toString(16).padStart(2, '0'))
        ascii += byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : '.'
      } else {
        hex.push('  ')
      }
    }
    lines.push(`${offset.toString(16).padStart(8, '0')}  ${hex.join(' ')}  |${ascii}|`)
  }
  return lines.join('\n')
}
