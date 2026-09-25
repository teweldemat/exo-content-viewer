# Built-in renderers

All built-ins live in `src/renderers/builtin.ts` as `ContentRenderer` objects whose `load()` is a
dynamic `import()`, so bundlers code-split each view. Matching is by media type first (lower-cased,
parameters stripped), then by the extension of `name` (falling back to the last `path` segment).
Bytes are never inspected.

| id | Label | Matches | Score | maxBytes |
| --- | --- | --- | --- | --- |
| `markdown` | Markdown | `text/markdown`, `text/x-markdown`, `text/mdx`; `.md`, `.mdx`, `.markdown` | 100 | – |
| `code` | Code | any source `isTextual()` says is text: `textual: true`, a `text/*` or known text media type (`+json`, `+xml`, …), or a known text extension | 50 | – |
| `json` | JSON | `application/json`, `application/ld+json`, `application/x-ndjson`, `application/jsonl`, `text/json`; `.json`, `.jsonl`, `.ndjson`, `.json5`, `.jsonc` | 100 | 8 MiB |
| `yaml-toml` | YAML / TOML | `application/yaml`, `application/x-yaml`, `text/yaml`, `application/toml`; `.yaml`, `.yml`, `.toml` | 100 | 8 MiB |
| `table` | Table | `text/csv`, `text/tab-separated-values`; `.csv`, `.tsv`, `.tab` | 100 | 16 MiB |
| `image` | Image | `image/png`, `jpeg`, `gif`, `webp`, `bmp`, `x-icon`, `avif`, `apng`; matching extensions | 100 | – |
| `svg` | SVG | `image/svg+xml`; `.svg` | 100 | – |
| `pdf` | PDF | `application/pdf`; `.pdf` | 100 | 50 MiB |
| `media` | Media | `video/*`, `audio/*`; common media extensions | 100 | – |
| `html` | HTML | `text/html`, `application/xhtml+xml`; `.html`, `.htm`, `.xhtml` | 100 | – |
| `notebook` | Notebook | `application/x-ipynb+json`; `.ipynb` | 100 | 16 MiB |
| `diff` | Diff | `text/x-diff`, `text/x-patch`; `.diff`, `.patch` | 100 | 4 MiB |
| `hex` | Hex | anything | 10 | 1 MiB |
| `binary` | File | anything; always the last entry | 1 | – |

Office (`docx`, `xlsx`) and archive renderers from the design are out of scope for now; add them as
consumer renderers or in a later release without changing the registry shape.

## markdown

`react-markdown` with `remark-gfm` (tables, task lists, strikethrough, footnotes, autolinks),
`remark-frontmatter` (YAML or TOML front matter rendered as a Key/Value table, or as a code block when it
does not parse), `remark-math` + `rehype-katex` (`trust: false`, `throwOnError: false`), and
`rehype-slug`. A collapsible table of contents is generated from ATX headings (fenced code and front
matter are skipped) when there are at least three; its slugs come from `github-slugger`, the same
algorithm `rehype-slug` uses, so the anchors line up.

Code fences render through the shared `CodeBlock` (shiki tokens). ```` ```mermaid ```` fences render
lazily with `mermaid` (`securityLevel: 'strict'`, `htmlLabels: false`, 50 KiB cap) and are shown as an
`<img>` data URL; a failed diagram falls back to a code block with the error.

Raw HTML is off by default (`skipHtml`). `createMarkdownRenderer({ allowRawHtml: true })` enables
`rehype-raw` followed by `rehype-sanitize` with the explicit `sanitizeSchema`, then KaTeX and slugs.
The URL transform keeps relative URLs, fragments and `http`, `https`, `mailto`, `tel`; everything else
(`javascript:`, `data:`, `vbscript:` …) becomes plain text.

Links: `#fragment` stays an in-page anchor; absolute URLs open in a new tab with
`rel="noopener noreferrer"`; relative links go through `source.resolve(relative)`: a string result is
used as the `href`, a `ContentSource` result renders a link to `target.url()` whose click calls
`onNavigate(target)` (with `preventDefault`), and `null` renders the text without a link. Relative
images resolve the same way and use `url({ preview: true })`.

Exports for reuse: `MarkdownView({ text, source, colorMode, onNavigate, allowRawHtml })`,
`createMarkdownComponent(options)`.

## code

`shiki` with the JavaScript regex engine (`shiki/engine/javascript`, `forgiving: true`), the
`github-light`/`github-dark` themes chosen from `colorMode`, and grammars loaded on first use from a
curated set of explicit lazy imports of `@shikijs/langs/<id>` (`languageLoaders` and the
extension-to-grammar map in `src/shared/highlighter.ts`). The curated set keeps a bundler from
emitting one chunk per grammar shiki ships; add an entry to both maps to support another language.
Only the two themes are imported. Tokens are React spans with inline colors.

Features: line numbers, wrap toggle, copy button, go-to-line, and `#L12-L20` selection. The selection
is read from `location.hash` on mount and on `hashchange`; clicking a line number (shift-click to
extend) writes the hash with `history.replaceState`. This is independent of `onNavigate`.

Files above 512 KiB or 20,000 lines (`shouldUsePlainView`) use a plain virtualized view
(`@tanstack/react-virtual`) with line numbers and selection but no highlighting.

Exports: `CodeView({ text, ... })`, `parseLineHash`, `formatLineHash`, `shouldUsePlainView`.

## json and yaml-toml

`parseJsonDocument` parses JSON, or JSON Lines row by row for `.jsonl`/`.ndjson`/`application/x-ndjson`
(the failing line number is reported). `parseStructured` uses `yaml` (`maxAliasCount: 100`, multi-document
files become an array) and `smol-toml`. Both feed `StructuredView`: a collapsible `TreeView` with a search
box (matches keys and primitive values, expands the ancestors), copy-path buttons (`$.items[0].name`),
and a Raw toggle that shows the `code` view. Parse failures show the error and fall back to the code
view. Text above 8 MiB is refused before parsing.

## table

`papaparse` with delimiter auto-detection among `,`, tab, `;`, `|` (forced to tab for `.tsv`/`.tab`),
the first row as the header, ragged rows padded. Rows are virtualized with `@tanstack/react-virtual`.
Column headers sort (asc, desc, off) with a numeric-aware, locale, case-insensitive comparison that
keeps empty cells last; a filter row does per-column case-insensitive substring filtering; the bar shows
"Showing N of M rows", the column count and the detected delimiter. Pure helpers: `parseDelimited`,
`sortRows`, `filterRows`, `compareCells`.

## image

`<img src={source.url({ preview: true })}>` on a checkerboard with Fit / 100% / 200% zoom and the
natural size once loaded. No preview URL shows a notice.

## svg

`<img>` only (so embedded scripts never run) plus a "View source" switch to the code renderer. With no
preview URL only the source is shown.

## pdf

`react-pdf` (`pdfjs-dist`) with page navigation, zoom steps, and the text layer. The document options
object is frozen and module-level (`isEvalSupported: false`, `enableXfa: false`) so react-pdf never
reloads because of a new options identity. The worker URL is resolved relative to the module unless
`configurePdfWorker(url)` was called. Files above 50 MiB decline at `match` time (the file card offers a
download) and the view itself also refuses them.

## media

`<video controls>` for `video/*` (or a video extension), `<audio controls>` otherwise, both with
`preload="metadata"` on the preview URL.

## html

`<iframe sandbox="" src={preview url} referrerpolicy="no-referrer">` (never `srcdoc`, never same-origin)
with a "View source" switch. Without a preview URL only the source is shown.

## notebook

Parses `.ipynb` JSON (`cells`, `metadata.language_info.name`). Markdown cells render through
`MarkdownView`; code cells through `CodeBlock` with the kernel language and an `In [n]:` prompt; raw
cells as text. Outputs: `stream` as text (stderr highlighted), `error` as a code block with ANSI codes
stripped, and `display_data`/`execute_result` by MIME priority: PNG/JPEG/GIF/WebP as base64 `<img>`,
SVG as an `<img>` data URL (never inlined), `text/html` through `SanitizedHtml` (same `sanitizeSchema`),
`text/markdown` through `MarkdownView`, `application/json` through `TreeView`, then `text/plain`.

## diff

`diff2html`'s parser (`parse`) feeds React elements that use the `d2h-*` class names, so the bundled
diff2html stylesheet applies. Line-by-line and side-by-side modes toggle in the bar; side-by-side pairs
deletions with the insertions that follow them and leaves placeholders for the rest. The color scheme
class follows `colorMode`.

## hex

Loads `source.blob()` and dumps the first 64 KiB: 8-digit offsets, 16 bytes in two groups, and an ASCII
gutter. Only offered for sources up to 1 MiB (or of unknown size).

## binary

Name, path, size, media type, SHA-256, modified time, and a download link from
`source.url({ download: true })`. Always the last fallback.

## Shared building blocks (`src/shared`)

`CodeBlock`, `TreeView`, `MermaidBlock`, `SanitizedHtml`/`sanitizeHtmlToHast`, `sanitizeSchema`,
`useSourceText`/`useSourceBytes`, `highlightCode`/`resolveLanguage`, `hexDump`, table and markdown helpers.
