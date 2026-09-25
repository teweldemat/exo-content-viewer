import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createStaticContentSource, type StaticContentSourceInit } from '../../src/content-source.js'

/** Tests run from the repository root (see scripts/run-tests.mjs). */
export function fixturePath(name: string): string {
  return path.join(process.cwd(), 'tests', 'fixtures', name)
}

export function readFixture(name: string): string {
  return readFileSync(fixturePath(name), 'utf8')
}

export function fixtureSource(name: string, overrides: Partial<StaticContentSourceInit> = {}) {
  return createStaticContentSource({ name, path: `/docs/${name}`, text: readFixture(name), ...overrides })
}
