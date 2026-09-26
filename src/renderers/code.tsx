import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Check, Copy } from 'lucide-react'
import { CodeBlock } from '../shared/CodeBlock.js'
import { formatLineHash, parseLineHash, shouldUsePlainView, splitLines, type LineSelection } from '../shared/code-helpers.js'
import { resolveLanguage } from '../shared/highlighter.js'
import { ErrorNotice, LoadingNotice } from '../shared/notices.js'
import { useSourceText } from '../shared/use-source-text.js'
import { fileNameOf } from './matching.js'
import type { ContentRenderProps } from './types.js'
import { RendererBar } from '../shared/renderer-bar.js'

export type CodeViewProps = ContentRenderProps & { text: string }

function currentHash(): string | null {
  return typeof window === 'undefined' ? null : window.location.hash
}

function useLineSelection(): [LineSelection | null, (line: number, extend: boolean) => void] {
  const [selection, setSelection] = useState<LineSelection | null>(() => parseLineHash(currentHash()))
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onHashChange = () => setSelection(parseLineHash(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  const select = useCallback((line: number, extend: boolean) => {
    setSelection((previous) => {
      const next = extend && previous
        ? { start: Math.min(previous.start, line), end: Math.max(previous.end, line) }
        : { start: line, end: line }
      if (typeof window !== 'undefined' && typeof window.history?.replaceState === 'function') {
        window.history.replaceState(null, '', formatLineHash(next))
      }
      return next
    })
  }, [])
  return [selection, select]
}

function PlainLines(props: { lines: string[]; wrap: boolean; selection: LineSelection | null; onLineClick: (line: number, event: { shiftKey: boolean }) => void }) {
  const { lines, wrap, selection, onLineClick } = props
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 20,
    overscan: 30,
    initialRect: { width: 800, height: 600 },
  })
  return (
    <div ref={parentRef} className={`cv-code cv-code-plain cv-code-numbered${wrap ? ' cv-code-wrap' : ''}`} data-virtualized="true">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((item) => {
          const number = item.index + 1
          const selected = selection ? number >= selection.start && number <= selection.end : false
          return (
            <div
              key={item.key}
              className={selected ? 'cv-code-row cv-code-row-selected' : 'cv-code-row'}
              data-line={number}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${item.start}px)` }}
            >
              <span className="cv-code-ln" role="button" onClick={(event) => onLineClick(number, { shiftKey: event.shiftKey })}>{number}</span>
              <span className="cv-code-text">{lines[item.index]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Highlighted source view with line numbers, wrap toggle, copy, go-to-line and `#L12-L20` selection. */
export function CodeView(props: CodeViewProps) {
  const { text, source, colorMode } = props
  const lines = useMemo(() => splitLines(text), [text])
  const plain = shouldUsePlainView(text, source.bytes, lines.length)
  const language = useMemo(() => resolveLanguage(fileNameOf(source)), [source])
  const [wrap, setWrap] = useState(false)
  const [selection, select] = useLineSelection()
  const [gotoValue, setGotoValue] = useState('')
  const [copied, setCopied] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selection || !containerRef.current) return
    const row = containerRef.current.querySelector<HTMLElement>(`[data-line="${selection.start}"]`)
    if (row && typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'center' })
  }, [selection])

  const onLineClick = useCallback((line: number, event: { shiftKey: boolean }) => select(line, event.shiftKey), [select])
  const goTo = (event: FormEvent) => {
    event.preventDefault()
    const line = Number.parseInt(gotoValue, 10)
    if (Number.isFinite(line) && line >= 1 && line <= lines.length) select(line, false)
  }
  const copy = () => {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
    if (!clipboard?.writeText) return
    clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200) }, () => undefined)
  }

  return (
    <div className="cv-code-view" data-cv-code-mode={plain ? 'plain' : 'highlighted'} ref={containerRef}>
      <RendererBar>
        <span className="cv-muted">{lines.length.toLocaleString()} line{lines.length === 1 ? '' : 's'}{language ? ` · ${language}` : ''}{plain ? ' · large file, plain view' : ''}</span>
        <label className="cv-bar-toggle">
          <input type="checkbox" checked={wrap} onChange={(event) => setWrap(event.target.checked)} /> Wrap
        </label>
        <form className="cv-goto" onSubmit={goTo}>
          <input
            className="cv-input"
            type="number"
            min={1}
            max={lines.length}
            placeholder="Line"
            aria-label="Go to line"
            value={gotoValue}
            onChange={(event) => setGotoValue(event.target.value)}
          />
          <button type="submit" className="cv-button">Go</button>
        </form>
        <button type="button" className="cv-button cv-button-icon" onClick={copy} aria-label="Copy contents" title="Copy contents">
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </RendererBar>
      {plain
        ? <PlainLines lines={lines} wrap={wrap} selection={selection} onLineClick={onLineClick} />
        : <CodeBlock code={text} language={language} colorMode={colorMode} lineNumbers wrap={wrap} selection={selection} onLineClick={onLineClick} />}
    </div>
  )
}

export default function CodeRenderer(props: ContentRenderProps) {
  const text = useSourceText(props.source)
  if (text.status === 'loading') return <LoadingNotice label="source" />
  if (text.status === 'error') return <ErrorNotice error={text.error} prefix="Could not load text" />
  return <CodeView {...props} text={text.value} />
}
