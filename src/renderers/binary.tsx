import { Download } from 'lucide-react'
import { formatBytes } from '../shared/format.js'
import type { ContentRenderProps } from './types.js'

/** The last-resort view: metadata and a download link. */
export function BinaryView({ source }: ContentRenderProps) {
  const download = source.url({ download: true })
  return (
    <div className="cv-binary">
      <dl className="cv-binary-meta">
        <dt>Name</dt><dd>{source.name}</dd>
        {source.path ? <><dt>Path</dt><dd>{source.path}</dd></> : null}
        <dt>Size</dt><dd>{source.bytes != null ? `${formatBytes(source.bytes)} (${source.bytes.toLocaleString()} bytes)` : 'unknown'}</dd>
        <dt>Media type</dt><dd>{source.mediaType ?? 'unknown'}</dd>
        {source.sha256 ? <><dt>SHA-256</dt><dd className="cv-mono">{source.sha256}</dd></> : null}
        {source.modifiedAt ? <><dt>Modified</dt><dd>{source.modifiedAt}</dd></> : null}
      </dl>
      {download
        ? <a className="cv-button cv-button-primary" href={download} download={source.name}><Download size={14} /> Download</a>
        : <p className="cv-muted">No preview or download is available for this file.</p>}
    </div>
  )
}

export default function BinaryRenderer(props: ContentRenderProps) {
  return <BinaryView {...props} />
}
