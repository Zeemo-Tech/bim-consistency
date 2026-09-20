<template>
  <div class="preview-container">
    <div ref="cadContainerRef" class="cad-viewer-container" />

    <!-- 加载遮罩 -->
    <div v-if="isLoading" class="loading-mask">
      <div class="loading-content">
        <div class="loading-spinner" />
        <p>{{ loadingMessage }}</p>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-else-if="errorMessage" class="error-container">
      <div class="error-content">
        <div class="error-icon">
          <el-icon :size="48"><Warning /></el-icon>
        </div>
        <h3>预览失败</h3>
        <p>{{ errorMessage }}</p>
        <el-button type="primary" @click="handleRetry">重试</el-button>
        <el-button @click="handleClose">关闭</el-button>
      </div>
    </div>

    <!-- 顶部工具栏 -->
    <div v-if="!isLoading && !errorMessage" class="top-toolbar">
      <div class="toolbar-left">
        <el-button size="small" :icon="ArrowLeft" @click="handleClose">
          返回
        </el-button>
        <span class="file-title">{{ fileName || 'CAD 图纸预览' }}</span>
      </div>
      <div class="toolbar-right">
        <el-button-group>
          <el-button size="small" :icon="RefreshLeft" @click="fitCadView">
            重置视角
          </el-button>
        </el-button-group>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch,
  markRaw,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, RefreshLeft, Warning } from '@element-plus/icons-vue'
import { DxfViewer } from 'dxf-viewer'
import * as THREE from 'three'
import { getDxfFile } from '@/api/calibration'

defineOptions({
  name: 'PreviewCad',
})

const route = useRoute()
const router = useRouter()

const projectId = computed(() => {
  const pid = route.query.projectId
  if (!pid) return 0
  const num = Number(pid)
  return Number.isFinite(num) ? num : 0
})

const fileId = computed(() => {
  const fid = route.params.id
  if (!fid) return 0
  const num = Number(fid)
  return Number.isFinite(num) ? num : 0
})

const fileName = computed(() => (route.query.fileName as string) || '')

const cadContainerRef = ref<HTMLDivElement | null>(null)

const isLoading = ref(true)
const loadingMessage = ref('正在加载CAD图纸...')
const errorMessage = ref('')

type CadBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const CAD_VIEW_PADDING = 0.12

let cadViewer: any | null = null
let cadBounds: CadBounds | null = null
let loadToken = 0
let isDeactivatedFlag = false

const isStale = (token: number) => isDeactivatedFlag || token !== loadToken

function isValidCadBounds(bounds: CadBounds | null | undefined) {
  if (!bounds) return false
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  return (
    Number.isFinite(bounds.minX) &&
    Number.isFinite(bounds.minY) &&
    Number.isFinite(bounds.maxX) &&
    Number.isFinite(bounds.maxY) &&
    width >= 0 &&
    height >= 0 &&
    width + height > 0
  )
}

function getCadSceneBounds(): CadBounds | null {
  const bounds = cadViewer?.GetBounds?.() as CadBounds | null
  if (!isValidCadBounds(bounds)) return null

  const origin = cadViewer?.GetOrigin?.()
  const originX = Number.isFinite(origin?.x) ? origin.x : 0
  const originY = Number.isFinite(origin?.y) ? origin.y : 0

  return {
    minX: bounds.minX - originX,
    maxX: bounds.maxX - originX,
    minY: bounds.minY - originY,
    maxY: bounds.maxY - originY,
  }
}

function disposeCadViewer() {
  if (!cadViewer) return
  try {
    cadViewer.Destroy?.()
  } catch (error) {
    console.error('[PreviewCad] 清理DXF查看器失败:', error)
  }
  cadViewer = null
  cadBounds = null
  if (cadContainerRef.value) cadContainerRef.value.innerHTML = ''
}

async function ensureCadViewer() {
  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

  const root = cadContainerRef.value
  if (!root) throw new Error('CAD容器不存在')
  if (cadViewer) return

  root.innerHTML = ''

  let containerWidth = root.clientWidth
  let containerHeight = root.clientHeight
  for (let i = 0; i < 10 && (!containerWidth || !containerHeight); i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    containerWidth = root.clientWidth
    containerHeight = root.clientHeight
  }

  const canvasWidth = containerWidth || 1024
  const canvasHeight = containerHeight || 768

  const viewer = new DxfViewer(root, {
    canvasWidth,
    canvasHeight,
    autoResize: true,
    antialias: true,
    colorCorrection: true,
    clearColor: new THREE.Color('#ffffff'),
    clearAlpha: 1,
  })

  cadViewer = markRaw(viewer)
}

async function waitForCadBounds(maxFrames = 30) {
  for (let i = 0; i < maxFrames; i++) {
    const bounds = getCadSceneBounds()
    if (bounds) return bounds
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
  return null
}

async function scheduleCadFit(frames = 6) {
  for (let i = 0; i < frames; i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    fitCadView()
  }
}

function fitCadView() {
  if (!cadViewer || !cadBounds) return
  try {
    if (cadViewer.SetView) {
      const width = cadBounds.maxX - cadBounds.minX
      const height = cadBounds.maxY - cadBounds.minY
      const centerX = (cadBounds.minX + cadBounds.maxX) / 2
      const centerY = (cadBounds.minY + cadBounds.maxY) / 2
      const root = cadContainerRef.value
      const aspect =
        root && root.clientWidth > 0 && root.clientHeight > 0
          ? root.clientWidth / root.clientHeight
          : 1
      const viewWidth = Math.max(width, height * aspect)

      if (Number.isFinite(viewWidth) && viewWidth > 0) {
        cadViewer.SetView(
          new THREE.Vector3(centerX, centerY, 0),
          viewWidth * (1 + CAD_VIEW_PADDING),
        )
      }
    } else if (cadViewer.FitView) {
      cadViewer.FitView(
        cadBounds.minX,
        cadBounds.maxX,
        cadBounds.minY,
        cadBounds.maxY,
        0.1,
      )
    }
    cadViewer.Render?.()
  } catch (error) {
    console.error('[PreviewCad] CAD FitView失败:', error)
  }
}

async function loadCadPreview() {
  const token = ++loadToken
  isLoading.value = true
  errorMessage.value = ''
  loadingMessage.value = '正在加载CAD图纸...'

  if (!projectId.value) throw new Error('缺少项目ID，请确保从正确的入口访问')
  if (!fileId.value) throw new Error('缺少文件ID，请确保从正确的入口访问')

  const res = await getDxfFile(projectId.value, fileId.value)
  if (res.code !== 200 || !res.data?.content) {
    throw new Error(res.msg || '加载DXF失败')
  }
  if (isStale(token)) return

  const blobUrl = URL.createObjectURL(
    new Blob([res.data.content], { type: 'application/dxf' }),
  )
  try {
    await ensureCadViewer()
    if (isStale(token)) return

    try {
      cadViewer?.Clear?.()
    } catch (error) {
      console.warn('[PreviewCad] CAD Clear失败（忽略）:', error)
    }

    await cadViewer?.Load?.({
      url: blobUrl,
      fonts: [],
      workerFactory: null,
      progressCbk: (
        _phase: string,
        processedSize: number,
        totalSize: number,
      ) => {
        let percent = 0
        if (totalSize > 0) {
          percent = Math.round((processedSize / totalSize) * 100)
        }
        loadingMessage.value = `加载DXF... ${percent}%`
      },
    })
    if (isStale(token)) return

    cadViewer?.Render?.()

    const bounds = await waitForCadBounds()
    if (bounds) cadBounds = bounds

    await scheduleCadFit(6)
    if (isStale(token)) return

    loadingMessage.value = 'CAD图纸加载完成'
    isLoading.value = false
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

const handleRetry = () => {
  loadCadPreview().catch((error) => {
    console.error('[PreviewCad] 重试失败:', error)
    errorMessage.value = error?.message || 'CAD预览加载失败，请稍后重试'
    isLoading.value = false
  })
}

const handleClose = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/data/history-model')
  }
}

onMounted(() => {
  loadCadPreview().catch((error) => {
    console.error('[PreviewCad] CAD预览加载失败:', error)
    errorMessage.value = error?.message || 'CAD预览加载失败，请稍后重试'
    isLoading.value = false
  })
})

onActivated(() => {
  isDeactivatedFlag = false
  nextTick().then(() => loadCadPreview().catch(() => {}))
})

onDeactivated(() => {
  isDeactivatedFlag = true
  loadToken++
  disposeCadViewer()
})

watch(
  () => [
    route.name,
    route.params.id,
    route.query.projectId,
    route.query.fileName,
  ],
  () => {
    if (route.name !== 'PreviewCad') return
    loadToken++
    disposeCadViewer()
    nextTick().then(() => loadCadPreview().catch(() => {}))
  },
)

onBeforeUnmount(() => {
  isDeactivatedFlag = true
  loadToken++
  disposeCadViewer()
})
</script>

<style lang="scss" scoped>
.preview-container {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.cad-viewer-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #ffffff;
}

.cad-viewer-container :deep(canvas) {
  width: 100% !important;
  height: 100% !important;
  display: block;
}

.top-toolbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  background: rgba(20, 20, 20, 0.55);
  backdrop-filter: blur(8px);
  z-index: 1001;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-title {
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
}

.loading-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.loading-content {
  text-align: center;
  color: #333333;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e5e7eb;
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.error-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: #ffffff;
}

.error-content {
  text-align: center;
  color: #333333;
  max-width: 420px;
  padding: 40px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}
</style>
