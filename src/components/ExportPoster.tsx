import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { trackPosterExported } from '../analytics/mixpanel'
import { downloadBlob, paintPosterOverlay, posterFilename } from '../poster/composePoster'
import { buildPosterImage } from '../poster/exportPoster'
import {
  loadPosterSettings,
  posterContentRect,
  posterPixelSize,
  POSTER_RESOLUTION_META,
  POSTER_RESOLUTIONS,
  savePosterSettings,
} from '../poster/settings'
import type {
  PosterCaptureRequest,
  PosterCaptureResult,
  PosterOverlayState,
  PosterPreviewSettings,
  PosterResolution,
  PosterSettings,
} from '../poster/types'
import type { UnitSystem } from '../units'

type ExportPosterProps = {
  disabled: boolean
  units: UnitSystem
  /** Catalog ids currently in the comparison — reported with the export event. */
  itemIds: string[]
  title: string
  shareUrl: string
  previewKey: string
  capture: (request: PosterCaptureRequest) => Promise<PosterCaptureResult>
  setLivePreview: (settings: PosterPreviewSettings | null) => void
  subscribeOverlay: (
    listener: (state: PosterOverlayState | null) => void,
  ) => () => void
  onPreviewActive?: (active: boolean) => void
  /** Toolbar-owned open state, so only one popover shows at a time. */
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Where the full-bleed preview overlay renders. The button itself lives in
   * the toolbar, which is too small to host an `inset: 0` canvas.
   */
  overlayContainer: HTMLElement | null
}

export function ExportPoster({
  disabled,
  units,
  itemIds,
  title,
  shareUrl,
  previewKey,
  capture,
  setLivePreview,
  subscribeOverlay,
  onPreviewActive,
  open,
  onOpenChange,
  overlayContainer,
}: ExportPosterProps) {
  const [settings, setSettings] = useState<PosterSettings>(() => loadPosterSettings())
  const [busy, setBusy] = useState<PosterResolution | null>(null)
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const lastOverlayRef = useRef<PosterOverlayState | null>(null)
  const captureRef = useRef(capture)
  const livePreviewRef = useRef(setLivePreview)
  const overlayMetaRef = useRef({ title, shareUrl, units, layout: settings.layout })
  captureRef.current = capture
  livePreviewRef.current = setLivePreview
  overlayMetaRef.current = {
    title,
    shareUrl,
    units,
    layout: settings.layout,
  }
  const previewActive = open && !disabled

  function previewSettings(): PosterPreviewSettings {
    return {
      layout: settings.layout,
      view: settings.view,
      contentRect: posterContentRect(settings.layout),
    }
  }

  function patch(next: Partial<PosterSettings>) {
    setSettings((current) => {
      const merged = { ...current, ...next }
      savePosterSettings(merged)
      return merged
    })
  }

  useEffect(() => {
    onPreviewActive?.(previewActive)
  }, [previewActive, onPreviewActive])

  useEffect(() => {
    return () => onPreviewActive?.(false)
  }, [onPreviewActive])

  useEffect(() => {
    if (!previewActive) {
      livePreviewRef.current(null)
      lastOverlayRef.current = null
      const canvas = overlayRef.current
      const ctx = canvas?.getContext('2d')
      if (canvas && ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
      return
    }
    livePreviewRef.current(previewSettings())
  }, [previewActive, settings.layout, settings.view, previewKey])

  useEffect(() => {
    return () => livePreviewRef.current(null)
  }, [])

  function paintOverlay(state: PosterOverlayState | null) {
    const canvas = overlayRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (!state) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    const width = Math.max(1, Math.round(state.width))
    const height = Math.max(1, Math.round(state.height))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    // Clear the whole backing store, not the new state's rect: labels from the
    // previous lineup sit wherever those items were and would survive a
    // narrower clear.
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const meta = overlayMetaRef.current
    paintPosterOverlay(ctx, {
      width,
      height,
      items: state.items,
      layout: meta.layout,
      units: meta.units,
      pixelsPerMeter: state.pixelsPerMeter,
      title: meta.title,
      shareUrl: meta.shareUrl,
    })
  }

  useEffect(() => {
    if (!previewActive) return
    return subscribeOverlay((state) => {
      lastOverlayRef.current = state
      paintOverlay(state)
    })
  }, [previewActive, subscribeOverlay])

  useEffect(() => {
    if (!previewActive) return
    paintOverlay(lastOverlayRef.current)
  }, [previewActive, title, shareUrl, units, settings.layout])

  async function handleDownload(resolution: PosterResolution) {
    if (disabled || busy) return
    setBusy(resolution)
    setError(null)
    try {
      const blob = await buildPosterImage({
        capture: (request) => captureRef.current(request),
        settings,
        resolution,
        units,
        title,
        shareUrl,
      })
      downloadBlob(posterFilename(title), blob)
      trackPosterExported({
        item_ids: itemIds.join(','),
        item_count: itemIds.length,
        comparison_title: title,
        layout: settings.layout,
        view: settings.view,
        background: settings.background,
        resolution,
        unit_system: units,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Download failed')
    } finally {
      setBusy(null)
    }
  }

  const overlay = (
    <>
      <canvas
        ref={overlayRef}
        className="export-overlay-canvas"
        hidden={!previewActive}
        aria-hidden
      />
      {busy && <div className="export-capture-veil" aria-hidden />}
    </>
  )

  return (
    <>
      {overlayContainer ? createPortal(overlay, overlayContainer) : null}
      <div className="toolbar-item">
        <button
          type="button"
          className={`toolbar-btn ${open ? 'is-open' : ''}`}
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-controls="export-poster-panel"
          title="Download image"
          aria-label="Download image"
        >
          <ArrowDownTrayIcon aria-hidden="true" />
        </button>

        {open && (
          <div
            id="export-poster-panel"
            className="toolbar-popover toolbar-popover-end export-panel"
            role="region"
            aria-label="Comparison image settings"
          >
            <fieldset className="export-field">
              <legend>Layout</legend>
              <div className="export-seg" role="group">
                <SegButton
                  active={settings.layout === 'lineup'}
                  onClick={() => patch({ layout: 'lineup' })}
                >
                  Side by side
                </SegButton>
                <SegButton
                  active={settings.layout === 'stacked'}
                  onClick={() => patch({ layout: 'stacked' })}
                >
                  Stacked
                </SegButton>
              </div>
            </fieldset>

            <fieldset className="export-field">
              <legend>View</legend>
              <div className="export-seg" role="group">
                <SegButton
                  active={settings.view === 'side'}
                  onClick={() => patch({ view: 'side' })}
                >
                  Side
                </SegButton>
                <SegButton
                  active={settings.view === 'top'}
                  onClick={() => patch({ view: 'top' })}
                >
                  Top
                </SegButton>
              </div>
            </fieldset>

            <fieldset className="export-field">
              <legend>Background</legend>
              <div className="export-seg" role="group">
                <SegButton
                  active={settings.background === 'white'}
                  onClick={() => patch({ background: 'white' })}
                >
                  White
                </SegButton>
                <SegButton
                  active={settings.background === 'transparent'}
                  onClick={() => patch({ background: 'transparent' })}
                  title="Transparent WebP — labels stay dark, so use it over light surfaces"
                >
                  Transparent
                </SegButton>
              </div>
            </fieldset>

            <fieldset className="export-field export-field-download">
              <legend>Download</legend>
              <div className="export-downloads">
                {POSTER_RESOLUTIONS.map((resolution) => {
                  const meta = POSTER_RESOLUTION_META[resolution]
                  const size = posterPixelSize(settings.layout, resolution)
                  return (
                    <button
                      key={resolution}
                      type="button"
                      className="export-download"
                      onClick={() => void handleDownload(resolution)}
                      disabled={disabled || busy !== null}
                      title={`${size.width} × ${size.height}`}
                    >
                      {busy === resolution ? '…' : meta.label}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            {disabled && (
              <p className="export-hint">Add objects from the library first.</p>
            )}
            {error && <p className="export-error">{error}</p>}
          </div>
        )}
      </div>
    </>
  )
}

function SegButton({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean
  onClick: () => void
  children: string
  title?: string
}) {
  return (
    <button
      type="button"
      className={active ? 'is-active' : ''}
      aria-pressed={active}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  )
}
