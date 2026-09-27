import type { ContentSource } from '../content-source.js'

/**
 * Per-browser viewer preferences: the renderer a user last picked for each content type and
 * the code view's line-wrap toggle. Stored in `localStorage` when it is available; otherwise
 * kept in memory for the page's lifetime so the behavior stays consistent without a store.
 */
export const PREFERENCES_STORAGE_KEY = 'cp-content-viewer:preferences'

export type ViewerPreferences = {
  /** Renderer id keyed by content type key (see `typeKeyOf`). */
  rendererByType: Record<string, string>
  /** Wrap long lines in the code view. */
  codeWrap: boolean
}

const MAX_REMEMBERED_TYPES = 200

function defaults(): ViewerPreferences {
  return { rendererByType: {}, codeWrap: false }
}

let memory: ViewerPreferences | null = null

function storage(): Storage | null {
  try {
    const scope = globalThis as { localStorage?: Storage; window?: { localStorage?: Storage } }
    const candidate = scope.localStorage ?? scope.window?.localStorage ?? null
    if (!candidate || typeof candidate.getItem !== 'function') return null
    return candidate
  } catch {
    // Access to storage can throw in sandboxed frames or with blocked site data.
    return null
  }
}

function normalize(value: unknown): ViewerPreferences {
  const result = defaults()
  if (!value || typeof value !== 'object') return result
  const record = value as { rendererByType?: unknown; codeWrap?: unknown }
  if (record.rendererByType && typeof record.rendererByType === 'object') {
    for (const [key, id] of Object.entries(record.rendererByType as Record<string, unknown>)) {
      if (typeof key === 'string' && key && typeof id === 'string' && id) result.rendererByType[key] = id
    }
  }
  if (typeof record.codeWrap === 'boolean') result.codeWrap = record.codeWrap
  return result
}

export function readPreferences(): ViewerPreferences {
  const store = storage()
  if (!store) return memory ? normalize(memory) : defaults()
  try {
    const raw = store.getItem(PREFERENCES_STORAGE_KEY)
    return raw ? normalize(JSON.parse(raw)) : defaults()
  } catch {
    return defaults()
  }
}

export function updatePreferences(update: (current: ViewerPreferences) => ViewerPreferences): ViewerPreferences {
  const next = normalize(update(readPreferences()))
  // Bound the map so a long-lived browser profile cannot grow it without limit.
  const keys = Object.keys(next.rendererByType)
  if (keys.length > MAX_REMEMBERED_TYPES) {
    for (const key of keys.slice(0, keys.length - MAX_REMEMBERED_TYPES)) delete next.rendererByType[key]
  }
  const store = storage()
  if (store) {
    try {
      store.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Quota or privacy mode: fall back to memory for this page.
      memory = next
    }
  } else {
    memory = next
  }
  return next
}

/**
 * The key a renderer choice is remembered under: the file extension when the name has one
 * (`.json`, `.md`, `.tar.gz` counts as `.gz`), otherwise the media type, otherwise the
 * lower-cased name (so `Dockerfile` and `Makefile` remember on their own).
 */
export function typeKeyOf(source: Pick<ContentSource, 'name' | 'mediaType'>): string {
  const name = (source.name ?? '').split('/').pop() ?? ''
  const dot = name.lastIndexOf('.')
  if (dot > 0 && dot < name.length - 1) return name.slice(dot).toLowerCase()
  if (source.mediaType) return source.mediaType.toLowerCase()
  return name ? name.toLowerCase() : '*'
}

export function rememberedRendererFor(source: Pick<ContentSource, 'name' | 'mediaType'>): string | null {
  return readPreferences().rendererByType[typeKeyOf(source)] ?? null
}

export function rememberRendererFor(source: Pick<ContentSource, 'name' | 'mediaType'>, rendererId: string): void {
  const key = typeKeyOf(source)
  updatePreferences((current) => {
    const { [key]: _previous, ...rest } = current.rendererByType
    // Re-insert last so the bounded map evicts the oldest choices first.
    return { ...current, rendererByType: { ...rest, [key]: rendererId } }
  })
}

export function rememberedCodeWrap(): boolean {
  return readPreferences().codeWrap
}

export function rememberCodeWrap(value: boolean): void {
  updatePreferences((current) => ({ ...current, codeWrap: value }))
}

/** Test hook: clears the stored and in-memory preferences. */
export function clearPreferences(): void {
  memory = null
  const store = storage()
  if (!store) return
  try {
    store.removeItem(PREFERENCES_STORAGE_KEY)
  } catch {
    // Nothing to clear.
  }
}
