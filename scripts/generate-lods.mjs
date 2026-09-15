/**
 * Generate level-of-detail variants beside every `public/models/{id}/model.glb`.
 *
 *   model.glb        LOD0 — the committed source, untouched. Source of truth for
 *                    bounds, orientation and scale.
 *   model.lod1.glb   mid detail: a ~25k triangle budget, textures capped at 512,
 *                    node hierarchy and original normals intact.
 *   model.lod2.glb   far detail: a ~2.5k triangle budget, textures capped at 128,
 *                    hierarchy flattened and primitives joined so the whole model
 *                    draws in as few calls as the material count allows.
 *
 * The point of LOD2 is the silhouette: meshoptimizer's simplifier is
 * error-bounded against the original surface, so the outline survives even when
 * 99% of the triangles do not. That is what lets a zoomed-out stage carry
 * hundreds of objects. A Venator goes 402k tris / 22.5 MB -> 8k tris / 675 KB.
 *
 * A level that does not beat the one above it on either bytes or triangles is
 * deleted rather than shipped — a second download for nothing.
 *
 * Skipped models:
 *
 *   skinned      A LOD would arrive with its own skeleton, and the viewer poses
 *                skeletons per placement (rest pose, T-pose relaxation, the clip
 *                it plays on focus). Swapping one mid-clip needs its own design,
 *                so people and creatures keep a single level for now.
 *   playClips    An item the viewer animates on screen. A static level cannot
 *                stand in for it however small it gets.
 *   tiny         Under MIN_SOURCE_TRIANGLES there is nothing to win.
 *
 * Other animated models are baked into the pose the viewer actually draws —
 * the last clip frame for `poseAtClipEnd`, the rest pose otherwise — and their
 * clips dropped, before any simplification runs.
 *
 * Output is recorded in `src/data/modelLods.ts` (generated, committed) keyed by
 * the source path, with the source's content hash so a changed `model.glb`
 * regenerates and an unchanged one is skipped. Both the GLBs and that manifest
 * are committed — a clone or Pages deploy must work from the files alone.
 *
 *   npm run generate-lods
 *   npm run generate-lods -- --only=a320,b21
 *   npm run generate-lods -- --dry-run
 *   npm run generate-lods -- --force
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicRoot = join(__dirname, '..', 'public')
const modelRoots = [join(publicRoot, 'models'), join(publicRoot, 'grounds')]
const manifestPath = join(__dirname, '..', 'src', 'data', 'modelLods.ts')

/**
 * Ordered coarsest-last.
 *
 * `triangleBudget` is what the level aims for in absolute terms — a far LOD is
 * useful because it costs about the same whatever it depicts, so a budget beats
 * a ratio. `minRatio` floors it so an already-light model is not destroyed, and
 * `error` is meshoptimizer's tolerance as a fraction of the mesh radius.
 *
 * The two levels differ in kind, not just degree:
 *
 *   lod1  Conservative. Exact weld only, node hierarchy intact, original
 *         normals kept, so it shades identically to LOD0 and the swap is
 *         invisible. Mostly a texture and triangle saving.
 *   lod2  Silhouette only. Positions welded regardless of normal/UV splits
 *         (without this the simplifier stalls around 25% — every hard edge is
 *         a topological border it will not cross), hierarchy flattened and
 *         primitives joined for the draw-call count, normals recomputed, and
 *         textures dropped to thumbnails.
 */
const LEVELS = [
  {
    suffix: 'lod1',
    triangleBudget: 25_000,
    minRatio: 0.25,
    error: 0.02,
    maxTexture: 512,
    textureQuality: 76,
    collapse: false,
    weldPositions: false,
    recomputeNormals: false,
  },
  {
    suffix: 'lod2',
    triangleBudget: 2_500,
    minRatio: 0.02,
    error: 0.25,
    maxTexture: 128,
    textureQuality: 60,
    collapse: true,
    weldPositions: true,
    recomputeNormals: true,
  },
]

/** Below this the source already draws for free; a LOD would only cost a fetch. */
const MIN_SOURCE_TRIANGLES = 4000
/** Never simplify a level below this — past it the silhouette starts to fold. */
const MIN_LEVEL_TRIANGLES = 400
/** A level has to beat the one above it by this much on bytes or triangles to ship. */
const LEVEL_WORTH_IT = 0.6
/** ...and this much on triangles alone if its file is the larger of the two. */
const LEVEL_BIGGER_FILE_NEEDS = 0.25

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

function listSourceGlbs() {
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

/** Path as the runtime sees it: relative to `public/`, forward slashes. */
function publicPath(absolute) {
  return relative(publicRoot, absolute).split(sep).join(posix.sep)
}

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16)
}

function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${n} B`
}

function countTriangles(document) {
  let total = 0
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices()
      const position = prim.getAttribute('POSITION')
      const verts = indices ? indices.getCount() : (position?.getCount() ?? 0)
      total += Math.floor(verts / 3)
    }
  }
  return total
}

/** glTF Transform logs every prune/weld at info level; only warnings matter here. */
const quietLogger = {
  debug() {},
  info() {},
  warn: (message) => console.warn(message),
  error: (message) => console.error(message),
}

let depsPromise = null
async function getDeps() {
  if (!depsPromise) {
    depsPromise = (async () => {
      const { NodeIO } = await import('@gltf-transform/core')
      const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions')
      const functions = await import('@gltf-transform/functions')
      const draco3d = (await import('draco3dgltf')).default
      const { MeshoptSimplifier } = await import('meshoptimizer')
      const sharp = (await import('sharp')).default
      await MeshoptSimplifier.ready
      const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
        'draco3d.decoder': await draco3d.createDecoderModule(),
        'draco3d.encoder': await draco3d.createEncoderModule(),
      })
      return { io, functions, simplifier: MeshoptSimplifier, sharp }
    })()
  }
  return depsPromise
}

/**
 * Merge vertices that share a position but were split by a normal or UV seam.
 *
 * meshoptimizer treats a split vertex as a topological border and refuses to
 * collapse across it, which on a hard-edged asset caps simplification at
 * roughly 25% however generous the error budget. Merging by position first
 * gives it a manifold to work on. The surviving vertex keeps the first copy's
 * attributes; on the far level normals are recomputed afterwards anyway and the
 * UV discontinuity lands on a 128 px texture, so neither is visible.
 */
function weldPositions() {
  return (document) => {
    const buffer = document.getRoot().listBuffers()[0]
    for (const mesh of document.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        const position = primitive.getAttribute('POSITION')
        if (!position) continue
        const positions = position.getArray()
        const count = position.getCount()

        const firstAt = new Map()
        const remap = new Uint32Array(count)
        const keep = []
        for (let i = 0; i < count; i++) {
          const key = `${positions[i * 3]},${positions[i * 3 + 1]},${positions[i * 3 + 2]}`
          let target = firstAt.get(key)
          if (target === undefined) {
            target = keep.length
            firstAt.set(key, target)
            keep.push(i)
          }
          remap[i] = target
        }
        if (keep.length === count) continue

        const indices = primitive.getIndices()
        const source = indices ? indices.getArray() : null
        const total = source ? source.length : count
        const welded = []
        for (let t = 0; t + 2 < total; t += 3) {
          const a = remap[source ? source[t] : t]
          const b = remap[source ? source[t + 1] : t + 1]
          const c = remap[source ? source[t + 2] : t + 2]
          // Collapsing a seam can fold a sliver triangle onto itself.
          if (a !== b && b !== c && a !== c) welded.push(a, b, c)
        }

        for (const semantic of primitive.listSemantics()) {
          const accessor = primitive.getAttribute(semantic)
          const array = accessor.getArray()
          const stride = accessor.getElementSize()
          const next = new array.constructor(keep.length * stride)
          for (let i = 0; i < keep.length; i++) {
            for (let c = 0; c < stride; c++) next[i * stride + c] = array[keep[i] * stride + c]
          }
          accessor.setArray(next)
        }
        primitive.setIndices(
          document.createAccessor().setArray(new Uint32Array(welded)).setBuffer(buffer),
        )
      }
    }
  }
}

/**
 * Port of `cropMeshBoxes` in `src/modelVerify.ts` / `ComparisonScene.cropImportedModel`.
 * Keep the three in lockstep.
 *
 * The viewer hides helper geometry — sim "teleport to y=-8192" bomb dummies,
 * zero-thickness cards, meshes parked far off the silhouette — before it
 * measures or draws a model. A LOD has to lose the same triangles: LOD2 joins
 * everything into one primitive, so anything still present at that point is
 * welded into the silhouette permanently and there is no hiding it later.
 *
 * Like the viewer, this runs on the raw GLB units, before any scale to metres.
 * The `person` and `playClips` exemptions do not need porting — both only
 * occur on skinned or animated files, which never reach here.
 */
const MODEL_CROP = {
  distantTypicalMult: 12,
  distantPadM: 4,
  distantMinTypicalM: 0.25,
  needleSpanM: 50,
  needleRatio: 25,
  paperSpanM: 1,
  paperMinDim: 1e-4,
  paperRatio: 1e-5,
  helperName: /gbu_helper|\bhelper\b|collision|gizmo|^dummy|^empty/i,
}

function transformPoint(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ]
}

/** World-space AABB of one primitive, matching the per-primitive meshes Babylon creates. */
function primitiveBox(primitive, worldMatrix) {
  const position = primitive.getAttribute('POSITION')
  if (!position) return null
  const lo = position.getMin([])
  const hi = position.getMax([])
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let corner = 0; corner < 8; corner++) {
    const point = transformPoint(
      worldMatrix,
      corner & 1 ? hi[0] : lo[0],
      corner & 2 ? hi[1] : lo[1],
      corner & 4 ? hi[2] : lo[2],
    )
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], point[axis])
      max[axis] = Math.max(max[axis], point[axis])
    }
  }
  return { min, max, vertices: position.getCount() }
}

function isNeedleSize(size) {
  const dims = [...size].sort((a, b) => a - b)
  return (
    dims[2] > MODEL_CROP.needleSpanM && dims[2] > MODEL_CROP.needleRatio * Math.max(dims[1], 1e-8)
  )
}

function isPaperSize(size) {
  const dims = [...size].sort((a, b) => a - b)
  return (
    dims[2] > MODEL_CROP.paperSpanM &&
    dims[0] < Math.max(dims[2] * MODEL_CROP.paperRatio, MODEL_CROP.paperMinDim)
  )
}

/** Drop the helper primitives the viewer hides. Returns how many went. */
function cropHelpers(document) {
  const parts = []
  for (const scene of document.getRoot().listScenes()) {
    scene.traverse((node) => {
      const mesh = node.getMesh()
      if (!mesh) return
      const worldMatrix = node.getWorldMatrix()
      for (const primitive of mesh.listPrimitives()) {
        const box = primitiveBox(primitive, worldMatrix)
        if (!box) continue
        parts.push({
          ...box,
          mesh,
          primitive,
          name: node.getName() ?? '',
          parentName: node.getParentNode()?.getName() ?? '',
        })
      }
    })
  }
  if (parts.length === 0) return 0

  const center = (part) => part.min.map((lo, axis) => (lo + part.max[axis]) / 2)
  const drop = new Set()

  // Vertex-weighted centroid so the body outvotes a swarm of tiny helpers.
  if (parts.length >= 2) {
    const sum = [0, 0, 0]
    let weight = 0
    for (const part of parts) {
      const c = center(part)
      const verts = Math.max(part.vertices, 1)
      for (let axis = 0; axis < 3; axis++) sum[axis] += c[axis] * verts
      weight += verts
    }
    if (weight >= 1) {
      const mid = sum.map((total) => total / weight)
      const distance = (part) => Math.hypot(...center(part).map((c, axis) => c - mid[axis]))
      const sorted = parts.map(distance).sort((a, b) => a - b)
      const typical = Math.max(
        sorted[Math.floor(sorted.length / 2)] ?? 1,
        MODEL_CROP.distantMinTypicalM,
      )
      const cutoff = typical * MODEL_CROP.distantTypicalMult + MODEL_CROP.distantPadM
      for (const part of parts) if (distance(part) > cutoff) drop.add(part)
    }
  }

  for (const part of parts) {
    if (drop.has(part)) continue
    const size = part.min.map((lo, axis) => part.max[axis] - lo)
    if (
      isNeedleSize(size) ||
      isPaperSize(size) ||
      MODEL_CROP.helperName.test(`${part.name} ${part.parentName}`)
    ) {
      drop.add(part)
    }
  }
  // Never crop a model down to nothing: that means the heuristics misfired.
  if (drop.size === parts.length) return 0

  for (const part of drop) part.mesh.removePrimitive(part.primitive)
  return drop.size
}

/**
 * The catalog, keyed by model path, loaded through Vite so this plain Node
 * script can read the TypeScript source. Same approach as `verify-models.mjs`.
 * Only paid for when an animated model actually turns up.
 */
let catalogPromise = null
async function getCatalogByModelPath() {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      const { createServer } = await import('vite')
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: 'custom',
        logLevel: 'error',
      })
      try {
        const { CATALOG_BY_ID } = await vite.ssrLoadModule('/src/data/catalog.ts')
        const byPath = new Map()
        for (const item of Object.values(CATALOG_BY_ID)) {
          if (item.model?.path) byPath.set(item.model.path.replace(/^\//, ''), item)
        }
        return byPath
      } finally {
        await vite.close()
      }
    })()
  }
  return catalogPromise
}

/**
 * Freeze an animated model into the pose the viewer actually draws.
 *
 * The viewer never plays a clip except on `playClips` items: it either holds
 * the last frame (`poseAtClipEnd` — the F-22's gear and boarding ladder) or
 * returns to the rest pose and throws the clips away. Baking the same choice
 * here lets an animated model have LODs at all — the far level flattens and
 * joins the hierarchy, which would otherwise weld in whatever pose the
 * exporter happened to leave behind.
 *
 * Keep in lockstep with `holdClipEndPose` / `disposeImportedAnimations` in
 * `ComparisonScene`.
 */
function bakeAnimationPose(document, atClipEnd) {
  if (atClipEnd) {
    for (const animation of document.getRoot().listAnimations()) {
      for (const channel of animation.listChannels()) {
        const node = channel.getTargetNode()
        const path = channel.getTargetPath()
        const sampler = channel.getSampler()
        const output = sampler?.getOutput()
        if (!node || !output) continue
        const size = output.getElementSize()
        const last = output.getCount() - 1
        if (last < 0) continue
        // CUBICSPLINE stores in-tangent, value, out-tangent per keyframe; the
        // value is the middle third.
        const stride = sampler.getInterpolation() === 'CUBICSPLINE' ? 3 : 1
        const index = stride === 3 ? last - 1 : last
        if (index < 0) continue
        const value = output.getElement(index, new Array(size).fill(0))
        if (path === 'translation') node.setTranslation(value)
        else if (path === 'rotation') node.setRotation(value)
        else if (path === 'scale') node.setScale(value)
      }
    }
  }
  for (const animation of document.getRoot().listAnimations()) animation.dispose()
}

/**
 * Strip primitives that are not triangles.
 *
 * Rigging, antennas and deck markings often ship as LINES. They carry no
 * triangles, so simplification ignores them and Draco refuses to compress them
 * — on the Nimitz, `join` merged twenty line primitives into two that stored 5
 * MB of raw float positions, more than the whole rest of the model. At the
 * distance the far level is for, a one-pixel wire is invisible anyway.
 */
function dropNonTriangles(document) {
  const TRIANGLES = 4
  let dropped = 0
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMode() === TRIANGLES) continue
      mesh.removePrimitive(primitive)
      dropped += 1
    }
  }
  return dropped
}

/** Why this model gets no LODs, or null if it should get them. */
async function skipReason(document, triangles, sourcePath) {
  if (document.getRoot().listSkins().length > 0) return 'skinned'
  if (triangles < MIN_SOURCE_TRIANGLES) return `only ${triangles} tris`
  if (document.getRoot().listAnimations().length > 0) {
    const item = (await getCatalogByModelPath()).get(sourcePath)
    // A `playClips` item is animating on screen, so a static level cannot
    // stand in for it however small it gets.
    if (!item) return 'animated, not in the catalog'
    if (item.playClips) return 'animated (plays clips)'
  }
  return null
}

async function buildLevel(sourcePath, outPath, level, sourceTriangles) {
  const { io, functions, simplifier, sharp } = await getDeps()
  const {
    dedup,
    flatten,
    join: joinPrimitives,
    weld,
    simplify,
    normals,
    prune,
    draco,
    textureCompress,
  } = functions

  const document = await io.read(sourcePath)
  document.setLogger(quietLogger)
  if (document.getRoot().listAnimations().length > 0) {
    const item = (await getCatalogByModelPath()).get(publicPath(sourcePath))
    bakeAnimationPose(document, Boolean(item?.model?.poseAtClipEnd))
  }
  // Before the crop, which measures node world matrices, and long before
  // flatten/join: the viewer never draws helper geometry, so neither should a
  // level whose parts it can no longer reach individually.
  cropHelpers(document)

  const ratio = Math.min(
    1,
    Math.max(
      level.triangleBudget / Math.max(sourceTriangles, 1),
      level.minRatio,
      // Floor so an already-light model is not simplified into mush.
      MIN_LEVEL_TRIANGLES / Math.max(sourceTriangles, 1),
    ),
  )

  if (level.collapse) dropNonTriangles(document)

  const transforms = [dedup()]
  if (level.collapse) {
    // Fewer draw calls is the whole point of the far level: one primitive per
    // material instead of one per authored part.
    transforms.push(flatten(), joinPrimitives({ keepNamed: false }))
  }
  transforms.push(level.weldPositions ? weldPositions() : weld())
  transforms.push(simplify({ simplifier, ratio, error: level.error }))
  if (level.recomputeNormals) transforms.push(normals({ overwrite: true }))
  transforms.push(
    prune(),
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [level.maxTexture, level.maxTexture],
      slots: /normalTexture/,
      lossless: true,
      effort: 80,
    }),
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [level.maxTexture, level.maxTexture],
      slots: /^(?!normalTexture).*$/,
      quality: level.textureQuality,
      effort: 80,
    }),
    draco({ method: 'edgebreaker' }),
  )

  await document.transform(...transforms)
  const triangles = countTriangles(document)
  writeFileSync(outPath, Buffer.from(await io.writeBinary(document)))
  return { triangles, bytes: statSync(outPath).size }
}

function readExistingManifest() {
  if (!existsSync(manifestPath)) return {}
  const text = readFileSync(manifestPath, 'utf8')
  const marker = 'export const MODEL_LODS: Record<string, ModelLodEntry> = '
  const start = text.indexOf(marker)
  if (start < 0) return {}
  const open = text.indexOf('{', start)
  const close = text.indexOf('\n}', open)
  if (open < 0 || close < 0) return {}
  try {
    // The generated literal is JSON-compatible by construction.
    return JSON.parse(text.slice(open, close + 2).replace(/,(\s*})$/, '$1'))
  } catch {
    return {}
  }
}

function writeManifest(entries) {
  const paths = Object.keys(entries).sort()
  const body = paths
    .map((path) => `  ${JSON.stringify(path)}: ${JSON.stringify(entries[path])},`)
    .join('\n')
  writeFileSync(
    manifestPath,
    `/**
 * GENERATED by \`npm run generate-lods\` — do not edit.
 *
 * Maps a model's source path (LOD0, under \`public/\`) to its generated detail
 * levels, ordered coarsest-last. \`sourceHash\` lets the generator tell a stale
 * level from a current one; the runtime ignores it.
 */

export type ModelLodLevel = {
  /** Path under \`public/\`, same convention as \`CatalogModelRef.path\`. */
  path: string
  triangles: number
  bytes: number
}

export type ModelLodEntry = {
  sourceHash: string
  sourceTriangles: number
  levels: ModelLodLevel[]
}

export const MODEL_LODS: Record<string, ModelLodEntry> = {
${body}
}

/** Detail levels for a catalog model path, coarsest-last. Empty when it has none. */
export function lodLevelsFor(sourcePath: string): ModelLodLevel[] {
  return MODEL_LODS[sourcePath.replace(/^\\//, '')]?.levels ?? []
}
`,
  )
}

async function main() {
  const sources = listSourceGlbs()
  if (sources.length === 0) {
    console.log('No model.glb files found.')
    return
  }

  // A full run rebuilds the manifest from scratch so entries for deleted models
  // drop out; a scoped run has to keep the ones it did not look at.
  const manifest = onlyIds || dryRun ? readExistingManifest() : {}
  const priorManifest = onlyIds || dryRun ? manifest : readExistingManifest()
  let built = 0
  let skipped = 0
  let unchanged = 0
  let failed = 0

  for (const { id, glb } of sources) {
    const key = publicPath(glb)
    const hash = hashFile(glb)
    const prior = priorManifest[key]
    const levelsOnDisk =
      prior?.levels?.every((level) => existsSync(join(publicRoot, level.path))) ?? false

    if (!force && prior && prior.sourceHash === hash && levelsOnDisk) {
      manifest[key] = prior
      unchanged += 1
      continue
    }

    let document
    let sourceTriangles
    try {
      const { io } = await getDeps()
      document = await io.read(glb)
      sourceTriangles = countTriangles(document)
    } catch (err) {
      failed += 1
      console.error(`FAIL  ${id}: ${err.message}`)
      continue
    }

    const reason = await skipReason(document, sourceTriangles, key)
    if (reason) {
      skipped += 1
      delete manifest[key]
      // A model that used to qualify and no longer does leaves files behind.
      for (const level of LEVELS) {
        const stale = join(dirname(glb), `model.${level.suffix}.glb`)
        if (existsSync(stale) && !dryRun) unlinkSync(stale)
      }
      console.log(`skip  ${id} (${reason})`)
      continue
    }

    if (dryRun) {
      console.log(`todo  ${id} (${sourceTriangles} tris, ${formatBytes(statSync(glb).size)})`)
      continue
    }

    try {
      const levels = []
      const sourceBytes = statSync(glb).size
      let previous = { triangles: sourceTriangles, bytes: sourceBytes }
      const dropped = []
      for (const level of LEVELS) {
        const outPath = join(dirname(glb), `model.${level.suffix}.glb`)
        const result = await buildLevel(glb, outPath, level, sourceTriangles)
        // A level has to be clearly cheaper than the one above it, on triangles
        // or on bytes; otherwise it is a second fetch for nothing. A file that
        // is *larger* than the level above has to earn it with a big triangle
        // win — recomputed normals and 32-bit indices can outweigh the texture
        // saving on a small model, and that is fine when the GPU cost drops
        // tenfold, but not for the B-21's 24 MB mid level that saved 0.4%.
        const cheaper =
          result.bytes <= previous.bytes * LEVEL_WORTH_IT ||
          result.triangles <= previous.triangles * LEVEL_WORTH_IT
        const earnsItsBytes =
          result.bytes < previous.bytes ||
          result.triangles <= previous.triangles * LEVEL_BIGGER_FILE_NEEDS
        if (!cheaper || !earnsItsBytes) {
          unlinkSync(outPath)
          dropped.push(level.suffix)
          continue
        }
        levels.push({ path: publicPath(outPath), ...result })
        previous = result
      }
      if (levels.length === 0) {
        skipped += 1
        delete manifest[key]
        console.log(`skip  ${id} (no level beat the source)`)
        continue
      }
      manifest[key] = { sourceHash: hash, sourceTriangles, levels }
      built += 1
      console.log(
        `ok    ${id} ${sourceTriangles} tris / ${formatBytes(sourceBytes)} -> ${levels
          .map((l) => `${l.triangles} (${formatBytes(l.bytes)})`)
          .join(' -> ')}${dropped.length ? `  [dropped ${dropped.join(', ')}]` : ''}`,
      )
    } catch (err) {
      failed += 1
      console.error(`FAIL  ${id}: ${err.message}`)
    }
  }

  if (!dryRun) writeManifest(manifest)
  console.log(
    dryRun
      ? `Dry run. ${sources.length} models.`
      : `Done. built=${built} unchanged=${unchanged} skipped=${skipped} failed=${failed}`,
  )
  if (failed) process.exitCode = 1
}

main()
