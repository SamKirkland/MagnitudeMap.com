/**
 * Generate stylized prop GLBs (embedded vertex colors) for catalog items
 * that lack redistributable source assets.
 *
 * Run: npm run generate-props
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const modelsDir = join(__dirname, '..', 'public', 'models')

function hex(h) {
  const n = h.replace('#', '')
  return {
    r: parseInt(n.slice(0, 2), 16) / 255,
    g: parseInt(n.slice(2, 4), 16) / 255,
    b: parseInt(n.slice(4, 6), 16) / 255,
  }
}

function pushTri(arrays, a, b, c, color) {
  const ab = sub(b, a)
  const ac = sub(c, a)
  const n = normalize(cross(ab, ac))
  for (const p of [a, b, c]) {
    arrays.positions.push(p[0], p[1], p[2])
    arrays.normals.push(n[0], n[1], n[2])
    arrays.colors.push(color.r, color.g, color.b)
  }
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}
function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

function addBox(arrays, cx, cy, cz, sx, sy, sz, color) {
  const hx = sx / 2
  const hy = sy / 2
  const hz = sz / 2
  const v = [
    [cx - hx, cy - hy, cz - hz],
    [cx + hx, cy - hy, cz - hz],
    [cx + hx, cy + hy, cz - hz],
    [cx - hx, cy + hy, cz - hz],
    [cx - hx, cy - hy, cz + hz],
    [cx + hx, cy - hy, cz + hz],
    [cx + hx, cy + hy, cz + hz],
    [cx - hx, cy + hy, cz + hz],
  ]
  const faces = [
    [0, 1, 2, 3],
    [5, 4, 7, 6],
    [4, 0, 3, 7],
    [1, 5, 6, 2],
    [3, 2, 6, 7],
    [4, 5, 1, 0],
  ]
  for (const [a, b, c, d] of faces) {
    pushTri(arrays, v[a], v[b], v[c], color)
    pushTri(arrays, v[a], v[c], v[d], color)
  }
}

function addCylinder(arrays, y0, y1, radius, color, segments = 20, x0 = 0, z0 = 0, axis = 'y') {
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2
    const a1 = ((i + 1) / segments) * Math.PI * 2
    const c0 = Math.cos(a0) * radius
    const s0 = Math.sin(a0) * radius
    const c1 = Math.cos(a1) * radius
    const s1 = Math.sin(a1) * radius
    let p0, p1, p2, p3
    if (axis === 'z') {
      p0 = [x0 + c0, y0 + s0, z0]
      p1 = [x0 + c1, y0 + s1, z0]
      p2 = [x0 + c1, y0 + s1, y1]
      p3 = [x0 + c0, y0 + s0, y1]
      // here y0/y1 reused as z0/z1 along length — call sites pass z extents as y0/y1 when axis=z
    } else {
      p0 = [x0 + c0, y0, z0 + s0]
      p1 = [x0 + c1, y0, z0 + s1]
      p2 = [x0 + c1, y1, z0 + s1]
      p3 = [x0 + c0, y1, z0 + s0]
    }
    pushTri(arrays, p0, p1, p2, color)
    pushTri(arrays, p0, p2, p3, color)
  }
}

function addCylinderZ(arrays, z0, z1, radius, color, segments = 20, x0 = 0, y0 = 0) {
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2
    const a1 = ((i + 1) / segments) * Math.PI * 2
    const p0 = [x0 + Math.cos(a0) * radius, y0 + Math.sin(a0) * radius, z0]
    const p1 = [x0 + Math.cos(a1) * radius, y0 + Math.sin(a1) * radius, z0]
    const p2 = [x0 + Math.cos(a1) * radius, y0 + Math.sin(a1) * radius, z1]
    const p3 = [x0 + Math.cos(a0) * radius, y0 + Math.sin(a0) * radius, z1]
    pushTri(arrays, p0, p1, p2, color)
    pushTri(arrays, p0, p2, p3, color)
  }
}

function addConeY(arrays, y0, y1, radius, color, segments = 18, x0 = 0, z0 = 0) {
  const tip = [x0, y1, z0]
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2
    const a1 = ((i + 1) / segments) * Math.PI * 2
    const p0 = [x0 + Math.cos(a0) * radius, y0, z0 + Math.sin(a0) * radius]
    const p1 = [x0 + Math.cos(a1) * radius, y0, z0 + Math.sin(a1) * radius]
    pushTri(arrays, p0, p1, tip, color)
  }
}

/** Unit-length container along Z (ISO-ish proportions). */
function buildContainer() {
  const arrays = { positions: [], normals: [], colors: [] }
  const body = hex('#c45c26')
  const rib = hex('#8b3d14')
  const door = hex('#6b2f10')
  const L = 1
  const W = 2.44 / 6.06
  const H = 2.59 / 6.06
  addBox(arrays, 0, H / 2, 0, W, H, L, body)
  for (let i = 0; i < 8; i++) {
    const z = -0.45 + i * 0.12
    addBox(arrays, 0, H / 2, z, W * 1.02, H * 0.92, 0.02, rib)
  }
  addBox(arrays, 0, H / 2, -L / 2 + 0.01, W * 0.96, H * 0.92, 0.02, door)
  return arrays
}

/** Unit-length school bus along Z. */
function buildSchoolBus() {
  const arrays = { positions: [], normals: [], colors: [] }
  const yellow = hex('#e0a800')
  const black = hex('#1f2933')
  const glass = hex('#93c5fd')
  const L = 1
  const W = 2.5 / 12
  const H = 3.2 / 12
  addBox(arrays, 0, H * 0.55, 0, W, H * 0.7, L * 0.95, yellow)
  addBox(arrays, 0, H * 0.85, L * 0.28, W * 0.9, H * 0.28, L * 0.35, glass)
  addBox(arrays, 0, H * 0.12, 0, W * 1.05, H * 0.08, L * 0.98, black)
  for (const z of [-0.32, 0.28]) {
    addCylinder(arrays, 0, H * 0.22, W * 0.28, black, 14, -W * 0.55, z)
    addCylinder(arrays, 0, H * 0.22, W * 0.28, black, 14, W * 0.55, z)
  }
  return arrays
}

/** Unit-length Abrams-style tank along Z. */
function buildAbrams() {
  const arrays = { positions: [], normals: [], colors: [] }
  const green = hex('#5c6b4a')
  const dark = hex('#3f4a32')
  const barrel = hex('#2f3628')
  const L = 1
  const W = 3.66 / 9.77
  const H = 2.44 / 9.77
  addBox(arrays, 0, H * 0.28, 0, W, H * 0.4, L * 0.95, green)
  addBox(arrays, 0, H * 0.55, -0.05, W * 0.7, H * 0.28, L * 0.45, dark)
  addCylinderZ(arrays, -0.05, 0.55, 0.035, barrel, 12, 0, H * 0.58)
  for (const x of [-W * 0.42, W * 0.42]) {
    addBox(arrays, x, H * 0.12, 0, W * 0.18, H * 0.18, L * 0.9, dark)
  }
  return arrays
}

/** Unit-length horizontal bomb along Z. */
function buildBomb(colorHex, tipHex) {
  const arrays = { positions: [], normals: [], colors: [] }
  const body = hex(colorHex)
  const tip = hex(tipHex)
  const R = 0.12
  addCylinderZ(arrays, -0.4, 0.35, R, body, 22, 0, R)
  // nose
  const segments = 18
  const tipP = [0, R, 0.5]
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2
    const a1 = ((i + 1) / segments) * Math.PI * 2
    const p0 = [Math.cos(a0) * R, R + Math.sin(a0) * R, 0.35]
    const p1 = [Math.cos(a1) * R, R + Math.sin(a1) * R, 0.35]
    pushTri(arrays, p0, p1, tipP, tip)
  }
  // fins
  const fin = hex('#374151')
  for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    addBox(arrays, c * R * 0.9, R + s * R * 0.9, -0.42, 0.02 + Math.abs(c) * 0.12, 0.02 + Math.abs(s) * 0.12, 0.12, fin)
  }
  return arrays
}

/** Unit-height Statue of Liberty-ish. */
function buildLiberty() {
  const arrays = { positions: [], normals: [], colors: [] }
  const green = hex('#3f8f7a')
  const stone = hex('#9ca3af')
  addBox(arrays, 0, 0.08, 0, 0.35, 0.16, 0.35, stone)
  addCylinder(arrays, 0.16, 0.7, 0.08, green, 16)
  addBox(arrays, 0, 0.82, 0, 0.18, 0.2, 0.12, green)
  addBox(arrays, 0.12, 0.95, 0, 0.04, 0.28, 0.04, green)
  addConeY(arrays, 0.88, 1, 0.1, green, 12)
  return arrays
}

function buildGlb(arrays, name) {
  const vertexCount = arrays.positions.length / 3
  const posBytes = vertexCount * 12
  const normBytes = vertexCount * 12
  const colBytes = vertexCount * 12
  const bufferLength = posBytes + normBytes + colBytes

  const bin = Buffer.alloc(bufferLength)
  let o = 0
  for (const v of arrays.positions) {
    bin.writeFloatLE(v, o)
    o += 4
  }
  for (const v of arrays.normals) {
    bin.writeFloatLE(v, o)
    o += 4
  }
  for (const v of arrays.colors) {
    bin.writeFloatLE(v, o)
    o += 4
  }

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity
  for (let i = 0; i < arrays.positions.length; i += 3) {
    minX = Math.min(minX, arrays.positions[i])
    maxX = Math.max(maxX, arrays.positions[i])
    minY = Math.min(minY, arrays.positions[i + 1])
    maxY = Math.max(maxY, arrays.positions[i + 1])
    minZ = Math.min(minZ, arrays.positions[i + 2])
    maxZ = Math.max(maxZ, arrays.positions[i + 2])
  }

  const gltf = {
    asset: { version: '2.0', generator: 'MagnitudeMap generate-props' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name }],
    meshes: [
      {
        name,
        primitives: [{ attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 }, mode: 4 }],
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: vertexCount,
        type: 'VEC3',
        max: [maxX, maxY, maxZ],
        min: [minX, minY, minZ],
      },
      { bufferView: 1, componentType: 5126, count: vertexCount, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: vertexCount, type: 'VEC3' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBytes, target: 34962 },
      { buffer: 0, byteOffset: posBytes, byteLength: normBytes, target: 34962 },
      { buffer: 0, byteOffset: posBytes + normBytes, byteLength: colBytes, target: 34962 },
    ],
    buffers: [{ byteLength: bufferLength }],
  }

  const json = Buffer.from(JSON.stringify(gltf), 'utf8')
  const jsonPadding = (4 - (json.length % 4)) % 4
  const jsonChunk = Buffer.concat([json, Buffer.alloc(jsonPadding, 0x20)])
  const binPadding = (4 - (bin.length % 4)) % 4
  const binChunk = Buffer.concat([bin, Buffer.alloc(binPadding, 0)])

  const totalLength = 12 + 8 + jsonChunk.length + 8 + binChunk.length
  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(totalLength, 8)

  const jsonHeader = Buffer.alloc(8)
  jsonHeader.writeUInt32LE(jsonChunk.length, 0)
  jsonHeader.writeUInt32LE(0x4e4f534a, 4)

  const binHeader = Buffer.alloc(8)
  binHeader.writeUInt32LE(binChunk.length, 0)
  binHeader.writeUInt32LE(0x004e4942, 4)

  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk])
}

/** Only items that still lack a redistributable third-party GLB. */
const PROPS = [
  {
    id: 'little-boy',
    build: () => buildBomb('#6b7280', '#9ca3af'),
    notes: 'Stylized Little Boy casing. Scaled to 3 m length in-app.',
  },
  {
    id: 'tsar-bomba',
    build: () => buildBomb('#4b5563', '#f59e0b'),
    notes: 'Stylized Tsar Bomba. Scaled to 8 m length in-app.',
  },
]

function main() {
  for (const prop of PROPS) {
    const outDir = join(modelsDir, prop.id)
    mkdirSync(outDir, { recursive: true })
    const glb = buildGlb(prop.build(), prop.id)
    writeFileSync(join(outDir, 'model.glb'), glb)
    writeFileSync(
      join(outDir, 'license.json'),
      `${JSON.stringify(
        {
          id: prop.id,
          file: 'model.glb',
          license: 'CC0-1.0',
          author: 'MagnitudeMap',
          source: 'Generated by scripts/generate-props.mjs',
          notes: prop.notes,
        },
        null,
        2,
      )}\n`,
    )
    console.log(`OK ${prop.id} (${glb.length} bytes)`)
  }
  console.log(`Done. ${PROPS.length} props in public/models/`)
}

main()
