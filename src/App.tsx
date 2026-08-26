import { useEffect, useMemo, useRef, useState } from 'react'
import { CATALOG_BY_ID, COMPARISON_PRESETS } from './data/catalog'
import type { DetonationMode } from './data/blastEffects'
import { hasBlastEffect } from './data/blastEffects'
import type { TourUiState } from './babylon/ComparisonScene'
import { trackModelAdded } from './analytics/mixpanel'
import { Sidebar } from './components/Sidebar'
import { Viewer, type DebugToggle, type TourToggle } from './components/Viewer'
import {
  parseSelectionFromLocation,
  relativeSiteBase,
  replaceSelectionUrl,
  selectionPathname,
  selectionShareUrl,
  type SelectionFromUrl,
} from './selectionUrl'
import {
  DEFAULT_UNIT_SYSTEM,
  loadUnitSystem,
  saveUnitSystem,
  type UnitSystem,
} from './units'
import {
  clampTourSettings,
  DEFAULT_TOUR_SETTINGS,
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
import {
  DEFAULT_SHADOWS_ENABLED,
  loadShadowsEnabled,
  saveShadowsEnabled,
} from './shadows'
import { DEFAULT_GROUND_PLATE, type GroundPlateId } from './data/groundPlates'
import {
  SITE_HEADING,
  SITE_TITLE,
  presetHeading,
  presetTitle,
} from './siteMeta'

const DEFAULT_PRESET = COMPARISON_PRESETS[0]

function initialSelection(seed?: SelectionFromUrl | null) {
  const fromUrl = seed ?? parseSelectionFromLocation()
  if (fromUrl) return fromUrl
  return {
    presetId: DEFAULT_PRESET.id as string | null,
    itemIds: [...DEFAULT_PRESET.itemIds],
  }
}

/** `initialSelection` is supplied by the prerenderer, which has no `window`. */
export type AppProps = {
  initialSelection?: SelectionFromUrl | null
}

export default function App({ initialSelection: seed }: AppProps = {}) {
  const boot = useMemo(() => initialSelection(seed), [seed])
  const [activeItemIds, setActiveItemIds] = useState<string[]>(boot.itemIds)
  const [activePresetId, setActivePresetId] = useState<string | null>(boot.presetId)
  const [tourPlaying, setTourPlaying] = useState(false)
  // Persisted preferences start at their defaults so the first client render
  // matches the prerendered HTML, which has no localStorage. The effect below
  // swaps in the stored values immediately after mount.
  const [units, setUnits] = useState<UnitSystem>(DEFAULT_UNIT_SYSTEM)
  const [tourSettings, setTourSettings] = useState<TourSettings>(DEFAULT_TOUR_SETTINGS)
  const [displayYawTurns, setDisplayYawTurns] = useState(0)
  const [groundPlateId, setGroundPlateId] = useState<GroundPlateId>(DEFAULT_GROUND_PLATE)
  const [shadowsEnabled, setShadowsEnabled] = useState(DEFAULT_SHADOWS_ENABLED)
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

  // Lineup links are relative to whichever URL the current selection implies,
  // so they stay correct as the app rewrites the address bar.
  const linkBase = useMemo(
    () => relativeSiteBase(selectionPathname(activeItemIds, shownPresetId)),
    [activeItemIds, shownPresetId],
  )

  /**
   * Name of the lineup this page represents, or `null` for the homepage.
   * The default lineup lives at `/`, so it does not name itself.
   */
  const pageName = useMemo(() => {
    if (selectionPathname(activeItemIds, shownPresetId) === '/') return null
    return (
      COMPARISON_PRESETS.find((entry) => entry.id === shownPresetId)?.name ?? null
    )
  }, [activeItemIds, shownPresetId])

  const heading = pageName ? presetHeading(pageName) : SITE_HEADING

  const showDetonationControls = useMemo(
    () => activeItemIds.some((id) => hasBlastEffect(id)),
    [activeItemIds],
  )

  useEffect(() => {
    setUnits(loadUnitSystem())
    setTourSettings(loadTourSettings())
    setDisplayYawTurns(loadDisplayYawTurns())
    setGroundPlateId(loadGroundPlate())
    setShadowsEnabled(loadShadowsEnabled())
  }, [])

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

  // The prerendered pages ship the right <title>; match it as the URL changes
  // so a bookmark or a share from an in-app navigation is labelled correctly.
  useEffect(() => {
    document.title = pageName ? presetTitle(pageName) : SITE_TITLE
  }, [pageName])

  function handleToggleItem(itemId: string) {
    setCameraMode('preserve')
    setActivePresetId(null)
    const adding = !activeItemIds.includes(itemId)
    const next = adding
      ? [...activeItemIds, itemId]
      : activeItemIds.filter((id) => id !== itemId)
    setActiveItemIds(next)
    const item = adding ? CATALOG_BY_ID[itemId] : undefined
    if (item) {
      trackModelAdded({
        item_id: item.id,
        item_name: item.name,
        item_category: item.category,
        item_count_after: next.length,
      })
    }
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
      {/* Only heading on the page; the visible brand mark is an SVG. */}
      <h1 className="sr-only">{heading}</h1>
      <Sidebar
        linkBase={linkBase}
        activeItemIds={activeItemIds}
        activePresetId={shownPresetId}
        tourPlaying={tourPlaying}
        tourSettings={tourSettings}
        onToggleItem={handleToggleItem}
        onApplyPreset={handleApplyPreset}
        onClear={handleClear}
        onToggleTour={() => tourToggleRef.current?.()}
        onTourSettingsChange={handleTourSettingsChange}
        displayYawTurns={displayYawTurns}
        onDisplayYawTurns={handleDisplayYawTurns}
        units={units}
      />
      <main className="viewer-pane">
        <Viewer
          activeItemIds={activeItemIds}
          units={units}
          onUnitsChange={handleUnitsChange}
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
