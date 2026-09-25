import { useState } from 'react'
import CodeRenderer from './code.js'
import type { ContentRenderProps } from './types.js'

/**
 * HTML is shown in a fully sandboxed iframe (`sandbox=""`, no same-origin, no scripts) loaded from the
 * preview URL, never through `srcdoc`. "View source" switches to the code renderer.
 */
export function HtmlView(props: ContentRenderProps) {
  const { source } = props
  const url = source.url({ preview: true })
  const [showSource, setShowSource] = useState(url === null)
  return (
    <div className="cv-html" data-view={showSource ? 'source' : 'preview'}>
      <div className="cv-bar">
        <label className="cv-bar-toggle">
          <input type="checkbox" checked={showSource} onChange={(event) => setShowSource(event.target.checked)} disabled={url === null} /> View source
        </label>
        <span className="cv-muted">{url === null ? 'No preview URL; showing source.' : 'Sandboxed preview: scripts, forms and navigation are disabled.'}</span>
      </div>
      {showSource || url === null
        ? <CodeRenderer {...props} />
        : <iframe className="cv-html-frame" sandbox="" src={url} title={source.name} referrerPolicy="no-referrer" loading="lazy" />}
    </div>
  )
}

export default function HtmlRenderer(props: ContentRenderProps) {
  return <HtmlView {...props} />
}
