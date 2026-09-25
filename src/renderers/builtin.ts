import type { ContentSource } from '../content-source.js'
import { MIB, SCORE, isTextual, matchBy } from './matching.js'
import type { ContentRenderer } from './types.js'

export type MarkdownOptions = {
  /** Enables raw HTML in Markdown. It is parsed with rehype-raw and then sanitized with the package schema. */
  allowRawHtml?: boolean
  /** Minimum number of headings before a table of contents is shown. Defaults to 3. */
  tocMinimumHeadings?: number
}

const markdownMatch = matchBy({ mediaTypes: ['text/markdown', 'text/x-markdown', 'text/mdx'], extensions: ['md', 'mdx', 'markdown'] })

/**
 * Creates a `markdown` renderer with options (for example `{ allowRawHtml: true }`). Pass it in
 * `renderers` to replace the built-in one; the component stays behind a dynamic import.
 */
export function createMarkdownRenderer(options: MarkdownOptions = {}): ContentRenderer {
  return {
    id: 'markdown',
    label: 'Markdown',
    match: markdownMatch,
    load: () => import('./markdown.js').then((module) => module.createMarkdownComponent(options)),
  }
}

/**
 * Built-in renderers. Every component is behind a dynamic `import()` so bundlers code-split it.
 * Matching uses the server-provided media type first and the file extension second; bytes are never inspected.
 */
export const markdownRenderer: ContentRenderer = createMarkdownRenderer()

export const codeRenderer: ContentRenderer = {
  id: 'code',
  label: 'Code',
  match: (source: ContentSource) => (isTextual(source) ? SCORE.code : null),
  load: () => import('./code.js').then((module) => module.default),
}

export const jsonRenderer: ContentRenderer = {
  id: 'json',
  label: 'JSON',
  match: matchBy({
    mediaTypes: ['application/json', 'application/ld+json', 'application/x-ndjson', 'application/jsonl', 'application/json5', 'text/json'],
    extensions: ['json', 'jsonl', 'ndjson', 'json5', 'jsonc'],
  }),
  load: () => import('./json.js').then((module) => module.default),
  maxBytes: 8 * MIB,
}

export const yamlTomlRenderer: ContentRenderer = {
  id: 'yaml-toml',
  label: 'YAML / TOML',
  match: matchBy({
    mediaTypes: ['application/yaml', 'application/x-yaml', 'text/yaml', 'text/x-yaml', 'application/toml', 'text/x-toml'],
    extensions: ['yaml', 'yml', 'toml'],
  }),
  load: () => import('./yaml-toml.js').then((module) => module.default),
  maxBytes: 8 * MIB,
}

export const tableRenderer: ContentRenderer = {
  id: 'table',
  label: 'Table',
  match: matchBy({ mediaTypes: ['text/csv', 'text/tab-separated-values', 'text/tsv'], extensions: ['csv', 'tsv', 'tab'] }),
  load: () => import('./table.js').then((module) => module.default),
  maxBytes: 16 * MIB,
}

export const imageRenderer: ContentRenderer = {
  id: 'image',
  label: 'Image',
  match: matchBy({
    mediaTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/avif', 'image/apng'],
    extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif', 'apng'],
  }),
  load: () => import('./image.js').then((module) => module.default),
}

export const svgRenderer: ContentRenderer = {
  id: 'svg',
  label: 'SVG',
  match: matchBy({ mediaTypes: ['image/svg+xml'], extensions: ['svg'] }),
  load: () => import('./svg.js').then((module) => module.default),
}

export const pdfRenderer: ContentRenderer = {
  id: 'pdf',
  label: 'PDF',
  match: matchBy({ mediaTypes: ['application/pdf'], extensions: ['pdf'] }),
  load: () => import('./pdf.js').then((module) => module.default),
  maxBytes: 50 * MIB,
}

export const mediaRenderer: ContentRenderer = {
  id: 'media',
  label: 'Media',
  match: matchBy({
    mediaTypePrefixes: ['video/', 'audio/'],
    extensions: ['mp4', 'webm', 'ogv', 'mov', 'm4v', 'mp3', 'ogg', 'oga', 'wav', 'flac', 'm4a', 'aac', 'opus', 'weba'],
  }),
  load: () => import('./media.js').then((module) => module.default),
}

export const htmlRenderer: ContentRenderer = {
  id: 'html',
  label: 'HTML',
  match: matchBy({ mediaTypes: ['text/html', 'application/xhtml+xml'], extensions: ['html', 'htm', 'xhtml'] }),
  load: () => import('./html.js').then((module) => module.default),
}

export const notebookRenderer: ContentRenderer = {
  id: 'notebook',
  label: 'Notebook',
  match: matchBy({ mediaTypes: ['application/x-ipynb+json'], extensions: ['ipynb'] }),
  load: () => import('./notebook.js').then((module) => module.default),
  maxBytes: 16 * MIB,
}

export const diffRenderer: ContentRenderer = {
  id: 'diff',
  label: 'Diff',
  match: matchBy({ mediaTypes: ['text/x-diff', 'text/x-patch'], extensions: ['diff', 'patch'] }),
  load: () => import('./diff.js').then((module) => module.default),
  maxBytes: 4 * MIB,
}

export const hexRenderer: ContentRenderer = {
  id: 'hex',
  label: 'Hex',
  match: () => SCORE.hex,
  load: () => import('./hex.js').then((module) => module.default),
  maxBytes: 1 * MIB,
}

export const binaryRenderer: ContentRenderer = {
  id: 'binary',
  label: 'File',
  match: () => SCORE.binary,
  load: () => import('./binary.js').then((module) => module.default),
}

export const builtInRenderers: ContentRenderer[] = [
  markdownRenderer,
  codeRenderer,
  jsonRenderer,
  yamlTomlRenderer,
  tableRenderer,
  imageRenderer,
  svgRenderer,
  pdfRenderer,
  mediaRenderer,
  htmlRenderer,
  notebookRenderer,
  diffRenderer,
  hexRenderer,
  binaryRenderer,
]

/**
 * Merges a consumer's renderers with the built-ins. The consumer's entries come first, so they win ties in
 * `selectRenderers`, and a consumer renderer whose id matches a built-in replaces it.
 */
export function mergeRenderers(custom: ContentRenderer[] | undefined | null): ContentRenderer[] {
  if (!custom || custom.length === 0) return builtInRenderers
  const overridden = new Set(custom.map((renderer) => renderer.id))
  return [...custom, ...builtInRenderers.filter((renderer) => !overridden.has(renderer.id))]
}
