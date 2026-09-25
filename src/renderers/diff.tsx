import { useMemo, useState, type ReactNode } from 'react'
import { parse as parseDiff } from 'diff2html'
import type { DiffBlock, DiffFile, DiffLine } from 'diff2html/lib/types.js'
import { ErrorNotice, LoadingNotice } from '../shared/notices.js'
import { useSourceText } from '../shared/use-source-text.js'
import type { ContentRenderProps } from './types.js'

export type DiffMode = 'line-by-line' | 'side-by-side'

export function parseUnifiedDiff(text: string): DiffFile[] {
  return parseDiff(text, { drawFileList: false })
}

function lineClass(line: DiffLine | null): string {
  if (!line) return 'd2h-code-side-emptyplaceholder'
  if (line.type === 'insert') return 'd2h-ins'
  if (line.type === 'delete') return 'd2h-del'
  return 'd2h-cntx'
}

function splitPrefix(content: string): { prefix: string; text: string } {
  const prefix = content.charAt(0)
  return prefix === '+' || prefix === '-' || prefix === ' ' ? { prefix, text: content.slice(1) } : { prefix: '', text: content }
}

function fileLabel(file: DiffFile): { name: string; tag: string; tagClass: string } {
  if (file.isNew) return { name: file.newName, tag: 'ADDED', tagClass: 'd2h-added' }
  if (file.isDeleted) return { name: file.oldName, tag: 'DELETED', tagClass: 'd2h-deleted' }
  if (file.isRename || (file.oldName !== file.newName && file.oldName !== '/dev/null')) {
    return { name: `${file.oldName} → ${file.newName}`, tag: 'RENAMED', tagClass: 'd2h-moved' }
  }
  return { name: file.newName, tag: 'CHANGED', tagClass: 'd2h-changed' }
}

function FileHeader({ file }: { file: DiffFile }) {
  const label = fileLabel(file)
  return (
    <div className="d2h-file-header">
      <span className="d2h-file-name-wrapper">
        <span className="d2h-file-name">{label.name}</span>
        <span className={`d2h-tag ${label.tagClass} ${label.tagClass}-tag`}>{label.tag}</span>
      </span>
      <span className="d2h-file-stats">
        <span className="d2h-lines-added">+{file.addedLines}</span>
        <span className="d2h-lines-deleted">-{file.deletedLines}</span>
      </span>
    </div>
  )
}

function LineByLine({ file }: { file: DiffFile }) {
  return (
    <div className="d2h-file-diff">
      <div className="d2h-code-wrapper">
        <table className="d2h-diff-table">
          <tbody className="d2h-diff-tbody">
            {file.blocks.flatMap((block, blockIndex) => [
              <tr key={`h${blockIndex}`}>
                <td className="d2h-code-linenumber d2h-info" />
                <td className="d2h-info"><div className="d2h-code-line">{block.header}</div></td>
              </tr>,
              ...block.lines.map((line, lineIndex) => {
                const parts = splitPrefix(line.content)
                return (
                  <tr key={`${blockIndex}-${lineIndex}`}>
                    <td className={`d2h-code-linenumber ${lineClass(line)}`}>
                      <div className="line-num1">{line.oldNumber ?? ''}</div>
                      <div className="line-num2">{line.newNumber ?? ''}</div>
                    </td>
                    <td className={lineClass(line)}>
                      <div className="d2h-code-line">
                        <span className="d2h-code-line-prefix">{parts.prefix || ' '}</span>
                        <span className="d2h-code-line-ctn">{parts.text}</span>
                      </div>
                    </td>
                  </tr>
                )
              }),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export type SidePair = { left: DiffLine | null; right: DiffLine | null }

/** Pairs deletions with the insertions that follow them, as side-by-side views do. */
export function pairBlockLines(block: DiffBlock): SidePair[] {
  const pairs: SidePair[] = []
  let pendingDeletes: DiffLine[] = []
  let pendingInserts: DiffLine[] = []
  const flush = () => {
    const length = Math.max(pendingDeletes.length, pendingInserts.length)
    for (let index = 0; index < length; index += 1) {
      pairs.push({ left: pendingDeletes[index] ?? null, right: pendingInserts[index] ?? null })
    }
    pendingDeletes = []
    pendingInserts = []
  }
  for (const line of block.lines) {
    if (line.type === 'delete') {
      if (pendingInserts.length > 0) flush()
      pendingDeletes.push(line)
    } else if (line.type === 'insert') {
      pendingInserts.push(line)
    } else {
      flush()
      pairs.push({ left: line, right: line })
    }
  }
  flush()
  return pairs
}

function SideCell({ line, number }: { line: DiffLine | null; number: number | undefined }): ReactNode {
  const parts = line ? splitPrefix(line.content) : null
  return (
    <>
      <td className={`d2h-code-side-linenumber ${lineClass(line)}`}>{number ?? ''}</td>
      <td className={lineClass(line)}>
        <div className="d2h-code-side-line">
          {parts ? <span className="d2h-code-line-prefix">{parts.prefix || ' '}</span> : null}
          {parts ? <span className="d2h-code-line-ctn">{parts.text}</span> : null}
        </div>
      </td>
    </>
  )
}

function SideBySide({ file }: { file: DiffFile }) {
  const sides = (pick: (pair: SidePair) => DiffLine | null, numberOf: (line: DiffLine) => number | undefined) => (
    <div className="d2h-file-side-diff">
      <div className="d2h-code-wrapper">
        <table className="d2h-diff-table">
          <tbody className="d2h-diff-tbody">
            {file.blocks.flatMap((block, blockIndex) => [
              <tr key={`h${blockIndex}`}>
                <td className="d2h-code-side-linenumber d2h-info" />
                <td className="d2h-info"><div className="d2h-code-side-line">{block.header}</div></td>
              </tr>,
              ...pairBlockLines(block).map((pair, pairIndex) => {
                const line = pick(pair)
                return <tr key={`${blockIndex}-${pairIndex}`}><SideCell line={line} number={line ? numberOf(line) : undefined} /></tr>
              }),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  )
  return (
    <div className="d2h-files-diff">
      {sides((pair) => pair.left, (line) => line.oldNumber)}
      {sides((pair) => pair.right, (line) => line.newNumber)}
    </div>
  )
}

export function DiffView(props: ContentRenderProps & { text: string; initialMode?: DiffMode }) {
  const { text, colorMode } = props
  const [mode, setMode] = useState<DiffMode>(props.initialMode ?? 'line-by-line')
  const files = useMemo(() => parseUnifiedDiff(text), [text])
  return (
    <div className={`cv-diff d2h-wrapper${colorMode === 'dark' ? ' d2h-dark-color-scheme' : ' d2h-light-color-scheme'}`} data-mode={mode}>
      <div className="cv-bar">
        <div className="cv-button-group" role="group" aria-label="Diff layout">
          <button type="button" className="cv-button" aria-pressed={mode === 'line-by-line'} onClick={() => setMode('line-by-line')}>Line by line</button>
          <button type="button" className="cv-button" aria-pressed={mode === 'side-by-side'} onClick={() => setMode('side-by-side')}>Side by side</button>
        </div>
        <span className="cv-muted">{files.length} file{files.length === 1 ? '' : 's'}</span>
      </div>
      {files.length === 0 ? <p className="cv-notice cv-muted">No hunks found in this diff.</p> : null}
      {files.map((file, index) => (
        <div key={index} className="d2h-file-wrapper" data-lang={file.language}>
          <FileHeader file={file} />
          {mode === 'line-by-line' ? <LineByLine file={file} /> : <SideBySide file={file} />}
        </div>
      ))}
    </div>
  )
}

export default function DiffRenderer(props: ContentRenderProps) {
  const text = useSourceText(props.source)
  if (text.status === 'loading') return <LoadingNotice label="diff" />
  if (text.status === 'error') return <ErrorNotice error={text.error} prefix="Could not load text" />
  return <DiffView {...props} text={text.value} />
}
