import { formatFeetInches, type UnitSystem } from './units'

/**
 * Rewrite the metric measurements written into catalog blurbs and facts so an
 * imperial reader sees feet / miles / mph / pounds instead.
 *
 * The catalog is authored in metric, in prose. Rather than maintaining two
 * copies of every description, we convert the quantities in place: a number
 * (or a range) immediately followed by a metric unit token. Anything else —
 * money, kilotons of yield, calibres already written in inches, bare words
 * like "several square metres" with no number — is left exactly as written.
 *
 * `scripts/tests/unit-text.test.mjs` walks every description in the catalog
 * and fails if a metric token survives conversion, so a new fact written with
 * a unit this file does not know about is caught at test time.
 */

type Conversion = {
  /** Imperial value for one metric unit. */
  factor: number
  /** Imperial unit written after the number. */
  suffix: string
}

/**
 * Longest token first — the matcher tries these in order, so `km/h` must come
 * before `km`, and `mm` before `m`.
 */
const CONVERSIONS: [token: string, conversion: Conversion][] = [
  ['km/h', { factor: 0.621371, suffix: 'mph' }],
  ['km²', { factor: 0.386102, suffix: 'sq mi' }],
  ['km³', { factor: 0.239913, suffix: 'cu mi' }],
  ['km', { factor: 0.621371, suffix: 'miles' }],
  ['kilometres', { factor: 0.621371, suffix: 'miles' }],
  ['kilometers', { factor: 0.621371, suffix: 'miles' }],
  ['kilometre', { factor: 0.621371, suffix: 'miles' }],
  ['kilometer', { factor: 0.621371, suffix: 'miles' }],
  ['m/s', { factor: 2.236936, suffix: 'mph' }],
  ['m²', { factor: 10.76391, suffix: 'sq ft' }],
  ['m³', { factor: 35.31467, suffix: 'cu ft' }],
  ['mm', { factor: 0.0393701, suffix: 'in' }],
  ['cm', { factor: 0.393701, suffix: 'in' }],
  ['m', { factor: 3.280840, suffix: 'ft' }],
  ['metres', { factor: 3.280840, suffix: 'ft' }],
  ['meters', { factor: 3.280840, suffix: 'ft' }],
  ['metre', { factor: 3.280840, suffix: 'ft' }],
  ['meter', { factor: 3.280840, suffix: 'ft' }],
  ['kg', { factor: 2.204623, suffix: 'lb' }],
  ['kilograms', { factor: 2.204623, suffix: 'lb' }],
  ['kilogram', { factor: 2.204623, suffix: 'lb' }],
  ['g', { factor: 0.0352740, suffix: 'oz' }],
  ['grams', { factor: 0.0352740, suffix: 'oz' }],
  ['gram', { factor: 0.0352740, suffix: 'oz' }],
  // Metric tonne -> US short ton.
  ['t', { factor: 1.102311, suffix: 'tons' }],
  ['tonnes', { factor: 1.102311, suffix: 'tons' }],
  ['tonne', { factor: 1.102311, suffix: 'tons' }],
  ['litres', { factor: 0.264172, suffix: 'gallons' }],
  ['liters', { factor: 0.264172, suffix: 'gallons' }],
  ['litre', { factor: 0.264172, suffix: 'gallons' }],
  ['liter', { factor: 0.264172, suffix: 'gallons' }],
]

const CONVERSION_BY_TOKEN = new Map(CONVERSIONS)

/**
 * Phrases the number-plus-unit matcher cannot get right on its own — rates
 * where the metric unit sits in the denominator, so both halves have to move
 * together. Applied before the general pass.
 */
const PHRASE_OVERRIDES: [metric: string, imperial: string][] = [
  ['1.5 litres of fuel per kilometre', '0.64 gallons of fuel per mile'],
]

/**
 * Quantities that stay metric for every reader, because the metric unit *is*
 * the fact — a physical constant or a unit of measure being named. The test
 * suite skips these when it checks for unconverted metric text.
 */
export const IMPERIAL_EXEMPT_PHRASES = [
  // The definition of the kiloton: TNT energy density is always quoted in MJ/kg.
  '4.18 megajoules per kilogram',
]

const NUMBER = String.raw`\d[\d,]*(?:\.\d+)?`
const UNIT_ALTERNATION = CONVERSIONS.map(([token]) =>
  token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
).join('|')

/**
 * A number, or a range of two numbers, followed by whitespace and a metric
 * unit. The unit must end the word (`(?![\w²³])`) so `100 mg` or `5 min` is
 * not read as `m` plus junk.
 */
const QUANTITY = new RegExp(
  String.raw`(${NUMBER})(\s*[–—-]\s*)?(${NUMBER})?\s(${UNIT_ALTERNATION})(?![\w²³/])`,
  'g',
)

function parseNumber(text: string): number {
  return Number(text.replace(/,/g, ''))
}

/** Significant digits in the authored number, so 160 km stays 3-figure precise. */
function significantDigits(text: string): number {
  const digits = text.replace(/[,.]/g, '').replace(/^0+/, '')
  return Math.min(Math.max(digits.length, 2), 3)
}

function roundToSignificant(value: number, digits: number): number {
  if (!Number.isFinite(value) || value === 0) return 0
  const exp = Math.floor(Math.log10(Math.abs(value)))
  const power = 10 ** (digits - 1 - exp)
  return Math.round(value * power) / power
}

function formatNumber(value: number, digits: number): string {
  const rounded = roundToSignificant(value, digits)
  // Enough decimals to show the significant figures we kept — a 0.0001 m²
  // radar cross-section must not round away to "0".
  const decimals = Math.max(
    0,
    Math.min(6, digits - 1 - Math.floor(Math.log10(Math.abs(rounded) || 1))),
  )
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
}

/**
 * Convert every metric quantity in `text` to imperial. Returns `text`
 * unchanged for the metric unit system, so callers can pass it through
 * unconditionally.
 */
export function convertUnitsInText(text: string, units: UnitSystem): string {
  if (units !== 'imperial' || !text) return text

  // Protect the exempt phrases from the general pass, then restore them.
  const exempt: string[] = []
  let out = text
  for (const phrase of IMPERIAL_EXEMPT_PHRASES) {
    if (!out.includes(phrase)) continue
    const token = `@@EXEMPT${exempt.length}@@`
    exempt.push(phrase)
    out = out.split(phrase).join(token)
  }

  for (const [metric, imperial] of PHRASE_OVERRIDES) {
    out = out.split(metric).join(imperial)
  }

  out = out.replace(
    QUANTITY,
    (match, low: string, dash: string | undefined, high: string | undefined, token: string) => {
      const conversion = CONVERSION_BY_TOKEN.get(token)
      if (!conversion) return match

      const digits = significantDigits(low)
      const lowValue = parseNumber(low) * conversion.factor

      // A single human-scale length reads as feet and inches. Ranges stay in
      // decimal feet — "9 ft 10 in–13 ft 1 in" is harder to read than the
      // numbers it replaces.
      if (conversion.suffix === 'ft' && (!dash || !high) && lowValue < 10) {
        if (lowValue < 1) return `${formatNumber(lowValue * 12, digits)} in`
        return formatFeetInches(lowValue)
      }

      const lowOut = formatNumber(lowValue, digits)
      if (!dash || !high) return `${lowOut} ${conversion.suffix}`

      const highOut = formatNumber(
        parseNumber(high) * conversion.factor,
        significantDigits(high),
      )
      return `${lowOut}${dash}${highOut} ${conversion.suffix}`
    },
  )

  exempt.forEach((phrase, index) => {
    out = out.split(`@@EXEMPT${index}@@`).join(phrase)
  })
  return out
}
