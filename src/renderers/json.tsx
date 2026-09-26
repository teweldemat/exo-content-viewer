import { useMemo, useState } from 'react'
import { TreeView } from '../shared/TreeView.js'
import { ErrorNotice, LoadingNotice } from '../shared/notices.js'
import { useSourceText } from '../shared/use-source-text.js'
import { CodeView } from './code.js'
import { MIB, extensionOf, mediaTypeOf } from './matching.js'
import type { ContentRenderProps } from './types.js'
import { RendererBar } from '../shared/renderer-bar.js'

export const STRUCTURED_MAX_BYTES = 8 * MIB

export type ParseResult = { ok: true; value: unknown } | { ok: false; error: string }

export function isJsonLines(source: ContentRenderProps['source']): boolean {
  const mediaType = mediaTypeOf(source)
  if (mediaType === 'application/x-ndjson' || mediaType === 'application/jsonl' || mediaType === 'application/x-jsonlines') return true
  const extension = extensionOf(source)
  return extension === 'jsonl' || extension === 'ndjson'
}

export function parseJsonDocument(text: string, jsonLines: boolean): ParseResult {
  try {
    if (!jsonLines) return { ok: true, value: JSON.parse(text) }
    const rows: unknown[] = []
    const lines = text.split(/\r\n|\r|\n/)
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!
      if (line.trim() === '') continue
      try {
        rows.push(JSON.parse(line))
      } catch (error) {
        return { ok: false, error: `line ${index + 1}: ${error instanceof Error ? error.message : String(error)}` }
      }
    }
    return { ok: true, value: rows }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export type StructuredViewProps = ContentRenderProps & {
  text: string
  parse: (text: string) => ParseResult
  label: string
}

/** Tree view with a raw toggle; used by the json and yaml-toml renderers. */
export function StructuredView(props: StructuredViewProps) {
  const { text, parse, label } = props
  const [raw, setRaw] = useState(false)
  const parsed = useMemo<ParseResult>(() => {
    if (text.length > STRUCTURED_MAX_BYTES) return { ok: false, error: `document exceeds ${STRUCTURED_MAX_BYTES / MIB} MiB` }
    return parse(text)
  }, [text, parse])
  if (!parsed.ok) {
    return (
      <div className="cv-structured" data-parse="failed">
        <ErrorNotice error={`${parsed.error}. Showing source.`} prefix={`Could not parse ${label}`} />
        <CodeView source={props.source} colorMode={props.colorMode} onNavigate={props.onNavigate} text={text} />
      </div>
    )
  }
  return (
    <div className="cv-structured" data-parse="ok">
      <RendererBar>
        <label className="cv-bar-toggle">
          <input type="checkbox" checked={raw} onChange={(event) => setRaw(event.target.checked)} /> Raw
        </label>
      </RendererBar>
      {raw
        ? <CodeView source={props.source} colorMode={props.colorMode} onNavigate={props.onNavigate} text={text} />
        : <TreeView value={parsed.value} />}
    </div>
  )
}

export function JsonView(props: ContentRenderProps & { text: string }) {
  const jsonLines = isJsonLines(props.source)
  const parse = useMemo(() => (text: string) => parseJsonDocument(text, jsonLines), [jsonLines])
  return <StructuredView {...props} parse={parse} label={jsonLines ? 'JSON Lines' : 'JSON'} />
}

export default function JsonRenderer(props: ContentRenderProps) {
  const text = useSourceText(props.source)
  if (text.status === 'loading') return <LoadingNotice label="JSON" />
  if (text.status === 'error') return <ErrorNotice error={text.error} prefix="Could not load text" />
  return <JsonView {...props} text={text.value} />
}
