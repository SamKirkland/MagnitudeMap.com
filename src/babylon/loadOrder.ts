/**
 * How a lineup comes down the wire.
 *
 * Two things make a lineup appear sooner without fetching less of it:
 *
 * - A **preview**: each big model first shows its coarse LOD level, which is
 *   typically a few percent of the full file, while full detail downloads
 *   behind it. The preview is scaled from its own bounds, which the generator
 *   holds within 10% of the source, and the lineup re-packs when the real model
 *   replaces it.
 * - **Smallest first**: full-detail files are fetched a few at a time in order
 *   of size, so a 13 KB V-2 is not left sharing bandwidth with a 4 MB SLS. Total
 *   time is the same either way; what changes is how many objects are standing
 *   while you wait.
 */
import type { ModelLodLevel } from '../data/modelLods'

/** Below this the full model arrives about as fast as a preview would. */
export const PREVIEW_MIN_SOURCE_BYTES = 256 * 1024

/** A preview has to be at most this fraction of the full file to earn its request. */
export const PREVIEW_MAX_FRACTION = 0.25

/** Full-detail downloads in flight at once. */
export const FULL_MODEL_LOADS_IN_FLIGHT = 4

/**
 * The level to stand in while full detail downloads, or null when a preview
 * would not arrive meaningfully sooner than the real thing.
 *
 * The swarm level (`lod3`) is never used: 64 px textures and ~400 triangles
 * hold up at 34 px on screen, not in the opening overview.
 */
export function previewLevelPath(
  levels: readonly ModelLodLevel[],
  sourceBytes: number | undefined,
): string | null {
  if (!sourceBytes || sourceBytes < PREVIEW_MIN_SOURCE_BYTES) return null
  let best: ModelLodLevel | null = null
  for (const level of levels) {
    if (/\.lod3\.glb$/i.test(level.path)) continue
    if (!best || level.bytes < best.bytes) best = level
  }
  if (!best || best.bytes > sourceBytes * PREVIEW_MAX_FRACTION) return null
  return best.path
}

/** Smallest download first; anything of unknown size goes last, in its original order. */
export function orderBySize<T>(items: readonly T[], bytesOf: (item: T) => number | undefined): T[] {
  return items
    .map((item, index) => ({ item, index, bytes: bytesOf(item) ?? Number.POSITIVE_INFINITY }))
    .sort((a, b) => a.bytes - b.bytes || a.index - b.index)
    .map((entry) => entry.item)
}

/** Run `task` over `items` in order, at most `limit` at a time. Rejections propagate. */
export async function forEachLimited<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const item = items[next]
      next += 1
      await task(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, worker))
}
