/**
 * Draco-compress public/models/{id}/model.glb in place.
 * Already-compressed files (KHR_draco_mesh_compression or EXT_meshopt_compression)
 * are left untouched so builds no-op after the first pass.
 *
 *   npm run compress-models
 *   npm run compress-models -- --only=starship,b21
 *   npm run compress-models -- --force
 *   npm run compress-models -- --dry-run
 */
import { createWriteStream, existsSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const __dirname = dirname(fileURLToPath(import.meta.url))
const modelsDir = join(__dirname, '..', 'public', 'models')

const MESH_COMPRESSION = new Set(['KHR_draco_mesh_compression', 'EXT_meshopt_compression'])

const args = process.argv.slice(2)
const force = args.includes('--force')
const dryRun = args.includes('--dry-run')
const onlyArg = args.find((a) => a.startsWith('--only='))
const onlyIds = onlyArg
  ? new Set(
      onlyArg
        .slice('--only='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
  : null

function listModelGlbs() {
  const out = []
  if (!existsSync(modelsDir)) return out
  for (const id of readdirSync(modelsDir)) {
    if (onlyIds && !onlyIds.has(id)) continue
    const glb = join(modelsDir, id, 'model.glb')
    if (existsSync(glb) && statSync(glb).isFile()) out.push({ id, glb })
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

function glbExtensions(path) {
  const fd = readFileSync(path)
  if (fd.length < 20) return { used: [], required: [] }
  const magic = fd.toString('ascii', 0, 4)
  if (magic !== 'glTF') return { used: [], required: [] }
  const chunkLen = fd.readUInt32LE(12)
  const chunkType = fd.toString('ascii', 16, 20)
  if (chunkType !== 'JSON') return { used: [], required: [] }
  const json = JSON.parse(fd.toString('utf8', 20, 20 + chunkLen))
  return {
    used: json.extensionsUsed ?? [],
    required: json.extensionsRequired ?? [],
  }
}

function isMeshCompressed(exts) {
  return [...exts.used, ...exts.required].some((name) => MESH_COMPRESSION.has(name))
}

function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${n} B`
}

let ioPromise = null
async function getIO() {
  if (!ioPromise) {
    ioPromise = (async () => {
      const { NodeIO } = await import('@gltf-transform/core')
      const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions')
      const draco3d = (await import('draco3dgltf')).default
      return new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({
          'draco3d.decoder': await draco3d.createDecoderModule(),
          'draco3d.encoder': await draco3d.createEncoderModule(),
        })
    })()
  }
  return ioPromise
}

async function compressGlb(path) {
  const { draco } = await import('@gltf-transform/functions')
  const io = await getIO()
  const document = await io.read(path)
  await document.transform(draco({ method: 'edgebreaker' }))
  const bytes = await io.writeBinary(document)
  const tmp = `${path}.tmp`
  await pipeline(Readable.from(Buffer.from(bytes)), createWriteStream(tmp))
  renameSync(tmp, path)
}

async function main() {
  const models = listModelGlbs()
  if (models.length === 0) {
    console.log('No model.glb files found.')
    return
  }

  let skipped = 0
  let compressed = 0
  let failed = 0

  for (const { id, glb } of models) {
    const before = statSync(glb).size
    const exts = glbExtensions(glb)
    if (!force && isMeshCompressed(exts)) {
      skipped += 1
      console.log(`skip  ${id} (${formatBytes(before)}, already compressed)`)
      continue
    }
    if (dryRun) {
      console.log(`todo  ${id} (${formatBytes(before)})`)
      continue
    }
    try {
      await compressGlb(glb)
      const after = statSync(glb).size
      const ratio = before > 0 ? ((after / before) * 100).toFixed(0) : '?'
      compressed += 1
      console.log(`ok    ${id} ${formatBytes(before)} → ${formatBytes(after)} (${ratio}%)`)
    } catch (err) {
      failed += 1
      const tmp = `${glb}.tmp`
      if (existsSync(tmp)) unlinkSync(tmp)
      console.error(`FAIL  ${id}:`, err.message)
    }
  }

  console.log(
    dryRun
      ? `Dry run. ${models.length} models, ${skipped} already compressed.`
      : `Done. compressed=${compressed} skipped=${skipped} failed=${failed}`,
  )
  if (failed) process.exitCode = 1
}

main()
