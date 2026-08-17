import { Vector3 } from '@babylonjs/core'
import type { PosterView } from './types'

/** Tiny tilt so ArcRotateCamera does not hit gimbal lock at straight-down. */
const TOP_BETA = 0.01

/**
 * Axis-aligned poster orbits. Lineup is along +X, models face +Z.
 * Both views are framed orthographically so scale is constant across the row.
 */
export function posterViewAngles(view: PosterView): { alpha: number; beta: number } {
  if (view === 'top') {
    return { alpha: -Math.PI / 2, beta: TOP_BETA }
  }
  // Horizontal, from -Z: the row reads left-to-right and height is on screen Y.
  return { alpha: -Math.PI / 2, beta: Math.PI / 2 }
}

export function aabbCorners(min: Vector3, max: Vector3): Vector3[] {
  return [
    new Vector3(min.x, min.y, min.z),
    new Vector3(max.x, min.y, min.z),
    new Vector3(min.x, max.y, min.z),
    new Vector3(max.x, max.y, min.z),
    new Vector3(min.x, min.y, max.z),
    new Vector3(max.x, min.y, max.z),
    new Vector3(min.x, max.y, max.z),
    new Vector3(max.x, max.y, max.z),
  ]
}
