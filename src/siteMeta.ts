/** Canonical origin for Open Graph tags (crawlers need an absolute image URL). */
export const SITE_ORIGIN = 'https://magnitudemap.com'
export const SITE_NAME = 'MagnitudeMap'
export const DEFAULT_DESCRIPTION =
  'Compare real-world object sizes side by side — bombs, guns, tanks, starships, and custom models.'

export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630

export function ogImageUrl(slug: string): string {
  return `${SITE_ORIGIN}/og/${slug}.jpg`
}

export function sharePageUrl(slug: string): string {
  return `${SITE_ORIGIN}/c/${slug}/`
}
