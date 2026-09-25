/** Test double for `react-pdf`, wired in by scripts/run-tests.mjs through an esbuild alias. */
import { useEffect, useRef, type ReactNode } from 'react'

export const pdfjs = {
  version: 'mock',
  GlobalWorkerOptions: { workerSrc: '' as string },
}

export const reactPdfMock = {
  documents: [] as Array<{ file: unknown; options: unknown }>,
  numPages: 3,
}

export type DocumentProps = {
  file: unknown
  options?: Record<string, unknown>
  onLoadSuccess?: (document: { numPages: number }) => void
  onLoadError?: (error: Error) => void
  loading?: ReactNode
  error?: ReactNode
  children?: ReactNode
}

export function Document(props: DocumentProps) {
  const { file, options, onLoadSuccess, children } = props
  const onLoadSuccessRef = useRef(onLoadSuccess)
  onLoadSuccessRef.current = onLoadSuccess
  useEffect(() => {
    reactPdfMock.documents.push({ file, options })
    onLoadSuccessRef.current?.({ numPages: reactPdfMock.numPages })
  }, [file, options])
  const label = typeof file === 'string' ? file : file instanceof Blob ? `blob:${file.size}` : String(file)
  return <div className="mock-pdf-document" data-file={label} data-options={JSON.stringify(options ?? null)}>{children}</div>
}

export type PageProps = { pageNumber: number; scale?: number; renderTextLayer?: boolean; renderAnnotationLayer?: boolean }

export function Page(props: PageProps) {
  return <div className="mock-pdf-page" data-page-number={props.pageNumber} data-scale={props.scale ?? 1} data-text-layer={String(props.renderTextLayer ?? true)} />
}
