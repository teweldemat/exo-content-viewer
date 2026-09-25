import type { ContentSource } from '../content-source.js'

export const SCORE = {
  specialist: 100,
  code: 50,
  hex: 10,
  binary: 1,
} as const

export const KIB = 1024
export const MIB = 1024 * 1024

/** Lower-cased media type without parameters, or null. */
export function mediaTypeOf(source: ContentSource): string | null {
  const raw = source.mediaType
  if (!raw) return null
  const base = raw.split(';')[0]?.trim().toLowerCase()
  return base ? base : null
}

/** File name used for extension matching: `name`, falling back to the last `path` segment. */
export function fileNameOf(source: ContentSource): string {
  const name = source.name?.trim()
  if (name) return name
  const path = source.path ?? ''
  return path.split('/').filter(Boolean).pop() ?? ''
}

/** Lower-cased extension without the dot, or null. `Dockerfile` and `Makefile` return their name. */
export function extensionOf(source: ContentSource): string | null {
  const name = fileNameOf(source).toLowerCase()
  if (!name) return null
  if (name === 'dockerfile' || name === 'makefile') return name
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return null
  return name.slice(dot + 1)
}

export type MatchSpec = {
  mediaTypes?: string[]
  /** Media type prefixes such as `video/`. */
  mediaTypePrefixes?: string[]
  extensions?: string[]
  score?: number
}

/** Builds a match function from media types (checked first) and extensions. */
export function matchBy(spec: MatchSpec): (source: ContentSource) => number | null {
  const mediaTypes = new Set(spec.mediaTypes ?? [])
  const prefixes = spec.mediaTypePrefixes ?? []
  const extensions = new Set(spec.extensions ?? [])
  const score = spec.score ?? SCORE.specialist
  return (source) => {
    const mediaType = mediaTypeOf(source)
    if (mediaType) {
      if (mediaTypes.has(mediaType)) return score
      if (prefixes.some((prefix) => mediaType.startsWith(prefix))) return score
    }
    const extension = extensionOf(source)
    if (extension && extensions.has(extension)) return score
    return null
  }
}

const textualMediaTypes = new Set([
  'application/json',
  'application/ld+json',
  'application/x-ndjson',
  'application/jsonl',
  'application/xml',
  'application/javascript',
  'application/ecmascript',
  'application/typescript',
  'application/x-sh',
  'application/x-shellscript',
  'application/yaml',
  'application/x-yaml',
  'application/toml',
  'application/sql',
  'application/x-httpd-php',
  'application/graphql',
  'application/x-ipynb+json',
  'image/svg+xml',
])

export const textualExtensions = new Set([
  'txt', 'text', 'log', 'md', 'mdx', 'markdown', 'rst', 'adoc',
  'ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs', 'json', 'jsonc', 'json5', 'jsonl', 'ndjson',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'kts', 'cs', 'fs', 'c', 'h', 'cpp', 'cc', 'cxx', 'hpp', 'hh', 'm', 'mm', 'swift', 'dart',
  'css', 'scss', 'sass', 'less', 'html', 'htm', 'xml', 'svg', 'xhtml', 'vue', 'svelte', 'astro',
  'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'env', 'properties', 'editorconfig',
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
  'sql', 'graphql', 'gql', 'proto', 'tf', 'hcl', 'lua', 'r', 'scala', 'hs', 'ex', 'exs', 'erl', 'clj', 'cljs', 'php', 'pl', 'pm',
  'csv', 'tsv', 'tab', 'diff', 'patch', 'ipynb', 'dockerfile', 'makefile', 'gitignore', 'gitattributes', 'lock', 'csproj', 'sln',
])

/** True when the source should be treated as text without looking at its bytes. */
export function isTextual(source: ContentSource): boolean {
  if (source.textual === true) return true
  if (source.textual === false) return false
  const mediaType = mediaTypeOf(source)
  if (mediaType) {
    if (mediaType.startsWith('text/')) return true
    if (textualMediaTypes.has(mediaType)) return true
    if (mediaType.endsWith('+json') || mediaType.endsWith('+xml')) return true
  }
  const extension = extensionOf(source)
  return extension !== null && textualExtensions.has(extension)
}
