/**
 * Bake historical N1 paint onto public/models/n1/model.glb:
 * olive-drab lower stages + off-white upper section (sharp horizontal split).
 *
 * Run after fetch: node scripts/paint-n1.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const glbPath = join(__dirname, '..', 'public', 'models', 'n1', 'model.glb')

/** Fraction of height from base where green → white (stage-3 neck / upper-stage flare). */
const WHITE_START = 0.59

const GREEN = hex('#3f5228')
const WHITE = hex('#f0ebe3')
const ENGINE = hex('#1a1a1a')

function hex(h) {
  const n = h.replace('#', '')
  return {
    r: parseInt(n.slice(0, 2), 16) / 255,
    g: parseInt(n.slice(2, 4), 16) / 255,
    b: parseInt(n.slice(4, 6), 16) / 255,
  }
}

function parseGlb(buf) {
  let offset = 12
  let json
  let bin
  while (offset < buf.length) {
    const chunkLen = buf.readUInt32LE(offset)
    const chunkType = buf.toString('utf8', offset + 4, offset + 8).replace(/\0/g, '')
    const data = buf.subarray(offset + 8, offset + 8 + chunkLen)
    if (chunkType === 'JSON') json = JSON.parse(data.toString('utf8'))
    if (chunkType === 'BIN') bin = Buffer.from(data)
    offset += 8 + chunkLen
  }
  if (!json || !bin) throw new Error('Invalid GLB')
  return { json, bin }
}

function writeGlb(json, bin) {
  const jsonStr = JSON.stringify(json)
  const jsonPad = (4 - (jsonStr.length % 4)) % 4
  const jsonBuf = Buffer.alloc(jsonStr.length + jsonPad, 0x20)
  jsonBuf.write(jsonStr, 0, 'utf8')

  const binPad = (4 - (bin.length % 4)) % 4
  const binBuf = binPad ? Buffer.concat([bin, Buffer.alloc(binPad, 0)]) : bin

  const total = 12 + 8 + jsonBuf.length + 8 + binBuf.length
  const out = Buffer.alloc(total)
  out.write('glTF', 0)
  out.writeUInt32LE(2, 4)
  out.writeUInt32LE(total, 8)
  out.writeUInt32LE(jsonBuf.length, 12)
  out.write('JSON', 16)
  jsonBuf.copy(out, 20)
  const binChunkStart = 20 + jsonBuf.length
  out.writeUInt32LE(binBuf.length, binChunkStart)
  out.write('BIN\0', binChunkStart + 4)
  binBuf.copy(out, binChunkStart + 8)
  return out
}

function mat4Identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
}

function mul(a, b) {
  const o = new Array(16)
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]
    }
  }
  return o
}

function fromTRS(t = [0, 0, 0], r = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = r
  const [sx, sy, sz] = s
  const x2 = x + x
  const y2 = y + y
  const z2 = z + z
  const xx = x * x2
  const xy = x * y2
  const xz = x * z2
  const yy = y * y2
  const yz = y * z2
  const zz = z * z2
  const wx = w * x2
  const wy = w * y2
  const wz = w * z2
  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    t[0],
    t[1],
    t[2],
    1,
  ]
}

function transformPoint(m, p) {
  const x = p[0]
  const y = p[1]
  const z = p[2]
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ]
}

function readAccessor(json, bin, accessorIndex) {
  const acc = json.accessors[accessorIndex]
  const view = json.bufferViews[acc.bufferView]
  const start = (view.byteOffset || 0) + (acc.byteOffset || 0)
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type]
  const bytesPer =
    acc.componentType === 5126 ? 4 : acc.componentType === 5123 ? 2 : acc.componentType === 5125 ? 4 : 1
  const stride = view.byteStride || comps * bytesPer
  const out = new Float32Array(acc.count * comps)
  for (let i = 0; i < acc.count; i++) {
    const off = start + i * stride
    for (let c = 0; c < comps; c++) {
      if (acc.componentType === 5126) out[i * comps + c] = bin.readFloatLE(off + c * 4)
      else if (acc.componentType === 5123) out[i * comps + c] = bin.readUInt16LE(off + c * 2)
      else if (acc.componentType === 5125) out[i * comps + c] = bin.readUInt32LE(off + c * 4)
      else out[i * comps + c] = bin[off + c]
    }
  }
  return { values: out, count: acc.count, comps }
}

function computeNodeWorlds(json) {
  const nodeWorld = new Array(json.nodes.length)
  function walk(i, parent) {
    const n = json.nodes[i]
    const local = n.matrix ? n.matrix : fromTRS(n.translation, n.rotation, n.scale)
    nodeWorld[i] = mul(parent, local)
    for (const c of n.children || []) walk(c, nodeWorld[i])
  }
  for (const root of json.scenes[0].nodes) walk(root, mat4Identity())
  return nodeWorld
}

function materialLuminance(mat) {
  const f = mat?.pbrMetallicRoughness?.baseColorFactor
  if (!f) return 0.5
  return f[0] * 0.2126 + f[1] * 0.7152 + f[2] * 0.0722
}

function writeColorsIntoBin(bin, json, accessorIndex, colors) {
  const acc = json.accessors[accessorIndex]
  const view = json.bufferViews[acc.bufferView]
  const start = (view.byteOffset || 0) + (acc.byteOffset || 0)
  const stride = view.byteStride || 16
  for (let i = 0; i < acc.count; i++) {
    const off = start + i * stride
    bin.writeFloatLE(colors[i * 4], off)
    bin.writeFloatLE(colors[i * 4 + 1], off + 4)
    bin.writeFloatLE(colors[i * 4 + 2], off + 8)
    bin.writeFloatLE(colors[i * 4 + 3], off + 12)
  }
}

function main() {
  const force = process.argv.includes('--force')
  const { json, bin } = parseGlb(readFileSync(glbPath))
  const alreadyPainted = json.meshes.some((m) => m.primitives?.[0]?.attributes?.COLOR_0 !== undefined)
  if (alreadyPainted && !force) {
    console.log('N1 already has vertex colors; skipping (use --force to repaint).')
    return
  }

  const nodeWorld = computeNodeWorlds(json)

  let yMin = Infinity
  let yMax = -Infinity
  const meshNodes = []

  for (let ni = 0; ni < json.nodes.length; ni++) {
    const n = json.nodes[ni]
    if (n.mesh === undefined) continue
    const mesh = json.meshes[n.mesh]
    const prim = mesh.primitives[0]
    const pos = readAccessor(json, bin, prim.attributes.POSITION)
    for (let i = 0; i < pos.count; i++) {
      const p = transformPoint(nodeWorld[ni], [
        pos.values[i * 3],
        pos.values[i * 3 + 1],
        pos.values[i * 3 + 2],
      ])
      yMin = Math.min(yMin, p[1])
      yMax = Math.max(yMax, p[1])
    }
    meshNodes.push({ ni, meshIndex: n.mesh, prim, pos })
  }

  const height = yMax - yMin
  const splitY = yMin + WHITE_START * height
  console.log(
    `N1 paint: Y [${yMin.toFixed(2)}, ${yMax.toFixed(2)}] split@${splitY.toFixed(2)} (${WHITE_START * 100}% from base)`,
  )

  let colorBlob = Buffer.alloc(0)
  const colorViewStart = bin.length
  const mutableBin = Buffer.from(bin)

  for (const { ni, prim, pos } of meshNodes) {
    const mat = json.materials[prim.material]
    // After a prior paint, baseColor is white — treat only near-black originals as engines.
    // Engine meshes keep COLOR_0 dark via keepDark when luminance was computed pre-paint;
    // on --force repaint, detect by existing near-black vertex average if present.
    let keepDark = materialLuminance(mat) < 0.08
    if (alreadyPainted && prim.attributes.COLOR_0 !== undefined) {
      const existing = readAccessor(json, mutableBin, prim.attributes.COLOR_0)
      let avg = 0
      for (let i = 0; i < existing.count; i++) {
        avg +=
          existing.values[i * 4] * 0.2126 +
          existing.values[i * 4 + 1] * 0.7152 +
          existing.values[i * 4 + 2] * 0.0722
      }
      avg /= existing.count
      keepDark = avg < 0.15
    }

    const colors = new Float32Array(pos.count * 4)
    for (let i = 0; i < pos.count; i++) {
      const p = transformPoint(nodeWorld[ni], [
        pos.values[i * 3],
        pos.values[i * 3 + 1],
        pos.values[i * 3 + 2],
      ])
      const c = keepDark ? ENGINE : p[1] >= splitY ? WHITE : GREEN
      colors[i * 4] = c.r
      colors[i * 4 + 1] = c.g
      colors[i * 4 + 2] = c.b
      colors[i * 4 + 3] = 1
    }

    if (prim.attributes.COLOR_0 !== undefined) {
      writeColorsIntoBin(mutableBin, json, prim.attributes.COLOR_0, colors)
      continue
    }

    const colorBuf = Buffer.from(colors.buffer)
    const byteOffset = colorViewStart + colorBlob.length
    const viewIndex = json.bufferViews.length
    json.bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: colorBuf.length,
      byteStride: 16,
      target: 34962,
    })
    const accessorIndex = json.accessors.length
    json.accessors.push({
      bufferView: viewIndex,
      componentType: 5126,
      count: pos.count,
      type: 'VEC4',
      min: [0, 0, 0, 1],
      max: [1, 1, 1, 1],
    })
    prim.attributes.COLOR_0 = accessorIndex
    colorBlob = Buffer.concat([colorBlob, colorBuf])
  }

  // Vertex colors multiply baseColor — keep base white so paint reads true.
  for (const mat of json.materials) {
    const pbr = mat.pbrMetallicRoughness || (mat.pbrMetallicRoughness = {})
    pbr.baseColorFactor = [1, 1, 1, 1]
    pbr.metallicFactor = 0
    pbr.roughnessFactor = 0.62
  }

  const newBin =
    colorBlob.length > 0 ? Buffer.concat([mutableBin, colorBlob]) : mutableBin
  json.buffers[0].byteLength = newBin.length
  writeFileSync(glbPath, writeGlb(json, newBin))
  console.log(`Painted ${meshNodes.length} meshes → ${glbPath}`)
}

main()
