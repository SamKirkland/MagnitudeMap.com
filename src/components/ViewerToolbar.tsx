import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ChevronUpIcon,
  Cog6ToothIcon,
  MapIcon,
} from '@heroicons/react/24/outline'
// Transport controls read better filled; the rest of the bar stays outline.
import { PauseIcon, PlayIcon } from '@heroicons/react/24/solid'
import { useEffect, useRef, type ReactNode } from 'react'
import { SPREAD_MAX, SPREAD_MIN, type TourSettings } from '../tourSettings'
import { GROUND_PLATES, type GroundPlateId } from '../data/groundPlates'
import { normalizeYawTurns } from '../modelOrientation'
import type { UnitSystem } from '../units'

/** Which popover the bar currently has open, if any. */
export type ToolbarPopover = 'map' | 'download' | 'settings' | 'tour'

type ViewerToolbarProps = {
  yawTurns: number
  onYawTurns: (turns: number) => void
  plateId: GroundPlateId
  onPlateChange: (id: GroundPlateId) => void
  shadowsEnabled: boolean
  onShadowsChange: (enabled: boolean) => void
  units: UnitSystem
  onUnitsChange: (units: UnitSystem) => void
  openPopover: ToolbarPopover | null
  onOpenPopover: (popover: ToolbarPopover | null) => void
  /** The download button and its panel, supplied by `ExportPoster`. */
  downloadItem: ReactNode
  tourPlaying: boolean
  /** False with an empty lineup — there is nothing to play through. */
  canTour: boolean
  onToggleTour: () => void
  tourSettings: TourSettings
  onTourSettingsChange: (patch: Partial<TourSettings>) => void
}

const PLATE_HINTS: Record<GroundPlateId, string> = {
  neighborhood: 'Suburban blocks at true scale',
  manhattan: 'Manhattan photogrammetry at true scale',
}

export function ViewerToolbar({
  yawTurns,
  onYawTurns,
  plateId,
  onPlateChange,
  shadowsEnabled,
  onShadowsChange,
  units,
  onUnitsChange,
  openPopover,
  onOpenPopover,
  downloadItem,
  tourPlaying,
  canTour,
  onToggleTour,
  tourSettings,
  onTourSettingsChange,
}: ViewerToolbarProps) {
  const turns = normalizeYawTurns(yawTurns)
  const barRef = useRef<HTMLDivElement>(null)

  // A tap on the canvas (or Escape) dismisses whichever popover is open, so the
  // bar returns to a single row of icons without a second deliberate tap.
  useEffect(() => {
    if (!openPopover) return
    function handlePointerDown(event: PointerEvent) {
      const bar = barRef.current
      if (bar && event.target instanceof Node && bar.contains(event.target)) return
      onOpenPopover(null)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenPopover(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openPopover, onOpenPopover])

  function toggle(popover: ToolbarPopover) {
    onOpenPopover(openPopover === popover ? null : popover)
  }

  return (
    <div
      ref={barRef}
      className="viewer-toolbar"
      role="toolbar"
      aria-label="Viewer controls"
    >
      <div className="toolbar-item">
        {/* Split like the download button: the main half plays, the chevron is
            the only way into the settings. */}
        <div className="toolbar-split">
          <button
            type="button"
            className={`toolbar-btn toolbar-btn-split-main ${tourPlaying ? 'is-playing' : ''}`}
            onClick={onToggleTour}
            disabled={!canTour}
            title={tourPlaying ? 'Pause' : 'Play'}
            aria-label={tourPlaying ? 'Pause the lineup' : 'Play the lineup'}
          >
            {tourPlaying ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
          </button>
          <button
            type="button"
            className={`toolbar-btn toolbar-btn-split-more ${openPopover === 'tour' ? 'is-open' : ''}`}
            onClick={() => toggle('tour')}
            aria-expanded={openPopover === 'tour'}
            aria-controls="toolbar-tour-panel"
            title="Play options"
            aria-label="Play options"
          >
            <ChevronUpIcon aria-hidden="true" />
          </button>
        </div>

        {openPopover === 'tour' && (
          <div
            id="toolbar-tour-panel"
            className="toolbar-popover toolbar-popover-start"
            role="group"
            aria-label="Play options"
          >
            <p className="toolbar-popover-title">Play options</p>
            <div className="tour-option-row">
              <span className="tour-option-label" id="tour-frame-label">
                In frame
              </span>
              <div className="tour-seg" role="group" aria-labelledby="tour-frame-label">
                <button
                  type="button"
                  className={tourSettings.frameMode === 'pair' ? 'is-active' : ''}
                  aria-pressed={tourSettings.frameMode === 'pair'}
                  onClick={() => onTourSettingsChange({ frameMode: 'pair' })}
                >
                  Latest two
                </button>
                <button
                  type="button"
                  className={tourSettings.frameMode === 'all' ? 'is-active' : ''}
                  aria-pressed={tourSettings.frameMode === 'all'}
                  onClick={() => onTourSettingsChange({ frameMode: 'all' })}
                >
                  All so far
                </button>
              </div>
            </div>

            <div className="tour-option-row">
              <label className="tour-option-label" htmlFor="tour-spread">
                Spacing
              </label>
              <input
                id="tour-spread"
                className="tour-options-slider"
                type="range"
                min={SPREAD_MIN}
                max={SPREAD_MAX}
                step={0.05}
                value={tourSettings.spread}
                onChange={(event) =>
                  onTourSettingsChange({ spread: Number(event.target.value) })
                }
              />
              <div className="tour-slider-meta">
                <span>Tight</span>
                <span>Wide</span>
              </div>
            </div>

            <div className="tour-option-row">
              <label className="tour-option-label" htmlFor="tour-yaw">
                Angle
              </label>
              <input
                id="tour-yaw"
                className="tour-options-slider"
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={tourSettings.yaw}
                onChange={(event) =>
                  onTourSettingsChange({ yaw: Number(event.target.value) })
                }
              />
              <div className="tour-slider-meta">
                <span>Left</span>
                <span>Right</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <span className="toolbar-divider" aria-hidden="true" />

      <div className="toolbar-rotate" role="group" aria-label="Rotate all models">
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => onYawTurns(turns - 1)}
          title="Rotate all models 90° left"
          aria-label="Rotate all models 90° left"
        >
          <ArrowUturnLeftIcon aria-hidden="true" />
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => onYawTurns(turns + 1)}
          title="Rotate all models 90° right"
          aria-label="Rotate all models 90° right"
        >
          <ArrowUturnRightIcon aria-hidden="true" />
        </button>
      </div>

      <span className="toolbar-divider" aria-hidden="true" />

      <div className="toolbar-item">
        <button
          type="button"
          className={`toolbar-btn ${openPopover === 'map' ? 'is-open' : ''}`}
          onClick={() => toggle('map')}
          aria-expanded={openPopover === 'map'}
          aria-controls="toolbar-map-panel"
          title="Ground"
          aria-label="Ground"
        >
          <MapIcon aria-hidden="true" />
        </button>
        {openPopover === 'map' && (
          <div
            id="toolbar-map-panel"
            className="toolbar-popover toolbar-popover-start"
            role="group"
            aria-label="Ground"
          >
            <p className="toolbar-popover-title">Ground</p>
            <div className="map-type-grid">
              {GROUND_PLATES.map((plate) => (
                <button
                  key={plate.id}
                  type="button"
                  className={`map-type${plateId === plate.id ? ' is-active' : ''}`}
                  onClick={() => onPlateChange(plate.id)}
                  aria-pressed={plateId === plate.id}
                  title={PLATE_HINTS[plate.id]}
                >
                  <span className="map-type-swatch" aria-hidden="true">
                    {plate.id === 'manhattan' ? <SkylineSwatch /> : <SuburbSwatch />}
                  </span>
                  <span className="map-type-name">{plate.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {downloadItem}

      <div className="toolbar-item">
        <button
          type="button"
          className={`toolbar-btn ${openPopover === 'settings' ? 'is-open' : ''}`}
          onClick={() => toggle('settings')}
          aria-expanded={openPopover === 'settings'}
          aria-controls="toolbar-settings-panel"
          title="Settings"
          aria-label="Settings"
        >
          <Cog6ToothIcon aria-hidden="true" />
        </button>
        {openPopover === 'settings' && (
          <div
            id="toolbar-settings-panel"
            className="toolbar-popover toolbar-popover-end"
            role="group"
            aria-label="Scene settings"
          >
            <p className="toolbar-popover-title">Shadows</p>
            <div className="export-seg">
              <button
                type="button"
                className={shadowsEnabled ? 'is-active' : ''}
                onClick={() => onShadowsChange(true)}
                aria-pressed={shadowsEnabled}
              >
                On
              </button>
              <button
                type="button"
                className={!shadowsEnabled ? 'is-active' : ''}
                onClick={() => onShadowsChange(false)}
                aria-pressed={!shadowsEnabled}
              >
                Off
              </button>
            </div>

            <p className="toolbar-popover-title toolbar-popover-title-spaced">Units</p>
            <div className="export-seg">
              <button
                type="button"
                className={units === 'metric' ? 'is-active' : ''}
                onClick={() => onUnitsChange('metric')}
                aria-pressed={units === 'metric'}
              >
                Meters
              </button>
              <button
                type="button"
                className={units === 'imperial' ? 'is-active' : ''}
                onClick={() => onUnitsChange('imperial')}
                aria-pressed={units === 'imperial'}
              >
                Feet
              </button>
            </div>

            {/* Touch-only: three-finger tilt has no other affordance. CSS hides
                this wherever the pointer is fine (mouse, trackpad). */}
            <div className="gesture-help">
              <p className="toolbar-popover-title">Gestures</p>
              <dl className="gesture-list">
                <dt>1 finger</dt>
                <dd>Orbit</dd>
                <dt>2 fingers</dt>
                <dd>Pinch to zoom, drag to pan</dd>
                <dt>3 fingers</dt>
                <dd>Drag up or down to tilt</dd>
              </dl>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Lower-Manhattan-ish towers: reads as "city" at 66 x 46 px. */
function SkylineSwatch() {
  return (
    <svg viewBox="0 0 66 46" className="map-type-art" aria-hidden="true">
      <rect width="66" height="46" fill="#8ea4b8" />
      <g fill="#5d7185">
        <rect x="4" y="26" width="9" height="20" />
        <rect x="15" y="18" width="8" height="28" />
        <path d="M27 12h7v34h-7z" />
        <path d="M30.5 5l1.5 7h-3z" />
        <rect x="36" y="21" width="9" height="25" />
        <rect x="47" y="15" width="7" height="31" />
        <rect x="56" y="28" width="7" height="18" />
      </g>
      <g fill="#cfe0ee" opacity="0.75">
        <rect x="6" y="29" width="2" height="3" />
        <rect x="10" y="29" width="2" height="3" />
        <rect x="17" y="22" width="2" height="3" />
        <rect x="17" y="29" width="2" height="3" />
        <rect x="29" y="17" width="2" height="3" />
        <rect x="29" y="24" width="2" height="3" />
        <rect x="38" y="25" width="2" height="3" />
        <rect x="49" y="19" width="2" height="3" />
        <rect x="49" y="27" width="2" height="3" />
        <rect x="58" y="32" width="2" height="3" />
      </g>
      <rect y="43" width="66" height="3" fill="#46586a" />
    </svg>
  )
}

/** Two pitched roofs on grass — the counterpart to the skyline. */
function SuburbSwatch() {
  return (
    <svg viewBox="0 0 66 46" className="map-type-art" aria-hidden="true">
      <rect width="66" height="46" fill="#a8cf90" />
      <g fill="#7ba866">
        <rect x="0" y="36" width="66" height="10" />
      </g>
      <g>
        <path d="M8 28l11-8 11 8v15H8z" fill="#e6ddcd" />
        <path d="M6 28.5L19 19l13 9.5-1.4 1.9L19 22l-11.6 8.4z" fill="#b4695a" />
        <rect x="16" y="34" width="6" height="9" fill="#8d7f6c" />
        <path d="M36 31l10-7 10 7v12H36z" fill="#e6ddcd" />
        <path d="M34 31.5L46 23l12 8.5-1.4 1.9L46 26l-10.6 7.4z" fill="#b4695a" />
        <rect x="43" y="36" width="6" height="7" fill="#8d7f6c" />
      </g>
      <rect y="43" width="66" height="3" fill="#6b9459" />
    </svg>
  )
}
