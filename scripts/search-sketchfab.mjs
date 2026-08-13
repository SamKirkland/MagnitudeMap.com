/**
 * Search Sketchfab for downloadable models using SKETCHFAB_API_TOKEN from .env.
 *
 *   npm run search-sketchfab -- "Eiffel Tower"
 *   npm run search-sketchfab -- "Eiffel Tower" --user=nazidefenseforceofficial
 *   npm run search-sketchfab -- "Eiffel Tower" --json
 *
 * Web equivalent:
 *   https://sketchfab.com/search?features=downloadable&q=Eiffel+Tower&type=models
 *
 * API equivalent:
 *   GET https://api.sketchfab.com/v3/search?type=models&q=Eiffel+Tower&downloadable=true
 *
 * Only CC0 / CC-BY / CC-BY-SA are OK to ship. Editorial, Standard, and NC are not.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const REDISTRIBUTABLE = new Set(['by', 'by-sa', 'cc0'])

function loadDotEnv() {
  const envPath = join(rootDir, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadDotEnv()

function parseArgs(argv) {
  const flags = { json: false, user: null, count: 24 }
  const queryParts = []
  for (const a of argv) {
    if (a === '--json') flags.json = true
    else if (a.startsWith('--user=')) flags.user = a.slice('--user='.length).trim()
    else if (a.startsWith('--count=')) flags.count = Math.min(24, Math.max(1, Number(a.slice('--count='.length)) || 24))
    else if (!a.startsWith('-')) queryParts.push(a)
  }
  return { query: queryParts.join(' ').trim(), ...flags }
}

function licenseSlug(model) {
  return model.license?.slug || ''
}

function licenseLabel(model) {
  return model.license?.label || licenseSlug(model) || '?'
}

function verdict(model) {
  const slug = licenseSlug(model)
  if (!model.isDownloadable) return 'NO-DL'
  if (REDISTRIBUTABLE.has(slug)) return 'OK'
  if (slug.startsWith('by-nc') || slug.includes('nc')) return 'NC'
  if (slug === 'ed') return 'ED'
  if (slug === 'st' || slug === 'free-st') return 'STD'
  return 'SKIP'
}

async function search({ query, user, count, token }) {
  const params = new URLSearchParams({
    type: 'models',
    q: query,
    downloadable: 'true',
    count: String(count),
  })
  if (user) params.set('user', user)
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Token ${token}`
  const res = await fetch(`https://api.sketchfab.com/v3/search?${params}`, { headers })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Sketchfab search ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

async function hydrateLicenses(results, token) {
  // Search hits often omit license.slug — fetch model metadata when missing.
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Token ${token}`
  const out = []
  for (const model of results) {
    if (model.license?.slug) {
      out.push(model)
      continue
    }
    const res = await fetch(`https://api.sketchfab.com/v3/models/${model.uid}`, { headers })
    if (!res.ok) {
      out.push(model)
      continue
    }
    const meta = await res.json()
    out.push({
      ...model,
      license: meta.license,
      isDownloadable: meta.isDownloadable ?? model.isDownloadable,
    })
  }
  return out
}

function printTable(query, models) {
  const web = `https://sketchfab.com/search?features=downloadable&q=${encodeURIComponent(query)}&type=models`
  console.log(`Query: ${query}`)
  console.log(`Web:   ${web}`)
  console.log(`OK = CC0 / CC-BY / CC-BY-SA and downloadable. Skip ED/STD/NC.\n`)
  console.log(
    `${'verdict'.padEnd(7)} ${'license'.padEnd(14)} ${'tris'.padStart(8)} ${'likes'.padStart(6)}  ${'uid'.padEnd(32)}  author / name`,
  )
  for (const m of models) {
    const v = verdict(m)
    const slug = (licenseSlug(m) || licenseLabel(m)).slice(0, 14)
    const tris = String(m.faceCount ?? 0).padStart(8)
    const likes = String(m.likeCount ?? 0).padStart(6)
    const author = m.user?.username || '?'
    console.log(`${v.padEnd(7)} ${slug.padEnd(14)} ${tris} ${likes}  ${m.uid.padEnd(32)}  @${author}  ${m.name}`)
  }
}

async function main() {
  const { query, json, user, count } = parseArgs(process.argv.slice(2))
  if (!query) {
    console.error(`Usage: npm run search-sketchfab -- "Eiffel Tower"
       npm run search-sketchfab -- "Eiffel Tower" --user=nazidefenseforceofficial`)
    process.exit(1)
  }
  const token = process.env.SKETCHFAB_API_TOKEN || process.env.SKETCHFAB_TOKEN || ''
  if (!token) {
    console.error('SKETCHFAB_API_TOKEN missing. Put it in repo-root .env (see .env.example).')
    process.exit(1)
  }

  const data = await search({ query, user, count, token })
  const models = await hydrateLicenses(data.results || [], token)
  if (json) {
    console.log(
      JSON.stringify(
        models.map((m) => ({
          verdict: verdict(m),
          uid: m.uid,
          name: m.name,
          author: m.user?.displayName || m.user?.username,
          username: m.user?.username,
          license: licenseSlug(m),
          licenseLabel: licenseLabel(m),
          downloadable: Boolean(m.isDownloadable),
          faceCount: m.faceCount,
          likeCount: m.likeCount,
          url: m.viewerUrl,
        })),
        null,
        2,
      ),
    )
    return
  }
  printTable(query, models)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
