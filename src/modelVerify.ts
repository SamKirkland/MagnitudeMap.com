import type { CatalogItem, ScaleAxis } from './data/catalog'
import { axisSizeAfterAuthoringYaw } from './modelOrientation'

/**
 * Headless + runtime checks that the GLB, after the catalog authoring pose
 * and the same crop/scale the viewer uses, matches real-world meters.
 *
 * `normalizeToMeters` forces one axis to the catalog. The other two axes,
 * leftover helper meshes, and a 90° authoring miss are what actually show
 * up as “the F-22 is the size of a person”.
 */

export const PERSON_MALE_HEIGHT_M = 1.75

/** Keep in lockstep with `ComparisonScene.cropImportedModel`. */
export const MODEL_CROP = {
  distantTypicalMult: 12,
  distantPadM: 4,
  distantMinTypicalM: 0.25,
  needleSpanM: 50,
  needleRatio: 25,
  paperSpanM: 1,
  paperMinDim: 1e-4,
  paperRatio: 1e-5,
  helperName: /gbu_helper|\bhelper\b|collision|gizmo|^dummy|^empty/i,
} as const

export type Vec3 = { x: number; y: number; z: number }

export type MeshBox = {
  name: string
  parentName: string
  min: Vec3
  max: Vec3
  vertices: number
}

export type VerifyIssue = {
  severity: 'fail' | 'warn'
  code: string
  message: string
}

export type MeasuredMeters = {
  /** +X after authoring pose (width / wings). */
  width: number
  /** +Y after authoring pose. */
  height: number
  /** +Z after authoring pose (length / nose). */
  length: number
}

export type ModelVerifyStatus = 'pass' | 'warn' | 'fail' | 'skip'

export type ModelVerifyResult = {
  id: string
  name: string
  status: ModelVerifyStatus
  skipReason?: string
  scaleAxis: ScaleAxis
  yawDegrees: number
  pitchDegrees: number
  rollDegrees: number
  catalog: MeasuredMeters
  /** Simulated viewer scale from the GLB AABB (gltf-transform). */
  glb?: MeasuredMeters & {
    raw: MeasuredMeters
    cropped: MeasuredMeters
    scale: number
    triangles: number
    meshCount: number
    croppedMeshCount: number
    occupancy: number
  }
  /** Actual ComparisonScene AABB when `--shots` ran. */
  runtime?: MeasuredMeters
  issues: VerifyIssue[]
  suggestedYawDegrees?: number
  shots?: {
    elevation?: string
    perspective?: string
  }
}

export type AxisTolerance = { warn: number; fail: number }

export function vec(x: number, y: number, z: number): Vec3 {
  return { x, y, z }
}

export function boxSize(min: Vec3, max: Vec3): Vec3 {
  return vec(max.x - min.x, max.y - min.y, max.z - min.z)
}

export function boxCenter(min: Vec3, max: Vec3): Vec3 {
  return vec((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2)
}

export function mergeBoxes(boxes: MeshBox[]): { min: Vec3; max: Vec3 } | null {
  if (boxes.length === 0) return null
  const min = vec(Infinity, Infinity, Infinity)
  const max = vec(-Infinity, -Infinity, -Infinity)
  for (const box of boxes) {
    min.x = Math.min(min.x, box.min.x)
    min.y = Math.min(min.y, box.min.y)
    min.z = Math.min(min.z, box.min.z)
    max.x = Math.max(max.x, box.max.x)
    max.y = Math.max(max.y, box.max.y)
    max.z = Math.max(max.z, box.max.z)
  }
  if (!Number.isFinite(min.x) || min.x > max.x) return null
  return { min, max }
}

export function sizeToMeasured(size: Vec3): MeasuredMeters {
  return { width: size.x, height: size.y, length: size.z }
}

export function catalogMeasured(item: Pick<CatalogItem, 'width' | 'height' | 'length'>): MeasuredMeters {
  return { width: item.width, height: item.height, length: item.length }
}

export function targetSize(item: Pick<CatalogItem, 'width' | 'height' | 'length'>, axis: ScaleAxis): number {
  switch (axis) {
    case 'length':
    case 'footprint':
      return item.length
    case 'width':
      return item.width
    case 'height':
      return item.height
    case 'max':
      return Math.max(item.length, item.width, item.height)
  }
}

export function isNeedleSize(size: Vec3): boolean {
  const dims = [size.x, size.y, size.z].sort((a, b) => a - b)
  const span = dims[2]
  return span > MODEL_CROP.needleSpanM && span > MODEL_CROP.needleRatio * Math.max(dims[1], 1e-8)
}

export function isPaperSize(size: Vec3): boolean {
  const dims = [size.x, size.y, size.z].sort((a, b) => a - b)
  const span = dims[2]
  return span > MODEL_CROP.paperSpanM && dims[0] < Math.max(span * MODEL_CROP.paperRatio, MODEL_CROP.paperMinDim)
}

export function isHelperLabel(name: string, parentName: string): boolean {
  return MODEL_CROP.helperName.test(`${name} ${parentName}`)
}

export function distantHelperCutoff(sortedDistances: number[]): number {
  const typical = Math.max(
    sortedDistances[Math.floor(sortedDistances.length / 2)] ?? 1,
    MODEL_CROP.distantMinTypicalM,
  )
  return typical * MODEL_CROP.distantTypicalMult + MODEL_CROP.distantPadM
}

export function isThinGroundPlate(size: Vec3, combined: Vec3): boolean {
  const horiz = Math.max(size.x, size.z)
  const combinedHoriz = Math.max(combined.x, combined.z)
  if (horiz < 0.5 || combinedHoriz < 0.5) return false
  return size.y < 0.03 * horiz && horiz > 0.7 * combinedHoriz
}

/** Babylon `Quaternion.FromEulerAngles(pitch, yaw, roll)`. */
export function quatFromPitchYawRoll(pitch: number, yaw: number, roll: number): {
  x: number
  y: number
  z: number
  w: number
} {
  const halfRoll = roll * 0.5
  const halfPitch = pitch * 0.5
  const halfYaw = yaw * 0.5
  const sinRoll = Math.sin(halfRoll)
  const cosRoll = Math.cos(halfRoll)
  const sinPitch = Math.sin(halfPitch)
  const cosPitch = Math.cos(halfPitch)
  const sinYaw = Math.sin(halfYaw)
  const cosYaw = Math.cos(halfYaw)
  return {
    x: cosYaw * sinPitch * cosRoll + sinYaw * cosPitch * sinRoll,
    y: sinYaw * cosPitch * cosRoll - cosYaw * sinPitch * sinRoll,
    z: cosYaw * cosPitch * sinRoll - sinYaw * sinPitch * cosRoll,
    w: cosYaw * cosPitch * cosRoll + sinYaw * sinPitch * sinRoll,
  }
}

function rotateVec(v: Vec3, q: { x: number; y: number; z: number; w: number }): Vec3 {
  const tx = 2 * (q.y * v.z - q.z * v.y)
  const ty = 2 * (q.z * v.x - q.x * v.z)
  const tz = 2 * (q.x * v.y - q.y * v.x)
  return vec(
    v.x + q.w * tx + (q.y * tz - q.z * ty),
    v.y + q.w * ty + (q.z * tx - q.x * tz),
    v.z + q.w * tz + (q.x * ty - q.y * tx),
  )
}

export function rotateBox(
  min: Vec3,
  max: Vec3,
  q: { x: number; y: number; z: number; w: number },
): { min: Vec3; max: Vec3 } {
  const corners: Vec3[] = [
    vec(min.x, min.y, min.z),
    vec(max.x, min.y, min.z),
    vec(min.x, max.y, min.z),
    vec(max.x, max.y, min.z),
    vec(min.x, min.y, max.z),
    vec(max.x, min.y, max.z),
    vec(min.x, max.y, max.z),
    vec(max.x, max.y, max.z),
  ]
  const outMin = vec(Infinity, Infinity, Infinity)
  const outMax = vec(-Infinity, -Infinity, -Infinity)
  for (const corner of corners) {
    const p = rotateVec(corner, q)
    outMin.x = Math.min(outMin.x, p.x)
    outMin.y = Math.min(outMin.y, p.y)
    outMin.z = Math.min(outMin.z, p.z)
    outMax.x = Math.max(outMax.x, p.x)
    outMax.y = Math.max(outMax.y, p.y)
    outMax.z = Math.max(outMax.z, p.z)
  }
  return { min: outMin, max: outMax }
}

export function applyAuthoringPose(meshes: MeshBox[], item: CatalogItem): MeshBox[] {
  const model = item.model
  if (!model || model.randomYaw) return meshes
  const pitch = ((model.pitchDegrees ?? 0) * Math.PI) / 180
  const yaw = ((model.yawDegrees ?? 0) * Math.PI) / 180
  const roll = ((model.rollDegrees ?? 0) * Math.PI) / 180
  if (!pitch && !yaw && !roll) return meshes
  const q = quatFromPitchYawRoll(pitch, yaw, roll)
  return meshes.map((mesh) => {
    const rotated = rotateBox(mesh.min, mesh.max, q)
    return { ...mesh, min: rotated.min, max: rotated.max }
  })
}

export type CropOptions = {
  skipAll?: boolean
  skipNeedlePaperHelpers?: boolean
}

export function cropMeshBoxes(meshes: MeshBox[], opts: CropOptions = {}): MeshBox[] {
  if (opts.skipAll || meshes.length === 0) return meshes

  let kept = meshes
  if (meshes.length >= 2) {
    let cx = 0
    let cy = 0
    let cz = 0
    let weight = 0
    for (const mesh of meshes) {
      const center = boxCenter(mesh.min, mesh.max)
      const verts = Math.max(mesh.vertices, 1)
      cx += center.x * verts
      cy += center.y * verts
      cz += center.z * verts
      weight += verts
    }
    if (weight >= 1) {
      cx /= weight
      cy /= weight
      cz /= weight
      const distances = meshes
        .map((mesh) => {
          const center = boxCenter(mesh.min, mesh.max)
          return Math.hypot(center.x - cx, center.y - cy, center.z - cz)
        })
        .sort((a, b) => a - b)
      const cutoff = distantHelperCutoff(distances)
      kept = meshes.filter((mesh) => {
        const center = boxCenter(mesh.min, mesh.max)
        const dist = Math.hypot(center.x - cx, center.y - cy, center.z - cz)
        return dist <= cutoff
      })
    }
  }

  if (opts.skipNeedlePaperHelpers) return kept

  return kept.filter((mesh) => {
    const size = boxSize(mesh.min, mesh.max)
    if (isNeedleSize(size) || isPaperSize(size) || isHelperLabel(mesh.name, mesh.parentName)) {
      return false
    }
    return true
  })
}

export function axisToleranceFor(item: Pick<CatalogItem, 'shape' | 'category' | 'playClips'>): AxisTolerance {
  if (item.shape === 'person' || item.category === 'animal') return { warn: 0.28, fail: 0.55 }
  if (item.playClips) return { warn: 0.25, fail: 0.5 }
  if (item.category === 'fiction') return { warn: 0.22, fail: 0.45 }
  if (item.category === 'landmark') return { warn: 0.18, fail: 0.4 }
  return { warn: 0.14, fail: 0.35 }
}

function relError(measured: number, expected: number): number {
  if (!Number.isFinite(measured) || !Number.isFinite(expected)) return Infinity
  const denom = Math.max(Math.abs(expected), 1e-6)
  return Math.abs(measured - expected) / denom
}

function pct(error: number): string {
  if (!Number.isFinite(error)) return '∞'
  return `${Math.round(error * 100)}%`
}

function meters(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) >= 100) return `${Math.round(value)} m`
  if (Math.abs(value) >= 10) return `${value.toFixed(1)} m`
  if (Math.abs(value) >= 1) return `${value.toFixed(2)} m`
  return `${value.toFixed(3)} m`
}

function occupancyOf(meshes: MeshBox[], combined: Vec3): number {
  const combinedVol = Math.max(combined.x * combined.y * combined.z, 1e-12)
  let meshVol = 0
  for (const mesh of meshes) {
    const size = boxSize(mesh.min, mesh.max)
    meshVol += Math.max(size.x * size.y * size.z, 0)
  }
  return Math.min(1, meshVol / combinedVol)
}

function extraYawSize(size: Vec3, extraTurns: number): Vec3 {
  return extraTurns % 2 === 1 ? vec(size.z, size.y, size.x) : size
}

function aspectError(size: Vec3, item: CatalogItem, axis: ScaleAxis): number {
  const current = axisSizeAfterAuthoringYaw(size, axis)
  const target = targetSize(item, axis)
  if (!(current > 1e-8) || !(target > 1e-8)) return Infinity
  const scale = target / current
  const measured = sizeToMeasured(vec(size.x * scale, size.y * scale, size.z * scale))
  const catalog = catalogMeasured(item)
  return (
    relError(measured.width, catalog.width) +
    relError(measured.height, catalog.height) +
    relError(measured.length, catalog.length)
  )
}

export function suggestAuthoringYaw(size: Vec3, item: CatalogItem, axis: ScaleAxis): number | undefined {
  const currentYaw = item.model?.randomYaw ? 0 : (item.model?.yawDegrees ?? 0)
  const currentErr = aspectError(size, item, axis)
  let bestYaw = currentYaw
  let bestErr = currentErr
  for (const extra of [0, 1, 2, 3]) {
    const err = aspectError(extraYawSize(size, extra), item, axis)
    if (err + 1e-6 < bestErr) {
      bestErr = err
      bestYaw = (((currentYaw + extra * 90) % 360) + 360) % 360
    }
  }
  if (bestYaw === currentYaw) return undefined
  if (!(currentErr > 0.25 && bestErr < currentErr * 0.55)) return undefined
  return bestYaw
}

export function evaluateRenderedSize(
  item: CatalogItem,
  measured: MeasuredMeters,
  source: 'glb' | 'runtime',
): VerifyIssue[] {
  const issues: VerifyIssue[] = []
  const axis = item.model?.scaleAxis ?? 'length'
  const catalog = catalogMeasured(item)
  const tolerance = axisToleranceFor(item)
  const label = source === 'runtime' ? 'Rendered' : 'GLB after scale'
  const axes: { key: keyof MeasuredMeters; expected: number }[] = [
    { key: 'length', expected: catalog.length },
    { key: 'width', expected: catalog.width },
    { key: 'height', expected: catalog.height },
  ]

  for (const { key, expected } of axes) {
    const got = measured[key]
    const error = relError(got, expected)
    const trusted = (axis === 'footprint' && (key === 'length' || key === 'width')) || axis === key || (axis === 'max' && got === Math.max(measured.length, measured.width, measured.height))
    if (trusted && axis !== 'footprint' && axis !== 'max' && error > 0.03) {
      issues.push({
        severity: 'fail',
        code: 'trusted-axis',
        message: `${label} ${key} is ${meters(got)} but scaleAxis=${axis} should be ${meters(expected)} (${pct(error)}).`,
      })
      continue
    }
    if (trusted) continue
    // Rigged people are authored in a wide bind pose; catalog L/W is the standing silhouette.
    if (source === 'glb' && item.shape === 'person') continue
    if (error > tolerance.fail) {
      issues.push({
        severity: 'fail',
        code: `axis-${key}`,
        message: `${label} ${key} is ${meters(got)} vs catalog ${meters(expected)} (${pct(error)}). Wrong yaw/pitch, extra plates, or a bad catalog number.`,
      })
    } else if (error > tolerance.warn) {
      issues.push({
        severity: 'warn',
        code: `axis-${key}`,
        message: `${label} ${key} is ${meters(got)} vs catalog ${meters(expected)} (${pct(error)}).`,
      })
    }
  }

  const swapped =
    item.shape !== 'person' &&
    relError(measured.length, catalog.width) < 0.12 &&
    relError(measured.width, catalog.length) < 0.12 &&
    relError(measured.length, catalog.length) > 0.25 &&
    relError(measured.width, catalog.width) > 0.25
  if (swapped) {
    issues.push({
      severity: 'fail',
      code: 'yaw-swapped',
      message: `${label} length/width look swapped vs catalog. Authoring yaw is probably 90° off (need +Z = length, +X = width).`,
    })
  }

  const tipped =
    item.shape !== 'person' &&
    relError(measured.height, catalog.length) < 0.12 &&
    relError(measured.length, catalog.height) < 0.12 &&
    catalog.length > catalog.height * 1.25
  if (tipped) {
    issues.push({
      severity: 'fail',
      code: 'pitch-tipped',
      message: `${label} height matches catalog length. The GLB is probably standing on its tail — set pitchDegrees.`,
    })
  }

  return issues
}

export function evaluateGlbMeshes(item: CatalogItem, posedMeshes: MeshBox[], triangles: number): {
  issues: VerifyIssue[]
  cropped: MeshBox[]
  rawSize: Vec3
  croppedSize: Vec3
  measured: MeasuredMeters
  scale: number
  occupancy: number
  suggestedYawDegrees?: number
} {
  const issues: VerifyIssue[] = []
  const raw = mergeBoxes(posedMeshes)
  if (!raw) {
    issues.push({ severity: 'fail', code: 'empty', message: 'GLB has no mesh geometry.' })
    const zero = vec(0, 0, 0)
    return {
      issues,
      cropped: [],
      rawSize: zero,
      croppedSize: zero,
      measured: sizeToMeasured(zero),
      scale: 0,
      occupancy: 0,
    }
  }
  const rawSize = boxSize(raw.min, raw.max)
  const skipAll = item.shape === 'person' || Boolean(item.model?.path.includes('nuclear-fireball'))
  const cropped = cropMeshBoxes(posedMeshes, {
    skipAll,
    skipNeedlePaperHelpers: Boolean(item.playClips),
  })
  const croppedMerge = mergeBoxes(cropped) ?? raw
  const croppedSize = boxSize(croppedMerge.min, croppedMerge.max)
  const occupancy = occupancyOf(cropped, croppedSize)
  const dropped = posedMeshes.length - cropped.length

  if (dropped > 0) {
    const droppedSpan = Math.max(rawSize.x, rawSize.y, rawSize.z)
    const keptSpan = Math.max(croppedSize.x, croppedSize.y, croppedSize.z)
    if (droppedSpan > keptSpan * 2.5 + 4) {
      issues.push({
        severity: 'fail',
        code: 'empty-aabb',
        message: `Crop hid ${dropped} helper mesh(es); raw AABB ${meters(droppedSpan)} vs hull ${meters(keptSpan)}. Clean lights/cameras/teleport helpers out of the GLB.`,
      })
    } else if (droppedSpan > keptSpan * 1.35 + 1) {
      issues.push({
        severity: 'warn',
        code: 'crop-helpers',
        message: `Runtime crop hid ${dropped} mesh(es) (raw ${meters(droppedSpan)} → ${meters(keptSpan)}). Prefer a clean asset.`,
      })
    }
  }

  if (cropped.length > 1) {
    for (const mesh of cropped) {
      const size = boxSize(mesh.min, mesh.max)
      if (isThinGroundPlate(size, croppedSize)) {
        issues.push({
          severity: 'fail',
          code: 'ground-plate',
          message: `Mesh "${mesh.name}" looks like a studio floor / shadow slab (${meters(size.x)} × ${meters(size.z)} × ${meters(size.y)} high). It inflates the AABB and breaks scale.`,
        })
      }
    }
  }

  if (occupancy < 0.08 && cropped.length > 2) {
    issues.push({
      severity: 'fail',
      code: 'sparse-aabb',
      message: `Meshes fill only ${Math.round(occupancy * 100)}% of the AABB. Hangar, terrain, or far helpers are still in the box.`,
    })
  } else if (occupancy < 0.18 && cropped.length > 2) {
    issues.push({
      severity: 'warn',
      code: 'sparse-aabb',
      message: `Meshes fill ${Math.round(occupancy * 100)}% of the AABB — check for leftover scenery.`,
    })
  }

  if (cropped.length >= 2) {
    const byMinY = [...cropped].sort((a, b) => a.min.y - b.min.y)
    const lowest = byMinY[0]
    const rest = byMinY.slice(1)
    const restMinY = Math.min(...rest.map((mesh) => mesh.min.y))
    const hullHeight = Math.max(croppedSize.y, 1e-6)
    const hang = restMinY - lowest.min.y
    const lowestVerts = Math.max(lowest.vertices, 1)
    const totalVerts = cropped.reduce((sum, mesh) => sum + Math.max(mesh.vertices, 1), 0)
    if (hang > 0.08 * hullHeight && hang > 0.15 && lowestVerts < 0.03 * totalVerts) {
      issues.push({
        severity: 'warn',
        code: 'hanging-below',
        message: `Mesh "${lowest.name}" hangs ${meters(hang)} below the rest (${Math.round((lowestVerts / totalVerts) * 100)}% of verts). Contact may be a helper, not wheels/feet.`,
      })
    }
  }

  if (triangles > 250_000) {
    issues.push({
      severity: 'warn',
      code: 'heavy-mesh',
      message: `${triangles.toLocaleString('en-US')} triangles (prefer ≲200k for catalog models).`,
    })
  }

  const axis = item.model?.scaleAxis ?? 'length'
  const current = axisSizeAfterAuthoringYaw(croppedSize, axis)
  const target = targetSize(item, axis)
  const scale = current > 1e-8 ? target / current : 0
  const measured = sizeToMeasured(
    vec(croppedSize.x * scale, croppedSize.y * scale, croppedSize.z * scale),
  )

  if (!(current > 1e-8)) {
    issues.push({
      severity: 'fail',
      code: 'zero-axis',
      message: `AABB ${axis} is ~0 after crop; cannot scale to ${meters(target)}.`,
    })
  } else {
    issues.push(...evaluateRenderedSize(item, measured, 'glb'))
  }

  const suggestedYawDegrees = item.model?.randomYaw
    ? undefined
    : suggestAuthoringYaw(croppedSize, item, axis)
  if (suggestedYawDegrees != null) {
    issues.push({
      severity: 'warn',
      code: 'suggest-yaw',
      message: `Authoring yaw ${item.model?.yawDegrees ?? 0}° may be wrong; ${suggestedYawDegrees}° fits catalog length/width better.`,
    })
  }

  return {
    issues,
    cropped,
    rawSize,
    croppedSize,
    measured,
    scale,
    occupancy,
    suggestedYawDegrees,
  }
}

export function skipReasonFor(item: CatalogItem): string | undefined {
  if (item.instanceGrid) return 'Packed instance grid (money pile); footprint is computed, not the unit GLB AABB.'
  if (!item.model) return 'Procedural stand-in (exact catalog size).'
  return undefined
}

export function resultStatus(issues: VerifyIssue[], skip?: string): ModelVerifyStatus {
  if (skip) return 'skip'
  if (issues.some((issue) => issue.severity === 'fail')) return 'fail'
  if (issues.some((issue) => issue.severity === 'warn')) return 'warn'
  return 'pass'
}

export function formatIssueLine(issue: VerifyIssue): string {
  return `${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`
}

export function formatResultLine(result: ModelVerifyResult): string {
  const tag = result.status.toUpperCase().padEnd(4)
  if (result.skipReason) return `${result.id.padEnd(22)} ${tag}  ${result.skipReason}`
  const measured = result.runtime ?? result.glb
  if (!measured) return `${result.id.padEnd(22)} ${tag}`
  const catalog = result.catalog
  const src = result.runtime ? 'rt' : 'glb'
  return [
    result.id.padEnd(22),
    tag,
    src,
    `L ${meters(measured.length)}/${meters(catalog.length)}`,
    `W ${meters(measured.width)}/${meters(catalog.width)}`,
    `H ${meters(measured.height)}/${meters(catalog.height)}`,
    `yaw ${result.yawDegrees}°`,
  ].join('  ')
}

export type VerifyCaptureItem = {
  id: string
  catalog: MeasuredMeters
  runtime: MeasuredMeters
  personHeight: number
  issues: VerifyIssue[]
  status: ModelVerifyStatus
}

export function evaluateRuntimeCapture(item: CatalogItem, runtime: MeasuredMeters): VerifyIssue[] {
  return evaluateRenderedSize(item, runtime, 'runtime')
}

export function verifyItemFromGlb(
  item: CatalogItem,
  posedMeshes: MeshBox[],
  triangles: number,
): ModelVerifyResult {
  const skip = skipReasonFor(item)
  const model = item.model
  if (skip || !model) {
    return {
      id: item.id,
      name: item.name,
      status: 'skip',
      skipReason: skip,
      scaleAxis: model?.scaleAxis ?? 'length',
      yawDegrees: model?.yawDegrees ?? 0,
      pitchDegrees: model?.pitchDegrees ?? 0,
      rollDegrees: model?.rollDegrees ?? 0,
      catalog: catalogMeasured(item),
      issues: [],
    }
  }

  const glbEval = evaluateGlbMeshes(item, posedMeshes, triangles)
  return {
    id: item.id,
    name: item.name,
    status: resultStatus(glbEval.issues),
    scaleAxis: model.scaleAxis,
    yawDegrees: model.yawDegrees ?? 0,
    pitchDegrees: model.pitchDegrees ?? 0,
    rollDegrees: model.rollDegrees ?? 0,
    catalog: catalogMeasured(item),
    glb: {
      ...glbEval.measured,
      raw: sizeToMeasured(glbEval.rawSize),
      cropped: sizeToMeasured(glbEval.croppedSize),
      scale: glbEval.scale,
      triangles,
      meshCount: posedMeshes.length,
      croppedMeshCount: glbEval.cropped.length,
      occupancy: glbEval.occupancy,
    },
    issues: glbEval.issues,
    suggestedYawDegrees: glbEval.suggestedYawDegrees,
  }
}
