/**
 * Download curated Poly Pizza / Quaternius open GLBs into public/models/.
 * Run: npm run fetch-open-models
 *
 * Sources use the Poly Pizza CDN preview GLBs (already glTF-binary).
 */
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'

const __dirname = dirname(fileURLToPath(import.meta.url))
const modelsDir = join(__dirname, '..', 'public', 'models')

const MODELS = [
  {
    id: 'abrams',
    url: 'https://static.poly.pizza/52977e64-f4b3-4845-9d44-fe50ec8154e3.glb.br',
    license: {
      license: 'CC0-1.0',
      author: 'Quaternius',
      source: 'https://poly.pizza/m/jWS1CLA0RO',
      sourceAsset: 'Tank',
      notes:
        'CC0 low-poly tank (not a photogrammetry Abrams). Used as Abrams-scale stand-in. Scaled to 9.77 m length in-app.',
    },
  },
]

async function download(url, dest) {
  mkdirSync(dirname(dest), { recursive: true })
  const res = await fetch(url, {
    headers: { 'Accept-Encoding': 'identity' },
  })
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`)
  // CDN may still send compressed bytes; Node fetch often decompresses for us.
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
}

async function main() {
  for (const entry of MODELS) {
    const outDir = join(modelsDir, entry.id)
    mkdirSync(outDir, { recursive: true })
    const glbPath = join(outDir, 'model.glb')
    console.log(`Downloading ${entry.id}...`)
    await download(entry.url, glbPath)
    writeFileSync(
      join(outDir, 'license.json'),
      `${JSON.stringify({ id: entry.id, file: 'model.glb', ...entry.license }, null, 2)}\n`,
    )
    console.log(`OK ${entry.id}`)
  }
  console.log(`Done. ${MODELS.length} open models in public/models/`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
