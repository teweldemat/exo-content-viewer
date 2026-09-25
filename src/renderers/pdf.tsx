import { useEffect, useState } from 'react'
import { Document, Page, pdfjs, type DocumentProps } from 'react-pdf'
import { getConfiguredPdfWorkerUrl } from '../pdf-worker.js'
import { formatBytes } from '../shared/format.js'
import { MIB } from './matching.js'
import type { ContentRenderProps } from './types.js'

export const PDF_MAX_BYTES = 50 * MIB

/**
 * pdf.js needs a worker. The default resolves the worker shipped with `pdfjs-dist` relative to this
 * module, which Vite rewrites to a hashed asset. `configurePdfWorker()` overrides it.
 */
function ensureWorker(): void {
  const configured = getConfiguredPdfWorkerUrl()
  if (configured) {
    pdfjs.GlobalWorkerOptions.workerSrc = configured
    return
  }
  if (pdfjs.GlobalWorkerOptions.workerSrc) return
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
}

/**
 * Never let pdf.js compile PostScript functions through `eval`/`new Function`. pdfjs-dist 5+ removed the
 * eval path and with it the `isEvalSupported` option (it is no longer in `DocumentInitParameters`), so the
 * flag is a harmless no-op on current builds and only matters if a consumer pins an older pdfjs-dist.
 * The object is frozen and module-level so react-pdf never sees a new options identity and reloads.
 */
const documentOptions = Object.freeze({ isEvalSupported: false, enableXfa: false }) as unknown as NonNullable<DocumentProps['options']>

// Configure the worker as soon as this lazily loaded module is evaluated. React runs a child's
// effects before its parent's, so react-pdf's <Document> would otherwise start loading before a
// PdfView effect could set the worker and fail with "No GlobalWorkerOptions.workerSrc specified".
ensureWorker()

export function exceedsPdfCap(bytes: number | null | undefined): boolean {
  return bytes != null && bytes > PDF_MAX_BYTES
}

const zoomLevels = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]

export function PdfView({ source }: ContentRenderProps) {
  const [file, setFile] = useState<string | Blob | null>(() => source.url({ preview: true }))
  const [numPages, setNumPages] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [scale, setScale] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const tooLarge = exceedsPdfCap(source.bytes)

  useEffect(() => {
    // Re-apply in case configurePdfWorker() was called after this module loaded.
    ensureWorker()
  }, [])

  useEffect(() => {
    if (tooLarge) return
    const url = source.url({ preview: true })
    if (url) {
      setFile(url)
      return
    }
    let cancelled = false
    source.blob().then((blob) => { if (!cancelled) setFile(blob) }, (loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError))
    })
    return () => { cancelled = true }
  }, [source, tooLarge])

  if (tooLarge) {
    const download = source.url({ download: true })
    return (
      <div className="cv-notice" data-cv-pdf="too-large">
        <p>This PDF is {formatBytes(source.bytes)}, above the {PDF_MAX_BYTES / MIB} MiB preview limit.</p>
        {download ? <a className="cv-button" href={download} download={source.name}>Download {source.name}</a> : null}
      </div>
    )
  }
  if (error) return <div className="cv-notice cv-error-text" role="alert">Could not load PDF: {error}</div>
  if (!file) return <div className="cv-notice cv-muted" role="status">Loading PDF…</div>

  const zoomIndex = zoomLevels.indexOf(scale)
  return (
    <div className="cv-pdf" data-page={page} data-scale={scale}>
      <div className="cv-bar">
        <button type="button" className="cv-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Previous</button>
        <span className="cv-muted" data-cv-pdf-pages>Page {page}{numPages ? ` of ${numPages}` : ''}</span>
        <button type="button" className="cv-button" onClick={() => setPage((current) => (numPages ? Math.min(numPages, current + 1) : current + 1))} disabled={numPages !== null && page >= numPages}>Next</button>
        <span className="cv-bar-spacer" />
        <button type="button" className="cv-button" onClick={() => setScale(zoomLevels[Math.max(0, zoomIndex - 1)]!)} disabled={zoomIndex <= 0} aria-label="Zoom out">−</button>
        <span className="cv-muted">{Math.round(scale * 100)}%</span>
        <button type="button" className="cv-button" onClick={() => setScale(zoomLevels[Math.min(zoomLevels.length - 1, zoomIndex + 1)]!)} disabled={zoomIndex >= zoomLevels.length - 1} aria-label="Zoom in">+</button>
      </div>
      <div className="cv-pdf-stage">
        <Document
          file={file}
          options={documentOptions}
          onLoadSuccess={(document) => { setNumPages(document.numPages); setPage(1) }}
          onLoadError={(loadError) => setError(loadError.message)}
          loading={<div className="cv-notice cv-muted">Loading PDF…</div>}
          error={<div className="cv-notice cv-error-text">Could not render this PDF.</div>}
        >
          <Page pageNumber={page} scale={scale} renderTextLayer renderAnnotationLayer={false} />
        </Document>
      </div>
    </div>
  )
}

export default function PdfRenderer(props: ContentRenderProps) {
  return <PdfView {...props} />
}
