import assert from 'node:assert/strict'
import { test } from 'node:test'
import { installDom, renderStatic } from './helpers/dom.js'
import { fixtureSource, readFixture } from './helpers/fixtures.js'
import { createStaticContentSource } from '../src/content-source.js'
import { YamlTomlView, parseStructured, structuredKindOf } from '../src/renderers/yaml-toml.js'

installDom()

test('yaml parses into the shared tree view', () => {
  const source = fixtureSource('sample.yaml')
  assert.equal(structuredKindOf(source), 'yaml')
  const parsed = parseStructured(readFixture('sample.yaml'), 'yaml')
  assert.deepEqual(parsed, { ok: true, value: { service: { name: 'wumis', ports: [8080, 8443] }, enabled: true } })
  const html = renderStatic(<YamlTomlView text={readFixture('sample.yaml')} source={source} colorMode="light" />)
  assert.match(html, /data-parse="ok"/)
  assert.match(html, /&quot;service&quot;/)
  assert.match(html, /cv-tree-boolean">true</)
})

test('toml parses into the shared tree view', () => {
  const source = fixtureSource('sample.toml')
  assert.equal(structuredKindOf(source), 'toml')
  assert.equal(structuredKindOf(createStaticContentSource({ name: 'x', mediaType: 'application/toml' })), 'toml')
  const parsed = JSON.parse(JSON.stringify(parseStructured(readFixture('sample.toml'), 'toml')))
  assert.deepEqual(parsed, { ok: true, value: { title: 'TOML sample', owner: { name: 'INTAPS', active: true }, servers: [{ host: 'alpha' }] } })
  const html = renderStatic(<YamlTomlView text={readFixture('sample.toml')} source={source} colorMode="light" />)
  assert.match(html, /&quot;owner&quot;/)
  assert.match(html, /aria-label="Copy path \$\.servers"/)
})

test('yaml and toml parse failures fall back to the code view and alias bombs are capped', () => {
  const badToml = parseStructured('title = "unterminated', 'toml')
  assert.equal(badToml.ok, false)
  const badYaml = parseStructured('a: [1, 2', 'yaml')
  assert.equal(badYaml.ok, false)
  const source = createStaticContentSource({ name: 'bad.yaml', text: 'a: [1, 2' })
  const html = renderStatic(<YamlTomlView text="a: [1, 2" source={source} colorMode="light" />)
  assert.match(html, /data-parse="failed"/)
  assert.match(html, /Could not parse YAML/)
  assert.match(html, /cv-code-view/)
  const bomb = ['a: &a [x, x, x, x, x, x, x, x, x, x]', 'b: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a, *a]', 'c: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b, *b]', 'd: [*c, *c, *c, *c, *c, *c, *c, *c, *c, *c]'].join('\n')
  const bombResult = parseStructured(bomb, 'yaml')
  assert.equal(bombResult.ok, false, 'alias expansion above the cap is refused')
})
