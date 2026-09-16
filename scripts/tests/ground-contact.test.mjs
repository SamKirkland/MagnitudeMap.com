/**
 * The ground-contact check that keeps a model from hanging in the air.
 *
 * Worth pinning down because the failure is invisible to every other check: the
 * viewer grounds on the bottom of a measured box, so a model whose box is
 * bigger than its geometry still "lands" — on the phantom box. The B-2 stood on
 * a tilted landing-gear node's inflated box and floated 3.17 m.
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

const outDir = await mkdtemp(path.join(tmpdir(), 'magnitudemap-ground-contact-test-'))
after(() => rm(outDir, { recursive: true, force: true }))

const outFile = path.join(outDir, 'bundle.mjs')
await esbuild.build({
  entryPoints: [path.join(ROOT, 'scripts/tests/ground-contact.entry.ts')],
  outfile: outFile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
})

const { evaluateGroundContact, isThinGroundPlate, vec } = await import(
  pathToFileURL(outFile).href
)

/** Only `height` is read; the rest satisfies the catalog shape. */
const itemOfHeight = (height) => ({ id: 'test', name: 'Test', height })

const codes = (issues) => issues.map((issue) => issue.code)

test('a model sitting on the ground raises nothing', () => {
  assert.deepEqual(codes(evaluateGroundContact(itemOfHeight(5.18), 0)), [])
  // Float noise from a metre-scale transform is not a hover.
  assert.deepEqual(codes(evaluateGroundContact(itemOfHeight(5.18), 1e-6)), [])
  assert.deepEqual(codes(evaluateGroundContact(itemOfHeight(5.18), -1e-6)), [])
})

test('the B-2 regression fails, and says how far off it is', () => {
  const issues = evaluateGroundContact(itemOfHeight(5.18), 3.17)
  assert.deepEqual(codes(issues), ['hovering'])
  assert.equal(issues[0].severity, 'fail')
  assert.match(issues[0].message, /3\.17 m/)
  assert.match(issues[0].message, /61%/)
})

const severities = (issues) => issues.map((issue) => issue.severity)

test('the threshold scales with the model, and has a floor for small ones', () => {
  // 2% of height fails: generous enough for a real asset, far under the B-2.
  assert.deepEqual(severities(evaluateGroundContact(itemOfHeight(100), 1.5)), ['warn'])
  assert.deepEqual(severities(evaluateGroundContact(itemOfHeight(100), 2.5)), ['fail'])
  // A banana must not need a millimetre-perfect bottom to pass.
  assert.deepEqual(codes(evaluateGroundContact(itemOfHeight(0.031), 0.01)), [])
  assert.deepEqual(severities(evaluateGroundContact(itemOfHeight(0.031), 0.06)), ['fail'])
})

test('geometry below the ground is its own failure', () => {
  const issues = evaluateGroundContact(itemOfHeight(5.18), -2)
  assert.deepEqual(codes(issues), ['sunken'])
  assert.equal(issues[0].severity, 'fail')
})

test('a wing is not mistaken for the studio floor it would be grounded on', () => {
  const hull = vec(11.2, 3.86, 9.12)
  // Wide, thin, and only a sixth as deep — a Spitfire wing.
  assert.equal(isThinGroundPlate(vec(11.97, 0.06, 2.06), hull), false)
  // Wide, thin, and just as deep in both directions — a shadow slab.
  assert.equal(isThinGroundPlate(vec(11.0, 0.05, 9.0), hull), true)
})
