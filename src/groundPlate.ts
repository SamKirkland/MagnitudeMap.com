import {
  DEFAULT_GROUND_PLATE,
  GROUND_PLATES,
  GROUND_PLATE_BY_ID,
  type GroundPlateId,
} from './data/groundPlates'

const STORAGE_KEY = 'magnitudemap-ground-plate'

/** Query parameter carrying the ground choice in shareable URLs: `?ground=new-york`. */
export const GROUND_URL_PARAM = 'ground'

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

/** `manhattan` → `new-york`: the URL uses the name people see in the toolbar. */
export function groundPlateSlug(id: GroundPlateId): string {
  return GROUND_PLATE_BY_ID[id].name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Accepts the readable slug (`new-york`) or the plate id (`manhattan`). */
export function parseGroundPlateParam(value: string | null | undefined): GroundPlateId | null {
  if (!value) return null
  const key = value.trim().toLowerCase()
  const match = GROUND_PLATES.find(
    (plate) => plate.id === key || groundPlateSlug(plate.id) === key,
  )
  return match?.id ?? null
}

/** Ground named in the address bar, or null. Reads `window`, so call it after mount. */
export function groundPlateFromUrl(): GroundPlateId | null {
  if (typeof window === 'undefined') return null
  return parseGroundPlateParam(
    new URLSearchParams(window.location.search).get(GROUND_URL_PARAM),
  )
}

/** `search` with the ground set — or removed for the default — keeping any other params. */
export function searchWithGroundPlate(search: string, id: GroundPlateId): string {
  const params = new URLSearchParams(search)
  if (id === DEFAULT_GROUND_PLATE) params.delete(GROUND_URL_PARAM)
  else params.set(GROUND_URL_PARAM, groundPlateSlug(id))
  const next = params.toString()
  return next ? `?${next}` : ''
}

/** Rewrite only the query string; the path and hash belong to the lineup selection. */
export function replaceGroundPlateUrl(id: GroundPlateId) {
  if (typeof window === 'undefined') return
  const { pathname, search, hash } = window.location
  const nextSearch = searchWithGroundPlate(search, id)
  if (nextSearch === search) return
  window.history.replaceState(window.history.state, '', `${pathname}${nextSearch}${hash}`)
}
