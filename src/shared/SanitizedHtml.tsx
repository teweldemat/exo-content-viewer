import { useMemo, type ReactNode } from 'react'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import { toJsxRuntime, type Options as JsxRuntimeOptions } from 'hast-util-to-jsx-runtime'
import rehypeParse from 'rehype-parse'
import rehypeSanitize from 'rehype-sanitize'
import { unified } from 'unified'
import type { Root } from 'hast'
import { sanitizeSchema } from './sanitize-schema.js'

const processor = unified().use(rehypeParse, { fragment: true }).use(rehypeSanitize, sanitizeSchema)

/** Parses an HTML fragment and sanitizes it with the package schema. */
export function sanitizeHtmlToHast(html: string): Root {
  const tree = processor.parse(html)
  return processor.runSync(tree) as Root
}

function SafeAnchor(props: { href?: string; children?: ReactNode; title?: string }) {
  const { href, children, title } = props
  if (!href) return <span>{children}</span>
  return <a href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a>
}

/** Renders sanitized HTML as React elements (no `innerHTML`). */
export function sanitizedHtmlToReact(html: string): ReactNode {
  const tree = sanitizeHtmlToHast(html)
  return toJsxRuntime(tree, {
    Fragment,
    jsx: jsx as JsxRuntimeOptions['jsx'],
    jsxs: jsxs as JsxRuntimeOptions['jsxs'],
    components: { a: SafeAnchor } as JsxRuntimeOptions['components'],
    development: false,
    ignoreInvalidStyle: true,
    passKeys: true,
  })
}

export function SanitizedHtml({ html, className }: { html: string; className?: string }) {
  const content = useMemo(() => sanitizedHtmlToReact(html), [html])
  return <div className={className ?? 'cv-html-output'}>{content}</div>
}
