export {
  DEFAULT_DESCRIPTION,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  SITE_NAME,
  SITE_ORIGIN,
  ogImageUrl,
  sharePageUrl,
} from './siteMeta'

/** Directory `public/` and Vite assets are served from, even on `/c/{preset}/` share pages. */
export function siteBaseUrl(): string {
  const path = window.location.pathname
  const share = path.match(/^(.*)\/c\/[^/]+\/?$/)
  if (share) {
    const prefix = share[1]
    return prefix === '' ? '/' : `${prefix}/`
  }
  const base = import.meta.env.BASE_URL
  if (base === './' || base === '.') {
    if (path.endsWith('/')) return path
    const cut = path.lastIndexOf('/')
    return cut <= 0 ? '/' : path.slice(0, cut + 1)
  }
  return base
}

export function publicAssetUrl(relativePath: string): string {
  const clean = relativePath.replace(/^\//, '')
  return new URL(clean, new URL(siteBaseUrl(), window.location.origin)).href
}
