import assert from 'node:assert/strict'
import { test } from 'node:test'
import { installDom } from './helpers/dom.js'
import {
  PREFERENCES_STORAGE_KEY,
  clearPreferences,
  readPreferences,
  rememberCodeWrap,
  rememberRendererFor,
  rememberedCodeWrap,
  rememberedRendererFor,
  typeKeyOf,
  updatePreferences,
} from '../src/shared/preferences.js'

installDom()

test('typeKeyOf keys by extension, then media type, then the bare name', () => {
  assert.equal(typeKeyOf({ name: 'notes.MD', mediaType: 'text/markdown' }), '.md')
  assert.equal(typeKeyOf({ name: 'archive.tar.gz', mediaType: null }), '.gz')
  assert.equal(typeKeyOf({ name: 'docs/README.md', mediaType: null }), '.md')
  assert.equal(typeKeyOf({ name: 'Dockerfile', mediaType: 'text/plain' }), 'text/plain')
  assert.equal(typeKeyOf({ name: 'Makefile', mediaType: null }), 'makefile')
  assert.equal(typeKeyOf({ name: '.env', mediaType: null }), '.env', 'a leading dot is a name, not an extension')
  assert.equal(typeKeyOf({ name: '', mediaType: null }), '*')
})

test('renderer choices and the wrap toggle round-trip through localStorage', () => {
  clearPreferences()
  assert.equal(rememberedRendererFor({ name: 'a.json', mediaType: 'application/json' }), null)
  rememberRendererFor({ name: 'a.json', mediaType: 'application/json' }, 'code')
  rememberRendererFor({ name: 'b.md', mediaType: null }, 'hex')
  assert.equal(rememberedRendererFor({ name: 'other.JSON', mediaType: null }), 'code', 'the choice applies to every file of the type')
  assert.equal(rememberedRendererFor({ name: 'x.md', mediaType: null }), 'hex')
  assert.equal(rememberedCodeWrap(), false)
  rememberCodeWrap(true)
  assert.equal(rememberedCodeWrap(), true)
  const stored = JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? '{}') as { rendererByType: Record<string, string>; codeWrap: boolean }
  assert.deepEqual(stored, { rendererByType: { '.json': 'code', '.md': 'hex' }, codeWrap: true })
  clearPreferences()
  assert.equal(rememberedRendererFor({ name: 'a.json', mediaType: null }), null)
  assert.equal(rememberedCodeWrap(), false)
})

test('malformed stored preferences are ignored and the remembered map stays bounded', () => {
  clearPreferences()
  window.localStorage.setItem(PREFERENCES_STORAGE_KEY, '{not json')
  assert.deepEqual(readPreferences(), { rendererByType: {}, codeWrap: false })
  window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ rendererByType: { '.md': 42, '': 'x', '.ts': 'code' }, codeWrap: 'yes' }))
  assert.deepEqual(readPreferences(), { rendererByType: { '.ts': 'code' }, codeWrap: false }, 'invalid entries are dropped')
  updatePreferences((current) => {
    const rendererByType: Record<string, string> = {}
    for (let index = 0; index < 250; index += 1) rendererByType[`.t${index}`] = 'code'
    return { ...current, rendererByType }
  })
  const keys = Object.keys(readPreferences().rendererByType)
  assert.equal(keys.length, 200)
  assert.equal(keys[0], '.t50', 'the oldest entries are evicted first')
  clearPreferences()
})

test('preferences survive without storage by falling back to memory', () => {
  clearPreferences()
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
  Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('blocked') } })
  try {
    rememberRendererFor({ name: 'a.csv', mediaType: null }, 'code')
    assert.equal(rememberedRendererFor({ name: 'b.csv', mediaType: null }), 'code')
    rememberCodeWrap(true)
    assert.equal(rememberedCodeWrap(), true)
  } finally {
    if (original) Object.defineProperty(window, 'localStorage', original)
  }
  clearPreferences()
})
