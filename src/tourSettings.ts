export type TourFrameMode = 'pair' | 'all'

export type TourSettings = {
  /** pair = current + previous (default). all = every object revealed so far. */
  frameMode: TourFrameMode
  /** 0.5 = AABBs nearly touching, 2.5 = isolated (head-on PLAY won't show the neighbor). */
  spread: number
  /** -1 = look from the left, 0 = default 3/4, 1 = look from the right. */
  yaw: number
}

export const DEFAULT_TOUR_SETTINGS: TourSettings = {
  frameMode: 'pair',
  spread: 1,
  yaw: 0,
}

const STORAGE_KEY = 'magnitudemap-tour-settings'
export const SPREAD_MIN = 0.5
export const SPREAD_MAX = 2.5

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** 0 at Tight, 1 at Wide. */
export function spreadAmount(spread: number): number {
  return clamp((spread - SPREAD_MIN) / (SPREAD_MAX - SPREAD_MIN), 0, 1)
}

export function clampTourSettings(settings: TourSettings): TourSettings {
  return {
    frameMode: settings.frameMode === 'all' ? 'all' : 'pair',
    spread: clamp(settings.spread, SPREAD_MIN, SPREAD_MAX),
    yaw: clamp(settings.yaw, -1, 1),
  }
}

export function tourSettingsEqual(a: TourSettings, b: TourSettings) {
  return a.frameMode === b.frameMode && a.spread === b.spread && a.yaw === b.yaw
}

export function loadTourSettings(): TourSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_TOUR_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<TourSettings>
    return clampTourSettings({
      frameMode: parsed.frameMode === 'all' ? 'all' : 'pair',
      spread:
        typeof parsed.spread === 'number' ? parsed.spread : DEFAULT_TOUR_SETTINGS.spread,
      yaw: typeof parsed.yaw === 'number' ? parsed.yaw : DEFAULT_TOUR_SETTINGS.yaw,
    })
  } catch {
    return { ...DEFAULT_TOUR_SETTINGS }
  }
}

export function saveTourSettings(settings: TourSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clampTourSettings(settings)))
  } catch {
    /* ignore */
  }
}
