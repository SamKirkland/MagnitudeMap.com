/**
 * Level-of-detail selection for whole models.
 *
 * Babylon's own LOD (`Mesh.addLODLevel`) is per-mesh: it compares the camera
 * against *that mesh's* bounding sphere. Our imports are hierarchies of dozens
 * of parts, so a wingtip and a fuselage would cross the threshold metres apart
 * and the model would spend the transition half-swapped. Instead each model is
 * one LOD group, measured once from the whole silhouette, and every part of it
 * switches on the same frame.
 *
 * The metric is apparent size in pixels rather than raw distance, so a 4 m car
 * and a 1.1 km star destroyer drop to their far level when they *look* small,
 * which is the only thing that matters for how much detail is worth drawing.
 *
 * The levels themselves come from `npm run generate-lods` — see
 * `scripts/generate-lods.mjs` and the generated `src/data/modelLods.ts`.
 */
import type { ModelLodLevel } from '../data/modelLods'

/**
 * Apparent height in pixels below which a level is good enough, by the `lodN`
 * token in its filename. Coarser levels get smaller numbers.
 *
 * 320 px is roughly a third of a tall viewport — past that the mid level's
 * halved triangle count and 512 px textures are indistinguishable. 96 px is
 * about where a model reads as a shape rather than an object, which is exactly
 * what the far level preserves.
 */
const SWITCH_BELOW_PIXELS: Record<string, number> = {
  lod1: 320,
  lod2: 96,
}

/**
 * Detail has to be worth this much more than the threshold before we swap back
 * up. Without the gap a model parked exactly on a boundary re-downloads and
 * re-swaps on every jittered frame.
 */
const HYSTERESIS = 1.2

export type LodLevelState = 'ready' | 'idle' | 'loading' | 'failed'

export type LodLevel = {
  /** Path under `public/`; null for LOD0, which is already in the scene. */
  path: string | null
  switchBelowPixels: number
  state: LodLevelState
}

/** LOD0 plus whatever the manifest has for this model, finest-first. */
export function buildLodLevels(manifestLevels: ModelLodLevel[]): LodLevel[] {
  const levels: LodLevel[] = [
    { path: null, switchBelowPixels: Number.POSITIVE_INFINITY, state: 'ready' },
  ]
  for (const level of manifestLevels) {
    const token = /\.(lod\d+)\.glb$/i.exec(level.path)?.[1]?.toLowerCase()
    const switchBelowPixels = token ? SWITCH_BELOW_PIXELS[token] : undefined
    if (switchBelowPixels === undefined) continue
    levels.push({ path: level.path, switchBelowPixels, state: 'idle' })
  }
  // Coarsest last, and never let a coarser level claim a larger threshold.
  levels.sort((a, b) => b.switchBelowPixels - a.switchBelowPixels)
  return levels
}

/**
 * Height in pixels that a sphere of `radius` at `distance` covers.
 *
 * `fovOrOrthoHeight` is the vertical field of view in radians for a perspective
 * camera, or the world-space height of the ortho box (poster preview), which is
 * distance-independent.
 */
export function apparentPixelHeight(
  radius: number,
  distance: number,
  viewportHeightPx: number,
  fovRadians: number | null,
  orthoHeight: number | null,
): number {
  if (radius <= 0 || viewportHeightPx <= 0) return 0
  if (orthoHeight !== null) {
    if (orthoHeight <= 1e-6) return Number.POSITIVE_INFINITY
    return ((2 * radius) / orthoHeight) * viewportHeightPx
  }
  if (fovRadians === null) return Number.POSITIVE_INFINITY
  // Inside the bounding sphere there is no meaningful projected size, and the
  // answer we want there is "as much detail as possible" anyway.
  if (distance <= radius) return Number.POSITIVE_INFINITY
  const frustumHeight = 2 * distance * Math.tan(fovRadians / 2)
  if (frustumHeight <= 1e-6) return Number.POSITIVE_INFINITY
  return ((2 * radius) / frustumHeight) * viewportHeightPx
}

/** The level this model wants at `pixels`, ignoring what has been downloaded. */
export function wantedLevel(levels: LodLevel[], pixels: number, active: number): number {
  let wanted = 0
  for (let i = levels.length - 1; i > 0; i--) {
    if (pixels < levels[i].switchBelowPixels) {
      wanted = i
      break
    }
  }
  // Dropping detail happens at the threshold; regaining it needs clear daylight,
  // so a model hovering on the line does not oscillate.
  if (wanted < active && pixels < levels[active].switchBelowPixels * HYSTERESIS) {
    return active
  }
  return wanted
}

/**
 * The level to actually show: `wanted` if it is downloaded, otherwise the
 * closest one that is, preferring more detail (always correct, just costlier)
 * over less.
 */
export function resolveLevel(levels: LodLevel[], wanted: number): number {
  if (levels[wanted]?.state === 'ready') return wanted
  for (let i = wanted - 1; i >= 0; i--) {
    if (levels[i].state === 'ready') return i
  }
  for (let i = wanted + 1; i < levels.length; i++) {
    if (levels[i].state === 'ready') return i
  }
  return 0
}
