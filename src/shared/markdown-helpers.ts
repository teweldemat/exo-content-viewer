import GithubSlugger from 'github-slugger'
import { parse as parseToml } from 'smol-toml'
import YAML from 'yaml'
import type { Root as MdastRoot, RootContent, TableRow } from 'mdast'
import type { Element, ElementContent, Root as HastRoot } from 'hast'
import type { ContentSource } from '../content-source.js'

const SAFE_PROTOCOLS = new Set(['http', 'https', 'mailto', 'tel'])
const schemeNoise = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(32)}${String.fromCharCode(127)}]`, 'g')

/**
 * URL transform for Markdown links and images. Relative URLs and fragments pass through;
 * absolute URLs survive only with an allow-listed protocol. `javascript:`, `data:` and
 * `vbscript:` (and anything else) become an empty string, which renders as plain text.
 */
export function safeUrl(url: string): string {
  const trimmed = url.trim()
  // Control characters and whitespace inside the scheme must not disguise it.
  const probe = trimmed.replace(schemeNoise, '')
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(probe)
  if (!match) return trimmed
  return SAFE_PROTOCOLS.has(match[1]!.toLowerCase()) ? trimmed : ''
}

export function isAbsoluteUrl(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')
}

export type ResolvedLink =
  | { kind: 'none' }
  | { kind: 'anchor'; href: string }
  | { kind: 'external'; href: string }
  | { kind: 'href'; href: string }
  | { kind: 'source'; href: string; target: ContentSource }

/** Classifies a link target and resolves relative ones through `source.resolve`. */
export function resolveLink(href: string | null | undefined, source: ContentSource): ResolvedLink {
  if (!href) return { kind: 'none' }
  if (href.startsWith('#')) return { kind: 'anchor', href }
  if (isAbsoluteUrl(href)) return { kind: 'external', href }
  if (!source.resolve) return { kind: 'href', href }
  const [pathPart, fragment] = splitFragment(href)
  const resolved = source.resolve(pathPart)
  if (resolved === null || resolved === undefined) return { kind: 'none' }
  if (typeof resolved === 'string') return { kind: 'href', href: resolved + fragment }
  return { kind: 'source', href: (resolved.url() ?? '') + fragment, target: resolved }
}

/** Resolves a relative image source to a preview URL, or null when nothing can be shown. */
export function resolveImage(src: string | null | undefined, source: ContentSource): string | null {
  if (!src) return null
  if (isAbsoluteUrl(src)) return src
  if (!source.resolve) return src
  const resolved = source.resolve(src)
  if (resolved === null || resolved === undefined) return null
  if (typeof resolved === 'string') return resolved
  return resolved.url({ preview: true })
}

function splitFragment(href: string): [string, string] {
  const index = href.indexOf('#')
  return index === -1 ? [href, ''] : [href.slice(0, index), href.slice(index)]
}

export type MarkdownHeading = { depth: number; text: string; id: string }

/**
 * Extracts ATX headings (outside fenced code and front matter) with the same slugs rehype-slug produces.
 */
export function extractHeadings(markdown: string): MarkdownHeading[] {
  const slugger = new GithubSlugger()
  const headings: MarkdownHeading[] = []
  let fence: string | null = null
  let inFrontmatter = false
  const lines = markdown.split(/\r\n|\r|\n/)
  lines.forEach((line, index) => {
    if (index === 0 && (line === '---' || line === '+++')) {
      inFrontmatter = true
      return
    }
    if (inFrontmatter) {
      if (line === '---' || line === '+++') inFrontmatter = false
      return
    }
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1]!
      if (!fence) fence = marker
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null
      return
    }
    if (fence) return
    const match = /^\s{0,3}(#{1,6})\s+(.*?)\s*(?:#+\s*)?$/.exec(line)
    if (!match) return
    const text = plainInlineText(match[2]!)
    if (!text) return
    headings.push({ depth: match[1]!.length, text, id: slugger.slug(text) })
  })
  return headings
}

function plainInlineText(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/[*_~]+/g, '')
    .trim()
}

/** Remark plugin: renders a leading YAML/TOML front matter block as a key/value table. */
export function remarkFrontmatterTable() {
  return (tree: MdastRoot) => {
    const first = tree.children[0] as { type: string; value?: string } | undefined
    if (!first || (first.type !== 'yaml' && first.type !== 'toml')) return
    const raw = first.value ?? ''
    let data: unknown
    try {
      data = first.type === 'yaml' ? YAML.parse(raw, { maxAliasCount: 100 }) : parseToml(raw)
    } catch {
      data = null
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      tree.children[0] = { type: 'code', lang: first.type, value: raw } as RootContent
      return
    }
    const entries = Object.entries(data as Record<string, unknown>)
    const row = (cells: string[], isHeader = false): TableRow => ({
      type: 'tableRow',
      children: cells.map((cell) => ({
        type: 'tableCell',
        children: [isHeader ? { type: 'strong', children: [{ type: 'text', value: cell }] } : { type: 'text', value: cell }],
      })),
    })
    tree.children[0] = {
      type: 'table',
      align: [null, null],
      data: { hProperties: { className: ['cv-frontmatter'] } },
      children: [row(['Key', 'Value'], true), ...entries.map(([key, value]) => row([key, formatFrontmatterValue(value)]))],
    } as RootContent
  }
}

function formatFrontmatterValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)
  return JSON.stringify(value)
}

/** Concatenates the text content of a hast node. */
export function hastToText(node: HastRoot | Element | ElementContent): string {
  const plain = node as { type: string; value?: unknown; children?: unknown[] }
  if (plain.type === 'text') return typeof plain.value === 'string' ? plain.value : ''
  if (Array.isArray(plain.children)) return plain.children.map((child) => hastToText(child as ElementContent)).join('')
  return ''
}

/** Extracts the fence language from a `language-*` class list. */
export function fenceLanguage(className: unknown): string | null {
  const list = Array.isArray(className) ? className : typeof className === 'string' ? className.split(/\s+/) : []
  for (const entry of list) {
    const match = /^language-(\S+)$/.exec(String(entry))
    if (match) return match[1]!.toLowerCase()
  }
  return null
}
