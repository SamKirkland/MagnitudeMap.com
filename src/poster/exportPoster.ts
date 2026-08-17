import type { UnitSystem } from '../units'
import { composePoster } from './composePoster'
import { posterContentRect, posterPixelSize } from './settings'
import type {
  PosterCaptureRequest,
  PosterCaptureResult,
  PosterResolution,
  PosterSettings,
} from './types'

export async function buildPosterImage(args: {
  capture: (request: PosterCaptureRequest) => Promise<PosterCaptureResult>
  settings: PosterSettings
  resolution: PosterResolution
  units: UnitSystem
  title: string
  shareUrl: string
}): Promise<Blob> {
  const size = posterPixelSize(args.settings.layout, args.resolution)
  const result = await args.capture({
    width: size.width,
    height: size.height,
    layout: args.settings.layout,
    view: args.settings.view,
    contentRect: posterContentRect(args.settings.layout),
  })
  return composePoster({
    render: result.image,
    width: result.width,
    height: result.height,
    items: result.items,
    layout: args.settings.layout,
    units: args.units,
    pixelsPerMeter: result.pixelsPerMeter,
    title: args.title,
    shareUrl: args.shareUrl,
  })
}
