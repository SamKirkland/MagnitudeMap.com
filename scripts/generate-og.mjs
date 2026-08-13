/**
 * After `vite build`, open the capture page in Chrome/Edge, render each
 * preset to 1200×630 JPEG, and write `dist/og/` + `public/og/`.
 * Exits non-zero if WebGL, a preset, or a JPEG fails.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { preview } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const distDir = join(root, 'dist')
const captureHtml = join(distDir, 'og-capture.html')
const MIN_JPEG_BYTES = 8_192
const TIMEOUT_MS = 15 * 60 * 1000

const CHROME_ARGS = [
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--disable-gpu-sandbox',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--autoplay-policy=no-user-gesture-required',
]

function die(message) {
  console.error(message)
  process.exitCode = 1
}

function jpegLooksValid(buffer) {
  return (
    buffer.length >= MIN_JPEG_BYTES &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8
  )
}

async function launchBrowser() {
  const headed = process.env.OG_HEADED === '1'
  const attempts = [
    { channel: 'chrome' },
    { channel: 'msedge' },
    { channel: 'chrome-beta' },
    { executablePath: process.env.CHROME_PATH },
    { executablePath: process.env.EDGE_PATH },
  ]
  const errors = []
  for (const attempt of attempts) {
    if (!attempt.channel && !attempt.executablePath) continue
    try {
      return await chromium.launch({
        ...attempt,
        headless: !headed,
        args: CHROME_ARGS,
      })
    } catch (error) {
      const label = attempt.channel ?? attempt.executablePath
      errors.push(`${label}: ${error instanceof Error ? error.message : error}`)
    }
  }
  throw new Error(
    [
      'Could not launch Chrome or Edge to render social images.',
      'Install Google Chrome or Microsoft Edge, or set CHROME_PATH.',
      'For a visible window: OG_HEADED=1 npm run generate-og',
      ...errors.map((line) => `  ${line}`),
    ].join('\n'),
  )
}

function writeJpegs(files) {
  const distOg = join(distDir, 'og')
  const publicOg = join(root, 'public', 'og')
  mkdirSync(distOg, { recursive: true })
  mkdirSync(publicOg, { recursive: true })
  const written = []
  for (const file of files) {
    if (!/^[a-z0-9-]+$/.test(file.slug)) {
      throw new Error(`Bad OG slug: ${file.slug}`)
    }
    const buffer = Buffer.from(file.base64, 'base64')
    if (!jpegLooksValid(buffer)) {
      throw new Error(
        `Invalid JPEG for ${file.slug}.jpg (${buffer.length} bytes)`,
      )
    }
    writeFileSync(join(distOg, `${file.slug}.jpg`), buffer)
    writeFileSync(join(publicOg, `${file.slug}.jpg`), buffer)
    written.push(`${file.slug}.jpg (${Math.round(buffer.length / 1024)} KB)`)
  }
  return written
}

if (!existsSync(captureHtml)) {
  die(
    `Missing ${captureHtml}. Run this after vite build (npm run build does that).`,
  )
  process.exit(1)
}

let server
let browser
try {
  server = await preview({
    root,
    preview: {
      host: '127.0.0.1',
      port: 4179,
      strictPort: false,
    },
  })
  const origin = server.resolvedUrls?.local?.[0]
  if (!origin) throw new Error('vite preview did not report a local URL')
  const captureUrl = new URL('og-capture.html?autorun=1', origin).href
  console.log(`OG capture: ${captureUrl}`)

  browser = await launchBrowser()
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  })
  page.setDefaultTimeout(TIMEOUT_MS)
  page.on('pageerror', (error) => {
    console.error(`[og-capture pageerror] ${error.message}`)
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error(`[og-capture] ${msg.text()}`)
  })

  await page.goto(captureUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForFunction(() => window.__OG_CAPTURE__, null, {
    timeout: 60_000,
  })
  await page.waitForFunction(
    () => window.__OG_CAPTURE__?.status === 'done',
    null,
    { timeout: TIMEOUT_MS },
  )

  const result = await page.evaluate(() => window.__OG_CAPTURE__)
  if (!result) throw new Error('Capture page did not publish __OG_CAPTURE__')
  if (result.errors?.length) {
    const details = result.errors
      .map((item) => `  ${item.slug}: ${item.message}`)
      .join('\n')
    throw new Error(`OG capture failed:\n${details}`)
  }
  if (!result.files?.length) {
    throw new Error('OG capture finished with no JPEGs')
  }
  const slugs = new Set(result.files.map((file) => file.slug))
  if (!slugs.has('default')) {
    throw new Error('OG capture missing default.jpg')
  }
  const written = writeJpegs(result.files)
  console.log(`Wrote ${written.length} social images:`)
  for (const line of written) console.log(`  ${line}`)
} catch (error) {
  die(error instanceof Error ? error.message : String(error))
} finally {
  await browser?.close().catch(() => {})
  await server?.close().catch(() => {})
}

if (process.exitCode) process.exit(process.exitCode)
