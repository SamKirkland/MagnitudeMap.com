import type { CatalogItem } from '../data/catalog'
import { itemExtentAlongX, itemExtentAlongZ } from '../modelOrientation'
import { spreadAmount } from '../tourSettings'

/** Primary visual magnitude used for size ordering / tour steps. */
export function itemMagnitude(item: CatalogItem): number {
  return Math.max(item.length, item.width, item.height)
}

export function sortBySizeAscending(items: CatalogItem[]): CatalogItem[] {
  return [...items].sort((a, b) => {
    const diff = itemMagnitude(a) - itemMagnitude(b)
    if (diff !== 0) return diff
    return a.name.localeCompare(b.name)
  })
}

export type CameraPose = {
  target: { x: number; y: number; z: number }
  radius: number
  alpha: number
  beta: number
}

export type WorldBounds = {
  min: { x: number; y: number; z: number }
  max: { x: number; y: number; z: number }
}

export type LayoutViewParams = {
  /** Vertical FOV in radians (Babylon ArcRotateCamera default ~0.8). */
  fov: number
  /** Canvas width / height. */
  aspect: number
}

const DEFAULT_VIEW: LayoutViewParams = { fov: 0.8, aspect: 16 / 9 }

export const DEFAULT_TOUR_ALPHA = -Math.PI / 2.35
export const DEFAULT_TOUR_BETA = 1.12

export type CameraAngles = { alpha: number; beta: number }

const DEFAULT_TOUR_ANGLES: CameraAngles = {
  alpha: DEFAULT_TOUR_ALPHA,
  beta: DEFAULT_TOUR_BETA,
}

/**
 * Map a -1..1 yaw slider to ArcRotateCamera alpha.
 * 0 keeps the default 3/4 view; negative looks from the left of the lineup.
 */
export function tourYawToAlpha(yaw: number): number {
  const t = Math.max(-1, Math.min(1, yaw))
  const left = -Math.PI + 0.42
  const right = -0.42
  if (t <= 0) return left + (DEFAULT_TOUR_ALPHA - left) * (t + 1)
  return DEFAULT_TOUR_ALPHA + (right - DEFAULT_TOUR_ALPHA) * t
}

export function tourAnglesFromYaw(yaw: number): CameraAngles {
  return { alpha: tourYawToAlpha(yaw), beta: DEFAULT_TOUR_BETA }
}

/**
 * Frame a single world-space AABB so it fits entirely in view (with margin).
 * Uses bounding-sphere fit against vertical + horizontal FOV.
 */
export function poseForWorldBounds(
  bounds: WorldBounds,
  view: LayoutViewParams = DEFAULT_VIEW,
  angles: { alpha: number; beta: number } = {
    alpha: -Math.PI / 2.35,
    beta: 1.05,
  },
): CameraPose {
  const cx = (bounds.min.x + bounds.max.x) * 0.5
  const cy = (bounds.min.y + bounds.max.y) * 0.5
  const cz = (bounds.min.z + bounds.max.z) * 0.5
  const hx = Math.max((bounds.max.x - bounds.min.x) * 0.5, 0.05)
  const hy = Math.max((bounds.max.y - bounds.min.y) * 0.5, 0.05)
  const hz = Math.max((bounds.max.z - bounds.min.z) * 0.5, 0.05)
  const sphereR = Math.hypot(hx, hy, hz)

  const margin = 1.22
  const halfV = Math.max(view.fov * 0.5, 0.05)
  const halfH = Math.atan(Math.tan(halfV) * Math.max(view.aspect, 0.2))
  const radiusV = sphereR / Math.tan(halfV)
  const radiusH = sphereR / Math.tan(halfH)
  const radius = Math.max(radiusV, radiusH, 1.25) * margin

  return {
    target: { x: cx, y: cy, z: cz },
    radius,
    alpha: angles.alpha,
    beta: angles.beta,
  }
}

/** Frame the objects in a tour step (pair or all-so-far). */
export function poseForTourStep(
  items: CatalogItem[],
  xs: number[],
  angles: CameraAngles = DEFAULT_TOUR_ANGLES,
  yawTurns = 0,
): CameraPose {
  return poseForItems(items, xs, angles, yawTurns)
}

export function poseForItems(
  items: CatalogItem[],
  xs: number[],
  angles: CameraAngles = DEFAULT_TOUR_ANGLES,
  yawTurns = 0,
): CameraPose {
  if (items.length === 0) {
    return { target: { x: 0, y: 2, z: 0 }, radius: 40, alpha: angles.alpha, beta: angles.beta }
  }

  let minX = Infinity
  let maxX = -Infinity
  let maxH = 0

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const x = xs[i]
    const half = itemExtentAlongX(item, yawTurns) / 2
    minX = Math.min(minX, x - half)
    maxX = Math.max(maxX, x + half)
    maxH = Math.max(maxH, item.height, itemExtentAlongZ(item, yawTurns))
  }

  const spanX = Math.max(maxX - minX, 0.5)
  const centerX = (minX + maxX) / 2
  const radius = Math.max(spanX * 1.35, maxH * 2.2, 2.5)

  return {
    target: { x: centerX, y: maxH * 0.4, z: 0 },
    radius,
    alpha: angles.alpha,
    beta: angles.beta,
  }
}

/** Half-width of the view at the camera target plane, along world X. */
export function visibleHalfWidthAtTarget(
  radius: number,
  view: LayoutViewParams = DEFAULT_VIEW,
): number {
  return radius * Math.tan(view.fov / 2) * view.aspect
}

export type RevealLayoutParams = {
  /** Slider value: 0.5 = Tight, 2.5 = Wide. */
  spread?: number
  /** User display yaw in 90° turns (0–3). Swaps length/width along the lineup. */
  yawTurns?: number
}

/** AABB gap at Tight, as a fraction of the pair's larger facing extent. */
const TIGHT_GAP_FRACTION = 0.05
/** Wide floor: padding at least this fraction of the larger facing extent. */
const WIDE_GAP_MIN_FRACTION = 1.5
/** Extra frustum padding so a neighbor isn't a sliver on the frame edge. */
const ISOLATION_EDGE_FRACTION = 0.08

/**
 * Gap past an item's facing AABB so a head-on 16:9 frame of that item
 * does not include a neighbor's near face.
 */
function headOnIsolationGap(item: CatalogItem, yawTurns: number): number {
  const facing = itemExtentAlongX(item, yawTurns)
  const hx = Math.max(facing * 0.5, 0.05)
  const hy = Math.max(item.height * 0.5, 0.05)
  const halfV = Math.max(DEFAULT_VIEW.fov * 0.5, 0.05)
  const halfH = Math.atan(Math.tan(halfV) * Math.max(DEFAULT_VIEW.aspect, 0.2))
  const radius =
    Math.max(hy / Math.tan(halfV), hx / Math.tan(halfH), 1.25) * 1.22
  const visibleHalf = visibleHalfWidthAtTarget(radius, DEFAULT_VIEW)
  return Math.max(0, visibleHalf - hx) + visibleHalf * ISOLATION_EDGE_FRACTION
}

/** Empty space between two AABBs along the lineup, in meters. */
export function pairSpacingGap(
  prev: CatalogItem,
  next: CatalogItem,
  spread: number,
  yawTurns: number,
): number {
  const facingPrev = itemExtentAlongX(prev, yawTurns)
  const facingNext = itemExtentAlongX(next, yawTurns)
  const largerFacing = Math.max(facingPrev, facingNext)
  const tight = largerFacing * TIGHT_GAP_FRACTION
  const wide = Math.max(
    headOnIsolationGap(prev, yawTurns),
    headOnIsolationGap(next, yawTurns),
    largerFacing * WIDE_GAP_MIN_FRACTION,
  )
  const t = spreadAmount(spread)
  return tight + (wide - tight) * t
}

/**
 * Pack items along +X with per-pair gaps from facing size (width at yaw 0,
 * length at 90°/270°) and the Tight–Wide slider.
 */
export function layoutRevealPositions(
  items: CatalogItem[],
  view: RevealLayoutParams = {},
): Map<string, number> {
  const xs = new Map<string, number>()
  if (items.length === 0) return xs

  const spread = view.spread ?? 1
  const yawTurns = view.yawTurns ?? 0
  xs.set(items[0].id, itemExtentAlongX(items[0], yawTurns) / 2)

  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1]
    const next = items[i]
    const prevX = xs.get(prev.id)!
    const gap = pairSpacingGap(prev, next, spread, yawTurns)
    const nextX =
      prevX +
      itemExtentAlongX(prev, yawTurns) / 2 +
      gap +
      itemExtentAlongX(next, yawTurns) / 2
    xs.set(next.id, nextX)
  }

  return xs
}

/** Shortest-path destination angle for ArcRotateCamera alpha. */
export function shortestAngleTo(from: number, to: number): number {
  const twoPi = Math.PI * 2
  const delta = ((((to - from) % twoPi) + twoPi * 1.5) % twoPi) - Math.PI
  return from + delta
}
