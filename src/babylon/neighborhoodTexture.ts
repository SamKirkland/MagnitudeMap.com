/**
 * Paint a seamless aerial neighborhood onto a Babylon DynamicTexture.
 * One tile = BLOCK_METERS + ROAD_METERS on each axis (true-scale when UV-tiled).
 */
import { DynamicTexture, Texture, type Scene } from '@babylonjs/core'

/** City block edge length (building lots), meters. */
export const BLOCK_METERS = 100
/** Street width curb-to-curb, meters. */
export const ROAD_METERS = 14
/** One seamless tile in world meters. */
export const NEIGHBORHOOD_TILE_METERS = BLOCK_METERS + ROAD_METERS

const TEX_SIZE = 2048

function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

function shade(base: [number, number, number], j: number): string {
  const k = 0.88 + j * 0.24
  return `rgb(${Math.round(base[0] * k)},${Math.round(base[1] * k)},${Math.round(base[2] * k)})`
}

export function createNeighborhoodTexture(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture(
    'neighborhood-aerial',
    { width: TEX_SIZE, height: TEX_SIZE },
    scene,
    true,
  )
  tex.wrapU = Texture.WRAP_ADDRESSMODE
  tex.wrapV = Texture.WRAP_ADDRESSMODE
  tex.hasAlpha = false

  const ctx = tex.getContext() as CanvasRenderingContext2D
  const pxPerM = TEX_SIZE / NEIGHBORHOOD_TILE_METERS
  const road = ROAD_METERS * pxPerM
  const block = BLOCK_METERS * pxPerM

  // Base asphalt for the whole tile (roads form a cross; block is inset).
  ctx.fillStyle = '#3a3d42'
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE)

  // Subtle asphalt noise
  for (let i = 0; i < 1800; i++) {
    const x = hash(i * 3.1) * TEX_SIZE
    const y = hash(i * 7.7) * TEX_SIZE
    const a = 0.04 + hash(i * 1.9) * 0.08
    ctx.fillStyle = `rgba(255,255,255,${a})`
    ctx.fillRect(x, y, 1 + hash(i) * 2, 1)
  }

  // Lot / yards
  ctx.fillStyle = '#4f6b45'
  ctx.fillRect(road, road, block, block)

  // Grass variation
  for (let i = 0; i < 900; i++) {
    const x = road + hash(i * 2.3) * block
    const y = road + hash(i * 4.1) * block
    ctx.fillStyle = shade([70, 110, 62], hash(i * 0.7))
    ctx.beginPath()
    ctx.arc(x, y, 1 + hash(i * 5) * 3, 0, Math.PI * 2)
    ctx.fill()
  }

  // Sidewalk ring
  const walk = 2.2 * pxPerM
  ctx.fillStyle = '#9a9b96'
  ctx.fillRect(road, road, block, walk)
  ctx.fillRect(road, road + block - walk, block, walk)
  ctx.fillRect(road, road, walk, block)
  ctx.fillRect(road + block - walk, road, walk, block)

  // Building footprints (rooftops) — leaves open yards so models aren't "inside" clutter visually
  const roofs: [number, number, number][] = [
    [92, 96, 100],
    [120, 108, 96],
    [88, 92, 98],
    [130, 124, 118],
    [100, 104, 90],
  ]
  const plots = [
    [0.08, 0.08, 0.38, 0.32],
    [0.52, 0.1, 0.36, 0.28],
    [0.1, 0.5, 0.3, 0.36],
    [0.48, 0.48, 0.4, 0.38],
  ]
  plots.forEach((p, i) => {
    const x = road + walk + p[0] * (block - walk * 2)
    const y = road + walk + p[1] * (block - walk * 2)
    const w = p[2] * (block - walk * 2)
    const h = p[3] * (block - walk * 2)
    ctx.fillStyle = shade(roofs[i % roofs.length], hash(i * 11))
    ctx.fillRect(x, y, w, h)
    // Roof edge
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = Math.max(1, pxPerM * 0.15)
    ctx.strokeRect(x, y, w, h)
    // HVAC / vents
    ctx.fillStyle = 'rgba(40,40,45,0.55)'
    ctx.fillRect(x + w * 0.2, y + h * 0.25, w * 0.12, h * 0.12)
    ctx.fillRect(x + w * 0.6, y + h * 0.55, w * 0.1, h * 0.1)
  })

  // Driveway / parking strip
  ctx.fillStyle = '#50545a'
  ctx.fillRect(road + block * 0.35, road + walk, block * 0.12, block * 0.22)

  // Tree canopies
  for (let i = 0; i < 14; i++) {
    const x = road + walk * 2 + hash(i * 9.1) * (block - walk * 4)
    const y = road + walk * 2 + hash(i * 13.3) * (block - walk * 4)
    const r = (2.5 + hash(i) * 4) * pxPerM
    ctx.fillStyle = shade([45, 90, 48], hash(i * 2.2))
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Lane markings on roads (center dashed lines)
  ctx.strokeStyle = '#d4c98a'
  ctx.lineWidth = Math.max(1.5, 0.18 * pxPerM)
  ctx.setLineDash([4 * pxPerM, 3 * pxPerM])

  // Horizontal road center (bottom strip of tile is part of road; top of next tile)
  // Vertical road: x in [0, road]
  ctx.beginPath()
  ctx.moveTo(road * 0.5, 0)
  ctx.lineTo(road * 0.5, TEX_SIZE)
  ctx.stroke()
  // Horizontal road: y in [0, road]
  ctx.beginPath()
  ctx.moveTo(0, road * 0.5)
  ctx.lineTo(TEX_SIZE, road * 0.5)
  ctx.stroke()
  ctx.setLineDash([])

  // Crosswalk at intersection
  ctx.fillStyle = 'rgba(230,230,230,0.75)'
  const stripe = 0.45 * pxPerM
  const gap = 0.55 * pxPerM
  for (let s = 0; s < 8; s++) {
    const o = s * (stripe + gap)
    ctx.fillRect(road + 1, 2 + o, walk * 0.9, stripe)
    ctx.fillRect(2 + o, road + 1, stripe, walk * 0.9)
  }

  // Curb lines
  ctx.strokeStyle = 'rgba(20,20,20,0.35)'
  ctx.lineWidth = 1
  ctx.strokeRect(road, road, block, block)

  tex.update()
  return tex
}

/** Minecraft-ish dirt side face: grass rim on top, brown dirt below. */
export function createDirtSideTexture(scene: Scene): DynamicTexture {
  const size = 256
  const tex = new DynamicTexture('dirt-side', { width: size, height: size }, scene, false)
  tex.wrapU = Texture.WRAP_ADDRESSMODE
  tex.wrapV = Texture.CLAMP_ADDRESSMODE
  tex.hasAlpha = false

  const ctx = tex.getContext() as CanvasRenderingContext2D
  const grassH = Math.round(size * 0.18)

  ctx.fillStyle = '#5a8f3c'
  ctx.fillRect(0, 0, size, grassH)

  for (let y = 0; y < grassH; y++) {
    for (let x = 0; x < size; x++) {
      if (hash(x * 0.7 + y * 3.1) > 0.55) {
        ctx.fillStyle = shade([70, 130, 50], hash(x + y * 9))
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }

  ctx.fillStyle = '#6b4a2e'
  ctx.fillRect(0, grassH, size, size - grassH)

  for (let i = 0; i < 2200; i++) {
    const x = Math.floor(hash(i * 1.7) * size)
    const y = grassH + Math.floor(hash(i * 4.3) * (size - grassH))
    ctx.fillStyle = shade([90, 62, 38], hash(i * 2.2))
    ctx.fillRect(x, y, 1 + (hash(i) > 0.7 ? 1 : 0), 1 + (hash(i * 3) > 0.8 ? 1 : 0))
  }

  // Darker flecks / pebbles
  for (let i = 0; i < 180; i++) {
    const x = Math.floor(hash(i * 8.1) * size)
    const y = grassH + Math.floor(hash(i * 6.6) * (size - grassH))
    ctx.fillStyle = shade([55, 40, 28], hash(i))
    ctx.fillRect(x, y, 2, 2)
  }

  tex.update()
  return tex
}

/**
 * Underside of the earth slab: ghost dirt + subtle blueprint grid, with a thin
 * more-opaque cutaway rim so the open bottom reads as intentional.
 */
export function createUndersideCutawayTexture(scene: Scene): DynamicTexture {
  const size = 512
  const tex = new DynamicTexture(
    'ground-underside',
    { width: size, height: size },
    scene,
    false,
  )
  tex.wrapU = Texture.CLAMP_ADDRESSMODE
  tex.wrapV = Texture.CLAMP_ADDRESSMODE
  tex.hasAlpha = true

  const ctx = tex.getContext() as CanvasRenderingContext2D
  ctx.clearRect(0, 0, size, size)

  // Ghost dirt fill — see model undersides through it.
  ctx.fillStyle = 'rgba(72, 48, 30, 0.22)'
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 3200; i++) {
    const x = Math.floor(hash(i * 1.9) * size)
    const y = Math.floor(hash(i * 4.7) * size)
    const a = 0.04 + hash(i * 2.1) * 0.1
    const k = 0.88 + hash(i * 3.3) * 0.24
    ctx.fillStyle = `rgba(${Math.round(95 * k)},${Math.round(64 * k)},${Math.round(40 * k)},${a})`
    ctx.fillRect(x, y, 1 + (hash(i) > 0.75 ? 1 : 0), 1)
  }

  const rim = Math.max(10, Math.round(size * 0.042))
  const inner = rim + 1
  const innerSize = size - inner * 2

  // Subtle blueprint / cutaway grid in the open aperture only.
  ctx.save()
  ctx.beginPath()
  ctx.rect(inner, inner, innerSize, innerSize)
  ctx.clip()

  const minor = Math.max(8, Math.round(size / 32))
  const majorEvery = 4
  for (let p = 0; p <= size; p += minor) {
    const isMajor = Math.round(p / minor) % majorEvery === 0
    ctx.strokeStyle = isMajor
      ? 'rgba(168, 196, 210, 0.28)'
      : 'rgba(168, 196, 210, 0.12)'
    ctx.lineWidth = isMajor ? 1.25 : 1
    ctx.beginPath()
    ctx.moveTo(p + 0.5, 0)
    ctx.lineTo(p + 0.5, size)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, p + 0.5)
    ctx.lineTo(size, p + 0.5)
    ctx.stroke()
  }

  // Soft center crosshair — reinforces “inspection / diagram” without clutter.
  const mid = size / 2
  ctx.strokeStyle = 'rgba(188, 214, 224, 0.22)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(mid + 0.5, inner)
  ctx.lineTo(mid + 0.5, size - inner)
  ctx.moveTo(inner, mid + 0.5)
  ctx.lineTo(size - inner, mid + 0.5)
  ctx.stroke()
  ctx.restore()

  // Thin cutaway rim — denser earth at the edge.
  ctx.fillStyle = 'rgba(48, 34, 22, 0.78)'
  ctx.fillRect(0, 0, size, rim)
  ctx.fillRect(0, size - rim, size, rim)
  ctx.fillRect(0, rim, rim, size - rim * 2)
  ctx.fillRect(size - rim, rim, rim, size - rim * 2)

  for (let i = 0; i < 900; i++) {
    const edge = Math.floor(hash(i * 6.2) * 4)
    let x = 0
    let y = 0
    if (edge === 0) {
      x = Math.floor(hash(i * 2.4) * size)
      y = Math.floor(hash(i * 3.1) * rim)
    } else if (edge === 1) {
      x = Math.floor(hash(i * 2.4) * size)
      y = size - rim + Math.floor(hash(i * 3.1) * rim)
    } else if (edge === 2) {
      x = Math.floor(hash(i * 2.4) * rim)
      y = Math.floor(hash(i * 3.1) * size)
    } else {
      x = size - rim + Math.floor(hash(i * 2.4) * rim)
      y = Math.floor(hash(i * 3.1) * size)
    }
    const k = 0.88 + hash(i) * 0.24
    ctx.fillStyle = `rgba(${Math.round(70 * k)},${Math.round(48 * k)},${Math.round(30 * k)},0.55)`
    ctx.fillRect(x, y, 2, 2)
  }

  // Hairline inner edge — cut, not a missing face.
  const inset = rim - 1
  ctx.strokeStyle = 'rgba(160, 140, 110, 0.55)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(inset + 0.5, inset + 0.5, size - inset * 2 - 1, size - inset * 2 - 1)

  tex.update()
  return tex
}
