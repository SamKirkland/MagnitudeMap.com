/**
 * The gate that makes a bad model import fail the build.
 *
 * `npm run verify-models` has always been able to find these problems, but it
 * only found them when somebody remembered to run it — which is exactly the
 * step an import skips. This runs the same headless pass over the whole
 * catalog (~10 s, no browser) and holds it against a baseline, so:
 *
 *   - a NEW model with a `fail` issue breaks the build, with the real message
 *   - an EXISTING known-bad model stays listed in model-verify-baseline.json
 *   - FIXING one means deleting its line, because a stale entry also fails
 *
 * That last rule is what keeps the list honest. It can only shrink.
 *
 * Run with `npm test`.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { after, before } from 'node:test'

const ROOT = path.resolve(import.meta.dirname, '../..')
const BASELINE_PATH = path.join(ROOT, 'scripts/tests/model-verify-baseline.json')

const baseline = JSON.parse(await readFile(BASELINE_PATH, 'utf8'))
/** id -> fail codes that were already broken when this gate was added. */
const known = baseline.known

let report

before(async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), 'magnitudemap-verify-'))
  after(() => rm(outDir, { recursive: true, force: true }))
  const outFile = path.join(outDir, 'verify.json')
  // Non-zero exit just means some model failed — that is the data, not an error.
  try {
    execFileSync(
      process.execPath,
      ['scripts/verify-models.mjs', '--no-shots', `--out=${path.relative(ROOT, outFile)}`],
      { cwd: ROOT, stdio: 'ignore' },
    )
  } catch {
    // Reading the report below is what decides pass or fail.
  }
  report = JSON.parse(await readFile(outFile, 'utf8'))
}, { timeout: 300_000 })

const failCodesOf = (result) =>
  [...new Set((result.issues ?? []).filter((issue) => issue.severity === 'fail').map((i) => i.code))]

test('the verify pass actually ran over the whole catalog', () => {
  assert.ok(report, 'verify-models produced no report')
  const total = Object.values(report.summary).reduce((sum, n) => sum + n, 0)
  assert.ok(total > 150, `only ${total} models verified — did the catalog fail to load?`)
  assert.equal(
    report.results.filter((r) => failCodesOf(r).includes('load')).length,
    0,
    'a GLB could not be read',
  )
  assert.equal(
    report.results.filter((r) => failCodesOf(r).includes('missing-glb')).length,
    0,
    'a catalog item points at a GLB that is not committed under public/',
  )
})

test('no model fails verification unless it is a known, listed exception', () => {
  const surprises = []
  for (const result of report.results) {
    const codes = failCodesOf(result)
    if (codes.length === 0) continue
    const allowed = new Set(known[result.id] ?? [])
    const unexpected = codes.filter((code) => !allowed.has(code))
    if (unexpected.length === 0) continue
    for (const issue of result.issues) {
      if (issue.severity !== 'fail' || !unexpected.includes(issue.code)) continue
      surprises.push(`  ${result.id} [${issue.code}] ${issue.message}`)
    }
  }
  assert.deepEqual(
    surprises,
    [],
    `Model verification failed for models that are not in the baseline.\n\n${surprises.join('\n')}\n\n` +
      'Fix the model (see "Every new or replaced model" in AGENTS.md), or — only if this is a\n' +
      'deliberate, documented exception — add the id and code to scripts/tests/model-verify-baseline.json.\n',
  )
})

test('the baseline has no stale entries, so it can only shrink', () => {
  const byId = new Map(report.results.map((result) => [result.id, result]))
  const stale = []
  for (const [id, codes] of Object.entries(known)) {
    const result = byId.get(id)
    if (!result) {
      stale.push(`  ${id} is in the baseline but not in the catalog — delete the entry`)
      continue
    }
    const actual = new Set(failCodesOf(result))
    for (const code of codes) {
      if (!actual.has(code)) {
        stale.push(`  ${id} no longer fails "${code}" — delete it from the baseline`)
      }
    }
  }
  assert.deepEqual(stale, [], `The baseline is out of date:\n\n${stale.join('\n')}\n`)
})

test('nothing hovers: every model stands on the ground', () => {
  // The runtime capture measures this from raw vertices in the rendered scene
  // (see modelVerifyCapture.measureGroundGap). The headless pass catches the
  // shape of the same bug — geometry that is not part of the silhouette
  // setting the bottom of the box the viewer grounds on.
  const floating = []
  for (const result of report.results) {
    for (const issue of result.issues ?? []) {
      if (issue.code === 'hovering' || issue.code === 'sunken') {
        floating.push(`  ${result.id} [${issue.code}] ${issue.message}`)
      }
    }
  }
  assert.deepEqual(floating, [], `Models are not sitting on the ground:\n\n${floating.join('\n')}\n`)
})
