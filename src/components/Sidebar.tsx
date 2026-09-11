import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  ChevronDownIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import {
  CATALOG,
  CATEGORY_LABELS,
  COMPARISON_PRESETS,
  type CatalogCategory,
  type CatalogItem,
} from '../data/catalog'
import { MODEL_ATTRIBUTIONS, type ModelAttribution } from '../data/attributions'
import { licenseDeedUrl, shortLicenseLabel } from '../data/licenseDisplay'
import { searchItems } from '../librarySearch'
import { presetHref } from '../selectionUrl'
import { UNOFFICIAL_DISCLAIMER } from '../siteMeta'
import { convertUnitsInText } from '../unitText'
import type { UnitSystem } from '../units'
import { PresetIcon } from './PresetIcons'

type SidebarProps = {
  activeItemIds: string[]
  activePresetId: string | null
  /** Relative prefix for lineup hrefs; see `relativeSiteBase`. */
  linkBase: string
  onToggleItem: (itemId: string) => void
  onApplyPreset: (presetId: string) => void
  onClear: () => void
  /** Descriptions are authored in metric and converted for imperial readers. */
  units: UnitSystem
}

const CATEGORY_ORDER: CatalogCategory[] = [
  'reference',
  'animal',
  'money',
  'oil',
  'vehicle',
  'military',
  'munition',
  'spacecraft',
  'fiction',
  'landmark',
]

function groupByCategory(items: CatalogItem[]) {
  const groups = new Map<CatalogCategory, CatalogItem[]>()
  for (const category of CATEGORY_ORDER) groups.set(category, [])
  for (const item of items) {
    groups.get(item.category)?.push(item)
  }
  return groups
}

function LibraryRow({
  item,
  checked,
  showCredits,
  credit,
  units,
  onToggle,
}: {
  item: CatalogItem
  checked: boolean
  showCredits: boolean
  credit: ModelAttribution | undefined
  units: UnitSystem
  onToggle: (itemId: string) => void
}) {
  const facts = item.facts ? convertUnitsInText(item.facts, units) : null
  const licenseText = credit ? shortLicenseLabel(credit.license) : ''
  const licenseHref = credit ? licenseDeedUrl(credit.license) : null
  return (
    <li>
      <label
        className={`item-row ${checked ? 'is-active' : ''}`}
        title={facts ?? undefined}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(item.id)}
        />
        <span className="swatch" style={{ background: item.color }} />
        <span className="item-text">
          <span className="item-name">{item.name}</span>
          {checked && facts && (
            <span className="item-facts">{facts}</span>
          )}
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
}

export function Sidebar({
  activeItemIds,
  activePresetId,
  linkBase,
  onToggleItem,
  onApplyPreset,
  onClear,
  units,
}: SidebarProps) {
  const [showCredits, setShowCredits] = useState(false)
  const [libraryQuery, setLibraryQuery] = useState('')
  const [lineupQuery, setLineupQuery] = useState('')
  /** Mobile-only accordion: which section body is expanded. Desktop ignores this. */
  const [mobilePanel, setMobilePanel] = useState<'lineups' | 'library'>('lineups')
  const [isMobileLayout, setIsMobileLayout] = useState(false)
  const deferredQuery = useDeferredValue(libraryQuery.trim())
  const deferredLineupQuery = useDeferredValue(lineupQuery.trim())
  const activeSet = new Set(activeItemIds)
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

  const filteredCatalog = useMemo(
    () => searchItems(CATALOG, deferredQuery),
    [deferredQuery],
  )

  const filteredPresets = useMemo(
    () => searchItems(COMPARISON_PRESETS, deferredLineupQuery),
    [deferredLineupQuery],
  )

  const grouped = useMemo(
    () => (deferredQuery ? null : groupByCategory(filteredCatalog)),
    [deferredQuery, filteredCatalog],
  )
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
        </div>

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
                  {/* A real link so crawlers can reach every lineup page;
                      plain clicks stay in-app, modified clicks open normally. */}
                  <a
                    href={presetHref(linkBase, preset)}
                    className={`preset-card ${selected ? 'is-selected' : ''}`}
                    aria-current={selected ? 'page' : undefined}
                    onClick={(event) => {
                      if (
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey
                      ) {
                        return
                      }
                      event.preventDefault()
                      onApplyPreset(preset.id)
                    }}
                    title={convertUnitsInText(preset.description, units)}
                  >
                    <PresetIcon presetId={preset.id} className="preset-icon" />
                    <span className="preset-name">{preset.name}</span>
                  </a>
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
            <button
              type="button"
              className="btn btn-clear"
              onClick={onClear}
              disabled={activeItemIds.length === 0}
            >
              Clear
            </button>
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
            {deferredQuery ? (
              <ul className="item-list">
                {filteredCatalog.map((item) => (
                  <LibraryRow
                    key={item.id}
                    item={item}
                    checked={activeSet.has(item.id)}
                    showCredits={showCredits}
                    credit={creditsById.get(item.id) ?? (item.category === 'oil' ? creditsById.get('twemoji-country-flags') : undefined)}
                    units={units}
                    onToggle={onToggleItem}
                  />
                ))}
              </ul>
            ) : (
              grouped &&
              [...grouped.entries()].map(([category, items]) => {
                if (!items.length) return null
                return (
                  <div key={category} className="category-block">
                    <h3>{CATEGORY_LABELS[category]}</h3>
                    <ul className="item-list">
                      {items.map((item) => (
                        <LibraryRow
                          key={item.id}
                          item={item}
                          checked={activeSet.has(item.id)}
                          showCredits={showCredits}
                          credit={creditsById.get(item.id) ?? (item.category === 'oil' ? creditsById.get('twemoji-country-flags') : undefined)}
                          units={units}
                          onToggle={onToggleItem}
                        />
                      ))}
                    </ul>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </section>
      <p className="sidebar-disclaimer">{UNOFFICIAL_DISCLAIMER}</p>
    </aside>
  )
}
