/** Painted suburban slab, or a true-scale city GLB sitting on it. */
export type GroundPlateId = 'neighborhood' | 'manhattan' | 'stadium'

export type GroundPlate = {
  id: GroundPlateId
  name: string
  /** GLB under `public/`, e.g. `grounds/manhattan/model.glb`. */
  modelPath?: string
  /**
   * Real-world meters for the longest horizontal AABB after import.
   * Lower Manhattan (Battery through the Brooklyn Bridge, plus harbor).
   * Omit when the GLB is already authored in metres.
   */
  lengthMeters?: number
  yawDegrees?: number
  pitchDegrees?: number
  rollDegrees?: number
  /** World-Y spin after seating, around the lineup origin. */
  spinDegrees?: number
  /** Shift the city so the lineup sits in a clearing (world meters). */
  originX?: number
  originZ?: number
  /**
   * Mesh whose top face the lineup stands on, in place of the automatic
   * clearing search — a stadium pitch, not whichever plaza scores best.
   */
  anchorMeshName?: string
  /** Float the plate on a harbor slab instead of dirt (photogrammetry islands). */
  water?: boolean
}

export const GROUND_PLATES: GroundPlate[] = [
  {
    id: 'neighborhood',
    name: 'Neighborhood',
  },
  {
    id: 'manhattan',
    name: 'New York',
    modelPath: 'grounds/manhattan/model.glb',
    // Harbor tile is a square ~8 km; building height (~490 m after scale) matches One WTC.
    // The water quad is stripped at load. Coverage is Battery through Midtown, not the full island.
    lengthMeters: 8000,
    // GLB is still an XY wall (buildings toward the plaques). +90 lays it down with roofs up.
    pitchDegrees: 90,
    yawDegrees: 0,
    spinDegrees: 165,
    water: true,
  },
  {
    id: 'stadium',
    name: 'Stadium',
    modelPath: 'grounds/stadium/model.glb',
    // Estadio Único Madre de Ciudades, authored in metres and already +Y up, so no
    // lengthMeters: the 105 x 68 m pitch is the scale check. Its long axis is the
    // model's X, which is also the lineup axis — no spin.
    anchorMeshName: 'pitch-anchor',
  },
]

export const GROUND_PLATE_BY_ID = Object.fromEntries(
  GROUND_PLATES.map((plate) => [plate.id, plate]),
) as Record<GroundPlateId, GroundPlate>

export const DEFAULT_GROUND_PLATE: GroundPlateId = 'neighborhood'
