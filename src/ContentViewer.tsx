import { Component, Suspense, lazy, useMemo, useState, type ComponentType, type ErrorInfo, type LazyExoticComponent, type ReactNode } from 'react'
import { RendererBarSlotContext } from './shared/renderer-bar.js'
import { useColorScheme } from '@mui/material/styles'
import { Download } from 'lucide-react'
import type { ContentSource } from './content-source.js'
import { BINARY_RENDERER_ID, selectRenderers, type ColorMode, type ContentRenderProps, type ContentRenderer } from './renderers/types.js'
import { mergeRenderers } from './renderers/builtin.js'
import { formatBytes } from './shared/format.js'
import { rememberRendererFor, rememberedRendererFor } from './shared/preferences.js'

export type ContentViewerToolbar = 'full' | 'compact' | 'none'

export type ContentViewerProps = {
  source: ContentSource
  /** Merged with the built-ins; the caller's renderers win ties and replace built-ins with the same id. */
  renderers?: ContentRenderer[]
  /** Renderer to start with when it matches the source; otherwise the best match is used. */
  initialRendererId?: string
  /** Defaults to the MUI color scheme when a `CssVarsProvider`/`ThemeProvider` is present, else `light`. */
  colorMode?: ColorMode
  onNavigate?: (target: ContentSource | string) => void
  toolbar?: ContentViewerToolbar
  className?: string
  /**
   * Remember the renderer the user picks per content type (file extension, else media type)
   * in browser storage and reopen files of that type with it. Defaults to true; a remembered
   * choice wins over `initialRendererId`.
   */
  rememberChoices?: boolean
}

const lazyComponents = new WeakMap<ContentRenderer, LazyExoticComponent<ComponentType<ContentRenderProps>>>()

function lazyComponentFor(renderer: ContentRenderer): LazyExoticComponent<ComponentType<ContentRenderProps>> {
  let component = lazyComponents.get(renderer)
  if (!component) {
    component = lazy(() => renderer.load().then((loaded) => ({ default: loaded })))
    lazyComponents.set(renderer, component)
  }
  return component
}

function useResolvedColorMode(explicit: ColorMode | undefined): ColorMode {
  const scheme = useColorScheme()
  if (explicit) return explicit
  const mode = scheme?.mode === 'system' ? scheme.systemMode : scheme?.mode
  return mode === 'dark' ? 'dark' : 'light'
}

type BoundaryProps = {
  resetKey: string
  children: ReactNode
  fallback: (error: Error) => ReactNode
}

type BoundaryState = { error: Error | null; resetKey: string }

class RendererErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props)
    this.state = { error: null, resetKey: props.resetKey }
  }

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error }
  }

  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState): Partial<BoundaryState> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // The fallback UI is the report; nothing else to do.
  }

  render(): ReactNode {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children
  }
}

/**
 * Renders a `ContentSource` with the best matching renderer and lets the user switch between
 * every renderer that accepts the source.
 */
export function ContentViewer(props: ContentViewerProps) {
  const { source, initialRendererId, onNavigate, toolbar = 'full', className, rememberChoices = true } = props
  const colorMode = useResolvedColorMode(props.colorMode)
  const renderers = useMemo(() => mergeRenderers(props.renderers), [props.renderers])
  const matched = useMemo(() => selectRenderers(source, renderers), [source, renderers])
  const [choice, setChoice] = useState<{ source: ContentSource; id: string } | null>(null)
  const remembered = useMemo(() => (rememberChoices ? rememberedRendererFor(source) : null), [rememberChoices, source])
  const rememberedMatches = remembered !== null && matched.some((renderer) => renderer.id === remembered)
  const requestedId = choice && choice.source === source ? choice.id : rememberedMatches ? remembered : initialRendererId
  const active = matched.find((renderer) => renderer.id === requestedId) ?? matched[0] ?? null
  const downloadUrl = source.url({ download: true })
  const codeRenderer = matched.find((renderer) => renderer.id === 'code') ?? null
  const binaryRenderer = matched.find((renderer) => renderer.id === BINARY_RENDERER_ID) ?? null

  const select = (id: string) => {
    setChoice({ source, id })
    if (rememberChoices) rememberRendererFor(source, id)
  }
  // Renderer controls (wrap, go-to-line, zoom, ...) are portaled into this slot so the viewer
  // shows one toolbar row. Compact mode leaves file metadata and download to the host page.
  const [barSlot, setBarSlot] = useState<HTMLElement | null>(null)

  if (!active) {
    return (
      <div className={`cv-root${className ? ` ${className}` : ''}`} data-color-mode={colorMode}>
        <div className="cv-notice cv-error-text" role="alert">No renderer accepts {source.name}.</div>
      </div>
    )
  }

  const Renderer = lazyComponentFor(active)
  const meta = [formatBytes(source.bytes), source.mediaType ?? ''].filter(Boolean).join(' · ')

  return (
    <div className={`cv-root${className ? ` ${className}` : ''}`} data-color-mode={colorMode} data-renderer={active.id}>
      {toolbar !== 'none' ? (
        <div className={`cv-toolbar cv-toolbar-${toolbar}`}>
          {toolbar === 'full' ? <span className="cv-toolbar-label">{active.label}</span> : null}
          {matched.length > 1 ? (
            <label className="cv-toolbar-viewas">
              <span className="cv-toolbar-viewas-text">View as</span>
              <select className="cv-select" aria-label="View as" value={active.id} onChange={(event) => select(event.target.value)}>
                {matched.map((renderer) => <option key={renderer.id} value={renderer.id}>{renderer.label}</option>)}
              </select>
            </label>
          ) : null}
          <div className="cv-toolbar-slot" ref={setBarSlot} />
          <span className="cv-bar-spacer" />
          {toolbar === 'full' && meta ? <span className="cv-toolbar-meta cv-muted">{meta}</span> : null}
          {toolbar === 'full' && downloadUrl ? (
            <a className="cv-button cv-button-icon" href={downloadUrl} download={source.name} title={`Download ${source.name}`} aria-label={`Download ${source.name}`}>
              <Download size={16} />
              <span>Download</span>
            </a>
          ) : null}
        </div>
      ) : null}
      <RendererBarSlotContext.Provider value={toolbar === 'none' ? null : barSlot}>
      <div className="cv-body">
        <RendererErrorBoundary
          resetKey={`${active.id}`}
          fallback={(error) => (
            <div className="cv-notice cv-renderer-error" role="alert">
              <p className="cv-error-text">The {active.label} view failed: {error.message}</p>
              <div className="cv-button-group">
                {codeRenderer && codeRenderer.id !== active.id
                  ? <button type="button" className="cv-button" onClick={() => select(codeRenderer.id)}>View as plain text</button>
                  : null}
                {binaryRenderer && binaryRenderer.id !== active.id
                  ? <button type="button" className="cv-button" onClick={() => select(binaryRenderer.id)}>View as binary</button>
                  : null}
              </div>
            </div>
          )}
        >
          <Suspense fallback={<div className="cv-notice cv-muted" role="status">Loading {active.label} view…</div>}>
            <Renderer source={source} colorMode={colorMode} onNavigate={onNavigate} />
          </Suspense>
        </RendererErrorBoundary>
      </div>
      </RendererBarSlotContext.Provider>
    </div>
  )
}
