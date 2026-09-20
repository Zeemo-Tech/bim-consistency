<template>
  <div class="scan-preview-page">
    <PointCloudViewer
      ref="pointcloudViewerRef"
      class="scan-preview-viewer"
      :is-preset-mode="true"
      :apply-tileset-transform="true"
      :click-to-enter-first-person="false"
      :pixel-ratio-cap="1"
      :tiles-resolution-scale="0.72"
      @loaded-change="handlePointcloudLoadedChange"
      @world-ready="handlePointcloudWorldReady"
    />

    <div class="scan-preview-toolbar">
      <div class="toolbar-left">
        <el-button size="small" :icon="ArrowLeft" @click="handleClose">
          返回
        </el-button>
        <span class="file-title">{{ fileName || '点云预览' }}</span>
      </div>
      <div class="toolbar-right">
        <el-tooltip :content="clipBoundsTooltip" placement="bottom">
          <el-button
            size="small"
            class="toolbar-tool-btn toolbar-tool-btn--svg"
            :class="{
              'is-on': showBounds,
              'is-disabled': !showBounds && !!clipBoundsDisabledReason,
            }"
            @click="onBoundsButtonClick"
          >
            <svg
              class="toolbar-tool-btn__svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M3 7 L12 3 L21 7 L21 17 L12 21 L3 17 Z" />
              <line x1="3" y1="7" x2="21" y2="7" />
              <line x1="3" y1="12" x2="21" y2="12" stroke-dasharray="3 2" />
              <line x1="12" y1="3" x2="12" y2="7" />
            </svg>
            裁切框
          </el-button>
        </el-tooltip>
        <el-button size="small" :icon="RefreshLeft" @click="resetView">
          重置视角
        </el-button>
        <el-button size="small" :icon="FullScreen" @click="toggleFullscreen">
          全屏
        </el-button>
      </div>
    </div>

    <div v-if="errorMessage" class="error-overlay">
      <div class="error-card">
        <div class="error-title">预览失败</div>
        <div class="error-message">{{ errorMessage }}</div>
        <div class="error-actions">
          <el-button type="primary" @click="loadPreview">重试</el-button>
          <el-button @click="handleClose">返回</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, RefreshLeft, FullScreen } from '@element-plus/icons-vue'
import * as THREE from 'three'
import PointCloudViewer from '@/views/twoScreen/components/PointCloudViewer.vue'

defineOptions({
  name: 'PreviewScan',
})

const route = useRoute()
const router = useRouter()

type ClipAxisKey = 'x' | 'y' | 'z'
type ClipBoxOffsets = {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  zMin: number
  zMax: number
}
type ClipBoxState = {
  baseBox: THREE.Box3
  offsets: ClipBoxOffsets
  revision: number
}
type ViewerThreeContext = {
  scene: THREE.Scene | null
  camera: THREE.Camera | null
  renderer:
    | THREE.WebGLRenderer
    | {
        domElement?: HTMLCanvasElement
      }
    | null
  controls:
    | {
        enabled: boolean
      }
    | null
}
type PointCloudViewerExpose = InstanceType<typeof PointCloudViewer> & {
  setStatusText?: (text: string) => void
  loadPointcloudByScanId: (projectId: number, scanFileId: number) => Promise<void>
  resetView?: () => void
  cleanup?: () => void
  getThreeContext?: () => ViewerThreeContext
  getPointcloudWorldBox?: () => THREE.Box3 | null
  setClipBox?: (box: THREE.Box3 | null) => void
  setControlsEnabled?: (enabled: boolean) => void
}

const pointcloudViewerRef = ref<PointCloudViewerExpose | null>(null)
const errorMessage = ref('')
const loadToken = ref(0)
const showBounds = ref(false)
const activeClipAxis = ref<ClipAxisKey>('z')
const activeClipInvert = ref(false)
const pointcloudLoadedState = ref(false)
const pointcloudWorldReady = ref(false)

let clipBoxState: ClipBoxState | null = null
let clipBoxHelper: THREE.Box3Helper | null = null
let clipHandlesGroup: THREE.Group | null = null
const clipHandlePickers: THREE.Object3D[] = []
const clipRaycaster = new THREE.Raycaster()
let clipBoundsRevision = 0
let boundsHelpersUpdateScheduled = false
let clipDragState: null | {
  pointerId: number
  axis: ClipAxisKey
  invert: boolean
  dragPlane: THREE.Plane
  startPoint: THREE.Vector3
  startPosition: number
  min: number
  max: number
} = null
let clipBoundDom: HTMLCanvasElement | null = null

const projectId = computed(() => {
  const value = Number(route.query.projectId)
  return Number.isFinite(value) && value > 0 ? value : null
})

const fileId = computed(() => {
  const value = Number(route.params.id)
  return Number.isFinite(value) && value > 0 ? value : null
})

const fileName = computed(() => String(route.query.fileName || ''))
const clipBoundsDisabledReason = computed(() => {
  if (showBounds.value) return ''
  if (errorMessage.value) return '点云加载失败，无法启用裁切框'
  if (!pointcloudLoadedState.value || !pointcloudWorldReady.value) {
    return '请先加载点云'
  }
  if (!getContentWorldBox()) return '点云包围盒尚未准备完成'
  return ''
})
const clipBoundsTooltip = computed(() => {
  return clipBoundsDisabledReason.value || '裁切框'
})

function getViewerThreeContext() {
  return pointcloudViewerRef.value?.getThreeContext?.() ?? null
}

function getViewerScene() {
  return getViewerThreeContext()?.scene ?? null
}

function getViewerCamera() {
  const camera = getViewerThreeContext()?.camera
  return camera instanceof THREE.Camera ? camera : null
}

function getViewerRendererDom() {
  const dom = getViewerThreeContext()?.renderer?.domElement
  return dom instanceof HTMLCanvasElement ? dom : null
}

function cloneBox3(box: THREE.Box3) {
  return new THREE.Box3(box.min.clone(), box.max.clone())
}

function createDefaultClipOffsets(): ClipBoxOffsets {
  return {
    xMin: 0,
    xMax: 0,
    yMin: 0,
    yMax: 0,
    zMin: 0,
    zMax: 0,
  }
}

function getContentWorldBox() {
  return pointcloudViewerRef.value?.getPointcloudWorldBox?.() ?? null
}

function getClipOffsetKey(axis: ClipAxisKey, invert: boolean) {
  return `${axis}${invert ? 'Max' : 'Min'}` as keyof ClipBoxOffsets
}

function invalidateClipBounds() {
  clipBoundsRevision += 1
}

function clampClipOffsets(state: ClipBoxState) {
  ;(['x', 'y', 'z'] as ClipAxisKey[]).forEach((axis) => {
    const minKey = `${axis}Min` as keyof ClipBoxOffsets
    const maxKey = `${axis}Max` as keyof ClipBoxOffsets
    const span = Math.max(0, state.baseBox.max[axis] - state.baseBox.min[axis])
    state.offsets[minKey] = THREE.MathUtils.clamp(state.offsets[minKey], 0, span)
    state.offsets[maxKey] = THREE.MathUtils.clamp(state.offsets[maxKey], 0, span)
    if (state.offsets[minKey] + state.offsets[maxKey] > span) {
      state.offsets[maxKey] = Math.max(0, span - state.offsets[minKey])
    }
  })
}

function ensureClipState() {
  const baseBox = getContentWorldBox()
  if (!baseBox) {
    clipBoxState = null
    return null
  }
  if (clipBoxState && clipBoxState.revision === clipBoundsRevision) {
    return clipBoxState
  }
  if (clipBoxState) {
    clipBoxState.baseBox.copy(baseBox)
    clipBoxState.revision = clipBoundsRevision
    clampClipOffsets(clipBoxState)
    return clipBoxState
  }
  clipBoxState = {
    baseBox: cloneBox3(baseBox),
    offsets: createDefaultClipOffsets(),
    revision: clipBoundsRevision,
  }
  return clipBoxState
}

function getClipBoxFromState(state: ClipBoxState) {
  const box = cloneBox3(state.baseBox)
  box.min.x += state.offsets.xMin
  box.max.x -= state.offsets.xMax
  box.min.y += state.offsets.yMin
  box.max.y -= state.offsets.yMax
  box.min.z += state.offsets.zMin
  box.max.z -= state.offsets.zMax
  return box
}

function getCurrentClipBox() {
  const state = ensureClipState()
  return state ? getClipBoxFromState(state) : null
}

function getClipFacePosition(axis: ClipAxisKey, invert: boolean) {
  const box = getCurrentClipBox()
  if (!box) return 0
  return invert ? box.max[axis] : box.min[axis]
}

function getClipFaceRange(axis: ClipAxisKey, invert: boolean) {
  const state = ensureClipState()
  const box = state ? getClipBoxFromState(state) : null
  if (!state || !box) return { min: 0, max: 1 }
  return invert
    ? { min: box.min[axis], max: state.baseBox.max[axis] }
    : { min: state.baseBox.min[axis], max: box.max[axis] }
}

function setClipFacePosition(axis: ClipAxisKey, invert: boolean, value: number) {
  const state = ensureClipState()
  if (!state) return
  const currentBox = getClipBoxFromState(state)
  const baseMin = state.baseBox.min[axis]
  const baseMax = state.baseBox.max[axis]
  const minLimit = invert ? currentBox.min[axis] : baseMin
  const maxLimit = invert ? baseMax : currentBox.max[axis]
  const clamped = THREE.MathUtils.clamp(value, minLimit, maxLimit)
  const key = getClipOffsetKey(axis, invert)
  if (invert) state.offsets[key] = baseMax - clamped
  else state.offsets[key] = clamped - baseMin
  clampClipOffsets(state)
}

function requestPointcloudRender() {
  const activeBox = showBounds.value ? getCurrentClipBox() : null
  pointcloudViewerRef.value?.setClipBox?.(activeBox)
}

function clearBoundsHelpers() {
  const scene = getViewerScene()
  if (clipBoxHelper) {
    scene?.remove(clipBoxHelper)
    clipBoxHelper.geometry?.dispose?.()
    ;(clipBoxHelper.material as any)?.dispose?.()
    clipBoxHelper = null
  }
  if (clipHandlesGroup) {
    scene?.remove(clipHandlesGroup)
    clipHandlesGroup.traverse?.((obj: any) => {
      obj.geometry?.dispose?.()
      obj.material?.dispose?.()
    })
    clipHandlesGroup = null
  }
  clipHandlePickers.length = 0
}

function buildClipHandles(box: THREE.Box3) {
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z, 1)
  const offset = Math.max(maxDim * 0.06, 0.12)
  const handleLength = Math.max(maxDim * 0.12, 0.22)
  const shaftLength = handleLength * 0.62
  const coneHeight = handleLength - shaftLength
  const shaftRadius = Math.max(maxDim * 0.006, 0.012)
  const coneRadius = shaftRadius * 2.2
  const hitRadius = Math.max(shaftRadius * 5, 0.06)
  const activeColor = new THREE.Color('#ffd04b')
  const idleColor = new THREE.Color('#409eff')
  const baseAxis = new THREE.Vector3(0, 1, 0)
  const group = new THREE.Group()
  const faces: Array<{
    axis: ClipAxisKey
    invert: boolean
    normal: THREE.Vector3
    arrowDir: THREE.Vector3
    anchor: THREE.Vector3
  }> = [
    {
      axis: 'x',
      invert: false,
      normal: new THREE.Vector3(-1, 0, 0),
      arrowDir: new THREE.Vector3(-1, 0, 0),
      anchor: new THREE.Vector3(box.min.x, center.y, center.z),
    },
    {
      axis: 'x',
      invert: true,
      normal: new THREE.Vector3(1, 0, 0),
      arrowDir: new THREE.Vector3(1, 0, 0),
      anchor: new THREE.Vector3(box.max.x, center.y, center.z),
    },
    {
      axis: 'y',
      invert: false,
      normal: new THREE.Vector3(0, -1, 0),
      arrowDir: new THREE.Vector3(0, -1, 0),
      anchor: new THREE.Vector3(center.x, box.min.y, center.z),
    },
    {
      axis: 'y',
      invert: true,
      normal: new THREE.Vector3(0, 1, 0),
      arrowDir: new THREE.Vector3(0, 1, 0),
      anchor: new THREE.Vector3(center.x, box.max.y, center.z),
    },
    {
      axis: 'z',
      invert: false,
      normal: new THREE.Vector3(0, 0, -1),
      arrowDir: new THREE.Vector3(0, 0, -1),
      anchor: new THREE.Vector3(center.x, center.y, box.min.z),
    },
    {
      axis: 'z',
      invert: true,
      normal: new THREE.Vector3(0, 0, 1),
      arrowDir: new THREE.Vector3(0, 0, 1),
      anchor: new THREE.Vector3(center.x, center.y, box.max.z),
    },
  ]

  for (const face of faces) {
    const handle = new THREE.Group()
    const isActiveFace =
      face.axis === activeClipAxis.value &&
      face.invert === activeClipInvert.value
    const color = isActiveFace ? activeColor : idleColor

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 12),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: isActiveFace ? 0.95 : 0.82,
        depthTest: false,
        depthWrite: false,
      }),
    )
    shaft.position.y = shaftLength * 0.5

    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(coneRadius, coneHeight, 16),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: isActiveFace ? 1 : 0.9,
        depthTest: false,
        depthWrite: false,
      }),
    )
    cone.position.y = shaftLength + coneHeight * 0.5

    const hitArea = new THREE.Mesh(
      new THREE.CylinderGeometry(hitRadius, hitRadius, handleLength, 10),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      }),
    )
    hitArea.position.y = handleLength * 0.5
    hitArea.userData = {
      __viewerClipHandle: true,
      axis: face.axis,
      invert: face.invert,
    }

    handle.add(shaft)
    handle.add(cone)
    handle.add(hitArea)
    handle.position.copy(face.anchor).add(face.normal.clone().multiplyScalar(offset))
    handle.quaternion.setFromUnitVectors(baseAxis, face.arrowDir)
    handle.renderOrder = 10000
    handle.traverse?.((obj: any) => {
      obj.renderOrder = 10000
    })
    group.add(handle)
    clipHandlePickers.push(hitArea)
  }

  return group
}

function updateBoundsHelpers() {
  const scene = getViewerScene()
  if (!scene) return
  clearBoundsHelpers()
  if (!showBounds.value) {
    requestPointcloudRender()
    return
  }

  const helperBox = getCurrentClipBox()
  if (!helperBox || helperBox.isEmpty()) {
    requestPointcloudRender()
    return
  }

  clipBoxHelper = new THREE.Box3Helper(helperBox.clone(), new THREE.Color('#ffcf4a'))
  clipBoxHelper.renderOrder = 9999
  ;(clipBoxHelper.material as any).depthTest = false
  clipBoxHelper.userData = {
    __viewerBoundsHelper: true,
  }
  scene.add(clipBoxHelper)

  clipHandlesGroup = buildClipHandles(helperBox)
  scene.add(clipHandlesGroup)
  requestPointcloudRender()
}

function scheduleBoundsHelpersUpdate() {
  if (boundsHelpersUpdateScheduled) return
  boundsHelpersUpdateScheduled = true
  requestAnimationFrame(() => {
    boundsHelpersUpdateScheduled = false
    updateBoundsHelpers()
  })
}

function applyClippingState() {
  requestPointcloudRender()
}

function onShowBoundsChange() {
  if (showBounds.value) {
    if (!getContentWorldBox()) {
      showBounds.value = false
      return
    }
    invalidateClipBounds()
    ensureClipState()
  } else {
    clipBoxState = null
  }
  updateBoundsHelpers()
  applyClippingState()
}

function onBoundsButtonClick() {
  if (showBounds.value) {
    showBounds.value = false
    onShowBoundsChange()
    return
  }
  if (clipBoundsDisabledReason.value) {
    ElMessage.warning(clipBoundsDisabledReason.value)
    return
  }
  showBounds.value = true
  onShowBoundsChange()
}

function getPointerNdc(ev: PointerEvent) {
  const rect = getViewerRendererDom()?.getBoundingClientRect?.()
  if (!rect) return null
  return new THREE.Vector2(
    ((ev.clientX - rect.left) / rect.width) * 2 - 1,
    -(((ev.clientY - rect.top) / rect.height) * 2 - 1),
  )
}

function consumePointerEvent(ev: PointerEvent) {
  ev.preventDefault()
  ev.stopPropagation()
  ;(ev as any).stopImmediatePropagation?.()
}

function pickClipOverlay(ev: PointerEvent):
  | null
  | { kind: 'handle'; axis: ClipAxisKey; invert: boolean }
  | { kind: 'bounds' } {
  const camera = getViewerCamera()
  if (!camera || !clipBoxHelper || !showBounds.value) return null
  const ndc = getPointerNdc(ev)
  if (!ndc) return null

  if (clipRaycaster.params.Line) {
    clipRaycaster.params.Line.threshold = 0.2
  } else {
    ;(clipRaycaster.params as any).Line = { threshold: 0.2 }
  }
  clipRaycaster.setFromCamera(ndc, camera)

  if (clipHandlePickers.length) {
    const handleHits = clipRaycaster.intersectObjects(clipHandlePickers, true)
    const handleHit = handleHits[0] as any
    if (handleHit?.object?.userData?.__viewerClipHandle) {
      return {
        kind: 'handle',
        axis: handleHit.object.userData.axis,
        invert: !!handleHit.object.userData.invert,
      }
    }
  }

  const lineHits = clipRaycaster.intersectObject(clipBoxHelper, true)
  if (!lineHits.length) return null
  return { kind: 'bounds' }
}

function buildClipDragPlane(axisKey: ClipAxisKey, anchor: THREE.Vector3) {
  const axis =
    axisKey === 'x'
      ? new THREE.Vector3(1, 0, 0)
      : axisKey === 'y'
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1)
  const camera = getViewerCamera()
  const cameraDir = new THREE.Vector3()
  camera?.getWorldDirection?.(cameraDir)
  let normal = cameraDir.sub(axis.clone().multiplyScalar(cameraDir.dot(axis)))
  if (normal.lengthSq() < 1e-6) normal = new THREE.Vector3(0, 1, 0).cross(axis)
  if (normal.lengthSq() < 1e-6) normal = new THREE.Vector3(0, 0, 1).cross(axis)
  normal.normalize()
  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, anchor)
}

function beginClipDrag(ev: PointerEvent, options: { axis: ClipAxisKey; invert: boolean }) {
  const camera = getViewerCamera()
  const dom = getViewerRendererDom()
  if (!camera || !dom) return

  activeClipAxis.value = options.axis
  activeClipInvert.value = options.invert
  updateBoundsHelpers()

  const ndc = getPointerNdc(ev)
  const box = getCurrentClipBox()
  if (!ndc || !box) return
  clipRaycaster.setFromCamera(ndc, camera)

  const anchor = new THREE.Vector3()
  anchor[options.axis] = getClipFacePosition(options.axis, options.invert)
  const center = box.getCenter(new THREE.Vector3())
  if (options.axis === 'x') {
    anchor.y = center.y
    anchor.z = center.z
  } else if (options.axis === 'y') {
    anchor.x = center.x
    anchor.z = center.z
  } else {
    anchor.x = center.x
    anchor.y = center.y
  }

  const dragPlane = buildClipDragPlane(options.axis, anchor)
  const startPoint = new THREE.Vector3()
  if (!clipRaycaster.ray.intersectPlane(dragPlane, startPoint)) return

  const range = getClipFaceRange(options.axis, options.invert)
  clipDragState = {
    pointerId: ev.pointerId,
    axis: options.axis,
    invert: options.invert,
    dragPlane,
    startPoint,
    startPosition: getClipFacePosition(options.axis, options.invert),
    min: range.min,
    max: range.max,
  }
  dom.setPointerCapture?.(ev.pointerId)
  pointcloudViewerRef.value?.setControlsEnabled?.(false)
}

function onClipDragMove(ev: PointerEvent) {
  const camera = getViewerCamera()
  if (!clipDragState || !camera) return
  const ndc = getPointerNdc(ev)
  if (!ndc) return
  clipRaycaster.setFromCamera(ndc, camera)
  const point = new THREE.Vector3()
  if (!clipRaycaster.ray.intersectPlane(clipDragState.dragPlane, point)) return

  const axisVec =
    clipDragState.axis === 'x'
      ? new THREE.Vector3(1, 0, 0)
      : clipDragState.axis === 'y'
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1)
  const delta = point.clone().sub(clipDragState.startPoint).dot(axisVec)
  const nextPosition = THREE.MathUtils.clamp(
    clipDragState.startPosition + delta,
    clipDragState.min,
    clipDragState.max,
  )
  setClipFacePosition(clipDragState.axis, clipDragState.invert, nextPosition)
  activeClipAxis.value = clipDragState.axis
  activeClipInvert.value = clipDragState.invert
  applyClippingState()
  scheduleBoundsHelpersUpdate()
}

function endClipDrag(ev?: PointerEvent) {
  const dom = getViewerRendererDom()
  if (clipDragState && dom && ev) {
    try {
      dom.releasePointerCapture?.(clipDragState.pointerId)
    } catch {
      // ignore pointer capture release errors
    }
  }
  clipDragState = null
  pointcloudViewerRef.value?.setControlsEnabled?.(true)
}

function onViewerPointerDown(event: PointerEvent) {
  const overlayHit = pickClipOverlay(event)
  if (overlayHit?.kind === 'handle') {
    consumePointerEvent(event)
    beginClipDrag(event, overlayHit)
    return
  }
  if (overlayHit?.kind === 'bounds') {
    consumePointerEvent(event)
  }
}

function onViewerPointerMove(event: PointerEvent) {
  if (!clipDragState) return
  consumePointerEvent(event)
  onClipDragMove(event)
}

function onViewerPointerUp(event: PointerEvent) {
  if (!clipDragState) return
  consumePointerEvent(event)
  endClipDrag(event)
}

function bindClipInteractions() {
  const dom = getViewerRendererDom()
  if (!dom || clipBoundDom === dom) return
  unbindClipInteractions()
  dom.addEventListener('pointerdown', onViewerPointerDown, true)
  dom.addEventListener('pointermove', onViewerPointerMove, true)
  dom.addEventListener('pointerup', onViewerPointerUp, true)
  dom.addEventListener('pointercancel', onViewerPointerUp, true)
  clipBoundDom = dom
}

function unbindClipInteractions() {
  if (!clipBoundDom) return
  clipBoundDom.removeEventListener('pointerdown', onViewerPointerDown, true)
  clipBoundDom.removeEventListener('pointermove', onViewerPointerMove, true)
  clipBoundDom.removeEventListener('pointerup', onViewerPointerUp, true)
  clipBoundDom.removeEventListener('pointercancel', onViewerPointerUp, true)
  clipBoundDom = null
}

function syncScanThreeControls() {
  bindClipInteractions()
  if (showBounds.value) {
    invalidateClipBounds()
    onShowBoundsChange()
    return
  }
  clearBoundsHelpers()
  pointcloudViewerRef.value?.setClipBox?.(null)
}

function handlePointcloudLoadedChange(loaded: boolean) {
  pointcloudLoadedState.value = loaded
  if (!loaded) {
    pointcloudWorldReady.value = false
    invalidateClipBounds()
    if (showBounds.value) {
      showBounds.value = false
    }
    clipBoxState = null
    clearBoundsHelpers()
    pointcloudViewerRef.value?.setClipBox?.(null)
    return
  }
  syncScanThreeControls()
}

function handlePointcloudWorldReady() {
  pointcloudWorldReady.value = true
  invalidateClipBounds()
  syncScanThreeControls()
}

const waitForViewerReady = async () => {
  for (let i = 0; i < 30; i += 1) {
    const viewer = pointcloudViewerRef.value
    if (viewer?.$el?.isConnected) {
      return viewer
    }
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
  return pointcloudViewerRef.value
}

const loadPreview = async () => {
  const token = ++loadToken.value
  errorMessage.value = ''
  pointcloudLoadedState.value = false
  pointcloudWorldReady.value = false
  invalidateClipBounds()
  clipBoxState = null

  if (!projectId.value) {
    errorMessage.value = '缺少项目ID，无法预览点云'
    return
  }

  if (!fileId.value) {
    errorMessage.value = '缺少文件ID，无法预览点云'
    return
  }

  const viewer = await waitForViewerReady()
  if (token !== loadToken.value) return

  if (!viewer) {
    errorMessage.value = '点云预览组件初始化失败'
    return
  }

  viewer.setStatusText?.('自动加载点云中...')

  try {
    await viewer.loadPointcloudByScanId(projectId.value, fileId.value)
  } catch (error: any) {
    if (token !== loadToken.value) return
    errorMessage.value = error?.message || '点云加载失败'
    pointcloudLoadedState.value = false
    pointcloudWorldReady.value = false
    invalidateClipBounds()
    clearBoundsHelpers()
    pointcloudViewerRef.value?.setClipBox?.(null)
  }
}

const resetView = () => {
  pointcloudViewerRef.value?.resetView?.()
}

const toggleFullscreen = async () => {
  const root = document.documentElement
  if (!document.fullscreenElement) {
    await root.requestFullscreen?.()
    return
  }
  await document.exitFullscreen?.()
}

const handleClose = () => {
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.push('/data/history-model')
}

watch(
  () => [route.params.id, route.query.projectId],
  () => {
    if (route.name !== 'PreviewScan') return
    void loadPreview()
  },
)

onMounted(() => {
  void loadPreview()
})

onBeforeUnmount(() => {
  loadToken.value += 1
  unbindClipInteractions()
  clearBoundsHelpers()
  pointcloudViewerRef.value?.setClipBox?.(null)
  pointcloudViewerRef.value?.cleanup?.()
})
</script>

<style lang="scss" scoped>
.scan-preview-page {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at top, rgba(57, 92, 135, 0.2), transparent 38%),
    linear-gradient(180deg, #09111d 0%, #050a12 100%);
}

.scan-preview-viewer {
  width: 100%;
  height: 100%;
  display: block;
}

.scan-preview-toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 14px;
  background: rgba(8, 15, 26, 0.72);
  backdrop-filter: blur(14px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.24);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar-right {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.file-title {
  max-width: 420px;
  overflow: hidden;
  color: #f8fafc;
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.toolbar-tool-btn--svg {
  overflow: hidden;
}

.toolbar-tool-btn__svg {
  width: 15px;
  height: 15px;
  display: block;
  flex-shrink: 0;
  pointer-events: none;
  overflow: visible;
  color: currentColor;
}

.scan-preview-toolbar :deep(.el-button.toolbar-tool-btn.is-on) {
  background: rgba(64, 158, 255, 0.92);
  border-color: rgba(64, 158, 255, 0.92);
  color: #ffffff;
}

.scan-preview-toolbar :deep(.el-button.toolbar-tool-btn.is-on:hover) {
  background: rgba(64, 158, 255, 0.98);
  border-color: rgba(64, 158, 255, 0.98);
}

.scan-preview-toolbar :deep(.el-button.toolbar-tool-btn.is-disabled:not(.is-on)) {
  opacity: 0.55;
}

.error-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(4, 10, 18, 0.66);
}

.error-card {
  width: min(480px, 100%);
  padding: 24px;
  border: 1px solid rgba(248, 113, 113, 0.24);
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.96);
  color: #e2e8f0;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.28);
}

.error-title {
  margin-bottom: 8px;
  color: #f8fafc;
  font-size: 18px;
  font-weight: 600;
}

.error-message {
  line-height: 1.6;
}

.error-actions {
  display: flex;
  gap: 12px;
  margin-top: 18px;
}

.scan-preview-page :deep(.pointcloud-view-panel) {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #1a1a1a;
}

.scan-preview-page :deep(.pointcloud-viewport) {
  position: relative;
  flex: 1;
  width: 100%;
  min-height: 0;
  overflow: hidden;
}

.scan-preview-page :deep(.pointcloud-viewport canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

.scan-preview-page :deep(.panel-refresh-btn) {
  display: none;
}

.scan-preview-page :deep(.empty-placeholder) {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2c2c2c;
  z-index: 1;
}

.scan-preview-page :deep(.placeholder-content) {
  padding: 40px;
  text-align: center;
}

.scan-preview-page :deep(.placeholder-icon) {
  margin-bottom: 16px;
  color: #64748b;
  font-size: 64px;
}

.scan-preview-page :deep(.placeholder-text) {
  margin: 0;
  color: #f8fafc;
  font-size: 14px;
}

@media (max-width: 768px) {
  .scan-preview-toolbar {
    top: 12px;
    left: 12px;
    right: 12px;
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-left,
  .toolbar-right {
    width: 100%;
    justify-content: space-between;
  }

  .file-title {
    max-width: none;
    flex: 1;
  }
}
</style>
