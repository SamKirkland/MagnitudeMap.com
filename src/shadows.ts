const STORAGE_KEY = 'magnitudemap-shadows'

export const DEFAULT_SHADOWS_ENABLED = true

export function loadShadowsEnabled(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === '0') return false
    if (stored === '1') return true
  } catch {
    /* ignore */
  }
  return DEFAULT_SHADOWS_ENABLED
}

export function saveShadowsEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
}
