import { useMemo } from 'react'
import { formatBytes } from '../shared/format.js'
import { HEX_DUMP_LIMIT, hexDump } from '../shared/hex.js'
import { ErrorNotice, LoadingNotice } from '../shared/notices.js'
import { useSourceBytes } from '../shared/use-source-text.js'
import { MIB } from './matching.js'
import type { ContentRenderProps } from './types.js'

export const HEX_MAX_BYTES = 1 * MIB

export function HexView({ bytes }: { bytes: Uint8Array }) {
  const dump = useMemo(() => hexDump(bytes, HEX_DUMP_LIMIT), [bytes])
  const truncated = bytes.length > HEX_DUMP_LIMIT
  return (
    <div className="cv-hex">
      <div className="cv-bar">
        <span className="cv-muted">
          {truncated ? `Showing the first ${formatBytes(HEX_DUMP_LIMIT)} of ${formatBytes(bytes.length)}` : `${formatBytes(bytes.length) || '0 B'}`}
        </span>
      </div>
      <pre className="cv-hex-dump">{dump}</pre>
    </div>
  )
}

export default function HexRenderer(props: ContentRenderProps) {
  const bytes = useSourceBytes(props.source)
  if (bytes.status === 'loading') return <LoadingNotice label="bytes" />
  if (bytes.status === 'error') return <ErrorNotice error={bytes.error} prefix="Could not load bytes" />
  return <HexView bytes={bytes.value} />
}
