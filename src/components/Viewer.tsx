import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { ComparisonScene, TourUiState } from '../babylon/ComparisonScene'
import type { DetonationMode } from '../data/blastEffects'
import type { TourSettings } from '../tourSettings'
import type { PosterOverlayState, PosterPreviewSettings } from '../poster/types'
import { SITE_ORIGIN } from '../siteMeta'
import type { UnitSystem } from '../units'
import { DetonateControls } from './DetonateControls'
import { ExportPoster } from './ExportPoster'
import { MagnitudeMapLogo } from './MagnitudeMapLogo'
import { ViewerToolbar, type ToolbarPopover } from './ViewerToolbar'
import { DEFAULT_GROUND_PLATE, type GroundPlateId } from '../data/groundPlates'
import { DEFAULT_SHADOWS_ENABLED } from '../shadows'

export type TourToggle = () => void
export type DebugToggle = () => void

const DEBUG_CLICKS = 5
const DEBUG_WINDOW_MS = 3000

type ViewerProps = {
  activeItemIds: string[]
  units: UnitSystem
  onUnitsChange: (units: UnitSystem) => void
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
  onUnitsChange,
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
  const activeItemIdsRef = useRef(activeItemIds)
  const brandClicksRef = useRef<number[]>([])
  const [posterPreviewActive, setPosterPreviewActive] = useState(false)
  const [openPopover, setOpenPopover] = useState<ToolbarPopover | null>(null)
  // The poster overlay portals into the viewer stack; state (not a ref) so the
  // first render with a mounted node re-renders the portal target.
  const [stackEl, setStackEl] = useState<HTMLDivElement | null>(null)
  onTourStateRef.current = onTourState
  unitsRef.current = units
  detonationModeRef.current = detonationMode
  cameraModeRef.current = cameraMode
  tourSettingsRef.current = tourSettings
  displayYawTurnsRef.current = displayYawTurns
  groundPlateIdRef.current = groundPlateId
  shadowsEnabledRef.current = shadowsEnabled
  activeItemIdsRef.current = activeItemIds

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

  // Babylon is imported lazily so the ~7 MB engine stays out of the initial
  // bundle and never loads during server-side prerendering.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false
    let scene: ComparisonScene | null = null
    let unsubscribe: (() => void) | null = null

    void (async () => {
      const { ComparisonScene: Scene } = await import('../babylon/ComparisonScene')
      if (cancelled) return

      scene = new Scene(canvas, tourSettingsRef.current)
      scene.setUnits(unitsRef.current)
      scene.setDetonationMode(detonationModeRef.current)
      scene.setDisplayYawTurns(displayYawTurnsRef.current)
      scene.setGroundPlate(groundPlateIdRef.current)
      scene.setShadowsEnabled(shadowsEnabledRef.current)
      sceneRef.current = scene
      unsubscribe = scene.subscribeTour((state) => {
        onTourStateRef.current?.(state)
      })
      // Prop-driven effects below already ran against a null scene; replay the
      // one that carries state the constructor does not take.
      void scene.setActiveItems(activeItemIdsRef.current, {
        camera: cameraModeRef.current,
      })
    })()

    if (tourToggleRef) {
      tourToggleRef.current = () => sceneRef.current?.toggleTour()
    }
    if (debugToggleRef) {
      debugToggleRef.current = () => {
        void sceneRef.current?.toggleDebugInspector()
      }
    }

    return () => {
      cancelled = true
      if (tourToggleRef) tourToggleRef.current = null
      if (debugToggleRef) debugToggleRef.current = null
      unsubscribe?.()
      scene?.dispose()
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
    <div
      ref={setStackEl}
      className={`viewer-stack${posterPreviewActive ? ' is-poster-preview' : ''}`}
    >
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
      <DetonateControls
        visible={showDetonationControls}
        mode={detonationMode}
        onDetonate={onDetonationModeChange}
        onReset={() => onDetonationModeChange('casing')}
      />
      <ViewerToolbar
        yawTurns={displayYawTurns}
        onYawTurns={(turns) => onDisplayYawTurns?.(turns)}
        plateId={groundPlateId}
        onPlateChange={(id) => onGroundPlateChange?.(id)}
        shadowsEnabled={shadowsEnabled}
        onShadowsChange={(enabled) => onShadowsEnabledChange?.(enabled)}
        units={units}
        onUnitsChange={onUnitsChange}
        openPopover={openPopover}
        onOpenPopover={setOpenPopover}
        downloadItem={
          <ExportPoster
            disabled={activeItemIds.length === 0}
            units={units}
            itemIds={activeItemIds}
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
            open={openPopover === 'download'}
            onOpenChange={(next) => setOpenPopover(next ? 'download' : null)}
            overlayContainer={stackEl}
          />
        }
      />
    </div>
  )
}
