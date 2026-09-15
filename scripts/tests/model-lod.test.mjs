/**
 * Level-of-detail selection, and the manifest `npm run generate-lods` writes.
 *
 * The selection rules are the part worth pinning down: a model that oscillates
 * between levels on a boundary re-uploads geometry every frame, and one that
 * picks a level it has not downloaded renders nothing at all.
 *
 * Run with `npm test`.
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import test, { after } from 'node:test'

import * as esbuild from 'esbuild'

const ROOT = path.resolve(import.meta.dirname, '../..')

const outDir = await mkdtemp(path.join(tmpdir(), 'magnitudemap-lod-test-'))
after(() => rm(outDir, { recursive: true, force: true }))

const outFile = path.join(outDir, 'bundle.mjs')
await esbuild.build({
  entryPoints: [path.join(ROOT, 'scripts/tests/model-lod.entry.ts')],
  outfile: outFile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
})

const { apparentPixelHeight, buildLodLevels, resolveLevel, wantedLevel, MODEL_LODS, lodLevelsFor } =
  await import(pathToFileURL(outFile).href)

const ready = (levels) => levels.map((level) => ({ ...level, state: 'ready' }))

test('levels come back finest-first, whichever order the manifest lists them', () => {
  const levels = buildLodLevels([
    { path: 'models/x/model.lod2.glb', triangles: 2000, bytes: 1 },
    { path: 'models/x/model.lod1.glb', triangles: 20000, bytes: 2 },
  ])
  assert.equal(levels.length, 3)
  assert.equal(levels[0].path, null)
  assert.equal(levels[0].switchBelowPixels, Number.POSITIVE_INFINITY)
  assert.equal(levels[1].path, 'models/x/model.lod1.glb')
  assert.equal(levels[2].path, 'models/x/model.lod2.glb')
  assert.ok(levels[1].switchBelowPixels > levels[2].switchBelowPixels)
})

test('a level with no known threshold is ignored rather than guessed at', () => {
  const levels = buildLodLevels([{ path: 'models/x/model.lod9.glb', triangles: 1, bytes: 1 }])
  assert.equal(levels.length, 1)
})

test('apparent size falls off with distance and saturates inside the sphere', () => {
  const near = apparentPixelHeight(10, 50, 800, 0.8, null)
  const far = apparentPixelHeight(10, 500, 800, 0.8, null)
  assert.ok(near > far)
  // Ten times the distance is a tenth the size, give or take the tangent.
  assert.ok(Math.abs(near / far - 10) < 0.5)
  assert.equal(apparentPixelHeight(10, 5, 800, 0.8, null), Number.POSITIVE_INFINITY)
})

test('an orthographic camera ignores distance', () => {
  const close = apparentPixelHeight(10, 20, 800, null, 100)
  const distant = apparentPixelHeight(10, 20000, 800, null, 100)
  assert.equal(close, distant)
  assert.equal(close, 160)
})

test('a shrinking model gives up detail at the threshold', () => {
  const levels = ready(
    buildLodLevels([
      { path: 'models/x/model.lod1.glb', triangles: 1, bytes: 1 },
      { path: 'models/x/model.lod2.glb', triangles: 1, bytes: 1 },
    ]),
  )
  assert.equal(wantedLevel(levels, 5000, 0), 0)
  assert.equal(wantedLevel(levels, levels[1].switchBelowPixels - 1, 0), 1)
  assert.equal(wantedLevel(levels, levels[2].switchBelowPixels - 1, 1), 2)
})

test('regaining detail needs more than crossing back over the line', () => {
  const levels = ready(
    buildLodLevels([
      { path: 'models/x/model.lod1.glb', triangles: 1, bytes: 1 },
      { path: 'models/x/model.lod2.glb', triangles: 1, bytes: 1 },
    ]),
  )
  const line = levels[2].switchBelowPixels
  // Just over the line is still the far level: that is the anti-flicker gap.
  assert.equal(wantedLevel(levels, line + 1, 2), 2)
  assert.equal(wantedLevel(levels, line * 1.5, 2), 1)
})

test('an undownloaded level falls back to more detail, never to nothing', () => {
  const levels = buildLodLevels([
    { path: 'models/x/model.lod1.glb', triangles: 1, bytes: 1 },
    { path: 'models/x/model.lod2.glb', triangles: 1, bytes: 1 },
  ])
  assert.equal(resolveLevel(levels, 2), 0)
  levels[1].state = 'ready'
  assert.equal(resolveLevel(levels, 2), 1)
  levels[2].state = 'ready'
  assert.equal(resolveLevel(levels, 2), 2)
})

test('every manifest level exists on disk and is smaller than its source', () => {
  const entries = Object.entries(MODEL_LODS)
  assert.ok(entries.length > 0, 'no LODs generated — run `npm run generate-lods`')
  for (const [sourcePath, entry] of entries) {
    assert.ok(
      existsSync(path.join(ROOT, 'public', sourcePath)),
      `${sourcePath} is in the LOD manifest but not in public/`,
    )
    let previous = entry.sourceTriangles
    for (const level of entry.levels) {
      assert.ok(
        existsSync(path.join(ROOT, 'public', level.path)),
        `${level.path} is in the LOD manifest but not on disk`,
      )
      assert.ok(
        level.triangles <= previous,
        `${level.path} has more triangles than the level above it`,
      )
      previous = level.triangles
    }
    assert.deepEqual(lodLevelsFor(sourcePath), entry.levels)
    assert.deepEqual(lodLevelsFor(`/${sourcePath}`), entry.levels)
  }
})
