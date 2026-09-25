import type { ComponentType } from 'react'
import type { ContentSource } from '../content-source.js'

export type ColorMode = 'light' | 'dark'

export type ContentRenderProps = {
  source: ContentSource
  colorMode: ColorMode
  onNavigate?: (target: ContentSource | string) => void
}

export type ContentRenderer = {
  /** Stable identifier. A caller's renderer with the same id replaces the built-in one. */
  id: string
  /** Human label shown in the toolbar and the "View as" menu. */
  label: string
  /** Higher scores win; `null` declines the source. */
  match(source: ContentSource): number | null
  /** Lazily loads the React component. */
  load(): Promise<ComponentType<ContentRenderProps>>
  /** Declines sources whose `bytes` exceed this value. */
  maxBytes?: number
}

/** Renderer id that is always kept as the final fallback. */
export const BINARY_RENDERER_ID = 'binary'

/**
 * Returns the renderers that accept `source`, best first.
 *
 * - `renderers` is the already merged list (the caller's renderers first, then the built-ins);
 *   the sort is stable, so on equal scores the earlier entry wins.
 * - Renderers whose `maxBytes` is below `source.bytes` are excluded.
 * - Duplicate ids keep the first occurrence.
 * - The `binary` renderer is always last, whatever its score.
 */
export function selectRenderers(source: ContentSource, renderers: ContentRenderer[]): ContentRenderer[] {
  const seen = new Set<string>()
  const scored: Array<{ renderer: ContentRenderer; score: number; index: number }> = []
  renderers.forEach((renderer, index) => {
    if (seen.has(renderer.id)) return
    seen.add(renderer.id)
    if (renderer.maxBytes !== undefined && source.bytes != null && source.bytes > renderer.maxBytes) return
    const score = renderer.match(source)
    if (score === null || score === undefined || Number.isNaN(score)) return
    scored.push({ renderer, score, index })
  })
  scored.sort((left, right) => {
    const leftBinary = left.renderer.id === BINARY_RENDERER_ID
    const rightBinary = right.renderer.id === BINARY_RENDERER_ID
    if (leftBinary !== rightBinary) return leftBinary ? 1 : -1
    if (right.score !== left.score) return right.score - left.score
    return left.index - right.index
  })
  return scored.map((entry) => entry.renderer)
}
