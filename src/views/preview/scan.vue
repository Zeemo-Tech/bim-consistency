<template>
  <div class="pointcloud-preview-page" :class="`theme-${backgroundTheme}`">
    <header class="pc-header">
      <span class="pc-heading">
        <strong :title="fileName">{{ fileName || '点云预览' }}</strong>
        <small :title="projectName">
          {{ projectName || '实测扫描' }} · 点云预览
        </small>
      </span>

      <div class="pc-header-controls" role="group" aria-label="预览背景">
        <span class="pc-header-label">背景</span>
        <div class="pc-segmented">
          <button
            v-for="option in backgroundOptions"
            :key="option.value"
            type="button"
            :class="{ on: backgroundTheme === option.value }"
            :aria-pressed="backgroundTheme === option.value"
            @click="backgroundTheme = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <button
        class="pc-close"
        type="button"
        aria-label="关闭预览"
        title="关闭预览"
        @click="handleClose"
      >
        <el-icon><Close /></el-icon>
      </button>
    </header>

    <main ref="stageRef" class="pc-stage" :class="`theme-${backgroundTheme}`">
      <PointCloudViewer
        ref="pointcloudViewerRef"
        class="pc-viewer"
        :is-preset-mode="true"
        :apply-tileset-transform="true"
        :click-to-enter-first-person="false"
        :show-internal-controls="false"
        :prefer-webgl="true"
        :pixel-ratio-cap="1.25"
        :tiles-resolution-scale="0.72"
        @loaded-change="handlePointcloudLoadedChange"
        @world-ready="handlePointcloudWorldReady"
      />

      <div class="pc-viewport-toolbar">
        <div class="pc-toolbar-cluster">
          <button
            type="button"
            aria-label="重置视角"
            title="重置视角"
            @click="resetView"
          >
            <el-icon><Aim /></el-icon>
          </button>
          <button
            type="button"
            :class="{ 'is-active': isFullscreen }"
            :aria-label="isFullscreen ? '退出全屏' : '进入全屏'"
            :title="isFullscreen ? '退出全屏' : '进入全屏'"
            @click="toggleFullscreen"
          >
            <el-icon><FullScreen /></el-icon>
          </button>
        </div>

        <div class="pc-display-panel">
          <div class="pc-display-row">
            <div
              class="pc-segmented pc-color-modes"
              role="group"
              aria-label="点云着色"
            >
              <button type="button" class="on" aria-pressed="true" disabled>
                真彩
              </button>
            </div>
          </div>

          <div class="pc-display-row">
            <label class="pc-size-control" title="点大小">
              <span>点大小</span>
              <input
                v-model.number="pointSize"
                type="range"
                min="1"
                max="5"
                step="0.1"
                aria-label="点大小"
              />
              <output>{{ pointSize.toFixed(1) }}</output>
            </label>
          </div>

          <div class="pc-display-row">
            <div class="pc-segmented" role="group" aria-label="场景辅助显示">
              <button
                type="button"
                :class="{ on: edlEnabled }"
                :aria-pressed="edlEnabled"
                @click="edlEnabled = !edlEnabled"
              >
                显示增强
              </button>
              <button
                type="button"
                :class="{ on: showAxes }"
                :aria-pressed="showAxes"
                @click="showAxes = !showAxes"
              >
                坐标轴
              </button>
              <button
                type="button"
                :class="{ on: showGrid }"
                :aria-pressed="showGrid"
                @click="showGrid = !showGrid"
              >
                网格
              </button>
              <button
                type="button"
                :class="{ on: showBounds }"
                :aria-pressed="showBounds"
                @click="onBoundsButtonClick"
              >
                剖切
              </button>
            </div>
          </div>
        </div>
      </div>

      <PointcloudAxesTriad
        v-show="showAxes"
        class="pc-axes-triad"
        :camera="viewerCamera"
      />

      <PointcloudViewCube
        class="pc-view-cube"
        :camera="viewerCamera"
        @select-direction="setViewDirection"
        @orbit="orbitView"
        @roll="rollView"
        @home="resetView"
      />

      <div v-if="analysisMode !== 'none'" class="pc-analysis-toolbar">
        <strong>{{ analysisTitle }}</strong>
        <span v-if="analysisSummary" class="pc-analysis-value">
          {{ analysisSummary }}
        </span>
        <span v-else class="pc-analysis-hint">{{ analysisHint }}</span>
        <span class="pc-analysis-exit">Esc 退出测量</span>
        <button type="button" @click="clearAnalysis">清除</button>
      </div>

      <div class="pc-measure-badges">
        <div
          v-for="badge in measureBadges"
          v-show="badge.visible"
          :key="badge.id"
          class="pc-measure-badge"
          :style="{ transform: `translate(${badge.x}px, ${badge.y}px)` }"
        >
          <header @pointerdown="startBadgeDrag(badge, $event)">
            <span class="pc-measure-badge__dots" aria-hidden="true" />
            <span class="pc-measure-badge__title">{{ badge.title }}</span>
          </header>
          <div v-if="badge.mainValue" class="pc-measure-badge__main">
            <span>{{ badge.mainLabel }}</span>
            <strong>{{ badge.mainValue }}</strong>
          </div>
          <div v-if="badge.rows.length" class="pc-measure-badge__rows">
            <div v-for="row in badge.rows" :key="row.label">
              <span>{{ row.label }}</span>
              <span>{{ row.value }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="pc-status" role="status">
        <i :class="{ loading: !pointcloudLoadedState }" aria-hidden="true" />
        {{ pointcloudLoadedState ? '点云已加载' : '正在加载点云' }}
      </div>

      <div class="pc-measurement-dock">
        <MeasurementToolbar
          v-model:collapsed="analysisToolbarCollapsed"
          :mode="analysisMode"
          :disabled="!pointcloudLoadedState"
          orientation="vertical"
          @update:mode="selectAnalysisMode"
          @clear="clearAnalysis"
        />
      </div>

      <div v-if="errorMessage" class="pc-error-overlay">
        <div class="pc-error-card">
          <div class="pc-error-title">预览失败</div>
          <div class="pc-error-message">{{ errorMessage }}</div>
          <div class="pc-error-actions">
            <el-button type="primary" @click="loadPreview">重试</el-button>
            <el-button @click="handleClose">返回</el-button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Aim, Close, FullScreen } from '@element-plus/icons-vue'
import * as THREE from 'three'
import PointCloudViewer from '@/views/twoScreen/components/PointCloudViewer.vue'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import MeasurementToolbar from './MeasurementToolbar.vue'
import PointcloudAxesTriad from './PointcloudAxesTriad.vue'
import PointcloudViewCube from './PointcloudViewCube.vue'

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
  controls: {
    enabled: boolean
  } | null
}
type PointCloudViewerExpose = InstanceType<typeof PointCloudViewer> & {
  setStatusText?: (text: string) => void
  loadPointcloudByScanId: (
    projectId: number,
    scanFileId: number,
  ) => Promise<void>
  resetView?: () => void
  cleanup?: () => void
  getThreeContext?: () => ViewerThreeContext
  getPointcloudWorldBox?: () => THREE.Box3 | null
  setClipBox?: (box: THREE.Box3 | null) => void
  setControlsEnabled?: (enabled: boolean) => void
  setPointSize?: (size: number) => void
  setShowGrid?: (show: boolean) => void
  setEdlEnabled?: (enabled: boolean) => void
  setTilesErrorTargetOverride?: (value: number | null) => void
  requestRender?: () => void
}

const pointcloudViewerRef = ref<PointCloudViewerExpose | null>(null)
const errorMessage = ref('')
const loadToken = ref(0)
const showBounds = ref(false)
const activeClipAxis = ref<ClipAxisKey>('z')
const activeClipInvert = ref(false)
const pointcloudLoadedState = ref(false)
const pointcloudWorldReady = ref(false)

// ==================== 预览页 UI 状态（对齐 cloudBIM-viewer 点云预览） ====================
type PreviewBackgroundTheme = 'deep' | 'light' | 'black' | 'gradient'
const backgroundTheme = ref<PreviewBackgroundTheme>('deep')
const backgroundOptions: Array<{
  label: string
  value: PreviewBackgroundTheme
}> = [
  { label: '蓝色', value: 'gradient' },
  { label: '深色', value: 'deep' },
  { label: '浅色', value: 'light' },
  { label: '纯黑', value: 'black' },
]
const projectName = computed(() => String(route.query.projectName || ''))
const stageRef = ref<HTMLElement | null>(null)
const viewerCamera = ref<THREE.Camera | null>(null)
const isFullscreen = ref(false)
const showAxes = ref(true)
const showGrid = ref(false)
const edlEnabled = ref(true)
const pointSize = ref(2.5)
let scanMaxDim = 10

// 测量工具
type AnalysisMode = 'none' | 'distance' | 'locate' | 'area'
const analysisMode = ref<AnalysisMode>('none')
const analysisToolbarCollapsed = ref(true)
type MeasureBadge = {
  id: string
  title: string
  mainLabel: string
  mainValue: string
  rows: Array<{ label: string; value: string }>
  anchor: THREE.Vector3
  offset: { x: number; y: number }
  x: number
  y: number
  visible: boolean
}
const measureBadges = ref<MeasureBadge[]>([])
let measureGroup: THREE.Group | null = null
let areaPreviewGroup: THREE.Group | null = null
let measureIdSeq = 0
const measureCounts = { point: 0, distance: 0, area: 0 }
let distanceStart: THREE.Vector3 | null = null
let areaPoints: THREE.Vector3[] = []
let measurePointerDown: { x: number; y: number } | null = null
let badgeDrag: {
  id: string
  startX: number
  startY: number
  originX: number
  originY: number
  moved: boolean
} | null = null
let labelRaf = 0

function ensureMeasureGroup(): THREE.Group | null {
  const scene = getViewerScene()
  if (!scene) return null
  if (!measureGroup) {
    measureGroup = new THREE.Group()
    measureGroup.name = '__scan_measure_group__'
    measureGroup.renderOrder = 10000
    scene.add(measureGroup)
  }
  return measureGroup
}

function requestScanRender() {
  pointcloudViewerRef.value?.requestRender?.()
}

/** 作用：创建测量标记（水滴形图钉），与参考页一致 */
function createMeasurementPinSprite(color = '#ff4040', opacity = 1) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建测量标记画布')
  context.shadowColor = 'rgba(255, 86, 86, .38)'
  context.shadowBlur = 18
  context.fillStyle = color
  context.beginPath()
  context.moveTo(64, 10)
  context.bezierCurveTo(33, 10, 18, 32, 18, 55)
  context.bezierCurveTo(18, 82, 39, 96, 64, 118)
  context.bezierCurveTo(89, 96, 110, 82, 110, 55)
  context.bezierCurveTo(110, 32, 95, 10, 64, 10)
  context.closePath()
  context.fill()
  context.shadowBlur = 0
  context.fillStyle = '#fff1f1'
  context.beginPath()
  context.arc(64, 52, 18, 0, Math.PI * 2)
  context.fill()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const marker = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  )
  marker.center.set(0.5, 0.1)
  marker.renderOrder = 10002
  return marker
}

/** 作用：把图钉保持为屏幕空间固定像素大小 */
function scaleMeasurementPin(marker: THREE.Sprite, targetPixels = 16) {
  const camera = getViewerCamera() as THREE.PerspectiveCamera | null
  const dom = getViewerRendererDom()
  if (!camera || !dom || !marker.visible) return
  const rect = dom.getBoundingClientRect()
  const viewportHeight = Math.max(rect.height, 1)
  const distance = camera.position.distanceTo(marker.position)
  const fov = THREE.MathUtils.degToRad(camera.fov || 50)
  const worldUnitsPerPixel =
    (2 * distance * Math.tan(fov * 0.5)) / viewportHeight
  const size = Math.max(worldUnitsPerPixel * targetPixels, 1e-6)
  marker.scale.set(size, size, 1)
}

function addMeasurementPin(
  point: THREE.Vector3,
  color = '#ff4040',
  opacity = 1,
  group?: THREE.Group | null,
) {
  const target = group ?? ensureMeasureGroup()
  if (!target) return
  const pin = createMeasurementPinSprite(color, opacity)
  pin.position.copy(point)
  target.add(pin)
  scaleMeasurementPin(pin)
}

/** 作用：创建测距/轮廓线（粗虚线，与参考页一致） */
function createMeasureLine(
  points: THREE.Vector3[],
  color = '#d63d3d',
  dashed = true,
) {
  const geometry = new LineGeometry()
  geometry.setPositions(points.flatMap((p) => [p.x, p.y, p.z]))
  const material = new LineMaterial({
    color,
    linewidth: 2.8,
    dashed,
    dashSize: 0.9,
    gapSize: 0.48,
    worldUnits: false,
    transparent: true,
    opacity: 0.96,
    depthTest: false,
    depthWrite: false,
  })
  const line = new Line2(geometry, material)
  line.computeLineDistances()
  line.renderOrder = 10001
  return line
}

function removeAreaPreview() {
  if (!areaPreviewGroup) return
  areaPreviewGroup.parent?.remove(areaPreviewGroup)
  areaPreviewGroup.traverse((obj: any) => {
    obj.geometry?.dispose?.()
    const mat = obj.material
    if (Array.isArray(mat)) mat.forEach((m: any) => m?.dispose?.())
    else mat?.dispose?.()
  })
  areaPreviewGroup = null
}

function addMeasureBadge(
  badge: Omit<MeasureBadge, 'x' | 'y' | 'visible' | 'offset'>,
) {
  measureBadges.value = [
    ...measureBadges.value,
    { ...badge, offset: { x: 0, y: 0 }, x: 0, y: 0, visible: false },
  ]
}

function updateMeasureBadges() {
  const camera = getViewerCamera()
  const dom = getViewerRendererDom()
  if (!camera || !dom || !measureBadges.value.length) return
  const rect = dom.getBoundingClientRect()
  const projected = new THREE.Vector3()
  measureBadges.value = measureBadges.value.map((badge) => {
    projected.copy(badge.anchor).project(camera as THREE.PerspectiveCamera)
    return {
      ...badge,
      x: (projected.x * 0.5 + 0.5) * rect.width + 14 + badge.offset.x,
      y: (-projected.y * 0.5 + 0.5) * rect.height - 18 + badge.offset.y,
      visible: projected.z < 1,
    }
  })
}

/** 作用：拖动测量徽章（与参考页一致）；未拖动的点击仍按测量处理 */
function startBadgeDrag(badge: MeasureBadge, event: PointerEvent) {
  event.stopPropagation()
  event.preventDefault()
  badgeDrag = {
    id: badge.id,
    startX: event.clientX,
    startY: event.clientY,
    originX: badge.offset.x,
    originY: badge.offset.y,
    moved: false,
  }
  window.addEventListener('pointermove', onBadgeDragMove)
  window.addEventListener('pointerup', endBadgeDrag)
}

function onBadgeDragMove(event: PointerEvent) {
  if (!badgeDrag) return
  const drag = badgeDrag
  const dx = event.clientX - drag.startX
  const dy = event.clientY - drag.startY
  if (!drag.moved && Math.hypot(dx, dy) <= 4) return
  drag.moved = true
  measureBadges.value = measureBadges.value.map((badge) =>
    badge.id === drag.id
      ? { ...badge, offset: { x: drag.originX + dx, y: drag.originY + dy } }
      : badge,
  )
}

function endBadgeDrag(event: PointerEvent) {
  const drag = badgeDrag
  badgeDrag = null
  window.removeEventListener('pointermove', onBadgeDragMove)
  window.removeEventListener('pointerup', endBadgeDrag)
  // 点在徽章手柄上但没有拖动：仍视为一次测量点击
  if (drag && !drag.moved && analysisMode.value !== 'none') {
    const point = pickScanPoint(event.clientX, event.clientY)
    if (point) handleMeasurePoint(point)
  }
}

/** 作用：同步图钉大小与粗线分辨率（跟随相机/视口） */
function syncMeasureVisuals() {
  const dom = getViewerRendererDom()
  const width = dom?.clientWidth || 1
  const height = dom?.clientHeight || 1
  measureGroup?.traverse((child: any) => {
    if (child instanceof THREE.Sprite) scaleMeasurementPin(child)
    if (child instanceof Line2) {
      child.material.resolution?.set?.(width, height)
    }
  })
}

function formatLength(value: number) {
  return `${value.toFixed(3)} m`
}

/** 作用：计算多边形在最佳拟合平面上的面积/周长/质心/投影点 */
function createPolygonMetrics(points: THREE.Vector3[]) {
  if (points.length < 3) return null
  const normal = new THREE.Vector3()
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length]
    normal.x += (point.y - next.y) * (point.z + next.z)
    normal.y += (point.z - next.z) * (point.x + next.x)
    normal.z += (point.x - next.x) * (point.y + next.y)
  })
  if (normal.lengthSq() < 1e-10) return null
  normal.normalize()
  const origin = points[0].clone()
  const axisU = points[1].clone().sub(origin)
  if (axisU.lengthSq() < 1e-10) return null
  axisU.normalize()
  const axisV = normal.clone().cross(axisU).normalize()
  const projected = points.map((point) => {
    const relative = point.clone().sub(origin)
    return new THREE.Vector2(relative.dot(axisU), relative.dot(axisV))
  })
  let twiceArea = 0
  let centroidX = 0
  let centroidY = 0
  projected.forEach((point, index) => {
    const next = projected[(index + 1) % projected.length]
    const cross = point.x * next.y - next.x * point.y
    twiceArea += cross
    centroidX += (point.x + next.x) * cross
    centroidY += (point.y + next.y) * cross
  })
  const area = Math.abs(twiceArea) * 0.5
  if (area <= 1e-8) return null
  let perimeter = 0
  points.forEach((point, index) => {
    perimeter += point.distanceTo(points[(index + 1) % points.length])
  })
  const centroid = origin
    .clone()
    .addScaledVector(axisU, centroidX / (3 * twiceArea))
    .addScaledVector(axisV, centroidY / (3 * twiceArea))
  return { projected, area, perimeter, centroid }
}

function polygonArea(points: THREE.Vector3[]) {
  return createPolygonMetrics(points)?.area ?? 0
}

function pickScanPoint(clientX: number, clientY: number): THREE.Vector3 | null {
  const camera = getViewerCamera() as THREE.PerspectiveCamera | null
  const scene = getViewerScene()
  const dom = getViewerRendererDom()
  if (!camera || !scene || !dom) return null
  const rect = dom.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1) return null

  // 只对点云本身做拾取，避免命中网格/测量图钉
  const targets: THREE.Object3D[] = []
  scene.traverse((obj) => {
    if ((obj as any).isPoints) targets.push(obj)
  })
  if (!targets.length) return null

  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -(((clientY - rect.top) / rect.height) * 2 - 1),
  )
  const controls = getViewerThreeContext()?.controls as any
  const target = controls?.target as THREE.Vector3 | undefined
  const distance = target
    ? camera.position.distanceTo(target)
    : Math.max(scanMaxDim, 1)
  const fov = THREE.MathUtils.degToRad(camera.fov || 50)
  const worldPerPixel =
    (2 * Math.max(distance, 0.001) * Math.tan(fov * 0.5)) /
    Math.max(rect.height, 1)

  const ray = new THREE.Raycaster()
  ray.setFromCamera(ndc, camera)
  // 屏幕空间容差：约 18px，先近后远；再放大到 48px 兜底
  for (const pixels of [18, 48]) {
    ray.params.Points = {
      threshold: Math.max(worldPerPixel * pixels, scanMaxDim * 0.01, 0.02),
    }
    const hit = ray.intersectObjects(targets, false)[0]
    if (hit) return snapMeasurePoint(hit.point.clone(), clientX, clientY)
  }
  return null
}

/** 作用：吸附到已有测量点（18px 内），用于闭合区域/接续测量 */
function snapMeasurePoint(
  point: THREE.Vector3,
  clientX: number,
  clientY: number,
): THREE.Vector3 {
  const camera = getViewerCamera()
  const dom = getViewerRendererDom()
  if (!camera || !dom) return point
  const candidates: THREE.Vector3[] = [...areaPoints]
  if (distanceStart) candidates.push(distanceStart)
  measureBadges.value.forEach((badge) => candidates.push(badge.anchor))
  if (!candidates.length) return point

  const rect = dom.getBoundingClientRect()
  const screenX = clientX - rect.left
  const screenY = clientY - rect.top
  const projected = new THREE.Vector3()
  let best: THREE.Vector3 | null = null
  let bestDistance = 18
  for (const candidate of candidates) {
    projected.copy(candidate).project(camera as THREE.PerspectiveCamera)
    if (projected.z < -1 || projected.z > 1) continue
    const x = (projected.x * 0.5 + 0.5) * rect.width
    const y = (-projected.y * 0.5 + 0.5) * rect.height
    const distance = Math.hypot(x - screenX, y - screenY)
    if (distance <= bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }
  return best ? best.clone() : point
}

function handleMeasurePoint(point: THREE.Vector3) {
  if (analysisMode.value === 'locate') {
    addMeasurementPin(point, '#22d3ee')
    addMeasureBadge({
      id: `measure-${++measureIdSeq}`,
      title: `定位 #${++measureCounts.point}`,
      mainLabel: '坐标',
      mainValue: '',
      rows: [
        { label: 'X', value: formatLength(point.x) },
        { label: 'Y', value: formatLength(point.z) },
        { label: 'Z', value: formatLength(point.y) },
      ],
      anchor: point,
    })
  } else if (analysisMode.value === 'distance') {
    if (!distanceStart) {
      distanceStart = point
      addMeasurementPin(point, '#ff4040')
    } else {
      const start = distanceStart
      const group = ensureMeasureGroup()
      group?.add(createMeasureLine([start, point]))
      addMeasurementPin(point, '#ff5a5a', 0.96)
      const dx = point.x - start.x
      const dy = point.y - start.y
      const dz = point.z - start.z
      const horizontal = Math.hypot(dx, dz)
      const vertical = Math.abs(dy)
      const slope =
        horizontal <= 1e-8
          ? vertical <= 1e-8
            ? 0
            : 90
          : (Math.atan2(vertical, horizontal) * 180) / Math.PI
      addMeasureBadge({
        id: `measure-${++measureIdSeq}`,
        title: `测距 #${++measureCounts.distance}`,
        mainLabel: '直线距离',
        mainValue: formatLength(start.distanceTo(point)),
        rows: [
          { label: '水平距离', value: formatLength(horizontal) },
          { label: '垂直距离', value: formatLength(vertical) },
          { label: '坡度', value: `${slope.toFixed(2)}°` },
        ],
        anchor: start.clone().add(point).multiplyScalar(0.5),
      })
      distanceStart = null
    }
  } else if (analysisMode.value === 'area') {
    const camera = getViewerCamera() as THREE.PerspectiveCamera | null
    const closeThreshold = Math.max(
      0.15,
      (camera?.position.distanceTo(point) ?? 1) * 0.025,
    )
    // 与参考页一致：点击首个点附近即闭合区域
    if (
      areaPoints.length >= 3 &&
      point.distanceTo(areaPoints[0]) < closeThreshold
    ) {
      closeAreaMeasurement()
      requestScanRender()
      return
    }
    areaPoints.push(point)
    if (!areaPreviewGroup) {
      areaPreviewGroup = new THREE.Group()
      areaPreviewGroup.renderOrder = 10000
      ensureMeasureGroup()?.add(areaPreviewGroup)
    }
    addMeasurementPin(point, '#ff4040', 1, areaPreviewGroup)
    updateAreaPreview()
  }
  requestScanRender()
}

function removeAreaPreviewLines() {
  if (!areaPreviewGroup) return
  for (const child of [...areaPreviewGroup.children]) {
    if ((child as any).isSprite) continue
    areaPreviewGroup.remove(child)
    ;(child as any).geometry?.dispose?.()
    ;(child as any).material?.dispose?.()
  }
}

/** 作用：刷新面积预览（≥3 点时自动闭合并填充，与参考页一致） */
function updateAreaPreview() {
  removeAreaPreviewLines()
  if (!areaPreviewGroup || areaPoints.length < 2) return
  const closed = areaPoints.length >= 3
  const outline = closed ? [...areaPoints, areaPoints[0]] : [...areaPoints]
  areaPreviewGroup.add(createMeasureLine(outline, '#ff5a5a'))
  if (!closed) return
  const metrics = createPolygonMetrics(areaPoints)
  if (!metrics) return
  const triangles = THREE.ShapeUtils.triangulateShape(metrics.projected, [])
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      areaPoints.flatMap((p) => [p.x, p.y, p.z]),
      3,
    ),
  )
  geometry.setIndex(triangles.flat())
  geometry.computeVertexNormals()
  const fill = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0xff5a5a,
      transparent: true,
      opacity: 0.16,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  fill.renderOrder = 10000
  areaPreviewGroup.add(fill)
}

function closeAreaMeasurement() {
  if (analysisMode.value !== 'area' || areaPoints.length < 3) return
  const points = [...areaPoints]
  const metrics = createPolygonMetrics(points)
  removeAreaPreviewLines()
  const group = ensureMeasureGroup()
  if (group) {
    group.add(createMeasureLine([...points, points[0]], '#ff5a5a'))
    if (metrics) {
      const triangles = THREE.ShapeUtils.triangulateShape(metrics.projected, [])
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          points.flatMap((point) => [point.x, point.y, point.z]),
          3,
        ),
      )
      geometry.setIndex(triangles.flat())
      geometry.computeVertexNormals()
      const fill = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: 0xff5a5a,
          transparent: true,
          opacity: 0.16,
          depthTest: false,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      )
      fill.renderOrder = 10000
      group.add(fill)
    }
  }
  const centroid =
    metrics?.centroid ??
    points
      .reduce((sum, p) => sum.add(p), new THREE.Vector3())
      .multiplyScalar(1 / points.length)
  addMeasureBadge({
    id: `measure-${++measureIdSeq}`,
    title: `面积 #${++measureCounts.area}`,
    mainLabel: '面积',
    mainValue: `${polygonArea(points).toFixed(2)} m²`,
    rows: metrics
      ? [{ label: '周长', value: `${metrics.perimeter.toFixed(2)} m` }]
      : [],
    anchor: centroid,
  })
  areaPoints = []
  areaPreviewGroup = null
  requestScanRender()
}

function selectAnalysisMode(mode: AnalysisMode) {
  analysisMode.value = analysisMode.value === mode ? 'none' : mode
  distanceStart = null
  areaPoints = []
  removeAreaPreview()
}

function clearAnalysis() {
  analysisMode.value = 'none'
  distanceStart = null
  areaPoints = []
  areaPreviewGroup = null
  measureBadges.value = []
  measureCounts.point = 0
  measureCounts.distance = 0
  measureCounts.area = 0
  if (measureGroup) {
    measureGroup.parent?.remove(measureGroup)
    measureGroup.traverse((obj: any) => {
      obj.geometry?.dispose?.()
      const mat = obj.material
      if (Array.isArray(mat)) mat.forEach((m: any) => m?.dispose?.())
      else {
        mat?.map?.dispose?.()
        mat?.dispose?.()
      }
    })
    measureGroup = null
  }
  requestScanRender()
}

function onStagePointerDown(event: PointerEvent) {
  if (analysisMode.value === 'none') return
  measurePointerDown = { x: event.clientX, y: event.clientY }
}

function onStagePointerUp(event: PointerEvent) {
  if (analysisMode.value === 'none' || !measurePointerDown) return
  const dx = event.clientX - measurePointerDown.x
  const dy = event.clientY - measurePointerDown.y
  measurePointerDown = null
  if (dx * dx + dy * dy > 25) return
  const point = pickScanPoint(event.clientX, event.clientY)
  if (point) handleMeasurePoint(point)
}

function onStageDblClick() {
  closeAreaMeasurement()
}

function onMeasureKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && analysisMode.value !== 'none') {
    clearAnalysis()
    return
  }
  if (event.key === 'Enter' && analysisMode.value === 'area') {
    closeAreaMeasurement()
  }
}

const analysisTitle = computed(() =>
  analysisMode.value === 'distance'
    ? '全局测距'
    : analysisMode.value === 'area'
      ? '面积测量'
      : '全局定位',
)
const analysisHint = computed(() => {
  if (analysisMode.value === 'distance') return '依次点击两点完成一段测距'
  if (analysisMode.value === 'area') return '连续点击至少三个点，双击闭合区域'
  return '点击任意位置拾取坐标'
})
const analysisSummary = computed(() => {
  const latest = measureBadges.value.at(-1)
  return latest ? `${latest.mainLabel} ${latest.mainValue}` : ''
})

function applyBackgroundTheme() {
  const ctx = getViewerThreeContext()
  const scene = ctx?.scene
  const renderer = ctx?.renderer as any
  const colorMap: Record<PreviewBackgroundTheme, string> = {
    deep: '#0c1224',
    light: '#e8eef6',
    black: '#000000',
    gradient: '#10213b',
  }
  const color = new THREE.Color(colorMap[backgroundTheme.value])
  if (scene) scene.background = color
  if (renderer?.setClearColor) renderer.setClearColor(color, 1)
  requestScanRender()
}

function setViewDirection(direction: [number, number, number]) {
  const camera = getViewerCamera()
  const controls = getViewerThreeContext()?.controls as any
  if (!camera || !controls?.target) return
  const target = (controls.target as THREE.Vector3).clone()
  const dir = new THREE.Vector3(...direction).normalize()
  const distance = Math.max(camera.position.distanceTo(target), scanMaxDim, 1)
  camera.up.set(0, 1, 0)
  if (Math.abs(dir.y) > 0.99) {
    camera.up.set(0, 0, dir.y > 0 ? -1 : 1)
  }
  camera.position.copy(target.clone().add(dir.multiplyScalar(distance)))
  camera.lookAt(target)
  controls.update?.()
  requestScanRender()
}

function orbitView(delta: { lon: number; lat: number }) {
  const camera = getViewerCamera()
  const controls = getViewerThreeContext()?.controls as any
  if (!camera || !controls?.target) return
  const target = (controls.target as THREE.Vector3).clone()
  const offset = camera.position.clone().sub(target)
  const spherical = new THREE.Spherical().setFromVector3(offset)
  spherical.theta -= THREE.MathUtils.degToRad(delta.lon)
  spherical.phi -= THREE.MathUtils.degToRad(delta.lat)
  spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.001, Math.PI - 0.001)
  offset.setFromSpherical(spherical)
  camera.position.copy(target.clone().add(offset))
  camera.up.set(0, 1, 0)
  camera.lookAt(target)
  controls.update?.()
  requestScanRender()
}

function rollView(direction: -1 | 1) {
  const camera = getViewerCamera()
  const controls = getViewerThreeContext()?.controls as any
  if (!camera) return
  const forward = new THREE.Vector3()
  camera.getWorldDirection(forward)
  camera.up.applyAxisAngle(forward, direction * (Math.PI / 2))
  if (controls?.target) camera.lookAt(controls.target as THREE.Vector3)
  controls?.update?.()
  requestScanRender()
}

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
    state.offsets[minKey] = THREE.MathUtils.clamp(
      state.offsets[minKey],
      0,
      span,
    )
    state.offsets[maxKey] = THREE.MathUtils.clamp(
      state.offsets[maxKey],
      0,
      span,
    )
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

function setClipFacePosition(
  axis: ClipAxisKey,
  invert: boolean,
  value: number,
) {
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
    handle.position
      .copy(face.anchor)
      .add(face.normal.clone().multiplyScalar(offset))
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

  clipBoxHelper = new THREE.Box3Helper(
    helperBox.clone(),
    new THREE.Color('#ffcf4a'),
  )
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

function pickClipOverlay(
  ev: PointerEvent,
):
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

function beginClipDrag(
  ev: PointerEvent,
  options: { axis: ClipAxisKey; invert: boolean },
) {
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
  viewerCamera.value = getViewerCamera()
  const box = getContentWorldBox()
  if (box) {
    const size = box.getSize(new THREE.Vector3())
    scanMaxDim = Math.max(size.x, size.y, size.z) || 10
  }
  applyBackgroundTheme()
  pointcloudViewerRef.value?.setPointSize?.(pointSize.value)
  pointcloudViewerRef.value?.setShowGrid?.(showGrid.value)
  pointcloudViewerRef.value?.setEdlEnabled?.(edlEnabled.value)
  // 与参考页一致：点云 LOD errorTarget = 32
  pointcloudViewerRef.value?.setTilesErrorTargetOverride?.(32)
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

watch(backgroundTheme, () => applyBackgroundTheme())
watch(showGrid, (value) => pointcloudViewerRef.value?.setShowGrid?.(value))
watch(pointSize, (value) => pointcloudViewerRef.value?.setPointSize?.(value))
watch(edlEnabled, (value) => pointcloudViewerRef.value?.setEdlEnabled?.(value))
watch(analysisMode, (mode) => {
  const dom = getViewerRendererDom()
  if (dom) dom.style.cursor = mode === 'none' ? '' : 'crosshair'
})

function syncFullscreenState() {
  isFullscreen.value = !!document.fullscreenElement
}

onMounted(() => {
  void loadPreview()
  const stage = stageRef.value
  stage?.addEventListener('pointerdown', onStagePointerDown)
  stage?.addEventListener('pointerup', onStagePointerUp)
  stage?.addEventListener('dblclick', onStageDblClick)
  document.addEventListener('fullscreenchange', syncFullscreenState)
  document.addEventListener('keydown', onMeasureKeyDown)

  const loop = () => {
    labelRaf = requestAnimationFrame(loop)
    if (measureBadges.value.length) updateMeasureBadges()
    if (measureGroup) syncMeasureVisuals()
  }
  loop()
})

onBeforeUnmount(() => {
  loadToken.value += 1
  cancelAnimationFrame(labelRaf)
  const stage = stageRef.value
  stage?.removeEventListener('pointerdown', onStagePointerDown)
  stage?.removeEventListener('pointerup', onStagePointerUp)
  stage?.removeEventListener('dblclick', onStageDblClick)
  document.removeEventListener('fullscreenchange', syncFullscreenState)
  document.removeEventListener('keydown', onMeasureKeyDown)
  clearAnalysis()
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

.scan-preview-toolbar
  :deep(.el-button.toolbar-tool-btn.is-disabled:not(.is-on)) {
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

<style lang="scss" scoped>
/* ==================== CloudBIM 风格点云预览布局 ==================== */
.pointcloud-preview-page {
  --viewer-stage: #0c1224;
  --viewer-chrome: rgb(12 18 36 / 88%);
  --viewer-ink: #e8ecf8;
  --viewer-muted: #9aa8c7;
  --viewer-accent: #9ec1ff;

  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--viewer-stage);
}

.pc-header {
  position: relative;
  z-index: 100;
  display: flex;
  flex: 0 0 64px;
  gap: var(--spacing-md);
  align-items: center;
  padding: 8px 64px 8px 20px;
  background: #e6ebf5;
  border-bottom: 1px solid #cfd7e8;
}

.pc-heading {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.pc-heading strong,
.pc-heading small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pc-heading strong {
  font-size: var(--font-size-sm);
  color: #1a1d24;
}

.pc-heading small {
  margin-top: 2px;
  font-size: var(--font-size-xs);
  color: #6b7280;
}

.pc-header-controls {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  align-items: center;
}

.pc-header-label {
  font-size: var(--font-size-xs);
  color: #6b7280;
}

.pc-close {
  position: absolute;
  top: 16px;
  right: 18px;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  color: #6b7280;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--radius-xs);
}

.pc-close:hover {
  color: #4e66cc;
  background: rgb(255 255 255 / 60%);
}

.pc-stage {
  position: relative;
  flex: 1;
  min-height: 320px;
  overflow: hidden;
  background: var(--viewer-stage);
}

.pc-stage.theme-deep {
  background: #0c1224;
}

.pc-stage.theme-black {
  background: #000;
}

.pc-stage.theme-light {
  background: #e8eef6;
}

.pc-stage.theme-gradient {
  background: #10213b;
}

.pc-viewer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.pc-viewer :deep(.pointcloud-view-panel),
.pc-viewer :deep(.pointcloud-viewport) {
  width: 100%;
  height: 100%;
}

.pc-viewport-toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
  max-width: calc(100% - 140px);
  pointer-events: none;
}

.pc-toolbar-cluster {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  pointer-events: auto;
}

.pc-toolbar-cluster button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  color: var(--viewer-ink);
  cursor: pointer;
  background: var(--viewer-chrome);
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: var(--radius-xs);
}

.pc-toolbar-cluster button:hover,
.pc-toolbar-cluster button.is-active {
  color: var(--viewer-accent);
  background: rgb(24 42 72 / 88%);
  border-color: rgb(115 162 243 / 55%);
}

.pc-display-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: max-content;
  max-width: min(720px, calc(100vw - 140px));
  padding: 8px 10px;
  background: rgb(26 29 36 / 90%);
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: var(--radius-sm);
  backdrop-filter: blur(6px);
  pointer-events: auto;
}

.pc-display-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.pc-segmented {
  display: inline-flex;
  align-items: center;
  padding: 3px;
  background: rgb(255 255 255 / 10%);
  border-radius: var(--radius-sm);
}

.pc-segmented button {
  min-width: 0;
  padding: 4px 8px;
  font-size: var(--font-size-sm);
  line-height: 20px;
  color: rgb(255 255 255 / 72%);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--radius-xs);
}

.pc-segmented button:hover:not(:disabled) {
  color: var(--viewer-ink);
}

.pc-segmented button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.pc-segmented button.on {
  color: var(--viewer-accent);
  background: rgb(255 255 255 / 14%);
  box-shadow: 0 0 0 1px rgb(255 255 255 / 12%);
}

.pc-header-controls .pc-segmented {
  background: rgb(255 255 255 / 55%);
}

.pc-header-controls .pc-segmented button {
  padding: 6px 12px;
  font-size: var(--font-size-xs);
  color: #3d4450;
}

.pc-header-controls .pc-segmented button.on {
  font-weight: 600;
  color: #4e66cc;
  background: #fff;
  box-shadow: 0 0 0 1px #cfd7e8;
}

.pc-size-control {
  display: flex;
  gap: 7px;
  align-items: center;
  min-width: 164px;
  height: 34px;
  padding: 3px 7px;
  font-size: var(--font-size-xs);
  color: rgb(255 255 255 / 72%);
  background: rgb(255 255 255 / 10%);
  border-radius: var(--radius-sm);
}

.pc-size-control input {
  flex: 1 1 auto;
  min-width: 60px;
  height: 4px;
  accent-color: var(--viewer-accent);
  cursor: pointer;
}

.pc-size-control output {
  min-width: 24px;
  color: var(--viewer-muted);
  font-variant-numeric: tabular-nums;
}

.pc-axes-triad {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 25;
  pointer-events: none;
}

.pc-view-cube {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 60;
}

.pc-analysis-toolbar {
  position: absolute;
  top: 18px;
  left: 50%;
  z-index: 82;
  display: flex;
  gap: 12px;
  align-items: center;
  min-height: 42px;
  max-width: calc(100% - 32px);
  padding: 8px 10px 8px 14px;
  color: #f8fafc;
  white-space: nowrap;
  background: rgb(8 17 29 / 86%);
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: var(--radius-sm);
  box-shadow: 0 12px 30px rgb(0 0 0 / 24%);
  backdrop-filter: blur(14px);
  transform: translateX(-50%);
}

.pc-analysis-toolbar strong {
  font-size: var(--font-size-sm);
}

.pc-analysis-hint,
.pc-analysis-exit {
  font-size: var(--font-size-xs);
  color: rgb(226 232 240 / 78%);
}

.pc-analysis-value {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: #fca5a5;
}

.pc-analysis-toolbar button {
  padding: 4px 9px;
  font-size: var(--font-size-xs);
  color: #fecaca;
  cursor: pointer;
  background: transparent;
  border: 1px solid rgb(248 113 113 / 40%);
  border-radius: var(--radius-xs);
}

.pc-analysis-toolbar button:hover {
  background: rgb(248 113 113 / 16%);
}

.pc-measure-badges {
  position: absolute;
  inset: 0;
  z-index: 40;
  pointer-events: none;
}

.pc-measure-badge {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 168px;
  max-width: 220px;
  padding: 10px 12px 8px;
  color: rgb(255 255 255 / 90%);
  pointer-events: none;
  user-select: none;
  background: rgb(8 18 42 / 78%);
  border: 1px solid rgb(115 162 243 / 22%);
  border-radius: var(--radius-sm);
  box-shadow:
    0 12px 28px rgb(4 10 34 / 30%),
    inset 0 1px 0 rgb(255 255 255 / 6%);
  backdrop-filter: blur(14px) saturate(120%);
}

.pc-measure-badge header {
  display: flex;
  gap: 8px;
  align-items: center;
  min-height: 18px;
  pointer-events: auto;
  cursor: grab;
}

.pc-measure-badge header:active {
  cursor: grabbing;
}

.pc-measure-badge__dots {
  width: 16px;
  height: 10px;
  background-image: radial-gradient(
    circle,
    rgb(151 186 255 / 78%) 1px,
    transparent 1.5px
  );
  background-size: 5px 5px;
  opacity: 0.62;
}

.pc-measure-badge__title {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: rgb(255 255 255 / 68%);
}

.pc-measure-badge__main {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.pc-measure-badge__main span {
  font-size: 10px;
  font-weight: 600;
  color: rgb(145 181 255 / 94%);
}

.pc-measure-badge__main strong {
  font-size: 18px;
  line-height: 1.15;
  color: #fff;
  text-shadow: 0 0 14px rgb(78 102 204 / 28%);
}

.pc-measure-badge__rows {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.pc-measure-badge__rows > div {
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.pc-measure-badge__rows span:first-child {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: rgb(161 191 250 / 88%);
}

.pc-measure-badge__rows span:last-child {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: rgb(255 255 255 / 94%);
  text-align: right;
}

.pc-status {
  position: absolute;
  bottom: 118px;
  left: 14px;
  z-index: 25;
  display: inline-flex;
  gap: 7px;
  align-items: center;
  font-size: var(--font-size-xs);
  color: var(--viewer-muted);
  pointer-events: none;
}

.pc-status > i {
  width: 7px;
  height: 7px;
  background: #22d3ee;
  border-radius: 50%;
}

.pc-status > i.loading {
  background: #f59e0b;
}

.pc-measurement-dock {
  position: absolute;
  top: 120px;
  right: 20px;
  z-index: 80;
}

.pc-error-overlay {
  position: absolute;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  background: rgb(8 17 29 / 72%);
}

.pc-error-card {
  max-width: 400px;
  padding: 32px;
  text-align: center;
  background: var(--bg-card);
  border-radius: var(--radius-md);
}

.pc-error-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.pc-error-message {
  margin: 12px 0 20px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

@media (width <= 900px) {
  .pc-header {
    padding-left: 14px;
  }

  .pc-header-label {
    display: none;
  }

  .pc-measurement-dock {
    top: auto;
    right: 12px;
    bottom: 14px;
  }
}
</style>
