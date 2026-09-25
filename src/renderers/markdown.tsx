import { useMemo, type MouseEvent, type ReactNode } from 'react'
import Markdown, { type Components, type ExtraProps } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import rehypeSlug from 'rehype-slug'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import type { PluggableList } from 'unified'
import type { Element } from 'hast'
import type { ContentSource } from '../content-source.js'
import { CodeBlock } from '../shared/CodeBlock.js'
import { MermaidBlock } from '../shared/Mermaid.js'
import {
  extractHeadings,
  fenceLanguage,
  hastToText,
  remarkFrontmatterTable,
  resolveImage,
  resolveLink,
  safeUrl,
  type MarkdownHeading,
} from '../shared/markdown-helpers.js'
import { ErrorNotice, LoadingNotice } from '../shared/notices.js'
import { sanitizeSchema } from '../shared/sanitize-schema.js'
import { useSourceText } from '../shared/use-source-text.js'
import type { ColorMode, ContentRenderProps } from './types.js'

import type { MarkdownOptions } from './builtin.js'
export type { MarkdownOptions }

export type MarkdownViewProps = ContentRenderProps & MarkdownOptions & { text: string }

const remarkPlugins: PluggableList = [
  [remarkFrontmatter, ['yaml', 'toml']],
  remarkFrontmatterTable,
  remarkGfm,
  remarkMath,
]

const katexOptions = { trust: false, throwOnError: false, strict: 'ignore' as const }

const rehypePluginsSafe: PluggableList = [[rehypeKatex, katexOptions], rehypeSlug]
const rehypePluginsRaw: PluggableList = [rehypeRaw, [rehypeSanitize, sanitizeSchema], [rehypeKatex, katexOptions], rehypeSlug]

export function TableOfContents({ headings }: { headings: MarkdownHeading[] }) {
  const minimumDepth = Math.min(...headings.map((heading) => heading.depth))
  return (
    <details className="cv-toc" open>
      <summary>Contents</summary>
      <ul>
        {headings.map((heading, index) => (
          <li key={`${heading.id}-${index}`} className={`cv-toc-depth-${heading.depth - minimumDepth + 1}`}>
            <a href={`#${heading.id}`}>{heading.text}</a>
          </li>
        ))}
      </ul>
    </details>
  )
}

type AnchorProps = ExtraProps & { href?: string; title?: string; children?: ReactNode }
type ImageProps = ExtraProps & { src?: string | Blob; alt?: string; title?: string }
type PreProps = ExtraProps & { children?: ReactNode }

function buildComponents(source: ContentSource, colorMode: ColorMode, onNavigate?: ContentRenderProps['onNavigate']): Components {
  const Anchor = ({ href, title, children }: AnchorProps) => {
    const link = resolveLink(href, source)
    switch (link.kind) {
      case 'none':
        return <span className="cv-link-disabled">{children}</span>
      case 'anchor':
        return <a href={link.href} title={title}>{children}</a>
      case 'external':
        return <a href={link.href} title={title} target="_blank" rel="noopener noreferrer">{children}</a>
      case 'href':
        return <a href={link.href} title={title}>{children}</a>
      case 'source': {
        const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
          if (!onNavigate) return
          event.preventDefault()
          onNavigate(link.target)
        }
        return <a href={link.href || '#'} title={title} onClick={onClick} data-cv-navigate={link.target.path ?? link.target.name}>{children}</a>
      }
    }
  }
  const Image = ({ src, alt, title }: ImageProps) => {
    const resolved = resolveImage(typeof src === 'string' ? src : null, source)
    if (!resolved) return <span className="cv-image-missing">{alt ?? ''}</span>
    return <img src={resolved} alt={alt ?? ''} title={title} loading="lazy" />
  }
  const Pre = ({ node, children }: PreProps) => {
    const codeNode = node?.children.find((child): child is Element => child.type === 'element' && child.tagName === 'code')
    if (!codeNode) return <pre>{children}</pre>
    const language = fenceLanguage(codeNode.properties?.className)
    const code = hastToText(codeNode).replace(/\n$/, '')
    if (language === 'mermaid') return <MermaidBlock code={code} colorMode={colorMode} />
    return <CodeBlock code={code} language={language} colorMode={colorMode} />
  }
  return { a: Anchor, img: Image, pre: Pre }
}

/** Renders Markdown text. Exported for the notebook renderer and for tests. */
export function MarkdownView(props: MarkdownViewProps) {
  const { text, source, colorMode, onNavigate, allowRawHtml = false, tocMinimumHeadings = 3 } = props
  const headings = useMemo(() => extractHeadings(text), [text])
  const components = useMemo(() => buildComponents(source, colorMode, onNavigate), [source, colorMode, onNavigate])
  return (
    <div className="cv-markdown" data-raw-html={allowRawHtml ? 'sanitized' : 'off'}>
      {headings.length >= tocMinimumHeadings ? <TableOfContents headings={headings} /> : null}
      <Markdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={allowRawHtml ? rehypePluginsRaw : rehypePluginsSafe}
        components={components}
        urlTransform={safeUrl}
        skipHtml={!allowRawHtml}
      >
        {text}
      </Markdown>
    </div>
  )
}

export function createMarkdownComponent(options: MarkdownOptions = {}) {
  return function MarkdownRenderer(props: ContentRenderProps) {
    const text = useSourceText(props.source)
    if (text.status === 'loading') return <LoadingNotice label="Markdown" />
    if (text.status === 'error') return <ErrorNotice error={text.error} prefix="Could not load text" />
    return <MarkdownView {...props} {...options} text={text.value} />
  }
}

export default createMarkdownComponent()
