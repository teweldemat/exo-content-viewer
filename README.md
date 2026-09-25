# cp-content-viewer

Rich, extensible content viewer for Exoscient control panels. Give it a `ContentSource` and it picks
the best renderer (Markdown, code, JSON/YAML/TOML trees, tables, images, SVG, PDF, media, HTML,
notebooks, diffs, hex, or a plain file card) and lets the user switch between every renderer that
accepts the file.

The package is published only to the host-local registry (`npm run package:local`), like cp-lib,
and consumed through `file:vendor/cp-content-viewer-<version>.tgz`.

## Install

Peer dependencies (the same set as `cp-lib-mui`, so a consumer adds nothing new):

```
react ^19.2.7, react-dom ^19.2.7, @mui/material ^9, @emotion/react, @emotion/styled, lucide-react ^1.17
```

```ts
import { ContentViewer, createStaticContentSource } from 'cp-content-viewer'
import 'cp-content-viewer/content-viewer.css'
```

## Usage

```tsx
import { ContentViewer, type ContentSource } from 'cp-content-viewer'

function FilePane({ source, onNavigate }: { source: ContentSource; onNavigate: (target: ContentSource | string) => void }) {
  return <ContentViewer source={source} onNavigate={onNavigate} toolbar="full" />
}
```

`ContentViewer` props:

| Prop | Meaning |
| --- | --- |
| `source` | The `ContentSource` to show (below). |
| `renderers` | Extra renderers, merged with the built-ins. See "Override rules". |
| `initialRendererId` | Start with this renderer when it accepts the source; otherwise the best match. |
| `colorMode` | `'light'` or `'dark'`. Defaults to the MUI color scheme (`useColorScheme`) when a `ThemeProvider`/`CssVarsProvider` is present, else `'light'`. |
| `onNavigate` | Called when a Markdown link resolves to another `ContentSource` (or a string href) through `source.resolve`. |
| `toolbar` | `'full'` (label, "View as" menu, size and media type, download), `'compact'` (menu and download icon), `'none'`. |

The toolbar shows a "View as" `<select>` listing every renderer that accepted the source, a Download
link when `source.url({ download: true })` returns a URL, and the size and media type.

Renderer components load lazily through `React.lazy`/`Suspense` (a text fallback is shown while the
chunk loads). A renderer that throws is caught by an error boundary that shows the message and offers
"View as plain text" (the `code` renderer) and "View as binary" escapes.

## The `ContentSource` contract

`cp-content-viewer` owns this type (`src/content-source.ts`); `cp-lib-core` carries an identical mirror.

```ts
export type ContentSourceUrlOptions = { preview?: boolean; download?: boolean }
export type ContentSource = {
  name: string
  path?: string | null            // logical path for link resolution and breadcrumbs
  mediaType?: string | null       // decided by the server; the viewer never sniffs bytes
  bytes?: number | null
  textual?: boolean | null        // decided by the server
  sha256?: string | null
  modifiedAt?: string | null
  text(): Promise<string>         // capped by the producer; cached per source
  blob(): Promise<Blob>
  url(options?: ContentSourceUrlOptions): string | null
  resolve?(relative: string): ContentSource | string | null   // sibling lookup for links and images
}
```

`createStaticContentSource({ name, text | blob, mediaType?, bytes?, textual?, url?, resolve? })` builds an
in-memory source for tests and simple consumers; `text()` and `blob()` are cached.

Matching never looks at bytes: the media type wins, then the extension of `name` (or the last `path`
segment). A source with neither `textual: true`, a text media type, nor a known text extension only
gets the hex and file renderers.

## Renderer API

```ts
export type ContentRenderProps = {
  source: ContentSource
  colorMode: 'light' | 'dark'
  onNavigate?: (target: ContentSource | string) => void
}

export type ContentRenderer = {
  id: string
  label: string
  match(source: ContentSource): number | null   // higher wins; null declines
  load(): Promise<React.ComponentType<ContentRenderProps>>   // lazy
  maxBytes?: number                              // declines above this size
}

export function selectRenderers(source: ContentSource, renderers: ContentRenderer[]): ContentRenderer[]
export const builtInRenderers: ContentRenderer[]
export function mergeRenderers(custom?: ContentRenderer[]): ContentRenderer[]
```

Scores used by the built-ins: exact specialist `100`, `code` for any textual source `50`, `hex` `10`,
`binary` `1`. Helpers `matchBy({ mediaTypes, mediaTypePrefixes, extensions, score })`, `mediaTypeOf`,
`extensionOf`, `fileNameOf` and `isTextual` are exported for custom renderers.

A minimal custom renderer:

```ts
import { matchBy, type ContentRenderer } from 'cp-content-viewer'

export const geoJsonRenderer: ContentRenderer = {
  id: 'geojson',
  label: 'Map',
  match: matchBy({ mediaTypes: ['application/geo+json'], extensions: ['geojson'] }),
  load: () => import('./GeoJsonView.js').then((m) => m.default),
  maxBytes: 8 * 1024 * 1024,
}

<ContentViewer source={source} renderers={[geoJsonRenderer]} />
```

## Override rules

`selectRenderers(source, renderers)` receives the merged list (`mergeRenderers` puts the caller's
renderers first, then the built-ins) and returns the renderers that accept the source, best first:

1. Renderers whose `maxBytes` is below `source.bytes` are dropped before `match` is called.
2. Renderers returning `null` are dropped.
3. The rest are sorted by score, descending. The sort is stable, so on a tie the earlier entry, that
   is the caller's renderer, wins. A consumer that returns `100` for `.md` therefore replaces the
   built-in Markdown view without forking the package.
4. Duplicate ids keep the first occurrence, so a caller's renderer with a built-in id (`'markdown'`)
   replaces the built-in outright. `createMarkdownRenderer({ allowRawHtml: true })` uses this.
5. `binary` is always last, whatever its score, so a download card is always reachable.

## Security posture

- Media types come from the server; the viewer never sniffs bytes to decide a type.
- SVG and HTML are never inlined: SVG is shown through `<img>`, HTML in `<iframe sandbox="">` on the
  preview URL (never `srcdoc`). Both offer a "View source" switch to the code renderer.
- Markdown drops raw HTML by default (`skipHtml`). `createMarkdownRenderer({ allowRawHtml: true })`
  runs `rehype-raw` followed by `rehype-sanitize` with the explicit schema exported as
  `sanitizeSchema` (no `script`, `style`, `iframe`, `svg`, event handlers or inline styles;
  `href` limited to http/https/mailto/tel). Notebook `text/html` outputs go through the same schema.
- Markdown link and image URLs pass a transform that drops `javascript:`, `data:`, `vbscript:` and any
  other non-allow-listed scheme. External links get `target="_blank" rel="noopener noreferrer"`.
- KaTeX runs with `trust: false`; Mermaid with `securityLevel: 'strict'`, a 50 KiB cap, and its SVG is
  shown through an `<img>` data URL rather than inlined.
- Shiki tokens are React elements; nothing is injected as HTML anywhere in the package (diffs are
  rendered from diff2html's parser into React elements).
- Every heavy renderer declares `maxBytes` (JSON/YAML/TOML 8 MiB, table 16 MiB, notebook 16 MiB,
  diff 4 MiB, PDF 50 MiB, hex 1 MiB) and declines above it.

## Vite notes

### CSS

`cp-content-viewer/content-viewer.css` starts with bare `@import` specifiers:

```css
@import 'katex/dist/katex.min.css';
@import 'diff2html/bundles/css/diff2html.min.css';
@import 'react-pdf/dist/Page/TextLayer.css';
```

Vite resolves bare `@import`s in CSS through its module resolver (postcss-import semantics), so importing
the stylesheet from application code is enough. Other pipelines need `postcss-import` or must import
those three files themselves. The stylesheet uses MUI CSS variables (`--mui-palette-*`) with light and
dark fallbacks keyed on the `data-color-mode` attribute of the viewer root, so it also works without
`cssVariables` enabled on the MUI theme.

### pdf.js worker

The `pdf` renderer sets `pdfjs.GlobalWorkerOptions.workerSrc` to
`new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`, which Vite rewrites to a hashed
asset when it bundles the package. If your setup pre-bundles dependencies in a way that breaks that
(for example a very old Vite, or an unusual `optimizeDeps` configuration), give it the URL explicitly
before the first PDF is shown:

```ts
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { configurePdfWorker } from 'cp-content-viewer'

configurePdfWorker(workerUrl)
```

`pdfjs-dist` must resolve to the version this package pins (it is a regular dependency, so npm dedupes it).
pdf.js 5+ removed the `eval` code path and the `isEvalSupported` option; the renderer still passes
`isEvalSupported: false` for consumers that pin an older build, and never enables XFA.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run build` | `tsc` to `dist/` and copies `content-viewer.css`. |
| `npm test` | Type-checks `src` and `tests`, bundles each `tests/*.test.ts(x)` with esbuild (packages external, `mermaid` and `react-pdf` aliased to `tests/mocks`), and runs `node --test` with a jsdom preload. `npm test -- markdown` runs one file. |
| `npm run package:local` | Builds, packs into `./packages`, runs the forbidden-identifier guard, and writes `<registry>/npm/cp-content-viewer/<version>/{tgz,manifest.json}` plus the registry `index.json`. Honors `CP_LIB_LOCAL_REGISTRY`; requires a clean committed worktree. |

See `docs/renderers.md` for the per-renderer reference.
