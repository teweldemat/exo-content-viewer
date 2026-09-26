import { useState } from 'react'
import CodeRenderer from './code.js'
import type { ContentRenderProps } from './types.js'
import { RendererBar } from '../shared/renderer-bar.js'

/** SVG is shown only through `<img>`, so embedded scripts never run; "View source" switches to the code renderer. */
export function SvgView(props: ContentRenderProps) {
  const { source } = props
  const url = source.url({ preview: true })
  const [showSource, setShowSource] = useState(url === null)
  return (
    <div className="cv-svg" data-view={showSource ? 'source' : 'image'}>
      <RendererBar>
        <label className="cv-bar-toggle">
          <input type="checkbox" checked={showSource} onChange={(event) => setShowSource(event.target.checked)} disabled={url === null} /> View source
        </label>
        {url === null ? <span className="cv-muted">No preview URL; showing source.</span> : null}
      </RendererBar>
      {showSource || url === null
        ? <CodeRenderer {...props} />
        : (
          <div className="cv-image-stage cv-checkerboard">
            <img src={url} alt={source.name} style={{ maxWidth: '100%', height: 'auto' }} draggable={false} />
          </div>
        )}
    </div>
  )
}

export default function SvgRenderer(props: ContentRenderProps) {
  return <SvgView {...props} />
}
