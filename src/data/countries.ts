/**
 * Countries behind the catalog: the flag shown beside an item's name, and the
 * words a visitor might type looking for it.
 *
 * Search only matches what is written down, so each country carries its
 * demonym ("american"), its short forms ("usa", "uk") and the state that built
 * the older hardware ("soviet", "ussr" for Russia). `countrySearchTags` folds
 * those into an item's tags, which is why "USA" finds the F-22 even though
 * neither its name nor its own tags say so.
 */

/** ISO 3166-1 alpha-2, plus `EU` for the multinational programs. */
export type CountryCode = string

export type Country = {
  /** Display name, as it would head a list. */
  name: string
  /** Extra search terms: demonym, abbreviations, predecessor states. */
  aliases: string[]
}

export const COUNTRIES: Record<CountryCode, Country> = {
  AE: { name: 'United Arab Emirates', aliases: ['uae', 'emirates', 'emirati', 'dubai', 'abu dhabi'] },
  AU: { name: 'Australia', aliases: ['australian', 'aussie'] },
  BR: { name: 'Brazil', aliases: ['brazilian', 'brasil'] },
  CA: { name: 'Canada', aliases: ['canadian'] },
  CN: { name: 'China', aliases: ['chinese', 'prc', "people's republic of china"] },
  DE: { name: 'Germany', aliases: ['german', 'deutschland'] },
  EG: { name: 'Egypt', aliases: ['egyptian'] },
  /** Airbus and the other cross-border European programs. */
  EU: { name: 'Europe', aliases: ['european', 'european union', 'eu'] },
  FR: { name: 'France', aliases: ['french'] },
  GB: { name: 'United Kingdom', aliases: ['uk', 'britain', 'british', 'great britain', 'england'] },
  IQ: { name: 'Iraq', aliases: ['iraqi'] },
  IR: { name: 'Iran', aliases: ['iranian', 'persia', 'persian'] },
  IT: { name: 'Italy', aliases: ['italian'] },
  JP: { name: 'Japan', aliases: ['japanese', 'imperial japan'] },
  KW: { name: 'Kuwait', aliases: ['kuwaiti'] },
  KZ: { name: 'Kazakhstan', aliases: ['kazakh'] },
  LY: { name: 'Libya', aliases: ['libyan'] },
  NG: { name: 'Nigeria', aliases: ['nigerian'] },
  NZ: { name: 'New Zealand', aliases: ['nz', 'kiwi'] },
  QA: { name: 'Qatar', aliases: ['qatari'] },
  RU: { name: 'Russia', aliases: ['russian', 'soviet', 'soviet union', 'ussr'] },
  SA: { name: 'Saudi Arabia', aliases: ['saudi', 'ksa'] },
  US: {
    name: 'United States',
    aliases: ['usa', 'us', 'america', 'american', 'united states of america'],
  },
  VE: { name: 'Venezuela', aliases: ['venezuelan'] },
}

/** `US` → 🇺🇸 (two regional-indicator symbols). */
export function flagEmoji(code: CountryCode): string {
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  )
}

/** The flags for an item, run together: `🇬🇧🇫🇷` for Concorde. */
export function flagsFor(codes: readonly CountryCode[] | undefined): string {
  if (!codes?.length) return ''
  return codes.map(flagEmoji).join('')
}

/** `🇺🇸 F-22 Raptor` — the name as it reads on a plaque, a poster or a row. */
export function withFlags(name: string, codes: readonly CountryCode[] | undefined): string {
  const flags = flagsFor(codes)
  return flags ? `${flags} ${name}` : name
}

/** Lowercased search terms for a set of countries: name plus every alias. */
export function countrySearchTags(codes: readonly CountryCode[] | undefined): string[] {
  if (!codes?.length) return []
  const tags: string[] = []
  for (const code of codes) {
    const country = COUNTRIES[code]
    if (!country) continue
    tags.push(country.name.toLowerCase(), ...country.aliases)
  }
  return tags
}
