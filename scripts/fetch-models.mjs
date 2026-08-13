/**
 * Download selected Kenney CC0 packs and copy curated GLBs into public/models/.
 * Run: npm run fetch-models
 */
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const tmp = join(root, '.tmp-models')
const modelsDir = join(root, 'public', 'models')

const PACKS = {
  'space-kit':
    'https://kenney.nl/media/pages/assets/space-kit/20874c75ac-1677698978/kenney_space-kit.zip',
}

const CURATED = [
  {
    id: 'rifle',
    pack: 'space-kit',
    file: 'weapon_rifle.glb',
    license: {
      license: 'CC0-1.0',
      author: 'Kenney',
      source: 'https://kenney.nl/assets/space-kit',
      sourceAsset: 'weapon_rifle.glb',
      notes: 'Stylized sci-fi rifle stand-in. Scaled to 0.88 m length.',
    },
  },
  {
    id: 'spaceship',
    pack: 'space-kit',
    file: 'craft_cargoA.glb',
    license: {
      license: 'CC0-1.0',
      author: 'Kenney',
      source: 'https://kenney.nl/assets/space-kit',
      sourceAsset: 'craft_cargoA.glb',
      notes: 'Stylized cargo craft. Scaled in-app to 18 m length.',
    },
  },
  {
    id: 'astronaut',
    pack: 'space-kit',
    file: 'astronautA.glb',
    license: {
      license: 'CC0-1.0',
      author: 'Kenney',
      source: 'https://kenney.nl/assets/space-kit',
      sourceAsset: 'astronautA.glb',
      notes: 'Stylized astronaut. Scaled in-app to 1.9 m height.',
    },
  },
]

async function download(url, dest) {
  mkdirSync(dirname(dest), { recursive: true })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
}

function unzip(zipPath, dest) {
  mkdirSync(dest, { recursive: true })
  try {
    execFileSync('tar', ['-xf', zipPath, '-C', dest], { stdio: 'inherit' })
  } catch {
    execFileSync(
      'powershell',
      ['-Command', `Expand-Archive -Path '${zipPath}' -DestinationPath '${dest}' -Force`],
      { stdio: 'inherit' },
    )
  }
}

function findFileSync(packDir, filename) {
  const stack = [packDir]
  while (stack.length) {
    const dir = stack.pop()
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) stack.push(full)
      else if (entry === filename) return full
    }
  }
  return null
}

/** Prefer a colormap living next to the GLB (…/GLB format/Textures/). */
function findFileNear(filePath, filename) {
  let dir = dirname(filePath)
  for (let i = 0; i < 3; i++) {
    const hit = findFileSync(dir, filename)
    if (hit) return hit
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

/** In-place GLB JSON rewrite when from/to strings are the same length. */
function rewriteGlbTextureUri(glbPath, from, to) {
  if (from.length !== to.length) {
    throw new Error(`rewriteGlbTextureUri requires equal lengths: ${from} -> ${to}`)
  }
  const buf = readFileSync(glbPath)
  const jsonLen = buf.readUInt32LE(12)
  const jsonStart = 20
  const json = buf.subarray(jsonStart, jsonStart + jsonLen).toString('utf8')
  if (!json.includes(from)) return false
  const updated = json.split(from).join(to)
  Buffer.from(updated, 'utf8').copy(buf, jsonStart)
  writeFileSync(glbPath, buf)
  return true
}

async function main() {
  mkdirSync(tmp, { recursive: true })
  mkdirSync(modelsDir, { recursive: true })

  for (const [name, url] of Object.entries(PACKS)) {
    const zip = join(tmp, `${name}.zip`)
    const dest = join(tmp, name)
    if (!existsSync(dest)) {
      console.log(`Downloading ${name}...`)
      await download(url, zip)
      console.log(`Extracting ${name}...`)
      unzip(zip, dest)
    } else {
      console.log(`Using cached ${name}`)
    }
  }

  const ids = []
  for (const entry of CURATED) {
    const packDir = join(tmp, entry.pack)
    const src = findFileSync(packDir, entry.file)
    if (!src) {
      console.warn(`Missing ${entry.file} in ${entry.pack}`)
      continue
    }
    const outDir = join(modelsDir, entry.id)
    mkdirSync(outDir, { recursive: true })
    copyFileSync(src, join(outDir, 'model.glb'))

    // Kenney GLBs ship with uri "Textures/colormap.png". Vite URL matching is
    // case-sensitive, so we store textures/ (lowercase) and rewrite the GLB URI.
    const textureSrc = findFileNear(src, 'colormap.png') ?? findFileSync(packDir, 'colormap.png')
    if (textureSrc) {
      const textureDir = join(outDir, 'textures')
      mkdirSync(textureDir, { recursive: true })
      copyFileSync(textureSrc, join(textureDir, 'colormap.png'))
      rewriteGlbTextureUri(join(outDir, 'model.glb'), 'Textures/', 'textures/')
    }

    writeFileSync(
      join(outDir, 'license.json'),
      `${JSON.stringify({ id: entry.id, file: 'model.glb', ...entry.license }, null, 2)}\n`,
    )
    ids.push(entry.id)
    console.log(`OK ${entry.id}${textureSrc ? ' (+textures)' : ''}`)
  }

  writeFileSync(
    join(modelsDir, 'index.json'),
    `${JSON.stringify({ version: 1, models: ids }, null, 2)}\n`,
  )
  console.log(`Done. ${ids.length} models in public/models/`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
