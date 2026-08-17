import type {
  PosterContentRect,
  PosterLayout,
  PosterResolution,
  PosterSettings,
  PosterView,
} from './types'

const STORAGE_KEY = 'magnitudemap-poster-settings-v5'
const LEGACY_STORAGE_KEYS = [
  'magnitudemap-poster-settings-v4',
  'magnitudemap-poster-settings-v3',
  'magnitudemap-poster-settings-v2',
]

export const DEFAULT_POSTER_SETTINGS: PosterSettings = {
  layout: 'lineup',
  view: 'side',
}

export const POSTER_RESOLUTIONS: PosterResolution[] = ['4k', '8k', '16k']

/** Long-edge pixels for each download size. */
export const POSTER_LONG_EDGE: Record<PosterResolution, number> = {
  '4k': 3840,
  '8k': 7680,
  '16k': 15360,
}

export const POSTER_RESOLUTION_META: Record<PosterResolution, { label: string }> = {
  '4k': { label: 'Large' },
  '8k': { label: 'Larger' },
  '16k': { label: 'Huge' },
}

export function posterPixelSize(
  layout: PosterLayout,
  resolution: PosterResolution,
): { width: number; height: number } {
  return pixelSizeForLongEdge(POSTER_LONG_EDGE[resolution], layout)
}

function pixelSizeForLongEdge(
  long: number,
  layout: PosterLayout,
): { width: number; height: number } {
  if (layout === 'stacked') {
    return {
      width: Math.round((long * 4) / 5),
      height: long,
    }
  }
  return {
    width: long,
    height: Math.round((long * 9) / 16),
  }
}

/** Image region (y-down fractions) reserved for the 3D models. */
export function posterContentRect(layout: PosterLayout): PosterContentRect {
  if (layout === 'stacked') {
    return { left: 0.06, right: 0.70, top: 0.09, bottom: 0.88 }
  }
  return { left: 0.05, right: 0.95, top: 0.09, bottom: 0.80 }
}

function isLayout(value: unknown): value is PosterLayout {
  return value === 'lineup' || value === 'stacked'
}

function isView(value: unknown): value is PosterView {
  return value === 'top' || value === 'side'
}

function viewFromSaved(parsed: Partial<PosterSettings> & { side?: unknown }): PosterView {
  if (isView(parsed.view)) return parsed.view
  if (parsed.view === 'left' || parsed.view === 'right') return 'side'
  if (parsed.side === 'left' || parsed.side === 'right') return 'side'
  return DEFAULT_POSTER_SETTINGS.view
}

export function loadPosterSettings(): PosterSettings {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean)
    if (!raw) return { ...DEFAULT_POSTER_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<PosterSettings> & { side?: unknown }
    return {
      layout: isLayout(parsed.layout) ? parsed.layout : DEFAULT_POSTER_SETTINGS.layout,
      view: viewFromSaved(parsed),
    }
  } catch {
    return { ...DEFAULT_POSTER_SETTINGS }
  }
}

export function savePosterSettings(settings: PosterSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* ignore */
  }
}
