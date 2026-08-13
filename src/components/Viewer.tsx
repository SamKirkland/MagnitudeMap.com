import { useEffect, useRef, type MutableRefObject } from 'react'
import {
  ComparisonScene,
  type TourUiState,
} from '../babylon/ComparisonScene'
import type { DetonationMode } from '../data/blastEffects'
import type { TourSettings } from '../tourSettings'
import type { UnitSystem } from '../units'
import { DetonateControls } from './DetonateControls'
import { FacingControls } from './FacingControls'
import { MagnitudeMapLogo } from './MagnitudeMapLogo'

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
  onTourState?: (tour: TourUiState) => void
  tourToggleRef?: MutableRefObject<TourToggle | null>
  debugToggleRef?: MutableRefObject<DebugToggle | null>
  onSecretDebugToggle?: () => void
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
  onTourState,
  tourToggleRef,
  debugToggleRef,
  onSecretDebugToggle,
}: ViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<ComparisonScene | null>(null)
  const onTourStateRef = useRef(onTourState)
  const unitsRef = useRef(units)
  const detonationModeRef = useRef(detonationMode)
  const cameraModeRef = useRef(cameraMode)
  const tourSettingsRef = useRef(tourSettings)
  const displayYawTurnsRef = useRef(displayYawTurns)
  const brandClicksRef = useRef<number[]>([])
  onTourStateRef.current = onTourState
  unitsRef.current = units
  detonationModeRef.current = detonationMode
  cameraModeRef.current = cameraMode
  tourSettingsRef.current = tourSettings
  displayYawTurnsRef.current = displayYawTurns

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

  return (
    <div className="viewer-stack">
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
      <FacingControls
        variant="overlay"
        yawTurns={displayYawTurns}
        onChange={(turns) => onDisplayYawTurns?.(turns)}
      />
      <DetonateControls
        visible={showDetonationControls}
        mode={detonationMode}
        onDetonate={onDetonationModeChange}
        onReset={() => onDetonationModeChange('casing')}
      />
    </div>
  )
}
