<template>
  <div class="dwg-viewer">
    <div class="viewer-container">
      <div ref="drawingContainer" class="drawing-container">
        <div v-if="loading" class="loading-overlay">
          <div class="loading-spinner"></div>
          <p>正在加载图纸... {{ percent }}%</p>
        </div>
        <canvas :id="uniqueCanvasId" class="drawing-canvas"></canvas>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'

interface DrawingInfo {
  drawingId: string
  version: number
  type?: string
  name?: string
}

interface Props {
  drawingId?: string
  version?: number
  fileName?: string
  token?: string
  baseUrl?: string
}

const props = withDefaults(defineProps<Props>(), {
  drawingId: '',
  version: 1,
  fileName: '',
  token: '',
  baseUrl: '',
})

const emit = defineEmits<{
  loaded: []
  error: [error: unknown]
}>()

const drawingContainer = ref<HTMLElement>()
const loading = ref(false)
const percent = ref(0)
const scale = ref(1)
const drawingInfo = ref<DrawingInfo | null>(null)

let currentApp: any = null
const uniqueCanvasId = `dwgCanvas-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

onBeforeUnmount(() => {
  try {
    if (currentApp?.data) {
      if (typeof currentApp.data().closeDrawingDatas === 'function') {
        currentApp.data().closeDrawingDatas()
      } else if (typeof currentApp.data().closeAllModelDatas === 'function') {
        currentApp.data().closeAllModelDatas()
      }

      if (typeof currentApp.stopFrame === 'function') {
        currentApp.stopFrame()
      }
    }
  } catch (error) {
    console.warn('DWG查看器清理时出错:', error)
  }

  currentApp = null
})

const getWind = () => {
  if (typeof window === 'undefined') return null
  return (window as any).WIND?.WIND ?? null
}

const waitForWind = async (timeoutMs = 5000) => {
  if (getWind()) return true

  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 200))
    if (getWind()) return true
  }

  return false
}

const cleanupCurrentApp = () => {
  if (!currentApp?.data) return

  try {
    if (typeof currentApp.data().closeDrawingDatas === 'function') {
      currentApp.data().closeDrawingDatas()
    } else if (typeof currentApp.data().closeAllModelDatas === 'function') {
      currentApp.data().closeAllModelDatas()
    }
  } catch (error) {
    console.warn('清理旧图纸时出错:', error)
  }
}

const getCanvas = async () => {
  let retryCount = 0
  const maxRetries = 10
  let canvas = document.getElementById(uniqueCanvasId) as HTMLCanvasElement | null

  while (!canvas && retryCount < maxRetries) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    canvas = document.getElementById(uniqueCanvasId) as HTMLCanvasElement | null
    retryCount += 1
  }

  return canvas
}

const simulateDrawingLoading = async (drawingId: string, version: number) => {
  loading.value = true
  percent.value = 0

  drawingInfo.value = {
    drawingId,
    version,
    type: 'dwg',
    name: props.fileName || '图纸预览',
  }

  percent.value = 25
  drawDemoContent()
  percent.value = 100
  loading.value = false
  emit('loaded')
}

const drawDemoContent = () => {
  const canvas = document.getElementById(uniqueCanvasId) as HTMLCanvasElement | null
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = canvas.clientWidth || drawingContainer.value?.clientWidth || 0
  canvas.height = canvas.clientHeight || drawingContainer.value?.clientHeight || 0

  if (!canvas.width || !canvas.height) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.strokeStyle = '#333333'
  ctx.fillStyle = '#333333'
  ctx.lineWidth = 2

  const centerX = canvas.width / 2
  const centerY = canvas.height / 2
  const demoScale = (Math.min(canvas.width, canvas.height) / 500) * scale.value

  ctx.strokeRect(centerX - 150 * demoScale, centerY - 100 * demoScale, 300 * demoScale, 200 * demoScale)
  ctx.font = `${16 * demoScale}px Arial`
  ctx.textAlign = 'center'
  ctx.fillText('演示图纸', centerX, centerY - 130 * demoScale)

  ctx.font = `${12 * demoScale}px Arial`
  ctx.fillText('DWG 图纸查看器演示', centerX, centerY + 130 * demoScale)

  ctx.beginPath()
  ctx.moveTo(centerX - 100 * demoScale, centerY - 50 * demoScale)
  ctx.lineTo(centerX + 100 * demoScale, centerY - 50 * demoScale)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(centerX - 100 * demoScale, centerY)
  ctx.lineTo(centerX + 100 * demoScale, centerY)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(centerX - 100 * demoScale, centerY + 50 * demoScale)
  ctx.lineTo(centerX + 100 * demoScale, centerY + 50 * demoScale)
  ctx.stroke()

  ctx.font = `${10 * demoScale}px Arial`
  ctx.fillText('200mm', centerX, centerY - 60 * demoScale)
}

const loadDrawing = async (drawingId: string, version = props.version) => {
  const windReady = await waitForWind()
  const WIND = getWind()

  if (!windReady || !WIND) {
    console.warn('WIND引擎未加载，使用演示模式')
    ElMessage.info('图纸加载中，请稍后刷新页面重试')
    await simulateDrawingLoading(drawingId, version)
    return
  }

  try {
    loading.value = true
    percent.value = 0
    cleanupCurrentApp()

    const canvas = await getCanvas()
    if (!canvas) {
      console.warn('Canvas元素未找到，使用演示模式')
      await simulateDrawingLoading(drawingId, version)
      return
    }

    const WINDDrawingApp = WIND.DRAWING.APP
    const drawingApp = new WINDDrawingApp(canvas)
    drawingApp.startFrame()

    if (!props.token || !props.baseUrl) {
      console.warn('未提供渲染凭证，使用演示模式')
      ElMessage.warning('未提供渲染凭证，使用演示模式')
      await simulateDrawingLoading(drawingId, version)
      return
    }

    await drawingApp.connect({
      serverIp: props.baseUrl,
      token: props.token,
    })

    const currentDrawing = await drawingApp.network().grabDrawingList(drawingId, version)

    drawingInfo.value = {
      drawingId,
      version,
      type: currentDrawing?.type || 'unknown',
      name: currentDrawing?.name,
    }

    drawingApp.effect().setBackgroundType(WIND.DRAWING.BackgroundType.WHITE)
    drawingApp.data().addCallback(1, (type: number, option: any) => {
      if (type === 1) {
        percent.value = Math.min(option?.percent || 0, 100)
      }
    })

    currentApp = drawingApp
    await drawingApp.data().openDrawingDatas([{ drawingId, version }])

    loading.value = false
    emit('loaded')
  } catch (error) {
    console.error('加载图纸失败:', error)
    loading.value = false
    emit('error', error)
    ElMessage.error('加载图纸失败，使用演示模式')
    await simulateDrawingLoading(drawingId, version)
  }
}

const resetView = () => {
  if (currentApp) {
    currentApp.action().homeRoaming()
    return
  }

  scale.value = 1
  drawDemoContent()
}

const mainView = () => {
  if (currentApp) {
    currentApp.action().homeRoaming()
  }
}

const toggleMeasure = (opened: boolean, type: 'dot' | 'angle' | 'area') => {
  const WIND = getWind()
  if (!currentApp || !WIND) return

  const MeasureType = WIND.DRAWING.MeasureType

  if (opened) {
    currentApp.create().openMeasure()
    switch (type) {
      case 'dot':
        currentApp.create().setMeasureType(MeasureType.DOT)
        break
      case 'angle':
        currentApp.create().setMeasureType(MeasureType.ANGLE)
        break
      case 'area':
        currentApp.create().setMeasureType(MeasureType.AREA)
        break
    }
    currentApp.create().addCallback(210, (callbackType: number, option: any) => {
      console.log('测量回调:', callbackType, option)
    })
  } else {
    currentApp.create().closeMeasure()
    currentApp.create().removeCallback(210)
  }
}

const setMeasureType = (type: 'dot' | 'angle' | 'area') => {
  const WIND = getWind()
  if (!currentApp || !WIND) return

  const MeasureType = WIND.DRAWING.MeasureType

  switch (type) {
    case 'dot':
      currentApp.create().setMeasureType(MeasureType.DOT)
      break
    case 'angle':
      currentApp.create().setMeasureType(MeasureType.ANGLE)
      break
    case 'area':
      currentApp.create().setMeasureType(MeasureType.AREA)
      break
  }
}

const zoomIn = () => {
  if (currentApp) {
    currentApp.view().zoom(1.2)
    return
  }

  scale.value *= 1.2
  drawDemoContent()
}

const zoomOut = () => {
  if (currentApp) {
    currentApp.view().zoom(0.8)
    return
  }

  scale.value *= 0.8
  drawDemoContent()
}

defineExpose({
  loadDrawing,
  resetView,
  zoomIn,
  zoomOut,
  mainView,
  toggleMeasure,
  setMeasureType,
})
</script>

<style scoped>
.dwg-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.viewer-container {
  flex: 1;
  position: relative;
  width: 100%;
  height: 100%;
  background: #fff;
}

.drawing-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: #fff;
}

.drawing-canvas {
  width: 100%;
  height: 100%;
  display: block;
  background: #fff;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e5e7eb;
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

.loading-overlay p {
  color: #333;
  font-size: 14px;
  margin: 0;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>
