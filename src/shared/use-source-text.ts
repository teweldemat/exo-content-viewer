import { useEffect, useState } from 'react'
import type { ContentSource } from '../content-source.js'

export type SourceLoadState<T> =
  | { status: 'loading' }
  | { status: 'ready'; value: T }
  | { status: 'error'; error: Error }

function useSourceLoad<T>(source: ContentSource, load: (source: ContentSource) => Promise<T>): SourceLoadState<T> {
  const [state, setState] = useState<{ source: ContentSource; state: SourceLoadState<T> } | null>(null)
  useEffect(() => {
    let cancelled = false
    load(source).then(
      (value) => { if (!cancelled) setState({ source, state: { status: 'ready', value } }) },
      (error: unknown) => {
        if (!cancelled) setState({ source, state: { status: 'error', error: error instanceof Error ? error : new Error(String(error)) } })
      },
    )
    return () => { cancelled = true }
  }, [source, load])
  return state && state.source === source ? state.state : { status: 'loading' }
}

const loadText = (source: ContentSource) => source.text()
const loadBytes = async (source: ContentSource) => new Uint8Array(await (await source.blob()).arrayBuffer())

/** Loads `source.text()` once per source instance. */
export function useSourceText(source: ContentSource): SourceLoadState<string> {
  return useSourceLoad(source, loadText)
}

/** Loads `source.blob()` as bytes once per source instance. */
export function useSourceBytes(source: ContentSource): SourceLoadState<Uint8Array> {
  return useSourceLoad(source, loadBytes)
}
