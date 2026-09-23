<template>
  <div class="gaussian-container">
    <!-- 顶部工具栏 -->
    <div class="top-toolbar" :class="{ 'toolbar-hidden': !showToolbar }">
      <div class="toolbar-left">
        <el-button-group>
          <el-tooltip content="重置视角 (R)" placement="bottom">
            <el-button @click="resetCamera" :icon="RefreshLeft" type="primary" />
          </el-tooltip>
          <el-tooltip content="截图保存 (P)" placement="bottom">
            <el-button @click="takeScreenshot" :icon="Camera" />
          </el-tooltip>
          <el-tooltip content="全屏模式 (F)" placement="bottom">
            <el-button @click="toggleFullscreen" :icon="isFullscreen ? FullScreen : ScaleToOriginal" />
          </el-tooltip>
          <el-tooltip content="第一人称视角 (V)" placement="bottom">
            <el-button
              :type="firstPersonEnabled ? 'primary' : ''"
              :icon="View"
              @click="toggleFirstPersonMode"
            >
              第一人称
            </el-button>
          </el-tooltip>
        </el-button-group>
      </div>

      <div class="toolbar-center">
        <el-button-group>
          <el-tooltip content="后视图" placement="bottom">
            <el-button :type="currentView === 'back' ? 'primary' : ''" @click="setView('back')">后</el-button>
          </el-tooltip>
          <el-tooltip content="左视图" placement="bottom">
            <el-button :type="currentView === 'left' ? 'primary' : ''" @click="setView('left')">左</el-button>
          </el-tooltip>
          <el-tooltip content="右视图" placement="bottom">
            <el-button :type="currentView === 'right' ? 'primary' : ''" @click="setView('right')">右</el-button>
          </el-tooltip>
        </el-button-group>
      </div>

      <div class="toolbar-right">
        <el-tooltip content="隐藏工具栏" placement="bottom">
          <el-button @click="showToolbar = false" :icon="ArrowUp" circle />
        </el-tooltip>
      </div>
    </div>

    <!-- 工具栏显示按钮 -->
    <transition name="fade">
      <div v-if="!showToolbar" class="toolbar-toggle" @click="showToolbar = true">
        <el-icon><ArrowDown /></el-icon>
      </div>
    </transition>

    <!-- 3D 画布 -->
    <div ref="canvasContainer" class="canvas-container">
      <!-- 方向控制器 -->
      <div class="direction-controls">
        <el-tooltip content="向前移动 (W)" placement="top">
          <div class="arrow-btn arrow-up" @click="moveCamera('up')">
            <el-icon><ArrowUp /></el-icon>
          </div>
        </el-tooltip>
        <div class="arrow-horizontal">
          <el-tooltip content="向右移动 (A)" placement="left">
            <div class="arrow-btn arrow-left" @click="moveCamera('left')">
              <el-icon><ArrowLeft /></el-icon>
            </div>
          </el-tooltip>
          <el-tooltip content="向左移动 (D)" placement="right">
            <div class="arrow-btn arrow-right" @click="moveCamera('right')">
              <el-icon><ArrowRight /></el-icon>
            </div>
          </el-tooltip>
        </div>
        <el-tooltip content="向后移动 (S)" placement="bottom">
          <div class="arrow-btn arrow-down" @click="moveCamera('down')">
            <el-icon><ArrowDown /></el-icon>
          </div>
        </el-tooltip>
      </div>
    </div>

    <!-- 加载覆盖层 -->
    <transition name="fade">
      <div v-if="loading" class="loading-overlay">
        <div class="loading-content">
          <div class="loading-spinner">
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
          </div>
          <el-progress
            :percentage="loadingProgress"
            :stroke-width="8"
            :show-text="false"
            color="#409EFF"
          />
          <p class="loading-text">加载高斯模型中...</p>
          <p class="loading-percent">{{ loadingProgress }}%</p>
          <p class="loading-tip">{{ loadingTips[currentTipIndex] }}</p>
        </div>
      </div>
    </transition>

    <!-- 右侧控制面板 -->
    <div class="controls-panel" :class="{ 'panel-collapsed': !showPanel }">
      <div class="panel-toggle" @click="showPanel = !showPanel">
        <el-icon>
          <component :is="showPanel ? ArrowRight : ArrowLeft" />
        </el-icon>
      </div>

      <div v-show="showPanel" class="panel-content">
        <!-- 渲染设置卡片 -->
        <el-card shadow="hover" class="control-card">
          <template #header>
            <div class="card-header" @click="renderSettingsExpanded = !renderSettingsExpanded">
              <div class="header-left">
                <el-icon><Setting /></el-icon>
                <span>渲染设置</span>
              </div>
              <el-icon class="expand-icon" :class="{ 'is-expanded': renderSettingsExpanded }">
                <ArrowDown />
              </el-icon>
            </div>
          </template>

          <transition name="slide-down">
            <div v-show="renderSettingsExpanded">
              <el-space direction="vertical" :size="16" style="width: 100%">
                <!-- 环境数据 -->
                <div class="control-item">
                  <div class="control-label">
                    <el-icon><Sunny /></el-icon>
                    <span>环境数据</span>
                  </div>
                  <el-switch
                    v-model="useEnv"
                    @change="handleEnvChange"
                    :disabled="!modelLoaded"
                  />
                </div>

                <!-- 球谐渲染 -->
                <div class="control-item">
                  <div class="control-label">
                    <el-icon><MagicStick /></el-icon>
                    <span>球谐渲染</span>
                  </div>
                  <el-switch
                    v-model="useShcoef"
                    @change="handleShcoefChange"
                    :disabled="!modelLoaded"
                  />
                </div>

                <!-- 点云模式 -->
                <div class="control-item">
                  <div class="control-label">
                    <el-icon><More /></el-icon>
                    <span>点云模式</span>
                  </div>
                  <el-switch
                    v-model="pointsMode"
                    @change="handlePointsModeChange"
                    :disabled="!modelLoaded"
                  />
                </div>

                <!-- 背景颜色 -->
                <div class="control-item">
                  <div class="control-label">
                    <el-icon><Picture /></el-icon>
                    <span>背景颜色</span>
                  </div>
                  <el-color-picker
                    v-model="backgroundColor"
                    @change="handleBackgroundChange"
                    size="default"
                  />
                </div>

                <el-divider style="margin: 8px 0" />

                <!-- 控制速度 -->
                <div class="control-item-full">
                  <div class="control-label">
                    <el-icon><Odometer /></el-icon>
                    <span>移动速度</span>
                  </div>
                  <el-slider
                    v-model="controlSpeed"
                    :min="0.1"
                    :max="5"
                    :step="0.1"
                    @input="handleSpeedChange"
                    :format-tooltip="(val: number) => `${val.toFixed(1)}x`"
                  />
                </div>

                <!-- 渲染质量 -->
                <div class="control-item-full">
                  <div class="control-label">
                    <el-icon><Monitor /></el-icon>
                    <span>渲染质量</span>
                  </div>
                  <el-radio-group v-model="renderQuality" @change="handleQualityChange" size="small">
                    <el-radio-button label="low">低</el-radio-button>
                    <el-radio-button label="medium">中</el-radio-button>
                    <el-radio-button label="high">高</el-radio-button>
                  </el-radio-group>
                </div>

                <el-divider style="margin: 8px 0" />

                <!-- 性能模式 -->
                <div class="control-item">
                  <div class="control-label">
                    <el-icon><Promotion /></el-icon>
                    <span>性能模式</span>
                  </div>
                  <el-switch v-model="performanceMode" @change="handlePerformanceModeChange" />
                </div>

                <!-- 数据缓存 -->
                <div class="control-item">
                  <div class="control-label">
                    <el-icon><FolderOpened /></el-icon>
                    <span>数据缓存</span>
                  </div>
                  <el-tag :type="useIndexDB ? 'success' : 'info'" size="small">
                    {{ useIndexDB ? '已启用' : '已禁用' }}
                  </el-tag>
                </div>

                <!-- 碰撞保护 -->
                <div class="control-item">
                  <div class="control-label">
                    <el-icon><Lock /></el-icon>
                    <span>碰撞保护</span>
                  </div>
                  <el-switch
                    v-model="collisionProtection"
                    @change="handleCollisionProtectionChange"
                  />
                </div>
              </el-space>
            </div>
          </transition>
        </el-card>

        <!-- 模型信息卡片（可折叠）-->
        <el-card shadow="hover" class="control-card info-card">
          <template #header>
            <div class="card-header" @click="modelInfoExpanded = !modelInfoExpanded">
              <div class="header-left">
                <el-icon><DataAnalysis /></el-icon>
                <span>模型信息</span>
              </div>
              <el-icon class="expand-icon" :class="{ 'is-expanded': modelInfoExpanded }">
                <ArrowDown />
              </el-icon>
            </div>
          </template>

          <transition name="slide-down">
            <div v-show="modelInfoExpanded" class="info-content">
              <div class="info-item">
                <span class="info-label">点数量:</span>
                <span class="info-value">29,197,426</span>
              </div>
              <div class="info-item">
                <span class="info-label">数据大小:</span>
                <span class="info-value">934 MB</span>
              </div>
              <div class="info-item">
                <span class="info-label">细节层次:</span>
                <span class="info-value">6 级</span>
              </div>
              <div class="info-item">
                <span class="info-label">加载状态:</span>
                <el-tag :type="modelLoaded ? 'success' : 'warning'" size="small">
                  {{ modelLoaded ? '已加载' : '加载中' }}
                </el-tag>
              </div>
            </div>
          </transition>
        </el-card>
      </div>
    </div>

    <!-- 底部信息栏 -->
    <div class="bottom-info-bar">
      <div class="info-section">
        <el-icon><Aim /></el-icon>
        <span>相机位置: X:{{ cameraPos.x }} Y:{{ cameraPos.y }} Z:{{ cameraPos.z }}</span>
      </div>
      <div class="info-section">
        <el-icon><Timer /></el-icon>
        <span>FPS: {{ fps }}</span>
        <el-tag
          :type="fps >= 50 ? 'success' : fps >= 30 ? 'warning' : 'danger'"
          size="small"
          effect="dark"
          style="margin-left: 8px"
        >
          {{ fps >= 50 ? '流畅' : fps >= 30 ? '一般' : '卡顿' }}
        </el-tag>
        <el-tooltip :content="`实际渲染: ${renderCount}帧/秒`" placement="top">
          <el-icon style="margin-left: 8px; cursor: help;"><InfoFilled /></el-icon>
        </el-tooltip>
      </div>
      <div class="info-section">
        <el-icon><View /></el-icon>
        <span>
          当前视图: {{ firstPersonEnabled ? '第一人称' : viewNames[currentView] }}
        </span>
      </div>
      <div class="info-section">
        <el-icon><Lock /></el-icon>
        <span>碰撞保护: {{ collisionProtection ? '已开启' : '已关闭' }}</span>
        <el-tag
          :type="collisionAvailable ? 'success' : 'info'"
          size="small"
          effect="dark"
          style="margin-left: 8px"
        >
          {{ collisionAvailable ? '可用' : '等待模型' }}
        </el-tag>
      </div>
    </div>

    <!-- 快捷键提示 -->
    <transition name="slide-up">
      <div v-if="showHelp" class="help-panel">
        <div class="help-header">
          <span>快捷键帮助</span>
          <el-button text @click="showHelp = false" :icon="Close" size="small" />
        </div>
        <div class="help-content">
          <div class="help-item">
            <kbd>鼠标左键</kbd>
            <span>旋转视角</span>
          </div>
          <div class="help-item">
            <kbd>鼠标右键</kbd>
            <span>平移视角</span>
          </div>
          <div class="help-item">
            <kbd>鼠标滚轮</kbd>
            <span>缩放视角</span>
          </div>
          <div class="help-item">
            <kbd>W A S D</kbd>
            <span>移动控制（第一人称下连续行走）</span>
          </div>
          <div class="help-item">
            <kbd>V</kbd>
            <span>进入/退出第一人称</span>
          </div>
          <div class="help-item">
            <kbd>Esc</kbd>
            <span>退出第一人称</span>
          </div>
          <div class="help-item">
            <kbd>W</kbd>
            <span>向前移动</span>
          </div>
          <div class="help-item">
            <kbd>S</kbd>
            <span>向后移动</span>
          </div>
          <div class="help-item">
            <kbd>A</kbd>
            <span>向右移动</span>
          </div>
          <div class="help-item">
            <kbd>D</kbd>
            <span>向左移动</span>
          </div>
          <div class="help-item">
            <kbd>R</kbd>
            <span>重置相机</span>
          </div>
          <div class="help-item">
            <kbd>P</kbd>
            <span>截图</span>
          </div>
          <div class="help-item">
            <kbd>F</kbd>
            <span>全屏</span>
          </div>
          <div class="help-item">
            <kbd>H</kbd>
            <span>显示/隐藏帮助</span>
          </div>
        </div>
      </div>
    </transition>

    <!-- 帮助按钮 -->
    <el-tooltip content="快捷键帮助 (H)" placement="left">
      <div class="help-button" @click="showHelp = !showHelp">
        <el-icon :size="24"><QuestionFilled /></el-icon>
      </div>
    </el-tooltip>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  RefreshLeft,
  Camera,
  FullScreen,
  ScaleToOriginal,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Setting,
  Sunny,
  MagicStick,
  More,
  Picture,
  Odometer,
  Monitor,
  Promotion,
  FolderOpened,
  DataAnalysis,
  Aim,
  Timer,
  View,
  QuestionFilled,
  Close,
  InfoFilled,
  Lock,
} from '@element-plus/icons-vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { getGaussAssetUrl } from '@/api/fileManage'
import { getToken, formatToken, getOrganizationId } from '@/utils/auth'

// @ts-ignore
import { LCCRender } from '@/libs/lcc-0.5.4.js'

const route = useRoute()
type CameraRot = { lon: number; lat: number }
type MoveDirection = 'up' | 'down' | 'left' | 'right'

let restoreGaussFetchInterceptor: (() => void) | null = null

const resolveFetchUrl = (input: RequestInfo | URL) => {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

const clampFirstPersonLat = (lat: number) =>
  Math.max(-FIRST_PERSON_MAX_PITCH, Math.min(FIRST_PERSON_MAX_PITCH, lat))

const normalizeLon = (lon: number) =>
  THREE.MathUtils.euclideanModulo(lon + 180, 360) - 180

const rotationToDirection = (rot: CameraRot) => {
  const lat = THREE.MathUtils.degToRad(clampFirstPersonLat(rot.lat))
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

const isGaussAssetRequest = (requestUrl: string) => {
  try {
    const url = new URL(requestUrl, window.location.origin)
    return /\/projects\/\d+\/files\/\d+\/gauss\/.+/.test(url.pathname)
  } catch {
    return false
  }
}

const mergeRequestHeaders = (input: RequestInfo | URL, init?: RequestInit) => {
  const headers = new Headers(input instanceof Request ? input.headers : undefined)

  if (init?.headers) {
    const initHeaders = new Headers(init.headers)
    initHeaders.forEach((value, key) => {
      headers.set(key, value)
    })
  }

  const tokenData = getToken()
  if (tokenData?.accessToken) {
    headers.set('Authorization', formatToken(tokenData.accessToken))
  }

  const organizationId = getOrganizationId()
  if (organizationId) {
    headers.set('X-Organization-Id', String(organizationId))
  }

  return headers
}

const installGaussFetchInterceptor = () => {
  if (typeof window === 'undefined' || restoreGaussFetchInterceptor) return

  const originalFetch = window.fetch.bind(window)

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = resolveFetchUrl(input)
    if (!isGaussAssetRequest(requestUrl)) {
      return originalFetch(input, init)
    }

    const fetchId = ++gaussianFetchSequence
    const fetchStartedAt = performance.now()
    markGaussianPerf('fetch-start', {
      id: fetchId,
      url: requestUrl,
    })

    const nextInput =
      input instanceof Request ? new Request(requestUrl, input) : requestUrl
    const headers = mergeRequestHeaders(input, init)
    return originalFetch(nextInput, {
      ...init,
      headers
    }).then((response) => {
      markGaussianPerf('fetch-response', {
        id: fetchId,
        url: requestUrl,
        status: response.status,
        elapsed: Math.round(performance.now() - fetchStartedAt),
      })

      const originalArrayBuffer = response.arrayBuffer.bind(response)
      response.arrayBuffer = () => {
        const bodyStartedAt = performance.now()
        markGaussianPerf('fetch-body-start', {
          id: fetchId,
          url: requestUrl,
        })
        return originalArrayBuffer().then((buffer) => {
          markGaussianPerf('fetch-body-end', {
            id: fetchId,
            url: requestUrl,
            bytes: buffer.byteLength,
            elapsed: Math.round(performance.now() - bodyStartedAt),
          })
          return buffer
        })
      }

      return response
    })
  }

  restoreGaussFetchInterceptor = () => {
    window.fetch = originalFetch
    restoreGaussFetchInterceptor = null
  }
}

const uninstallGaussFetchInterceptor = () => {
  if (!restoreGaussFetchInterceptor) return
  restoreGaussFetchInterceptor()
}

const previewProjectId = computed(() => {
  const raw = route.query.projectId
  const value = Array.isArray(raw) ? raw[0] : raw
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : null
})

const previewFileId = computed(() => {
  const raw = route.query.fileId
  const value = Array.isArray(raw) ? raw[0] : raw
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : null
})

const previewAssetPath = computed(() => {
  const raw = route.query.assetPath
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string') return 'meta.lcc'
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '').trim()
  return normalized || 'meta.lcc'
})

const hasValidGaussPreviewSource = computed(
  () => !!previewProjectId.value && !!previewFileId.value,
)

const buildGaussPreviewDataPath = () => {
  if (!hasValidGaussPreviewSource.value) return null

  const baseUrl = `${window.location.origin}${getGaussAssetUrl(
    previewProjectId.value,
    previewFileId.value,
    previewAssetPath.value
  )}`

  const tokenData = getToken()
  const organizationId = getOrganizationId()

  const url = new URL(baseUrl)

  if (tokenData?.accessToken) {
    const authHeaderValue = formatToken(tokenData.accessToken)
    url.searchParams.set('token', authHeaderValue)
  }

  if (organizationId) {
    url.searchParams.set('orgId', String(organizationId))
  }

  return url.toString()
}


// ==================== 响应式数据 ====================
const canvasContainer = ref<HTMLDivElement>()
const loading = ref(true)
const loadingProgress = ref(0)
const modelLoaded = ref(false)

// 加载提示
const loadingTips = [
  '正在加载点云数据...',
  '准备渲染引擎...',
  '构建空间索引...',
  '优化渲染性能...',
  '即将完成...'
]
const currentTipIndex = ref(0)

// UI 状态
const showToolbar = ref(true)
const showPanel = ref(true)
const showHelp = ref(false)
const isFullscreen = ref(false)
const renderSettingsExpanded = ref(true)
const modelInfoExpanded = ref(true) // 模型信息折叠状态
const currentView = ref<'free' | 'back' | 'left' | 'right'>('free')
const firstPersonEnabled = ref(false)
const firstPersonMouseDown = ref(false)
const firstPersonMousePos = ref({ x: 0, y: 0 })
const firstPersonCameraRot = ref<CameraRot>({ lon: 0, lat: 0 })
const activeFirstPersonMoveDirections = new Set<MoveDirection>()

// 渲染设置
const useEnv = ref(false)
const useShcoef = ref(false)
const pointsMode = ref(false)
const useIndexDB = ref(true)
const useLoadingEffect = ref(false)
const backgroundColor = ref('#1a1a2e')
const controlSpeed = ref(1.0)
const renderQuality = ref<'low' | 'medium' | 'high'>('low')
const performanceMode = ref(true) // 默认启用性能模式
const collisionProtection = ref(true)
const collisionAvailable = ref(false)

// 性能监控
const fps = ref(60)
const cameraPos = ref({ x: '0.0', y: '2.0', z: '0.0' })
const renderCount = ref(0) // 渲染帧计数器

// 视图名称映射
const viewNames = {
  free: '自由视角',
  back: '后视图',
  left: '左视图',
  right: '右视图'
}

// ==================== Three.js 变量 ====================
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let lccObject: any
let animationId: number
let clock: THREE.Clock // 添加Clock用于精确时间控制
let lastSafeCameraPose: {
  camera: THREE.Vector3
  target: THREE.Vector3
} | null = null
let lastFirstPersonMoveAt = 0
let lastFirstPersonGroundHeight: number | null = null

// 性能监控
let lastTime = performance.now()
let frames = 0
let fpsUpdateInterval: number
let tipInterval: number

// 渲染优化 - 简化逻辑
let resizeTimeout: number | null = null

type GaussianPerfEntry = {
  name: string
  time: number
  detail?: Record<string, unknown>
}

const GAUSSIAN_FIRST_FRAME_MARK = 'gaussian:first-frame'
let gaussianLoadStartedAt = 0
let gaussianFirstFrameMarked = false
let gaussianFetchSequence = 0
let gaussianLoadSequence = 0
let activeGaussianLoadId = 0
let activeGaussianDataPath: string | null = null
let gaussianQualityUpgradeTimer: number | null = null

const getGaussianPerfStore = () => {
  if (typeof window === 'undefined') return null
  const target = window as any
  if (!target.__gaussianPerf) {
    target.__gaussianPerf = {
      startedAt: performance.now(),
      marks: [] as GaussianPerfEntry[],
    }
  }
  return target.__gaussianPerf as {
    startedAt: number
    marks: GaussianPerfEntry[]
  }
}

const markGaussianPerf = (
  name: string,
  detail?: Record<string, unknown>,
) => {
  if (typeof performance === 'undefined') return
  const entry = {
    name,
    time: performance.now(),
    detail,
  }
  getGaussianPerfStore()?.marks.push(entry)
  performance.mark(`gaussian:${name}`)
}

const measureGaussianPerf = (
  name: string,
  startMark: string,
  endMark: string,
) => {
  if (typeof performance === 'undefined') return
  try {
    performance.measure(`gaussian:${name}`, startMark, endMark)
  } catch {
    // marks may be missing after route reloads; the raw entries remain in window.__gaussianPerf.
  }
}

const COLLISION_RADIUS = 0.24
const DEFAULT_FIRST_PERSON_EYE_HEIGHT = 1.5
const FIRST_PERSON_GROUND_PROBE_DISTANCE = 8
const FIRST_PERSON_MAX_STEP_UP = 0.18
const FIRST_PERSON_MAX_STEP_DOWN = 0.5
const FIRST_PERSON_MAX_GROUND_HEIGHT_JUMP = 0.28
const FIRST_PERSON_ROTATION_SENSITIVITY = 0.12
const FIRST_PERSON_MAX_POINTER_DELTA = 48
const FIRST_PERSON_MAX_PITCH = 55
const FIRST_PERSON_MOVE_SPEED = 2.8
const FIRST_SCREEN_MAX_SPLATS = 700000
const FIRST_SCREEN_MAX_DISTANCE = 80
const ENHANCED_SCREEN_MAX_SPLATS = 1500000
const ENHANCED_SCREEN_MAX_DISTANCE = 120
const GAUSSIAN_QUALITY_UPGRADE_DELAY = 1500

// 初始相机位置
// 初始相机位置（机位置）
const initialCameraPosition = new THREE.Vector3(-3.5, 1.0, 0.2)

// 初始相机注视点
const initialCameraTarget = new THREE.Vector3(0, 1, 0)

// 模型矩阵
const createModelMatrix = () => {
  return new THREE.Matrix4(
    -1, 0, 0, 0,
    0, 0, 1, 0,
    0, 1, 0, 0,
    0, 0, 0, 1
  )
}

// ==================== 初始化场景 ====================
const initScene = () => {
  if (!canvasContainer.value) return

  // 创建场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(backgroundColor.value)

  // 初始化Clock
  clock = new THREE.Clock()

  // 创建相机
  camera = new THREE.PerspectiveCamera(
    45,
    canvasContainer.value.clientWidth / canvasContainer.value.clientHeight,
    0.1, // 近裁剪面改小，提升近距离渲染
    150000
  )
  camera.position.copy(initialCameraPosition)

  // 创建渲染器 - 优化配置
  // 关键：降低pixelRatio以提升性能
  const pixelRatio = renderQuality.value === 'high' ? Math.min(window.devicePixelRatio, 1.5) :
                    renderQuality.value === 'medium' ? 1 : 0.8

  renderer = new THREE.WebGLRenderer({
    antialias: renderQuality.value === 'high', // 只有高质量才开启抗锯齿
    powerPreference: performanceMode.value ? 'high-performance' : 'default',
    preserveDrawingBuffer: true, // 重要：允许截图
    alpha: false,
    stencil: false, // 禁用模板缓冲，提升性能
    depth: true
  })
  renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
  renderer.setPixelRatio(pixelRatio)

  // 关键优化：设置渲染器的输出编码
  renderer.outputColorSpace = THREE.SRGBColorSpace

  canvasContainer.value.appendChild(renderer.domElement)

  // 添加轨道控制器
  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.copy(initialCameraTarget)
  controls.update()
  // 关键优化：减小阻尼，让动画更快停止
  controls.enableDamping = true
  controls.dampingFactor = 0.15 // 从0.05增加到0.15，让阻尼更快停止
  controls.rotateSpeed = controlSpeed.value * 0.8 // 降低旋转速度，更精确
  controls.panSpeed = controlSpeed.value * 0.8
  controls.zoomSpeed = controlSpeed.value
  controls.minDistance = 0.5 // 设置最小距离
  controls.maxDistance = 100 // 设置最大距离

  // 加载LCC模型
  loadLCCModel(createModelMatrix())

  // 启动 FPS 监控
  startFPSMonitor()

  // 启动加载提示切换
  startTipRotation()
}

// ==================== 加载 LCC 模型 ====================
const loadLCCModel = (modelMatrix: THREE.Matrix4) => {
  // 🔥 重要：根据LCC SDK文档，dataPath有两种格式：
  // 方式1：指向meta.lcc文件（推荐）
  // 方式2：指向包含LCC文件的目录
  const dataPath = buildGaussPreviewDataPath()
  if (!dataPath) {
    loading.value = false
    loadingProgress.value = 0
    modelLoaded.value = false
    markGaussianPerf('load-skipped', {
      reason: 'missing-route-query',
      projectId: previewProjectId.value,
      fileId: previewFileId.value,
      assetPath: previewAssetPath.value,
    })
    return
  }

  if (activeGaussianDataPath === dataPath && (loading.value || modelLoaded.value)) {
    markGaussianPerf('load-skipped', {
      reason: 'same-data-path',
      dataPath,
      loading: loading.value,
      modelLoaded: modelLoaded.value,
    })
    return
  }

  const loadId = ++gaussianLoadSequence
  activeGaussianLoadId = loadId
  activeGaussianDataPath = dataPath
  const loadStartedAt = performance.now()
  gaussianLoadStartedAt = loadStartedAt
  gaussianFirstFrameMarked = false
  markGaussianPerf('load-start', {
    loadId,
    dataPath,
    useEnv: useEnv.value,
    useIndexDB: useIndexDB.value,
    useLoadingEffect: useLoadingEffect.value,
    renderQuality: renderQuality.value,
    performanceMode: performanceMode.value,
  })

  let loadedObject: any = null
  loadedObject = LCCRender.load(
    {
      camera: camera,
      scene: scene,
      dataPath: dataPath,
      renderLib: THREE,
      canvas: renderer.domElement,
      renderer: renderer,
      useEnv: useEnv.value,
      useIndexDB: useIndexDB.value,
      useLoadingEffect: useLoadingEffect.value,
      modelMatrix: modelMatrix,
      appKey: null,
      // 性能优化：设置缓存大小
      maxHostCacheSize: 512, // 主机内存缓存（MB）
      maxGpuCacheSize: 512   // GPU内存缓存（MB）
    },
    (mesh: any) => {
      if (activeGaussianLoadId !== loadId) {
        markGaussianPerf('stale-load-success-ignored', {
          loadId,
          activeLoadId: activeGaussianLoadId,
          dataPath,
        })
        return
      }

      markGaussianPerf('load-success', {
        loadId,
        elapsed: Math.round(performance.now() - loadStartedAt),
      })
      measureGaussianPerf(
        'load-to-success',
        'gaussian:load-start',
        'gaussian:load-success',
      )
      loading.value = false
      loadingProgress.value = 100
      modelLoaded.value = true
      collisionAvailable.value = typeof lccObject?.intersectsSphere === 'function'
      rememberSafeCameraPose()

      // 停止提示轮换
      if (tipInterval) {
        clearInterval(tipInterval)
      }

      applyLODOptimizations('first-screen')
      scheduleGaussianQualityUpgrade(loadId)

      // ElMessage.success({
      //   message: '高斯模型加载成功！',
      //   duration: 2000,
      //   showClose: true
      // })
    },
    (percent: number) => {
      const nextProgress = Math.floor(percent * 100)
      if (
        nextProgress === 1 ||
        nextProgress === 25 ||
        nextProgress === 50 ||
        nextProgress === 75 ||
        nextProgress === 90 ||
        nextProgress === 100 ||
        nextProgress - loadingProgress.value >= 20
      ) {
        if (activeGaussianLoadId !== loadId) return
        markGaussianPerf('load-progress', {
          loadId,
          percent: nextProgress,
          elapsed: Math.round(performance.now() - loadStartedAt),
        })
      }
      if (activeGaussianLoadId !== loadId) return
      loadingProgress.value = nextProgress

      // 根据进度更新提示
      if (percent < 0.2) currentTipIndex.value = 0
      else if (percent < 0.4) currentTipIndex.value = 1
      else if (percent < 0.6) currentTipIndex.value = 2
      else if (percent < 0.8) currentTipIndex.value = 3
      else currentTipIndex.value = 4
    },
    () => {
      if (activeGaussianLoadId !== loadId) {
        markGaussianPerf('stale-load-failure-ignored', {
          loadId,
          activeLoadId: activeGaussianLoadId,
          dataPath,
        })
        return
      }

      markGaussianPerf('load-failure', {
        loadId,
        elapsed: Math.round(performance.now() - loadStartedAt),
      })
      console.error('❌ 模型加载失败回调触发')
      loading.value = false
      modelLoaded.value = false
      if (tipInterval) {
        clearInterval(tipInterval)
      }
      // ElMessage.error({
      //   message: '高斯模型加载失败，请检查数据文件',
      //   duration: 3000,
      //   showClose: true
      // })
    }
  )
  lccObject = loadedObject

  // 暴露到 window 对象方便调试
  ;(window as any).lccObject = lccObject
  ;(window as any).LCCRender = LCCRender
  ;(window as any).camera = camera
  ;(window as any).scene = scene
  ;(window as any).renderer = renderer
}

const unloadCurrentModel = () => {
  clearGaussianQualityUpgradeTimer()
  if (lccObject && LCCRender) {
    try {
      LCCRender.unload(lccObject)
    } catch (error) {
      console.error('LCC 卸载错误:', error)
    } finally {
      lccObject = null
      collisionAvailable.value = false
      lastSafeCameraPose = null
    }
  }
}

const clearGaussianQualityUpgradeTimer = () => {
  if (gaussianQualityUpgradeTimer === null) return
  window.clearTimeout(gaussianQualityUpgradeTimer)
  gaussianQualityUpgradeTimer = null
}

const scheduleGaussianQualityUpgrade = (loadId: number) => {
  clearGaussianQualityUpgradeTimer()
  gaussianQualityUpgradeTimer = window.setTimeout(() => {
    gaussianQualityUpgradeTimer = null
    if (activeGaussianLoadId !== loadId || !modelLoaded.value || !lccObject) {
      return
    }
    applyLODOptimizations('enhanced')
  }, GAUSSIAN_QUALITY_UPGRADE_DELAY)
}

const reloadModelForRouteChange = () => {
  if (!scene || !camera || !renderer) return
  if (!hasValidGaussPreviewSource.value) {
    markGaussianPerf('route-reload-skipped', {
      reason: 'missing-route-query',
      projectId: previewProjectId.value,
      fileId: previewFileId.value,
      assetPath: previewAssetPath.value,
    })
    return
  }

  unloadCurrentModel()

  loading.value = true
  loadingProgress.value = 0
  modelLoaded.value = false
  collisionAvailable.value = false
  lastSafeCameraPose = null
  currentTipIndex.value = 0

  if (tipInterval) {
    clearInterval(tipInterval)
  }
  startTipRotation()

  currentView.value = 'free'
  camera.position.copy(initialCameraPosition)
  controls.target.copy(initialCameraTarget)
  controls.update()

  loadLCCModel(createModelMatrix())
}

// ==================== LOD 性能优化配置 ====================
const applyLODOptimizations = (stage: 'first-screen' | 'enhanced' = 'enhanced') => {
  if (!lccObject) return

  try {
    const maxSplats =
      stage === 'enhanced'
        ? performanceMode.value
          ? ENHANCED_SCREEN_MAX_SPLATS
          : 2000000
        : FIRST_SCREEN_MAX_SPLATS

    if (typeof lccObject.setMaxSplats === 'function') {
      lccObject.setMaxSplats(maxSplats)
    }

    const maxDistance =
      stage === 'enhanced'
        ? ENHANCED_SCREEN_MAX_DISTANCE
        : FIRST_SCREEN_MAX_DISTANCE
    if (typeof lccObject.setMaxDistance === 'function') {
      lccObject.setMaxDistance(maxDistance)
    }

    if (typeof lccObject.setLodAutoLevelUp === 'function') {
      lccObject.setLodAutoLevelUp(true)
    }

    markGaussianPerf('lod-config-applied', {
      stage,
      maxSplats,
      maxDistance,
      performanceMode: performanceMode.value,
    })
  } catch (error) {
    console.error('❌ LOD 优化配置失败:', error)
  }
}

const snapshotCameraPose = () => {
  if (!camera || !controls) return null
  return {
    camera: camera.position.clone(),
    target: controls.target.clone(),
  }
}

const restoreCameraPose = (
  pose: { camera: THREE.Vector3; target: THREE.Vector3 } | null,
) => {
  if (!pose || !camera || !controls) return
  camera.position.copy(pose.camera)
  controls.target.copy(pose.target)
  controls.update()
}

const rememberSafeCameraPose = () => {
  const collision = detectCameraCollision(camera.position)
  if (collision.hit) return
  lastSafeCameraPose = snapshotCameraPose()
}

const detectCameraCollision = (position: THREE.Vector3) => {
  if (
    !collisionProtection.value ||
    !lccObject ||
    typeof lccObject.intersectsSphere !== 'function'
  ) {
    return { hit: false, delta: new THREE.Vector3() }
  }

  const result = lccObject.intersectsSphere({
    center: {
      x: position.x,
      y: position.y,
      z: position.z,
    },
    radius: COLLISION_RADIUS,
    noDelta: false,
  })

  const delta = new THREE.Vector3(
    result?.delta?.x ?? 0,
    result?.delta?.y ?? 0,
    result?.delta?.z ?? 0,
  )

  return {
    hit: Boolean(result?.hit),
    delta,
  }
}

const resolveCameraCollision = () => {
  if (
    !modelLoaded.value ||
    !camera ||
    !controls ||
    !collisionProtection.value
  ) {
    return false
  }

  const collision = detectCameraCollision(camera.position)
  if (!collision.hit) {
    rememberSafeCameraPose()
    return false
  }

  if (lastSafeCameraPose) {
    restoreCameraPose(lastSafeCameraPose)
    return true
  }

  if (collision.delta.lengthSq() <= 1e-8) {
    return true
  }

  const nextCameraPosition = camera.position
    .clone()
    .add(collision.delta.clone().multiplyScalar(1.05))
  const offset = nextCameraPosition.clone().sub(camera.position)

  camera.position.copy(nextCameraPosition)
  controls.target.add(offset)
  controls.update()

  if (!detectCameraCollision(camera.position).hit) {
    rememberSafeCameraPose()
  }

  return true
}

const handleCollisionProtectionChange = (value: boolean) => {
  if (value) {
    collisionAvailable.value = typeof lccObject?.intersectsSphere === 'function'
    resolveCameraCollision()
    if (collisionAvailable.value) {
      ElMessage.success('碰撞保护已开启')
    } else {
      ElMessage.info('碰撞保护已开启，模型加载完成后生效')
    }
  } else {
    lastSafeCameraPose = null
    ElMessage.info('碰撞保护已关闭')
  }
}

const syncFirstPersonRotationFromCamera = () => {
  if (!camera) return
  const direction = new THREE.Vector3()
  camera.getWorldDirection(direction)
  const nextRot = directionToRotation(direction)
  firstPersonCameraRot.value.lon = normalizeLon(nextRot.lon)
  firstPersonCameraRot.value.lat = clampFirstPersonLat(nextRot.lat)
}

const updateFirstPersonCamera = () => {
  if (!camera || !controls) return
  const direction = rotationToDirection(firstPersonCameraRot.value)
  const target = camera.position.clone().addScaledVector(direction, 10)
  controls.target.copy(target)
  camera.up.set(0, 1, 0)
  camera.lookAt(target)
  camera.updateMatrixWorld()
  controls.update()
}

const applyFirstPersonRotationDelta = (deltaX: number, deltaY: number) => {
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

  firstPersonCameraRot.value.lon = normalizeLon(
    firstPersonCameraRot.value.lon -
      limitedDeltaX * FIRST_PERSON_ROTATION_SENSITIVITY,
  )
  firstPersonCameraRot.value.lat = clampFirstPersonLat(
    firstPersonCameraRot.value.lat -
      limitedDeltaY * FIRST_PERSON_ROTATION_SENSITIVITY,
  )
  updateFirstPersonCamera()
}

const raycastGaussFromOrigin = (
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  maxDistance: number,
  radius = 0.06,
) => {
  if (!lccObject || typeof lccObject.raycastFromOrigin !== 'function') {
    return null
  }

  const hit = lccObject.raycastFromOrigin({
    origin: {
      x: origin.x,
      y: origin.y,
      z: origin.z,
    },
    direction: {
      x: direction.x,
      y: direction.y,
      z: direction.z,
    },
    maxDistance,
    radius,
  })

  if (
    !hit ||
    !Number.isFinite(hit.x) ||
    !Number.isFinite(hit.y) ||
    !Number.isFinite(hit.z)
  ) {
    return null
  }

  return new THREE.Vector3(hit.x, hit.y, hit.z)
}

const sampleFirstPersonGroundHeight = (position: THREE.Vector3) => {
  const downward = new THREE.Vector3(0, -1, 0)
  const localOrigin = position.clone()
  localOrigin.y += 0.2
  const localHit = raycastGaussFromOrigin(
    localOrigin,
    downward,
    Math.max(FIRST_PERSON_GROUND_PROBE_DISTANCE, DEFAULT_FIRST_PERSON_EYE_HEIGHT * 4),
  )

  if (localHit) {
    lastFirstPersonGroundHeight = localHit.y
    return localHit.y
  }

  const globalOrigin = position.clone()
  globalOrigin.y += Math.max(FIRST_PERSON_GROUND_PROBE_DISTANCE, 12)
  const globalHit = raycastGaussFromOrigin(globalOrigin, downward, 30)
  const fallbackGround = globalHit?.y ?? null

  if (fallbackGround === null) return lastFirstPersonGroundHeight
  if (
    lastFirstPersonGroundHeight !== null &&
    fallbackGround > lastFirstPersonGroundHeight + FIRST_PERSON_MAX_GROUND_HEIGHT_JUMP
  ) {
    return lastFirstPersonGroundHeight
  }

  lastFirstPersonGroundHeight = fallbackGround
  return fallbackGround
}

const resolveFirstPersonGroundPosition = (
  targetPosition: THREE.Vector3,
  options?: { snapImmediately?: boolean },
) => {
  if (!camera) return targetPosition

  if (!lccObject || typeof lccObject.raycastFromOrigin !== 'function') {
    const resolved = targetPosition.clone()
    if (options?.snapImmediately) {
      resolved.y = DEFAULT_FIRST_PERSON_EYE_HEIGHT
    }
    return resolved
  }

  const groundHeight = sampleFirstPersonGroundHeight(targetPosition)
  if (groundHeight === null) return targetPosition

  const desiredY = groundHeight + DEFAULT_FIRST_PERSON_EYE_HEIGHT
  const deltaY = desiredY - camera.position.y
  const resolved = targetPosition.clone()

  if (options?.snapImmediately) {
    resolved.y = desiredY
    return resolved
  }

  resolved.y =
    camera.position.y +
    THREE.MathUtils.clamp(
      deltaY,
      -FIRST_PERSON_MAX_STEP_DOWN,
      FIRST_PERSON_MAX_STEP_UP,
    )

  return resolved
}

const cleanupFirstPersonControls = () => {
  const canvas = renderer?.domElement
  if (!canvas) return
  canvas.removeEventListener('mousedown', handleFirstPersonMouseDown)
  canvas.removeEventListener('mousemove', handleFirstPersonMouseMove)
  canvas.removeEventListener('mouseup', handleFirstPersonMouseUp)
  canvas.removeEventListener('mouseleave', handleFirstPersonMouseUp)
  canvas.removeEventListener('wheel', handleFirstPersonWheel)
}

const setupFirstPersonControls = () => {
  const canvas = renderer?.domElement
  if (!canvas) return
  cleanupFirstPersonControls()
  canvas.addEventListener('mousedown', handleFirstPersonMouseDown)
  canvas.addEventListener('mousemove', handleFirstPersonMouseMove)
  canvas.addEventListener('mouseup', handleFirstPersonMouseUp)
  canvas.addEventListener('mouseleave', handleFirstPersonMouseUp)
  canvas.addEventListener('wheel', handleFirstPersonWheel, { passive: false })
}

function handleFirstPersonMouseDown(event: MouseEvent) {
  if (!firstPersonEnabled.value) return
  firstPersonMouseDown.value = true
  firstPersonMousePos.value = { x: event.clientX, y: event.clientY }
}

function handleFirstPersonMouseMove(event: MouseEvent) {
  if (!firstPersonEnabled.value || !firstPersonMouseDown.value) return

  const deltaX = event.clientX - firstPersonMousePos.value.x
  const deltaY = event.clientY - firstPersonMousePos.value.y
  firstPersonMousePos.value = { x: event.clientX, y: event.clientY }
  applyFirstPersonRotationDelta(deltaX, deltaY)
}

function handleFirstPersonMouseUp() {
  firstPersonMouseDown.value = false
}

function handleFirstPersonWheel(event: WheelEvent) {
  if (!firstPersonEnabled.value || !camera) return
  event.preventDefault()
  const delta = event.deltaY > 0 ? 5 : -5
  camera.fov = Math.max(30, Math.min(90, camera.fov + delta))
  camera.updateProjectionMatrix()
}

const enterFirstPersonMode = () => {
  if (!camera || !controls) return
  currentView.value = 'free'
  syncFirstPersonRotationFromCamera()
  firstPersonEnabled.value = true
  firstPersonMouseDown.value = false
  activeFirstPersonMoveDirections.clear()
  lastFirstPersonMoveAt = 0
  lastFirstPersonGroundHeight = null
  controls.enabled = false
  setupFirstPersonControls()
  camera.position.copy(
    resolveFirstPersonGroundPosition(camera.position.clone(), {
      snapImmediately: true,
    }),
  )
  updateFirstPersonCamera()
  resolveCameraCollision()
  rememberSafeCameraPose()
  ElMessage.success('已进入第一人称视角')
}

const exitFirstPersonMode = () => {
  if (!controls) return
  firstPersonEnabled.value = false
  firstPersonMouseDown.value = false
  activeFirstPersonMoveDirections.clear()
  lastFirstPersonMoveAt = 0
  lastFirstPersonGroundHeight = null
  cleanupFirstPersonControls()
  controls.enabled = true
  controls.update()
  rememberSafeCameraPose()
  ElMessage.info('已退出第一人称视角')
}

const toggleFirstPersonMode = () => {
  if (firstPersonEnabled.value) {
    exitFirstPersonMode()
  } else {
    enterFirstPersonMode()
  }
}

const getFirstPersonMoveBasis = () => {
  if (!camera) return null

  const forward = new THREE.Vector3()
  camera.getWorldDirection(forward)
  forward.y = 0

  if (forward.lengthSq() < 1e-8) {
    forward.copy(
      rotationToDirection({
        lon: firstPersonCameraRot.value.lon,
        lat: 0,
      }),
    )
    forward.y = 0
  }

  if (forward.lengthSq() < 1e-8) return null

  forward.normalize()
  const right = new THREE.Vector3()
    .crossVectors(new THREE.Vector3(0, 1, 0), forward)
    .normalize()

  return { forward, right }
}

const updateFirstPersonMovement = (timestamp: number) => {
  if (!firstPersonEnabled.value) {
    activeFirstPersonMoveDirections.clear()
    lastFirstPersonMoveAt = 0
    return false
  }

  if (activeFirstPersonMoveDirections.size === 0) {
    lastFirstPersonMoveAt = 0
    return false
  }

  const deltaSeconds = lastFirstPersonMoveAt
    ? Math.min((timestamp - lastFirstPersonMoveAt) / 1000, 0.05)
    : 1 / 60
  lastFirstPersonMoveAt = timestamp

  const moveBasis = getFirstPersonMoveBasis()
  if (!moveBasis || !camera || !controls) return false
  const { forward, right } = moveBasis
  const moveDistance = FIRST_PERSON_MOVE_SPEED * controlSpeed.value * deltaSeconds
  const offset = new THREE.Vector3()

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

  const previousPose = snapshotCameraPose()
  if (previousPose && !detectCameraCollision(previousPose.camera).hit) {
    lastSafeCameraPose = previousPose
  }

  const nextPosition = resolveFirstPersonGroundPosition(
    camera.position.clone().add(offset),
  )
  const resolvedOffset = nextPosition.clone().sub(camera.position)

  camera.position.copy(nextPosition)
  controls.target.add(resolvedOffset)
  updateFirstPersonCamera()

  const blocked = resolveCameraCollision()
  if (blocked && previousPose) {
    restoreCameraPose(previousPose)
    updateFirstPersonCamera()
    rememberSafeCameraPose()
    return false
  }

  rememberSafeCameraPose()
  return true
}

// ==================== 渲染循环（性能优化版 - 按需渲染）====================
const animate = () => {
  animationId = requestAnimationFrame(animate)

  // 获取时间差，用于平滑控制
  const delta = clock.getDelta()

  // 更新控制器（需要在渲染前更新）
  if (controls && !firstPersonEnabled.value) {
    controls.update()
  }

  updateFirstPersonMovement(performance.now())
  if (!firstPersonEnabled.value) {
    resolveCameraCollision()
  }

  // 🔥 重要：LCCRender.update() 必须在每一帧都调用
  // 参考demo实现，每帧都调用以保证流畅性
  if (LCCRender && LCCRender.update) {
    LCCRender.update()
  }

  // 🚀 性能优化：按需渲染 - 只在必要时渲染
  // 根据 LCC SDK 文档，使用 checkRenderNextFrame 可以显著提升性能
  let shouldRender = true
  if (lccObject && modelLoaded.value && typeof lccObject.checkRenderNextFrame === 'function') {
    shouldRender = lccObject.checkRenderNextFrame()
    if (shouldRender) {
      lccObject.clearRenderNextFrame()
    }
  }

  // 只在需要时渲染场景
  if (shouldRender) {
    renderer.render(scene, camera)
    renderCount.value++
    if (modelLoaded.value && !gaussianFirstFrameMarked) {
      gaussianFirstFrameMarked = true
      markGaussianPerf('first-frame', {
        elapsed: Math.round(performance.now() - gaussianLoadStartedAt),
      })
      measureGaussianPerf(
        'load-to-first-frame',
        'gaussian:load-start',
        GAUSSIAN_FIRST_FRAME_MARK,
      )
    }
  }

  // 每30帧更新一次相机位置显示，减少DOM操作
  if (frames % 30 === 0) {
    updateCameraPosition()
  }

  // 计算 FPS
  frames++
}

// ==================== FPS 监控（优化版 - 智能自适应） ====================
let lowFpsCount = 0 // 记录低 FPS 次数，避免误判

const startFPSMonitor = () => {
  fpsUpdateInterval = window.setInterval(() => {
    const now = performance.now()
    const delta = now - lastTime
    const currentFPS = Math.round((frames * 1000) / delta)
    fps.value = currentFPS
    frames = 0
    lastTime = now

    // 🚀 优化：智能自适应质量调整
    // 只有在性能模式下且持续低帧率时才调整，避免误判和频繁切换
    if (performanceMode.value && modelLoaded.value) {
      if (currentFPS < 25) {
        lowFpsCount++

        // 连续 3 秒低帧率才触发降级，避免偶发性卡顿导致降级
        if (lowFpsCount >= 3) {
          if (renderQuality.value === 'high') {
            renderQuality.value = 'medium'
            handleQualityChange('medium')
            ElMessage.warning('检测到持续性能不足，已自动降低渲染质量')
            lowFpsCount = 0
          } else if (currentFPS < 20 && renderQuality.value === 'medium') {
            renderQuality.value = 'low'
            handleQualityChange('low')
            ElMessage.warning('检测到严重卡顿，已自动切换到低质量模式')
            lowFpsCount = 0
          }
        }
      } else {
        // 帧率正常，重置计数器
        lowFpsCount = 0
      }
    }

    // 重置渲染计数器
    renderCount.value = 0
  }, 1000)
}

// 启动加载提示轮换
const startTipRotation = () => {
  tipInterval = window.setInterval(() => {
    if (!loading.value) {
      clearInterval(tipInterval)
      return
    }
    currentTipIndex.value = (currentTipIndex.value + 1) % loadingTips.length
  }, 3000)
}

// 更新相机位置
const updateCameraPosition = () => {
  cameraPos.value = {
    x: camera.position.x.toFixed(1),
    y: camera.position.y.toFixed(1),
    z: camera.position.z.toFixed(1)
  }
}

// ==================== 窗口大小调整（优化版 - 防抖处理） ====================
const handleResize = () => {
  // 清除之前的定时器，实现防抖
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
  }

  // 设置新的定时器，300ms 后执行调整
  resizeTimeout = window.setTimeout(() => {
    if (!canvasContainer.value) return

    // 更新相机宽高比
    camera.aspect = canvasContainer.value.clientWidth / canvasContainer.value.clientHeight
    camera.updateProjectionMatrix()

    // 更新渲染器尺寸
    renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
  }, 300)
}

// ==================== 视角控制 ====================
const setView = (view: typeof currentView.value) => {
  if (firstPersonEnabled.value) {
    exitFirstPersonMode()
  }
  currentView.value = view
  const distance = 10

  switch (view) {
    case 'back':
      camera.position.set(0, 2, -distance)
      controls.target.set(0, 2, 0)
      break
    case 'left':
      camera.position.set(-distance, 2, 0)
      controls.target.set(0, 2, 0)
      break
    case 'right':
      camera.position.set(distance, 2, 0)
      controls.target.set(0, 2, 0)
      break
  }

  controls.update()
  resolveCameraCollision()
  rememberSafeCameraPose()
  ElMessage.success(`已切换到${viewNames[view]}`)
}

// 重置相机
const resetCamera = () => {
  if (firstPersonEnabled.value) {
    exitFirstPersonMode()
  }
  currentView.value = 'free'
  camera.position.copy(initialCameraPosition)
  controls.target.copy(initialCameraTarget)
  controls.update()
  resolveCameraCollision()
  rememberSafeCameraPose()
  ElMessage.success('相机已重置')
}

// 移动相机（游戏风格移动）
const moveCamera = (direction: 'up' | 'down' | 'left' | 'right') => {
  if (firstPersonEnabled.value) {
    activeFirstPersonMoveDirections.add(direction)
    window.setTimeout(() => {
      activeFirstPersonMoveDirections.delete(direction)
    }, 140)
    return
  }

  const moveDistance = 0.8 * controlSpeed.value // 增加移动距离，更像游戏移动
  const previousPose = snapshotCameraPose()
  if (previousPose && !detectCameraCollision(previousPose.camera).hit) {
    lastSafeCameraPose = previousPose
  }

  // 获取相机的方向向量
  const forward = new THREE.Vector3()
  const right = new THREE.Vector3()

  // 计算相机的前方和右方向量（忽略Y轴，保持水平移动）
  camera.getWorldDirection(forward)
  forward.y = 0 // 忽略Y轴，保持水平移动
  forward.normalize()

  right.crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize()

  const offset = new THREE.Vector3()

  switch (direction) {
    case 'up':
      // 向前移动（沿着相机朝向）
      offset.copy(forward).multiplyScalar(moveDistance)
      break
    case 'down':
      // 向后移动（沿着相机朝向的反方向）
      offset.copy(forward).multiplyScalar(-moveDistance)
      break
    case 'left':
      // 向左平移（沿着相机右方向）
      offset.copy(right).multiplyScalar(moveDistance)
      break
    case 'right':
      // 向右平移（沿着相机左方向）
      offset.copy(right).multiplyScalar(-moveDistance)
      break
  }

  // 同时移动相机和目标点，保持视角不变
  camera.position.add(offset)
  controls.target.add(offset)
  controls.update()

  const blocked = resolveCameraCollision()
  if (blocked && previousPose) {
    restoreCameraPose(previousPose)
  }

  // 添加视觉反馈
  showMoveFeedback(direction)
}

// 显示移动反馈
const showMoveFeedback = (direction: string) => {
  const directionNames = {
    up: '向前',
    down: '向后',
    left: '向左',
    right: '向右'
  }

  // 创建移动提示
  const feedback = document.createElement('div')
  feedback.className = 'move-feedback'
  feedback.textContent = directionNames[direction as keyof typeof directionNames]
  feedback.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(64, 158, 255, 0.9);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    z-index: 1000;
    pointer-events: none;
    animation: fadeInOut 1s ease-out forwards;
  `

  // 添加动画样式
  if (!document.querySelector('#move-feedback-style')) {
    const style = document.createElement('style')
    style.id = 'move-feedback-style'
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        50% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
      }
    `
    document.head.appendChild(style)
  }

  document.body.appendChild(feedback)
  setTimeout(() => {
    document.body.removeChild(feedback)
  }, 1000)
}

// ==================== 功能函数 ====================

// 截图 - 修复版本
const takeScreenshot = () => {
  if (!modelLoaded.value) {
    ElMessage.warning('请等待模型加载完成')
    return
  }

  try {
    // 确保渲染一帧
    renderer.render(scene, camera)

    // 获取截图
    renderer.domElement.toBlob((blob) => {
      if (!blob) {
        throw new Error('截图失败')
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `gaussian-model-${Date.now()}.png`
      link.href = url
      link.click()

      // 清理
      setTimeout(() => URL.revokeObjectURL(url), 100)

      ElMessage.success('截图已保存')
    }, 'image/png')
  } catch (error) {
    ElMessage.error('截图失败，请重试')
    console.error('截图错误:', error)
  }
}

// 全屏切换
const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    canvasContainer.value?.parentElement?.requestFullscreen()
    isFullscreen.value = true
  } else {
    document.exitFullscreen()
    isFullscreen.value = false
  }
}

// 环境数据切换
const handleEnvChange = (value: boolean) => {
  if (!modelLoaded.value) {
    ElMessage.warning('请等待模型加载完成')
    useEnv.value = !value
    return
  }

  if (lccObject && lccObject.useEnvironment) {
    try {
      lccObject.useEnvironment(value)
      ElMessage.success(`环境数据已${value ? '启用' : '禁用'}`)
    } catch (error) {
      console.error('环境数据切换失败:', error)
      ElMessage.error('环境数据切换失败')
    }
  }
}

// 球谐渲染切换
const handleShcoefChange = (value: boolean) => {
  if (!modelLoaded.value) {
    ElMessage.warning('请等待模型加载完成')
    useShcoef.value = !value
    return
  }

  if (lccObject && lccObject.useShcoef) {
    try {
      lccObject.useShcoef(value)
      ElMessage.success(`球谐渲染已${value ? '启用' : '禁用'}`)
    } catch (error) {
      console.error('球谐渲染切换失败:', error)
      ElMessage.error('球谐渲染切换失败')
    }
  }
}

// 点云模式切换
const handlePointsModeChange = (value: boolean) => {
  if (!modelLoaded.value) {
    ElMessage.warning('请等待模型加载完成')
    pointsMode.value = !value
    return
  }

  if (lccObject && lccObject.togglePointsDisplayMode) {
    try {
      lccObject.togglePointsDisplayMode()
      ElMessage.success(`已切换到${value ? '点云' : '高斯'}模式`)
    } catch (error) {
      console.error('点云模式切换失败:', error)
      ElMessage.error('点云模式切换失败')
    }
  }
}

// 背景颜色切换
const handleBackgroundChange = (value: string) => {
  if (value && scene) {
    scene.background = new THREE.Color(value)
    ElMessage.success('背景颜色已更新')
  }
}

// 控制速度调整
const handleSpeedChange = (value: number) => {
  controls.rotateSpeed = value * 0.8 // 降低旋转速度
  controls.panSpeed = value * 0.8
  controls.zoomSpeed = value
}

// 渲染质量调整 - 实时应用优化
const handleQualityChange = (value: string) => {
  const pixelRatio = value === 'high' ? Math.min(window.devicePixelRatio, 1.5) :
                    value === 'medium' ? 1 : 0.8
  renderer.setPixelRatio(pixelRatio)

  // 如果模型已加载，实时更新 LOD 配置
  if (modelLoaded.value) {
    applyLODOptimizations()
  }

  ElMessage.success(`渲染质量已设置为${value === 'high' ? '高' : value === 'medium' ? '中' : '低'}`)
}

// 性能模式切换 - 实时应用优化
const handlePerformanceModeChange = (value: boolean) => {
  if (!modelLoaded.value) {
    ElMessage.info(`性能模式已${value ? '启用' : '禁用'}（加载完成后生效）`)
    return
  }

  // 实时重新应用 LOD 优化配置
  applyLODOptimizations()

  ElMessage.success(`性能模式已${value ? '启用' : '禁用'}，优化已应用`)
}

// ==================== 键盘快捷键 ====================
const handleKeydown = (event: KeyboardEvent) => {
  // 如果在输入框中，不处理快捷键
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return
  }

  switch (event.key.toLowerCase()) {
    case 'w':
      event.preventDefault()
      if (firstPersonEnabled.value) {
        activeFirstPersonMoveDirections.add('up')
      } else {
        moveCamera('up')
      }
      break
    case 's':
      event.preventDefault()
      if (firstPersonEnabled.value) {
        activeFirstPersonMoveDirections.add('down')
      } else {
        moveCamera('down')
      }
      break
    case 'a':
      event.preventDefault()
      if (firstPersonEnabled.value) {
        activeFirstPersonMoveDirections.add('left')
      } else {
        moveCamera('left')
      }
      break
    case 'd':
      event.preventDefault()
      if (firstPersonEnabled.value) {
        activeFirstPersonMoveDirections.add('right')
      } else {
        moveCamera('right')
      }
      break
    case 'v':
      event.preventDefault()
      toggleFirstPersonMode()
      break
    case 'escape':
      if (!firstPersonEnabled.value) return
      event.preventDefault()
      exitFirstPersonMode()
      break
    case 'r':
      event.preventDefault()
      resetCamera()
      break
    case 'h':
      event.preventDefault()
      showHelp.value = !showHelp.value
      break
    // 保持原有的截图和全屏功能（用不同的快捷键）
    case 'p':
      event.preventDefault()
      takeScreenshot()
      break
    case 'f':
      event.preventDefault()
      toggleFullscreen()
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

// ==================== 清理函数 ====================
const cleanup = () => {
  cleanupFirstPersonControls()
  activeFirstPersonMoveDirections.clear()

  // 清理定时器
  if (fpsUpdateInterval) {
    clearInterval(fpsUpdateInterval)
  }
  if (tipInterval) {
    clearInterval(tipInterval)
  }
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
  }

  // 清理动画
  if (animationId) {
    cancelAnimationFrame(animationId)
  }

  // 清理 LCC 对象
  unloadCurrentModel()

  // 清理控制器
  if (controls) {
    controls.dispose()
  }

  // 清理渲染器
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement)
    }
  }

  // 清理场景
  if (scene) {
    scene.traverse((object: any) => {
      if (object.geometry) {
        object.geometry.dispose()
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((material: any) => material.dispose())
        } else {
          object.material.dispose()
        }
      }
    })
  }

  // 清理 window 对象
  if (window) {
    delete (window as any).lccObject
    delete (window as any).LCCRender
    delete (window as any).camera
    delete (window as any).scene
    delete (window as any).renderer
  }
}

// ==================== 生命周期 ====================
onMounted(() => {
  installGaussFetchInterceptor()
  initScene()
  animate()
  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('keyup', handleKeyup)

  // 监听全屏变化
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
})

watch(
  () => [previewProjectId.value, previewFileId.value, previewAssetPath.value],
  (newValue, oldValue) => {
    if (!oldValue) return
    if (newValue[0] === oldValue[0] && newValue[1] === oldValue[1] && newValue[2] === oldValue[2]) return
    reloadModelForRouteChange()
  }
)

onBeforeUnmount(() => {
  // 移除事件监听
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('keyup', handleKeyup)

  uninstallGaussFetchInterceptor()

  // 执行清理
  cleanup()
})
</script>

<style scoped lang="scss">
.gaussian-container {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
}

// ==================== 顶部工具栏 ====================
.top-toolbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: linear-gradient(180deg, rgba(10, 10, 10, 0.95) 0%, rgba(10, 10, 10, 0) 100%);
  backdrop-filter: blur(20px) saturate(180%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  z-index: 10;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);

  &.toolbar-hidden {
    transform: translateY(-100%);
  }

  .toolbar-left,
  .toolbar-center,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  :deep(.el-button) {
    border-radius: 8px;
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
    }
  }
}

.toolbar-toggle {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 48px;
  height: 28px;
  background: linear-gradient(135deg, rgba(10, 10, 10, 0.9) 0%, rgba(26, 26, 46, 0.9) 100%);
  backdrop-filter: blur(20px);
  border-radius: 0 0 14px 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 9;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-top: none;

  &:hover {
    background: linear-gradient(135deg, rgba(10, 10, 10, 1) 0%, rgba(26, 26, 46, 1) 100%);
    height: 32px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .el-icon {
    color: #409EFF;
    font-size: 18px;
  }
}

// ==================== 3D 画布 ====================
.canvas-container {
  width: 100%;
  height: 100%;
  background: transparent;
  position: relative;
}

// ==================== 方向控制器 ====================
.direction-controls {
  position: absolute;
  bottom: 80px;
  left: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  z-index: 9;
  user-select: none;
  padding: 12px;
  background: rgba(10, 10, 10, 0.15);
  backdrop-filter: blur(8px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;

  &:hover {
    background: rgba(10, 10, 10, 0.25);
    backdrop-filter: blur(12px);
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .arrow-horizontal {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .arrow-btn {
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(12px) saturate(150%);
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;

    // 光晕效果
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, rgba(64, 158, 255, 0.1), transparent 70%);
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .el-icon {
      color: rgba(255, 255, 255, 0.65);
      font-size: 24px;
      transition: all 0.3s ease;
      position: relative;
      z-index: 1;
    }

    &:hover {
      background: rgba(64, 158, 255, 0.28);
      backdrop-filter: blur(16px) saturate(180%);
      border-color: rgba(64, 158, 255, 0.5);
      transform: scale(1.1);
      box-shadow: 0 8px 24px rgba(64, 158, 255, 0.4),
                  0 0 20px rgba(64, 158, 255, 0.2);

      &::before {
        opacity: 1;
      }

      .el-icon {
        color: rgba(255, 255, 255, 1);
        transform: scale(1.15);
        filter: drop-shadow(0 0 8px rgba(64, 158, 255, 0.6));
      }
    }

    &:active {
      transform: scale(0.98);
      background: rgba(64, 158, 255, 0.4);
      box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
    }

    // 方向特定的动画效果
    &.arrow-up:hover .el-icon {
      animation: bounce-up 0.6s ease-in-out infinite;
    }

    &.arrow-down:hover .el-icon {
      animation: bounce-down 0.6s ease-in-out infinite;
    }

    &.arrow-left:hover .el-icon {
      animation: bounce-left 0.6s ease-in-out infinite;
    }

    &.arrow-right:hover .el-icon {
      animation: bounce-right 0.6s ease-in-out infinite;
    }
  }
}

// 箭头弹跳动画
@keyframes bounce-up {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

@keyframes bounce-down {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(4px); }
}

@keyframes bounce-left {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(-4px); }
}

@keyframes bounce-right {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(4px); }
}

// ==================== 加载覆盖层 ====================
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(10, 10, 10, 0.98) 0%, rgba(26, 26, 46, 0.98) 100%);
  backdrop-filter: blur(30px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.loading-content {
  width: 420px;
  text-align: center;
  padding: 48px 40px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(40px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);

  .loading-spinner {
    position: relative;
    width: 80px;
    height: 80px;
    margin: 0 auto 32px;

    .spinner-ring {
      position: absolute;
      width: 100%;
      height: 100%;
      border: 3px solid transparent;
      border-top-color: #409EFF;
      border-radius: 50%;
      animation: spin 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;

      &:nth-child(2) {
        width: 70%;
        height: 70%;
        top: 15%;
        left: 15%;
        border-top-color: #67C23A;
        animation-duration: 2s;
        animation-direction: reverse;
      }

      &:nth-child(3) {
        width: 40%;
        height: 40%;
        top: 30%;
        left: 30%;
        border-top-color: #E6A23C;
        animation-duration: 1s;
      }
    }
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .loading-text {
    margin-top: 24px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 16px;
    font-weight: 500;
  }

  .loading-percent {
    margin-top: 8px;
    color: #409EFF;
    font-size: 32px;
    font-weight: 700;
    text-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
  }

  .loading-tip {
    margin-top: 16px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    height: 20px;
    transition: opacity 0.3s ease;
  }
}

// ==================== 右侧控制面板 ====================
.controls-panel {
  position: absolute;
  top: 84px;
  right: 0;
  max-height: calc(100% - 164px);
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 8;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &.panel-collapsed {
    transform: translateX(calc(100% - 48px));
  }

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(64, 158, 255, 0.3);
    border-radius: 3px;

    &:hover {
      background: rgba(64, 158, 255, 0.5);
    }
  }

  .panel-toggle {
    position: absolute;
    left: -48px;
    top: 24px;
    width: 48px;
    height: 64px;
    background: linear-gradient(90deg, rgba(10, 10, 10, 0.9) 0%, rgba(26, 26, 46, 0.9) 100%);
    backdrop-filter: blur(20px);
    border-radius: 12px 0 0 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-right: none;

    &:hover {
      background: linear-gradient(90deg, rgba(10, 10, 10, 1) 0%, rgba(26, 26, 46, 1) 100%);
      left: -50px;
      box-shadow: -4px 0 12px rgba(0, 0, 0, 0.3);
    }

    .el-icon {
      color: #409EFF;
      font-size: 22px;
    }
  }

  .panel-content {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
}

.control-card {
  width: 300px;
  background: linear-gradient(135deg, rgba(10, 10, 10, 0.9) 0%, rgba(26, 26, 46, 0.9) 100%);
  backdrop-filter: blur(30px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s ease;

  &:hover {
    border-color: rgba(64, 158, 255, 0.3);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  }

  :deep(.el-card__header) {
    background: linear-gradient(135deg, rgba(64, 158, 255, 0.1) 0%, rgba(103, 194, 58, 0.05) 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding: 16px 20px;
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
      background: linear-gradient(135deg, rgba(64, 158, 255, 0.15) 0%, rgba(103, 194, 58, 0.08) 100%);
    }
  }

  :deep(.el-card__body) {
    padding: 20px;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    user-select: none;

    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
      font-size: 15px;
      color: rgba(255, 255, 255, 0.95);

      .el-icon {
        color: #409EFF;
        font-size: 18px;
      }
    }

    .expand-icon {
      color: rgba(255, 255, 255, 0.6);
      font-size: 16px;
      transition: transform 0.3s ease;

      &.is-expanded {
        transform: rotate(180deg);
      }
    }
  }
}

.control-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  transition: all 0.3s ease;

  .control-label {
    display: flex;
    align-items: center;
    gap: 10px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;

    .el-icon {
      color: #409EFF;
      font-size: 16px;
    }
  }
}

.control-item-full {
  padding: 10px 0;

  .control-label {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;

    .el-icon {
      color: #409EFF;
      font-size: 16px;
    }
  }
}

// 信息卡片
.info-card {
  .info-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: linear-gradient(135deg, rgba(64, 158, 255, 0.05) 0%, rgba(103, 194, 58, 0.02) 100%);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.3s ease;

    &:hover {
      background: linear-gradient(135deg, rgba(64, 158, 255, 0.08) 0%, rgba(103, 194, 58, 0.04) 100%);
      border-color: rgba(64, 158, 255, 0.2);
      transform: translateX(-2px);
    }

    .info-label {
      color: rgba(255, 255, 255, 0.7);
      font-size: 13px;
    }

    .info-value {
      color: #409EFF;
      font-weight: 600;
      font-size: 14px;
      text-shadow: 0 2px 4px rgba(64, 158, 255, 0.2);
    }
  }
}

// ==================== 底部信息栏 ====================
.bottom-info-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: linear-gradient(0deg, rgba(10, 10, 10, 0.95) 0%, rgba(10, 10, 10, 0) 100%);
  backdrop-filter: blur(20px) saturate(180%);
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 24px;
  z-index: 10;
  border-top: 1px solid rgba(255, 255, 255, 0.05);

  .info-section {
    display: flex;
    align-items: center;
    gap: 10px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.3s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(64, 158, 255, 0.2);
    }

    .el-icon {
      color: #409EFF;
      font-size: 16px;
    }
  }
}

// ==================== 帮助面板 ====================
.help-button {
  position: absolute;
  bottom: 76px;
  right: 24px;
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #409EFF 0%, #67C23A 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 11;
  box-shadow: 0 6px 20px rgba(64, 158, 255, 0.4);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: scale(1.1) rotate(90deg);
    box-shadow: 0 8px 28px rgba(64, 158, 255, 0.6);
  }

  .el-icon {
    color: #fff;
  }
}

.help-panel {
  position: absolute;
  bottom: 76px;
  right: 92px;
  width: 320px;
  background: linear-gradient(135deg, rgba(10, 10, 10, 0.98) 0%, rgba(26, 26, 46, 0.98) 100%);
  backdrop-filter: blur(40px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  overflow: hidden;
  z-index: 11;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);

  .help-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 24px;
    background: linear-gradient(135deg, rgba(64, 158, 255, 0.15) 0%, rgba(103, 194, 58, 0.08) 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    font-weight: 600;
    font-size: 15px;
  }

  .help-content {
    padding: 20px 24px;
    max-height: 400px;
    overflow-y: auto;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(64, 158, 255, 0.3);
      border-radius: 3px;
    }
  }

  .help-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    color: rgba(255, 255, 255, 0.85);
    font-size: 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);

    &:last-child {
      border-bottom: none;
    }

    kbd {
      padding: 6px 12px;
      background: linear-gradient(135deg, rgba(64, 158, 255, 0.2) 0%, rgba(103, 194, 58, 0.1) 100%);
      border: 1px solid rgba(64, 158, 255, 0.3);
      border-radius: 6px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      font-weight: 600;
      color: #409EFF;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
  }
}

// ==================== 动画效果 ====================
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  max-height: 1000px;
}
</style>
