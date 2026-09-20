<template>
  <div class="small-window" :class="{ 'is-collapsed': isCollapsed }">
    <!-- 头部：标题和控制按钮 -->
    <div class="small-window-header">
      <template v-if="!isCollapsed">
        <!-- 标题 -->
        <span class="window-title">{{ title }}</span>
        <!-- 操作按钮组 -->
        <div class="header-actions">
          <!-- 收起按钮 -->
          <el-button
            size="small"
            text
            circle
            @click="toggleCollapse"
            title="收起"
          >
            <el-icon><ArrowLeft /></el-icon>
          </el-button>
          <!-- 全屏按钮 -->
          <el-button
            size="small"
            text
            circle
            @click="toggleFullscreen"
            :title="isFullscreen ? '退出全屏' : '全屏查看'"
          >
            <el-icon v-if="!isFullscreen"><FullScreen /></el-icon>
            <el-icon v-else><Close /></el-icon>
          </el-button>
        </div>
      </template>
      <!-- 收起状态只显示展开按钮 -->
      <template v-else>
        <el-button
          size="small"
          text
          circle
          @click="toggleCollapse"
          title="展开"
        >
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </template>
    </div>

    <!-- 内容区：CAD查看器 -->
    <div v-show="!isCollapsed" class="small-window-content" ref="cadRoot">
      <!-- 空状态提示 -->
      <div v-if="!cadViewer" class="empty-state">
        <el-icon class="empty-icon"><Picture /></el-icon>
        <p>{{ emptyText }}</p>
      </div>
      <!-- CAD查看器容器 -->
      <div
        ref="cadContainer"
        class="cad-container"
        :class="{ 'cad-loaded': cadViewer }"
      ></div>
    </div>

    <!-- 全屏遮罩层 -->
    <div
      v-if="isFullscreen"
      class="fullscreen-overlay"
      @click="onOverlayClick"
    >
      <div class="small-window is-fullscreen" @click.stop>
        <!-- 全屏模式头部 -->
        <div class="small-window-header">
          <span class="window-title">{{ title }}</span>
          <el-button
            size="small"
            text
            circle
            @click="toggleFullscreen"
            title="退出全屏"
          >
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
        <!-- 全屏模式内容区 -->
        <div class="small-window-content" ref="cadRootFullscreen">
          <div
            ref="cadContainerFullscreen"
            class="cad-container"
            :class="{ 'cad-loaded': cadViewer }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  onMounted,
  onBeforeUnmount,
  watch,
  nextTick,
  markRaw,
} from 'vue'
import { ElMessage } from 'element-plus'
import {
  FullScreen,
  Close,
  Picture,
  ArrowLeft,
  ArrowRight,
} from '@element-plus/icons-vue'
import { DxfViewer } from 'dxf-viewer'
import * as THREE from 'three'
import type {
  TrajectoryInfo,
  TrajectoryPoint,
  AlignmentResult,
} from '@/api/calibration'

// ============================================
// Props 定义
// ============================================
const props = defineProps({
  /** 标题 */
  title: {
    type: String,
    default: '图纸轨迹',
  },
  /** 空状态提示文字 */
  emptyText: {
    type: String,
    default: '加载后显示',
  },
  /** CAD文件Blob URL */
  dxfBlobUrl: {
    type: String,
    default: null,
  },
  /** 轨迹数据 */
  trajectoryData: {
    type: Object as () => TrajectoryInfo | null,
    default: null,
  },
  /** 对齐数据 */
  alignment: {
    type: Object as () => AlignmentResult | null,
    default: null,
  },
})

// ============================================
// Emits 定义
// ============================================
const emit = defineEmits<{
  /** 点击轨迹点事件 */
  (e: 'pointClick', point: TrajectoryPoint): void
}>()

// ============================================
// 组件状态
// ============================================
/** 收起状态 */
const isCollapsed = ref(false)
/** 全屏状态 */
const isFullscreen = ref(false)
/** 组件销毁标志 */
let destroyed = false

// ============================================
// DOM 引用
// ============================================
const cadRoot = ref<HTMLDivElement>()
const cadContainer = ref<HTMLDivElement>()
const cadRootFullscreen = ref<HTMLDivElement>()
const cadContainerFullscreen = ref<HTMLDivElement>()

// ============================================
// CAD 查看器相关状态
// ============================================
const cadViewer = ref<any>(null)
const cadOrigin = ref<{ x: number; y: number } | null>(null)
const cadOverlayLine = ref<THREE.Line | null>(null) // 轨迹线
const cadTrajectoryPoints = ref<THREE.Points | null>(null) // 轨迹点集合
const cadHighlightSphere = ref<THREE.Mesh | null>(null) // 高亮选中的点

type CadBounds = { minX: number; maxX: number; minY: number; maxY: number }

const CAD_VIEW_PADDING = 0.12

// ============================================
// 辅助函数：安全释放 Material
// ============================================
const disposeMaterial = (material: THREE.Material | THREE.Material[]) => {
  if (Array.isArray(material)) {
    material.forEach((m) => m.dispose())
  } else {
    material.dispose()
  }
}

const waitForNextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

const isValidCadBounds = (bounds: CadBounds | null | undefined) => {
  if (!bounds) return false
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  return (
    Number.isFinite(bounds.minX) &&
    Number.isFinite(bounds.maxX) &&
    Number.isFinite(bounds.minY) &&
    Number.isFinite(bounds.maxY) &&
    width >= 0 &&
    height >= 0 &&
    width + height > 0
  )
}

const getCadSceneBounds = (): CadBounds | null => {
  const bounds = cadViewer.value?.GetBounds?.() as CadBounds | null
  if (!isValidCadBounds(bounds)) return null

  const origin = cadViewer.value?.GetOrigin?.()
  const originX = Number.isFinite(origin?.x) ? origin.x : 0
  const originY = Number.isFinite(origin?.y) ? origin.y : 0

  return {
    minX: bounds.minX - originX,
    maxX: bounds.maxX - originX,
    minY: bounds.minY - originY,
    maxY: bounds.maxY - originY,
  }
}

const waitForCadBounds = async (maxFrames = 30) => {
  for (let i = 0; i < maxFrames; i += 1) {
    const bounds = getCadSceneBounds()
    if (bounds) return bounds
    await waitForNextFrame()
  }
  return null
}

const fitCadView = (bounds: CadBounds) => {
  if (!cadViewer.value) return

  try {
    const width = bounds.maxX - bounds.minX
    const height = bounds.maxY - bounds.minY
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2
    const container = isFullscreen.value
      ? cadContainerFullscreen.value
      : cadContainer.value
    const aspect =
      container && container.clientWidth > 0 && container.clientHeight > 0
        ? container.clientWidth / container.clientHeight
        : 1
    const viewWidth = Math.max(width, height * aspect)

    if (Number.isFinite(viewWidth) && viewWidth > 0) {
      cadViewer.value.SetView(
        new THREE.Vector3(centerX, centerY, 0),
        viewWidth * (1 + CAD_VIEW_PADDING),
      )
    }

    cadViewer.value.Render?.()
  } catch (setError) {
    console.warn('[SmallWindow] SetView失败:', setError)
  }
}

// ============================================
// 辅助函数：应用对齐变换
// 将点云坐标转换为CAD坐标
// ============================================
const applyAlignment = (
  alignmentData: AlignmentResult,
  x: number,
  y: number,
) => {
  const theta = ((alignmentData.thetaDegrees ?? 0) * Math.PI) / 180
  const s = alignmentData.scale ?? 1
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)
  return {
    x: s * (cosT * x - sinT * y) + (alignmentData.tx ?? 0),
    y: s * (sinT * x + cosT * y) + (alignmentData.ty ?? 0),
  }
}

// ============================================
// 初始化 CAD 查看器
// isFullscreenMode: 是否全屏模式
// ============================================
const initCadViewer = async (isFullscreenMode = false) => {
  if (destroyed) return
  if (cadViewer.value) {
    return
  }

  const container = isFullscreenMode
    ? cadContainerFullscreen.value
    : cadContainer.value

  if (!container) {
    console.error('[SmallWindow] CAD容器DOM元素不存在')
    return
  }

  container.innerHTML = ''
  await new Promise((resolve) => requestAnimationFrame(resolve))

  try {
    // 根据模式设置容器尺寸
    const containerWidth = container.clientWidth || (isFullscreenMode ? 800 : 320)
    const containerHeight = container.clientHeight || (isFullscreenMode ? 600 : 168)

    const viewer = new DxfViewer(container, {
      canvasWidth: containerWidth,
      canvasHeight: containerHeight,
      autoResize: true,
      antialias: true,
      colorCorrection: true,
      clearColor: new THREE.Color('#ffffff'),
      clearAlpha: 1,
    })

    cadViewer.value = markRaw(viewer)

    // 订阅点击事件：检测轨迹点
    cadViewer.value.Subscribe('pointerdown', (event: any) => {
      if (destroyed) return

      const pos = event?.detail?.position
      const origin = cadOrigin.value || cadViewer.value?.GetOrigin?.()
      if (!pos || !origin) return

      const cadX = pos.x + origin.x
      const cadY = pos.y + origin.y

      // 查找最近的轨迹点
      const hit = findNearestTrajectoryPoint(cadX, cadY)
      if (hit) {
        console.log('[SmallWindow] 点击到轨迹点:', hit.imageName)
        highlightTrajectoryPoint(hit)
        emit('pointClick', hit)
      } else {
        console.log('[SmallWindow] 未点击到轨迹点:', cadX.toFixed(2), cadY.toFixed(2))
      }
    })
  } catch (error) {
    console.error('[SmallWindow] DXF查看器初始化失败:', error)
    cadViewer.value = null
  }
}

// ============================================
// 加载 CAD 文件
// ============================================
const loadDxf = async () => {
  if (destroyed || !props.dxfBlobUrl) return

  try {
    await initCadViewer(isFullscreen.value)

    if (destroyed || !cadViewer.value) {
      console.warn('[SmallWindow] 查看器未初始化或已销毁')
      return
    }

    try {
      cadViewer.value.Clear()
    } catch (e) {
      console.warn('[SmallWindow] 清空查看器失败:', e)
    }

    await cadViewer.value.Load({
      url: props.dxfBlobUrl,
      fonts: [],
      workerFactory: null,
    })

    // 设置视图居中。这里只调整相机视图，不改变 CAD/轨迹的实际坐标。
    const bounds = await waitForCadBounds()
    if (bounds) {
      fitCadView(bounds)
    }

    cadOrigin.value = cadViewer.value.GetOrigin()

    // 渲染轨迹
    renderTrajectory()
  } catch (error) {
    console.error('[SmallWindow] CAD加载失败:', error)
    ElMessage.error('CAD图纸加载失败')
  }
}

// ============================================
// 查找最近的轨迹点（CAD坐标）
// ============================================
const findNearestTrajectoryPoint = (
  cadX: number,
  cadY: number,
): TrajectoryPoint | null => {
  if (
    !props.trajectoryData?.points?.length ||
    !props.alignment ||
    !cadViewer.value
  ) {
    return null
  }

  const cam = cadViewer.value.GetCamera()
  const canvas = cadViewer.value.GetCanvas()

  if (!cam || !canvas) return null

  // 计算点击阈值：15个像素对应的世界坐标距离
  const viewWidth = (cam.right - cam.left) / (cam.zoom || 1)
  const unitsPerPixel = viewWidth / canvas.width
  const threshold = unitsPerPixel * 15
  const thr2 = threshold * threshold

  let best: TrajectoryPoint | null = null
  let bestD2 = thr2

  for (const p of props.trajectoryData.points) {
    const tp = applyAlignment(props.alignment, p.x, p.y)
    const dx = tp.x - cadX
    const dy = tp.y - cadY
    const d2 = dx * dx + dy * dy

    if (d2 < bestD2) {
      bestD2 = d2
      best = p
    }
  }

  return best
}

// ============================================
// 高亮选中的轨迹点
// ============================================
const highlightTrajectoryPoint = (point: TrajectoryPoint) => {
  if (!cadViewer.value || !props.alignment) return

  const scene = cadViewer.value.GetScene()
  const origin = cadOrigin.value || cadViewer.value.GetOrigin()
  if (!origin) return

  // 应用对齐变换，获取CAD坐标
  const tp = applyAlignment(props.alignment, point.x, point.y)
  const cadSceneX = tp.x - origin.x
  const cadSceneY = tp.y - origin.y

  // 如果已存在高亮点，移动位置；否则创建新的
  if (cadHighlightSphere.value) {
    cadHighlightSphere.value.position.set(cadSceneX, cadSceneY, 0.01)
  } else {
    const circleGeometry = new THREE.CircleGeometry(150, 150)
    const circleMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      side: THREE.FrontSide,
    })
    const circle = new THREE.Mesh(circleGeometry, circleMaterial)
    circle.position.set(cadSceneX, cadSceneY, 0.01)
    scene.add(circle)
    // markRaw 防止 Vue 代理导致 scene.remove() 无法找到对象
    cadHighlightSphere.value = markRaw(circle)
  }

  cadViewer.value.Render()
}

// ============================================
// 渲染轨迹线和轨迹点
// ============================================
const renderTrajectory = () => {
  if (destroyed || !cadViewer.value) return

  const scene = cadViewer.value.GetScene()
  const origin = cadOrigin.value || cadViewer.value.GetOrigin()

  // 清理旧的轨迹线
  if (cadOverlayLine.value) {
    try {
      scene.remove(cadOverlayLine.value)
      cadOverlayLine.value.geometry.dispose()
      disposeMaterial(cadOverlayLine.value.material)
    } catch (error) {
      console.error('[SmallWindow] 清理轨迹线失败:', error)
    }
    cadOverlayLine.value = null
  }

  // 清理旧的轨迹点
  if (cadTrajectoryPoints.value) {
    try {
      scene.remove(cadTrajectoryPoints.value)
      cadTrajectoryPoints.value.geometry.dispose()
      disposeMaterial(cadTrajectoryPoints.value.material)
    } catch (error) {
      console.error('[SmallWindow] 清理轨迹点失败:', error)
    }
    cadTrajectoryPoints.value = null
  }

  // 清理高亮点
  if (cadHighlightSphere.value) {
    try {
      scene.remove(cadHighlightSphere.value)
      cadHighlightSphere.value.geometry.dispose()
      disposeMaterial(cadHighlightSphere.value.material)
    } catch (error) {
      console.error('[SmallWindow] 清理高亮点失败:', error)
    }
    cadHighlightSphere.value = null
  }

  // 检查数据完整性
  if (!props.trajectoryData?.points?.length || !props.alignment || !origin) {
    cadViewer.value.Render()
    return
  }

  // 转换轨迹点坐标
  const pts = props.trajectoryData.points.map((p) => {
    const tp = applyAlignment(props.alignment!, p.x, p.y)
    return new THREE.Vector3(tp.x - origin.x, tp.y - origin.y, 0)
  })

  // 创建轨迹线
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(pts)
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x00ff88,
    linewidth: 2,
  })
  const line = new THREE.Line(lineGeometry, lineMaterial)
  scene.add(line)
  // markRaw 防止 Vue 代理导致 scene.remove() 无法识别对象（多条轨迹叠加的根因）
  cadOverlayLine.value = markRaw(line)

  // 创建轨迹点
  const pointsGeometry = new THREE.BufferGeometry().setFromPoints(pts)
  const pointsMaterial = new THREE.PointsMaterial({
    color: 0x00ff88,
    size: 2,
    sizeAttenuation: false,
  })
  const points = new THREE.Points(pointsGeometry, pointsMaterial)
  scene.add(points)
  cadTrajectoryPoints.value = markRaw(points)

  cadViewer.value.Render()
}

// ============================================
// 清理所有 Three.js 资源
// ============================================
const cleanup = () => {
  destroyed = true

  // 清理轨迹线
  if (cadOverlayLine.value && cadViewer.value) {
    try {
      const scene = cadViewer.value.GetScene()
      if (scene) scene.remove(cadOverlayLine.value)
      cadOverlayLine.value.geometry.dispose()
      disposeMaterial(cadOverlayLine.value.material)
    } catch (error) {
      console.error('[SmallWindow] 清理轨迹线失败:', error)
    }
    cadOverlayLine.value = null
  }

  // 清理轨迹点
  if (cadTrajectoryPoints.value && cadViewer.value) {
    try {
      const scene = cadViewer.value.GetScene()
      if (scene) scene.remove(cadTrajectoryPoints.value)
      cadTrajectoryPoints.value.geometry.dispose()
      disposeMaterial(cadTrajectoryPoints.value.material)
    } catch (error) {
      console.error('[SmallWindow] 清理轨迹点失败:', error)
    }
    cadTrajectoryPoints.value = null
  }

  // 清理高亮点
  if (cadHighlightSphere.value && cadViewer.value) {
    try {
      const scene = cadViewer.value.GetScene()
      if (scene) scene.remove(cadHighlightSphere.value)
      cadHighlightSphere.value.geometry.dispose()
      disposeMaterial(cadHighlightSphere.value.material)
    } catch (error) {
      console.error('[SmallWindow] 清理高亮点失败:', error)
    }
    cadHighlightSphere.value = null
  }

  // 清理 CAD 查看器
  if (cadViewer.value) {
    try {
      cadViewer.value.Unsubscribe('pointerdown')
      cadViewer.value.Destroy()
    } catch (error) {
      console.error('[SmallWindow] 清理DXF查看器失败:', error)
    }
    cadViewer.value = null
  }

  cadOrigin.value = null
}

// ============================================
// 切换收起/展开状态
// ============================================
const toggleCollapse = async () => {
  isCollapsed.value = !isCollapsed.value

  // 展开时重新加载 CAD
  if (!isCollapsed.value && props.dxfBlobUrl) {
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 100))

    // 销毁旧的 viewer
    if (cadViewer.value) {
      try {
        cadViewer.value.Unsubscribe('pointerdown')
        cadViewer.value.Destroy()
      } catch (e) {
        console.warn('[SmallWindow] 销毁CAD查看器失败:', e)
      }
      cadViewer.value = null
    }

    await loadDxf()
  }
}

const setCollapsed = async (value: boolean) => {
  const nextValue = Boolean(value)
  if (isCollapsed.value === nextValue) return
  isCollapsed.value = nextValue
  if (isCollapsed.value) {
    isFullscreen.value = false
    return
  }

  if (props.dxfBlobUrl) {
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 100))

    if (cadViewer.value) {
      try {
        cadViewer.value.Unsubscribe('pointerdown')
        cadViewer.value.Destroy()
      } catch (e) {
        console.warn('[SmallWindow] 销毁CAD查看器失败:', e)
      }
      cadViewer.value = null
    }

    await loadDxf()
  }
}

// ============================================
// 切换全屏状态
// ============================================
const toggleFullscreen = async () => {
  const wasFullscreen = isFullscreen.value
  isFullscreen.value = !isFullscreen.value

  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 100))

  // 销毁旧的 viewer
  if (cadViewer.value) {
    try {
      cadViewer.value.Unsubscribe('pointerdown')
      cadViewer.value.Destroy()
    } catch (e) {
      console.warn('[SmallWindow] 销毁CAD查看器失败:', e)
    }
    cadViewer.value = null
  }

  // 重新加载 CAD
  if (props.dxfBlobUrl) {
    await loadDxf()
  }
}

// ============================================
// 点击遮罩层关闭全屏
// ============================================
const onOverlayClick = () => {
  if (isFullscreen.value) {
    isFullscreen.value = false
    nextTick(() => {
      window.dispatchEvent(new Event('resize'))
    })
  }
}

// ============================================
// 暴露方法给父组件
// ============================================
defineExpose({
  /** 高亮指定轨迹点 */
  highlightPoint: highlightTrajectoryPoint,
  /** 清除高亮 */
  clearHighlight: () => {
    if (cadHighlightSphere.value && cadViewer.value) {
      try {
        const scene = cadViewer.value.GetScene()
        scene.remove(cadHighlightSphere.value)
        cadHighlightSphere.value.geometry.dispose()
        disposeMaterial(cadHighlightSphere.value.material)
      } catch (error) {
        console.error('[SmallWindow] 清除高亮失败:', error)
      }
      cadHighlightSphere.value = null
      cadViewer.value.Render()
    }
  },
  setCollapsed,
})

// ============================================
// Watch 监听 props 变化
// ============================================
// 监听 CAD 文件 URL 变化
watch(
  () => props.dxfBlobUrl,
  (newUrl) => {
    if (newUrl && !isCollapsed.value) {
      loadDxf()
    }
  },
)

// 监听轨迹数据或对齐数据变化，重新渲染轨迹
watch(
  () => [props.trajectoryData, props.alignment],
  () => {
    if (props.dxfBlobUrl && !isCollapsed.value) {
      renderTrajectory()
    }
  },
  { deep: true },
)

// ============================================
// 生命周期
// ============================================
onMounted(() => {
  destroyed = false
  // 如果已有 CAD 文件，自动加载
  if (props.dxfBlobUrl) {
    loadDxf()
  }
})

onBeforeUnmount(() => {
  cleanup()
})

</script>

<style lang="scss" scoped>
.small-window {
  /** 基础样式 */
  width: 100%;
  height: 160px;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid #e8e8e8;

  /** 全屏模式 */
  &.is-fullscreen {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 80vw;
    height: 60vh;
    max-width: 1000px;
    z-index: 9999;
  }

  /** 收起状态 */
  &.is-collapsed {
    float: right;
    width: 40px;
    height: 40px;
    min-width: 40px;
    border-radius: 4px;

    .small-window-header {
      padding: 4px;
      justify-content: center;
      height: 100%;

      .header-actions {
        display: none;
      }
    }

    .small-window-content {
      display: none;
    }
  }

  /** 头部样式 */
  .small-window-header {
    flex-shrink: 0;
    padding: 8px 12px;
    background: #fafafa;
    border-bottom: 1px solid #e8e8e8;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 40px;
    box-sizing: border-box;

    .window-title {
      font-size: 13px;
      color: #333;
      font-weight: 500;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .el-button {
      padding: 4px;
      color: #999;

      &:hover {
        color: #409eff;
        background: #f5f5f5;
      }

      .el-icon {
        font-size: 14px;
      }
    }
  }

  /** 内容区样式 */
  .small-window-content {
    flex: 1;
    position: relative;
    background: #fafafa;
    overflow: hidden;

    .empty-state {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #c0c0c0;
      font-size: 12px;

      .empty-icon {
        font-size: 32px;
        margin-bottom: 6px;
      }

      p {
        margin: 0;
      }
    }

    .cad-container {
      width: 100%;
      height: 100%;
      background: #fff;
      display: none;
      overflow: hidden;

      &.cad-loaded {
        display: block;
      }

      :deep(canvas) {
        max-width: 100% !important;
        max-height: 100% !important;
      }
    }
  }

  /** 全屏遮罩 */
  .fullscreen-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 9998;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
  }
}
</style>
