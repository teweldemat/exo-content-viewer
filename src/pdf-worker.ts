let configuredWorkerUrl: string | null = null

/**
 * Overrides the pdf.js worker URL used by the `pdf` renderer.
 *
 * The renderer defaults to `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`, which
 * Vite rewrites to a hashed asset when it bundles this package. Call this before the first PDF is
 * shown when that does not work in your setup (see the README's Vite notes), for example with
 * `import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`.
 */
export function configurePdfWorker(url: string): void {
  configuredWorkerUrl = url
}

export function getConfiguredPdfWorkerUrl(): string | null {
  return configuredWorkerUrl
}
