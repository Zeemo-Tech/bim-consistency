<template>
  <div class="gaussian-view-panel">
    <div class="panel-actions">
      <button
        :class="[
          'panel-refresh-btn',
          { 'is-first-person-active': firstPersonEnabled },
        ]"
        type="button"
        aria-label="第一人称"
        title="第一人称"
        @click="toggleFirstPersonMode"
      >
        <el-icon><User /></el-icon>
      </button>
      <button
        class="panel-refresh-btn"
        type="button"
        aria-label="重新加载高斯模型"
        title="重新加载高斯模型"
        @click="reloadGaussianModel"
      >
        <el-icon><Refresh /></el-icon>
      </button>
      <button
        class="panel-refresh-btn"
        type="button"
        aria-label="重置视角"
        title="重置视角"
        @click="handleResetView"
      >
        <el-icon><RefreshRight /></el-icon>
      </button>
    </div>
    <div v-if="!gaussianModelLoaded" class="empty-placeholder">
      <div class="placeholder-content">
        <el-icon class="placeholder-icon"><View /></el-icon>
        <p class="placeholder-text">{{ gaussianLoadingText }}</p>
      </div>
    </div>

    <div
      ref="gaussianContainer"
      class="gaussian-container"
      tabindex="0"
      @pointerdown="focusGaussianContainer"
    >
      <div
        v-if="currentAnnotationOverlay || annotationOverlayMarkers.length"
        class="gaussian-annotation-overlay"
        aria-hidden="true"
      >
        <div
          v-for="marker in annotationOverlayMarkers"
          :key="marker.key"
          :class="[
            'gaussian-annotation-overlay__marker',
            {
              'is-highlighted': marker.highlighted,
              'is-current': marker.current,
              'is-synced': marker.synced,
            },
          ]"
          :style="getOverlayMarkerStyle(marker)"
        />
        <div
          v-if="currentAnnotationOverlay"
          :class="[
            'gaussian-annotation-overlay__marker',
            'is-current',
            {
              'is-highlighted': currentAnnotationOverlay.highlighted,
            },
          ]"
          :style="getOverlayMarkerStyle(currentAnnotationOverlay)"
        />
      </div>
      <div v-if="showMoveControls" class="direction-controls">
        <el-tooltip content="向前移动 (W)" placement="top">
          <div class="arrow-btn arrow-up" @click="moveGaussianCamera('up')">
            <el-icon><ArrowUp /></el-icon>
          </div>
        </el-tooltip>
        <div class="arrow-horizontal">
          <el-tooltip content="向左移动 (A)" placement="left">
            <div
              class="arrow-btn arrow-left"
              @click="moveGaussianCamera('left')"
            >
              <el-icon><ArrowLeft /></el-icon>
            </div>
          </el-tooltip>
          <el-tooltip content="向右移动 (D)" placement="right">
            <div
              class="arrow-btn arrow-right"
              @click="moveGaussianCamera('right')"
            >
              <el-icon><ArrowRight /></el-icon>
            </div>
          </el-tooltip>
        </div>
        <el-tooltip content="向后移动 (S)" placement="bottom">
          <div class="arrow-btn arrow-down" @click="moveGaussianCamera('down')">
            <el-icon><ArrowDown /></el-icon>
          </div>
        </el-tooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Refresh,
  RefreshRight,
  User,
  View,
} from '@element-plus/icons-vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { TrajectoryPoint } from '@/api/calibration'
import { getGaussAssetUrl } from '@/api/fileManage'
import { formatToken, getOrganizationId, getToken } from '@/utils/auth'
import {
  buildGaussianTrajectoryYUpPose,
  FUSION_GAUSSIAN_Y_UP_MATRIX,
} from '../utils/fusionTransforms'
// @ts-ignore
import { LCCRender } from '@/libs/lcc-0.5.4.js'

type ViewMode = 'flat' | 'perspective' | 'firstPerson'
type CameraRot = { lon: number; lat: number }
type MoveDirection = 'up' | 'down' | 'left' | 'right'
type AnnotationMarkerStatus = 'default' | 'editing' | 'saved'
type GaussianCameraPoseSnapshot = {
  camera: THREE.Vector3
  target: THREE.Vector3 | null
}
type GaussianCameraTransformSnapshot = {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
}
type AnnotationOverlayMarker = {
  key: string
  left: number
  top: number
  color: string
  size: number
  highlighted: boolean
  synced: boolean
  current: boolean
}

const formatMatrix = (matrix?: THREE.Matrix4 | null) => {
  if (!matrix) return null
  return matrix.toArray().map((value) => Number(value.toFixed(6)))
}

const formatGaussianPose = (camera?: THREE.PerspectiveCamera | null) => {
  if (!camera) return null
  const direction = new THREE.Vector3()
  camera.getWorldDirection(direction)
  return {
    camera: {
      x: Number(camera.position.x.toFixed(6)),
      y: Number(camera.position.y.toFixed(6)),
      z: Number(camera.position.z.toFixed(6)),
    },
    direction: {
      x: Number(direction.x.toFixed(6)),
      y: Number(direction.y.toFixed(6)),
      z: Number(direction.z.toFixed(6)),
    },
  }
}

const props = defineProps<{
  projectId: number | null
  gaussFileId: number | null
  gaussAssetPath: string
  currentImageInfo: any
  currentTrajectoryPoint?: TrajectoryPoint | null
  panoramaCameraRot: CameraRot
  panoramaFov: number | null
  rotationLock?: boolean
  annotationEnabled?: boolean
  annotationPoint?: { x: number; y: number; z: number } | null
  annotationStatus?: 'default' | 'editing' | 'saved'
  annotationStashMarkers?: {
    key: string
    point: { x: number; y: number; z: number }
    status: 'default' | 'editing' | 'saved'
    highlighted: boolean
    synced: boolean
  }[]
  annotationHighlightCurrent?: boolean
  annotationMarkersVisible?: boolean
}>()

const emit = defineEmits<{
  (e: 'panorama-fov-sync', value: number): void
  (e: 'loaded-change', value: boolean): void
  (e: 'camera-change', value: { lon: number; lat: number }): void
  (
    e: 'annotation-pick',
    value: {
      point: { x: number; y: number; z: number } | null
      screen: { x: number; y: number } | null
      source: 'gaussian'
      key?: string
      synced?: boolean
      componentId?: string
      componentInfo?: {
        id?: string | number
        name?: string
        type?: string
      } | null
    },
  ): void
  (e: 'error'): void
}>()

const gaussianContainer = ref<HTMLDivElement | null>(null)
const gaussianModelLoaded = ref(false)
const gaussianLoadingText = ref('等待加载数据...')
const gaussianCameraPos = ref({ x: '0.0', y: '0.0', z: '0.0' })
const viewMode = ref<ViewMode>('perspective')
const gaussianMouseDown = ref(false)
const gaussianMousePos = ref({ x: 0, y: 0 })
const gaussianCameraRot = ref({ lon: 0, lat: 0 })
const isAnimatingCamera = ref(false)
const firstPersonEnabled = ref(false)
const pendingTrajectoryPoint = ref<TrajectoryPoint | null>(null)
const currentAnnotationOverlay = ref<AnnotationOverlayMarker | null>(null)
const annotationOverlayMarkers = ref<AnnotationOverlayMarker[]>([])

const focusGaussianContainer = () => {
  gaussianContainer.value?.focus()
}

const hasGaussianKeyboardFocus = () => {
  const container = gaussianContainer.value
  const activeElement = document.activeElement
  if (!container || !(activeElement instanceof HTMLElement)) return false
  return activeElement === container || container.contains(activeElement)
}

const NORMAL_FOV = 55
const FLAT_FOV = 10
const GAUSSIAN_COLLISION_RADIUS = 0.32
const GAUSSIAN_OVERLAY_VISIBILITY_INTERVAL = 140
const GAUSSIAN_TRAJECTORY_COLLISION_SUPPRESS_MS = 2200
const GAUSSIAN_LOAD_WATCHDOG_MS = 100_000
const GAUSSIAN_MAX_AUTO_RETRIES = 2
const GAUSSIAN_FIRST_SCREEN_MAX_SPLATS = 700000
const GAUSSIAN_FIRST_SCREEN_MAX_DISTANCE = 80
const GAUSSIAN_ENHANCED_SCREEN_MAX_SPLATS = 1500000
const GAUSSIAN_ENHANCED_SCREEN_MAX_DISTANCE = 120
const GAUSSIAN_QUALITY_UPGRADE_DELAY = 1500
const DEFAULT_FIRST_PERSON_EYE_HEIGHT = 1.5
const FIRST_PERSON_GROUND_PROBE_DISTANCE = 8
const FIRST_PERSON_MAX_STEP_UP = 0.18
const FIRST_PERSON_MAX_STEP_DOWN = 0.5
const FIRST_PERSON_MAX_GROUND_HEIGHT_JUMP = 0.28
const FIRST_PERSON_ROTATION_SENSITIVITY = 0.12
const FIRST_PERSON_MAX_POINTER_DELTA = 48
const FIRST_PERSON_MAX_PITCH = 55
const FIRST_PERSON_MOVE_SPEED = 2.8

let gaussianScene: THREE.Scene | null = null
let gaussianCamera: THREE.PerspectiveCamera | null = null
let gaussianRenderer: THREE.WebGLRenderer | null = null
let gaussianControls: OrbitControls | null = null
let worldOriginAxes: THREE.AxesHelper | null = null
let lccObject: any
let gaussianAnimationId = 0
let perspectiveCamera: THREE.PerspectiveCamera | null = null
let destroyed = false
let gaussianResizeObserver: ResizeObserver | null = null
let isCleaningUp = false
let gaussianInitTimer: number | null = null
let gaussianLoadWatchdogTimer: number | null = null
let gaussianLoadInFlight = false
let gaussianAutoRetryCount = 0
let annotationMarker: THREE.Group | null = null
let annotationStashGroup: THREE.Group | null = null
let gaussianLastSafePose: GaussianCameraPoseSnapshot | null = null
let gaussianLastFrameTransform: GaussianCameraTransformSnapshot | null = null
let gaussianLastCollisionPosition: THREE.Vector3 | null = null
let annotationOverlayVisibilityCheckedAt = 0
let annotationOverlayVisibilityDirty = true
const annotationStashMarkerMap = new Map<string, THREE.Group>()
const annotationOverlayVisibility = new Map<string, boolean>()
const annotationRaycaster = new THREE.Raycaster()
let annotationPointerId: number | null = null
let annotationPointerDown: { x: number; y: number } | null = null
let annotationPointerDragging = false
let rotationPointerId: number | null = null
let rotationPointerDown: { x: number; y: number } | null = null
let suppressGaussianCollisionUntil = 0
let firstPersonEyeHeight: number | null = null
let lastFirstPersonGroundHeight: number | null = null
const activeFirstPersonMoveDirections = new Set<MoveDirection>()
let lastFirstPersonMoveAt = 0
let restoreGaussFetchInterceptor: (() => void) | null = null
let gaussianFetchSequence = 0
let gaussianLoadSequence = 0
let activeGaussianLoadId = 0
let activeGaussianDataPath: string | null = null
let gaussianLoadStartedAt = 0
let gaussianFirstFrameMarked = false
let gaussianQualityUpgradeTimer: number | null = null

type GaussianPerfEntry = {
  name: string
  time: number
  detail?: Record<string, unknown>
}

const getTwoScreenGaussianPerfStore = () => {
  if (typeof window === 'undefined') return null
  const target = window as any
  if (!target.__twoScreenGaussianPerf) {
    target.__twoScreenGaussianPerf = {
      startedAt: performance.now(),
      marks: [] as GaussianPerfEntry[],
    }
  }
  return target.__twoScreenGaussianPerf as {
    startedAt: number
    marks: GaussianPerfEntry[]
  }
}

const markTwoScreenGaussianPerf = (
  name: string,
  detail?: Record<string, unknown>,
) => {
  if (typeof performance === 'undefined') return
  getTwoScreenGaussianPerfStore()?.marks.push({
    name,
    time: performance.now(),
    detail,
  })
  performance.mark(`two-screen-gaussian:${name}`)
}

const resolveFetchUrl = (input: RequestInfo | URL) => {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

const isGaussAssetRequest = (requestUrl: string) => {
  try {
    const url = new URL(requestUrl, window.location.origin)
    return /\/projects\/\d+\/files\/\d+\/gauss\/.+/.test(url.pathname)
  } catch {
    return false
  }
}

const mergeRequestHeaders = (input: RequestInfo | URL, init?: RequestInit) => {
  const headers = new Headers(
    input instanceof Request ? input.headers : undefined,
  )

  if (init?.headers) {
    const initHeaders = new Headers(init.headers)
    initHeaders.forEach((value, key) => {
      headers.set(key, value)
    })
  }

  const tokenData = getToken()
  if (tokenData?.accessToken) {
    headers.set('Authorization', formatToken(tokenData.accessToken))
  }

  const organizationId = getOrganizationId()
  if (organizationId) {
    headers.set('X-Organization-Id', String(organizationId))
  }

  return headers
}

const installGaussFetchInterceptor = () => {
  if (typeof window === 'undefined' || restoreGaussFetchInterceptor) return

  const originalFetch = window.fetch.bind(window)

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = resolveFetchUrl(input)
    if (!isGaussAssetRequest(requestUrl)) {
      return originalFetch(input, init)
    }

    const fetchId = ++gaussianFetchSequence
    const fetchStartedAt = performance.now()
    markTwoScreenGaussianPerf('fetch-start', {
      id: fetchId,
      url: requestUrl,
    })

    const nextInput =
      input instanceof Request ? new Request(requestUrl, input) : requestUrl
    const headers = mergeRequestHeaders(input, init)

    return originalFetch(nextInput, {
      ...init,
      headers,
    }).then((response) => {
      markTwoScreenGaussianPerf('fetch-response', {
        id: fetchId,
        url: requestUrl,
        status: response.status,
        elapsed: Math.round(performance.now() - fetchStartedAt),
      })

      const originalArrayBuffer = response.arrayBuffer.bind(response)
      response.arrayBuffer = () => {
        const bodyStartedAt = performance.now()
        markTwoScreenGaussianPerf('fetch-body-start', {
          id: fetchId,
          url: requestUrl,
        })
        return originalArrayBuffer().then((buffer) => {
          markTwoScreenGaussianPerf('fetch-body-end', {
            id: fetchId,
            url: requestUrl,
            bytes: buffer.byteLength,
            elapsed: Math.round(performance.now() - bodyStartedAt),
          })
          return buffer
        })
      }

      return response
    })
  }

  restoreGaussFetchInterceptor = () => {
    window.fetch = originalFetch
    restoreGaussFetchInterceptor = null
  }
}

const uninstallGaussFetchInterceptor = () => {
  if (!restoreGaussFetchInterceptor) return
  restoreGaussFetchInterceptor()
}

const clampLat = (lat: number) => Math.max(-85, Math.min(85, lat))
const clampFirstPersonLat = (lat: number) =>
  Math.max(-FIRST_PERSON_MAX_PITCH, Math.min(FIRST_PERSON_MAX_PITCH, lat))
const normalizeLon = (lon: number) =>
  THREE.MathUtils.euclideanModulo(lon + 180, 360) - 180

const rotationToDirection = (rot: CameraRot) => {
  const lat = THREE.MathUtils.degToRad(clampLat(rot.lat))
  const lon = THREE.MathUtils.degToRad(rot.lon)
  const cosLat = Math.cos(lat)
  return new THREE.Vector3(
    cosLat * Math.cos(lon),
    Math.sin(lat),
    cosLat * Math.sin(lon),
  ).normalize()
}

const directionToRotation = (direction: THREE.Vector3) => {
  const normalized = direction.clone().normalize()
  const hyp = Math.sqrt(
    normalized.x * normalized.x + normalized.z * normalized.z,
  )
  return {
    lon: THREE.MathUtils.radToDeg(Math.atan2(normalized.z, normalized.x)),
    lat: THREE.MathUtils.radToDeg(Math.atan2(normalized.y, hyp)),
  }
}

const runSafely = (label: string, task: () => void) => {
  try {
    task()
  } catch (error) {}
}

const disposeLccManager = () => {
  const lccRenderAny = LCCRender as any
  if (!lccRenderAny || typeof lccRenderAny.dispose !== 'function') return
  runSafely('LCC全局管理器重置', () => {
    lccRenderAny.dispose()
  })
}

const disposeObject3D = (obj: THREE.Object3D) => {
  obj.traverse((child: any) => {
    if (child?.geometry) child.geometry.dispose?.()
    const material = child?.material
    if (Array.isArray(material)) material.forEach((m) => m?.dispose?.())
    else material?.dispose?.()
  })
}

const ensureWorldOriginAxes = () => {}

const markerColors: Record<AnnotationMarkerStatus, number> = {
  default: 0x2f6bff,
  editing: 0xfacc15,
  saved: 0x22c55e,
}
const markerColorCss: Record<AnnotationMarkerStatus, string> = {
  default: '#2f6bff',
  editing: '#facc15',
  saved: '#22c55e',
}
const annotationMarkerBaseRadius = 1

const resolveAnnotationStatus = (value?: string) =>
  value === 'editing' || value === 'saved' ? value : 'default'

const getOverlayMarkerStyle = (marker: AnnotationOverlayMarker) => ({
  left: `${marker.left}px`,
  top: `${marker.top}px`,
  '--marker-color': marker.color,
  '--marker-size': `${marker.size}px`,
})

const applyAnnotationMarkerStyle = (
  status?: string,
  marker?: THREE.Group | null,
) => {
  const target = marker ?? annotationMarker
  if (!target) return
  const resolvedStatus = resolveAnnotationStatus(status)
  const outerMaterial = target.userData.outerMaterial as
    | THREE.MeshBasicMaterial
    | undefined
  target.userData.annotationStatus = resolvedStatus
  if (!outerMaterial) return
  outerMaterial.color.setHex(markerColors[resolvedStatus])
}

const applyAnnotationMarkerScale = (
  marker: THREE.Group | null,
  highlighted?: boolean,
) => {
  if (!marker) return
  const isHighlighted = highlighted ?? Boolean(marker.userData.highlighted)
  marker.userData.highlighted = isHighlighted
  marker.visible = props.annotationMarkersVisible !== false
  if (!marker.userData.worldRadius) {
    const distance = Math.max(
      gaussianCamera?.position.distanceTo(marker.position) ?? 1,
      gaussianCamera?.near ? gaussianCamera.near * 2 : 0.1,
      0.1,
    )
    const viewportHeight = Math.max(gaussianContainer.value?.clientHeight || 1, 1)
    const worldUnitsPerPixel = gaussianCamera
      ? (2 * Math.tan(THREE.MathUtils.degToRad(gaussianCamera.fov) / 2) * distance) /
        viewportHeight
      : 0.01
    marker.userData.worldRadius = Math.max(worldUnitsPerPixel * 6, 0.002)
  }
  marker.scale.setScalar(
    (marker.userData.worldRadius / annotationMarkerBaseRadius) *
      (isHighlighted ? 1.3 : 1),
  )
}

const buildAnnotationMarker = () => {
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
  outerMaterial.depthTest = true
  outerMaterial.depthWrite = false
  innerMaterial.depthTest = true
  innerMaterial.depthWrite = false

  const outerMesh = new THREE.Mesh(outerGeometry, outerMaterial)
  const innerMesh = new THREE.Mesh(innerGeometry, innerMaterial)
  outerMesh.renderOrder = 999
  innerMesh.renderOrder = 1000

  const group = new THREE.Group()
  group.name = 'annotation-marker'
  group.renderOrder = 999
  group.userData.outerMaterial = outerMaterial
  group.userData.isAnnotationMarker = true
  group.userData.highlighted = false
  group.add(outerMesh, innerMesh)
  return group
}

const refreshAnnotationMarkerScales = () => {
  applyAnnotationMarkerScale(annotationMarker)
  for (const marker of annotationStashMarkerMap.values()) {
    applyAnnotationMarkerScale(marker)
  }
}

const projectPointToViewport = (
  point: THREE.Vector3,
  viewportWidth: number,
  viewportHeight: number,
) => {
  if (!gaussianCamera || viewportWidth <= 0 || viewportHeight <= 0) return null
  const projected = point.clone().project(gaussianCamera)
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

const isPointVisibleFromCamera = (point: THREE.Vector3) => {
  if (!gaussianCamera) return false
  if (!lccObject || typeof lccObject.raycastFromOrigin !== 'function') {
    return true
  }

  const origin = gaussianCamera.position.clone()
  const direction = point.clone().sub(origin)
  const targetDistance = direction.length()
  if (!Number.isFinite(targetDistance) || targetDistance <= 0) return false
  direction.normalize()

  const hit = lccObject.raycastFromOrigin({
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
    maxDistance: Math.min(targetDistance + 0.2, gaussianCamera.far || 150000),
    radius: 0.03,
  })

  if (
    !hit ||
    !Number.isFinite(hit.x) ||
    !Number.isFinite(hit.y) ||
    !Number.isFinite(hit.z)
  ) {
    return true
  }

  const hitDistance = origin.distanceTo(new THREE.Vector3(hit.x, hit.y, hit.z))
  const tolerance = Math.max(0.08, targetDistance * 0.0025)
  return hitDistance + tolerance >= targetDistance
}

const buildOverlayMarker = (
  key: string,
  point: THREE.Vector3,
  status: AnnotationMarkerStatus,
  highlighted: boolean,
  synced: boolean,
  current: boolean,
  viewportWidth: number,
  viewportHeight: number,
): AnnotationOverlayMarker | null => {
  const projected = projectPointToViewport(point, viewportWidth, viewportHeight)
  if (!projected) return null
  if (props.annotationMarkersVisible === false) return null
  const distance = Math.max(
    gaussianCamera?.position.distanceTo(point) ?? 1,
    gaussianCamera?.near ? gaussianCamera.near * 2 : 0.1,
    0.1,
  )
  if (annotationOverlayVisibility.get(key) === false) return null
  return {
    key,
    left: projected.left,
    top: projected.top,
    color: markerColorCss[status],
    size: Math.min(48, Math.max(6, (120 / distance) * (highlighted ? 1.3 : 1))),
    highlighted,
    synced,
    current,
  }
}

const collectAnnotationOverlayMarkers = (
  viewportWidth: number,
  viewportHeight: number,
) => {
  if (!gaussianCamera || viewportWidth <= 0 || viewportHeight <= 0) {
    return {
      current: null as AnnotationOverlayMarker | null,
      stash: [] as AnnotationOverlayMarker[],
    }
  }
  gaussianCamera.updateMatrixWorld?.()
  const current =
    annotationMarker && props.annotationPoint
      ? buildOverlayMarker(
          '__current__',
          annotationMarker.position,
          resolveAnnotationStatus(props.annotationStatus),
          Boolean(props.annotationHighlightCurrent),
          false,
          true,
          viewportWidth,
          viewportHeight,
        )
      : null
  const stash: AnnotationOverlayMarker[] = []
  for (const [key, marker] of annotationStashMarkerMap) {
    const overlay = buildOverlayMarker(
      key,
      marker.position,
      resolveAnnotationStatus(marker.userData.annotationStatus),
      Boolean(marker.userData.highlighted),
      Boolean(marker.userData.isSynced),
      false,
      viewportWidth,
      viewportHeight,
    )
    if (overlay) stash.push(overlay)
  }
  return { current, stash }
}

const syncAnnotationOverlays = () => {
  const width = gaussianContainer.value?.clientWidth ?? 0
  const height = gaussianContainer.value?.clientHeight ?? 0
  const projected = collectAnnotationOverlayMarkers(width, height)
  currentAnnotationOverlay.value = projected.current
  annotationOverlayMarkers.value = projected.stash
}

const markAnnotationOverlayVisibilityDirty = () => {
  annotationOverlayVisibilityDirty = true
}

const snapshotGaussianTransform =
  (): GaussianCameraTransformSnapshot | null => {
    if (!gaussianCamera) return null
    return {
      position: gaussianCamera.position.clone(),
      quaternion: gaussianCamera.quaternion.clone(),
    }
  }

const hasGaussianCameraTransformChanged = () => {
  const current = snapshotGaussianTransform()
  if (!current) return false
  if (!gaussianLastFrameTransform) return true
  return (
    current.position.distanceToSquared(gaussianLastFrameTransform.position) >
      1e-8 ||
    1 -
      Math.abs(current.quaternion.dot(gaussianLastFrameTransform.quaternion)) >
      1e-7
  )
}

const hasGaussianCameraPositionChanged = () => {
  if (!gaussianCamera) return false
  if (!gaussianLastCollisionPosition) return true
  return (
    gaussianCamera.position.distanceToSquared(gaussianLastCollisionPosition) >
    1e-8
  )
}

const commitGaussianFrameState = () => {
  gaussianLastFrameTransform = snapshotGaussianTransform()
  gaussianLastCollisionPosition = gaussianCamera?.position.clone() ?? null
}

const refreshAnnotationOverlayVisibility = (force = false) => {
  if (!gaussianCamera) return
  const now = performance.now()
  if (
    !force &&
    !annotationOverlayVisibilityDirty &&
    now - annotationOverlayVisibilityCheckedAt <
      GAUSSIAN_OVERLAY_VISIBILITY_INTERVAL
  ) {
    return
  }

  annotationOverlayVisibility.clear()
  if (props.annotationMarkersVisible !== false && annotationMarker?.visible) {
    annotationOverlayVisibility.set(
      '__current__',
      isPointVisibleFromCamera(annotationMarker.position),
    )
  }
  for (const [key, marker] of annotationStashMarkerMap) {
    annotationOverlayVisibility.set(
      key,
      isPointVisibleFromCamera(marker.position),
    )
  }
  annotationOverlayVisibilityCheckedAt = now
  annotationOverlayVisibilityDirty = false
}

const detectGaussianCameraCollision = (position: THREE.Vector3) => {
  if (!lccObject || typeof lccObject.intersectsSphere !== 'function') {
    return { hit: false, delta: new THREE.Vector3() }
  }

  const result = lccObject.intersectsSphere({
    center: {
      x: position.x,
      y: position.y,
      z: position.z,
    },
    radius: GAUSSIAN_COLLISION_RADIUS,
    noDelta: false,
  })

  const delta = new THREE.Vector3(
    result?.delta?.x ?? 0,
    result?.delta?.y ?? 0,
    result?.delta?.z ?? 0,
  )
  return {
    hit: Boolean(result?.hit),
    delta,
  }
}

const snapshotGaussianPose = (): GaussianCameraPoseSnapshot | null => {
  if (!gaussianCamera) return null
  return {
    camera: gaussianCamera.position.clone(),
    target: gaussianControls ? gaussianControls.target.clone() : null,
  }
}

const restoreGaussianPose = (pose: GaussianCameraPoseSnapshot | null) => {
  if (!pose || !gaussianCamera) return
  gaussianCamera.position.copy(pose.camera)
  if (gaussianControls && pose.target) {
    gaussianControls.target.copy(pose.target)
    gaussianControls.update()
  }
  if (firstPersonEnabled.value) {
    syncGaussianFirstPersonRotationFromCamera()
  }
}

const rememberGaussianSafePose = () => {
  const pose = snapshotGaussianPose()
  if (!pose) return
  gaussianLastSafePose = pose
}

const tryResolveGaussianCollision = () => {
  if (!gaussianCamera || !gaussianModelLoaded.value) return
  if (!firstPersonEnabled.value) return
  if (performance.now() < suppressGaussianCollisionUntil) return

  const collision = detectGaussianCameraCollision(gaussianCamera.position)
  if (!collision.hit) {
    rememberGaussianSafePose()
    return
  }

  if (gaussianLastSafePose) {
    restoreGaussianPose(gaussianLastSafePose)
    return
  }

  if (collision.delta.lengthSq() <= 1e-8) return

  const nextCamera = gaussianCamera.position
    .clone()
    .add(collision.delta.clone().multiplyScalar(1.02))
  const offset = nextCamera.clone().sub(gaussianCamera.position)
  gaussianCamera.position.copy(nextCamera)

  if (gaussianControls) {
    gaussianControls.target.add(offset)
    gaussianControls.update()
  }

  if (firstPersonEnabled.value) {
    syncGaussianFirstPersonRotationFromCamera()
  }

  if (!detectGaussianCameraCollision(gaussianCamera.position).hit) {
    rememberGaussianSafePose()
  }
}

const resolveAnnotationMarkerFromHit = (object: THREE.Object3D | null) => {
  let current: THREE.Object3D | null = object
  while (current) {
    if (current.userData?.isAnnotationMarker) {
      return current as THREE.Group
    }
    current = current.parent
  }
  return null
}

const setAnnotationMarker = (point: THREE.Vector3 | null) => {
  if (!gaussianScene) return
  if (!point) {
    if (annotationMarker) {
      gaussianScene.remove(annotationMarker)
      disposeObject3D(annotationMarker)
      annotationMarker = null
    }
    markAnnotationOverlayVisibilityDirty()
    refreshAnnotationOverlayVisibility(true)
    syncAnnotationOverlays()
    return
  }

  if (!annotationMarker) {
    annotationMarker = buildAnnotationMarker()
    gaussianScene.add(annotationMarker)
  }
  annotationMarker.position.copy(point)
  annotationMarker.userData.worldRadius = undefined
  applyAnnotationMarkerStyle(props.annotationStatus, annotationMarker)
  applyAnnotationMarkerScale(annotationMarker, props.annotationHighlightCurrent)
  markAnnotationOverlayVisibilityDirty()
  refreshAnnotationOverlayVisibility(true)
  syncAnnotationOverlays()
}

const ensureAnnotationStashGroup = () => {
  if (!gaussianScene) return
  if (!annotationStashGroup) {
    annotationStashGroup = new THREE.Group()
    annotationStashGroup.name = 'annotation-stash-group'
    gaussianScene.add(annotationStashGroup)
  }
}

const syncAnnotationStashMarkers = (
  markers: {
    key: string
    point: { x: number; y: number; z: number }
    status: 'default' | 'editing' | 'saved'
    highlighted: boolean
    synced: boolean
  }[] = [],
) => {
  if (!gaussianScene) return
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
      annotationStashMarkerMap.set(item.key, marker)
      annotationStashGroup?.add(marker)
    }
    marker.userData.isSynced = item.synced
    marker.userData.highlighted = item.highlighted
    marker.userData.annotationStatus = resolveAnnotationStatus(item.status)
    marker.position.set(item.point.x, item.point.y, item.point.z)
    marker.userData.worldRadius = undefined
    applyAnnotationMarkerScale(marker, item.highlighted)
    applyAnnotationMarkerStyle(item.status, marker)
  })
  markAnnotationOverlayVisibilityDirty()
  refreshAnnotationOverlayVisibility(true)
  syncAnnotationOverlays()
}

const showMoveControls = computed(
  () =>
    gaussianModelLoaded.value &&
    viewMode.value !== 'firstPerson' &&
    !props.rotationLock,
)

const hasGaussianSourceBinding = computed(
  () => Boolean(props.projectId && props.gaussFileId),
)

const normalizedGaussAssetPath = computed(() => {
  const normalized = (props.gaussAssetPath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim()
  return normalized || 'meta.lcc'
})

const resolveGaussianDataPath = () => {
  if (!props.projectId || !props.gaussFileId) return ''

  const baseUrl = `${window.location.origin}${getGaussAssetUrl(
    props.projectId,
    props.gaussFileId,
    normalizedGaussAssetPath.value,
  )}`

  const tokenData = getToken()
  const organizationId = getOrganizationId()

  const url = new URL(baseUrl)
  if (tokenData?.accessToken) {
    url.searchParams.set('token', formatToken(tokenData.accessToken))
  }
  if (organizationId) {
    url.searchParams.set('orgId', String(organizationId))
  }
  return url.toString()
}

const clearGaussianInitTimer = () => {
  if (gaussianInitTimer === null) return
  window.clearTimeout(gaussianInitTimer)
  gaussianInitTimer = null
}

const clearGaussianLoadWatchdog = () => {
  if (gaussianLoadWatchdogTimer === null) return
  window.clearTimeout(gaussianLoadWatchdogTimer)
  gaussianLoadWatchdogTimer = null
}

const clearGaussianQualityUpgradeTimer = () => {
  if (gaussianQualityUpgradeTimer === null) return
  window.clearTimeout(gaussianQualityUpgradeTimer)
  gaussianQualityUpgradeTimer = null
}

const applyGaussianQuality = (
  stage: 'first-screen' | 'enhanced',
  loadId: number,
) => {
  if (!lccObject) return

  const maxSplats =
    stage === 'enhanced'
      ? GAUSSIAN_ENHANCED_SCREEN_MAX_SPLATS
      : GAUSSIAN_FIRST_SCREEN_MAX_SPLATS
  const maxDistance =
    stage === 'enhanced'
      ? GAUSSIAN_ENHANCED_SCREEN_MAX_DISTANCE
      : GAUSSIAN_FIRST_SCREEN_MAX_DISTANCE

  if (typeof lccObject.setMaxSplats === 'function') {
    lccObject.setMaxSplats(maxSplats)
  }
  if (typeof lccObject.setMaxDistance === 'function') {
    lccObject.setMaxDistance(maxDistance)
  }
  if (typeof lccObject.setLodAutoLevelUp === 'function') {
    lccObject.setLodAutoLevelUp(true)
  }
  markTwoScreenGaussianPerf('lod-config-applied', {
    loadId,
    stage,
    maxSplats,
    maxDistance,
  })
}

const scheduleGaussianQualityUpgrade = (loadId: number) => {
  clearGaussianQualityUpgradeTimer()
  gaussianQualityUpgradeTimer = window.setTimeout(() => {
    gaussianQualityUpgradeTimer = null
    if (
      activeGaussianLoadId !== loadId ||
      !gaussianModelLoaded.value ||
      !lccObject
    ) {
      return
    }
    applyGaussianQuality('enhanced', loadId)
  }, GAUSSIAN_QUALITY_UPGRADE_DELAY)
}

const restartGaussianModel = (resetRetryCount = true) => {
  cleanupGaussianFirstPersonControls()
  cleanupGaussianModel()
  pendingTrajectoryPoint.value = null
  firstPersonEnabled.value = false
  isAnimatingCamera.value = false
  if (resetRetryCount) {
    gaussianAutoRetryCount = 0
  }
  if (!hasGaussianSourceBinding.value) {
    gaussianLoadingText.value = '等待高斯文件绑定...'
    return
  }
  void nextTick(() => {
    initGaussianModel()
  })
}

const scheduleGaussianLoadWatchdog = () => {
  clearGaussianLoadWatchdog()
  gaussianLoadWatchdogTimer = window.setTimeout(() => {
    gaussianLoadWatchdogTimer = null
    if (destroyed || !gaussianLoadInFlight) return
    markTwoScreenGaussianPerf('load-watchdog-timeout', {
      activeLoadId: activeGaussianLoadId,
      retryCount: gaussianAutoRetryCount,
      dataPath: activeGaussianDataPath,
    })
    if (gaussianAutoRetryCount < GAUSSIAN_MAX_AUTO_RETRIES) {
      gaussianAutoRetryCount += 1
      gaussianLoadInFlight = false
      gaussianModelLoaded.value = false
      gaussianLoadingText.value = `高斯加载超时，正在重试（${gaussianAutoRetryCount}/${GAUSSIAN_MAX_AUTO_RETRIES}）...`
      restartGaussianModel(false)
      return
    }
    gaussianLoadInFlight = false
    gaussianModelLoaded.value = false
    gaussianLoadingText.value = '高斯模型加载失败，请重试'
    emit('loaded-change', false)
    emit('error')
  }, GAUSSIAN_LOAD_WATCHDOG_MS)
}

const isGaussianContainerRenderable = () => {
  const container = gaussianContainer.value
  return Boolean(
    container &&
      container.isConnected &&
      container.clientWidth > 0 &&
      container.clientHeight > 0,
  )
}

const hasDetachedGaussianCanvas = () => {
  if (!gaussianRenderer || !gaussianContainer.value) return false
  const canvas = gaussianRenderer.domElement
  return (
    !canvas?.isConnected || canvas.parentElement !== gaussianContainer.value
  )
}

const scheduleGaussianInit = (delay = 120) => {
  if (destroyed || gaussianInitTimer !== null) return
  gaussianInitTimer = window.setTimeout(() => {
    gaussianInitTimer = null
    void nextTick(() => {
      initGaussianModel()
    })
  }, delay)
}

const initGaussianModel = () => {
  if (destroyed) return
  clearGaussianInitTimer()

  if (!hasGaussianSourceBinding.value) {
    gaussianLoadInFlight = false
    gaussianModelLoaded.value = false
    gaussianLoadingText.value = '等待高斯文件绑定...'
    return
  }

  if (!gaussianContainer.value || !gaussianContainer.value.isConnected) {
    gaussianLoadingText.value = '等待高斯视图挂载...'
    scheduleGaussianInit()
    return
  }

  if (gaussianRenderer) {
    if (hasDetachedGaussianCanvas()) {
      reloadGaussianModel()
      return
    }
    handleGaussianResize()
    if (!gaussianModelLoaded.value && !gaussianLoadInFlight) {
      loadGaussianLCCModel(FUSION_GAUSSIAN_Y_UP_MATRIX.clone())
    }
    return
  }

  if (!isGaussianContainerRenderable()) {
    gaussianModelLoaded.value = false
    gaussianLoadingText.value = '等待高斯视图显示...'
    scheduleGaussianInit()
    return
  }

  gaussianLoadingText.value = '初始化高斯模型...'

  const container = gaussianContainer.value
  const width = container.clientWidth || 800
  const height = container.clientHeight || 600

  gaussianScene = new THREE.Scene()
  gaussianScene.background = new THREE.Color('#1a1a2e')
  ensureWorldOriginAxes()

  perspectiveCamera = new THREE.PerspectiveCamera(
    NORMAL_FOV,
    width / height,
    0.1,
    150000,
  )
  perspectiveCamera.position.set(-3.5, 0, 0.2)
  perspectiveCamera.up.set(0, 1, 0)
  perspectiveCamera.lookAt(0, 0, 0)

  gaussianCamera = perspectiveCamera

  gaussianRenderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  gaussianRenderer.setSize(width, height)
  gaussianRenderer.setPixelRatio(1)
  gaussianRenderer.outputColorSpace = THREE.SRGBColorSpace
  container.appendChild(gaussianRenderer.domElement)
  gaussianRenderer.domElement.addEventListener(
    'pointerdown',
    handleAnnotationPointerDown,
  )
  gaussianRenderer.domElement.addEventListener(
    'pointermove',
    handleAnnotationPointerMove,
  )
  gaussianRenderer.domElement.addEventListener(
    'pointerup',
    handleAnnotationPointerUp,
  )
  gaussianRenderer.domElement.addEventListener(
    'pointercancel',
    handleAnnotationPointerUp,
  )
  gaussianRenderer.domElement.addEventListener(
    'pointerdown',
    handleRotationPointerDown,
  )
  gaussianRenderer.domElement.addEventListener(
    'pointermove',
    handleRotationPointerMove,
  )
  gaussianRenderer.domElement.addEventListener(
    'pointerup',
    handleRotationPointerUp,
  )
  gaussianRenderer.domElement.addEventListener(
    'pointercancel',
    handleRotationPointerUp,
  )
  gaussianRenderer.domElement.addEventListener('wheel', handleRotationWheel, {
    passive: false,
  })

  createGaussianControls(gaussianCamera)
  syncAnnotationStashMarkers(props.annotationStashMarkers ?? [])
  if (props.annotationPoint) {
    setAnnotationMarker(
      new THREE.Vector3(
        props.annotationPoint.x,
        props.annotationPoint.y,
        props.annotationPoint.z,
      ),
    )
  }

  loadGaussianLCCModel(FUSION_GAUSSIAN_Y_UP_MATRIX.clone())

  setupGaussianResizeObserver()
  animateGaussian()
  window.addEventListener('resize', handleGaussianResize)
}

const loadGaussianLCCModel = (modelMatrix: THREE.Matrix4) => {
  if (destroyed) return
  if (!gaussianRenderer) return
  if (gaussianLoadInFlight) return

  if (
    typeof LCCRender === 'undefined' ||
    typeof LCCRender.load !== 'function'
  ) {
    gaussianLoadingText.value = 'LCC库未加载'
    emit('error')
    return
  }

  const dataPath = resolveGaussianDataPath()
  if (!dataPath) {
    gaussianLoadInFlight = false
    gaussianModelLoaded.value = false
    gaussianLoadingText.value = '等待高斯文件绑定...'
    markTwoScreenGaussianPerf('load-skipped', {
      reason: 'missing-source-binding',
      projectId: props.projectId,
      fileId: props.gaussFileId,
      assetPath: normalizedGaussAssetPath.value,
    })
    return
  }

  if (
    activeGaussianDataPath === dataPath &&
    (gaussianLoadInFlight || gaussianModelLoaded.value)
  ) {
    markTwoScreenGaussianPerf('load-skipped', {
      reason: 'same-data-path',
      dataPath,
      loading: gaussianLoadInFlight,
      loaded: gaussianModelLoaded.value,
    })
    return
  }

  const loadId = ++gaussianLoadSequence
  activeGaussianLoadId = loadId
  activeGaussianDataPath = dataPath
  const loadStartedAt = performance.now()
  gaussianLoadStartedAt = loadStartedAt
  gaussianFirstFrameMarked = false
  gaussianLoadInFlight = true
  gaussianLoadingText.value = '加载高斯模型数据...'
  markTwoScreenGaussianPerf('load-start', {
    loadId,
    dataPath,
    useEnv: false,
    useIndexDB: true,
    useLoadingEffect: false,
  })
  scheduleGaussianLoadWatchdog()

  try {
    lccObject = (LCCRender as any).load(
      {
        camera: gaussianCamera,
        scene: gaussianScene,
        dataPath,
        renderLib: THREE,
        canvas: gaussianRenderer.domElement,
        renderer: gaussianRenderer,
        useEnv: false,
        useIndexDB: true,
        useLoadingEffect: false,
        modelMatrix,
        appKey: null,
        maxHostCacheSize: 512,
        maxGpuCacheSize: 512,
      },
      () => {
        if (destroyed) return
        if (activeGaussianLoadId !== loadId) {
          markTwoScreenGaussianPerf('stale-load-success-ignored', {
            loadId,
            activeLoadId: activeGaussianLoadId,
            dataPath,
          })
          return
        }

        clearGaussianLoadWatchdog()
        gaussianLoadInFlight = false
        gaussianAutoRetryCount = 0
        gaussianModelLoaded.value = true
        gaussianLoadingText.value = ''
        markTwoScreenGaussianPerf('load-success', {
          loadId,
          elapsed: Math.round(performance.now() - loadStartedAt),
        })
        emit('loaded-change', true)

        const pendingPoint = pendingTrajectoryPoint.value
        if (pendingPoint) {
          pendingTrajectoryPoint.value = null
          requestAnimationFrame(() => {
            updateGaussianCameraFromTrajectory(pendingPoint)
          })
        }

        applyGaussianQuality('first-screen', loadId)
        scheduleGaussianQualityUpgrade(loadId)

        ElMessage.success('高斯模型加载完成')
      },
      (percent: number) => {
        if (destroyed) return
        if (activeGaussianLoadId !== loadId) return
        scheduleGaussianLoadWatchdog()
        const percentage = Math.min(100, Math.round(percent * 100))
        if (
          percentage === 1 ||
          percentage === 25 ||
          percentage === 50 ||
          percentage === 75 ||
          percentage === 90 ||
          percentage === 100
        ) {
          markTwoScreenGaussianPerf('load-progress', {
            loadId,
            percent: percentage,
            elapsed: Math.round(performance.now() - loadStartedAt),
          })
        }
        gaussianLoadingText.value = `加载中... ${percentage}%`
      },
      (error: any) => {
        if (destroyed) return
        if (activeGaussianLoadId !== loadId) {
          markTwoScreenGaussianPerf('stale-load-failure-ignored', {
            loadId,
            activeLoadId: activeGaussianLoadId,
            dataPath,
          })
          return
        }
        clearGaussianLoadWatchdog()
        gaussianLoadInFlight = false
        gaussianModelLoaded.value = false
        gaussianLoadingText.value = '加载失败'
        markTwoScreenGaussianPerf('load-failure', {
          loadId,
          elapsed: Math.round(performance.now() - loadStartedAt),
        })
        emit('loaded-change', false)
        emit('error')
      },
    )
  } catch (error) {
    clearGaussianLoadWatchdog()
    gaussianLoadInFlight = false
    lccObject = null
    gaussianModelLoaded.value = false
    gaussianLoadingText.value = '加载失败'
    markTwoScreenGaussianPerf('load-throw', {
      loadId,
      elapsed: Math.round(performance.now() - loadStartedAt),
    })
    emit('loaded-change', false)
    emit('error')
  }
}

const animateGaussian = () => {
  if (destroyed) return

  gaussianAnimationId = requestAnimationFrame(animateGaussian)

  if (gaussianControls && !firstPersonEnabled.value) {
    gaussianControls.update()
  }

  updateFirstPersonMovement(performance.now())

  const cameraTransformChangedBeforeCollision =
    hasGaussianCameraTransformChanged()
  const cameraPositionChanged = hasGaussianCameraPositionChanged()

  if (cameraPositionChanged) {
    tryResolveGaussianCollision()
  }

  const cameraTransformChanged =
    cameraTransformChangedBeforeCollision || hasGaussianCameraTransformChanged()

  if (
    lccObject &&
    gaussianModelLoaded.value &&
    typeof lccObject.checkRenderNextFrame === 'function'
  ) {
    runSafely('LCC逐帧渲染', () => {
      lccObject.checkRenderNextFrame()
    })
  }

  const shouldRender = !lccObject || !lccObject?.disableThreeJSRender

  refreshAnnotationMarkerScales()
  if (cameraTransformChanged || annotationOverlayVisibilityDirty) {
    if (cameraTransformChanged) {
      markAnnotationOverlayVisibilityDirty()
    }
    refreshAnnotationOverlayVisibility()
    syncAnnotationOverlays()
  }

  if (shouldRender && gaussianRenderer && gaussianScene && gaussianCamera) {
    gaussianRenderer.render(gaussianScene, gaussianCamera)
    if (gaussianModelLoaded.value && !gaussianFirstFrameMarked) {
      gaussianFirstFrameMarked = true
      markTwoScreenGaussianPerf('first-frame', {
        elapsed: Math.round(performance.now() - gaussianLoadStartedAt),
      })
    }
  }

  updateGaussianCameraPosition()
  commitGaussianFrameState()

  if (LCCRender && LCCRender.update) {
    runSafely('LCC渲染更新', () => {
      LCCRender.update()
    })
  }
}

const updateGaussianCameraPosition = () => {
  if (!gaussianCamera) return
  gaussianCameraPos.value = {
    x: gaussianCamera.position.x.toFixed(1),
    y: gaussianCamera.position.y.toFixed(1),
    z: gaussianCamera.position.z.toFixed(1),
  }
}

const handleGaussianResize = () => {
  if (!gaussianContainer.value || !gaussianRenderer || !perspectiveCamera)
    return

  const width = gaussianContainer.value.clientWidth
  const height = gaussianContainer.value.clientHeight
  if (width <= 0 || height <= 0) return
  const aspect = width / height

  perspectiveCamera.aspect = aspect
  perspectiveCamera.updateProjectionMatrix()

  gaussianRenderer.setSize(width, height)
  syncAnnotationOverlays()
}

const setupGaussianResizeObserver = () => {
  if (!gaussianContainer.value || gaussianResizeObserver) return
  if (typeof ResizeObserver === 'undefined') return

  gaussianResizeObserver = new ResizeObserver(() => {
    if (destroyed || !gaussianContainer.value?.isConnected) return
    if (!isGaussianContainerRenderable()) return
    if (!gaussianRenderer) {
      initGaussianModel()
      return
    }
    if (hasDetachedGaussianCanvas()) {
      reloadGaussianModel()
      return
    }
    handleGaussianResize()
  })
  gaussianResizeObserver.observe(gaussianContainer.value)
}

const resetGaussianCamera = () => {
  if (!gaussianCamera || !gaussianControls || !perspectiveCamera) return

  firstPersonEnabled.value = false
  activeFirstPersonMoveDirections.clear()
  lastFirstPersonMoveAt = 0
  firstPersonEyeHeight = null
  lastFirstPersonGroundHeight = null

  cleanupGaussianFirstPersonControls()

  const defaultPos = { x: -3.5, y: 0, z: 0.2 }
  const defaultTarget = { x: 0, y: 0, z: 0 }

  perspectiveCamera.position.set(defaultPos.x, defaultPos.y, defaultPos.z)
  perspectiveCamera.up.set(0, 1, 0)
  perspectiveCamera.lookAt(defaultTarget.x, defaultTarget.y, defaultTarget.z)
  perspectiveCamera.fov = NORMAL_FOV
  perspectiveCamera.updateProjectionMatrix()

  createGaussianControls(perspectiveCamera)
}

const handleResetView = () => {
  const targetPoint =
    props.currentTrajectoryPoint ?? props.currentImageInfo?.point ?? null
  if (targetPoint) {
    updateGaussianCameraFromTrajectory(targetPoint)
    return
  }
  resetGaussianCamera()
}

const toggleFirstPersonMode = () => {
  focusGaussianContainer()
  if (firstPersonEnabled.value) {
    switchViewMode('perspective')
    return
  }
  switchViewMode('firstPerson')
}

const cleanupGaussianFirstPersonControls = () => {
  if (!gaussianContainer.value) return

  const container = gaussianContainer.value
  container.onmousedown = null
  container.onmousemove = null
  container.onmouseup = null
  container.onmouseleave = null
  container.onwheel = null
}

const switchViewMode = (mode: ViewMode) => {
  if (!perspectiveCamera || !gaussianRenderer || !gaussianCamera) return

  if (firstPersonEnabled.value && perspectiveCamera) {
    syncGaussianFirstPersonRotationFromCamera()
  }

  firstPersonEnabled.value = false
  activeFirstPersonMoveDirections.clear()
  lastFirstPersonMoveAt = 0
  lastFirstPersonGroundHeight = null

  cleanupGaussianFirstPersonControls()

  const currentPosition = gaussianCamera.position.clone()
  const currentTarget =
    gaussianControls?.target.clone() || new THREE.Vector3(0, 1, 0)

  viewMode.value = mode

  if (mode === 'flat') {
    perspectiveCamera.fov = FLAT_FOV
    perspectiveCamera.updateProjectionMatrix()
    gaussianCamera = perspectiveCamera
    perspectiveCamera.position.copy(currentPosition)
    perspectiveCamera.lookAt(currentTarget)
    perspectiveCamera.up.set(0, 1, 0)
    createGaussianControls(perspectiveCamera)
  } else if (mode === 'perspective') {
    perspectiveCamera.fov = NORMAL_FOV
    perspectiveCamera.updateProjectionMatrix()
    gaussianCamera = perspectiveCamera
    perspectiveCamera.position.copy(currentPosition)
    perspectiveCamera.lookAt(currentTarget)
    perspectiveCamera.up.set(0, 1, 0)
    createGaussianControls(perspectiveCamera)
  } else if (mode === 'firstPerson') {
    perspectiveCamera.fov = NORMAL_FOV
    perspectiveCamera.updateProjectionMatrix()
    gaussianCamera = perspectiveCamera

    perspectiveCamera.position.copy(currentPosition)
    perspectiveCamera.up.set(0, 1, 0)
    perspectiveCamera.lookAt(currentTarget)
    syncGaussianFirstPersonRotationFromCamera()
    refreshGaussianFirstPersonEyeHeight()
    perspectiveCamera.position.copy(
      resolveGaussianGroundFollowingPosition(
        perspectiveCamera.position.clone(),
        {
          snapImmediately: true,
        },
      ),
    )

    firstPersonEnabled.value = true
    if (gaussianControls) gaussianControls.enabled = false

    if (document.pointerLockElement) {
      document.exitPointerLock()
    }

    setupGaussianFirstPersonControls()
    updateGaussianFirstPersonCamera({ emitChange: true })
    rememberGaussianSafePose()
  }

  gaussianCamera.updateProjectionMatrix()
}

const syncGaussianRotationFromPanorama = (rot: CameraRot) => {
  if (!firstPersonEnabled.value || !perspectiveCamera) return

  gaussianCameraRot.value.lon = normalizeLon(rot.lon)
  gaussianCameraRot.value.lat = clampFirstPersonLat(rot.lat)

  updateGaussianFirstPersonCamera({ emitChange: true })
}

const getRotationLookDistance = () => {
  if (!gaussianCamera) return 10
  if (gaussianControls) {
    return Math.max(
      gaussianCamera.position.distanceTo(gaussianControls.target),
      0.5,
    )
  }
  return 10
}

const getResolvedFirstPersonEyeHeight = () =>
  firstPersonEyeHeight ?? DEFAULT_FIRST_PERSON_EYE_HEIGHT

const raycastGaussianFromOrigin = (
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  maxDistance: number,
  radius = 0.05,
) => {
  if (!lccObject || typeof lccObject.raycastFromOrigin !== 'function') {
    return null
  }

  const hit = lccObject.raycastFromOrigin({
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

const sampleGaussianGroundHeight = (position: THREE.Vector3) => {
  const downward = new THREE.Vector3(0, -1, 0)
  const localOrigin = position.clone()
  localOrigin.y += 0.2
  const localHit = raycastGaussianFromOrigin(
    localOrigin,
    downward,
    Math.max(
      FIRST_PERSON_GROUND_PROBE_DISTANCE,
      getResolvedFirstPersonEyeHeight() * 4,
    ),
    0.06,
  )
  if (localHit) {
    lastFirstPersonGroundHeight = localHit.y
    return localHit.y
  }

  const globalOrigin = position.clone()
  globalOrigin.y += Math.max(FIRST_PERSON_GROUND_PROBE_DISTANCE, 12)
  const globalHit = raycastGaussianFromOrigin(globalOrigin, downward, 30, 0.06)
  const fallbackGround = globalHit?.y ?? null
  if (fallbackGround === null) return lastFirstPersonGroundHeight
  if (
    lastFirstPersonGroundHeight !== null &&
    fallbackGround >
      lastFirstPersonGroundHeight + FIRST_PERSON_MAX_GROUND_HEIGHT_JUMP
  ) {
    return lastFirstPersonGroundHeight
  }
  lastFirstPersonGroundHeight = fallbackGround
  return fallbackGround
}

const refreshGaussianFirstPersonEyeHeight = () => {
  if (!gaussianCamera) return
  const groundHeight = sampleGaussianGroundHeight(gaussianCamera.position)
  if (groundHeight === null) {
    firstPersonEyeHeight = DEFAULT_FIRST_PERSON_EYE_HEIGHT
    lastFirstPersonGroundHeight = null
    return
  }
  firstPersonEyeHeight = DEFAULT_FIRST_PERSON_EYE_HEIGHT
  lastFirstPersonGroundHeight = groundHeight
}

const resolveGaussianGroundFollowingPosition = (
  targetPosition: THREE.Vector3,
  options?: { snapImmediately?: boolean },
) => {
  if (!gaussianCamera) return targetPosition
  const groundHeight = sampleGaussianGroundHeight(targetPosition)
  if (groundHeight === null) return targetPosition

  const desiredY = groundHeight + getResolvedFirstPersonEyeHeight()
  const currentY = gaussianCamera.position.y
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

const syncGaussianFirstPersonRotationFromCamera = () => {
  if (!gaussianCamera) return
  const direction = new THREE.Vector3()
  gaussianCamera.getWorldDirection(direction)
  const nextRot = directionToRotation(direction)
  gaussianCameraRot.value.lon = normalizeLon(nextRot.lon)
  gaussianCameraRot.value.lat = clampFirstPersonLat(nextRot.lat)
}

const emitCameraOrientation = () => {
  if (!gaussianModelLoaded.value) return
  const rot = getCameraOrientation()
  if (!rot) return
  emit('camera-change', rot)
}

const applyRotationOnly = (
  rot: CameraRot,
  options?: { emitChange?: boolean },
) => {
  if (!gaussianCamera) return
  if (firstPersonEnabled.value) {
    gaussianCameraRot.value.lon = normalizeLon(rot.lon)
    gaussianCameraRot.value.lat = clampFirstPersonLat(rot.lat)
    updateGaussianFirstPersonCamera({ emitChange: options?.emitChange })
    return
  }
  const direction = rotationToDirection(rot)
  const lookDistance = getRotationLookDistance()
  const target = gaussianCamera.position
    .clone()
    .addScaledVector(direction, lookDistance)

  if (gaussianControls) {
    gaussianControls.target.copy(target)
    gaussianControls.update()
  }
  gaussianCamera.lookAt(target)
  gaussianCamera.updateMatrixWorld()
  markAnnotationOverlayVisibilityDirty()
  syncAnnotationOverlays()
  if (options?.emitChange) emitCameraOrientation()
}

const applyRotationLockState = () => {
  if (!gaussianControls) return
  const locked = Boolean(props.rotationLock)
  gaussianControls.enableRotate = !locked
  gaussianControls.enablePan = !locked
  gaussianControls.enableZoom = !locked
}

const createGaussianControls = (camera: THREE.PerspectiveCamera) => {
  if (!gaussianRenderer) return

  if (gaussianControls) {
    gaussianControls.dispose()
  }

  gaussianControls = new OrbitControls(camera, gaussianRenderer.domElement)
  gaussianControls.target.set(0, 1, 0)
  gaussianControls.enableDamping = true
  gaussianControls.dampingFactor = 0.15
  gaussianControls.rotateSpeed = 0.3
  gaussianControls.panSpeed = 0.3
  gaussianControls.zoomSpeed = 1.0
  gaussianControls.minDistance = 0.5
  gaussianControls.maxDistance = 100
  gaussianControls.addEventListener('change', () => {
    markAnnotationOverlayVisibilityDirty()
    syncAnnotationOverlays()
    emitCameraOrientation()
  })

  gaussianControls.update()
  applyRotationLockState()
}

const getPickOffset = () => {
  if (!gaussianCamera || !gaussianControls) return 0.01
  return Math.max(
    0.005,
    gaussianCamera.position.distanceTo(gaussianControls.target) * 0.002,
  )
}

const applyPickOffset = (point: THREE.Vector3) => {
  const offset = getPickOffset()
  return point
    .clone()
    .addScaledVector(annotationRaycaster.ray.direction, -offset)
}

const pickAnnotationOverlayMarker = (event: PointerEvent) => {
  if (!gaussianContainer.value) return null
  const rect = gaussianContainer.value.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  const candidates: {
    overlay: AnnotationOverlayMarker
    point: THREE.Vector3
    key?: string
    synced?: boolean
  }[] = []

  if (currentAnnotationOverlay.value && annotationMarker) {
    candidates.push({
      overlay: currentAnnotationOverlay.value,
      point: annotationMarker.position.clone(),
    })
  }
  if (props.annotationMarkersVisible === false) return null
  for (const marker of annotationOverlayMarkers.value) {
    const markerGroup = annotationStashMarkerMap.get(marker.key)
    if (!markerGroup) continue
    candidates.push({
      overlay: marker,
      point: markerGroup.position.clone(),
      key: marker.key,
      synced: Boolean(markerGroup.userData.isSynced),
    })
  }

  let matched: {
    point: THREE.Vector3
    key?: string
    synced?: boolean
  } | null = null
  let minDistance = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    const radius = candidate.overlay.size / 2 + 10
    const dx = x - candidate.overlay.left
    const dy = y - candidate.overlay.top
    const distanceSq = dx * dx + dy * dy
    if (distanceSq > radius * radius || distanceSq >= minDistance) continue
    minDistance = distanceSq
    matched = {
      point: candidate.point,
      key: candidate.key,
      synced: candidate.synced,
    }
  }

  return matched
}

const pickGaussianAnnotationPoint = (event: PointerEvent) => {
  if (!gaussianRenderer || !gaussianCamera || !gaussianScene) return null
  const rect = gaussianRenderer.domElement.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  annotationRaycaster.setFromCamera(new THREE.Vector2(x, y), gaussianCamera)

  const overlayHit = pickAnnotationOverlayMarker(event)
  if (overlayHit) {
    return overlayHit
  }

  if (annotationMarker) {
    const markerHits = annotationRaycaster.intersectObject(
      annotationMarker,
      true,
    )
    if (markerHits.length > 0) {
      return { point: annotationMarker.position.clone() }
    }
  }

  if (annotationStashGroup) {
    const stashHits = annotationRaycaster.intersectObject(
      annotationStashGroup,
      true,
    )
    if (stashHits.length > 0) {
      const markerGroup = resolveAnnotationMarkerFromHit(stashHits[0].object)
      if (markerGroup) {
        return {
          point: markerGroup.position.clone(),
          key: markerGroup.userData.annotationKey as string,
          synced: Boolean(markerGroup.userData.isSynced),
        }
      }
    }
  }

  if (lccObject && typeof lccObject.raycastFromOrigin === 'function') {
    const hit = lccObject.raycastFromOrigin({
      origin: {
        x: annotationRaycaster.ray.origin.x,
        y: annotationRaycaster.ray.origin.y,
        z: annotationRaycaster.ray.origin.z,
      },
      direction: {
        x: annotationRaycaster.ray.direction.x,
        y: annotationRaycaster.ray.direction.y,
        z: annotationRaycaster.ray.direction.z,
      },
      maxDistance: gaussianCamera.far || 150000,
      radius: 0.05,
    })
    if (
      hit &&
      Number.isFinite(hit.x) &&
      Number.isFinite(hit.y) &&
      Number.isFinite(hit.z)
    ) {
      return {
        point: applyPickOffset(new THREE.Vector3(hit.x, hit.y, hit.z)),
      }
    }
  }

  const hits = annotationRaycaster
    .intersectObject(gaussianScene, true)
    .filter((hit) => !resolveAnnotationMarkerFromHit(hit.object))
  if (hits.length > 0) {
    return { point: applyPickOffset(hits[0].point) }
  }

  if (gaussianControls) {
    const fallbackDistance = Math.max(
      gaussianCamera.position.distanceTo(gaussianControls.target),
      1,
    )
    return {
      point: annotationRaycaster.ray.origin
        .clone()
        .addScaledVector(annotationRaycaster.ray.direction, fallbackDistance),
    }
  }

  return null
}

const drawAnnotationMarkerOnContext = (
  ctx: CanvasRenderingContext2D,
  marker: AnnotationOverlayMarker,
) => {
  const outerRadius = marker.size / 2
  const innerRadius = outerRadius * 0.55
  ctx.save()
  if (marker.highlighted) {
    ctx.shadowColor = marker.color
    ctx.shadowBlur = 12
  }
  ctx.beginPath()
  ctx.fillStyle = marker.color
  ctx.arc(marker.left, marker.top, outerRadius, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.beginPath()
  ctx.fillStyle = '#ffffff'
  ctx.arc(marker.left, marker.top, innerRadius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

const handleAnnotationPointerDown = (event: PointerEvent) => {
  if (!props.annotationEnabled || !gaussianModelLoaded.value) return
  if (event.button !== 0) return
  annotationPointerDown = { x: event.clientX, y: event.clientY }
  annotationPointerDragging = false
  annotationPointerId = event.pointerId
  gaussianRenderer?.domElement.setPointerCapture?.(event.pointerId)
}

const handleAnnotationPointerMove = (event: PointerEvent) => {
  if (!annotationPointerDown) return
  const dx = event.clientX - annotationPointerDown.x
  const dy = event.clientY - annotationPointerDown.y
  if (dx * dx + dy * dy > 16) {
    annotationPointerDragging = true
  }
}

const handleAnnotationPointerUp = (event: PointerEvent) => {
  if (!annotationPointerDown) return
  if (annotationPointerId !== null) {
    gaussianRenderer?.domElement.releasePointerCapture?.(annotationPointerId)
  }
  annotationPointerId = null
  const wasDragging = annotationPointerDragging
  annotationPointerDown = null
  annotationPointerDragging = false
  if (wasDragging) return
  if (!props.annotationEnabled || !gaussianModelLoaded.value) return
  if (event.button !== 0) return
  const result = pickGaussianAnnotationPoint(event)
  if (!result) return
  emit('annotation-pick', {
    point: { x: result.point.x, y: result.point.y, z: result.point.z },
    screen: { x: event.clientX, y: event.clientY },
    source: 'gaussian',
    key: result.key,
    synced: result.synced,
  })
  setAnnotationMarker(result.point)
}

const handleRotationPointerDown = (event: PointerEvent) => {
  if (!props.rotationLock || !gaussianModelLoaded.value) return
  if (event.button !== 0) return
  rotationPointerId = event.pointerId
  rotationPointerDown = { x: event.clientX, y: event.clientY }
  gaussianRenderer?.domElement.setPointerCapture?.(event.pointerId)
}

const handleRotationPointerMove = (event: PointerEvent) => {
  if (!props.rotationLock || !rotationPointerDown) return
  const currentRot = getCameraOrientation()
  if (!currentRot) return

  const deltaX = event.clientX - rotationPointerDown.x
  const deltaY = event.clientY - rotationPointerDown.y
  if (deltaX === 0 && deltaY === 0) return

  rotationPointerDown = { x: event.clientX, y: event.clientY }
  applyRotationOnly(
    {
      lon: currentRot.lon - deltaX * 0.2,
      lat: clampLat(currentRot.lat - deltaY * 0.2),
    },
    { emitChange: true },
  )
}

const clearRotationPointerState = () => {
  if (rotationPointerId !== null) {
    try {
      gaussianRenderer?.domElement.releasePointerCapture?.(rotationPointerId)
    } catch {
      // ignore stale pointer capture
    }
  }
  rotationPointerId = null
  rotationPointerDown = null
}

const handleRotationPointerUp = () => {
  clearRotationPointerState()
}

const handleRotationWheel = (event: WheelEvent) => {
  if (!props.rotationLock) return
  event.preventDefault()
}

const forceCaptureDataUrl = () => {
  if (!gaussianRenderer || !gaussianScene || !gaussianCamera) return null
  const shouldRender = !lccObject || !lccObject?.disableThreeJSRender
  if (shouldRender) {
    refreshAnnotationMarkerScales()
    gaussianRenderer.render(gaussianScene, gaussianCamera)
  }
  try {
    const rect = gaussianRenderer.domElement.getBoundingClientRect()
    const viewportWidth = gaussianRenderer.domElement.width || rect.width
    const viewportHeight = gaussianRenderer.domElement.height || rect.height
    refreshAnnotationOverlayVisibility(true)
    const projected = collectAnnotationOverlayMarkers(
      viewportWidth,
      viewportHeight,
    )
    const output = document.createElement('canvas')
    output.width = Math.max(1, Math.floor(viewportWidth))
    output.height = Math.max(1, Math.floor(viewportHeight))
    const ctx = output.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(
      gaussianRenderer.domElement,
      0,
      0,
      output.width,
      output.height,
    )
    projected.stash.forEach((marker) =>
      drawAnnotationMarkerOnContext(ctx, marker),
    )
    if (projected.current) {
      drawAnnotationMarkerOnContext(ctx, projected.current)
    }
    return {
      dataUrl: output.toDataURL('image/png'),
      rect,
    }
  } catch {
    return null
  }
}

const setupGaussianFirstPersonControls = () => {
  if (!gaussianContainer.value || !perspectiveCamera) return

  const container = gaussianContainer.value

  const onMouseDown = (event: MouseEvent) => {
    gaussianMouseDown.value = true
    gaussianMousePos.value = { x: event.clientX, y: event.clientY }
  }

  const onMouseMove = (event: MouseEvent) => {
    if (!gaussianMouseDown.value) return

    const deltaX = event.clientX - gaussianMousePos.value.x
    const deltaY = event.clientY - gaussianMousePos.value.y

    gaussianMousePos.value = { x: event.clientX, y: event.clientY }
    applyFirstPersonRotationDelta(deltaX, deltaY)
  }

  const onMouseUp = () => {
    gaussianMouseDown.value = false
  }

  const onMouseLeave = () => {
    gaussianMouseDown.value = false
  }

  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    if (!perspectiveCamera) return

    const delta = event.deltaY > 0 ? 5 : -5
    const newFov = Math.max(30, Math.min(90, perspectiveCamera.fov + delta))
    perspectiveCamera.fov = newFov
    perspectiveCamera.updateProjectionMatrix()

    if (firstPersonEnabled.value) {
      emit('panorama-fov-sync', newFov)
    }
  }

  container.removeEventListener('mousedown', onMouseDown)
  container.removeEventListener('mousemove', onMouseMove)
  container.removeEventListener('mouseup', onMouseUp)
  container.removeEventListener('mouseleave', onMouseLeave)
  container.removeEventListener('wheel', onWheel)

  container.addEventListener('mousedown', onMouseDown)
  container.addEventListener('mousemove', onMouseMove)
  container.addEventListener('mouseup', onMouseUp)
  container.addEventListener('mouseleave', onMouseLeave)
  container.addEventListener('wheel', onWheel, { passive: false })
}

const updateGaussianFirstPersonCamera = (options?: {
  emitChange?: boolean
}) => {
  if (!gaussianCamera || !gaussianControls) return

  const direction = rotationToDirection({
    lon: gaussianCameraRot.value.lon,
    lat: clampFirstPersonLat(gaussianCameraRot.value.lat),
  })
  const target = gaussianCamera.position.clone().addScaledVector(direction, 10)

  gaussianControls.target.copy(target)
  gaussianCamera.up.set(0, 1, 0)
  gaussianCamera.lookAt(target)
  gaussianCamera.updateMatrixWorld()
  gaussianControls.update()

  if (options?.emitChange) {
    emitCameraOrientation()
  }
}

const applyFirstPersonRotationDelta = (deltaX: number, deltaY: number) => {
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

  gaussianCameraRot.value.lon = normalizeLon(
    gaussianCameraRot.value.lon -
      limitedDeltaX * FIRST_PERSON_ROTATION_SENSITIVITY,
  )
  gaussianCameraRot.value.lat = clampFirstPersonLat(
    gaussianCameraRot.value.lat -
      limitedDeltaY * FIRST_PERSON_ROTATION_SENSITIVITY,
  )
  updateGaussianFirstPersonCamera({ emitChange: true })
}

const getGaussianFirstPersonMoveBasis = () => {
  if (!gaussianCamera) return null

  const forward = new THREE.Vector3()
  gaussianCamera.getWorldDirection(forward)
  forward.y = 0

  if (forward.lengthSq() < 1e-8) {
    forward.copy(
      rotationToDirection({
        lon: gaussianCameraRot.value.lon,
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

const moveGaussianCamera = (
  direction: MoveDirection,
  distanceOverride?: number,
) => {
  if (props.rotationLock) return
  if (!gaussianCamera || !gaussianControls) return

  const moveDistance = distanceOverride ?? 0.8
  const moveBasis = getGaussianFirstPersonMoveBasis()
  if (!moveBasis) return
  const { forward, right } = moveBasis

  const offset = new THREE.Vector3()

  switch (direction) {
    case 'up':
      offset.copy(forward).multiplyScalar(moveDistance)
      break
    case 'down':
      offset.copy(forward).multiplyScalar(-moveDistance)
      break
    case 'left':
      offset.copy(right).multiplyScalar(moveDistance)
      break
    case 'right':
      offset.copy(right).multiplyScalar(-moveDistance)
      break
  }

  if (firstPersonEnabled.value) {
    gaussianCamera.position.copy(
      resolveGaussianGroundFollowingPosition(
        gaussianCamera.position.clone().add(offset),
      ),
    )
    tryResolveGaussianCollision()
    gaussianCamera.position.copy(
      resolveGaussianGroundFollowingPosition(gaussianCamera.position.clone(), {
        snapImmediately: true,
      }),
    )
    updateGaussianFirstPersonCamera({ emitChange: true })
    return
  }

  gaussianCamera.position.add(offset)
  gaussianControls.target.add(offset)
  gaussianControls.update()
  tryResolveGaussianCollision()
  emitCameraOrientation()
}

const updateFirstPersonMovement = (timestamp: number) => {
  if (!firstPersonEnabled.value) {
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
  const moveDistance = FIRST_PERSON_MOVE_SPEED * deltaSeconds

  const moveBasis = getGaussianFirstPersonMoveBasis()
  if (!moveBasis) return false
  const { forward, right } = moveBasis

  const offset = new THREE.Vector3()
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

  gaussianCamera.position.copy(
    resolveGaussianGroundFollowingPosition(
      gaussianCamera.position.clone().add(offset),
    ),
  )
  tryResolveGaussianCollision()
  gaussianCamera.position.copy(
    resolveGaussianGroundFollowingPosition(gaussianCamera.position.clone(), {
      snapImmediately: true,
    }),
  )
  updateGaussianFirstPersonCamera({ emitChange: true })
  rememberGaussianSafePose()
  return true
}

const handleKeydown = (event: KeyboardEvent) => {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement
  ) {
    return
  }
  if (!hasGaussianKeyboardFocus()) return

  if (!gaussianModelLoaded.value) return
  if (props.rotationLock) return

  switch (event.key.toLowerCase()) {
    case 'w':
      event.preventDefault()
      if (firstPersonEnabled.value) {
        activeFirstPersonMoveDirections.add('up')
      } else {
        moveGaussianCamera('up')
      }
      break
    case 's':
      event.preventDefault()
      if (firstPersonEnabled.value) {
        activeFirstPersonMoveDirections.add('down')
      } else {
        moveGaussianCamera('down')
      }
      break
    case 'a':
      event.preventDefault()
      if (firstPersonEnabled.value) {
        activeFirstPersonMoveDirections.add('left')
      } else {
        moveGaussianCamera('left')
      }
      break
    case 'd':
      event.preventDefault()
      if (firstPersonEnabled.value) {
        activeFirstPersonMoveDirections.add('right')
      } else {
        moveGaussianCamera('right')
      }
      break
    case 'escape':
      if (!firstPersonEnabled.value) return
      event.preventDefault()
      switchViewMode('perspective')
      break
    case 'r':
      event.preventDefault()
      handleResetView()
      break
  }
}

const handleKeyup = (event: KeyboardEvent) => {
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

const cleanupGaussianModel = () => {
  if (isCleaningUp) return
  isCleaningUp = true
  clearGaussianInitTimer()
  clearGaussianLoadWatchdog()
  clearGaussianQualityUpgradeTimer()

  window.removeEventListener('resize', handleGaussianResize)

  try {
    if (gaussianResizeObserver) {
      runSafely('ResizeObserver清理', () => {
        gaussianResizeObserver?.disconnect()
      })
      gaussianResizeObserver = null
    }

    if (gaussianAnimationId) {
      runSafely('动画帧清理', () => {
        cancelAnimationFrame(gaussianAnimationId)
      })
      gaussianAnimationId = 0
    }

    if (lccObject && LCCRender) {
      runSafely('LCC卸载', () => {
        LCCRender.unload(lccObject)
      })
    }
    lccObject = null
    // 当前 SDK 的 LCCRender 是全局单例；仅 unload 会复用首次绑定的 canvas/scene，
    // 视图隐藏再显示后容易继续绑到旧渲染上下文，导致白屏。这里做一次完整重置。
    disposeLccManager()

    if (gaussianControls) {
      runSafely('控制器释放', () => {
        gaussianControls?.dispose()
      })
      gaussianControls = null
    }

    if (gaussianRenderer) {
      const rendererDom = gaussianRenderer.domElement
      runSafely('高斯批注事件解绑', () => {
        rendererDom?.removeEventListener(
          'pointerdown',
          handleAnnotationPointerDown,
        )
        rendererDom?.removeEventListener(
          'pointermove',
          handleAnnotationPointerMove,
        )
        rendererDom?.removeEventListener('pointerup', handleAnnotationPointerUp)
        rendererDom?.removeEventListener(
          'pointercancel',
          handleAnnotationPointerUp,
        )
        rendererDom?.removeEventListener(
          'pointerdown',
          handleRotationPointerDown,
        )
        rendererDom?.removeEventListener(
          'pointermove',
          handleRotationPointerMove,
        )
        rendererDom?.removeEventListener('pointerup', handleRotationPointerUp)
        rendererDom?.removeEventListener(
          'pointercancel',
          handleRotationPointerUp,
        )
        rendererDom?.removeEventListener('wheel', handleRotationWheel)
      })
      runSafely('渲染器释放', () => {
        gaussianRenderer?.dispose()
      })
      runSafely('WebGL上下文释放', () => {
        gaussianRenderer?.forceContextLoss()
      })
      if (rendererDom && rendererDom.parentNode) {
        runSafely('Canvas节点移除', () => {
          rendererDom.parentNode?.removeChild(rendererDom)
        })
      }
    }

    if (annotationMarker && gaussianScene) {
      runSafely('当前高斯批注标记释放', () => {
        gaussianScene.remove(annotationMarker!)
        disposeObject3D(annotationMarker!)
      })
      annotationMarker = null
    }

    if (annotationStashGroup && gaussianScene) {
      runSafely('高斯批注列表标记释放', () => {
        for (const marker of annotationStashMarkerMap.values()) {
          annotationStashGroup?.remove(marker)
          disposeObject3D(marker)
        }
      })
      annotationStashMarkerMap.clear()
      runSafely('高斯批注列表标记组移除', () => {
        gaussianScene.remove(annotationStashGroup!)
      })
      annotationStashGroup = null
    }

    if (gaussianScene) {
      runSafely('场景资源释放', () => {
        gaussianScene?.traverse((object: any) => {
          if (
            object.geometry &&
            typeof object.geometry.dispose === 'function'
          ) {
            object.geometry.dispose()
          }
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((material: any) => {
                if (material && typeof material.dispose === 'function') {
                  material.dispose()
                }
              })
            } else if (typeof object.material.dispose === 'function') {
              object.material.dispose()
            }
          }
        })
      })
    }
  } finally {
    annotationPointerId = null
    annotationPointerDown = null
    annotationPointerDragging = false
    clearRotationPointerState()
    currentAnnotationOverlay.value = null
    annotationOverlayMarkers.value = []
    gaussianLastSafePose = null
    gaussianLastFrameTransform = null
    gaussianLastCollisionPosition = null
    annotationOverlayVisibility.clear()
    annotationOverlayVisibilityCheckedAt = 0
    annotationOverlayVisibilityDirty = true
    activeFirstPersonMoveDirections.clear()
    lastFirstPersonMoveAt = 0
    firstPersonEyeHeight = null
    lastFirstPersonGroundHeight = null
    gaussianLoadInFlight = false
    worldOriginAxes = null
    gaussianScene = null
    gaussianCamera = null
    gaussianRenderer = null
    perspectiveCamera = null
    gaussianModelLoaded.value = false
    emit('loaded-change', false)
    isCleaningUp = false
  }
}

const updateGaussianCameraFromTrajectory = (point: TrajectoryPoint) => {
  if (!gaussianCamera || !gaussianModelLoaded.value) {
    pendingTrajectoryPoint.value = point
    return
  }
  if (isAnimatingCamera.value) return

  suppressGaussianCollisionUntil =
    performance.now() + GAUSSIAN_TRAJECTORY_COLLISION_SUPPRESS_MS
  gaussianLastSafePose = null
  gaussianLastCollisionPosition = null

  const pose = buildGaussianTrajectoryYUpPose(point)

  const wasFirstPerson = firstPersonEnabled.value
  if (wasFirstPerson) {
    firstPersonEnabled.value = false
    activeFirstPersonMoveDirections.clear()
    lastFirstPersonMoveAt = 0
    lastFirstPersonGroundHeight = null
  }

  isAnimatingCamera.value = true

  animateGaussianCameraTo(pose.camera, pose.target, 1500, () => {
    isAnimatingCamera.value = false

    if (viewMode.value === 'firstPerson') {
      firstPersonEnabled.value = true
      if (gaussianControls) gaussianControls.enabled = false
      syncGaussianFirstPersonRotationFromCamera()
      refreshGaussianFirstPersonEyeHeight()
      gaussianCamera.position.copy(
        resolveGaussianGroundFollowingPosition(
          gaussianCamera.position.clone(),
          {
            snapImmediately: true,
          },
        ),
      )
      updateGaussianFirstPersonCamera({ emitChange: true })
    } else {
      firstPersonEnabled.value = false
      if (gaussianControls) gaussianControls.enabled = true
    }
  })
}

const animateGaussianCameraTo = (
  endPosition: THREE.Vector3,
  endTarget: THREE.Vector3,
  duration: number,
  onComplete?: () => void,
) => {
  if (!gaussianCamera || !gaussianControls) {
    onComplete?.()
    return
  }

  const startPosition = gaussianCamera.position.clone()
  const startTarget = gaussianControls.target.clone()
  const startTime = performance.now()

  const oldEnableDamping = gaussianControls.enableDamping
  gaussianControls.enableDamping = false

  const animate = () => {
    const currentTime = performance.now()
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const easeProgress = progress * (2 - progress)

    gaussianCamera.position.lerpVectors(
      startPosition,
      endPosition,
      easeProgress,
    )
    gaussianControls!.target.lerpVectors(startTarget, endTarget, easeProgress)
    gaussianControls!.update()

    if (progress < 1) {
      requestAnimationFrame(animate)
    } else {
      gaussianCamera.position.copy(endPosition)
      gaussianControls!.target.copy(endTarget)
      gaussianControls!.update()

      gaussianControls.enableDamping = oldEnableDamping

      onComplete?.()
    }
  }

  animate()
}

const getCameraOrientation = () => {
  if (!gaussianCamera) return null
  const direction = new THREE.Vector3()
  gaussianCamera.getWorldDirection(direction)
  return directionToRotation(direction)
}

const syncFromPanoramaRotation = (rot: CameraRot) => {
  applyRotationOnly(rot)
}

const reloadGaussianModel = () => {
  restartGaussianModel(true)
}

watch(
  () => props.panoramaCameraRot,
  (rot) => {
    if (!rot) return
    if (!firstPersonEnabled.value) return
    syncGaussianRotationFromPanorama(rot)
  },
  { deep: true },
)

watch(
  () => props.panoramaFov,
  (fov) => {
    if (!fov || !perspectiveCamera) return
    if (!firstPersonEnabled.value) return
    perspectiveCamera.fov = fov
    perspectiveCamera.updateProjectionMatrix()
  },
)

watch(
  () => [props.projectId, props.gaussFileId, normalizedGaussAssetPath.value],
  (newValue, oldValue) => {
    if (!oldValue) return
    if (
      newValue[0] === oldValue[0] &&
      newValue[1] === oldValue[1] &&
      newValue[2] === oldValue[2]
    ) {
      return
    }
    if (!newValue[0] || !newValue[1]) {
      restartGaussianModel(true)
      return
    }
    reloadGaussianModel()
  },
)

watch(
  () => props.annotationPoint,
  (value) => {
    if (!value) {
      setAnnotationMarker(null)
      return
    }
    setAnnotationMarker(new THREE.Vector3(value.x, value.y, value.z))
  },
  { immediate: true },
)

watch(
  () => props.annotationStatus,
  (status) => {
    applyAnnotationMarkerStyle(status, annotationMarker)
  },
  { immediate: true },
)

watch(
  () => props.annotationHighlightCurrent,
  (highlighted) => {
    applyAnnotationMarkerScale(annotationMarker, highlighted)
  },
  { immediate: true },
)

watch(
  () => props.annotationMarkersVisible,
  () => {
    if (annotationMarker) {
      annotationMarker.visible = props.annotationMarkersVisible !== false
    }
    for (const marker of annotationStashMarkerMap.values()) {
      marker.visible = props.annotationMarkersVisible !== false
    }
    syncAnnotationOverlays()
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

watch(
  () => props.rotationLock,
  () => {
    applyRotationLockState()
    if (props.rotationLock && firstPersonEnabled.value) {
      firstPersonEnabled.value = false
      activeFirstPersonMoveDirections.clear()
      lastFirstPersonMoveAt = 0
      lastFirstPersonGroundHeight = null
      cleanupGaussianFirstPersonControls()
      if (gaussianControls) gaussianControls.enabled = true
    }
    if (!props.rotationLock) clearRotationPointerState()
  },
  { immediate: true },
)

const setCameraPose = (
  pose: { camera: THREE.Vector3; target: THREE.Vector3 } | null,
) => {
  if (!gaussianCamera || !gaussianControls || !pose) return
  if (firstPersonEnabled.value) {
    firstPersonEnabled.value = false
    activeFirstPersonMoveDirections.clear()
    lastFirstPersonMoveAt = 0
    lastFirstPersonGroundHeight = null
  }
  gaussianCamera.position.copy(pose.camera)
  gaussianControls.target.copy(pose.target)
  gaussianCamera.lookAt(gaussianControls.target)
  gaussianCamera.updateMatrixWorld()
  gaussianControls.update()
  emitCameraOrientation()
}

const getCameraPose = () => {
  if (!gaussianCamera || !gaussianControls) return null
  return {
    camera: gaussianCamera.position.clone(),
    target: gaussianControls.target.clone(),
  }
}

onMounted(() => {
  destroyed = false
  installGaussFetchInterceptor()
  if (hasGaussianSourceBinding.value) {
    void nextTick(() => {
      initGaussianModel()
    })
  } else {
    gaussianLoadingText.value = '等待高斯文件绑定...'
  }
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('keyup', handleKeyup)
})

onBeforeUnmount(() => {
  destroyed = true
  cleanupGaussianFirstPersonControls()
  cleanupGaussianModel()
  uninstallGaussFetchInterceptor()
  window.removeEventListener('resize', handleGaussianResize)
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('keyup', handleKeyup)
})

defineExpose({
  init: initGaussianModel,
  reloadModel: reloadGaussianModel,
  syncFromTrajectory: updateGaussianCameraFromTrajectory,
  cleanup: cleanupGaussianModel,
  getCameraPose,
  setCameraPose,
  switchViewMode,
  enterFirstPersonMode: () => switchViewMode('firstPerson'),
  exitFirstPersonMode: () => switchViewMode('perspective'),
  toggleFirstPersonMode,
  isFirstPersonActive: () => firstPersonEnabled.value,
  getCameraOrientation,
  syncFromPanoramaRotation,
  getAnnotationMarkerPosition: () => {
    if (!annotationMarker) return null
    return {
      x: annotationMarker.position.x,
      y: annotationMarker.position.y,
      z: annotationMarker.position.z,
    }
  },
  forceCaptureDataUrl,
})
</script>

<style scoped>
.gaussian-view-panel {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.panel-actions {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 12;
}

.panel-actions .panel-refresh-btn {
  position: static;
  top: auto;
  right: auto;
}

.gaussian-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #1a1a2e;
}

.gaussian-container:focus {
  outline: none;
}

.gaussian-container canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.gaussian-annotation-overlay {
  position: absolute;
  inset: 0;
  z-index: 8;
  pointer-events: none;
}

.gaussian-annotation-overlay__marker {
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

.gaussian-annotation-overlay__marker::after {
  content: '';
  position: absolute;
  inset: 22%;
  border-radius: 50%;
  background: #fff;
}

.gaussian-annotation-overlay__marker.is-highlighted {
  box-shadow:
    0 0 0 1px rgba(14, 20, 34, 0.12),
    0 0 14px var(--marker-color);
}

.gaussian-annotation-overlay__marker.is-synced {
  opacity: 0.92;
}

.gaussian-annotation-overlay__marker.is-current {
  z-index: 1;
}

.direction-controls {
  position: absolute;
  bottom: 20px;
  left: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  z-index: 9;
  user-select: none;
  padding: 12px;
  background: rgba(10, 10, 10, 0.15);
  backdrop-filter: blur(8px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
}

.direction-controls:hover {
  background: rgba(10, 10, 10, 0.25);
  backdrop-filter: blur(12px);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.direction-controls .arrow-horizontal {
  display: flex;
  align-items: center;
  gap: 6px;
}

.direction-controls .arrow-btn {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px) saturate(150%);
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.direction-controls .arrow-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at center,
    rgba(64, 158, 255, 0.1),
    transparent 70%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}

.direction-controls .arrow-btn .el-icon {
  color: rgba(255, 255, 255, 0.65);
  font-size: 24px;
  transition: all 0.3s ease;
  position: relative;
  z-index: 1;
}

.direction-controls .arrow-btn:hover {
  background: rgba(64, 158, 255, 0.28);
  backdrop-filter: blur(16px) saturate(180%);
  border-color: rgba(64, 158, 255, 0.5);
  transform: scale(1.1);
  box-shadow:
    0 8px 24px rgba(64, 158, 255, 0.4),
    0 0 20px rgba(64, 158, 255, 0.2);
}

.direction-controls .arrow-btn:hover::before {
  opacity: 1;
}

.direction-controls .arrow-btn:hover .el-icon {
  color: rgba(255, 255, 255, 1);
  transform: scale(1.15);
  filter: drop-shadow(0 0 8px rgba(64, 158, 255, 0.6));
}

.direction-controls .arrow-btn:active {
  transform: scale(0.98);
  background: rgba(64, 158, 255, 0.4);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}
</style>
