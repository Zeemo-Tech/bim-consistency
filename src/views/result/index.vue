<template>
  <div ref="resultContainerEl" class="result-container">
    <ResultDataSelector
      ref="dataSelectorRef"
      v-model:form-data="formData"
      :project-list="projectList"
      :scan-files="scanFiles"
      :cad-files="cadFiles"
      :is-preset-mode="isPresetMode"
      :resolved-project-name="resolvedProjectName"
      :resolved-scan-name="resolvedScanName"
      :resolved-cad-name="resolvedCadName"
      :can-load="canLoad"
      :loading="loading"
      :sync-active="quadRotationSyncActive"
      @project-change="onProjectChange"
      @file-change="onFileChange"
      @load-data="loadData"
      @reload-preset="reloadPreset"
      @toggle-sync="handleQuadLinkClick"
    />

    <!-- 图纸轨迹小窗口（可拖动，默认右上角展示） -->
    <div
      ref="miniMapEl"
      class="mini-map-float"
      :class="{ 'is-dragging': isMiniMapDragging }"
      :style="miniMapStyle"
      @pointerdown="onMiniMapPointerDown"
    >
      <SmallWindow
        ref="smallWindowRef"
        title="图纸轨迹"
        empty-text="加载后显示"
        :dxf-blob-url="dxfBlobUrl"
        :trajectory-data="trajectoryData"
        :alignment="alignment"
        @point-click="onTrajectoryPointClick"
      />
    </div>

    <!-- 主内容区：四分屏布局 -->
    <div class="main-content">
      <PanoramaViewPanel
        ref="panoramaRef"
        :project-id="formData.projectId"
        :scan-file-id="formData.scanFileId"
        @image-info-change="onImageInfoChange"
        @panorama-rot-change="onPanoramaRotChange"
      />

      <GaussianViewPanel
        ref="gaussianRef"
        :project-id="resolvedGaussProjectId"
        :gauss-file-id="resolvedGaussId"
        :gauss-asset-path="resolvedGaussAssetPath"
        :current-trajectory-point="lastTrajectoryPoint"
        :current-image-info="currentImageInfo"
        @loaded-change="onGaussianLoadedChange"
        @camera-change="onGaussianRotChange"
        @error="handleGaussianError"
      />

      <BimViewPanel
        ref="bimRef"
        :is-preset-mode="isPresetMode"
        :calibration="bimPointcloudCalibration"
        :pointcloud-world-matrix="pointcloudWorldMatrix"
        :current-trajectory-point="lastTrajectoryPoint"
        @loaded-change="onBimLoadedChange"
        @camera-change="onBimRotChange"
      />

      <PointcloudViewPanel
        ref="pointcloudRef"
        :is-preset-mode="isPresetMode"
        :apply-tileset-transform="true"
        :auto-fit-on-load="false"
        :current-trajectory-point="lastTrajectoryPoint"
        @loaded-change="onPointcloudLoadedChange"
        @world-ready="onPointcloudWorldReady"
        @camera-change="onPointcloudRotChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  onMounted,
  onActivated,
  onDeactivated,
  onBeforeUnmount,
  computed,
  watch,
  nextTick,
} from 'vue'
import { ElMessage } from 'element-plus'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import {
  getScanPreview,
  getDxfFile,
  getLatestAlignment,
  getBimAlignment,
  type ModelAlignment,
  type PreviewInfo,
  type TrajectoryInfo,
  type AlignmentResult,
  type TrajectoryPoint,
} from '@/api/calibration'
import { getScanCalibration } from '@/api/scan'
import * as THREE from 'three'
import { getProjectFiles, type ProjectFileInfo } from '@/api/fileManage'
import SmallWindow from '@/components/SmallWindow/index.vue'
import ResultDataSelector from './components/ResultDataSelector.vue'
import { buildGaussianTrajectoryYUpPose } from '../twoScreen/utils/fusionTransforms'
import GaussianViewPanel from './components/GaussianViewPanel.vue'
import PanoramaViewPanel from './components/PanoramaViewPanel.vue'
import BimViewPanel from './components/BimViewerHeaderPanel.vue'
import PointcloudViewPanel from './components/PointcloudViewerHeaderPanel.vue'

let destroyed = false

const HISTORY_MODEL_RELOAD_KEY = 'history-model:reload-once'

const route = useRoute()

const getQueryString = (key: string): string => {
  const value = route.query[key]
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

const getQueryNumber = (key: string): number | null => {
  const raw = getQueryString(key)
  if (!raw) return null
  const num = Number(raw)
  if (!Number.isFinite(num) || num <= 0) return null
  return num
}

const formData = ref({
  projectId: null as number | null,
  scanFileId: null as number | null,
  cadFileId: null as number | null,
})

const loading = ref(false)
const statusText = ref('')

const projectList = ref<
  Array<{ projectId: number; projectName: string; types: any[] }>
>([])
const scanFiles = ref<ProjectFileInfo[]>([])
const cadFiles = ref<ProjectFileInfo[]>([])

interface BimPointcloudCalibration {
  projectId: number
  scanFileId: number
  bimFileId?: number
  modelMatrix: number[]
  timestamp?: number
}

const toBimPointcloudCalibration = (
  projectId: number,
  alignment: ModelAlignment,
): BimPointcloudCalibration => {
  const rawMatrix = new THREE.Matrix4()
  if (
    Array.isArray(alignment.modelMatrix) &&
    alignment.modelMatrix.length === 16
  ) {
    rawMatrix.fromArray(alignment.modelMatrix)
  } else {
    throw new Error('BIM对齐结果缺少 modelMatrix')
  }

  return {
    projectId,
    scanFileId: alignment.modelScanFileId,
    bimFileId: alignment.modelBimFileId,
    modelMatrix: rawMatrix.toArray(),
  }
}

const bimPointcloudCalibration = ref<BimPointcloudCalibration | null>(null)
const pointcloudWorldMatrix = ref<number[] | null>(null)
const lastTrajectoryPoint = ref<TrajectoryPoint | null>(null)
const gaussianSharedPoseSyncEnabled = true
const trajectoryPointSyncEnabled = true
const gaussianTrajectorySyncDurationMs = 1800
const warnedMissingCalibration = ref(false)
let lastRelativeTransformLogKey = ''
let gaussianTrajectorySyncAnimationId = 0
const panoramaCameraRot = ref({ lon: 0, lat: 0 })
const quadRotationSyncActive = ref(false)
type QuadSyncSource = 'panorama' | 'bim' | 'pointcloud' | 'gaussian'
const quadSyncBaseRotations: Record<
  QuadSyncSource,
  { lon: number; lat: number } | null
> = {
  panorama: null,
  bim: null,
  pointcloud: null,
  gaussian: null,
}
const lastQuadBroadcastRotations: Record<
  QuadSyncSource,
  { lon: number; lat: number } | null
> = {
  panorama: null,
  bim: null,
  pointcloud: null,
  gaussian: null,
}
let applyingQuadRotationSync = false
let suppressQuadRotationBroadcastUntil = 0

const presetProjectId = computed(() => getQueryNumber('projectId'))
const presetScanId = computed(() => getQueryNumber('scanId'))
const presetCadId = computed(() => getQueryNumber('cadId'))
const presetBimId = computed(() => getQueryNumber('bimId'))
const presetGaussId = computed(() => getQueryNumber('gaussId'))

const isPresetMode = computed(() => {
  return Boolean(
    presetProjectId.value && presetScanId.value && presetCadId.value,
  )
})

const presetProjectName = computed(() => getQueryString('projectName') || '')
const presetScanName = computed(() => {
  return (
    getQueryString('scanName') ||
    getQueryString('title') ||
    getQueryString('pointCloudName') ||
    ''
  )
})
const presetCadName = computed(() => getQueryString('cadName') || '')
const presetBimName = computed(() => getQueryString('bimName') || '')
const resolvedGaussAssetPath = computed(() => {
  const raw = getQueryString('gaussAssetPath')
  const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '').trim()
  return normalized || 'meta.lcc'
})

const findProject = (projectId: number | null) => {
  if (!projectId) return null
  return (
    projectList.value.find((project) => project.projectId === projectId) || null
  )
}

const findProjectFileName = (
  projectId: number | null,
  type: 'scan' | 'cad' | 'bim' | 'gauss',
  fileId: number | null,
) => {
  if (!projectId || !fileId) return ''
  const project = findProject(projectId)
  const files = project?.types?.find((t) => t.type === type)?.files || []
  const match = files.find(
    (file: ProjectFileInfo) => Number(file.id) === fileId,
  )
  return match?.originalName || ''
}

const resolvedProjectName = computed(() => {
  if (presetProjectName.value) return presetProjectName.value
  return findProject(presetProjectId.value)?.projectName || ''
})

const resolvedScanName = computed(() => {
  if (presetScanName.value) return presetScanName.value
  return findProjectFileName(presetProjectId.value, 'scan', presetScanId.value)
})

const resolvedCadName = computed(() => {
  if (presetCadName.value) return presetCadName.value
  return findProjectFileName(presetProjectId.value, 'cad', presetCadId.value)
})

const boundBimFileId = ref<number | null>(null)
const boundGaussFileId = ref<number | null>(null)

const resolvedBimId = computed(() => {
  if (boundBimFileId.value) return boundBimFileId.value
  if (presetBimId.value) return presetBimId.value
  const project = findProject(presetProjectId.value)
  const files = project?.types?.find((t) => t.type === 'bim')?.files || []
  const fallback = files[0]
  const fallbackId = fallback?.id ?? null
  return typeof fallbackId === 'number'
    ? fallbackId
    : Number(fallbackId || 0) || null
})

const resolvedBimName = computed(() => {
  if (presetBimName.value) return presetBimName.value
  return findProjectFileName(presetProjectId.value, 'bim', resolvedBimId.value)
})

const resolvedGaussProjectId = computed(
  () => presetProjectId.value ?? formData.value.projectId,
)

const resolvedGaussId = computed(() => {
  if (boundGaussFileId.value) return boundGaussFileId.value
  if (presetScanId.value || formData.value.scanFileId) return null
  if (presetGaussId.value) return presetGaussId.value
  const project = findProject(resolvedGaussProjectId.value)
  const files = project?.types?.find((t) => t.type === 'gauss')?.files || []
  const fallback = files[0]
  const fallbackId = fallback?.id ?? null
  return typeof fallbackId === 'number'
    ? fallbackId
    : Number(fallbackId || 0) || null
})

const logResultGaussianSelection = (label: string) => {
  console.info(`[Result][Gaussian] ${label}`, {
    presetProjectId: presetProjectId.value,
    formProjectId: formData.value.projectId,
    resolvedGaussProjectId: resolvedGaussProjectId.value,
    presetScanId: presetScanId.value,
    formScanFileId: formData.value.scanFileId,
    presetGaussId: presetGaussId.value,
    boundGaussFileId: boundGaussFileId.value,
    resolvedGaussId: resolvedGaussId.value,
    resolvedGaussAssetPath: resolvedGaussAssetPath.value,
  })
}

const loadBimPointcloudCalibration = async () => {
  const projectId = presetProjectId.value ?? formData.value.projectId
  const scanId = presetScanId.value ?? formData.value.scanFileId
  if (!projectId || !scanId) {
    bimPointcloudCalibration.value = null
    boundBimFileId.value = null
    boundGaussFileId.value = null
    return
  }

  try {
    const calibrationRes = await getScanCalibration(projectId, scanId)
    if (calibrationRes.code !== 200) {
      throw new Error(calibrationRes.msg || '获取扫描校准绑定失败')
    }

    boundBimFileId.value = calibrationRes.data?.bimFileId ?? null
    boundGaussFileId.value = calibrationRes.data?.hasGaussBinding
      ? (calibrationRes.data?.gaussFileId ?? null)
      : null
    console.info('[Result][Gaussian] scan calibration loaded', {
      projectId,
      scanId,
      hasGaussBinding: calibrationRes.data?.hasGaussBinding ?? false,
      gaussFileId: calibrationRes.data?.gaussFileId ?? null,
      boundGaussFileId: boundGaussFileId.value,
    })
    const bimId = boundBimFileId.value
    if (!bimId) {
      bimPointcloudCalibration.value = null
      return
    }

    const alignmentRes = await getBimAlignment(projectId, scanId, bimId)
    if (alignmentRes.code !== 200) {
      throw new Error(alignmentRes.msg || '获取BIM对齐结果失败')
    }

    bimPointcloudCalibration.value = toBimPointcloudCalibration(
      projectId,
      alignmentRes.data,
    )
  } catch (error) {
    console.warn('[Result] 获取BIM/点云对齐失败:', error)
    bimPointcloudCalibration.value = null
    boundBimFileId.value = null
    boundGaussFileId.value = null
  }
}

const previewData = ref<PreviewInfo | null>(null)
const trajectoryData = ref<TrajectoryInfo | null>(null)
const canLoad = computed(() => {
  return Boolean(
    formData.value.projectId &&
      formData.value.scanFileId &&
      formData.value.cadFileId,
  )
})

const alignment = ref<AlignmentResult | null>(null)
const currentImageInfo = ref<any>(null)
const bimModelLoaded = ref(false)
const gaussianModelLoaded = ref(false)
const pointcloudLoaded = ref(false)

const gaussianRef = ref<InstanceType<typeof GaussianViewPanel> | null>(null)
const panoramaRef = ref<InstanceType<typeof PanoramaViewPanel> | null>(null)
const dataSelectorRef = ref<InstanceType<typeof ResultDataSelector> | null>(
  null,
)
const bimRef = ref<InstanceType<typeof BimViewPanel> | null>(null)
const pointcloudRef = ref<InstanceType<typeof PointcloudViewPanel> | null>(null)

const resultContainerEl = ref<HTMLDivElement | null>(null)
const miniMapEl = ref<HTMLDivElement | null>(null)
const smallWindowRef = ref()

const dxfBlobUrl = ref<string | null>(null)

const miniMapPos = ref({ x: 0, y: 0 })
const isMiniMapDragging = ref(false)
const miniMapDragOffset = ref({ x: 0, y: 0 })

const miniMapStyle = computed(() => {
  return {
    left: `${miniMapPos.value.x}px`,
    top: `${miniMapPos.value.y}px`,
  }
})

const clampMiniMapPosition = () => {
  if (!resultContainerEl.value || !miniMapEl.value) return
  const containerW = resultContainerEl.value.clientWidth || 1
  const containerH = resultContainerEl.value.clientHeight || 1
  const mapW = miniMapEl.value.offsetWidth || 1
  const mapH = miniMapEl.value.offsetHeight || 1

  miniMapPos.value.x = Math.min(
    Math.max(0, miniMapPos.value.x),
    Math.max(0, containerW - mapW),
  )
  miniMapPos.value.y = Math.min(
    Math.max(0, miniMapPos.value.y),
    Math.max(0, containerH - mapH),
  )
}

const setMiniMapDefaultPosition = () => {
  if (!resultContainerEl.value || !miniMapEl.value) return
  const margin = 12
  const containerW = resultContainerEl.value.clientWidth || 1
  const mapW = miniMapEl.value.offsetWidth || 1
  const topOffset = dataSelectorRef.value?.getEl()?.offsetHeight ?? 0

  miniMapPos.value = {
    x: Math.max(margin, containerW - mapW - margin),
    y: topOffset + margin,
  }
  clampMiniMapPosition()
}

const onMiniMapPointerDown = (event: PointerEvent) => {
  if (!resultContainerEl.value || !miniMapEl.value) return
  if (event.button !== 0) return

  const target = event.target as HTMLElement | null
  if (!target?.closest('.small-window-header')) return
  if (target.closest('button, .el-button, .header-actions')) return

  const containerRect = resultContainerEl.value.getBoundingClientRect()
  isMiniMapDragging.value = true
  miniMapDragOffset.value = {
    x: event.clientX - containerRect.left - miniMapPos.value.x,
    y: event.clientY - containerRect.top - miniMapPos.value.y,
  }
  ;(event.currentTarget as HTMLElement)?.setPointerCapture?.(event.pointerId)

  const onMove = (e: PointerEvent) => {
    if (!isMiniMapDragging.value || !resultContainerEl.value) return
    e.preventDefault()
    const rect = resultContainerEl.value.getBoundingClientRect()
    miniMapPos.value = {
      x: e.clientX - rect.left - miniMapDragOffset.value.x,
      y: e.clientY - rect.top - miniMapDragOffset.value.y,
    }
    clampMiniMapPosition()
  }

  const onUp = () => {
    isMiniMapDragging.value = false
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }

  window.addEventListener('pointermove', onMove, { passive: false })
  window.addEventListener('pointerup', onUp)
}

const loadProjects = async () => {
  try {
    const res = await getProjectFiles({ page: 1, pageSize: 100 })
    if (res.code === 200) {
      projectList.value = res.data.list
    }
  } catch (error) {
    console.error('加载项目列表失败:', error)
    ElMessage.error('加载项目列表失败')
  }
}

const onProjectChange = (projectId: number | null) => {
  const project = projectList.value.find((p) => p.projectId === projectId)
  if (!project) return

  scanFiles.value = project.types.find((t) => t.type === 'scan')?.files || []
  cadFiles.value = project.types.find((t) => t.type === 'cad')?.files || []

  if (scanFiles.value.length > 0) {
    formData.value.scanFileId = scanFiles.value[0].id
  } else {
    formData.value.scanFileId = null
  }

  if (cadFiles.value.length > 0) {
    formData.value.cadFileId = cadFiles.value[0].id
  } else {
    formData.value.cadFileId = null
  }

  clearDisplay()
}

const onFileChange = () => {
  clearDisplay()
}

const clearDisplay = () => {
  resetScanState()

  if (smallWindowRef.value) {
    smallWindowRef.value.clearHighlight()
  }

  panoramaRef.value?.clearImage()

  statusText.value = ''
}

const resetScanState = () => {
  previewData.value = null
  trajectoryData.value = null
  alignment.value = null
  currentImageInfo.value = null
  panoramaCameraRot.value = { lon: 0, lat: 0 }
  lastTrajectoryPoint.value = null
  lastRelativeTransformLogKey = ''
  warnedMissingCalibration.value = false
  bimPointcloudCalibration.value = null
  pointcloudWorldMatrix.value = null
  bimModelLoaded.value = false
  gaussianModelLoaded.value = false
  pointcloudLoaded.value = false
  boundBimFileId.value = null
  boundGaussFileId.value = null
  if (dxfBlobUrl.value) {
    URL.revokeObjectURL(dxfBlobUrl.value)
    dxfBlobUrl.value = null
  }
  stopGaussianTrajectoryPoseSync()
}

const ensureCadBinding = async () => {
  if (
    !formData.value.projectId ||
    !formData.value.scanFileId ||
    formData.value.cadFileId
  )
    return
  try {
    const res = await getScanCalibration(
      formData.value.projectId,
      formData.value.scanFileId,
    )
    if (res.code === 200 && res.data?.cadFileId) {
      formData.value.cadFileId = res.data.cadFileId
    }
  } catch (error) {
    console.warn('获取扫描绑定 CAD 失败:', error)
  }
}

const loadData = async () => {
  await ensureCadBinding()
  if (!canLoad.value) {
    ElMessage.warning('请选择项目、扫描文件和CAD文件')
    return
  }

  try {
    loading.value = true
    statusText.value = '加载中...'
    resetScanState()

    await loadDxf()
    await loadBimPointcloudCalibration()
    await loadLatestAlignmentData()
    await loadPreview()

    statusText.value = '加载完成'
    ElMessage.success('校准结果加载完成')

    await nextTick()
    await loadPointcloudModel()
    await loadBimModel()
    await loadGaussianModel()
    await ensureInitialTrajectoryView()
  } catch (error: any) {
    console.error('加载失败:', error)
    statusText.value = error?.message || '加载失败'
    ElMessage.error(error?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

let lastPresetKey = ''
const applyPresetFromRoute = async (force = false) => {
  if (!isPresetMode.value) return

  const key = [
    presetProjectId.value,
    presetScanId.value,
    presetCadId.value,
    resolvedBimId.value,
    resolvedGaussId.value,
    resolvedGaussAssetPath.value,
  ].join('|')
  if (!force && key === lastPresetKey) return
  lastPresetKey = key

  formData.value.projectId = presetProjectId.value
  formData.value.scanFileId = presetScanId.value
  formData.value.cadFileId = presetCadId.value

  clearDisplay()

  bimRef.value?.setStatusText(
    resolvedBimId.value ? '自动加载BIM中...' : '未选择BIM模型',
  )
  pointcloudRef.value?.setStatusText(
    resolvedScanName.value ? '自动加载点云中...' : '未选择点云文件',
  )

  await loadData()
}

const reloadPreset = () => {
  void applyPresetFromRoute(true)
}

const loadDxf = async () => {
  if (destroyed) return

  statusText.value = '加载CAD图纸...'

  try {
    const res = await getDxfFile(
      formData.value.projectId!,
      formData.value.cadFileId!,
    )

    if (destroyed) return

    if (res.code !== 200 || !res.data?.content) {
      throw new Error(res.msg || '加载DXF失败')
    }

    const blobUrl = URL.createObjectURL(
      new Blob([res.data.content], { type: 'application/dxf' }),
    )

    if (dxfBlobUrl.value) {
      URL.revokeObjectURL(dxfBlobUrl.value)
    }
    dxfBlobUrl.value = blobUrl
    statusText.value = 'CAD图纸已加载'
  } catch (error: any) {
    console.error('DXF加载失败:', error)
    statusText.value = error?.message || 'DXF加载失败'
    throw error
  }
}

const loadPreview = async () => {
  if (destroyed) return

  const res = await getScanPreview(
    formData.value.projectId!,
    formData.value.scanFileId!,
    { size: 1024 },
  )

  if (destroyed) return

  if (res.code !== 200 || !res.data?.preview?.pngBase64) {
    console.error('加载预览失败:', res)
    throw new Error(res.msg || '加载预览失败')
  }

  previewData.value = res.data.preview
  trajectoryData.value = res.data.trajectory
}

const loadLatestAlignmentData = async () => {
  if (destroyed) return

  try {
    const res = await getLatestAlignment(
      formData.value.projectId!,
      formData.value.scanFileId!,
      formData.value.cadFileId!,
    )

    if (res.code === 200) {
      alignment.value = res.data
      return
    }

    throw new Error(res.msg || '获取对齐数据失败')
  } catch (error) {
    console.error('加载对齐数据失败:', error)
    throw new Error('加载对齐数据失败')
  }
}

const onImageInfoChange = (info: any | null) => {
  currentImageInfo.value = info
}

const clampLat = (lat: number) => Math.max(-85, Math.min(85, lat))

const normalizeQuadLon = (lon: number) => {
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180
  return Object.is(wrapped, -0) ? 0 : wrapped
}

const normalizeQuadRotation = (rot: { lon: number; lat: number }) => ({
  lon: Number(normalizeQuadLon(rot.lon).toFixed(6)),
  lat: Number(clampLat(rot.lat).toFixed(6)),
})

const isSameQuadRotation = (
  a: { lon: number; lat: number } | null | undefined,
  b: { lon: number; lat: number } | null | undefined,
  epsilon = 1e-6,
) => {
  if (!a || !b) return false
  return (
    Math.abs(a.lon - b.lon) <= epsilon && Math.abs(a.lat - b.lat) <= epsilon
  )
}

const shouldIgnoreDuplicateQuadRotation = (
  source: QuadSyncSource,
  rot: { lon: number; lat: number },
) => {
  const normalizedRot = normalizeQuadRotation(rot)
  if (!isSameQuadRotation(lastQuadBroadcastRotations[source], normalizedRot)) {
    return false
  }
  return true
}

const getCurrentQuadRotation = (source: QuadSyncSource) => {
  if (source === 'panorama') {
    return normalizeQuadRotation(panoramaCameraRot.value)
  }
  if (source === 'bim') {
    const rot = bimRef.value?.getCameraOrientation?.()
    return rot ? normalizeQuadRotation(rot) : null
  }
  if (source === 'pointcloud') {
    const rot = pointcloudRef.value?.getCameraOrientation?.()
    return rot ? normalizeQuadRotation(rot) : null
  }
  const rot = gaussianRef.value?.getCameraOrientation?.()
  return rot ? normalizeQuadRotation(rot) : null
}

const clearQuadRotationSyncState = () => {
  ;(['panorama', 'bim', 'pointcloud', 'gaussian'] as QuadSyncSource[]).forEach(
    (source) => {
      quadSyncBaseRotations[source] = null
      lastQuadBroadcastRotations[source] = null
    },
  )
}

const captureQuadRotationBases = () => {
  ;(['panorama', 'bim', 'pointcloud', 'gaussian'] as QuadSyncSource[]).forEach(
    (source) => {
      quadSyncBaseRotations[source] = getCurrentQuadRotation(source)
      lastQuadBroadcastRotations[source] = quadSyncBaseRotations[source]
    },
  )
}

const buildQuadTargetRotation = (
  source: QuadSyncSource,
  target: QuadSyncSource,
  sourceRot: { lon: number; lat: number },
) => {
  const normalizedSourceRot = normalizeQuadRotation(sourceRot)
  const sourceBase = quadSyncBaseRotations[source]
  const targetBase = quadSyncBaseRotations[target]
  if (!sourceBase || !targetBase) return normalizedSourceRot

  const deltaLon = normalizeQuadLon(normalizedSourceRot.lon - sourceBase.lon)
  const deltaLat = normalizedSourceRot.lat - sourceBase.lat

  return normalizeQuadRotation({
    lon: targetBase.lon + deltaLon,
    lat: targetBase.lat + deltaLat,
  })
}

const syncQuadRotationAcrossViews = (
  rot: { lon: number; lat: number } | null | undefined,
  source: QuadSyncSource | null = null,
) => {
  if (!quadRotationSyncActive.value || !rot) return
  const targetRot = {
    lon: rot.lon,
    lat: clampLat(rot.lat),
  }
  const normalizedSourceRot = normalizeQuadRotation(targetRot)
  if (
    source &&
    isSameQuadRotation(lastQuadBroadcastRotations[source], normalizedSourceRot)
  ) {
    return
  }
  if (source) {
    if (!quadSyncBaseRotations[source]) {
      captureQuadRotationBases()
    }
    lastQuadBroadcastRotations[source] = normalizedSourceRot
  }

  const panoramaTargetRot = source
    ? buildQuadTargetRotation(source, 'panorama', normalizedSourceRot)
    : normalizedSourceRot
  const bimTargetRot = source
    ? buildQuadTargetRotation(source, 'bim', normalizedSourceRot)
    : normalizedSourceRot
  const pointcloudTargetRot = source
    ? buildQuadTargetRotation(source, 'pointcloud', normalizedSourceRot)
    : normalizedSourceRot
  const gaussianTargetRot = source
    ? buildQuadTargetRotation(source, 'gaussian', normalizedSourceRot)
    : normalizedSourceRot

  panoramaCameraRot.value =
    source === 'panorama'
      ? { ...normalizedSourceRot }
      : { ...panoramaTargetRot }

  applyingQuadRotationSync = true
  try {
    if (source !== 'panorama') {
      panoramaRef.value?.syncFromRotation?.(panoramaTargetRot)
    }
    if (source !== 'bim') {
      bimRef.value?.syncFromPanoramaRotation?.(bimTargetRot)
    }
    if (source !== 'pointcloud') {
      pointcloudRef.value?.syncFromPanoramaRotation?.(pointcloudTargetRot)
    }
    if (source !== 'gaussian') {
      gaussianRef.value?.syncFromPanoramaRotation?.(gaussianTargetRot)
    }
  } finally {
    applyingQuadRotationSync = false
  }
}

const handleQuadLinkClick = () => {
  quadRotationSyncActive.value = !quadRotationSyncActive.value
  if (quadRotationSyncActive.value) {
    captureQuadRotationBases()
    return
  }
  clearQuadRotationSyncState()
}

const handleViewerMoveKeydown = (event: KeyboardEvent) => {
  if (!quadRotationSyncActive.value) return
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement
  ) {
    return
  }
  const key = event.key.toLowerCase()
  if (!['w', 'a', 's', 'd'].includes(key)) return
  event.preventDefault()
  event.stopImmediatePropagation()
}

const onPanoramaRotChange = (rot: { lon: number; lat: number }) => {
  panoramaCameraRot.value = { ...rot }
  if (!quadRotationSyncActive.value) return
  if (applyingQuadRotationSync) return
  if (performance.now() < suppressQuadRotationBroadcastUntil) return
  if (shouldIgnoreDuplicateQuadRotation('panorama', rot)) return
  syncQuadRotationAcrossViews(rot, 'panorama')
}

const onBimRotChange = (rot: { lon: number; lat: number }) => {
  if (!quadRotationSyncActive.value) return
  if (applyingQuadRotationSync) return
  if (performance.now() < suppressQuadRotationBroadcastUntil) return
  if (shouldIgnoreDuplicateQuadRotation('bim', rot)) return
  syncQuadRotationAcrossViews(rot, 'bim')
}

const onPointcloudRotChange = (rot: { lon: number; lat: number }) => {
  if (!quadRotationSyncActive.value) return
  if (applyingQuadRotationSync) return
  if (performance.now() < suppressQuadRotationBroadcastUntil) return
  if (shouldIgnoreDuplicateQuadRotation('pointcloud', rot)) return
  syncQuadRotationAcrossViews(rot, 'pointcloud')
}

const onGaussianRotChange = (rot: { lon: number; lat: number }) => {
  if (!quadRotationSyncActive.value) return
  if (applyingQuadRotationSync) return
  if (performance.now() < suppressQuadRotationBroadcastUntil) return
  if (shouldIgnoreDuplicateQuadRotation('gaussian', rot)) return
  syncQuadRotationAcrossViews(rot, 'gaussian')
}

const onBimLoadedChange = (loaded: boolean) => {
  bimModelLoaded.value = loaded
  if (loaded && gaussianModelLoaded.value) {
    syncSharedPoseFromGaussian()
    if (trajectoryPointSyncEnabled && lastTrajectoryPoint.value?.imageName) {
      requestAnimationFrame(() => {
        syncSharedPoseFromGaussian()
      })
    }
  }
}

const onGaussianLoadedChange = (loaded: boolean) => {
  gaussianModelLoaded.value = loaded
  if (loaded) {
    if (trajectoryPointSyncEnabled && lastTrajectoryPoint.value?.imageName) {
      startGaussianTrajectoryPoseSync()
    } else {
      syncSharedPoseFromGaussian()
    }
  }
}

const handleGaussianError = () => {
  gaussianModelLoaded.value = false
}

const onPointcloudLoadedChange = (loaded: boolean) => {
  pointcloudLoaded.value = loaded
  if (!loaded) {
    pointcloudWorldMatrix.value = null
    return
  }
  if (gaussianModelLoaded.value) {
    requestAnimationFrame(() => {
      syncSharedPoseFromGaussian()
    })
  }
}

const onPointcloudWorldReady = () => {
  refreshPointcloudWorldMatrix()
  requestAnimationFrame(() => {
    syncSharedPoseFromGaussian()
  })
}

const getDefaultTrajectoryPoint = () => {
  const points = trajectoryData.value?.points ?? []
  return points.find((point) => Boolean(point?.imageName)) ?? null
}

const isComponentConnected = (comp: any) =>
  Boolean(comp?.$el && comp.$el.isConnected)

const syncSharedPoseFromGaussian = () => {
  if (!gaussianSharedPoseSyncEnabled) return
  const pose = gaussianRef.value?.getCameraPose?.()
  if (!pose) return
  if (pointcloudLoaded.value) {
    pointcloudRef.value?.syncFromExternalPose?.(pose)
  }
  if (bimModelLoaded.value) {
    bimRef.value?.setCameraPose?.(pose)
  }
}

const syncSharedPoseFromTrajectoryPoint = (
  point: TrajectoryPoint | null | undefined,
) => {
  if (!point) return

  const gaussianPose = gaussianRef.value?.getCameraPose?.() ?? null
  const pose =
    gaussianPose ??
    buildGaussianTrajectoryYUpPose(point)

  if (pointcloudLoaded.value) {
    pointcloudRef.value?.syncFromExternalPose?.(pose)
  }
  if (bimModelLoaded.value) {
    bimRef.value?.setCameraPose?.(pose)
  }
}

const refreshPointcloudWorldMatrix = () => {
  const matrix = getPointcloudWorldMatrix()
  pointcloudWorldMatrix.value = matrix ? matrix.toArray() : null
}

const stopGaussianTrajectoryPoseSync = () => {
  if (!gaussianTrajectorySyncAnimationId) return
  cancelAnimationFrame(gaussianTrajectorySyncAnimationId)
  gaussianTrajectorySyncAnimationId = 0
}

const startGaussianTrajectoryPoseSync = (
  durationMs = gaussianTrajectorySyncDurationMs,
) => {
  stopGaussianTrajectoryPoseSync()
  const startAt = performance.now()

  const tick = () => {
    syncSharedPoseFromGaussian()
    if (performance.now() - startAt >= durationMs) {
      gaussianTrajectorySyncAnimationId = 0
      syncSharedPoseFromGaussian()
      return
    }
    gaussianTrajectorySyncAnimationId = requestAnimationFrame(tick)
  }

  tick()
}

const loadBimModel = async (retry = 0, requireConnected = false) => {
  const readyRef =
    bimRef.value && (!requireConnected || isComponentConnected(bimRef.value))
  if (!readyRef) {
    if (retry < 20) {
      await nextTick()
      window.setTimeout(() => {
        void loadBimModel(retry + 1, requireConnected)
      }, 80)
    }
    return
  }
  const projectId = presetProjectId.value ?? formData.value.projectId
  const bimFileId = resolvedBimId.value
  if (!projectId || !bimFileId) {
    bimRef.value?.setStatusText?.('未绑定BIM文件')
    return
  }
  bimRef.value?.setStatusText?.('自动加载BIM中...')
  await bimRef.value?.loadBimByFileId?.(
    projectId,
    bimFileId,
    resolvedBimName.value || undefined,
  )
}

const loadPointcloudModel = async (retry = 0, requireConnected = false) => {
  const readyRef =
    pointcloudRef.value &&
    (!requireConnected || isComponentConnected(pointcloudRef.value))
  if (!readyRef) {
    if (retry < 20) {
      await nextTick()
      window.setTimeout(() => {
        void loadPointcloudModel(retry + 1, requireConnected)
      }, 80)
    }
    return
  }
  const projectId = presetProjectId.value ?? formData.value.projectId
  const scanFileId = presetScanId.value ?? formData.value.scanFileId
  if (!projectId || !scanFileId) {
    pointcloudRef.value?.setStatusText?.('未选择点云文件')
    return
  }
  pointcloudRef.value?.setStatusText?.('自动加载点云中...')
  await pointcloudRef.value?.loadPointcloudByScanId?.(projectId, scanFileId)
}

const loadPanoramaImage = async (retry = 0, requireConnected = false) => {
  const readyRef =
    panoramaRef.value &&
    (!requireConnected || isComponentConnected(panoramaRef.value))
  if (!readyRef) {
    if (retry < 20) {
      await nextTick()
      window.setTimeout(() => {
        void loadPanoramaImage(retry + 1, requireConnected)
      }, 80)
    }
    return
  }

  const targetPoint = lastTrajectoryPoint.value
  if (targetPoint) {
    await panoramaRef.value?.showTrajectoryImage?.(targetPoint)
  } else {
    panoramaRef.value?.clearImage?.()
  }
}

const loadGaussianModel = async (retry = 0, requireConnected = false) => {
  const readyRef =
    gaussianRef.value &&
    (!requireConnected || isComponentConnected(gaussianRef.value))
  if (!readyRef) {
    if (retry < 20) {
      await nextTick()
      window.setTimeout(() => {
        void loadGaussianModel(retry + 1, requireConnected)
      }, 80)
    }
    return
  }
  logResultGaussianSelection('before reloadModel')
  gaussianRef.value?.reloadModel?.()
  const targetPoint = lastTrajectoryPoint.value
  if (trajectoryPointSyncEnabled && targetPoint) {
    gaussianRef.value?.syncFromTrajectory?.(targetPoint)
  }
}

watch(
  () => [
    resolvedGaussProjectId.value,
    resolvedGaussId.value,
    resolvedGaussAssetPath.value,
    boundGaussFileId.value,
    presetGaussId.value,
  ],
  () => {
    logResultGaussianSelection('selection changed')
  },
  { immediate: true },
)

const getPointcloudWorldMatrix = () => {
  return pointcloudRef.value?.getPointcloudGroupWorldMatrix?.() ?? null
}

const getBimWorldMatrix = () => {
  return bimRef.value?.getModelWorldMatrix?.() ?? null
}

const vectorToPlainObject = (vec: THREE.Vector3) => ({
  x: Number((vec.x || 0).toFixed(6)),
  y: Number((vec.y || 0).toFixed(6)),
  z: Number((vec.z || 0).toFixed(6)),
})

const quaternionToPlainObject = (quat: THREE.Quaternion) => ({
  x: Number((quat.x || 0).toFixed(6)),
  y: Number((quat.y || 0).toFixed(6)),
  z: Number((quat.z || 0).toFixed(6)),
  w: Number((quat.w || 1).toFixed(6)),
})

const logBimRelativeTransform = () => {
  const bimWorldMatrix = getBimWorldMatrix()
  const pointcloudWorldMatrix = getPointcloudWorldMatrix()
  if (!bimWorldMatrix || !pointcloudWorldMatrix) return

  const relativeMatrix = new THREE.Matrix4()
    .copy(pointcloudWorldMatrix)
    .invert()
    .multiply(bimWorldMatrix)
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  relativeMatrix.decompose(position, quaternion, new THREE.Vector3())

  const payload = {
    bimRelativePositionToPointcloud: vectorToPlainObject(position),
    bimRelativeQuaternionToPointcloud: quaternionToPlainObject(quaternion),
  }
  const key = JSON.stringify(payload)
  if (key === lastRelativeTransformLogKey) return
  lastRelativeTransformLogKey = key

  console.info('[Result] BIM相对点云变换', payload)
}

const onTrajectoryPointClick = async (point: TrajectoryPoint) => {
  if (quadRotationSyncActive.value) {
    suppressQuadRotationBroadcastUntil =
      performance.now() + gaussianTrajectorySyncDurationMs + 600
  }
  lastTrajectoryPoint.value = point
  await loadPanoramaImage()

  if (!trajectoryPointSyncEnabled) return

  gaussianRef.value?.syncFromTrajectory?.(point)

  if (!bimPointcloudCalibration.value) {
    await loadBimPointcloudCalibration()
  }

  if (gaussianRef.value) {
    startGaussianTrajectoryPoseSync()
  } else {
    syncSharedPoseFromTrajectoryPoint(point)
  }
  if (quadRotationSyncActive.value) {
    window.setTimeout(() => {
      if (!quadRotationSyncActive.value) return
      captureQuadRotationBases()
    }, gaussianTrajectorySyncDurationMs + 80)
  }
  if (!bimPointcloudCalibration.value && !warnedMissingCalibration.value) {
    warnedMissingCalibration.value = true
    ElMessage.warning(
      '未找到 BIM-点云 校准参数，请先在 BIM-点云校准页点击“保存并继续”',
    )
  }
}

const ensureInitialTrajectoryView = async () => {
  if (!trajectoryPointSyncEnabled) return
  if (lastTrajectoryPoint.value?.imageName) return
  const point = getDefaultTrajectoryPoint()
  if (!point) return

  lastTrajectoryPoint.value = point
  await loadPanoramaImage(0, true)
  if (gaussianRef.value) {
    gaussianRef.value.syncFromTrajectory?.(point)
    requestAnimationFrame(() => {
      startGaussianTrajectoryPoseSync()
    })
    return
  }
  await loadGaussianModel(0, true)
  requestAnimationFrame(() => {
    if (gaussianRef.value) {
      startGaussianTrajectoryPoseSync()
      return
    }
    syncSharedPoseFromTrajectoryPoint(point)
  })
}

const cleanup = () => {
  destroyed = true
  stopGaussianTrajectoryPoseSync()

  gaussianRef.value?.cleanup()
  panoramaRef.value?.cleanup()
  bimRef.value?.cleanup()
  pointcloudRef.value?.cleanup()

  if (dxfBlobUrl.value) {
    URL.revokeObjectURL(dxfBlobUrl.value)
    dxfBlobUrl.value = null
  }
}

onMounted(async () => {
  destroyed = false
  await loadProjects()
  await applyPresetFromRoute()

  nextTick(() => {
    setMiniMapDefaultPosition()
  })

  window.addEventListener('resize', setMiniMapDefaultPosition)
  window.addEventListener('keydown', handleViewerMoveKeydown, true)
})

onActivated(async () => {
  destroyed = false
  await applyPresetFromRoute()
})

onDeactivated(() => {
  cleanup()
  lastPresetKey = ''
})

onBeforeRouteLeave((to) => {
  const state = window.history.state as { forward?: string } | null
  const isBrowserBack = state?.forward === route.fullPath
  if (
    isBrowserBack &&
    (to.path === '/data/history-model' ||
      to.fullPath.startsWith('/data/history-model'))
  ) {
    sessionStorage.setItem(HISTORY_MODEL_RELOAD_KEY, '1')
  }
})

watch(
  () => route.fullPath,
  () => {
    void applyPresetFromRoute()
  },
)

watch([bimModelLoaded, pointcloudLoaded], () => {
  if (!trajectoryPointSyncEnabled) return
  if (!lastTrajectoryPoint.value || !bimPointcloudCalibration.value) return
  if (!bimModelLoaded.value || !pointcloudLoaded.value) return
  syncSharedPoseFromGaussian()
  logBimRelativeTransform()
})

watch([bimModelLoaded, () => bimPointcloudCalibration.value], () => {
  if (!trajectoryPointSyncEnabled) return
  if (!lastTrajectoryPoint.value || !bimPointcloudCalibration.value) return
  if (!bimModelLoaded.value) return
  syncSharedPoseFromGaussian()
  logBimRelativeTransform()
})

watch([pointcloudLoaded], () => {
  if (!trajectoryPointSyncEnabled) return
  if (!lastTrajectoryPoint.value) return
  if (!pointcloudLoaded.value) return
  syncSharedPoseFromGaussian()
  logBimRelativeTransform()
})

onBeforeUnmount(() => {
  cleanup()

  window.removeEventListener('resize', setMiniMapDefaultPosition)
  window.removeEventListener('keydown', handleViewerMoveKeydown, true)
})
</script>

<style lang="scss">
@use './index.scss';
</style>
