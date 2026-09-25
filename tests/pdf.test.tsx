import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pdfjs, reactPdfMock } from './mocks/react-pdf.js'
import { installDom, renderClient, renderStatic, click } from './helpers/dom.js'
import { createStaticContentSource } from '../src/content-source.js'
import { builtInRenderers, pdfRenderer } from '../src/renderers/builtin.js'
import { PDF_MAX_BYTES, PdfView, exceedsPdfCap } from '../src/renderers/pdf.js'
import { selectRenderers } from '../src/renderers/types.js'
import { configurePdfWorker } from '../src/pdf-worker.js'

installDom()

test('pdf renderer configures the pdf.js worker when its module loads, before any document renders', () => {
  // React runs child effects before parent effects, so the worker must be set at module evaluation
  // time or react-pdf's <Document> starts loading first and fails with "No workerSrc specified".
  assert.match(pdfjs.GlobalWorkerOptions.workerSrc, /pdf\.worker\.min\.mjs$/)
})

test('pdf renderer declines files above 50 MiB so the binary fallback offers a download', () => {
  assert.equal(pdfRenderer.maxBytes, 50 * 1024 * 1024)
  assert.equal(PDF_MAX_BYTES, pdfRenderer.maxBytes)
  assert.equal(exceedsPdfCap(PDF_MAX_BYTES), false)
  assert.equal(exceedsPdfCap(PDF_MAX_BYTES + 1), true)
  const huge = createStaticContentSource({ name: 'big.pdf', mediaType: 'application/pdf', bytes: 60 * 1024 * 1024, textual: false, url: () => '/dl/big.pdf' })
  assert.deepEqual(selectRenderers(huge, builtInRenderers).map((renderer) => renderer.id), ['binary'])
  const html = renderStatic(<PdfView source={huge} colorMode="light" />)
  assert.match(html, /data-cv-pdf="too-large"/)
  assert.match(html, /href="\/dl\/big.pdf" download="big.pdf"/)
})

test('pdf renderer loads the document with eval disabled, a text layer and page navigation', async () => {
  reactPdfMock.documents.length = 0
  reactPdfMock.numPages = 3
  const source = createStaticContentSource({ name: 'doc.pdf', mediaType: 'application/pdf', bytes: 1234, textual: false, url: (options) => (options?.preview ? '/preview/doc.pdf' : '/raw/doc.pdf') })
  const rendered = await renderClient(<PdfView source={source} colorMode="light" />)
  const document = await rendered.waitFor(() => rendered.container.querySelector('.mock-pdf-document'))
  assert.equal(document.getAttribute('data-file'), '/preview/doc.pdf')
  const options = JSON.parse(document.getAttribute('data-options')!)
  assert.equal(options.isEvalSupported, false)
  assert.equal(reactPdfMock.documents.length, 1, 'a stable options object means a single load')
  await rendered.waitFor(() => rendered.container.querySelector('[data-cv-pdf-pages]')?.textContent === 'Page 1 of 3')
  assert.equal(rendered.container.querySelector('.mock-pdf-page')?.getAttribute('data-text-layer'), 'true')
  const next = Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'Next')!
  click(next)
  await rendered.flush()
  assert.equal(rendered.container.querySelector('.mock-pdf-page')?.getAttribute('data-page-number'), '2')
  const zoomIn = rendered.container.querySelector('button[aria-label="Zoom in"]')!
  click(zoomIn)
  await rendered.flush()
  assert.equal(rendered.container.querySelector('.mock-pdf-page')?.getAttribute('data-scale'), '1.25')
  assert.equal(reactPdfMock.documents.length, 1, 'navigation and zoom do not reload the document')
  assert.match(pdfjs.GlobalWorkerOptions.workerSrc, /pdf\.worker\.min\.mjs$/, 'default worker url points at the pdfjs-dist worker')
  await rendered.unmount()
})

test('pdf renderer honors configurePdfWorker and falls back to the blob without a preview url', async () => {
  configurePdfWorker('/assets/custom.worker.mjs')
  const source = createStaticContentSource({ name: 'local.pdf', mediaType: 'application/pdf', blob: new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' }) })
  const rendered = await renderClient(<PdfView source={source} colorMode="dark" />)
  const document = await rendered.waitFor(() => rendered.container.querySelector('.mock-pdf-document'))
  assert.equal(document.getAttribute('data-file'), 'blob:4')
  assert.equal(pdfjs.GlobalWorkerOptions.workerSrc, '/assets/custom.worker.mjs')
  await rendered.unmount()
})
