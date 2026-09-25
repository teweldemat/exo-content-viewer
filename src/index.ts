export type { ContentSource, ContentSourceUrlOptions, StaticContentSourceInit } from './content-source.js'
export { createStaticContentSource } from './content-source.js'

export type { ColorMode, ContentRenderProps, ContentRenderer } from './renderers/types.js'
export { BINARY_RENDERER_ID, selectRenderers } from './renderers/types.js'

export {
  builtInRenderers,
  mergeRenderers,
  createMarkdownRenderer,
  markdownRenderer,
  codeRenderer,
  jsonRenderer,
  yamlTomlRenderer,
  tableRenderer,
  imageRenderer,
  svgRenderer,
  pdfRenderer,
  mediaRenderer,
  htmlRenderer,
  notebookRenderer,
  diffRenderer,
  hexRenderer,
  binaryRenderer,
} from './renderers/builtin.js'
export type { MarkdownOptions } from './renderers/builtin.js'

export { SCORE, extensionOf, fileNameOf, isTextual, matchBy, mediaTypeOf } from './renderers/matching.js'
export type { MatchSpec } from './renderers/matching.js'

export { ContentViewer } from './ContentViewer.js'
export type { ContentViewerProps, ContentViewerToolbar } from './ContentViewer.js'

export { configurePdfWorker } from './pdf-worker.js'
export { sanitizeSchema } from './shared/sanitize-schema.js'
