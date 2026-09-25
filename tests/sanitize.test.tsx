import assert from 'node:assert/strict'
import { test } from 'node:test'
import { installDom, renderStatic } from './helpers/dom.js'
import { SanitizedHtml, sanitizeHtmlToHast } from '../src/shared/SanitizedHtml.js'
import { sanitizeSchema } from '../src/shared/sanitize-schema.js'

installDom()

const hostile = [
  '<script>alert(1)</script>',
  '<img src="https://ok.example/a.png" onerror="alert(2)" alt="ok">',
  '<img src="javascript:alert(3)">',
  '<a href="javascript:alert(4)">js</a>',
  '<a href="https://ok.example/" target="_blank" onclick="x()">ok</a>',
  '<iframe src="https://evil.example"></iframe>',
  '<object data="x"></object><embed src="x">',
  '<form action="https://evil.example"><input type="text" name="pw"><button>go</button></form>',
  '<svg onload="alert(5)"><script>alert(6)</script></svg>',
  '<math><mi>x</mi></math>',
  '<style>body{display:none}</style>',
  '<p style="color:red" id="target" class="x">styled</p>',
  '<details open><summary>s</summary>d</details>',
  '<input type="checkbox" checked disabled> task',
  '<table><tr><td colspan="2">cell</td></tr></table>',
].join('')

test('sanitizer schema removes everything executable and keeps benign structure', () => {
  const html = renderStatic(<SanitizedHtml html={hostile} />)
  assert.doesNotMatch(html, /<script/i)
  assert.doesNotMatch(html, /alert\(/)
  assert.doesNotMatch(html, /onerror|onclick|onload/i)
  assert.doesNotMatch(html, /javascript:/i)
  assert.doesNotMatch(html, /<iframe|<object|<embed|<form|<button|<svg|<math|<style/i)
  assert.doesNotMatch(html, /evil\.example/)
  assert.doesNotMatch(html, /style=/)
  assert.doesNotMatch(html, /class="x"/, 'arbitrary classes are dropped')
  assert.match(html, /<img src="https:\/\/ok.example\/a.png" alt="ok"\/>/)
  assert.match(html, /<span>js<\/span>/, 'links without a safe href become spans')
  assert.match(html, /<a href="https:\/\/ok.example\/" target="_blank" rel="noopener noreferrer">ok<\/a>/)
  assert.match(html, /<p id="user-content-target">styled<\/p>/, 'ids are clobber-prefixed')
  assert.match(html, /<details open=""><summary>s<\/summary>d<\/details>/)
  assert.match(html, /<input type="checkbox" (checked="" disabled=""|disabled="" checked="")\/>/)
  assert.match(html, /<td colspan="2">cell<\/td>/i)
})

test('sanitizer schema is explicit and has no wildcard attributes that carry handlers or styles', () => {
  assert.ok(Array.isArray(sanitizeSchema.tagNames))
  assert.ok(!sanitizeSchema.tagNames!.includes('script'))
  assert.ok(!sanitizeSchema.tagNames!.includes('iframe'))
  assert.ok(!sanitizeSchema.tagNames!.includes('style'))
  assert.deepEqual(sanitizeSchema.attributes!['*'], ['id', 'title', 'dir', 'lang', 'abbr'])
  assert.deepEqual(sanitizeSchema.protocols!.href, ['http', 'https', 'mailto', 'tel'])
  const tree = sanitizeHtmlToHast('<a href="data:text/html,hi">x</a><a href="//cdn.example/x">y</a>')
  const anchors = JSON.stringify(tree)
  assert.doesNotMatch(anchors, /data:text/)
  assert.match(anchors, /\/\/cdn.example\/x/, 'protocol-relative urls are allowed like http(s)')
})
