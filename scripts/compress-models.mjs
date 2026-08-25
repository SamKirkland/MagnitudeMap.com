/**
 * Optimize public/models/{id}/model.glb in place: Draco for geometry, WebP for
 * textures.
 *
 * Two independent stages, each with its own skip check, so a model that already
 * has one stage applied still gets the other:
 *
 *   mesh     dedup -> flatten -> weld -> resample -> prune -> draco (edgebreaker).
 *            Matches glTF Transform "basic" defaults (same as
 *            https://glb.babylonpress.org/). Simplify, quantize, and meshopt
 *            reorder stay off. Skipped when the file already declares
 *            KHR_draco_mesh_compression or EXT_meshopt_compression.
 *
 *   textures PNG/JPEG -> WebP. Normal maps go lossless (banding in a normal map
 *            shows up as visible shading artifacts); everything else is lossy at
 *            TEXTURE_QUALITY. Both passes are scoped with `formats`, so an image
 *            that is already WebP is never handed to the encoder -- re-running
 *            the script cannot stack generation loss on it. Once a file has no
 *            PNG/JPEG images left, the stage has nothing to do and is skipped.
 *
 * That makes repeat builds no-ops: after the first pass every model is Draco +
 * WebP, both checks skip, and the file is not even opened.
 *
 * Babylon reads WebP textures through EXT_texture_webp, which glTF Transform
 * adds automatically during conversion.
 *
 *   npm run compress-models
 *   npm run compress-models -- --only=starship,b21
 *   npm run compress-models -- --dry-run
 *   npm run compress-models -- --force            # redo both stages
 *   npm run compress-models -- --force-textures   # redo textures only
 *   npm run compress-models -- --max-texture=1024
 *
 * --force and --force-textures re-encode images that are already WebP and will
 * degrade them a little each time. They exist for changing the quality settings
 * below, not for routine builds.
 */
import { createWriteStream, existsSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const __dirname = dirname(fileURLToPath(import.meta.url))
const modelRoots = [
  join(__dirname, '..', 'public', 'models'),
  join(__dirname, '..', 'public', 'grounds'),
]

const MESH_COMPRESSION = new Set(['KHR_draco_mesh_compression', 'EXT_meshopt_compression'])

/**
 * Formats the texture stage will convert. Anything else is left alone.
 * textureCompress matches this against the MIME type, not the bare format name
 * its docs suggest, so these have to be `image/*`.
 */
const CONVERTIBLE_FORMATS = /^image\/(png|jpeg)$/
const CONVERTIBLE_MIME = new Set(['image/png', 'image/jpeg'])
/** Same set plus webp, used only by --force-textures. */
const RECOMPRESS_FORMATS = /^image\/(png|jpeg|webp)$/
/** Lossy quality for colour/ORM maps. Normal maps ignore this and go lossless. */
const TEXTURE_QUALITY = 82
/** CPU effort, 0-100. Build-time only, so favour size. */
const TEXTURE_EFFORT = 80
/** Longest-edge cap. Only ever downscales; aspect ratio is preserved. */
const DEFAULT_MAX_TEXTURE = 2048

const args = process.argv.slice(2)
const force = args.includes('--force')
const forceTextures = force || args.includes('--force-textures')
const dryRun = args.includes('--dry-run')
const maxTextureArg = args.find((a) => a.startsWith('--max-texture='))
const maxTexture = maxTextureArg
  ? Number(maxTextureArg.slice('--max-texture='.length))
  : DEFAULT_MAX_TEXTURE
if (!Number.isFinite(maxTexture) || maxTexture < 16) {
  console.error(`Invalid ${maxTextureArg}`)
  process.exit(1)
}
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
  for (const root of modelRoots) {
    if (!existsSync(root)) continue
    for (const id of readdirSync(root)) {
      if (onlyIds && !onlyIds.has(id)) continue
      const glb = join(root, id, 'model.glb')
      if (existsSync(glb) && statSync(glb).isFile()) out.push({ id, glb })
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

function isConvertibleImage(image) {
  if (image.mimeType) return CONVERTIBLE_MIME.has(image.mimeType)
  // No mimeType means an external URI; fall back to the file extension.
  const ext = String(image.uri ?? '').split('.').pop()?.toLowerCase() ?? ''
  return ext === 'png' || ext === 'jpeg' || ext === 'jpg'
}

/**
 * Read the GLB JSON chunk without decoding any geometry, so the skip checks stay
 * cheap enough to run over every model on every build.
 */
function glbInfo(path) {
  const empty = { used: [], required: [], convertibleImages: 0 }
  const fd = readFileSync(path)
  if (fd.length < 20) return empty
  if (fd.toString('ascii', 0, 4) !== 'glTF') return empty
  const chunkLen = fd.readUInt32LE(12)
  if (fd.toString('ascii', 16, 20) !== 'JSON') return empty
  const json = JSON.parse(fd.toString('utf8', 20, 20 + chunkLen))
  return {
    used: json.extensionsUsed ?? [],
    required: json.extensionsRequired ?? [],
    convertibleImages: (json.images ?? []).filter(isConvertibleImage).length,
  }
}

function isMeshCompressed(info) {
  return [...info.used, ...info.required].some((name) => MESH_COMPRESSION.has(name))
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

let sharpPromise = null
async function getSharp() {
  if (!sharpPromise) sharpPromise = import('sharp').then((m) => m.default)
  return sharpPromise
}

/**
 * @param {string} path
 * @param {{ mesh: boolean, textures: boolean }} stages
 */
async function compressGlb(path, stages) {
  const { dedup, flatten, weld, resample, prune, draco, textureCompress } = await import(
    '@gltf-transform/functions'
  )
  const io = await getIO()
  const document = await io.read(path)

  const transforms = []
  if (stages.mesh) {
    transforms.push(dedup(), flatten(), weld(), resample(), prune(), draco({ method: 'edgebreaker' }))
  }
  if (stages.textures) {
    const encoder = await getSharp()
    // `formats` is what keeps this idempotent: already-WebP images do not match,
    // so they pass through untouched instead of being decoded and re-encoded.
    const formats = forceTextures ? RECOMPRESS_FORMATS : CONVERTIBLE_FORMATS
    const shared = {
      encoder,
      targetFormat: 'webp',
      resize: [maxTexture, maxTexture],
      effort: TEXTURE_EFFORT,
      formats,
    }
    transforms.push(
      textureCompress({ ...shared, slots: /normalTexture/, lossless: true }),
      textureCompress({ ...shared, slots: /^(?!normalTexture).*$/, quality: TEXTURE_QUALITY }),
    )
  }

  await document.transform(...transforms)
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
    const info = glbInfo(glb)
    const stages = {
      mesh: force || !isMeshCompressed(info),
      textures: forceTextures || info.convertibleImages > 0,
    }
    const label = [stages.mesh && 'mesh', stages.textures && 'textures'].filter(Boolean).join('+')

    if (!stages.mesh && !stages.textures) {
      skipped += 1
      console.log(`skip  ${id} (${formatBytes(before)}, already compressed)`)
      continue
    }
    if (dryRun) {
      console.log(`todo  ${id} (${formatBytes(before)}, ${label})`)
      continue
    }
    try {
      await compressGlb(glb, stages)
      const after = statSync(glb).size
      const ratio = before > 0 ? ((after / before) * 100).toFixed(0) : '?'
      compressed += 1
      console.log(`ok    ${id} ${formatBytes(before)} -> ${formatBytes(after)} (${ratio}%, ${label})`)
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
