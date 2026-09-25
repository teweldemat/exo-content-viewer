import type { Options as Schema } from 'rehype-sanitize'

/**
 * Explicit sanitizer schema used for raw Markdown HTML and notebook HTML outputs.
 * Nothing that can execute script, load frames, or carry inline styles survives.
 */
export const sanitizeSchema: Schema = {
  strip: ['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'svg', 'math', 'form', 'textarea', 'select', 'button'],
  clobberPrefix: 'user-content-',
  clobber: ['id', 'name'],
  ancestors: {
    li: ['ol', 'ul'],
    tbody: ['table'],
    tfoot: ['table'],
    thead: ['table'],
    td: ['table'],
    th: ['table'],
    tr: ['table'],
  },
  protocols: {
    href: ['http', 'https', 'mailto', 'tel'],
    src: ['http', 'https'],
    cite: ['http', 'https'],
  },
  tagNames: [
    'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'code', 'dd', 'del', 'details', 'dfn', 'div', 'dl', 'dt', 'em',
    'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'input', 'ins', 'kbd', 'li', 'mark',
    'ol', 'p', 'pre', 'q', 's', 'samp', 'section', 'small', 'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody',
    'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul', 'var', 'wbr',
  ],
  attributes: {
    a: ['href', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    blockquote: ['cite'],
    q: ['cite'],
    code: [['className', /^language-./, 'math-inline', 'math-display']],
    input: [['type', 'checkbox'], ['disabled', true], ['checked', true]],
    li: [['className', 'task-list-item']],
    ol: ['start', 'type'],
    td: ['align', 'colSpan', 'rowSpan'],
    th: ['align', 'colSpan', 'rowSpan', 'scope'],
    details: ['open'],
    '*': ['id', 'title', 'dir', 'lang', 'abbr'],
  },
  required: {
    input: { type: 'checkbox', disabled: true },
  },
  allowComments: false,
  allowDoctypes: false,
}
