import type {
  PosterBackground,
  PosterContentRect,
  PosterLayout,
  PosterResolution,
  PosterSettings,
  PosterView,
} from './types'

const STORAGE_KEY = 'magnitudemap-poster-settings-v6'
const LEGACY_STORAGE_KEYS = [
  'magnitudemap-poster-settings-v5',
  'magnitudemap-poster-settings-v4',
  'magnitudemap-poster-settings-v3',
  'magnitudemap-poster-settings-v2',
]

export const DEFAULT_POSTER_SETTINGS: PosterSettings = {
  layout: 'lineup',
  view: 'side',
  background: 'white',
  resolution: '4k',
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

/**
 * Above this many objects a single row (or column) reads as a thin ribbon in a
 * 16:9 frame, so the poster wraps into a grid instead.
 */
export const POSTER_GRID_MIN_ITEMS = 8

export function posterUsesGrid(itemCount: number): boolean {
  return itemCount >= POSTER_GRID_MIN_ITEMS
}

/** Image region (y-down fractions) reserved for the 3D models. */
export function posterContentRect(
  layout: PosterLayout,
  itemCount = 0,
): PosterContentRect {
  const grid = posterUsesGrid(itemCount)
  if (layout === 'stacked') {
    // Grid mode carries a label gutter inside every column, so the reserved
    // strip on the right only has to hold the last column's names.
    return grid
      ? { left: 0.05, right: 0.86, top: 0.07, bottom: 0.90 }
      : { left: 0.06, right: 0.70, top: 0.09, bottom: 0.88 }
  }
  // Grid rows label in place, so only the bottom row needs a strip under it.
  return grid
    ? { left: 0.05, right: 0.95, top: 0.07, bottom: 0.86 }
    : { left: 0.05, right: 0.95, top: 0.09, bottom: 0.80 }
}

/** Label type size, shared by the layout planner and the overlay painter. */
export function posterLabelFontSize(width: number, itemCount: number): number {
  const crowded = itemCount > 8
  return Math.max(12, Math.round(width * (crowded ? 0.01 : 0.0125)))
}

/**
 * A name's length in average glyph widths. A flag emoji is four UTF-16 code
 * units but draws about as wide as two letters, so a plain `.length` would
 * reserve a gutter half again too wide for a short flagged name.
 */
export function labelCharWidth(name: string): number {
  const flags = name.match(/[\u{1F1E6}-\u{1F1FF}]{2}/gu)?.length ?? 0
  return name.length - flags * 2
}

/** Vertical strip one row of labels needs, in pixels. */
export function posterLabelBandPx(width: number, itemCount: number): number {
  const fontSize = posterLabelFontSize(width, itemCount)
  return Math.round(fontSize * 1.9)
}

function isLayout(value: unknown): value is PosterLayout {
  return value === 'lineup' || value === 'stacked'
}

function isBackground(value: unknown): value is PosterBackground {
  return value === 'white' || value === 'transparent'
}

function isResolution(value: unknown): value is PosterResolution {
  return value === '4k' || value === '8k' || value === '16k'
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
      background: isBackground(parsed.background)
        ? parsed.background
        : DEFAULT_POSTER_SETTINGS.background,
      // Absent in settings saved before one-tap download existed.
      resolution: isResolution(parsed.resolution)
        ? parsed.resolution
        : DEFAULT_POSTER_SETTINGS.resolution,
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
