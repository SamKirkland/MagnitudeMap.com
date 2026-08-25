import { renderToString } from 'react-dom/server'
import App from './App'
import { findPresetBySlug } from './selectionUrl'

/**
 * Render the app to static HTML at build time.
 *
 * `slug` is the `/c/{slug}/` share-page segment, or `null` for the homepage.
 * There is no `window` here, so the selection the client would read from the
 * URL is resolved up front and passed in as a prop.
 */
export function render(slug: string | null): string {
  const preset = slug ? findPresetBySlug(slug) : undefined
  const initialSelection = preset
    ? { presetId: preset.id, itemIds: [...preset.itemIds] }
    : null
  return renderToString(<App initialSelection={initialSelection} />)
}
