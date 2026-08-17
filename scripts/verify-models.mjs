/**
 * Confirm catalog GLBs render at real-world meters.
 *
 * Loads each GLB, applies the catalog authoring pose, runs the same crop
 * heuristics as the viewer, scales the trusted axis, and compares the other
 * two axes. Optional Playwright shots place the model next to person-male.
 *
 *   npm run verify-models
 *   npm run verify-models -- --only=f22,eiffel
 *   npm run verify-models -- --only=f22 --no-shots
 *   npm run verify-models -- --shots
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { getBounds, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const publicDir = join(root, 'public')
const outDefault = join(root, 'tmp', 'verify-models.json')
const shotsDir = join(root, 'tmp', 'verify-models')

const args = process.argv.slice(2)
const jsonStdout = args.includes('--json')
const noShots = args.includes('--no-shots')
const shotsFlag = args.includes('--shots')
const onlyArg = args.find((a) => a.startsWith('--only='))
const outArg = args.find((a) => a.startsWith('--out='))
const onlyIds = onlyArg
  ? new Set(
      onlyArg
        .slice('--only='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
  : null
const outPath = outArg ? join(root, outArg.slice('--out='.length)) : outDefault

const CHROME_ARGS = [
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--disable-gpu-sandbox',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--autoplay-policy=no-user-gesture-required',
]

function log(...parts) {
  if (jsonStdout) console.error(...parts)
  else console.log(...parts)
}

function die(message) {
  console.error(message)
  process.exitCode = 1
}

let ioPromise = null
async function getIO() {
  if (!ioPromise) {
    ioPromise = (async () => {
      const draco3d = (await import('draco3dgltf')).default
      return new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({
          'draco3d.decoder': await draco3d.createDecoderModule(),
        })
    })()
  }
  return ioPromise
}

function collectMeshBoxes(document) {
  const boxes = []
  let triangles = 0
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    let vertices = 0
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')
      if (pos) vertices += pos.getCount()
      const indices = prim.getIndices()
      if (indices) triangles += Math.floor(indices.getCount() / 3)
      else if (pos) triangles += Math.floor(pos.getCount() / 3)
    }
    if (vertices === 0) continue
    const bounds = getBounds(node)
    boxes.push({
      name: node.getName() || mesh.getName() || 'mesh',
      parentName: node.getParentNode()?.getName() ?? '',
      min: { x: bounds.min[0], y: bounds.min[1], z: bounds.min[2] },
      max: { x: bounds.max[0], y: bounds.max[1], z: bounds.max[2] },
      vertices,
    })
  }
  return { boxes, triangles }
}

function publicPath(modelPath) {
  return join(publicDir, modelPath.replace(/^[\\/]+/, ''))
}

async function launchBrowser() {
  const headed = process.env.VERIFY_HEADED === '1'
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
      'Could not launch Chrome or Edge to capture verify shots.',
      'Install Google Chrome or Microsoft Edge, or set CHROME_PATH.',
      'Skip shots with --no-shots.',
      ...errors.map((line) => `  ${line}`),
    ].join('\n'),
  )
}

function mergeRuntime(result, runtimeItem, shotPaths, resultStatus) {
  result.runtime = runtimeItem.runtime
  const keep = result.issues.filter(
    (issue) =>
      !issue.code.startsWith('axis-') &&
      issue.code !== 'trusted-axis' &&
      issue.code !== 'yaw-swapped' &&
      issue.code !== 'pitch-tipped',
  )
  result.issues = [...keep, ...runtimeItem.issues]
  result.status = resultStatus(result.issues, result.skipReason)
  if (shotPaths) result.shots = shotPaths
}

async function captureShots(vite, ids, resultsById, modelVerify) {
  const browser = await launchBrowser()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const origin = vite.resolvedUrls?.local?.[0]
  if (!origin) throw new Error('Vite dev server has no local URL')
  const url = new URL('verify-model.html', origin)
  url.searchParams.set('autorun', '1')
  url.searchParams.set('ids', ids.join(','))

  try {
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForFunction(
      () => {
        const report = window.__MODEL_VERIFY__
        return report && (report.status === 'done' || report.status === 'error')
      },
      null,
      { timeout: Math.max(120_000, ids.length * 90_000) },
    )
    const report = await page.evaluate(() => window.__MODEL_VERIFY__)
    if (!report || report.status === 'error') {
      throw new Error(report?.error || 'Verify capture page failed')
    }

    mkdirSync(shotsDir, { recursive: true })
    const filesByKey = new Map()
    for (const file of report.files ?? []) {
      filesByKey.set(`${file.id}:${file.kind}`, file)
    }

    for (const item of report.items ?? []) {
      const result = resultsById.get(item.id)
      if (!result) continue
      const elevation = filesByKey.get(`${item.id}:elevation`)
      const perspective = filesByKey.get(`${item.id}:perspective`)
      const shotPaths = {}
      if (elevation?.base64) {
        const path = join(shotsDir, `${item.id}-elevation.png`)
        writeFileSync(path, Buffer.from(elevation.base64, 'base64'))
        shotPaths.elevation = relative(root, path).replaceAll('\\', '/')
      }
      if (perspective?.base64) {
        const path = join(shotsDir, `${item.id}-perspective.png`)
        writeFileSync(path, Buffer.from(perspective.base64, 'base64'))
        shotPaths.perspective = relative(root, path).replaceAll('\\', '/')
      }
      mergeRuntime(result, item, shotPaths, modelVerify.resultStatus)
    }
  } finally {
    await browser.close()
  }
}

async function main() {
  const vite = await createServer({
    root,
    configFile: join(root, 'vite.config.ts'),
    server: { port: 5179, strictPort: false },
  })
  await vite.listen()

  try {
    const { CATALOG } = await vite.ssrLoadModule('/src/data/catalog.ts')
    const modelVerify = await vite.ssrLoadModule('/src/modelVerify.ts')
    const io = await getIO()

    const items = CATALOG.filter((item) => (onlyIds ? onlyIds.has(item.id) : true))
    if (onlyIds) {
      for (const id of onlyIds) {
        if (!items.some((item) => item.id === id)) {
          die(`Unknown catalog id: ${id}`)
        }
      }
    }
    if (items.length === 0) {
      die('No catalog items to verify.')
      return
    }

    const wantShots = !noShots && (shotsFlag || (onlyIds != null && items.length <= 8))
    const results = []
    const resultsById = new Map()

    for (const item of items) {
      const skip = modelVerify.skipReasonFor(item)
      if (skip) {
        const result = modelVerify.verifyItemFromGlb(item, [], 0)
        results.push(result)
        resultsById.set(item.id, result)
        log(modelVerify.formatResultLine(result))
        continue
      }

      const glbPath = item.model ? publicPath(item.model.path) : null
      if (!glbPath || !existsSync(glbPath)) {
        const result = {
          ...modelVerify.verifyItemFromGlb(item, [], 0),
          status: 'fail',
          skipReason: undefined,
          issues: [
            {
              severity: 'fail',
              code: 'missing-glb',
              message: `Missing ${item.model?.path ?? 'model.glb'} under public/.`,
            },
          ],
        }
        results.push(result)
        resultsById.set(item.id, result)
        log(modelVerify.formatResultLine(result))
        for (const issue of result.issues) log(`  ${modelVerify.formatIssueLine(issue)}`)
        continue
      }

      try {
        const document = await io.read(glbPath)
        const { boxes, triangles } = collectMeshBoxes(document)
        const posed = modelVerify.applyAuthoringPose(boxes, item)
        const result = modelVerify.verifyItemFromGlb(item, posed, triangles)
        results.push(result)
        resultsById.set(item.id, result)
        log(modelVerify.formatResultLine(result))
        for (const issue of result.issues) log(`  ${modelVerify.formatIssueLine(issue)}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const result = {
          ...modelVerify.verifyItemFromGlb(item, [], 0),
          status: 'fail',
          skipReason: undefined,
          issues: [{ severity: 'fail', code: 'load', message }],
        }
        results.push(result)
        resultsById.set(item.id, result)
        log(modelVerify.formatResultLine(result))
        log(`  ${modelVerify.formatIssueLine(result.issues[0])}`)
      }
    }

    const shotIds = items
      .filter((item) => !modelVerify.skipReasonFor(item) && resultsById.get(item.id)?.status !== 'skip')
      .map((item) => item.id)

    if (wantShots && shotIds.length > 0) {
      log(`Capturing ${shotIds.length} viewer shot(s) next to person-male…`)
      try {
        await captureShots(vite, shotIds, resultsById, modelVerify)
        for (const id of shotIds) {
          const result = resultsById.get(id)
          if (!result) continue
          log(modelVerify.formatResultLine(result))
          for (const issue of result.issues) log(`  ${modelVerify.formatIssueLine(issue)}`)
          if (result.shots?.elevation) log(`  shot ${result.shots.elevation}`)
          if (result.shots?.perspective) log(`  shot ${result.shots.perspective}`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (shotsFlag) {
          die(message)
        } else {
          log(`Shots skipped: ${message}`)
        }
      }
    }

    const summary = { pass: 0, warn: 0, fail: 0, skip: 0 }
    for (const result of results) summary[result.status] += 1
    const report = {
      ok: summary.fail === 0,
      summary,
      personMaleHeightM: 1.75,
      howToRead:
        'Rendered L/W/H should match catalog meters. scaleAxis is forced; a big error on the other axes means wrong yaw/pitch, extra plates, or a bad catalog number. Elevation PNG is orthographic next to the 1.75 m adult at Facing 0° (+Z nose).',
      results,
    }

    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`)
    log(
      `Summary  pass=${summary.pass}  warn=${summary.warn}  fail=${summary.fail}  skip=${summary.skip}`,
    )
    log(`Wrote ${relative(root, outPath).replaceAll('\\', '/')}`)

    if (jsonStdout) console.log(JSON.stringify(report, null, 2))
    if (summary.fail > 0) process.exitCode = 1
  } finally {
    await vite.close()
  }
}

main().catch((error) => {
  die(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
