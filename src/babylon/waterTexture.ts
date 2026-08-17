/**
 * Procedural harbor water for the New York ground plate.
 * Top tiles in world meters; side V is 0–1 so the foam rim stays at the surface.
 */
import { DynamicTexture, Texture, type Scene } from '@babylonjs/core'

/** One water tile in world meters. Large enough to read at city overview. */
export const WATER_TILE_METERS = 220

const SURFACE_SIZE = 1024
const SIDE_SIZE = 256
const UNDERSIDE_SIZE = 512

function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

function shade(base: [number, number, number], j: number): string {
  const k = 0.88 + j * 0.24
  return `rgb(${Math.round(base[0] * k)},${Math.round(base[1] * k)},${Math.round(base[2] * k)})`
}

function wrapOffsets(size: number): number[] {
  return [-size, 0, size]
}

export function createWaterSurfaceTexture(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture(
    'water-surface',
    { width: SURFACE_SIZE, height: SURFACE_SIZE },
    scene,
    true,
  )
  tex.wrapU = Texture.WRAP_ADDRESSMODE
  tex.wrapV = Texture.WRAP_ADDRESSMODE
  tex.hasAlpha = false

  const ctx = tex.getContext() as CanvasRenderingContext2D
  const size = SURFACE_SIZE

  ctx.fillStyle = '#2a6270'
  ctx.fillRect(0, 0, size, size)

  // Fine chop — one-way horizontal streaks only (no swell blobs).
  for (let i = 0; i < 2200; i++) {
    const x = hash(i * 1.9) * size
    const y = hash(i * 4.3) * size
    const w = 6 + hash(i * 2.8) * 18
    const h = 1 + hash(i * 6.1) * 2.5
    const a = 0.07 + hash(i * 3.3) * 0.12
    ctx.fillStyle =
      hash(i * 0.7) > 0.5 ? `rgba(210, 235, 240,${a})` : `rgba(12, 48, 60,${a})`
    for (const ox of wrapOffsets(size)) {
      ctx.fillRect(x + ox, y, w, h)
    }
  }

  // Sparse foam streaks
  for (let i = 0; i < 90; i++) {
    const x = hash(i * 11.2) * size
    const y = hash(i * 7.4) * size
    ctx.strokeStyle = `rgba(220, 240, 245,${0.08 + hash(i) * 0.1})`
    ctx.lineWidth = 1 + hash(i * 3) * 1.5
    ctx.beginPath()
    const len = 18 + hash(i * 2) * 40
    for (const ox of wrapOffsets(size)) {
      ctx.moveTo(x + ox, y)
      ctx.quadraticCurveTo(x + ox + len * 0.4, y - 4, x + ox + len, y + 2)
    }
    ctx.stroke()
  }

  tex.update()
  return tex
}

/** Water column: foam lip on top, deeper teal below. */
export function createWaterSideTexture(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture('water-side', { width: SIDE_SIZE, height: SIDE_SIZE }, scene, false)
  tex.wrapU = Texture.WRAP_ADDRESSMODE
  tex.wrapV = Texture.CLAMP_ADDRESSMODE
  tex.hasAlpha = false

  const ctx = tex.getContext() as CanvasRenderingContext2D
  const size = SIDE_SIZE
  const foamH = Math.round(size * 0.14)

  const top = [70, 150, 160]
  const bot = [18, 48, 58]
  for (let y = foamH; y < size; y++) {
    const t = (y - foamH) / (size - foamH)
    const r = Math.round(top[0] + (bot[0] - top[0]) * t)
    const g = Math.round(top[1] + (bot[1] - top[1]) * t)
    const b = Math.round(top[2] + (bot[2] - top[2]) * t)
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(0, y, size, 1)
  }

  for (let i = 0; i < 1600; i++) {
    const x = Math.floor(hash(i * 1.7) * size)
    const y = foamH + Math.floor(hash(i * 4.3) * (size - foamH))
    ctx.fillStyle = shade([40, 90, 100], hash(i * 2.2))
    ctx.fillRect(x, y, 1 + (hash(i) > 0.7 ? 2 : 0), 1)
  }

  ctx.fillStyle = '#9ec9d0'
  ctx.fillRect(0, 0, size, foamH)
  for (let y = 0; y < foamH; y++) {
    for (let x = 0; x < size; x++) {
      if (hash(x * 0.7 + y * 3.1) > 0.5) {
        ctx.fillStyle = shade([180, 220, 225], hash(x + y * 9))
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }

  tex.update()
  return tex
}

/** Ghost water underside with the same cutaway rim as the dirt slab. */
export function createWaterUndersideTexture(scene: Scene): DynamicTexture {
  const size = UNDERSIDE_SIZE
  const tex = new DynamicTexture(
    'water-underside',
    { width: size, height: size },
    scene,
    false,
  )
  tex.wrapU = Texture.CLAMP_ADDRESSMODE
  tex.wrapV = Texture.CLAMP_ADDRESSMODE
  tex.hasAlpha = true

  const ctx = tex.getContext() as CanvasRenderingContext2D
  ctx.clearRect(0, 0, size, size)

  ctx.fillStyle = 'rgba(32, 78, 92, 0.24)'
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 2800; i++) {
    const x = Math.floor(hash(i * 1.9) * size)
    const y = Math.floor(hash(i * 4.7) * size)
    const a = 0.04 + hash(i * 2.1) * 0.1
    ctx.fillStyle = `rgba(90, 160, 175,${a})`
    ctx.fillRect(x, y, 1 + (hash(i) > 0.75 ? 2 : 0), 1)
  }

  const rim = Math.max(10, Math.round(size * 0.042))
  const inner = rim + 1
  const innerSize = size - inner * 2

  ctx.save()
  ctx.beginPath()
  ctx.rect(inner, inner, innerSize, innerSize)
  ctx.clip()

  const minor = Math.max(8, Math.round(size / 32))
  const majorEvery = 4
  for (let p = 0; p <= size; p += minor) {
    const isMajor = Math.round(p / minor) % majorEvery === 0
    ctx.strokeStyle = isMajor ? 'rgba(150, 200, 210, 0.28)' : 'rgba(150, 200, 210, 0.12)'
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
  ctx.restore()

  ctx.fillStyle = 'rgba(22, 52, 62, 0.8)'
  ctx.fillRect(0, 0, size, rim)
  ctx.fillRect(0, size - rim, size, rim)
  ctx.fillRect(0, rim, rim, size - rim * 2)
  ctx.fillRect(size - rim, rim, rim, size - rim * 2)

  const inset = rim - 1
  ctx.strokeStyle = 'rgba(160, 210, 220, 0.5)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(inset + 0.5, inset + 0.5, size - inset * 2 - 1, size - inset * 2 - 1)

  tex.update()
  return tex
}
