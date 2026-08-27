/**
 * Catalog descriptions are authored in metric prose and converted on the fly by
 * `src/unitText.ts`. This walks every description we ship and fails if any
 * metric quantity survives the imperial conversion — so a new fact written with
 * a unit the converter does not know about is caught here rather than shipping
 * "73 t" to a reader who asked for imperial.
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

/** Bundle the TS modules under test to ESM so plain node can import them. */
const outDir = await mkdtemp(path.join(tmpdir(), 'magnitudemap-test-'))
after(() => rm(outDir, { recursive: true, force: true }))

const outFile = path.join(outDir, 'bundle.mjs')
await esbuild.build({
  entryPoints: [path.join(ROOT, 'scripts/tests/unit-text.entry.ts')],
  outfile: outFile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
})

const {
  CATALOG,
  COMPARISON_PRESETS,
  convertUnitsInText,
  IMPERIAL_EXEMPT_PHRASES,
  formatFeetInches,
} = await import(pathToFileURL(outFile).href)

/** Every user-visible description string, tagged with where it came from. */
function allDescriptions() {
  const entries = []
  for (const item of CATALOG) {
    if (item.blurb) entries.push([`${item.id}.blurb`, item.blurb])
    if (item.facts) entries.push([`${item.id}.facts`, item.facts])
  }
  for (const preset of COMPARISON_PRESETS) {
    if (preset.description) {
      entries.push([`preset:${preset.id}.description`, preset.description])
    }
  }
  return entries
}

/**
 * A number followed by a metric unit. Mirrors the converter's matcher; anything
 * this finds after conversion is a unit the converter missed.
 */
const LEFTOVER_METRIC =
  /\d[\d,]*(?:\.\d+)?\s(?:km\/h|km²|km³|km|kilometres?|kilometers?|m\/s|m²|m³|mm|cm|m|metres?|meters?|kg|kilograms?|g|grams?|t|tonnes?|litres?|liters?)(?![\w²³/])/

/** Metric units in the denominator of a rate ("per kilometre"). */
const LEFTOVER_METRIC_RATE = /per (?:kilometres?|kilometers?|km|metres?|meters?|kilograms?|kg|litres?|liters?)\b/i

/** Phrases the converter deliberately leaves metric are not failures. */
function stripExempt(text) {
  let out = text
  for (const phrase of IMPERIAL_EXEMPT_PHRASES) out = out.split(phrase).join('')
  return out
}

test('catalog is not empty (guards against an import that silently yields nothing)', () => {
  assert.ok(CATALOG.length > 50)
  assert.ok(COMPARISON_PRESETS.length > 0)
  assert.ok(allDescriptions().length > 100)
})

test('metric leaves every description untouched', () => {
  for (const [where, text] of allDescriptions()) {
    assert.equal(convertUnitsInText(text, 'metric'), text, where)
  }
})

test('no metric unit survives imperial conversion', () => {
  const failures = []
  for (const [where, text] of allDescriptions()) {
    const converted = stripExempt(convertUnitsInText(text, 'imperial'))
    const leftover =
      converted.match(LEFTOVER_METRIC) ?? converted.match(LEFTOVER_METRIC_RATE)
    if (leftover) failures.push(`${where}: "${leftover[0]}" in ${converted}`)
  }
  assert.deepEqual(failures, [], `unconverted metric units:\n${failures.join('\n')}`)
})

test('conversion never drops or mangles the surrounding prose', () => {
  for (const [where, text] of allDescriptions()) {
    const converted = convertUnitsInText(text, 'imperial')
    assert.ok(converted.length > 0, where)
    assert.equal(converted.includes('NaN'), false, `${where}: ${converted}`)
    assert.equal(converted.includes('undefined'), false, `${where}: ${converted}`)
    // Sentence count is prose structure; conversion must not eat a full stop.
    assert.equal(
      (converted.match(/\. /g) ?? []).length,
      (text.match(/\. /g) ?? []).length,
      where,
    )
  }
})

test('known quantities convert to the right imperial value', () => {
  const cases = [
    ['1.75 m tall', '5 ft 9 in tall'],
    // Sub-10 ft reads as feet and inches; a whole foot drops the empty half.
    ['1.71 m', '5 ft 7 in'],
    ['3.048 m', '10 ft'],
    ['0.15 m', '5.9 in'],
    // 10 ft and over stays decimal, and so does a range.
    ['12 m wide', '39 ft wide'],
    ['2–3 m', '6.6–9.8 ft'],
    ['398 m long', '1,310 ft long'],
    ['160 km range', '99.4 miles range'],
    ['67 km/h', '42 mph'],
    ['73 t', '80 tons'],
    ['25–35 kg of kit', '55–77 lb of kit'],
    ['120 mm smoothbore', '4.72 in smoothbore'],
    ['66 cm', '26 in'],
    ['907 kg', '2,000 lb'],
    ['67 m³', '2,400 cu ft'],
    ['1.2 m² radar cross-section', '13 sq ft radar cross-section'],
  ]
  for (const [metric, imperial] of cases) {
    assert.equal(convertUnitsInText(metric, 'imperial'), imperial, metric)
  }
})

test('feet-and-inches formatting carries and trims correctly', () => {
  const cases = [
    [1, '1 ft'],
    [1.5, '1 ft 6 in'],
    [5.99, '6 ft'],
    [0.9, '11 in'],
    [9.99, '10 ft'],
  ]
  for (const [feet, expected] of cases) {
    assert.equal(formatFeetInches(feet), expected, String(feet))
  }
})

test('non-measurements are left alone', () => {
  const untouched = [
    'about $10 million and 4,600 built',
    '15 kilotons from a gun-type design',
    'nine 16-inch guns',
    'several square metres of radar return',
    '4,500 rounds per minute',
    'flew 135 missions',
  ]
  for (const text of untouched) {
    assert.equal(convertUnitsInText(text, 'imperial'), text, text)
  }
})

/**
 * Every catalog item should be reachable from at least one lineup — the lineup
 * cards are the only crawl path to the `/c/` pages, and an item in no lineup is
 * findable only by searching the library for it by name. Importing a model
 * without adding it to a lineup fails here; see the checklist in AGENTS.md.
 */
test('every catalog item belongs to at least one lineup', () => {
  const placed = new Set()
  for (const preset of COMPARISON_PRESETS) {
    for (const id of preset.itemIds) placed.add(id)
  }
  const homeless = CATALOG.filter((item) => !placed.has(item.id)).map((item) => item.id)
  assert.deepEqual(homeless, [], `not in any lineup: ${homeless.join(', ')}`)
})

test('lineups only reference real catalog ids, with no repeats', () => {
  const ids = new Set(CATALOG.map((item) => item.id))
  for (const preset of COMPARISON_PRESETS) {
    for (const id of preset.itemIds) {
      assert.ok(ids.has(id), `lineup ${preset.id} references unknown item ${id}`)
    }
    const seen = new Set()
    const dupes = preset.itemIds.filter((id) => seen.size === seen.add(id).size)
    assert.deepEqual(dupes, [], `lineup ${preset.id} repeats: ${dupes.join(', ')}`)
  }
})

/** Lineup URLs are the slugified name, so two lineups may not share one. */
test('lineup slugs are unique', () => {
  const slugs = COMPARISON_PRESETS.map((preset) =>
    preset.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
  )
  const seen = new Set()
  const dupes = slugs.filter((slug) => seen.size === seen.add(slug).size)
  assert.deepEqual(dupes, [], `duplicate lineup slugs: ${dupes.join(', ')}`)
})
