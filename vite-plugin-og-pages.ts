import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { CATALOG_BY_ID, COMPARISON_PRESETS } from './src/data/catalog'
import {
  DEFAULT_DESCRIPTION,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  SITE_NAME,
  SITE_ORIGIN,
  THEME_COLOR,
  ogImageAlt,
  ogImageUrl,
  presetTitle,
  sharePageUrl,
} from './src/siteMeta'

function toSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function presetSlug(name: string): string {
  return toSlug(name)
}

const rootDir = dirname(fileURLToPath(import.meta.url))

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

/**
 * A page must never advertise an image that 404s — social platforms cache the
 * miss and the link unfurls blank. Lineups whose capture has not been run yet
 * fall back to the default card rather than pointing at nothing.
 */
function resolveOgImage(slug: string, missing: string[]): string {
  if (existsSync(resolve(rootDir, 'public/og', `${slug}.jpg`))) {
    return ogImageUrl(slug)
  }
  missing.push(slug)
  return ogImageUrl('default')
}

/** `</script>` inside a JSON-LD block would close the tag early. */
function jsonLd(data: unknown): string {
  const json = JSON.stringify(data, null, 2).replace(/</g, '\\u003c')
  return `<script type="application/ld+json">
${json}
    </script>`
}

/** ItemList of the lineup's objects — the names people actually search for. */
function presetStructuredData(preset: {
  name: string
  description: string
  itemIds: string[]
  url: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${preset.name} size comparison`,
    description: preset.description,
    url: preset.url,
    numberOfItems: preset.itemIds.length,
    itemListElement: preset.itemIds.map((id, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: CATALOG_BY_ID[id]?.name ?? id,
    })),
  }
}

function ogMetaBlock(opts: {
  title: string
  description: string
  url: string
  image: string
  imageAlt: string
  structuredData: unknown
}): string {
  const title = escapeAttr(opts.title)
  const description = escapeAttr(opts.description)
  return `<!-- og-meta -->
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="theme-color" content="${THEME_COLOR}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${opts.url}" />
    <meta property="og:image" content="${opts.image}" />
    <meta property="og:image:width" content="${OG_IMAGE_WIDTH}" />
    <meta property="og:image:height" content="${OG_IMAGE_HEIGHT}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:alt" content="${escapeAttr(opts.imageAlt)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${opts.image}" />
    <meta name="twitter:image:alt" content="${escapeAttr(opts.imageAlt)}" />
    <link rel="canonical" href="${opts.url}" />
    ${jsonLd(opts.structuredData)}
    <!-- /og-meta -->`
}

function replaceOgMeta(html: string, block: string): string {
  if (!html.includes('<!-- og-meta -->')) {
    return html.replace('</head>', `${block}\n  </head>`)
  }
  return html.replace(/<!-- og-meta -->[\s\S]*?<!-- \/og-meta -->/, block)
}

/** Nested `/c/{slug}/index.html` must climb two levels to reach Vite assets. */
function rewriteRelativeAssetUrls(html: string): string {
  return html.replace(/(\s(?:src|href))="\.\//g, '$1="../../')
}

function readBody(req: IncomingMessage): Promise<Uint8Array> {
  return new Promise((resolveBody, reject) => {
    const chunks: Uint8Array[] = []
    req.on('data', (chunk: Uint8Array) => {
      chunks.push(chunk)
    })
    req.on('end', () => {
      const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
      const body = new Uint8Array(total)
      let offset = 0
      for (const chunk of chunks) {
        body.set(chunk, offset)
        offset += chunk.byteLength
      }
      resolveBody(body)
    })
    req.on('error', reject)
  })
}

const RETRYABLE_FS_CODES = new Set([
  'UNKNOWN',
  'EBUSY',
  'EPERM',
  'EACCES',
  'EAGAIN',
])

function isRetryableFsError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false
  return RETRYABLE_FS_CODES.has(String((error as { code: unknown }).code))
}

/** Windows often reports a brief lock (Watcher / Defender) as UNKNOWN. */
async function writeFileWithRetry(path: string, data: Uint8Array): Promise<void> {
  let lastError: unknown
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      writeFileSync(path, data)
      return
    } catch (error) {
      lastError = error
      if (!isRetryableFsError(error)) throw error
      await sleep(50 * 2 ** Math.min(attempt, 4))
    }
  }
  throw lastError
}

function sendError(res: ServerResponse, status: number, message: string) {
  res.statusCode = status
  res.setHeader('content-type', 'text/plain')
  res.end(message)
}

/** Dev-only: capture page POSTs JPEGs into `public/og/`. */
export function ogWritePlugin(): Plugin {
  return {
    name: 'og-write',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next) => {
        const path = req.url?.split('?')[0]
        if (path !== '/__og-write' || req.method !== 'POST') {
          next()
          return
        }
        void (async () => {
          try {
            const slug = String(req.headers['x-og-slug'] ?? '')
            if (!/^[a-z0-9-]+$/.test(slug)) {
              sendError(res, 400, 'bad slug')
              return
            }
            const body = await readBody(req)
            const dir = resolve(rootDir, 'public/og')
            mkdirSync(dir, { recursive: true })
            await writeFileWithRetry(resolve(dir, `${slug}.jpg`), body)
            res.statusCode = 200
            res.setHeader('content-type', 'text/plain')
            res.end('ok')
          } catch (error) {
            const message = error instanceof Error ? error.message : 'write failed'
            sendError(res, 500, message)
          }
        })()
      })
    },
  }
}

/** After `vite build`, emit `/c/{preset}/index.html` with that lineup's OG tags. */
export function ogPagesPlugin(): Plugin {
  return {
    name: 'og-pages',
    closeBundle() {
      const indexPath = resolve(rootDir, 'dist/index.html')
      let indexHtml: string
      try {
        indexHtml = readFileSync(indexPath, 'utf8')
      } catch {
        return
      }

      const missingImages: string[] = []
      for (const preset of COMPARISON_PRESETS) {
        const slug = presetSlug(preset.name)
        // The default lineup is what `/` already shows. Its `/c/` page still
        // exists so the slug unfurls, but it points search engines at `/`
        // instead of competing with it.
        const url = isHomepagePreset(preset) ? `${SITE_ORIGIN}/` : sharePageUrl(slug)
        const description = preset.description || DEFAULT_DESCRIPTION
        const html = rewriteRelativeAssetUrls(
          replaceOgMeta(
            indexHtml,
            ogMetaBlock({
              title: presetTitle(preset.name),
              description,
              url,
              image: resolveOgImage(slug, missingImages),
              imageAlt: ogImageAlt(preset.name),
              structuredData: presetStructuredData({
                name: preset.name,
                description,
                itemIds: preset.itemIds,
                url,
              }),
            }),
          ),
        )
        const dir = resolve(rootDir, 'dist/c', slug)
        mkdirSync(dir, { recursive: true })
        writeFileSync(resolve(dir, 'index.html'), html)
      }

      writeSitemap()

      if (missingImages.length > 0) {
        this.warn(
          `No social image for ${missingImages.join(', ')} — using default.jpg. ` +
            `Run \`npm run generate-og\` to render them.`,
        )
      }
    },
  }
}

/** The first preset is what `/` renders, so its `/c/` page is a duplicate. */
function isHomepagePreset(preset: { id: string }): boolean {
  return preset.id === COMPARISON_PRESETS[0]?.id
}

/**
 * Lists `/` plus every non-duplicate share page. The sidebar links to these
 * too; the sitemap makes them discoverable without executing the app.
 */
function writeSitemap() {
  const urls = [
    `${SITE_ORIGIN}/`,
    ...COMPARISON_PRESETS.filter((preset) => !isHomepagePreset(preset)).map(
      (preset) => sharePageUrl(presetSlug(preset.name)),
    ),
  ]
  const body = urls
    .map(
      (url) => `  <url>
    <loc>${url}</loc>
  </url>
`,
    )
    .join('')
  writeFileSync(
    resolve(rootDir, 'dist/sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}</urlset>
`,
  )
}
