import { useMemo, type ReactNode } from 'react'
import { CodeBlock } from '../shared/CodeBlock.js'
import { SanitizedHtml } from '../shared/SanitizedHtml.js'
import { TreeView } from '../shared/TreeView.js'
import { stripAnsi } from '../shared/format.js'
import { ErrorNotice, LoadingNotice } from '../shared/notices.js'
import { useSourceText } from '../shared/use-source-text.js'
import { CodeView } from './code.js'
import { MarkdownView } from './markdown.js'
import type { ContentRenderProps } from './types.js'

export type NotebookOutput = {
  output_type: 'stream' | 'display_data' | 'execute_result' | 'error' | string
  name?: string
  text?: string | string[]
  data?: Record<string, unknown>
  ename?: string
  evalue?: string
  traceback?: string[]
  execution_count?: number | null
}

export type NotebookCell = {
  cell_type: 'markdown' | 'code' | 'raw' | string
  source: string | string[]
  outputs?: NotebookOutput[]
  execution_count?: number | null
}

export type ParsedNotebook = { cells: NotebookCell[]; language: string | null }

export function joinSource(value: unknown): string {
  if (Array.isArray(value)) return value.map((entry) => String(entry)).join('')
  if (value === null || value === undefined) return ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

export function parseNotebook(text: string): ParsedNotebook {
  const raw = JSON.parse(text) as { cells?: unknown; metadata?: { language_info?: { name?: string }; kernelspec?: { language?: string } } }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.cells)) throw new Error('not a Jupyter notebook: missing cells array')
  const cells = raw.cells.filter((cell): cell is NotebookCell => Boolean(cell) && typeof cell === 'object' && typeof (cell as NotebookCell).cell_type === 'string')
  const language = raw.metadata?.language_info?.name ?? raw.metadata?.kernelspec?.language ?? null
  return { cells, language }
}

const imageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const

function OutputData({ data, colorMode, source, onNavigate }: { data: Record<string, unknown> } & ContentRenderProps): ReactNode {
  for (const mime of imageTypes) {
    if (data[mime] !== undefined) {
      const payload = joinSource(data[mime]).replace(/\s+/g, '')
      return <img className="cv-nb-image" alt="Notebook output" src={`data:${mime};base64,${payload}`} />
    }
  }
  if (data['image/svg+xml'] !== undefined) {
    const svg = joinSource(data['image/svg+xml'])
    return <img className="cv-nb-image" alt="Notebook SVG output" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} />
  }
  if (data['text/html'] !== undefined) {
    return <SanitizedHtml className="cv-nb-html" html={joinSource(data['text/html'])} />
  }
  if (data['text/markdown'] !== undefined) {
    return <MarkdownView text={joinSource(data['text/markdown'])} source={source} colorMode={colorMode} onNavigate={onNavigate} />
  }
  if (data['application/json'] !== undefined) {
    return <TreeView value={data['application/json']} initialDepth={3} />
  }
  if (data['text/plain'] !== undefined) {
    return <pre className="cv-nb-text">{joinSource(data['text/plain'])}</pre>
  }
  const types = Object.keys(data)
  return <p className="cv-muted">Unsupported output type{types.length === 1 ? '' : 's'}: {types.join(', ') || 'none'}</p>
}

function Output({ output, ...props }: { output: NotebookOutput } & ContentRenderProps): ReactNode {
  switch (output.output_type) {
    case 'stream':
      return <pre className={`cv-nb-stream cv-nb-stream-${output.name ?? 'stdout'}`}>{joinSource(output.text)}</pre>
    case 'error': {
      const traceback = output.traceback && output.traceback.length > 0
        ? output.traceback.join('\n')
        : `${output.ename ?? 'Error'}: ${output.evalue ?? ''}`
      return (
        <div className="cv-nb-error" role="alert">
          <CodeBlock code={stripAnsi(traceback)} language={null} colorMode={props.colorMode} />
        </div>
      )
    }
    case 'display_data':
    case 'execute_result':
      return <OutputData data={output.data ?? {}} {...props} />
    default:
      return <p className="cv-muted">Unknown output type: {output.output_type}</p>
  }
}

export function NotebookView(props: ContentRenderProps & { text: string }) {
  const { text, source, colorMode, onNavigate } = props
  const parsed = useMemo<{ ok: true; notebook: ParsedNotebook } | { ok: false; error: string }>(() => {
    try {
      return { ok: true, notebook: parseNotebook(text) }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }, [text])
  if (!parsed.ok) {
    return (
      <div className="cv-notebook" data-parse="failed">
        <ErrorNotice error={`${parsed.error}. Showing source.`} prefix="Could not parse notebook" />
        <CodeView source={source} colorMode={colorMode} onNavigate={onNavigate} text={text} />
      </div>
    )
  }
  const { cells, language } = parsed.notebook
  return (
    <div className="cv-notebook" data-parse="ok" data-language={language ?? undefined}>
      {cells.map((cell, index) => {
        const body = joinSource(cell.source)
        if (cell.cell_type === 'markdown') {
          return (
            <section key={index} className="cv-nb-cell cv-nb-markdown">
              <MarkdownView text={body} source={source} colorMode={colorMode} onNavigate={onNavigate} />
            </section>
          )
        }
        if (cell.cell_type === 'code') {
          const count = cell.execution_count ?? null
          return (
            <section key={index} className="cv-nb-cell cv-nb-code">
              <div className="cv-nb-input">
                <span className="cv-nb-prompt">In [{count ?? ' '}]:</span>
                <CodeBlock code={body} language={language} colorMode={colorMode} />
              </div>
              {(cell.outputs ?? []).map((output, outputIndex) => (
                <div key={outputIndex} className="cv-nb-output" data-output-type={output.output_type}>
                  <Output output={output} source={source} colorMode={colorMode} onNavigate={onNavigate} />
                </div>
              ))}
            </section>
          )
        }
        return (
          <section key={index} className="cv-nb-cell cv-nb-raw">
            <pre className="cv-nb-text">{body}</pre>
          </section>
        )
      })}
    </div>
  )
}

export default function NotebookRenderer(props: ContentRenderProps) {
  const text = useSourceText(props.source)
  if (text.status === 'loading') return <LoadingNotice label="notebook" />
  if (text.status === 'error') return <ErrorNotice error={text.error} prefix="Could not load text" />
  return <NotebookView {...props} text={text.value} />
}
