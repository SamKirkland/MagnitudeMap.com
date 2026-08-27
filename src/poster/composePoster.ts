import { SITE_NAME } from '../siteMeta'
import { formatLength, niceScaleMeters, type UnitSystem } from '../units'
import { posterLabelFontSize } from './settings'
import type { PosterBackground, PosterItemProjection, PosterLayout } from './types'

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
  background: PosterBackground
}

export async function composePoster(opts: ComposePosterOptions): Promise<Blob> {
  await document.fonts.ready.catch(() => undefined)

  const bitmap = await blobToImage(opts.render)
  const canvas = document.createElement('canvas')
  canvas.width = opts.width
  canvas.height = opts.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create poster canvas')

  if (opts.background !== 'transparent') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, opts.width, opts.height)
  }
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

function labelFont(fontSize: number): string {
  return `600 ${fontSize}px "IBM Plex Sans", "Segoe UI", sans-serif`
}

type FittedLabel = { text: string; fontSize: number; width: number }

/**
 * Shrink (to 72% of the base size) then ellipsize until the name fits its slot.
 * Clamping to the slot is what keeps neighbouring labels from colliding.
 */
function fitLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  baseSize: number,
): FittedLabel {
  const floor = Math.max(10, Math.round(baseSize * 0.72))
  let fontSize = baseSize
  ctx.font = labelFont(fontSize)
  let width = ctx.measureText(text).width
  while (width > maxWidth && fontSize > floor) {
    fontSize = Math.max(floor, fontSize - 1)
    ctx.font = labelFont(fontSize)
    width = ctx.measureText(text).width
  }
  if (width <= maxWidth) return { text, fontSize, width }

  let clipped = text
  while (clipped.length > 1) {
    clipped = clipped.slice(0, -1)
    width = ctx.measureText(`${clipped}…`).width
    if (width <= maxWidth) break
  }
  return { text: `${clipped}…`, fontSize, width }
}

/** Items grouped by the row/column the scene laid them out in, in reading order. */
function labelRows(items: PosterItemProjection[]): PosterItemProjection[][] {
  const byRow = new Map<number, PosterItemProjection[]>()
  for (const item of items) {
    const row = Number.isFinite(item.row) ? item.row : 0
    const bucket = byRow.get(row)
    if (bucket) bucket.push(item)
    else byRow.set(row, [item])
  }
  return [...byRow.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, bucket]) => bucket)
}

function drawLabels(ctx: CanvasRenderingContext2D, opts: PosterOverlayOptions) {
  if (opts.items.length === 0) return
  const fontSize = posterLabelFontSize(opts.width, opts.items.length)
  if (opts.layout === 'stacked') {
    drawStackedLabels(ctx, opts, fontSize)
    return
  }
  drawLineupLabels(ctx, opts, fontSize)
}

/**
 * A name under every object, banded beneath its own row. Two alternating lines
 * are used when the row is packed tighter than the names are wide and there is
 * vertical room before the next row starts.
 */
function drawLineupLabels(
  ctx: CanvasRenderingContext2D,
  opts: PosterOverlayOptions,
  fontSize: number,
) {
  const gap = Math.max(8, Math.round(fontSize * 0.45))
  const lineH = Math.round(fontSize * 1.35)
  const rows = labelRows(opts.items).map((row) =>
    [...row].sort((a, b) => a.minX - b.minX),
  )

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    const next = rows[r + 1]
    const bandY = Math.max(...row.map((item) => item.maxY)) + gap
    const limit = next
      ? Math.min(...next.map((item) => item.minY)) - gap * 0.5
      : opts.height - gap
    const lines = Math.max(1, Math.min(2, Math.floor((limit - bandY) / lineH)))

    // Slots first at one line; if any name has to be cut, stagger onto two.
    const single = slotWidths(row, opts.width, 1)
    const cramped = row.some(
      (item, i) => measureName(ctx, item.name, fontSize) > single[i],
    )
    const useTwo = lines >= 2 && cramped
    const widths = useTwo ? slotWidths(row, opts.width, 2) : single

    for (let i = 0; i < row.length; i++) {
      const item = row[i]
      const cx = (item.minX + item.maxX) / 2
      const y = bandY + (useTwo ? (i % 2) * lineH : 0)
      const fitted = fitLabel(ctx, item.name, widths[i], fontSize)
      drawLabelLine(ctx, fitted.text, cx, y, 'center', 'top', fitted.fontSize)
    }
  }
}

function measureName(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
): number {
  ctx.font = labelFont(fontSize)
  return ctx.measureText(text).width
}

/**
 * Horizontal room each label may claim: half the distance to whichever
 * neighbour shares its line, so no two names can ever meet.
 */
function slotWidths(
  row: PosterItemProjection[],
  width: number,
  lines: number,
): number[] {
  const margin = Math.max(6, width * 0.004)
  return row.map((item, i) => {
    const cx = (item.minX + item.maxX) / 2
    const before = row[i - lines]
    const after = row[i + lines]
    const left = before ? (before.maxX + item.minX) / 2 : 0
    const right = after ? (item.maxX + after.minX) / 2 : width
    const room = Math.min(cx - left, right - cx) * 2 - margin * 2
    // Never collapse to nothing: a heavily overlapped item still gets a stub.
    return Math.max(room, width * 0.05)
  })
}

/** Stacked posters label to the right, clamped to the next column's edge. */
function drawStackedLabels(
  ctx: CanvasRenderingContext2D,
  opts: PosterOverlayOptions,
  fontSize: number,
) {
  const pad = Math.max(16, opts.width * 0.012)
  for (const column of labelRows(opts.items)) {
    const placed: number[] = []
    for (const item of [...column].sort((a, b) => a.minY - b.minY)) {
      const x = item.maxX + pad
      let y = (item.minY + item.maxY) / 2
      for (const other of placed) {
        if (Math.abs(y - other) < fontSize * 1.2) y = other + fontSize * 1.25
      }
      placed.push(y)
      const fitted = fitLabel(ctx, item.name, gutterWidth(opts, item, x, pad), fontSize)
      drawLabelLine(ctx, fitted.text, x, y, 'left', 'middle', fitted.fontSize)
    }
  }
}

/** Space between an item's right edge and whatever sits beside it. */
function gutterWidth(
  opts: PosterOverlayOptions,
  item: PosterItemProjection,
  x: number,
  pad: number,
): number {
  let right = opts.width - pad
  for (const other of opts.items) {
    if (other === item || other.minX <= item.maxX) continue
    const overlaps = other.minY < item.maxY && other.maxY > item.minY
    if (overlaps) right = Math.min(right, other.minX - pad * 0.5)
  }
  return Math.max(right - x, opts.width * 0.05)
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
  ctx.font = labelFont(fontSize)
  ctx.textAlign = align
  ctx.textBaseline = baseline
  ctx.fillStyle = INK
  ctx.fillText(text, x, y)
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
