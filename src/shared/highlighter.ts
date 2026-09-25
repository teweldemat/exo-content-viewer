import { createHighlighterCore, type HighlighterCore, type LanguageRegistration, type ThemedToken } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import type { ColorMode } from '../renderers/types.js'

export type HighlightedLine = ThemedToken[]

type LanguageLoader = () => Promise<{ default: LanguageRegistration[] }>

/**
 * Curated grammar set. Each entry is an explicit dynamic import so a bundler
 * emits one lazy chunk per listed language instead of one per grammar shiki
 * ships (over 200). Extend this map together with `extensionLanguages`.
 */
export const languageLoaders: Record<string, LanguageLoader> = {
  'typescript': () => import('@shikijs/langs/typescript'),
  'tsx': () => import('@shikijs/langs/tsx'),
  'javascript': () => import('@shikijs/langs/javascript'),
  'jsx': () => import('@shikijs/langs/jsx'),
  'json': () => import('@shikijs/langs/json'),
  'jsonc': () => import('@shikijs/langs/jsonc'),
  'json5': () => import('@shikijs/langs/json5'),
  'python': () => import('@shikijs/langs/python'),
  'ruby': () => import('@shikijs/langs/ruby'),
  'go': () => import('@shikijs/langs/go'),
  'rust': () => import('@shikijs/langs/rust'),
  'java': () => import('@shikijs/langs/java'),
  'kotlin': () => import('@shikijs/langs/kotlin'),
  'csharp': () => import('@shikijs/langs/csharp'),
  'fsharp': () => import('@shikijs/langs/fsharp'),
  'c': () => import('@shikijs/langs/c'),
  'cpp': () => import('@shikijs/langs/cpp'),
  'objective-c': () => import('@shikijs/langs/objective-c'),
  'objective-cpp': () => import('@shikijs/langs/objective-cpp'),
  'swift': () => import('@shikijs/langs/swift'),
  'dart': () => import('@shikijs/langs/dart'),
  'css': () => import('@shikijs/langs/css'),
  'scss': () => import('@shikijs/langs/scss'),
  'sass': () => import('@shikijs/langs/sass'),
  'less': () => import('@shikijs/langs/less'),
  'html': () => import('@shikijs/langs/html'),
  'xml': () => import('@shikijs/langs/xml'),
  'vue': () => import('@shikijs/langs/vue'),
  'svelte': () => import('@shikijs/langs/svelte'),
  'astro': () => import('@shikijs/langs/astro'),
  'yaml': () => import('@shikijs/langs/yaml'),
  'toml': () => import('@shikijs/langs/toml'),
  'ini': () => import('@shikijs/langs/ini'),
  'properties': () => import('@shikijs/langs/properties'),
  'dotenv': () => import('@shikijs/langs/dotenv'),
  'markdown': () => import('@shikijs/langs/markdown'),
  'mdx': () => import('@shikijs/langs/mdx'),
  'rst': () => import('@shikijs/langs/rst'),
  'asciidoc': () => import('@shikijs/langs/asciidoc'),
  'shellscript': () => import('@shikijs/langs/shellscript'),
  'fish': () => import('@shikijs/langs/fish'),
  'powershell': () => import('@shikijs/langs/powershell'),
  'bat': () => import('@shikijs/langs/bat'),
  'sql': () => import('@shikijs/langs/sql'),
  'graphql': () => import('@shikijs/langs/graphql'),
  'proto': () => import('@shikijs/langs/proto'),
  'terraform': () => import('@shikijs/langs/terraform'),
  'hcl': () => import('@shikijs/langs/hcl'),
  'lua': () => import('@shikijs/langs/lua'),
  'r': () => import('@shikijs/langs/r'),
  'scala': () => import('@shikijs/langs/scala'),
  'haskell': () => import('@shikijs/langs/haskell'),
  'elixir': () => import('@shikijs/langs/elixir'),
  'erlang': () => import('@shikijs/langs/erlang'),
  'clojure': () => import('@shikijs/langs/clojure'),
  'php': () => import('@shikijs/langs/php'),
  'perl': () => import('@shikijs/langs/perl'),
  'diff': () => import('@shikijs/langs/diff'),
  'dockerfile': () => import('@shikijs/langs/dockerfile'),
  'make': () => import('@shikijs/langs/make'),
  'csv': () => import('@shikijs/langs/csv'),
  'prisma': () => import('@shikijs/langs/prisma'),
  'mermaid': () => import('@shikijs/langs/mermaid'),
  'latex': () => import('@shikijs/langs/latex'),
}

export type SupportedLanguage = keyof typeof languageLoaders

const extensionLanguages: Record<string, string> = {
  ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'tsx',
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx',
  json: 'json', jsonc: 'jsonc', json5: 'json5', jsonl: 'json', ndjson: 'json', ipynb: 'json',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', kts: 'kotlin', cs: 'csharp', fs: 'fsharp',
  c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp', m: 'objective-c', mm: 'objective-cpp',
  swift: 'swift', dart: 'dart', css: 'css', scss: 'scss', sass: 'sass', less: 'less',
  html: 'html', htm: 'html', xhtml: 'html', xml: 'xml', svg: 'xml', vue: 'vue', svelte: 'svelte', astro: 'astro',
  yaml: 'yaml', yml: 'yaml', toml: 'toml', ini: 'ini', cfg: 'ini', conf: 'ini', properties: 'properties', env: 'dotenv',
  md: 'markdown', mdx: 'mdx', markdown: 'markdown', rst: 'rst', adoc: 'asciidoc',
  sh: 'shellscript', bash: 'shellscript', zsh: 'shellscript', fish: 'fish', ps1: 'powershell', bat: 'bat', cmd: 'bat',
  sql: 'sql', graphql: 'graphql', gql: 'graphql', proto: 'proto', tf: 'terraform', hcl: 'hcl', lua: 'lua', r: 'r',
  scala: 'scala', hs: 'haskell', ex: 'elixir', exs: 'elixir', erl: 'erlang', clj: 'clojure', cljs: 'clojure',
  php: 'php', pl: 'perl', pm: 'perl', diff: 'diff', patch: 'diff', dockerfile: 'dockerfile', makefile: 'make',
  csv: 'csv', prisma: 'prisma', mermaid: 'mermaid', tex: 'latex', latex: 'latex', csproj: 'xml', sln: 'ini',
}

/** Resolves a shiki language id from a file name, extension, or fence language. Returns null when unknown. */
export function resolveLanguage(hint: string | null | undefined): string | null {
  if (!hint) return null
  const lower = hint.trim().toLowerCase()
  if (!lower) return null
  const base = lower.includes('/') ? lower.slice(lower.lastIndexOf('/') + 1) : lower
  const candidates: string[] = []
  if (base === 'dockerfile' || base === 'makefile') candidates.push(base)
  const dot = base.lastIndexOf('.')
  if (dot > 0 && dot < base.length - 1) candidates.push(base.slice(dot + 1))
  candidates.push(base)
  for (const candidate of candidates) {
    const mapped = extensionLanguages[candidate] ?? candidate
    if (Object.prototype.hasOwnProperty.call(languageLoaders, mapped)) return mapped
  }
  return null
}

let highlighterPromise: Promise<HighlighterCore> | null = null

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      // Explicit theme imports keep bundlers from emitting a chunk per shiki theme.
      themes: [import('@shikijs/themes/github-light'), import('@shikijs/themes/github-dark')],
      langs: [],
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    })
  }
  return highlighterPromise
}

export function themeFor(colorMode: ColorMode): 'github-light' | 'github-dark' {
  return colorMode === 'dark' ? 'github-dark' : 'github-light'
}

/**
 * Tokenizes `code` with the grammar for `language`, loading it on first use.
 * Returns null when the language is unknown so callers can render plain text.
 */
export async function highlightCode(code: string, language: string | null | undefined, colorMode: ColorMode): Promise<HighlightedLine[] | null> {
  const id = resolveLanguage(language)
  if (!id) return null
  const highlighter = await getHighlighter()
  if (!highlighter.getLoadedLanguages().includes(id)) {
    await highlighter.loadLanguage(languageLoaders[id]!)
  }
  return highlighter.codeToTokensBase(code, { lang: id, theme: themeFor(colorMode) })
}
