import {
  Mesh,
  type Material,
  type Scene,
  VertexData,
} from '@babylonjs/core'
import type { MoneyPack, MoneyUnitSize } from '../data/moneyPack'

/**
 * Atlas UV rectangles for one unit money cube (from models/money/model.glb).
 * Corners are BL → BR → TR → TL in face-local space for one whole clip.
 * Measured from GLB accessors — tiling uses these rects only (never half a clip).
 */
type UvRect = {
  bl: readonly [number, number]
  br: readonly [number, number]
  tr: readonly [number, number]
  tl: readonly [number, number]
}

/**
 * Face atlas clips for the LeopardGepard money cube (Y-up, bill faces on ±Z).
 * +Z/−Z = bill faces; ±X = strapped sides; ±Y = top/bottom edges.
 */
const MONEY_FACE_UV = {
  posX: {
    bl: [0.3221, 0.708],
    br: [0.0028, 0.708],
    tr: [0.0028, 0.3582],
    tl: [0.3221, 0.3582],
  },
  negX: {
    bl: [0.3277, 0.3582],
    br: [0.6469, 0.3582],
    tr: [0.6469, 0.708],
    tl: [0.3277, 0.708],
  },
  posY: {
    bl: [0.6779, 0.3348],
    br: [0.6779, 0.0028],
    tr: [0.9972, 0.0028],
    tl: [0.9972, 0.3348],
  },
  negY: {
    bl: [0.6525, 0.6902],
    br: [0.6525, 0.3582],
    tr: [0.9718, 0.3582],
    tl: [0.9718, 0.6902],
  },
  posZ: {
    bl: [0.3404, 0.0028],
    br: [0.6723, 0.0028],
    tr: [0.6723, 0.3526],
    tl: [0.3404, 0.3526],
  },
  negZ: {
    bl: [0.3348, 0.3526],
    br: [0.0028, 0.3526],
    tr: [0.0028, 0.0028],
    tl: [0.3348, 0.0028],
  },
} as const satisfies Record<string, UvRect>

function lerpUv(rect: UvRect, u: number, v: number): [number, number] {
  const bottomU = rect.bl[0] + (rect.br[0] - rect.bl[0]) * u
  const bottomV = rect.bl[1] + (rect.br[1] - rect.bl[1]) * u
  const topU = rect.tl[0] + (rect.tr[0] - rect.tl[0]) * u
  const topV = rect.tl[1] + (rect.tr[1] - rect.tl[1]) * u
  return [bottomU + (topU - bottomU) * v, bottomV + (topV - bottomV) * v]
}

function pushQuad(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  x3: number,
  y3: number,
  z3: number,
  nx: number,
  ny: number,
  nz: number,
  rect: UvRect,
) {
  const base = positions.length / 3
  positions.push(x0, y0, z0, x1, y1, z1, x2, y2, z2, x3, y3, z3)
  for (let i = 0; i < 4; i++) normals.push(nx, ny, nz)
  const uv0 = lerpUv(rect, 0, 0)
  const uv1 = lerpUv(rect, 1, 0)
  const uv2 = lerpUv(rect, 1, 1)
  const uv3 = lerpUv(rect, 0, 1)
  uvs.push(uv0[0], uv0[1], uv1[0], uv1[1], uv2[0], uv2[1], uv3[0], uv3[1])
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
}

/**
 * One solid money pile: 6 faces, each subdivided into whole unit cells so every
 * quad samples a full atlas money clip (never a half-block). Triangle count is
 * O(surface of the AABB), not O(volume).
 */
export function createMoneyTiledPile(
  name: string,
  pack: MoneyPack,
  _unit: MoneyUnitSize,
  material: Material | null,
  scene: Scene,
): Mesh {
  const { nx, ny, nz } = pack
  const totalW = pack.width
  const totalH = pack.height
  const totalL = pack.length
  const cellW = totalW / nx
  const cellH = totalH / ny
  const cellL = totalL / nz

  const x0 = -totalW / 2
  const y0 = 0
  const z0 = -totalL / 2

  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  // +X / −X  (tile nz along Z, ny along Y)
  for (let iy = 0; iy < ny; iy++) {
    for (let iz = 0; iz < nz; iz++) {
      const yA = y0 + iy * cellH
      const yB = yA + cellH
      const zA = z0 + iz * cellL
      const zB = zA + cellL
      const xP = x0 + totalW
      const xN = x0
      pushQuad(
        positions,
        normals,
        uvs,
        indices,
        xP,
        yA,
        zB,
        xP,
        yA,
        zA,
        xP,
        yB,
        zA,
        xP,
        yB,
        zB,
        1,
        0,
        0,
        MONEY_FACE_UV.posX,
      )
      pushQuad(
        positions,
        normals,
        uvs,
        indices,
        xN,
        yA,
        zA,
        xN,
        yA,
        zB,
        xN,
        yB,
        zB,
        xN,
        yB,
        zA,
        -1,
        0,
        0,
        MONEY_FACE_UV.negX,
      )
    }
  }

  // +Y / −Y  (tile nx along X, nz along Z)
  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++) {
      const xA = x0 + ix * cellW
      const xB = xA + cellW
      const zA = z0 + iz * cellL
      const zB = zA + cellL
      const yP = y0 + totalH
      const yN = y0
      pushQuad(
        positions,
        normals,
        uvs,
        indices,
        xA,
        yP,
        zB,
        xB,
        yP,
        zB,
        xB,
        yP,
        zA,
        xA,
        yP,
        zA,
        0,
        1,
        0,
        MONEY_FACE_UV.posY,
      )
      pushQuad(
        positions,
        normals,
        uvs,
        indices,
        xA,
        yN,
        zA,
        xB,
        yN,
        zA,
        xB,
        yN,
        zB,
        xA,
        yN,
        zB,
        0,
        -1,
        0,
        MONEY_FACE_UV.negY,
      )
    }
  }

  // +Z / −Z  (tile nx along X, ny along Y) — bill faces
  for (let ix = 0; ix < nx; ix++) {
    for (let iy = 0; iy < ny; iy++) {
      const xA = x0 + ix * cellW
      const xB = xA + cellW
      const yA = y0 + iy * cellH
      const yB = yA + cellH
      const zP = z0 + totalL
      const zN = z0
      pushQuad(
        positions,
        normals,
        uvs,
        indices,
        xA,
        yA,
        zP,
        xB,
        yA,
        zP,
        xB,
        yB,
        zP,
        xA,
        yB,
        zP,
        0,
        0,
        1,
        MONEY_FACE_UV.posZ,
      )
      pushQuad(
        positions,
        normals,
        uvs,
        indices,
        xB,
        yA,
        zN,
        xA,
        yA,
        zN,
        xA,
        yB,
        zN,
        xB,
        yB,
        zN,
        0,
        0,
        -1,
        MONEY_FACE_UV.negZ,
      )
    }
  }

  const mesh = new Mesh(name, scene)
  const vertexData = new VertexData()
  vertexData.positions = positions
  vertexData.normals = normals
  vertexData.uvs = uvs
  vertexData.indices = indices
  vertexData.applyToMesh(mesh)
  if (material) mesh.material = material
  mesh.isPickable = true
  return mesh
}
