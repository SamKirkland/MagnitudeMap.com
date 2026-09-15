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
 *   model.lod3.glb   swarm detail: ~400 triangles and 64 px textures. Only earns
 *                    its keep on a fleet lineup — 30,000 aircraft at the far
 *                    level is 90M triangles a frame, and at this one it is 12M.
 *
 * The point of LOD2 is the silhouette: meshoptimizer's simplifier is
 * error-bounded against the original surface, so the outline survives even when
 * 99% of the triangles do not. That is what lets a zoomed-out stage carry
 * hundreds of objects. A Venator goes 402k tris / 22.5 MB -> 8k tris / 675 KB.
 *
 * A level that does not beat the one above it on either bytes or triangles is
 * deleted rather than shipped — a second download for nothing.
 *
 * Animation is baked away before anything is simplified, because a level has to
 * be static geometry:
 *
 *   node clips   Frozen at the pose the viewer actually draws — the last clip
 *                frame for `poseAtClipEnd` (the F-22's gear and boarding
 *                ladder), the rest pose otherwise.
 *   skins        Dropped outright, but only for the models where that provably
 *                changes nothing: a glTF skin whose node transforms are its own
 *                bind pose contributes identity at rest, so the raw positions
 *                already are the pose a renderer draws (`skinRestDeviation`).
 *                It still loses the walk cycle, so those models only get the far
 *                and swarm levels, where they are too small for that to show
 *                (`allowSkinned`). A model whose rest pose is a real deformation
 *                is skipped: posing it needs a decision the file does not make,
 *                and a wrong guess ships a mangled animal.
 *
 * Skipped models:
 *
 *   tiny         Under MIN_SOURCE_TRIANGLES there is nothing to win.
 *   unlisted     An animated model with no catalog entry, since the pose to
 *                bake comes from the catalog.
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
    allowSkinned: true,
    triangleBudget: 2_500,
    minRatio: 0.02,
    // Held well below the swarm level's: a quarter of the mesh radius folds an
    // organic surface in on itself (the elephant's ears and trunk), and on
    // hard-surface models the simplifier is topology-limited long before the
    // error budget binds, so there is nothing to gain by being generous.
    error: 0.08,
    maxTexture: 128,
    textureQuality: 60,
    collapse: true,
    weldPositions: true,
    recomputeNormals: true,
  },
  {
    suffix: 'lod3',
    allowSkinned: true,
    triangleBudget: 400,
    minRatio: 0.002,
    error: 0.8,
    maxTexture: 64,
    textureQuality: 55,
    collapse: true,
    collapseMaterials: true,
    weldPositions: true,
    sloppy: true,
    recomputeNormals: true,
  },
]

/**
 * Below this the source already draws for free; a LOD would only cost a fetch.
 * Kept low because a fleet lineup multiplies it: 377 Fletchers at the source's
 * 2,530 triangles is 954k a frame, and at the swarm level's 400 it is 151k.
 */
const MIN_SOURCE_TRIANGLES = 1200
/**
 * Never simplify a level below this — past it the silhouette starts to fold.
 * It is also the swarm level's whole budget, which is the point: at 30 px an
 * aeroplane is a wing, a fuselage and a fin, and 400 triangles draw all three.
 */
const MIN_LEVEL_TRIANGLES = 400
/**
 * How far a vertex may move when the skeleton is collapsed for a skinned model
 * still to qualify, as a fraction of the model's size. Effectively zero: the
 * only skins accepted are the ones that do nothing at rest.
 */
const MAX_SKIN_REST_DEVIATION = 0.01
/** Split ratio above which position welding is worth its damage. See `positionSplitRatio`. */
const POSITION_WELD_SPLIT_RATIO = 1.45
/**
 * How far a level may reach outside the model, as a fraction of the model's
 * largest dimension: `maxGrowth` before it is rebuilt through a safer recipe,
 * `maxDrift` before it is not shipped at all. Per level, because a level is
 * only ever seen at one size.
 *
 * This is the dial on a trade. `join` displaces some geometry on most of these
 * hierarchies — 7% on the C-47, 12-19% on the Hellcat and the B-17 — and the
 * recipe that avoids it also gives up the merge the simplifier needs, so the
 * level lands several times heavier or cannot beat the level above it and is
 * dropped. What matters is whether the displacement is legible: on lod1 and
 * lod2, which are drawn from 320 px down to 34, a part a tenth of the model out
 * of place is a wheel hanging in the air; on the swarm level, drawn below 34 px
 * and mostly a thousand strong in a fleet, the same fraction is two pixels.
 *
 * Only growth counts. A simplifier can only pull a silhouette inwards — the
 * swarm level of a thin-winged aeroplane legitimately loses 40% of its span at
 * 400 triangles — so shrinkage is never evidence of a bug, while anything
 * *outside* the model is geometry the pipeline put there.
 */
/**
 * Bump when a change here would produce different output from the same source.
 *
 * The source hash tells us when a *model* changed; nothing told us when the
 * *pipeline* changed, so every fix in this file — a dropped skin's transform, a
 * collapse that repainted the model, a level that came out with parts in open
 * air — sat unapplied in ninety-odd committed GLBs until someone remembered
 * `--force`. A level built by an older pipeline is now stale by definition.
 *
 * 1: skinned node transforms cleared on drop, material colours baked to
 *    vertices before the collapse, silhouette and scale guards.
 * 2: swarm-level silhouette tolerance loosened; see LEVEL_GROWTH_LIMITS.
 */
const PIPELINE_VERSION = 2

const LEVEL_GROWTH_LIMITS = {
  lod1: { maxGrowth: 0.08, maxDrift: 0.2 },
  lod2: { maxGrowth: 0.1, maxDrift: 0.25 },
  // The swarm level is drawn below 34 px and, in a fleet, several thousand
  // strong: what it costs matters more here than anywhere else, and what it
  // looks like matters less. Tightening this to 0.2 cost the Thunderbolt and
  // the Skytrain their swarm levels outright — the recipe that avoids the merge
  // cannot beat the level above it, so it is dropped and 5,000 aircraft draw at
  // lod2 instead, 16M triangles for one block. At 0.35 they keep a 400-triangle
  // level and the displacement is a few pixels on a shape that is 30 across.
  // lod1 and lod2 stay strict: those are the levels you see close up, and that
  // is where a wheel hanging in the air is a wheel hanging in the air.
  lod3: { maxGrowth: 0.35, maxDrift: 0.6 },
}
const DEFAULT_GROWTH_LIMITS = { maxGrowth: 0.1, maxDrift: 0.25 }
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
/**
 * How many times over the average position is duplicated. Hard-surface models
 * split a vertex at every hard normal and UV seam and land well above 1.5 (a
 * Venator 1.73, an Abrams 2.20); smooth organic meshes sit near 1.2 (a wolf
 * 1.19, an elephant 1.39).
 */
function positionSplitRatio(document) {
  let vertices = 0
  let unique = 0
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION')
      if (!position) continue
      const array = position.getArray()
      const count = position.getCount()
      const seen = new Set()
      for (let i = 0; i < count; i++) {
        seen.add(`${array[i * 3]},${array[i * 3 + 1]},${array[i * 3 + 2]}`)
      }
      vertices += count
      unique += seen.size
    }
  }
  return unique > 0 ? vertices / unique : 1
}

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

/** sRGB channel (0-1) to linear, the transfer glTF uses for base colour. */
function srgbToLinear(value) {
  const c = Math.min(Math.max(value, 0), 1)
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Mean colour of a texture, in linear space, or null if it cannot be read. */
async function averageTextureColor(texture, sharp) {
  const image = texture?.getImage()
  if (!image) return null
  try {
    const stats = await sharp(Buffer.from(image)).stats()
    const [r, g, b] = stats.channels
    if (!r || !g || !b) return null
    return [r, g, b].map((channel) => srgbToLinear(channel.mean / 255))
  } catch {
    // An exotic encoding is not worth failing a level over; skip the texture.
    return null
  }
}

/**
 * Fold each primitive's material colour into its vertex colours.
 *
 * Only useful ahead of `collapseMaterials`, and necessary because of it: once
 * every primitive is on one material, the model is painted in whichever colour
 * happened to cover the most triangles — the Hellcat's whole airframe went the
 * colour of its canopy glass. Vertex colours survive the collapse, the join and
 * the simplifier, cost one float4 a vertex on a 400-triangle mesh, and need no
 * extra draw call, so the swarm level can keep its markings while still being
 * one primitive on one material.
 *
 * A textured material contributes the texture's average colour: at this level
 * the texture itself is thrown away, and its average is what the eye reads off
 * a shape 30 px tall anyway.
 */
async function bakeMaterialColorsToVertices(document, sharp) {
  const buffer = document.getRoot().listBuffers()[0]
  if (!buffer) return 0
  const cache = new Map()
  let baked = 0

  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const material = primitive.getMaterial()
      const position = primitive.getAttribute('POSITION')
      if (!material || !position) continue

      let colour = cache.get(material)
      if (!colour) {
        const factor = material.getBaseColorFactor() ?? [1, 1, 1, 1]
        const mean = await averageTextureColor(material.getBaseColorTexture(), sharp)
        colour = [0, 1, 2].map((i) => factor[i] * (mean ? mean[i] : 1))
        cache.set(material, colour)
      }

      const count = position.getCount()
      const existing = primitive.getAttribute('COLOR_0')
      const existingSlots = existing?.getType() === 'VEC3' ? 3 : 4
      const slot = new Array(existingSlots).fill(1)
      const array = new Float32Array(count * 4)
      for (let v = 0; v < count; v++) {
        if (existing) existing.getElement(v, slot)
        for (let c = 0; c < 3; c++) array[v * 4 + c] = colour[c] * (existing ? slot[c] : 1)
        // Alpha stays on the material: the viewer draws these levels opaque.
        array[v * 4 + 3] = 1
      }
      primitive.setAttribute(
        'COLOR_0',
        document.createAccessor().setArray(array).setType('VEC4').setBuffer(buffer),
      )
      baked += 1
    }
  }
  return baked
}

/**
 * Put every primitive on one material, so `join` can merge the whole model into
 * a single primitive.
 *
 * Simplification runs per primitive, and each one bottoms out at a handful of
 * triangles it cannot collapse further. A model with twenty materials therefore
 * has a floor of twenty times that: the P-38 would not go below 5,224 triangles
 * however small the budget, which on a 1,800-aircraft block is 9M triangles a
 * frame for aeroplanes 30 px tall. Collapsing to one material drops the floor to
 * one primitive's worth.
 *
 * The survivor is whichever material covers the most triangles, stripped of its
 * own colour: what each part is painted has already been folded into its vertex
 * colours, which cost nothing extra to draw and survive everything downstream.
 * Only the swarm level does this; the far level still keeps its materials.
 */
function collapseMaterials(document) {
  const share = new Map()
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const material = primitive.getMaterial()
      if (!material) continue
      const indices = primitive.getIndices()
      const position = primitive.getAttribute('POSITION')
      const count = indices ? indices.getCount() : (position?.getCount() ?? 0)
      share.set(material, (share.get(material) ?? 0) + count)
    }
  }
  if (share.size < 2) return 0
  let winner = null
  let most = -1
  for (const [material, count] of share) {
    if (count > most) {
      most = count
      winner = material
    }
  }
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) primitive.setMaterial(winner)
  }
  // The vertices carry the colour now (see `bakeMaterialColorsToVertices`), so
  // the surviving material has to stop carrying its own or every primitive
  // would be tinted by it — and its texture would be painted over the whole
  // model, which is how the collapse used to repaint half an aeroplane.
  winner.setBaseColorTexture(null)
  const alpha = winner.getBaseColorFactor()?.[3] ?? 1
  winner.setBaseColorFactor([1, 1, 1, alpha])
  return share.size - 1
}

/** Column-major 4x4 product, `a` applied after `b` to a column vector. */
function mat4Multiply(a, b) {
  const out = new Array(16).fill(0)
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k]
      out[col * 4 + row] = sum
    }
  }
  return out
}

/**
 * Largest distance a vertex would move if the skeleton were collapsed into the
 * geometry, as a fraction of the model's size.
 *
 * glTF stores skinned positions in bind space and poses them with
 * `jointWorldMatrix x inverseBindMatrix`. When the file's node transforms are
 * its bind pose those products are all identity, the skeleton does nothing at
 * rest, and the raw positions are exactly what a renderer draws — so the skin
 * can be dropped with no geometry change at all. When they are not, the rest
 * pose is a real deformation and dropping the skin would show the bind pose
 * instead: a different shape, and not one the file tells us is correct.
 */
function skinRestDeviation(document) {
  let worst = 0
  for (const node of document.getRoot().listNodes()) {
    const skin = node.getSkin()
    const mesh = node.getMesh()
    if (!skin || !mesh) continue
    const joints = skin.listJoints()
    const ibmAccessor = skin.getInverseBindMatrices()
    const jointMatrices = joints.map((joint, index) => {
      const world = joint.getWorldMatrix()
      if (!ibmAccessor) return world
      return mat4Multiply(world, ibmAccessor.getElement(index, new Array(16).fill(0)))
    })

    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION')
      const jointsAttribute = primitive.getAttribute('JOINTS_0')
      const weights = primitive.getAttribute('WEIGHTS_0')
      if (!position || !jointsAttribute || !weights) continue
      const array = position.getArray()
      const count = position.getCount()
      const lo = position.getMin([])
      const hi = position.getMax([])
      const size = Math.max(Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]), 1e-6)

      const skinMatrix = new Array(16)
      const jointSlot = new Array(4)
      const weightSlot = new Array(4)
      const step = Math.max(1, Math.floor(count / 400))
      for (let v = 0; v < count; v += step) {
        skinMatrix.fill(0)
        let total = 0
        jointsAttribute.getElement(v, jointSlot)
        weights.getElement(v, weightSlot)
        for (let k = 0; k < 4; k++) {
          const weight = weightSlot[k]
          if (!weight) continue
          const matrix = jointMatrices[jointSlot[k]]
          if (!matrix) continue
          for (let i = 0; i < 16; i++) skinMatrix[i] += matrix[i] * weight
          total += weight
        }
        if (total <= 1e-6) continue
        if (Math.abs(total - 1) > 1e-4) {
          for (let i = 0; i < 16; i++) skinMatrix[i] /= total
        }
        const x = array[v * 3]
        const y = array[v * 3 + 1]
        const z = array[v * 3 + 2]
        const moved = transformPoint(skinMatrix, x, y, z)
        const drift = Math.hypot(moved[0] - x, moved[1] - y, moved[2] - z) / size
        if (drift > worst) worst = drift
      }
    }
  }
  return worst
}

/**
 * Turn a skinned mesh into static geometry by removing the skeleton and nothing
 * else.
 *
 * Only safe when `skinRestDeviation` is ~0, which is the caller's job to check:
 * then the skeleton is provably doing nothing at rest and the vertices are
 * already in the pose a renderer draws. Deliberately no vertex maths, no
 * reparenting and no transform changes — the file's geometry and hierarchy come
 * out byte-identical apart from the skin itself, which is what makes this a
 * change we can be sure of.
 */
function dropSkin(document) {
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!node.getSkin() || !mesh) continue
    for (const primitive of mesh.listPrimitives()) {
      for (const semantic of primitive.listSemantics()) {
        if (/^(JOINTS|WEIGHTS)_\d+$/.test(semantic)) primitive.setAttribute(semantic, null)
      }
    }
    node.setSkin(null)
    // glTF ignores a skinned mesh node's transform — the joint matrices carry
    // the whole pose — so the moment the mesh stops being skinned that
    // transform starts applying, and the level renders at a scale and
    // orientation LOD0 never had. The ankylosaurus node carries a 2x scale and
    // the carnotaurus node a quarter turn, which is exactly how they looked:
    // one doubling in size and the other spinning as the camera crossed the
    // switch distance.
    clearNodeWorldTransform(document, node)
  }
  for (const skin of document.getRoot().listSkins()) skin.dispose()
  for (const animation of document.getRoot().listAnimations()) animation.dispose()
}

/**
 * Give a node the identity world matrix: its own transform cleared, and the
 * node lifted out from under any parent still carrying one.
 */
function clearNodeWorldTransform(document, node) {
  node.setTranslation([0, 0, 0])
  node.setRotation([0, 0, 0, 1])
  node.setScale([1, 1, 1])
  let top = node
  let parent = top.getParentNode()
  if (!parent) return
  while (parent) {
    top = parent
    parent = top.getParentNode()
  }
  for (const scene of document.getRoot().listScenes()) {
    if (scene.listChildren().includes(top)) {
      scene.addChild(node)
      return
    }
  }
}

/**
 * Last resort for the swarm level: meshoptimizer's sloppy simplifier.
 *
 * The ordinary simplifier preserves topology, so a model built from many small
 * closed shells has a floor it will not go under — the P-38 stops at 4,400
 * triangles however small the budget, and 1,800 of those is 8M triangles a frame
 * for aeroplanes 30 px tall. `simplifySloppy` ignores topology entirely and hits
 * the target. It smears UVs across what used to be separate shells, which is
 * exactly the trade to make on a 64 px texture at 30 px on screen, and exactly
 * the trade never to make anywhere else.
 */
function sloppySimplify(simplifier, targetTriangles) {
  return (document) => {
    for (const mesh of document.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        const position = primitive.getAttribute('POSITION')
        const indices = primitive.getIndices()
        if (!position || !indices) continue
        if (indices.getCount() / 3 <= targetTriangles * 1.5) continue
        const source = indices.getArray()
        const positions = position.getArray()
        const [next] = simplifier.simplifySloppy(
          source instanceof Uint32Array ? source : new Uint32Array(source),
          positions instanceof Float32Array ? positions : new Float32Array(positions),
          3,
          // No locked vertices: nothing here shares a border with anything else.
          null,
          Math.max(12, Math.floor(targetTriangles) * 3),
          1,
        )
        if (next.length >= source.length) continue
        indices.setArray(new Uint32Array(next))
      }
    }
  }
}

/** Why this model gets no LODs, or null if it should get them. */
async function skipReason(document, triangles, sourcePath) {
  if (triangles < MIN_SOURCE_TRIANGLES) return `only ${triangles} tris`
  const skinned = document.getRoot().listSkins().length > 0
  if (skinned || document.getRoot().listAnimations().length > 0) {
    const item = (await getCatalogByModelPath()).get(sourcePath)
    // The pose to bake comes from the catalog.
    if (!item) return 'animated, not in the catalog'
    // People ship in a T-pose and the viewer lowers the arms on the live
    // skeleton (`relaxTPoseArms`). A bake would keep the arms out, which reads
    // as a scarecrow next to the figure it is standing in for — and the three
    // person models are 4k triangles each, so there is nothing to win anyway.
    if (skinned && item.shape === 'person') return 'person (T-pose is relaxed at runtime)'
    if (skinned) {
      const deviation = skinRestDeviation(document)
      if (deviation > MAX_SKIN_REST_DEVIATION) {
        return `skinned, rest pose is not the bind pose (${(deviation * 100).toFixed(0)}%)`
      }
    }
  }
  return null
}

/**
 * Which levels this model gets. A skinned model is baked into its rest pose to
 * become static (see `bakeSkin`), which costs the animation, so it only gets
 * the levels small enough for that not to show.
 */
function levelsFor(document) {
  if (document.getRoot().listSkins().length === 0) return LEVELS
  return LEVELS.filter((level) => level.allowSkinned)
}

async function buildLevelDocument(sourcePath, level, sourceTriangles) {
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
    compactPrimitive,
  } = functions

  const document = await io.read(sourcePath)
  document.setLogger(quietLogger)
  // What the viewer actually draws for LOD0, measured before anything here
  // touches the file: for a skinned mesh that is the raw vertex data, since
  // glTF has the joints place it and ignores the node's own transform.
  const runtimeBox = documentBox(document, true)
  if (document.getRoot().listSkins().length > 0) {
    dropSkin(document)
  } else if (document.getRoot().listAnimations().length > 0) {
    const item = (await getCatalogByModelPath()).get(publicPath(sourcePath))
    bakeAnimationPose(document, Boolean(item?.model?.poseAtClipEnd))
  }
  // Before the crop, which measures node world matrices, and long before
  // flatten/join: the viewer never draws helper geometry, so neither should a
  // level whose parts it can no longer reach individually.
  cropHelpers(document)
  // The silhouette the level has to stay inside, measured on exactly the
  // geometry that survived the crop.
  const sourceBox = documentBox(document)

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

  if (level.collapseMaterials) {
    await bakeMaterialColorsToVertices(document, sharp)
    collapseMaterials(document)
  }

  const transforms = [dedup()]
  if (level.collapse) {
    // Fewer draw calls is the whole point of the far level: one primitive per
    // material instead of one per authored part.
    transforms.push(flatten(), joinPrimitives({ keepNamed: false }))
  }
  // Position welding only pays on a model whose vertices are split by seams.
  // On a smooth organic mesh the exact weld already reaches the triangle budget,
  // and merging across the seams there just pulls the surface about — it cost
  // the elephant 2 m of ear height for no triangles at all.
  const seamy = positionSplitRatio(document) >= POSITION_WELD_SPLIT_RATIO
  const welded = Boolean(level.weldPositions) && seamy
  transforms.push(welded ? weldPositions() : weld())
  transforms.push(simplify({ simplifier, ratio, error: level.error }))
  // Sloppy pass, then a compaction to throw away the vertices it orphaned.
  if (level.sloppy) {
    transforms.push(sloppySimplify(simplifier, level.triangleBudget))
    transforms.push((document) => {
      for (const mesh of document.getRoot().listMeshes()) {
        for (const primitive of mesh.listPrimitives()) compactPrimitive(primitive)
      }
    })
  }
  // Only recompute normals when something actually invalidated them: the
  // position weld leaves a seam vertex holding the wrong one, and the sloppy
  // pass rewrites the topology outright. Recomputing otherwise is destructive —
  // on a mesh whose triangle winding is not perfectly consistent (the elephant)
  // the fresh normals fight the winding and the surface reads as loose sheets.
  if (level.recomputeNormals && (welded || level.sloppy)) {
    transforms.push(normals({ overwrite: true }))
  }
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
  return { document, sourceBox, runtimeBox }
}

/**
 * World-space AABB of every primitive in the document, or null if it has none.
 *
 * `asDrawn` measures a still-skinned mesh the way a renderer does: from the raw
 * vertices, ignoring the node's transform, which glTF says the joints override.
 */
function documentBox(document, asDrawn = false) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  let found = false
  for (const scene of document.getRoot().listScenes()) {
    scene.traverse((node) => {
      const mesh = node.getMesh()
      if (!mesh) return
      const worldMatrix =
        asDrawn && node.getSkin() ? IDENTITY_MATRIX : node.getWorldMatrix()
      for (const primitive of mesh.listPrimitives()) {
        const box = primitiveBox(primitive, worldMatrix)
        if (!box) continue
        found = true
        for (let axis = 0; axis < 3; axis++) {
          min[axis] = Math.min(min[axis], box.min[axis])
          max[axis] = Math.max(max[axis], box.max[axis])
        }
      }
    })
  }
  return found ? { min, max } : null
}

const IDENTITY_MATRIX = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

/**
 * How far `box` reaches outside `source`, as a fraction of the source's size.
 *
 * Growth only: geometry outside the model's own box is either a part the
 * pipeline displaced or the whole model at the wrong scale or facing, and both
 * are bugs. Geometry *inside* it is a simplifier doing its job.
 *
 * Measured against the model's largest dimension, not each axis's own, so a
 * wheel dragged sideways off a flat wing is not read as a 900% error.
 */
function boxGrowth(source, box) {
  if (!source || !box) return 0
  const span = Math.max(...source.max.map((hi, axis) => hi - source.min[axis]))
  if (!(span > 0)) return 0
  let worst = 0
  for (let axis = 0; axis < 3; axis++) {
    worst = Math.max(
      worst,
      (source.min[axis] - box.min[axis]) / span,
      (box.max[axis] - source.max[axis]) / span,
    )
  }
  return worst
}

/**
 * Build a level, falling back through safer recipes until it stays inside the
 * source's silhouette.
 *
 * A level is meant to be the same shape with fewer triangles, and a part that
 * comes out beyond the source's box is geometry standing in open air — which
 * the viewer then scales by the factor it measured on LOD0, so on the C-47 a
 * wheel a third of a wingspan wide of the airframe arrived on screen as a
 * wheel the size of a building floating beside the aeroplane.
 *
 * Measured on the C-47, the culprit is `join`, not the simplifier: with the
 * merge on, the swarm level came out 25% wider than the source whatever the
 * error budget, and with it off, 0%. Tightening `error` is tried first because
 * it is cheap and keeps the draw-call win; the no-merge recipe is the fallback.
 * It has to be caught here — by the time a level ships, the displaced part is
 * welded into a joined primitive and cannot be reached on its own.
 */
async function buildLevel(sourcePath, outPath, level, sourceTriangles) {
  const { io } = await getDeps()
  const limits = LEVEL_GROWTH_LIMITS[level.suffix] ?? DEFAULT_GROWTH_LIMITS
  const attempts = [level, { ...level, error: level.error / 4 }]
  if (level.sloppy) attempts.push({ ...level, error: level.error / 16, sloppy: false })
  // Last resort. `join` is what displaces the geometry — it bakes node
  // transforms as it merges, and on some authoring hierarchies (the C-47's
  // landing gear) parts come out well wide of where they started. Dropping the
  // merge costs draw calls and leaves the simplifier topology-limited, so it is
  // worth it only when the alternative is a wheel floating beside the model.
  // The sloppy pass and the position weld both want the joined primitive, and
  // meshoptimizer walks off the end of the buffer without it, so this attempt
  // gives up all three together.
  if (level.collapse) {
    attempts.push({ ...level, collapse: false, sloppy: false, weldPositions: false })
  }

  let best = null
  for (const attempt of attempts) {
    let document
    let sourceBox
    let runtimeBox
    try {
      ;({ document, sourceBox, runtimeBox } = await buildLevelDocument(
        sourcePath,
        attempt,
        sourceTriangles,
      ))
    } catch (err) {
      // One recipe failing is not the model failing: try the next.
      console.warn(`      ${level.suffix}: ${err.message}`)
      continue
    }
    // Against what the viewer draws for LOD0, not against the mid-pipeline
    // document: a skinned model whose node transform leaked in would agree
    // with itself perfectly and still be twice the size on screen.
    const growth = Math.max(
      boxGrowth(sourceBox, documentBox(document)),
      boxGrowth(runtimeBox, documentBox(document)),
    )
    if (!best || growth < best.growth) best = { document, growth, attempt }
    if (growth <= limits.maxGrowth) break
  }
  if (!best) throw new Error(`${level.suffix}: every recipe failed`)
  if (best.growth > limits.maxDrift) {
    console.warn(
      `      ${level.suffix}: dropped, ${(best.growth * 100).toFixed(0)}% outside the model`,
    )
    return null
  }
  if (best.growth > limits.maxGrowth) {
    console.warn(
      `      ${level.suffix}: silhouette ${(best.growth * 100).toFixed(0)}% over source`,
    )
  } else if (best.attempt !== level) {
    console.log(`      ${level.suffix}: rebuilt to keep the silhouette`)
  }

  const triangles = countTriangles(best.document)
  writeFileSync(outPath, Buffer.from(await io.writeBinary(best.document)))
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
  /**
   * Version of the generator that built these levels; see PIPELINE_VERSION.
   * Absent on entries written before pipeline versioning, which counts as 0 —
   * older than anything current, so they rebuild.
   */
  pipeline?: number
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

/** Triangles in the model as authored — what one copy of LOD0 costs. */
export function lodSourceTrianglesFor(sourcePath: string): number {
  return MODEL_LODS[sourcePath.replace(/^\\//, '')]?.sourceTriangles ?? 0
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

    const currentPipeline = (prior?.pipeline ?? 0) === PIPELINE_VERSION
    if (!force && prior && prior.sourceHash === hash && currentPipeline && levelsOnDisk) {
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
      for (const level of levelsFor(document)) {
        const outPath = join(dirname(glb), `model.${level.suffix}.glb`)
        const result = await buildLevel(glb, outPath, level, sourceTriangles)
        // Came out as a different model; `buildLevel` has already said why.
        if (!result) {
          dropped.push(level.suffix)
          continue
        }
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
      // Levels this model is not entitled to may still be on disk from an
      // earlier run with different rules.
      const kept = new Set(levels.map((l) => l.path))
      for (const level of LEVELS) {
        const path = publicPath(join(dirname(glb), `model.${level.suffix}.glb`))
        if (kept.has(path) || dropped.includes(level.suffix)) continue
        const absolute = join(publicRoot, path)
        if (existsSync(absolute)) unlinkSync(absolute)
      }
      manifest[key] = { sourceHash: hash, pipeline: PIPELINE_VERSION, sourceTriangles, levels }
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
