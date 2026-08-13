/**
 * Blast / detonation visuals for munition catalog items.
 * Radii are approximate moderate-blast (≈5 psi) figures; nuclear values
 * follow Glasstone & Dolan / NUKEMAP-style scaling.
 */
import type { CatalogItem, CatalogModelRef, ScaleAxis } from './catalog'

export type DetonationMode = 'casing' | 'ground' | 'air'

export type BlastEffectId = 'mushroom-cloud' | 'nuclear-fireball' | 'nuclear-explosion'

export type MunitionBlast = {
  /** Short yield label for plaques (e.g. "15 kt"). */
  yieldLabel: string
  /** ≈5 psi surface-burst radius in meters. */
  groundBlastRadiusM: number
  /** ≈5 psi airburst radius in meters. */
  airBlastRadiusM: number
  /** Ground visual: mushroom for large nukes, generic explosion otherwise. */
  groundEffect: 'mushroom-cloud' | 'nuclear-explosion'
}

type EffectModel = {
  path: string
  scaleAxis: ScaleAxis
  /** Fixed pitch so the mesh “points down” / stays upright (degrees). */
  pitchDegrees?: number
  /** Randomize yaw on each load so repeated fireballs don’t look identical. */
  randomYaw?: boolean
  /** Cloud height ≈ this × blast radius (visual aspect only). */
  heightFactor: number
}

export const BLAST_EFFECT_MODELS: Record<BlastEffectId, EffectModel> = {
  'mushroom-cloud': {
    path: 'models/mushroom-cloud/model.glb',
    scaleAxis: 'footprint',
    pitchDegrees: 0,
    heightFactor: 1.35,
  },
  'nuclear-fireball': {
    path: 'models/nuclear-fireball/model.glb',
    scaleAxis: 'footprint',
    pitchDegrees: 0,
    randomYaw: true,
    heightFactor: 1,
  },
  'nuclear-explosion': {
    path: 'models/nuclear-explosion/model.glb',
    scaleAxis: 'footprint',
    pitchDegrees: 0,
    heightFactor: 1.15,
  },
}

/** Munition id → blast parameters. */
export const MUNITION_BLAST: Record<string, MunitionBlast> = {
  tnt: {
    yieldLabel: '~1.6 t TNT',
    groundBlastRadiusM: 110,
    airBlastRadiusM: 200,
    groundEffect: 'nuclear-explosion',
  },
  jdam: {
    yieldLabel: 'GBU-31 / Mk 84',
    groundBlastRadiusM: 60,
    airBlastRadiusM: 100,
    groundEffect: 'nuclear-explosion',
  },
  'little-boy': {
    yieldLabel: '15 kt',
    groundBlastRadiusM: 1380,
    airBlastRadiusM: 2520,
    groundEffect: 'mushroom-cloud',
  },
  'fat-man': {
    yieldLabel: '21 kt',
    groundBlastRadiusM: 1600,
    airBlastRadiusM: 2810,
    groundEffect: 'mushroom-cloud',
  },
  'tsar-bomba': {
    yieldLabel: '50 Mt',
    groundBlastRadiusM: 20130,
    airBlastRadiusM: 36600,
    groundEffect: 'mushroom-cloud',
  },
}

export function hasBlastEffect(itemId: string): boolean {
  return Boolean(MUNITION_BLAST[itemId])
}

export function blastRadiusM(itemId: string, mode: DetonationMode): number | null {
  const blast = MUNITION_BLAST[itemId]
  if (!blast || mode === 'casing') return null
  return mode === 'ground' ? blast.groundBlastRadiusM : blast.airBlastRadiusM
}

/**
 * When mode is ground/air, return a catalog-shaped item whose footprint is the
 * blast radius (width) so layout, plaques, and model scaling all stay in sync.
 * Casing mode returns the original item unchanged.
 */
export function resolveDetonationItem(
  item: CatalogItem,
  mode: DetonationMode,
): CatalogItem {
  if (mode === 'casing') return item
  const blast = MUNITION_BLAST[item.id]
  if (!blast) return item

  const effectId: BlastEffectId =
    mode === 'air' ? 'nuclear-fireball' : blast.groundEffect
  const effect = BLAST_EFFECT_MODELS[effectId]
  const radius = mode === 'ground' ? blast.groundBlastRadiusM : blast.airBlastRadiusM
  const height = radius * effect.heightFactor

  const model: CatalogModelRef = {
    path: effect.path,
    scaleAxis: effect.scaleAxis,
    pitchDegrees: effect.pitchDegrees,
    randomYaw: effect.randomYaw,
  }

  return {
    ...item,
    // Keep the casing id so selection / library checkboxes stay stable.
    length: radius,
    width: radius,
    height,
    shape: 'box',
    orientation: undefined,
    color: mode === 'air' ? '#f97316' : '#a8a29e',
    blurb: `${blast.yieldLabel} · ~${Math.round(radius)} m blast radius (${mode}).`,
    model,
  }
}
