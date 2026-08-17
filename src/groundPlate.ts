import {
  DEFAULT_GROUND_PLATE,
  GROUND_PLATE_BY_ID,
  type GroundPlateId,
} from './data/groundPlates'

const STORAGE_KEY = 'magnitudemap-ground-plate'

export function loadGroundPlate(): GroundPlateId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && stored in GROUND_PLATE_BY_ID) return stored as GroundPlateId
  } catch {
    /* ignore */
  }
  return DEFAULT_GROUND_PLATE
}

export function saveGroundPlate(id: GroundPlateId) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
}
