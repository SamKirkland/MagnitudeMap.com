import type { CatalogItem } from '../data/catalog'

export type PosterLayout = 'lineup' | 'stacked'
export type PosterView = 'top' | 'side'
export type PosterResolution = '4k' | '8k' | '16k'
export type PosterBackground = 'white' | 'transparent'

export type PosterContentRect = {
  left: number
  right: number
  top: number
  bottom: number
}

export type PosterPreviewSettings = {
  layout: PosterLayout
  view: PosterView
  contentRect: PosterContentRect
}

/** Everything the camera framing needs — no background choice involved. */
export type PosterFrameRequest = PosterPreviewSettings & {
  width: number
  height: number
}

export type PosterCaptureRequest = PosterFrameRequest & {
  /** Transparent skips the white fill so the render keeps its alpha channel. */
  background: PosterBackground
}

export type PosterOverlayState = {
  width: number
  height: number
  pixelsPerMeter: number
  items: PosterItemProjection[]
}

export type PosterItemProjection = {
  itemId: string
  name: string
  sizeMeters: number
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type PosterCaptureResult = {
  image: Blob
  width: number
  height: number
  /** Screen pixels per world metre along +X (ground scale). */
  pixelsPerMeter: number
  items: PosterItemProjection[]
}

export type PosterSettings = {
  layout: PosterLayout
  view: PosterView
  background: PosterBackground
}

/** Headline size for labels: the largest catalog dimension. */
export function headlineSizeMeters(item: CatalogItem): number {
  return Math.max(item.length, item.width, item.height)
}
