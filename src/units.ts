export type UnitSystem = 'metric' | 'imperial'

const STORAGE_KEY = 'magnitudemap-units'
const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM'])

const M_TO_FT = 3.280839895
const M_TO_IN = 39.37007874

/** Rendered by the prerenderer and by the first client render, so both agree. */
export const DEFAULT_UNIT_SYSTEM: UnitSystem = 'metric'

/**
 * Best-effort default from browser locale (US / Liberia / Myanmar → imperial).
 *
 * Node 22 defines a global `navigator` with a real `language`, so a bare
 * `typeof navigator` check does not keep this off the prerenderer — the build
 * machine's locale would otherwise be baked into every page. Gate on `window`.
 */
export function detectDefaultUnitSystem(): UnitSystem {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return DEFAULT_UNIT_SYSTEM
  }
  const locales = navigator.languages?.length
    ? [...navigator.languages]
    : [navigator.language || 'en']

  for (const locale of locales) {
    const region = locale.split(/[-_]/)[1]?.toUpperCase()
    if (region && IMPERIAL_REGIONS.has(region)) return 'imperial'
  }
  return 'metric'
}

export function loadUnitSystem(): UnitSystem {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'metric' || stored === 'imperial') return stored
  } catch {
    /* ignore */
  }
  return detectDefaultUnitSystem()
}

export function saveUnitSystem(units: UnitSystem) {
  try {
    localStorage.setItem(STORAGE_KEY, units)
  } catch {
    /* ignore */
  }
}

/** 1 / 2 / 5 × 10^n closest to `value` (for scale bars). */
export function niceNumber(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  const exp = 10 ** Math.floor(Math.log10(value))
  const fraction = value / exp
  const nice = fraction >= 5 ? 5 : fraction >= 2 ? 2 : 1
  return nice * exp
}

/** Metres that format as a round number in the current unit system. */
export function niceScaleMeters(targetMeters: number, units: UnitSystem): number {
  if (units === 'imperial') return niceNumber(targetMeters * M_TO_FT) / M_TO_FT
  return niceNumber(targetMeters)
}

/** Format a real-world length stored in meters. */
export function formatLength(meters: number, units: UnitSystem): string {
  if (!Number.isFinite(meters)) return '—'

  if (units === 'metric') {
    if (meters >= 100) return `${Math.round(meters)} m`
    if (meters >= 10) return `${meters.toFixed(1)} m`
    if (meters >= 1) return `${meters.toFixed(2)} m`
    return `${(meters * 100).toFixed(0)} cm`
  }

  const feet = meters * M_TO_FT
  if (feet >= 100) return `${Math.round(feet)} ft`
  if (feet >= 10) return `${feet.toFixed(1)} ft`
  // Human-scale lengths read as feet and inches, not decimal feet.
  if (feet >= 1) return formatFeetInches(feet)
  return `${(meters * M_TO_IN).toFixed(1)} in`
}

/**
 * Feet and whole inches, the way an imperial reader says a height: `5 ft 7 in`.
 * Carries 12 in up to a foot, and drops the empty half (`6 ft`, `9 in`).
 */
export function formatFeetInches(feet: number): string {
  const totalInches = Math.round(feet * 12)
  const wholeFeet = Math.floor(totalInches / 12)
  const inches = totalInches % 12
  if (wholeFeet === 0) return `${totalInches} in`
  if (inches === 0) return `${wholeFeet} ft`
  return `${wholeFeet} ft ${inches} in`
}
