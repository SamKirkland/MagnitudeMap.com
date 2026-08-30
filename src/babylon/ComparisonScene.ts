// Deep imports, not the '@babylonjs/core' barrel. The barrel defeats
// tree-shaking: it pulled the whole engine into the ComparisonScene chunk
// (1.6 MB, ~60% of it unused, 3.3 s of script evaluation on mobile).
//
// These are the side-effectful module paths ('Meshes/mesh'), not the '.pure'
// ones. Each re-exports its .pure implementation and additionally registers the
// runtime bits that class needs, so behaviour matches the barrel; '.pure' would
// silently drop those registrations.
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { Animation } from '@babylonjs/core/Animations/animation'
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup'
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import type { ArcRotateCameraPointersInput } from '@babylonjs/core/Cameras/Inputs/arcRotateCameraPointersInput'
import { BoundingInfo } from '@babylonjs/core/Culling/boundingInfo'
import { Camera } from '@babylonjs/core/Cameras/camera'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Constants } from '@babylonjs/core/Engines/constants'
import { CubeTexture } from '@babylonjs/core/Materials/Textures/cubeTexture'
import { CubicEase, EasingFunction } from '@babylonjs/core/Animations/easing'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { Engine } from '@babylonjs/core/Engines/engine'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import type { Material } from '@babylonjs/core/Materials/material'
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { MultiMaterial } from '@babylonjs/core/Materials/multiMaterial'
import type { Node } from '@babylonjs/core/node'
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { PointerEventTypes, type PointerInfo } from '@babylonjs/core/Events/pointerEvents'
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture'
import { Scene } from '@babylonjs/core/scene'
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader'
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { Skeleton } from '@babylonjs/core/Bones/skeleton'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { SubMesh } from '@babylonjs/core/Meshes/subMesh'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer'
import { Viewport } from '@babylonjs/core/Maths/math.viewport'
// Side-effect only. shadowGenerator.js warns at runtime and renders no shadows
// unless the scene component that drives it is registered; the barrel used to
// bring this in for us.
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'
// Installs Scene.createPickingRay / Scene.pick. Babylon's ES6 build ships the
// picking API as a side-effect augmentation, so without this import every
// scene.pick() throws and click-to-focus and hover silently do nothing.
import '@babylonjs/core/Culling/ray'
// Installs AbstractMesh.enableEdgesRendering. Same story as picking above: the
// ES6 build only patches the prototype when this module is imported, so the
// hover cage threw here and killed the outline plus its dimension labels.
import '@babylonjs/core/Rendering/edgesRenderer'
import { CreateScreenshotUsingRenderTargetAsync } from '@babylonjs/core/Misc/screenshotTools'
// glTF 2.0 only. The bare '@babylonjs/loaders/glTF' entry also registers the
// glTF 1.0 loader, which nothing here loads.
import '@babylonjs/loaders/glTF/2.0'
import { DracoDecoder } from '@babylonjs/core/Meshes/Compression/dracoDecoder'
// Vite emits these as hashed assets; they are never parsed as modules.
import dracoWrapperUrl from '@babylonjs/core/assets/Draco/draco_wasm_wrapper_gltf.js?url'
import dracoWasmUrl from '@babylonjs/core/assets/Draco/draco_decoder_gltf.wasm?url'
import dracoFallbackUrl from '@babylonjs/core/assets/Draco/draco_decoder_gltf.js?url'
import {
  CATALOG_BY_ID,
  type CatalogItem,
  type CatalogInstanceGrid,
  type ScaleAxis,
} from '../data/catalog'
import {
  blastRadiusM,
  hasBlastEffect,
  resolveDetonationItem,
  type DetonationMode,
} from '../data/blastEffects'
import {
  packMoneyAmount,
} from '../data/moneyPack'
import { createMoneyTiledPile } from './moneyTiledMesh'
import { formatLength, type UnitSystem } from '../units'
import { convertUnitsInText } from '../unitText'
import {
  facingExtentAlongX,
  itemMagnitude,
  layoutRevealPositions,
  pairSpacingGap,
  poseForItems,
  poseForTourStep,
  poseForWorldBounds,
  shortestAngleTo,
  sortBySizeAscending,
  tourAnglesFromYaw,
  type CameraPose,
} from './cameraTour'
import {
  clampTourSettings,
  DEFAULT_TOUR_SETTINGS,
  SPREAD_MIN,
  tourSettingsEqual,
  type TourSettings,
} from '../tourSettings'
import {
  axisSizeAfterAuthoringYaw,
  displayYawRadians,
  itemExtentAlongZ,
  normalizeYawTurns,
} from '../modelOrientation'
import {
  createDirtSideTexture,
  createNeighborhoodTexture,
  createUndersideCutawayTexture,
  NEIGHBORHOOD_TILE_METERS,
} from './neighborhoodTexture'
import {
  createWaterSideTexture,
  createWaterSurfaceTexture,
  createWaterUndersideTexture,
  WATER_TILE_METERS,
} from './waterTexture'
import {
  DEFAULT_GROUND_PLATE,
  GROUND_PLATE_BY_ID,
  type GroundPlate,
  type GroundPlateId,
} from '../data/groundPlates'
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, publicAssetUrl } from '../site'
import { aabbCorners, posterViewAngles } from '../poster/ortho'
import {
  headlineSizeMeters,
  type PosterCaptureRequest,
  type PosterCaptureResult,
  type PosterFrameRequest,
  type PosterItemProjection,
  type PosterOverlayState,
  type PosterPreviewSettings,
  type PosterView,
} from '../poster/types'
import { posterLabelBandPx, posterLabelFontSize, posterUsesGrid } from '../poster/settings'
import {
  distantHelperCutoff,
  isHelperLabel,
  isNeedleSize,
  isPaperSize,
  type MeasuredMeters,
} from '../modelVerify'

export type ComparisonSceneOptions = {
  /** OG capture: perspective screenshot, no plaques or camera controls. */
  capture?: boolean
}

/**
 * Every model in the catalog is Draco-compressed, and Babylon's stock
 * configuration pulls the decoder from cdn.babylonjs.com — a third-party origin
 * that is only discovered once the first model has already downloaded. Serve it
 * from our own bundle instead: no extra DNS/TLS, no runtime dependency on
 * someone else's CDN, and it can be warmed in parallel with the models.
 */
DracoDecoder.DefaultConfiguration = {
  wasmUrl: dracoWrapperUrl,
  wasmBinaryUrl: dracoWasmUrl,
  fallbackUrl: dracoFallbackUrl,
}

/** Fetch and compile the decoder now, alongside the first models' download. */
function warmDracoDecoder() {
  try {
    void DracoDecoder.Default.whenReadyAsync().catch(() => undefined)
  } catch {
    // Decoding still works; it just pays for the fetch on the first model.
  }
}

type PlacedObject = {
  instanceId: string
  itemId: string
  /** Tracks casing vs ground/air so mode changes force a reload. */
  effectKey: string
  root: TransformNode
  /** User display yaw (90° snaps). Parent of `body`; plaques stay on `root`. */
  display: TransformNode
  body: TransformNode
  labelTex: DynamicTexture | null
  animationGroups: AnimationGroup[]
  clipPlaying: boolean
}

/**
 * Poster scale figures. Instead of leaving the user's "Adult" pick in the
 * lineup, the poster hides it and drops a black silhouette beside every few
 * objects — the architectural-drawing convention, and far easier to read.
 */
const POSTER_SCALE_FIGURE_ID = 'person-male'
const POSTER_SCALE_REFERENCE_IDS = new Set(['person-male', 'person-female'])
/** Objects smaller than this get no figure: it would dwarf them. */
const POSTER_SCALE_FIGURE_MIN_SIZE_M = 3
const POSTER_SCALE_FIGURE_EVERY = 3
const POSTER_SCALE_FIGURE_MAX = 6
/** Air kept around a figure, as a multiple of its own width. */
const POSTER_SCALE_FIGURE_SLOT = 2.2
/** Rows/columns the poster will wrap into at most. */
const POSTER_MAX_GROUPS = 6

type PosterEntry = {
  item: CatalogItem
  placement: PlacedObject
  min: Vector3
  max: Vector3
  /** Reserve room for a scale figure to this object's left. */
  figure: boolean
}

type PosterAxes = {
  /** World axis index that runs up the poster image. */
  up: 0 | 1 | 2
  /** World axis index pointing at the camera. */
  depth: 0 | 1 | 2
}

/** Reported while a lineup loads; null once the scene is settled. */
export type SceneLoadProgress = {
  /** Objects standing on the stage. */
  loaded: number
  total: number
  /** 0–1, counting the in-flight download of each object that is still coming. */
  fraction: number
}

export type TourUiState = {
  sortedItemIds: string[]
  stepIndex: number
  playing: boolean
  focusItemId: string | null
  mode: 'overview' | 'tour' | 'focus'
}

type TourListener = (state: TourUiState) => void

type PosterInteractiveSnapshot = {
  mode: number
  alpha: number
  beta: number
  radius: number
  target: Vector3
  fov: number
  minZ: number
  maxZ: number
  orthoLeft: number | null
  orthoRight: number | null
  orthoTop: number | null
  orthoBottom: number | null
  clearColor: Color4
  autoClear: boolean
  positions: Map<string, Vector3>
}

const TOUR_HOLD_MS = 2200
const CAMERA_ANIM_FRAMES = 75
const CAMERA_FOCUS_FRAMES = 96
const CAMERA_ANIM_FPS = 60
/** Cap backing-store DPR so retina + MSAA does not 4x fill rate. */
const MAX_DEVICE_PIXEL_RATIO = 1.5
/** Live poster preview: cheaper than interactive; 4K capture still supersamples. */
const MAX_POSTER_PREVIEW_PIXEL_RATIO = 1.25
/** After the camera/scene stop changing, pause clips and skip GPU submits. */
const IDLE_SETTLE_MS = 300
/**
 * Orbit radius where pan/zoom speeds are 1×. Matches the default camera radius so
 * human-scale navigation stays the same; larger views scale pan and zoom with it.
 */
const CAMERA_NAV_REFERENCE_RADIUS = 40

/**
 * Zoom envelope, as multiples of the radius the current framing uses.
 *
 * A flat 0.4 m floor and 50,000 km ceiling made zoom lopsided: you could pull
 * back roughly 50 notches into empty space, while the floor was measured from
 * the camera *target*, so on a wide lineup zooming in only ever closed on the
 * gap between models. Both ends now scale with whatever is being framed.
 */
const CAMERA_MIN_RADIUS_FRACTION = 0.02
const CAMERA_MAX_RADIUS_FACTOR = 6
/** Smallest usable radius outright; below this the near plane starts clipping. */
const CAMERA_MIN_RADIUS = 0.1
/** Floor for the ceiling, so a lone iPhone still has room to pull back. */
const CAMERA_MIN_MAX_RADIUS = 200

/** Fingers that must be down before a drag tilts instead of panning. */
const TILT_TOUCH_COUNT = 3
/** Radians of pitch per pixel of three-finger vertical travel. */
const TILT_RADIANS_PER_PIXEL = 0.006
/** Straight down and a hair above the horizon; past either the ground clips. */
const TILT_MIN_BETA = 0.12
const TILT_MAX_BETA = 1.52
/**
 * Directional sun + contact shadows. Off restores the original unlit comparison
 * look (no shadow maps, no extra lights). Flip true to ship lighting later.
 * Temporarily enabled for local preview.
 */
const ENABLE_SCENE_LIGHTING = true
/** In-shadow light mix. 0.22 = visible contact shadows; 1 = none. */
const SHADOW_DARKNESS = 0.22
const SHADOW_DARKNESS_OFF = 1

/** Fraction of the gap to a neighbour a plaque may occupy, so the two never touch. */
const PLAQUE_LANE_MARGIN = 0.92
/**
 * A plaque never shrinks below this, however tightly the lineup is packed —
 * a guard against a degenerate zero-width lane, not a legibility floor. Keep it
 * under the tightest real lane in the catalog (Rabbit beside Owl, 0.29 m) or it
 * reintroduces the overlap it is clamping.
 */
const PLAQUE_MIN_WIDTH_M = 0.25

/** Max facts rows on a plaque; overflow is ellipsised on the last line. */
const PLAQUE_FACT_LINES = 7

/** Type scale + padding for a plaque, all as fractions of texture width. */
function plaqueMetrics(texW: number) {
  return {
    titleSize: Math.round(texW * 0.085),
    dimsSize: Math.round(texW * 0.055),
    factsSize: Math.round(texW * 0.034),
    lineHeight: Math.round(texW * 0.034) * 1.32,
    padY: texW * 0.045,
    gapTitle: texW * 0.018,
    gapFacts: texW * 0.03,
    factsWidth: texW * 0.9,
  }
}

/**
 * Offscreen 2D context used only to measure text before the plaque texture
 * exists, so the mesh can be sized to the number of lines the facts wrap to.
 */
let plaqueMeasureCtx: CanvasRenderingContext2D | null = null
function measureCtx(): CanvasRenderingContext2D | null {
  if (plaqueMeasureCtx) return plaqueMeasureCtx
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 8
  canvas.height = 8
  plaqueMeasureCtx = canvas.getContext('2d')
  return plaqueMeasureCtx
}

/** Wrap an item's facts to the plaque column at the given texture width. */
function plaqueFactLines(
  item: CatalogItem,
  texW: number,
  units: UnitSystem,
): string[] {
  if (!item.facts) return []
  const ctx = measureCtx()
  if (!ctx) return []
  const m = plaqueMetrics(texW)
  ctx.font = `${m.factsSize}px "IBM Plex Sans", sans-serif`
  const facts = convertUnitsInText(item.facts, units)
  return wrapPlaqueText(ctx, facts, m.factsWidth, PLAQUE_FACT_LINES)
}

/**
 * Plaque depth (and texture height) as a fraction of its width. With facts the
 * height is driven by the wrapped line count, so short blurbs get a short
 * plaque instead of padding out to a fixed box.
 */
function plaqueAspect(
  item: CatalogItem,
  texW: number,
  units: UnitSystem,
): number {
  const lines = plaqueFactLines(item, texW, units)
  if (lines.length === 0) return 0.42
  const m = plaqueMetrics(texW)
  const height =
    m.padY +
    m.titleSize +
    m.gapTitle +
    m.dimsSize +
    m.gapFacts +
    m.lineHeight * lines.length +
    m.padY
  return height / texW
}

/**
 * Largest font size at or below `size` that fits `text` in `maxWidth`, down to
 * 60% before it gives up. The title and dimension lines are single centred
 * `fillText` calls with no wrap, so a long string ("5 ft 9 in tall", "ground
 * blast r 1,310 ft") would otherwise bleed past the plaque edge.
 */
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size: number,
  weight = '',
): number {
  const prefix = weight ? `${weight} ` : ''
  let fitted = size
  const floor = size * 0.6
  while (fitted > floor) {
    ctx.font = `${prefix}${Math.round(fitted)}px "IBM Plex Sans", sans-serif`
    if (ctx.measureText(text).width <= maxWidth) break
    fitted -= 1
  }
  return Math.round(Math.max(fitted, floor))
}

/** Greedy word wrap, ellipsising whatever does not fit in `maxLines`. */
function wrapPlaqueText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line)
      if (lines.length === maxLines) break
      line = word
    } else {
      line = next
    }
  }
  if (lines.length < maxLines && line) lines.push(line)

  const truncated = lines.length === maxLines && line !== lines[maxLines - 1]
  if (truncated) {
    let last = lines[maxLines - 1]
    while (last && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1).trimEnd()
    }
    lines[maxLines - 1] = `${last}…`
  }
  return lines
}

export class ComparisonScene {
  readonly engine: Engine
  readonly scene: Scene
  readonly camera: ArcRotateCamera

  private readonly placements = new Map<string, PlacedObject>()
  private ground: Mesh
  private skybox: Mesh
  private sun!: DirectionalLight
  private shadows: ShadowGenerator | null = null
  private neighborhoodTex: DynamicTexture | null = null
  private dirtSideTex: DynamicTexture | null = null
  private undersideTex: DynamicTexture | null = null
  private waterSurfaceTex: DynamicTexture | null = null
  private waterSideTex: DynamicTexture | null = null
  private waterUndersideTex: DynamicTexture | null = null
  private disposed = false
  private loadGeneration = 0

  private sortedItems: CatalogItem[] = []
  private itemXs = new Map<string, number>()
  private stepIndex = 0
  private playing = false
  private focusItemId: string | null = null
  private mode: TourUiState['mode'] = 'overview'
  private tourTimer: number | null = null
  private listeners = new Set<TourListener>()
  private readonly loadListeners = new Set<(state: SceneLoadProgress | null) => void>()
  private loadProgress: SceneLoadProgress | null = null
  /** Per-object download fraction for whatever is still coming. */
  private readonly loadInFlight = new Map<string, number>()
  private loadDone = 0
  private loadTotal = 0
  private pointerDownPos: { x: number; y: number } | null = null
  /** Live touch points on the canvas, keyed by pointerId. Touch only — a mouse
   *  never enters here, so the gesture layer is inert on desktop. */
  private activeTouches = new Map<number, { x: number; y: number }>()
  /** Mean Y of the touch points on the previous move, while tilting. */
  private tiltLastY: number | null = null
  private units: UnitSystem = 'metric'
  private groundPlateId: GroundPlateId = DEFAULT_GROUND_PLATE
  private shadowsWanted = true
  private cityRoot: TransformNode | null = null
  private cityLoadGen = 0
  private cityFootprint = { width: 0, depth: 0 }
  private detonationMode: DetonationMode = 'casing'
  private activeItemIds: string[] = []
  private hoverItemId: string | null = null
  private hoverRoot: TransformNode | null = null
  /** Shared GLB templates for instance grids (money piles). */
  private readonly modelTemplates = new Map<string, Mesh>()
  private readonly modelTemplateLoading = new Map<string, Promise<Mesh>>()
  private renderNeeded = true
  private heldIdle = false
  private idleSettleTimer: number | null = null
  private clipPlayingCount = 0
  private cameraMoveGen = 0
  private rendersThisSecond = 0
  private skippedThisSecond = 0
  private perfSecondStarted = 0
  private tourSettings: TourSettings = { ...DEFAULT_TOUR_SETTINGS }
  /** User-facing yaw for every model, in 90° turns (0–3). */
  private displayYawTurns = 0
  private readonly captureMode: boolean
  private posterPreview: {
    settings: PosterPreviewSettings
    saved: PosterInteractiveSnapshot
  } | null = null
  private readonly posterOverlayListeners = new Set<
    (state: PosterOverlayState | null) => void
  >()
  /** Silhouettes reused across every poster in the session. */
  private posterFigures: TransformNode[] = []
  private posterFigureWork: Promise<void> | null = null
  private posterFigureFailed = false
  /** True for the whole of capturePosterRender: the poster owns the camera. */
  private posterCapturing = false
  private posterFigureMaterial: StandardMaterial | null = null
  /** Scale references swapped out for silhouettes while the poster is up. */
  private posterHiddenItemIds = new Set<string>()
  /** Row (lineup) or column (stacked) each object landed in. */
  private readonly posterRowByItem = new Map<string, number>()

  constructor(
    canvas: HTMLCanvasElement,
    settings?: TourSettings,
    options?: ComparisonSceneOptions,
  ) {
    this.captureMode = Boolean(options?.capture)
    if (settings) this.tourSettings = clampTourSettings(settings)
    this.engine = new Engine(canvas, true, {
      powerPreference: 'high-performance',
      preserveDrawingBuffer: this.captureMode,
      stencil: false,
      adaptToDeviceRatio: false,
      // Babylon defaults the canvas to tabIndex="1", which puts it ahead of every
      // other control in the tab order and fails the axe `tabindex` rule. 0 keeps
      // the canvas keyboard-focusable in document order.
      canvasTabIndex: 0,
    })
    this.applyResolutionCap()
    warmDracoDecoder()

    this.scene = new Scene(this.engine)
    this.scene.clearColor = new Color4(0.894, 0.933, 0.945, 1)
    this.scene.ambientColor = ENABLE_SCENE_LIGHTING
      ? new Color3(0.18, 0.2, 0.22)
      : new Color3(0.35, 0.38, 0.4)
    this.scene.skipPointerMovePicking = true
    this.scene.constantlyUpdateMeshUnderPointer = false
    this.scene.collisionsEnabled = false
    this.scene.particlesEnabled = false
    this.scene.spritesEnabled = false
    this.scene.lensFlaresEnabled = false
    this.scene.proceduralTexturesEnabled = false
    this.scene.probesEnabled = false
    this.scene.postProcessesEnabled = false
    this.scene.renderTargetsEnabled = ENABLE_SCENE_LIGHTING
    this.scene.shadowsEnabled = ENABLE_SCENE_LIGHTING
    this.scene.fogEnabled = false

    this.camera = new ArcRotateCamera(
      'camera',
      -Math.PI / 2.4,
      1.15,
      CAMERA_NAV_REFERENCE_RADIUS,
      new Vector3(0, 2, 0),
      this.scene,
    )
    this.camera.mode = Camera.PERSPECTIVE_CAMERA
    this.camera.lowerRadiusLimit = 0.4
    // Death Star II is 160 km; leave headroom to zoom out past km-scale subjects.
    this.camera.upperRadiusLimit = 50_000_000
    // Lower = faster. At the old 8 a notch moved radius ~4%, so crossing the
    // zoom range took 60-odd notches and read as "it stopped letting me in".
    this.camera.wheelPrecision = 1.5
    // Babylon's default 0.9 pan inertia *adds* each mouse delta onto leftover
    // velocity, so a steady drag ramps to ~10× speed. Map-style pan: 1:1 with
    // the cursor, no coast after release.
    this.camera.panningInertia = 0
    this.syncCameraNavigationScale()
    this.camera.minZ = 0.05
    this.camera.maxZ = 1_000_000
    if (!this.captureMode) {
      this.camera.attachControl(canvas, true)
      // Middle-click drag pans like right-click (default map only has button 2 → pan).
      this.camera.movement.input.addEntry({
        source: 'pointer',
        button: 1,
        interaction: 'pan',
      })
      const pointers = this.camera.inputs.attached
        .pointers as ArcRotateCameraPointersInput | undefined
      if (pointers) {
        // Pinch tracks the fingers themselves rather than a fixed pixel
        // precision, which is the only zoom that stays usable across a range
        // running from a 0.4 m radius to a 160 km Death Star.
        pointers.useNaturalPinchZoom = true
      }
      canvas.addEventListener('pointerdown', this.onCanvasPointerDown)
      canvas.addEventListener('pointermove', this.onCanvasPointerMove)
      canvas.addEventListener('pointerup', this.onCanvasPointerUp)
      canvas.addEventListener('pointercancel', this.onCanvasPointerUp)
      canvas.addEventListener('wheel', this.onCanvasWheel, { passive: true })
    }

    this.installLights()

    this.skybox = this.createGradientSkybox()

    this.neighborhoodTex = createNeighborhoodTexture(this.scene)
    this.dirtSideTex = createDirtSideTexture(this.scene)
    this.undersideTex = createUndersideCutawayTexture(this.scene)
    this.waterSurfaceTex = createWaterSurfaceTexture(this.scene)
    this.waterSideTex = createWaterSideTexture(this.scene)
    this.waterUndersideTex = createWaterUndersideTexture(this.scene)

    this.ground = this.buildEarthSlab(0, 0, 60, 60)
    this.scene.blockMaterialDirtyMechanism = true

    if (!this.captureMode) this.scene.onPointerObservable.add(this.onPointer)

    this.engine.runRenderLoop(this.tickRender)
    window.addEventListener('resize', this.onResize)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.armIdleSettle()
  }

  subscribeTour(listener: TourListener) {
    this.listeners.add(listener)
    listener(this.getTourState())
    return () => {
      this.listeners.delete(listener)
    }
  }

  getTourState(): TourUiState {
    return {
      sortedItemIds: this.sortedItems.map((item) => item.id),
      stepIndex: this.stepIndex,
      playing: this.playing,
      focusItemId: this.focusItemId,
      mode: this.mode,
    }
  }

  playTour() {
    if (this.posterPreview || this.sortedItems.length === 0) return
    this.focusItemId = null
    this.playing = true
    this.mode = 'tour'
    this.goToStep(0, true)
    this.scheduleTourAdvance()
    this.emitTour()
  }

  pauseTour() {
    this.playing = false
    this.clearTourTimer()
    this.emitTour()
  }

  toggleTour() {
    if (this.playing) this.pauseTour()
    else this.playTour()
  }

  /** Babylon Inspector (FPS, scene graph, etc.). Lazy-loads @babylonjs/inspector. */
  async toggleDebugInspector() {
    await import('@babylonjs/core/Debug/debugLayer')
    await import('@babylonjs/inspector')
    if (this.scene.debugLayer.isVisible()) {
      this.scene.debugLayer.hide()
      this.armIdleSettle()
      return
    }
    await this.scene.debugLayer.show({
      embedMode: true,
      overlay: true,
      handleResize: true,
      enablePopup: false,
    })
    this.markDirty()
  }

  nextStep() {
    if (this.posterPreview || this.sortedItems.length === 0) return
    this.playing = false
    this.clearTourTimer()
    this.focusItemId = null
    this.mode = 'tour'
    const next = Math.min(this.stepIndex + 1, this.sortedItems.length - 1)
    this.goToStep(next, true)
    this.emitTour()
  }

  prevStep() {
    if (this.posterPreview || this.sortedItems.length === 0) return
    this.playing = false
    this.clearTourTimer()
    this.focusItemId = null
    this.mode = 'tour'
    const prev = Math.max(this.stepIndex - 1, 0)
    this.goToStep(prev, true)
    this.emitTour()
  }

  goToStep(stepIndex: number, animate = true) {
    if (this.sortedItems.length === 0) return
    this.stepIndex = Math.max(0, Math.min(stepIndex, this.sortedItems.length - 1))
    this.mode = 'tour'
    this.focusItemId = null

    const visible = this.tourVisibleItems(this.stepIndex)
    const xs = visible.map((item) => this.itemXs.get(item.id) ?? 0)
    const pose = poseForTourStep(
      visible,
      xs,
      this.tourAngles(),
      this.displayYawTurns,
      this.measuredFacingExtents(),
    )
    const itemId = this.sortedItems[this.stepIndex]?.id
    this.playFocusMotion(itemId)
    this.applyPose(pose, animate, CAMERA_ANIM_FRAMES)
    this.emitTour()
  }

  showOverview(animate = true) {
    this.playing = false
    this.clearTourTimer()
    this.focusItemId = null
    this.mode = 'overview'
    this.stepIndex = Math.max(0, this.sortedItems.length - 1)
    this.stopImportedClips()

    const xs = this.sortedItems.map((item) => this.itemXs.get(item.id) ?? 0)
    const pose = poseForItems(
      this.sortedItems,
      xs,
      this.tourAngles(),
      this.displayYawTurns,
      this.measuredFacingExtents(),
    )
    this.applyPose(pose, animate)
    this.emitTour()
  }

  setTourSettings(settings: TourSettings) {
    const next = clampTourSettings(settings)
    const prev = this.tourSettings
    if (tourSettingsEqual(prev, next)) return
    this.tourSettings = next

    const layoutChanged = prev.spread !== next.spread
    if (layoutChanged) {
      this.relayoutLineup()
      // Plaque width is clamped to the gap between neighbours, which just moved.
      for (const placement of this.placements.values()) {
        this.thawPlacement(placement)
        this.relayoutPlaque(placement)
      }
      this.freezeStaticScene()
    }
    this.reframeAfterSettingsChange(layoutChanged)
  }

  setDisplayYawTurns(turns: number) {
    const next = normalizeYawTurns(turns)
    if (next === this.displayYawTurns) return
    this.displayYawTurns = next
    const yaw = displayYawRadians(next)
    this.clearHover()
    for (const placement of this.placements.values()) {
      this.thawPlacement(placement)
      placement.display.rotation.y = yaw
    }
    this.relayoutLineup()
    for (const placement of this.placements.values()) {
      this.thawPlacement(placement)
      this.relayoutPlaque(placement)
    }
    this.freezeStaticScene()
    this.reframeAfterSettingsChange(true)
    this.markDirty()
  }

  focusItem(itemId: string, animate = true) {
    if (this.posterPreview) return
    const placement = [...this.placements.values()].find((p) => p.itemId === itemId)
    if (!placement) return

    this.playing = false
    this.clearTourTimer()
    this.focusItemId = itemId
    this.mode = 'focus'

    const sortedIndex = this.sortedItems.findIndex((entry) => entry.id === itemId)
    this.stepIndex = Math.max(0, sortedIndex)

    // Frame the model mesh only (not the ground plaque), using live bounds.
    const body = placement.body
    body.computeWorldMatrix(true)
    for (const child of body.getChildMeshes()) child.computeWorldMatrix(true)
    const { min, max } = this.visualBounds(body)

    const pose = poseForWorldBounds(
      {
        min: { x: min.x, y: min.y, z: min.z },
        max: { x: max.x, y: max.y, z: max.z },
      },
      {
        fov: this.camera.fov,
        aspect: Math.max(this.engine.getAspectRatio(this.camera), 0.5),
      },
      {
        // Keep a consistent 3/4 view so the object is the clear subject.
        alpha: -Math.PI / 2.4,
        beta: 1.05,
      },
    )
    this.applyPose(pose, animate, CAMERA_FOCUS_FRAMES)
    this.playFocusMotion(itemId)
    this.emitTour()
  }

  resetFocus(animate = true) {
    this.showOverview(animate)
  }

  /** World AABB of each loaded body after crop/scale/ground, in meters. */
  measureLoadedItemBounds(): Array<
    { itemId: string } & MeasuredMeters & {
      min: { x: number; y: number; z: number }
      max: { x: number; y: number; z: number }
    }
  > {
    const out: Array<
      { itemId: string } & MeasuredMeters & {
        min: { x: number; y: number; z: number }
        max: { x: number; y: number; z: number }
      }
    > = []
    for (const placement of this.placements.values()) {
      this.thawPlacement(placement)
      placement.body.computeWorldMatrix(true)
      const box = this.visualBounds(placement.body)
      out.push({
        itemId: placement.itemId,
        width: box.max.x - box.min.x,
        height: box.max.y - box.min.y,
        length: box.max.z - box.min.z,
        min: { x: box.min.x, y: box.min.y, z: box.min.z },
        max: { x: box.max.x, y: box.max.y, z: box.max.z },
      })
    }
    this.freezeStaticScene()
    return out
  }

  /**
   * Load progress for the current lineup. Fires with null when nothing is
   * outstanding, so a subscriber can hide its indicator on the same signal.
   */
  subscribeLoadProgress(listener: (state: SceneLoadProgress | null) => void) {
    this.loadListeners.add(listener)
    listener(this.loadProgress)
    return () => {
      this.loadListeners.delete(listener)
    }
  }

  private emitLoadProgress(state: SceneLoadProgress | null) {
    this.loadProgress = state
    for (const listener of this.loadListeners) listener(state)
  }

  async setActiveItems(
    itemIds: string[],
    opts: { camera?: 'overview' | 'preserve'; animate?: boolean } = {},
  ) {
    this.scene.blockMaterialDirtyMechanism = false
    try {
      await this.setActiveItemsUnblocked(itemIds, opts)
    } finally {
      this.scene.blockMaterialDirtyMechanism = true
    }
  }

  private async setActiveItemsUnblocked(
    itemIds: string[],
    opts: { camera?: 'overview' | 'preserve'; animate?: boolean } = {},
  ) {
    const cameraMode = opts.camera ?? 'overview'
    const generation = ++this.loadGeneration
    this.clearHover()
    this.activeItemIds = [...itemIds]

    if (cameraMode === 'overview') {
      this.pauseTour()
      this.focusItemId = null
      this.mode = 'overview'
    } else {
      // Library toggles: keep the user's view; drop focus only if that item was removed.
      if (this.focusItemId && !itemIds.includes(this.focusItemId)) {
        this.focusItemId = null
        this.mode = 'overview'
      }
    }

    const switching = this.placements.size > 0
    const unordered = itemIds
      .map((id) => CATALOG_BY_ID[id])
      .filter((item): item is CatalogItem => Boolean(item))
      .map((item) => resolveDetonationItem(item, this.detonationMode))

    // Layout from catalog sizes up front so nothing ever sits at the origin.
    const sorted = sortBySizeAscending(unordered)
    const xs = layoutRevealPositions(sorted, this.layoutView())
    this.sortedItems = sorted
    this.itemXs = xs

    const desired = new Set(itemIds)
    const existingByItem = new Map<string, PlacedObject>()
    for (const placement of this.placements.values()) {
      existingByItem.set(placement.itemId, placement)
    }

    const toRemove = [...existingByItem.entries()].filter(([itemId, placement]) => {
      if (!desired.has(itemId)) return true
      // Detonation mode changed for this munition — rebuild the mesh.
      return placement.effectKey !== this.effectKeyFor(itemId)
    })

    // Keepers jump to the new lineup immediately (shared items across presets).
    for (const item of sorted) {
      const kept = existingByItem.get(item.id)
      if (!kept) continue
      if (toRemove.some(([, p]) => p.instanceId === kept.instanceId)) continue
      this.thawPlacement(kept)
      kept.root.position.set(xs.get(item.id) ?? 0, 0, 0)
    }

    const removingIds = new Set(toRemove.map(([, p]) => p.itemId))
    const toLoad = sorted.filter(
      (item) => !existingByItem.has(item.id) || removingIds.has(item.id),
    )

    // The outgoing lineup goes now, not after the load: incoming objects take
    // its slots along X, so leaving it up would overlap two lineups for as
    // long as the slowest model takes.
    for (const [, placement] of toRemove) {
      this.removePlacement(placement.instanceId)
      existingByItem.delete(placement.itemId)
    }

    // Frame the lineup from catalog sizes before anything has loaded, so
    // objects appear inside the shot instead of the camera chasing them.
    // Snap rather than ease: there is nothing on stage yet to follow, and the
    // ease at the end covers catalog-vs-measured size differences.
    if (toLoad.length > 0 && cameraMode === 'overview') {
      this.showOverview(false)
    }

    this.startLoadProgress(generation, sorted.length, toLoad.length)
    await Promise.all(
      toLoad.map(async (item) => {
        if (this.disposed || generation !== this.loadGeneration) return
        const placement = await this.createPlacement(item, {
          x: xs.get(item.id) ?? 0,
          hidden: true,
          onProgress: (fraction) =>
            this.noteItemLoadProgress(generation, item.id, fraction),
        })
        if (this.disposed || generation !== this.loadGeneration) {
          this.disposePlacement(placement)
          return
        }
        // Reveal on arrival. Everything that follows is per-object work the
        // old all-at-once swap did in one batch.
        this.placements.set(placement.instanceId, placement)
        existingByItem.set(placement.itemId, placement)
        placement.root.setEnabled(true)
        this.settleLineup()
        this.noteItemLoaded(generation, item.id)
      }),
    )

    if (this.disposed || generation !== this.loadGeneration) return
    this.emitLoadProgress(null)

    this.settleLineup()
    this.stepIndex = Math.max(0, this.sortedItems.length - 1)

    if (this.posterPreview) {
      this.posterPreview.saved.positions = this.snapshotItemPositions()
      this.applyPosterLook(this.posterPreview.settings)
      this.emitTour()
      this.markDirty()
      return
    }

    if (cameraMode === 'overview') {
      // Ease on preset/content swaps; snap on first populate or when asked
      // (reset from a blast view is a huge scale jump — animating it looks broken).
      this.showOverview(opts.animate ?? switching)
    } else {
      this.emitTour()
    }
    this.markDirty()
  }

  /**
   * Repack and re-dress the lineup around whatever is currently standing.
   * Runs once per arrival during a load and once more at the end.
   */
  private settleLineup() {
    // Catalog width is body diameter; pack again from real mesh AABBs so
    // Tight never overlaps fins / legs / wings.
    this.relayoutLineup()

    // Re-seat plaques in root-local space (fixes offsets from lineup moves /
    // older world-space placement bugs).
    for (const placement of this.placements.values()) {
      this.relayoutPlaque(placement)
    }

    this.resizeGroundToContent()
    this.freezeStaticScene()
    this.markDirty()
  }

  private startLoadProgress(generation: number, total: number, pending: number) {
    this.loadInFlight.clear()
    if (pending === 0 || total === 0) {
      this.loadTotal = 0
      this.emitLoadProgress(null)
      return
    }
    this.loadDone = total - pending
    this.loadTotal = total
    this.publishLoadProgress(generation)
  }

  private noteItemLoadProgress(generation: number, itemId: string, fraction: number) {
    if (generation !== this.loadGeneration) return
    const clamped = Math.min(Math.max(fraction, 0), 1)
    const previous = this.loadInFlight.get(itemId) ?? 0
    // Byte events land in the hundreds; only redraw on a visible step.
    if (clamped - previous < 0.02 && clamped < 1) return
    this.loadInFlight.set(itemId, clamped)
    this.publishLoadProgress(generation)
  }

  private noteItemLoaded(generation: number, itemId: string) {
    if (generation !== this.loadGeneration) return
    this.loadInFlight.delete(itemId)
    this.loadDone += 1
    this.publishLoadProgress(generation)
  }

  /**
   * Each object is worth one slot; one still downloading is worth its own
   * fraction of a slot, so the bar keeps moving through a single big model.
   */
  private publishLoadProgress(generation: number) {
    if (generation !== this.loadGeneration || this.loadTotal === 0) return
    let partial = 0
    for (const fraction of this.loadInFlight.values()) partial += fraction
    this.emitLoadProgress({
      loaded: this.loadDone,
      total: this.loadTotal,
      fraction: Math.min((this.loadDone + partial) / this.loadTotal, 1),
    })
  }

  /**
   * Snap a 3/4 perspective overview and encode a JPEG for social cards.
   * Uses a render-target so the output is exactly `width`×`height`.
   */
  async capturePerspectiveJpeg(
    width = OG_IMAGE_WIDTH,
    height = OG_IMAGE_HEIGHT,
  ): Promise<Blob> {
    this.camera.mode = Camera.PERSPECTIVE_CAMERA
    this.engine.setSize(width, height)
    this.frameCameraOnLineup()
    this.heldIdle = false
    this.renderNeeded = true
    await this.whenSceneReady()
    await nextFrame()
    await nextFrame()

    const prevRt = this.scene.renderTargetsEnabled
    this.scene.renderTargetsEnabled = true
    try {
      const dataUrl = await CreateScreenshotUsingRenderTargetAsync(
        this.engine,
        this.camera,
        { width, height },
        'image/jpeg',
        4,
        true,
        undefined,
        false,
        false,
        true,
        0.86,
      )
      return dataUrlToBlob(dataUrl, 'image/jpeg')
    } finally {
      this.scene.renderTargetsEnabled = prevRt
      this.markDirty()
    }
  }

  /**
   * Locked top-down or side poster of the current lineup on a white (or
   * transparent) background.
   * Restores the live camera, ground, and item positions afterward.
   */
  async capturePosterRender(
    request: PosterCaptureRequest,
  ): Promise<PosterCaptureResult> {
    if (this.sortedItems.length === 0) {
      throw new Error('Select at least one object to export.')
    }

    this.pauseTour()
    this.scene.stopAnimation(this.camera)
    this.camera.animations = []
    this.cameraMoveGen += 1
    this.clearHover()
    // Before anything is torn down: this awaits model imports, and the live
    // preview may have the same load already in flight.
    await this.ensurePosterFigures(this.posterFigureDemand())
    this.posterCapturing = true

    const camera = this.camera
    const saved = {
      mode: camera.mode,
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      target: camera.target.clone(),
      fov: camera.fov,
      minZ: camera.minZ,
      maxZ: camera.maxZ,
      orthoLeft: camera.orthoLeft,
      orthoRight: camera.orthoRight,
      orthoTop: camera.orthoTop,
      orthoBottom: camera.orthoBottom,
      clearColor: this.scene.clearColor.clone(),
      autoClear: this.scene.autoClear,
      scaling: this.engine.getHardwareScalingLevel(),
    }
    const savedPositions = new Map<string, Vector3>()
    for (const placement of this.placements.values()) {
      savedPositions.set(placement.instanceId, placement.root.position.clone())
    }

    try {
      this.setPosterStageEnabled(false)
      this.scene.clearColor =
        request.background === 'transparent'
          ? new Color4(0, 0, 0, 0)
          : new Color4(1, 1, 1, 1)
      this.scene.autoClear = true
      const maxTex = this.engine.getCaps().maxTextureSize ?? 8192
      const sized = this.clampPosterPixelSize(
        request.width,
        request.height,
        maxTex,
      )
      const captureRequest = { ...request, ...sized }

      this.engine.setHardwareScalingLevel(1)
      this.setPosterCaptureBackbuffer(captureRequest.width, captureRequest.height)
      this.setMaterialsLogarithmicDepth(false)
      this.layoutAndFramePoster(captureRequest)

      this.heldIdle = false
      this.renderNeeded = true
      this.camera.unfreezeProjectionMatrix()
      await this.whenSceneReady()
      await nextFrame()
      await nextFrame()

      const items = this.projectPosterItems(
        captureRequest.width,
        captureRequest.height,
      )
      const pixelsPerMeter = this.measurePixelsPerMeter(
        captureRequest.width,
        captureRequest.height,
      )

      const long = Math.max(captureRequest.width, captureRequest.height)
      const maxSamples = Math.max(1, this.engine.getCaps().maxMSAASamples ?? 4)
      const wantSamples = long > 8000 ? 2 : long > 4000 ? 4 : 8
      const samples = Math.min(wantSamples, maxSamples)
      // 4K still 2× SSAA. 8K/16K already have the pixels — don't allocate a 32K RT.
      const wantSuper = long <= 3840 ? 2 : 1
      const superScale = Math.min(wantSuper, maxTex / long)
      const prevRt = this.scene.renderTargetsEnabled
      this.scene.renderTargetsEnabled = true
      this.camera.unfreezeProjectionMatrix()
      let dataUrl: string
      try {
        dataUrl = await this.screenshotPosterPng(
          captureRequest.width,
          captureRequest.height,
          superScale,
          samples,
        )
      } finally {
        this.scene.renderTargetsEnabled = prevRt
      }

      return {
        image: dataUrlToBlob(dataUrl, 'image/png'),
        width: captureRequest.width,
        height: captureRequest.height,
        pixelsPerMeter,
        items,
      }
    } finally {
      this.posterCapturing = false
      this.engine.setHardwareScalingLevel(saved.scaling)
      this.setMaterialsLogarithmicDepth(true)
      this.applyResolutionCap()
      this.engine.resize()
      if (this.posterPreview) {
        this.restoreItemPositions(this.posterPreview.saved.positions)
        this.applyPosterLook(this.posterPreview.settings)
      } else {
        for (const placement of this.placements.values()) {
          const pos = savedPositions.get(placement.instanceId)
          if (!pos) continue
          this.thawPlacement(placement)
          placement.root.position.copyFrom(pos)
        }
        this.clearPosterScaleReferences()
        this.setPosterStageEnabled(true)
        this.scene.clearColor.copyFrom(saved.clearColor)
        this.scene.autoClear = saved.autoClear
        camera.mode = saved.mode
        camera.fov = saved.fov
        this.applyCameraOrbit(saved.target, saved.alpha, saved.beta, saved.radius)
        camera.minZ = saved.minZ
        camera.maxZ = saved.maxZ
        camera.orthoLeft = saved.orthoLeft
        camera.orthoRight = saved.orthoRight
        camera.orthoTop = saved.orthoTop
        camera.orthoBottom = saved.orthoBottom
        this.freezeStaticScene()
      }
      this.camera.unfreezeProjectionMatrix()
      this.markDirty()
    }
  }

  /**
   * Put the live viewer into the poster look, or restore the interactive scene.
   */
  setPosterPreview(settings: PosterPreviewSettings | null) {
    if (!settings || this.sortedItems.length === 0) {
      this.exitPosterPreview()
      return
    }
    if (!this.posterPreview) this.enterPosterPreview(settings)
    else this.updatePosterPreview(settings)
  }

  subscribePosterOverlay(
    listener: (state: PosterOverlayState | null) => void,
  ) {
    this.posterOverlayListeners.add(listener)
    listener(this.readPosterOverlay())
    return () => {
      this.posterOverlayListeners.delete(listener)
    }
  }

  private enterPosterPreview(settings: PosterPreviewSettings) {
    this.pauseTour()
    this.scene.stopAnimation(this.camera)
    this.camera.animations = []
    this.cameraMoveGen += 1
    this.haltCameraMotion()
    this.clearHover()
    if (!this.captureMode) this.camera.detachControl()
    this.posterPreview = {
      settings,
      saved: this.snapshotInteractive(),
    }
    this.applyPosterLook(settings)
  }

  private updatePosterPreview(settings: PosterPreviewSettings) {
    if (!this.posterPreview) return
    this.posterPreview.settings = settings
    this.applyPosterLook(settings)
  }

  private exitPosterPreview() {
    if (!this.posterPreview) return
    const saved = this.posterPreview.saved
    this.posterPreview = null
    this.clearPosterScaleReferences()
    this.restoreInteractive(saved)
    this.emitPosterOverlay()
  }

  private applyPosterLook(settings: PosterPreviewSettings) {
    this.setPosterStageEnabled(false)
    this.scene.clearColor = new Color4(1, 1, 1, 1)
    this.scene.autoClear = true
    this.applyPosterPreviewResolution()
    this.engine.resize()
    this.requestPosterFigures()
    this.layoutAndFramePoster({ ...settings, ...this.canvasCssSize() })
    this.freezeStaticScene()
    this.markDirty()
    this.emitPosterOverlay()
  }

  private snapshotInteractive(): PosterInteractiveSnapshot {
    return {
      mode: this.camera.mode,
      alpha: this.camera.alpha,
      beta: this.camera.beta,
      radius: this.camera.radius,
      target: this.camera.target.clone(),
      fov: this.camera.fov,
      minZ: this.camera.minZ,
      maxZ: this.camera.maxZ,
      orthoLeft: this.camera.orthoLeft,
      orthoRight: this.camera.orthoRight,
      orthoTop: this.camera.orthoTop,
      orthoBottom: this.camera.orthoBottom,
      clearColor: this.scene.clearColor.clone(),
      autoClear: this.scene.autoClear,
      positions: this.snapshotItemPositions(),
    }
  }

  private snapshotItemPositions() {
    const positions = new Map<string, Vector3>()
    for (const placement of this.placements.values()) {
      positions.set(placement.instanceId, placement.root.position.clone())
    }
    return positions
  }

  private restoreItemPositions(positions: Map<string, Vector3>) {
    for (const placement of this.placements.values()) {
      const pos = positions.get(placement.instanceId)
      if (!pos) continue
      this.thawPlacement(placement)
      placement.root.position.copyFrom(pos)
    }
  }

  private syncPlacementWorldMatrices() {
    for (const placement of this.placements.values()) {
      this.thawPlacement(placement)
      placement.root.computeWorldMatrix(true)
      placement.display.computeWorldMatrix(true)
      placement.body.computeWorldMatrix(true)
      for (const mesh of placement.root.getChildMeshes(false)) {
        mesh.computeWorldMatrix(true)
      }
    }
  }

  private restoreInteractive(saved: PosterInteractiveSnapshot) {
    this.setMaterialsLogarithmicDepth(true)
    this.applyResolutionCap()
    this.engine.resize()
    this.restoreItemPositions(saved.positions)
    this.syncPlacementWorldMatrices()
    this.setPosterStageEnabled(true)
    this.ground.unfreezeWorldMatrix()
    this.ground.computeWorldMatrix(true)
    this.ground.freezeWorldMatrix()
    this.scene.clearColor.copyFrom(saved.clearColor)
    this.scene.autoClear = saved.autoClear
    this.camera.upVector.copyFrom(Vector3.Up())
    this.camera.mode = saved.mode
    this.camera.fov = saved.fov
    this.applyCameraOrbit(saved.target, saved.alpha, saved.beta, saved.radius)
    this.camera.minZ = saved.minZ
    this.camera.maxZ = saved.maxZ
    this.camera.orthoLeft = saved.orthoLeft
    this.camera.orthoRight = saved.orthoRight
    this.camera.orthoTop = saved.orthoTop
    this.camera.orthoBottom = saved.orthoBottom
    const canvas = this.engine.getRenderingCanvas()
    if (!this.captureMode && canvas) this.camera.attachControl(canvas, true)
    this.freezeStaticScene()
    this.camera.unfreezeProjectionMatrix()
    this.heldIdle = false
    this.markDirty()
  }

  private canvasCssSize() {
    const canvas = this.engine.getRenderingCanvas()
    return {
      width: Math.max(canvas?.clientWidth ?? 1, 1),
      height: Math.max(canvas?.clientHeight ?? 1, 1),
    }
  }

  private readPosterOverlay(): PosterOverlayState | null {
    if (!this.posterPreview) return null
    const { width, height } = this.canvasCssSize()
    return {
      width,
      height,
      items: this.projectPosterItems(width, height),
      pixelsPerMeter: this.measurePixelsPerMeter(width, height),
    }
  }

  private emitPosterOverlay() {
    const state = this.readPosterOverlay()
    for (const listener of this.posterOverlayListeners) listener(state)
  }

  private setPosterStageEnabled(enabled: boolean) {
    this.ground.setEnabled(enabled)
    this.skybox.setEnabled(enabled)
    this.cityRoot?.setEnabled(enabled && this.groundPlateId !== 'neighborhood')
    for (const mesh of this.scene.meshes) {
      if (mesh.name.startsWith('label-')) mesh.setEnabled(enabled)
    }
  }

  /**
   * Lay the comparison out for the poster. One packed row (or column) while it
   * still reads as one; past that it wraps into a grid whose aspect matches the
   * image, so a long list stops turning into a hairline ribbon.
   * `labelGap` / `labelGutter` are the world-space strips each row keeps free
   * for its names.
   */
  private applyPosterItemLayout(
    request: PosterFrameRequest,
    labelGap: number,
    labelGutter: number,
  ) {
    // Silhouettes only earn their place in the side view: from directly above
    // a standing person is an unreadable blob.
    const useFigures = request.layout === 'lineup' && request.view === 'side'
    this.applyPosterScaleReferences(useFigures)
    this.posterRowByItem.clear()
    const entries = this.posterEntries(useFigures)
    if (entries.length === 0) {
      this.showPosterFigures([])
      return
    }
    const axes = this.posterAxes(request.view)
    if (request.layout === 'stacked') {
      this.layoutPosterStacked(entries, axes, request, labelGutter)
    } else {
      this.layoutPosterLineup(entries, axes, request, labelGap)
    }
  }

  /** Screen axes of a poster view: what runs up the image, what faces us. */
  private posterAxes(view: PosterView): PosterAxes {
    // Top-down looks along -Y with the tiny tilt toward -Z, so +Z is up-screen.
    if (view === 'top') return { up: 2, depth: 1 }
    return { up: 1, depth: 2 }
  }

  private posterEntries(useFigures: boolean): PosterEntry[] {
    const entries: PosterEntry[] = []
    for (const item of this.sortedItems) {
      if (this.posterHiddenItemIds.has(item.id)) continue
      const placement = this.placementForItem(item.id)
      if (!placement) continue
      this.thawPlacement(placement)
      placement.body.computeWorldMatrix(true)
      const box = this.visualBounds(placement.body)
      entries.push({ item, placement, min: box.min, max: box.max, figure: false })
    }
    if (useFigures) this.assignPosterFigures(entries)
    return entries
  }

  /** A silhouette next to every few objects, skipping ones it would dwarf. */
  private assignPosterFigures(entries: PosterEntry[]) {
    const budget = Math.min(this.posterFigures.length, POSTER_SCALE_FIGURE_MAX)
    if (budget === 0) return
    let used = 0
    let since = POSTER_SCALE_FIGURE_EVERY - 1
    for (const entry of entries) {
      if (used >= budget) break
      if (!this.posterFigureFits(entry.item)) continue
      if (since < POSTER_SCALE_FIGURE_EVERY - 1) {
        since += 1
        continue
      }
      entry.figure = true
      used += 1
      since = 0
    }
  }

  private posterFigureFits(item: CatalogItem): boolean {
    if (item.shape === 'person') return false
    return headlineSizeMeters(item) >= POSTER_SCALE_FIGURE_MIN_SIZE_M
  }

  private posterFigureFootprint() {
    const person = CATALOG_BY_ID[POSTER_SCALE_FIGURE_ID]
    return {
      width: person?.width ?? 0.55,
      length: person?.length ?? 0.55,
      height: person?.height ?? 1.75,
    }
  }

  private axisValue(v: Vector3, axis: 0 | 1 | 2): number {
    return axis === 0 ? v.x : axis === 1 ? v.y : v.z
  }

  private addOnAxis(v: Vector3, axis: 0 | 1 | 2, amount: number) {
    if (axis === 0) v.x += amount
    else if (axis === 1) v.y += amount
    else v.z += amount
  }

  /** Space this entry claims along the row, including any reserved figure. */
  private posterRunLength(entry: PosterEntry, figureWidth: number): number {
    const own = Math.max(entry.max.x - entry.min.x, 0.01)
    return own + (entry.figure ? figureWidth * POSTER_SCALE_FIGURE_SLOT : 0)
  }

  private layoutPosterLineup(
    entries: PosterEntry[],
    axes: PosterAxes,
    request: PosterFrameRequest,
    labelGap: number,
  ) {
    const figure = this.posterFigureFootprint()
    const facing = this.measuredFacingExtents()
    const lengths = entries.map((entry) => this.posterRunLength(entry, figure.width))
    const thickness = entries.map((entry) =>
      Math.max(
        this.axisValue(entry.max, axes.up) - this.axisValue(entry.min, axes.up),
        0.01,
      ),
    )
    const gaps = entries.map((entry, i) =>
      i === entries.length - 1
        ? 0
        : pairSpacingGap(
            entry.item,
            entries[i + 1].item,
            SPREAD_MIN,
            this.displayYawTurns,
            facing,
          ),
    )
    const runs = lengths.map((length, i) => length + gaps[i])
    const rowGap = Math.max(...thickness) * 0.14 + labelGap
    const rows = this.planPosterGroups(
      entries.length,
      runs,
      thickness,
      rowGap,
      request,
      'rows',
    )

    const figures: Vector3[] = []
    let top = 0
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      const rowThickness = Math.max(...row.map((i) => thickness[i]))
      const baseline = top - rowThickness
      const rowLength =
        row.reduce((sum, i) => sum + lengths[i], 0) +
        row.slice(0, -1).reduce((sum, i) => sum + gaps[i], 0)

      let x = -rowLength / 2
      for (const i of row) {
        const entry = entries[i]
        if (entry.figure) {
          figures.push(this.posterFigurePosition(x + figure.width / 2, baseline, axes))
          x += figure.width * POSTER_SCALE_FIGURE_SLOT
        }
        const width = entry.max.x - entry.min.x
        this.movePosterEntry(entry, axes, x, baseline)
        this.posterRowByItem.set(entry.item.id, r)
        x += width + gaps[i]
      }
      top = baseline - rowGap
    }
    this.showPosterFigures(figures)
  }

  private layoutPosterStacked(
    entries: PosterEntry[],
    axes: PosterAxes,
    request: PosterFrameRequest,
    labelGutter: number,
  ) {
    // Biggest first: a stacked poster reads top-down.
    const ordered = [...entries].reverse()
    const heights = ordered.map((entry) =>
      Math.max(
        this.axisValue(entry.max, axes.up) - this.axisValue(entry.min, axes.up),
        0.01,
      ),
    )
    const widths = ordered.map((entry) => Math.max(entry.max.x - entry.min.x, 0.01))
    const gaps = heights.map((h, i) =>
      i === heights.length - 1 ? 0 : Math.max(h, heights[i + 1]) * 0.12,
    )
    const runs = heights.map((h, i) => h + gaps[i])
    const columns = this.planPosterGroups(
      ordered.length,
      runs,
      widths,
      Math.max(...widths) * 0.08 + labelGutter,
      request,
      'columns',
    )
    // A single column labels into the frame's reserved right strip; only a
    // multi-column poster has to carry that gutter inside the layout.
    const gutter = columns.length > 1 ? labelGutter : 0

    let x = 0
    for (let c = 0; c < columns.length; c++) {
      const column = columns[c]
      const columnWidth = Math.max(...column.map((i) => widths[i]))
      let top = 0
      for (const i of column) {
        const entry = ordered[i]
        const baseline = top - heights[i]
        this.movePosterEntry(entry, axes, x, baseline)
        this.posterRowByItem.set(entry.item.id, c)
        top = baseline - gaps[i]
      }
      x += columnWidth * 1.08 + gutter
    }
    this.showPosterFigures([])
  }

  /**
   * Pick the row/column count whose packed bounding box best matches the
   * image's aspect, then split the run into that many balanced chunks.
   */
  private planPosterGroups(
    count: number,
    runs: number[],
    thickness: number[],
    groupGap: number,
    request: PosterFrameRequest,
    orientation: 'rows' | 'columns',
  ): number[][] {
    const single = [Array.from({ length: count }, (_, i) => i)]
    if (!posterUsesGrid(count)) return single

    const rect = request.contentRect
    const target =
      ((rect.right - rect.left) * request.width) /
      Math.max((rect.bottom - rect.top) * request.height, 1)

    let best = single
    let bestScore = Infinity
    for (let groups = 1; groups <= Math.min(count, POSTER_MAX_GROUPS); groups++) {
      const chunks = this.chunkPosterRun(runs, groups)
      let along = 0
      let across = 0
      for (const chunk of chunks) {
        along = Math.max(
          along,
          chunk.reduce((sum, i) => sum + runs[i], 0),
        )
        across += Math.max(...chunk.map((i) => thickness[i]))
      }
      across += groupGap * Math.max(0, chunks.length - 1)
      const width = orientation === 'rows' ? along : across
      const height = orientation === 'rows' ? across : along
      const score = Math.abs(
        Math.log(width / Math.max(height, 1e-6) / Math.max(target, 1e-6)),
      )
      if (score < bestScore) {
        bestScore = score
        best = chunks
      }
    }
    return best
  }

  /** Greedy split into `groups` chunks of roughly equal packed length. */
  private chunkPosterRun(runs: number[], groups: number): number[][] {
    if (groups <= 1) return [runs.map((_, i) => i)]
    const target = runs.reduce((sum, run) => sum + run, 0) / groups
    const chunks: number[][] = []
    let current: number[] = []
    let acc = 0
    for (let i = 0; i < runs.length; i++) {
      const slotsLeft = groups - chunks.length
      // Never strand a chunk: keep one item in reserve for each slot left.
      const mustBreak = current.length > 0 && runs.length - i < slotsLeft
      const full =
        current.length > 0 && acc + runs[i] / 2 > target && chunks.length < groups - 1
      if (mustBreak || full) {
        chunks.push(current)
        current = []
        acc = 0
      }
      current.push(i)
      acc += runs[i]
    }
    if (current.length > 0) chunks.push(current)
    return chunks
  }

  /**
   * Slide an object so its left edge sits at `x` and its bottom edge on the
   * row baseline, squared up on the axis facing the camera.
   */
  private movePosterEntry(
    entry: PosterEntry,
    axes: PosterAxes,
    x: number,
    baseline: number,
  ) {
    const delta = new Vector3(x - entry.min.x, 0, 0)
    this.addOnAxis(delta, axes.up, baseline - this.axisValue(entry.min, axes.up))
    if (axes.depth === 1) {
      // Top-down: keep everything sitting on the ground plane.
      delta.y += -entry.min.y
    } else {
      delta.z += -((entry.min.z + entry.max.z) / 2)
    }
    entry.placement.root.position.addInPlace(delta)
    entry.placement.root.computeWorldMatrix(true)
    entry.min.addInPlace(delta)
    entry.max.addInPlace(delta)
  }

  private posterFigurePosition(
    centerX: number,
    baseline: number,
    axes: PosterAxes,
  ): Vector3 {
    const figure = this.posterFigureFootprint()
    const position = new Vector3(centerX, 0, 0)
    // The silhouette is centred on X/Z with its feet at local y = 0.
    if (axes.up === 1) position.y = baseline
    else position.z = baseline + figure.length / 2
    return position
  }

  /**
   * Drop the user's own "Adult" reference out of the poster once silhouettes
   * are available — the silhouettes say the same thing without eating a slot.
   */
  private applyPosterScaleReferences(useFigures: boolean) {
    const references = this.sortedItems.filter((item) =>
      POSTER_SCALE_REFERENCE_IDS.has(item.id),
    )
    const others = this.sortedItems.length - references.length
    const hide =
      useFigures && this.posterFigures.length > 0 && others > 0
        ? references.map((item) => item.id)
        : []
    this.posterHiddenItemIds = new Set(hide)
    for (const placement of this.placements.values()) {
      const wanted = !this.posterHiddenItemIds.has(placement.itemId)
      if (placement.root.isEnabled() !== wanted) placement.root.setEnabled(wanted)
    }
  }

  /** Put every scale reference back in the scene when the poster is dismissed. */
  private clearPosterScaleReferences() {
    for (const placement of this.placements.values()) {
      if (!this.posterHiddenItemIds.has(placement.itemId)) continue
      placement.root.setEnabled(true)
    }
    this.posterHiddenItemIds = new Set()
    this.showPosterFigures([])
  }

  private showPosterFigures(positions: Vector3[]) {
    for (let i = 0; i < this.posterFigures.length; i++) {
      const node = this.posterFigures[i]
      const position = positions[i]
      if (!position) {
        node.setEnabled(false)
        continue
      }
      node.setEnabled(true)
      node.position.copyFrom(position)
      node.computeWorldMatrix(true)
    }
  }

  /** How many silhouettes this comparison could use, before any are loaded. */
  private posterFigureDemand(): number {
    const eligible = this.sortedItems.filter((item) => this.posterFigureFits(item))
    if (eligible.length === 0) return 0
    return Math.min(
      POSTER_SCALE_FIGURE_MAX,
      Math.max(1, Math.ceil(eligible.length / POSTER_SCALE_FIGURE_EVERY)),
    )
  }

  /** Load silhouettes in the background, then re-lay the live preview. */
  private requestPosterFigures() {
    if (this.posterFigures.length >= this.posterFigureDemand()) return
    void this.ensurePosterFigures(this.posterFigureDemand()).then(() => {
      // A capture does its own layout and owns the camera and backbuffer until
      // it is done — re-laying the preview underneath it blanks the render.
      if (this.disposed || this.posterCapturing || !this.posterPreview) return
      this.applyPosterLook(this.posterPreview.settings)
    })
  }

  /**
   * Silhouettes, up to `count`. Loads are chained rather than run side by side,
   * so a download that lands mid-preview waits on the same work instead of
   * importing a second copy of every avatar.
   */
  private ensurePosterFigures(count: number): Promise<void> {
    const want = Math.min(count, POSTER_SCALE_FIGURE_MAX)
    if (this.posterFigureFailed || this.posterFigures.length >= want) {
      return this.posterFigureWork ?? Promise.resolve()
    }
    const chain = (this.posterFigureWork ?? Promise.resolve())
      .then(() => this.loadPosterFiguresUpTo(want))
      .catch(() => undefined)
    this.posterFigureWork = chain.finally(() => {
      if (this.posterFigureWork === chain) this.posterFigureWork = null
    })
    return this.posterFigureWork
  }

  private async loadPosterFiguresUpTo(want: number): Promise<void> {
    while (!this.disposed && !this.posterFigureFailed && this.posterFigures.length < want) {
      const figure = await this.buildPosterFigure()
      if (!figure) {
        // One failure means the avatar is unreachable; stop asking for more.
        this.posterFigureFailed = true
        return
      }
      if (this.disposed) {
        figure.dispose(false, true)
        return
      }
      this.posterFigures.push(figure)
    }
  }

  /** One adult, painted flat black so it reads as a silhouette at any size. */
  private async buildPosterFigure(): Promise<TransformNode | null> {
    const item = CATALOG_BY_ID[POSTER_SCALE_FIGURE_ID]
    if (!item?.model) return null
    const instanceId = `poster-figure-${crypto.randomUUID()}`
    try {
      const loaded = await this.loadScaledModel(item, instanceId)
      const root = new TransformNode(`root-${instanceId}`, this.scene)
      loaded.container.parent = root
      // Arms all the way down: a silhouette wants a clean outline, and at
      // poster scale spread arms just read as a smudge.
      this.relaxTPoseArms(loaded.skeletons, 0.47)
      this.disposeImportedAnimations(loaded.animationGroups)
      this.paintPosterFigure(root)
      root.setEnabled(false)
      return root
    } catch (error) {
      console.warn('Poster scale figure failed to load.', error)
      return null
    }
  }

  private paintPosterFigure(root: TransformNode) {
    if (!this.posterFigureMaterial) {
      const material = new StandardMaterial('poster-scale-figure', this.scene)
      material.disableLighting = true
      material.diffuseColor = Color3.Black()
      material.specularColor = Color3.Black()
      material.emissiveColor = Color3.Black()
      material.ambientColor = Color3.Black()
      this.posterFigureMaterial = material
    }
    for (const mesh of root.getChildMeshes(false)) {
      mesh.material = this.posterFigureMaterial
      mesh.isPickable = false
      mesh.receiveShadows = false
    }
  }

  private disposePosterFigures() {
    for (const figure of this.posterFigures) {
      if (!figure.isDisposed()) figure.dispose(false, true)
    }
    this.posterFigures = []
    this.posterFigureMaterial?.dispose()
    this.posterFigureMaterial = null
  }

  private posterVisualBounds(): { min: Vector3; max: Vector3 } | null {
    const min = new Vector3(Infinity, Infinity, Infinity)
    const max = new Vector3(-Infinity, -Infinity, -Infinity)
    let found = false
    for (const placement of this.placements.values()) {
      if (this.posterHiddenItemIds.has(placement.itemId)) continue
      this.thawPlacement(placement)
      placement.body.computeWorldMatrix(true)
      const box = this.visualBounds(placement.body)
      Vector3.CheckExtends(box.min, min, max)
      Vector3.CheckExtends(box.max, min, max)
      found = true
    }
    for (const figure of this.posterFigures) {
      if (!figure.isEnabled()) continue
      const box = this.visualBounds(figure)
      Vector3.CheckExtends(box.min, min, max)
      Vector3.CheckExtends(box.max, min, max)
    }
    if (!found || !Number.isFinite(min.x)) return null
    return { min, max }
  }

  /**
   * Lay out, frame, then do it again once the pixels-per-metre is known: row
   * gaps and label gutters are pixel-sized strips, and the first pass is the
   * only way to learn the scale they have to be reserved at.
   */
  private layoutAndFramePoster(request: PosterFrameRequest) {
    this.applyPosterItemLayout(request, 0, 0)
    this.framePosterCamera(request)

    const ppm = this.measurePixelsPerMeter(request.width, request.height)
    if (!Number.isFinite(ppm) || ppm <= 0) return
    const count = this.sortedItems.length
    this.applyPosterItemLayout(
      request,
      posterLabelBandPx(request.width, count) / ppm,
      this.posterLabelGutterPx(request.width, count) / ppm,
    )
    this.framePosterCamera(request)
  }

  /** Room the longest name needs beside a stacked column, in pixels. */
  private posterLabelGutterPx(width: number, count: number): number {
    const fontSize = posterLabelFontSize(width, count)
    const chars = this.sortedItems.reduce(
      (longest, item) => Math.max(longest, item.name.length),
      0,
    )
    // Plex Sans Semibold averages a little over half an em per character.
    return Math.min(chars * fontSize * 0.55 + fontSize, width * 0.28)
  }

  private framePosterCamera(request: PosterFrameRequest) {
    const bounds = this.posterVisualBounds()
    if (!bounds) return

    const angles = posterViewAngles(request.view)
    const target = new Vector3(
      (bounds.min.x + bounds.max.x) * 0.5,
      (bounds.min.y + bounds.max.y) * 0.5,
      (bounds.min.z + bounds.max.z) * 0.5,
    )
    const corners = aabbCorners(bounds.min, bounds.max)
    const radius = Math.max(Vector3.Distance(bounds.min, bounds.max) * 1.5, 2)

    this.haltCameraMotion()
    this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA
    this.applyCameraOrbit(target, angles.alpha, angles.beta, radius)
    this.seedPosterOrtho(request, bounds)

    for (let i = 0; i < 4; i++) {
      this.fitPosterOrthoToContent(request, corners)
      this.centerPosterInContentRect(request, corners)
    }

    this.syncCameraClipPlanes()
    this.refreshPosterCameraMatrices()
  }

  /**
   * ArcRotateCamera.setTarget() rebuilds alpha/beta/radius from the current
   * world position. Always write the orbit after the target so poster views
   * snap to a fixed pose instead of drifting from the last camera.
   */
  private applyCameraOrbit(
    target: Vector3,
    alpha: number,
    beta: number,
    radius: number,
  ) {
    this.camera.unfreezeProjectionMatrix()
    this.camera.setTarget(target)
    this.camera.alpha = alpha
    this.camera.beta = beta
    this.camera.radius = Math.max(radius, 0.5)
    this.refreshPosterCameraMatrices()
  }

  private haltCameraMotion() {
    this.camera.inertialAlphaOffset = 0
    this.camera.inertialBetaOffset = 0
    this.camera.inertialRadiusOffset = 0
    this.camera.inertialPanningX = 0
    this.camera.inertialPanningY = 0
  }

  private refreshPosterCameraMatrices() {
    this.camera.unfreezeProjectionMatrix()
    this.camera.getViewMatrix(true)
    this.camera.getProjectionMatrix(true)
  }

  private projectPosterCorners(
    corners: Vector3[],
    width: number,
    height: number,
  ) {
    this.refreshPosterCameraMatrices()
    const viewport = new Viewport(0, 0, width, height)
    const transform = this.camera.getTransformationMatrix()
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const corner of corners) {
      const projected = Vector3.Project(
        corner,
        Matrix.Identity(),
        transform,
        viewport,
      )
      minX = Math.min(minX, projected.x)
      maxX = Math.max(maxX, projected.x)
      minY = Math.min(minY, projected.y)
      maxY = Math.max(maxY, projected.y)
    }
    return { minX, minY, maxX, maxY }
  }

  private seedPosterOrtho(
    request: PosterFrameRequest,
    bounds: { min: Vector3; max: Vector3 },
  ) {
    const aspect = request.width / Math.max(request.height, 1)
    const halfH = Math.max(Vector3.Distance(bounds.min, bounds.max) * 0.75, 1)
    this.setPosterOrthoWindow(halfH * aspect, halfH)
  }

  /** Zoom so the AABB fills the layout's content rect (not a bounding sphere). */
  private fitPosterOrthoToContent(
    request: PosterFrameRequest,
    corners: Vector3[],
  ) {
    const { width, height, contentRect } = request
    const inset = 0.015
    const boxW = Math.max((contentRect.right - contentRect.left - inset * 2) * width, 1)
    const boxH = Math.max((contentRect.bottom - contentRect.top - inset * 2) * height, 1)
    const box = this.projectPosterCorners(corners, width, height)
    const projW = Math.max(box.maxX - box.minX, 1)
    const projH = Math.max(box.maxY - box.minY, 1)
    const scale = Math.max(projW / boxW, projH / boxH)
    const { halfW, halfH } = this.posterOrthoHalfSize()
    this.setPosterOrthoWindow(
      Math.max(halfW * scale, 0.05),
      Math.max(halfH * scale, 0.05),
    )
  }

  /** Pan so the lineup sits in the content rect, leaving room for labels. */
  private centerPosterInContentRect(
    request: PosterFrameRequest,
    corners: Vector3[],
  ) {
    const { width, height, contentRect } = request
    const wantX = ((contentRect.left + contentRect.right) / 2) * width
    const wantY = ((contentRect.top + contentRect.bottom) / 2) * height
    const box = this.projectPosterCorners(corners, width, height)
    const gotX = (box.minX + box.maxX) / 2
    const gotY = (box.minY + box.maxY) / 2
    const dxPx = wantX - gotX
    const dyPx = wantY - gotY
    if (Math.abs(dxPx) < 0.5 && Math.abs(dyPx) < 0.5) return

    const { halfW, halfH } = this.posterOrthoHalfSize()
    const worldRight = (dxPx / (width / 2)) * halfW
    const worldUp = -(dyPx / (height / 2)) * halfH
    const right = this.camera.getDirection(Vector3.Right())
    const up = this.camera.getDirection(Vector3.Up())
    const target = this.camera.target.clone()
    target.addInPlace(right.scale(-worldRight))
    target.addInPlace(up.scale(-worldUp))
    this.applyCameraOrbit(target, this.camera.alpha, this.camera.beta, this.camera.radius)
  }

  private posterOrthoHalfSize() {
    const left = this.camera.orthoLeft ?? -1
    const right = this.camera.orthoRight ?? 1
    const top = this.camera.orthoTop ?? 1
    const bottom = this.camera.orthoBottom ?? -1
    return {
      halfW: Math.max((right - left) * 0.5, 0.05),
      halfH: Math.max((top - bottom) * 0.5, 0.05),
    }
  }

  private setPosterOrthoWindow(halfW: number, halfH: number) {
    this.camera.orthoLeft = -halfW
    this.camera.orthoRight = halfW
    this.camera.orthoTop = halfH
    this.camera.orthoBottom = -halfH
    this.refreshPosterCameraMatrices()
  }

  private projectPosterItems(
    width: number,
    height: number,
  ): PosterItemProjection[] {
    const viewport = new Viewport(0, 0, width, height)
    this.camera.unfreezeProjectionMatrix()
    const transform = this.camera.getTransformationMatrix()
    const items: PosterItemProjection[] = []
    for (const item of this.sortedItems) {
      if (this.posterHiddenItemIds.has(item.id)) continue
      const placement = this.placementForItem(item.id)
      if (!placement) continue
      const box = this.visualBounds(placement.body)
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const corner of aabbCorners(box.min, box.max)) {
        const projected = Vector3.Project(
          corner,
          Matrix.Identity(),
          transform,
          viewport,
        )
        minX = Math.min(minX, projected.x)
        maxX = Math.max(maxX, projected.x)
        minY = Math.min(minY, projected.y)
        maxY = Math.max(maxY, projected.y)
      }
      items.push({
        itemId: item.id,
        name: item.name,
        sizeMeters: headlineSizeMeters(item),
        row: this.posterRowByItem.get(item.id) ?? 0,
        minX,
        minY,
        maxX,
        maxY,
      })
    }
    return items
  }

  private measurePixelsPerMeter(width: number, height: number): number {
    const bounds = this.posterVisualBounds()
    const origin = bounds
      ? new Vector3(
          (bounds.min.x + bounds.max.x) / 2,
          0,
          (bounds.min.z + bounds.max.z) / 2,
        )
      : Vector3.Zero()
    const viewport = new Viewport(0, 0, width, height)
    this.camera.unfreezeProjectionMatrix()
    const transform = this.camera.getTransformationMatrix()
    const a = Vector3.Project(origin, Matrix.Identity(), transform, viewport)
    const b = Vector3.Project(
      origin.add(new Vector3(1, 0, 0)),
      Matrix.Identity(),
      transform,
      viewport,
    )
    return Math.hypot(b.x - a.x, b.y - a.y)
  }

  private whenSceneReady(): Promise<void> {
    return new Promise((resolve) => {
      this.scene.executeWhenReady(() => resolve())
    })
  }

  /**
   * Point the camera at the lineup AABB center and pull back until the box fits.
   */
  private frameCameraOnLineup() {
    const bounds = this.lineupWorldBounds()
    if (!bounds) {
      this.showOverview(false)
      return
    }

    const center = new Vector3(
      (bounds.min.x + bounds.max.x) * 0.5,
      (bounds.min.y + bounds.max.y) * 0.5,
      (bounds.min.z + bounds.max.z) * 0.5,
    )
    const angles = this.tourAngles()
    this.camera.setTarget(center)
    this.camera.alpha = angles.alpha
    this.camera.beta = angles.beta

    const box = new BoundingInfo(bounds.min, bounds.max)
    const fits = () => {
      this.syncCameraClipPlanes()
      this.camera.unfreezeProjectionMatrix()
      this.camera.getViewMatrix(true)
      this.camera.getProjectionMatrix(true)
      return this.camera.isCompletelyInFrustum(box)
    }

    this.engine.stopRenderLoop()
    try {
      let hi = Math.max(Vector3.Distance(bounds.min, bounds.max), 2)
      this.camera.radius = hi
      let guard = 0
      while (!fits() && guard < 24) {
        hi *= 1.35
        this.camera.radius = hi
        guard += 1
      }
      let lo = hi / 20
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) * 0.5
        this.camera.radius = mid
        if (fits()) hi = mid
        else lo = mid
      }
      this.camera.radius = hi * 1.04
    } finally {
      this.engine.runRenderLoop(this.tickRender)
    }
    this.syncCameraClipPlanes()
    this.markDirty()
  }

  private lineupWorldBounds(): { min: Vector3; max: Vector3 } | null {
    if (this.sortedItems.length === 0) return null
    const yaw = this.displayYawTurns
    const facing = this.measuredFacingExtents()
    let minX = Infinity
    let maxX = -Infinity
    let maxH = 0
    let maxZ = 0
    for (const item of this.sortedItems) {
      const x = this.itemXs.get(item.id) ?? 0
      const halfX = facingExtentAlongX(item, yaw, facing) / 2
      const halfZ = itemExtentAlongZ(item, yaw) / 2
      minX = Math.min(minX, x - halfX)
      maxX = Math.max(maxX, x + halfX)
      maxH = Math.max(maxH, item.height)
      maxZ = Math.max(maxZ, halfZ)
    }
    if (!Number.isFinite(minX) || minX > maxX) return null
    return {
      min: new Vector3(minX, 0, -maxZ),
      max: new Vector3(maxX, maxH, maxZ),
    }
  }

  setUnits(units: UnitSystem) {
    if (this.units === units) return
    this.units = units
    this.refreshAllPlaques()
    this.markDirty()
    if (this.hoverItemId) {
      const id = this.hoverItemId
      this.clearHover()
      this.showHover(id)
    }
  }

  setGroundPlate(id: GroundPlateId) {
    if (this.groundPlateId === id) return
    this.groundPlateId = id
    void this.syncGroundPlate()
  }

  setShadowsEnabled(enabled: boolean) {
    if (this.shadowsWanted === enabled) return
    this.shadowsWanted = enabled
    this.applyShadowState()
  }

  private shadowsActive() {
    return ENABLE_SCENE_LIGHTING && this.shadowsWanted
  }

  private applyShadowState() {
    if (!this.shadows) return
    this.shadows.darkness = this.shadowsActive() ? SHADOW_DARKNESS : SHADOW_DARKNESS_OFF
    if (this.shadowsActive()) {
      this.syncShadowCasters()
      this.fitSunShadows()
    }
    this.markDirty()
  }

  private async syncGroundPlate() {
    const gen = ++this.cityLoadGen
    const plate = GROUND_PLATE_BY_ID[this.groundPlateId]
    if (!plate.modelPath) {
      if (this.cityRoot) {
        this.cityRoot.dispose()
        this.cityRoot = null
        this.cityFootprint = { width: 0, depth: 0 }
      }
      this.resizeGroundToContent()
      this.syncCameraClipPlanes()
      this.markDirty()
      return
    }
    if (this.captureMode) return
    try {
      if (!this.cityRoot) await this.loadCityPlate(plate)
      if (this.disposed || gen !== this.cityLoadGen) return
      this.cityRoot?.setEnabled(true)
      this.resizeGroundToContent()
      this.syncCameraClipPlanes()
      this.markDirty()
    } catch (error) {
      console.warn('Failed to load ground plate', plate.id, error)
    }
  }

  private async loadCityPlate(plate: GroundPlate) {
    const { rootUrl, filename } = this.resolveModelUrl(plate.modelPath!)
    const result = await SceneLoader.ImportMeshAsync('', rootUrl, filename, this.scene)
    const root = new TransformNode('ground-city', this.scene)
    for (const mesh of result.meshes) {
      if (!mesh.parent) mesh.parent = root
      mesh.isPickable = false
      mesh.metadata = { kind: 'ground-city' }
    }
    this.prepareImportedMaterials(root)
    for (const mesh of root.getChildMeshes(false)) {
      mesh.receiveShadows = ENABLE_SCENE_LIGHTING
      const mat = mesh.material
      if (!(mat instanceof PBRMaterial)) continue
      if (mat.albedoTexture) mat.albedoTexture.anisotropicFilteringLevel = 8
      // Unlit skips the shadow term. Keep the baked look only when lighting is off.
      if (!ENABLE_SCENE_LIGHTING) {
        mat.unlit = true
        if (mat.albedoTexture) {
          mat.emissiveTexture = mat.albedoTexture
          mat.emissiveColor = Color3.White()
        }
      }
    }

    const pitch = ((plate.pitchDegrees ?? 0) * Math.PI) / 180
    const roll = ((plate.rollDegrees ?? 0) * Math.PI) / 180
    const yaw = ((plate.yawDegrees ?? 0) * Math.PI) / 180
    if (pitch || roll || yaw) {
      root.rotationQuaternion = Quaternion.FromEulerAngles(pitch, yaw, roll)
    }
    root.computeWorldMatrix(true)
    for (const mesh of root.getChildMeshes(false)) mesh.computeWorldMatrix(true)
    const bounds = this.visualBounds(root)
    const size = bounds.max.subtract(bounds.min)
    const horiz = Math.max(size.x, size.z, 1e-4)
    const scale = (plate.lengthMeters ?? horiz) / horiz
    root.scaling.setAll(scale)
    // Scale includes the square harbor tile; drop it so it does not read as a gray slab.
    this.stripCityWaterPlanes(root)
    root.computeWorldMatrix(true)
    for (const mesh of root.getChildMeshes(false)) mesh.computeWorldMatrix(true)
    const groundY = this.cityGroundLevelY(root)
    // Seat streets on the model ground plane (AABB min hangs below the city).
    root.position.y -= groundY
    root.computeWorldMatrix(true)
    for (const mesh of root.getChildMeshes(false)) mesh.computeWorldMatrix(true)

    const land = this.cityLandBounds(root) ?? this.visualBounds(root)
    let clearing: { x: number; z: number } | null = null
    try {
      clearing = this.findCityClearing(root, land)
    } catch (error) {
      console.warn('City clearing search failed', error)
    }
    const centerX = clearing?.x ?? (land.min.x + land.max.x) * 0.5
    const centerZ = clearing?.z ?? (land.min.z + land.max.z) * 0.5
    root.position.x += (plate.originX ?? 0) - centerX
    root.position.z += (plate.originZ ?? 0) - centerZ
    root.computeWorldMatrix(true)
    for (const mesh of root.getChildMeshes(false)) mesh.computeWorldMatrix(true)
    const final = this.visualBounds(root)
    // Square from origin so later yaw around the lineup does not clip the harbor.
    const radius = Math.max(
      Math.abs(final.min.x),
      Math.abs(final.max.x),
      Math.abs(final.min.z),
      Math.abs(final.max.z),
      1,
    )
    this.cityFootprint = { width: radius * 2, depth: radius * 2 }
    const pivot = new TransformNode('ground-city-yaw', this.scene)
    root.parent = pivot
    pivot.rotation.y = ((plate.spinDegrees ?? 0) * Math.PI) / 180
    this.cityRoot = pivot
    for (const mesh of root.getChildMeshes(false)) {
      this.freezeMaterialTree(mesh.material)
    }
  }

  private stripCityWaterPlanes(root: TransformNode) {
    for (const mesh of root.getChildMeshes(false)) {
      if (/watter|water/i.test(mesh.name)) mesh.dispose()
    }
  }

  private cityLandBounds(root: TransformNode): { min: Vector3; max: Vector3 } | null {
    const min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)
    const max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY)
    let found = false
    for (const mesh of root.getChildMeshes(false)) {
      if (!this.isVisualMesh(mesh)) continue
      if (/watter|water/i.test(mesh.name)) continue
      mesh.computeWorldMatrix(true)
      const box = mesh.getBoundingInfo().boundingBox
      Vector3.CheckExtends(box.minimumWorld, min, max)
      Vector3.CheckExtends(box.maximumWorld, min, max)
      found = true
    }
    if (!found || !Number.isFinite(min.x) || min.x > max.x) return null
    return { min, max }
  }

  /**
   * Street / harbor height in world Y. Photogrammetry often has junk below
   * the real ground; sitting on AABB min leaves the city hovering.
   */
  private cityGroundLevelY(root: TransformNode): number {
    const samples: number[] = []
    const tmp = new Vector3()
    for (const mesh of root.getChildMeshes(false)) {
      if (!this.isVisualMesh(mesh)) continue
      if (/watter|water/i.test(mesh.name)) continue
      const data = mesh.getVerticesData(VertexBuffer.PositionKind)
      if (!data) continue
      const wm = mesh.getWorldMatrix()
      for (let i = 0; i + 2 < data.length; i += 24) {
        Vector3.TransformCoordinatesFromFloatsToRef(data[i], data[i + 1], data[i + 2], wm, tmp)
        samples.push(tmp.y)
      }
    }
    if (samples.length > 20) {
      samples.sort((a, b) => a - b)
      return samples[Math.floor(samples.length * 0.15)]
    }

    for (const mesh of root.getChildMeshes(false)) {
      if (!this.isVisualMesh(mesh)) continue
      if (!/watter|water/i.test(mesh.name)) continue
      mesh.computeWorldMatrix(true)
      const box = mesh.getBoundingInfo().boundingBox
      return (box.minimumWorld.y + box.maximumWorld.y) * 0.5
    }
    return this.visualBounds(root).min.y
  }

  /** Street / park cell with the most near-ground verts, biased toward the land center. */
  private findCityClearing(
    root: TransformNode,
    land: { min: Vector3; max: Vector3 },
  ): { x: number; z: number } | null {
    const bins = 28
    const spanX = land.max.x - land.min.x
    const spanZ = land.max.z - land.min.z
    if (spanX < 1 || spanZ < 1) return null
    const counts = new Float64Array(bins * bins)
    const tmp = new Vector3()
    const groundY = 12

    for (const mesh of root.getChildMeshes(false)) {
      if (!this.isVisualMesh(mesh)) continue
      if (/watter|water/i.test(mesh.name)) continue
      const data = mesh.getVerticesData(VertexBuffer.PositionKind)
      if (!data) continue
      const wm = mesh.getWorldMatrix()
      for (let i = 0; i + 2 < data.length; i += 9) {
        Vector3.TransformCoordinatesFromFloatsToRef(data[i], data[i + 1], data[i + 2], wm, tmp)
        if (tmp.y > groundY) continue
        const ix = Math.floor(((tmp.x - land.min.x) / spanX) * bins)
        const iz = Math.floor(((tmp.z - land.min.z) / spanZ) * bins)
        if (ix < 0 || iz < 0 || ix >= bins || iz >= bins) continue
        counts[iz * bins + ix] += 1
      }
    }

    const cx = (bins - 1) / 2
    const cz = (bins - 1) / 2
    let bestI = -1
    let bestScore = -1
    for (let iz = 0; iz < bins; iz++) {
      for (let ix = 0; ix < bins; ix++) {
        const n = counts[iz * bins + ix]
        if (n < 12) continue
        const dist = (ix - cx) * (ix - cx) + (iz - cz) * (iz - cz)
        const score = n / (1 + dist * 0.12)
        if (score > bestScore) {
          bestScore = score
          bestI = iz * bins + ix
        }
      }
    }
    if (bestI < 0) return null
    const ix = bestI % bins
    const iz = Math.floor(bestI / bins)
    return {
      x: land.min.x + ((ix + 0.5) / bins) * spanX,
      z: land.min.z + ((iz + 0.5) / bins) * spanZ,
    }
  }

  setDetonationMode(mode: DetonationMode) {
    if (this.detonationMode === mode) return
    this.detonationMode = mode
    if (this.activeItemIds.length === 0) return
    void this.setActiveItems([...this.activeItemIds], {
      camera: 'overview',
      animate: mode !== 'casing',
    })
  }

  private effectKeyFor(itemId: string): string {
    if (!hasBlastEffect(itemId)) return 'none'
    return this.detonationMode
  }

  dispose() {
    this.disposed = true
    this.loadGeneration += 1
    this.cityLoadGen += 1
    this.posterPreview = null
    this.posterOverlayListeners.clear()
    this.loadListeners.clear()
    this.disposePosterFigures()
    this.clearHover()
    this.clearTourTimer()
    this.listeners.clear()
    this.clearIdleSettle()
    window.removeEventListener('resize', this.onResize)
    document.removeEventListener('visibilitychange', this.onVisibility)
    const canvas = this.engine.getRenderingCanvas()
    canvas?.removeEventListener('pointerdown', this.onCanvasPointerDown)
    canvas?.removeEventListener('pointermove', this.onCanvasPointerMove)
    canvas?.removeEventListener('pointerup', this.onCanvasPointerUp)
    canvas?.removeEventListener('pointercancel', this.onCanvasPointerUp)
    canvas?.removeEventListener('wheel', this.onCanvasWheel)
    this.activeTouches.clear()
    try {
      if (this.scene.debugLayer?.isVisible()) this.scene.debugLayer.hide()
    } catch {
      // Inspector may not be loaded.
    }
    this.scene.dispose()
    this.engine.dispose()
    this.modelTemplates.clear()
    this.modelTemplateLoading.clear()
  }

  private tourAngles() {
    return tourAnglesFromYaw(this.tourSettings.yaw)
  }

  private layoutView() {
    return {
      spread: this.tourSettings.spread,
      yawTurns: this.displayYawTurns,
      facingExtents: this.measuredFacingExtents(),
    }
  }

  /** World-X AABB of each loaded body (excludes plaques). */
  private measuredFacingExtents(): Map<string, number> {
    const extents = new Map<string, number>()
    for (const item of this.sortedItems) {
      const placement = this.placementForItem(item.id)
      if (!placement) continue
      const box = this.visualBounds(placement.body)
      const width = box.max.x - box.min.x
      if (Number.isFinite(width) && width > 1e-6) extents.set(item.id, width)
    }
    return extents
  }

  private tourVisibleItems(stepIndex: number) {
    if (this.tourSettings.frameMode === 'pair') {
      const start = Math.max(0, stepIndex - 1)
      return this.sortedItems.slice(start, stepIndex + 1)
    }
    return this.sortedItems.slice(0, stepIndex + 1)
  }

  private relayoutLineup() {
    if (this.sortedItems.length === 0) return
    const xs = layoutRevealPositions(this.sortedItems, this.layoutView())
    this.itemXs = xs
    if (this.posterPreview) {
      this.posterPreview.saved.positions = this.positionsFromLineupXs(xs)
      return
    }
    for (const item of this.sortedItems) {
      const placement = this.placementForItem(item.id)
      if (!placement) continue
      this.thawPlacement(placement)
      placement.root.position.set(xs.get(item.id) ?? 0, 0, 0)
    }
    this.resizeGroundToContent()
    this.freezeStaticScene()
    this.markDirty()
  }

  private positionsFromLineupXs(xs: Map<string, number>) {
    const positions = new Map<string, Vector3>()
    for (const placement of this.placements.values()) {
      positions.set(
        placement.instanceId,
        new Vector3(xs.get(placement.itemId) ?? 0, 0, 0),
      )
    }
    return positions
  }

  private placementForItem(itemId: string) {
    for (const placement of this.placements.values()) {
      if (placement.itemId === itemId) return placement
    }
    return undefined
  }

  private reframeAfterSettingsChange(layoutChanged: boolean) {
    if (this.posterPreview) {
      this.applyPosterLook(this.posterPreview.settings)
      return
    }
    if (this.sortedItems.length === 0) return
    if (this.mode === 'tour') {
      this.goToStep(this.stepIndex, true)
      if (this.playing) this.scheduleTourAdvance()
      return
    }
    if (this.mode === 'overview') {
      const xs = this.sortedItems.map((item) => this.itemXs.get(item.id) ?? 0)
      const pose = poseForItems(
        this.sortedItems,
        xs,
        this.tourAngles(),
        this.displayYawTurns,
        this.measuredFacingExtents(),
      )
      this.applyPose(pose, true)
      return
    }
    if (this.mode === 'focus' && layoutChanged && this.focusItemId) {
      this.focusItem(this.focusItemId, true)
    }
  }

  private emitTour() {
    const state = this.getTourState()
    for (const listener of this.listeners) listener(state)
  }

  private scheduleTourAdvance() {
    this.clearTourTimer()
    if (!this.playing) return
    this.tourTimer = window.setTimeout(() => {
      if (!this.playing || this.disposed) return
      if (this.stepIndex >= this.sortedItems.length - 1) {
        this.playing = false
        this.mode = 'overview'
        this.showOverview(true)
        return
      }
      this.goToStep(this.stepIndex + 1, true)
      this.scheduleTourAdvance()
    }, TOUR_HOLD_MS)
  }

  private clearTourTimer() {
    if (this.tourTimer != null) {
      window.clearTimeout(this.tourTimer)
      this.tourTimer = null
    }
  }

  /**
   * Rebuild the zoom envelope around the framing about to be adopted.
   *
   * Called before the pose is applied so the limits already bracket
   * `pose.radius` — the camera clamps radius every frame, and a limit set
   * afterwards would fight the framing animation.
   */
  private syncCameraRadiusLimits(framedRadius: number) {
    const framed = Math.max(framedRadius, CAMERA_MIN_RADIUS)
    this.camera.lowerRadiusLimit = Math.max(
      CAMERA_MIN_RADIUS,
      framed * CAMERA_MIN_RADIUS_FRACTION,
    )
    this.camera.upperRadiusLimit = Math.max(
      framed * CAMERA_MAX_RADIUS_FACTOR,
      CAMERA_MIN_MAX_RADIUS,
    )
  }

  private applyPose(
    pose: CameraPose,
    animate: boolean,
    frames = CAMERA_ANIM_FRAMES,
    onComplete?: () => void,
  ) {
    this.syncCameraRadiusLimits(pose.radius)
    this.scene.stopAnimation(this.camera)
    this.camera.animations = []
    this.cameraMoveGen += 1
    const moveGen = this.cameraMoveGen
    const finish = () => {
      if (this.disposed || moveGen !== this.cameraMoveGen) return
      onComplete?.()
      this.armIdleSettle()
    }
    const alphaTo = shortestAngleTo(this.camera.alpha, pose.alpha)
    if (!animate) {
      this.camera.setTarget(new Vector3(pose.target.x, pose.target.y, pose.target.z))
      this.camera.radius = pose.radius
      this.camera.alpha = pose.alpha
      this.camera.beta = pose.beta
      this.markDirty()
      finish()
      return
    }

    const ease = new CubicEase()
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT)

    const targetAnim = new Animation(
      'camTarget',
      'target',
      CAMERA_ANIM_FPS,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
    )
    targetAnim.setKeys([
      { frame: 0, value: this.camera.target.clone() },
      {
        frame: frames,
        value: new Vector3(pose.target.x, pose.target.y, pose.target.z),
      },
    ])
    targetAnim.setEasingFunction(ease)

    const radiusAnim = new Animation(
      'camRadius',
      'radius',
      CAMERA_ANIM_FPS,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
    )
    radiusAnim.setKeys([
      { frame: 0, value: this.camera.radius },
      { frame: frames, value: pose.radius },
    ])
    radiusAnim.setEasingFunction(ease)

    const alphaAnim = new Animation(
      'camAlpha',
      'alpha',
      CAMERA_ANIM_FPS,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
    )
    alphaAnim.setKeys([
      { frame: 0, value: this.camera.alpha },
      { frame: frames, value: alphaTo },
    ])
    alphaAnim.setEasingFunction(ease)

    const betaAnim = new Animation(
      'camBeta',
      'beta',
      CAMERA_ANIM_FPS,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
    )
    betaAnim.setKeys([
      { frame: 0, value: this.camera.beta },
      { frame: frames, value: pose.beta },
    ])
    betaAnim.setEasingFunction(ease)

    this.camera.animations = [targetAnim, radiusAnim, alphaAnim, betaAnim]
    this.scene.beginAnimation(this.camera, 0, frames, false, 1, finish)
    this.markDirty()
  }

  private onPointer = (info: PointerInfo) => {
    if (this.posterPreview) return
    const event = info.event as PointerEvent

    if (info.type === PointerEventTypes.POINTERMOVE) {
      if (this.pointerDownPos) return
      const pick = this.scene.pick(
        this.scene.pointerX,
        this.scene.pointerY,
        (mesh) => Boolean((mesh.metadata as { itemId?: string } | undefined)?.itemId),
      )
      const itemId = this.resolveItemId(pick.pickedMesh)
      if (itemId !== this.hoverItemId) {
        this.clearHover()
        if (itemId) this.showHover(itemId)
      }
      return
    }

    if (info.type === PointerEventTypes.POINTERDOWN) {
      this.pointerDownPos = { x: event.clientX, y: event.clientY }
      return
    }

    if (info.type !== PointerEventTypes.POINTERUP || !this.pointerDownPos) return

    const dx = event.clientX - this.pointerDownPos.x
    const dy = event.clientY - this.pointerDownPos.y
    this.pointerDownPos = null
    if (dx * dx + dy * dy > 36) return

    const mesh = info.pickInfo?.pickedMesh
    const itemId = this.resolveItemId(mesh)
    if (itemId) {
      this.focusItem(itemId, true)
      return
    }

    if (mesh?.metadata?.kind === 'ground' || !info.pickInfo?.hit) {
      this.resetFocus(true)
    }
  }

  private resolveItemId(mesh: Node | null | undefined): string | null {
    let current: Node | null | undefined = mesh
    while (current) {
      const meta = current.metadata as { itemId?: string } | undefined
      if (meta?.itemId) return meta.itemId
      current = current.parent
    }
    return null
  }

  /**
   * Fit a thick earth slab around the current model footprints with padding.
   * Centered on content; grows/shrinks as items are added/removed.
   */
  private resizeGroundToContent() {
    const cityOn = Boolean(this.cityRoot?.isEnabled())
    if (this.placements.size === 0 && !cityOn) {
      this.rebuildGround(0, 0, 60, 60)
      return
    }

    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    let maxMag = 1

    for (const placement of this.placements.values()) {
      placement.root.computeWorldMatrix(true)
      for (const child of placement.root.getChildMeshes()) child.computeWorldMatrix(true)
      const { min, max } = this.visualBounds(placement.root)
      minX = Math.min(minX, min.x)
      maxX = Math.max(maxX, max.x)
      minZ = Math.min(minZ, min.z)
      maxZ = Math.max(maxZ, max.z)
      const base = CATALOG_BY_ID[placement.itemId]
      if (base) {
        const item = resolveDetonationItem(base, this.detonationMode)
        maxMag = Math.max(maxMag, itemMagnitude(item))
      }
    }

    const hasItems = Number.isFinite(minX)
    const spanX = hasItems ? Math.max(maxX - minX, 1) : 1
    const spanZ = hasItems ? Math.max(maxZ - minZ, 1) : 1
    const pad = Math.max(spanX * 0.35, spanZ * 0.35, maxMag * 0.45, 28)

    let width = hasItems ? spanX + pad * 2 : 60
    let depth = hasItems ? spanZ + pad * 2 : 60
    let centerX = hasItems ? (minX + maxX) / 2 : 0
    let centerZ = hasItems ? (minZ + maxZ) / 2 : 0

    if (cityOn && this.cityFootprint.width > 1) {
      width = Math.max(width, this.cityFootprint.width * 1.22)
      depth = Math.max(depth, this.cityFootprint.depth * 1.22)
      centerX = 0
      centerZ = 0
    }

    this.rebuildGround(centerX, centerZ, width, depth)
  }

  /** Soft zenith→horizon→ground wash. Camera-relative via infiniteDistance; not clipped. */
  private createGradientSkybox(): Mesh {
    // Must stay inside the tightest far plane (syncCameraClipPlanes uses max(r*20, 200)).
    const size = 160
    const sky = MeshBuilder.CreateSphere(
      'skybox',
      { diameter: size, segments: 24, sideOrientation: Mesh.BACKSIDE },
      this.scene,
    )
    sky.isPickable = false
    sky.infiniteDistance = true
    sky.applyFog = false
    sky.alwaysSelectAsActiveMesh = true
    sky.ignoreCameraMaxZ = true

    const positions = sky.getVerticesData(VertexBuffer.PositionKind)
    if (positions) {
      const radius = size / 2
      const zenith = Color3.FromHexString('#9eb6c8')
      const horizon = Color3.FromHexString('#e4edf1')
      const ground = Color3.FromHexString('#dcd4c6')
      const colors = new Array<number>((positions.length / 3) * 4)
      for (let i = 0, c = 0; i < positions.length; i += 3, c += 4) {
        const y = positions[i + 1] / radius
        const color =
          y >= 0
            ? Color3.Lerp(horizon, zenith, Math.pow(y, 0.65))
            : Color3.Lerp(horizon, ground, Math.min(1, -y * 1.15))
        colors[c] = color.r
        colors[c + 1] = color.g
        colors[c + 2] = color.b
        colors[c + 3] = 1
      }
      sky.setVerticesData(VertexBuffer.ColorKind, colors)
    }

    const mat = new StandardMaterial('skyMat', this.scene)
    mat.disableLighting = true
    mat.backFaceCulling = false
    mat.disableDepthWrite = true
    mat.diffuseColor = Color3.Black()
    mat.specularColor = Color3.Black()
    mat.emissiveColor = Color3.White()
    mat.freeze()
    sky.material = mat
    sky.useVertexColors = true
    sky.hasVertexAlpha = false
    this.scene.autoClear = false
    return sky
  }

  private rebuildGround(centerX: number, centerZ: number, width: number, depth: number) {
    this.ground.dispose()
    this.ground = this.buildEarthSlab(centerX, centerZ, width, depth)
  }

  /**
   * Minecraft-style slab: neighborhood dirt, or a thick harbor volume under
   * the New York photogrammetry.
   */
  private buildEarthSlab(centerX: number, centerZ: number, width: number, depth: number): Mesh {
    const harbor = this.groundPlateId !== 'neighborhood'
    const span = Math.max(width, depth)
    const thickness = harbor
      ? Math.max(28, Math.min(span * 0.006, 72))
      : Math.max(8, Math.min(span * 0.0025, Math.sqrt(span) * 0.8))
    // Sit the harbor a few meters below streets so the city shoreline reads above water.
    const surfaceY = harbor ? -3 : 0

    const slab = MeshBuilder.CreateBox(
      'ground',
      { width, depth, height: thickness, wrap: true },
      this.scene,
    )
    slab.position.set(centerX, surfaceY - thickness / 2, centerZ)
    slab.receiveShadows = ENABLE_SCENE_LIGHTING
    slab.isPickable = true
    slab.metadata = { kind: 'ground' }

    const topMat = new StandardMaterial('groundTopMat', this.scene)
    topMat.specularColor = Color3.Black()
    topMat.diffuseColor = Color3.White()
    topMat.backFaceCulling = true
    // Lose depth vs models/plaques so a 160 km sphere doesn't z-fight the slab.
    topMat.zOffset = 2
    if (ENABLE_SCENE_LIGHTING) {
      topMat.emissiveColor = Color3.Black()
      topMat.ambientColor = new Color3(0.38, 0.4, 0.36)
    } else {
      topMat.disableLighting = true
      topMat.emissiveColor = Color3.White()
    }

    if (harbor && this.waterSurfaceTex) {
      const topTex = this.waterSurfaceTex
      topTex.uScale = Math.min(width / WATER_TILE_METERS, 36)
      topTex.vScale = Math.min(depth / WATER_TILE_METERS, 36)
      topTex.wrapU = Texture.WRAP_ADDRESSMODE
      topTex.wrapV = Texture.WRAP_ADDRESSMODE
      topMat.diffuseTexture = topTex
      if (!ENABLE_SCENE_LIGHTING) topMat.emissiveTexture = topTex
    } else if (this.neighborhoodTex && span < 8_000) {
      // Clone so each rebuild can set its own UV scale without fighting prior mats.
      const topTex = this.neighborhoodTex
      // Cap tiling: huge quads with uScale in the thousands swim and alias.
      topTex.uScale = Math.min(width / NEIGHBORHOOD_TILE_METERS, 48)
      topTex.vScale = Math.min(depth / NEIGHBORHOOD_TILE_METERS, 48)
      topTex.wrapU = Texture.WRAP_ADDRESSMODE
      topTex.wrapV = Texture.WRAP_ADDRESSMODE
      topMat.diffuseTexture = topTex
      if (!ENABLE_SCENE_LIGHTING) topMat.emissiveTexture = topTex
    } else if (ENABLE_SCENE_LIGHTING) {
      topMat.diffuseColor = new Color3(0.5, 0.53, 0.51)
    } else {
      // Km-scale slabs: aerial blocks become moiré; a flat earth read is enough.
      topMat.emissiveColor = new Color3(0.48, 0.5, 0.44)
    }

    const sideMat = new StandardMaterial('groundSideMat', this.scene)
    sideMat.specularColor = Color3.Black()
    sideMat.diffuseColor = Color3.White()
    sideMat.backFaceCulling = true
    if (ENABLE_SCENE_LIGHTING) {
      sideMat.emissiveColor = Color3.Black()
      sideMat.ambientColor = harbor ? new Color3(0.22, 0.34, 0.38) : new Color3(0.34, 0.28, 0.2)
    } else {
      sideMat.disableLighting = true
      sideMat.emissiveColor = Color3.White()
    }
    const sideTex = harbor ? this.waterSideTex : this.dirtSideTex
    if (sideTex) {
      // Tile horizontally with world size; V stays 0–1 so the rim stays on top.
      sideTex.uScale = Math.min(Math.max(width, depth) / (harbor ? WATER_TILE_METERS : 16), 48)
      sideTex.vScale = 1
      sideMat.diffuseTexture = sideTex
      if (!ENABLE_SCENE_LIGHTING) sideMat.emissiveTexture = sideTex
    } else if (ENABLE_SCENE_LIGHTING) {
      sideMat.diffuseColor = harbor ? new Color3(0.18, 0.38, 0.42) : new Color3(0.42, 0.28, 0.16)
    } else {
      sideMat.emissiveColor = harbor ? new Color3(0.18, 0.38, 0.42) : new Color3(0.42, 0.28, 0.16)
    }

    const bottomMat = new StandardMaterial('groundBottomMat', this.scene)
    bottomMat.disableLighting = true
    bottomMat.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND
    bottomMat.useAlphaFromDiffuseTexture = true
    bottomMat.disableDepthWrite = true
    bottomMat.backFaceCulling = true
    bottomMat.specularColor = Color3.Black()
    bottomMat.diffuseColor = Color3.White()
    bottomMat.emissiveColor = Color3.White()
    const bottomTex = harbor ? this.waterUndersideTex : this.undersideTex
    if (bottomTex) {
      bottomMat.diffuseTexture = bottomTex
      bottomMat.emissiveTexture = bottomTex
      bottomMat.opacityTexture = bottomTex
    } else {
      bottomMat.alpha = 0.22
      bottomMat.emissiveColor = harbor ? new Color3(0.18, 0.38, 0.42) : new Color3(0.42, 0.28, 0.16)
    }

    // CreateBox face order: front, back, right, left, top, bottom
    const multi = new MultiMaterial('groundMulti', this.scene)
    multi.subMaterials = [sideMat, sideMat, sideMat, sideMat, topMat, bottomMat]
    slab.material = multi

    const vertCount = slab.getTotalVertices()
    slab.subMeshes = []
    for (let i = 0; i < 6; i++) {
      // The constructor attaches itself to the mesh, so do not push as well:
      // that gave the slab 12 submeshes and drew every face twice.
      new SubMesh(i, 0, vertCount, i * 6, 6, slab)
    }

    slab.computeWorldMatrix(true)
    slab.doNotSyncBoundingInfo = true
    slab.freezeWorldMatrix()
    this.freezeMaterialTree(multi)

    return slab
  }

  private onCanvasPointerDown = (event: PointerEvent) => {
    if (event.button === 1) event.preventDefault()
    if (event.pointerType === 'touch') {
      this.activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY })
      this.syncTiltGesture()
    }
    this.markDirty()
  }

  private onCanvasPointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch' && this.activeTouches.has(event.pointerId)) {
      this.activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY })
      this.applyTiltGesture()
    }
    if (event.buttons) this.markDirty()
  }

  private onCanvasPointerUp = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return
    this.activeTouches.delete(event.pointerId)
    this.syncTiltGesture()
  }

  /** Mean Y of the live touch points, or `null` when none are down. */
  private touchCentroidY() {
    if (this.activeTouches.size === 0) return null
    let sum = 0
    for (const point of this.activeTouches.values()) sum += point.y
    return sum / this.activeTouches.size
  }

  /**
   * Starts or ends the three-finger tilt as fingers land and lift.
   *
   * Babylon's pointer input only ever tracks two pointers, so a third finger
   * would otherwise be ignored while the first two kept pinching. Detaching the
   * camera for the duration hands the gesture over cleanly and drops the input's
   * half-finished pinch state; re-attaching on the way back down means the user
   * must lift and re-touch to pinch again, rather than the camera lurching from
   * a stale finger pair.
   */
  private syncTiltGesture() {
    const tilting = this.activeTouches.size >= TILT_TOUCH_COUNT
    if (tilting === (this.tiltLastY !== null)) return
    const canvas = this.engine.getRenderingCanvas()
    if (tilting) {
      this.camera.detachControl()
      this.haltCameraMotion()
      this.tiltLastY = this.touchCentroidY()
    } else {
      this.tiltLastY = null
      if (canvas) this.camera.attachControl(canvas, true)
    }
  }

  private applyTiltGesture() {
    if (this.tiltLastY === null) return
    const centroidY = this.touchCentroidY()
    if (centroidY === null) return
    const deltaY = centroidY - this.tiltLastY
    this.tiltLastY = centroidY
    // Matches the one-finger orbit convention: dragging down looks from above.
    const beta = this.camera.beta - deltaY * TILT_RADIANS_PER_PIXEL
    this.camera.beta = Math.min(TILT_MAX_BETA, Math.max(TILT_MIN_BETA, beta))
    this.camera.unfreezeProjectionMatrix()
    this.markDirty()
  }

  private onCanvasWheel = () => {
    this.markDirty()
  }

  private isCameraAnimatable(animatable: { target: unknown }) {
    return animatable.target === this.camera
  }

  private hasActiveCameraAnimation() {
    for (const animatable of this.scene.animatables) {
      if (this.isCameraAnimatable(animatable)) return true
    }
    return false
  }

  private cameraNeedsFrames() {
    return (
      this.playing ||
      this.cameraStillGliding() ||
      this.hasActiveCameraAnimation() ||
      this.clipPlayingCount > 0
    )
  }

  private cameraStillGliding() {
    const camera = this.camera
    const movement = camera.movement
    if (movement?.activeInput) return true
    if (Math.abs(movement?.zoomDeltaCurrentFrame ?? 0) > 1e-8) return true
    const rotation = movement?.rotationDeltaCurrentFrame
    if (rotation && (Math.abs(rotation.x) > 1e-8 || Math.abs(rotation.y) > 1e-8)) return true
    const pan = movement?.panDeltaCurrentFrame
    if (pan && (Math.abs(pan.x) > 1e-8 || Math.abs(pan.y) > 1e-8)) return true
    if (Math.abs(camera.inertialAlphaOffset) > 1e-5) return true
    if (Math.abs(camera.inertialBetaOffset) > 1e-5) return true
    if (Math.abs(camera.inertialRadiusOffset) > 1e-5) return true
    if (Math.abs(camera.inertialPanningX) > 1e-5) return true
    if (Math.abs(camera.inertialPanningY) > 1e-5) return true
    return false
  }

  private onResize = () => {
    this.camera.unfreezeProjectionMatrix()
    if (this.posterPreview) this.applyPosterPreviewResolution()
    else this.applyResolutionCap()
    this.engine.resize()
    if (this.posterPreview) {
      this.framePosterCamera({
        ...this.posterPreview.settings,
        ...this.canvasCssSize(),
      })
      this.emitPosterOverlay()
    }
    this.markDirty()
  }

  private onVisibility = () => {
    if (!document.hidden) this.markDirty()
  }

  private markDirty() {
    this.renderNeeded = true
    this.armIdleSettle()
  }

  private armIdleSettle() {
    this.clearIdleSettle()
    this.idleSettleTimer = window.setTimeout(() => {
      this.idleSettleTimer = null
      if (this.disposed || this.playing || (!this.captureMode && document.hidden)) {
        return
      }
      this.holdIdle()
    }, IDLE_SETTLE_MS)
  }

  private clearIdleSettle() {
    if (this.idleSettleTimer == null) return
    window.clearTimeout(this.idleSettleTimer)
    this.idleSettleTimer = null
  }

  private holdIdle() {
    if (this.cameraNeedsFrames()) {
      this.armIdleSettle()
      return
    }
    for (const animatable of this.scene.animatables) {
      if (this.isCameraAnimatable(animatable)) continue
      animatable.pause()
    }
    this.heldIdle = true
    this.renderNeeded = false
  }

  private syncCameraClipPlanes() {
    const r = Math.max(this.camera.radius, 1)
    // Keep far/near ≈ 10k. Capping minZ at 2m (old) made km-scale views
    // z-fight: hulls vanish, ground/plaques wiggle.
    const minZ = Math.max(r / 500, 0.05)
    const cityFar = this.cityRoot?.isEnabled()
      ? Math.max(this.cityFootprint.width, this.cityFootprint.depth)
      : 0
    const maxZ = Math.max(r * 20, cityFar, 200)
    if (this.camera.minZ !== minZ || this.camera.maxZ !== maxZ) {
      this.camera.unfreezeProjectionMatrix()
      this.camera.minZ = minZ
      this.camera.maxZ = maxZ
    }
  }

  /** Keep pan/zoom in screen-relative units so km-scale views still move at a usable speed. */
  private syncCameraNavigationScale() {
    const radius = Math.max(this.camera.radius, this.camera.lowerRadiusLimit ?? 0.4)
    const scale = radius / CAMERA_NAV_REFERENCE_RADIUS
    const movement = this.camera.movement
    movement.panSpeed = scale
    movement.zoomSpeed = scale

    // Pan must track the cursor 1:1. Effective world-units-per-pixel is
    // panSpeed / panningSensibility, and one pixel spans
    // 2 * radius * tan(fov / 2) / viewportPx of world at the target plane, so
    // solving for the sensibility that cancels out leaves this constant.
    const horizontalFov = this.camera.fovMode === Camera.FOVMODE_HORIZONTAL_FIXED
    const viewportPx = horizontalFov
      ? this.engine.getRenderWidth()
      : this.engine.getRenderHeight()
    const worldPerPixelAtReference =
      (2 * Math.tan(this.camera.fov / 2)) / Math.max(viewportPx, 1)
    this.camera.panningSensibility =
      1 / (CAMERA_NAV_REFERENCE_RADIUS * worldPerPixelAtReference)
  }

  private tickRender = () => {
    if (this.disposed || (!this.captureMode && document.hidden)) {
      this.noteSkippedFrame()
      return
    }

    if (this.cameraNeedsFrames()) {
      this.renderNeeded = true
    }

    if (this.heldIdle && !this.renderNeeded) {
      this.noteSkippedFrame()
      return
    }
    if (!this.renderNeeded && this.scene.animatables.length === 0) {
      this.noteSkippedFrame()
      return
    }

    this.syncCameraClipPlanes()
    this.syncCameraNavigationScale()
    this.scene.render()
    this.camera.freezeProjectionMatrix()
    this.rendersThisSecond += 1
    this.publishPerf()
  }

  private noteSkippedFrame() {
    this.skippedThisSecond += 1
    this.publishPerf()
  }

  private publishPerf() {
    const now = performance.now()
    if (this.perfSecondStarted === 0) this.perfSecondStarted = now
    if (now - this.perfSecondStarted < 1000) return
    const stats = {
      submitsPerSec: this.rendersThisSecond,
      skippedPerSec: this.skippedThisSecond,
      heldIdle: this.heldIdle,
      renderNeeded: this.renderNeeded,
      animatables: this.scene.animatables.length,
    }
    ;(window as unknown as { __mmPerf: typeof stats }).__mmPerf = stats
    this.rendersThisSecond = 0
    this.skippedThisSecond = 0
    this.perfSecondStarted = now
  }

  private applyResolutionCap() {
    if (this.captureMode) {
      this.engine.setHardwareScalingLevel(1)
      return
    }
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO)
    this.engine.setHardwareScalingLevel(1 / dpr)
  }

  /** Live preview only — no 2× SSAA; download path supersamples separately. */
  private applyPosterPreviewResolution() {
    if (this.captureMode) {
      this.engine.setHardwareScalingLevel(1)
      return
    }
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_POSTER_PREVIEW_PIXEL_RATIO)
    this.engine.setHardwareScalingLevel(1 / dpr)
  }

  /**
   * Log depth writes gl_FragDepth, which disables MSAA coverage. Poster shots
   * frame a tight near/far, so linear depth is enough and edges can anti-alias.
   */
  private setMaterialsLogarithmicDepth(enabled: boolean) {
    const blocked = this.scene.blockMaterialDirtyMechanism
    this.scene.blockMaterialDirtyMechanism = false
    try {
      for (const material of this.scene.materials) {
        this.setMaterialLogarithmicDepth(material, enabled)
      }
    } finally {
      this.scene.blockMaterialDirtyMechanism = blocked
    }
  }

  private setMaterialLogarithmicDepth(
    material: Material | null | undefined,
    enabled: boolean,
  ) {
    if (!material) return
    if (material instanceof MultiMaterial) {
      for (const sub of material.subMaterials) {
        this.setMaterialLogarithmicDepth(sub, enabled)
      }
      return
    }
    if (material.useLogarithmicDepth === enabled) return
    const blocked = this.scene.blockMaterialDirtyMechanism
    this.scene.blockMaterialDirtyMechanism = false
    const frozen = material.isFrozen
    if (frozen) material.unfreeze()
    material.useLogarithmicDepth = enabled
    material.markDirty?.()
    if (frozen) material.freeze()
    this.scene.blockMaterialDirtyMechanism = blocked
  }

  private clampPosterPixelSize(
    width: number,
    height: number,
    maxEdge: number,
  ) {
    const long = Math.max(width, height)
    if (long <= maxEdge) return { width, height }
    const scale = maxEdge / long
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    }
  }

  /** Keep the on-screen canvas modest; the screenshot render target is full-res. */
  private setPosterCaptureBackbuffer(width: number, height: number) {
    const aspect = width / Math.max(height, 1)
    const cap = 2048
    let w: number
    let h: number
    if (aspect >= 1) {
      w = Math.min(width, cap)
      h = Math.max(1, Math.round(w / aspect))
    } else {
      h = Math.min(height, cap)
      w = Math.max(1, Math.round(h * aspect))
    }
    this.engine.setSize(w, h)
  }

  private async screenshotPosterPng(
    width: number,
    height: number,
    superScale: number,
    samples: number,
  ) {
    const capture = (scale: number, msaa: number) =>
      CreateScreenshotUsingRenderTargetAsync(
        this.engine,
        this.camera,
        {
          width: Math.max(1, Math.round(width * scale)),
          height: Math.max(1, Math.round(height * scale)),
        },
        'image/png',
        msaa,
        false,
        undefined,
        false,
        false,
        true,
      )
    const scale = Math.max(superScale, 1)
    try {
      return await capture(scale, samples)
    } catch (error) {
      if (scale > 1 || samples > 1) {
        return await capture(1, 1)
      }
      throw error
    }
  }

  private isAnimatedPlacement(placement: PlacedObject): boolean {
    const item = CATALOG_BY_ID[placement.itemId]
    return Boolean(item && (item.playClips || item.shape === 'person'))
  }

  private thawPlacement(placement: PlacedObject) {
    placement.root.unfreezeWorldMatrix()
    placement.display.unfreezeWorldMatrix()
    placement.body.unfreezeWorldMatrix()
    for (const mesh of placement.root.getChildMeshes(false)) {
      mesh.unfreezeWorldMatrix()
      mesh.doNotSyncBoundingInfo = false
    }
  }

  private freezeStaticPlacement(placement: PlacedObject) {
    // Rigged placements keep live world matrices, but their materials still
    // have to share the ground's depth encoding. Logarithmic depth writes
    // gl_FragDepth on its own curve, so a mesh left on hardware depth cannot be
    // compared against one using it — the ground wins the test and paints over
    // models standing on top of it.
    if (this.isAnimatedPlacement(placement)) {
      for (const mesh of placement.root.getChildMeshes(false)) {
        this.setMaterialLogarithmicDepth(mesh.material, !this.posterPreview)
      }
      return
    }
    placement.root.computeWorldMatrix(true)
    placement.display.computeWorldMatrix(true)
    placement.body.computeWorldMatrix(true)
    for (const mesh of placement.root.getChildMeshes(false)) {
      mesh.computeWorldMatrix(true)
      mesh.doNotSyncBoundingInfo = true
      mesh.freezeWorldMatrix()
      this.freezeMaterialTree(mesh.material)
    }
    placement.body.freezeWorldMatrix()
    placement.display.freezeWorldMatrix()
    placement.root.freezeWorldMatrix()
  }

  private freezeStaticScene() {
    if (this.shadowsActive()) this.syncShadowCasters()
    for (const placement of this.placements.values()) {
      this.freezeStaticPlacement(placement)
    }
    if (this.shadowsActive()) this.fitSunShadows()
  }

  private installLights() {
    if (ENABLE_SCENE_LIGHTING) {
      const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), this.scene)
      hemi.intensity = 0.28
      hemi.diffuse = new Color3(0.9, 0.93, 1)
      hemi.groundColor = new Color3(0.36, 0.34, 0.3)
      hemi.specular = Color3.Black()

      this.sun = new DirectionalLight('sun', new Vector3(-0.45, -1, 0.62), this.scene)
      this.sun.direction.normalize()
      this.sun.intensity = 1.9
      this.sun.diffuse = new Color3(1, 0.93, 0.8)
      this.sun.specular = new Color3(1, 0.9, 0.72)
      this.fitSunShadows()

      const fill = new DirectionalLight('fill', new Vector3(0.55, -0.35, -0.7), this.scene)
      fill.intensity = 0.16
      fill.diffuse = new Color3(0.6, 0.74, 0.95)
      fill.specular = Color3.Black()
      fill.shadowEnabled = false

      this.shadows = this.createSunShadows(this.sun)
      this.scene.environmentIntensity = 0.28
      this.applyShadowState()
    } else {
      const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), this.scene)
      hemi.intensity = 0.8
      hemi.groundColor = new Color3(0.28, 0.3, 0.28)

      this.sun = new DirectionalLight('sun', new Vector3(-0.4, -1, 0.35), this.scene)
      this.sun.intensity = 0.7
      this.sun.position = new Vector3(40, 80, -20)
      this.scene.environmentIntensity = 0.4
    }

    // Modest IBL so metallic glTF doesn't go black.
    const envUrl = publicAssetUrl('env/environmentSpecular.env')
    const env = CubeTexture.CreateFromPrefilteredData(envUrl, this.scene)
    env.onLoadObservable.addOnce(() => this.markDirty())
    this.scene.environmentTexture = env
  }

  /**
   * Directional shadows must be a square ortho looking along `sun.direction`
   * through the lineup center. Auto-fit off-center ortho shears the window so
   * contact shadows look overhead at one end of the row and low-angle at the other.
   */
  private fitSunShadows() {
    const bounds = this.lineupWorldBounds()
    const center = bounds
      ? Vector3.Center(bounds.min, bounds.max)
      : new Vector3(0, 4, 0)
    const extent = bounds
      ? bounds.max.subtract(bounds.min)
      : new Vector3(60, 20, 60)
    const radius = Math.max(extent.length() * 0.5, 8)
    const dir = this.sun.direction.clone()
    if (dir.lengthSquared() < 1e-6) dir.set(-0.45, -1, 0.62)
    dir.normalize()
    this.sun.direction.copyFrom(dir)

    const standoff = radius * 2 + 24
    this.sun.position.copyFrom(center).subtractInPlace(dir.scale(standoff))
    this.sun.autoUpdateExtends = false
    this.sun.autoCalcShadowZBounds = false
    this.sun.shadowFrustumSize = radius * 2.15
    this.sun.shadowMinZ = 1
    this.sun.shadowMaxZ = standoff + radius + 16
    this.sun.forceProjectionMatrixCompute()
  }

  private createSunShadows(sun: DirectionalLight): ShadowGenerator {
    const shadows = new ShadowGenerator(4096, sun, true)
    shadows.usePercentageCloserFiltering = true
    shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM
    shadows.bias = 0.0004
    shadows.normalBias = 0.015
    shadows.darkness = SHADOW_DARKNESS
    return shadows
  }

  private syncShadowCasters() {
    if (!this.shadows) return
    const map = this.shadows.getShadowMap()
    if (map?.renderList) map.renderList.length = 0

    if (this.cityRoot) {
      for (const mesh of this.cityRoot.getChildMeshes(false)) {
        if (!mesh.isVisible || mesh.getTotalVertices() < 3) continue
        mesh.receiveShadows = true
      }
    }

    for (const placement of this.placements.values()) {
      const item = CATALOG_BY_ID[placement.itemId]
      if (item?.model && this.isAirBlastModel(item.model.path)) continue

      if (placement.body instanceof AbstractMesh) {
        placement.body.receiveShadows = true
        this.shadows.addShadowCaster(placement.body, true)
      }
      for (const mesh of placement.body.getChildMeshes(false)) {
        if (!mesh.isVisible || mesh.getTotalVertices() < 3) continue
        mesh.receiveShadows = true
        if (!(placement.body instanceof AbstractMesh)) {
          this.shadows.addShadowCaster(mesh, false)
        }
      }
    }
  }

  private freezeMaterialTree(material: Material | null | undefined) {
    if (!material) return
    if (material instanceof MultiMaterial) {
      for (const sub of material.subMaterials) this.freezeMaterialTree(sub)
      return
    }
    // Linear 24-bit depth falls apart for 160 km subjects; log depth keeps
    // hulls and the ground from z-fighting. Off during poster preview so
    // MSAA can actually anti-alias silhouettes (gl_FragDepth kills coverage).
    this.setMaterialLogarithmicDepth(material, !this.posterPreview)
    if (!material.isFrozen) material.freeze()
  }

  private removePlacement(instanceId: string) {
    const placement = this.placements.get(instanceId)
    if (!placement) return
    if (this.hoverItemId === placement.itemId) this.clearHover()
    this.disposePlacement(placement)
    this.placements.delete(instanceId)
  }

  private disposePlacement(placement: PlacedObject) {
    if (placement.clipPlaying) {
      placement.clipPlaying = false
      this.clipPlayingCount = Math.max(0, this.clipPlayingCount - 1)
    }
    for (const group of placement.animationGroups) {
      try {
        group.stop()
        group.dispose()
      } catch {
        // Already disposed with the scene/mesh.
      }
    }
    placement.animationGroups = []
    if (!placement.root.isDisposed()) {
      placement.root.dispose(false, true)
    }
  }

  private async createPlacement(
    item: CatalogItem,
    opts: {
      x?: number
      hidden?: boolean
      /** 0–1 of the model file downloaded, when the server reports a length. */
      onProgress?: (fraction: number) => void
    } = {},
  ): Promise<PlacedObject> {
    const instanceId = `${item.id}-${crypto.randomUUID()}`
    const root = new TransformNode(`root-${instanceId}`, this.scene)
    root.metadata = { itemId: item.id }
    root.position.set(opts.x ?? 0, 0, 0)
    if (opts.hidden) root.setEnabled(false)

    let body: TransformNode
    let animationGroups: AnimationGroup[] = []
    let skeletons: Skeleton[] = []
    if (item.instanceGrid) {
      try {
        body = await this.loadInstanceGrid(item, item.instanceGrid, instanceId)
      } catch (error) {
        console.warn(`Failed to load instance grid for ${item.id}, using stand-in.`, error)
        body = this.buildStandInMesh(item, instanceId)
        this.tintStandIn(body, item, instanceId)
      }
    } else if (item.model) {
      try {
        const loaded = await this.loadScaledModel(item, instanceId, opts.onProgress)
        body = loaded.container
        animationGroups = loaded.animationGroups
        skeletons = loaded.skeletons
      } catch (error) {
        console.warn(`Failed to load ${item.model.path}, using stand-in.`, error)
        // Dispose any partial import Babylon may have left in the scene.
        this.scene.meshes
          .filter((mesh) => mesh.name?.includes(instanceId) || mesh.id?.includes(instanceId))
          .forEach((mesh) => {
            if (!mesh.isDisposed()) mesh.dispose(false, true)
          })
        body = this.buildStandInMesh(item, instanceId)
        this.tintStandIn(body, item, instanceId)
      }
    } else {
      body = this.buildStandInMesh(item, instanceId)
      this.tintStandIn(body, item, instanceId)
    }

    const display = new TransformNode(`display-${instanceId}`, this.scene)
    display.parent = root
    display.rotation.y = displayYawRadians(this.displayYawTurns)
    body.parent = display
    body.metadata = { itemId: item.id }
    this.markPickable(body, item.id)
    const labelTex = this.captureMode
      ? null
      : this.attachPlaque(root, body, item, instanceId)

    const placement: PlacedObject = {
      instanceId,
      itemId: item.id,
      effectKey: this.effectKeyFor(item.id),
      root,
      display,
      body,
      labelTex,
      animationGroups,
      clipPlaying: false,
    }

    if (item.shape === 'person') {
      this.preparePersonRestPose(placement, skeletons)
    }

    return placement
  }

  private markPickable(node: TransformNode, itemId: string) {
    node.metadata = { ...(node.metadata ?? {}), itemId }
    if (node instanceof AbstractMesh) {
      node.isPickable = node.getTotalVertices() > 0
    }
    for (const child of node.getChildMeshes(false)) {
      child.metadata = { ...(child.metadata ?? {}), itemId }
      child.isPickable = child.getTotalVertices() > 0
    }
  }

  private tintStandIn(body: TransformNode, item: CatalogItem, instanceId: string) {
    if (item.shape === 'cylinder' && item.orientation === 'horizontal') {
      body.position.y = item.width / 2
    } else if (item.shape !== 'person') {
      body.position.y = item.height / 2
    }

    const mat = new StandardMaterial(`mat-${instanceId}`, this.scene)
    mat.diffuseColor = Color3.FromHexString(item.color)
    mat.specularColor = new Color3(0.15, 0.15, 0.15)
    this.applyMaterial(body, mat)
  }

  private async loadScaledModel(
    item: CatalogItem,
    instanceId: string,
    onProgress?: (fraction: number) => void,
  ): Promise<{
    container: TransformNode
    animationGroups: AnimationGroup[]
    skeletons: Skeleton[]
  }> {
    const model = item.model!
    const { rootUrl, filename } = this.resolveModelUrl(model.path)

    const result = await SceneLoader.ImportMeshAsync(
      '',
      rootUrl,
      filename,
      this.scene,
      onProgress
        ? (event) => {
            // A cached file reports no length; it lands as a completion instead.
            if (!event.lengthComputable || event.total <= 0) return
            onProgress(event.loaded / event.total)
          }
        : undefined,
    )
    // Hide immediately — ImportMesh drops meshes at the world origin before parenting.
    for (const mesh of result.meshes) {
      mesh.isVisible = false
      mesh.setEnabled(false)
    }

    const container = new TransformNode(`mesh-${instanceId}`, this.scene)
    container.metadata = { itemId: item.id }

    for (const mesh of result.meshes) {
      if (!mesh.parent) {
        mesh.parent = container
      }
      mesh.isVisible = true
      mesh.setEnabled(true)
    }

    const pitch = ((model.pitchDegrees ?? 0) * Math.PI) / 180
    const roll = ((model.rollDegrees ?? 0) * Math.PI) / 180
    const yaw = model.randomYaw ? 0 : ((model.yawDegrees ?? 0) * Math.PI) / 180
    if (pitch || roll || yaw) {
      container.rotationQuaternion = Quaternion.FromEulerAngles(pitch, yaw, roll)
    }

    this.enableVertexColors(container)
    this.prepareImportedMaterials(container)
    if (this.isAirBlastModel(model.path)) {
      this.prepareAirBlastMaterials(container)
    }
    if (item.shape === 'person') {
      this.preparePersonMaterials(container, item.id)
    }
    const keepClips = Boolean(item.playClips || item.shape === 'person')
    if (model.poseAtClipEnd) {
      // Hold the last frame (F-22: gear down, boarding ladder out) and never play.
      this.holdClipEndPose(result.animationGroups)
    } else if (!keepClips) {
      // Stop sim "hide" clips (B-21 teleports GBUs to y≈-8192) before measuring.
      for (const skeleton of result.skeletons ?? []) {
        try {
          skeleton.returnToRest()
        } catch {
          // Some imports have no rest pose.
        }
      }
      this.disposeImportedAnimations(result.animationGroups)
    } else {
      for (const group of result.animationGroups ?? []) {
        try {
          group.stop()
          group.reset()
        } catch {
          // Some importers leave groups already stopped.
        }
      }
    }
    container.computeWorldMatrix(true)
    for (const mesh of container.getChildMeshes(false)) {
      mesh.computeWorldMatrix(true)
      mesh.refreshBoundingInfo(true, true)
    }
    this.normalizeToMeters(container, item, model.scaleAxis)
    if (model.randomYaw) {
      // After scale so size stays stable; spin about vertical only.
      container.rotation.y = Math.random() * Math.PI * 2
    }
    if (this.isAirBlastModel(model.path)) {
      this.liftAirBlast(container)
    }
    if (model.heightPaint) {
      this.applyHeightPaint(container, model.heightPaint)
    }
    return {
      container,
      animationGroups: keepClips && !model.poseAtClipEnd ? (result.animationGroups ?? []) : [],
      skeletons: result.skeletons ?? [],
    }
  }

  /**
   * Money pile as one tiled mesh: outer faces subdivided into whole $42M cubes
   * so every quad samples a full atlas clip (no half-blocks, no instance flood).
   */
  private async loadInstanceGrid(
    item: CatalogItem,
    grid: CatalogInstanceGrid,
    instanceId: string,
  ): Promise<TransformNode> {
    const unit = {
      width: grid.unitWidth,
      length: grid.unitLength,
      height: grid.unitHeight,
    }
    const pack = packMoneyAmount(grid.targetUsd, grid.unitUsd, unit)
    if (pack.slotCount < 1) {
      throw new Error(`Empty money pack for ${item.id}`)
    }

    const template = await this.getModelTemplate(grid.unitPath)
    const sourceMat = template.material
    const mat =
      sourceMat && 'clone' in sourceMat
        ? (sourceMat.clone(`${sourceMat.name}-pile-${instanceId}`) as typeof sourceMat)
        : sourceMat

    const container = new TransformNode(`mesh-${instanceId}`, this.scene)
    container.metadata = { itemId: item.id }

    const pile = createMoneyTiledPile(
      `grid-tiled-${instanceId}`,
      pack,
      unit,
      mat,
      this.scene,
    )
    pile.parent = container
    pile.metadata = { itemId: item.id }

    container.computeWorldMatrix(true)
    this.setMeshBounds(
      pile,
      -pack.width / 2,
      0,
      -pack.length / 2,
      pack.width / 2,
      pack.height,
      pack.length / 2,
    )

    return container
  }

  private async getModelTemplate(relativePath: string): Promise<Mesh> {
    const cached = this.modelTemplates.get(relativePath)
    if (cached && !cached.isDisposed()) return cached

    let pending = this.modelTemplateLoading.get(relativePath)
    if (!pending) {
      pending = (async () => {
        const { rootUrl, filename } = this.resolveModelUrl(relativePath)
        const result = await SceneLoader.ImportMeshAsync('', rootUrl, filename, this.scene)

        const renderable = result.meshes.find(
          (mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0,
        )
        if (!renderable) {
          throw new Error(`No renderable mesh in ${relativePath}`)
        }

        for (const mesh of result.meshes) {
          mesh.isVisible = false
          mesh.setEnabled(false)
        }

        const holder = new TransformNode(`template-holder-${relativePath}`, this.scene)
        holder.setEnabled(false)
        renderable.parent = holder
        this.prepareImportedMaterials(holder)
        this.modelTemplates.set(relativePath, renderable)
        return renderable
      })()
      this.modelTemplateLoading.set(relativePath, pending)
    }

    try {
      return await pending
    } finally {
      this.modelTemplateLoading.delete(relativePath)
    }
  }

  private setMeshBounds(
    mesh: AbstractMesh,
    minX: number,
    minY: number,
    minZ: number,
    maxX: number,
    maxY: number,
    maxZ: number,
  ) {
    mesh.setBoundingInfo(
      new BoundingInfo(
        new Vector3(minX, minY, minZ),
        new Vector3(maxX, maxY, maxZ),
      ),
    )
  }

  /** People GLBs often ship as BLEND + alpha textures (Minecraft) or tear films (RPM). */
  private preparePersonMaterials(root: TransformNode, itemId: string) {
    const isMinecraft = itemId === 'minecraft-player'

    for (const mesh of root.getChildMeshes(false)) {
      const mat = mesh.material
      if (!(mat instanceof PBRMaterial)) continue

      mat.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE
      mat.alpha = 1
      if (mat.albedoTexture) {
        mat.albedoTexture.hasAlpha = false
        mat.useAlphaFromAlbedoTexture = false
        if (isMinecraft) {
          mat.albedoTexture.wrapU = Texture.CLAMP_ADDRESSMODE
          mat.albedoTexture.wrapV = Texture.CLAMP_ADDRESSMODE
          mat.albedoTexture.updateSamplingMode(Constants.TEXTURE_NEAREST_SAMPLINGMODE)
        }
      }
      if (mat.subSurface) {
        mat.subSurface.isRefractionEnabled = false
        mat.subSurface.isTranslucencyEnabled = false
      }
      mat.metallic = Math.min(mat.metallic ?? 0, 0.05)
      mat.roughness = Math.max(mat.roughness ?? 0.5, isMinecraft ? 0.85 : 0.55)
      if (ENABLE_SCENE_LIGHTING) {
        mat.environmentIntensity = isMinecraft ? 0.2 : 0.3
        mat.directIntensity = isMinecraft ? 1.45 : 1.4
        mat.unlit = false
        mat.emissiveColor = Color3.Black()
        mat.emissiveIntensity = 0
        mat.emissiveTexture = null
      } else {
        mat.environmentIntensity = isMinecraft ? 0.35 : 0.65
        mat.directIntensity = isMinecraft ? 1.25 : 1.15
      }
      mat.backFaceCulling = false
      mat.twoSidedLighting = true
      mat.markDirty?.()
    }
  }

  /** Rest pose only; imported clips play on select via `playFocusMotion`. */
  private preparePersonRestPose(placement: PlacedObject, skeletons: Skeleton[]) {
    const ambient =
      placement.animationGroups.find((group) => /idle(?!\.001)/i.test(group.name)) ??
      placement.animationGroups.find((group) => /idle/i.test(group.name))
    if (!ambient) this.relaxTPoseArms(skeletons)
  }

  private playFocusMotion(itemId: string | undefined) {
    this.stopImportedClips(itemId)
    if (!itemId) return
    const item = CATALOG_BY_ID[itemId]
    if (!item?.playClips) return
    const placement = [...this.placements.values()].find((p) => p.itemId === itemId)
    if (placement) this.playPlacementClip(placement)
  }

  private stopImportedClips(exceptItemId?: string) {
    for (const placement of this.placements.values()) {
      const item = CATALOG_BY_ID[placement.itemId]
      if (!item?.playClips) continue
      if (exceptItemId && placement.itemId === exceptItemId) continue
      this.stopPlacementClips(placement)
    }
  }

  private stopPlacementClips(placement: PlacedObject) {
    for (const group of placement.animationGroups) {
      try {
        group.stop()
      } catch {
        // ignore
      }
    }
    if (!placement.clipPlaying) return
    placement.clipPlaying = false
    this.clipPlayingCount = Math.max(0, this.clipPlayingCount - 1)
  }

  private playPlacementClip(placement: PlacedObject) {
    const item = CATALOG_BY_ID[placement.itemId]
    const clip = this.pickFocusClip(placement.animationGroups, item?.model?.clipPrefer)
    if (!clip) return

    this.heldIdle = false
    for (const group of placement.animationGroups) {
      try {
        group.stop()
      } catch {
        // ignore
      }
    }
    clip.play(true)
    if (!placement.clipPlaying) {
      placement.clipPlaying = true
      this.clipPlayingCount += 1
    }
    this.markDirty()
  }

  private pickFocusClip(groups: AnimationGroup[], prefer?: string): AnimationGroup | null {
    const usable = groups.filter((group) => group.targetedAnimations.length > 0)
    if (usable.length === 0) return null
    if (prefer) {
      try {
        const re = new RegExp(prefer, 'i')
        const hit = usable.find((group) => re.test(group.name))
        if (hit) return hit
      } catch {
        // Invalid catalog regex — fall through to defaults.
      }
    }
    const order = [/run/i, /walk/i, /fly/i, /howl/i, /hop|jump/i, /idle/i, /attack/i]
    for (const re of order) {
      const hit = usable.find((group) => re.test(group.name))
      if (hit) return hit
    }
    return usable.reduce((best, group) =>
      group.targetedAnimations.length > best.targetedAnimations.length ? group : best,
    )
  }

  private relaxTPoseArms(skeletons: Skeleton[], turns = 0.42) {
    const left = this.findArmNode(skeletons, 'left')
    const right = this.findArmNode(skeletons, 'right')
    // Drop from horizontal T-pose toward the hips (local Z on Mixamo-style arms).
    if (left) this.nudgeEuler(left, new Vector3(0, 0, Math.PI * turns))
    if (right) this.nudgeEuler(right, new Vector3(0, 0, -Math.PI * turns))
  }

  private findArmNode(skeletons: Skeleton[], side: 'left' | 'right'): TransformNode | null {
    const prefer =
      side === 'right'
        ? [/^RightArm(_|$)/i, /^Right_Arm(_|$)/i, /^right_arm$/i, /RightArm/i]
        : [/^LeftArm(_|$)/i, /^Left_Arm(_|$)/i, /^left_arm$/i, /LeftArm/i]
    const reject = /thumb|index|middle|ring|pinky|hand|fore|lower|end|shoulder/i
    const candidates: TransformNode[] = []
    for (const skeleton of skeletons) {
      for (const bone of skeleton.bones) {
        const node = bone.getTransformNode()
        if (node) candidates.push(node)
      }
    }
    for (const pattern of prefer) {
      const hit = candidates.find((node) => pattern.test(node.name) && !reject.test(node.name))
      if (hit) return hit
    }
    return null
  }

  private nudgeEuler(node: TransformNode, delta: Vector3) {
    if (node.rotationQuaternion) {
      node.rotation = node.rotationQuaternion.toEulerAngles()
      node.rotationQuaternion = null
    }
    node.rotation.addInPlace(delta)
  }

  /**
   * Recolor by world height with a hard seam (nearest 1D albedo strip).
   * N1: olive through stage-3 taper, off-white from the upper-stage flare to the tip.
   * Avoids vertex-color blending across tall stage panels — no mesh explode needed.
   */
  private applyHeightPaint(
    root: TransformNode,
    paint: NonNullable<CatalogItem['model']>['heightPaint'],
  ) {
    if (!paint) return
    root.computeWorldMatrix(true)
    for (const child of root.getChildMeshes(false)) {
      child.computeWorldMatrix(true)
    }

    const { min, max } = this.visualBounds(root)
    const height = Math.max(max.y - min.y, 1e-6)
    const below = Color3.FromHexString(paint.below)
    const above = Color3.FromHexString(paint.above)

    // 1D green|white strip; NEAREST sampling → sharp stage joint, not a soft fade.
    const stripW = 256
    const splitPx = Math.max(1, Math.min(stripW - 1, Math.round(paint.split * stripW)))
    const pixels = new Uint8Array(stripW * 4)
    for (let x = 0; x < stripW; x++) {
      const c = x < splitPx ? below : above
      const i = x * 4
      pixels[i] = Math.round(c.r * 255)
      pixels[i + 1] = Math.round(c.g * 255)
      pixels[i + 2] = Math.round(c.b * 255)
      pixels[i + 3] = 255
    }
    const strip = RawTexture.CreateRGBATexture(
      pixels,
      stripW,
      1,
      this.scene,
      false,
      false,
      Constants.TEXTURE_NEAREST_SAMPLINGMODE,
    )
    strip.wrapU = Constants.TEXTURE_CLAMP_ADDRESSMODE
    strip.wrapV = Constants.TEXTURE_CLAMP_ADDRESSMODE
    strip.name = `height-paint-strip-${root.uniqueId}`

    const worldPos = new Vector3()
    for (const mesh of root.getChildMeshes(false)) {
      const positions = mesh.getVerticesData(VertexBuffer.PositionKind)
      if (!positions || positions.length < 3) continue

      const wm = mesh.getWorldMatrix()
      const vertCount = positions.length / 3
      const uvs = new Float32Array(vertCount * 2)
      for (let i = 0; i < vertCount; i++) {
        worldPos.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
        Vector3.TransformCoordinatesToRef(worldPos, wm, worldPos)
        // U = height fraction; strip pixel flips at paint.split.
        uvs[i * 2] = (worldPos.y - min.y) / height
        uvs[i * 2 + 1] = 0.5
      }
      mesh.setVerticesData(VertexBuffer.UVKind, uvs, true)
      mesh.hasVertexAlpha = false
      mesh.useVertexColors = false

      const mat = new PBRMaterial(`height-paint-${mesh.uniqueId}`, this.scene)
      mat.albedoColor = Color3.White()
      mat.albedoTexture = strip
      mat.metallic = 0
      mat.roughness = 0.58
      mat.alpha = 1
      mat.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE
      mat.environmentIntensity = ENABLE_SCENE_LIGHTING ? 0.3 : 0.55
      mat.directIntensity = ENABLE_SCENE_LIGHTING ? 1.35 : 1.1
      mat.backFaceCulling = false
      mat.twoSidedLighting = true
      mesh.material = mat
    }
  }

  /**
   * Sketchfab GLBs often need small fixes for a simple outdoor comparison scene:
   * wrong alphaMode (whole body BLEND), transmission tear films, dark-metal blacks.
   */
  private prepareImportedMaterials(root: TransformNode) {
    for (const mesh of root.getChildMeshes(false)) {
      const mat = mesh.material
      if (!(mat instanceof PBRMaterial)) continue

      const name = `${mat.name ?? ''} ${mesh.name ?? ''}`.toLowerCase()

      // Untinted glass (white base color, no texture) reads as solid white windows.
      // Give it a dark, slightly transparent tint so cockpit/cabin glazing reads as glass.
      if (
        !mat.albedoTexture &&
        (name.includes('glass') ||
          name.includes('window') ||
          name.includes('windshield') ||
          name.includes('windscreen') ||
          name.includes('canopy') ||
          name.includes('glazing'))
      ) {
        mat.albedoColor = new Color3(0.06, 0.08, 0.1)
        mat.metallic = 0.1
        mat.roughness = 0.15
        mat.alpha = Math.min(mat.alpha ?? 1, 0.72)
        mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND
        mat.backFaceCulling = true
        if (mat.subSurface) {
          mat.subSurface.isRefractionEnabled = false
          mat.subSurface.isTranslucencyEnabled = false
        }
        mat.markDirty?.()
        continue
      }

      // Hide refractive tear/wet-eye films — they read as ghostly transparency.
      if (name.includes('tear')) {
        mesh.isVisible = false
        continue
      }

      // Teal'c body (and similar) ships as BLEND with an opaque texture → ghost mesh.
      if (
        name.includes('body') ||
        name.includes('skin') ||
        name.includes('head') ||
        name.includes('armor') ||
        name.includes('cloth')
      ) {
        mat.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE
        mat.alpha = 1
        if (mat.subSurface) {
          mat.subSurface.isRefractionEnabled = false
          mat.subSurface.isTranslucencyEnabled = false
        }
      }

      // Keep eyelashes / hair as alpha blend; everything else with full alpha → opaque.
      if (
        mat.transparencyMode === PBRMaterial.PBRMATERIAL_ALPHABLEND &&
        !name.includes('lash') &&
        !name.includes('hair') &&
        !name.includes('fur') &&
        (mat.alpha ?? 1) > 0.98
      ) {
        mat.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE
      }

      // MASK cutouts minify to empty at km-scale (Death Star II hull). Treat as
      // opaque so the silhouette stays solid; geometric gaps still read.
      if (mat.transparencyMode === PBRMaterial.PBRMATERIAL_ALPHATEST) {
        mat.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE
        mat.alpha = 1
        mat.needDepthPrePass = false
        mat.backFaceCulling = false
        mat.twoSidedLighting = true
        if (mat.albedoTexture) {
          mat.albedoTexture.hasAlpha = false
          mat.useAlphaFromAlbedoTexture = false
        }
      }

      if (ENABLE_SCENE_LIGHTING) {
        mat.environmentIntensity = 0.35
        mat.directIntensity = 1.35
        mat.unlit = false
        mat.emissiveColor = Color3.Black()
        mat.emissiveIntensity = 0
        mat.emissiveTexture = null
      } else {
        mat.environmentIntensity = 0.85
        mat.directIntensity = 1
      }

      // Dark metallic shells (bombs, ships) → readable painted metal, not black chrome.
      const metallic = mat.metallic ?? 0
      if (metallic >= 0.35) {
        mat.metallic = Math.min(metallic, 0.28)
        mat.roughness = Math.max(mat.roughness ?? 0.4, 0.42)
      }
      if (mat.albedoColor) {
        const lum =
          mat.albedoColor.r * 0.2126 + mat.albedoColor.g * 0.7152 + mat.albedoColor.b * 0.0722
        if (lum < 0.12) {
          mat.albedoColor = mat.albedoColor.add(new Color3(0.1, 0.1, 0.1))
        }
      }

      mat.markDirty?.()
    }
  }

  private isAirBlastModel(path: string) {
    return path.includes('nuclear-fireball')
  }

  /**
   * Air-blast GLB is an emissive energy sphere on a black albedo. Normal
   * alpha-blend of that black shell reads as a disc; additive + no depth write
   * keeps the glow and the far side of the sphere.
   */
  private prepareAirBlastMaterials(root: TransformNode) {
    for (const mesh of root.getChildMeshes(false)) {
      const mat = mesh.material
      if (!(mat instanceof PBRMaterial)) continue

      mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND
      mat.alphaMode = Engine.ALPHA_ADD
      mat.backFaceCulling = false
      mat.twoSidedLighting = true
      mat.disableDepthWrite = true
      mat.needDepthPrePass = false
      mat.useAlphaFromAlbedoTexture = false
      mat.metallic = 0
      mat.roughness = 1
      mat.environmentIntensity = 0
      mat.directIntensity = 0
      mat.albedoColor = Color3.Black()
      mat.emissiveColor = Color3.White()
      if (mat.subSurface) {
        mat.subSurface.isRefractionEnabled = false
        mat.subSurface.isTranslucencyEnabled = false
      }
      if (mat.albedoTexture) {
        mat.albedoTexture.hasAlpha = false
      }
      mat.markDirty?.()
    }
  }

  private liftAirBlast(root: TransformNode) {
    root.computeWorldMatrix(true)
    for (const child of root.getChildMeshes()) child.computeWorldMatrix(true)
    const bounds = this.visualBounds(root)
    const height = bounds.max.y - bounds.min.y
    if (height > 1e-6) root.position.y += height * 0.4
  }

  /** Ensure glTF COLOR_0 attributes actually tint the mesh (Babylon 9: flag lives on the mesh). */
  private enableVertexColors(root: TransformNode) {
    for (const mesh of root.getChildMeshes(false)) {
      if (mesh.isVerticesDataPresent(VertexBuffer.ColorKind)) {
        mesh.useVertexColors = true
        // Avoid ghosting when COLOR_0 is VEC4 (loader sets hasVertexAlpha).
        mesh.hasVertexAlpha = false
      }
    }
  }

  /** Resolve a public/ asset path into Babylon rootUrl + filename (textures resolve beside the GLB). */
  private resolveModelUrl(relativePath: string): { rootUrl: string; filename: string } {
    const clean = relativePath.replace(/^\//, '')
    const absolute = new URL(publicAssetUrl(clean))
    const href = absolute.href
    const slash = href.lastIndexOf('/')
    return {
      rootUrl: href.slice(0, slash + 1),
      filename: decodeURIComponent(href.slice(slash + 1)),
    }
  }

  /**
   * Freeze an import on the final frame of its clips. Used for GLBs whose
   * animation ends in the pose we want on the ramp rather than the rest pose.
   * Runs before the bounds are measured so scale and ground contact use it.
   */
  private holdClipEndPose(groups: AnimationGroup[] | undefined) {
    for (const group of groups ?? []) {
      try {
        group.stop()
        group.start(false, 1, group.to, group.to, false)
        group.goToFrame(group.to)
        group.pause()
      } catch {
        // A clip with no keys leaves the rest pose alone.
      }
    }
  }

  private disposeImportedAnimations(groups: AnimationGroup[] | undefined) {
    for (const group of groups ?? []) {
      try {
        group.reset()
        group.stop()
        group.dispose()
      } catch {
        // Already disposed with a failed import.
      }
    }
  }

  private isVisualMesh(mesh: AbstractMesh): boolean {
    return (
      mesh.isEnabled() &&
      mesh.isVisible !== false &&
      typeof mesh.getTotalVertices === 'function' &&
      mesh.getTotalVertices() > 0
    )
  }

  /**
   * AABB of enabled meshes with geometry. Avoids Babylon's predicate (it is
   * also invoked on TransformNodes) and inverted empty boxes (MAX_VALUE).
   */
  private visualBounds(root: TransformNode): { min: Vector3; max: Vector3 } {
    root.computeWorldMatrix(true)
    const min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)
    const max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY)
    let found = false
    for (const mesh of root.getChildMeshes(false)) {
      if (!this.isVisualMesh(mesh)) continue
      mesh.computeWorldMatrix(true)
      if (mesh.skeleton) {
        mesh.refreshBoundingInfo(true, true)
      }
      const box = mesh.getBoundingInfo().boundingBox
      Vector3.CheckExtends(box.minimumWorld, min, max)
      Vector3.CheckExtends(box.maximumWorld, min, max)
      found = true
    }
    if (!found || !Number.isFinite(min.x) || min.x > max.x) {
      return root.getHierarchyBoundingVectors(true)
    }
    return { min, max }
  }

  /**
   * Hide stray helper triangles parked far from the silhouette (draft horse
   * tail-print mesh at y≈90). Vertex-weighted centroid so the body wins.
   */
  private cropDistantHelperMeshes(root: TransformNode) {
    const meshes = root.getChildMeshes(false).filter((mesh) => this.isVisualMesh(mesh))
    if (meshes.length < 2) return

    let cx = 0
    let cy = 0
    let cz = 0
    let weight = 0
    for (const mesh of meshes) {
      mesh.computeWorldMatrix(true)
      const center = mesh.getBoundingInfo().boundingBox.centerWorld
      const verts = Math.max(mesh.getTotalVertices(), 1)
      cx += center.x * verts
      cy += center.y * verts
      cz += center.z * verts
      weight += verts
    }
    if (weight < 1) return
    cx /= weight
    cy /= weight
    cz /= weight

    const distances = meshes
      .map((mesh) => {
        const center = mesh.getBoundingInfo().boundingBox.centerWorld
        return Math.hypot(center.x - cx, center.y - cy, center.z - cz)
      })
      .sort((a, b) => a - b)
    const cutoff = distantHelperCutoff(distances)

    for (const mesh of meshes) {
      const center = mesh.getBoundingInfo().boundingBox.centerWorld
      const dist = Math.hypot(center.x - cx, center.y - cy, center.z - cz)
      if (dist <= cutoff) continue
      mesh.setEnabled(false)
      mesh.isVisible = false
      mesh.isPickable = false
    }
  }

  /**
   * Hide needle AABBs left by sim "teleport to -8192" helpers. Do not infer
   * landing-gear contact or strip lights — that was collapsing whole aircraft.
   */
  private cropImportedModel(root: TransformNode, item: CatalogItem) {
    if (item.shape === 'person') return
    if (item.model && this.isAirBlastModel(item.model.path)) return

    this.cropDistantHelperMeshes(root)
    if (item.playClips) return

    for (const mesh of root.getChildMeshes(false)) {
      if (typeof mesh.getTotalVertices !== 'function' || mesh.getTotalVertices() === 0) continue
      mesh.computeWorldMatrix(true)
      const box = mesh.getBoundingInfo().boundingBox
      const size = box.maximumWorld.subtract(box.minimumWorld)
      const needle = isNeedleSize(size)
      // Zero-thickness cards (Death Star II equator planes) z-fight into noise at km scale.
      const paper = isPaperSize(size)
      if (needle || paper || isHelperLabel(mesh.name, mesh.parent?.name ?? '')) {
        mesh.setEnabled(false)
        mesh.isVisible = false
        mesh.isPickable = false
      }
    }
  }

  private normalizeToMeters(root: TransformNode, item: CatalogItem, axis: ScaleAxis) {
    try {
      this.cropImportedModel(root, item)
    } catch {
      // Crop is a safety net; never fail the load.
    }

    const { min, max } = this.visualBounds(root)
    const size = max.subtract(min)
    const authoringYaw = item.model?.randomYaw ? 0 : (item.model?.yawDegrees ?? 0)
    const current = this.axisSize(size, axis, authoringYaw)
    const target = this.targetSize(item, axis)

    if (Number.isFinite(current) && current > 1e-6) {
      const scale = target / current
      if (Number.isFinite(scale) && scale > 0) {
        root.scaling.scaleInPlace(scale)
      }
    }

    const bounds = this.visualBounds(root)
    if (!Number.isFinite(bounds.min.x) || bounds.min.x > bounds.max.x) return
    const centerX = (bounds.min.x + bounds.max.x) / 2
    const centerZ = (bounds.min.z + bounds.max.z) / 2
    root.position.x -= centerX
    root.position.z -= centerZ
    root.position.y -= bounds.min.y
  }

  private axisSize(size: Vector3, axis: ScaleAxis, yawDegrees: number): number {
    return axisSizeAfterAuthoringYaw(size, axis, yawDegrees)
  }

  private targetSize(item: CatalogItem, axis: ScaleAxis): number {
    switch (axis) {
      case 'length':
      case 'footprint':
        return item.length
      case 'width':
        return item.width
      case 'height':
        return item.height
      case 'max':
        return itemMagnitude(item)
    }
  }

  private buildStandInMesh(item: CatalogItem, instanceId: string): TransformNode {
    if (item.shape === 'cylinder') {
      const orientation = item.orientation ?? 'vertical'

      if (orientation === 'horizontal') {
        const mesh = MeshBuilder.CreateCylinder(
          `mesh-${instanceId}`,
          {
            height: item.length,
            diameter: item.width,
            tessellation: 28,
          },
          this.scene,
        )
        mesh.rotation.x = Math.PI / 2
        return mesh
      }

      return MeshBuilder.CreateCylinder(
        `mesh-${instanceId}`,
        {
          height: item.height,
          diameter: item.width,
          tessellation: 28,
        },
        this.scene,
      )
    }

    if (item.shape === 'person') {
      const group = new TransformNode(`mesh-${instanceId}`, this.scene)
      const torsoHeight = item.height * 0.55
      const headDiameter = item.width * 0.7
      const torso = MeshBuilder.CreateBox(
        `torso-${instanceId}`,
        { width: item.width, depth: item.length, height: torsoHeight },
        this.scene,
      )
      torso.position.y = torsoHeight / 2
      torso.parent = group

      const head = MeshBuilder.CreateSphere(
        `head-${instanceId}`,
        { diameter: headDiameter, segments: 12 },
        this.scene,
      )
      head.position.y = torsoHeight + headDiameter / 2
      head.parent = group
      return group
    }

    return MeshBuilder.CreateBox(
      `mesh-${instanceId}`,
      {
        width: item.width,
        depth: item.length,
        height: item.height,
      },
      this.scene,
    )
  }

  private applyMaterial(node: TransformNode, material: StandardMaterial) {
    if (node instanceof AbstractMesh) node.material = material
    for (const child of node.getChildMeshes(false)) {
      child.material = material
    }
  }

  private relayoutPlaque(placement: PlacedObject) {
    const base = CATALOG_BY_ID[placement.itemId]
    if (!base) return
    if (this.captureMode) {
      placement.labelTex = null
      return
    }
    const item = resolveDetonationItem(base, this.detonationMode)

    for (const child of [...placement.root.getChildren()]) {
      if (child.name.startsWith('label-')) {
        child.dispose(false, true)
      }
    }
    placement.labelTex = this.attachPlaque(
      placement.root,
      placement.body,
      item,
      placement.instanceId,
    )
  }

  /**
   * Widest a plaque can be without touching its neighbours': the smaller of the
   * centre-to-centre distances to the items either side, minus a hair so two
   * equally clamped plaques still show daylight between them. Unbounded for a
   * lone item, and never below a floor that would make the text unreadable.
   */
  private plaqueLaneWidth(itemId: string): number {
    const index = this.sortedItems.findIndex((entry) => entry.id === itemId)
    if (index < 0) return Number.POSITIVE_INFINITY

    const x = this.itemXs.get(itemId)
    if (x == null) return Number.POSITIVE_INFINITY

    let lane = Number.POSITIVE_INFINITY
    for (const neighbor of [this.sortedItems[index - 1], this.sortedItems[index + 1]]) {
      if (!neighbor) continue
      const neighborX = this.itemXs.get(neighbor.id)
      if (neighborX == null) continue
      lane = Math.min(lane, Math.abs(neighborX - x))
    }
    if (!Number.isFinite(lane)) return Number.POSITIVE_INFINITY
    return Math.max(lane * PLAQUE_LANE_MARGIN, PLAQUE_MIN_WIDTH_M)
  }

  private attachPlaque(
    root: TransformNode,
    body: TransformNode,
    item: CatalogItem,
    instanceId: string,
  ): DynamicTexture {
    root.computeWorldMatrix(true)
    body.computeWorldMatrix(true)
    for (const child of body.getChildMeshes()) child.computeWorldMatrix(true)

    // Bounds come back in world space; plaque is parented to root (often already
    // translated along the lineup), so convert to root-local before placing.
    const { min, max } = this.visualBounds(body)
    const inv = Matrix.Invert(root.getWorldMatrix())
    const corners = [
      new Vector3(min.x, min.y, min.z),
      new Vector3(max.x, min.y, min.z),
      new Vector3(min.x, max.y, min.z),
      new Vector3(max.x, max.y, min.z),
      new Vector3(min.x, min.y, max.z),
      new Vector3(max.x, min.y, max.z),
      new Vector3(min.x, max.y, max.z),
      new Vector3(max.x, max.y, max.z),
    ].map((corner) => Vector3.TransformCoordinates(corner, inv))

    let localMin = corners[0].clone()
    let localMax = corners[0].clone()
    for (let i = 1; i < corners.length; i++) {
      localMin = Vector3.Minimize(localMin, corners[i])
      localMax = Vector3.Maximize(localMax, corners[i])
    }

    const footprintW = Math.max(localMax.x - localMin.x, localMax.z - localMin.z, 0.4)
    const magnitude = itemMagnitude(item)
    // The 1.4 m floor is what a plaque wants; the lane is what the lineup can
    // spare. Without the clamp, human-scale items packed 0.5 m apart each claim
    // 1.4 m and their plaques run into each other.
    const labelW = Math.min(
      Math.max(footprintW * 0.55, magnitude * 0.12, 1.4),
      this.plaqueLaneWidth(item.id),
    )
    const texW = labelW > 20 ? 2048 : 1024
    // Facts add rows, so the plaque deepens to exactly fit them; texture matches.
    const aspect = plaqueAspect(item, texW, this.units)
    const labelD = labelW * aspect
    const gap = Math.max(labelD * 0.2, footprintW * 0.06, magnitude * 0.02)
    const z = localMin.z - gap - labelD * 0.5

    const label = MeshBuilder.CreateGround(
      `label-${instanceId}`,
      { width: labelW, height: labelD },
      this.scene,
    )
    label.parent = root
    label.position.set(
      (localMin.x + localMax.x) * 0.5,
      Math.max(0.05, magnitude * 0.002),
      z,
    )
    label.isPickable = false

    const texH = Math.round(texW * aspect)
    const tex = new DynamicTexture(
      `label-tex-${instanceId}`,
      { width: texW, height: texH },
      this.scene,
      true,
    )
    tex.hasAlpha = false
    this.paintPlaqueTexture(tex, item)

    const mat = new StandardMaterial(`label-mat-${instanceId}`, this.scene)
    mat.diffuseTexture = tex
    mat.emissiveTexture = tex
    mat.specularColor = Color3.Black()
    mat.emissiveColor = new Color3(0.55, 0.55, 0.55)
    mat.backFaceCulling = false
    mat.transparencyMode = StandardMaterial.MATERIAL_OPAQUE
    mat.disableDepthWrite = false
    mat.zOffset = -2
    label.material = mat

    label.onDisposeObservable.add(() => {
      tex.dispose()
      mat.dispose()
    })

    return tex
  }

  private paintPlaqueTexture(tex: DynamicTexture, item: CatalogItem) {
    const size = tex.getSize()
    const texW = size.width
    const texH = size.height
    const ctx = tex.getContext() as CanvasRenderingContext2D
    ctx.fillStyle = '#14181c'
    ctx.fillRect(0, 0, texW, texH)

    // Sizes track texture width so a deeper facts plaque keeps the same type scale.
    const m = plaqueMetrics(texW)
    const lines = plaqueFactLines(item, texW, this.units)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (lines.length === 0) {
      const dims = this.labelDimensions(item)
      ctx.fillStyle = '#f7f4ef'
      ctx.font = `600 ${fitFontSize(ctx, item.name, m.factsWidth, m.titleSize, '600')}px "IBM Plex Sans", sans-serif`
      ctx.fillText(item.name, texW / 2, texH * 0.4)

      ctx.fillStyle = '#b8c0c6'
      ctx.font = `${fitFontSize(ctx, dims, m.factsWidth, m.dimsSize)}px "IBM Plex Sans", sans-serif`
      ctx.fillText(dims, texW / 2, texH * 0.7)
      tex.update()
      return
    }

    // Same running total as plaqueAspect, so the box ends flush with the text.
    let y = m.padY

    // Rows keep their nominal height so the running total still matches
    // `plaqueAspect`; only the glyphs shrink to fit the plaque width.
    const dims = this.labelDimensions(item)
    ctx.fillStyle = '#f7f4ef'
    ctx.font = `600 ${fitFontSize(ctx, item.name, m.factsWidth, m.titleSize, '600')}px "IBM Plex Sans", sans-serif`
    ctx.fillText(item.name, texW / 2, y + m.titleSize / 2)
    y += m.titleSize + m.gapTitle

    ctx.fillStyle = '#b8c0c6'
    ctx.font = `${fitFontSize(ctx, dims, m.factsWidth, m.dimsSize)}px "IBM Plex Sans", sans-serif`
    ctx.fillText(dims, texW / 2, y + m.dimsSize / 2)
    y += m.dimsSize + m.gapFacts

    ctx.fillStyle = '#98a2aa'
    ctx.font = `${m.factsSize}px "IBM Plex Sans", sans-serif`
    for (const line of lines) {
      ctx.fillText(line, texW / 2, y + m.lineHeight / 2)
      y += m.lineHeight
    }
    tex.update()
  }

  private refreshAllPlaques() {
    for (const placement of this.placements.values()) {
      const base = CATALOG_BY_ID[placement.itemId]
      if (!base || !placement.labelTex) continue
      const item = resolveDetonationItem(base, this.detonationMode)
      this.paintPlaqueTexture(placement.labelTex, item)
    }
  }

  private labelDimensions(item: CatalogItem): string {
    if (hasBlastEffect(item.id) && this.detonationMode !== 'casing') {
      const radius = blastRadiusM(item.id, this.detonationMode)
      if (radius != null) {
        const modeLabel = this.detonationMode === 'ground' ? 'ground' : 'air'
        return `${modeLabel} blast r ${formatLength(radius, this.units)}`
      }
    }

    if (item.shape === 'cylinder' && item.orientation === 'horizontal') {
      return `${formatLength(item.length, this.units)} long · Ø ${formatLength(item.width, this.units)}`
    }

    if (item.model?.scaleAxis === 'length' || item.model?.scaleAxis === 'width') {
      return `${formatLength(item.length, this.units)} long`
    }

    return `${formatLength(item.height, this.units)} tall`
  }

  private clearHover() {
    const hadHover = this.hoverRoot != null
    this.hoverItemId = null
    if (this.hoverRoot) {
      this.hoverRoot.dispose(false, true)
      this.hoverRoot = null
    }
    if (hadHover) this.markDirty()
  }

  private showHover(itemId: string) {
    this.scene.blockMaterialDirtyMechanism = false
    try {
      this.buildHover(itemId)
    } finally {
      this.scene.blockMaterialDirtyMechanism = true
    }
  }

  private buildHover(itemId: string) {
    const placement = [...this.placements.values()].find((p) => p.itemId === itemId)
    const base = CATALOG_BY_ID[itemId]
    if (!placement || !base) return
    const item = resolveDetonationItem(base, this.detonationMode)

    const body = placement.body
    body.computeWorldMatrix(true)
    for (const child of body.getChildMeshes()) child.computeWorldMatrix(true)
    const { min, max } = this.visualBounds(body)
    const size = max.subtract(min)
    const center = min.add(max).scale(0.5)
    const magnitude = itemMagnitude(item)
    const pad = Math.max(magnitude * 0.01, 0.05)
    // Keep the cage floor above the earth slab so bottom edges stay visible.
    const groundClearance = Math.max(magnitude * 0.012, 0.06)
    const boxWidth = size.x + pad * 2
    const boxDepth = size.z + pad * 2
    const boxTop = max.y + pad
    const boxBottom = Math.max(min.y - pad, groundClearance)
    const boxHeight = Math.max(boxTop - boxBottom, pad)
    const boxCenter = new Vector3(center.x, (boxTop + boxBottom) / 2, center.z)

    const root = new TransformNode(`hover-${itemId}`, this.scene)
    this.hoverRoot = root
    this.hoverItemId = itemId

    // The cage is real geometry, not edges rendering. Babylon's line shader has
    // no vertex-side logarithmic depth, and the whole scene draws with log depth
    // on, so an edges-rendered cage lands at the wrong depth and either sinks
    // under the ground or has to be overlaid on top of everything. Thin boxes on
    // a StandardMaterial share the models' depth path and occlude correctly.
    const edgeMat = new StandardMaterial(`hover-edge-mat-${itemId}`, this.scene)
    edgeMat.diffuseColor = Color3.Black()
    edgeMat.specularColor = Color3.Black()
    edgeMat.emissiveColor = new Color3(0.12, 0.85, 0.72)
    edgeMat.disableLighting = true
    edgeMat.useLogarithmicDepth = true

    const span = Math.max(boxWidth, boxHeight, boxDepth)
    const thickness = Math.max(span * 0.004, magnitude * 0.002)
    const x0 = boxCenter.x - boxWidth / 2
    const x1 = boxCenter.x + boxWidth / 2
    const y0 = boxBottom
    const y1 = boxTop
    const z0 = boxCenter.z - boxDepth / 2
    const z1 = boxCenter.z + boxDepth / 2

    for (const y of [y0, y1]) {
      for (const z of [z0, z1]) {
        this.addHoverEdge(
          root,
          edgeMat,
          new Vector3(boxCenter.x, y, z),
          new Vector3(boxWidth + thickness, thickness, thickness),
        )
      }
    }
    for (const x of [x0, x1]) {
      for (const z of [z0, z1]) {
        this.addHoverEdge(
          root,
          edgeMat,
          new Vector3(x, (y0 + y1) / 2, z),
          new Vector3(thickness, boxHeight, thickness),
        )
      }
    }
    for (const x of [x0, x1]) {
      for (const y of [y0, y1]) {
        this.addHoverEdge(
          root,
          edgeMat,
          new Vector3(x, y, boxCenter.z),
          new Vector3(thickness, thickness, boxDepth + thickness),
        )
      }
    }
    root.onDisposeObservable.add(() => edgeMat.dispose())

    const labelScale = Math.max(magnitude * 0.055, 0.55)
    const midY = boxCenter.y
    const topY = boxTop
    const frontZ = min.z - pad
    const rightX = max.x + pad

    this.addHoverDimLabel(
      root,
      `${formatLength(item.width, this.units)} wide`,
      new Vector3(center.x, topY + labelScale * 0.35, frontZ),
      labelScale * 2.4,
      labelScale * 0.7,
    )
    this.addHoverDimLabel(
      root,
      `${formatLength(item.height, this.units)} tall`,
      new Vector3(rightX + labelScale * 0.15, midY, center.z),
      labelScale * 2.4,
      labelScale * 0.7,
    )
    this.addHoverDimLabel(
      root,
      `${formatLength(item.length, this.units)} long`,
      new Vector3(center.x, Math.max(boxBottom, groundClearance) + labelScale * 0.4, max.z + pad + labelScale * 0.2),
      labelScale * 2.4,
      labelScale * 0.7,
    )
    this.markDirty()
  }

  /** One bar of the hover cage. Same depth pass as the models so it occludes. */
  private addHoverEdge(
    parent: TransformNode,
    material: StandardMaterial,
    position: Vector3,
    size: Vector3,
  ) {
    const bar = MeshBuilder.CreateBox(
      'hover-edge',
      { width: size.x, height: size.y, depth: size.z },
      this.scene,
    )
    bar.parent = parent
    bar.position.copyFrom(position)
    bar.isPickable = false
    bar.renderingGroupId = 0
    bar.material = material
  }

  private addHoverDimLabel(
    parent: TransformNode,
    text: string,
    position: Vector3,
    width: number,
    height: number,
  ) {
    const plane = MeshBuilder.CreatePlane(
      `hover-label-${text}`,
      { width, height },
      this.scene,
    )
    plane.parent = parent
    plane.position.copyFrom(position)
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL
    plane.isPickable = false
    // Same group for all labels; real depth decides near-over-far.
    plane.renderingGroupId = 2

    const texW = 512
    const texH = 160
    const tex = new DynamicTexture(`hover-label-tex-${text}`, { width: texW, height: texH }, this.scene, true)
    tex.hasAlpha = false
    const ctx = tex.getContext() as CanvasRenderingContext2D
    ctx.fillStyle = '#0a1012'
    ctx.fillRect(0, 0, texW, texH)

    ctx.fillStyle = '#f4fffc'
    ctx.font = '700 56px "IBM Plex Sans", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, texW / 2, texH / 2)
    tex.update()

    const mat = new StandardMaterial(`hover-label-mat-${text}`, this.scene)
    mat.diffuseTexture = tex
    mat.emissiveTexture = tex
    mat.specularColor = Color3.Black()
    mat.emissiveColor = Color3.White()
    mat.backFaceCulling = false
    mat.transparencyMode = StandardMaterial.MATERIAL_OPAQUE
    mat.disableDepthWrite = false
    mat.useLogarithmicDepth = true
    // Bias toward camera so labels win over coplanar edge lines.
    mat.zOffset = -2
    plane.material = mat

    plane.onDisposeObservable.add(() => {
      tex.dispose()
      mat.dispose()
    })
  }
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function dataUrlToBlob(dataUrl: string, fallbackType = 'image/jpeg'): Blob {
  const comma = dataUrl.indexOf(',')
  const header = comma >= 0 ? dataUrl.slice(0, comma) : ''
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? fallbackType
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}
