/**
 * Country flags on catalog items, and the search that goes with them.
 *
 * The flag is the visible half; the useful half is that "USA", "American" and
 * "soviet" reach hardware whose name says none of those words. Both halves come
 * off the same `countries` field, so these pin the field down: every id maps to
 * a real item, every code to a real country, and the searches a visitor would
 * actually type land on the right things.
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

const outDir = await mkdtemp(path.join(tmpdir(), 'magnitudemap-country-test-'))
after(() => rm(outDir, { recursive: true, force: true }))

const outFile = path.join(outDir, 'bundle.mjs')
await esbuild.build({
  entryPoints: [path.join(ROOT, 'scripts/tests/country-search.entry.ts')],
  outfile: outFile,
  bundle: true,
  format: 'esm',
  platform: 'node',
})

const {
  CATALOG,
  CATALOG_BY_ID,
  COMPARISON_PRESETS,
  itemDisplayName,
  presetDisplayName,
  CATALOG_COUNTRIES,
  PRESET_COUNTRIES,
  COUNTRIES,
  flagEmoji,
  OIL_RESERVES,
  searchItems,
} = await import(pathToFileURL(outFile).href)

/** Ids drift when items are renamed; a stale key would silently drop a flag. */
test('every country assignment points at something that exists', () => {
  for (const id of Object.keys(CATALOG_COUNTRIES)) {
    assert.ok(CATALOG_BY_ID[id], `CATALOG_COUNTRIES has no catalog item "${id}"`)
  }
  for (const id of Object.keys(PRESET_COUNTRIES)) {
    assert.ok(
      COMPARISON_PRESETS.some((preset) => preset.id === id),
      `PRESET_COUNTRIES has no lineup "${id}"`,
    )
  }
})

test('every country code is registered, so it has a flag and search terms', () => {
  const assigned = [
    ...Object.values(CATALOG_COUNTRIES).flat(),
    ...Object.values(PRESET_COUNTRIES).flat(),
    ...OIL_RESERVES.map((reserve) => reserve.iso),
  ]
  for (const code of assigned) {
    assert.ok(COUNTRIES[code], `country code "${code}" is missing from COUNTRIES`)
    assert.match(code, /^[A-Z]{2}$/, `country code "${code}" is not alpha-2`)
  }
})

test('the display name leads with the flag, and plain items are untouched', () => {
  assert.equal(itemDisplayName(CATALOG_BY_ID.f22), '\u{1F1FA}\u{1F1F8} F-22 Raptor')
  assert.equal(itemDisplayName(CATALOG_BY_ID.yamato), '\u{1F1EF}\u{1F1F5} Yamato')
  // Two states genuinely built it, so it flies both flags.
  assert.equal(
    itemDisplayName(CATALOG_BY_ID.concorde),
    '\u{1F1EC}\u{1F1E7}\u{1F1EB}\u{1F1F7} Concorde',
  )
  assert.equal(itemDisplayName(CATALOG_BY_ID.godzilla), 'Godzilla (Legendary)')
  assert.equal(
    presetDisplayName(COMPARISON_PRESETS.find((preset) => preset.id === 'us-navy-today')),
    '\u{1F1FA}\u{1F1F8} US Navy today',
  )
})

/** Oil cubes had the flag baked into their name; they now share the one path. */
test('oil reserves still read as flag, country, oil', () => {
  const venezuela = CATALOG_BY_ID['oil-venezuela']
  assert.equal(itemDisplayName(venezuela), `${flagEmoji('VE')} Venezuela oil`)
  assert.deepEqual(venezuela.countries, ['VE'])
  assert.ok(searchItems(CATALOG, 'venezuela').includes(venezuela))
})

test('a country search finds hardware that never names the country', () => {
  const cases = [
    ['usa', 'f22'],
    ['united states', 'f22'],
    ['american', 'nimitz'],
    ['america', 'iowa'],
    ['soviet', 't72'],
    ['ussr', 'n1'],
    ['russian', 'su57'],
    ['british', 'spitfire'],
    ['uk', 'type45'],
    ['britain', 'big-ben'],
    ['japan', 'yamato'],
    ['japanese', 'yamato'],
    ['german', 'v2-rocket'],
    ['germany', 'hindenburg'],
    ['chinese', 'h20'],
    ['france', 'eiffel'],
    ['french', 'concorde'],
    ['italy', 'colosseum'],
    ['europe', 'a380'],
    ['brazil', 'christ-redeemer'],
    ['egypt', 'great-pyramids'],
    ['australia', 'sydney-opera-house'],
  ]
  for (const [query, id] of cases) {
    const ids = searchItems(CATALOG, query).map((item) => item.id)
    assert.ok(ids.includes(id), `"${query}" did not find ${id}`)
  }
})

test('a country search does not drag in other countries', () => {
  const ids = searchItems(CATALOG, 'japan').map((item) => item.id)
  assert.ok(ids.includes('yamato'))
  assert.ok(!ids.includes('f22'), '"japan" should not return American hardware')

  const soviet = searchItems(CATALOG, 'soviet').map((item) => item.id)
  assert.ok(soviet.includes('mig23'))
  assert.ok(!soviet.includes('abrams'), '"soviet" should not return the Abrams')
})

test('fiction and animals stay flagless', () => {
  for (const item of CATALOG) {
    if (item.category === 'fiction' || item.category === 'animal') {
      assert.equal(item.countries, undefined, `${item.id} should carry no flag`)
    }
  }
})

test('a country search finds the national lineups', () => {
  const ids = searchItems(COMPARISON_PRESETS, 'usa').map((preset) => preset.id)
  assert.ok(ids.includes('us-navy-today'))
  assert.ok(ids.includes('us-air-force-today'))
})

/** The narrower query has to keep winning, or "f22" stops finding the F-22. */
test('country terms do not outrank a name match', () => {
  assert.equal(searchItems(CATALOG, 'f22')[0].id, 'f22')
  assert.equal(searchItems(CATALOG, 'yamato')[0].id, 'yamato')
  assert.equal(searchItems(CATALOG, 'abrams')[0].id, 'abrams')
})
