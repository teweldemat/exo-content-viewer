import { useEffect, useState } from 'react'
import type { ColorMode } from '../renderers/types.js'
import { CodeBlock } from './CodeBlock.js'

export const MERMAID_MAX_BYTES = 50 * 1024

let renderCounter = 0

/**
 * Renders a Mermaid definition to SVG with `securityLevel: 'strict'` and shows it through an
 * `<img>` data URL, so the SVG is never inlined into the document and cannot run script.
 */
export async function renderMermaid(definition: string, colorMode: ColorMode): Promise<string> {
  const mermaid = (await import('mermaid')).default
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: colorMode === 'dark' ? 'dark' : 'default',
    htmlLabels: false,
    flowchart: { htmlLabels: false },
  })
  renderCounter += 1
  const { svg } = await mermaid.render(`cv-mermaid-${renderCounter}`, definition)
  return svg
}

export function mermaidDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

type MermaidState =
  | { status: 'loading' }
  | { status: 'ready'; svg: string }
  | { status: 'error'; message: string }

export function MermaidBlock({ code, colorMode }: { code: string; colorMode: ColorMode }) {
  const [state, setState] = useState<MermaidState>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    if (code.length > MERMAID_MAX_BYTES) {
      setState({ status: 'error', message: `Diagram definition exceeds ${MERMAID_MAX_BYTES / 1024} KiB; showing source.` })
      return () => { cancelled = true }
    }
    setState({ status: 'loading' })
    renderMermaid(code, colorMode).then(
      (svg) => { if (!cancelled) setState({ status: 'ready', svg }) },
      (error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
      },
    )
    return () => { cancelled = true }
  }, [code, colorMode])

  if (state.status === 'ready') {
    return (
      <figure className="cv-mermaid">
        <img alt="Mermaid diagram" src={mermaidDataUrl(state.svg)} />
      </figure>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="cv-mermaid cv-mermaid-error">
        <p className="cv-error-text" role="alert">Mermaid diagram could not be rendered: {state.message}</p>
        <CodeBlock code={code} language="mermaid" colorMode={colorMode} />
      </div>
    )
  }
  return <div className="cv-mermaid cv-mermaid-loading cv-muted">Rendering diagram…</div>
}
