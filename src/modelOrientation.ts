import type { CatalogItem, ScaleAxis } from './data/catalog'

/**
 * After the catalog authoring pose, models live in this frame:
 * +Y up, +Z length/forward (nose), +X width (right / wings).
 *
 * User display yaw is a separate 90° snap on a parent node and must never
 * be fed back into scaling.
 */

const STORAGE_KEY = 'magnitudemap-display-yaw-turns'

export function normalizeYawTurns(turns: number): number {
  return ((Math.round(turns) % 4) + 4) % 4
}

export function displayYawRadians(turns: number): number {
  return normalizeYawTurns(turns) * (Math.PI / 2)
}

export function loadDisplayYawTurns(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null) return 0
    return normalizeYawTurns(Number(raw))
  } catch {
    return 0
  }
}

export function saveDisplayYawTurns(turns: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(normalizeYawTurns(turns)))
  } catch {
    /* ignore */
  }
}

/** Quarter-turn degrees in 0/90/180/270. */
export function normalizeQuarterDegrees(degrees: number): number {
  return (((Math.round(degrees / 90) * 90) % 360) + 360) % 360
}

/**
 * Lineup runs along +X. After the authoring pose, width is on X and length
 * is on Z, so display yaw 0 spaces by width; 90°/270° swap in length.
 */
export function itemExtentAlongX(item: CatalogItem, yawTurns: number): number {
  return normalizeYawTurns(yawTurns) % 2 === 0 ? item.width : item.length
}

export function itemExtentAlongZ(item: CatalogItem, yawTurns: number): number {
  return normalizeYawTurns(yawTurns) % 2 === 0 ? item.length : item.width
}

type Size3 = { x: number; y: number; z: number }

/**
 * World AABB size along the catalog axis after the authoring pose.
 * Authoring yaw must already put length on Z and width on X.
 */
export function axisSizeAfterAuthoringYaw(
  size: Size3,
  axis: ScaleAxis,
  _yawDegrees?: number,
): number {
  switch (axis) {
    case 'height':
      return size.y
    case 'max':
      return Math.max(size.x, size.y, size.z)
    case 'footprint':
      return Math.max(size.x, size.z)
    case 'length':
      return size.z
    case 'width':
      return size.x
  }
}
