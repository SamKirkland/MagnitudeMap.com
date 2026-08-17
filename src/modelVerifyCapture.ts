import { ComparisonScene } from './babylon/ComparisonScene'
import { CATALOG, CATALOG_BY_ID } from './data/catalog'
import { skipReasonFor, evaluateRuntimeCapture, PERSON_MALE_HEIGHT_M, resultStatus } from './modelVerify'
import { SPREAD_MIN } from './tourSettings'
import { formatLength } from './units'
import './styles/globals.css'

type ShotKind = 'elevation' | 'perspective'

type CaptureRow = {
  id: string
  name: string
  status: 'pending' | 'rendering' | 'done' | 'error' | 'skip'
  detail: string
  elevationUrl: string | null
  perspectiveUrl: string | null
}

type VerifyCaptureFile = {
  id: string
  kind: ShotKind
  mime: string
  base64: string
}

type VerifyCaptureItem = {
  id: string
  catalog: { width: number; height: number; length: number }
  runtime: { width: number; height: number; length: number }
  personHeight: number
  issues: { severity: 'fail' | 'warn'; code: string; message: string }[]
  status: 'pass' | 'warn' | 'fail' | 'skip'
}

type VerifyCaptureReport = {
  status: 'idle' | 'running' | 'done' | 'error'
  error?: string
  items: VerifyCaptureItem[]
  files: VerifyCaptureFile[]
}

const params = new URLSearchParams(window.location.search)
const automated = params.has('autorun')
const onlyIds = (params.get('ids') ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)

const WIDTH = 1280
const HEIGHT = 720

const report: VerifyCaptureReport = {
  status: 'idle',
  items: [],
  files: [],
}

function publishReport() {
  ;(window as unknown as { __MODEL_VERIFY__: VerifyCaptureReport }).__MODEL_VERIFY__ = report
}

publishReport()

const ids = (onlyIds.length > 0 ? onlyIds : CATALOG.map((item) => item.id)).filter((id) => {
  const item = CATALOG_BY_ID[id]
  if (!item) return false
  return !skipReasonFor(item)
})

const rows: CaptureRow[] = ids.map((id) => ({
  id,
  name: CATALOG_BY_ID[id]?.name ?? id,
  status: 'pending',
  detail: '',
  elevationUrl: null,
  perspectiveUrl: null,
}))

const root = document.getElementById('model-verify')
if (!root) throw new Error('Missing #model-verify')

root.innerHTML = `
  <div class="og-capture-page">
    <header class="og-capture-header">
      <h1>Model scale verify</h1>
      <p>
        Loads each catalog GLB next to the 1.75&nbsp;m adult, using the same crop/scale
        as the viewer. Elevation is orthographic; perspective is the site 3/4 view.
      </p>
      <div class="og-capture-actions">
        <button type="button" id="verify-run">Capture</button>
        <span id="verify-progress" class="og-capture-progress"></span>
      </div>
    </header>
    <div class="og-capture-stage-wrap">
      <div class="og-capture-stage" id="verify-stage">
        <canvas id="verify-canvas" width="${WIDTH}" height="${HEIGHT}"></canvas>
      </div>
    </div>
    <ol class="og-capture-list" id="verify-list"></ol>
  </div>
`

const canvas = document.getElementById('verify-canvas') as HTMLCanvasElement
const listEl = document.getElementById('verify-list') as HTMLOListElement
const runBtn = document.getElementById('verify-run') as HTMLButtonElement
const progressEl = document.getElementById('verify-progress') as HTMLSpanElement
const stageEl = document.getElementById('verify-stage') as HTMLDivElement

function fitStage() {
  const maxW = Math.min(window.innerWidth - 48, WIDTH)
  const scale = Math.max(0.25, Math.min(1, maxW / WIDTH))
  stageEl.style.transform = `scale(${scale})`
  stageEl.parentElement?.style.setProperty('height', `${HEIGHT * scale}px`)
}

fitStage()
window.addEventListener('resize', fitStage)

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
}

function renderList() {
  listEl.innerHTML = rows
    .map((row) => {
      const thumbs = [row.elevationUrl, row.perspectiveUrl]
        .filter(Boolean)
        .map((url) => `<img src="${url}" alt="" width="160" height="90" />`)
        .join('')
      return `<li class="og-capture-row is-${row.status}">
        ${thumbs}
        <div>
          <strong>${escapeHtml(row.name)}</strong>
          <code>${escapeHtml(row.id)}</code>
          <span>${escapeHtml(row.detail)}</span>
        </div>
      </li>`
    })
    .join('')
}

renderList()

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const comma = text.indexOf(',')
      resolve(comma >= 0 ? text.slice(comma + 1) : text)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function metersLabel(value: number): string {
  return formatLength(value, 'metric')
}

function dimLine(
  label: string,
  size: { width: number; height: number; length: number },
): string {
  return `${label} L ${metersLabel(size.length)} · W ${metersLabel(size.width)} · H ${metersLabel(size.height)}`
}

async function captionPng(
  blob: Blob,
  title: string,
  lines: string[],
  tone: 'pass' | 'warn' | 'fail' | 'skip',
): Promise<Blob> {
  const img = await createImageBitmap(blob)
  const bar = 88
  const out = document.createElement('canvas')
  out.width = img.width
  out.height = img.height + bar
  const ctx = out.getContext('2d')
  if (!ctx) return blob
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(img, 0, 0)
  ctx.fillStyle = '#1c2430'
  ctx.fillRect(0, img.height, out.width, bar)
  const accent = tone === 'fail' ? '#b91c1c' : tone === 'warn' ? '#b45309' : '#0f6a5b'
  ctx.fillStyle = accent
  ctx.fillRect(0, img.height, 10, bar)
  ctx.fillStyle = '#f8fafc'
  ctx.font = '600 22px "IBM Plex Sans", sans-serif'
  ctx.fillText(title, 24, img.height + 32)
  ctx.font = '400 15px "IBM Plex Sans", sans-serif'
  ctx.fillStyle = '#cbd5e1'
  ctx.fillText(lines.join('   ·   '), 24, img.height + 58)
  return await new Promise((resolve, reject) => {
    out.toBlob((next) => {
      if (next) resolve(next)
      else reject(new Error('PNG encode failed'))
    }, 'image/png')
  })
}

let scene: ComparisonScene
try {
  scene = new ComparisonScene(canvas, { frameMode: 'pair', spread: SPREAD_MIN, yaw: 0 }, { capture: true })
  scene.setDisplayYawTurns(0)
  scene.engine.setSize(WIDTH, HEIGHT)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  report.status = 'error'
  report.error = message
  publishReport()
  progressEl.textContent = message
  throw error
}

async function captureOne(row: CaptureRow): Promise<void> {
  const item = CATALOG_BY_ID[row.id]
  if (!item) throw new Error(`Unknown catalog id ${row.id}`)

  const lineup = row.id === 'person-male' ? ['person-male'] : ['person-male', row.id]
  row.status = 'rendering'
  row.detail = 'Loading…'
  renderList()

  await scene.setActiveItems(lineup, { camera: 'overview', animate: false })
  scene.setDisplayYawTurns(0)

  const bounds = scene.measureLoadedItemBounds()
  const measured = bounds.find((entry) => entry.itemId === row.id)
  if (!measured) throw new Error('Model did not load into the scene')

  const runtime = {
    width: measured.width,
    height: measured.height,
    length: measured.length,
  }
  const issues = evaluateRuntimeCapture(item, runtime)
  const status = resultStatus(issues)
  const catalog = { width: item.width, height: item.height, length: item.length }

  row.detail = 'Elevation…'
  renderList()
  const elevationRaw = await scene.capturePosterRender({
    layout: 'lineup',
    view: 'side',
    contentRect: { left: 0.04, right: 0.96, top: 0.08, bottom: 0.92 },
    width: WIDTH,
    height: HEIGHT,
  })
  const elevation = await captionPng(
    elevationRaw.image,
    `${item.name}  ·  ${status.toUpperCase()}  ·  vs adult ${PERSON_MALE_HEIGHT_M} m`,
    [dimLine('catalog', catalog), dimLine('rendered', runtime)],
    status,
  )

  row.detail = 'Perspective…'
  renderList()
  const perspectiveRaw = await scene.capturePerspectiveJpeg(WIDTH, HEIGHT)
  const perspective = await captionPng(
    perspectiveRaw,
    `${item.name}  ·  facing 0°  ·  ${status.toUpperCase()}`,
    [dimLine('catalog', catalog), dimLine('rendered', runtime)],
    status,
  )

  if (row.elevationUrl) URL.revokeObjectURL(row.elevationUrl)
  if (row.perspectiveUrl) URL.revokeObjectURL(row.perspectiveUrl)
  row.elevationUrl = URL.createObjectURL(elevation)
  row.perspectiveUrl = URL.createObjectURL(perspective)
  row.status = status === 'fail' ? 'error' : 'done'
  row.detail = status.toUpperCase()
  renderList()

  report.items.push({
    id: row.id,
    catalog,
    runtime,
    personHeight: PERSON_MALE_HEIGHT_M,
    issues,
    status,
  })
  report.files.push(
    { id: row.id, kind: 'elevation', mime: 'image/png', base64: await blobToBase64(elevation) },
    { id: row.id, kind: 'perspective', mime: 'image/png', base64: await blobToBase64(perspective) },
  )
  publishReport()
}

async function generateAll() {
  runBtn.disabled = true
  report.status = 'running'
  report.items = []
  report.files = []
  report.error = undefined
  publishReport()

  let done = 0
  for (const row of rows) {
    progressEl.textContent = `${done}/${rows.length} — ${row.name}`
    try {
      await captureOne(row)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      row.status = 'error'
      row.detail = message
      report.items.push({
        id: row.id,
        catalog: CATALOG_BY_ID[row.id]
          ? {
              width: CATALOG_BY_ID[row.id].width,
              height: CATALOG_BY_ID[row.id].height,
              length: CATALOG_BY_ID[row.id].length,
            }
          : { width: 0, height: 0, length: 0 },
        runtime: { width: 0, height: 0, length: 0 },
        personHeight: PERSON_MALE_HEIGHT_M,
        issues: [{ severity: 'fail', code: 'capture', message }],
        status: 'fail',
      })
      publishReport()
      renderList()
    }
    done += 1
  }

  report.status = 'done'
  publishReport()
  runBtn.disabled = false
  progressEl.textContent = `Done ${rows.length}.`
}

runBtn.addEventListener('click', () => {
  void generateAll()
})

if (automated) {
  void generateAll()
}
