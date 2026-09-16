/**
 * Which country built each real thing in the catalog — the flag on its row,
 * its plaque and its poster label, and the reason "USA" or "soviet" finds it.
 *
 * Country of origin, not of service: the Hind is Russian wherever it flies. A
 * few entries carry two flags because two states genuinely share the design
 * (Concorde), and Airbus flies `EU` because no single member state built it.
 *
 * Left out on purpose: fiction, animals, the plain reference objects, and the
 * generic merchant hulls (container ship, super tanker) that fly whatever flag
 * of convenience their owner picked. Oil cubes get their flag from
 * `OIL_RESERVES`, and money stacks are dollars, which the name already says.
 */
import type { CountryCode } from './countries'

export const CATALOG_COUNTRIES: Record<string, CountryCode[]> = {
  // Reference
  'soldier-ww2': ['US'],
  'school-bus': ['US'],

  // Armor and ground
  sherman: ['US'],
  abrams: ['US'],
  chieftain: ['GB'],
  t72: ['RU'],
  patriot: ['US'],
  'c-ram': ['US'],

  // Fighters
  f16: ['US'],
  f22: ['US'],
  f35: ['US'],
  f18: ['US'],
  f15: ['US'],
  f14: ['US'],
  yf23: ['US'],
  f38: ['US'],
  f117: ['US'],
  p51: ['US'],
  p47: ['US'],
  p38: ['US'],
  f6f: ['US'],
  f4u: ['US'],
  spitfire: ['GB'],
  mig23: ['RU'],
  mig35: ['RU'],
  su57: ['RU'],

  // Bombers and recon
  b17: ['US'],
  b25: ['US'],
  b29: ['US'],
  b52: ['US'],
  b1: ['US'],
  b2: ['US'],
  b21: ['US'],
  sr71: ['US'],
  sr72: ['US'],
  xb70: ['US'],
  tu22m3: ['RU'],
  h20: ['CN'],

  // Transports and airlift
  c47: ['US'],
  c5: ['US'],
  c17a: ['US'],
  c18a: ['US'],
  c130j: ['US'],
  v22: ['US'],

  // Helicopters
  apache: ['US'],
  rah66: ['US'],
  chinook: ['US'],
  blackhawk: ['US'],
  'stealth-hawk': ['US'],
  'pave-low': ['US'],
  s97: ['US'],
  'mi-24': ['RU'],
  mi26: ['RU'],
  mi10: ['RU'],

  // Airliners and civil aircraft
  'boeing-737': ['US'],
  'boeing-747': ['US'],
  a320: ['EU'],
  a380: ['EU'],
  concorde: ['GB', 'FR'],
  'wright-flyer': ['US'],
  'da-vinci-ornithopter': ['IT'],
  hindenburg: ['DE'],

  // Warships and submarines
  'ford-carrier': ['US'],
  nimitz: ['US'],
  'essex-cv': ['US'],
  'independence-cvl': ['US'],
  iowa: ['US'],
  'south-dakota': ['US'],
  cleveland: ['US'],
  fletcher: ['US'],
  'arleigh-burke': ['US'],
  zumwalt: ['US'],
  independence: ['US'],
  wasp: ['US'],
  virginia: ['US'],
  ohio: ['US'],
  seawolf: ['US'],
  'los-angeles': ['US'],
  gato: ['US'],
  type45: ['GB'],
  moskva: ['RU'],
  kiev: ['RU'],
  yamato: ['JP'],

  // Munitions
  jdam: ['US'],
  'little-boy': ['US'],
  'fat-man': ['US'],
  'tsar-bomba': ['RU'],
  'v1-flying-bomb': ['DE'],
  'v2-rocket': ['DE'],

  // Spacecraft
  electron: ['US', 'NZ'],
  'falcon-9': ['US'],
  starship: ['US'],
  'new-glenn': ['US'],
  sls: ['US'],
  'saturn-v': ['US'],
  'shuttle-discovery': ['US'],
  'shuttle-atlantis': ['US'],
  'apollo-lm': ['US'],
  hubble: ['US'],
  jwst: ['US'],
  'roman-telescope': ['US'],
  n1: ['RU'],
  'soyuz-rocket': ['RU'],

  // Landmarks
  'statue-liberty': ['US'],
  'washington-monument': ['US'],
  eiffel: ['FR'],
  'big-ben': ['GB'],
  stonehenge: ['GB'],
  colosseum: ['IT'],
  burj: ['AE'],
  'christ-redeemer': ['BR'],
  'sydney-opera-house': ['AU'],
  'great-pyramids': ['EG'],
}

/** Lineups that are one nation's order of battle. */
export const PRESET_COUNTRIES: Record<string, CountryCode[]> = {
  'us-air-power-1945': ['US'],
  'us-navy-1945': ['US'],
  'us-navy-today': ['US'],
  'us-air-force-today': ['US'],
}
