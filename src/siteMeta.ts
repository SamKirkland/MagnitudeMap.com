/** Canonical origin for Open Graph tags (crawlers need an absolute image URL). */
export const SITE_ORIGIN = 'https://magnitudemap.com'
export const SITE_NAME = 'MagnitudeMap'
export const DEFAULT_DESCRIPTION =
  'Compare real-world object sizes side by side — bombs, guns, tanks, starships, and custom models.'

/** Broad nominative-use note — do not list individual studios or franchises. */
export const UNOFFICIAL_DISCLAIMER =
  'Unofficial. Names and likenesses identify subjects for size comparison only and do not imply affiliation with any rights holder.'

/** Homepage `<title>`: brand alone is unsearchable, so lead with the job. */
export const SITE_TITLE =
  'MagnitudeMap — Compare the Real Size of Anything, Side by Side'

/** `Star Wars` → `Star Wars Size Comparison — MagnitudeMap` */
export function presetTitle(name: string): string {
  return `${name} Size Comparison — ${SITE_NAME}`
}

/** `<h1>` text; the homepage is a statement, share pages name the lineup. */
export const SITE_HEADING = 'Compare the real size of anything, side by side'

export function presetHeading(name: string): string {
  return `${name} size comparison`
}

export const THEME_COLOR = '#0b0f14'

export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630

export function ogImageAlt(name?: string): string {
  return name
    ? `${name} rendered side by side at true scale on MagnitudeMap`
    : 'Objects rendered side by side at true scale on MagnitudeMap'
}

export function ogImageUrl(slug: string): string {
  return `${SITE_ORIGIN}/og/${slug}.jpg`
}

export function sharePageUrl(slug: string): string {
  return `${SITE_ORIGIN}/c/${slug}/`
}
