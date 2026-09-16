/**
 * The checks that decide whether an imported model is usable.
 *
 * model-geometry.test.mjs runs these over the real catalog; this file pins
 * down what they actually mean, using synthetic meshes shaped like the assets
 * that taught us each rule. Without this a check can quietly stop firing — it
 * still returns an array, the catalog still passes, and the next bad import
 * sails through.
 *
 * Every case here is a real asset behind it, named in the test.
 *
 * Run with `npm test`.
 */
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import test, { after } from 'node:test'

import * as esbuild from 'esbuild'

const ROOT = path.resolve(import.meta.dirname, '../..')

const outDir = await mkdtemp(path.join(tmpdir(), 'magnitudemap-model-verify-test-'))
after(() => rm(outDir, { recursive: true, force: true }))

const outFile = path.join(outDir, 'bundle.mjs')
await esbuild.build({
  entryPoints: [path.join(ROOT, 'scripts/tests/model-verify.entry.ts')],
  outfile: outFile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
})

const {
  applyAuthoringPose,
  axisToleranceFor,
  cropMeshBoxes,
  distantHelperCutoff,
  evaluateGlbMeshes,
  evaluateRenderedSize,
  isHelperLabel,
  isNeedleSize,
  isPaperSize,
  isThinGroundPlate,
  resultStatus,
  rotateBox,
  quatFromPitchYawRoll,
  skipReasonFor,
  suggestAuthoringYaw,
  vec,
} = await import(pathToFileURL(outFile).href)

const codes = (issues) => issues.map((issue) => issue.code)
const severityOf = (issues, code) => issues.find((issue) => issue.code === code)?.severity

/** A mesh box centred at the origin, sized `size`, with `vertices` verts. */
function meshAt(name, center, size, vertices = 1000, parentName = '') {
  const half = { x: size.x / 2, y: size.y / 2, z: size.z / 2 }
  return {
    name,
    parentName,
    vertices,
    min: vec(center.x - half.x, center.y - half.y, center.z - half.z),
    max: vec(center.x + half.x, center.y + half.y, center.z + half.z),
  }
}

const aircraft = (over = {}) => ({
  id: 'test-jet',
  name: 'Test jet',
  category: 'military',
  shape: 'box',
  length: 20,
  width: 12,
  height: 5,
  model: { path: 'models/test/model.glb', scaleAxis: 'length' },
  ...over,
})

// --- crop: what counts as scenery, and what is the aircraft -----------------

test('a sim teleport helper is a needle, a real fuselage is not', () => {
  // B-21: sim kits park bombs at y ~= -8192, which is a long thin AABB.
  assert.equal(isNeedleSize(vec(0.2, 8200, 0.2)), true)
  // A 70 m airliner fuselage is long but nowhere near 25x its own girth.
  assert.equal(isNeedleSize(vec(6, 6, 70)), false)
  // A Star Destroyer is 1600 m long and legitimately slender.
  assert.equal(isNeedleSize(vec(985, 447, 1600)), false)
})

test('a zero-thickness card is paper, a thin wing is not', () => {
  // Death Star II equator planes: no thickness at all, z-fights into noise.
  assert.equal(isPaperSize(vec(160, 0, 160)), true)
  // A Spitfire wing is thin, but it has a real thickness.
  assert.equal(isPaperSize(vec(11.2, 0.12, 2.1)), false)
})

test('helper meshes are recognised by name, on the node or its parent', () => {
  assert.equal(isHelperLabel('gbu_helper_01', ''), true)
  assert.equal(isHelperLabel('Object_12', 'collision_hull'), true)
  assert.equal(isHelperLabel('dummy001', ''), true)
  // "Helper" must be a word, not a substring of something innocent.
  assert.equal(isHelperLabel('wing_fillet', 'fuselage'), false)
  assert.equal(isHelperLabel('Object_4', 'B-2-airframe_0'), false)
})

test('the distant-helper cutoff scales with the model, with a floor for small ones', () => {
  // Draft horse: a stray tail-print mesh at y ~= 90 with the body around 1 m.
  const cutoff = distantHelperCutoff([0.4, 0.5, 0.6, 0.7, 90])
  assert.ok(cutoff > 0.7 && cutoff < 90, `cutoff ${cutoff} should drop the outlier but keep the body`)
  // An iPhone's meshes are millimetres apart; the floor stops a zero cutoff.
  assert.ok(distantHelperCutoff([0, 0, 0]) >= 4)
})

test('crop drops the far outlier and keeps every part of the body', () => {
  const body = [
    meshAt('fuselage', vec(0, 0, 0), vec(2, 2, 20), 20000),
    meshAt('wing-l', vec(-5, 0, 0), vec(8, 0.3, 4), 5000),
    meshAt('wing-r', vec(5, 0, 0), vec(8, 0.3, 4), 5000),
    meshAt('gear', vec(0, -1.4, 6), vec(0.6, 1.2, 0.6), 1500),
  ]
  const stray = meshAt('tail-print', vec(0, 900, 0), vec(1, 1, 1), 40)
  const kept = cropMeshBoxes([...body, stray]).map((mesh) => mesh.name)
  assert.deepEqual(kept.sort(), ['fuselage', 'gear', 'wing-l', 'wing-r'])
})

test('crop is skipped entirely for people, who are posed at runtime', () => {
  const meshes = [meshAt('body', vec(0, 0, 0), vec(0.5, 1.75, 0.3), 9000)]
  assert.equal(cropMeshBoxes(meshes, { skipAll: true }).length, 1)
})

// --- ground plates vs. the wing that looks just like one --------------------

test('a studio floor is scenery; a wing and a rotor disc are not', () => {
  const hull = vec(11.2, 3.86, 9.12)
  // Wide, thin, and just as deep in both directions: a shadow slab.
  assert.equal(isThinGroundPlate(vec(11, 0.05, 9), hull), true)
  // Wright Flyer wing: just as wide and thin, but a sixth as deep.
  assert.equal(isThinGroundPlate(vec(11.97, 0.06, 2.06), hull), false)
  // Small parts are never scenery, whatever their proportions.
  assert.equal(isThinGroundPlate(vec(0.3, 0.001, 0.3), hull), false)
})

// --- orientation ------------------------------------------------------------

test('a 90 degree authoring yaw swaps length and width exactly', () => {
  const q = quatFromPitchYawRoll(0, Math.PI / 2, 0)
  const { min, max } = rotateBox(vec(-1, -2, -10), vec(1, 2, 10), q)
  assert.ok(Math.abs(max.x - min.x - 20) < 1e-6, 'width should become the old length')
  assert.ok(Math.abs(max.z - min.z - 2) < 1e-6, 'length should become the old width')
  assert.ok(Math.abs(max.y - min.y - 4) < 1e-6, 'height is untouched by yaw')
})

test('applyAuthoringPose leaves an unrotated model alone', () => {
  const meshes = [meshAt('hull', vec(0, 0, 0), vec(2, 2, 20))]
  assert.deepEqual(applyAuthoringPose(meshes, aircraft()), meshes)
})

test('a model imported 90 degrees off gets a yaw suggestion', () => {
  // Authored nose along +X: the GLB is 12 long and 20 wide, catalog says 20x12.
  const suggestion = suggestAuthoringYaw(vec(20, 5, 12), aircraft(), 'length')
  assert.equal(suggestion, 90)
})

test('a correctly oriented model gets no suggestion', () => {
  assert.equal(suggestAuthoringYaw(vec(12, 5, 20), aircraft(), 'length'), undefined)
})

// --- rendered size ----------------------------------------------------------

test('a model matching the catalog raises nothing', () => {
  const issues = evaluateRenderedSize(aircraft(), { length: 20, width: 12, height: 5 }, 'glb')
  assert.deepEqual(codes(issues), [])
})

test('the trusted axis must be exact, because it was forced to the catalog', () => {
  // scaleAxis=length is scaled to fit, so a mismatch means the maths is wrong.
  const issues = evaluateRenderedSize(aircraft(), { length: 17, width: 12, height: 5 }, 'glb')
  assert.deepEqual(codes(issues), ['trusted-axis'])
  assert.equal(severityOf(issues, 'trusted-axis'), 'fail')
})

test('an untrusted axis is graded, not demanded', () => {
  const near = evaluateRenderedSize(aircraft(), { length: 20, width: 14, height: 5 }, 'glb')
  assert.equal(severityOf(near, 'axis-width'), 'warn')
  const far = evaluateRenderedSize(aircraft(), { length: 20, width: 20, height: 5 }, 'glb')
  assert.equal(severityOf(far, 'axis-width'), 'fail')
})

test('a model rotated 90 degrees off is named as such, not just "wrong width"', () => {
  const issues = evaluateRenderedSize(aircraft(), { length: 12, width: 20, height: 5 }, 'glb')
  assert.ok(codes(issues).includes('yaw-swapped'), `expected yaw-swapped, got ${codes(issues)}`)
})

test('a model standing on its tail is named as such', () => {
  // A 20 m aircraft rendered 20 m tall and 5 m long: pitched up onto its tail.
  const issues = evaluateRenderedSize(aircraft(), { length: 5, width: 12, height: 20 }, 'glb')
  assert.ok(codes(issues).includes('pitch-tipped'), `expected pitch-tipped, got ${codes(issues)}`)
})

test('tolerance is looser where the catalog figure is genuinely fuzzy', () => {
  // A published rotors-turning length, an animal, or a fictional ship will
  // never match a mesh as tightly as a tank does.
  const hardware = axisToleranceFor({ shape: 'box', category: 'military' })
  const animal = axisToleranceFor({ shape: 'box', category: 'animal' })
  const fiction = axisToleranceFor({ shape: 'box', category: 'fiction' })
  assert.ok(animal.fail > fiction.fail, 'animals are the loosest')
  assert.ok(fiction.fail > hardware.fail, 'hardware is the strictest')
  assert.ok(hardware.warn < hardware.fail, 'warn must come before fail')
})

// --- whole-model evaluation -------------------------------------------------

test('a clean model passes the full GLB evaluation', () => {
  const meshes = [
    meshAt('fuselage', vec(0, 0, 0), vec(2, 2, 20), 20000),
    meshAt('wing-l', vec(-3.5, 0, 0), vec(5, 0.3, 4), 5000),
    meshAt('wing-r', vec(3.5, 0, 0), vec(5, 0.3, 4), 5000),
  ]
  const { issues } = evaluateGlbMeshes(aircraft({ width: 12, height: 2, length: 20 }), meshes, 30_000)
  assert.deepEqual(codes(issues), [])
})

test('a GLB with no geometry at all fails loudly', () => {
  const { issues } = evaluateGlbMeshes(aircraft(), [], 0)
  assert.deepEqual(codes(issues), ['empty'])
})

test('a hangar left around the aircraft is caught as a sparse box', () => {
  const meshes = [
    meshAt('fuselage', vec(0, 0, 0), vec(2, 2, 20), 20000),
    meshAt('wing', vec(0, 0, 0), vec(12, 0.3, 4), 8000),
    // 200 m of terrain: the aircraft now fills almost none of its own box.
    meshAt('terrain-a', vec(-90, 0, -90), vec(4, 1, 4), 900),
    meshAt('terrain-b', vec(90, 0, 90), vec(4, 1, 4), 900),
  ]
  const { issues } = evaluateGlbMeshes(aircraft(), meshes, 30_000)
  assert.ok(
    codes(issues).some((code) => code === 'sparse-aabb' || code === 'empty-aabb' || code === 'crop-helpers'),
    `expected the leftover scenery to be reported, got ${codes(issues)}`,
  )
})

test('an over-heavy mesh is flagged so it does not reach the download', () => {
  const meshes = [meshAt('hull', vec(0, 0, 0), vec(12, 5, 20), 400_000)]
  const { issues } = evaluateGlbMeshes(aircraft(), meshes, 400_000)
  assert.ok(codes(issues).includes('heavy-mesh'))
  assert.equal(severityOf(issues, 'heavy-mesh'), 'warn')
})

// --- what the catalog is allowed to skip ------------------------------------

test('only computed and procedural items may skip verification', () => {
  assert.ok(skipReasonFor({ ...aircraft(), model: undefined }), 'a stand-in has no GLB to check')
  assert.ok(skipReasonFor({ ...aircraft(), instanceGrid: { rows: 2 } }), 'a money pile is computed')
  assert.equal(skipReasonFor(aircraft()), undefined, 'a normal model must be verified')
})

test('status is the worst severity present', () => {
  assert.equal(resultStatus([]), 'pass')
  assert.equal(resultStatus([{ severity: 'warn', code: 'a', message: '' }]), 'warn')
  assert.equal(
    resultStatus([
      { severity: 'warn', code: 'a', message: '' },
      { severity: 'fail', code: 'b', message: '' },
    ]),
    'fail',
  )
  assert.equal(resultStatus([], 'procedural stand-in'), 'skip')
})
