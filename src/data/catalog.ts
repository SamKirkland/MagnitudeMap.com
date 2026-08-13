import { CATALOG_TAGS } from './catalogTags'
import { packMoneyAmount } from './moneyPack'

export type CatalogCategory =
  | 'reference'
  | 'animal'
  | 'vehicle'
  | 'military'
  | 'munition'
  | 'spacecraft'
  | 'fiction'
  | 'landmark'
  | 'money'

export type CatalogShape = 'box' | 'cylinder' | 'person'

/** Cylinder long-axis: rockets stand up; bombs lie flat. */
export type CylinderOrientation = 'vertical' | 'horizontal'

/**
 * Which bounding-box axis to match to real-world meters, after the authoring pose.
 * `footprint` = max(X, Z) — blast spheres / clouds.
 */
export type ScaleAxis = 'length' | 'width' | 'height' | 'max' | 'footprint'

export type CatalogModelRef = {
  /** Path under `public/`, e.g. `models/school-bus/model.glb` (resolved with Vite BASE_URL). */
  path: string
  scaleAxis: ScaleAxis
  /**
   * Authoring yaw in 90° snaps so the GLB matches +Z forward / +X width.
   * Applied on the canonical node before scale. Ignored when `randomYaw` is set.
   * User display yaw is a separate parent transform — do not put it here.
   */
  yawDegrees?: number
  /** Authoring pitch (degrees). Positive tips the nose down toward -Y when authored upright. */
  pitchDegrees?: number
  /** Authoring roll (degrees). Rare; for GLBs that ship on their side. */
  rollDegrees?: number
  /** Randomize yaw on each load (e.g. air-blast fireballs). Applied after scale. */
  randomYaw?: boolean
  /** Prefer a clip whose name matches this regex when the camera focuses the item. */
  clipPrefer?: string
  /**
   * Paint mesh by world-space height after scale (e.g. N1 olive / off-white stages).
   * `split` is the fraction of height from the base where the upper color begins.
   */
  heightPaint?: {
    split: number
    below: string
    above: string
  }
}

/**
 * Place many copies of a unit GLB in a packed grid (money stacks).
 * Footprint length/width/height on the item should match the packed pile.
 */
export type CatalogInstanceGrid = {
  unitPath: string
  unitUsd: number
  targetUsd: number
  unitWidth: number
  unitLength: number
  unitHeight: number
}

/** Real-world size in meters (Babylon 1 unit = 1 meter). */
export type CatalogItem = {
  id: string
  name: string
  category: CatalogCategory
  /** Length along +Z after the authoring pose (nose / forward). */
  length: number
  /** Width along +X after the authoring pose (right / wings). */
  width: number
  /** Height along +Y. */
  height: number
  shape: CatalogShape
  /** Required for cylinders. */
  orientation?: CylinderOrientation
  color: string
  blurb: string
  /** Keywords for library search (Fuse.js). */
  tags: string[]
  /** Optional colored GLB; falls back to stand-in mesh. */
  model?: CatalogModelRef
  /** When set, spawn a packed grid of unit models instead of one scaled mesh. */
  instanceGrid?: CatalogInstanceGrid
  /** Keep imported clips and play one when the camera focuses this item. */
  playClips?: boolean
}

export type ComparisonPreset = {
  id: string
  name: string
  /** Short tooltip / search blurb — not shown on the card. */
  description: string
  tags: string[]
  itemIds: string[]
}

type CatalogSeed = Omit<CatalogItem, 'tags'>

/**
 * ABA / Fed: strap = 100 x $100 = $10k; bundle = 10 straps = $100k.
 * US bill ≈ 156.1 × 66.3 mm; ~1000 notes ≈ 109 mm thick.
 * Sketchfab "Money" cube ≈ 7×3×20 bundles → $42,000,000.
 * Unit is a cube with that cash volume so the atlas stays undistorted
 * (the GLB is authored as a cube; a 7×3×20 slab stretched it onto its side).
 */
const MONEY_BUNDLE_USD = 100_000
const MONEY_BLOCK_BUNDLES = 7 * 3 * 20
export const MONEY_BLOCK_USD = MONEY_BLOCK_BUNDLES * MONEY_BUNDLE_USD // $42M

const MONEY_BUNDLE_VOL_M3 = 0.1561 * 0.0663 * 0.1092
/** Side length of one $42M cube (volume = 420 bundles). */
export const MONEY_UNIT_M = Math.cbrt(MONEY_BLOCK_BUNDLES * MONEY_BUNDLE_VOL_M3)

export const MONEY_BLOCK_WIDTH_M = MONEY_UNIT_M
export const MONEY_BLOCK_LENGTH_M = MONEY_UNIT_M
export const MONEY_BLOCK_HEIGHT_M = MONEY_UNIT_M

const MONEY_UNIT = {
  width: MONEY_BLOCK_WIDTH_M,
  length: MONEY_BLOCK_LENGTH_M,
  height: MONEY_BLOCK_HEIGHT_M,
}

function moneyItem(
  id: string,
  name: string,
  usd: number,
  blurb: string,
): CatalogSeed {
  const pack = packMoneyAmount(usd, MONEY_BLOCK_USD, MONEY_UNIT)
  const blocksLabel =
    pack.fullCount === 0
      ? `one partial $${(MONEY_BLOCK_USD / 1e6).toFixed(0)}M block`
      : pack.fraction > 0
        ? `~${pack.fullCount + 1} × $${(MONEY_BLOCK_USD / 1e6).toFixed(0)}M blocks`
        : `${pack.fullCount.toLocaleString('en-US')} × $${(MONEY_BLOCK_USD / 1e6).toFixed(0)}M blocks`

  return {
    id,
    name,
    category: 'money',
    length: pack.length,
    width: pack.width,
    height: pack.height,
    shape: 'box',
    color: '#1a7a3c',
    blurb: `${blurb} (${blocksLabel}).`,
    model: {
      path: 'models/money/model.glb',
      scaleAxis: 'height',
    },
    instanceGrid: {
      unitPath: 'models/money/model.glb',
      unitUsd: MONEY_BLOCK_USD,
      targetUsd: usd,
      unitWidth: MONEY_BLOCK_WIDTH_M,
      unitLength: MONEY_BLOCK_LENGTH_M,
      unitHeight: MONEY_BLOCK_HEIGHT_M,
    },
  }
}

const CATALOG_SEED: CatalogSeed[] = [
  {
    id: 'person-male',
    name: 'Adult (male)',
    category: 'reference',
    length: 0.55,
    width: 0.55,
    height: 1.75,
    shape: 'person',
    color: '#c4a484',
    blurb: 'Ready Player Me male avatar (~1.75 m). Rigged; waves occasionally.',
    model: {
      path: 'models/person-male/model.glb',
      scaleAxis: 'height',
      yawDegrees: 180,
    },
  },
  {
    id: 'person-female',
    name: 'Adult (female)',
    category: 'reference',
    length: 0.5,
    width: 0.5,
    height: 1.65,
    shape: 'person',
    color: '#c4a484',
    blurb: 'Ready Player Me female avatar (~1.65 m). Rigged; waves occasionally.',
    model: {
      path: 'models/person-female/model.glb',
      scaleAxis: 'height',
      yawDegrees: 180,
    },
  },
  {
    id: 'minecraft-player',
    name: 'Minecraft player',
    category: 'reference',
    length: 0.6,
    width: 0.6,
    height: 1.8,
    shape: 'person',
    color: '#8fbc8f',
    blurb: 'The Perfect Steve (~1.8 m). Blender3D CC-BY on Sketchfab; rigged with a clip + occasional wave.',
    model: {
      path: 'models/minecraft-player/model.glb',
      scaleAxis: 'height',
      yawDegrees: 180,
    },
  },
  {
    id: 'soldier-ww2',
    name: 'WW2 US Soldier',
    category: 'reference',
    length: 0.6,
    width: 0.6,
    height: 1.75,
    shape: 'person',
    color: '#5c6b4a',
    blurb: 'WW2 US Army Ranger (~1.75 m).',
    model: {
      path: 'models/soldier-ww2/model.glb',
      scaleAxis: 'height',
      yawDegrees: 180,
    },
  },
  {
    id: 'iphone',
    name: 'iPhone',
    category: 'reference',
    length: 0.072,
    width: 0.008,
    height: 0.147,
    shape: 'box',
    color: '#1c1c1e',
    blurb: 'Phone-sized (~147 mm). Rescue3D CC-BY on Sketchfab.',
    model: {
      path: 'models/iphone/model.glb',
      scaleAxis: 'height',
    },
  },
  {
    id: 'astronaut',
    name: 'Astronaut',
    category: 'reference',
    length: 0.7,
    width: 0.7,
    height: 1.9,
    shape: 'person',
    color: '#dfe7ef',
    blurb: 'Kenney space-kit astronaut scaled to 1.9 m.',
    model: {
      path: 'models/astronaut/model.glb',
      scaleAxis: 'height',
      yawDegrees: 180,
    },
  },
  {
    id: 'firetruck',
    name: 'Fire truck',
    category: 'vehicle',
    length: 12.0,
    width: 2.5,
    height: 3.8,
    shape: 'box',
    color: '#b91c1c',
    blurb: 'Ladder fire truck (~12 m).',
    model: {
      path: 'models/firetruck/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'school-bus',
    name: 'School bus',
    category: 'vehicle',
    length: 12.0,
    width: 2.5,
    height: 3.2,
    shape: 'box',
    color: '#d4a017',
    blurb: 'Full-size school bus (~12 m).',
    model: {
      path: 'models/school-bus/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'container-20',
    name: '40ft shipping container',
    category: 'reference',
    length: 12.19,
    width: 2.44,
    height: 2.59,
    shape: 'box',
    color: '#8b5a2b',
    blurb: 'Standard ISO 40-foot container.',
    model: {
      path: 'models/container-20/model.glb',
      scaleAxis: 'length',
      yawDegrees: 90,
    },
  },
  {
    id: 'ak47',
    name: 'Rifle (stylized)',
    category: 'military',
    length: 0.88,
    width: 0.08,
    height: 0.28,
    shape: 'box',
    color: '#4a5560',
    blurb: 'Kenney space-kit rifle stand-in scaled to 0.88 m long.',
    model: {
      path: 'models/rifle/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'sherman',
    name: 'M4 Sherman',
    category: 'military',
    length: 5.89,
    width: 2.62,
    height: 2.74,
    shape: 'box',
    color: '#6b7355',
    blurb: 'WWII M4 Sherman (~5.9 m long).',
    model: {
      path: 'models/sherman/model.glb',
      scaleAxis: 'length',
      yawDegrees: 0,
    },
  },
  {
    id: 'abrams',
    name: 'M1A2 Abrams',
    category: 'military',
    length: 9.77,
    width: 3.66,
    height: 2.44,
    shape: 'box',
    color: '#5c6b4a',
    blurb: 'M1A2 Abrams main battle tank (~9.8 m long).',
    model: {
      path: 'models/abrams/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'chieftain',
    name: 'Chieftain Mk 5',
    category: 'military',
    length: 10.77,
    width: 3.51,
    height: 2.9,
    shape: 'box',
    color: '#4a5538',
    blurb: 'Chieftain Mk 5 main battle tank (~10.8 m long).',
    model: {
      path: 'models/chieftain/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 't72',
    name: 'T-72B3',
    category: 'military',
    length: 9.53,
    width: 3.46,
    height: 2.23,
    shape: 'box',
    color: '#4b5538',
    blurb: 'T-72B3 main battle tank (~9.5 m long).',
    model: {
      path: 'models/t72/model.glb',
      scaleAxis: 'length',
      yawDegrees: 0,
    },
  },
  {
    id: 'patriot',
    name: 'MIM-104 Patriot',
    category: 'military',
    length: 10.4,
    width: 2.8,
    height: 4.5,
    shape: 'box',
    color: '#6b7280',
    blurb: 'Patriot air-defense launcher (~10.4 m long).',
    model: {
      path: 'models/patriot/model.glb',
      scaleAxis: 'length',
      yawDegrees: 270,
    },
  },
  {
    id: 'c-ram',
    name: 'Centurion C-RAM',
    category: 'military',
    length: 3.1,
    width: 3.1,
    height: 4.26,
    shape: 'box',
    color: '#6b7280',
    blurb: 'Land Phalanx / Centurion C-RAM (~4.3 m tall).',
    model: {
      path: 'models/c-ram/model.glb',
      scaleAxis: 'height',
      yawDegrees: 0,
    },
  },
  {
    id: 'f16',
    name: 'F-16C Falcon',
    category: 'military',
    length: 15.06,
    width: 9.96,
    height: 4.88,
    shape: 'box',
    color: '#7a8794',
    blurb: 'F-16C Fighting Falcon (~15.1 m long).',
    model: {
      path: 'models/f16/model.glb',
      scaleAxis: 'length',
      // Native nose is already -Z (cockpit); 0° keeps length on +Z.
      yawDegrees: 0,
    },
  },
  {
    id: 'f22',
    name: 'F-22 Raptor',
    category: 'military',
    length: 18.92,
    width: 13.56,
    height: 5.08,
    shape: 'box',
    color: '#8b95a1',
    blurb: 'F-22 Raptor (~18.9 m long).',
    model: {
      path: 'models/f22/model.glb',
      scaleAxis: 'length',
      // Native length on X (exhaust +X). 90° puts length on +Z, matching F-16 facing.
      yawDegrees: 90,
    },
  },
  {
    id: 'f35',
    name: 'F-35B Lightning II',
    category: 'military',
    length: 15.61,
    width: 10.7,
    height: 4.33,
    shape: 'box',
    color: '#6e7884',
    blurb: 'F-35B Lightning II (~15.6 m long).',
    model: {
      path: 'models/f35/model.glb',
      scaleAxis: 'length',
      // Native length on X (nose gear +X). 270° puts length on +Z, matching F-16 facing.
      yawDegrees: 270,
    },
  },
  {
    id: 'f117',
    name: 'F-117A Nighthawk',
    category: 'military',
    length: 20.09,
    width: 13.2,
    height: 3.78,
    shape: 'box',
    color: '#111827',
    blurb: 'F-117A Nighthawk stealth attack aircraft (~20.1 m long).',
    model: {
      path: 'models/f117/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'b21',
    name: 'B-21 Raider',
    category: 'military',
    length: 16.5,
    width: 45,
    height: 5.5,
    shape: 'box',
    color: '#c8cdd2',
    blurb: 'B-21 Raider (~45 m wingspan est.; dimensions still classified).',
    model: {
      path: 'models/b21/model.glb',
      scaleAxis: 'width',
      yawDegrees: 180,
    },
  },
  {
    id: 'b2',
    name: 'B-2 Spirit',
    category: 'military',
    length: 20.9,
    width: 52.4,
    height: 5.18,
    shape: 'box',
    color: '#1f2933',
    blurb: 'B-2 Spirit stealth bomber (~52.4 m wingspan).',
    model: {
      path: 'models/b2/model.glb',
      scaleAxis: 'width',
      // Native nose is -X; 270° puts nose toward the plaque (-Z).
      yawDegrees: 270,
    },
  },
  {
    id: 'b1',
    name: 'B-1B Lancer',
    category: 'military',
    length: 44.5,
    width: 41.8,
    height: 10.4,
    shape: 'box',
    color: '#6b7280',
    blurb: 'B-1B Lancer (~44.5 m long, wings swept out).',
    model: {
      path: 'models/b1/model.glb',
      scaleAxis: 'length',
      // Native nose is -Z; 0° already points at the plaque.
      yawDegrees: 0,
    },
  },
  {
    id: 'tu22m3',
    name: 'Tu-22M3 Backfire',
    category: 'military',
    length: 42.46,
    width: 34.28,
    height: 11.05,
    shape: 'box',
    color: '#475569',
    blurb: 'Tupolev Tu-22M3 (~42.5 m long, wings spread).',
    model: {
      path: 'models/tu22m3/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'a320',
    name: 'Airbus A320',
    category: 'vehicle',
    length: 37.57,
    width: 35.8,
    height: 11.76,
    shape: 'box',
    color: '#94a3b8',
    blurb: 'Airbus A320 narrow-body airliner (~37.6 m long).',
    model: {
      path: 'models/a320/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'boeing-737',
    name: 'Boeing 737-800',
    category: 'vehicle',
    length: 39.47,
    width: 35.79,
    height: 12.55,
    shape: 'box',
    color: '#64748b',
    blurb: 'Boeing 737-800 (~39.5 m long).',
    model: {
      path: 'models/boeing-737/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'boeing-747',
    name: 'Boeing 747 (VC-25)',
    category: 'vehicle',
    length: 70.66,
    width: 59.64,
    height: 19.33,
    shape: 'box',
    color: '#1e3a5f',
    blurb: 'VC-25 Air Force One / 747 (~70.7 m long).',
    model: {
      path: 'models/boeing-747/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'v22',
    name: 'V-22 Osprey',
    category: 'military',
    length: 17.5,
    width: 25.8,
    height: 6.73,
    shape: 'box',
    color: '#4b5563',
    blurb: 'Bell Boeing V-22 Osprey tiltrotor (~17.5 m long).',
    model: {
      path: 'models/v22/model.glb',
      scaleAxis: 'length',
      yawDegrees: 0,
    },
  },
  {
    id: 'apache',
    name: 'AH-64D Apache',
    category: 'military',
    length: 17.73,
    width: 14.63,
    height: 4.64,
    shape: 'box',
    color: '#3f4a3a',
    blurb: 'AH-64D Apache attack helicopter (~17.7 m long).',
    model: {
      path: 'models/apache/model.glb',
      scaleAxis: 'length',
      // Native length on X (cockpit +X). 270° puts length on +Z, matching Black Hawk facing.
      yawDegrees: 270,
    },
  },
  {
    id: 'chinook',
    name: 'CH-47 Chinook',
    category: 'military',
    length: 30.1,
    width: 18.3,
    height: 5.7,
    shape: 'box',
    color: '#4a5540',
    blurb: 'CH-47 Chinook (~30.1 m rotor tip-to-tip).',
    model: {
      path: 'models/chinook/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'c18a',
    name: 'C-18A Skylord',
    category: 'military',
    length: 53,
    width: 51.75,
    height: 16.79,
    shape: 'box',
    color: '#6b7280',
    blurb: 'C-18A Skylord concept (~C-17 size, ~53 m long).',
    model: {
      path: 'models/c18a/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'blackhawk',
    name: 'UH-60M Black Hawk',
    category: 'military',
    length: 19.76,
    width: 16.36,
    height: 5.13,
    shape: 'box',
    color: '#3f4738',
    blurb: 'UH-60M Black Hawk (~19.8 m long).',
    model: {
      path: 'models/blackhawk/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'tnt',
    name: 'TNT block',
    category: 'munition',
    length: 1,
    width: 1,
    height: 1,
    shape: 'box',
    color: '#b91c1c',
    blurb: 'Minecraft-style TNT block (~1 m cube).',
    model: {
      path: 'models/tnt/model.glb',
      scaleAxis: 'height',
    },
  },
  {
    id: 'jdam',
    name: 'GBU-31 JDAM',
    category: 'munition',
    length: 3.88,
    width: 0.65,
    height: 0.65,
    shape: 'cylinder',
    orientation: 'horizontal',
    color: '#4b5563',
    blurb: 'GBU-31 JDAM (Mk 84, ~3.9 m long).',
    model: {
      path: 'models/jdam/model.glb',
      scaleAxis: 'length',
      yawDegrees: 270,
    },
  },
  {
    id: 'little-boy',
    name: 'Little Boy',
    category: 'munition',
    length: 3.0,
    width: 0.71,
    height: 0.71,
    shape: 'cylinder',
    orientation: 'horizontal',
    color: '#6b7280',
    blurb: 'Hiroshima bomb casing (~3 m long).',
    model: {
      path: 'models/little-boy/model.glb',
      scaleAxis: 'length',
      yawDegrees: 90,
    },
  },
  {
    id: 'fat-man',
    name: 'Fat Man',
    category: 'munition',
    length: 3.25,
    width: 1.52,
    height: 1.52,
    shape: 'cylinder',
    orientation: 'horizontal',
    color: '#57534e',
    blurb: 'Nagasaki bomb casing (~3.3 m long, 1.5 m diameter).',
    model: {
      path: 'models/fat-man/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'tsar-bomba',
    name: 'Tsar Bomba',
    category: 'munition',
    length: 8.0,
    width: 2.1,
    height: 2.1,
    shape: 'cylinder',
    orientation: 'horizontal',
    color: '#9a3412',
    blurb: 'Largest tested nuke — casing ~8×2.1 m.',
    model: {
      path: 'models/tsar-bomba/model.glb',
      scaleAxis: 'length',
      yawDegrees: 90,
    },
  },
  {
    id: 'spaceship',
    name: 'Cargo craft',
    category: 'spacecraft',
    length: 18,
    width: 10,
    height: 6,
    shape: 'box',
    color: '#94a3b8',
    blurb: 'Kenney space-kit cargo craft scaled to 18 m long.',
    model: {
      path: 'models/spaceship/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'electron',
    name: 'Electron',
    category: 'spacecraft',
    length: 1.2,
    width: 1.2,
    height: 18.0,
    shape: 'cylinder',
    orientation: 'vertical',
    color: '#1c2430',
    blurb: 'Rocket Lab small-lift vehicle (~18 m).',
    model: {
      path: 'models/electron/model.glb',
      scaleAxis: 'height',
    },
  },
  {
    id: 'falcon-9',
    name: 'Falcon 9',
    category: 'spacecraft',
    length: 3.7,
    width: 3.7,
    height: 70,
    shape: 'cylinder',
    orientation: 'vertical',
    color: '#e8e6e1',
    blurb: 'SpaceX Falcon 9 Block 5 (~70 m).',
    model: {
      path: 'models/falcon-9/model.glb',
      scaleAxis: 'height',
    },
  },
  {
    id: 'soyuz-2',
    name: 'Soyuz-2',
    category: 'spacecraft',
    length: 10.3,
    width: 10.3,
    height: 46.1,
    shape: 'cylinder',
    orientation: 'vertical',
    color: '#f59e0b',
    blurb: 'Russian Soyuz with strap-on boosters (~46 m). Soyuz-FG mesh stand-in.',
    model: {
      path: 'models/soyuz-2/model.glb',
      scaleAxis: 'height',
    },
  },
  {
    id: 'new-glenn',
    name: 'New Glenn',
    category: 'spacecraft',
    length: 7.0,
    width: 7.0,
    height: 98,
    shape: 'cylinder',
    orientation: 'vertical',
    color: '#e2e8f0',
    blurb: 'Blue Origin heavy-lift (~98 m, 7 m diameter).',
    model: {
      path: 'models/new-glenn/model.glb',
      scaleAxis: 'height',
    },
  },
  {
    id: 'sls',
    name: 'SLS Block 1',
    category: 'spacecraft',
    length: 8.4,
    width: 8.4,
    height: 98,
    shape: 'cylinder',
    orientation: 'vertical',
    color: '#f8fafc',
    blurb: 'NASA Space Launch System / Artemis II (~98 m).',
    model: {
      path: 'models/sls/model.glb',
      scaleAxis: 'height',
    },
  },
  {
    id: 'saturn-v',
    name: 'Saturn V',
    category: 'spacecraft',
    length: 10.1,
    width: 10.1,
    height: 110.6,
    shape: 'cylinder',
    orientation: 'vertical',
    color: '#f5f0e6',
    blurb: 'Apollo moon rocket (~111 m). BoldlyBuilding CC-BY on Sketchfab.',
    model: {
      path: 'models/saturn-v/model.glb',
      scaleAxis: 'height',
    },
  },
  {
    id: 'n1',
    name: 'N1',
    category: 'spacecraft',
    length: 17,
    width: 17,
    height: 105.3,
    shape: 'cylinder',
    orientation: 'vertical',
    color: '#3f5228',
    blurb: 'Soviet N1 moon rocket (~105 m). Olive lower stages, off-white upper.',
    model: {
      path: 'models/n1/model.glb',
      scaleAxis: 'height',
      // Historical Baikonur scheme: olive Blocks A–V, off-white Block G + fairing.
      heightPaint: {
        // Stage-3 taper neck → upper-stage flare (~59% up the stack).
        split: 0.59,
        below: '#3f5228',
        above: '#f0ebe3',
      },
    },
  },
  {
    id: 'starship',
    name: 'Starship (full stack)',
    category: 'spacecraft',
    length: 9.0,
    width: 9.0,
    height: 121,
    shape: 'cylinder',
    orientation: 'vertical',
    color: '#cbd5e1',
    blurb:
      'SpaceX Super Heavy + Starship (~121 m). Clarence365 CC-BY on Sketchfab (Ship S25 & Booster 9).',
    model: {
      path: 'models/starship/model.glb',
      scaleAxis: 'height',
    },
  },
  {
    id: 'statue-liberty',
    name: 'Statue of Liberty',
    category: 'landmark',
    length: 17,
    width: 17,
    height: 93,
    shape: 'cylinder',
    orientation: 'vertical',
    color: '#3f8f7a',
    blurb: 'Torch height ~93 m. Gravity Jack CC-BY on Sketchfab.',
    model: {
      path: 'models/statue-liberty/model.glb',
      scaleAxis: 'height',
    },
  },
  {
    id: 'eiffel',
    name: 'Eiffel Tower',
    category: 'landmark',
    length: 125,
    width: 125,
    height: 330,
    shape: 'box',
    color: '#b45309',
    blurb: 'Paris landmark (~330 m to tip).',
    model: {
      path: 'models/eiffel/model.glb',
      scaleAxis: 'height',
    },
  },
  {
    id: 'big-ben',
    name: 'Big Ben',
    category: 'landmark',
    length: 17,
    width: 17,
    height: 96,
    shape: 'box',
    color: '#c4a574',
    blurb: 'Elizabeth Tower, London (~96 m).',
    model: {
      path: 'models/big-ben/model.glb',
      scaleAxis: 'height',
    },
  },
  {
    id: 'colosseum',
    name: 'Colosseum',
    category: 'landmark',
    length: 189,
    width: 158,
    height: 48,
    shape: 'box',
    color: '#c4a882',
    blurb: 'Flavian Amphitheatre, Rome (~189 × 156 m, ~48 m high).',
    model: {
      path: 'models/colosseum/model.glb',
      scaleAxis: 'length',
    },
  },
  {
    id: 'washington-monument',
    name: 'Washington Monument',
    category: 'landmark',
    length: 53,
    width: 53,
    height: 169.3,
    shape: 'box',
    color: '#e8e0d0',
    blurb: 'Obelisk on the National Mall (~169 m).',
    model: {
      path: 'models/washington-monument/model.glb',
      scaleAxis: 'height',
    },
  },
  {
    id: 'burj',
    name: 'Burj Khalifa',
    category: 'landmark',
    length: 163,
    width: 142,
    height: 828,
    shape: 'box',
    color: '#64748b',
    blurb: 'World’s tallest building (~828 m).',
    model: {
      path: 'models/burj/model.glb',
      scaleAxis: 'height',
    },
  },
  {
    id: 'stonehenge',
    name: 'Stonehenge',
    category: 'landmark',
    length: 50,
    width: 50,
    height: 7.2,
    shape: 'box',
    color: '#8a8478',
    blurb: 'Sarsen circle on the plateau (~50 m across, ~7.2 m lintel height).',
    model: {
      path: 'models/stonehenge/model.glb',
      scaleAxis: 'height',
    },
  },
  {
    id: 'sydney-opera-house',
    name: 'Sydney Opera House',
    category: 'landmark',
    length: 183,
    width: 177,
    height: 67,
    shape: 'box',
    color: '#f5f0e8',
    blurb: 'Bennelong Point shells (~183 m long, ~67 m high).',
    model: {
      path: 'models/sydney-opera-house/model.glb',
      scaleAxis: 'length',
    },
  },
  {
    id: 'golden-gate',
    name: 'Golden Gate Bridge',
    category: 'landmark',
    length: 1966,
    width: 27,
    height: 227,
    shape: 'box',
    color: '#c4481b',
    blurb: 'San Francisco suspension span (~1,966 m anchorage to anchorage, 227 m towers).',
    model: {
      path: 'models/golden-gate/model.glb',
      scaleAxis: 'length',
    },
  },
  {
    id: 'great-pyramids',
    name: 'Great Pyramid of Giza',
    category: 'landmark',
    length: 230.3,
    width: 230.3,
    height: 138.5,
    shape: 'box',
    color: '#d4b483',
    blurb: 'Khufu / Cheops (~230 m base, 138.5 m current height).',
    model: {
      path: 'models/great-pyramids/model.glb',
      scaleAxis: 'height',
      // Longer base edge is native +X; 90° puts length on +Z.
      yawDegrees: 90,
    },
  },
  {
    id: 'ford-carrier',
    name: 'Ford-class carrier',
    category: 'military',
    length: 337,
    width: 78,
    height: 41,
    shape: 'box',
    color: '#64748b',
    blurb: 'Gerald R. Ford–class aircraft carrier (~337 m long).',
    model: {
      path: 'models/ford-carrier/model.glb',
      scaleAxis: 'length',
      yawDegrees: 0,
    },
  },
  {
    id: 'cvn-65',
    name: 'Enterprise-class carrier',
    category: 'military',
    length: 342,
    width: 78.4,
    height: 41,
    shape: 'box',
    color: '#57534e',
    blurb: 'Enterprise-class aircraft carrier (~342 m long).',
    model: {
      path: 'models/cvn-65/model.glb',
      scaleAxis: 'length',
      // Native length on X. 270° puts length on +Z, facing right.
      yawDegrees: 270,
    },
  },
  {
    id: 'nimitz',
    name: 'Nimitz-class carrier',
    category: 'military',
    length: 332.8,
    width: 76.8,
    height: 41,
    shape: 'box',
    color: '#52525b',
    blurb: 'Nimitz-class aircraft carrier (~333 m long).',
    model: {
      path: 'models/nimitz/model.glb',
      scaleAxis: 'length',
      // Native length on X (island aft of +X bow). 270° puts length on +Z, matching Enterprise facing.
      yawDegrees: 270,
    },
  },
  {
    id: 'virginia',
    name: 'Virginia-class submarine',
    category: 'military',
    length: 115,
    width: 10.4,
    height: 10.5,
    shape: 'box',
    color: '#1e293b',
    blurb: 'Virginia-class nuclear attack submarine (~115 m long).',
    model: {
      path: 'models/virginia/model.glb',
      scaleAxis: 'length',
      // Native length on X (sail toward +X). 270° puts length on +Z, matching Enterprise facing.
      yawDegrees: 270,
    },
  },
  {
    id: 'ohio',
    name: 'Ohio-class submarine',
    category: 'military',
    length: 170.7,
    width: 12.8,
    height: 18,
    shape: 'box',
    color: '#0f172a',
    blurb: 'Ohio-class nuclear ballistic missile submarine (~171 m long).',
    model: {
      path: 'models/ohio/model.glb',
      scaleAxis: 'length',
      yawDegrees: 0,
    },
  },
  {
    id: 'independence',
    name: 'Independence-class LCS',
    category: 'military',
    length: 127.4,
    width: 31.6,
    height: 13,
    shape: 'box',
    color: '#64748b',
    blurb: 'Independence-class littoral combat ship (~127 m long).',
    model: {
      path: 'models/independence/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'type45',
    name: 'Type 45 destroyer',
    category: 'military',
    length: 152.4,
    width: 21.2,
    height: 21,
    shape: 'box',
    color: '#475569',
    blurb: 'Royal Navy Type 45 destroyer (~152 m long).',
    model: {
      path: 'models/type45/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'zumwalt',
    name: 'Zumwalt-class destroyer',
    category: 'military',
    length: 186,
    width: 24.6,
    height: 41,
    shape: 'box',
    color: '#3f3f46',
    blurb: 'Zumwalt-class guided-missile destroyer (~186 m long).',
    model: {
      path: 'models/zumwalt/model.glb',
      scaleAxis: 'length',
      // Sketchfab root matrix lays length on +Z, keel down. 180° puts bow with the other ships.
      yawDegrees: 180,
    },
  },
  {
    id: 'moskva',
    name: 'Moskva-class carrier',
    category: 'military',
    length: 189,
    width: 34,
    height: 25,
    shape: 'box',
    color: '#334155',
    blurb: 'Moskva-class helicopter carrier (~189 m long).',
    model: {
      path: 'models/moskva/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'wasp',
    name: 'Wasp-class assault ship',
    category: 'military',
    length: 257,
    width: 42,
    height: 30,
    shape: 'box',
    color: '#64748b',
    blurb: 'Wasp-class amphibious assault ship (~257 m long).',
    model: {
      path: 'models/wasp/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'kiev',
    name: 'Kiev-class carrier',
    category: 'military',
    length: 273,
    width: 49.2,
    height: 35,
    shape: 'box',
    color: '#57534e',
    blurb: 'Kiev-class aircraft carrier (~273 m long).',
    model: {
      path: 'models/kiev/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'tealc',
    name: "Teal'c",
    category: 'fiction',
    length: 0.6,
    width: 0.6,
    height: 1.96,
    shape: 'person',
    color: '#4a5560',
    blurb: "Jaffa warrior (~1.96 m). Fan estimate from actor height.",
    model: {
      path: 'models/tealc/model.glb',
      scaleAxis: 'height',
      yawDegrees: 180,
    },
  },
  {
    id: 'puddle-jumper',
    name: 'Puddle Jumper',
    category: 'fiction',
    length: 9,
    width: 4,
    height: 3,
    shape: 'box',
    color: '#64748b',
    blurb: 'Ancient gateship (~9 m). Fan-scale estimate.',
    model: {
      path: 'models/puddle-jumper/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'alkesh',
    name: "Al'kesh",
    category: 'fiction',
    length: 45,
    width: 35,
    height: 15,
    shape: 'box',
    color: '#57534e',
    blurb: "Goa'uld mid-range bomber (~45 m). Fan-scale estimate.",
    model: {
      path: 'models/alkesh/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'daedalus',
    name: 'Daedalus (BC-304)',
    category: 'fiction',
    length: 536,
    width: 180,
    height: 80,
    shape: 'box',
    color: '#94a3b8',
    blurb: 'Earth battlecruiser (~536 m). Common fan-scale estimate.',
    model: {
      path: 'models/daedalus/model.glb',
      scaleAxis: 'length',
      // Native length on X (engines toward -X). 270° puts length on +Z, facing right.
      yawDegrees: 270,
    },
  },
  {
    id: 'wraith-cruiser',
    name: 'Wraith Cruiser',
    category: 'fiction',
    length: 3200,
    width: 800,
    height: 600,
    shape: 'box',
    color: '#3f3f46',
    blurb: 'Wraith hive-escort cruiser (~3.2 km). Fan-scale estimate.',
    model: {
      path: 'models/wraith-cruiser/model.glb',
      scaleAxis: 'length',
      yawDegrees: 180,
    },
  },
  {
    id: 'atlantis',
    name: 'Atlantis',
    category: 'fiction',
    length: 3000,
    width: 3000,
    height: 500,
    shape: 'box',
    color: '#0e7490',
    blurb: 'Ancient city-ship (~3 km span). Fan-scale estimate.',
    model: {
      path: 'models/atlantis/model.glb',
      scaleAxis: 'max',
    },
  },
  {
    id: 'rabbit',
    name: 'Rabbit',
    category: 'animal',
    length: 0.4,
    width: 0.18,
    height: 0.3,
    shape: 'box',
    color: '#d6c3a8',
    blurb: 'European rabbit (~40 cm). Hops when focused.',
    playClips: true,
    model: {
      path: 'models/rabbit/model.glb',
      scaleAxis: 'length',
      clipPrefer: 'hop|run|jump|idle',
    },
  },
  {
    id: 'owl',
    name: 'Owl',
    category: 'animal',
    length: 0.55,
    width: 0.4,
    height: 0.45,
    shape: 'box',
    color: '#8b6914',
    blurb: 'Great horned owl (~55 cm). Flies when focused.',
    playClips: true,
    model: {
      path: 'models/owl/model.glb',
      scaleAxis: 'length',
      clipPrefer: 'fly|Take',
    },
  },
  {
    id: 'wolf',
    name: 'Wolf',
    category: 'animal',
    length: 1.4,
    width: 0.4,
    height: 0.8,
    shape: 'box',
    color: '#6b7280',
    blurb: 'Gray wolf (~1.4 m). Animates when focused.',
    playClips: true,
    model: {
      path: 'models/wolf/model.glb',
      scaleAxis: 'length',
      clipPrefer: 'walk|run|howl|idle',
    },
  },
  {
    id: 'leopard',
    name: 'Leopard',
    category: 'animal',
    length: 1.5,
    width: 0.5,
    height: 0.7,
    shape: 'box',
    color: '#c2782a',
    blurb: 'African leopard (~1.5 m). Runs when focused.',
    playClips: true,
    model: {
      path: 'models/leopard/model.glb',
      scaleAxis: 'length',
      yawDegrees: -90,
      clipPrefer: 'run',
    },
  },
  {
    id: 'eagle',
    name: 'Bald eagle',
    category: 'animal',
    length: 0.9,
    width: 2.3,
    height: 0.4,
    shape: 'box',
    color: '#92400e',
    blurb: 'Bald eagle (~2.3 m wingspan). Flies when focused.',
    playClips: true,
    model: {
      path: 'models/eagle/model.glb',
      scaleAxis: 'width',
      clipPrefer: 'fly|fast',
    },
  },
  {
    id: 'horse',
    name: 'Draft horse',
    category: 'animal',
    length: 2.6,
    width: 0.7,
    height: 1.73,
    shape: 'box',
    color: '#7c4a1a',
    blurb: 'Draft horse (~1.73 m at the withers). Walks when focused.',
    playClips: true,
    model: {
      path: 'models/horse/model.glb',
      scaleAxis: 'height',
      clipPrefer: 'walk|run',
    },
  },
  {
    id: 'rhino',
    name: 'White rhinoceros',
    category: 'animal',
    length: 3.8,
    width: 1.5,
    height: 1.7,
    shape: 'box',
    color: '#9ca3af',
    blurb: 'White rhinoceros (~3.8 m). Walks when focused.',
    playClips: true,
    model: {
      path: 'models/rhino/model.glb',
      scaleAxis: 'length',
      yawDegrees: -90,
      clipPrefer: 'walk',
    },
  },
  {
    id: 'anaconda',
    name: 'Green anaconda',
    category: 'animal',
    length: 5.5,
    width: 0.3,
    height: 0.3,
    shape: 'box',
    color: '#3f6212',
    blurb: 'Green anaconda (~5.5 m). Animates when focused.',
    playClips: true,
    model: {
      path: 'models/anaconda/model.glb',
      scaleAxis: 'length',
      clipPrefer: 'idle|attack|walk',
    },
  },
  {
    id: 'elephant',
    name: 'African elephant',
    category: 'animal',
    length: 6.5,
    width: 2.5,
    height: 3.2,
    shape: 'box',
    color: '#6b7280',
    blurb: 'African bush elephant (~3.2 m at the shoulder). Idles when focused.',
    playClips: true,
    model: {
      path: 'models/elephant/model.glb',
      scaleAxis: 'height',
      yawDegrees: -90,
      clipPrefer: 'idle|walk',
    },
  },
  {
    id: 'ankylosaurus',
    name: 'Ankylosaurus',
    category: 'animal',
    length: 7.5,
    width: 2.0,
    height: 1.7,
    shape: 'box',
    color: '#57534e',
    blurb: 'Ankylosaurus (~7.5 m). Animates when focused.',
    playClips: true,
    model: {
      path: 'models/ankylosaurus/model.glb',
      scaleAxis: 'length',
      clipPrefer: 'walk|idle|run',
    },
  },
  {
    id: 'carnotaurus',
    name: 'Carnotaurus',
    category: 'animal',
    length: 8.0,
    width: 1.5,
    height: 3.0,
    shape: 'box',
    color: '#9a3412',
    blurb: 'Carnotaurus (~8 m). Animates when focused.',
    playClips: true,
    model: {
      path: 'models/carnotaurus/model.glb',
      scaleAxis: 'length',
      clipPrefer: '^idle$',
    },
  },
  {
    id: 'giganotosaurus',
    name: 'Giganotosaurus',
    category: 'animal',
    length: 12.5,
    width: 2.0,
    height: 4.0,
    shape: 'box',
    color: '#44403c',
    blurb: 'Giganotosaurus (~12.5 m). Walks when focused.',
    playClips: true,
    model: {
      path: 'models/giganotosaurus/model.glb',
      scaleAxis: 'length',
      clipPrefer: 'walk|run|idle',
    },
  },
  {
    id: 'spinosaurus',
    name: 'Spinosaurus',
    category: 'animal',
    length: 14.0,
    width: 2.2,
    height: 4.6,
    shape: 'box',
    color: '#1e3a5f',
    blurb: 'Spinosaurus (~14 m). Walks when focused.',
    playClips: true,
    model: {
      path: 'models/spinosaurus/model.glb',
      scaleAxis: 'length',
      clipPrefer: 'walk|idle',
    },
  },
  moneyItem(
    'money-1m',
    '$1 million',
    1_000_000,
    'Packed $100-bill cubes. Unit cube ≈ 7×3×20 × $100k bundles ($42M)',
  ),
  moneyItem(
    'money-100m',
    '$100 million',
    100_000_000,
    'Packed $100-bill cubes from $42M unit blocks',
  ),
  moneyItem(
    'money-1b',
    '$1 billion',
    1_000_000_000,
    'Packed $100-bill cubes from $42M unit blocks',
  ),
  moneyItem(
    'money-100b',
    '$100 billion',
    100_000_000_000,
    'Packed $100-bill cubes from $42M unit blocks',
  ),
  moneyItem(
    'money-1t',
    '$1 trillion',
    1_000_000_000_000,
    'Packed $100-bill cubes from $42M unit blocks',
  ),
  moneyItem(
    'money-us-debt',
    'US national debt',
    39_890_000_000_000,
    'Packed $100-bill cubes for ~$39.89T (Treasury, ~Aug 6 2026)',
  ),
]

export const CATALOG: CatalogItem[] = CATALOG_SEED.map((item) => ({
  ...item,
  tags: CATALOG_TAGS[item.id] ?? [item.category],
}))

export const CATALOG_BY_ID = Object.fromEntries(
  CATALOG.map((item) => [item.id, item]),
) as Record<string, CatalogItem>

export const COMPARISON_PRESETS: ComparisonPreset[] = [
  {
    id: 'street',
    name: 'Street scale',
    description: 'Trucks, tanks, and air defense.',
    tags: ['street', 'trucks', 'vehicles', 'tanks', 'everyday', 'city'],
    itemIds: [
      'person-male',
      'person-female',
      'minecraft-player',
      'soldier-ww2',
      'firetruck',
      'school-bus',
      'container-20',
      'sherman',
      'abrams',
      'chieftain',
      't72',
      'patriot',
      'c-ram',
    ],
  },
  {
    id: 'nukes',
    name: 'Bomb sizes',
    description: 'TNT, JDAM, Little Boy, Fat Man, Tsar Bomba.',
    tags: ['bombs', 'nukes', 'nuclear', 'munition', 'tnt', 'jdam', 'little boy', 'fat man', 'tsar'],
    itemIds: ['person-male', 'tnt', 'jdam', 'little-boy', 'fat-man', 'tsar-bomba', 'container-20'],
  },
  {
    id: 'fighters',
    name: 'Fighter jets',
    description: 'F-16, F-35, and F-22.',
    tags: ['jets', 'fighters', 'aircraft', 'military', 'f16', 'f35', 'f22'],
    itemIds: ['person-male', 'f16', 'f35', 'f22'],
  },
  {
    id: 'bombers',
    name: 'Bombers',
    description: 'F-117, B-1, B-2, B-21, and Tu-22M3.',
    tags: ['bombers', 'stealth', 'aircraft', 'military', 'b1', 'b2', 'b21', 'f117', 'tu22'],
    itemIds: ['person-male', 'f117', 'b21', 'b2', 'b1', 'tu22m3'],
  },
  {
    id: 'airliners',
    name: 'Airliners',
    description: 'A320, 737, and Air Force One.',
    tags: ['airliners', 'planes', 'boeing', 'airbus', '747', '737', 'a320'],
    itemIds: ['person-male', 'a320', 'boeing-737', 'boeing-747'],
  },
  {
    id: 'helicopters',
    name: 'Helicopters',
    description: 'Black Hawk, Apache, Chinook, Osprey.',
    tags: ['helicopters', 'rotary', 'apache', 'chinook', 'blackhawk', 'osprey'],
    itemIds: ['person-male', 'apache', 'blackhawk', 'v22', 'chinook'],
  },
  {
    id: 'navy',
    name: 'Navy',
    description: 'Sub through supercarriers.',
    tags: [
      'navy',
      'ships',
      'carrier',
      'submarine',
      'destroyer',
      'lcs',
      'amphibious',
    ],
    itemIds: [
      'person-male',
      'virginia',
      'ohio',
      'independence',
      'type45',
      'zumwalt',
      'moskva',
      'wasp',
      'kiev',
      'cvn-65',
      'nimitz',
      'ford-carrier',
    ],
  },
  {
    id: 'stargate',
    name: 'Stargate',
    description: "Teal'c through Atlantis.",
    tags: ['stargate', 'fiction', 'ships', 'atlantis', 'sci-fi', 'daedalus'],
    itemIds: [
      'tealc',
      'puddle-jumper',
      'alkesh',
      'daedalus',
      'ford-carrier',
      'wraith-cruiser',
      'atlantis',
    ],
  },
  {
    id: 'rockets',
    name: 'Rockets',
    description: 'Electron through Starship.',
    tags: ['rockets', 'space', 'launch', 'saturn', 'starship', 'falcon', 'n1'],
    itemIds: [
      'person-male',
      'electron',
      'falcon-9',
      'soyuz-2',
      'new-glenn',
      'sls',
      'n1',
      'saturn-v',
      'starship',
    ],
  },
  {
    id: 'landmarks',
    name: 'World landmarks',
    description: 'Stonehenge through Burj, plus the Golden Gate.',
    tags: [
      'landmarks',
      'towers',
      'buildings',
      'heights',
      'eiffel',
      'burj',
      'pyramids',
      'bridge',
    ],
    itemIds: [
      'person-male',
      'stonehenge',
      'big-ben',
      'statue-liberty',
      'washington-monument',
      'colosseum',
      'sydney-opera-house',
      'eiffel',
      'great-pyramids',
      'burj',
      'golden-gate',
    ],
  },
  {
    id: 'money',
    name: 'Money stacks',
    description: 'Million through US national debt in $100 bills.',
    tags: ['money', 'cash', 'dollar', 'debt', 'billion', 'trillion', 'wealth'],
    itemIds: [
      'person-male',
      'money-1m',
      'money-100m',
      'money-1b',
      'money-100b',
      'money-1t',
      'money-us-debt',
    ],
  },
  {
    id: 'animals',
    name: 'Animals',
    description: 'Rabbit through Spinosaurus — clips play when you focus them.',
    tags: [
      'animals',
      'dinosaurs',
      'wildlife',
      'kids',
      'eagle',
      'elephant',
      'horse',
      'wolf',
    ],
    itemIds: [
      'person-male',
      'rabbit',
      'owl',
      'wolf',
      'leopard',
      'eagle',
      'horse',
      'rhino',
      'anaconda',
      'elephant',
      'ankylosaurus',
      'carnotaurus',
      'giganotosaurus',
      'spinosaurus',
    ],
  },
]

export const CATEGORY_LABELS: Record<CatalogCategory, string> = {
  reference: 'Reference',
  animal: 'Animals',
  vehicle: 'Vehicles',
  military: 'Military',
  munition: 'Munitions',
  spacecraft: 'Spacecraft',
  fiction: 'Fiction',
  landmark: 'Landmarks',
  money: 'Money',
}

