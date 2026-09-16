/**
 * Proven oil reserves for the top 15 countries, shown as one cube of crude each.
 *
 * Source: Worldometer (EIA International Energy Statistics / Oil & Gas Journal).
 * Reserves are 2025 figures; "years left" is reserves ÷ current production as
 * Worldometer publishes it; consumption is the latest year (2024 or 2025).
 * https://www.worldometers.info/oil/oil-reserves-by-country/
 * https://www.worldometers.info/oil/oil-consumption-by-country/
 */

import type { CountryCode } from './countries'

export type OilReserve = {
  /** Catalog id suffix: `oil-{slug}`. */
  slug: string
  name: string
  /** ISO 3166-1 alpha-2 code; the flag comes from `COUNTRIES`. */
  iso: CountryCode
  /** Name as it reads mid-sentence ("the United States"). Defaults to `name`. */
  proseName?: string
  /** Proven reserves in barrels. */
  barrels: number
  /** Share of world proven reserves, percent. */
  worldSharePct: number
  /** Years of reserves at current production; `null` when over 500 years. */
  yearsLeft: number | null
  /** Domestic consumption in barrels per day. */
  consumptionBpd: number
}

/** One US oil barrel is 42 US gallons. */
export const BARREL_M3 = 0.158987294928

/** Descending by reserves. */
export const OIL_RESERVES: OilReserve[] = [
  { slug: 'venezuela', name: 'Venezuela', iso: 'VE', barrels: 303_008_000_000, worldSharePct: 17.2, yearsLeft: null, consumptionBpd: 234_478 },
  { slug: 'saudi-arabia', name: 'Saudi Arabia', iso: 'SA', barrels: 267_230_000_000, worldSharePct: 15.1, yearsLeft: 77, consumptionBpd: 3_695_113 },
  { slug: 'iran', name: 'Iran', iso: 'IR', barrels: 208_600_000_000, worldSharePct: 11.8, yearsLeft: 141, consumptionBpd: 1_998_961 },
  { slug: 'canada', name: 'Canada', iso: 'CA', barrels: 163_108_000_000, worldSharePct: 9.2, yearsLeft: 90, consumptionBpd: 2_476_562 },
  { slug: 'iraq', name: 'Iraq', iso: 'IQ', barrels: 145_019_000_000, worldSharePct: 8.2, yearsLeft: 91, consumptionBpd: 1_065_349 },
  { slug: 'uae', name: 'United Arab Emirates', iso: 'AE', proseName: 'the UAE', barrels: 113_000_000_000, worldSharePct: 6.4, yearsLeft: 82, consumptionBpd: 879_804 },
  { slug: 'kuwait', name: 'Kuwait', iso: 'KW', barrels: 101_500_000_000, worldSharePct: 5.8, yearsLeft: 108, consumptionBpd: 438_020 },
  { slug: 'united-states', name: 'United States', iso: 'US', proseName: 'the United States', barrels: 83_729_430_000, worldSharePct: 4.7, yearsLeft: 17, consumptionBpd: 20_610_329 },
  { slug: 'russia', name: 'Russia', iso: 'RU', barrels: 80_000_000_000, worldSharePct: 4.5, yearsLeft: 22, consumptionBpd: 3_801_859 },
  { slug: 'libya', name: 'Libya', iso: 'LY', barrels: 48_363_000_000, worldSharePct: 2.7, yearsLeft: 97, consumptionBpd: 222_799 },
  { slug: 'nigeria', name: 'Nigeria', iso: 'NG', barrels: 37_500_000_000, worldSharePct: 2.1, yearsLeft: 64, consumptionBpd: 492_939 },
  { slug: 'kazakhstan', name: 'Kazakhstan', iso: 'KZ', barrels: 30_000_000_000, worldSharePct: 1.7, yearsLeft: 40, consumptionBpd: 412_115 },
  { slug: 'china', name: 'China', iso: 'CN', barrels: 28_182_000_000, worldSharePct: 1.6, yearsLeft: 18, consumptionBpd: 16_370_536 },
  { slug: 'qatar', name: 'Qatar', iso: 'QA', barrels: 25_244_000_000, worldSharePct: 1.4, yearsLeft: 53, consumptionBpd: 276_281 },
  { slug: 'brazil', name: 'Brazil', iso: 'BR', barrels: 15_894_160_000, worldSharePct: 0.9, yearsLeft: 12, consumptionBpd: 3_268_781 },
]

export function oilReserveId(reserve: OilReserve): string {
  return `oil-${reserve.slug}`
}

/** Edge of a cube holding the whole reserve, in meters. */
export function oilCubeSideM(reserve: OilReserve): number {
  return Math.cbrt(reserve.barrels * BARREL_M3)
}

/** Years the reserve would cover the country's own consumption. */
export function oilYearsAtOwnConsumption(reserve: OilReserve): number {
  return reserve.barrels / (reserve.consumptionBpd * 365)
}

function formatYears(years: number): string {
  if (years < 20) return years.toFixed(1)
  return Math.round(years).toLocaleString('en-US')
}

function formatBarrels(barrels: number): string {
  return `${(barrels / 1e9).toLocaleString('en-US', { maximumFractionDigits: 1 })} billion`
}

/** Plaque / tooltip line. */
export function oilBlurb(reserve: OilReserve): string {
  const sideKm = (oilCubeSideM(reserve) / 1000).toFixed(1)
  return `${formatBarrels(reserve.barrels)} barrels of proven oil reserves as one ${sideKm} km cube.`
}

/** Library facts, authored in metric for the imperial converter. */
export function oilFacts(reserve: OilReserve): string {
  const who = reserve.proseName ?? reserve.name
  const Who = who.charAt(0).toUpperCase() + who.slice(1)
  const own = oilYearsAtOwnConsumption(reserve)
  const production =
    reserve.yearsLeft == null
      ? 'more than 500 years'
      : `about ${reserve.yearsLeft} years`
  const sideKm = (oilCubeSideM(reserve) / 1000).toFixed(1)
  const importer =
    reserve.yearsLeft != null && own < reserve.yearsLeft
      ? ' It burns more oil than it pumps, so its reserves cover its own needs for less time than its output would suggest.'
      : ''
  return (
    `${Who} holds ${formatBarrels(reserve.barrels)} barrels of proven oil reserves — ` +
    `${reserve.worldSharePct}% of the world total. At current production that lasts ${production}; ` +
    `at its own consumption of ${reserve.consumptionBpd.toLocaleString('en-US')} barrels a day, ` +
    `it would last about ${formatYears(own)} years.${importer} ` +
    `Gathered into one cube, the oil would be ${sideKm} km on each side.`
  )
}
