<template>
  <div class="bim-view-panel">
    <div v-if="showInternalControls" class="panel-actions">
      <button
        :class="[
          'panel-refresh-btn',
          { 'is-first-person-active': firstPersonActive },
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
        aria-label="重置视角"
        title="重置视角"
        @click="handleResetView"
      >
        <el-icon><RefreshRight /></el-icon>
      </button>
    </div>
    <div v-if="!bimModelLoaded" class="empty-placeholder">
      <div class="placeholder-content">
        <el-icon class="placeholder-icon"><View /></el-icon>
        <p class="placeholder-text" style="color: #fff">{{ bimStatusText }}</p>
      </div>
    </div>
    <div
      ref="bimViewportEl"
      class="bim-viewport"
      tabindex="0"
      @pointerdown="focusBimViewport"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RefreshRight, User, View } from '@element-plus/icons-vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import type { TrajectoryPoint } from '@/api/calibration'
import { getIfcGlbFile } from '@/api/fileManage'
import {
  buildFusionBimWorldMatrix,
  buildGaussianTrajectoryYUpPose,
} from '../utils/fusionTransforms'

type Calibration = {
  modelMatrix: number[]
}

type CameraPose = { camera: THREE.Vector3; target: THREE.Vector3 }
type MoveDirection = 'up' | 'down' | 'left' | 'right'

const formatMatrix = (matrix?: THREE.Matrix4 | null) => {
  if (!matrix) return null
  return matrix.toArray().map((value) => Number(value.toFixed(6)))
}

const formatPose = (pose?: CameraPose | null) => {
  if (!pose) return null
  return {
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
}

const props = defineProps<{
  isPresetMode: boolean
  calibration?: Calibration | null
  pointcloudWorldMatrix?: number[] | null
  currentTrajectoryPoint?: TrajectoryPoint | null
  showInternalControls?: boolean
  clickToEnterFirstPerson?: boolean
  rotationLock?: boolean
  annotationEnabled?: boolean
  annotationPoint?: { x: number; y: number; z: number } | null
  annotationStatus?: 'default' | 'editing' | 'saved'
  annotationPersist?: boolean
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

const showInternalControls = computed(
  () => props.showInternalControls !== false,
)

type AnnotationPickPayload = {
  point: { x: number; y: number; z: number } | null
  screen: { x: number; y: number } | null
  source: 'bim'
  key?: string
  synced?: boolean
  componentId?: string
  componentInfo?: {
    id?: string | number
    name?: string
    type?: string
  } | null
}

const emit = defineEmits<{
  (e: 'loaded-change', value: boolean): void
  (e: 'camera-change', value: { lon: number; lat: number }): void
  (e: 'first-person-change', value: boolean): void
  (e: 'annotation-pick', value: AnnotationPickPayload): void
}>()

const bimViewportEl = ref<HTMLDivElement | null>(null)
const bimStatusText = ref('等待导入 glTF/GLB...')
const bimModelLoaded = ref(false)

const focusBimViewport = () => {
  bimViewportEl.value?.focus()
}

const hasBimKeyboardFocus = () => {
  const viewport = bimViewportEl.value
  const activeElement = document.activeElement
  if (!viewport || !(activeElement instanceof HTMLElement)) return false
  return activeElement === viewport || viewport.contains(activeElement)
}

let bimScene: THREE.Scene | null = null
let bimCamera: THREE.PerspectiveCamera | null = null
let bimRenderer: THREE.WebGLRenderer | null = null
let bimControls: OrbitControls | null = null
let bimModelRoot: THREE.Object3D | null = null
let worldOriginAxes: THREE.AxesHelper | null = null
let annotationMarker: THREE.Group | null = null
let annotationStashGroup: THREE.Group | null = null
const annotationStashMarkerMap = new Map<string, THREE.Group>()
let annotationPointerId: number | null = null
let annotationPointerDown: { x: number; y: number } | null = null
let annotationPointerDragging = false
let rotationPointerId: number | null = null
let rotationPointerDown: { x: number; y: number } | null = null
let firstPersonPointerDown: { x: number; y: number } | null = null
const firstPersonActive = ref(false)
const annotationRaycaster = new THREE.Raycaster()
let highlightedElement: {
  mesh: THREE.Mesh
  overlay: THREE.Mesh
  material: THREE.Material
} | null = null
const bimModelCenter = new THREE.Vector3()
let bimModelMaxDim = 1
let fixedViewSize: number | null = null
let animationId = 0
let isRendering = false
let needsRender = false
let resizeObserver: ResizeObserver | null = null
const FIRST_PERSON_COLLISION_RADIUS = 0.35
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
let firstPersonEyeHeight: number | null = null
let lastFirstPersonGroundHeight: number | null = null
const activeFirstPersonMoveDirections = new Set<MoveDirection>()
let lastFirstPersonMoveAt = 0

const disposeObject3D = (obj: THREE.Object3D) => {
  obj.traverse((child: any) => {
    if (child?.geometry) child.geometry.dispose?.()
    const material = child?.material
    if (Array.isArray(material)) material.forEach((m) => m?.dispose?.())
    else material?.dispose?.()
  })
}

const disposeMaterial = (material: THREE.Material | null | undefined) => {
  material?.dispose?.()
}

const highlightColor = new THREE.Color('#ffcf4a')

const createHighlightOverlayMaterial = (color: THREE.Color) => {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.45,
  })
  mat.depthTest = true
  mat.depthWrite = false
  return mat
}

const clearHighlight = () => {
  if (!highlightedElement) return
  const { mesh, overlay, material } = highlightedElement
  mesh.remove(overlay)
  disposeMaterial(material)
  highlightedElement = null
  requestRender()
}

const highlightMesh = (mesh: THREE.Mesh, color: THREE.Color) => {
  clearHighlight()
  const mat = createHighlightOverlayMaterial(color)
  const overlay = new THREE.Mesh(mesh.geometry, mat)
  overlay.name = 'annotation-pick-highlight'
  overlay.userData.__annotationHighlightOverlay = true
  overlay.frustumCulled = false
  overlay.renderOrder = 9998
  overlay.matrixAutoUpdate = false
  overlay.matrix.identity()
  overlay.matrixWorldNeedsUpdate = true
  mesh.add(overlay)
  highlightedElement = { mesh, overlay, material: mat }
  requestRender()
}

const guessIfcId = (userData: any): string | undefined => {
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
    const v = userData[key]
    if (v !== undefined && v !== null && v !== '') {
      return String(v)
    }
  }
  return undefined
}

const resolveElementIdFromObject = (object: THREE.Object3D | null) => {
  let current: THREE.Object3D | null = object
  while (current) {
    if ((current as any).userData?.__annotationHighlightOverlay) {
      current = current.parent
      continue
    }
    const name = String(current.name || '')
    if (name && /^[0-9A-Za-z_$]{22}$/.test(name)) return name
    const id = guessIfcId(current.userData)
    if (id) return id
    current = current.parent
  }
  return undefined
}

const pickComponentInfoFromData = (data: any) => {
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

const resolveComponentInfoFromObject = (object: THREE.Object3D | null) => {
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

const resolveHighlightMeshFromHit = (object: THREE.Object3D | null) => {
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

const fitCameraToObject = (
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  object: THREE.Object3D,
) => {
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  if (!Number.isFinite(size.x + size.y + size.z)) return
  const maxDim = Math.max(size.x, size.y, size.z)
  if (maxDim <= 0) return

  const fov = THREE.MathUtils.degToRad(camera.fov)
  const distance = maxDim / 2 / Math.tan(fov / 2)

  controls.target.copy(center)
  camera.position.set(
    center.x,
    center.y + maxDim * 0.15,
    center.z + distance * 2.2,
  )
  camera.near = Math.max(0.01, distance / 100)
  camera.far = Math.max(5000, distance * 100)
  camera.updateProjectionMatrix()

  controls.update()
}

const setTopView = (
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  center: THREE.Vector3,
  height: number,
) => {
  const h = Number.isFinite(height) && height > 0 ? height : 10
  controls.target.copy(center)
  camera.position.set(center.x, center.y + h, center.z + 0.1)
  camera.lookAt(center)
  camera.near = 0.01
  camera.far = Math.max(5000, h * 200)
  camera.updateProjectionMatrix()
  controls.update()
}

const markerColors: Record<'default' | 'editing' | 'saved', number> = {
  default: 0x2f6bff,
  editing: 0xfacc15,
  saved: 0x22c55e,
}
const annotationMarkerBaseRadius = 1

const resolveAnnotationStatus = (value?: string) =>
  value === 'editing' || value === 'saved' ? value : 'default'

const applyAnnotationMarkerStyle = (
  status?: string,
  marker?: THREE.Group | null,
) => {
  const target = marker ?? annotationMarker
  if (!target) return
  const outerMaterial = target.userData.outerMaterial as
    | THREE.MeshBasicMaterial
    | undefined
  if (!outerMaterial) return
  outerMaterial.color.setHex(markerColors[resolveAnnotationStatus(status)])
  requestRender()
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
      bimCamera?.position.distanceTo(marker.position) ?? 1,
      bimCamera?.near ? bimCamera.near * 2 : 0.1,
      0.1,
    )
    const viewportHeight = Math.max(bimViewportEl.value?.clientHeight || 1, 1)
    const worldUnitsPerPixel = bimCamera
      ? (2 * Math.tan(THREE.MathUtils.degToRad(bimCamera.fov) / 2) * distance) /
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
  if (!bimScene) return
  if (!point) {
    if (annotationMarker) {
      bimScene.remove(annotationMarker)
      disposeObject3D(annotationMarker)
      annotationMarker = null
      requestRender()
    }
    return
  }

  if (!annotationMarker) {
    annotationMarker = buildAnnotationMarker()
    bimScene.add(annotationMarker)
  }
  annotationMarker.position.copy(point)
  annotationMarker.userData.worldRadius = undefined
  applyAnnotationMarkerStyle(props.annotationStatus, annotationMarker)
  applyAnnotationMarkerScale(annotationMarker, props.annotationHighlightCurrent)
  requestRender()
}

const ensureAnnotationStashGroup = () => {
  if (!bimScene) return
  if (!annotationStashGroup) {
    annotationStashGroup = new THREE.Group()
    annotationStashGroup.name = 'annotation-stash-group'
    bimScene.add(annotationStashGroup)
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
  if (!bimScene) return
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
    marker.position.set(item.point.x, item.point.y, item.point.z)
    marker.userData.worldRadius = undefined
    applyAnnotationMarkerScale(marker, item.highlighted)
    applyAnnotationMarkerStyle(item.status, marker)
  })
  requestRender()
}

const syncRendererSize = (
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  containerEl: HTMLElement,
) => {
  const rect = containerEl.getBoundingClientRect()
  const w = Math.max(1, Math.floor(rect.width || 1))
  const h = Math.max(1, Math.floor(rect.height || 1))
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const cw = Math.floor(w * dpr)
  const ch = Math.floor(h * dpr)
  if (renderer.domElement.width === cw && renderer.domElement.height === ch)
    return false

  renderer.setPixelRatio(dpr)
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  return true
}

const ensureWorldOriginAxes = () => {}

const updateWorldOriginAxesScale = (_size?: number | null) => {}

const clampLat = (lat: number) => Math.max(-85, Math.min(85, lat))
const clampFirstPersonLat = (lat: number) =>
  Math.max(-FIRST_PERSON_MAX_PITCH, Math.min(FIRST_PERSON_MAX_PITCH, lat))
const normalizeLon = (lon: number) =>
  THREE.MathUtils.euclideanModulo(lon + 180, 360) - 180

const rotationToDirection = (rot: { lon: number; lat: number }) => {
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

const getRotationLookDistance = () => {
  if (!bimCamera || !bimControls) return 10
  return Math.max(bimCamera.position.distanceTo(bimControls.target), 0.5)
}

const getResolvedFirstPersonEyeHeight = () =>
  firstPersonEyeHeight ?? DEFAULT_FIRST_PERSON_EYE_HEIGHT

const raycastBimGroundHeight = (origin: THREE.Vector3, distance: number) => {
  if (!bimModelRoot || !bimModelLoaded.value) return null
  const raycaster = new THREE.Raycaster(
    origin,
    new THREE.Vector3(0, -1, 0),
    0,
    distance,
  )
  const hit = raycaster.intersectObject(bimModelRoot, true)[0]
  return hit?.point?.y ?? null
}

const sampleBimGroundHeight = (position: THREE.Vector3) => {
  const localOrigin = position.clone()
  localOrigin.y += 0.2
  const localDistance = Math.max(
    FIRST_PERSON_GROUND_PROBE_DISTANCE,
    getResolvedFirstPersonEyeHeight() * 4,
  )
  const localGround = raycastBimGroundHeight(localOrigin, localDistance)
  if (localGround !== null) {
    lastFirstPersonGroundHeight = localGround
    return localGround
  }

  const globalOrigin = new THREE.Vector3(
    position.x,
    bimModelCenter.y + bimModelMaxDim * 1.5,
    position.z,
  )
  const globalDistance = Math.max(bimModelMaxDim * 3, 30)
  const fallbackGround = raycastBimGroundHeight(globalOrigin, globalDistance)
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

const refreshBimFirstPersonEyeHeight = () => {
  if (!bimCamera) return
  const groundHeight = sampleBimGroundHeight(bimCamera.position)
  if (groundHeight === null) {
    firstPersonEyeHeight = DEFAULT_FIRST_PERSON_EYE_HEIGHT
    lastFirstPersonGroundHeight = null
    return
  }

  const measuredEyeHeight = bimCamera.position.y - groundHeight
  if (measuredEyeHeight > 1.2 && measuredEyeHeight < 2.2) {
    firstPersonEyeHeight = THREE.MathUtils.clamp(
      measuredEyeHeight,
      FIRST_PERSON_MIN_EYE_HEIGHT,
      FIRST_PERSON_MAX_EYE_HEIGHT,
    )
    lastFirstPersonGroundHeight = groundHeight
    return
  }

  firstPersonEyeHeight = DEFAULT_FIRST_PERSON_EYE_HEIGHT
  lastFirstPersonGroundHeight = groundHeight
}

const resolveBimGroundFollowingPosition = (
  targetPosition: THREE.Vector3,
  options?: { snapImmediately?: boolean },
) => {
  if (!bimCamera) return targetPosition
  const groundHeight = sampleBimGroundHeight(targetPosition)
  if (groundHeight === null) return targetPosition

  const desiredY = groundHeight + getResolvedFirstPersonEyeHeight()
  const currentY = bimCamera.position.y
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

const applyFirstPersonBimRotationDelta = (
  currentRot: { lon: number; lat: number },
  deltaX: number,
  deltaY: number,
) => {
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

  applyRotationOnly(
    {
      lon: normalizeLon(
        currentRot.lon - limitedDeltaX * FIRST_PERSON_ROTATION_SENSITIVITY,
      ),
      lat: clampFirstPersonLat(
        currentRot.lat - limitedDeltaY * FIRST_PERSON_ROTATION_SENSITIVITY,
      ),
    },
    { emitChange: true },
  )
}

const hasFirstPersonBimCollision = (
  currentPosition: THREE.Vector3,
  nextPosition: THREE.Vector3,
  direction: THREE.Vector3,
) => {
  if (!bimModelRoot || !bimModelLoaded.value) return false
  const rayDirection = direction.clone().normalize()
  if (rayDirection.lengthSq() < 1e-8) return false
  const raycaster = new THREE.Raycaster(
    currentPosition,
    rayDirection,
    0,
    currentPosition.distanceTo(nextPosition) + FIRST_PERSON_COLLISION_RADIUS,
  )
  return raycaster.intersectObject(bimModelRoot, true).length > 0
}

const moveBimCamera = (direction: MoveDirection) => {
  if (!firstPersonActive.value) return
  if (!bimCamera || !bimControls) return
  const currentRot = getCameraOrientation()
  if (!currentRot) return

  const moveDistance = 0.8
  const forward = rotationToDirection({
    lon: currentRot.lon,
    lat: 0,
  })
  const right = new THREE.Vector3()
  if (forward.lengthSq() < 1e-8) return
  forward.normalize()
  right.crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize()

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

  const currentPosition = bimCamera.position.clone()
  const collisionProbePosition = currentPosition.clone().add(offset)
  if (
    hasFirstPersonBimCollision(currentPosition, collisionProbePosition, offset)
  ) {
    return
  }

  const nextPosition = resolveBimGroundFollowingPosition(collisionProbePosition)
  bimCamera.position.copy(nextPosition)
  applyRotationOnly(
    {
      lon: currentRot.lon,
      lat: clampFirstPersonLat(currentRot.lat),
    },
    { emitChange: true },
  )
}

const updateFirstPersonMovement = (timestamp: number) => {
  if (!firstPersonActive.value || !bimCamera || !bimControls) {
    activeFirstPersonMoveDirections.clear()
    lastFirstPersonMoveAt = 0
    return false
  }
  if (activeFirstPersonMoveDirections.size === 0) {
    lastFirstPersonMoveAt = 0
    return false
  }

  const currentRot = getCameraOrientation()
  if (!currentRot) return false

  const deltaSeconds = lastFirstPersonMoveAt
    ? Math.min((timestamp - lastFirstPersonMoveAt) / 1000, 0.05)
    : 1 / 60
  lastFirstPersonMoveAt = timestamp

  const forward = rotationToDirection({
    lon: currentRot.lon,
    lat: 0,
  })
  if (forward.lengthSq() < 1e-8) return false
  forward.normalize()
  const right = new THREE.Vector3()
    .crossVectors(new THREE.Vector3(0, 1, 0), forward)
    .normalize()

  const offset = new THREE.Vector3()
  const moveDistance = FIRST_PERSON_MOVE_SPEED * deltaSeconds
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

  const currentPosition = bimCamera.position.clone()
  const collisionProbePosition = currentPosition.clone().add(offset)
  if (
    hasFirstPersonBimCollision(currentPosition, collisionProbePosition, offset)
  ) {
    return false
  }

  const nextPosition = resolveBimGroundFollowingPosition(collisionProbePosition)
  if (nextPosition.distanceToSquared(currentPosition) <= 1e-8) return false

  bimCamera.position.copy(nextPosition)
  applyRotationOnly(
    {
      lon: currentRot.lon,
      lat: clampFirstPersonLat(currentRot.lat),
    },
    { emitChange: true },
  )
  return true
}

const applyRotationOnly = (
  rot: { lon: number; lat: number },
  options?: { emitChange?: boolean },
) => {
  if (!bimCamera || !bimControls) return
  const direction = rotationToDirection(rot)
  const lookDistance = getRotationLookDistance()
  const target = bimCamera.position
    .clone()
    .addScaledVector(direction, lookDistance)
  bimCamera.up.set(0, 1, 0)
  bimControls.target.copy(target)
  bimCamera.lookAt(target)
  bimCamera.updateMatrixWorld()
  bimControls.update()
  requestRender()
  if (options?.emitChange) emitCameraOrientation()
}

const applyRotationLockState = () => {
  if (!bimControls) return
  const locked = Boolean(props.rotationLock)
  const enableOrbit = !locked && !firstPersonActive.value
  bimControls.enabled = enableOrbit
  bimControls.enableRotate = enableOrbit
  bimControls.enablePan = enableOrbit
  bimControls.enableZoom = enableOrbit
}

const clearFirstPersonPointerState = () => {
  firstPersonPointerDown = null
}

const setFirstPersonActive = (value: boolean) => {
  if (firstPersonActive.value === value) return
  firstPersonActive.value = value
  emit('first-person-change', value)
}

const exitFirstPersonMode = () => {
  setFirstPersonActive(false)
  firstPersonEyeHeight = null
  lastFirstPersonGroundHeight = null
  activeFirstPersonMoveDirections.clear()
  lastFirstPersonMoveAt = 0
  clearFirstPersonPointerState()
  applyRotationLockState()
}

const enterFirstPersonMode = () => {
  if (!bimModelLoaded.value) return
  if (props.rotationLock) return
  if (firstPersonActive.value) return
  focusBimViewport()
  setFirstPersonActive(true)
  activeFirstPersonMoveDirections.clear()
  lastFirstPersonMoveAt = 0
  lastFirstPersonGroundHeight = null
  refreshBimFirstPersonEyeHeight()
  if (bimCamera) {
    bimCamera.up.set(0, 1, 0)
    const groundedPosition = resolveBimGroundFollowingPosition(
      bimCamera.position.clone(),
      { snapImmediately: true },
    )
    const currentRot = getCameraOrientation()
    bimCamera.position.copy(groundedPosition)
    if (currentRot) {
      applyRotationOnly(
        {
          lon: normalizeLon(currentRot.lon),
          lat: clampFirstPersonLat(currentRot.lat),
        },
        { emitChange: true },
      )
    }
  }
  applyRotationLockState()
}

const initBimViewer = () => {
  if (!bimViewportEl.value || bimRenderer) return

  bimScene = new THREE.Scene()
  bimScene.background = new THREE.Color(0x0f0f0f)
  ensureWorldOriginAxes()

  const w = bimViewportEl.value.clientWidth || 1
  const h = bimViewportEl.value.clientHeight || 1
  bimCamera = new THREE.PerspectiveCamera(55, w / h, 0.1, 5000)
  bimCamera.position.set(3, 2, 5)

  bimRenderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  })
  bimRenderer.setPixelRatio(window.devicePixelRatio)
  bimRenderer.setSize(w, h)
  bimViewportEl.value.appendChild(bimRenderer.domElement)

  bimControls = new OrbitControls(bimCamera, bimRenderer.domElement)
  bimControls.enableDamping = false
  // Keep right-button panning aligned with the screen so vertical drags move
  // the aligned model instead of being converted into ground-plane depth.
  bimControls.screenSpacePanning = true
  bimControls.addEventListener('change', () => {
    requestRender()
    emitCameraOrientation()
  })
  applyRotationLockState()

  const ambient = new THREE.AmbientLight(0xffffff, 0.6)
  const dir = new THREE.DirectionalLight(0xffffff, 0.8)
  dir.position.set(10, 10, 10)
  bimScene.add(ambient, dir)
}

const updateBimModelMetrics = () => {
  if (!bimModelRoot) return
  bimModelRoot.updateMatrixWorld?.(true)

  const box = new THREE.Box3().setFromObject(bimModelRoot)
  if (box.isEmpty()) {
    bimModelCenter.set(0, 0, 0)
    bimModelMaxDim = 1
    return
  }

  const size = box.getSize(new THREE.Vector3())
  bimModelCenter.copy(box.getCenter(new THREE.Vector3()))
  bimModelMaxDim = Math.max(size.x, size.y, size.z) || 1
  updateWorldOriginAxesScale(Math.max(bimModelMaxDim * 0.12, 1))
}

const requestRender = () => {
  needsRender = true
  if (isRendering) return
  isRendering = true
  animationId = requestAnimationFrame(renderBim)
}

const forceCaptureDataUrl = (options?: { transparentBackground?: boolean }) => {
  if (!bimRenderer || !bimScene || !bimCamera) return null

  const transparentBackground = options?.transparentBackground === true
  const previousBackground = bimScene.background
  const previousClearAlpha = bimRenderer.getClearAlpha()
  const previousClearColor = bimRenderer.getClearColor(new THREE.Color())

  try {
    if (transparentBackground) {
      bimScene.background = null
      bimRenderer.setClearColor(previousClearColor, 0)
    }

    bimRenderer.render(bimScene, bimCamera)
    const gl = bimRenderer.getContext()
    try {
      const pixel = new Uint8Array(4)
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
    } catch {
      // ignore readPixels failures
    }

    return {
      dataUrl: bimRenderer.domElement.toDataURL('image/png'),
      rect: bimRenderer.domElement.getBoundingClientRect(),
    }
  } catch {
    return null
  } finally {
    if (transparentBackground) {
      bimScene.background = previousBackground
      bimRenderer.setClearColor(previousClearColor, previousClearAlpha)
      requestRender()
    }
  }
}

const renderBim = () => {
  if (!bimRenderer || !bimScene || !bimCamera) {
    isRendering = false
    animationId = 0
    return
  }

  try {
    if (bimViewportEl.value) {
      if (syncRendererSize(bimRenderer, bimCamera, bimViewportEl.value)) {
        needsRender = true
      }
    }
    const didUpdate = bimControls?.update() ?? false
    const didMove = updateFirstPersonMovement(performance.now())
    refreshAnnotationMarkerScales()
    if (didMove) {
      needsRender = true
    }
    if (needsRender || didUpdate || didMove) {
      bimRenderer.render(bimScene, bimCamera)
      needsRender = false
    }

    if (needsRender || didUpdate || didMove) {
      animationId = requestAnimationFrame(renderBim)
    } else {
      isRendering = false
      animationId = 0
    }
  } catch (error) {
    isRendering = false
    animationId = 0
  }
}

const getPickOffset = () => Math.max(0.005, bimModelMaxDim * 0.002)

const applyPickOffset = (point: THREE.Vector3) => {
  const offset = getPickOffset()
  return point
    .clone()
    .addScaledVector(annotationRaycaster.ray.direction, -offset)
}

const pickAnnotationPoint = (event: PointerEvent) => {
  if (!bimRenderer || !bimCamera || !bimScene) return null
  if (!bimModelRoot) return null
  const rect = bimRenderer.domElement.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  annotationRaycaster.setFromCamera(new THREE.Vector2(x, y), bimCamera)

  if (props.annotationMarkersVisible !== false && annotationMarker?.visible) {
    const markerHits = annotationRaycaster.intersectObject(
      annotationMarker,
      true,
    )
    if (markerHits.length > 0) {
      return { point: annotationMarker.position.clone() }
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
        return {
          point: markerGroup.position.clone(),
          key: markerGroup.userData.annotationKey as string,
          synced: Boolean(markerGroup.userData.isSynced),
        }
      }
    }
  }

  const hits = annotationRaycaster.intersectObject(bimModelRoot, true)
  if (hits.length === 0) {
    clearHighlight()
    return null
  }
  const hit = hits[0]
  const mesh = resolveHighlightMeshFromHit(hit.object)
  const elementId = resolveElementIdFromObject(hit.object)
  let componentInfo = resolveComponentInfoFromObject(hit.object)
  if (elementId) {
    if (componentInfo) {
      componentInfo = { ...componentInfo, id: componentInfo.id ?? elementId }
    } else {
      componentInfo = { id: elementId, name: '', type: '' }
    }
  }
  if (mesh) {
    highlightMesh(mesh, highlightColor)
  } else {
    clearHighlight()
  }
  return {
    point: applyPickOffset(hit.point),
    componentInfo,
  }
}

const loadBimBlob = async (blob: Blob, name: string) => {
  initBimViewer()
  if (!bimScene || !bimCamera || !bimControls) return

  const displayName = name || 'BIM模型'
  bimStatusText.value = `加载中：${displayName}`
  bimModelLoaded.value = false

  const url = URL.createObjectURL(blob)
  const loader = new GLTFLoader()
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('/draco/')
  loader.setDRACOLoader(dracoLoader)

  loader.load(
    url,
    (gltf) => {
      URL.revokeObjectURL(url)
      dracoLoader.dispose()

      if (!bimScene || !bimCamera || !bimControls) return
      if (bimModelRoot) {
        clearHighlight()
        bimScene.remove(bimModelRoot)
        disposeObject3D(bimModelRoot)
      }

      bimModelRoot = gltf.scene
      bimScene.add(bimModelRoot)
      if (!applyCalibrationToBimModel({ refitCamera: false })) {
        updateBimModelMetrics()
        fitCameraToObject(bimCamera, bimControls, bimModelRoot)
        setTopView(bimCamera, bimControls, bimModelCenter, bimModelMaxDim * 1.2)
      }
      setAnnotationMarker(
        props.annotationPoint
          ? new THREE.Vector3(
              props.annotationPoint.x,
              props.annotationPoint.y,
              props.annotationPoint.z,
            )
          : null,
      )
      bimModelLoaded.value = true
      bimStatusText.value = `已加载：${displayName}`
      requestRender()
    },
    undefined,
    (err) => {
      URL.revokeObjectURL(url)
      dracoLoader.dispose()
      bimStatusText.value = `加载失败：${displayName}`
      bimModelLoaded.value = false
    },
  )
}

const loadBimByFileId = async (
  projectId: number,
  fileId: number | null,
  displayName?: string,
) => {
  if (!fileId) {
    bimStatusText.value = '未选择BIM模型'
    bimModelLoaded.value = false
    return
  }

  try {
    bimStatusText.value = '加载BIM模型中...'
    const blob = await getIfcGlbFile(projectId, fileId)
    await loadBimBlob(blob, displayName || `BIM-${fileId}`)
  } catch (error: any) {
    bimStatusText.value = error?.message || 'BIM模型加载失败'
    bimModelLoaded.value = false
  }
}

const applyCalibrationToBimModel = (options?: { refitCamera?: boolean }) => {
  if (!bimModelRoot) return false

  const desiredWorld = buildFusionBimWorldMatrix(
    Array.isArray(props.pointcloudWorldMatrix)
      ? new THREE.Matrix4().fromArray(props.pointcloudWorldMatrix)
      : null,
    props.calibration?.modelMatrix,
  )
  if (!desiredWorld) return false

  bimModelRoot.matrixAutoUpdate = false
  bimModelRoot.matrix.copy(desiredWorld)
  bimModelRoot.matrixWorldNeedsUpdate = true

  bimModelRoot.updateMatrixWorld?.(true)
  updateBimModelMetrics()

  if (options?.refitCamera && bimCamera && bimControls) {
    fitCameraToObject(bimCamera, bimControls, bimModelRoot)
    setTopView(bimCamera, bimControls, bimModelCenter, bimModelMaxDim * 1.2)
  }

  requestRender()
  return true
}

const syncFromTrajectory = (
  point: TrajectoryPoint,
  calibration: Calibration | null,
) => {
  if (!bimModelLoaded.value) return
  if (!bimCamera || !bimControls) return
  if (!calibration) return

  const pose = buildGaussianTrajectoryYUpPose(point)
  bimCamera.position.copy(pose.camera)
  bimCamera.lookAt(pose.target)
  bimControls.target.copy(pose.target)
  bimCamera.updateMatrixWorld()
  bimControls.update()
  requestRender()
}

const handleResetView = () => {
  if (props.currentTrajectoryPoint) {
    const pose = buildGaussianTrajectoryYUpPose(props.currentTrajectoryPoint)
    setCameraPose(pose)
    return
  }
  resetBimView()
}

const syncFromPointcloudPose = (
  pose: CameraPose | null,
  calibration: Calibration | null,
) => {
  if (!bimModelLoaded.value) return
  if (!bimCamera || !bimControls) return
  if (!calibration || !pose) return

  bimCamera.position.copy(pose.camera)
  bimCamera.lookAt(pose.target)
  bimControls.target.copy(pose.target)
  bimCamera.updateMatrixWorld()
  bimControls.update()
  requestRender()
}

const clampPanoramaFov = (value: number) => Math.max(30, Math.min(120, value))

const syncFromPanoramaFov = (fov: number) => {
  if (!bimCamera) return
  const nextFov = clampPanoramaFov(fov)
  if (Math.abs(bimCamera.fov - nextFov) < 0.01) return
  bimCamera.fov = nextFov
  bimCamera.updateProjectionMatrix()
  requestRender()
}

const getCameraPose = () => {
  if (!bimCamera || !bimControls) return null
  return {
    camera: bimCamera.position.clone(),
    target: bimControls.target.clone(),
  }
}

const setCameraPose = (pose: CameraPose | null) => {
  if (!bimCamera || !bimControls || !pose) return
  bimCamera.position.copy(pose.camera)
  bimControls.target.copy(pose.target)
  bimCamera.lookAt(bimControls.target)
  bimCamera.updateMatrixWorld()
  bimControls.update()
  requestRender()
  emitCameraOrientation()
}

const getCameraOrientation = () => {
  if (!bimCamera || !bimControls) return null
  const dir = new THREE.Vector3()
    .subVectors(bimControls.target, bimCamera.position)
    .normalize()
  return directionToRotation(dir)
}

const emitCameraOrientation = () => {
  if (!bimModelLoaded.value) return
  const rot = getCameraOrientation()
  if (!rot) return
  emit('camera-change', rot)
}

const resetBimView = () => {
  if (!bimCamera || !bimControls) return
  if (fixedViewSize) {
    setFixedViewBySize(fixedViewSize)
    return
  }
  if (bimModelRoot) {
    fitCameraToObject(bimCamera, bimControls, bimModelRoot)
    setTopView(bimCamera, bimControls, bimModelCenter, bimModelMaxDim * 1.2)
    requestRender()
    return
  }
  bimControls.target.set(0, 0, 0)
  bimCamera.position.set(3, 2, 5)
  bimCamera.updateProjectionMatrix()
  bimControls.update()
  requestRender()
}

const toggleFirstPersonMode = () => {
  if (firstPersonActive.value) exitFirstPersonMode()
  else enterFirstPersonMode()
}

const setStatusText = (text: string) => {
  bimStatusText.value = text
}

const setFixedViewBySize = (size: number) => {
  if (!bimCamera || !bimControls) return
  const dim = Number.isFinite(size) && size > 0 ? size : bimModelMaxDim || 1
  fixedViewSize = dim
  setTopView(bimCamera, bimControls, bimModelCenter, dim * 1.2)
  requestRender()
}

const getModelMaxDim = () => bimModelMaxDim || 1
const getModelCenter = () => ({
  x: bimModelCenter.x,
  y: bimModelCenter.y,
  z: bimModelCenter.z,
})

const getModelWorldMatrix = () => {
  if (!bimModelRoot) return null
  bimModelRoot.updateMatrixWorld?.(true)
  return bimModelRoot.matrixWorld.clone()
}

const cleanup = () => {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = 0
  }
  isRendering = false
  needsRender = false
  clearHighlight()

  resizeObserver?.disconnect?.()
  resizeObserver = null

  if (bimRenderer?.domElement) {
    bimRenderer.domElement.removeEventListener(
      'pointerdown',
      handleAnnotationPointerDown,
    )
    bimRenderer.domElement.removeEventListener(
      'pointermove',
      handleAnnotationPointerMove,
    )
    bimRenderer.domElement.removeEventListener(
      'pointerup',
      handleAnnotationPointerUp,
    )
    bimRenderer.domElement.removeEventListener(
      'pointercancel',
      handleAnnotationPointerUp,
    )
    bimRenderer.domElement.removeEventListener(
      'pointerdown',
      handleRotationPointerDown,
    )
    bimRenderer.domElement.removeEventListener(
      'pointermove',
      handleRotationPointerMove,
    )
    bimRenderer.domElement.removeEventListener(
      'pointerup',
      handleRotationPointerUp,
    )
    bimRenderer.domElement.removeEventListener(
      'pointercancel',
      handleRotationPointerUp,
    )
    bimRenderer.domElement.removeEventListener('wheel', handleRotationWheel)
    bimRenderer.domElement.removeEventListener(
      'pointerdown',
      handleFirstPersonPointerDown,
    )
    bimRenderer.domElement.removeEventListener(
      'pointermove',
      handleFirstPersonPointerMove,
    )
    bimRenderer.domElement.removeEventListener(
      'pointerup',
      handleFirstPersonPointerUp,
    )
    bimRenderer.domElement.removeEventListener(
      'pointercancel',
      handleFirstPersonPointerUp,
    )
  }
  clearRotationPointerState()
  clearFirstPersonPointerState()
  firstPersonActive.value = false

  if (annotationMarker && bimScene) {
    bimScene.remove(annotationMarker)
    disposeObject3D(annotationMarker)
    annotationMarker = null
  }

  if (annotationStashGroup && bimScene) {
    for (const marker of annotationStashMarkerMap.values()) {
      annotationStashGroup.remove(marker)
      disposeObject3D(marker)
    }
    annotationStashMarkerMap.clear()
    bimScene.remove(annotationStashGroup)
    annotationStashGroup = null
  }

  if (worldOriginAxes && bimScene) {
    bimScene.remove(worldOriginAxes)
    disposeObject3D(worldOriginAxes)
    worldOriginAxes = null
  }

  if (bimModelRoot && bimScene) {
    bimScene.remove(bimModelRoot)
    disposeObject3D(bimModelRoot)
    bimModelRoot = null
  }
  bimModelCenter.set(0, 0, 0)
  bimModelMaxDim = 1

  bimControls?.dispose?.()

  if (bimRenderer) {
    bimRenderer.dispose()
    if (bimRenderer.domElement?.parentElement) {
      bimRenderer.domElement.parentElement.removeChild(bimRenderer.domElement)
    }
  }

  bimScene = null
  bimCamera = null
  bimRenderer = null
  bimControls = null
}

const handleAnnotationPointerDown = (event: PointerEvent) => {
  if (!props.annotationEnabled || !bimModelLoaded.value) return
  if (firstPersonActive.value) return
  if (event.button !== 0) return
  annotationPointerDown = { x: event.clientX, y: event.clientY }
  annotationPointerDragging = false
  annotationPointerId = event.pointerId
  bimRenderer?.domElement.setPointerCapture?.(event.pointerId)
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
    bimRenderer?.domElement.releasePointerCapture?.(annotationPointerId)
  }
  annotationPointerId = null
  const wasDragging = annotationPointerDragging
  annotationPointerDown = null
  annotationPointerDragging = false
  if (wasDragging) return
  if (!props.annotationEnabled || !bimModelLoaded.value) return
  if (firstPersonActive.value) return
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
    source: 'bim',
    key: result.key,
    synced: result.synced,
    componentInfo: result.componentInfo,
  })
  setAnnotationMarker(result.point)
}

const handleRotationPointerDown = (event: PointerEvent) => {
  if (!props.rotationLock || !bimModelLoaded.value) return
  if (event.button !== 0) return
  rotationPointerId = event.pointerId
  rotationPointerDown = { x: event.clientX, y: event.clientY }
  bimRenderer?.domElement.setPointerCapture?.(event.pointerId)
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
      bimRenderer?.domElement.releasePointerCapture?.(rotationPointerId)
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

const handleFirstPersonPointerDown = (event: PointerEvent) => {
  if (event.button !== 0) return
  if (!bimModelLoaded.value) return
  if (props.rotationLock) return
  if (!firstPersonActive.value) {
    if (props.clickToEnterFirstPerson === false) return
    enterFirstPersonMode()
  }
  firstPersonPointerDown = { x: event.clientX, y: event.clientY }
}

const handleFirstPersonPointerMove = (event: PointerEvent) => {
  if (!firstPersonActive.value || !firstPersonPointerDown) return
  const currentRot = getCameraOrientation()
  if (!currentRot) return

  const deltaX = event.clientX - firstPersonPointerDown.x
  const deltaY = event.clientY - firstPersonPointerDown.y
  if (deltaX === 0 && deltaY === 0) return

  firstPersonPointerDown = { x: event.clientX, y: event.clientY }
  applyFirstPersonBimRotationDelta(currentRot, deltaX, deltaY)
}

const handleFirstPersonPointerUp = () => {
  clearFirstPersonPointerState()
}

const handleKeydown = (event: KeyboardEvent) => {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement
  ) {
    return
  }
  if (!hasBimKeyboardFocus()) return
  if (!firstPersonActive.value || !bimModelLoaded.value) return
  if (props.rotationLock) return

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
      exitFirstPersonMode()
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

watch(
  () => bimModelLoaded.value,
  (value) => {
    if (!value) exitFirstPersonMode()
    emit('loaded-change', value)
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
    if (annotationMarker) annotationMarker.visible = props.annotationMarkersVisible !== false
    for (const marker of annotationStashMarkerMap.values()) {
      marker.visible = props.annotationMarkersVisible !== false
    }
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

watch(
  () => props.calibration,
  () => {
    if (!bimModelRoot) return
    applyCalibrationToBimModel({ refitCamera: false })
  },
  { deep: true },
)

watch(
  () => props.pointcloudWorldMatrix,
  () => {
    if (!bimModelRoot) return
    applyCalibrationToBimModel({ refitCamera: false })
  },
  { deep: true },
)

watch(
  () => props.rotationLock,
  () => {
    applyRotationLockState()
    if (props.rotationLock) {
      exitFirstPersonMode()
    } else {
      clearRotationPointerState()
    }
  },
  { immediate: true },
)

onMounted(() => {
  initBimViewer()
  syncAnnotationStashMarkers(props.annotationStashMarkers ?? [])
  if (bimRenderer?.domElement) {
    bimRenderer.domElement.addEventListener(
      'pointerdown',
      handleAnnotationPointerDown,
    )
    bimRenderer.domElement.addEventListener(
      'pointermove',
      handleAnnotationPointerMove,
    )
    bimRenderer.domElement.addEventListener(
      'pointerup',
      handleAnnotationPointerUp,
    )
    bimRenderer.domElement.addEventListener(
      'pointercancel',
      handleAnnotationPointerUp,
    )
    bimRenderer.domElement.addEventListener(
      'pointerdown',
      handleRotationPointerDown,
    )
    bimRenderer.domElement.addEventListener(
      'pointermove',
      handleRotationPointerMove,
    )
    bimRenderer.domElement.addEventListener(
      'pointerup',
      handleRotationPointerUp,
    )
    bimRenderer.domElement.addEventListener(
      'pointercancel',
      handleRotationPointerUp,
    )
    bimRenderer.domElement.addEventListener('wheel', handleRotationWheel, {
      passive: false,
    })
    bimRenderer.domElement.addEventListener(
      'pointerdown',
      handleFirstPersonPointerDown,
    )
    bimRenderer.domElement.addEventListener(
      'pointermove',
      handleFirstPersonPointerMove,
    )
    bimRenderer.domElement.addEventListener(
      'pointerup',
      handleFirstPersonPointerUp,
    )
    bimRenderer.domElement.addEventListener(
      'pointercancel',
      handleFirstPersonPointerUp,
    )
  }
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('keyup', handleKeyup)
  if (
    !resizeObserver &&
    typeof ResizeObserver !== 'undefined' &&
    bimViewportEl.value
  ) {
    resizeObserver = new ResizeObserver(() => {
      if (bimRenderer && bimCamera && bimViewportEl.value) {
        if (syncRendererSize(bimRenderer, bimCamera, bimViewportEl.value)) {
          requestRender()
        }
      }
    })
    resizeObserver.observe(bimViewportEl.value)
  }
  requestRender()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('keyup', handleKeyup)
  cleanup()
})

defineExpose({
  loadBimBlob,
  loadBimByFileId,
  syncFromTrajectory,
  syncFromPointcloudPose,
  syncFromPanoramaRotation: applyRotationOnly,
  resetView: resetBimView,
  syncFromPanoramaFov,
  getCameraPose,
  setCameraPose,
  getCameraOrientation,
  setStatusText,
  setFixedViewBySize,
  getModelMaxDim,
  getModelCenter,
  getModelWorldMatrix,
  getAnnotationMarkerPosition: () => {
    if (!annotationMarker) return null
    return {
      x: annotationMarker.position.x,
      y: annotationMarker.position.y,
      z: annotationMarker.position.z,
    }
  },
  forceCaptureDataUrl,
  enterFirstPersonMode,
  exitFirstPersonMode,
  toggleFirstPersonMode,
  isFirstPersonActive: () => firstPersonActive.value,
  cleanup,
})
</script>

<style scoped>
.bim-viewport:focus {
  outline: none;
}
</style>
