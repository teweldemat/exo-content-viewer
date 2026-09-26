import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ErrorNotice, LoadingNotice } from '../shared/notices.js'
import { filterRows, parseDelimited, sortRows, type SortDirection } from '../shared/table-helpers.js'
import { useSourceText } from '../shared/use-source-text.js'
import { MIB, fileNameOf } from './matching.js'
import type { ContentRenderProps } from './types.js'
import { RendererBar } from '../shared/renderer-bar.js'

export const TABLE_MAX_BYTES = 16 * MIB

const delimiterNames: Record<string, string> = { ',': 'comma', '\t': 'tab', ';': 'semicolon', '|': 'pipe' }

export function TableView(props: ContentRenderProps & { text: string }) {
  const { text, source } = props
  const parsed = useMemo(() => parseDelimited(text, fileNameOf(source)), [text, source])
  const [sort, setSort] = useState<{ column: number; direction: SortDirection } | null>(null)
  const [filters, setFilters] = useState<string[]>([])
  const visible = useMemo(() => {
    const filtered = filterRows(parsed.rows, filters)
    return sort ? sortRows(filtered, sort.column, sort.direction) : filtered
  }, [parsed.rows, filters, sort])
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 20,
    initialRect: { width: 800, height: 600 },
  })
  const columns = parsed.header.length
  const gridTemplateColumns = `repeat(${columns}, minmax(120px, 1fr))`
  const toggleSort = (column: number) => {
    setSort((previous) => {
      if (!previous || previous.column !== column) return { column, direction: 'asc' }
      return previous.direction === 'asc' ? { column, direction: 'desc' } : null
    })
  }
  return (
    <div className="cv-table" data-delimiter={parsed.delimiter}>
      <RendererBar>
        <span className="cv-muted" data-cv-table-summary>Showing {visible.length.toLocaleString()} of {parsed.rows.length.toLocaleString()} rows</span>
        <span className="cv-muted">{columns} columns · {delimiterNames[parsed.delimiter] ?? JSON.stringify(parsed.delimiter)} delimited</span>
        {parsed.errors.length > 0 ? <span className="cv-error-text">{parsed.errors.length} parse warning{parsed.errors.length === 1 ? '' : 's'}</span> : null}
      </RendererBar>
      <div className="cv-table-grid" role="table" aria-rowcount={parsed.rows.length}>
        <div className="cv-table-header" role="row" style={{ gridTemplateColumns }}>
          {parsed.header.map((name, column) => (
            <button
              key={column}
              type="button"
              role="columnheader"
              className="cv-table-th"
              aria-sort={sort?.column === column ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
              onClick={() => toggleSort(column)}
            >
              {name}
              {sort?.column === column ? <span className="cv-table-sort">{sort.direction === 'asc' ? '▲' : '▼'}</span> : null}
            </button>
          ))}
        </div>
        <div className="cv-table-filters" role="row" style={{ gridTemplateColumns }}>
          {parsed.header.map((name, column) => (
            <input
              key={column}
              className="cv-input"
              type="search"
              placeholder="Filter"
              aria-label={`Filter ${name}`}
              value={filters[column] ?? ''}
              onChange={(event) => {
                const next = filters.slice()
                next[column] = event.target.value
                setFilters(next)
              }}
            />
          ))}
        </div>
        <div ref={parentRef} className="cv-table-body" data-virtualized="true">
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((item) => {
              const row = visible[item.index]!
              return (
                <div
                  key={item.key}
                  role="row"
                  className="cv-table-row"
                  style={{ gridTemplateColumns, position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${item.start}px)` }}
                >
                  {row.map((cell, column) => (
                    <div key={column} role="cell" className="cv-table-td" title={cell}>{cell}</div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TableRenderer(props: ContentRenderProps) {
  const text = useSourceText(props.source)
  if (text.status === 'loading') return <LoadingNotice label="table" />
  if (text.status === 'error') return <ErrorNotice error={text.error} prefix="Could not load text" />
  return <TableView {...props} text={text.value} />
}
