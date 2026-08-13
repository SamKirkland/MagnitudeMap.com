/**
 * Pack N unit money blocks ($42M each) into a near-cubic grid.
 * Used by the catalog (footprint) and the scene (instance placement).
 */

export type MoneyPack = {
  /** Cells along width (X). */
  nx: number
  /** Cells along height (Y). */
  ny: number
  /** Cells along length/depth (Z). */
  nz: number
  /** Whole $42M blocks. */
  fullCount: number
  /** Extra partial block as a volume fraction 0..1 (0 = none). */
  fraction: number
  /** Total placed slots (fullCount + optional partial). */
  slotCount: number
  /** Footprint / stack size in meters. */
  width: number
  length: number
  height: number
}

export type MoneyUnitSize = {
  width: number
  length: number
  height: number
}

/** Choose nx×nz×ny close to a cube in world meters for `slotCount` cells. */
export function packMoneySlots(slotCount: number, unit: MoneyUnitSize): {
  nx: number
  ny: number
  nz: number
} {
  if (slotCount <= 1) return { nx: 1, ny: 1, nz: 1 }

  const volume = slotCount * unit.width * unit.length * unit.height
  const side = Math.cbrt(volume)
  let best = { nx: slotCount, ny: 1, nz: 1, score: Number.POSITIVE_INFINITY }

  const nx0 = Math.max(1, Math.round(side / unit.width))
  const nz0 = Math.max(1, Math.round(side / unit.length))

  for (let nx = Math.max(1, nx0 - 4); nx <= nx0 + 6; nx++) {
    for (let nz = Math.max(1, nz0 - 4); nz <= nz0 + 6; nz++) {
      const ny = Math.ceil(slotCount / (nx * nz))
      const w = nx * unit.width
      const l = nz * unit.length
      const h = ny * unit.height
      // Prefer compact piles; lightly penalize unused cells in the top layer.
      const unused = nx * nz * ny - slotCount
      const score =
        Math.abs(w - side) + Math.abs(l - side) + Math.abs(h - side) + unused * 0.05
      if (score < best.score) best = { nx, ny, nz, score }
    }
  }

  return { nx: best.nx, ny: best.ny, nz: best.nz }
}

export function packMoneyAmount(usd: number, unitUsd: number, unit: MoneyUnitSize): MoneyPack {
  const units = usd / unitUsd
  const fullCount = Math.floor(units + 1e-9)
  const fractionRaw = units - fullCount
  const fraction = fractionRaw > 0.001 ? fractionRaw : 0
  const slotCount = Math.max(1, fullCount + (fraction > 0 ? 1 : 0))

  // Single partial block (e.g. $1M): one scaled unit, not a grid of tiny cells.
  if (fullCount === 0) {
    const s = Math.cbrt(Math.max(units, 1e-9))
    return {
      nx: 1,
      ny: 1,
      nz: 1,
      fullCount: 0,
      fraction: units,
      slotCount: 1,
      width: unit.width * s,
      length: unit.length * s,
      height: unit.height * s,
    }
  }

  const { nx, ny, nz } = packMoneySlots(slotCount, unit)
  return {
    nx,
    ny,
    nz,
    fullCount,
    fraction,
    slotCount,
    width: nx * unit.width,
    length: nz * unit.length,
    height: ny * unit.height,
  }
}

export type MoneyBlockPose = {
  /** Center of the block in pile-local space (origin at pile center on XZ, y=0 at ground). */
  position: { x: number; y: number; z: number }
  /** Uniform scale relative to a full unit block. */
  scale: number
}

/** Slot index → grid coords (fill order: Y, then Z, then X). */
export function moneySlotCoords(
  pack: MoneyPack,
  index: number,
): { ix: number; iy: number; iz: number } {
  const layer = pack.nx * pack.nz
  const iy = Math.floor(index / layer)
  const rem = index - iy * layer
  const iz = Math.floor(rem / pack.nx)
  const ix = rem - iz * pack.nx
  return { ix, iy, iz }
}

function moneySlotFilled(pack: MoneyPack, ix: number, iy: number, iz: number): boolean {
  if (ix < 0 || iy < 0 || iz < 0 || ix >= pack.nx || iy >= pack.ny || iz >= pack.nz) {
    return false
  }
  return iy * pack.nx * pack.nz + iz * pack.nx + ix < pack.slotCount
}

/**
 * True when a filled slot has at least one empty 6-neighbor (outer shell).
 * Interior cells are skipped for rendering — footprint/volume labels stay full-size.
 */
export function isMoneyShellSlot(pack: MoneyPack, index: number): boolean {
  if (index < 0 || index >= pack.slotCount) return false
  const { ix, iy, iz } = moneySlotCoords(pack, index)
  return (
    !moneySlotFilled(pack, ix - 1, iy, iz) ||
    !moneySlotFilled(pack, ix + 1, iy, iz) ||
    !moneySlotFilled(pack, ix, iy - 1, iz) ||
    !moneySlotFilled(pack, ix, iy + 1, iz) ||
    !moneySlotFilled(pack, ix, iy, iz - 1) ||
    !moneySlotFilled(pack, ix, iy, iz + 1)
  )
}

/** Filled shell slot indices in fill order (for thin-instance placement). */
export function moneyShellSlotIndices(pack: MoneyPack): number[] {
  const indices: number[] = []
  for (let i = 0; i < pack.slotCount; i++) {
    if (isMoneyShellSlot(pack, i)) indices.push(i)
  }
  return indices
}

export function moneyBlockPoseAt(
  pack: MoneyPack,
  unit: MoneyUnitSize,
  index: number,
): MoneyBlockPose {
  const { nx, nz, fullCount, fraction } = pack
  const { ix, iy, iz } = moneySlotCoords(pack, index)
  const isPartial = index === fullCount && fraction > 0
  const scale = isPartial ? Math.cbrt(fraction) : 1
  const originX = (-nx * unit.width) / 2
  const originZ = (-nz * unit.length) / 2
  return {
    position: {
      x: originX + (ix + 0.5) * unit.width,
      y: iy * unit.height + 0.5 * unit.height * scale,
      z: originZ + (iz + 0.5) * unit.length,
    },
    scale,
  }
}

/** World-local poses for each block in the packed pile (y-up, grounded). */
export function moneyBlockPoses(pack: MoneyPack, unit: MoneyUnitSize): MoneyBlockPose[] {
  const poses: MoneyBlockPose[] = []
  for (let i = 0; i < pack.slotCount; i++) {
    poses.push(moneyBlockPoseAt(pack, unit, i))
  }
  return poses
}

/** Exterior-only poses (skips buried interior cells). */
export function moneyShellPoses(pack: MoneyPack, unit: MoneyUnitSize): MoneyBlockPose[] {
  return moneyShellSlotIndices(pack).map((index) => moneyBlockPoseAt(pack, unit, index))
}
