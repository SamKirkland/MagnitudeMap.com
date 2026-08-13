import {
  CATALOG_BY_ID,
  COMPARISON_PRESETS,
  type ComparisonPreset,
} from './data/catalog'
import { siteBaseUrl } from './site'

export type SelectionFromUrl = {
  itemIds: string[]
  presetId: string | null
}

/** `Bomb sizes` → `bomb-sizes`, `Rockets` → `rockets` */
export function toSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function presetSlug(preset: ComparisonPreset): string {
  return toSlug(preset.name)
}

export function findPresetBySlug(slug: string): ComparisonPreset | undefined {
  const key = slug.toLowerCase()
  return COMPARISON_PRESETS.find(
    (preset) => preset.id === key || presetSlug(preset) === key,
  )
}

/** Old Kenney `person` id → Ready Player Me male. */
const ID_ALIASES: Record<string, string> = {
  person: 'person-male',
}

function uniqueValidIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of ids) {
    const id = ID_ALIASES[raw] ?? raw
    if (!CATALOG_BY_ID[id] || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function selectionKey(itemIds: string[]): string {
  return [...itemIds].sort().join('|')
}

function shareSlugFromPath(): string | null {
  const match = window.location.pathname.match(/\/c\/([^/]+)\/?$/)
  if (!match) return null
  try {
    return decodeURIComponent(match[1]).trim() || null
  } catch {
    return match[1]
  }
}

/** Read `/c/{preset}` or `#hash` into a selection, or `null` if absent/invalid. */
export function parseSelectionFromLocation(): SelectionFromUrl | null {
  const fromPath = shareSlugFromPath()
  if (fromPath) {
    const preset = findPresetBySlug(fromPath)
    if (preset) return { presetId: preset.id, itemIds: [...preset.itemIds] }
  }

  const raw = window.location.hash.replace(/^#/, '').trim()
  if (!raw) return null

  const preset = findPresetBySlug(raw)
  if (preset) {
    return { presetId: preset.id, itemIds: [...preset.itemIds] }
  }

  // Custom mix: comma or plus separated catalog ids.
  const parts = raw.split(/[,+]/).map((part) => part.trim()).filter(Boolean)
  const itemIds = uniqueValidIds(parts)
  if (itemIds.length === 0) return null
  return { presetId: null, itemIds }
}

/**
 * Encode selection for the URL (no leading `#`).
 * Presets use a readable name slug (`rockets`, `bomb-sizes`);
 * custom mixes use catalog ids (`person-male,falcon-9,starship`).
 */
export function serializeSelection(
  itemIds: string[],
  presetId: string | null,
): string {
  if (itemIds.length === 0) return ''

  const key = selectionKey(itemIds)
  const matched = COMPARISON_PRESETS.find(
    (preset) => selectionKey(preset.itemIds) === key,
  )
  if (matched) return presetSlug(matched)

  if (presetId) {
    const preset = COMPARISON_PRESETS.find((entry) => entry.id === presetId)
    if (preset && selectionKey(preset.itemIds) === key) {
      return presetSlug(preset)
    }
  }

  return uniqueValidIds(itemIds).join(',')
}

function sameLocation(a: string, b: string): boolean {
  const norm = (value: string) => value.replace(/\/+(?=\?|#|$)/g, '/')
  return norm(a) === norm(b)
}

/** Update the path (presets) or hash (custom mixes) — shareable, no history spam. */
export function replaceSelectionUrl(itemIds: string[], presetId: string | null) {
  const encoded = serializeSelection(itemIds, presetId)
  const { search } = window.location
  const base = siteBaseUrl()
  const preset = encoded ? findPresetBySlug(encoded) : undefined
  const homepagePreset = COMPARISON_PRESETS[0]

  let next: string
  if (preset && preset.id !== homepagePreset?.id) {
    next = `${base}c/${presetSlug(preset)}/${search}`
  } else if (preset) {
    next = `${base}${search}`
  } else if (encoded) {
    next = `${base}${search}#${encoded}`
  } else {
    next = `${base}${search}`
  }

  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (sameLocation(next, current)) return
  window.history.replaceState(null, '', next)
}
