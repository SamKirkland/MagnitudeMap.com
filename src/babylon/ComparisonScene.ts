import {
  AbstractMesh,
  Animation,
  AnimationGroup,
  ArcRotateCamera,
  BoundingInfo,
  Camera,
  Color3,
  Color4,
  Constants,
  CubeTexture,
  CubicEase,
  DirectionalLight,
  DynamicTexture,
  EasingFunction,
  Engine,
  HemisphericLight,
  type Material,
  Matrix,
  Mesh,
  MeshBuilder,
  MultiMaterial,
  type Node,
  PBRMaterial,
  PointerEventTypes,
  type PointerInfo,
  Quaternion,
  RawTexture,
  Scene,
  SceneLoader,
  ShadowGenerator,
  Skeleton,
  StandardMaterial,
  SubMesh,
  Texture,
  TransformNode,
  Vector3,
  VertexBuffer,
} from '@babylonjs/core'
import { CreateScreenshotUsingRenderTargetAsync } from '@babylonjs/core/Misc/screenshotTools'
import '@babylonjs/loaders/glTF'
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
import {
  itemMagnitude,
  layoutRevealPositions,
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
  tourSettingsEqual,
  type TourSettings,
} from '../tourSettings'
import {
  axisSizeAfterAuthoringYaw,
  displayYawRadians,
  itemExtentAlongX,
  itemExtentAlongZ,
  normalizeYawTurns,
} from '../modelOrientation'
import {
  createDirtSideTexture,
  createNeighborhoodTexture,
  createUndersideCutawayTexture,
  NEIGHBORHOOD_TILE_METERS,
} from './neighborhoodTexture'
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, publicAssetUrl } from '../site'

export type ComparisonSceneOptions = {
  /** OG capture: perspective screenshot, no plaques or camera controls. */
  capture?: boolean
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
  waveTimer: number | null
  waveArm: TransformNode | null
  waving: boolean
  waveGen: number
  clipPlaying: boolean
}

export type TourUiState = {
  sortedItemIds: string[]
  stepIndex: number
  playing: boolean
  focusItemId: string | null
  mode: 'overview' | 'tour' | 'focus'
}

type TourListener = (state: TourUiState) => void

const TOUR_HOLD_MS = 2200
const CAMERA_ANIM_FRAMES = 75
const CAMERA_FOCUS_FRAMES = 96
const CAMERA_ANIM_FPS = 60
/** Cap backing-store DPR so retina + MSAA does not 4x fill rate. */
const MAX_DEVICE_PIXEL_RATIO = 1.5
/** After the camera/scene stop changing, pause clips and skip GPU submits. */
const IDLE_SETTLE_MS = 300
/**
 * Orbit radius where pan/zoom speeds are 1×. Matches the default camera radius so
 * human-scale navigation stays the same; larger views scale pan and zoom with it.
 */
const CAMERA_NAV_REFERENCE_RADIUS = 40
/**
 * Directional sun + contact shadows. Off restores the original unlit comparison
 * look (no shadow maps, no extra lights). Flip true to ship lighting later.
 */
const ENABLE_SCENE_LIGHTING = false

export class ComparisonScene {
  readonly engine: Engine
  readonly scene: Scene
  readonly camera: ArcRotateCamera

  private readonly placements = new Map<string, PlacedObject>()
  private ground: Mesh
  private sun!: DirectionalLight
  private shadows: ShadowGenerator | null = null
  private neighborhoodTex: DynamicTexture | null = null
  private dirtSideTex: DynamicTexture | null = null
  private undersideTex: DynamicTexture | null = null
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
  private pointerDownPos: { x: number; y: number } | null = null
  private units: UnitSystem = 'metric'
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
  private personWaveCount = 0
  private clipPlayingCount = 0
  private cameraMoveGen = 0
  private rendersThisSecond = 0
  private skippedThisSecond = 0
  private perfSecondStarted = 0
  private tourSettings: TourSettings = { ...DEFAULT_TOUR_SETTINGS }
  /** User-facing yaw for every model, in 90° turns (0–3). */
  private displayYawTurns = 0
  private readonly captureMode: boolean

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
    })
    this.applyResolutionCap()

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
    this.camera.wheelPrecision = 8
    this.camera.panningSensibility = 40
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
      canvas.addEventListener('pointerdown', this.onCanvasPointerDown)
      canvas.addEventListener('pointermove', this.onCanvasPointerMove)
      canvas.addEventListener('wheel', this.onCanvasWheel, { passive: true })
    }

    this.installLights()

    this.createGradientSkybox()

    this.neighborhoodTex = createNeighborhoodTexture(this.scene)
    this.dirtSideTex = createDirtSideTexture(this.scene)
    this.undersideTex = createUndersideCutawayTexture(this.scene)

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
    if (this.sortedItems.length === 0) return
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
    if (this.sortedItems.length === 0) return
    this.playing = false
    this.clearTourTimer()
    this.focusItemId = null
    this.mode = 'tour'
    const next = Math.min(this.stepIndex + 1, this.sortedItems.length - 1)
    this.goToStep(next, true)
    this.emitTour()
  }

  prevStep() {
    if (this.sortedItems.length === 0) return
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
    const pose = poseForTourStep(visible, xs, this.tourAngles(), this.displayYawTurns)
    const itemId = this.sortedItems[this.stepIndex]?.id
    this.playFocusMotion(itemId)
    this.applyPose(pose, animate, CAMERA_ANIM_FRAMES, () => this.waveIfPerson(itemId))
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
    if (layoutChanged) this.relayoutLineup()
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
    this.applyPose(pose, animate, CAMERA_FOCUS_FRAMES, () => this.waveIfPerson(itemId))
    this.playFocusMotion(itemId)
    this.emitTour()
  }

  resetFocus(animate = true) {
    this.showOverview(animate)
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
    const loaded = await Promise.all(
      toLoad.map(async (item) => {
        if (this.disposed || generation !== this.loadGeneration) return null
        const placement = await this.createPlacement(item, {
          x: xs.get(item.id) ?? 0,
          hidden: true,
        })
        if (this.disposed || generation !== this.loadGeneration) {
          this.disposePlacement(placement)
          return null
        }
        return placement
      }),
    )

    if (this.disposed || generation !== this.loadGeneration) return

    // Swap only after the new set is ready — avoids empty flashes + origin piles.
    for (const [, placement] of toRemove) {
      this.removePlacement(placement.instanceId)
      existingByItem.delete(placement.itemId)
    }

    for (const placement of loaded) {
      if (!placement) continue
      this.placements.set(placement.instanceId, placement)
      existingByItem.set(placement.itemId, placement)
      placement.root.setEnabled(true)
    }

    // Re-seat plaques in root-local space (fixes offsets from lineup moves /
    // older world-space placement bugs).
    for (const placement of this.placements.values()) {
      this.relayoutPlaque(placement)
    }

    this.resizeGroundToContent()
    this.freezeStaticScene()
    this.stepIndex = Math.max(0, this.sortedItems.length - 1)

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
      return dataUrlToJpegBlob(dataUrl)
    } finally {
      this.scene.renderTargetsEnabled = prevRt
      this.markDirty()
    }
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
    let minX = Infinity
    let maxX = -Infinity
    let maxH = 0
    let maxZ = 0
    for (const item of this.sortedItems) {
      const x = this.itemXs.get(item.id) ?? 0
      const halfX = itemExtentAlongX(item, yaw) / 2
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
    this.clearHover()
    this.clearTourTimer()
    this.listeners.clear()
    this.clearIdleSettle()
    window.removeEventListener('resize', this.onResize)
    document.removeEventListener('visibilitychange', this.onVisibility)
    const canvas = this.engine.getRenderingCanvas()
    canvas?.removeEventListener('pointerdown', this.onCanvasPointerDown)
    canvas?.removeEventListener('pointermove', this.onCanvasPointerMove)
    canvas?.removeEventListener('wheel', this.onCanvasWheel)
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
    }
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

  private placementForItem(itemId: string) {
    for (const placement of this.placements.values()) {
      if (placement.itemId === itemId) return placement
    }
    return undefined
  }

  private reframeAfterSettingsChange(layoutChanged: boolean) {
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

  private applyPose(
    pose: CameraPose,
    animate: boolean,
    frames = CAMERA_ANIM_FRAMES,
    onComplete?: () => void,
  ) {
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
    if (this.placements.size === 0) {
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

    const spanX = Math.max(maxX - minX, 1)
    const spanZ = Math.max(maxZ - minZ, 1)
    const pad = Math.max(spanX * 0.35, spanZ * 0.35, maxMag * 0.45, 28)

    const width = spanX + pad * 2
    const depth = spanZ + pad * 2
    const centerX = (minX + maxX) / 2
    const centerZ = (minZ + maxZ) / 2

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
   * Minecraft-style dirt slab: neighborhood on top, dirt sides, ghost-dirt
   * underside with a thin cutaway rim (see-through, but clearly intentional).
   */
  private buildEarthSlab(centerX: number, centerZ: number, width: number, depth: number): Mesh {
    const span = Math.max(width, depth)
    const thickness = Math.max(8, Math.min(span * 0.0025, Math.sqrt(span) * 0.8))

    const slab = MeshBuilder.CreateBox(
      'ground',
      { width, depth, height: thickness, wrap: true },
      this.scene,
    )
    slab.position.set(centerX, -thickness / 2, centerZ)
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

    if (this.neighborhoodTex && span < 8_000) {
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
      sideMat.ambientColor = new Color3(0.34, 0.28, 0.2)
    } else {
      sideMat.disableLighting = true
      sideMat.emissiveColor = Color3.White()
    }
    if (this.dirtSideTex) {
      const sideTex = this.dirtSideTex
      // Tile dirt horizontally with world size; V stays 0–1 so grass rim stays on top.
      sideTex.uScale = Math.min(Math.max(width, depth) / 16, 48)
      sideTex.vScale = 1
      sideMat.diffuseTexture = sideTex
      if (!ENABLE_SCENE_LIGHTING) sideMat.emissiveTexture = sideTex
    } else if (ENABLE_SCENE_LIGHTING) {
      sideMat.diffuseColor = new Color3(0.42, 0.28, 0.16)
    } else {
      sideMat.emissiveColor = new Color3(0.42, 0.28, 0.16)
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
    if (this.undersideTex) {
      bottomMat.diffuseTexture = this.undersideTex
      bottomMat.emissiveTexture = this.undersideTex
      bottomMat.opacityTexture = this.undersideTex
    } else {
      bottomMat.alpha = 0.22
      bottomMat.emissiveColor = new Color3(0.42, 0.28, 0.16)
    }

    // CreateBox face order: front, back, right, left, top, bottom
    const multi = new MultiMaterial('groundMulti', this.scene)
    multi.subMaterials = [sideMat, sideMat, sideMat, sideMat, topMat, bottomMat]
    slab.material = multi

    const vertCount = slab.getTotalVertices()
    slab.subMeshes = []
    for (let i = 0; i < 6; i++) {
      slab.subMeshes.push(new SubMesh(i, 0, vertCount, i * 6, 6, slab))
    }

    slab.computeWorldMatrix(true)
    slab.doNotSyncBoundingInfo = true
    slab.freezeWorldMatrix()
    this.freezeMaterialTree(multi)

    return slab
  }

  private onCanvasPointerDown = (event: PointerEvent) => {
    if (event.button === 1) event.preventDefault()
    this.markDirty()
  }

  private onCanvasPointerMove = (event: PointerEvent) => {
    if (event.buttons) this.markDirty()
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
      this.personWaveCount > 0 ||
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
    this.applyResolutionCap()
    this.engine.resize()
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
    const maxZ = Math.max(r * 20, 200)
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
    if (this.isAnimatedPlacement(placement)) return
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
    if (ENABLE_SCENE_LIGHTING) this.syncShadowCasters()
    for (const placement of this.placements.values()) {
      this.freezeStaticPlacement(placement)
    }
    if (ENABLE_SCENE_LIGHTING) this.fitSunShadows()
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
    shadows.darkness = 0.22
    return shadows
  }

  private syncShadowCasters() {
    if (!this.shadows) return
    const map = this.shadows.getShadowMap()
    if (map?.renderList) map.renderList.length = 0

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
    // hulls and the ground from z-fighting. Must be on every depth-tested mat.
    if (!material.useLogarithmicDepth) material.useLogarithmicDepth = true
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
    if (placement.waving) {
      placement.waving = false
      placement.waveGen += 1
      this.personWaveCount = Math.max(0, this.personWaveCount - 1)
    }
    if (placement.clipPlaying) {
      placement.clipPlaying = false
      this.clipPlayingCount = Math.max(0, this.clipPlayingCount - 1)
    }
    this.clearWaveTimer(placement)
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

  private clearWaveTimer(placement: PlacedObject) {
    if (placement.waveTimer != null) {
      window.clearTimeout(placement.waveTimer)
      placement.waveTimer = null
    }
  }

  private async createPlacement(
    item: CatalogItem,
    opts: { x?: number; hidden?: boolean } = {},
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
        const loaded = await this.loadScaledModel(item, instanceId)
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
      waveTimer: null,
      waveArm: null,
      waving: false,
      waveGen: 0,
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
  ): Promise<{
    container: TransformNode
    animationGroups: AnimationGroup[]
    skeletons: Skeleton[]
  }> {
    const model = item.model!
    const { rootUrl, filename } = this.resolveModelUrl(model.path)

    const result = await SceneLoader.ImportMeshAsync('', rootUrl, filename, this.scene)
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
    if (!keepClips) {
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
      animationGroups: keepClips ? (result.animationGroups ?? []) : [],
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

  /** Rest pose only — waves run once on click-focus or that person's tour step. */
  private preparePersonRestPose(placement: PlacedObject, skeletons: Skeleton[]) {
    const ambient =
      placement.animationGroups.find((group) => /idle(?!\.001)/i.test(group.name)) ??
      placement.animationGroups.find((group) => /idle/i.test(group.name))
    const arm = this.findWaveArm(placement.body, skeletons)
    placement.waveArm = arm
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

  private waveIfPerson(itemId: string | undefined) {
    if (!itemId) return
    const placement = [...this.placements.values()].find((p) => p.itemId === itemId)
    if (!placement) return
    this.triggerPersonWave(placement)
  }

  private triggerPersonWave(placement: PlacedObject) {
    const item = CATALOG_BY_ID[placement.itemId]
    const arm = placement.waveArm
    if (item?.shape !== 'person' || !arm || arm.isDisposed() || placement.root.isDisposed()) {
      return
    }

    this.heldIdle = false
    this.scene.stopAnimation(arm)
    placement.waveGen += 1
    const gen = placement.waveGen
    if (!placement.waving) {
      placement.waving = true
      this.personWaveCount += 1
    }
    for (const group of placement.animationGroups) {
      try {
        group.stop()
      } catch {
        // ignore
      }
    }
    this.playProceduralWave(arm, () => {
      if (this.disposed || placement.waveGen !== gen) return
      placement.waving = false
      this.personWaveCount = Math.max(0, this.personWaveCount - 1)
      this.armIdleSettle()
    })
    this.markDirty()
  }

  private relaxTPoseArms(skeletons: Skeleton[]) {
    const left = this.findArmNode(skeletons, 'left')
    const right = this.findArmNode(skeletons, 'right')
    // Drop from horizontal T-pose toward the hips (local Z on Mixamo-style arms).
    if (left) this.nudgeEuler(left, new Vector3(0, 0, Math.PI * 0.42))
    if (right) this.nudgeEuler(right, new Vector3(0, 0, -Math.PI * 0.42))
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

  private findWaveArm(
    root: TransformNode,
    skeletons: Skeleton[],
  ): TransformNode | null {
    return (
      this.findArmNode(skeletons, 'right') ??
      this.findArmNodeFromHierarchy(root, 'right') ??
      this.findArmNodeByPose(skeletons, 'right')
    )
  }

  /** When bones are unnamed (e.g. Perfect Steve), pick the lateral upper limb. */
  private findArmNodeByPose(
    skeletons: Skeleton[],
    side: 'left' | 'right',
  ): TransformNode | null {
    type Candidate = { node: TransformNode; x: number; y: number }
    const candidates: Candidate[] = []

    for (const skeleton of skeletons) {
      for (const bone of skeleton.bones) {
        const name = bone.name ?? ''
        if (/root|end/i.test(name)) continue
        const node = bone.getTransformNode()
        if (!node) continue
        // Prefer bones that have a child (upper arm → forearm).
        if (bone.children.length === 0) continue
        node.computeWorldMatrix(true)
        const pos = node.getAbsolutePosition()
        candidates.push({ node, x: pos.x, y: pos.y })
      }
    }

    if (candidates.length === 0) return null

    const ys = candidates.map((c) => c.y).sort((a, b) => a - b)
    const midY = ys[Math.floor(ys.length / 2)] ?? 0
    // Arms sit around mid/upper height — drop feet and very top (head).
    const mid = candidates.filter((c) => c.y >= midY * 0.55 && c.y <= midY * 1.55)
    const pool = mid.length ? mid : candidates
    pool.sort((a, b) => (side === 'right' ? b.x - a.x : a.x - b.x))
    return pool[0]?.node ?? null
  }

  private findArmNodeFromHierarchy(
    root: TransformNode,
    side: 'left' | 'right',
  ): TransformNode | null {
    const prefer =
      side === 'right'
        ? [/^RightArm(_|$)/i, /^Right_Arm(_|$)/i, /^right_arm$/i, /RightArm/i]
        : [/^LeftArm(_|$)/i, /^Left_Arm(_|$)/i, /^left_arm$/i, /LeftArm/i]
    const reject = /thumb|index|middle|ring|pinky|hand|fore|lower|end|shoulder/i
    const candidates = root.getChildTransformNodes(true)
    for (const pattern of prefer) {
      const hit = candidates.find((node) => pattern.test(node.name) && !reject.test(node.name))
      if (hit) return hit
    }
    return null
  }

  private playProceduralWave(arm: TransformNode, onDone: () => void) {
    // glTF nodes often use quaternions — switch to Euler for a short procedural clip.
    if (arm.rotationQuaternion) {
      arm.rotation = arm.rotationQuaternion.toEulerAngles()
      arm.rotationQuaternion = null
    }

    const rest = arm.rotation.clone()
    // Lift the already-relaxed arm and wiggle.
    const lift = rest.add(new Vector3(0.2, 0, -0.95))
    const wigA = lift.add(new Vector3(0.55, 0, 0))
    const wigB = lift.add(new Vector3(-0.45, 0, 0))

    const anim = new Animation(
      `wave-${arm.uniqueId}`,
      'rotation',
      30,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
    )
    anim.setKeys([
      { frame: 0, value: rest },
      { frame: 10, value: lift },
      { frame: 18, value: wigA },
      { frame: 26, value: wigB },
      { frame: 34, value: wigA },
      { frame: 42, value: wigB },
      { frame: 50, value: lift },
      { frame: 62, value: rest },
    ])

    arm.animations = [anim]
    this.scene.beginAnimation(arm, 0, 62, false, 1, () => {
      arm.rotation.copyFrom(rest)
      arm.animations = []
      onDone()
    })
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
    const typical = Math.max(distances[Math.floor(distances.length / 2)] ?? 1, 0.25)
    const cutoff = typical * 12 + 4

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

    const helperName = /gbu_helper|\bhelper\b|collision|gizmo|^dummy|^empty/i
    for (const mesh of root.getChildMeshes(false)) {
      if (typeof mesh.getTotalVertices !== 'function' || mesh.getTotalVertices() === 0) continue
      mesh.computeWorldMatrix(true)
      const box = mesh.getBoundingInfo().boundingBox
      const size = box.maximumWorld.subtract(box.minimumWorld)
      const dims = [size.x, size.y, size.z].sort((a, b) => a - b)
      const span = dims[2]
      const needle = span > 50 && span > 25 * Math.max(dims[1], 1e-8)
      // Zero-thickness cards (Death Star II equator planes) z-fight into noise at km scale.
      const paper = span > 1 && dims[0] < Math.max(span * 1e-5, 1e-4)
      const label = `${mesh.name} ${mesh.parent?.name ?? ''}`
      if (needle || paper || helperName.test(label)) {
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
    const labelW = Math.max(footprintW * 0.55, magnitude * 0.12, 1.4)
    const labelD = labelW * 0.42
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

    const texW = labelW > 20 ? 1024 : 512
    const texH = labelW > 20 ? 512 : 256
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

    const titleSize = Math.round(texH * 0.17)
    const dimsSize = Math.round(texH * 0.11)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#f7f4ef'
    ctx.font = `600 ${titleSize}px "IBM Plex Sans", sans-serif`
    ctx.fillText(item.name, texW / 2, texH * 0.4)

    ctx.fillStyle = '#b8c0c6'
    ctx.font = `${dimsSize}px "IBM Plex Sans", sans-serif`
    ctx.fillText(this.labelDimensions(item), texW / 2, texH * 0.7)
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

    const box = MeshBuilder.CreateBox(
      `hover-box-${itemId}`,
      {
        width: boxWidth,
        height: boxHeight,
        depth: boxDepth,
      },
      this.scene,
    )
    box.parent = root
    box.position.copyFrom(boxCenter)
    box.isPickable = false
    // Same depth pass as models so the cage occludes / is occluded in physical space.
    // (Group 1+ auto-clears depth, which made edges always paint over the mesh.)
    box.renderingGroupId = 0

    const boxMat = new StandardMaterial(`hover-box-mat-${itemId}`, this.scene)
    boxMat.diffuseColor = new Color3(0.12, 0.78, 0.68)
    boxMat.specularColor = Color3.Black()
    boxMat.alpha = 0
    boxMat.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND
    boxMat.disableDepthWrite = true
    boxMat.useLogarithmicDepth = true
    box.material = boxMat
    box.enableEdgesRendering(0.999)
    box.edgesWidth = Math.min(Math.max(magnitude * 0.12, 3), 14)
    box.edgesColor = new Color4(0.12, 0.85, 0.72, 1)

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

function dataUrlToJpegBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',')
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: 'image/jpeg' })
}
