/**
 * Packs cp-content-viewer into ./packages and publishes it to the host-local registry, the way
 * cp-lib's scripts/build-local-packages.mjs does for its packages (minus the NuGet half).
 *
 * - Requires a clean, committed worktree whose package.json matches HEAD.
 * - Runs the same forbidden legacy-identifier guard over every file in the tarball.
 * - Writes <registry>/npm/cp-content-viewer/<version>/{tarball,manifest.json} and merges index.json.
 * - Refuses to overwrite a registry version that came from a different commit.
 *
 * The registry root is $CP_LIB_LOCAL_REGISTRY or ../registry next to this checkout (shared with cp-lib).
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = path.resolve(repositoryRoot, '..')
const packageRoot = path.join(repositoryRoot, 'packages')
const registryRoot = process.env.CP_LIB_LOCAL_REGISTRY
  ? path.resolve(process.env.CP_LIB_LOCAL_REGISTRY)
  : path.join(workspaceRoot, 'registry')
const sourcePackage = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'))
const version = sourcePackage.version
const checkedAt = new Date().toISOString()
const sourceRevision = requireCleanSourceCommit()
const commit = sourceRevision.short

/** Identifiers from retired control-panel capabilities that must never ship in a package payload. */
const forbiddenLegacyPayloadPatterns = [
  'EXO_CALLER_ACCESS',
  'taskPermission',
  'TaskPermission',
  'request-access',
  'release-access',
  'resource-details',
  'resource-queue',
  'application-code',
  'application-workspace-files',
  'AccessPolicyProfiles',
]

const definition = {
  id: sourcePackage.name,
  kind: 'npm',
  description: sourcePackage.description,
  dependencies: {},
  peerDependencies: sourcePackage.peerDependencies ?? {},
}

await stat(path.join(repositoryRoot, 'dist', 'index.js')).catch(() => {
  throw new Error('dist/index.js is missing; run `npm run build` first (package:local does this).')
})

await rm(packageRoot, { force: true, recursive: true })
await mkdir(packageRoot, { recursive: true })
await mkdir(registryRoot, { recursive: true })

const packOutput = execFileSync('npm', ['pack', '--json', '--pack-destination', packageRoot], {
  cwd: repositoryRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
})
const [packResult] = JSON.parse(packOutput)
await assertCleanNpmPayload(packResult)
requireCleanWorktree()

const tarballName = packResult.filename
const tarballPath = path.join(packageRoot, tarballName)
const registryDirectory = path.join(registryRoot, definition.kind, definition.id, version)
await assertRegistryVersionProvenance(registryDirectory)
await rm(registryDirectory, { force: true, recursive: true })
await mkdir(registryDirectory, { recursive: true })
const registryArtifactPath = path.join(registryDirectory, tarballName)
await cp(tarballPath, registryArtifactPath)
const sha256 = await fileSha256(registryArtifactPath)
const artifact = {
  fileName: tarballName,
  relativePath: path.relative(registryRoot, registryArtifactPath).split(path.sep).join('/'),
  sha256,
  bytes: packResult.size,
}
const manifest = {
  package: definition.id,
  kind: definition.kind,
  version,
  description: definition.description,
  createdAt: checkedAt,
  sourceCommit: commit,
  sourceCommitFull: sourceRevision.full,
  dependencies: definition.dependencies,
  peerDependencies: definition.peerDependencies,
  artifact,
}
await writeFile(path.join(registryDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
await writeFile(path.join(packageRoot, 'manifest.json'), JSON.stringify({ ...manifest, artifact: { ...artifact, localPath: tarballName } }, null, 2) + '\n')

const registryEntry = {
  id: definition.id,
  kind: definition.kind,
  version,
  description: definition.description,
  sourceCommit: commit,
  createdAt: checkedAt,
  dependencies: definition.dependencies,
  artifact,
}
const registryPackages = await mergeRegistryPackages([registryEntry])
await writeFile(
  path.join(registryRoot, 'index.json'),
  JSON.stringify({
    schemaVersion: 1,
    createdAt: checkedAt,
    sourceRepository: repositoryRoot,
    sourceCommit: commit,
    packages: registryPackages,
  }, null, 2) + '\n',
)

console.log(JSON.stringify({ registryRoot, version, packages: [registryEntry] }, null, 2))

function readGitValue(args) {
  return execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

function requireCleanSourceCommit() {
  let full
  try {
    full = readGitValue(['rev-parse', 'HEAD'])
  } catch {
    throw new Error('Local packages require a committed Git source revision.')
  }
  requireCleanWorktree()
  let committedPackage
  try {
    committedPackage = JSON.parse(execFileSync('git', ['show', 'HEAD:package.json'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }))
  } catch {
    throw new Error('Unable to verify the committed package metadata for local packaging.')
  }
  if (committedPackage.name !== sourcePackage.name || committedPackage.version !== version) {
    throw new Error('Working package name/version does not match the committed source revision.')
  }
  return { full, short: full.slice(0, 12) }
}

function requireCleanWorktree() {
  let status
  try {
    status = readGitValue(['status', '--porcelain=v1', '--untracked-files=all'])
  } catch {
    throw new Error('Unable to verify local package source cleanliness.')
  }
  if (status) {
    throw new Error('Local packages must be built from a clean committed worktree; commit first.')
  }
}

async function assertRegistryVersionProvenance(registryDirectory) {
  try {
    const info = await stat(registryDirectory)
    if (!info.isDirectory()) throw new Error(`Local package registry version path is not a directory: ${registryDirectory}`)
  } catch (error) {
    if (error?.code === 'ENOENT') return
    throw error
  }
  let existingManifest
  try {
    existingManifest = JSON.parse(await readFile(path.join(registryDirectory, 'manifest.json'), 'utf8'))
  } catch {
    throw new Error(`Refusing to replace an existing package version without valid provenance: ${registryDirectory}`)
  }
  if (existingManifest.sourceCommit !== commit) {
    throw new Error(
      `Refusing to replace ${existingManifest.package ?? 'package'} ${existingManifest.version ?? version}; `
      + `existing source commit ${existingManifest.sourceCommit ?? 'unknown'} differs from ${commit}. Bump the package version.`,
    )
  }
}

async function assertCleanNpmPayload(packResult) {
  if (!Array.isArray(packResult.files)) throw new Error('npm pack did not return a verifiable file list.')
  for (const entry of packResult.files) {
    const relativePath = String(entry?.path ?? '').replaceAll('\\', '/')
    if (!relativePath || relativePath.startsWith('../') || path.isAbsolute(relativePath)) {
      throw new Error(`npm pack returned an unsafe payload path: ${relativePath || '<empty>'}`)
    }
    if (/(^|\/)verb-defaults(?:\.json|\/)/.test(relativePath)) {
      throw new Error(`Legacy verb-default payload is forbidden: ${relativePath}`)
    }
    const content = await readFile(path.join(repositoryRoot, relativePath))
    assertNoLegacyPayload(content, relativePath)
  }
}

function assertNoLegacyPayload(content, label) {
  const text = content.toString('utf8')
  const forbidden = forbiddenLegacyPayloadPatterns.find((pattern) => text.includes(pattern))
  if (forbidden) throw new Error(`Legacy capability payload ${forbidden} is forbidden in ${label}.`)
}

async function mergeRegistryPackages(currentPackages) {
  const indexPath = path.join(registryRoot, 'index.json')
  let existingPackages = []
  try {
    const existingIndex = JSON.parse(await readFile(indexPath, 'utf8'))
    if (existingIndex.schemaVersion !== 1 || !Array.isArray(existingIndex.packages)) {
      throw new Error(`Unsupported local package registry index: ${indexPath}`)
    }
    existingPackages = existingIndex.packages
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  const replacedKeys = new Set(currentPackages.map(registryPackageKey))
  return [
    ...existingPackages.filter((entry) => !replacedKeys.has(registryPackageKey(entry))),
    ...currentPackages,
  ].sort((left, right) => registryPackageKey(left).localeCompare(registryPackageKey(right)))
}

function registryPackageKey(entry) {
  const id = typeof entry?.id === 'string' ? entry.id : typeof entry?.package === 'string' ? entry.package : null
  if (!id || typeof entry?.kind !== 'string') throw new Error('Local package registry entries require a package id and kind.')
  return `${entry.kind}:${id}`
}

async function fileSha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex')
}
