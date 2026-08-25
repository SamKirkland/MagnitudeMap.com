/**
 * Mixpanel tracking.
 *
 * The token is a browser token: it ships in the JS bundle and is public by design,
 * so there is nothing to hide in env config.
 *
 * Event and property names are `snake_case`, events are `past_tense_verb + noun`,
 * and events fire only after the action succeeds — never on the click that starts it.
 * The site has no accounts, so there is no `identify()` / `reset()`: every visitor is
 * an anonymous Mixpanel device ID.
 */
import mixpanel from 'mixpanel-browser'

const TOKEN = 'ec53a41e45e5d9ca87b2ed242b5ecbfa'

let ready = false

export function initAnalytics() {
  if (ready) return
  mixpanel.init(TOKEN, {
    debug: import.meta.env.DEV,
    // One SPA route, so autocapture of the initial load is the whole pageview story.
    track_pageview: true,
    persistence: 'localStorage',
  })
  ready = true
}

type Props = Record<string, string | number | boolean | undefined>

function track(event: string, props: Props) {
  if (!ready) return
  mixpanel.track(event, props)
}

/** A visitor toggled a model into the comparison from the library. */
export function trackModelAdded(props: {
  item_id: string
  item_name: string
  item_category: string
  item_count_after: number
}) {
  track('model_added_to_comparison', props)
}

/** Value Moment: the poster image finished building and the download started. */
export function trackPosterExported(props: {
  item_ids: string
  item_count: number
  comparison_title: string
  layout: string
  view: string
  background: string
  resolution: string
  unit_system: string
}) {
  track('poster_exported', props)
}
