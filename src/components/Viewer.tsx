import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import {
  ComparisonScene,
  type TourUiState,
} from '../babylon/ComparisonScene'
import type { DetonationMode } from '../data/blastEffects'
import type { TourSettings } from '../tourSettings'
import type { PosterOverlayState, PosterPreviewSettings } from '../poster/types'
import { SITE_ORIGIN } from '../siteMeta'
import type { UnitSystem } from '../units'
import { DetonateControls } from './DetonateControls'
import { ExportPoster } from './ExportPoster'
import { FacingControls } from './FacingControls'
import { GroundPlateControls } from './GroundPlateControls'
import { ShadowControls } from './ShadowControls'
import { MagnitudeMapLogo } from './MagnitudeMapLogo'
import { DEFAULT_GROUND_PLATE, type GroundPlateId } from '../data/groundPlates'
import { DEFAULT_SHADOWS_ENABLED } from '../shadows'

export type TourToggle = () => void
export type DebugToggle = () => void

const DEBUG_CLICKS = 5
const DEBUG_WINDOW_MS = 3000

type ViewerProps = {
  activeItemIds: string[]
  units: UnitSystem
  detonationMode: DetonationMode
  showDetonationControls: boolean
  onDetonationModeChange: (mode: DetonationMode) => void
  /** overview = reframe lineup; preserve = keep current camera (library toggles). */
  cameraMode?: 'overview' | 'preserve'
  tourSettings?: TourSettings
  displayYawTurns?: number
  onDisplayYawTurns?: (turns: number) => void
  groundPlateId?: GroundPlateId
  onGroundPlateChange?: (id: GroundPlateId) => void
  shadowsEnabled?: boolean
  onShadowsEnabledChange?: (enabled: boolean) => void
  onTourState?: (tour: TourUiState) => void
  tourToggleRef?: MutableRefObject<TourToggle | null>
  debugToggleRef?: MutableRefObject<DebugToggle | null>
  onSecretDebugToggle?: () => void
  exportTitle?: string
  shareUrl?: string
}

export function Viewer({
  activeItemIds,
  units,
  detonationMode,
  showDetonationControls,
  onDetonationModeChange,
  cameraMode = 'overview',
  tourSettings,
  displayYawTurns = 0,
  onDisplayYawTurns,
  groundPlateId = DEFAULT_GROUND_PLATE,
  onGroundPlateChange,
  shadowsEnabled = DEFAULT_SHADOWS_ENABLED,
  onShadowsEnabledChange,
  onTourState,
  tourToggleRef,
  debugToggleRef,
  onSecretDebugToggle,
  exportTitle = 'Custom comparison',
  shareUrl = `${SITE_ORIGIN}/`,
}: ViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<ComparisonScene | null>(null)
  const onTourStateRef = useRef(onTourState)
  const unitsRef = useRef(units)
  const detonationModeRef = useRef(detonationMode)
  const cameraModeRef = useRef(cameraMode)
  const tourSettingsRef = useRef(tourSettings)
  const displayYawTurnsRef = useRef(displayYawTurns)
  const groundPlateIdRef = useRef(groundPlateId)
  const shadowsEnabledRef = useRef(shadowsEnabled)
  const brandClicksRef = useRef<number[]>([])
  const [posterPreviewActive, setPosterPreviewActive] = useState(false)
  onTourStateRef.current = onTourState
  unitsRef.current = units
  detonationModeRef.current = detonationMode
  cameraModeRef.current = cameraMode
  tourSettingsRef.current = tourSettings
  displayYawTurnsRef.current = displayYawTurns
  groundPlateIdRef.current = groundPlateId
  shadowsEnabledRef.current = shadowsEnabled

  function handleBrandClick() {
    const now = Date.now()
    const recent = brandClicksRef.current.filter((t) => now - t <= DEBUG_WINDOW_MS)
    recent.push(now)
    brandClicksRef.current = recent
    if (recent.length >= DEBUG_CLICKS) {
      brandClicksRef.current = []
      onSecretDebugToggle?.()
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scene = new ComparisonScene(canvas, tourSettingsRef.current)
    scene.setUnits(unitsRef.current)
    scene.setDetonationMode(detonationModeRef.current)
    scene.setDisplayYawTurns(displayYawTurnsRef.current)
    scene.setGroundPlate(groundPlateIdRef.current)
    scene.setShadowsEnabled(shadowsEnabledRef.current)
    sceneRef.current = scene
    const unsubscribe = scene.subscribeTour((state) => {
      onTourStateRef.current?.(state)
    })

    if (tourToggleRef) {
      tourToggleRef.current = () => sceneRef.current?.toggleTour()
    }
    if (debugToggleRef) {
      debugToggleRef.current = () => {
        void sceneRef.current?.toggleDebugInspector()
      }
    }

    return () => {
      if (tourToggleRef) tourToggleRef.current = null
      if (debugToggleRef) debugToggleRef.current = null
      unsubscribe()
      scene.dispose()
      sceneRef.current = null
    }
  }, [tourToggleRef, debugToggleRef])

  useEffect(() => {
    void sceneRef.current?.setActiveItems(activeItemIds, {
      camera: cameraModeRef.current,
    })
  }, [activeItemIds])

  useEffect(() => {
    sceneRef.current?.setUnits(units)
  }, [units])

  useEffect(() => {
    sceneRef.current?.setDetonationMode(detonationMode)
  }, [detonationMode])

  useEffect(() => {
    if (tourSettings) sceneRef.current?.setTourSettings(tourSettings)
  }, [tourSettings])

  useEffect(() => {
    sceneRef.current?.setDisplayYawTurns(displayYawTurns)
  }, [displayYawTurns])

  useEffect(() => {
    sceneRef.current?.setGroundPlate(groundPlateId)
  }, [groundPlateId])

  useEffect(() => {
    sceneRef.current?.setShadowsEnabled(shadowsEnabled)
  }, [shadowsEnabled])

  const setLivePreview = useCallback((settings: PosterPreviewSettings | null) => {
    sceneRef.current?.setPosterPreview(settings)
  }, [])

  const subscribeOverlay = useCallback(
    (listener: (state: PosterOverlayState | null) => void) => {
      return sceneRef.current?.subscribePosterOverlay(listener) ?? (() => {})
    },
    [],
  )

  return (
    <div className={`viewer-stack${posterPreviewActive ? ' is-poster-preview' : ''}`}>
      <canvas
        ref={canvasRef}
        className="viewer-canvas"
        aria-label="MagnitudeMap 3D comparison viewer"
      />
      <button
        type="button"
        className="map-brand"
        onClick={handleBrandClick}
        aria-label="MagnitudeMap"
      >
        <MagnitudeMapLogo className="map-brand-logo" />
      </button>
      <ExportPoster
        disabled={activeItemIds.length === 0}
        units={units}
        title={exportTitle}
        shareUrl={shareUrl}
        previewKey={`${activeItemIds.join(',')}@${displayYawTurns}`}
        capture={(request) => {
          const scene = sceneRef.current
          if (!scene) return Promise.reject(new Error('Viewer is still loading'))
          return scene.capturePosterRender(request)
        }}
        setLivePreview={setLivePreview}
        subscribeOverlay={subscribeOverlay}
        onPreviewActive={setPosterPreviewActive}
      />
      <div className="viewer-docks">
        <GroundPlateControls
          plateId={groundPlateId}
          onChange={(id) => onGroundPlateChange?.(id)}
        />
        <ShadowControls
          enabled={shadowsEnabled}
          onChange={(enabled) => onShadowsEnabledChange?.(enabled)}
        />
        <FacingControls
          variant="overlay"
          yawTurns={displayYawTurns}
          onChange={(turns) => onDisplayYawTurns?.(turns)}
        />
      </div>
      <DetonateControls
        visible={showDetonationControls}
        mode={detonationMode}
        onDetonate={onDetonationModeChange}
        onReset={() => onDetonationModeChange('casing')}
      />
    </div>
  )
}
