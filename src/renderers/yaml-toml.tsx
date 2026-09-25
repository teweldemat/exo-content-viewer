import { useMemo } from 'react'
import { parse as parseToml } from 'smol-toml'
import YAML from 'yaml'
import { ErrorNotice, LoadingNotice } from '../shared/notices.js'
import { useSourceText } from '../shared/use-source-text.js'
import { StructuredView, type ParseResult } from './json.js'
import { extensionOf, mediaTypeOf } from './matching.js'
import type { ContentRenderProps } from './types.js'

export type StructuredKind = 'yaml' | 'toml'

export function structuredKindOf(source: ContentRenderProps['source']): StructuredKind {
  const mediaType = mediaTypeOf(source)
  if (mediaType === 'application/toml' || mediaType === 'text/x-toml') return 'toml'
  return extensionOf(source) === 'toml' ? 'toml' : 'yaml'
}

export function parseStructured(text: string, kind: StructuredKind): ParseResult {
  try {
    if (kind === 'toml') return { ok: true, value: parseToml(text) }
    const documents = YAML.parseAllDocuments(text)
    const errors = documents.flatMap((document) => document.errors)
    if (errors.length > 0) return { ok: false, error: errors[0]!.message }
    const values = documents.map((document) => document.toJS({ maxAliasCount: 100 }))
    return { ok: true, value: values.length === 1 ? values[0] : values }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export function YamlTomlView(props: ContentRenderProps & { text: string }) {
  const kind = structuredKindOf(props.source)
  const parse = useMemo(() => (text: string) => parseStructured(text, kind), [kind])
  return <StructuredView {...props} parse={parse} label={kind.toUpperCase()} />
}

export default function YamlTomlRenderer(props: ContentRenderProps) {
  const text = useSourceText(props.source)
  if (text.status === 'loading') return <LoadingNotice label="document" />
  if (text.status === 'error') return <ErrorNotice error={text.error} prefix="Could not load text" />
  return <YamlTomlView {...props} text={text.value} />
}
