/**
 * The import rules that are about the *files*, not the geometry.
 *
 * `npm run verify-models` measures the mesh. It has nothing to say about a
 * model that shipped with no licence, a non-redistributable one, an
 * uncompressed 22 MB GLB, or a catalog entry with no tags — all of which are
 * steps in the AGENTS.md import checklist, and all of which were previously
 * enforced only by whoever remembered them.
 *
 * Reads the glTF JSON chunk directly, so it stays fast (no Draco decode) and
 * has no dependency on the viewer.
 *
 * Run with `npm test`.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import test, { after } from 'node:test'

import * as esbuild from 'esbuild'

const ROOT = path.resolve(import.meta.dirname, '../..')
const MODELS_DIR = path.join(ROOT, 'public/models')

const outDir = await mkdtemp(path.join(tmpdir(), 'magnitudemap-model-assets-test-'))
after(() => rm(outDir, { recursive: true, force: true }))

const outFile = path.join(outDir, 'bundle.mjs')
await esbuild.build({
  entryPoints: [path.join(ROOT, 'scripts/tests/model-assets.entry.ts')],
  outfile: outFile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
})

const { CATALOG, CATALOG_TAGS, CATALOG_FACTS } = await import(pathToFileURL(outFile).href)

const baseline = JSON.parse(
  readFileSync(path.join(ROOT, 'scripts/tests/model-asset-baseline.json'), 'utf8'),
)

/** Sketchfab slugs we are allowed to redistribute. See AGENTS.md. */
const SHIPPABLE_LICENCES = [/^CC0/i, /^CC-BY-4/i, /^CC-BY-SA/i]
/** glTF extensions that mean the mesh data is actually compressed. */
const MESH_COMPRESSION = ['KHR_draco_mesh_compression', 'EXT_meshopt_compression']

const modelItems = CATALOG.filter((item) => item.model?.path)

/** Some license.json files were written with a UTF-8 BOM. */
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''))

/** The glTF JSON chunk of a .glb, without decoding any buffers. */
function readGlbJson(file) {
  const buf = readFileSync(file)
  assert.equal(buf.readUInt32LE(0), 0x46546c67, `${file} is not a GLB (bad magic)`)
  const chunkLength = buf.readUInt32LE(12)
  const chunkType = buf.readUInt32LE(16)
  assert.equal(chunkType, 0x4e4f534a, `${file} does not start with a JSON chunk`)
  return JSON.parse(buf.subarray(20, 20 + chunkLength).toString('utf8'))
}

const modelDirs = readdirSync(MODELS_DIR).filter((name) =>
  statSync(path.join(MODELS_DIR, name)).isDirectory(),
)

test('every catalog model has its GLB committed under public/', () => {
  const missing = modelItems
    .map((item) => ({ id: item.id, file: path.join(ROOT, 'public', item.model.path) }))
    .filter(({ file }) => !existsSync(file))
    .map(({ id }) => `  ${id}`)
  assert.deepEqual(
    missing,
    [],
    `A clone or Pages deploy must work from the committed files alone:\n${missing.join('\n')}\n`,
  )
})

test('every model ships a complete license.json', () => {
  const problems = []
  for (const id of modelDirs) {
    const file = path.join(MODELS_DIR, id, 'license.json')
    if (!existsSync(file)) {
      problems.push(`  ${id}: no license.json`)
      continue
    }
    let licence
    try {
      licence = readJson(file)
    } catch (error) {
      problems.push(`  ${id}: license.json is not valid JSON (${error.message})`)
      continue
    }
    // Not `attribution`: sync-attributions composes that from the fields below
    // when license.json does not spell it out.
    for (const field of ['license', 'author', 'source']) {
      if (!licence[field]) problems.push(`  ${id}: license.json has no "${field}"`)
    }
    // AGENTS.md: "A license.json with no provenance note has not been checked."
    if (!licence.notes) {
      problems.push(`  ${id}: license.json has no "notes" — the provenance check was not recorded`)
    }
  }
  assert.deepEqual(problems, [], `Incomplete model licensing:\n${problems.join('\n')}\n`)
})

test('no model ships under a licence we are not allowed to redistribute', () => {
  // AGENTS.md: ship only CC0 / CC-BY / CC-BY-SA. Never NonCommercial,
  // NoDerivs, Editorial or Standard.
  const allowed = new Set(baseline.nonRedistributable)
  const problems = []
  for (const id of modelDirs) {
    const file = path.join(MODELS_DIR, id, 'license.json')
    if (!existsSync(file)) continue
    let licence
    try {
      licence = readJson(file)
    } catch {
      continue // reported by the test above
    }
    const slug = String(licence.license ?? '')
    if (SHIPPABLE_LICENCES.some((pattern) => pattern.test(slug))) continue
    if (allowed.has(id)) continue
    problems.push(`  ${id}: "${slug}" is not CC0 / CC-BY / CC-BY-SA`)
  }
  assert.deepEqual(
    problems,
    [],
    `Models under a licence AGENTS.md forbids shipping:\n${problems.join('\n')}\n\n` +
      'Replace the model with a redistributable one. Do not add it to the baseline\n' +
      'unless the repo owner has decided to accept the licence.\n',
  )
})

test('the non-redistributable baseline has no stale entries', () => {
  const stale = []
  for (const id of baseline.nonRedistributable) {
    const file = path.join(MODELS_DIR, id, 'license.json')
    if (!existsSync(file)) {
      stale.push(`  ${id} is no longer in public/models — delete the entry`)
      continue
    }
    const slug = String(readJson(file).license ?? '')
    if (SHIPPABLE_LICENCES.some((pattern) => pattern.test(slug))) {
      stale.push(`  ${id} is now "${slug}" — delete it from the baseline`)
    }
  }
  assert.deepEqual(stale, [], `The licence baseline is out of date:\n${stale.join('\n')}\n`)
})

test('no uncompressed GLB reaches public/models', () => {
  // AGENTS.md: "Do not leave uncompressed GLBs in public/models/."
  const problems = []
  for (const item of modelItems) {
    const file = path.join(ROOT, 'public', item.model.path)
    if (!existsSync(file)) continue
    const json = readGlbJson(file)
    const declared = [...(json.extensionsUsed ?? []), ...(json.extensionsRequired ?? [])]
    if (MESH_COMPRESSION.some((ext) => declared.includes(ext))) continue
    const mb = (statSync(file).size / 1_000_000).toFixed(1)
    problems.push(`  ${item.id}: ${mb} MB with no Draco or meshopt`)
  }
  assert.deepEqual(
    problems,
    [],
    `Run npm run compress-models -- --only={id}:\n${problems.join('\n')}\n`,
  )
})

test('every catalog item is searchable and has something to say', () => {
  // Read the *resolved* catalog, not the authoring maps: generated items (oil)
  // carry their tags and facts on their own seed, so CATALOG_TAGS / CATALOG_FACTS
  // only ever hold the hand-authored half. catalog.ts resolves seed tags with no
  // category fallback, so an item nobody authored still arrives here empty.
  const untagged = CATALOG.filter((item) => !item.tags?.length).map((i) => `  ${i.id}`)
  assert.deepEqual(
    untagged,
    [],
    `Missing tags - add to src/data/catalogTags.ts, or to the seed for a generated item:\n${untagged.join('\n')}\n`,
  )

  const factless = CATALOG.filter((item) => !item.facts?.trim()).map((i) => `  ${i.id}`)
  assert.deepEqual(
    factless,
    [],
    `Missing facts - add to src/data/catalogFacts.ts, or to the seed for a generated item:\n${factless.join('\n')}\n`,
  )
})

test('tags and facts do not name items the catalog dropped', () => {
  const ids = new Set(CATALOG.map((item) => item.id))
  const orphans = [
    ...Object.keys(CATALOG_TAGS).filter((id) => !ids.has(id)).map((id) => `  catalogTags: ${id}`),
    ...Object.keys(CATALOG_FACTS).filter((id) => !ids.has(id)).map((id) => `  catalogFacts: ${id}`),
  ]
  assert.deepEqual(orphans, [], `Entries for ids that no longer exist:\n${orphans.join('\n')}\n`)
})

test('every catalog item has real, positive dimensions', () => {
  const problems = []
  for (const item of CATALOG) {
    for (const axis of ['length', 'width', 'height']) {
      const value = item[axis]
      if (!Number.isFinite(value) || value <= 0) {
        problems.push(`  ${item.id}: ${axis} is ${value}`)
      }
    }
  }
  assert.deepEqual(problems, [], `Bad catalog dimensions:\n${problems.join('\n')}\n`)
})

test('every model declares a scaleAxis the viewer understands', () => {
  const valid = new Set(['length', 'width', 'height', 'footprint', 'max'])
  const problems = modelItems
    .filter((item) => !valid.has(item.model.scaleAxis))
    .map((item) => `  ${item.id}: scaleAxis "${item.model.scaleAxis}"`)
  assert.deepEqual(problems, [], `Unknown scaleAxis:\n${problems.join('\n')}\n`)
})

test('authoring angles are finite degrees, not radians by accident', () => {
  const problems = []
  for (const item of modelItems) {
    for (const key of ['yawDegrees', 'pitchDegrees', 'rollDegrees']) {
      const value = item.model[key]
      if (value === undefined) continue
      if (!Number.isFinite(value)) problems.push(`  ${item.id}: ${key} is ${value}`)
      else if (Math.abs(value) > 360) problems.push(`  ${item.id}: ${key} is ${value}, out of range`)
    }
  }
  assert.deepEqual(problems, [], `Bad authoring pose:\n${problems.join('\n')}\n`)
})

test('catalog ids are unique', () => {
  const seen = new Set()
  const duplicates = []
  for (const item of CATALOG) {
    if (seen.has(item.id)) duplicates.push(`  ${item.id}`)
    seen.add(item.id)
  }
  assert.deepEqual(duplicates, [], `Duplicate catalog ids:\n${duplicates.join('\n')}\n`)
})
