import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { COMPARISON_PRESETS } from './src/data/catalog'
import {
  DEFAULT_DESCRIPTION,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  SITE_NAME,
  ogImageUrl,
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

function ogMetaBlock(opts: {
  title: string
  description: string
  url: string
  image: string
}): string {
  const title = escapeAttr(opts.title)
  const description = escapeAttr(opts.description)
  return `<!-- og-meta -->
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${opts.url}" />
    <meta property="og:image" content="${opts.image}" />
    <meta property="og:image:width" content="${OG_IMAGE_WIDTH}" />
    <meta property="og:image:height" content="${OG_IMAGE_HEIGHT}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${opts.image}" />
    <link rel="canonical" href="${opts.url}" />
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

/** Dev-only: capture page POSTs JPEGs into `public/og/`. */
export function ogWritePlugin(): Plugin {
  return {
    name: 'og-write',
    configureServer(server) {
      server.middlewares.use(
        async (req: IncomingMessage, res: ServerResponse, next) => {
          const path = req.url?.split('?')[0]
          if (path !== '/__og-write' || req.method !== 'POST') {
            next()
            return
          }
          const slug = String(req.headers['x-og-slug'] ?? '')
          if (!/^[a-z0-9-]+$/.test(slug)) {
            res.statusCode = 400
            res.end('bad slug')
            return
          }
          const body = await readBody(req)
          const dir = resolve(rootDir, 'public/og')
          mkdirSync(dir, { recursive: true })
          writeFileSync(resolve(dir, `${slug}.jpg`), body)
          res.statusCode = 200
          res.setHeader('content-type', 'text/plain')
          res.end('ok')
        },
      )
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

      for (const preset of COMPARISON_PRESETS) {
        const slug = presetSlug(preset.name)
        const html = rewriteRelativeAssetUrls(
          replaceOgMeta(
            indexHtml,
            ogMetaBlock({
              title: `${preset.name} — ${SITE_NAME}`,
              description: preset.description || DEFAULT_DESCRIPTION,
              url: sharePageUrl(slug),
              image: ogImageUrl(slug),
            }),
          ),
        )
        const dir = resolve(rootDir, 'dist/c', slug)
        mkdirSync(dir, { recursive: true })
        writeFileSync(resolve(dir, 'index.html'), html)
      }
    },
  }
}
