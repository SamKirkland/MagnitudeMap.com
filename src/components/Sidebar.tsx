import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  ChevronDownIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import Fuse, { type IFuseOptions } from 'fuse.js'
import {
  CATALOG,
  CATEGORY_LABELS,
  COMPARISON_PRESETS,
  type CatalogCategory,
  type CatalogItem,
  type ComparisonPreset,
} from '../data/catalog'
import { MODEL_ATTRIBUTIONS } from '../data/attributions'
import { licenseDeedUrl, shortLicenseLabel } from '../data/licenseDisplay'
import type { UnitSystem } from '../units'
import { SPREAD_MAX, SPREAD_MIN, type TourSettings } from '../tourSettings'
import { PresetIcon } from './PresetIcons'
import { FacingControls } from './FacingControls'

type SidebarProps = {
  activeItemIds: string[]
  activePresetId: string | null
  tourPlaying: boolean
  tourSettings: TourSettings
  units: UnitSystem
  onToggleItem: (itemId: string) => void
  onApplyPreset: (presetId: string) => void
  onClear: () => void
  onToggleTour: () => void
  onUnitsChange: (units: UnitSystem) => void
  onTourSettingsChange: (patch: Partial<TourSettings>) => void
  displayYawTurns: number
  onDisplayYawTurns: (turns: number) => void
}

const CATEGORY_ORDER: CatalogCategory[] = [
  'reference',
  'animal',
  'money',
  'vehicle',
  'military',
  'munition',
  'spacecraft',
  'fiction',
  'landmark',
]

const FUSE_OPTIONS: IFuseOptions<CatalogItem> = {
  keys: [
    { name: 'name', weight: 0.45 },
    { name: 'tags', weight: 0.35 },
    { name: 'category', weight: 0.1 },
    { name: 'blurb', weight: 0.1 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  includeScore: true,
  minMatchCharLength: 1,
}

const PRESET_FUSE_OPTIONS: IFuseOptions<ComparisonPreset> = {
  keys: [
    { name: 'name', weight: 0.5 },
    { name: 'tags', weight: 0.35 },
    { name: 'description', weight: 0.15 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  includeScore: true,
  minMatchCharLength: 1,
}

function groupByCategory(items: CatalogItem[]) {
  const groups = new Map<CatalogCategory, CatalogItem[]>()
  for (const category of CATEGORY_ORDER) groups.set(category, [])
  for (const item of items) {
    groups.get(item.category)?.push(item)
  }
  return groups
}

export function Sidebar({
  activeItemIds,
  activePresetId,
  tourPlaying,
  tourSettings,
  units,
  onToggleItem,
  onApplyPreset,
  onClear,
  onToggleTour,
  onUnitsChange,
  onTourSettingsChange,
  displayYawTurns,
  onDisplayYawTurns,
}: SidebarProps) {
  const [showCredits, setShowCredits] = useState(false)
  const [showTourOptions, setShowTourOptions] = useState(false)
  const [libraryQuery, setLibraryQuery] = useState('')
  const [lineupQuery, setLineupQuery] = useState('')
  /** Mobile-only accordion: which section body is expanded. Desktop ignores this. */
  const [mobilePanel, setMobilePanel] = useState<'lineups' | 'library'>('lineups')
  const [isMobileLayout, setIsMobileLayout] = useState(false)
  const deferredQuery = useDeferredValue(libraryQuery.trim())
  const deferredLineupQuery = useDeferredValue(lineupQuery.trim())
  const activeSet = new Set(activeItemIds)
  const canTour = activeItemIds.length > 0
  const lineupsOpen = !isMobileLayout || mobilePanel === 'lineups'
  const libraryOpen = !isMobileLayout || mobilePanel === 'library'
  const creditsById = useMemo(
    () => new Map(MODEL_ATTRIBUTIONS.map((entry) => [entry.id, entry])),
    [],
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)')
    const sync = () => setIsMobileLayout(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const fuse = useMemo(() => new Fuse(CATALOG, FUSE_OPTIONS), [])
  const presetFuse = useMemo(
    () => new Fuse(COMPARISON_PRESETS, PRESET_FUSE_OPTIONS),
    [],
  )

  const filteredCatalog = useMemo(() => {
    if (!deferredQuery) return CATALOG
    return fuse.search(deferredQuery).map((result) => result.item)
  }, [deferredQuery, fuse])

  const filteredPresets = useMemo(() => {
    if (!deferredLineupQuery) return COMPARISON_PRESETS
    return presetFuse.search(deferredLineupQuery).map((result) => result.item)
  }, [deferredLineupQuery, presetFuse])

  const grouped = useMemo(() => groupByCategory(filteredCatalog), [filteredCatalog])
  const hasResults = filteredCatalog.length > 0
  const hasPresetResults = filteredPresets.length > 0

  return (
    <aside className="sidebar">
      <section
        className={`sidebar-section sidebar-presets ${lineupsOpen ? 'is-open' : 'is-collapsed'}`}
        aria-label="Lineups"
      >
        <div className="section-heading">
          <button
            type="button"
            className="section-accordion-toggle"
            onClick={() => setMobilePanel('lineups')}
            aria-expanded={lineupsOpen}
            aria-controls="sidebar-lineups-body"
            tabIndex={isMobileLayout ? 0 : -1}
          >
            <h2>Lineups</h2>
            <ChevronDownIcon className="section-accordion-chevron" aria-hidden="true" />
          </button>
          <div className="section-heading-actions">
            <div className="tour-controls">
              <button
                type="button"
                className={`text-btn tour-btn ${tourPlaying ? 'is-active' : ''}`}
                onClick={onToggleTour}
                disabled={!canTour}
              >
                {tourPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                type="button"
                className={`tour-options-toggle ${showTourOptions ? 'is-open' : ''}`}
                onClick={() => setShowTourOptions((open) => !open)}
                aria-expanded={showTourOptions}
                aria-controls="tour-options"
                title="Play options"
                aria-label={showTourOptions ? 'Hide play options' : 'Show play options'}
              >
                <ChevronDownIcon aria-hidden="true" />
              </button>
            </div>
            <button type="button" className="text-btn" onClick={onClear}>
              Clear
            </button>
          </div>
        </div>

        {showTourOptions && (
          <div id="tour-options" className="tour-options" role="region" aria-label="Play options">
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

            <FacingControls
              yawTurns={displayYawTurns}
              onChange={onDisplayYawTurns}
            />
          </div>
        )}

        <div id="sidebar-lineups-body" className="sidebar-section-body">
          <label className="library-search">
            <MagnifyingGlassIcon aria-hidden="true" className="library-search-icon" />
            <input
              type="search"
              value={lineupQuery}
              onChange={(event) => setLineupQuery(event.target.value)}
              placeholder="Search lineups…"
              aria-label="Search lineups"
              autoComplete="off"
              spellCheck={false}
            />
            {lineupQuery && (
              <button
                type="button"
                className="library-search-clear"
                onClick={() => setLineupQuery('')}
                aria-label="Clear lineup search"
              >
                Clear
              </button>
            )}
          </label>

          <ul className="preset-list">
            {!hasPresetResults && (
              <li className="library-empty">No lineups match “{deferredLineupQuery}”.</li>
            )}
            {filteredPresets.map((preset) => {
              const selected = activePresetId === preset.id
              return (
                <li key={preset.id}>
                  <button
                    type="button"
                    className={`preset-card ${selected ? 'is-selected' : ''}`}
                    onClick={() => onApplyPreset(preset.id)}
                    title={preset.description}
                  >
                    <PresetIcon presetId={preset.id} className="preset-icon" />
                    <span className="preset-name">{preset.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      <section
        className={`sidebar-section sidebar-library ${libraryOpen ? 'is-open' : 'is-collapsed'}`}
        aria-label="Object library"
      >
        <div className="section-heading sidebar-library-heading">
          <button
            type="button"
            className="section-accordion-toggle"
            onClick={() => setMobilePanel('library')}
            aria-expanded={libraryOpen}
            aria-controls="sidebar-library-body"
            tabIndex={isMobileLayout ? 0 : -1}
          >
            <h2>Library</h2>
            <ChevronDownIcon className="section-accordion-chevron" aria-hidden="true" />
          </button>
          <div className="section-heading-actions library-heading-actions">
            <div className="unit-toggle" role="group" aria-label="Units">
              <button
                type="button"
                className={units === 'metric' ? 'is-active' : ''}
                onClick={() => onUnitsChange('metric')}
              >
                m
              </button>
              <span className="unit-toggle-sep" aria-hidden="true">
                /
              </span>
              <button
                type="button"
                className={units === 'imperial' ? 'is-active' : ''}
                onClick={() => onUnitsChange('imperial')}
              >
                ft
              </button>
            </div>
            <button
              type="button"
              className={`credits-icon-btn ${showCredits ? 'is-active' : ''}`}
              onClick={() => setShowCredits((v) => !v)}
              title={showCredits ? 'Hide credits' : 'Show credits'}
              aria-label={showCredits ? 'Hide model credits' : 'Show model credits'}
              aria-pressed={showCredits}
            >
              <InformationCircleIcon aria-hidden="true" />
            </button>
          </div>
        </div>

        <div id="sidebar-library-body" className="sidebar-section-body">
          <label className="library-search">
            <MagnifyingGlassIcon aria-hidden="true" className="library-search-icon" />
            <input
              type="search"
              value={libraryQuery}
              onChange={(event) => setLibraryQuery(event.target.value)}
              placeholder="Search name or tags…"
              aria-label="Search library"
              autoComplete="off"
              spellCheck={false}
            />
            {libraryQuery && (
              <button
                type="button"
                className="library-search-clear"
                onClick={() => setLibraryQuery('')}
                aria-label="Clear search"
              >
                Clear
              </button>
            )}
          </label>

          <div className="sidebar-library-scroll">
            {!hasResults && (
              <p className="library-empty">No models match “{deferredQuery}”.</p>
            )}
            {[...grouped.entries()].map(([category, items]) => {
              if (!items.length) return null
              return (
                <div key={category} className="category-block">
                  <h3>{CATEGORY_LABELS[category]}</h3>
                  <ul className="item-list">
                    {items.map((item) => {
                      const checked = activeSet.has(item.id)
                      const credit = creditsById.get(item.id)
                      const licenseText = credit
                        ? shortLicenseLabel(credit.license)
                        : ''
                      const licenseHref = credit
                        ? licenseDeedUrl(credit.license)
                        : null
                      return (
                        <li key={item.id}>
                          <label className={`item-row ${checked ? 'is-active' : ''}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => onToggleItem(item.id)}
                            />
                            <span className="swatch" style={{ background: item.color }} />
                            <span className="item-text">
                              <span className="item-name">{item.name}</span>
                              {showCredits && credit && (
                                <span className="item-credit">
                                  {credit.source ? (
                                    <a
                                      href={credit.source}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      {credit.author}
                                    </a>
                                  ) : (
                                    credit.author
                                  )}
                                  <span aria-hidden="true"> · </span>
                                  {licenseHref ? (
                                    <a
                                      href={licenseHref}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      {licenseText}
                                    </a>
                                  ) : (
                                    licenseText
                                  )}
                                </span>
                              )}
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </aside>
  )
}
