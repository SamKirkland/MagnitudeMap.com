/**
 * Formation layout for a fleet lineup.
 *
 * A normal lineup shows one of each type. A fleet lineup shows how many there
 * were: every type keeps its place in the sorted row, but stands at the front
 * of a block holding the rest of its class. The block is what gives the
 * comparison its point — 74 destroyers next to 11 carriers reads as a fleet in
 * a way that one of each never will.
 *
 * The copies are drawn as thin instances of the type's own mesh, so a block
 * costs one draw call per mesh however many ships are in it. Paired with the
 * far LOD level (`modelLod.ts`), a stage can carry a few thousand hulls.
 *
 * Offsets are world-space metres relative to the type's own position: +X along
 * the lineup, −Z away from the camera, so the block grows backwards and the
 * front rank stays level with the rest of the row.
 */

export type FleetSlot = { x: number; z: number }

export type FleetFormation = {
  /** Every copy except the one already standing in the lineup. */
  copies: FleetSlot[]
  /** Block extent in metres, including the gaps between units. */
  width: number
  depth: number
  cols: number
  rows: number
}

/**
 * Space between units as a fraction of their own size. Enough to read each
 * hull as separate at a glance, tight enough that a block still reads as one.
 */
const GAP_FRACTION = 0.35

/**
 * Ceiling on copies actually drawn, per type. Well above any real order of
 * battle for ships; aircraft counts are scaled down by the caller instead of
 * being silently clipped here.
 */
export const MAX_FLEET_COPIES = 4000

const EMPTY: FleetFormation = { copies: [], width: 0, depth: 0, cols: 0, rows: 0 }

/**
 * @param count  Total units of this type, including the one in the lineup.
 * @param unitX  Measured world-X extent of one unit, in metres.
 * @param unitZ  Measured world-Z extent of one unit, in metres.
 */
export function fleetFormation(count: number, unitX: number, unitZ: number): FleetFormation {
  const total = Math.min(Math.floor(count), MAX_FLEET_COPIES)
  if (!Number.isFinite(total) || total <= 1) return EMPTY

  const cellX = Math.max(unitX, 1e-3) * (1 + GAP_FRACTION)
  const cellZ = Math.max(unitZ, 1e-3) * (1 + GAP_FRACTION)

  // Aim for a block that is about as wide as it is deep in metres, so a long
  // hull ends up in few columns and a stubby one in many. Purely by unit count
  // a destroyer block would be square in *ships* and ten times deeper than wide.
  const cols = Math.max(1, Math.min(total, Math.round(Math.sqrt((total * cellZ) / cellX))))
  const rows = Math.ceil(total / cols)

  const slots: FleetSlot[] = []
  for (let row = 0; row < rows; row++) {
    const inRow = Math.min(cols, total - row * cols)
    // Centre each rank on the lineup position, including a short last rank.
    const offset = ((inRow - 1) * cellX) / 2
    for (let col = 0; col < inRow; col++) {
      slots.push({ x: col * cellX - offset, z: -row * cellZ })
    }
  }

  // The unit already in the lineup takes the slot nearest its own position, so
  // the plaque still belongs to the hull in front of it.
  let heroIndex = 0
  let best = Infinity
  for (let i = 0; i < slots.length; i++) {
    const distance = Math.hypot(slots[i].x, slots[i].z)
    if (distance < best) {
      best = distance
      heroIndex = i
    }
  }
  const hero = slots[heroIndex]
  const copies = slots
    .filter((_, i) => i !== heroIndex)
    // Re-centre on the hero: it is the one the lineup already positioned.
    .map((slot) => ({ x: slot.x - hero.x, z: slot.z - hero.z }))

  return {
    copies,
    width: cols * cellX,
    depth: rows * cellZ,
    cols,
    rows,
  }
}
