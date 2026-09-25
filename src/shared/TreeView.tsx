import { useMemo, useState, type ReactNode } from 'react'
import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react'

export type TreeViewProps = {
  value: unknown
  rootName?: string
  initialDepth?: number
  /** Optional externally controlled search text. When omitted the tree shows its own search box. */
  search?: string
  emptyLabel?: string
}

const identifierPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/

/** Formats a JSONPath-like path such as `$.items[0].name`. */
export function formatTreePath(segments: ReadonlyArray<string | number>): string {
  return segments.reduce<string>((path, segment) => {
    if (typeof segment === 'number') return `${path}[${segment}]`
    return identifierPattern.test(segment) ? `${path}.${segment}` : `${path}[${JSON.stringify(segment)}]`
  }, '$')
}

function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null
}

function entriesOf(value: Record<string, unknown> | unknown[]): Array<[string | number, unknown]> {
  return Array.isArray(value) ? value.map((item, index) => [index, item]) : Object.entries(value)
}

function formatPrimitive(value: unknown): { text: string; kind: string } {
  if (value === null) return { text: 'null', kind: 'null' }
  if (value === undefined) return { text: 'undefined', kind: 'null' }
  if (typeof value === 'string') return { text: JSON.stringify(value), kind: 'string' }
  if (typeof value === 'number' || typeof value === 'bigint') return { text: String(value), kind: 'number' }
  if (typeof value === 'boolean') return { text: String(value), kind: 'boolean' }
  if (value instanceof Date) return { text: value.toISOString(), kind: 'string' }
  return { text: String(value), kind: 'other' }
}

/**
 * Computes which paths match the search and the ancestor paths that must be expanded to show them.
 */
export function searchTree(value: unknown, needle: string): { matches: Set<string>; ancestors: Set<string> } {
  const matches = new Set<string>()
  const ancestors = new Set<string>()
  const query = needle.trim().toLowerCase()
  if (!query) return { matches, ancestors }
  const visit = (node: unknown, segments: Array<string | number>) => {
    const path = formatTreePath(segments)
    const last = segments[segments.length - 1]
    const keyMatches = last !== undefined && String(last).toLowerCase().includes(query)
    let hit = keyMatches
    if (isContainer(node)) {
      for (const [key, child] of entriesOf(node)) {
        if (visit(child, [...segments, key])) hit = true
      }
    } else if (formatPrimitive(node).text.toLowerCase().includes(query)) {
      hit = true
    }
    if (hit) {
      matches.add(path)
      for (let index = 0; index < segments.length; index += 1) ancestors.add(formatTreePath(segments.slice(0, index)))
    }
    return hit
  }
  visit(value, [])
  return { matches, ancestors }
}

function CopyPathButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="cv-tree-copy"
      title={`Copy path ${path}`}
      aria-label={`Copy path ${path}`}
      onClick={() => {
        const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
        if (clipboard?.writeText) {
          clipboard.writeText(path).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200) }, () => undefined)
        }
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}

type NodeProps = {
  name: string | number | null
  value: unknown
  segments: Array<string | number>
  depth: number
  initialDepth: number
  expanded: Map<string, boolean>
  toggle: (path: string) => void
  search: { matches: Set<string>; ancestors: Set<string>; active: boolean }
}

function TreeNode(props: NodeProps): ReactNode {
  const { name, value, segments, depth, initialDepth, expanded, toggle, search } = props
  const path = formatTreePath(segments)
  if (search.active && !search.matches.has(path) && !search.ancestors.has(path)) return null
  const label = name === null ? null : (
    <span className="cv-tree-key">{typeof name === 'number' ? name : JSON.stringify(name)}</span>
  )
  if (!isContainer(value)) {
    const primitive = formatPrimitive(value)
    return (
      <li className="cv-tree-node cv-tree-leaf" data-path={path}>
        {label}
        {label ? <span className="cv-tree-colon">: </span> : null}
        <span className={`cv-tree-value cv-tree-${primitive.kind}`}>{primitive.text}</span>
        <CopyPathButton path={path} />
      </li>
    )
  }
  const entries = entriesOf(value)
  const isOpen = expanded.has(path)
    ? expanded.get(path)!
    : search.active ? search.ancestors.has(path) : depth < initialDepth
  const summary = Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`
  return (
    <li className="cv-tree-node cv-tree-branch" data-path={path}>
      <button type="button" className="cv-tree-toggle" aria-expanded={isOpen} onClick={() => toggle(path)}>
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {label}
        {label ? <span className="cv-tree-colon">: </span> : null}
        <span className="cv-tree-summary">{summary}</span>
      </button>
      <CopyPathButton path={path} />
      {isOpen && entries.length > 0 ? (
        <ul className="cv-tree-children">
          {entries.map(([key, child]) => (
            <TreeNode
              key={String(key)}
              name={key}
              value={child}
              segments={[...segments, key]}
              depth={depth + 1}
              initialDepth={initialDepth}
              expanded={expanded}
              toggle={toggle}
              search={search}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/** Collapsible tree for parsed JSON, YAML, or TOML values with search and copy-path. */
export function TreeView(props: TreeViewProps) {
  const { value, initialDepth = 2, emptyLabel = 'Empty document' } = props
  const [ownSearch, setOwnSearch] = useState('')
  const search = props.search ?? ownSearch
  const [expanded, setExpanded] = useState<Map<string, boolean>>(() => new Map())
  const [searchVersion, setSearchVersion] = useState(0)
  const found = useMemo(() => searchTree(value, search), [value, search])
  const searchState = { ...found, active: search.trim().length > 0 }
  const toggle = (path: string) => {
    setExpanded((previous) => {
      const next = new Map(previous)
      const current = next.has(path)
        ? next.get(path)!
        : searchState.active ? searchState.ancestors.has(path) : path.split(/[.[]/).length - 1 < initialDepth
      next.set(path, !current)
      return next
    })
  }
  const showSearch = props.search === undefined
  const isEmpty = value === undefined || (isContainer(value) && entriesOf(value).length === 0)
  return (
    <div className="cv-tree" data-search-version={searchVersion}>
      {showSearch ? (
        <div className="cv-tree-search">
          <input
            type="search"
            className="cv-input"
            placeholder="Search keys and values"
            aria-label="Search keys and values"
            value={ownSearch}
            onChange={(event) => { setOwnSearch(event.target.value); setExpanded(new Map()); setSearchVersion((version) => version + 1) }}
          />
          {searchState.active ? <span className="cv-tree-search-count">{found.matches.size} match{found.matches.size === 1 ? '' : 'es'}</span> : null}
        </div>
      ) : null}
      {isEmpty ? <p className="cv-muted">{emptyLabel}</p> : (
        <ul className="cv-tree-root">
          <TreeNode
            name={null}
            value={value}
            segments={[]}
            depth={0}
            initialDepth={initialDepth}
            expanded={expanded}
            toggle={toggle}
            search={searchState}
          />
        </ul>
      )}
    </div>
  )
}
