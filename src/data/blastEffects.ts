/**
 * Blast / detonation visuals for munition catalog items.
 * Radii are approximate moderate-blast (≈5 psi) figures; nuclear values
 * follow Glasstone & Dolan / NUKEMAP-style scaling.
 */
import type { CatalogItem, CatalogModelRef, ScaleAxis } from './catalog'

export type DetonationMode = 'casing' | 'ground'

export type BlastEffectId = 'mushroom-cloud' | 'nuclear-explosion'

export type MunitionBlast = {
  /** Short yield label for plaques (e.g. "15 kt"). */
  yieldLabel: string
  /** ≈5 psi surface-burst radius in meters. */
  groundBlastRadiusM: number
  /** Ground visual: mushroom for large nukes, generic explosion otherwise. */
  groundEffect: BlastEffectId
}

type EffectModel = {
  path: string
  scaleAxis: ScaleAxis
  /** Fixed pitch so the mesh “points down” / stays upright (degrees). */
  pitchDegrees?: number
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
    groundEffect: 'nuclear-explosion',
  },
  jdam: {
    yieldLabel: 'GBU-31 / Mk 84',
    groundBlastRadiusM: 60,
    groundEffect: 'nuclear-explosion',
  },
  'little-boy': {
    yieldLabel: '15 kt',
    groundBlastRadiusM: 1380,
    groundEffect: 'mushroom-cloud',
  },
  'fat-man': {
    yieldLabel: '21 kt',
    groundBlastRadiusM: 1600,
    groundEffect: 'mushroom-cloud',
  },
  'tsar-bomba': {
    yieldLabel: '50 Mt',
    groundBlastRadiusM: 20130,
    groundEffect: 'mushroom-cloud',
  },
}

export function hasBlastEffect(itemId: string): boolean {
  return Boolean(MUNITION_BLAST[itemId])
}

export function blastRadiusM(itemId: string, mode: DetonationMode): number | null {
  const blast = MUNITION_BLAST[itemId]
  if (!blast || mode === 'casing') return null
  return blast.groundBlastRadiusM
}

/**
 * When detonated, return a catalog-shaped item whose footprint is the blast
 * radius (width) so layout, plaques, and model scaling all stay in sync.
 * Casing mode returns the original item unchanged.
 */
export function resolveDetonationItem(
  item: CatalogItem,
  mode: DetonationMode,
): CatalogItem {
  if (mode === 'casing') return item
  const blast = MUNITION_BLAST[item.id]
  if (!blast) return item

  const effect = BLAST_EFFECT_MODELS[blast.groundEffect]
  const radius = blast.groundBlastRadiusM
  const height = radius * effect.heightFactor

  const model: CatalogModelRef = {
    path: effect.path,
    scaleAxis: effect.scaleAxis,
    pitchDegrees: effect.pitchDegrees,
  }

  return {
    ...item,
    // Keep the casing id so selection / library checkboxes stay stable.
    length: radius,
    width: radius,
    height,
    shape: 'box',
    orientation: undefined,
    color: '#a8a29e',
    blurb: `${blast.yieldLabel} · ~${Math.round(radius)} m blast radius.`,
    model,
  }
}
