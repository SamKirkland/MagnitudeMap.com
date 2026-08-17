/**
 * Catalog / lineup search. Not Fuse.js: Bitap + ignoreLocation on short
 * queries matched most of the library (e.g. "ori" → "pedestrian"), and the
 * sidebar then regrouped hits by category so weak reference items appeared
 * first. Rank name/id/tag substrings and keep that order when querying.
 */

export type Searchable = {
  id: string
  name: string
  tags: string[]
}

const SCORE = {
  nameExact: 500,
  namePrefix: 450,
  nameWordPrefix: 400,
  nameContains: 350,
  idExact: 320,
  idPrefix: 300,
  idContains: 280,
  tagExact: 240,
  tagPrefix: 200,
  tagContains: 160,
} as const

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function isAlphaNum(ch: string | undefined): boolean {
  return !!ch && /[a-z0-9]/i.test(ch)
}

function words(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

/** True when `needle` starts at the beginning of a word in `haystack`. */
function containsAtWordStart(haystack: string, needle: string): boolean {
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  if (!n) return false
  let from = 0
  while (from <= h.length) {
    const index = h.indexOf(n, from)
    if (index === -1) return false
    if (!isAlphaNum(h[index - 1])) return true
    from = index + 1
  }
  return false
}

function fieldHit(
  value: string,
  query: string,
  compactQuery: string,
  allowContains: boolean,
  allowCompactContains: boolean,
  wordPrefix = true,
): 'exact' | 'prefix' | 'wordPrefix' | 'contains' | null {
  const lower = value.toLowerCase()
  const squeezed = compact(value)
  if (lower === query || squeezed === compactQuery) return 'exact'
  if (lower.startsWith(query) || (compactQuery.length > 0 && squeezed.startsWith(compactQuery))) {
    return 'prefix'
  }
  if (
    wordPrefix &&
    words(value).some(
      (word) =>
        word.startsWith(query) ||
        (compactQuery.length > 0 && compact(word).startsWith(compactQuery)),
    )
  ) {
    return 'wordPrefix'
  }
  if (allowContains && containsAtWordStart(value, query)) return 'contains'
  if (allowCompactContains && compactQuery.length > 0 && squeezed.includes(compactQuery)) {
    return 'contains'
  }
  return null
}

/** Catalog ids like ak47 / f22: query is the letter prefix and the rest is digits. */
function isIdCodePrefix(id: string, compactQuery: string): boolean {
  if (!compactQuery) return false
  const squeezed = compact(id)
  if (!squeezed.startsWith(compactQuery)) return false
  const rest = squeezed.slice(compactQuery.length)
  return rest.length > 0 && /^\d+$/.test(rest)
}

function scorePart(item: Searchable, part: string): number {
  const query = part.toLowerCase()
  const compactQuery = compact(part)
  const qLen = compactQuery.length || query.length
  if (!qLen) return 0

  const allowTags = qLen >= 2
  const allowContains = qLen >= 3
  const allowCompactContains = qLen >= 2 && /^\d+$/.test(compactQuery)
  const allowTagPrefix = qLen >= 3
  const allowTagContains = qLen >= 4
  const allowTagInner = qLen >= 5
  const allowWordPrefix = qLen >= 2

  const nameHit = fieldHit(
    item.name,
    query,
    compactQuery,
    allowContains,
    allowCompactContains,
    allowWordPrefix,
  )
  if (nameHit === 'exact') return SCORE.nameExact
  if (nameHit === 'prefix') return SCORE.namePrefix
  if (nameHit === 'wordPrefix') return SCORE.nameWordPrefix
  if (nameHit === 'contains') return SCORE.nameContains

  if (isIdCodePrefix(item.id, compactQuery)) return SCORE.namePrefix

  const idHit = fieldHit(
    item.id,
    query,
    compactQuery,
    allowContains,
    allowCompactContains,
    allowWordPrefix,
  )
  if (idHit === 'exact') return SCORE.idExact
  if (idHit === 'prefix') return SCORE.idPrefix
  if (idHit === 'wordPrefix' || idHit === 'contains') return SCORE.idContains

  if (!allowTags) return 0

  let best = 0
  for (const tag of item.tags) {
    const hit = fieldHit(
      tag,
      query,
      compactQuery,
      allowTagContains,
      false,
      allowTagPrefix,
    )
    if (hit === 'exact') best = Math.max(best, SCORE.tagExact)
    else if (!allowTagPrefix) continue
    else if (hit === 'prefix') best = Math.max(best, SCORE.tagPrefix)
    else if (hit === 'wordPrefix' || hit === 'contains') {
      best = Math.max(best, SCORE.tagContains)
    } else if (
      allowTagInner &&
      compact(tag).endsWith(compactQuery) &&
      compact(tag).length > compactQuery.length
    ) {
      best = Math.max(best, SCORE.tagContains)
    }
  }
  return best
}

function scoreItem(item: Searchable, rawQuery: string): number {
  const parts = rawQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!parts.length) return 1

  let total = 0
  for (const part of parts) {
    const partScore = scorePart(item, part)
    if (partScore <= 0) return 0
    total += partScore
  }
  if (parts.length > 1 && containsAtWordStart(item.name, rawQuery.trim())) {
    total += 40
  }
  return total
}

export function searchItems<T extends Searchable>(items: readonly T[], rawQuery: string): T[] {
  const query = rawQuery.trim()
  if (!query) return items.slice()

  return items
    .map((item, index) => ({ item, index, score: scoreItem(item, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item)
}
