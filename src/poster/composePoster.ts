import { SITE_NAME } from '../siteMeta'
import { formatLength, niceScaleMeters, type UnitSystem } from '../units'
import type { PosterItemProjection, PosterLayout } from './types'

const INK = '#1c2430'
const MUTED = '#5c6b7a'

export type PosterOverlayOptions = {
  width: number
  height: number
  items: PosterItemProjection[]
  layout: PosterLayout
  units: UnitSystem
  pixelsPerMeter: number
  title: string
  shareUrl: string
}

export type ComposePosterOptions = PosterOverlayOptions & {
  render: Blob
}

export async function composePoster(opts: ComposePosterOptions): Promise<Blob> {
  await document.fonts.ready.catch(() => undefined)

  const bitmap = await blobToImage(opts.render)
  const canvas = document.createElement('canvas')
  canvas.width = opts.width
  canvas.height = opts.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create poster canvas')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, opts.width, opts.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, opts.width, opts.height)

  paintPosterOverlay(ctx, opts)

  return encodePosterBlob(canvas)
}

/** Labels, scale, and corner brand — used by the download and the live canvas overlay. */
export function paintPosterOverlay(
  ctx: CanvasRenderingContext2D,
  opts: PosterOverlayOptions,
) {
  const pad = Math.round(opts.width * 0.028)
  drawLabels(ctx, opts)
  drawScaleBar(ctx, opts, pad)
  drawCornerBrand(ctx, opts, pad)
}

const LOGO_VIEW_W = 268
const LOGO_VIEW_H = 36
const LOGO_FONT = 22
const LOGO_TEXT_X = 34
const LOGO_TEXT_Y = 25
const LOGO_WORDMARK = 'MagnitudeMap.com'
const LOGO_BARS = [
  { x: 0, y: 24, h: 9, o: 0.4 },
  { x: 7, y: 16, h: 17, o: 0.55 },
  { x: 14, y: 7, h: 26, o: 0.7 },
  { x: 21, y: 0, h: 33, o: 0.85 },
]

function applyLogoFont(ctx: CanvasRenderingContext2D, fontSize: number) {
  ctx.font = `600 ${fontSize}px "IBM Plex Sans", "Segoe UI", sans-serif`
  ctx.letterSpacing = `${-0.01 * fontSize}px`
}

function measureMagnitudeMapLogo(
  ctx: CanvasRenderingContext2D,
  s: number,
): { width: number; height: number } {
  ctx.save()
  applyLogoFont(ctx, LOGO_FONT * s)
  const width = LOGO_TEXT_X * s + ctx.measureText(LOGO_WORDMARK).width
  ctx.restore()
  return { width, height: LOGO_VIEW_H * s }
}

function drawMagnitudeMapLogo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
) {
  ctx.save()
  const baseAlpha = ctx.globalAlpha
  ctx.fillStyle = MUTED
  for (const bar of LOGO_BARS) {
    ctx.globalAlpha = baseAlpha * bar.o
    roundRect(
      ctx,
      x + bar.x * s,
      y + bar.y * s,
      4.5 * s,
      bar.h * s,
      Math.max(0.6, s),
    )
    ctx.fill()
  }
  ctx.globalAlpha = baseAlpha
  applyLogoFont(ctx, LOGO_FONT * s)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(LOGO_WORDMARK, x + LOGO_TEXT_X * s, y + LOGO_TEXT_Y * s)
  ctx.restore()
}

function drawLabels(ctx: CanvasRenderingContext2D, opts: PosterOverlayOptions) {
  const crowded = opts.items.length > 8
  const fontSize = Math.max(12, Math.round(opts.width * (crowded ? 0.01 : 0.0125)))
  ctx.font = `600 ${fontSize}px "IBM Plex Sans", "Segoe UI", sans-serif`
  const gap = Math.max(8, Math.round(fontSize * 0.45))
  const boxes = opts.items.map((item) => {
    const name = item.name
    const size = formatLength(item.sizeMeters, opts.units)
    const label = `${name}  —  ${size}`
    const width = Math.max(ctx.measureText(name).width, ctx.measureText(size).width)
    return { item, label, name, size, width, fontSize }
  })

  if (opts.layout === 'stacked') {
    const placed: number[] = []
    for (const box of boxes) {
      const x = box.item.maxX + Math.max(16, opts.width * 0.018)
      let y = (box.item.minY + box.item.maxY) / 2
      for (const other of placed) {
        if (Math.abs(y - other) < fontSize * 1.2) y = other + fontSize * 1.25
      }
      placed.push(y)
      drawLabelLine(ctx, box.label, x, y, 'left', 'middle', fontSize)
    }
    return
  }

  const lowest = Math.max(...opts.items.map((item) => item.maxY), opts.height * 0.55)
  const bandY = Math.min(opts.height * 0.86, lowest + gap)
  const rowH = fontSize * 2.35
  const placed: Array<{ left: number; right: number; y: number }> = []
  for (const box of boxes.sort((a, b) => a.item.minX - b.item.minX)) {
    const cx = (box.item.minX + box.item.maxX) / 2
    let y = bandY
    const left = cx - box.width / 2
    const right = cx + box.width / 2
    for (const other of placed) {
      const overlap = left < other.right + 12 && right > other.left - 12
      if (overlap && Math.abs(y - other.y) < rowH) y = other.y + rowH
    }
    placed.push({ left, right, y })
    drawStackedCaption(ctx, box.name, box.size, cx, y, fontSize)
  }
}

function drawLabelLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: CanvasTextAlign,
  baseline: CanvasTextBaseline,
  fontSize: number,
) {
  ctx.font = `600 ${fontSize}px "IBM Plex Sans", "Segoe UI", sans-serif`
  ctx.textAlign = align
  ctx.textBaseline = baseline
  ctx.fillStyle = INK
  ctx.fillText(text, x, y)
}

function drawStackedCaption(
  ctx: CanvasRenderingContext2D,
  name: string,
  size: string,
  x: number,
  y: number,
  fontSize: number,
) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.font = `600 ${fontSize}px "IBM Plex Sans", "Segoe UI", sans-serif`
  ctx.fillStyle = INK
  ctx.fillText(name, x, y)
  ctx.font = `500 ${fontSize}px "IBM Plex Sans", "Segoe UI", sans-serif`
  ctx.fillStyle = MUTED
  ctx.fillText(size, x, y + fontSize * 1.15)
}

function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  opts: PosterOverlayOptions,
  pad: number,
) {
  const ppm = opts.pixelsPerMeter
  if (!Number.isFinite(ppm) || ppm <= 0) return

  const targetPx = opts.width * 0.16
  const niceMeters = niceScaleMeters(targetPx / ppm, opts.units)
  const barPx = niceMeters * ppm
  if (barPx < 24 || barPx > opts.width * 0.4) return

  const label = formatLength(niceMeters, opts.units)
  const fontSize = Math.max(12, Math.round(opts.width * 0.01))
  const tick = Math.max(6, Math.round(fontSize * 0.7))
  const x1 = pad
  const x2 = pad + barPx
  const y = opts.height - pad - fontSize - tick - 4

  ctx.strokeStyle = INK
  ctx.fillStyle = INK
  ctx.lineWidth = Math.max(2, Math.round(opts.width * 0.0016))
  ctx.beginPath()
  ctx.moveTo(x1, y - tick)
  ctx.lineTo(x1, y)
  ctx.lineTo(x2, y)
  ctx.lineTo(x2, y - tick)
  ctx.stroke()

  ctx.font = `500 ${fontSize}px "IBM Plex Sans", "Segoe UI", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(label.replace(/(\d+)\.0\s/, '$1 '), (x1 + x2) / 2, y + 6)
}

function drawCornerBrand(
  ctx: CanvasRenderingContext2D,
  opts: PosterOverlayOptions,
  pad: number,
) {
  const { width, height } = opts
  const s = (width * 0.11) / LOGO_VIEW_W
  const { width: logoWidth, height: logoHeight } = measureMagnitudeMapLogo(ctx, s)

  ctx.save()
  ctx.globalAlpha = 0.42
  drawMagnitudeMapLogo(ctx, width - pad - logoWidth, height - pad - logoHeight, s)
  ctx.restore()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius)
    return
  }
  ctx.rect(x, y, w, h)
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not decode poster render'))
    }
    image.src = url
  })
}

/** High-quality lossy WebP — much smaller than PNG, sharp enough for labels. */
const WEBP_QUALITY = 0.88

function encodePosterBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob && blob.type === 'image/webp') {
          resolve(blob)
          return
        }
        reject(new Error('Could not encode WebP'))
      },
      'image/webp',
      WEBP_QUALITY,
    )
  })
}

export function posterFilename(title: string, ext = 'webp'): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  const date = new Date().toISOString().slice(0, 10)
  return `${SITE_NAME}-${slug || 'comparison'}-${date}.${ext}`
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000)
}
