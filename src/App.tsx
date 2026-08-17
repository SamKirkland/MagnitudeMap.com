import { useEffect, useMemo, useRef, useState } from 'react'
import { COMPARISON_PRESETS } from './data/catalog'
import type { DetonationMode } from './data/blastEffects'
import { hasBlastEffect } from './data/blastEffects'
import type { TourUiState } from './babylon/ComparisonScene'
import { Sidebar } from './components/Sidebar'
import { Viewer, type DebugToggle, type TourToggle } from './components/Viewer'
import {
  parseSelectionFromLocation,
  replaceSelectionUrl,
  selectionShareUrl,
} from './selectionUrl'
import { loadUnitSystem, saveUnitSystem, type UnitSystem } from './units'
import {
  clampTourSettings,
  loadTourSettings,
  saveTourSettings,
  type TourSettings,
} from './tourSettings'
import {
  loadDisplayYawTurns,
  normalizeYawTurns,
  saveDisplayYawTurns,
} from './modelOrientation'
import { loadGroundPlate, saveGroundPlate } from './groundPlate'
import { loadShadowsEnabled, saveShadowsEnabled } from './shadows'
import type { GroundPlateId } from './data/groundPlates'

const DEFAULT_PRESET = COMPARISON_PRESETS[0]

function initialSelection() {
  const fromUrl = parseSelectionFromLocation()
  if (fromUrl) return fromUrl
  return {
    presetId: DEFAULT_PRESET.id as string | null,
    itemIds: [...DEFAULT_PRESET.itemIds],
  }
}

export default function App() {
  const boot = useMemo(() => initialSelection(), [])
  const [activeItemIds, setActiveItemIds] = useState<string[]>(boot.itemIds)
  const [activePresetId, setActivePresetId] = useState<string | null>(boot.presetId)
  const [tourPlaying, setTourPlaying] = useState(false)
  const [units, setUnits] = useState<UnitSystem>(() => loadUnitSystem())
  const [tourSettings, setTourSettings] = useState<TourSettings>(() => loadTourSettings())
  const [displayYawTurns, setDisplayYawTurns] = useState(() => loadDisplayYawTurns())
  const [groundPlateId, setGroundPlateId] = useState<GroundPlateId>(() => loadGroundPlate())
  const [shadowsEnabled, setShadowsEnabled] = useState(() => loadShadowsEnabled())
  const [detonationMode, setDetonationMode] = useState<DetonationMode>('casing')
  const [cameraMode, setCameraMode] = useState<'overview' | 'preserve'>('overview')
  const tourToggleRef = useRef<TourToggle | null>(null)
  const debugToggleRef = useRef<DebugToggle | null>(null)

  const presetMatchId = useMemo(() => {
    const key = [...activeItemIds].sort().join('|')
    const match = COMPARISON_PRESETS.find(
      (preset) => [...preset.itemIds].sort().join('|') === key,
    )
    return match?.id ?? null
  }, [activeItemIds])

  const shownPresetId = activePresetId ?? presetMatchId

  const exportTitle = useMemo(() => {
    if (!shownPresetId) return 'Custom comparison'
    return (
      COMPARISON_PRESETS.find((preset) => preset.id === shownPresetId)?.name ??
      'Custom comparison'
    )
  }, [shownPresetId])

  const shareUrl = useMemo(
    () => selectionShareUrl(activeItemIds, shownPresetId),
    [activeItemIds, shownPresetId],
  )

  const showDetonationControls = useMemo(
    () => activeItemIds.some((id) => hasBlastEffect(id)),
    [activeItemIds],
  )

  // Leave blast visuals when no munition remains selected.
  useEffect(() => {
    if (!showDetonationControls && detonationMode !== 'casing') {
      setDetonationMode('casing')
    }
  }, [showDetonationControls, detonationMode])

  // Keep the address bar in sync without pushing history entries.
  useEffect(() => {
    replaceSelectionUrl(activeItemIds, shownPresetId)
  }, [activeItemIds, shownPresetId])

  function handleToggleItem(itemId: string) {
    setCameraMode('preserve')
    setActivePresetId(null)
    setActiveItemIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    )
  }

  function handleApplyPreset(presetId: string) {
    const preset = COMPARISON_PRESETS.find((entry) => entry.id === presetId)
    if (!preset) return
    setCameraMode('overview')
    setActivePresetId(preset.id)
    setActiveItemIds([...preset.itemIds])
  }

  function handleClear() {
    setCameraMode('overview')
    setActivePresetId(null)
    setActiveItemIds([])
  }

  function handleTourState(tour: TourUiState) {
    setTourPlaying(tour.playing)
  }

  function handleUnitsChange(next: UnitSystem) {
    setUnits(next)
    saveUnitSystem(next)
  }

  function handleTourSettingsChange(patch: Partial<TourSettings>) {
    setTourSettings((current) => {
      const next = clampTourSettings({ ...current, ...patch })
      saveTourSettings(next)
      return next
    })
  }

  function handleDisplayYawTurns(turns: number) {
    const next = normalizeYawTurns(turns)
    setDisplayYawTurns(next)
    saveDisplayYawTurns(next)
  }

  function handleGroundPlate(id: GroundPlateId) {
    setGroundPlateId(id)
    saveGroundPlate(id)
  }

  function handleShadowsEnabled(enabled: boolean) {
    setShadowsEnabled(enabled)
    saveShadowsEnabled(enabled)
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeItemIds={activeItemIds}
        activePresetId={shownPresetId}
        tourPlaying={tourPlaying}
        tourSettings={tourSettings}
        units={units}
        onToggleItem={handleToggleItem}
        onApplyPreset={handleApplyPreset}
        onClear={handleClear}
        onToggleTour={() => tourToggleRef.current?.()}
        onUnitsChange={handleUnitsChange}
        onTourSettingsChange={handleTourSettingsChange}
        displayYawTurns={displayYawTurns}
        onDisplayYawTurns={handleDisplayYawTurns}
      />
      <main className="viewer-pane">
        <Viewer
          activeItemIds={activeItemIds}
          units={units}
          detonationMode={detonationMode}
          showDetonationControls={showDetonationControls}
          onDetonationModeChange={setDetonationMode}
          cameraMode={cameraMode}
          tourSettings={tourSettings}
          displayYawTurns={displayYawTurns}
          onDisplayYawTurns={handleDisplayYawTurns}
          groundPlateId={groundPlateId}
          onGroundPlateChange={handleGroundPlate}
          shadowsEnabled={shadowsEnabled}
          onShadowsEnabledChange={handleShadowsEnabled}
          onTourState={handleTourState}
          tourToggleRef={tourToggleRef}
          debugToggleRef={debugToggleRef}
          onSecretDebugToggle={() => debugToggleRef.current?.()}
          exportTitle={exportTitle}
          shareUrl={shareUrl}
        />
      </main>
    </div>
  )
}
