<template>
  <div
    v-for="(panel, index) in visiblePanels"
    :key="panel.content"
    :class="['dynamic-panel', getPanelClass(index, visiblePanels.length)]"
    :data-panel="panel.id"
  >
    <div class="panel-content">
      <BimViewer
        v-if="panel.content === 'rvt'"
        :ref="setBimRef"
        :is-preset-mode="isPresetMode"
        :show-internal-controls="true"
        :calibration="bimPointcloudCalibration"
        :pointcloud-world-matrix="pointcloudWorldMatrix"
        :current-trajectory-point="currentTrajectoryPoint"
        :click-to-enter-first-person="false"
        :rotation-lock="rotationLock"
        :annotation-enabled="annotationEnabled"
        :annotation-point="annotationPointBim"
        :annotation-status="annotationStatus"
        :annotation-persist="annotationPersist"
        :annotation-stash-markers="annotationStashMarkers.bim"
        :annotation-highlight-current="annotationHighlightCurrent"
        :annotation-markers-visible="annotationMarkersVisible"
        @loaded-change="handleBimLoadedChange"
        @camera-change="handleBimCameraChange"
        @annotation-pick="handleAnnotationPick"
      />
      <PanoramaViewPanel
        v-else-if="panel.content === 'panorama'"
        :ref="setPanoramaRef"
        :time-range="timeRange"
        :project-id="projectId"
        :scan-file-id="scanFileId"
        :segments="segments"
        :now="now"
        @image-info-change="handleImageInfoChange"
        @panorama-rot-change="handlePanoramaRotChange"
        @panorama-fov-change="handlePanoramaFovChange"
        @visible-change="handleVisibleChange"
        @segment-click="handleSegmentClick"
      />
      <GaussianViewerSimple
        v-else-if="panel.content === 'gaussian' && gaussFileId"
        :key="gaussianViewerKey"
        :ref="setGaussianRef"
        :project-id="projectId"
        :gauss-file-id="gaussFileId"
        :gauss-asset-path="gaussAssetPath"
        :current-image-info="currentImageInfo"
        :current-trajectory-point="currentTrajectoryPoint"
        :panorama-camera-rot="panoramaCameraRot"
        :panorama-fov="panoramaFov"
        :rotation-lock="rotationLock"
        :annotation-enabled="annotationEnabled"
        :annotation-point="annotationPointGaussian"
        :annotation-status="annotationStatus"
        :annotation-stash-markers="annotationStashMarkers.gaussian"
        :annotation-highlight-current="annotationHighlightCurrent"
        :annotation-markers-visible="annotationMarkersVisible"
        @loaded-change="handleGaussianLoadedChange"
        @camera-change="handleGaussianCameraChange"
        @annotation-pick="handleAnnotationPick"
        @error="() => handleGaussianError()"
      />
      <div v-else-if="panel.content === 'gaussian'" class="gaussian-wait-panel">
        <div class="gaussian-wait-panel__content">
          <div class="gaussian-wait-panel__title">高斯模型准备中</div>
          <div class="gaussian-wait-panel__text">
            正在读取当前扫描的高斯绑定信息，请稍后。
          </div>
        </div>
      </div>
      <PointCloudViewer
        v-else-if="panel.content === 'pointcloud'"
        :ref="setPointcloudRef"
        :is-preset-mode="isPresetMode"
        :show-internal-controls="true"
        :apply-tileset-transform="true"
        :auto-fit-on-load="false"
        :render-all-points="layoutMode === 'quad'"
        :current-trajectory-point="currentTrajectoryPoint"
        :click-to-enter-first-person="false"
        :rotation-lock="rotationLock"
        :annotation-point="annotationPointPointcloud"
        :annotation-status="annotationStatus"
        :annotation-stash-markers="annotationStashMarkers.pointcloud"
        :annotation-highlight-current="annotationHighlightCurrent"
        :annotation-markers-visible="annotationMarkersVisible"
        :annotation-enabled="annotationEnabled"
        @loaded-change="handlePointcloudLoadedChange"
        @camera-change="handlePointcloudCameraChange"
        @world-ready="handlePointcloudWorldReady"
        @annotation-pick="handleAnnotationPick"
      />
      <ConsistencyResultViewer
        v-else-if="panel.content === 'consistencyResult'"
        :ref="setConsistencyResultRef"
        :project-id="projectId"
        :scan-file-id="scanFileId"
        :bim-file-id="bimFileId"
        :calibration="bimPointcloudCalibration"
        :pointcloud-world-matrix="pointcloudWorldMatrix"
        :camera-pose="consistencyCameraPose"
        :annotation-enabled="annotationEnabled"
        :annotation-point="annotationPointConsistency"
        :annotation-status="annotationStatus"
        :annotation-persist="annotationPersist"
        :annotation-stash-markers="annotationStashMarkers.consistencyResult"
        :annotation-highlight-current="annotationHighlightCurrent"
        :annotation-markers-visible="annotationMarkersVisible"
        @loaded-change="handleConsistencyResultLoadedChange"
        @ready-state-change="handleConsistencyResultReadyStateChange"
        @annotation-pick="handleAnnotationPick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { TrajectoryPoint } from '@/api/calibration'
import BimViewer from './BimViewer.vue'
import PanoramaViewPanel from './PanoramaViewPanel.vue'
import GaussianViewerSimple from './GaussianViewerSimple.vue'
import PointCloudViewer from './PointCloudViewer.vue'
import ConsistencyResultViewer from './ConsistencyResultViewer.vue'

interface Panel {
  id: string
  content: 'rvt' | 'panorama' | 'gaussian' | 'pointcloud' | 'consistencyResult'
}

interface PanelContents {
  [key: string]:
    | 'rvt'
    | 'panorama'
    | 'gaussian'
    | 'pointcloud'
    | 'consistencyResult'
    | ''
}

interface TimeRange {
  start: number
  end: number
}

interface Segment {
  start: number
  end: number
  status: 'calibrated' | 'uncalibrated'
  scanFileId?: number
}

type ViewerCameraPose = {
  camera: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
}

const props = defineProps<{
  layoutMode: string
  panelContents: PanelContents
  timeRange?: TimeRange | null
  projectId?: number | null
  scanFileId?: number | null
  bimFileId?: number | null
  gaussFileId?: number | null
  gaussAssetPath?: string
  segments?: Segment[]
  now?: number
  isPresetMode?: boolean
  bimPointcloudCalibration?: {
    modelMatrix: number[]
  } | null
  pointcloudWorldMatrix?: number[] | null
  currentImageInfo?: any
  currentTrajectoryPoint?: TrajectoryPoint | null
  panoramaCameraRot?: { lon: number; lat: number }
  panoramaFov?: number | null
  rotationLock?: boolean
  annotationEnabled?: boolean
  annotationPoint?: { x: number; y: number; z: number } | null
  annotationPointBim?: { x: number; y: number; z: number } | null
  annotationPointPointcloud?: { x: number; y: number; z: number } | null
  annotationPointGaussian?: { x: number; y: number; z: number } | null
  annotationPointConsistency?: { x: number; y: number; z: number } | null
  annotationStatus?: 'default' | 'editing' | 'saved'
  annotationPersist?: boolean
  annotationStashMarkers?: {
    bim: {
      key: string
      point: { x: number; y: number; z: number }
      status: 'default' | 'editing' | 'saved'
      highlighted: boolean
      synced: boolean
    }[]
    pointcloud: {
      key: string
      point: { x: number; y: number; z: number }
      status: 'default' | 'editing' | 'saved'
      highlighted: boolean
      synced: boolean
    }[]
    gaussian: {
      key: string
      point: { x: number; y: number; z: number }
      status: 'default' | 'editing' | 'saved'
      highlighted: boolean
      synced: boolean
    }[]
    consistencyResult: {
      key: string
      point: { x: number; y: number; z: number }
      status: 'default' | 'editing' | 'saved'
      highlighted: boolean
      synced: boolean
    }[]
  }
  annotationHighlightCurrent?: boolean
  annotationMarkersVisible?: boolean
}>()

const emit = defineEmits<{
  'gaussian-error': []
  'gaussian-loaded-change': [boolean]
  'bim-loaded-change': [boolean]
  'pointcloud-loaded-change': [boolean]
  'consistency-result-loaded-change': [boolean]
  'consistency-result-ready-state-change': [
    'pending' | 'loaded' | 'optional' | 'error',
  ]
  'pointcloud-world-ready': []
  'bim-rot-change': [{ lon: number; lat: number }]
  'pointcloud-rot-change': [{ lon: number; lat: number }]
  'gaussian-rot-change': [{ lon: number; lat: number }]
  'image-info-change': [any | null]
  'panorama-rot-change': [{ lon: number; lat: number }]
  'panorama-fov-change': [number]
  'visible-change': [TimeRange]
  'segment-click': [Segment]
  'annotation-pick': [
    {
      point: { x: number; y: number; z: number } | null
      screen: { x: number; y: number } | null
      source: 'bim' | 'pointcloud' | 'gaussian' | 'consistencyResult'
      key?: string
      synced?: boolean
      componentId?: string
      componentInfo?: {
        id?: string | number
        name?: string
        type?: string
      } | null
    },
  ]
}>()

const bimRef = ref<InstanceType<typeof BimViewer> | null>(null)
const pointcloudRef = ref<InstanceType<typeof PointCloudViewer> | null>(null)
const panoramaRef = ref<InstanceType<typeof PanoramaViewPanel> | null>(null)
const gaussianRef = ref<InstanceType<typeof GaussianViewerSimple> | null>(null)
const consistencyResultRef = ref<InstanceType<
  typeof ConsistencyResultViewer
> | null>(null)
const consistencyCameraPose = ref<ViewerCameraPose | null>(null)
const setBimRef = (el: InstanceType<typeof BimViewer> | null) => {
  bimRef.value = el
}
const setPointcloudRef = (el: InstanceType<typeof PointCloudViewer> | null) => {
  pointcloudRef.value = el
}
const setPanoramaRef = (el: InstanceType<typeof PanoramaViewPanel> | null) => {
  panoramaRef.value = el
}
const setGaussianRef = (
  el: InstanceType<typeof GaussianViewerSimple> | null,
) => {
  gaussianRef.value = el
}
const setConsistencyResultRef = (
  el: InstanceType<typeof ConsistencyResultViewer> | null,
) => {
  consistencyResultRef.value = el
}

// 高斯查看器重新加载键值
const gaussianViewerKey = ref(0)
let gaussianRetryTimer: number | null = null

const isPresetMode = computed(() => Boolean(props.isPresetMode))
const projectId = computed(() => props.projectId ?? null)
const scanFileId = computed(() => props.scanFileId ?? null)
const bimFileId = computed(() => props.bimFileId ?? null)
const gaussFileId = computed(() => props.gaussFileId ?? null)
const gaussAssetPath = computed(() => props.gaussAssetPath ?? 'meta.lcc')
const currentImageInfo = computed(() => props.currentImageInfo ?? null)
const panoramaCameraRot = computed(
  () => props.panoramaCameraRot ?? { lon: 0, lat: 0 },
)
const panoramaFov = computed(() => props.panoramaFov ?? null)
const rotationLock = computed(() => Boolean(props.rotationLock))
const annotationEnabled = computed(() => Boolean(props.annotationEnabled))
const annotationPointBim = computed(
  () => props.annotationPointBim ?? props.annotationPoint ?? null,
)
const annotationPointPointcloud = computed(
  () => props.annotationPointPointcloud ?? props.annotationPoint ?? null,
)
const annotationPointGaussian = computed(
  () => props.annotationPointGaussian ?? props.annotationPoint ?? null,
)
const annotationPointConsistency = computed(
  () => props.annotationPointConsistency ?? props.annotationPoint ?? null,
)
const annotationStashMarkers = computed(
  () =>
    props.annotationStashMarkers ?? {
      bim: [],
      pointcloud: [],
      gaussian: [],
      consistencyResult: [],
    },
)
const annotationHighlightCurrent = computed(() =>
  Boolean(props.annotationHighlightCurrent),
)
const annotationMarkersVisible = computed(
  () => props.annotationMarkersVisible !== false,
)

// 获取可见的面板
const visiblePanels = computed(() => {
  const panels: Panel[] = []

  switch (props.layoutMode) {
    case 'single':
      if (props.panelContents.panel1) {
        panels.push({
          id: 'panel1',
          content: props.panelContents.panel1 as Panel['content'],
        })
      }
      break
    case 'double-horizontal':
    case 'double-vertical':
      for (let i = 1; i <= 2; i++) {
        const key = `panel${i}`
        if (props.panelContents[key]) {
          panels.push({
            id: key,
            content: props.panelContents[key] as Panel['content'],
          })
        }
      }
      break
    case 'triple-left':
    case 'triple-right':
      for (let i = 1; i <= 3; i++) {
        const key = `panel${i}`
        if (props.panelContents[key]) {
          panels.push({
            id: key,
            content: props.panelContents[key] as Panel['content'],
          })
        }
      }
      break
    case 'quad':
    default:
      for (let i = 1; i <= 4; i++) {
        const key = `panel${i}`
        if (props.panelContents[key]) {
          panels.push({
            id: key,
            content: props.panelContents[key] as Panel['content'],
          })
        }
      }
      break
  }

  return panels
})

// 获取面板样式类
const getPanelClass = (index: number, totalPanels: number) => {
  if (totalPanels === 1) {
    return 'single-panel'
  } else if (totalPanels === 2) {
    return props.layoutMode === 'double-horizontal'
      ? index === 0
        ? 'left-panel'
        : 'right-panel'
      : index === 0
        ? 'top-panel'
        : 'bottom-panel'
  } else if (totalPanels === 3) {
    if (props.layoutMode === 'triple-left') {
      return index === 0
        ? 'large-left'
        : index === 1
          ? 'small-right-top'
          : 'small-right-bottom'
    } else {
      return index === 2
        ? 'large-right'
        : index === 0
          ? 'small-left-top'
          : 'small-left-bottom'
    }
  } else if (totalPanels === 4) {
    const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
    return positions[index]
  }
  return ''
}

const handleGaussianError = () => {
  emit('gaussian-error')

  if (gaussianRetryTimer !== null) {
    window.clearTimeout(gaussianRetryTimer)
  }
  gaussianRetryTimer = window.setTimeout(() => {
    gaussianRetryTimer = null
    gaussianViewerKey.value++
  }, 3000)
}

const syncConsistencyCameraPoseFromBim = () => {
  const pose = bimRef.value?.getCameraPose?.()
  if (!pose) return
  consistencyCameraPose.value = {
    camera: {
      x: pose.camera.x,
      y: pose.camera.y,
      z: pose.camera.z,
    },
    target: {
      x: pose.target.x,
      y: pose.target.y,
      z: pose.target.z,
    },
  }
}

const handleGaussianLoadedChange = (value: boolean) => {
  if (value && gaussianRetryTimer !== null) {
    window.clearTimeout(gaussianRetryTimer)
    gaussianRetryTimer = null
  }
  emit('gaussian-loaded-change', value)
}

const handleBimLoadedChange = (value: boolean) => {
  emit('bim-loaded-change', value)
  if (value) {
    nextTick(() => {
      syncConsistencyCameraPoseFromBim()
    })
  }
}

const handleBimCameraChange = (value: { lon: number; lat: number }) => {
  emit('bim-rot-change', value)
  syncConsistencyCameraPoseFromBim()
}

const handlePointcloudCameraChange = (value: { lon: number; lat: number }) => {
  emit('pointcloud-rot-change', value)
}

const handleGaussianCameraChange = (value: { lon: number; lat: number }) => {
  emit('gaussian-rot-change', value)
}

const handlePointcloudLoadedChange = (value: boolean) => {
  emit('pointcloud-loaded-change', value)
}

const handleConsistencyResultLoadedChange = (value: boolean) => {
  emit('consistency-result-loaded-change', value)
}

const handleConsistencyResultReadyStateChange = (
  value: 'pending' | 'loaded' | 'optional' | 'error',
) => {
  emit('consistency-result-ready-state-change', value)
}

const handlePointcloudWorldReady = () => {
  emit('pointcloud-world-ready')
}

const handleImageInfoChange = (value: any | null) => {
  emit('image-info-change', value)
}

const handlePanoramaRotChange = (value: { lon: number; lat: number }) => {
  emit('panorama-rot-change', value)
}

const handlePanoramaFovChange = (value: number) => {
  emit('panorama-fov-change', value)
}

const handleVisibleChange = (value: TimeRange) => {
  emit('visible-change', value)
}

const handleSegmentClick = (value: Segment) => {
  emit('segment-click', value)
}

const handleAnnotationPick = (value: {
  point: { x: number; y: number; z: number } | null
  screen: { x: number; y: number } | null
  source: 'bim' | 'pointcloud' | 'gaussian' | 'consistencyResult'
  key?: string
  synced?: boolean
  componentInfo?: { id?: string | number; name?: string; type?: string } | null
}) => {
  emit('annotation-pick', value)
}

watch(
  () =>
    visiblePanels.value.some((panel) => panel.content === 'consistencyResult'),
  (visible) => {
    if (!visible) {
      emit('consistency-result-loaded-change', false)
      return
    }
    nextTick(() => {
      syncConsistencyCameraPoseFromBim()
    })
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (gaussianRetryTimer !== null) {
    window.clearTimeout(gaussianRetryTimer)
    gaussianRetryTimer = null
  }
})

defineExpose({
  getBimRef: () => bimRef.value,
  getPointcloudRef: () => pointcloudRef.value,
  getPanoramaRef: () => panoramaRef.value,
  getGaussianRef: () => gaussianRef.value,
  getConsistencyResultRef: () => consistencyResultRef.value,
})
</script>

<style scoped>
.dynamic-panel {
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  background: #1a1a1a;
}

/* 单屏布局 */
.single-panel {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
}

/* 双屏布局 */
.left-panel {
  grid-column: 1;
  grid-row: 1;
}

.right-panel {
  grid-column: 2;
  grid-row: 1;
}

.top-panel {
  grid-column: 1 / -1;
  grid-row: 1;
}

.bottom-panel {
  grid-column: 1 / -1;
  grid-row: 2;
}

/* 三屏布局 */
.large-left {
  grid-column: 1;
  grid-row: 1 / -1;
}

.small-right-top {
  grid-column: 2;
  grid-row: 1;
}

.small-right-bottom {
  grid-column: 2;
  grid-row: 2;
}

.small-left-top {
  grid-column: 1;
  grid-row: 1;
}

.small-left-bottom {
  grid-column: 1;
  grid-row: 2;
}

.large-right {
  grid-column: 2;
  grid-row: 1 / -1;
}

/* 四屏布局 */
.top-left {
  grid-column: 1;
  grid-row: 1;
}

.top-right {
  grid-column: 2;
  grid-row: 1;
}

.bottom-left {
  grid-column: 1;
  grid-row: 2;
}

.bottom-right {
  grid-column: 2;
  grid-row: 2;
}

.panel-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.panel-content > * {
  width: 100%;
  height: 100%;
}

/* 确保查看器组件全屏 */
.panel-content :deep(.gaussian-viewer) {
  width: 100%;
  height: 100%;
}

.gaussian-wait-panel {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(
      circle at top left,
      rgba(59, 130, 246, 0.16),
      transparent 34%
    ),
    linear-gradient(180deg, #0f172a 0%, #111827 100%);
  color: #e5eef7;
}

.gaussian-wait-panel__content {
  width: min(100%, 320px);
  padding: 28px 24px;
  border: 1px dashed rgba(148, 163, 184, 0.28);
  border-radius: 20px;
  background: rgba(15, 23, 42, 0.38);
  text-align: center;
  backdrop-filter: blur(8px);
}

.gaussian-wait-panel__title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
}

.gaussian-wait-panel__text {
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.6;
  color: rgba(226, 232, 240, 0.78);
}

.consistency-result-panel {
  display: flex;
  height: 100%;
  flex-direction: column;
  background:
    radial-gradient(
      circle at top left,
      rgba(34, 197, 94, 0.16),
      transparent 36%
    ),
    radial-gradient(
      circle at bottom right,
      rgba(59, 130, 246, 0.14),
      transparent 34%
    ),
    linear-gradient(180deg, #0f172a 0%, #111827 100%);
  color: #e5eef7;
}

.consistency-result-panel__header {
  display: flex;
  align-items: center;
  min-height: 52px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.72);
}

.consistency-result-panel__title {
  position: relative;
  padding-left: 12px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
}

.consistency-result-panel__title::before {
  position: absolute;
  left: 0;
  top: 1px;
  width: 4px;
  height: 14px;
  border-radius: 999px;
  background: linear-gradient(180deg, #22c55e 0%, #38bdf8 100%);
  content: '';
}

.consistency-result-panel__body {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.consistency-result-panel__empty {
  width: min(100%, 320px);
  padding: 28px 24px;
  border: 1px dashed rgba(148, 163, 184, 0.32);
  border-radius: 20px;
  background: rgba(15, 23, 42, 0.35);
  text-align: center;
  backdrop-filter: blur(8px);
}

.consistency-result-panel__empty-title {
  margin: 0 0 10px;
  font-size: 16px;
  font-weight: 600;
  color: #f8fafc;
}

.consistency-result-panel__empty-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: rgba(226, 232, 240, 0.72);
}
</style>
