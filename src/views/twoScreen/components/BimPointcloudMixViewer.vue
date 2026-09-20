<template>
  <div class="mix-view-panel">
    <div v-if="showPlaceholder" class="empty-placeholder">
      <div class="placeholder-content">
        <el-icon class="placeholder-icon"><View /></el-icon>
        <p class="placeholder-text">{{ placeholderText }}</p>
      </div>
    </div>

    <div class="mix-toolbar">
      <div class="mix-toolbar__inner">
        <div class="mix-toolbar__section mix-toolbar__section--mode">
          <span class="mix-toolbar__label">视角模式</span>
          <div
            class="mix-toolbar__mode-switch"
            role="tablist"
            aria-label="视角模式"
          >
            <button
              class="mix-toolbar__mode-btn"
              :class="{ 'is-active': viewMode === 'normal' }"
              type="button"
              role="tab"
              aria-label="普通模式"
              :aria-selected="viewMode === 'normal'"
              @click="setViewMode('normal')"
            >
              <el-icon><View /></el-icon>
              <span>普通模式</span>
            </button>
            <button
              class="mix-toolbar__mode-btn"
              :class="{ 'is-active': viewMode === 'firstPerson' }"
              type="button"
              role="tab"
              aria-label="数字人模式"
              :aria-selected="viewMode === 'firstPerson'"
              @click="setViewMode('firstPerson')"
            >
              <el-icon><User /></el-icon>
              <span>数字人模式</span>
            </button>
          </div>
        </div>

        <div class="mix-toolbar__divider" aria-hidden="true" />

        <div class="mix-toolbar__section mix-toolbar__section--layers">
          <span class="mix-toolbar__label">混合图层</span>
          <div
            class="mix-toolbar__layer-switch"
            role="group"
            aria-label="混合图层"
          >
            <button
              class="mix-toolbar__layer-btn"
              :class="{ 'is-active': shouldShowPointcloud() }"
              type="button"
              @click="emit('toggle-layer-visibility', 'pointcloud')"
            >
              <el-icon><Coordinate /></el-icon>
              <span>点云</span>
            </button>
            <button
              class="mix-toolbar__layer-btn"
              :class="{ 'is-active': shouldShowBim() }"
              type="button"
              @click="emit('toggle-layer-visibility', 'bim')"
            >
              <el-icon><PictureRounded /></el-icon>
              <span>BIM</span>
            </button>
            <button
              class="mix-toolbar__layer-btn"
              :class="{ 'is-active': shouldShowGaussian() }"
              type="button"
              @click="emit('toggle-layer-visibility', 'gaussian')"
            >
              <el-icon><MagicStick /></el-icon>
              <span>高斯</span>
            </button>
            <el-tooltip
              :disabled="isConsistencyResultAvailable()"
              :content="consistencyResultUnavailableText"
              placement="bottom"
            >
              <span class="mix-toolbar__tooltip-wrap">
                <button
                  class="mix-toolbar__layer-btn"
                  :class="{
                    'is-active': shouldShowConsistencyResult(),
                    'is-disabled': !isConsistencyResultAvailable(),
                  }"
                  type="button"
                  :disabled="!isConsistencyResultAvailable()"
                  :aria-disabled="!isConsistencyResultAvailable()"
                  @click="emit('toggle-layer-visibility', 'consistencyResult')"
                >
                  <el-icon><View /></el-icon>
                  <span>实模一致结果</span>
                </button>
              </span>
            </el-tooltip>
          </div>
        </div>

        <div class="mix-toolbar__divider" aria-hidden="true" />

        <div class="mix-toolbar__section mix-toolbar__section--actions">
          <span class="mix-toolbar__label">快捷操作</span>
          <div class="mix-toolbar__action-group">
            <el-tooltip content="重置视角" placement="bottom">
              <button
                class="mix-toolbar__icon-btn"
                type="button"
                aria-label="重置视角"
                @click="resetView"
              >
                <el-icon><RefreshRight /></el-icon>
              </button>
            </el-tooltip>

            <el-tooltip content="返回出生点" placement="bottom">
              <button
                class="mix-toolbar__icon-btn"
                type="button"
                aria-label="返回出生点"
                @click="handleBackToSpawn"
              >
                <el-icon><House /></el-icon>
              </button>
            </el-tooltip>

            <el-tooltip
              :content="collisionEnabled ? '关闭碰撞' : '启用碰撞'"
              placement="bottom"
            >
              <button
                class="mix-toolbar__icon-btn"
                :class="{ 'is-active': collisionEnabled }"
                type="button"
                aria-label="碰撞开关"
                @click="toggleCollision"
              >
                <el-icon><Aim /></el-icon>
              </button>
            </el-tooltip>

            <el-tooltip
              :content="`移动速度 ${speedOptions[speedIndex].label}`"
              placement="bottom"
            >
              <button
                class="mix-toolbar__icon-btn mix-toolbar__speed-btn"
                type="button"
                aria-label="移动速度"
                @click="cycleMoveSpeed"
              >
                <el-icon><Promotion /></el-icon>
                <span class="mix-toolbar__speed-text">
                  {{ speedOptions[speedIndex].label }}
                </span>
              </button>
            </el-tooltip>
          </div>
        </div>
      </div>
    </div>

    <div class="mix-stack">
      <div
        class="mix-pointcloud-layer"
        :class="{ 'is-hidden': !shouldShowPointcloud() }"
      >
        <PointCloudViewer
          ref="pointcloudRef"
          class="mix-pointcloud-panel"
          :is-preset-mode="true"
          :apply-tileset-transform="true"
          :auto-fit-on-load="false"
          :annotation-enabled="false"
          @loaded-change="handlePointcloudLoaded"
        />
      </div>

      <div
        class="mix-consistency-layer"
        :class="{ 'is-hidden': !shouldShowConsistencyResult() }"
      >
        <ConsistencyResultViewer
          v-if="shouldShowConsistencyResult()"
          ref="consistencyResultRef"
          class="mix-consistency-panel"
          :project-id="projectId"
          :scan-file-id="scanFileId"
          :bim-file-id="bimFileId"
          :transparent-background="true"
          :calibration="consistencyCalibration"
          :pointcloud-world-matrix="consistencyPointcloudWorldMatrix"
          :camera-pose="consistencyLayerCameraPose"
          :annotation-enabled="false"
          @loaded-change="handleConsistencyResultLoaded"
          @ready-state-change="handleConsistencyResultReadyStateChange"
        />
      </div>

      <div
        ref="overlayViewportRef"
        class="mix-overlay-layer"
        tabindex="0"
        @pointerdown="focusMixViewport"
      />

      <div
        v-if="
          currentGaussianAnnotationOverlay ||
          gaussianAnnotationOverlayMarkers.length
        "
        class="mix-gaussian-annotation-overlay"
        aria-hidden="true"
      >
        <div
          v-for="marker in gaussianAnnotationOverlayMarkers"
          :key="marker.key"
          :class="[
            'mix-gaussian-annotation-overlay__marker',
            {
              'is-highlighted': marker.highlighted,
              'is-current': marker.current,
              'is-synced': marker.synced,
            },
          ]"
          :style="getOverlayMarkerStyle(marker)"
        />
        <div
          v-if="currentGaussianAnnotationOverlay"
          :class="[
            'mix-gaussian-annotation-overlay__marker',
            'is-current',
            {
              'is-highlighted': currentGaussianAnnotationOverlay.highlighted,
            },
          ]"
          :style="getOverlayMarkerStyle(currentGaussianAnnotationOverlay)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Aim,
  Coordinate,
  House,
  PictureRounded,
  Promotion,
  RefreshRight,
  User,
  MagicStick,
  View,
} from '@element-plus/icons-vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { getBimAlignment, type ModelAlignment } from '@/api/calibration'
import { getGaussAssetUrl, getIfcGlbFile } from '@/api/fileManage'
import { formatToken, getOrganizationId, getToken } from '@/utils/auth'
import PointCloudViewer from './PointCloudViewer.vue'
import ConsistencyResultViewer from './ConsistencyResultViewer.vue'
import { LCCRender } from '@/libs/lcc-0.5.4.js'

type AnnotationSource = 'bim' | 'pointcloud' | 'gaussian' | 'consistencyResult'

type MoveDirection = 'up' | 'down' | 'left' | 'right'
type MixViewMode = 'normal' | 'firstPerson'

type AnnotationPickPayload = {
  point: { x: number; y: number; z: number } | null
  screen: { x: number; y: number } | null
  source: AnnotationSource
  key?: string
  synced?: boolean
  componentId?: string
  componentInfo?: {
    id?: string | number
    name?: string
    type?: string
  } | null
}

type AnnotationOverlayMarker = {
  key: string
  left: number
  top: number
  size: number
  color: string
  highlighted: boolean
  current: boolean
  synced: boolean
}

type PointcloudViewerExpose = InstanceType<typeof PointCloudViewer> & {
  cleanup?: () => void
  getCameraPose?: () => { camera: THREE.Vector3; target: THREE.Vector3 } | null
  getPointcloudWorldBox?: () => THREE.Box3 | null
  getThreeContext?: () => {
    scene: THREE.Scene | null
    camera: THREE.Camera | null
    renderer: THREE.WebGLRenderer | null
    controls: OrbitControls | null
  }
  loadPointcloudByScanId?: (
    projectId: number,
    scanFileId: number | null,
  ) => Promise<void> | void
  pickPointFromScreen?: (
    clientX: number,
    clientY: number,
  ) => {
    x: number
    y: number
    z: number
    key?: string
    synced?: boolean
  } | null
  resetView?: () => void
  syncFromExternalPose?: (pose: {
    camera: THREE.Vector3
    target: THREE.Vector3
  }) => void
  forceCaptureDataUrl?: () =>
    | Promise<{ dataUrl: string; rect: DOMRect } | null>
    | { dataUrl: string; rect: DOMRect }
    | null
}

type ConsistencyResultViewerExpose = InstanceType<
  typeof ConsistencyResultViewer
> & {
  forceCaptureDataUrl?: () =>
    | Promise<{ dataUrl: string; rect: DOMRect } | null>
    | { dataUrl: string; rect: DOMRect }
    | null
  getCameraPose?: () => {
    camera: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
  } | null
  getAnnotationMarkerPosition?: () => { x: number; y: number; z: number } | null
  pickPointFromScreen?: (
    clientX: number,
    clientY: number,
  ) => {
    x: number
    y: number
    z: number
    key?: string
    synced?: boolean
  } | null
  setCameraPose?: (
    pose?: {
      camera: { x: number; y: number; z: number }
      target: { x: number; y: number; z: number }
    } | null,
  ) => void
}

const props = defineProps<{
  projectId?: number | null
  scanFileId?: number | null
  bimFileId?: number | null
  gaussFileId?: number | null
  gaussAssetPath?: string
  consistencyResultAvailable?: boolean
  consistencyCalibration?: { modelMatrix: number[] } | null
  consistencyPointcloudWorldMatrix?: number[] | null
  showBim?: boolean
  showPointcloud?: boolean
  showGaussian?: boolean
  showConsistencyResult?: boolean
  bimOpacity?: number
  annotationEnabled?: boolean
  annotationPoint?: { x: number; y: number; z: number } | null
  annotationSource?: AnnotationSource | null
  annotationStatus?: 'default' | 'editing' | 'saved'
  annotationPersist?: boolean
  annotationStashMarkers?: {
    key: string
    point: { x: number; y: number; z: number }
    status: 'default' | 'editing' | 'saved'
    highlighted: boolean
    synced: boolean
    source?: AnnotationSource
  }[]
  annotationHighlightCurrent?: boolean
  annotationMarkersVisible?: boolean
}>()

const emit = defineEmits<{
  (e: 'annotation-pick', value: AnnotationPickPayload): void
  (
    e: 'camera-pose-change',
    value: {
      camera: { x: number; y: number; z: number }
      target: { x: number; y: number; z: number }
    } | null,
  ): void
  (
    e: 'toggle-layer-visibility',
    value: 'bim' | 'pointcloud' | 'gaussian' | 'consistencyResult',
  ): void
  (e: 'consistency-result-loaded-change', value: boolean): void
  (
    e: 'consistency-result-ready-state-change',
    value: 'pending' | 'loaded' | 'optional' | 'error',
  ): void
  (e: 'bim-loaded-change', value: boolean): void
  (e: 'pointcloud-loaded-change', value: boolean): void
  (e: 'gaussian-loaded-change', value: boolean): void
}>()

const pointcloudRef = ref<PointcloudViewerExpose | null>(null)
const consistencyResultRef = ref<ConsistencyResultViewerExpose | null>(null)
const overlayViewportRef = ref<HTMLDivElement | null>(null)

const statusText = ref('等待加载 BIM / 点云 / 高斯...')
const pointcloudLoaded = ref(false)
const bimLoaded = ref(false)
const gaussianLoaded = ref(false)
const consistencyResultLoaded = ref(false)
const consistencyResultReadyState = ref<
  'pending' | 'loaded' | 'optional' | 'error'
>('pending')
const isPointcloudLoading = ref(false)
const isBimLoading = ref(false)
const isGaussianLoading = ref(false)
const consistencyLayerCameraPose = ref<{
  camera: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
} | null>(null)
const viewMode = ref<MixViewMode>('normal')
const collisionEnabled = ref(true)
const consistencyResultUnavailableText = '当前扫描暂无实模一致结果'
const speedOptions = [
  { label: '0.5x', value: 0.45 },
  { label: '1.0x', value: 0.8 },
  { label: '1.5x', value: 1.2 },
]
const speedIndex = ref(1)
const firstPersonEyeHeight = ref<number | null>(null)

let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let contentGroup: THREE.Group | null = null
let bimObject: THREE.Object3D | null = null
let lccObject: any = null
let resizeObserver: ResizeObserver | null = null
let animationId = 0
let isRendering = false
let needsRender = false
let rendererReady = false
let initPromise: Promise<void> | null = null
let contentMaxDim = 1
let lastLoadToken = 0
let pointcloudLoadToken = 0

const annotationRaycaster = new THREE.Raycaster()
const annotationPointer = new THREE.Vector2()
const currentGaussianAnnotationOverlay = ref<AnnotationOverlayMarker | null>(
  null,
)
const gaussianAnnotationOverlayMarkers = ref<AnnotationOverlayMarker[]>([])
let annotationPointerId: number | null = null
let annotationPointerDown: { x: number; y: number } | null = null
let annotationPointerDragging = false
let annotationEventsBound = false
let firstPersonPointerId: number | null = null
let firstPersonPointerDown: { x: number; y: number } | null = null
const firstPersonActive = ref(false)
const mixCameraRot = ref({ lon: 0, lat: 0 })

let annotationLayer: THREE.Group | null = null
let annotationMarker: THREE.Group | null = null
let annotationStashGroup: THREE.Group | null = null
const annotationStashMarkerMap = new Map<string, THREE.Group>()
let pendingExternalPose: {
  camera: THREE.Vector3
  target: THREE.Vector3
} | null = null
let normalModeAnchor: THREE.Vector3 | null = null
let normalModeLookDistance = 5
let applyingNormalModePose = false
let spawnPose: {
  camera: THREE.Vector3
  target: THREE.Vector3
} | null = null
let trajectorySpawnPose: {
  camera: THREE.Vector3
  target: THREE.Vector3
} | null = null

const lastSyncedPose = {
  camera: new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN),
  target: new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN),
}

const dprCap = 1.25
const overlayBgAlpha = 0
const defaultBgColor = '#0b1020'
const zUpToYUpRotationX = -Math.PI / 2
const zUpToYUpMatrix = new THREE.Matrix4().makeRotationX(zUpToYUpRotationX)
const markerColors: Record<'default' | 'editing' | 'saved', number> = {
  default: 0x2f6bff,
  editing: 0xfacc15,
  saved: 0x22c55e,
}
const markerColorCss: Record<'default' | 'editing' | 'saved', string> = {
  default: '#2f6bff',
  editing: '#facc15',
  saved: '#22c55e',
}
const annotationMarkerBaseRadius = 1

let highlightedElement: {
  mesh: THREE.Mesh
  overlay: THREE.Mesh
  material: THREE.Material
} | null = null

const highlightColor = new THREE.Color('#ffcf4a')
const firstPersonLookDistance = 5
const mixCollisionRadius = 0.32
const DEFAULT_FIRST_PERSON_EYE_HEIGHT = 1.65
const FIRST_PERSON_MIN_EYE_HEIGHT = 1.45
const FIRST_PERSON_MAX_EYE_HEIGHT = 1.85
const FIRST_PERSON_GROUND_PROBE_DISTANCE = 8
const FIRST_PERSON_MAX_STEP_UP = 0.18
const FIRST_PERSON_MAX_STEP_DOWN = 0.5
const FIRST_PERSON_MAX_GROUND_HEIGHT_JUMP = 0.28
const FIRST_PERSON_ROTATION_SENSITIVITY = 0.12
const FIRST_PERSON_MAX_POINTER_DELTA = 48
const FIRST_PERSON_MAX_PITCH = 55
const FIRST_PERSON_MOVE_SPEED = 2.8
const FIRST_PERSON_GROUND_POINT_THRESHOLD = 0.35
const GAUSSIAN_FIRST_SCREEN_MAX_SPLATS = 700000
const GAUSSIAN_FIRST_SCREEN_MAX_DISTANCE = 80
const GAUSSIAN_ENHANCED_SCREEN_MAX_SPLATS = 1500000
const GAUSSIAN_ENHANCED_SCREEN_MAX_DISTANCE = 120
const GAUSSIAN_QUALITY_UPGRADE_DELAY = 1500
const activeFirstPersonMoveDirections = new Set<MoveDirection>()
let lastFirstPersonMoveAt = 0
let lastFirstPersonGroundHeight: number | null = null
const contentWorldBox = new THREE.Box3()
let gaussianQualityUpgradeTimer: number | null = null

function focusMixViewport() {
  overlayViewportRef.value?.focus()
}

function hasMixKeyboardFocus() {
  const viewport = overlayViewportRef.value
  const activeElement = document.activeElement
  if (!viewport || !(activeElement instanceof HTMLElement)) return false
  return activeElement === viewport || viewport.contains(activeElement)
}

function directionToRotation(
  direction: THREE.Vector3,
  options?: { clampLat?: (lat: number) => number },
) {
  const normalized = direction.clone().normalize()
  const hyp = Math.sqrt(
    normalized.x * normalized.x + normalized.z * normalized.z,
  )
  const lon = THREE.MathUtils.radToDeg(Math.atan2(normalized.z, normalized.x))
  const lat = THREE.MathUtils.radToDeg(Math.atan2(normalized.y, hyp))
  return {
    lon,
    lat: (options?.clampLat ?? clampFirstPersonLat)(lat),
  }
}

function clampLat(lat: number) {
  return Math.max(-85, Math.min(85, lat))
}

function clampFirstPersonLat(lat: number) {
  return Math.max(
    -FIRST_PERSON_MAX_PITCH,
    Math.min(FIRST_PERSON_MAX_PITCH, lat),
  )
}

function normalizeLon(lon: number) {
  return THREE.MathUtils.euclideanModulo(lon + 180, 360) - 180
}

function rotationToDirection(rot: { lon: number; lat: number }) {
  const lat = THREE.MathUtils.degToRad(clampLat(rot.lat))
  const lon = THREE.MathUtils.degToRad(rot.lon)
  const cosLat = Math.cos(lat)
  return new THREE.Vector3(
    cosLat * Math.cos(lon),
    Math.sin(lat),
    cosLat * Math.sin(lon),
  ).normalize()
}

function rememberSpawnPose(
  pose?: { camera: THREE.Vector3; target: THREE.Vector3 } | null,
) {
  const nextPose = pose ?? getOverlayPose()
  if (!nextPose) return
  spawnPose = {
    camera: nextPose.camera.clone(),
    target: nextPose.target.clone(),
  }
}

function emitBimLoadedChange(value: boolean) {
  emit('bim-loaded-change', value)
}

function emitPointcloudLoadedChange(value: boolean) {
  emit('pointcloud-loaded-change', value)
}

function emitGaussianLoadedChange(value: boolean) {
  emit('gaussian-loaded-change', value)
}

function getResolvedFirstPersonEyeHeight() {
  return firstPersonEyeHeight.value ?? DEFAULT_FIRST_PERSON_EYE_HEIGHT
}

function getFirstPersonSpeed() {
  const defaultSpeed = speedOptions[1]?.value ?? 1
  const currentSpeed = speedOptions[speedIndex.value]?.value ?? defaultSpeed
  return FIRST_PERSON_MOVE_SPEED * (currentSpeed / defaultSpeed)
}

function raycastBimGroundHeight(origin: THREE.Vector3, distance: number) {
  if (!bimObject || !bimLoaded.value || !shouldShowBim()) return null
  const raycaster = new THREE.Raycaster(
    origin,
    new THREE.Vector3(0, -1, 0),
    0,
    distance,
  )
  const hit = raycaster.intersectObject(bimObject, true)[0]
  return hit?.point?.y ?? null
}

function raycastGaussianFromOrigin(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  maxDistance: number,
  radius: number,
) {
  const lccRenderAny = LCCRender as any
  if (!gaussianLoaded.value || !shouldShowGaussian()) return null
  if (!lccRenderAny || typeof lccRenderAny.raycastFromOrigin !== 'function') {
    return null
  }

  const hit = lccRenderAny.raycastFromOrigin({
    origin: {
      x: origin.x,
      y: origin.y,
      z: origin.z,
    },
    direction: {
      x: direction.x,
      y: direction.y,
      z: direction.z,
    },
    maxDistance,
    radius,
  })

  if (
    !hit ||
    !Number.isFinite(hit.x) ||
    !Number.isFinite(hit.y) ||
    !Number.isFinite(hit.z)
  ) {
    return null
  }

  return new THREE.Vector3(hit.x, hit.y, hit.z)
}

function raycastGaussianGroundHeight(origin: THREE.Vector3, distance: number) {
  const hit = raycastGaussianFromOrigin(
    origin,
    new THREE.Vector3(0, -1, 0),
    distance,
    0.06,
  )
  return hit?.y ?? null
}

function isPointcloudHelperObject(object: THREE.Object3D | null) {
  let current: THREE.Object3D | null = object
  while (current) {
    const name = String(current.name || '')
    if (name === 'annotation-marker' || name === 'annotation-stash-group') {
      return true
    }
    current = current.parent
  }
  return false
}

function raycastPointcloudHit(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  distance: number,
  threshold: number,
) {
  if (!pointcloudLoaded.value || !shouldShowPointcloud()) return null
  const pointcloudScene =
    pointcloudRef.value?.getThreeContext?.()?.scene ?? null
  if (!pointcloudScene) return null

  const raycaster = new THREE.Raycaster(
    origin,
    direction.clone().normalize(),
    0,
    distance,
  )
  if (!raycaster.params.Points) {
    raycaster.params.Points = { threshold }
  } else {
    raycaster.params.Points.threshold = threshold
  }

  const hits = raycaster.intersectObject(pointcloudScene, true)
  return hits.find((hit) => !isPointcloudHelperObject(hit.object)) ?? null
}

function raycastPointcloudGroundHeight(
  origin: THREE.Vector3,
  distance: number,
) {
  const hit = raycastPointcloudHit(
    origin,
    new THREE.Vector3(0, -1, 0),
    distance,
    FIRST_PERSON_GROUND_POINT_THRESHOLD,
  )
  return hit?.point?.y ?? null
}

function sampleBimGroundHeight(position: THREE.Vector3) {
  if (!bimObject || !bimLoaded.value || !shouldShowBim()) return null

  const localOrigin = position.clone()
  localOrigin.y += 0.2
  const localDistance = Math.max(
    FIRST_PERSON_GROUND_PROBE_DISTANCE,
    getResolvedFirstPersonEyeHeight() * 4,
  )
  const localGround = raycastBimGroundHeight(localOrigin, localDistance)
  if (localGround !== null) return localGround

  if (contentWorldBox.isEmpty()) return null
  const globalOrigin = new THREE.Vector3(
    position.x,
    contentWorldBox.max.y + Math.max(contentMaxDim * 0.5, 12),
    position.z,
  )
  const globalDistance = Math.max(contentMaxDim * 3, 30)
  return raycastBimGroundHeight(globalOrigin, globalDistance)
}

function sampleGaussianGroundHeight(position: THREE.Vector3) {
  if (!gaussianLoaded.value || !shouldShowGaussian()) return null

  const localOrigin = position.clone()
  localOrigin.y += 0.2
  const localHit = raycastGaussianGroundHeight(
    localOrigin,
    Math.max(
      FIRST_PERSON_GROUND_PROBE_DISTANCE,
      getResolvedFirstPersonEyeHeight() * 4,
    ),
  )
  if (localHit !== null) return localHit

  const globalOrigin = position.clone()
  globalOrigin.y += Math.max(FIRST_PERSON_GROUND_PROBE_DISTANCE, 12)
  return raycastGaussianGroundHeight(globalOrigin, 30)
}

function samplePointcloudGroundHeight(position: THREE.Vector3) {
  if (!pointcloudLoaded.value || !shouldShowPointcloud()) return null

  const localOrigin = position.clone()
  localOrigin.y += 0.2
  const localDistance = Math.max(
    FIRST_PERSON_GROUND_PROBE_DISTANCE,
    getResolvedFirstPersonEyeHeight() * 4,
  )
  const localGround = raycastPointcloudGroundHeight(localOrigin, localDistance)
  if (localGround !== null) return localGround

  const worldBox = pointcloudRef.value?.getPointcloudWorldBox?.() ?? null
  if (!worldBox) return null
  const globalOrigin = new THREE.Vector3(
    position.x,
    worldBox.max.y + Math.max(contentMaxDim * 0.5, 12),
    position.z,
  )
  const globalDistance = Math.max(contentMaxDim * 3, 30)
  return raycastPointcloudGroundHeight(globalOrigin, globalDistance)
}

function sampleMixGroundHeight(position: THREE.Vector3) {
  const groundHeight =
    sampleBimGroundHeight(position) ??
    sampleGaussianGroundHeight(position) ??
    samplePointcloudGroundHeight(position)

  if (groundHeight === null) return lastFirstPersonGroundHeight
  if (
    lastFirstPersonGroundHeight !== null &&
    groundHeight >
      lastFirstPersonGroundHeight + FIRST_PERSON_MAX_GROUND_HEIGHT_JUMP
  ) {
    return lastFirstPersonGroundHeight
  }

  lastFirstPersonGroundHeight = groundHeight
  return groundHeight
}

function refreshFirstPersonEyeHeight() {
  if (!camera) return
  const groundHeight = sampleMixGroundHeight(camera.position)
  if (groundHeight === null) {
    firstPersonEyeHeight.value = DEFAULT_FIRST_PERSON_EYE_HEIGHT
    lastFirstPersonGroundHeight = null
    return
  }

  const measuredEyeHeight = camera.position.y - groundHeight
  if (measuredEyeHeight > 1.2 && measuredEyeHeight < 2.2) {
    firstPersonEyeHeight.value = THREE.MathUtils.clamp(
      measuredEyeHeight,
      FIRST_PERSON_MIN_EYE_HEIGHT,
      FIRST_PERSON_MAX_EYE_HEIGHT,
    )
    lastFirstPersonGroundHeight = groundHeight
    return
  }

  firstPersonEyeHeight.value = DEFAULT_FIRST_PERSON_EYE_HEIGHT
  lastFirstPersonGroundHeight = groundHeight
}

function resolveGroundFollowingPosition(
  targetPosition: THREE.Vector3,
  options?: { snapImmediately?: boolean },
) {
  if (!camera) return targetPosition
  const groundHeight = sampleMixGroundHeight(targetPosition)
  if (groundHeight === null) return targetPosition

  const desiredY = groundHeight + getResolvedFirstPersonEyeHeight()
  const currentY = camera.position.y
  const deltaY = desiredY - currentY

  const resolved = targetPosition.clone()
  if (options?.snapImmediately) {
    resolved.y = desiredY
    return resolved
  }
  resolved.y =
    currentY +
    THREE.MathUtils.clamp(
      deltaY,
      -FIRST_PERSON_MAX_STEP_DOWN,
      FIRST_PERSON_MAX_STEP_UP,
    )
  return resolved
}

function applyFirstPersonRotationDelta(deltaX: number, deltaY: number) {
  const limitedDeltaX = THREE.MathUtils.clamp(
    deltaX,
    -FIRST_PERSON_MAX_POINTER_DELTA,
    FIRST_PERSON_MAX_POINTER_DELTA,
  )
  const limitedDeltaY = THREE.MathUtils.clamp(
    deltaY,
    -FIRST_PERSON_MAX_POINTER_DELTA,
    FIRST_PERSON_MAX_POINTER_DELTA,
  )

  mixCameraRot.value = {
    lon: normalizeLon(
      mixCameraRot.value.lon +
        limitedDeltaX * FIRST_PERSON_ROTATION_SENSITIVITY,
    ),
    lat: clampFirstPersonLat(
      mixCameraRot.value.lat -
        limitedDeltaY * FIRST_PERSON_ROTATION_SENSITIVITY,
    ),
  }
  updateFirstPersonCamera()
  controls?.update()
  syncPointcloudPose(true)
  emitCameraPoseChange()
  requestRender()
}

function getFirstPersonMoveBasis() {
  if (!camera) return null

  const forward = new THREE.Vector3()
  camera.getWorldDirection(forward)
  forward.y = 0

  if (forward.lengthSq() < 1e-8) {
    forward.copy(
      rotationToDirection({
        lon: mixCameraRot.value.lon,
        lat: 0,
      }),
    )
    forward.y = 0
  }

  if (forward.lengthSq() < 1e-8) return null

  forward.normalize()
  const right = new THREE.Vector3()
    .crossVectors(new THREE.Vector3(0, 1, 0), forward)
    .normalize()

  return { forward, right }
}

function syncFirstPersonRotationFromCamera() {
  if (!camera) return
  const direction = new THREE.Vector3()
  camera.getWorldDirection(direction)
  mixCameraRot.value = directionToRotation(direction)
}

function syncNormalRotationFromCamera() {
  if (!camera) return
  const direction = new THREE.Vector3()
  camera.getWorldDirection(direction)
  mixCameraRot.value = directionToRotation(direction, { clampLat })
}

function syncNormalModeAnchor(
  pose?: { camera: THREE.Vector3; target: THREE.Vector3 } | null,
) {
  const nextPose = pose ?? getOverlayPose()
  if (!nextPose) return
  normalModeAnchor = nextPose.camera.clone()
  const lookVector = nextPose.target.clone().sub(nextPose.camera)
  const lookDistance = lookVector.length()
  normalModeLookDistance =
    lookDistance > 1e-6 ? lookDistance : firstPersonLookDistance
  mixCameraRot.value = directionToRotation(lookVector, { clampLat })
}

function updateNormalCamera() {
  if (!camera || !controls) return
  const anchor = normalModeAnchor ?? camera.position.clone()
  const direction = rotationToDirection({
    lon: normalizeLon(mixCameraRot.value.lon),
    lat: clampLat(mixCameraRot.value.lat),
  })
  const target = anchor
    .clone()
    .addScaledVector(direction, Math.max(normalModeLookDistance, 0.1))
  camera.position.copy(anchor)
  controls.target.copy(target)
  camera.up.set(0, 1, 0)
  camera.lookAt(target)
  camera.updateMatrixWorld()
}

function applyNormalModeStationaryPose() {
  if (!camera || !controls || firstPersonActive.value) return
  const direction = controls.target.clone().sub(camera.position)
  if (direction.lengthSq() < 1e-8) {
    camera.getWorldDirection(direction)
  }
  if (direction.lengthSq() < 1e-8) {
    direction.set(0, 0, -1)
  }
  mixCameraRot.value = directionToRotation(direction, { clampLat })

  applyingNormalModePose = true
  try {
    updateNormalCamera()
    controls.update()
  } finally {
    applyingNormalModePose = false
  }
}

function updateFirstPersonCamera() {
  if (!camera || !controls) return
  const direction = rotationToDirection({
    lon: normalizeLon(mixCameraRot.value.lon),
    lat: clampFirstPersonLat(mixCameraRot.value.lat),
  })
  const target = camera.position
    .clone()
    .addScaledVector(direction, firstPersonLookDistance)
  controls.target.copy(target)
  camera.up.set(0, 1, 0)
  camera.lookAt(target)
  camera.updateMatrixWorld()
}

function updateNormalControlsConfig() {
  if (!controls) return
  const orbitDistanceBase = Math.max(contentMaxDim, 1)
  controls.enableDamping = true
  controls.dampingFactor = 0.12
  controls.rotateSpeed = 0.35
  controls.panSpeed = 0.45
  controls.zoomSpeed = 0.85
  controls.screenSpacePanning = false
  controls.minDistance = Math.max(0.3, orbitDistanceBase * 0.02)
  controls.maxDistance = Math.max(orbitDistanceBase * 6, 60)
}

function applyViewModeState() {
  if (!controls) return
  updateNormalControlsConfig()
  const enableOrbit = viewMode.value === 'normal'
  controls.enabled = enableOrbit
  controls.enableRotate = enableOrbit
  controls.enablePan = false
  controls.enableZoom = false
  firstPersonActive.value = viewMode.value === 'firstPerson'
  if (firstPersonActive.value) {
    syncFirstPersonRotationFromCamera()
    updateFirstPersonCamera()
  } else {
    syncNormalModeAnchor()
    updateNormalCamera()
  }
}

function setViewMode(mode: MixViewMode) {
  if (!camera || !controls) {
    viewMode.value = mode
    applyViewModeState()
    return
  }
  if (viewMode.value === mode) {
    if (mode === 'firstPerson') {
      syncFirstPersonRotationFromCamera()
      updateFirstPersonCamera()
      requestRender()
    }
    return
  }

  viewMode.value = mode
  if (mode === 'firstPerson') {
    rememberSpawnPose()
    activeFirstPersonMoveDirections.clear()
    lastFirstPersonMoveAt = 0
    lastFirstPersonGroundHeight = null
    clearFirstPersonPointerState()
    syncFirstPersonRotationFromCamera()
    refreshFirstPersonEyeHeight()
    camera.position.copy(
      resolveGroundFollowingPosition(camera.position.clone(), {
        snapImmediately: true,
      }),
    )
  } else {
    activeFirstPersonMoveDirections.clear()
    lastFirstPersonMoveAt = 0
    lastFirstPersonGroundHeight = null
    firstPersonEyeHeight.value = null
    clearFirstPersonPointerState()
    syncNormalModeAnchor()
  }
  applyViewModeState()
  if (mode === 'firstPerson') {
    refreshFirstPersonEyeHeight()
    syncFirstPersonRotationFromCamera()
    updateFirstPersonCamera()
  } else {
    syncNormalRotationFromCamera()
    updateNormalCamera()
  }
  controls.update()
  syncPointcloudPose(true)
  emitCameraPoseChange()
  requestRender()
}

function toggleCollision() {
  collisionEnabled.value = !collisionEnabled.value
}

function cycleMoveSpeed() {
  speedIndex.value = (speedIndex.value + 1) % speedOptions.length
}

function handleBackToSpawn() {
  const targetSpawnPose = trajectorySpawnPose ?? spawnPose
  if (targetSpawnPose) {
    applyOverlayPose(
      {
        camera: targetSpawnPose.camera.clone(),
        target: targetSpawnPose.target.clone(),
      },
      true,
    )
    return
  }
  void resetView()
}

function setTrajectorySpawnPose(
  pose: { camera: THREE.Vector3; target: THREE.Vector3 } | null,
) {
  if (!pose) {
    trajectorySpawnPose = null
    return
  }
  trajectorySpawnPose = {
    camera: pose.camera.clone(),
    target: pose.target.clone(),
  }
  firstPersonEyeHeight.value = null
}

function shouldShowPointcloud() {
  return props.showPointcloud !== false
}

function shouldShowBim() {
  return props.showBim !== false
}

function shouldShowGaussian() {
  return props.showGaussian !== false
}

function isConsistencyResultAvailable() {
  return props.consistencyResultAvailable !== false
}

function shouldShowConsistencyResult() {
  return isConsistencyResultAvailable() && props.showConsistencyResult !== false
}

function getResolvedBimOpacity() {
  const nextOpacity = Number(props.bimOpacity)
  if (!Number.isFinite(nextOpacity)) return 1
  return THREE.MathUtils.clamp(nextOpacity, 0, 1)
}

function applyBimMaterialOpacity(material?: THREE.Material | null) {
  if (!material) return
  const targetMaterial = material as THREE.Material & {
    opacity?: number
    transparent?: boolean
    depthWrite?: boolean
    alphaTest?: number
    userData: Record<string, any>
    needsUpdate?: boolean
  }
  const nextOpacity = getResolvedBimOpacity()
  const userData = (targetMaterial.userData ||= {})

  if (userData.__mixOriginalOpacity === undefined) {
    userData.__mixOriginalOpacity =
      typeof targetMaterial.opacity === 'number' ? targetMaterial.opacity : 1
  }
  if (userData.__mixOriginalTransparent === undefined) {
    userData.__mixOriginalTransparent = Boolean(targetMaterial.transparent)
  }
  if (userData.__mixOriginalDepthWrite === undefined) {
    userData.__mixOriginalDepthWrite =
      targetMaterial.depthWrite !== undefined ? targetMaterial.depthWrite : true
  }

  targetMaterial.opacity = nextOpacity
  targetMaterial.transparent =
    nextOpacity < 0.999 || Boolean(userData.__mixOriginalTransparent)
  targetMaterial.depthWrite =
    nextOpacity >= 0.999 &&
    !Boolean(userData.__mixOriginalTransparent) &&
    (targetMaterial.alphaTest ?? 0) <= 0
      ? Boolean(userData.__mixOriginalDepthWrite)
      : false
  targetMaterial.needsUpdate = true
}

function applyBimOpacity() {
  if (!bimObject) return
  const nextOpacity = getResolvedBimOpacity()

  bimObject.visible = shouldShowBim() && nextOpacity > 0.001

  bimObject.traverse((child: any) => {
    const material = child?.material
    if (Array.isArray(material)) {
      material.forEach((entry) => applyBimMaterialOpacity(entry))
      return
    }
    applyBimMaterialOpacity(material)
  })
  requestRender()
}

const showPlaceholder = computed(() => {
  return (
    !pointcloudLoaded.value &&
    !bimLoaded.value &&
    !gaussianLoaded.value &&
    !consistencyResultLoaded.value &&
    !isPointcloudLoading.value &&
    !isBimLoading.value &&
    !isGaussianLoading.value &&
    !shouldShowConsistencyResult()
  )
})

const placeholderText = computed(() => {
  if (!props.projectId) return '缺少项目ID'
  if (!props.scanFileId && !props.bimFileId && !props.gaussFileId) {
    return '未绑定点云、BIM 或高斯文件'
  }
  return statusText.value || '加载中...'
})

function runSafely(label: string, task: () => void) {
  try {
    task()
  } catch (error) {}
}

function disposeLccManager() {
  const lccRenderAny = LCCRender as any
  if (!lccRenderAny || typeof lccRenderAny.dispose !== 'function') return
  runSafely('LCC全局管理器重置', () => {
    lccRenderAny.dispose()
  })
}

function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child: any) => {
    child.geometry?.dispose?.()
    const material = child.material
    if (Array.isArray(material)) {
      material.forEach((entry) => entry?.dispose?.())
      return
    }
    material?.dispose?.()
  })
}

function normalizeGaussAssetPath(value?: string) {
  return (
    String(value || 'meta.lcc')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .trim() || 'meta.lcc'
  )
}

function resolveGaussianDataPath() {
  if (!props.projectId || !props.gaussFileId) return ''

  const baseUrl = `${window.location.origin}${getGaussAssetUrl(
    props.projectId,
    props.gaussFileId,
    normalizeGaussAssetPath(props.gaussAssetPath),
  )}`

  const tokenData = getToken()
  const organizationId = getOrganizationId()

  if (!tokenData?.accessToken && !organizationId) return baseUrl

  const url = new URL(baseUrl)
  if (tokenData?.accessToken) {
    url.searchParams.set('token', formatToken(tokenData.accessToken))
  }
  if (organizationId) {
    url.searchParams.set('orgId', String(organizationId))
  }
  return url.toString()
}

function getVisibleModelCount() {
  return [
    shouldShowPointcloud() && pointcloudLoaded.value,
    shouldShowBim() && bimLoaded.value,
    shouldShowGaussian() && gaussianLoaded.value,
    shouldShowConsistencyResult() &&
      consistencyResultReadyState.value === 'loaded' &&
      consistencyResultLoaded.value,
  ].filter(Boolean).length
}

function updateStatusText() {
  if (!props.projectId || !props.scanFileId) {
    statusText.value = '请选择项目和扫描后加载融合场景'
    return
  }

  if (isPointcloudLoading.value) {
    statusText.value = '加载点云中...'
    return
  }
  if (isBimLoading.value) {
    statusText.value = '加载 BIM 中...'
    return
  }
  if (isGaussianLoading.value) {
    statusText.value = '加载高斯中...'
    return
  }
  if (
    shouldShowConsistencyResult() &&
    consistencyResultReadyState.value === 'pending'
  ) {
    statusText.value = '加载实模一致结果中...'
    return
  }

  if (getVisibleModelCount() === 0) {
    statusText.value = '已隐藏全部模型，点击左侧图层重新显示'
    return
  }

  if (
    shouldShowPointcloud() &&
    pointcloudLoaded.value &&
    shouldShowBim() &&
    bimLoaded.value &&
    shouldShowGaussian() &&
    gaussianLoaded.value &&
    (!shouldShowConsistencyResult() ||
      (consistencyResultReadyState.value === 'loaded' &&
        consistencyResultLoaded.value) ||
      consistencyResultReadyState.value !== 'loaded')
  ) {
    statusText.value = shouldShowConsistencyResult()
      ? '点云、高斯、BIM、实模一致结果已对齐显示'
      : '点云、高斯、BIM 已对齐显示'
    return
  }

  const labels: string[] = []
  if (shouldShowPointcloud() && pointcloudLoaded.value) labels.push('点云')
  if (shouldShowBim() && bimLoaded.value) labels.push('BIM')
  if (shouldShowGaussian() && gaussianLoaded.value) labels.push('高斯')
  if (
    shouldShowConsistencyResult() &&
    consistencyResultReadyState.value === 'loaded' &&
    consistencyResultLoaded.value
  ) {
    labels.push('实模一致结果')
  }
  statusText.value = labels.length
    ? `${labels.join(' / ')} 已显示`
    : '加载中...'
}

function buildAlignmentMatrix(alignment: ModelAlignment) {
  const matrix = new THREE.Matrix4()
  if (
    Array.isArray(alignment.modelMatrix) &&
    alignment.modelMatrix.length === 16
  ) {
    matrix.fromArray(alignment.modelMatrix)
    return matrix
  }

  matrix.compose(
    new THREE.Vector3(
      alignment.modelTranslationX,
      alignment.modelTranslationY,
      alignment.modelTranslationZ,
    ),
    new THREE.Quaternion(
      alignment.modelRotationQx,
      alignment.modelRotationQy,
      alignment.modelRotationQz,
      alignment.modelRotationQw,
    ),
    new THREE.Vector3(1, 1, 1),
  )
  return matrix
}

function getPointcloudWorldMatrix() {
  return pointcloudRef.value?.getPointcloudGroupWorldMatrix?.() ?? null
}

function getPointcloudWorldMatrixArray() {
  const matrix = getPointcloudWorldMatrix()
  return matrix
    ? matrix.toArray().map((value) => Number(value.toFixed(6)))
    : null
}

function emitCameraPoseChange() {
  const pose = getOverlayPose()
  if (!pose) {
    consistencyLayerCameraPose.value = null
    emit('camera-pose-change', null)
    return
  }
  const plainPose = {
    camera: {
      x: Number(pose.camera.x.toFixed(6)),
      y: Number(pose.camera.y.toFixed(6)),
      z: Number(pose.camera.z.toFixed(6)),
    },
    target: {
      x: Number(pose.target.x.toFixed(6)),
      y: Number(pose.target.y.toFixed(6)),
      z: Number(pose.target.z.toFixed(6)),
    },
  }
  consistencyLayerCameraPose.value = plainPose
  emit('camera-pose-change', plainPose)
}

async function loadGltfRootFromBlob(blob: Blob) {
  const objectUrl = URL.createObjectURL(blob)
  const loader = new GLTFLoader()
  try {
    const gltf = await new Promise<any>((resolve, reject) => {
      loader.load(objectUrl, resolve, undefined, reject)
    })
    const root = gltf?.scene ?? gltf?.scenes?.[0] ?? null
    if (!root) {
      throw new Error('empty glTF scene')
    }
    return root as THREE.Object3D
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function updateContentMetrics() {
  if (!contentGroup) return
  contentGroup.updateMatrixWorld?.(true)
  const box = new THREE.Box3().setFromObject(contentGroup)
  if (box.isEmpty()) {
    contentWorldBox.makeEmpty()
    contentMaxDim = 1
    updateNormalControlsConfig()
    return
  }
  contentWorldBox.copy(box)
  const size = box.getSize(new THREE.Vector3())
  contentMaxDim = Math.max(size.x, size.y, size.z) || 1
  updateNormalControlsConfig()
}

function fitCameraToObject(object: THREE.Object3D) {
  if (!camera || !controls) return
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  if (!Number.isFinite(maxDim) || maxDim <= 0) return

  const fov = THREE.MathUtils.degToRad(camera.fov)
  const distance = maxDim / 2 / Math.tan(fov / 2)

  controls.target.copy(center)
  camera.position.set(
    center.x,
    center.y + maxDim * 0.15,
    center.z + distance * 2.2,
  )
  camera.near = Math.max(0.01, distance / 100)
  camera.far = Math.max(100000, distance * 200)
  camera.updateProjectionMatrix()
  controls.update()
  updateContentMetrics()
  rememberSpawnPose({
    camera: camera.position.clone(),
    target: controls.target.clone(),
  })
}

function getOverlayPose() {
  if (!camera || !controls) return null
  return {
    camera: camera.position.clone(),
    target: controls.target.clone(),
  }
}

function detectGaussianCollision(position: THREE.Vector3) {
  if (!lccObject || typeof lccObject.intersectsSphere !== 'function') {
    return { hit: false, delta: new THREE.Vector3() }
  }

  const result = lccObject.intersectsSphere({
    center: {
      x: position.x,
      y: position.y,
      z: position.z,
    },
    radius: mixCollisionRadius,
    noDelta: false,
  })

  return {
    hit: Boolean(result?.hit),
    delta: new THREE.Vector3(
      result?.delta?.x ?? 0,
      result?.delta?.y ?? 0,
      result?.delta?.z ?? 0,
    ),
  }
}

function hasBimCollision(
  currentPosition: THREE.Vector3,
  nextPosition: THREE.Vector3,
  direction: THREE.Vector3,
) {
  if (!bimObject || !shouldShowBim() || !bimLoaded.value) return false
  const rayDirection = direction.clone().normalize()
  if (rayDirection.lengthSq() < 1e-8) return false
  const raycaster = new THREE.Raycaster(
    currentPosition,
    rayDirection,
    0,
    currentPosition.distanceTo(nextPosition) + mixCollisionRadius,
  )
  return raycaster.intersectObject(bimObject, true).length > 0
}

function hasPointcloudCollision(
  currentPosition: THREE.Vector3,
  nextPosition: THREE.Vector3,
  direction: THREE.Vector3,
) {
  if (!pointcloudLoaded.value || !shouldShowPointcloud()) return false
  const rayDirection = direction.clone().normalize()
  if (rayDirection.lengthSq() < 1e-8) return false
  const hit = raycastPointcloudHit(
    currentPosition,
    rayDirection,
    currentPosition.distanceTo(nextPosition) + mixCollisionRadius,
    mixCollisionRadius,
  )
  return Boolean(hit)
}

function resolveCollidedCameraPosition(
  currentPosition: THREE.Vector3,
  nextPosition: THREE.Vector3,
  moveDirection: THREE.Vector3,
) {
  if (!collisionEnabled.value) return nextPosition

  const resolvedPosition = nextPosition.clone()
  if (shouldShowGaussian() && gaussianLoaded.value) {
    const gaussianCollision = detectGaussianCollision(resolvedPosition)
    if (gaussianCollision.hit) {
      if (gaussianCollision.delta.lengthSq() > 1e-8) {
        const collisionDelta = gaussianCollision.delta.clone()
        collisionDelta.y = 0
        resolvedPosition.add(collisionDelta.multiplyScalar(1.02))
      } else {
        resolvedPosition.copy(currentPosition)
      }
    }
  }

  if (
    hasBimCollision(currentPosition, resolvedPosition, moveDirection) ||
    hasPointcloudCollision(currentPosition, resolvedPosition, moveDirection)
  ) {
    return currentPosition.clone()
  }
  return resolvedPosition
}

function moveFirstPersonCamera(
  direction: MoveDirection,
  distanceOverride?: number,
) {
  if (!camera || !controls || !firstPersonActive.value) return
  if (!bimLoaded.value && !pointcloudLoaded.value && !gaussianLoaded.value) {
    return
  }

  const moveBasis = getFirstPersonMoveBasis()
  if (!moveBasis) return
  const { forward, right } = moveBasis
  const moveDistance = distanceOverride ?? 0.8

  const movement = new THREE.Vector3()
  switch (direction) {
    case 'up':
      movement.copy(forward).multiplyScalar(moveDistance)
      break
    case 'down':
      movement.copy(forward).multiplyScalar(-moveDistance)
      break
    case 'left':
      movement.copy(right).multiplyScalar(moveDistance)
      break
    case 'right':
      movement.copy(right).multiplyScalar(-moveDistance)
      break
  }

  const currentPosition = camera.position.clone()
  const nextPosition = resolveGroundFollowingPosition(
    resolveCollidedCameraPosition(
      currentPosition,
      currentPosition.clone().add(movement),
      movement,
    ),
  )
  if (nextPosition.distanceToSquared(currentPosition) <= 1e-8) return
  camera.position.copy(nextPosition)
  camera.position.copy(
    resolveGroundFollowingPosition(camera.position.clone(), {
      snapImmediately: true,
    }),
  )
  updateFirstPersonCamera()
  controls.update()
  syncPointcloudPose(true)
  emitCameraPoseChange()
  requestRender()
}

function updateFirstPersonMovement(timestamp: number) {
  if (!firstPersonActive.value || !camera || !controls) {
    activeFirstPersonMoveDirections.clear()
    lastFirstPersonMoveAt = 0
    return false
  }
  if (activeFirstPersonMoveDirections.size === 0) {
    lastFirstPersonMoveAt = 0
    return false
  }

  const deltaSeconds = lastFirstPersonMoveAt
    ? Math.min((timestamp - lastFirstPersonMoveAt) / 1000, 0.05)
    : 1 / 60
  lastFirstPersonMoveAt = timestamp

  const moveBasis = getFirstPersonMoveBasis()
  if (!moveBasis) return false
  const { forward, right } = moveBasis

  const offset = new THREE.Vector3()
  const moveDistance = getFirstPersonSpeed() * deltaSeconds
  activeFirstPersonMoveDirections.forEach((direction) => {
    switch (direction) {
      case 'up':
        offset.addScaledVector(forward, moveDistance)
        break
      case 'down':
        offset.addScaledVector(forward, -moveDistance)
        break
      case 'left':
        offset.addScaledVector(right, moveDistance)
        break
      case 'right':
        offset.addScaledVector(right, -moveDistance)
        break
    }
  })

  if (offset.lengthSq() < 1e-8) return false
  if (activeFirstPersonMoveDirections.size > 1) {
    offset.setLength(moveDistance)
  }

  const currentPosition = camera.position.clone()
  const collisionResolvedPosition = resolveCollidedCameraPosition(
    currentPosition,
    currentPosition.clone().add(offset),
    offset,
  )
  const nextPosition = resolveGroundFollowingPosition(collisionResolvedPosition)
  if (nextPosition.distanceToSquared(currentPosition) <= 1e-8) return false

  camera.position.copy(nextPosition)
  camera.position.copy(
    resolveGroundFollowingPosition(camera.position.clone(), {
      snapImmediately: true,
    }),
  )
  updateFirstPersonCamera()
  controls.update()
  syncPointcloudPose(true)
  emitCameraPoseChange()
  requestRender()
  return true
}

function syncPointcloudPose(force = false) {
  const pose = getOverlayPose()
  const viewer = pointcloudRef.value
  if (
    !pose ||
    !viewer?.syncFromExternalPose ||
    !shouldShowPointcloud() ||
    !pointcloudLoaded.value
  ) {
    return
  }

  const hasChanged =
    force ||
    pose.camera.distanceToSquared(lastSyncedPose.camera) > 1e-10 ||
    pose.target.distanceToSquared(lastSyncedPose.target) > 1e-10

  if (!hasChanged) return

  viewer.syncFromExternalPose(pose)
  lastSyncedPose.camera.copy(pose.camera)
  lastSyncedPose.target.copy(pose.target)
}

function syncOverlayFromPointcloudPose() {
  if (!camera || !controls) return
  const pose = pointcloudRef.value?.getCameraPose?.()
  if (!pose) return

  camera.position.copy(pose.camera)
  controls.target.copy(pose.target)
  camera.lookAt(controls.target)
  camera.updateProjectionMatrix()
  controls.update()
  lastSyncedPose.camera.copy(pose.camera)
  lastSyncedPose.target.copy(pose.target)
  if (firstPersonActive.value) {
    rememberSpawnPose(pose)
  } else {
    syncNormalModeAnchor(pose)
  }
  if (firstPersonActive.value) {
    refreshFirstPersonEyeHeight()
    syncFirstPersonRotationFromCamera()
    updateFirstPersonCamera()
  } else {
    syncNormalRotationFromCamera()
    updateNormalCamera()
  }
  emitCameraPoseChange()
  requestRender()
}

function applyOverlayPose(
  pose: { camera: THREE.Vector3; target: THREE.Vector3 } | null,
  syncPointcloud = true,
  options?: { updateSpawnPose?: boolean },
) {
  if (!camera || !controls || !pose) return
  camera.position.copy(pose.camera)
  controls.target.copy(pose.target)
  camera.lookAt(controls.target)
  camera.updateProjectionMatrix()
  controls.update()
  if (firstPersonActive.value) {
    refreshFirstPersonEyeHeight()
    syncFirstPersonRotationFromCamera()
    updateFirstPersonCamera()
  } else {
    syncNormalModeAnchor(pose)
    syncNormalRotationFromCamera()
    updateNormalCamera()
  }
  if (options?.updateSpawnPose) {
    rememberSpawnPose(pose)
  }
  if (syncPointcloud) {
    syncPointcloudPose(true)
  }
  emitCameraPoseChange()
  requestRender()
}

function resolveAnnotationStatus(value?: string) {
  return value === 'editing' || value === 'saved' ? value : 'default'
}

function createHighlightOverlayMaterial(color: THREE.Color) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.45,
  })
  mat.depthTest = true
  mat.depthWrite = false
  return mat
}

function clearHighlight() {
  if (!highlightedElement) return
  const { mesh, overlay, material } = highlightedElement
  mesh.remove(overlay)
  material.dispose?.()
  highlightedElement = null
  requestRender()
}

function highlightMesh(mesh: THREE.Mesh, color: THREE.Color) {
  clearHighlight()
  const material = createHighlightOverlayMaterial(color)
  const overlay = new THREE.Mesh(mesh.geometry, material)
  overlay.name = 'annotation-pick-highlight'
  overlay.userData.__annotationHighlightOverlay = true
  overlay.frustumCulled = false
  overlay.renderOrder = 9998
  overlay.matrixAutoUpdate = false
  overlay.matrix.identity()
  overlay.matrixWorldNeedsUpdate = true
  mesh.add(overlay)
  highlightedElement = { mesh, overlay, material }
  requestRender()
}

function guessIfcId(userData: any): string | undefined {
  if (!userData || typeof userData !== 'object') return undefined
  const directKeys = [
    'expressID',
    'ExpressID',
    'expressId',
    'ifcId',
    'ifcID',
    'IfcId',
    'globalId',
    'GlobalId',
    'GUID',
    'guid',
    'id',
    'ID',
    'elementId',
    'elementID',
  ]
  for (const key of directKeys) {
    const value = userData[key]
    if (value !== undefined && value !== null && value !== '') {
      return String(value)
    }
  }
  return undefined
}

function resolveElementIdFromObject(object: THREE.Object3D | null) {
  let current: THREE.Object3D | null = object
  while (current) {
    if ((current as any).userData?.__annotationHighlightOverlay) {
      current = current.parent
      continue
    }
    const name = String(current.name || '')
    if (name && /^[0-9A-Za-z_$]{22}$/.test(name)) return name
    const id = guessIfcId((current as any).userData)
    if (id) return id
    current = current.parent
  }
  return undefined
}

function pickComponentInfoFromData(data: any) {
  if (!data || typeof data !== 'object') return null
  const name =
    typeof data.label === 'string'
      ? data.label.trim()
      : typeof data.name === 'string'
        ? data.name.trim()
        : typeof data.displayName === 'string'
          ? data.displayName.trim()
          : ''
  const type =
    typeof data.type === 'string'
      ? data.type
      : typeof data.ifcType === 'string'
        ? data.ifcType
        : ''
  const stepId = data.stepId ?? data.stepID ?? data.expressID ?? data.expressId
  const id =
    stepId ??
    data.elementId ??
    data.elementID ??
    data.id ??
    data.ID ??
    data.globalId ??
    data.GlobalId ??
    data.GUID ??
    data.guid
  if (name || type || id !== undefined) {
    return { id, name, type }
  }
  return null
}

function resolveComponentInfoFromObject(object: THREE.Object3D | null) {
  let current: THREE.Object3D | null = object
  while (current) {
    if ((current as any).userData?.__annotationHighlightOverlay) {
      current = current.parent
      continue
    }
    const data = (current as any).userData
    const info =
      pickComponentInfoFromData(data) ||
      pickComponentInfoFromData(data?.node) ||
      pickComponentInfoFromData(data?.meta) ||
      pickComponentInfoFromData(data?.element) ||
      pickComponentInfoFromData(data?.data)
    if (info) return info
    current = current.parent
  }
  return null
}

function resolveHighlightMeshFromHit(object: THREE.Object3D | null) {
  let current: THREE.Object3D | null = object
  while (current) {
    if ((current as any).userData?.__annotationHighlightOverlay) {
      current = current.parent
      continue
    }
    if ((current as any).isMesh) return current as THREE.Mesh
    current = current.parent
  }
  return null
}

function applyAnnotationMarkerStyle(
  status?: string,
  marker?: THREE.Group | null,
) {
  const target = marker ?? annotationMarker
  if (!target) return
  const outerMaterial = target.userData.outerMaterial as
    | THREE.MeshBasicMaterial
    | undefined
  if (!outerMaterial) return
  outerMaterial.color.setHex(markerColors[resolveAnnotationStatus(status)])
}

function applyAnnotationMarkerScale(
  marker: THREE.Group | null,
  highlighted?: boolean,
) {
  if (!marker) return
  const isHighlighted = highlighted ?? Boolean(marker.userData.highlighted)
  marker.userData.highlighted = isHighlighted
  marker.visible = props.annotationMarkersVisible !== false
  if (!marker.userData.worldRadius) {
    const distance = Math.max(
      camera?.position.distanceTo(marker.position) ?? 1,
      camera?.near ? camera.near * 2 : 0.1,
      0.1,
    )
    const viewportHeight = Math.max(overlayViewportRef.value?.clientHeight || 1, 1)
    const worldUnitsPerPixel = camera
      ? (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * distance) /
        viewportHeight
      : 0.01
    marker.userData.worldRadius = Math.max(worldUnitsPerPixel * 6, 0.002)
  }
  marker.scale.setScalar(
    (marker.userData.worldRadius / annotationMarkerBaseRadius) *
      (isHighlighted ? 1.3 : 1),
  )
}

function buildAnnotationMarker() {
  const outerGeometry = new THREE.SphereGeometry(
    annotationMarkerBaseRadius,
    18,
    18,
  )
  const innerGeometry = new THREE.SphereGeometry(
    annotationMarkerBaseRadius * 0.55,
    18,
    18,
  )
  const outerMaterial = new THREE.MeshBasicMaterial({ color: 0x2f6bff })
  const innerMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff })
  outerMaterial.depthTest = false
  outerMaterial.depthWrite = false
  innerMaterial.depthTest = false
  innerMaterial.depthWrite = false

  const outerMesh = new THREE.Mesh(outerGeometry, outerMaterial)
  const innerMesh = new THREE.Mesh(innerGeometry, innerMaterial)
  outerMesh.renderOrder = 10001
  innerMesh.renderOrder = 10002
  outerMesh.frustumCulled = false
  innerMesh.frustumCulled = false

  const group = new THREE.Group()
  group.name = 'annotation-marker'
  group.renderOrder = 10000
  group.frustumCulled = false
  group.userData.outerMaterial = outerMaterial
  group.userData.isAnnotationMarker = true
  group.userData.highlighted = false
  group.add(outerMesh, innerMesh)
  return group
}

function getOverlayMarkerStyle(marker: AnnotationOverlayMarker) {
  return {
    left: `${marker.left}px`,
    top: `${marker.top}px`,
    '--marker-color': marker.color,
    '--marker-size': `${marker.size}px`,
  }
}

function projectPointToViewport(
  point: THREE.Vector3,
  viewportWidth: number,
  viewportHeight: number,
) {
  if (!camera || viewportWidth <= 0 || viewportHeight <= 0) return null
  const projected = point.clone().project(camera)
  if (
    !Number.isFinite(projected.x) ||
    !Number.isFinite(projected.y) ||
    !Number.isFinite(projected.z)
  ) {
    return null
  }
  const left = ((projected.x + 1) / 2) * viewportWidth
  const top = ((1 - projected.y) / 2) * viewportHeight
  const margin = 24
  const visible =
    projected.z >= -1 &&
    projected.z <= 1 &&
    left >= -margin &&
    left <= viewportWidth + margin &&
    top >= -margin &&
    top <= viewportHeight + margin
  if (!visible) return null
  return { left, top }
}

function buildGaussianOverlayMarker(
  marker: THREE.Group,
  key: string,
  options: {
    current?: boolean
    highlighted?: boolean
    synced?: boolean
  } = {},
) {
  if (!overlayViewportRef.value) return null

  const projected = projectPointToViewport(
    marker.position,
    overlayViewportRef.value.clientWidth || 0,
    overlayViewportRef.value.clientHeight || 0,
  )
  if (!projected) return null
  if (props.annotationMarkersVisible === false) return null
  const distance = Math.max(
    camera?.position.distanceTo(marker.position) ?? 1,
    camera?.near ? camera.near * 2 : 0.1,
    0.1,
  )

  const resolvedStatus = resolveAnnotationStatus(
    marker.userData.annotationStatus as string | undefined,
  )
  const highlighted =
    options.highlighted ?? Boolean(marker.userData.highlighted)
  return {
    key,
    left: projected.left,
    top: projected.top,
    size: Math.min(48, Math.max(6, (120 / distance) * (highlighted ? 1.3 : 1))),
    color: markerColorCss[resolvedStatus],
    highlighted,
    current: Boolean(options.current),
    synced: Boolean(options.synced),
  }
}

function syncGaussianAnnotationOverlays() {
  if (!overlayViewportRef.value) {
    currentGaussianAnnotationOverlay.value = null
    gaussianAnnotationOverlayMarkers.value = []
    return
  }

  const currentKey =
    (annotationMarker?.userData.annotationKey as string | undefined) ??
    'gaussian-current'
  currentGaussianAnnotationOverlay.value =
    annotationMarker && props.annotationPoint
      ? buildGaussianOverlayMarker(annotationMarker, currentKey, {
          current: true,
          highlighted: props.annotationHighlightCurrent,
        })
      : null

  const nextMarkers: AnnotationOverlayMarker[] = []
  for (const [key, marker] of annotationStashMarkerMap) {
    const overlay = buildGaussianOverlayMarker(marker, key, {
      highlighted: Boolean(marker.userData.highlighted),
      synced: Boolean(marker.userData.isSynced),
    })
    if (overlay) nextMarkers.push(overlay)
  }
  gaussianAnnotationOverlayMarkers.value = nextMarkers
}

function ensureAnnotationLayer() {
  if (!contentGroup) return
  if (!annotationLayer) {
    annotationLayer = new THREE.Group()
    annotationLayer.name = 'annotation-layer'
    contentGroup.add(annotationLayer)
  }
}

function parseAnnotationSourceFromKey(
  key?: string | null,
): AnnotationSource | null {
  if (!key) return null
  const [source] = key.split(':')
  if (
    source === 'bim' ||
    source === 'pointcloud' ||
    source === 'gaussian' ||
    source === 'consistencyResult'
  ) {
    return source
  }
  return null
}

function buildAnnotationKey(
  point?: { x: number; y: number; z: number } | null,
  source?: AnnotationSource | null,
) {
  if (!point || !source) return ''
  const fmt = (value: number) => Number(value).toFixed(3)
  return `${source}:${fmt(point.x)},${fmt(point.y)},${fmt(point.z)}`
}

function setAnnotationMarker(
  point: THREE.Vector3 | null,
  source?: AnnotationSource | null,
) {
  ensureAnnotationLayer()
  if (!annotationLayer) return
  if (!point) {
    if (annotationMarker) {
      annotationLayer.remove(annotationMarker)
      disposeObject3D(annotationMarker)
      annotationMarker = null
    }
    syncGaussianAnnotationOverlays()
    requestRender()
    return
  }

  if (!annotationMarker) {
    annotationMarker = buildAnnotationMarker()
    annotationLayer.add(annotationMarker)
  }

  annotationMarker.position.copy(point)
  annotationMarker.userData.worldRadius = undefined
  applyAnnotationMarkerStyle(props.annotationStatus, annotationMarker)
  applyAnnotationMarkerScale(annotationMarker, props.annotationHighlightCurrent)

  const key = buildAnnotationKey(
    { x: point.x, y: point.y, z: point.z },
    source ?? props.annotationSource ?? null,
  )
  if (key) {
    annotationMarker.userData.annotationKey = key
    annotationMarker.userData.annotationSource =
      parseAnnotationSourceFromKey(key)
  } else {
    delete annotationMarker.userData.annotationKey
    delete annotationMarker.userData.annotationSource
  }

  requestRender()
  syncGaussianAnnotationOverlays()
}

function ensureAnnotationStashGroup() {
  ensureAnnotationLayer()
  if (!annotationLayer) return
  if (!annotationStashGroup) {
    annotationStashGroup = new THREE.Group()
    annotationStashGroup.name = 'annotation-stash-group'
    annotationLayer.add(annotationStashGroup)
  }
}

function syncAnnotationStashMarkers(
  markers: {
    key: string
    point: { x: number; y: number; z: number }
    status: 'default' | 'editing' | 'saved'
    highlighted: boolean
    synced: boolean
    source?: AnnotationSource
  }[] = [],
) {
  if (!contentGroup) return
  ensureAnnotationStashGroup()
  const nextKeys = new Set(markers.map((item) => item.key))

  for (const [key, marker] of annotationStashMarkerMap) {
    if (nextKeys.has(key)) continue
    annotationStashGroup?.remove(marker)
    disposeObject3D(marker)
    annotationStashMarkerMap.delete(key)
  }

  markers.forEach((item) => {
    let marker = annotationStashMarkerMap.get(item.key)
    if (!marker) {
      marker = buildAnnotationMarker()
      marker.userData.annotationKey = item.key
      marker.userData.annotationSource =
        item.source ?? parseAnnotationSourceFromKey(item.key)
      annotationStashMarkerMap.set(item.key, marker)
      annotationStashGroup?.add(marker)
    }
    marker.userData.isSynced = item.synced
    marker.userData.highlighted = item.highlighted
    marker.position.set(item.point.x, item.point.y, item.point.z)
    marker.userData.worldRadius = undefined
    applyAnnotationMarkerScale(marker, item.highlighted)
    applyAnnotationMarkerStyle(item.status, marker)
    marker.userData.annotationStatus = item.status
  })

  syncGaussianAnnotationOverlays()
  requestRender()
}

function refreshAnnotationMarkerScales() {
  applyAnnotationMarkerScale(annotationMarker)
  for (const marker of annotationStashMarkerMap.values()) {
    applyAnnotationMarkerScale(marker)
  }
  syncGaussianAnnotationOverlays()
}

function resolveAnnotationMarkerFromHit(object: THREE.Object3D | null) {
  let current: THREE.Object3D | null = object
  while (current) {
    if (current.userData?.isAnnotationMarker) {
      return current as THREE.Group
    }
    current = current.parent
  }
  return null
}

function getPickOffset() {
  return Math.max(0.005, contentMaxDim * 0.002)
}

function applyPickOffset(point: THREE.Vector3) {
  return point
    .clone()
    .addScaledVector(annotationRaycaster.ray.direction, -getPickOffset())
}

function syncRendererSize() {
  if (!renderer || !camera || !overlayViewportRef.value) return false
  const rect = overlayViewportRef.value.getBoundingClientRect()
  const width = Math.max(1, Math.floor(rect.width || 1))
  const height = Math.max(1, Math.floor(rect.height || 1))
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap)
  const canvasWidth = Math.floor(width * dpr)
  const canvasHeight = Math.floor(height * dpr)

  if (
    renderer.domElement.width === canvasWidth &&
    renderer.domElement.height === canvasHeight
  ) {
    return false
  }

  renderer.setPixelRatio(dpr)
  renderer.setSize(width, height)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  return true
}

function requestRender() {
  needsRender = true
  if (isRendering) return
  isRendering = true
  animationId = requestAnimationFrame(renderScene)
}

function renderScene() {
  if (!renderer || !scene || !camera || !rendererReady) {
    isRendering = false
    animationId = 0
    return
  }

  try {
    const resized = syncRendererSize()
    const didMove = updateFirstPersonMovement(performance.now())
    const didUpdate = controls?.update() ?? false
    camera.updateMatrixWorld()
    if (didMove || didUpdate) {
      syncPointcloudPose(true)
    }
    refreshAnnotationMarkerScales()

    let lccRequestedFrame = false
    if (
      lccObject &&
      (shouldShowGaussian() || isGaussianLoading.value) &&
      typeof lccObject.checkRenderNextFrame === 'function'
    ) {
      lccRequestedFrame = Boolean(lccObject.checkRenderNextFrame())
    }
    if (
      LCCRender?.update &&
      (shouldShowGaussian() || isGaussianLoading.value)
    ) {
      LCCRender.update()
    }

    const isActiveLoading =
      isPointcloudLoading.value || isBimLoading.value || isGaussianLoading.value

    if (
      needsRender ||
      resized ||
      didMove ||
      didUpdate ||
      isActiveLoading ||
      lccRequestedFrame
    ) {
      renderer.render(scene, camera)
      needsRender = false
    }

    if (
      needsRender ||
      resized ||
      didMove ||
      didUpdate ||
      isActiveLoading ||
      lccRequestedFrame
    ) {
      animationId = requestAnimationFrame(renderScene)
    } else {
      isRendering = false
      animationId = 0
    }
  } catch (error) {
    isRendering = false
    animationId = 0
  }
}

async function initOverlay() {
  if (!overlayViewportRef.value) return
  if (renderer && rendererReady) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    if (!overlayViewportRef.value) return

    const width = overlayViewportRef.value.clientWidth || 1
    const height = overlayViewportRef.value.clientHeight || 1

    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100000)
    camera.position.set(0, 10, 20)

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
      alpha: true,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap))
    renderer.setSize(width, height)
    renderer.setClearColor(new THREE.Color(defaultBgColor), overlayBgAlpha)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    overlayViewportRef.value.appendChild(renderer.domElement)

    controls = new OrbitControls(camera, renderer.domElement)
    updateNormalControlsConfig()
    controls.addEventListener('change', () => {
      if (applyingNormalModePose) return
      if (firstPersonActive.value) {
        syncFirstPersonRotationFromCamera()
      } else {
        applyNormalModeStationaryPose()
      }
      syncPointcloudPose(true)
      emitCameraPoseChange()
      requestRender()
    })

    const ambient = new THREE.AmbientLight(0xffffff, 0.7)
    const dir = new THREE.DirectionalLight(0xffffff, 0.9)
    dir.position.set(10, 10, 10)
    scene.add(ambient, dir)

    contentGroup = new THREE.Group()
    contentGroup.name = 'mix-overlay-content-group'
    scene.add(contentGroup)

    if (!annotationEventsBound) {
      renderer.domElement.addEventListener(
        'pointerdown',
        handleAnnotationPointerDown,
      )
      renderer.domElement.addEventListener(
        'pointerdown',
        handleFirstPersonPointerDown,
      )
      renderer.domElement.addEventListener(
        'pointermove',
        handleAnnotationPointerMove,
      )
      renderer.domElement.addEventListener(
        'pointermove',
        handleFirstPersonPointerMove,
      )
      renderer.domElement.addEventListener(
        'pointerup',
        handleAnnotationPointerUp,
      )
      renderer.domElement.addEventListener(
        'pointerup',
        handleFirstPersonPointerUp,
      )
      renderer.domElement.addEventListener(
        'pointercancel',
        handleAnnotationPointerUp,
      )
      renderer.domElement.addEventListener(
        'pointercancel',
        handleFirstPersonPointerUp,
      )
      annotationEventsBound = true
    }

    if (!resizeObserver && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (syncRendererSize()) {
          requestRender()
        }
      })
      resizeObserver.observe(overlayViewportRef.value)
    }

    rendererReady = true
    rememberSpawnPose({
      camera: camera.position.clone(),
      target: controls.target.clone(),
    })
    applyViewModeState()
    syncAnnotationStashMarkers(props.annotationStashMarkers ?? [])
    if (props.annotationPoint) {
      setAnnotationMarker(
        new THREE.Vector3(
          props.annotationPoint.x,
          props.annotationPoint.y,
          props.annotationPoint.z,
        ),
        props.annotationSource ?? null,
      )
    } else {
      setAnnotationMarker(null)
    }
    emitCameraPoseChange()
    requestRender()
  })()

  await initPromise
}

function clearBim() {
  if (bimObject && contentGroup) {
    contentGroup.remove(bimObject)
    disposeObject3D(bimObject)
  }
  const wasLoaded = bimLoaded.value
  bimObject = null
  bimLoaded.value = false
  isBimLoading.value = false
  if (wasLoaded) {
    emitBimLoadedChange(false)
  }
  clearHighlight()
  updateContentMetrics()
  updateStatusText()
}

async function loadBim(
  projectId: number,
  scanFileId: number,
  bimFileId: number,
  loadToken: number,
) {
  if (!contentGroup) return

  clearBim()
  isBimLoading.value = true
  updateStatusText()
  requestRender()

  try {
    const alignmentRes = await getBimAlignment(projectId, scanFileId, bimFileId)
    if (loadToken !== lastLoadToken) return
    if (alignmentRes?.code !== 200 || !alignmentRes.data) {
      throw new Error(alignmentRes?.msg || '获取 BIM 校准矩阵失败')
    }

    const alignmentMatrix = buildAlignmentMatrix(alignmentRes.data)
    const inverseAlignmentMatrix = alignmentMatrix.clone().invert()
    const bimWorldMatrix = new THREE.Matrix4()
      .copy(zUpToYUpMatrix)
      .multiply(inverseAlignmentMatrix)

    const blob = await getIfcGlbFile(projectId, bimFileId)
    if (loadToken !== lastLoadToken) return

    const root = await loadGltfRootFromBlob(blob)
    if (loadToken !== lastLoadToken) {
      disposeObject3D(root)
      return
    }

    root.matrixAutoUpdate = false
    root.matrix.copy(bimWorldMatrix)
    root.matrixWorldNeedsUpdate = true
    root.visible = shouldShowBim()
    bimObject = root
    contentGroup.add(root)
    root.updateMatrixWorld(true)
    applyBimOpacity()

    bimLoaded.value = true
    isBimLoading.value = false
    emitBimLoadedChange(true)
    updateContentMetrics()
    updateStatusText()
    requestRender()
  } catch (error: any) {
    if (loadToken !== lastLoadToken) return
    clearBim()
    statusText.value = error?.message || 'BIM 加载失败'
    requestRender()
  }
}

function clearGaussian() {
  clearGaussianQualityUpgradeTimer()
  if (lccObject && LCCRender) {
    runSafely('LCC卸载', () => {
      LCCRender.unload(lccObject)
    })
  }
  const wasLoaded = gaussianLoaded.value
  lccObject = null
  gaussianLoaded.value = false
  isGaussianLoading.value = false
  if (wasLoaded) {
    emitGaussianLoadedChange(false)
  }
  disposeLccManager()
  updateStatusText()
}

function clearGaussianQualityUpgradeTimer() {
  if (gaussianQualityUpgradeTimer === null) return
  window.clearTimeout(gaussianQualityUpgradeTimer)
  gaussianQualityUpgradeTimer = null
}

function getGaussianQualityDistance(stage: 'first-screen' | 'enhanced') {
  const stageDistance =
    stage === 'enhanced'
      ? GAUSSIAN_ENHANCED_SCREEN_MAX_DISTANCE
      : GAUSSIAN_FIRST_SCREEN_MAX_DISTANCE
  return Math.max(stageDistance, contentMaxDim * 20)
}

function applyGaussianQuality(
  stage: 'first-screen' | 'enhanced',
  loadToken: number,
) {
  if (!lccObject) return

  const maxSplats =
    stage === 'enhanced'
      ? GAUSSIAN_ENHANCED_SCREEN_MAX_SPLATS
      : GAUSSIAN_FIRST_SCREEN_MAX_SPLATS
  const maxDistance = getGaussianQualityDistance(stage)

  if (typeof lccObject?.setMaxSplats === 'function') {
    lccObject.setMaxSplats(maxSplats)
  }
  if (typeof lccObject?.setMaxDistance === 'function') {
    lccObject.setMaxDistance(maxDistance)
  }
  if (typeof lccObject?.setLodAutoLevelUp === 'function') {
    lccObject.setLodAutoLevelUp(true)
  }

  requestRender()
}

function scheduleGaussianQualityUpgrade(loadToken: number) {
  clearGaussianQualityUpgradeTimer()
  gaussianQualityUpgradeTimer = window.setTimeout(() => {
    gaussianQualityUpgradeTimer = null
    if (loadToken !== lastLoadToken || !gaussianLoaded.value || !lccObject) {
      return
    }
    applyGaussianQuality('enhanced', loadToken)
  }, GAUSSIAN_QUALITY_UPGRADE_DELAY)
}

async function loadGaussian(loadToken: number) {
  if (!scene || !camera || !renderer) return

  const dataPath = resolveGaussianDataPath()
  if (!dataPath) {
    if (gaussianLoaded.value) {
      emitGaussianLoadedChange(false)
    }
    gaussianLoaded.value = false
    statusText.value = '未绑定高斯文件'
    return
  }

  isGaussianLoading.value = true
  if (gaussianLoaded.value) {
    emitGaussianLoadedChange(false)
  }
  gaussianLoaded.value = false
  updateStatusText()
  requestRender()

  lccObject = (LCCRender as any).load(
    {
      camera,
      scene,
      dataPath,
      renderLib: THREE,
      canvas: renderer.domElement,
      renderer,
      useEnv: false,
      useIndexDB: true,
      useLoadingEffect: false,
      modelMatrix: zUpToYUpMatrix.clone(),
      appKey: null,
      maxHostCacheSize: 512,
      maxGpuCacheSize: 512,
    },
    () => {
      if (loadToken !== lastLoadToken) return
      gaussianLoaded.value = true
      isGaussianLoading.value = false
      emitGaussianLoadedChange(true)
      updateContentMetrics()
      updateStatusText()

      applyGaussianQuality('first-screen', loadToken)
      scheduleGaussianQualityUpgrade(loadToken)

      requestRender()
    },
    () => {
      if (loadToken !== lastLoadToken) return
      requestRender()
    },
    (error: any) => {
      if (loadToken !== lastLoadToken) return
      if (gaussianLoaded.value) {
        emitGaussianLoadedChange(false)
      }
      gaussianLoaded.value = false
      isGaussianLoading.value = false
      statusText.value = '高斯加载失败'
      requestRender()
    },
  )
}

async function loadPointcloudLayer() {
  const viewer = pointcloudRef.value
  if (!viewer) return

  if (!shouldShowPointcloud() || !props.projectId || !props.scanFileId) {
    viewer.cleanup?.()
    if (pointcloudLoaded.value) {
      emitPointcloudLoadedChange(false)
    }
    pointcloudLoaded.value = false
    isPointcloudLoading.value = false
    updateStatusText()
    return
  }

  const loadToken = ++pointcloudLoadToken
  const overlayPose = getOverlayPose()
  if (overlayPose) {
    pendingExternalPose = {
      camera: overlayPose.camera.clone(),
      target: overlayPose.target.clone(),
    }
  }
  if (pointcloudLoaded.value) {
    emitPointcloudLoadedChange(false)
  }
  pointcloudLoaded.value = false
  isPointcloudLoading.value = true
  updateStatusText()

  await nextTick()
  if (loadToken !== pointcloudLoadToken) return

  try {
    await viewer.loadPointcloudByScanId?.(props.projectId, props.scanFileId)
  } catch (error) {
    if (loadToken !== pointcloudLoadToken) return
    if (pointcloudLoaded.value) {
      emitPointcloudLoadedChange(false)
    }
    pointcloudLoaded.value = false
    isPointcloudLoading.value = false
    statusText.value = '点云加载失败'
  }
}

async function applyPointcloudVisibilityState() {
  await nextTick()
  await loadPointcloudLayer()
  updateStatusText()
  requestRender()
}

async function applyBimVisibilityState() {
  await nextTick()

  if (bimObject) {
    applyBimOpacity()
    if (!shouldShowBim()) {
      clearHighlight()
    }
    updateStatusText()
    requestRender()
    return
  }

  if (
    shouldShowBim() &&
    props.projectId &&
    props.scanFileId &&
    props.bimFileId &&
    !bimLoaded.value &&
    !isBimLoading.value &&
    !bimObject
  ) {
    await loadBim(
      props.projectId,
      props.scanFileId,
      props.bimFileId,
      lastLoadToken,
    )
  }

  updateStatusText()
  requestRender()
}

async function applyGaussianVisibilityState() {
  await nextTick()

  if (!shouldShowGaussian()) {
    if (lccObject || gaussianLoaded.value) {
      clearGaussian()
    }
  } else if (
    props.projectId &&
    props.gaussFileId &&
    !gaussianLoaded.value &&
    !isGaussianLoading.value &&
    !lccObject
  ) {
    await loadGaussian(lastLoadToken)
  }

  updateStatusText()
  requestRender()
}

async function loadScene() {
  await initOverlay()
  await nextTick()

  const projectId = props.projectId ?? null
  const scanFileId = props.scanFileId ?? null
  const bimFileId = props.bimFileId ?? null
  const gaussFileId = props.gaussFileId ?? null

  clearBim()
  clearGaussian()

  if (!projectId || !scanFileId) {
    pointcloudRef.value?.cleanup?.()
    pointcloudLoaded.value = false
    bimLoaded.value = false
    gaussianLoaded.value = false
    isPointcloudLoading.value = false
    isBimLoading.value = false
    isGaussianLoading.value = false
    statusText.value = '请选择项目和扫描后加载融合场景'
    requestRender()
    return
  }

  const loadToken = ++lastLoadToken

  await loadPointcloudLayer()

  if (shouldShowBim() && bimFileId) {
    await loadBim(projectId, scanFileId, bimFileId, loadToken)
  }

  if (shouldShowGaussian() && gaussFileId) {
    await loadGaussian(loadToken)
  }

  updateContentMetrics()
  updateStatusText()
  requestRender()
}

function pickGaussianWorldPoint(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
) {
  const maxDistance = Math.max(camera?.far ?? 100000, contentMaxDim * 200)
  const radius = Math.max(contentMaxDim * 0.001, 0.01)
  return raycastGaussianFromOrigin(origin, direction, maxDistance, radius)
}

function pickAnnotationPoint(event: PointerEvent) {
  if (!camera || !renderer) return null

  const rect = renderer.domElement.getBoundingClientRect()
  if (!rect.width || !rect.height) return null

  annotationPointer.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  )
  camera.updateMatrixWorld(true)
  annotationRaycaster.setFromCamera(annotationPointer, camera)

  if (props.annotationMarkersVisible !== false && annotationMarker?.visible) {
    const markerHits = annotationRaycaster.intersectObject(
      annotationMarker,
      true,
    )
    if (markerHits.length > 0) {
      const key = annotationMarker.userData.annotationKey as string | undefined
      const source =
        annotationMarker.userData.annotationSource ||
        parseAnnotationSourceFromKey(key) ||
        props.annotationSource ||
        'bim'
      return { point: annotationMarker.position.clone(), key, source }
    }
  }

  if (props.annotationMarkersVisible !== false && annotationStashGroup) {
    const stashHits = annotationRaycaster.intersectObject(
      annotationStashGroup,
      true,
    )
    if (stashHits.length > 0) {
      const markerGroup = resolveAnnotationMarkerFromHit(stashHits[0].object)
      if (markerGroup) {
        const key = markerGroup.userData.annotationKey as string | undefined
        const source =
          markerGroup.userData.annotationSource ||
          parseAnnotationSourceFromKey(key) ||
          props.annotationSource ||
          'bim'
        return {
          point: markerGroup.position.clone(),
          key,
          source,
          synced: Boolean(markerGroup.userData.isSynced),
        }
      }
    }
  }

  const candidates: Array<{
    source: AnnotationSource
    point: THREE.Vector3
    distance: number
    object?: THREE.Object3D | null
  }> = []

  if (shouldShowBim() && bimObject) {
    const bimHits = annotationRaycaster.intersectObject(bimObject, true)
    if (bimHits.length > 0) {
      candidates.push({
        source: 'bim',
        point: bimHits[0].point.clone(),
        distance: bimHits[0].distance,
        object: bimHits[0].object,
      })
    }
  }

  const pointcloudPick =
    shouldShowPointcloud() && pointcloudLoaded.value
      ? (pointcloudRef.value?.pickPointFromScreen?.(
          event.clientX,
          event.clientY,
        ) ?? null)
      : null
  if (pointcloudPick) {
    const point = new THREE.Vector3(
      pointcloudPick.x,
      pointcloudPick.y,
      pointcloudPick.z,
    )
    candidates.push({
      source: 'pointcloud',
      point,
      distance: annotationRaycaster.ray.origin.distanceTo(point),
    })
  }

  const consistencyPick =
    shouldShowConsistencyResult() &&
    consistencyResultReadyState.value === 'loaded'
      ? (consistencyResultRef.value?.pickPointFromScreen?.(
          event.clientX,
          event.clientY,
        ) ?? null)
      : null
  if (consistencyPick) {
    const point = new THREE.Vector3(
      consistencyPick.x,
      consistencyPick.y,
      consistencyPick.z,
    )
    candidates.push({
      source: 'consistencyResult',
      point,
      distance: annotationRaycaster.ray.origin.distanceTo(point),
    })
  }

  const gaussianHit = pickGaussianWorldPoint(
    annotationRaycaster.ray.origin,
    annotationRaycaster.ray.direction,
  )
  if (gaussianHit) {
    candidates.push({
      source: 'gaussian',
      point: gaussianHit,
      distance: annotationRaycaster.ray.origin.distanceTo(gaussianHit),
    })
  }

  if (!candidates.length) {
    clearHighlight()
    return null
  }

  const best = candidates.reduce((current, next) =>
    next.distance < current.distance ? next : current,
  )

  let componentInfo: {
    id?: string | number
    name?: string
    type?: string
  } | null = null

  if (best.source === 'bim') {
    const mesh = resolveHighlightMeshFromHit(best.object ?? null)
    const elementId = resolveElementIdFromObject(best.object ?? null)
    componentInfo = resolveComponentInfoFromObject(best.object ?? null)
    if (mesh) {
      highlightMesh(mesh, highlightColor)
    } else {
      clearHighlight()
    }
    if (elementId) {
      componentInfo = componentInfo
        ? { ...componentInfo, id: componentInfo.id ?? elementId }
        : { id: elementId }
    }
  } else {
    clearHighlight()
  }

  return {
    point: applyPickOffset(best.point),
    source: best.source,
    componentInfo,
  }
}

function handleFirstPersonPointerDown(event: PointerEvent) {
  if (!firstPersonActive.value || event.button !== 0) return
  firstPersonPointerId = event.pointerId
  firstPersonPointerDown = { x: event.clientX, y: event.clientY }
  renderer?.domElement.setPointerCapture?.(event.pointerId)
}

function handleFirstPersonPointerMove(event: PointerEvent) {
  if (!firstPersonActive.value || !firstPersonPointerDown) return

  const deltaX = event.clientX - firstPersonPointerDown.x
  const deltaY = event.clientY - firstPersonPointerDown.y
  if (deltaX === 0 && deltaY === 0) return

  firstPersonPointerDown = { x: event.clientX, y: event.clientY }
  applyFirstPersonRotationDelta(deltaX, deltaY)
}

function clearFirstPersonPointerState() {
  if (firstPersonPointerId !== null) {
    try {
      renderer?.domElement.releasePointerCapture?.(firstPersonPointerId)
    } catch {
      // ignore stale pointer capture
    }
  }
  firstPersonPointerId = null
  firstPersonPointerDown = null
}

function handleFirstPersonPointerUp() {
  clearFirstPersonPointerState()
}

function handleAnnotationPointerDown(event: PointerEvent) {
  if (firstPersonActive.value) return
  if (!props.annotationEnabled) return
  if (
    !bimLoaded.value &&
    !pointcloudLoaded.value &&
    !gaussianLoaded.value &&
    consistencyResultReadyState.value !== 'loaded'
  ) {
    return
  }
  if (event.button !== 0) return
  annotationPointerDown = { x: event.clientX, y: event.clientY }
  annotationPointerDragging = false
  annotationPointerId = event.pointerId
  renderer?.domElement.setPointerCapture?.(event.pointerId)
}

function handleAnnotationPointerMove(event: PointerEvent) {
  if (firstPersonActive.value) return
  if (!annotationPointerDown) return
  const dx = event.clientX - annotationPointerDown.x
  const dy = event.clientY - annotationPointerDown.y
  if (dx * dx + dy * dy > 16) {
    annotationPointerDragging = true
  }
}

function handleAnnotationPointerUp(event: PointerEvent) {
  if (firstPersonActive.value) return
  if (!annotationPointerDown) return
  if (annotationPointerId !== null) {
    renderer?.domElement.releasePointerCapture?.(annotationPointerId)
  }
  annotationPointerId = null
  const wasDragging = annotationPointerDragging
  annotationPointerDown = null
  annotationPointerDragging = false
  if (wasDragging) return
  if (!props.annotationEnabled) return
  if (
    !bimLoaded.value &&
    !pointcloudLoaded.value &&
    !gaussianLoaded.value &&
    consistencyResultReadyState.value !== 'loaded'
  ) {
    return
  }
  if (event.button !== 0) return

  const result = pickAnnotationPoint(event)
  if (!result) {
    if (props.annotationPersist) return
    emit('annotation-pick', {
      point: null,
      screen: { x: event.clientX, y: event.clientY },
      source: 'bim',
    })
    setAnnotationMarker(null)
    return
  }

  emit('annotation-pick', {
    point: { x: result.point.x, y: result.point.y, z: result.point.z },
    screen: { x: event.clientX, y: event.clientY },
    source: result.source,
    key: result.key,
    synced: result.synced,
    componentInfo: result.componentInfo,
  })
  setAnnotationMarker(result.point, result.source)
}

function handleKeydown(event: KeyboardEvent) {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement ||
    (event.target instanceof HTMLElement && event.target.isContentEditable)
  ) {
    return
  }
  if (!firstPersonActive.value) return
  if (!hasMixKeyboardFocus()) return

  switch (event.key.toLowerCase()) {
    case 'w':
      event.preventDefault()
      activeFirstPersonMoveDirections.add('up')
      requestRender()
      break
    case 's':
      event.preventDefault()
      activeFirstPersonMoveDirections.add('down')
      requestRender()
      break
    case 'a':
      event.preventDefault()
      activeFirstPersonMoveDirections.add('left')
      requestRender()
      break
    case 'd':
      event.preventDefault()
      activeFirstPersonMoveDirections.add('right')
      requestRender()
      break
    case 'escape':
      event.preventDefault()
      setViewMode('normal')
      break
  }
}

function handleKeyup(event: KeyboardEvent) {
  switch (event.key.toLowerCase()) {
    case 'w':
      activeFirstPersonMoveDirections.delete('up')
      break
    case 's':
      activeFirstPersonMoveDirections.delete('down')
      break
    case 'a':
      activeFirstPersonMoveDirections.delete('left')
      break
    case 'd':
      activeFirstPersonMoveDirections.delete('right')
      break
  }
}

async function captureOverlayDataUrl() {
  if (!renderer || !scene || !camera) return null
  renderer.render(scene, camera)
  return {
    dataUrl: renderer.domElement.toDataURL('image/png'),
    rect: renderer.domElement.getBoundingClientRect(),
  }
}

async function mergeCaptureLayers(
  baseUrl?: string | null,
  overlayUrl?: string | null,
) {
  if (!baseUrl) return overlayUrl || null
  if (!overlayUrl) return baseUrl

  const loadImage = (url: string) =>
    new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })

  const [baseImage, overlayImage] = await Promise.all([
    loadImage(baseUrl),
    loadImage(overlayUrl),
  ])
  if (!baseImage || !overlayImage) return baseUrl

  const width = baseImage.naturalWidth || baseImage.width
  const height = baseImage.naturalHeight || baseImage.height
  if (!width || !height) return baseUrl

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return baseUrl

  ctx.drawImage(baseImage, 0, 0, width, height)
  ctx.drawImage(overlayImage, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}

async function captureAnnotationViews() {
  const pointcloudCapture = shouldShowPointcloud()
    ? await pointcloudRef.value?.forceCaptureDataUrl?.()
    : null
  const consistencyCapture =
    shouldShowConsistencyResult() &&
    consistencyResultReadyState.value === 'loaded'
      ? await consistencyResultRef.value?.forceCaptureDataUrl?.()
      : null

  const bimVisible = bimObject?.visible ?? false
  let bimUrl: string | null = null
  let gaussianUrl: string | null = null

  try {
    if (bimObject && shouldShowBim()) {
      bimObject.visible = true
      const capture = await captureOverlayDataUrl()
      bimUrl = capture?.dataUrl ?? null
    }
    if (shouldShowGaussian() && gaussianLoaded.value) {
      if (bimObject) bimObject.visible = false
      const capture = await captureOverlayDataUrl()
      gaussianUrl = capture?.dataUrl ?? null
    }
  } finally {
    if (bimObject) bimObject.visible = bimVisible
  }

  return {
    bim: bimUrl,
    pointcloud: pointcloudCapture?.dataUrl ?? null,
    gaussian: gaussianUrl,
    consistencyResult: consistencyCapture?.dataUrl ?? null,
  }
}

async function forceCaptureDataUrl() {
  const pointcloudCapture = shouldShowPointcloud()
    ? await pointcloudRef.value?.forceCaptureDataUrl?.()
    : null
  const overlayCapture = await captureOverlayDataUrl()

  const dataUrl = await mergeCaptureLayers(
    pointcloudCapture?.dataUrl ?? null,
    overlayCapture?.dataUrl ?? null,
  )
  if (!dataUrl) return null

  return {
    dataUrl,
    rect:
      pointcloudCapture?.rect ??
      overlayCapture?.rect ??
      renderer?.domElement.getBoundingClientRect()!,
  }
}

function getCameraPose() {
  return getOverlayPose()
}

function getViewMode() {
  return viewMode.value
}

function setCameraPose(
  pose: { camera: THREE.Vector3; target: THREE.Vector3 } | null,
  options?: { updateSpawnPose?: boolean },
) {
  if (!pose) return
  if (options?.updateSpawnPose) {
    rememberSpawnPose(pose)
  }
  pendingExternalPose =
    shouldShowPointcloud() && !pointcloudLoaded.value
      ? {
          camera: pose.camera.clone(),
          target: pose.target.clone(),
        }
      : null
  applyOverlayPose(pose, true, options)
}

async function resetView() {
  if (shouldShowPointcloud() && pointcloudRef.value?.resetView) {
    pointcloudRef.value.resetView()
    await nextTick()
    syncOverlayFromPointcloudPose()
    rememberSpawnPose()
    return
  }

  if (contentGroup && getVisibleModelCount() > 0) {
    fitCameraToObject(contentGroup)
    syncNormalModeAnchor()
    syncNormalRotationFromCamera()
    updateNormalCamera()
    rememberSpawnPose()
    requestRender()
    return
  }

  if (!camera || !controls) return
  controls.target.set(0, 0, 0)
  camera.position.set(0, 10, 20)
  camera.lookAt(0, 0, 0)
  controls.update()
  syncNormalModeAnchor()
  syncNormalRotationFromCamera()
  updateNormalCamera()
  rememberSpawnPose({
    camera: camera.position.clone(),
    target: controls.target.clone(),
  })
  requestRender()
}

function handlePointcloudLoaded(value: boolean) {
  pointcloudLoaded.value = value
  emitPointcloudLoadedChange(value)
  if (value) {
    isPointcloudLoading.value = false
    syncOverlayFromPointcloudPose()
    if (pendingExternalPose) {
      applyOverlayPose(
        {
          camera: pendingExternalPose.camera.clone(),
          target: pendingExternalPose.target.clone(),
        },
        true,
      )
      pendingExternalPose = null
    }
  } else if (!shouldShowPointcloud()) {
    isPointcloudLoading.value = false
  }
  updateStatusText()
}

function handleConsistencyResultLoaded(value: boolean) {
  consistencyResultLoaded.value = value
  emit('consistency-result-loaded-change', value)
  updateStatusText()
  requestRender()
}

function handleConsistencyResultReadyStateChange(
  value: 'pending' | 'loaded' | 'optional' | 'error',
) {
  consistencyResultReadyState.value = value
  emit('consistency-result-ready-state-change', value)
  updateStatusText()
  requestRender()
}

function cleanup() {
  lastLoadToken += 1
  pointcloudLoadToken += 1

  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = 0
  }

  runSafely('ResizeObserver清理', () => {
    resizeObserver?.disconnect()
  })
  resizeObserver = null

  pointcloudRef.value?.cleanup?.()
  clearBim()
  clearGaussian()

  if (annotationStashGroup) {
    for (const marker of annotationStashMarkerMap.values()) {
      annotationStashGroup.remove(marker)
      disposeObject3D(marker)
    }
    annotationStashMarkerMap.clear()
    annotationLayer?.remove(annotationStashGroup)
    annotationStashGroup = null
  }
  if (annotationMarker) {
    annotationLayer?.remove(annotationMarker)
    disposeObject3D(annotationMarker)
    annotationMarker = null
  }
  if (annotationLayer) {
    contentGroup?.remove(annotationLayer)
    annotationLayer = null
  }
  clearHighlight()

  runSafely('控制器释放', () => {
    controls?.dispose()
  })
  controls = null

  if (renderer) {
    const canvas = renderer.domElement
    if (annotationEventsBound) {
      runSafely('批注事件解绑', () => {
        canvas.removeEventListener('pointerdown', handleAnnotationPointerDown)
        canvas.removeEventListener('pointerdown', handleFirstPersonPointerDown)
        canvas.removeEventListener('pointermove', handleAnnotationPointerMove)
        canvas.removeEventListener('pointermove', handleFirstPersonPointerMove)
        canvas.removeEventListener('pointerup', handleAnnotationPointerUp)
        canvas.removeEventListener('pointerup', handleFirstPersonPointerUp)
        canvas.removeEventListener('pointercancel', handleAnnotationPointerUp)
        canvas.removeEventListener('pointercancel', handleFirstPersonPointerUp)
      })
      annotationEventsBound = false
    }
    runSafely('渲染器释放', () => {
      renderer?.dispose()
    })
    runSafely('WebGL上下文释放', () => {
      renderer?.forceContextLoss()
    })
    if (canvas.parentElement) {
      runSafely('Canvas节点移除', () => {
        canvas.parentElement?.removeChild(canvas)
      })
    }
  }

  scene = null
  camera = null
  renderer = null
  contentGroup = null
  rendererReady = false
  initPromise = null
  isRendering = false
  needsRender = false
  activeFirstPersonMoveDirections.clear()
  lastFirstPersonMoveAt = 0
  lastFirstPersonGroundHeight = null
  firstPersonEyeHeight.value = null
  normalModeAnchor = null
  normalModeLookDistance = firstPersonLookDistance
  applyingNormalModePose = false
  clearFirstPersonPointerState()
  trajectorySpawnPose = null
}

watch(
  () => [
    props.projectId,
    props.scanFileId,
    props.bimFileId,
    props.gaussFileId,
    normalizeGaussAssetPath(props.gaussAssetPath),
  ],
  () => {
    void loadScene()
  },
)

watch(
  () => shouldShowPointcloud(),
  () => {
    void applyPointcloudVisibilityState()
  },
)

watch(
  () => shouldShowBim(),
  () => {
    void applyBimVisibilityState()
  },
)

watch(
  () => shouldShowGaussian(),
  () => {
    void applyGaussianVisibilityState()
  },
)

watch(
  () => props.showConsistencyResult !== false,
  (visible) => {
    if (!visible) {
      consistencyResultLoaded.value = false
    }
    updateStatusText()
    requestRender()
  },
)

watch(
  () => props.bimOpacity,
  () => {
    applyBimOpacity()
  },
  { immediate: true },
)

watch(
  () => props.annotationPoint,
  (value) => {
    if (!value) {
      setAnnotationMarker(null)
      return
    }
    setAnnotationMarker(
      new THREE.Vector3(value.x, value.y, value.z),
      props.annotationSource ?? null,
    )
  },
  { immediate: true },
)

watch(
  () => props.annotationSource,
  () => {
    if (!annotationMarker || !props.annotationPoint) return
    const key = buildAnnotationKey(
      props.annotationPoint,
      props.annotationSource ?? null,
    )
    if (key) {
      annotationMarker.userData.annotationKey = key
      annotationMarker.userData.annotationSource =
        parseAnnotationSourceFromKey(key)
    }
  },
  { immediate: true },
)

watch(
  () => props.annotationStatus,
  (status) => {
    applyAnnotationMarkerStyle(status, annotationMarker)
    requestRender()
  },
  { immediate: true },
)

watch(
  () => props.annotationHighlightCurrent,
  (highlighted) => {
    applyAnnotationMarkerScale(annotationMarker, highlighted)
    requestRender()
  },
  { immediate: true },
)

watch(
  () => props.annotationMarkersVisible,
  () => {
    if (annotationMarker) annotationMarker.visible = props.annotationMarkersVisible !== false
    for (const marker of annotationStashMarkerMap.values()) {
      marker.visible = props.annotationMarkersVisible !== false
    }
    syncGaussianAnnotationOverlays()
    requestRender()
  },
  { immediate: true },
)

watch(
  () => props.annotationStashMarkers,
  (markers) => {
    syncAnnotationStashMarkers(markers ?? [])
  },
  { immediate: true, deep: true },
)

watch(viewMode, () => {
  applyViewModeState()
})

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('keyup', handleKeyup)
  await initOverlay()
  await loadScene()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('keyup', handleKeyup)
  cleanup()
})

defineExpose({
  forceCaptureDataUrl,
  captureAnnotationViews,
  getCameraPose,
  getConsistencyResultRef: () => consistencyResultRef.value,
  getViewMode,
  getPointcloudWorldMatrixArray,
  setCameraPose,
  setTrajectorySpawnPose,
})
</script>

<style scoped>
.mix-view-panel {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.mix-toolbar {
  position: absolute;
  top: 12px;
  left: 16px;
  right: 16px;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.mix-toolbar__inner {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 14px;
  min-height: 40px;
  padding: 5px 12px;
  border-radius: 0;
  background: linear-gradient(
    180deg,
    rgba(6, 10, 18, 0.88) 0%,
    rgba(10, 15, 24, 0.76) 55%,
    rgba(10, 15, 24, 0.58) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 14px 32px rgba(2, 6, 23, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(16px);
}

.mix-toolbar__section {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.mix-toolbar__section--mode,
.mix-toolbar__section--layers {
  flex: 1 1 0;
}

.mix-toolbar__section--actions {
  justify-content: flex-end;
}

.mix-toolbar__label {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: rgba(203, 213, 225, 0.76);
  white-space: nowrap;
}

.mix-toolbar__divider {
  width: 1px;
  align-self: stretch;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0),
    rgba(148, 163, 184, 0.24),
    rgba(255, 255, 255, 0)
  );
}

.mix-toolbar__icon-btn,
.mix-toolbar__mode-btn,
.mix-toolbar__layer-btn {
  border: 1px solid rgba(255, 255, 255, 0.08);
  outline: none;
  cursor: pointer;
  color: rgba(241, 245, 249, 0.9);
  background: rgba(255, 255, 255, 0.04);
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.mix-toolbar__tooltip-wrap {
  display: inline-flex;
}

.mix-toolbar__icon-btn {
  width: 30px;
  height: 30px;
  border-radius: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.mix-toolbar__action-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mix-toolbar__icon-btn:hover,
.mix-toolbar__mode-btn:hover,
.mix-toolbar__layer-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.14);
}

.mix-toolbar__layer-btn.is-disabled,
.mix-toolbar__layer-btn:disabled {
  cursor: not-allowed;
  color: rgba(148, 163, 184, 0.72);
  background: rgba(15, 23, 42, 0.2);
  border-color: rgba(148, 163, 184, 0.12);
  box-shadow: none;
  transform: none;
}

.mix-toolbar__layer-btn.is-disabled:hover,
.mix-toolbar__layer-btn:disabled:hover,
.mix-toolbar__layer-btn.is-disabled:active,
.mix-toolbar__layer-btn:disabled:active {
  background: rgba(15, 23, 42, 0.2);
  border-color: rgba(148, 163, 184, 0.12);
  transform: none;
}

.mix-toolbar__icon-btn.is-active,
.mix-toolbar__mode-btn.is-active,
.mix-toolbar__layer-btn.is-active {
  background: linear-gradient(
    180deg,
    rgba(18, 58, 89, 0.96) 0%,
    rgba(14, 90, 120, 0.86) 100%
  );
  border-color: rgba(96, 165, 250, 0.28);
  color: #f8fafc;
  box-shadow:
    0 0 0 1px rgba(96, 165, 250, 0.22) inset,
    0 10px 22px rgba(8, 47, 73, 0.28);
}

.mix-toolbar__icon-btn:active,
.mix-toolbar__mode-btn:active,
.mix-toolbar__layer-btn:active {
  transform: scale(0.96);
}

.mix-toolbar__icon-btn .el-icon,
.mix-toolbar__mode-btn .el-icon,
.mix-toolbar__layer-btn .el-icon {
  font-size: 14px;
}

.mix-toolbar__speed-btn {
  width: auto;
  min-width: 66px;
  padding: 0 8px;
  gap: 5px;
}

.mix-toolbar__speed-text {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.mix-toolbar__mode-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.mix-toolbar__mode-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 94px;
  height: 30px;
  padding: 0 10px;
  border-radius: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.mix-toolbar__layer-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.mix-toolbar__layer-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border-radius: 0;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.mix-stack {
  position: absolute;
  inset: 0;
}

.mix-pointcloud-layer,
.mix-consistency-layer,
.mix-overlay-layer {
  position: absolute;
  inset: 0;
}

.mix-pointcloud-layer {
  z-index: 1;
}

.mix-pointcloud-layer.is-hidden {
  visibility: hidden;
}

.mix-consistency-layer {
  z-index: 2;
  pointer-events: none;
}

.mix-consistency-layer.is-hidden {
  visibility: hidden;
}

.mix-overlay-layer {
  z-index: 3;
}

.mix-overlay-layer:focus {
  outline: none;
}

.mix-gaussian-annotation-overlay {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
}

.mix-gaussian-annotation-overlay__marker {
  position: absolute;
  width: var(--marker-size);
  height: var(--marker-size);
  margin-left: calc(var(--marker-size) / -2);
  margin-top: calc(var(--marker-size) / -2);
  border-radius: 50%;
  background: var(--marker-color);
  box-shadow: 0 0 0 1px rgba(14, 20, 34, 0.12);
  transform: translateZ(0);
}

.mix-gaussian-annotation-overlay__marker::after {
  content: '';
  position: absolute;
  inset: 22%;
  border-radius: 50%;
  background: #fff;
}

.mix-gaussian-annotation-overlay__marker.is-highlighted {
  box-shadow:
    0 0 0 1px rgba(14, 20, 34, 0.12),
    0 0 14px var(--marker-color);
}

.mix-gaussian-annotation-overlay__marker.is-synced {
  opacity: 0.92;
}

.mix-pointcloud-panel {
  width: 100%;
  height: 100%;
}

.mix-pointcloud-panel :deep(.panel-refresh-btn),
.mix-pointcloud-panel :deep(.empty-placeholder) {
  display: none;
}

.mix-pointcloud-panel :deep(.pointcloud-viewport),
.mix-pointcloud-panel :deep(.pointcloud-view-panel) {
  width: 100%;
  height: 100%;
}

.mix-consistency-panel {
  width: 100%;
  height: 100%;
}

.mix-consistency-panel :deep(.panel-refresh-btn) {
  display: none;
}

.mix-consistency-panel :deep(.consistency-viewer),
.mix-consistency-panel :deep(.consistency-viewer__viewport) {
  width: 100%;
  height: 100%;
}

.mix-consistency-panel :deep(.consistency-viewer__placeholder) {
  pointer-events: none;
}

.mix-overlay-layer :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

@media (max-width: 900px) {
  .mix-toolbar {
    top: 10px;
    left: 10px;
    right: 10px;
  }

  .mix-toolbar__inner {
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    min-height: 40px;
    padding: 8px 10px;
  }

  .mix-toolbar__section {
    width: 100%;
    justify-content: center;
    flex-wrap: wrap;
  }

  .mix-toolbar__section--actions {
    justify-content: center;
  }

  .mix-toolbar__divider {
    display: none;
  }

  .mix-toolbar__label {
    width: 100%;
    text-align: center;
  }

  .mix-toolbar__mode-switch {
    width: 100%;
    justify-content: center;
  }

  .mix-toolbar__layer-switch {
    justify-content: center;
  }
}
</style>
