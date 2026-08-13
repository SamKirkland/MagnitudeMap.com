import { ComparisonScene } from './babylon/ComparisonScene'
import { COMPARISON_PRESETS } from './data/catalog'
import { presetSlug } from './selectionUrl'
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from './site'
import { DEFAULT_TOUR_SETTINGS } from './tourSettings'
import './styles/globals.css'

type RowStatus = 'pending' | 'rendering' | 'saved' | 'downloaded' | 'error'

type Row = {
  slug: string
  name: string
  itemIds: string[]
  homepageDefault: boolean
  status: RowStatus
  detail: string
  previewUrl: string | null
}

type OgCaptureFile = {
  slug: string
  base64: string
}

type OgCaptureReport = {
  status: 'idle' | 'running' | 'done'
  files: OgCaptureFile[]
  errors: { slug: string; message: string }[]
}

const rows: Row[] = COMPARISON_PRESETS.map((preset, index) => ({
  slug: presetSlug(preset),
  name: preset.name,
  itemIds: [...preset.itemIds],
  homepageDefault: index === 0,
  status: 'pending',
  detail: '',
  previewUrl: null,
}))

const automated = new URLSearchParams(window.location.search).has('autorun')

const report: OgCaptureReport = {
  status: 'idle',
  files: [],
  errors: [],
}

function publishReport() {
  ;(window as unknown as { __OG_CAPTURE__: OgCaptureReport }).__OG_CAPTURE__ = report
}

publishReport()

const root = document.getElementById('og-capture')
if (!root) throw new Error('Missing #og-capture')

root.innerHTML = `
  <div class="og-capture-page">
    <header class="og-capture-header">
      <h1>Social share images</h1>
      <p>
        Renders each lineup with the same perspective overview camera as the site
        (1200×630 JPEG). Keep this tab visible while it runs.
      </p>
      <div class="og-capture-actions">
        <button type="button" id="og-run">Generate all</button>
        <span id="og-progress" class="og-capture-progress"></span>
      </div>
    </header>
    <div class="og-capture-stage-wrap">
      <div class="og-capture-stage" id="og-stage">
        <canvas id="og-canvas" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}"></canvas>
      </div>
    </div>
    <ol class="og-capture-list" id="og-list"></ol>
  </div>
`

const canvas = document.getElementById('og-canvas') as HTMLCanvasElement
const listEl = document.getElementById('og-list') as HTMLOListElement
const runBtn = document.getElementById('og-run') as HTMLButtonElement
const progressEl = document.getElementById('og-progress') as HTMLSpanElement
const stageEl = document.getElementById('og-stage') as HTMLDivElement

function fitStage() {
  const maxW = Math.min(window.innerWidth - 48, OG_IMAGE_WIDTH)
  const scale = Math.max(0.25, Math.min(1, maxW / OG_IMAGE_WIDTH))
  stageEl.style.transform = `scale(${scale})`
  stageEl.parentElement?.style.setProperty(
    'height',
    `${OG_IMAGE_HEIGHT * scale}px`,
  )
}

fitStage()
window.addEventListener('resize', fitStage)

function renderList() {
  listEl.innerHTML = rows
    .map((row) => {
      const thumb = row.previewUrl
        ? `<img src="${row.previewUrl}" alt="" width="160" height="84" />`
        : ''
      return `<li class="og-capture-row is-${row.status}">
        ${thumb}
        <div>
          <strong>${escapeHtml(row.name)}</strong>
          <code>${escapeHtml(row.slug)}.jpg</code>
          ${row.homepageDefault ? '<em>also default.jpg</em>' : ''}
          <span>${escapeHtml(row.detail)}</span>
        </div>
      </li>`
    })
    .join('')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

renderList()

let scene: ComparisonScene
try {
  scene = new ComparisonScene(canvas, DEFAULT_TOUR_SETTINGS, { capture: true })
  scene.engine.setSize(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  report.status = 'done'
  report.errors.push({ slug: '*', message })
  publishReport()
  progressEl.textContent = message
  throw error
}

async function writeBlob(slug: string, blob: Blob): Promise<RowStatus> {
  try {
    const response = await fetch('/__og-write', {
      method: 'POST',
      headers: { 'x-og-slug': slug },
      body: blob,
    })
    if (response.ok) return 'saved'
  } catch {
    // Not running under Vite dev, or the write plugin is absent.
  }
  if (!automated) downloadBlob(`${slug}.jpg`, blob)
  return 'downloaded'
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000)
}

async function generateAll() {
  runBtn.disabled = true
  report.status = 'running'
  report.files = []
  report.errors = []
  publishReport()
  let done = 0
  for (const row of rows) {
    row.status = 'rendering'
    row.detail = `Loading ${row.itemIds.length} models…`
    progressEl.textContent = `${done}/${rows.length} — ${row.name}`
    renderList()
    try {
      await scene.setActiveItems(row.itemIds, { camera: 'overview', animate: false })
      row.detail = 'Screenshot…'
      renderList()
      const blob = await scene.capturePerspectiveJpeg()
      if (blob.size < 8_192) {
        throw new Error(`JPEG too small (${blob.size} bytes)`)
      }
      const base64 = await blobToBase64(blob)
      report.files.push({ slug: row.slug, base64 })
      if (row.homepageDefault) {
        report.files.push({ slug: 'default', base64 })
      }
      publishReport()
      if (row.previewUrl) URL.revokeObjectURL(row.previewUrl)
      row.previewUrl = URL.createObjectURL(blob)
      row.status = await writeBlob(row.slug, blob)
      if (row.homepageDefault) {
        await writeBlob('default', blob)
      }
      row.detail = row.status === 'saved' ? 'Wrote public/og/' : 'Captured'
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      row.status = 'error'
      row.detail = message
      report.errors.push({ slug: row.slug, message })
      publishReport()
    }
    done += 1
    progressEl.textContent = `${done}/${rows.length}`
    renderList()
  }
  runBtn.disabled = false
  report.status = 'done'
  publishReport()
  progressEl.textContent = report.errors.length
    ? `Failed ${report.errors.length} of ${rows.length}.`
    : automated
      ? 'Done.'
      : 'Done. Commit the JPEGs in public/og/.'
}

runBtn.addEventListener('click', () => {
  void generateAll()
})

if (automated) {
  void generateAll()
}
