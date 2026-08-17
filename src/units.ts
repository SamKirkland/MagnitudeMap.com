export type UnitSystem = 'metric' | 'imperial'

const STORAGE_KEY = 'magnitudemap-units'
const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM'])

const M_TO_FT = 3.280839895
const M_TO_IN = 39.37007874

/** Best-effort default from browser locale (US / Liberia / Myanmar → imperial). */
export function detectDefaultUnitSystem(): UnitSystem {
  if (typeof navigator === 'undefined') return 'metric'
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
  if (feet >= 3) return `${feet.toFixed(2)} ft`
  return `${(meters * M_TO_IN).toFixed(1)} in`
}
