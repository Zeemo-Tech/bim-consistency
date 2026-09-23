<template>
  <section class="asset-preview-page" :class="`theme-${backgroundTheme}`">
    <header class="bim-preview-header">
      <button class="preview-button" type="button" @click="handleClose">
        <el-icon><ArrowLeft /></el-icon>
        <span>返回</span>
      </button>
      <div class="bim-file-context">
        <strong :title="fileName">{{ fileName || 'BIM 模型预览' }}</strong>
        <span :title="projectName">
          {{ projectName || (projectId ? `项目 ${projectId}` : '模型预览') }}
        </span>
      </div>
      <div class="bim-header-tools">
        <span class="toolbar-label">测量</span>
        <MeasurementToolbar
          v-model:collapsed="analysisToolbarCollapsed"
          :mode="analysisMode"
          :disabled="!hasModel"
          @update:mode="selectAnalysisMode"
          @clear="clearAnalysis"
        />
        <button
          class="preview-button"
          type="button"
          :disabled="!hasModel"
          @click="resetView"
        >
          <el-icon><RefreshLeft /></el-icon>
          <span>重置视角</span>
        </button>
        <button
          class="preview-button icon-btn"
          :class="{ 'is-active': showComponentTree }"
          type="button"
          title="构件树"
          aria-label="构件树"
          @click="toggleComponentTree"
        >
          <el-icon><Grid /></el-icon>
        </button>
        <button
          class="preview-button icon-btn"
          type="button"
          title="全屏"
          aria-label="全屏"
          @click="toggleFullscreen"
        >
          <el-icon><FullScreen /></el-icon>
        </button>
      </div>
    </header>

    <!-- 加载遮罩 -->
    <div v-if="isLoading" class="loading-mask">
      <div class="loading-content">
        <div class="loading-spinner" />
        <p>{{ loadingMessage }}</p>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="errorMessage" class="error-container">
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

    <div
      class="layout-shell"
      :class="{ 'is-sidebar-collapsed': sidebarCollapsed }"
    >
      <div class="viewer-region" :class="`theme-${backgroundTheme}`">
        <div ref="viewerContainerRef" class="three-viewer-container" />

        <!-- 测量工具条 -->
        <div v-if="analysisMode !== 'none'" class="measure-analysis-toolbar">
          <strong>{{ analysisTitle }}</strong>
          <span v-if="analysisSummary" class="measure-analysis-value">
            {{ analysisSummary }}
          </span>
          <span v-else class="measure-analysis-hint">{{ analysisHint }}</span>
          <span class="measure-analysis-exit">Esc 退出测量</span>
          <button type="button" @click="clearAnalysis">清除</button>
        </div>

        <!-- 测量结果徽章 -->
        <div class="measure-badges">
          <div
            v-for="badge in measureBadges"
            v-show="badge.visible"
            :key="badge.id"
            class="measure-badge"
            :style="{ transform: `translate(${badge.x}px, ${badge.y}px)` }"
          >
            <header @pointerdown="startBadgeDrag(badge, $event)">
              <span class="measure-badge__dots" aria-hidden="true" />
              <span class="measure-badge__title">{{ badge.title }}</span>
            </header>
            <div v-if="badge.mainValue" class="measure-badge__main">
              <span>{{ badge.mainLabel }}</span>
              <strong>{{ badge.mainValue }}</strong>
            </div>
            <div v-if="badge.rows.length" class="measure-badge__rows">
              <div v-for="row in badge.rows" :key="row.label">
                <span>{{ row.label }}</span>
                <span>{{ row.value }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 构件树面板 -->
        <div v-if="showComponentTree" class="component-tree-panel">
          <div class="panel-header">
            <span class="panel-title">构件树</span>
            <div class="panel-count">{{ treeNodeCount }} 个节点</div>
            <el-button
              text
              circle
              size="small"
              @click="showComponentTree = false"
            >
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
          <div ref="treeContainerRef" class="tree-container">
            <el-tree
              v-if="treeData.length > 0"
              ref="treeRef"
              :data="treeData"
              :props="treeProps"
              node-key="id"
              :current-node-key="selectedTreeNodeKey"
              :default-expanded-keys="defaultExpandedKeys"
              :highlight-current="true"
              :expand-on-click-node="false"
              show-checkbox
              @node-click="handleNodeClick"
              @check="handleCheckChange"
              @current-change="handleCurrentChange"
            >
              <template #default="{ node, data }">
                <div
                  class="tree-node-content"
                  :class="{ 'is-selected': selectedTreeNodeKey === data.id }"
                >
                  <span class="node-label">{{ node.label }}</span>
                  <el-tag
                    v-if="data.stepId"
                    size="small"
                    type="info"
                    class="node-step-id"
                  >
                    #{{ data.stepId }}
                  </el-tag>
                </div>
              </template>
            </el-tree>
            <div v-else class="tree-empty">
              <el-empty description="暂无构件数据" :image-size="60" />
            </div>
          </div>
          <!-- 选中构件信息 -->
          <div v-if="selectedElementMeta" class="meta-box">
            <div class="meta-title">
              {{ selectedElementMeta.name || selectedElementMeta.id }}
            </div>
            <div class="meta-sub">
              <span class="pill">{{ selectedElementMeta.type }}</span>
              <span v-if="selectedElementMeta.stepId" class="pill">
                #{{ selectedElementMeta.stepId }}
              </span>
              <el-tag size="small" type="primary">
                {{ selectedElementMeta.id }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>

      <aside
        class="sidebar"
        :class="{ 'is-collapsed': sidebarCollapsed }"
        aria-label="模型工具"
      >
        <div class="sidebar-heading">
          <h2 v-if="!sidebarCollapsed">模型工具</h2>
          <button
            class="preview-button icon-btn"
            type="button"
            :title="sidebarCollapsed ? '展开模型工具' : '收起模型工具'"
            :aria-label="sidebarCollapsed ? '展开模型工具' : '收起模型工具'"
            @click="sidebarCollapsed = !sidebarCollapsed"
          >
            <el-icon>
              <ArrowLeft v-if="sidebarCollapsed" />
              <DArrowRight v-else />
            </el-icon>
          </button>
        </div>

        <div v-show="!sidebarCollapsed" class="sidebar-sections">
          <!-- 模型与网格 -->
          <section class="tool-section">
            <h3>模型与网格</h3>
            <div
              class="model-view-options"
              role="group"
              aria-label="模型显示内容"
            >
              <button
                class="preview-button"
                :class="{ 'is-active': !remeshVisible }"
                type="button"
                :disabled="!hasModel || remeshBusy"
                @click="toggleRemesh(false)"
              >
                原始 IFC
              </button>
              <button
                class="preview-button"
                :class="{ 'is-active': remeshVisible }"
                type="button"
                :disabled="!hasModel || !remeshReady || remeshBusy"
                @click="toggleRemesh(true)"
              >
                网格结果
              </button>
            </div>
            <p
              class="mesh-status"
              role="status"
              :class="{
                'is-ready': remeshReady,
                'is-error': remeshStatus?.status === 'failed',
              }"
            >
              {{ remeshStatusText }}
            </p>
            <table
              v-if="remeshReady && remeshStats"
              class="mesh-stats"
              aria-label="网格均匀化前后统计"
            >
              <thead>
                <tr>
                  <th scope="col">几何统计</th>
                  <th scope="col">原始 IFC</th>
                  <th scope="col">网格结果</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">顶点</th>
                  <td>{{ remeshStats.vertexBefore.toLocaleString() }}</td>
                  <td>{{ remeshStats.vertexAfter.toLocaleString() }}</td>
                </tr>
                <tr>
                  <th scope="row">三角面</th>
                  <td>{{ remeshStats.faceBefore.toLocaleString() }}</td>
                  <td>{{ remeshStats.faceAfter.toLocaleString() }}</td>
                </tr>
              </tbody>
            </table>
            <div class="mesh-actions">
              <button
                class="preview-button primary-button"
                type="button"
                :disabled="!remeshCanRun || remeshBusy"
                @click="retryRemesh"
              >
                {{ remeshActionText }}
              </button>
              <button
                class="preview-button"
                type="button"
                :disabled="remeshBusy || remeshRunning"
                @click="refreshRemeshStatus"
              >
                刷新状态
              </button>
            </div>
            <p v-if="remeshError" role="alert" class="error-message">
              {{ remeshError }}
            </p>
            <p class="section-note">
              {{
                remeshVisible
                  ? '橙色模型为均匀化结果；开启线框可检查三角网格。'
                  : '切换网格结果后，可用线框检查网格化效果。'
              }}
            </p>
            <label class="toggle-row">
              <span>线框模式</span>
              <el-switch
                v-model="bimControls.wireframe"
                aria-label="线框模式"
              />
            </label>
          </section>

          <!-- 剖切 -->
          <section class="tool-section">
            <h3>剖切</h3>
            <label class="toggle-row">
              <span>启用剖切</span>
              <el-switch
                v-model="bimControls.sectionEnabled"
                aria-label="启用剖切"
              />
            </label>
            <p class="section-note">
              开启后拖拽模型外侧的 6 个方向箭头，调整剖切范围。
            </p>
          </section>

          <!-- 辅助显示 -->
          <section class="tool-section">
            <h3>辅助显示</h3>
            <label class="toggle-row">
              <span>坐标轴</span>
              <el-switch v-model="bimControls.showAxes" aria-label="坐标轴" />
            </label>
            <label class="toggle-row">
              <span>参考网格</span>
              <el-switch v-model="bimControls.showGrid" aria-label="参考网格" />
            </label>
          </section>

          <!-- 画布背景 -->
          <section class="tool-section">
            <h3>画布背景</h3>
            <div class="background-options" role="group" aria-label="画布背景">
              <button
                v-for="option in backgroundOptions"
                :key="option.value"
                class="preview-button theme-chip"
                :class="{ 'is-active': backgroundTheme === option.value }"
                type="button"
                @click="backgroundTheme = option.value"
              >
                <span
                  class="theme-swatch"
                  :class="`theme-swatch-${option.value}`"
                />
                {{ option.label }}
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onActivated, onDeactivated, onBeforeUnmount, nextTick, watch, defineComponent, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Close,
  RefreshLeft,
  FullScreen,
  ArrowLeft,
  Grid,
  Warning,
  DArrowRight
} from '@element-plus/icons-vue'
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js'
import { Line2 } from 'three/examples/jsm/lines/webgpu/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { InfiniteGroundGrid } from '@/utils/three/infiniteGroundGrid'
import MeasurementToolbar from './MeasurementToolbar.vue'

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import {
  MeshBasicNodeMaterial,
  MeshLambertNodeMaterial,
  ClippingGroup,
  Line2NodeMaterial,
  WebGPURenderer,
} from 'three/webgpu'
import { color as tslColor, vertexColor as tslVertexColor } from 'three/tsl'

// 导入API
import { getIfcGlbFile, getIfcMetadata } from '@/api/fileManage'
import {
  getRemeshStatus,
  remeshBimFile,
  getRemeshResultUrl,
  type RemeshStats,
  type RemeshStatusResponse
} from '@/api/mesh'
import { getToken, formatToken, getOrganizationId } from '@/utils/auth'

// 获取路由参数
const route = useRoute()
const router = useRouter()

let loadToken = 0
let isDeactivatedFlag = false
const isStale = (token: number) => isDeactivatedFlag || token !== loadToken

// 项目ID和文件ID从路由参数获取
// 注意：projectId 从 query 获取，fileId 从 params 获取
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

defineOptions({
  name: 'PreviewFile'
})

// 加载状态
const isLoading = ref(true)
const loadingMessage = ref('正在加载预览...')
const errorMessage = ref('')

// 文件信息
const fileType = ref<'bim' | 'cad' | 'scan' | null>(null)
const fileName = ref('')

// 项目名称（来自路由 query）
const projectName = computed(() => {
  const name = route.query.projectName
  return typeof name === 'string' ? name : ''
})

// 画布背景主题
type PreviewBackgroundTheme = 'deep' | 'light' | 'black' | 'gradient'
const backgroundTheme = ref<PreviewBackgroundTheme>('deep')
const backgroundOptions: Array<{
  label: string
  value: PreviewBackgroundTheme
}> = [
  { label: '蓝色', value: 'gradient' },
  { label: '深色', value: 'deep' },
  { label: '浅色', value: 'light' },
  { label: '纯黑', value: 'black' }
]
const sidebarCollapsed = ref(false)

// 模型工具开关
const bimControls = reactive({
  showAxes: true,
  showGrid: true,
  wireframe: false,
  sectionEnabled: false
})

// 网格均匀化（保形网格）状态
const remeshStatus = ref<RemeshStatusResponse | null>(null)
const remeshStats = ref<RemeshStats | null>(null)
const remeshSubmitting = ref(false)
const remeshLoading = ref(false)
const remeshVisible = ref(false)
const remeshError = ref('')
let remeshTimer: ReturnType<typeof setTimeout> | undefined
let remeshGroup: THREE.Group | null = null
let axesHelper: THREE.AxesHelper | null = null
let gridHelper: InfiniteGroundGrid | null = null
let originalModelCenter: THREE.Vector3 | null = null

// Three.js渲染相关实例
const viewerContainerRef = ref<HTMLDivElement | null>(null)
let renderer: WebGPURenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let contentGroup: THREE.Group | null = null
let clippingGroup: ClippingGroup | null = null
let resizeObserver: ResizeObserver | null = null
let animationHandle: number | null = null
let raycaster: THREE.Raycaster | null = null

// WebGPU支持状态
const webgpuSupported = ref(false)

// 构件树相关状态
const metadata = ref<any | null>(null)
const showComponentTree = ref(false)
const expandedTreeNodeIds = ref<Set<string>>(new Set())
const selectedTreeNodeKey = ref<string>('')
const selectedMetaId = ref<string>('')
const enableElementPicking = ref(true)
const treeBoxEl = ref<HTMLElement | null>(null)
const pickedElement = ref<{ label: string; ifcId: string; sourceLabel: string } | null>(null)
const treeContainerRef = ref<HTMLElement | null>(null)
const treeRef = ref<any>(null)
let highlightedElement: {
  mesh: THREE.Mesh
  material: THREE.Material
  overlay?: THREE.Mesh
} | null = null

// el-tree 相关状态
const treeData = ref<any[]>([])
const treeProps = {
  label: 'label',
  children: 'children',
  isLeaf: (data: any) => !data.children || data.children.length === 0
}
const defaultExpandedKeys = ref<string[]>([])

// 材质模式：original-原始材质，unlit-TSL无光照材质，lambert-TSL Lambert光照材质
// const materialMode = ref<'original' | 'unlit' | 'lambert'>('unlit')

// 显示包围盒
const showBounds = ref(false)
const hasModel = ref(false)
const clippingEnabled = ref(false)
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
}
const activeClipAxis = ref<ClipAxisKey>('z')
const activeClipInvert = ref(false)
const clipBoundsDisabledReason = computed(() => {
  if (showBounds.value) return ''
  if (!hasModel.value) return '请先加载 BIM 模型'
  return ''
})
const clipBoundsTooltip = computed(() => {
  return clipBoundsDisabledReason.value || '裁切框'
})
let clipBoxState: ClipBoxState | null = null
let clipBoxHelper: THREE.Box3Helper | null = null
let clipHandlesGroup: THREE.Group | null = null
const clipHandlePickers: THREE.Object3D[] = []
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

// 节点计数
const treeNodeCount = computed(() => {
  let count = 0
  const traverse = (nodes: any[]) => {
    for (const node of nodes) {
      count++
      if (node.children && node.children.length > 0) {
        traverse(node.children)
      }
    }
  }
  traverse(treeData.value)
  return count
})

// 处理节点点击
function handleNodeClick(data: any, node: any) {
  selectedTreeNodeKey.value = data.id
  selectedMetaId.value = data.id

  // 高亮 3D 构件
  highlightElementById(data.id)

  // 设置高亮节点
  treeRef.value?.setCurrentKey(data.id)
}

// 处理选中变化
function handleCurrentChange(data: any, node: any) {
}

// 处理复选框变化
function handleCheckChange(data: any, { checkedKeys, halfCheckedKeys }: any) {
  // 获取所有选中的节点（包括半选中的父节点）- 这些节点应该显示
  const allVisibleKeys = [...checkedKeys, ...halfCheckedKeys]

  // 控制构件显示/隐藏
  setNodesVisibility(allVisibleKeys)
}

// 设置节点可见性
function setNodesVisibility(visibleIds: string[]) {
  if (!contentGroup) return

  const visibleSet = new Set(visibleIds)

  contentGroup.traverse((obj: any) => {
    if (obj.isMesh && obj.name) {
      // 检查 mesh.name 是否在可见列表中
      const isVisible = visibleSet.has(obj.name)
      if (obj.visible !== isVisible) {
        obj.visible = isVisible
      }
    }
  })

  requestRender()
}

// el-tree 引用方法
function getTreeNode(key: string) {
  return treeRef.value?.getNode(key)
}

function getCheckedNodes(leafOnly = false) {
  return treeRef.value?.getCheckedNodes(leafOnly) || []
}

function getCheckedKeys(leafOnly = false) {
  return treeRef.value?.getCheckedKeys(leafOnly) || []
}

function setCheckedNodes(nodes: any[]) {
  treeRef.value?.setCheckedNodes(nodes)
}

function setCheckedKeys(keys: string[]) {
  treeRef.value?.setCheckedKeys(keys)
}

// 渲染状态
const materialMode = ref<'original' | 'unlit' | 'lambert'>('unlit')

// 全屏状态
const isFullscreen = ref(false)

// Three.js辅助函数

// 材质缓存（避免重复创建）
const unlitMaterialCache = new Map<any, { v0?: any; v1?: any }>()
const lambertMaterialCache = new Map<any, { v0?: any; v1?: any }>()
const originalMaterialByTSL = new Map<any, any>()

/** 作用：释放材质 */
function disposeMaterial(material: any) {
  if (!material) return
  material.dispose?.()
}

/** 作用：把原材质上影响透明/双面的通用标志同步到替换材质上。 */
function applySharedMaterialFlags(mat: any, src: any) {
  const alphaTest = src?.alphaTest ?? 0
  const opacity = src?.opacity ?? 1
  mat.alphaTest = alphaTest
  mat.opacity = opacity
  mat.transparent = alphaTest > 0 ? false : !!src?.transparent || opacity < 1
  mat.side = src?.side ?? THREE.FrontSide
}

/** 作用：获取或创建与源材质对应的 TSL Unlit 材质（按 vertexColors 分缓存）。 */
function getOrCreateUnlitTSLMaterial(src: any, opts: { vertexColors: boolean }) {
  const entry = unlitMaterialCache.get(src) ?? {}
  const cached = opts.vertexColors ? entry.v1 : entry.v0
  if (cached) return cached

  const mat = new MeshBasicNodeMaterial()
  mat.name = src?.name ? `${src.name} (TSL Unlit)` : 'TSL Unlit'
  mat.fog = false
  mat.lights = false

  applySharedMaterialFlags(mat, src)
  mat.toneMapped = false

  const hasVertexColors = opts.vertexColors || src?.vertexColors
  if (hasVertexColors) {
    mat.colorNode = tslVertexColor()
    mat.vertexColors = true
  } else {
    mat.colorNode = tslColor(src?.color ?? 0xffffff)
    mat.vertexColors = false
  }

  originalMaterialByTSL.set(mat, src)
  ;(mat as any).__viewerOriginalMaterial = src
  if (opts.vertexColors) entry.v1 = mat
  else entry.v0 = mat
  unlitMaterialCache.set(src, entry)

  return mat
}

/** 作用：获取或创建与源材质对应的 TSL Lambert 材质（按 vertexColors 分缓存）。 */
function getOrCreateLambertTSLMaterial(src: any, opts: { vertexColors: boolean }) {
  const entry = lambertMaterialCache.get(src) ?? {}
  const cached = opts.vertexColors ? entry.v1 : entry.v0
  if (cached) return cached

  const mat = new MeshLambertNodeMaterial()
  mat.name = src?.name ? `${src.name} (TSL Lambert)` : 'TSL Lambert'
  mat.fog = false

  applySharedMaterialFlags(mat, src)
  mat.toneMapped = true

  const hasVertexColors = opts.vertexColors || src?.vertexColors
  if (hasVertexColors) {
    mat.colorNode = tslVertexColor()
    mat.vertexColors = true
  } else {
    mat.colorNode = tslColor(src?.color ?? 0xffffff)
    mat.vertexColors = false
  }

  originalMaterialByTSL.set(mat, src)
  ;(mat as any).__viewerOriginalMaterial = src
  if (opts.vertexColors) entry.v1 = mat
  else entry.v0 = mat
  lambertMaterialCache.set(src, entry)

  return mat
}

/** 作用：在整个 root 上切换材质模式（original / unlit / lambert）。 */
function applyMaterialMode(root: any, mode: 'original' | 'unlit' | 'lambert') {
  let changed = 0

  root.traverse((obj: any) => {
    if (!obj?.material) return
    if (Array.isArray(obj.material)) return

    if (mode === 'original') {
      // 恢复原始材质
      const original =
        (obj.material as any)?.__viewerOriginalMaterial ??
        originalMaterialByTSL.get(obj.material) ??
        obj.material.userData?.__originalMaterial
      if (original && obj.material !== original) {
        obj.material = original
        changed++
      }
      return
    }

    // TSL 模式：创建或复用 TSL 材质
    const src =
      (obj.material as any)?.__viewerOriginalMaterial ??
      originalMaterialByTSL.get(obj.material) ??
      obj.material.userData?.__originalMaterial ??
      obj.material
    const opts = { vertexColors: !!obj.geometry?.attributes?.color }
    const next =
      mode === 'lambert' ? getOrCreateLambertTSLMaterial(src, opts) : getOrCreateUnlitTSLMaterial(src, opts)

    if (obj.material !== next) {
      obj.material = next
      changed++
    }
  })

  return changed
}

/** 作用：材质模式切换事件处理 */
function onMaterialModeChange() {
  if (!contentGroup) return
  clearHighlight()
  applyMaterialMode(contentGroup, materialMode.value)
  requestRender()
}

function setMaterialMode(mode: 'original' | 'unlit' | 'lambert') {
  if (materialMode.value === mode || !hasModel.value) return
  materialMode.value = mode
  onMaterialModeChange()
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

function cloneBox3(box: THREE.Box3) {
  return new THREE.Box3(box.min.clone(), box.max.clone())
}

function getContentWorldBox() {
  if (!contentGroup) return null
  contentGroup.updateMatrixWorld?.(true)
  const box = new THREE.Box3().setFromObject(contentGroup)
  return box.isEmpty() ? null : box
}

function getClipOffsetKey(axis: ClipAxisKey, invert: boolean) {
  return `${axis}${invert ? 'Max' : 'Min'}` as keyof ClipBoxOffsets
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
  if (!clipBoxState) {
    clipBoxState = {
      baseBox: cloneBox3(baseBox),
      offsets: createDefaultClipOffsets(),
    }
    return clipBoxState
  }
  clipBoxState.baseBox.copy(baseBox)
  clampClipOffsets(clipBoxState)
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

function clearBoundsHelpers() {
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
  if (!scene) return
  clearBoundsHelpers()
  if (!showBounds.value) {
    requestRender()
    return
  }

  const helperBox =
    clippingEnabled.value && hasModel.value
      ? getCurrentClipBox()
      : getContentWorldBox()
  if (!helperBox || helperBox.isEmpty()) {
    requestRender()
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

  if (clippingEnabled.value) {
    clipHandlesGroup = buildClipHandles(helperBox)
    scene.add(clipHandlesGroup)
  }
  requestRender()
}

function applyClippingState() {
  if (!clippingGroup) return

  clippingGroup.enabled = false
  const planes = clippingGroup.clippingPlanes as any
  if (Array.isArray(planes)) planes.length = 0
  else clippingGroup.clippingPlanes = []

  const activeBox =
    clippingEnabled.value && hasModel.value && showBounds.value
      ? getCurrentClipBox()
      : null
  if (!activeBox) {
    requestRender()
    return
  }

  clippingGroup.enabled = true
  clippingGroup.clippingPlanes.push(
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -activeBox.min.x),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), activeBox.max.x),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -activeBox.min.y),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), activeBox.max.y),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -activeBox.min.z),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), activeBox.max.z),
  )
  requestRender()
}

function onShowBoundsChange() {
  if (showBounds.value) {
    if (!hasModel.value) {
      showBounds.value = false
      return
    }
    clippingEnabled.value = true
    ensureClipState()
  } else {
    clippingEnabled.value = false
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
  const rect = renderer?.domElement?.getBoundingClientRect?.()
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
  if (!raycaster || !camera || !clipBoxHelper) return null
  const ndc = getPointerNdc(ev)
  if (!ndc) return null

  raycaster.params.Line = raycaster.params.Line ?? { threshold: 1 }
  raycaster.params.Line.threshold = 0.2
  raycaster.setFromCamera(ndc, camera)

  if (clipHandlePickers.length) {
    const handleHits = raycaster.intersectObjects(clipHandlePickers, true)
    const handleHit = handleHits[0] as any
    if (handleHit?.object?.userData?.__viewerClipHandle) {
      return {
        kind: 'handle',
        axis: handleHit.object.userData.axis,
        invert: !!handleHit.object.userData.invert,
      }
    }
  }

  const lineHits = raycaster.intersectObject(clipBoxHelper, true)
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
  if (!raycaster || !camera || !renderer) return
  activeClipAxis.value = options.axis
  activeClipInvert.value = options.invert
  clippingEnabled.value = true
  applyClippingState()
  updateBoundsHelpers()

  const ndc = getPointerNdc(ev)
  const box = getCurrentClipBox()
  if (!ndc || !box) return
  raycaster.setFromCamera(ndc, camera)

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
  if (!raycaster.ray.intersectPlane(dragPlane, startPoint)) return

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
  renderer.domElement.setPointerCapture?.(ev.pointerId)
  if (controls) controls.enabled = false
}

function onClipDragMove(ev: PointerEvent) {
  if (!clipDragState || !raycaster || !camera) return
  const ndc = getPointerNdc(ev)
  if (!ndc) return
  raycaster.setFromCamera(ndc, camera)
  const point = new THREE.Vector3()
  if (!raycaster.ray.intersectPlane(clipDragState.dragPlane, point)) return

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
  setClipFacePosition(
    clipDragState.axis,
    clipDragState.invert,
    nextPosition,
  )
  activeClipAxis.value = clipDragState.axis
  activeClipInvert.value = clipDragState.invert
  applyClippingState()
  updateBoundsHelpers()
  requestRender()
}

function endClipDrag(ev?: PointerEvent) {
  if (clipDragState && renderer?.domElement && ev) {
    try {
      renderer.domElement.releasePointerCapture?.(clipDragState.pointerId)
    } catch {
      // ignore pointer capture release errors
    }
  }
  clipDragState = null
  if (controls) controls.enabled = true
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
    return
  }
  // 测量模式：记录按下位置，抬起时（未拖动）才提交，避免旋转视角时误加点
  if (analysisMode.value !== 'none') {
    measurePointerDown = { x: event.clientX, y: event.clientY }
    return
  }
  onModelClick(event)
}

function onViewerPointerMove(event: PointerEvent) {
  if (!clipDragState) return
  consumePointerEvent(event)
  onClipDragMove(event)
}

function onViewerPointerUp(event: PointerEvent) {
  if (clipDragState) {
    consumePointerEvent(event)
    endClipDrag(event)
    return
  }
  const down = measurePointerDown
  measurePointerDown = null
  if (!down || analysisMode.value === 'none') return
  if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) return
  handleMeasureClick(event)
}
/** 作用：创建高亮 overlay 材质（TSL 模式下确保可见） */
function createHighlightOverlayMaterial(color: THREE.Color): THREE.Material {
  const mat: any = materialMode.value === 'lambert'
    ? new MeshLambertNodeMaterial()
    : new MeshBasicNodeMaterial()
  mat.name = 'Pick Highlight'
  mat.transparent = true
  mat.opacity = 0.65
  mat.depthTest = false
  mat.depthWrite = false
  mat.polygonOffset = true
  mat.polygonOffsetFactor = -1
  mat.polygonOffsetUnits = -1
  mat.toneMapped = false

  if ('colorNode' in mat) {
    mat.colorNode = tslColor(color)
    mat.vertexColors = false
    mat.needsUpdate = true
  } else if (mat.color) {
    mat.color.copy(color)
  }

  return mat
}

/** 作用：创建高亮材质（原始方式，用于 original 模式） */
function createHighlightMaterial(color: THREE.Color): THREE.Material {
  if (materialMode.value === 'lambert') {
    const mat = new MeshLambertNodeMaterial()
    mat.colorNode = tslColor(color)
    mat.transparent = true
    mat.opacity = 0.65
    mat.depthTest = false
    mat.depthWrite = false
    return mat
  }
  const mat = new MeshBasicNodeMaterial()
  mat.colorNode = tslColor(color)
  mat.transparent = true
  mat.opacity = 0.65
  mat.depthTest = false
  mat.depthWrite = false
  return mat
}

/** 作用：清除高亮并恢复原始状态 */
function clearHighlight() {
  if (highlightedElement) {
    const { mesh, overlay, material } = highlightedElement

    if (overlay) {
      // Overlay 方式：移除 overlay mesh
      mesh.remove(overlay)
      disposeMaterial(material)
    } else {
      // 原始方式：恢复原始材质
      mesh.material = highlightedElement.material as THREE.Material
      disposeMaterial(material)
    }

    highlightedElement = null
  }
}

/** 作用：对普通 Mesh 以 overlay 方式做高亮（避免材质 clone/循环引用问题） */
function highlightMeshWithOverlay(mesh: any, color: THREE.Color) {
  if (!mesh?.isMesh) return

  const mat = createHighlightOverlayMaterial(color)
  const overlay = new THREE.Mesh(mesh.geometry, mat)
  overlay.name = 'Pick Highlight Overlay'
  overlay.userData = overlay.userData ?? {}
  overlay.userData.__viewerPickIgnore = true
  overlay.frustumCulled = false
  overlay.matrixAutoUpdate = false
  overlay.renderOrder = 9998
  overlay.matrix.identity()
  overlay.matrixWorldNeedsUpdate = true
  mesh.add(overlay)

  highlightedElement = {
    mesh,
    material: mat,
    overlay: overlay
  }
}

/** 作用：以 overlay 方式高亮 Mesh */
function highlightMesh(mesh: any, color: THREE.Color) {
  // TSL 模式使用 overlay mesh 方案
  if (materialMode.value !== 'original') {
    highlightMeshWithOverlay(mesh, color)
    return
  }

  // original 模式直接替换材质
  highlightedElement = {
    mesh,
    material: mesh.material as THREE.Material
  }
  mesh.material = createHighlightMaterial(color)
}

/** 作用：清除选择（用于点击空白处完全清除选择） */
function clearSelection() {
  clearHighlight()
  selectedMetaId.value = ''
  selectedTreeNodeKey.value = ''
  pickedElement.value = null
}

/** 作用：从对象 userData 中提取 elementId/GlobalId 等标识字段 */
function guessIfcId(userData: any): string | undefined {
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

// stepId → GlobalId 映射（用于 "#<STEP_ID>" 格式）
const elementIdByStepId = ref<Map<number, string>>(new Map())

/** 作用：构建 stepId → GlobalId 映射 */
function buildStepIdIndex(data: any) {
  const m = new Map<number, string>()
  const elements = data?.elements
  if (elements && typeof elements === 'object') {
    for (const [eid, meta] of Object.entries(elements)) {
      const step = Number((meta as any)?.stepId)
      if (Number.isFinite(step)) m.set(step, String(eid))
    }
  }
  elementIdByStepId.value = m
}

/** 作用：滚动树到指定节点位置 */
function scrollTreeToNodeKey(nodeKey: string) {
  if (!treeBoxEl.value) return
  const container = treeBoxEl.value
  const sel = `[data-node-key="${nodeKey}"]`
  const el = container.querySelector(sel) as HTMLElement | null
  if (el) {
    el.scrollIntoView({ block: 'center' })
  }
}

/** 作用：展开节点的所有祖先 */
function expandTreeToNodeKey(nodeKey: string) {
  const k = String(nodeKey ?? '')
  if (!k) return
  const next = new Set(expandedTreeNodeIds.value)
  let cur: string | null | undefined = k
  while (cur) {
    next.add(cur)
    cur = treeParentKeyByKey.value.get(cur) ?? null
  }
  expandedTreeNodeIds.value = next
}

// 构件树辅助数据结构
const treeNodeByKey = ref<Map<string, any>>(new Map())
const treeParentKeyByKey = ref<Map<string, string | null>>(new Map())

/** 作用：根据 elementId 选中树节点并展开 */
function selectTreeNodeForElementId(elementId: string) {
  const key = treePreferredNodeKeyByElementId.value.get(elementId) ?? ''
  if (!key) return false
  // selectedTreeNodeKey 使用 elementId（el-tree 的 node-key）
  selectedTreeNodeKey.value = elementId
  selectedMetaId.value = elementId
  // expandTreeToNodeKey 使用 __viewerNodeKey 展开祖先节点
  expandTreeToNodeKey(key)
  // 设置 el-tree 当前高亮节点，使用 elementId
  treeRef.value?.setCurrentKey(elementId)
  nextTick(() => scrollTreeToNodeKey(key))
  return true
}

/** 作用：获取元素的元数据 */
const selectedElementMeta = computed(() => {
  if (!metadata.value) return null
  const id = selectedMetaId.value
  if (!id) return null
  return (metadata.value as any).elements?.[id] ?? null
})

/** 作用：尝试根据各种 ID 格式选中元数据 */
function trySelectMetadataById(id: unknown): boolean {
  if (!metadata.value) return false
  const key = String(id ?? '').trim()
  if (!key) return false

  // 直接匹配 elements key
  const direct = (metadata.value as any).elements?.[key]
  if (direct) {
    selectedMetaId.value = key
    selectTreeNodeForElementId(key)
    return true
  }

  // 遍历查找
  const elements = (metadata.value as any).elements
  if (elements) {
    for (const [eid, meta] of Object.entries(elements)) {
      const m = meta as any
      if (m?.stepId === Number(key) || m?.id === key || m?.name === key) {
        selectedMetaId.value = eid
        selectTreeNodeForElementId(eid)
        return true
      }
    }
  }

  return false
}

// 优先节点映射
const treePreferredNodeKeyByElementId = ref<Map<string, string>>(new Map())

/** 作用：从元数据树构建节点索引 */
function buildTreeDescendantIndexFromMetadataTree(root: any) {
  if (!root || typeof root !== 'object') return

  const nodeByKey = new Map<string, any>()
  const parentKeyByKey = new Map<string, string | null>()
  const descendantsByKey = new Map<string, Set<string>>()
  const nodeKeysByElementId = new Map<string, string[]>()

  // DFS 生成节点 key
  const post: any[] = []
  const stack: Array<{ node: any; key: string; parentKey: string | null }> = [
    { node: root, key: '', parentKey: null },
  ]
  while (stack.length) {
    const entry = stack.pop()
    if (!entry) continue
    const n = entry?.node
    if (!n) continue
    const rawId = String(n.id ?? '').trim()
    const type = String(n.type ?? '')
    const localKey = entry?.key || `${type}:${rawId || ''}`
    n.__viewerNodeKey = localKey
    nodeByKey.set(localKey, n)
    parentKeyByKey.set(localKey, entry?.parentKey ?? null)
    post.push(n)
    const cs = n.children
    if (Array.isArray(cs)) {
      for (let i = cs.length - 1; i >= 0; i--) {
        const c = cs[i]
        if (!c) continue
        const childKey = `${localKey}/${i}:${String(c.type ?? '')}:${String(c.id ?? '')}`
        stack.push({ node: c, key: childKey, parentKey: localKey })
      }
    }
  }

  // 后序聚合
  for (let i = post.length - 1; i >= 0; i--) {
    const n = post[i]
    const rawId = String(n.id ?? '').trim()
    const nodeKey = String(n.__viewerNodeKey ?? '')
    if (!nodeKey) continue

    const set = new Set<string>()
    const cs = n.children
    if (Array.isArray(cs)) {
      for (const c of cs) {
        const childKey = String(c?.__viewerNodeKey ?? '')
        if (!childKey) continue
        const childSet = descendantsByKey.get(childKey)
        if (childSet) for (const x of childSet) set.add(x)
      }
    }

    // 如果是 element，添加到集合
    if (rawId && (metadata.value as any)?.elements?.[rawId]) {
      set.add(rawId)
      const list = nodeKeysByElementId.get(rawId) ?? []
      list.push(nodeKey)
      nodeKeysByElementId.set(rawId, list)
    }

    descendantsByKey.set(nodeKey, set)
  }

  treeNodeByKey.value = nodeByKey
  treeParentKeyByKey.value = parentKeyByKey

  // 选择优先节点
  const preferred = new Map<string, string>()
  for (const [eid, keys] of nodeKeysByElementId.entries()) {
    const sorted = keys.slice().sort((a, b) => {
      const aUnassigned = a.includes('__unassigned__') ? 1 : 0
      const bUnassigned = b.includes('__unassigned__') ? 1 : 0
      if (aUnassigned !== bUnassigned) return aUnassigned - bUnassigned
      return b.length - a.length
    })
    preferred.set(eid, sorted[0]!)
  }
  treePreferredNodeKeyByElementId.value = preferred
}

/** 作用：处理模型点击事件 */
function onModelClick(event: PointerEvent) {
  if (!enableElementPicking.value) return
  if (!renderer || !camera || !scene || !raycaster || !contentGroup) return

  const rect = renderer.domElement.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
// ts-ignore
  raycaster.setFromCamera({ x, y } as unknown as THREE.Vector2, camera)
  const intersects = raycaster.intersectObjects(contentGroup.children, true)

  if (intersects.length > 0) {
    // 找到点击的对象
    let clickedObject = intersects[0].object as any

    // 获取构件ID - 优先从 mesh.name 获取 GlobalId，其次从 userData 获取
    let elementId: string | undefined

    // 方式1: 从 mesh.name 获取 GlobalId（GLB 存储方式）
    if (clickedObject.name && /^[0-9A-Za-z_$]{22}$/.test(clickedObject.name)) {
      elementId = clickedObject.name
    }

    // 方式2: 从 userData 获取
    if (!elementId) {
      elementId = guessIfcId(clickedObject?.userData)
    }

    if (elementId) {
      // 清除之前的高亮
      clearHighlight()

      // 高亮当前构件
      if (clickedObject instanceof THREE.Mesh) {
        highlightedElement = {
          mesh: clickedObject,
          material: clickedObject.material as THREE.Material
        }
        clickedObject.material = createHighlightMaterial(new THREE.Color('#409eff'))
      }

      // 尝试选中元数据并联动树
      trySelectMetadataById(elementId)
      pickedElement.value = {
        label: clickedObject.name || clickedObject.userData?.name || '构件',
        ifcId: elementId,
        sourceLabel: clickedObject.userData?.__viewerLabel,
      }

      requestRender()
    }
  } else {
    // 点击空白处完全清除选择
    clearSelection()
    requestRender()
  }
}

// ==================== 模型工具（网格结果 / 背景 / 辅助显示 / 剖切） ====================

const remeshRunning = computed(() =>
  ['queued', 'processing'].includes(remeshStatus.value?.status || '')
)
const remeshReady = computed(
  () =>
    remeshStatus.value?.status === 'succeeded' &&
    Boolean(remeshStatus.value?.resultFileId)
)
const remeshBusy = computed(() => remeshSubmitting.value || remeshLoading.value)
const remeshCanRun = computed(() =>
  Boolean(
    remeshStatus.value?.supported &&
      !remeshRunning.value &&
      (remeshStatus.value.status === 'succeeded' ||
        remeshStatus.value.canManualRetry)
  )
)
const remeshActionText = computed(() => {
  if (remeshBusy.value) return '请稍候…'
  if (remeshRunning.value) return '正在生成网格…'
  if (remeshStatus.value?.status === 'succeeded') return '重新生成网格'
  if (remeshStatus.value?.status === 'failed') return '重试生成网格'
  return '生成网格'
})
const remeshStatusText = computed(() => {
  if (!remeshStatus.value) return '正在查询均匀化状态…'
  if (!remeshStatus.value.supported) return '当前模型不支持网格均匀化'
  switch (remeshStatus.value.status) {
    case 'queued':
      return '任务已排队，完成后自动显示保形网格'
    case 'processing':
      return '正在生成保形网格，完成后自动显示'
    case 'succeeded':
      return remeshReady.value
        ? remeshVisible.value
          ? '当前显示：保形网格'
          : '当前显示：原始模型；可开启保形网格'
        : '已有结果不可用，请重新生成网格'
    case 'failed':
      return '均匀化失败，可重试'
    default:
      return '尚未生成均匀化网格'
  }
})

/** 作用：为二进制资源请求构造鉴权头（PLY 结果等无法走 axios 拦截器） */
function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token?.accessToken) headers.Authorization = formatToken(token.accessToken)
  const orgId = getOrganizationId()
  if (orgId) headers['X-Organization-Id'] = String(orgId)
  return headers
}

/** 作用：应用画布背景主题 */
function applyBackgroundTheme() {
  const colorMap: Record<PreviewBackgroundTheme, string> = {
    deep: '#0b1020',
    light: '#e8eef6',
    black: '#000000',
    gradient: '#10213b'
  }
  const color = new THREE.Color(colorMap[backgroundTheme.value])
  if (scene) scene.background = color
  renderer?.setClearColor?.(color, 1)
  requestRender()
}

/** 作用：坐标轴 / 参考网格辅助显示（与 cloudBIM-viewer 保持一致） */
function applyHelpers() {
  if (!scene) return

  const box = contentGroup
    ? new THREE.Box3().setFromObject(contentGroup)
    : null
  const validBox = box && !box.isEmpty() ? box : null
  const modelSize = validBox ? validBox.getSize(new THREE.Vector3()) : null
  const maxDim = modelSize
    ? Math.max(modelSize.x, modelSize.y, modelSize.z, 0.001)
    : 15

  // 坐标轴：与 cloudBIM-viewer 预览模型页一致（AxesHelper、置于原点）；
  // 长度按模型尺寸自适应，保证像参考页一样贯穿画面（基准长度 15）。
  if (!axesHelper) {
    axesHelper = new THREE.AxesHelper(15)
    scene.add(axesHelper)
  }
  axesHelper.visible = bimControls.showAxes
  axesHelper.scale.setScalar((maxDim * 1.5) / 15)

  // 参考网格：无限地面网格
  if (!gridHelper) {
    gridHelper = new InfiniteGroundGrid()
    scene.add(gridHelper)
  }
  if (validBox) {
    gridHelper.setBounds(validBox)
  }
  gridHelper.visible = bimControls.showGrid
  if (gridHelper.visible && camera) {
    gridHelper.updateForCamera(camera)
  }
  requestRender()
}

/** 作用：切换线框模式（同时作用于原始模型与网格结果） */
function applyWireframe() {
  const apply = (root: THREE.Object3D | null) => {
    root?.traverse((obj: any) => {
      if (!obj?.isMesh) return
      const mat = obj.material
      if (Array.isArray(mat)) {
        mat.forEach((m: any) => {
          if (m) m.wireframe = bimControls.wireframe
        })
      } else if (mat) {
        mat.wireframe = bimControls.wireframe
      }
    })
  }
  apply(contentGroup)
  apply(remeshGroup)
  requestRender()
}

/** 作用：查询 BIM 网格均匀化状态（排队/处理中自动轮询） */
async function refreshRemeshStatus() {
  clearTimeout(remeshTimer)
  if (!projectId.value || !fileId.value) return
  try {
    const res = await getRemeshStatus(projectId.value, fileId.value)
    remeshStatus.value = res.data
    remeshError.value =
      res.data?.status === 'failed'
        ? res.data.lastError || '网格均匀化失败'
        : ''
    if (
      res.data?.supported &&
      ['queued', 'processing'].includes(res.data.status || '')
    ) {
      remeshTimer = setTimeout(() => void refreshRemeshStatus(), 4000)
    }
  } catch (error: any) {
    remeshError.value =
      error?.response?.data?.msg || error?.message || '查询均匀化状态失败'
  }
}

/** 作用：清理网格结果模型 */
function clearRemeshGroup() {
  if (!remeshGroup) return
  remeshGroup.parent?.remove(remeshGroup)
  remeshGroup.traverse((obj: any) => {
    obj.geometry?.dispose?.()
    const mat = obj.material
    if (Array.isArray(mat)) mat.forEach((m: any) => m?.dispose?.())
    else mat?.dispose?.()
  })
  remeshGroup = null
}

/** 作用：下载并加载网格均匀化结果（PLY）到场景 */
async function loadRemeshResult() {
  if (!projectId.value || !fileId.value || !scene) return
  remeshLoading.value = true
  remeshError.value = ''
  let blobUrl: string | null = null
  try {
    const url = getRemeshResultUrl(projectId.value, fileId.value)
    const resp = await fetch(url, {
      headers: buildAuthHeaders(),
      cache: 'no-store'
    })
    if (!resp.ok) throw new Error(`网格结果下载失败 HTTP ${resp.status}`)
    const blob = await resp.blob()
    blobUrl = URL.createObjectURL(blob)
    const geometry = await new PLYLoader().loadAsync(blobUrl)
    if (!geometry.attributes.normal) geometry.computeVertexNormals()
    geometry.computeBoundingBox()

    // 与原始 GLB 使用同一套坐标（原始模型加载时已按 center 平移）
    const center = originalModelCenter
      ? originalModelCenter.clone()
      : (geometry.boundingBox as THREE.Box3).getCenter(new THREE.Vector3())
    geometry.translate(-center.x, -center.y, -center.z)

    const material = new THREE.MeshStandardMaterial({
      color: 0xff8a3d,
      metalness: 0.1,
      roughness: 0.75,
      side: THREE.DoubleSide,
      wireframe: bimControls.wireframe
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = '__remesh_result__'
    remeshGroup = new THREE.Group()
    remeshGroup.name = '__remesh_group__'
    remeshGroup.add(mesh)
    scene.add(remeshGroup)
    requestRender()
  } catch (error: any) {
    remeshError.value = error?.message || '加载网格结果失败'
  } finally {
    if (blobUrl) URL.revokeObjectURL(blobUrl)
    remeshLoading.value = false
  }
}

/** 作用：在原始 IFC 与网格结果之间切换 */
async function toggleRemesh(visible = !remeshVisible.value) {
  if (remeshBusy.value || !hasModel.value || !remeshReady.value) return
  if (visible === remeshVisible.value) return

  if (visible) {
    await loadRemeshResult()
    if (remeshError.value) return
    remeshVisible.value = true
    if (contentGroup) contentGroup.visible = false
  } else {
    remeshVisible.value = false
    clearRemeshGroup()
    if (contentGroup) contentGroup.visible = true
  }
  requestRender()
}

/** 作用：提交（或重新提交）网格均匀化任务 */
async function retryRemesh() {
  if (!projectId.value || !fileId.value || !remeshCanRun.value || remeshBusy.value) {
    return
  }
  const force = remeshStatus.value?.status === 'succeeded'
  remeshSubmitting.value = true
  remeshError.value = ''
  try {
    const res = await remeshBimFile(projectId.value, fileId.value, {
      algorithm: 'bim_preprocessor',
      params: {},
      ...(force ? { force: true } : {})
    })
    if (res?.data?.stats) remeshStats.value = res.data.stats
    if (remeshVisible.value) await toggleRemesh(false)
    remeshStatus.value = {
      ...(remeshStatus.value || { supported: true, canManualRetry: false }),
      status: 'queued',
      canManualRetry: false
    }
    await refreshRemeshStatus()
    ElMessage.success('网格均匀化任务已提交，完成后可切换查看')
  } catch (error: any) {
    remeshError.value =
      error?.response?.data?.msg || error?.message || '提交均匀化任务失败'
    if (error?.response?.status === 409) await refreshRemeshStatus()
  } finally {
    remeshSubmitting.value = false
  }
}

// ==================== 测量工具（测距 / 定位 / 面积） ====================
type AnalysisMode = 'none' | 'distance' | 'locate' | 'area'
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
const analysisMode = ref<AnalysisMode>('none')
const analysisToolbarCollapsed = ref(true)
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
let modelMaxDim = 10

function ensureMeasureGroup(): THREE.Group | null {
  if (!scene) return null
  if (!measureGroup) {
    measureGroup = new THREE.Group()
    measureGroup.name = '__measure_group__'
    measureGroup.renderOrder = 10000
    scene.add(measureGroup)
  }
  return measureGroup
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
      toneMapped: false
    })
  )
  marker.center.set(0.5, 0.1)
  marker.renderOrder = 10002
  return marker
}

/** 作用：把图钉保持为屏幕空间固定像素大小 */
function scaleMeasurementPin(marker: THREE.Sprite, targetPixels = 16) {
  if (!camera || !renderer?.domElement || !marker.visible) return
  const rect = renderer.domElement.getBoundingClientRect()
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
  group?: THREE.Group | null
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
  dashed = true
) {
  const geometry = new LineGeometry()
  geometry.setPositions(points.flatMap((p) => [p.x, p.y, p.z]))
  const material = new Line2NodeMaterial({
    color,
    linewidth: 2.8,
    dashed,
    dashSize: 0.9,
    gapSize: 0.48,
    worldUnits: false,
    transparent: true,
    opacity: 0.96,
    depthTest: false,
    depthWrite: false
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
  badge: Omit<MeasureBadge, 'x' | 'y' | 'visible' | 'offset'>
) {
  measureBadges.value = [
    ...measureBadges.value,
    { ...badge, offset: { x: 0, y: 0 }, x: 0, y: 0, visible: false }
  ]
}

function updateMeasureBadges() {
  if (!camera || !renderer?.domElement || !measureBadges.value.length) return
  const rect = renderer.domElement.getBoundingClientRect()
  const projected = new THREE.Vector3()
  measureBadges.value = measureBadges.value.map((badge) => {
    projected.copy(badge.anchor).project(camera as THREE.PerspectiveCamera)
    return {
      ...badge,
      x: (projected.x * 0.5 + 0.5) * rect.width + 14 + badge.offset.x,
      y: (-projected.y * 0.5 + 0.5) * rect.height - 18 + badge.offset.y,
      visible: projected.z < 1
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
    moved: false
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
      : badge
  )
}

function endBadgeDrag(event: PointerEvent) {
  const drag = badgeDrag
  badgeDrag = null
  window.removeEventListener('pointermove', onBadgeDragMove)
  window.removeEventListener('pointerup', endBadgeDrag)
  // 点在徽章手柄上但没有拖动：仍视为一次测量点击
  if (drag && !drag.moved && analysisMode.value !== 'none') {
    handleMeasureClick(event)
  }
}

/** 作用：同步图钉大小（跟随相机/视口） */
function syncMeasureVisuals() {
  measureGroup?.traverse((child: any) => {
    if (child instanceof THREE.Sprite) scaleMeasurementPin(child)
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

function selectAnalysisMode(mode: AnalysisMode) {
  analysisMode.value = analysisMode.value === mode ? 'none' : mode
  distanceStart = null
  areaPoints = []
  removeAreaPreview()
}

function pickMeasurePoint(event: PointerEvent): THREE.Vector3 | null {
  if (!renderer || !camera || !raycaster) return null
  const ndc = getPointerNdc(event)
  if (!ndc) return null
  raycaster.setFromCamera(ndc, camera)
  const targets: THREE.Object3D[] = []
  if (contentGroup) targets.push(contentGroup)
  if (remeshGroup) targets.push(remeshGroup)
  const hits = raycaster.intersectObjects(targets, true)
  if (!hits.length) return null
  return snapMeasurePoint(hits[0].point.clone(), event)
}

/** 作用：吸附到已有测量点（18px 内），用于闭合区域/接续测量 */
function snapMeasurePoint(
  point: THREE.Vector3,
  event: PointerEvent
): THREE.Vector3 {
  if (!camera || !renderer?.domElement) return point
  const candidates: THREE.Vector3[] = [...areaPoints]
  if (distanceStart) candidates.push(distanceStart)
  measureBadges.value.forEach((badge) => candidates.push(badge.anchor))
  if (!candidates.length) return point

  const rect = renderer.domElement.getBoundingClientRect()
  const screenX = event.clientX - rect.left
  const screenY = event.clientY - rect.top
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

function handleMeasureClick(event: PointerEvent) {
  const point = pickMeasurePoint(event)
  if (!point) return

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
        { label: 'Z', value: formatLength(point.y) }
      ],
      anchor: point
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
          { label: '坡度', value: `${slope.toFixed(2)}°` }
        ],
        anchor: start.clone().add(point).multiplyScalar(0.5)
      })
      distanceStart = null
    }
  } else if (analysisMode.value === 'area') {
    const cameraRef = camera as THREE.PerspectiveCamera | null
    const closeThreshold = Math.max(
      0.15,
      (cameraRef?.position.distanceTo(point) ?? 1) * 0.025
    )
    // 与参考页一致：点击首个点附近即闭合区域
    if (
      areaPoints.length >= 3 &&
      point.distanceTo(areaPoints[0]) < closeThreshold
    ) {
      closeAreaMeasurement()
      requestRender()
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
  requestRender()
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
      3
    )
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
      side: THREE.DoubleSide
    })
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
          3
        )
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
          side: THREE.DoubleSide
        })
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
    anchor: centroid
  })
  areaPoints = []
  areaPreviewGroup = null
  requestRender()
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
  requestRender()
}

function onViewerDblClick() {
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
      : '全局定位'
)
const analysisHint = computed(() => {
  if (analysisMode.value === 'distance') return '依次点击两点完成一段测距'
  if (analysisMode.value === 'area') return '连续点击至少三个点，双击闭合区域'
  return '点击模型任意位置拾取坐标'
})
const analysisSummary = computed(() => {
  const latest = measureBadges.value.at(-1)
  return latest ? `${latest.mainLabel} ${latest.mainValue}` : ''
})

watch(analysisMode, (mode) => {
  if (renderer?.domElement) {
    renderer.domElement.style.cursor = mode === 'none' ? '' : 'crosshair'
  }
})

watch(backgroundTheme, () => applyBackgroundTheme())
watch(
  () => [bimControls.showAxes, bimControls.showGrid],
  () => applyHelpers()
)
watch(
  () => bimControls.wireframe,
  () => applyWireframe()
)
watch(
  () => bimControls.sectionEnabled,
  (enabled) => {
    if (enabled) {
      if (!hasModel.value) {
        bimControls.sectionEnabled = false
        ElMessage.warning('请先加载 BIM 模型')
        return
      }
      if (!showBounds.value) {
        showBounds.value = true
        onShowBoundsChange()
      }
    } else if (showBounds.value) {
      showBounds.value = false
      onShowBoundsChange()
    }
  }
)

/** 作用：重置相机视角 */
/** 重置视角（根据模型尺寸自适应） */
const resetView = () => {
  if (!camera || !controls || !contentGroup) return

  // 1️计算模型包围盒
  const box = new THREE.Box3().setFromObject(contentGroup)

  if (box.isEmpty()) return

  // 2️获取中心点 & 尺寸
  const center = new THREE.Vector3()
  const size = new THREE.Vector3()

  box.getCenter(center)
  box.getSize(size)

  // 3️根据模型尺寸计算合适距离
  const maxSize = Math.max(size.x, size.y, size.z)
  const fov = (camera.fov * Math.PI) / 180

  let distance = maxSize / (2 * Math.tan(fov / 2))
  distance *= 1.5 // 👈 再拉远一点，留边距

  // 4设置相机位置（保持当前视角方向）
  const direction = new THREE.Vector3()
    .subVectors(camera.position, controls.target)
    .normalize()

  camera.position.copy(
    center.clone().add(direction.multiplyScalar(distance))
  )

  // 5️更新控制器目标
  controls.target.copy(center)

  // 6️更新相机参数
  camera.near = distance / 100
  camera.far = distance * 100
  camera.updateProjectionMatrix()
  controls.update()

  ElMessage.success('视角已重置')
}

const toggleFullscreen = () => {
  if (!isFullscreen.value) {
    // 进入全屏
    const elem = document.documentElement
    if (elem.requestFullscreen) {
      elem.requestFullscreen()
    }
    isFullscreen.value = true
  } else {
    // 退出全屏
    if (document.exitFullscreen) {
      document.exitFullscreen()
    }
    isFullscreen.value = false
  }
}

const handleDownload = () => {
  // 实现文件下载功能
  ElMessage.info('下载功能待实现')
}

const handleClose = () => {
  // 返回上一页或跳转到文件管理页面
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/data/history-model')
  }
}

const handleRetry = () => {
  loadPreview()
}

// 监听全屏状态变化
const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement
}

// Three.js渲染循环
let renderRequested = false

function renderFrame() {
  renderRequested = false
  if (!renderer || !scene || !camera) return
  controls?.update?.()
  camera.updateMatrixWorld?.()
  if (gridHelper?.visible) gridHelper.updateForCamera(camera)
  renderer.render(scene, camera)
  updateMeasureBadges()
  syncMeasureVisuals()
}

function requestRender() {
  if (renderRequested) return
  renderRequested = true
  animationHandle = requestAnimationFrame(renderFrame)
}

// Three.js初始化
async function initThree() {
  // 等待DOM完全渲染
  await nextTick()
  await nextTick()
  await nextTick()

  const el = viewerContainerRef.value
  if (!el) {
    console.error('[Preview] 容器元素不存在')
    throw new Error('容器元素不存在')
  }

  let rect = el.getBoundingClientRect()
  for (let i = 0; i < 10 && (rect.width < 2 || rect.height < 2); i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    rect = el.getBoundingClientRect()
  }

  // 创建场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color('#0b1020')

  // 创建内容组
  contentGroup = new THREE.Group()
  clippingGroup = new ClippingGroup()
  scene.add(clippingGroup)
  clippingGroup.add(contentGroup)

  // 创建相机
  camera = new THREE.PerspectiveCamera(50, 1, 0.01, 5000)
  camera.position.set(0, 1.5, 4)

  // 创建WebGPU渲染器
  renderer = new WebGPURenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))
  renderer.setClearColor(0x0b1020, 1)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0

  el.appendChild(renderer.domElement)

  const initialWidth = Math.max(1, rect.width)
  const initialHeight = Math.max(1, rect.height)
  renderer.setSize(initialWidth, initialHeight)
  camera.aspect = initialWidth / initialHeight
  camera.updateProjectionMatrix()

  // 创建射线检测器
  raycaster = new THREE.Raycaster()

  // 创建控制器
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = false
  controls.minDistance = 0.1
  controls.maxDistance = 1000
  controls.addEventListener?.('change', requestRender)

  // 添加光照
  const ambient = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambient)

  const key = new THREE.DirectionalLight(0xffffff, 1.3)
  key.position.set(3, 6, 4)
  scene.add(key)

  const fill = new THREE.DirectionalLight(0x99bbff, 0.5)
  fill.position.set(-4, 2, -3)
  scene.add(fill)

  // 监听容器大小变化
  resizeObserver = new ResizeObserver(() => {
    if (!renderer || !camera || !el) return
    const { width, height } = el.getBoundingClientRect()
    if (width < 2 || height < 2) return
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25)
    renderer.setPixelRatio(dpr)
    renderer.setSize(Math.max(1, width), Math.max(1, height))
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    requestRender()
  })
  resizeObserver.observe(el)

  // 点击/拖拽事件处理
  renderer.domElement.addEventListener('pointerdown', onViewerPointerDown, true)
  renderer.domElement.addEventListener('pointermove', onViewerPointerMove)
  renderer.domElement.addEventListener('pointerup', onViewerPointerUp)
  renderer.domElement.addEventListener('pointercancel', onViewerPointerUp)
  renderer.domElement.addEventListener('dblclick', onViewerDblClick)

  // 初始化渲染器
  loadingMessage.value = '正在初始化渲染引擎...'
  await renderer.init()
  loadingMessage.value = '渲染引擎初始化完成'
  applyBackgroundTheme()
  applyClippingState()
  requestRender()
}

// 加载GLB模型
function loadGlbModel(blob: Blob, token: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isStale(token)) {
      resolve()
      return
    }

    if (!scene || !camera || !contentGroup) {
      console.error('[Preview] 渲染环境未初始化', { scene, camera, contentGroup })
      reject(new Error('渲染环境未初始化'))
      return
    }

    loadingMessage.value = '正在加载模型...'

    const url = URL.createObjectURL(blob)
    const loader = new GLTFLoader()

    loader.load(
      url,
      (gltf: any) => {
        try {
          if (isStale(token)) {
            URL.revokeObjectURL(url)
            resolve()
            return
          }

          const root = gltf?.scene ?? gltf?.scenes?.[0]
          if (!root) {
            errorMessage.value = '模型加载失败: 空场景'
            reject(new Error('空场景'))
            return
          }

          // 添加到场景
          contentGroup.add(root)

          // 保存原始材质到 userData（用于材质切换时恢复）
          root.traverse((obj: any) => {
            if (obj?.isMesh && obj.material && !Array.isArray(obj.material)) {
              if (!obj.material.userData) obj.material.userData = {}
              obj.material.userData.__originalMaterial = obj.material
              ;(obj.material as any).__viewerOriginalMaterial = obj.material
            }
          })

          // 应用当前材质模式（确保 WebGPU 剖切生效）
          applyMaterialMode(root, materialMode.value)

          // 调整视角以适应模型
          const box = new THREE.Box3().setFromObject(root)
          const size = box.getSize(new THREE.Vector3())
          const center = box.getCenter(new THREE.Vector3())

          root.position.sub(center)
          root.updateMatrixWorld?.(true)

          const maxDim = Math.max(size.x, size.y, size.z) || 1
          const fov = THREE.MathUtils.degToRad(camera!.fov)
          const distance = maxDim / 2 / Math.tan(fov / 2)

          // 记录原始中心与尺寸，供网格结果对齐、测量点尺寸使用
          originalModelCenter = center.clone()
          modelMaxDim = maxDim

          controls!.target.set(0, 0, 0)
          camera!.position.set(0, maxDim * 0.15, distance * 2.2)
          camera!.near = distance / 100
          camera!.far = distance * 100
          camera!.updateProjectionMatrix()
          controls!.update()

          loadingMessage.value = '模型加载完成'

          hasModel.value = true
          ensureClipState()
          updateBoundsHelpers()
          applyClippingState()

          isLoading.value = false

          // 应用辅助显示与网格均匀化状态
          applyHelpers()
          void refreshRemeshStatus()

          // 加载构件树元数据
          if (!isStale(token)) loadMetadata()

          URL.revokeObjectURL(url)
          resolve()
        } catch (err) {
          console.error('[Preview] 处理模型失败:', err)
          errorMessage.value = '处理模型失败'
          reject(err)
        }
      },
      (e: any) => {
        if (isStale(token)) return
        if (!e?.total) return
        const pct = Math.round((e.loaded / e.total) * 100)
        loadingMessage.value = `加载中: ${pct}%`
      },
      (err: unknown) => {
        if (isStale(token)) {
          URL.revokeObjectURL(url)
          resolve()
          return
        }
        console.error('[Preview] GLTFLoader加载失败:', err)
        errorMessage.value = '模型加载失败'
        isLoading.value = false
        reject(err)
      }
    )
  })
}

// 加载预览数据
const loadPreview = async () => {
  const token = ++loadToken
  isLoading.value = true
  errorMessage.value = ''
  loadingMessage.value = '正在加载预览...'

  try {
    disposeResources()
    if (isStale(token)) return

    // 检查WebGPU支持
    webgpuSupported.value = typeof navigator !== 'undefined' && 'gpu' in navigator
    if (!webgpuSupported.value) {
      errorMessage.value = '您的浏览器不支持WebGPU，请使用Chrome/Edge浏览器'
      isLoading.value = false
      return
    }

    // 初始化Three.js（内部会等待DOM渲染）
    loadingMessage.value = '正在初始化3D引擎...'
    await initThree()
    if (isStale(token)) return

    // 获取GLB文件
    if (!projectId.value) {
      console.error('[Preview] projectId 为空:', route.query.projectId)
      throw new Error('缺少项目ID，请确保从正确的入口访问')
    }
    if (!fileId.value) {
      console.error('[Preview] fileId 为空:', route.params.id)
      throw new Error('缺少文件ID，请确保从正确的入口访问')
    }

    loadingMessage.value = '正在获取模型文件...'
    // 使用封装好的API获取Blob
    const response = await getIfcGlbFile(projectId.value, fileId.value)
    if (isStale(token)) return

    if (response instanceof Blob) {
      await loadGlbModel(response, token)
    } else {
      console.error('[Preview] 响应不是Blob类型:', response)
      throw new Error('获取的文件格式不正确')
    }
  } catch (error: any) {
    if (isStale(token)) return
    console.error('[Preview] 预览加载失败:', error)
    errorMessage.value = error.message || '预览加载失败，请稍后重试'
    isLoading.value = false
  }
}

// 加载构件树元数据
async function loadMetadata() {
  if (!projectId.value || !fileId.value) return

  try {
    const data = await getIfcMetadata(projectId.value, fileId.value)
    if (data) {
      metadata.value = data

      // 构建 stepId → GlobalId 索引
      buildStepIdIndex(data)

      // 将元数据树转换为 el-tree 格式
      if (data.tree && typeof data.tree === 'object') {
        treeData.value = buildTreeNodes(data.tree, data.elements)

        // 构建树节点索引（用于3D点击同步到树）
        buildTreeDescendantIndexFromMetadataTree(data.tree)

        // 默认展开前两层
        defaultExpandedKeys.value = getDefaultExpandedKeys(treeData.value, 2)

        // 如果树面板已经显示，立即全选
        if (showComponentTree.value) {
          nextTick(() => {
            const allKeys = getAllNodeKeys(treeData.value)
            treeRef.value?.setCheckedKeys(allKeys)
          })
        }
      }
    }
  } catch (error) {
    console.error('[Preview] 加载构件树失败:', error)
  }
}

// 构建树节点
function buildTreeNodes(treeNode: any, elements: Record<string, any>): any[] {
  if (!treeNode || !Array.isArray(treeNode.children)) {
    return []
  }

  const result: any[] = []

  for (const child of treeNode.children) {
    const elementId = child.id
    const element = elements?.[elementId]

    const node: any = {
      id: elementId,
      label: child.name || element?.name || child.type || elementId,
      type: child.type || element?.type || '',
      stepId: element?.stepId,
      children: buildTreeNodes(child, elements)
    }

    result.push(node)
  }

  return result
}

// 获取默认展开的 keys
function getDefaultExpandedKeys(nodes: any[], maxDepth: number, currentDepth = 0): string[] {
  if (currentDepth >= maxDepth) return []

  const keys: string[] = []
  for (const node of nodes) {
    keys.push(node.id)
    if (node.children && node.children.length > 0) {
      keys.push(...getDefaultExpandedKeys(node.children, maxDepth, currentDepth + 1))
    }
  }
  return keys
}

// 获取所有节点的 key
function getAllNodeKeys(nodes: any[]): string[] {
  const keys: string[] = []
  const traverse = (ns: any[]) => {
    for (const node of ns) {
      keys.push(node.id)
      if (node.children && node.children.length > 0) {
        traverse(node.children)
      }
    }
  }
  traverse(nodes)
  return keys
}

/** 根据ID高亮构件 - 支持 expressID 和 GlobalId */
function highlightElementById(elementId: string): boolean {
  clearHighlight()

  if (!contentGroup) return false

  // 判断 elementId 是 GlobalId 还是 stepId
  const isGlobalId = /^[0-9A-Za-z_$]{22}$/.test(elementId)
  const isStepId = /^\d+$/.test(elementId)

  // 如果是 GlobalId，尝试找到对应的 stepId
  let targetStepId: number | null = null
  if (isGlobalId) {
    const elements = (metadata.value as any)?.elements
    if (elements) {
      for (const [eid, meta] of Object.entries(elements)) {
        if (eid === elementId) {
          targetStepId = Number((meta as any)?.stepId)
          break
        }
      }
    }
  }

  // 查找对应的 3D 模型并高亮
  let found = false
  contentGroup.traverse((obj: any) => {
    if (found) return
    if (obj.isMesh) {
      const meshName = obj.name
      const meshExpressId = Number(obj.userData?.expressID ?? obj.userData?.ExpressID ?? obj.userData?.expressId)

      let matched = false

      if (isGlobalId) {
        // 方式1: 直接匹配 mesh.name（GLB 使用 name 存储 GlobalId）
        if (meshName && String(meshName) === elementId) {
          matched = true
        }
        // 方式2: 通过 expressID → stepId → GlobalId 匹配
        if (!matched && Number.isFinite(meshExpressId) && targetStepId && meshExpressId === targetStepId) {
          matched = true
        }
      } else if (isStepId) {
        // 如果是 stepId（数字），尝试匹配 3D 对象的 expressID
        if (Number.isFinite(meshExpressId) && String(meshExpressId) === elementId) {
          matched = true
        }
      }

      if (matched && obj instanceof THREE.Mesh) {
        highlightedElement = {
          mesh: obj,
          material: obj.material as THREE.Material
        }
        obj.material = createHighlightMaterial(new THREE.Color('#409eff'))
        requestRender()
        found = true
      }
    }
  })

  return found
}

/** 作用：选中树节点并尝试高亮 3D 构件 */
function highlightAndFocusByElementId(elementId: string, options?: { focus?: boolean }): boolean {
  const highlighted = highlightElementById(elementId)
  return highlighted
}

/** 切换构件树显示 */
async function toggleComponentTree() {
  if (showComponentTree.value) {
    showComponentTree.value = false
  } else {
    // 如果还没有加载 metadata，则加载
    if (!metadata.value && projectId.value && fileId.value) {
      await loadMetadata()
    }
    showComponentTree.value = true
    // 等待树渲染完成后初始化默认选中状态
    // 使用 setTimeout 确保 DOM 已渲染
    setTimeout(() => {
      if (treeData.value.length > 0) {
        // 先展开
        const keys: string[] = []
        const traverse = (nodes: any[]) => {
          for (const node of nodes) {
            keys.push(node.id)
            if (node.children && node.children.length > 0) {
              traverse(node.children)
            }
          }
        }
        traverse(treeData.value)
        defaultExpandedKeys.value = keys
        // 全选
        treeRef.value?.setCheckedKeys(keys)
      }
    }, 200)
  }
}

// 清理资源
function disposeResources() {
  // 停止渲染循环
  if (animationHandle) {
    cancelAnimationFrame(animationHandle)
    animationHandle = null
  }

  // 清理高亮
  clearHighlight()

  // 清理包围盒辅助线
  clearBoundsHelpers()

  // 清理测量结果
  clearAnalysis()

  // 清理网格结果、辅助显示与定时器
  clearTimeout(remeshTimer)
  clearRemeshGroup()
  if (axesHelper) {
    scene?.remove(axesHelper)
    axesHelper.dispose?.()
    axesHelper = null
  }
  if (gridHelper) {
    scene?.remove(gridHelper)
    gridHelper.dispose()
    gridHelper = null
  }
  remeshStatus.value = null
  remeshStats.value = null
  remeshVisible.value = false
  remeshError.value = ''
  remeshSubmitting.value = false
  remeshLoading.value = false
  originalModelCenter = null

  // 清理Three.js资源
  resizeObserver?.disconnect()
  controls?.dispose()
  if (renderer?.domElement) {
    renderer.domElement.removeEventListener('pointerdown', onViewerPointerDown, true)
    renderer.domElement.removeEventListener('pointermove', onViewerPointerMove)
    renderer.domElement.removeEventListener('pointerup', onViewerPointerUp)
    renderer.domElement.removeEventListener('pointercancel', onViewerPointerUp)
    renderer.domElement.removeEventListener('dblclick', onViewerDblClick)
  }
  renderer?.dispose()
  renderer?.domElement?.remove()

  // 清理场景中的对象（WebGPU/NodeMaterial 在 dispose 时可能抛错，需兜底）
  try {
    scene?.traverse((obj: any) => {
      if (!obj?.isMesh) return

      try {
        obj.geometry?.dispose?.()
      } catch (error) {
        console.warn('[Preview] geometry.dispose 失败（忽略）:', error)
      }

      const mat = obj.material
      if (!mat) return

      if (Array.isArray(mat)) {
        mat.forEach((m: any) => {
          try {
            m?.dispose?.()
          } catch (error) {
            console.warn('[Preview] material.dispose 失败（忽略）:', error)
          }
        })
      } else {
        try {
          mat?.dispose?.()
        } catch (error) {
          console.warn('[Preview] material.dispose 失败（忽略）:', error)
        }
      }
    })
  } catch (error) {
    console.warn('[Preview] scene.traverse dispose 失败（忽略）:', error)
  }

  resizeObserver = null
  controls = null
  camera = null
  scene = null
  renderer = null
  contentGroup = null
  clippingGroup = null
  clipBoxState = null
  clipBoxHelper = null
  clipHandlesGroup = null
  clipHandlePickers.length = 0
  clipDragState = null
  raycaster = null
  hasModel.value = false
  showBounds.value = false
  clippingEnabled.value = false
  activeClipAxis.value = 'z'
  activeClipInvert.value = false
}

const syncFileInfoFromRoute = () => {
  const query = route.query
  fileName.value = (query.fileName as string) || ''
  fileType.value = (query.fileType as any) || null

  // 如果没有文件类型，尝试从文件名推断
  if (!fileType.value && fileName.value) {
    const ext = fileName.value.split('.').pop()?.toLowerCase()
    if (['ifc'].includes(ext || '')) {
      fileType.value = 'bim'
    } else if (['dwg', 'dxf'].includes(ext || '')) {
      fileType.value = 'cad'
    } else if (['las', 'laz', 'e57'].includes(ext || '')) {
      fileType.value = 'scan'
    }
  }
}



// 组件挂载
onMounted(() => {
  syncFileInfoFromRoute()

  // 开始加载预览
  loadPreview()

  // 监听全屏状态变化
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('keydown', onMeasureKeyDown)
})

onActivated(() => {
  isDeactivatedFlag = false
  if (route.name !== 'PreviewFile') return
  if (isLoading.value) return
  syncFileInfoFromRoute()
  nextTick().then(() => {
    if (!renderer) {
      loadPreview()
    } else {
      requestRender()
    }
  })
})

onDeactivated(() => {
  isDeactivatedFlag = true
  loadToken++
  disposeResources()
})

watch(
  () => [
    route.name,
    route.params.id,
    route.query.projectId,
    route.query.fileName,
    route.query.fileType,
  ],
  () => {
    if (route.name !== 'PreviewFile') return
    syncFileInfoFromRoute()
    loadPreview()
  },
)

// 组件卸载
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('keydown', onMeasureKeyDown)
  isDeactivatedFlag = true
  loadToken++
  // 清理Three.js资源
  disposeResources()
})
</script>

<style lang="scss" scoped>
.preview-container {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

/* ==================== 加载遮罩 ==================== */
.loading-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 248, 248, 0.98) 100%);
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
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 错误容器 */
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
  max-width: 400px;
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

.error-content h3 {
  margin: 16px 0 8px;
  font-size: 20px;
}

.error-content p {
  margin: 8px 0 24px;
  color: #666666;
  font-size: 14px;
}

/* 预览内容 */
.preview-content {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background-color: #0b1020;
}

/* Three.js模型渲染容器 */
.three-viewer-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.three-viewer-container :deep(canvas) {
  width: 100% !important;
  height: 100% !important;
  display: block;
}

/* 构件信息面板 */
.element-info-panel {
  position: fixed;
  top: 80px;
  right: 20px;
  width: 280px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 100;
  overflow: hidden;
}

.element-info-panel .panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: 600;
}

.element-info-panel .panel-content {
  padding: 16px;
}

.element-info-panel .info-row {
  display: flex;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.element-info-panel .info-row:last-child {
  border-bottom: none;
}

.element-info-panel .info-row .label {
  width: 60px;
  color: #666;
  font-size: 13px;
}

.element-info-panel .info-row .value {
  flex: 1;
  color: #333;
  font-size: 13px;
  word-break: break-all;
}

/* 不支持的文件类型 */
.unsupported-file {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: #ffffff;
}

.unsupported-content {
  text-align: center;
  color: #333333;
  max-width: 400px;
  padding: 40px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.unsupported-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.unsupported-content h3 {
  margin: 16px 0 8px;
  font-size: 20px;
}

.unsupported-content p {
  margin: 8px 0 24px;
  color: #666666;
  font-size: 14px;
}

/* 顶部工具栏 */
.top-toolbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 248, 248, 0.95) 100%);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  z-index: 1000;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.top-toolbar:hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(252, 252, 252, 0.98) 100%);
  box-shadow: 0 6px 25px rgba(0, 0, 0, 0.15);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-title {
  font-size: 18px;
  font-weight: 600;
  color: #333333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 400px;
  letter-spacing: 0.5px;
}

/* 已选构件信息 */
.selected-element-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(64, 158, 255, 0.1);
  border-radius: 6px;
  border: 1px solid rgba(64, 158, 255, 0.3);
}

.selected-element-info .el-icon {
  color: #409eff;
  font-size: 16px;
}

.selected-label {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
}

.material-switch {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;

  border-radius: 12px;

  backdrop-filter: blur(10px);
}

.material-switch__label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
}

.material-switch__group {
  display: inline-flex;
  align-items: center;
  padding: 3px;
  background: rgba(15, 23, 42, 0.06);
  border-radius: 10px;
  gap: 4px;
}

.material-switch__btn {
  appearance: none;
  border: none;
  outline: none;
  height: 30px;
  padding: 0 12px;
  border-radius: 8px;
  background: transparent;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  line-height: 30px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;
}

.material-switch__btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.72);
  color: #1f2937;
}

.material-switch__btn.is-active {
  background: linear-gradient(135deg, #409dfe 0%, #2563eb 100%);
  color: #ffffff;
  box-shadow: 0 6px 14px rgba(37, 99, 235, 0.28);
}

.material-switch__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* 调整预览内容的位置，为顶部工具栏留出空间 */
// .preview-content {
//   width: 100%;
//   height: 100%;
//   box-sizing: border-box;
//   background: #ffffff;
//   transition: margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
// }

/* 当功能面板显示时，给预览内容添加右侧外边距，让模型在可见区域居中 */
.preview-container:has(.function-panel) .preview-content {
  margin-right: 190px;
}

/* 全屏状态下的工具栏 */
:fullscreen .top-toolbar {
  position: fixed;
  top: 0;
  z-index: 9999;
}

/* 按钮样式优化 */
.top-toolbar :deep(.el-button) {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.15);
  color: #333333;
  transition: all 0.3s ease;
  backdrop-filter: blur(8px);
}

.top-toolbar :deep(.el-button:hover) {
  background: rgba(255, 255, 255, 0.95);
  border-color: rgba(0, 0, 0, 0.25);
  color: #333333;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.top-toolbar :deep(.el-button:active) {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.top-toolbar :deep(.el-button-group) {
  display: flex;
  gap: 8px;
}

.top-toolbar :deep(.el-button-group .el-button) {
  border-radius: 8px;
  font-weight: 500;
  letter-spacing: 0.3px;
}

.top-toolbar :deep(.el-tooltip__trigger) {
  display: inline-flex;
}

.toolbar-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.toolbar-tool-btn :deep(.el-icon) {
  margin-right: 0 !important;
}

.toolbar-tool-btn--svg {
  overflow: hidden;
}

.toolbar-tool-btn__svg {
  width: 15px;
  height: 15px;
  display: block;
  flex-shrink: 0;
  user-select: none;
  pointer-events: none;
  overflow: visible;
  color: currentColor;
}

.top-toolbar :deep(.el-button.toolbar-tool-btn.is-on) {
  background: rgba(64, 158, 255, 0.92);
  border-color: rgba(64, 158, 255, 0.92);
  color: #ffffff;
}

.top-toolbar :deep(.el-button.toolbar-tool-btn.is-on:hover) {
  background: rgba(64, 158, 255, 0.98);
  border-color: rgba(64, 158, 255, 0.98);
  color: #ffffff;
}

.top-toolbar :deep(.el-button.toolbar-tool-btn.is-disabled:not(.is-on)) {
  opacity: 0.55;
}

/* 剖切弹层 */
:deep(.clipping-popper) {
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
  font-family: system-ui, -apple-system;
}
:deep(.clipping-row) {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  background: transparent;
  border: none;
}
:deep(.clipping-label) {
  width: 36px;
  font-size: 11px;
  color: #374151;
  font-weight: 500;
  user-select: none;
}
:deep(.el-radio-group) {
  display: inline-flex;
  gap: 2px;
}

:deep(.el-radio-button__inner) {
  padding: 3px 10px;
  font-size: 11px;
  border-radius: 3px;
  background: #e5e7eb;
  border: 1px solid #cbd5e1;
  color: #374151;
  font-weight: 600;
}

:deep(.el-radio-button__original-radio:checked
  + .el-radio-button__inner) {
  background: #1f2937;
  color: #fff;
  border-color: #1f2937;
}
:deep(.el-checkbox) {
  margin-left: 6px;
}

:deep(.el-checkbox__label) {
  font-size: 11px;
  color: #4b5563;
}
:deep(.el-slider) {
  flex: 1;
}

:deep(.el-slider__runway) {
  height: 3px;
  background: #d1d5db;
}

:deep(.el-slider__bar) {
  height: 3px;
  background: #1f2937;
}

:deep(.el-slider__button) {
  width: 10px;
  height: 10px;
  border: 2px solid #1f2937;
  background: #f9fafb;
}
:deep(.clipping-actions .el-button) {
  padding: 3px 10px;
  font-size: 11px;
  color: #374151;
}
:deep(.clipping-hint) {
  margin-top: 4px;
  font-size: 10px;
  color: #6b7280;
  text-align: left;
}


/* 返回按钮特殊样式 */
.top-toolbar :deep(.el-button.back-btn .el-icon) {
  margin-right: 6px;
  transition: transform 0.3s ease;
}

.top-toolbar :deep(.el-button.back-btn:hover .el-icon) {
  transform: translateX(-2px);
}

/* ==================== 构件树面板样式 ==================== */
.component-tree-panel {
  position: fixed;
  right: 0;
  top: 64px;
  bottom: 0;
  width: 320px;
  background: #ffffff;
  border-left: 1px solid #e4e7ed;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
  z-index: 10000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.component-tree-panel .panel-header {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #e4e7ed;
  background: linear-gradient(135deg, #f5f7fa 0%, #ffffff 100%);
}

.component-tree-panel .panel-title {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.component-tree-panel .panel-count {
  font-size: 12px;
  color: #909399;
  margin-right: 8px;
  background: #f4f4f5;
  padding: 2px 8px;
  border-radius: 10px;
}

.component-tree-panel .tree-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  user-select: text;
}

.component-tree-panel .tree-container::-webkit-scrollbar {
  width: 6px;
}

.component-tree-panel .tree-container::-webkit-scrollbar-track {
  background: #f5f7fa;
  border-radius: 3px;
}

.component-tree-panel .tree-container::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 3px;
}

.component-tree-panel .tree-container::-webkit-scrollbar-thumb:hover {
  background: #909399;
}

/* 树节点样式 - 复刻 BimPointcloudAlign */
.component-tree-panel .treeNode {
  user-select: text;
}

.component-tree-panel .treeRow {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  margin: 1px 4px;
  transition: background-color 0.15s ease;
}

/* ==================== el-tree 构件树样式 ==================== */
.component-tree-panel .tree-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.component-tree-panel .tree-container:deep(.el-tree) {
  background: transparent;
}

.component-tree-panel .tree-container:deep(.el-tree-node__content) {
  height: 28px;
  /* 允许 el-tree 默认缩进，不要覆盖 padding-left */
}

.component-tree-panel .tree-container:deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: rgba(64, 158, 255, 0.15) !important;
}

.component-tree-panel .tree-container:deep(.el-tree-node > .el-tree-node__content:hover) {
  background: rgba(64, 158, 255, 0.1);
}

.component-tree-panel .tree-container:deep(.el-checkbox) {
  margin-right: 8px;
}

.component-tree-panel .tree-container:deep(.el-checkbox__inner) {
  border-radius: 3px;
}

/* 自定义树节点内容 */
.component-tree-panel .tree-node-content {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  overflow: hidden;
}

.component-tree-panel .tree-node-content.is-selected {
  color: #409eff;
}

.component-tree-panel .node-label {
  flex: 1;
  font-size: 12px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.component-tree-panel .node-step-id {
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  flex-shrink: 0;
}

.component-tree-panel .tree-empty {
  padding: 40px 20px;
  text-align: center;
  color: #909399;
  font-size: 14px;
}

/* 选中构件信息面板 */
.component-tree-panel .meta-box {
  padding: 12px 16px;
  border-top: 1px solid #e4e7ed;
  background: #fafafa;
}

.component-tree-panel .meta-title {
  font-weight: 600;
  font-size: 13px;
  color: #303133;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.component-tree-panel .meta-sub {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.component-tree-panel .pill {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #e4e7ed;
  color: #606266;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .top-toolbar {
    height: 56px;
    padding: 0 16px;
  }

  .toolbar-left {
    gap: 12px;
  }

  .file-title {
    font-size: 16px;
    max-width: 200px;
  }


  .top-toolbar :deep(.el-button) {
    padding: 8px 12px;
    font-size: 13px;
  }

  .top-toolbar :deep(.el-button-group) {
    gap: 4px;
  }

  .toolbar-right {
    gap: 8px;
  }

  .material-switch {
    padding: 6px 8px;
    gap: 8px;
  }

  .material-switch__label {
    display: none;
  }

  .material-switch__btn {
    padding: 0 10px;
    font-size: 11px;
  }
}

/* ==================== 功能面板样式 ==================== */
.function-panel {
  position: fixed;
  right: 0;
  top: 64px;
  bottom: 0;
  width: 380px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 250, 250, 0.98) 100%);
  backdrop-filter: blur(20px);
  box-shadow: -4px 0 30px rgba(0, 0, 0, 0.15);
  z-index: 999;
  display: flex;
  flex-direction: column;
  border-left: 1px solid rgba(0, 0, 0, 0.08);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #333;
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.feature-collapse {
  border: none;
  background: transparent;

  :deep(.el-collapse-item) {
    margin-bottom: 12px;
    border-radius: 12px;
    background: white;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.05);
  }

  :deep(.el-collapse-item__header) {
    padding: 16px 20px;
    font-size: 15px;
    font-weight: 600;
    color: #333;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border: none;
    transition: all 0.3s ease;

    &:hover {
      background: linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%);
    }
  }

  :deep(.el-collapse-item__wrap) {
    border: none;
  }

  :deep(.el-collapse-item__content) {
    padding: 16px 20px;
  }
}

.feature-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.control-group {
  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: #555;
  }
}

.control-item {
  margin-bottom: 16px;

  label {
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #666;
  }
}

.color-picker-row,
.slider-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.slider-row {
  :deep(.el-slider) {
    flex: 1;
  }
}

.value-display {
  min-width: 50px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  color: #667eea;
}

.button-group-vertical {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .el-button {
    width: 100%;
    justify-content: center;
  }
}

.view-button {
  width: 100%;
  margin: 4px 0;
}

.clipping-controls {
  margin-top: 16px;
  padding: 16px;
  background: rgba(102, 126, 234, 0.05);
  border-radius: 8px;
  border: 1px dashed rgba(102, 126, 234, 0.3);
}

.info-text {
  padding: 12px;
  background: rgba(255, 193, 7, 0.1);
  border-left: 3px solid #ffc107;
  border-radius: 4px;
  font-size: 12px;
  color: #666;
  line-height: 1.6;
}

</style>

<style lang="scss" scoped>
/* ==================== CloudBIM 风格预览布局 ==================== */
.asset-preview-page {
  --viewer-panel-width: 320px;

  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  background: var(--bg-page);
}

.asset-preview-page .error-container {
  position: absolute;
  inset: 0;
  z-index: 1001;
  height: auto;
}

.bim-preview-header {
  display: flex;
  flex: 0 0 64px;
  gap: var(--spacing-md);
  align-items: center;
  min-width: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-color-light);
}

.bim-file-context {
  display: flex;
  flex: 1;
  gap: var(--spacing-compact);
  align-items: center;
  min-width: 0;
  padding-left: var(--spacing-md);
  border-left: 1px solid var(--border-color-light);
}

.bim-file-context strong,
.bim-file-context span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bim-file-context strong {
  font-weight: 600;
}

.bim-file-context span {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.bim-header-tools {
  display: flex;
  gap: var(--spacing-compact);
  align-items: center;
}

.preview-button {
  display: inline-flex;
  gap: var(--spacing-sm);
  align-items: center;
  justify-content: center;
  min-height: var(--control-height, 32px);
  padding: 0 var(--spacing-compact);
  font: inherit;
  color: var(--text-secondary);
  cursor: pointer;
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-xs);
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast);
}

.preview-button:hover:not(:disabled) {
  background: var(--bg-control-hover);
  border-color: var(--border-color-hover);
}

.preview-button.is-active {
  font-weight: 600;
  color: var(--color-primary-active);
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}

.preview-button:disabled {
  color: var(--text-disabled);
  cursor: not-allowed;
  background: var(--bg-muted);
  border-color: var(--border-color-light);
}

.primary-button {
  color: var(--bg-card);
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.primary-button:hover:not(:disabled) {
  background: var(--color-primary-active);
  border-color: var(--color-primary-active);
}

.icon-btn {
  flex: 0 0 var(--control-height, 32px);
  width: var(--control-height, 32px);
  padding: 0;
}

.layout-shell {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1fr) var(--viewer-panel-width);
  min-height: 0;
}

.layout-shell.is-sidebar-collapsed {
  grid-template-columns: minmax(0, 1fr) 56px;
}

.viewer-region {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #0b1020;
}

.viewer-region .component-tree-panel {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: auto;
  z-index: 50;
  width: 320px;
  border-right: 1px solid var(--border-color-light);
  border-left: 0;
  box-shadow: 4px 0 20px rgb(0 0 0 / 10%);
}

.sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-card);
  border-left: 1px solid var(--border-color-light);
}

.sidebar-heading {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
  justify-content: space-between;
  min-height: 56px;
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--border-color-light);
}

.sidebar-heading h2 {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.sidebar.is-collapsed .sidebar-heading {
  justify-content: center;
  padding-inline: var(--spacing-sm);
}

.sidebar-sections {
  min-height: 0;
  overflow-y: auto;
}

.tool-section {
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--border-color-light);
}

.tool-section h3 {
  margin: 0 0 var(--spacing-compact);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.model-view-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-sm);
}

.mesh-status {
  margin: var(--spacing-compact) 0;
  font-size: var(--font-size-xs);
  line-height: var(--line-height-base, 1.5);
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

.mesh-status.is-ready {
  color: var(--color-success);
}

.mesh-status.is-error,
.error-message {
  color: var(--text-danger);
}

.mesh-stats {
  width: 100%;
  margin-bottom: var(--spacing-md);
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
  border-collapse: collapse;
}

.mesh-stats th,
.mesh-stats td {
  padding: var(--spacing-xs) 0;
  font-weight: 400;
  text-align: right;
}

.mesh-stats th:first-child {
  text-align: left;
  color: var(--text-secondary);
}

.mesh-stats thead {
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color-light);
}

.mesh-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.mesh-actions .primary-button {
  flex: 1;
}

.error-message {
  margin: var(--spacing-sm) 0 0;
  font-size: var(--font-size-xs);
  overflow-wrap: anywhere;
}

.section-note {
  margin: var(--spacing-sm) 0 0;
  font-size: var(--font-size-xs);
  line-height: var(--line-height-base, 1.5);
  color: var(--text-secondary);
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--control-height, 32px);
  gap: var(--spacing-compact);
}

.background-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-sm);
}

.theme-chip {
  justify-content: flex-start;
}

.theme-swatch {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  border: 1px solid var(--border-color-light);
  border-radius: var(--spacing-xs);
}

.theme-swatch-gradient {
  background: #10213b;
}

.theme-swatch-deep {
  background: #0c1224;
}

.theme-swatch-light {
  background: #e8eef6;
}

.theme-swatch-black {
  background: #000;
}

@media (width <= 1600px) {
  .asset-preview-page {
    --viewer-panel-width: 300px;
  }

  .bim-file-context {
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
  }
}

@media (width <= 720px) {
  .bim-preview-header {
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }

  .bim-file-context {
    flex-basis: 40%;
  }

  .bim-header-tools {
    margin-left: auto;
  }

  .layout-shell {
    grid-template-columns: minmax(0, 1fr) min(280px, 48vw);
  }

  .mesh-actions {
    flex-direction: column;
  }
}
</style>

<style lang="scss" scoped>
/* ==================== 测量工具与结果标签 ==================== */
.toolbar-label {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.measure-analysis-toolbar {
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

.measure-analysis-toolbar strong {
  font-size: var(--font-size-sm);
}

.measure-analysis-hint,
.measure-analysis-exit {
  font-size: var(--font-size-xs);
  color: rgb(226 232 240 / 78%);
}

.measure-analysis-value {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: #fca5a5;
}

.measure-analysis-toolbar button {
  padding: 4px 9px;
  font-size: var(--font-size-xs);
  color: #fecaca;
  cursor: pointer;
  background: transparent;
  border: 1px solid rgb(248 113 113 / 40%);
  border-radius: var(--radius-xs);
}

.measure-analysis-toolbar button:hover {
  background: rgb(248 113 113 / 16%);
}

.measure-badges {
  position: absolute;
  inset: 0;
  z-index: 40;
  pointer-events: none;
}

.measure-badge {
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

.measure-badge header {
  display: flex;
  gap: 8px;
  align-items: center;
  min-height: 18px;
  pointer-events: auto;
  cursor: grab;
}

.measure-badge header:active {
  cursor: grabbing;
}

.measure-badge__dots {
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

.measure-badge__title {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: rgb(255 255 255 / 68%);
}

.measure-badge__main {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.measure-badge__main span {
  font-size: 10px;
  font-weight: 600;
  color: rgb(145 181 255 / 94%);
}

.measure-badge__main strong {
  font-size: 18px;
  line-height: 1.15;
  color: #fff;
  text-shadow: 0 0 14px rgb(78 102 204 / 28%);
}

.measure-badge__rows {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.measure-badge__rows > div {
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.measure-badge__rows span:first-child {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: rgb(161 191 250 / 88%);
}

.measure-badge__rows span:last-child {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: rgb(255 255 255 / 94%);
  text-align: right;
}
</style>
