/**
 * The ground choice is deep-linkable as `?ground=new-york`. These guard the
 * slug round trip and that the default ground keeps URLs clean.
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

const outDir = await mkdtemp(path.join(tmpdir(), 'magnitudemap-ground-test-'))
after(() => rm(outDir, { recursive: true, force: true }))

const outFile = path.join(outDir, 'bundle.mjs')
await esbuild.build({
  entryPoints: [path.join(ROOT, 'scripts/tests/ground-url.entry.ts')],
  outfile: outFile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
})

const {
  GROUND_URL_PARAM,
  groundPlateSlug,
  parseGroundPlateParam,
  searchWithGroundPlate,
  DEFAULT_GROUND_PLATE,
  GROUND_PLATES,
} = await import(pathToFileURL(outFile).href)

test('every ground round-trips through its URL slug', () => {
  for (const plate of GROUND_PLATES) {
    const slug = groundPlateSlug(plate.id)
    assert.match(slug, /^[a-z0-9-]+$/, `${plate.id} slug "${slug}" is not URL-safe`)
    assert.equal(parseGroundPlateParam(slug), plate.id)
  }
})

test('New York uses a readable slug and still accepts its id', () => {
  assert.equal(groundPlateSlug('manhattan'), 'new-york')
  assert.equal(parseGroundPlateParam('manhattan'), 'manhattan')
  assert.equal(parseGroundPlateParam('New-York'), 'manhattan')
})

test('unknown or empty values are ignored', () => {
  assert.equal(parseGroundPlateParam(''), null)
  assert.equal(parseGroundPlateParam(null), null)
  assert.equal(parseGroundPlateParam('mars'), null)
})

test('the default ground leaves the query string clean', () => {
  assert.equal(searchWithGroundPlate('', DEFAULT_GROUND_PLATE), '')
  assert.equal(searchWithGroundPlate('?ground=stadium', DEFAULT_GROUND_PLATE), '')
})

test('setting a ground keeps unrelated query params', () => {
  assert.equal(
    searchWithGroundPlate('?utm_source=x', 'stadium'),
    `?utm_source=x&${GROUND_URL_PARAM}=stadium`,
  )
  assert.equal(
    searchWithGroundPlate('?ground=stadium&utm_source=x', 'manhattan'),
    '?ground=new-york&utm_source=x',
  )
})
