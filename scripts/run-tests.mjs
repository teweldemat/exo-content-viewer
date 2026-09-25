/**
 * Test runner: type-checks src + tests, bundles every tests/*.test.ts(x) with esbuild (npm packages stay
 * external, `mermaid` and `react-pdf` are aliased to the mocks in tests/mocks), then runs node --test.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'dist-test')
const filter = process.argv[2] ?? null

execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.test.json'], { cwd: root, stdio: 'inherit' })

rmSync(outDir, { force: true, recursive: true })
mkdirSync(outDir, { recursive: true })

const testFiles = readdirSync(path.join(root, 'tests'))
  .filter((name) => /\.test\.tsx?$/.test(name))
  .filter((name) => !filter || name.includes(filter))
  .sort()

const setupBundle = path.join(outDir, 'setup-dom.mjs')
await build({
  entryPoints: [path.join(root, 'tests/helpers/setup-dom.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  logLevel: 'warning',
  outfile: setupBundle,
})

const bundles = []
for (const name of testFiles) {
  const outfile = path.join(outDir, name.replace(/\.tsx?$/, '.mjs'))
  await build({
    entryPoints: [path.join(root, 'tests', name)],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    jsx: 'automatic',
    packages: 'external',
    sourcemap: 'inline',
    logLevel: 'warning',
    outfile,
    alias: {
      mermaid: path.join(root, 'tests/mocks/mermaid.ts'),
      'react-pdf': path.join(root, 'tests/mocks/react-pdf.tsx'),
    },
  })
  bundles.push(outfile)
}

execFileSync(process.execPath, ['--import', setupBundle, '--test', '--test-reporter=spec', ...bundles], { cwd: root, stdio: 'inherit' })
