// Inject build-time React markup into the static HTML the client build emitted.
//
// Runs after `vite build` (which writes dist/index.html and, via
// vite-plugin-og-pages, dist/c/{slug}/index.html with per-lineup meta tags)
// and after the SSR build (which writes dist-ssr/entry-server.js).
//
// Only the contents of `<div id="root">` are touched, so the OG/canonical tags
// each page already carries are left exactly as they were.

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = resolve(rootDir, 'dist')

// Anchored on </body> so the match spans previously injected markup too:
// re-running the step replaces the content instead of failing.
const ROOT_DIV = /(<div id="root">)[\s\S]*(<\/div>\s*<\/body>)/

function shareSlugs() {
  const shareDir = resolve(distDir, 'c')
  try {
    return readdirSync(shareDir).filter((name) =>
      statSync(resolve(shareDir, name)).isDirectory(),
    )
  } catch {
    return []
  }
}

function inject(htmlPath, markup) {
  const html = readFileSync(htmlPath, 'utf8')
  if (!ROOT_DIV.test(html)) {
    throw new Error(`no <div id="root"> ... </div></body> found in ${htmlPath}`)
  }
  // Replacer function, not a template string: rendered markup can contain `$1`
  // (e.g. "$100 bills"), which String.replace would treat as a capture group.
  writeFileSync(
    htmlPath,
    html.replace(ROOT_DIV, (_match, open, close) => `${open}${markup}${close}`),
  )
}

const { render } = await import(
  new URL('../dist-ssr/entry-server.js', import.meta.url).href
)

const pages = [
  { slug: null, path: resolve(distDir, 'index.html') },
  ...shareSlugs().map((slug) => ({
    slug,
    path: resolve(distDir, 'c', slug, 'index.html'),
  })),
]

/** Enough markup to prove the React tree rendered, not just an empty shell. */
const MIN_MARKUP_BYTES = 4096

const problems = new Set()

function check(condition, message) {
  if (!condition) problems.add(message)
}

let bytes = 0
for (const page of pages) {
  const markup = render(page.slug)
  check(
    markup.length >= MIN_MARKUP_BYTES,
    `${page.slug ?? 'index'}: only ${markup.length} bytes of markup`,
  )
  check(/<h1[\s>]/.test(markup), `${page.slug ?? 'index'}: no <h1>`)
  inject(page.path, markup)
  bytes += markup.length

  // Every image a page advertises must exist, or the link unfurls blank.
  const html = readFileSync(page.path, 'utf8')
  for (const [, url] of html.matchAll(
    /<meta (?:property|name)="(?:og|twitter):image" content="([^"]+)"/g,
  )) {
    const file = resolve(distDir, url.replace(/^https?:\/\/[^/]+\//, ''))
    check(existsSync(file), `${page.slug ?? 'index'}: missing image ${url}`)
  }
}

check(existsSync(resolve(distDir, 'sitemap.xml')), 'dist/sitemap.xml not emitted')
check(existsSync(resolve(distDir, 'robots.txt')), 'dist/robots.txt not copied')

if (problems.size > 0) {
  console.error('prerender checks failed:')
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}

console.log(
  `prerendered ${pages.length} pages (${(bytes / pages.length / 1024).toFixed(1)} KB avg markup)`,
)
