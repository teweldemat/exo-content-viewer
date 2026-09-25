/**
 * The content contract shared between the viewer and its producers.
 *
 * A mirror of `ContentSource` lives in `cp-lib-core`; keep the shape identical.
 */
export type ContentSourceUrlOptions = { preview?: boolean; download?: boolean }

export type ContentSource = {
  /** File name, used for extension matching and the download attribute. */
  name: string
  /** Logical path used for link resolution and breadcrumbs. */
  path?: string | null
  /** Media type decided by the server. The viewer never sniffs bytes. */
  mediaType?: string | null
  bytes?: number | null
  /** Whether the server considers the content text. */
  textual?: boolean | null
  sha256?: string | null
  modifiedAt?: string | null
  /** Text content, capped by the producer and cached per source. */
  text(): Promise<string>
  blob(): Promise<Blob>
  /** A URL for the content, or null when none can be produced. */
  url(options?: ContentSourceUrlOptions): string | null
  /** Sibling lookup for relative links and images. */
  resolve?(relative: string): ContentSource | string | null
}

export type StaticContentSourceInit = {
  name: string
  path?: string | null
  mediaType?: string | null
  bytes?: number | null
  textual?: boolean | null
  sha256?: string | null
  modifiedAt?: string | null
  text?: string
  blob?: Blob
  url?: string | null | ((options?: ContentSourceUrlOptions) => string | null)
  resolve?: (relative: string) => ContentSource | string | null
}

const encoder = typeof TextEncoder === 'undefined' ? null : new TextEncoder()

/**
 * Creates an in-memory `ContentSource` for tests and simple consumers.
 * `text()` is computed once and cached; `blob()` is derived from the text when no blob is given.
 */
export function createStaticContentSource(init: StaticContentSourceInit): ContentSource {
  let textPromise: Promise<string> | null = null
  let blobPromise: Promise<Blob> | null = null
  const mediaType = init.mediaType ?? null
  const bytes = init.bytes ?? (
    init.blob ? init.blob.size
      : init.text !== undefined && encoder ? encoder.encode(init.text).byteLength
        : null
  )
  const textual = init.textual ?? (init.text !== undefined ? true : null)

  const source: ContentSource = {
    name: init.name,
    path: init.path ?? null,
    mediaType,
    bytes,
    textual,
    sha256: init.sha256 ?? null,
    modifiedAt: init.modifiedAt ?? null,
    text() {
      if (!textPromise) {
        if (init.text !== undefined) {
          textPromise = Promise.resolve(init.text)
        } else if (init.blob) {
          textPromise = init.blob.text()
        } else {
          textPromise = Promise.reject(new Error(`No text content for ${init.name}`))
        }
      }
      return textPromise
    },
    blob() {
      if (!blobPromise) {
        if (init.blob) {
          blobPromise = Promise.resolve(init.blob)
        } else if (init.text !== undefined) {
          const text = init.text
          blobPromise = Promise.resolve(new Blob([text], { type: mediaType ?? 'text/plain' }))
        } else {
          blobPromise = Promise.reject(new Error(`No content for ${init.name}`))
        }
      }
      return blobPromise
    },
    url(options) {
      if (typeof init.url === 'function') return init.url(options)
      return init.url ?? null
    },
  }
  if (init.resolve) source.resolve = init.resolve
  return source
}
