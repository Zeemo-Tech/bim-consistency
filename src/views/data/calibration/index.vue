<template>
  <div class="calibration-container">
    <!-- 顶部工具栏 -->
    <div class="top-toolbar">
      <div class="toolbar-left">
        <el-button :icon="ArrowLeft" @click="handleGoBack" size="small">返回</el-button>
        <h1 class="page-title">CAD图纸与巡检轨迹校准</h1>
        <el-tag :type="calibrationStatus === 'completed' ? 'success' : 'info'" size="small">
          {{ calibrationStatusText }}
        </el-tag>
      </div>
      <div class="toolbar-right">
        <span class="scan-info">扫描ID: {{ scanId }}</span>
        <el-button type="primary" size="small" @click="handleSaveCalibration">
          <el-icon><Check /></el-icon>
          保存校准
        </el-button>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="calibration-workspace">
      <!-- 主视图：CAD + 轨迹叠加 -->
      <div class="main-panel">
        <div class="panel-header">
          <span class="panel-title">校准视图</span>
          <div class="panel-actions">
            <!-- 图层控制 -->
              <el-tooltip content="显示轨迹图层">
              <el-button
                :type="showTrackLayer ? 'primary' : ''"
                size="small"
                @click="toggleTrackLayer"
              >
                <el-icon><MapLocation /></el-icon>
                轨迹
              </el-button>
            </el-tooltip>
            <el-divider direction="vertical" />
            <el-tooltip content="显示坐标轴">
              <el-button
                :type="showAxis ? 'primary' : ''"
                size="small"
                circle
                @click="toggleAxis"
              >
                <el-icon><Histogram /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="重置视图">
              <el-button size="small" circle @click="resetView">
                <el-icon><RefreshRight /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </div>
        <div class="canvas-container" ref="canvasContainer">
          <!-- DWG查看器作为底层 -->
          <div ref="dwgViewerContainer" class="dwg-layer">
            <DwgViewer
              v-if="dwgReady"
              ref="dwgViewerRef"
              :drawing-id="dwgDrawingId"
              :version="dwgVersion"
              :token="dwgToken"
              :base-url="dwgBaseUrl"
            />
            <div v-else class="dwg-placeholder">
              <el-icon :size="48"><Document /></el-icon>
              <p>请提供CAD图纸加载参数</p>
            </div>
          </div>
          <!-- 透明Canvas作为叠加层用于绘制轨迹和控制点 -->
          <canvas
            ref="mainCanvas"
            class="overlay-canvas"
            :class="{ 'pointer-events-none': calibrationMode === 'view' }"
            @mousedown="handleMouseDown"
            @mousemove="handleMouseMove"
            @mouseup="handleMouseUp"
            @click="handleCanvasClick"
          ></canvas>
          <!-- 坐标显示 -->
          <div v-if="mousePos" class="coord-display">
            坐标: ({{ mousePos.x.toFixed(2) }}, {{ mousePos.y.toFixed(2) }})
          </div>
          </div>
      </div>

      <!-- 校准控制面板 -->
      <div class="control-panel" :class="{ collapsed: controlPanelCollapsed }">
        <div class="panel-toggle" @click="toggleControlPanel">
          <el-icon><DArrowLeft v-if="!controlPanelCollapsed" /><DArrowRight v-else /></el-icon>
        </div>

        <div v-show="!controlPanelCollapsed" class="panel-content">
          <el-divider />

          <h3 class="panel-section-title">
            <el-icon><Setting /></el-icon>
            校准参数
          </h3>

          <!-- 轨迹平移 -->
          <div class="control-group">
            <label class="control-label">轨迹平移 X</label>
            <div class="control-input-group">
              <el-slider v-model="trackTransform.translateX" :min="-1000" :max="1000" @input="updateView" />
              <el-input-number
                v-model="trackTransform.translateX"
                :min="-1000"
                :max="1000"
                size="small"
                @change="updateView"
              />
            </div>
          </div>

          <div class="control-group">
            <label class="control-label">轨迹平移 Y</label>
            <div class="control-input-group">
              <el-slider v-model="trackTransform.translateY" :min="-1000" :max="1000" @input="updateView" />
              <el-input-number
                v-model="trackTransform.translateY"
                :min="-1000"
                :max="1000"
                size="small"
                @change="updateView"
              />
            </div>
          </div>

          <!-- 轨迹旋转 -->
          <div class="control-group">
            <label class="control-label">轨迹旋转角度</label>
            <div class="control-input-group">
              <el-slider v-model="trackTransform.rotation" :min="-180" :max="180" @input="updateView" />
              <el-input-number
                v-model="trackTransform.rotation"
                :min="-180"
                :max="180"
                size="small"
                @change="updateView"
              />
            </div>
          </div>

          <!-- 轨迹缩放 -->
          <div class="control-group">
            <label class="control-label">轨迹缩放</label>
            <div class="control-input-group">
              <el-slider v-model="trackTransform.scale" :min="0.01" :max="10" :step="0.1" @input="updateView" />
              <el-input-number
                v-model="trackTransform.scale"
                :min="0.01"
                :max="10"
                :step="0.1"
                :precision="2"
                size="small"
                @change="updateView"
              />
            </div>
          </div>

          <el-divider />

          <!-- 校准模式 -->
          <h3 class="panel-section-title">
            <el-icon><Pointer /></el-icon>
            校准模式
          </h3>

          <div class="control-group">
            <el-radio-group v-model="calibrationMode" @change="handleModeChange">
              <el-radio value="drag">拖拽模式</el-radio>
              <el-radio value="control-point">控制点模式</el-radio>
              <el-radio value="view">查看模式</el-radio>
            </el-radio-group>
          </div>

          <div v-if="calibrationMode === 'control-point'" class="control-point-info">
            <p class="info-text">
              点击模式：先选择CAD上的点，再选���轨迹上的对应点
            </p>
            <p class="info-text">
              当前步骤：{{ controlPointStep === 'cad' ? '在CAD上选点' : '在轨迹上选点' }}
            </p>
            <p class="info-text">已添加控制点对：{{ controlPoints.length }}</p>
          </div>

          <el-divider />

          <!-- 控制点列表 -->
          <div v-if="controlPoints.length > 0" class="control-points-list">
            <h3 class="panel-section-title">
              <el-icon><Position /></el-icon>
              控制点列表
            </h3>
            <div v-for="(point, index) in controlPoints" :key="index" class="control-point-item">
              <span class="point-index">{{ index + 1 }}</span>
              <div class="point-coords">
                <span class="point-cad">CAD: ({{ point.cad.x.toFixed(1) }}, {{ point.cad.y.toFixed(1) }})</span>
                <span class="point-track">GPS: ({{ point.track.x.toFixed(1) }}, {{ point.track.y.toFixed(1) }})</span>
              </div>
              <el-button size="small" text type="danger" @click="removeControlPoint(index)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
            <el-button
              v-if="controlPoints.length >= 2"
              type="primary"
              size="small"
              style="width: 100%; margin-top: 10px"
              @click="calculateTransform"
            >
              自动计算校准参数
            </el-button>
          </div>

          <el-divider />

          <!-- 误差信息 -->
          <div v-if="calibrationError" class="error-info">
            <h3 class="panel-section-title">
              <el-icon><DataAnalysis /></el-icon>
              校准误差
            </h3>
            <div class="error-item">
              <span class="error-label">平均误差：</span>
              <span class="error-value">{{ calibrationError.average.toFixed(3) }} m</span>
            </div>
            <div class="error-item">
              <span class="error-label">最大误差：</span>
              <span class="error-value">{{ calibrationError.max.toFixed(3) }} m</span>
            </div>
            <div class="error-item">
              <span class="error-label">最小误差：</span>
              <span class="error-value">{{ calibrationError.min.toFixed(3) }} m</span>
            </div>
          </div>

          <!-- 快捷操作 -->
          <el-divider />
          <div class="quick-actions">
            <el-button size="small" @click="resetAllCalibration">
              <el-icon><RefreshLeft /></el-icon>
              重置所有
            </el-button>
            <el-button size="small" @click="clearControlPoints">
              <el-icon><Delete /></el-icon>
              清除控制点
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="bottom-statusbar">
      <div class="status-item">
        <el-icon><Document /></el-icon>
        <span>CAD文件：{{ fileName || (fileId ? `ID:${fileId}` : '未指定') }} {{ dwgLoaded ? '(已加载)' : '(加载中...)' }}</span>
      </div>
      <div class="status-item">
        <el-icon><MapLocation /></el-icon>
        <span>轨迹点数：{{ trackPoints.length }}</span>
      </div>
      <div class="status-item">
        <el-icon><Coordinate /></el-icon>
        <span>控制点对：{{ controlPoints.length }}</span>
      </div>
      <div class="status-item">
        <el-icon><InfoFilled /></el-icon>
        <span>{{ statusMessage }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  Check,
  Histogram,
  RefreshRight,
  DArrowLeft,
  DArrowRight,
  Setting,
  Pointer,
  Position,
  Delete,
  DataAnalysis,
  RefreshLeft,
  Document,
  MapLocation,
  Coordinate,
  InfoFilled,
  Files,
} from '@element-plus/icons-vue'
import DwgViewer from '@/components/twoScreen/DwgViewer.vue'

/**
 * 路由相关
 */
const route = useRoute()
const router = useRouter()

const getQueryString = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return ''
}

const scanId = ref(getQueryString(route.query.scanId) || 'mock-scan-001')
const fileId = ref(getQueryString(route.query.fileId))

/**
 * Canvas引用和DWG查看器引用
 */
const mainCanvas = ref<HTMLCanvasElement>()
const canvasContainer = ref<HTMLDivElement>()
const dwgViewerRef = ref<InstanceType<typeof DwgViewer>>()
const dwgViewerContainer = ref<HTMLDivElement>()

/**
 * 轨迹变换参数（将轨迹对齐到CAD坐标系）
 * CAD是空间基准，不能改变其实际尺寸
 * 所有校准变换应用到轨迹数据上
 */
const trackTransform = ref({
  translateX: 0,
  translateY: 0,
  rotation: 0, // 角度
  scale: 1,
})

/**
 * 图层显示控制
 */
const showTrackLayer = ref(true)
const trackOpacity = ref(0.8)

/**
 * 显示选项
 */
const showAxis = ref(true)

/**
 * 校准状态
 */
const calibrationStatus = ref<'not_started' | 'in_progress' | 'completed'>('not_started')
const calibrationStatusText = computed(() => {
  const statusMap = {
    not_started: '未开始',
    in_progress: '校准中',
    completed: '已完成',
  }
  return statusMap[calibrationStatus.value]
})

/**
 * 控制面板折叠状态
 */
const controlPanelCollapsed = ref(false)

/**
 * 校准模式
 */
const calibrationMode = ref<'drag' | 'control-point' | 'view'>('view')

/**
 * 控制点模式的步骤
 */
const controlPointStep = ref<'cad' | 'track'>('cad')
const tempCADPoint = ref<{ x: number; y: number } | null>(null)

/**
 * 控制点对
 */
interface ControlPoint {
  cad: { x: number; y: number }
  track: { x: number; y: number }
}
const controlPoints = ref<ControlPoint[]>([])

/**
 * 校准误差
 */
const calibrationError = ref<{
  average: number
  max: number
  min: number
} | null>(null)

/**
 * 鼠标位置
 */
const mousePos = ref<{ x: number; y: number } | null>(null)

/**
 * 拖拽状态
 */
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })

/**
 * 状态消息和文件信息
 */
const statusMessage = ref('准备就绪')
const fileName = ref(route.query.fileName as string || '')

/**
 * DWG文件信息
 */
const dwgDrawingId = ref(
  getQueryString(route.query.drawingId) || getQueryString(route.query.dwgDrawingId)
)
const dwgVersion = ref(1)
const dwgLoaded = ref(false)
const dwgToken = ref(getQueryString(route.query.token) || getQueryString(route.query.dwgToken))
const dwgBaseUrl = ref(getQueryString(route.query.baseUrl) || getQueryString(route.query.dwgBaseUrl))
const dwgReady = computed(() => Boolean(dwgDrawingId.value && dwgToken.value && dwgBaseUrl.value))

/**
 * 模拟的巡检轨迹数据（GPS坐标）- 调整为与CAD更接近的位置
 */
const trackPoints = ref([
  { x: 60, y: 60 },
  { x: 80, y: 70 },
  { x: 100, y: 90 },
  { x: 120, y: 110 },
  { x: 140, y: 130 },
  { x: 160, y: 140 },
  { x: 180, y: 145 },
  { x: 190, y: 148 },
  { x: 200, y: 150 },
  { x: 210, y: 152 },
  { x: 230, y: 160 },
  { x: 250, y: 170 },
  { x: 270, y: 180 },
  { x: 290, y: 190 },
  { x: 310, y: 200 },
  { x: 330, y: 210 },
  { x: 340, y: 220 },
])

/**
 * 加载WIND引擎
 */
const loadWindEngine = () => {
  return new Promise((resolve) => {
    // 检查是否已经加载
    if (typeof window !== 'undefined' && (window as any).WIND) {
      console.log('WIND引擎已加载')
      resolve(true)
      return
    }

    console.log('开始加载WIND引擎...')
    // 加载 WIND 引擎脚本
    const script = document.createElement('script')
    script.src = '/twoScreen/WIND.js'
    script.onload = () => {
      console.log('WIND引擎加载完成')
      resolve(true)
    }
    script.onerror = () => {
      console.warn('WIND引擎加载失败，将使用演示模式')
      resolve(true) // 继续执行，让组件使用演示模式
    }
    document.head.appendChild(script)

    // 同时加载 YZGIS 引擎
    const yzgisScript = document.createElement('script')
    yzgisScript.src = '/twoScreen/YZGIS.js'
    yzgisScript.onload = () => {
      console.log('YZGIS引擎加载完成')
    }
    yzgisScript.onerror = () => {
      console.warn('YZGIS引擎加载失败，将使用演示模式')
    }
    document.head.appendChild(yzgisScript)
  })
}

/**
 * 初始化Canvas和DWG查看器
 */
const initCanvas = async () => {
  // 先加载WIND引擎
  await loadWindEngine()

  // 等待一帧确保DOM更新完成
  await new Promise(resolve => requestAnimationFrame(resolve))

  if (mainCanvas.value && canvasContainer.value) {
    const container = canvasContainer.value
    mainCanvas.value.width = container.clientWidth
    mainCanvas.value.height = container.clientHeight
    console.log('Canvas 初始化完成:', {
      width: mainCanvas.value.width,
      height: mainCanvas.value.height
    })
  }

  // 加载DWG图纸
  await loadDWG()

  // 绘制叠加层（轨迹和控制点）
  drawMain()
}

/**
 * 加载DWG图纸
 */
const loadDWG = async () => {
  if (!dwgReady.value) {
    statusMessage.value = '缺少图纸加载参数，无法加载CAD图纸'
    ElMessage.warning('请提供CAD图纸ID、token和baseUrl')
    return
  }

  try {
    if (dwgViewerRef.value && dwgDrawingId.value) {
      statusMessage.value = '正在加载CAD图纸...'
      await dwgViewerRef.value.loadDrawing(dwgDrawingId.value, dwgVersion.value)
      dwgLoaded.value = true
      statusMessage.value = 'CAD图纸加载完成'
    }
  } catch (error) {
    console.error('加载DWG图纸失败:', error)
    statusMessage.value = 'CAD图纸加载失败'
    ElMessage.error('CAD图纸加载失败: ' + (error as Error).message)
  }
}

/**
 * 绘制主视图（轨迹和控制点叠加在DWG上）
 */
const drawMain = () => {
  if (!mainCanvas.value) return

  const canvas = mainCanvas.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 清空画布（透明）
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  
  // 绘制坐标轴
  if (showAxis.value) {
    drawAxis(ctx, canvas.width, canvas.height)
  }

  // 绘制轨迹图层
  if (showTrackLayer.value) {
    drawTrackLayer(ctx)
  }

  // 绘制控制点
  drawControlPoints(ctx, canvas.width, canvas.height)
}



/**
 * 绘制轨迹图层
 * 将变换应用到轨迹坐标上（轨迹对齐到CAD）
 */
const drawTrackLayer = (ctx: CanvasRenderingContext2D) => {
  if (!mainCanvas.value) return

  ctx.save()

  // 设置透明度
  ctx.globalAlpha = trackOpacity.value

  // 将轨迹点变换到CAD坐标系
  const transformedPoints = trackPoints.value.map(point =>
    transformPoint(
      point.x,
      point.y,
      mainCanvas.value!.width,
      mainCanvas.value!.height,
      trackTransform.value
    )
  )

  // 绘制轨迹线
  if (transformedPoints.length > 1) {
    ctx.strokeStyle = '#00ff80'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.beginPath()
    ctx.moveTo(transformedPoints[0].x, transformedPoints[0].y)
    for (let i = 1; i < transformedPoints.length; i++) {
      ctx.lineTo(transformedPoints[i].x, transformedPoints[i].y)
    }
    ctx.stroke()

    // 绘制轨迹点
    ctx.fillStyle = '#00ff80'
    transformedPoints.forEach((point) => {
      ctx.beginPath()
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2)
      ctx.fill()
    })

    // 绘制起点和终点标记
    // 起点
    ctx.fillStyle = '#00ff00'
    ctx.beginPath()
    ctx.arc(transformedPoints[0].x, transformedPoints[0].y, 6, 0, Math.PI * 2)
    ctx.fill()

    // 终点
    ctx.fillStyle = '#ff0000'
    ctx.beginPath()
    ctx.arc(
      transformedPoints[transformedPoints.length - 1].x,
      transformedPoints[transformedPoints.length - 1].y,
      6,
      0,
      Math.PI * 2
    )
    ctx.fill()
  }

  ctx.restore()
}

/**
 * 绘制控制点
 * CAD控制点保持不变，轨迹控制点应用变换
 */
const drawControlPoints = (ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) => {
  // 绘制控制点对
  controlPoints.value.forEach((point, index) => {
    // 绘制CAD侧控制点（保持原位，不变换）
    drawControlPoint(ctx, point.cad.x, point.cad.y, index + 1, '#4a90ff')

    // 绘制轨迹侧控制点（应用变换）
    const transformedTrack = transformPoint(
      point.track.x,
      point.track.y,
      canvasWidth,
      canvasHeight,
      trackTransform.value
    )
    drawControlPoint(ctx, transformedTrack.x, transformedTrack.y, index + 1, '#00ff80')

    // 绘制连接线（误差可视化）
    ctx.save()
    ctx.strokeStyle = '#ff9900'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.globalAlpha = 0.6
    ctx.beginPath()
    ctx.moveTo(point.cad.x, point.cad.y)
    ctx.lineTo(transformedTrack.x, transformedTrack.y)
    ctx.stroke()
    ctx.restore()
  })

  // 绘制临时控制点
  if (calibrationMode.value === 'control-point' && controlPointStep.value === 'track' && tempCADPoint.value) {
    drawControlPoint(ctx, tempCADPoint.value.x, tempCADPoint.value.y, 0, '#ffaa00', true)
  }
}

/**
 * 绘制网格
 */
const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, color: string) => {
  ctx.strokeStyle = color
  ctx.lineWidth = 0.5

  const gridSize = 50
  for (let x = 0; x <= width; x += gridSize) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }

  for (let y = 0; y <= height; y += gridSize) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
}

/**
 * 绘制��标轴
 */
const drawAxis = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  // X轴
  ctx.strokeStyle = '#ff4444'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, height / 2)
  ctx.lineTo(width, height / 2)
  ctx.stroke()

  // Y轴
  ctx.strokeStyle = '#44ff44'
  ctx.beginPath()
  ctx.moveTo(width / 2, 0)
  ctx.lineTo(width / 2, height)
  ctx.stroke()
}

/**
 * 绘制控制点
 */
const drawControlPoint = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  index: number,
  color: string,
  isTemp = false
) => {
  // 外圈
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, 10, 0, Math.PI * 2)
  ctx.stroke()

  // 内圈
  ctx.fillStyle = isTemp ? 'rgba(255, 170, 0, 0.6)' : color
  ctx.beginPath()
  ctx.arc(x, y, 6, 0, Math.PI * 2)
  ctx.fill()

  // 序号
  if (index > 0) {
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(index.toString(), x, y)
  }
}

/**
 * 变换点坐标
 */
const transformPoint = (
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
  transform: { translateX: number; translateY: number; rotation: number; scale: number }
) => {
  // 移到中心
  let px = x - canvasWidth / 2
  let py = y - canvasHeight / 2

  // 应用平移
  px += transform.translateX
  py += transform.translateY

  // 应用缩放
  px *= transform.scale
  py *= transform.scale

  // 应用旋转
  const angle = (transform.rotation * Math.PI) / 180
  const rotatedX = px * Math.cos(angle) - py * Math.sin(angle)
  const rotatedY = px * Math.sin(angle) + py * Math.cos(angle)

  // 移回
  return {
    x: rotatedX + canvasWidth / 2,
    y: rotatedY + canvasHeight / 2,
  }
}

/**
 * 反向变换点坐标（从屏幕坐标到原始坐标）
 */
const inverseTransformPoint = (
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number,
  transform: { translateX: number; translateY: number; rotation: number; scale: number }
) => {
  // 移到中心
  let x = screenX - canvasWidth / 2
  let y = screenY - canvasHeight / 2

  // 反向旋转
  const angle = (-transform.rotation * Math.PI) / 180
  const unrotatedX = x * Math.cos(angle) - y * Math.sin(angle)
  const unrotatedY = x * Math.sin(angle) + y * Math.cos(angle)

  // 反向缩放
  let px = unrotatedX / transform.scale
  let py = unrotatedY / transform.scale

  // 反向平移
  px -= transform.translateX
  py -= transform.translateY

  // 移回
  return {
    x: px + canvasWidth / 2,
    y: py + canvasHeight / 2,
  }
}

/**
 * 获取画布上的实际坐标
 */
const getCanvasCoordinates = (clientX: number, clientY: number) => {
  if (!mainCanvas.value) return { x: 0, y: 0 }

  const rect = mainCanvas.value.getBoundingClientRect()
  const x = clientX - rect.left
  const y = clientY - rect.top

  return { x, y }
}

/**
 * 鼠标按下
 */
const handleMouseDown = (e: MouseEvent) => {
  if (calibrationMode.value === 'drag' || calibrationMode.value === 'view') {
    isDragging.value = true
    dragStart.value = { x: e.offsetX, y: e.offsetY }
  }
}

/**
 * 鼠标移动
 */
const handleMouseMove = (e: MouseEvent) => {
  if (!mainCanvas.value) return

  // 更新鼠标位置显示
  const coords = getCanvasCoordinates(e.clientX, e.clientY)
  mousePos.value = coords

  // 拖拽模式：拖动轨迹（而非CAD）
  if (isDragging.value && calibrationMode.value === 'drag') {
    const dx = e.offsetX - dragStart.value.x
    const dy = e.offsetY - dragStart.value.y

    trackTransform.value.translateX += dx
    trackTransform.value.translateY += dy

    dragStart.value = { x: e.offsetX, y: e.offsetY }
    updateView()
    calibrationStatus.value = 'in_progress'
  }
}

/**
 * 鼠标释放
 */
const handleMouseUp = () => {
  isDragging.value = false
}

/**
 * 画布点击（用于添加控制点）
 */
const handleCanvasClick = (e: MouseEvent) => {
  if (calibrationMode.value !== 'control-point') return
  if (!mainCanvas.value) return

  const coords = getCanvasCoordinates(e.clientX, e.clientY)

  if (controlPointStep.value === 'cad') {
    // 在CAD图层上选点 - CAD是基准，直接使用坐标
    tempCADPoint.value = coords
    controlPointStep.value = 'track'
    statusMessage.value = '请在轨迹上选择对应���'
    drawMain()
  } else if (controlPointStep.value === 'track' && tempCADPoint.value) {
    // 在轨迹图层上选点 - 需要反向变换回原始轨迹坐标
    const originalTrackPos = inverseTransformPoint(
      coords.x,
      coords.y,
      mainCanvas.value.width,
      mainCanvas.value.height,
      trackTransform.value
    )

    controlPoints.value.push({
      cad: tempCADPoint.value,
      track: originalTrackPos,
    })

    tempCADPoint.value = null
    controlPointStep.value = 'cad'
    statusMessage.value = `已添加控制点 ${controlPoints.value.length}，请继续在CAD上选择下一个点`

    drawMain()
    ElMessage.success(`已添加第 ${controlPoints.value.length} 个控制点对`)
  }
}

/**
 * 更新视图
 */
const updateView = () => {
  drawMain()
  calculateError()
}

/**
 * 切换轨迹图层
 */
const toggleTrackLayer = () => {
  showTrackLayer.value = !showTrackLayer.value
  drawMain()
}

/**
 * 切换坐标轴显示
 */
const toggleAxis = () => {
  showAxis.value = !showAxis.value
  drawMain()
}

/**
 * 重置视图
 */
const resetView = () => {
  // 重置 DWG Viewer 视图
  if (dwgViewerRef.value && dwgViewerRef.value.resetView) {
    dwgViewerRef.value.resetView()
  }
}


/**
 * 切换控制面板
 */
const toggleControlPanel = () => {
  controlPanelCollapsed.value = !controlPanelCollapsed.value
}

/**
 * 处理模式切换
 */
const handleModeChange = (mode: string) => {
  if (mode === 'control-point') {
    statusMessage.value = '请在CAD图上选择第一个控制点'
    controlPointStep.value = 'cad'
    tempCADPoint.value = null
  } else if (mode === 'drag') {
    statusMessage.value = '拖拽模式：可以拖动轨迹进行对齐'
  } else {
    statusMessage.value = '查看模式：可以使用滚轮缩放和拖动查看 DWG 图纸'
  }
}

/**
 * 删除控制点
 */
const removeControlPoint = (index: number) => {
  controlPoints.value.splice(index, 1)
  drawMain()
  ElMessage.info('已删除控制点')
}

/**
 * 清除所有控制点
 */
const clearControlPoints = () => {
  if (controlPoints.value.length === 0) {
    ElMessage.info('没有控制点需要清除')
    return
  }

  ElMessageBox.confirm('确定要清除所有控制点吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    controlPoints.value = []
    tempCADPoint.value = null
    controlPointStep.value = 'cad'
    calibrationError.value = null
    drawMain()
    ElMessage.success('已清除所有控制点')
  })
}

/**
 * 重置所有校准
 */
const resetAllCalibration = () => {
  ElMessageBox.confirm('确定要重置所有校准参数吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    trackTransform.value = {
      translateX: 0,
      translateY: 0,
      rotation: 0,
      scale: 1,
    }
    controlPoints.value = []
    tempCADPoint.value = null
    controlPointStep.value = 'cad'
    calibrationError.value = null
    calibrationStatus.value = 'not_started'
    updateView()
    ElMessage.success('已重置所有校准参数')
  })
}

/**
 * 计算变换矩阵（基于控制点）
 */
const calculateTransform = () => {
  if (controlPoints.value.length < 2) {
    ElMessage.warning('至少需要2个控制点才能计算变换')
    return
  }

  // 简化算法：使用前两个控制点计算变换：从轨迹坐标系到CAD坐标系
  const cp1CAD = controlPoints.value[0].cad
  const cp1Track = controlPoints.value[0].track
  const cp2CAD = controlPoints.value[1].cad
  const cp2Track = controlPoints.value[1].track

  // 计算平移：将轨迹平移到CAD位置
  trackTransform.value.translateX = cp1CAD.x - cp1Track.x
  trackTransform.value.translateY = cp1CAD.y - cp1Track.y

  // 计算旋转角度：从轨迹方向到CAD方向
  const angleTrack = Math.atan2(cp2Track.y - cp1Track.y, cp2Track.x - cp1Track.x)
  const angleCAD = Math.atan2(cp2CAD.y - cp1CAD.y, cp2CAD.x - cp1CAD.x)
  trackTransform.value.rotation = ((angleCAD - angleTrack) * 180) / Math.PI

  // 计算缩放：从轨迹距离到CAD距离
  const distTrack = Math.sqrt((cp2Track.x - cp1Track.x) ** 2 + (cp2Track.y - cp1Track.y) ** 2)
  const distCAD = Math.sqrt((cp2CAD.x - cp1CAD.x) ** 2 + (cp2CAD.y - cp1CAD.y) ** 2)
  trackTransform.value.scale = distCAD / distTrack

  updateView()
  calibrationStatus.value = 'completed'
  ElMessage.success('已自动计算校准参数')
  statusMessage.value = '自动校准完成'
}

/**
 * 计算误差
 * 计算变换后的轨迹点与CAD控制点的距离
 */
const calculateError = () => {
  if (controlPoints.value.length < 2) {
    calibrationError.value = null
    return
  }

  if (!mainCanvas.value) return

  const errors: number[] = []

  controlPoints.value.forEach((point) => {
    // 将轨迹点变换到CAD坐标系
    const transformedTrack = transformPoint(
      point.track.x,
      point.track.y,
      mainCanvas.value!.width,
      mainCanvas.value!.height,
      trackTransform.value
    )

    // 计算变换后的轨迹点与CAD点的距离
    const error = Math.sqrt(
      (transformedTrack.x - point.cad.x) ** 2 +
      (transformedTrack.y - point.cad.y) ** 2
    )
    errors.push(error)
  })

  if (errors.length > 0) {
    calibrationError.value = {
      average: errors.reduce((sum, e) => sum + e, 0) / errors.length,
      max: Math.max(...errors),
      min: Math.min(...errors),
    }
  }
}

/**
 * 保存校准结果
 */
const handleSaveCalibration = () => {
  const calibrationData = {
    scanId: scanId.value,
    trackTransform: trackTransform.value,
    controlPoints: controlPoints.value,
    error: calibrationError.value,
    timestamp: new Date().toISOString(),
  }

  console.log('保存校准数据：', calibrationData)

  ElMessage.success('校准结果已保存（模拟）')
  statusMessage.value = '校准结果已保存'
  calibrationStatus.value = 'completed'

  // TODO: 调用后端API保存校准数据
}

/**
 * 返回上一页
 */
const handleGoBack = () => {
  router.push('/projects/files')
}

/**
 * 窗口大小变化处理
 */
const handleResize = () => {
  initCanvas()
}

/**
 * 组件挂载
 */
onMounted(async () => {
  await nextTick()

  // 延迟初始化以确保DWG查看器已挂载
  // 增加延迟时间确保DOM完全渲染
  setTimeout(async () => {
    console.log('开始初始化 calibration 页面...')
    await initCanvas()
    console.log('Calibration 页面初始化完成')
    statusMessage.value = '准备就绪，请选择校准模式开始'
  }, 1000)

  window.addEventListener('resize', handleResize)
})

/**
 * 组件卸载
 */
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style lang="scss" scoped>
.calibration-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #0f0f0f;
  color: #e0e0e0;
  overflow: hidden;
}

.top-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-bottom: 1px solid #2a2a3e;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  z-index: 100;

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 16px;

    .page-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #ffffff;
      letter-spacing: 0.5px;
    }
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 16px;

    .scan-info {
      font-size: 13px;
      color: #a0a0b0;
    }
  }
}

.calibration-workspace {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
}

.main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  border: 1px solid #2a2a3e;
  margin: 8px;
  border-radius: 8px;
  overflow: hidden;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #2a2a3e 0%, #1e1e2e 100%);
  border-bottom: 1px solid #3a3a4e;

  .panel-title {
    font-size: 14px;
    font-weight: 600;
    color: #00ffff;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .panel-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.canvas-container {
  flex: 1;
  position: relative;
  overflow: hidden;

  .dwg-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    transition: opacity 0.3s ease;

    .dwg-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      color: #999;
      gap: 16px;

      p {
        font-size: 14px;
        margin: 0;
      }
    }
  }

  .overlay-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 2;
    cursor: crosshair;

    &.pointer-events-none {
      pointer-events: none;
    }
  }

  .coord-display {
    position: absolute;
    bottom: 12px;
    left: 12px;
    padding: 6px 12px;
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid #00ffff;
    border-radius: 4px;
    font-size: 12px;
    font-family: 'Courier New', monospace;
    color: #00ffff;
    backdrop-filter: blur(5px);
    z-index: 3;
  }

  .layer-indicator {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 3;

    .layer-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: rgba(0, 0, 0, 0.8);
      border-radius: 4px;
      font-size: 12px;
      backdrop-filter: blur(5px);

      .layer-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }

      &.cad-layer {
        border: 1px solid #00ffff;
        color: #00ffff;

        .layer-dot {
          background: #00ffff;
        }
      }

      &.track-layer {
        border: 1px solid #00ff80;
        color: #00ff80;

        .layer-dot {
          background: #00ff80;
        }
      }
    }
  }
}

.control-panel {
  position: absolute;
  right: 8px;
  top: 88px;
  bottom: 48px;
  width: 320px;
  background: rgba(26, 26, 46, 0.95);
  border: 1px solid #3a3a5e;
  border-radius: 12px;
  backdrop-filter: blur(20px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  transition: transform 0.3s ease;
  z-index: 50;
  display: flex;

  &.collapsed {
    transform: translateX(calc(100% - 32px));
  }

  .panel-toggle {
    width: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(26, 26, 46, 0.95);
    border-right: 1px solid #3a3a5e;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: rgba(42, 42, 62, 0.95);
    }

    .el-icon {
      font-size: 20px;
      color: #00ffff;
    }
  }

  .panel-content {
    flex: 1;
    padding: 16px;
    overflow-y: auto;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: rgba(42, 42, 62, 0.5);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(0, 255, 255, 0.5);
      border-radius: 3px;

      &:hover {
        background: rgba(0, 255, 255, 0.7);
      }
    }
  }

  .panel-section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 16px 0;
    font-size: 14px;
    font-weight: 600;
    color: #00ffff;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .layer-controls {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .layer-control-item {
      display: flex;
      align-items: center;
      gap: 8px;

      .layer-name {
        font-size: 13px;
        font-weight: 500;

        &.cad-color {
          color: #00ffff;
        }

        &.track-color {
          color: #00ff80;
        }
      }
    }
  }

  .control-group {
    margin-bottom: 20px;

    .control-label {
      display: block;
      margin-bottom: 8px;
      font-size: 13px;
      color: #b0b0c0;
    }

    .control-input-group {
      display: flex;
      gap: 10px;
      align-items: center;

      .el-slider {
        flex: 1;
      }

      .el-input-number {
        width: 100px;
      }
    }
  }

  .control-point-info {
    padding: 12px;
    background: rgba(74, 144, 255, 0.1);
    border: 1px solid rgba(74, 144, 255, 0.3);
    border-radius: 6px;
    margin-top: 12px;

    .info-text {
      margin: 4px 0;
      font-size: 12px;
      color: #c0c0d0;
      line-height: 1.5;
    }
  }

  .control-points-list {
    .control-point-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      margin-bottom: 8px;
      background: rgba(42, 42, 62, 0.5);
      border: 1px solid #3a3a5e;
      border-radius: 6px;
      transition: all 0.2s;

      &:hover {
        background: rgba(42, 42, 62, 0.8);
        border-color: #4a4a6e;
      }

      .point-index {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #4a90ff;
        border-radius: 50%;
        font-size: 12px;
        font-weight: bold;
        color: #fff;
      }

      .point-coords {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 11px;
        font-family: 'Courier New', monospace;

        .point-cad {
          color: #00ffff;
        }

        .point-track {
          color: #00ff80;
        }
      }
    }
  }

  .error-info {
    .error-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 12px;
      margin-bottom: 6px;
      background: rgba(42, 42, 62, 0.5);
      border-radius: 4px;
      font-size: 12px;

      .error-label {
        color: #b0b0c0;
      }

      .error-value {
        color: #00ff80;
        font-weight: bold;
        font-family: 'Courier New', monospace;
      }
    }
  }

  .quick-actions {
    display: flex;
    gap: 8px;

    .el-button {
      flex: 1;
    }
  }
}

.bottom-statusbar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-top: 1px solid #2a2a3e;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.3);

  .status-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #a0a0b0;

    .el-icon {
      color: #00ffff;
    }
  }
}

:deep(.el-slider__runway) {
  background-color: rgba(74, 144, 255, 0.2);
}

:deep(.el-slider__bar) {
  background-color: #4a90ff;
}

:deep(.el-slider__button) {
  border-color: #4a90ff;
}

:deep(.el-input-number) {
  .el-input__wrapper {
    background-color: rgba(42, 42, 62, 0.8);
    border-color: #3a3a5e;
  }

  .el-input__inner {
    color: #e0e0e0;
  }
}

:deep(.el-radio-group) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:deep(.el-radio) {
  margin-right: 0;
  color: #b0b0c0;

  &.is-checked {
    .el-radio__label {
      color: #00ffff;
    }
  }
}

:deep(.el-checkbox) {
  color: #b0b0c0;

  &.is-checked {
    .el-checkbox__label {
      color: #00ffff;
    }
  }
}

:deep(.el-divider) {
  border-color: #3a3a5e;
  margin: 16px 0;
}
</style>
