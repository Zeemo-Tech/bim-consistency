<template>
  <div class="pointcloud-view-panel">
    <div v-if="showInternalControls" class="panel-actions">
      <button
        :class="[
          'panel-refresh-btn',
          { 'is-first-person-active': firstPersonActive },
        ]"
        type="button"
        aria-label="第一人称"
        title="第一人称"
        @click="toggleFirstPersonMode"
      >
        <el-icon><User /></el-icon>
      </button>
      <button
        class="panel-refresh-btn"
        type="button"
        aria-label="重置视角"
        title="重置视角"
        @click="handleResetView"
      >
        <el-icon><RefreshRight /></el-icon>
      </button>
    </div>
    <div v-if="!pointcloudLoaded" class="empty-placeholder">
      <div class="placeholder-content">
        <el-icon class="placeholder-icon"><View /></el-icon>
        <p class="placeholder-text">
          {{
            pointcloudStatusText ||
            (isPresetMode ? '自动加载点云中...' : '输入 3D Tiles 地址并加载')
          }}
        </p>
      </div>
    </div>
    <div
      ref="pointcloudViewportEl"
      class="pointcloud-viewport"
      tabindex="0"
      @pointerdown="focusPointcloudViewport"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, toRefs } from 'vue'
import { RefreshRight, User, View } from '@element-plus/icons-vue'
import * as THREE from 'three'
import {
  ClippingGroup,
  NodeMaterial,
  PointsNodeMaterial,
  WebGPURenderer,
} from 'three/webgpu'
import { color as tslColor, vertexColor as tslVertexColor } from 'three/tsl'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { TilesRenderer } from '3d-tiles-renderer'
import { GLTFExtensionsPlugin } from '3d-tiles-renderer/three/plugins'
import type { TrajectoryPoint } from '@/api/calibration'
import { getScanTilesetUrl, getScanTilesAsset } from '@/api/fileManage'
import { buildGaussianTrajectoryYUpPose } from '../utils/fusionTransforms'
import { InfiniteGroundGrid } from '@/utils/three/infiniteGroundGrid'
import { InfiniteGroundGrid as InfiniteGroundGridWebgl } from '@/utils/three/infiniteGroundGridWebgl'
import { PointCloudEdlPipeline } from '@/utils/three/pointCloudEdl'
import { PointCloudEdlPipeline as PointCloudEdlPipelineWebgl } from '@/utils/three/pointCloudEdlWebgl'

type MoveDirection = 'up' | 'down' | 'left' | 'right'

const props = defineProps<{
  isPresetMode: boolean
  applyTilesetTransform?: boolean
  autoFitOnLoad?: boolean
  rotationLock?: boolean
  clickToEnterFirstPerson?: boolean
  currentTrajectoryPoint?: TrajectoryPoint | null
  showInternalControls?: boolean
  preferWebgl?: boolean
  pixelRatioCap?: number
  tilesResolutionScale?: number
  /** Render all visible leaf tiles instead of stopping at a coarse LOD level. */
  renderAllPoints?: boolean
  annotationEnabled?: boolean
  annotationPoint?: { x: number; y: number; z: number } | null
  annotationStatus?: 'default' | 'editing' | 'saved'
  annotationStashMarkers?: {
    key: string
    point: { x: number; y: number; z: number }
    status: 'default' | 'editing' | 'saved'
    highlighted: boolean
    synced: boolean
  }[]
  annotationHighlightCurrent?: boolean
  annotationMarkersVisible?: boolean
}>()

const showInternalControls = computed(
  () => props.showInternalControls !== false,
)

const { isPresetMode } = toRefs(props)

const emit = defineEmits<{
  (e: 'loaded-change', value: boolean): void
  (e: 'world-ready'): void
  (e: 'camera-change', value: { lon: number; lat: number }): void
  (e: 'first-person-change', value: boolean): void
  (
    e: 'annotation-pick',
    value: {
      point: { x: number; y: number; z: number } | null
      screen: { x: number; y: number } | null
      source: 'pointcloud'
      key?: string
      synced?: boolean
      componentId?: string
      componentInfo?: {
        id?: string | number
        name?: string
        type?: string
      } | null
    },
  ): void
}>()

const pointcloudViewportEl = ref<HTMLDivElement | null>(null)
const tilesetUrl = ref<string>('')
const pointcloudStatusText = ref('')
const pointcloudLoaded = ref(false)

const focusPointcloudViewport = () => {
  pointcloudViewportEl.value?.focus()
}

const hasPointcloudKeyboardFocus = () => {
  const viewport = pointcloudViewportEl.value
  const activeElement = document.activeElement
  if (!viewport || !(activeElement instanceof HTMLElement)) return false
  return activeElement === viewport || viewport.contains(activeElement)
}
const tilesErrorTargetMin = 1
const tilesErrorTargetMax = 40
const tilesErrorTargetNear = 0.5
const tilesErrorTargetFar = 3.5
const useUnlitMaterial = false
const defaultBgColor = '#0b1020'
const dprCap = 1.25
const unlitMaterialCache = new WeakMap<any, THREE.Material>()
const unlitTSLMaterialCache = new WeakMap<any, { v0?: any; v1?: any }>()
const pointsTSLMaterialCache = new WeakMap<any, { v0?: any; v1?: any }>()
const originalMaterialByTSL = new WeakMap<any, any>()

const getResolvedPixelRatioCap = () => {
  const value = Number(props.pixelRatioCap)
  if (!Number.isFinite(value) || value <= 0) return dprCap
  return Math.min(value, dprCap)
}

const getResolvedTilesResolutionScale = () => {
  const value = Number(props.tilesResolutionScale)
  if (!Number.isFinite(value) || value <= 0) return 1
  return clamp(value, 0.5, 1)
}

let pointcloudScene: THREE.Scene | null = null
let pointcloudCamera: THREE.PerspectiveCamera | null = null
let pointcloudRenderer: WebGPURenderer | THREE.WebGLRenderer | null = null
let pointcloudControls: OrbitControls | null = null
let pointcloudTileset: TilesRenderer | null = null
let pointcloudTilesetWrapper: THREE.Group | null = null
let pointcloudClippingGroup: ClippingGroup | null = null
let pointcloudContentGroup: THREE.Group | null = null
let pointcloudClipHost: ClippingGroup | null = null
let worldOriginAxes: THREE.AxesHelper | null = null
let annotationMarker: THREE.Group | null = null
let annotationStashGroup: THREE.Group | null = null
let manualTilesErrorTarget: number | null = null
let manualClipBox: THREE.Box3 | null = null
const annotationStashMarkerMap = new Map<string, THREE.Group>()
const annotationRaycaster = new THREE.Raycaster()
let annotationPointerId: number | null = null
let annotationPointerDown: { x: number; y: number } | null = null
let annotationPointerDragging = false
let rotationPointerId: number | null = null
let rotationPointerDown: { x: number; y: number } | null = null
let firstPersonPointerDown: { x: number; y: number } | null = null
const firstPersonActive = ref(false)
let animationId = 0
let isRendering = false
let needsRender = false
let tilesLoadingCount = 0
let isPointcloudLoading = false
let resizeObserver: ResizeObserver | null = null
let pointcloudMaxDim = 1
let fixedViewSize: number | null = null
let desiredPointSize: number | null = null
let pointcloudGroundGrid: InfiniteGroundGrid | null = null
let pointcloudGroundGridWebgl: InfiniteGroundGridWebgl | null = null
let pointcloudGroundGridVisible = false
let edlPipeline: PointCloudEdlPipeline | null = null
let edlPipelineWebgl: PointCloudEdlPipelineWebgl | null = null
let edlEnabled = true

// ==================== 点云着色模式（真彩 / 强度 / 台面分色）====================
type PointCloudColorMode = 'rgb' | 'intensity' | 'table-class'
type PointCloudColorRamp = 'grayscale' | 'spectrum' | 'viridis'
const COLOR_MODE_INDEX: Record<PointCloudColorMode, number> = {
  rgb: 0,
  intensity: 1,
  'table-class': 2,
}
const COLOR_RAMP_INDEX: Record<PointCloudColorRamp, number> = {
  grayscale: 0,
  spectrum: 1,
  viridis: 2,
}
let pointColorMode: PointCloudColorMode = 'rgb'
let pointColorRamp: PointCloudColorRamp = 'spectrum'
let pointColorRange: [number, number] = [0, 1]
let pointAttributeAvailable = false
const colorModeUniforms = {
  uColorMode: { value: 0 },
  uColorRamp: { value: 1 },
  uRangeMin: { value: 0 },
  uRangeMax: { value: 1 },
}
const colorModeMaterials = new WeakSet<THREE.Material>()

const POINT_COLOR_VERTEX_DECL = `
attribute float aIntensity;
attribute float aClass;
uniform int uColorMode;
uniform int uColorRamp;
uniform float uRangeMin;
uniform float uRangeMax;
varying vec3 vModeColor;
vec3 pointRampColor(float t) {
  t = clamp(t, 0.0, 1.0);
  if (uColorRamp == 0) { return vec3(t); }
  if (uColorRamp == 2) {
    const vec3 c0 = vec3(0.267, 0.005, 0.329);
    const vec3 c1 = vec3(0.188, 0.408, 0.556);
    const vec3 c2 = vec3(0.208, 0.718, 0.472);
    const vec3 c3 = vec3(0.993, 0.906, 0.144);
    float x = t * 3.0;
    if (x < 1.0) return mix(c0, c1, x);
    if (x < 2.0) return mix(c1, c2, x - 1.0);
    return mix(c2, c3, x - 2.0);
  }
  return clamp(vec3(
    abs(t * 6.0 - 3.0) - 1.0,
    2.0 - abs(t * 6.0 - 2.0),
    2.0 - abs(t * 6.0 - 4.0)
  ), 0.0, 1.0);
}
`
const POINT_COLOR_VERTEX_BODY = `
vModeColor = vec3(1.0);
if (uColorMode == 1) {
  float t = (aIntensity - uRangeMin) / max(uRangeMax - uRangeMin, 1e-5);
  vModeColor = pointRampColor(t);
} else if (uColorMode == 2) {
  vModeColor = aClass > 0.5 ? vec3(0.86, 0.36, 0.22) : vec3(0.24, 0.58, 0.90);
}
`

const attachColorModeShader = (mat: THREE.Material) => {
  if (!mat || colorModeMaterials.has(mat)) return
  const pointMat = mat as THREE.PointsMaterial & {
    onBeforeCompile?: (shader: any) => void
  }
  const previous = pointMat.onBeforeCompile
  pointMat.onBeforeCompile = (shader: any) => {
    previous?.call(pointMat, shader)
    shader.uniforms.uColorMode = colorModeUniforms.uColorMode
    shader.uniforms.uColorRamp = colorModeUniforms.uColorRamp
    shader.uniforms.uRangeMin = colorModeUniforms.uRangeMin
    shader.uniforms.uRangeMax = colorModeUniforms.uRangeMax
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${POINT_COLOR_VERTEX_DECL}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n${POINT_COLOR_VERTEX_BODY}`,
      )
    const fragmentDecl = `
varying vec3 vModeColor;
uniform int uColorMode;
`
    const fragmentOverride = `if (uColorMode > 0) diffuseColor.rgb = vModeColor;\n`
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>\n${fragmentDecl}`,
    )
    if (shader.fragmentShader.includes('#include <opaque_fragment>')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `${fragmentOverride}#include <opaque_fragment>`,
      )
    } else {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `${fragmentOverride}#include <color_fragment>`,
      )
    }
  }
  pointMat.needsUpdate = true
  colorModeMaterials.add(mat)
}

// 从 pnts 的 batch table 读取 INTENSITY / CLASSIFICATION，写成顶点属性
const readBatchScalar = (batchTable: any, key: string): number[] | null => {
  if (!batchTable || typeof batchTable.getData !== 'function') return null
  const desc = batchTable.header?.[key]
  if (!desc) return null
  try {
    const data = batchTable.getData(key, desc.componentType, desc.type)
    return data ? Array.from(data as ArrayLike<number>) : null
  } catch {
    return null
  }
}

const applyPointAttributes = (root: any) => {
  let intensityMin = Infinity
  let intensityMax = -Infinity
  let anyAttribute = false
  root?.traverse?.((obj: any) => {
    if (!obj?.isPoints || !obj.geometry) return
    const geometry = obj.geometry as THREE.BufferGeometry
    if (geometry.getAttribute('aIntensity') || geometry.getAttribute('aClass'))
      return
    const batchTable = obj.batchTable ?? obj.userData?.batchTable
    const count: number = batchTable?.count ?? geometry.getAttribute('position')?.count ?? 0
    if (!count) return
    const intensity = readBatchScalar(batchTable, 'INTENSITY')
    const classification = readBatchScalar(batchTable, 'CLASSIFICATION')
    if (intensity && intensity.length === count) {
      const attribute = new Float32Array(count)
      for (let i = 0; i < count; i++) {
        const value = Number(intensity[i])
        attribute[i] = value
        if (value < intensityMin) intensityMin = value
        if (value > intensityMax) intensityMax = value
      }
      geometry.setAttribute('aIntensity', new THREE.BufferAttribute(attribute, 1))
      anyAttribute = true
    }
    if (classification && classification.length === count) {
      const attribute = new Float32Array(count)
      for (let i = 0; i < count; i++) {
        attribute[i] = Number(classification[i]) === 2 ? 1 : 0
      }
      geometry.setAttribute('aClass', new THREE.BufferAttribute(attribute, 1))
      anyAttribute = true
    }
  })
  if (intensityMin <= intensityMax && Number.isFinite(intensityMin)) {
    pointColorRange = [intensityMin, intensityMax]
    colorModeUniforms.uRangeMin.value = intensityMin
    colorModeUniforms.uRangeMax.value = intensityMax
  }
  if (anyAttribute) pointAttributeAvailable = true
}

const syncColorModeUniforms = () => {
  colorModeUniforms.uColorMode.value = COLOR_MODE_INDEX[pointColorMode]
  colorModeUniforms.uColorRamp.value = COLOR_RAMP_INDEX[pointColorRamp]
  colorModeUniforms.uRangeMin.value = pointColorRange[0]
  colorModeUniforms.uRangeMax.value = pointColorRange[1]
}

/** 作用：切换点云着色模式（真彩 / 强度 / 台面分色），并可选设置色带与范围。 */
const setColorMode = (
  mode: PointCloudColorMode,
  ramp?: PointCloudColorRamp,
  range?: [number, number] | null,
) => {
  pointColorMode = mode
  if (ramp) pointColorRamp = ramp
  if (range && Number.isFinite(range[0]) && Number.isFinite(range[1])) {
    pointColorRange = range
  }
  syncColorModeUniforms()
  if (pointcloudScene) applyMaterialMode(pointcloudScene)
  requestRender()
}

let lastTilesErrorTarget = -1
let rendererReady = false
let initPromise: Promise<void> | null = null
let rendererMode: 'webgpu' | 'webgl' | null = null
let captureTarget: THREE.RenderTarget | null = null
let cleaningUp = false
const FIRST_PERSON_COLLISION_RADIUS = 0.35
const DEFAULT_FIRST_PERSON_EYE_HEIGHT = 1.65
const FIRST_PERSON_MIN_EYE_HEIGHT = 1.45
const FIRST_PERSON_MAX_EYE_HEIGHT = 1.85
const FIRST_PERSON_GROUND_PROBE_DISTANCE = 8
const FIRST_PERSON_MAX_STEP_UP = 0.18
const FIRST_PERSON_MAX_STEP_DOWN = 0.5
const FIRST_PERSON_ROTATION_SENSITIVITY = 0.12
const FIRST_PERSON_MAX_POINTER_DELTA = 48
const FIRST_PERSON_MAX_PITCH = 55
const FIRST_PERSON_GROUND_POINT_THRESHOLD = 0.45
const FIRST_PERSON_MOVE_SPEED = 2.8
let firstPersonEyeHeight: number | null = null
const activeFirstPersonMoveDirections = new Set<MoveDirection>()
let lastFirstPersonMoveAt = 0

const clampLat = (lat: number) => Math.max(-85, Math.min(85, lat))
const clampFirstPersonLat = (lat: number) =>
  Math.max(-FIRST_PERSON_MAX_PITCH, Math.min(FIRST_PERSON_MAX_PITCH, lat))
const normalizeLon = (lon: number) =>
  THREE.MathUtils.euclideanModulo(lon + 180, 360) - 180

const rotationToDirection = (rot: { lon: number; lat: number }) => {
  const lat = THREE.MathUtils.degToRad(clampLat(rot.lat))
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

const runCleanupSafely = (label: string, task: () => void) => {
  try {
    task()
  } catch (error) {}
}

const disposeObject3D = (obj: THREE.Object3D) => {
  obj.traverse((child: any) => {
    if (child?.geometry) child.geometry.dispose?.()
    const material = child?.material
    if (Array.isArray(material)) material.forEach((m) => m?.dispose?.())
    else material?.dispose?.()
  })
}

const applySharedMaterialFlags = (mat: any, src: any) => {
  const alphaTest = src?.alphaTest ?? 0
  const opacity = src?.opacity ?? 1
  mat.alphaTest = alphaTest
  mat.opacity = opacity
  mat.transparent = alphaTest > 0 ? false : !!src?.transparent || opacity < 1
  mat.side = src?.side ?? THREE.FrontSide
}

const getOrCreateUnlitMaterialWebGL = (
  src: any,
  opts: { vertexColors: boolean; isPoints: boolean },
) => {
  const cached = unlitMaterialCache.get(src)
  if (cached) return cached

  const baseColor = opts.vertexColors
    ? new THREE.Color(0xffffff)
    : (src?.color?.clone?.() ?? new THREE.Color(0xffffff))

  let mat: THREE.Material
  if (opts.isPoints) {
    const next = new THREE.PointsMaterial({
      size: desiredPointSize ?? src?.size ?? 1,
      sizeAttenuation:
        desiredPointSize !== null ? false : (src?.sizeAttenuation ?? true),
      color: baseColor,
      vertexColors: opts.vertexColors,
    })
    if (src?.map) next.map = src.map
    applySharedMaterialFlags(next, src)
    next.toneMapped = false
    attachColorModeShader(next)
    mat = next
  } else {
    const next = new THREE.MeshBasicMaterial({
      color: baseColor,
      vertexColors: opts.vertexColors,
    })
    if (src?.map) next.map = src.map
    if (src?.alphaMap) next.alphaMap = src.alphaMap
    applySharedMaterialFlags(next, src)
    next.toneMapped = false
    mat = next
  }

  unlitMaterialCache.set(src, mat)
  return mat
}

const getOrCreateUnlitTSLMaterial = (
  src: any,
  opts: { vertexColors: boolean },
) => {
  const entry = unlitTSLMaterialCache.get(src) ?? {}
  const cached = opts.vertexColors ? entry.v1 : entry.v0
  if (cached) return cached

  const mat = new NodeMaterial()
  mat.name = src?.name ? `${src.name} (TSL Unlit)` : 'TSL Unlit'
  mat.fog = false
  mat.lights = false

  applySharedMaterialFlags(mat, src)
  mat.toneMapped = false

  mat.colorNode = opts.vertexColors
    ? tslVertexColor()
    : tslColor(src?.color ?? 0xffffff)
  mat.vertexColors = opts.vertexColors
  ;(mat as any).__viewerOriginalMaterial = src
  if (opts.vertexColors) entry.v1 = mat
  else entry.v0 = mat
  unlitTSLMaterialCache.set(src, entry)

  return mat
}

const getOrCreatePointsTSLMaterial = (
  src: any,
  opts: { vertexColors: boolean },
) => {
  const entry = pointsTSLMaterialCache.get(src) ?? {}
  const cached = opts.vertexColors ? entry.v1 : entry.v0
  if (cached) return cached

  const mat: any = new PointsNodeMaterial()
  mat.name = src?.name ? `${src.name} (TSL Points)` : 'TSL Points'
  mat.fog = false
  mat.lights = false
  mat.toneMapped = false

  applySharedMaterialFlags(mat, src)
  mat.vertexColors = opts.vertexColors
  mat.color = src?.color?.clone?.() ?? new THREE.Color(0xffffff)
  mat.colorNode = opts.vertexColors
    ? tslVertexColor()
    : tslColor(src?.color ?? 0xffffff)
  mat.size = desiredPointSize ?? src?.size ?? 1
  mat.sizeAttenuation =
    desiredPointSize !== null ? false : (src?.sizeAttenuation ?? true)
  mat.map = src?.map ?? null
  mat.alphaMap = src?.alphaMap ?? null
  mat.depthTest = src?.depthTest ?? true
  mat.depthWrite = desiredPointSize !== null ? true : (src?.depthWrite ?? false)

  originalMaterialByTSL.set(mat, src)
  ;(mat as any).__viewerOriginalMaterial = src
  if (opts.vertexColors) entry.v1 = mat
  else entry.v0 = mat
  pointsTSLMaterialCache.set(src, entry)

  return mat
}

const applyMaterialMode = (root: any) => {
  root.traverse((obj: any) => {
    if (!obj?.material) return
    const hasVertexColors = !!obj.geometry?.attributes?.color
    if (rendererMode === 'webgpu') {
      if (Array.isArray(obj.material)) return
      if (obj?.isPoints) {
        const src =
          (obj.material as any)?.__viewerOriginalMaterial ??
          originalMaterialByTSL.get(obj.material) ??
          obj.material
        const next = getOrCreatePointsTSLMaterial(src ?? obj.material, {
          vertexColors: hasVertexColors,
        })
        if (obj.material !== next) obj.material = next
        return
      }
      if (!useUnlitMaterial) return
      const src =
        (obj.material as any)?.__viewerOriginalMaterial ??
        originalMaterialByTSL.get(obj.material) ??
        obj.material
      const next = getOrCreateUnlitTSLMaterial(src, {
        vertexColors: hasVertexColors,
      })
      if (obj.material !== next) obj.material = next
      return
    }

    // 点云始终使用统一材质（与参考页一致：sizeAttenuation=false / toneMapped=false），
    // 非点对象才受 useUnlitMaterial 控制
    if (!useUnlitMaterial && !obj.isPoints) return

    const opts = {
      vertexColors: hasVertexColors,
      isPoints: Boolean(obj.isPoints),
    }
    if (Array.isArray(obj.material)) {
      const next = obj.material.map((src: any) =>
        getOrCreateUnlitMaterialWebGL(src, opts),
      )
      const isSame = obj.material.every(
        (src: any, index: number) => src === next[index],
      )
      if (!isSame) obj.material = next
      return
    }
    const next = getOrCreateUnlitMaterialWebGL(obj.material, opts)
    if (obj.material !== next) obj.material = next
  })
}

const estimateGeometryBytes = (geometry: any) => {
  let bytes = 0
  const index = geometry?.index
  if (index?.array?.byteLength) bytes += index.array.byteLength
  const attrs = geometry?.attributes ?? {}
  for (const a of Object.values(attrs) as any[]) {
    const array = a?.isInterleavedBufferAttribute ? a.data?.array : a?.array
    if (array?.byteLength) bytes += array.byteLength
  }
  return bytes
}

const ensureWebGPUVertexAlignment = (geometry: any) => {
  if (!geometry?.attributes) return 0

  let fixed = 0
  for (const [name, attr] of Object.entries(geometry.attributes)) {
    const a = attr as any
    if (!a) continue
    if (a.isInterleavedBufferAttribute) continue

    const array = a.array
    const bytesPerElement = array?.BYTES_PER_ELEMENT ?? 0
    const itemSize = a.itemSize ?? 0
    const stride = bytesPerElement * itemSize

    if (!bytesPerElement || !itemSize || stride % 4 === 0) continue
    if (itemSize > 4) continue

    const count = a.count ?? 0
    const paddedSize = 4
    const paddedArray = new array.constructor(count * paddedSize)

    for (let i = 0; i < count; i++) {
      const srcIndex = i * itemSize
      const dstIndex = i * paddedSize
      for (let c = 0; c < itemSize; c++) {
        paddedArray[dstIndex + c] = array[srcIndex + c]
      }
      if (name === 'color' && bytesPerElement === 1 && a.normalized) {
        paddedArray[dstIndex + 3] = 255
      } else {
        paddedArray[dstIndex + 3] = 1
      }
    }

    const interleaved = new THREE.InterleavedBuffer(paddedArray, paddedSize)
    interleaved.usage = a.usage ?? THREE.StaticDrawUsage

    const newAttr = new THREE.InterleavedBufferAttribute(
      interleaved,
      itemSize,
      0,
      a.normalized,
    )
    ;(newAttr as any).gpuType = a.gpuType
    geometry.setAttribute(name, newAttr)
    fixed++
  }

  return fixed
}

const sanitizeObjectForWebGPU = (root: any) => {
  let fixedAttributes = 0
  let oversizedGeometries = 0

  const maxBufferBytes = 256 * 1024 * 1024
  const softLimit = maxBufferBytes - 8 * 1024 * 1024

  root.traverse((obj: any) => {
    const geom = obj?.geometry
    if (!geom?.isBufferGeometry) return

    fixedAttributes += ensureWebGPUVertexAlignment(geom)

    const bytes = estimateGeometryBytes(geom)
    if (bytes > softLimit) {
      oversizedGeometries++
      obj.visible = false
    }
  })

  return { fixedAttributes, oversizedGeometries }
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const getTilesErrorTarget = () => {
  if (props.renderAllPoints === true) return 0
  if (
    manualTilesErrorTarget !== null &&
    Number.isFinite(manualTilesErrorTarget) &&
    manualTilesErrorTarget > 0
  ) {
    return manualTilesErrorTarget
  }
  if (!pointcloudCamera || !pointcloudControls) return tilesErrorTargetMin
  const base = (fixedViewSize ?? pointcloudMaxDim ?? 1) || 1
  const distance = pointcloudCamera.position.distanceTo(
    pointcloudControls.target,
  )
  const ratio = distance / Math.max(base, 1)
  const t = clamp(
    (ratio - tilesErrorTargetNear) /
      (tilesErrorTargetFar - tilesErrorTargetNear),
    0,
    1,
  )
  return tilesErrorTargetMin + t * (tilesErrorTargetMax - tilesErrorTargetMin)
}

const applyTilesErrorTarget = () => {
  if (!pointcloudTileset) return
  const next = Math.round(getTilesErrorTarget() * 10) / 10
  if (Math.abs(next - lastTilesErrorTarget) < 0.1) return
  lastTilesErrorTarget = next
  pointcloudTileset.errorTarget = next
}

const getPointcloudRoot = () => {
  return pointcloudTilesetWrapper ?? pointcloudTileset?.group ?? null
}

const getPointcloudWorldBox = () => {
  const root = getPointcloudRoot()
  if (!root) return null
  root.updateMatrixWorld?.(true)
  const box = new THREE.Box3().setFromObject(root)
  return box.isEmpty() ? null : box
}

const buildClipPlanesFromBox = (box: THREE.Box3) => {
  return [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -box.min.x),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), box.max.x),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -box.min.y),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), box.max.y),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -box.min.z),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), box.max.z),
  ]
}

const applyClipPlanesToMaterial = (
  material: THREE.Material | THREE.Material[] | null | undefined,
  planes: THREE.Plane[] | null,
) => {
  const targetMaterials = Array.isArray(material)
    ? material
    : material
      ? [material]
      : []
  targetMaterials.forEach((mat: any) => {
    mat.clippingPlanes = planes ? planes.map((plane) => plane.clone()) : null
    mat.clipIntersection = true
    mat.needsUpdate = true
  })
}

const applyManualClipBox = () => {
  const root = getPointcloudRoot()
  if (!pointcloudRenderer) return

  const planes =
    manualClipBox && !manualClipBox.isEmpty()
      ? buildClipPlanesFromBox(manualClipBox)
      : null

  if (rendererMode === 'webgpu' && pointcloudClipHost) {
    pointcloudClipHost.enabled = !!planes
    const hostPlanes = pointcloudClipHost.clippingPlanes as any
    if (Array.isArray(hostPlanes)) hostPlanes.length = 0
    else pointcloudClipHost.clippingPlanes = []
    if (planes) {
      pointcloudClipHost.clippingPlanes.push(
        ...planes.map((plane) => plane.clone()),
      )
    }
    requestRender()
    return
  }

  if ('localClippingEnabled' in pointcloudRenderer) {
    ;(pointcloudRenderer as THREE.WebGLRenderer).localClippingEnabled = !!planes
  }

  if (!root) {
    requestRender()
    return
  }

  root.traverse((obj: any) => {
    if (!obj?.material) return
    applyClipPlanesToMaterial(obj.material, planes)
  })
  requestRender()
}

const getCaptureTarget = (width: number, height: number) => {
  if (
    !captureTarget ||
    captureTarget.width !== width ||
    captureTarget.height !== height
  ) {
    captureTarget?.dispose()
    captureTarget = new THREE.RenderTarget(width, height, {
      depthBuffer: true,
      stencilBuffer: false,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    })
    captureTarget.texture.colorSpace = THREE.SRGBColorSpace
  }
  return captureTarget
}

const updateTilesetResolution = () => {
  if (!pointcloudViewportEl.value || !pointcloudTileset || !pointcloudCamera)
    return
  const rect = pointcloudViewportEl.value.getBoundingClientRect()
  const scale = getResolvedTilesResolutionScale()
  const w = Math.max(1, Math.floor((rect.width || 1) * scale))
  const h = Math.max(1, Math.floor((rect.height || 1) * scale))
  pointcloudTileset.setResolution?.(pointcloudCamera, w, h)
  if (rendererMode === 'webgl' && pointcloudRenderer) {
    pointcloudTileset.setResolutionFromRenderer?.(
      pointcloudCamera,
      pointcloudRenderer as THREE.WebGLRenderer,
    )
  }
}

const resolveWebGPUDevice = () => {
  const anyRenderer = pointcloudRenderer as any
  return (
    anyRenderer?.device ||
    anyRenderer?.backend?.device ||
    anyRenderer?._backend?.device ||
    anyRenderer?.getDevice?.() ||
    null
  )
}

const readWebGPUCanvas = async () => {
  try {
    if (!pointcloudRenderer || !rendererReady || rendererMode !== 'webgpu')
      return null
    if (
      typeof GPUBufferUsage === 'undefined' ||
      typeof GPUMapMode === 'undefined'
    )
      return null
    const canvas = pointcloudRenderer.domElement
    const device = resolveWebGPUDevice()
    const context =
      (canvas.getContext?.('webgpu') as GPUCanvasContext | null) ||
      ((pointcloudRenderer as any).context as GPUCanvasContext | null)
    if (!device || !context?.getCurrentTexture) return null

    const width = canvas.width
    const height = canvas.height
    if (!width || !height) return null

    const texture = context.getCurrentTexture()
    if (!texture) return null

    const bytesPerPixel = 4
    const unpaddedBytesPerRow = width * bytesPerPixel
    const align = 256
    const bytesPerRow = Math.ceil(unpaddedBytesPerRow / align) * align
    const bufferSize = bytesPerRow * height

    const readBuffer = device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    })

    const encoder = device.createCommandEncoder()
    encoder.copyTextureToBuffer(
      { texture },
      { buffer: readBuffer, bytesPerRow, rowsPerImage: height },
      { width, height, depthOrArrayLayers: 1 },
    )
    device.queue.submit([encoder.finish()])

    await readBuffer.mapAsync(GPUMapMode.READ)
    const mapped = readBuffer.getMappedRange()
    const src = new Uint8Array(mapped)
    const pixels = new Uint8ClampedArray(width * height * bytesPerPixel)
    for (let row = 0; row < height; row += 1) {
      const srcOffset = row * bytesPerRow
      const dstOffset = row * unpaddedBytesPerRow
      pixels.set(
        src.subarray(srcOffset, srcOffset + unpaddedBytesPerRow),
        dstOffset,
      )
    }
    readBuffer.unmap()
    readBuffer.destroy?.()

    const preferredFormat =
      (navigator.gpu as any)?.getPreferredCanvasFormat?.() ||
      (navigator.gpu as any)?.getPreferredFormat?.() ||
      ''
    if (
      typeof preferredFormat === 'string' &&
      preferredFormat.startsWith('bgra')
    ) {
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i]
        pixels[i] = pixels[i + 2]
        pixels[i + 2] = r
      }
    }

    const output = document.createElement('canvas')
    output.width = width
    output.height = height
    const ctx = output.getContext('2d')
    if (!ctx) return null
    ctx.putImageData(new ImageData(pixels, width, height), 0, 0)
    return output.toDataURL('image/png')
  } catch (error) {
    return null
  }
}

const readRenderTargetToDataUrl = async (
  target: THREE.RenderTarget,
  width: number,
  height: number,
) => {
  const backend = (pointcloudRenderer as any)?.backend
  const device = backend?.device
  if (!backend || !device) return null
  const texture = target.texture
  const textureData = backend.get(texture)
  const textureGPU = textureData?.texture
  const format = textureData?.textureDescriptorGPU?.format as string | undefined
  if (!textureGPU || !format) return null

  const bytesPerTexel = 4
  const unpaddedBytesPerRow = width * bytesPerTexel
  const align = 256
  const bytesPerRow = Math.ceil(unpaddedBytesPerRow / align) * align
  const bufferSize = bytesPerRow * height

  const readBuffer = device.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  })

  const encoder = device.createCommandEncoder()
  encoder.copyTextureToBuffer(
    { texture: textureGPU },
    { buffer: readBuffer, bytesPerRow, rowsPerImage: height },
    { width, height, depthOrArrayLayers: 1 },
  )
  device.queue.submit([encoder.finish()])

  await readBuffer.mapAsync(GPUMapMode.READ)
  const mapped = readBuffer.getMappedRange()
  const src = new Uint8Array(mapped)
  const pixels = new Uint8ClampedArray(width * height * bytesPerTexel)
  for (let row = 0; row < height; row += 1) {
    const srcOffset = row * bytesPerRow
    const dstOffset = row * unpaddedBytesPerRow
    pixels.set(
      src.subarray(srcOffset, srcOffset + unpaddedBytesPerRow),
      dstOffset,
    )
  }
  readBuffer.unmap()
  readBuffer.destroy?.()

  if (format.startsWith('bgra')) {
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i]
      pixels[i] = pixels[i + 2]
      pixels[i + 2] = r
    }
  }

  const output = document.createElement('canvas')
  output.width = width
  output.height = height
  const ctx = output.getContext('2d')
  if (!ctx) return null
  ctx.putImageData(new ImageData(pixels, width, height), 0, 0)
  return output.toDataURL('image/png')
}

const renderSceneToDataUrl = async (width: number, height: number) => {
  if (!pointcloudRenderer || !pointcloudScene || !pointcloudCamera) return null
  const rendererAny = pointcloudRenderer as any
  if (!rendererAny.setRenderTarget) return null
  const prevTarget = rendererAny.getRenderTarget?.() ?? null
  const target = getCaptureTarget(width, height)
  rendererAny.setRenderTarget(target)
  await (pointcloudRenderer as WebGPURenderer).renderAsync?.(
    pointcloudScene,
    pointcloudCamera,
  )
  await (pointcloudRenderer as WebGPURenderer).waitForGPU?.()
  const dataUrl = await readRenderTargetToDataUrl(target, width, height)
  rendererAny.setRenderTarget(prevTarget)
  return dataUrl
}

const syncRendererSize = (
  renderer: WebGPURenderer | THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  containerEl: HTMLElement,
  afterResize?: () => void,
) => {
  const rect = containerEl.getBoundingClientRect()
  const w = Math.max(1, Math.floor(rect.width || 1))
  const h = Math.max(1, Math.floor(rect.height || 1))
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap)
  const cw = Math.floor(w * dpr)
  const ch = Math.floor(h * dpr)
  if (renderer.domElement.width === cw && renderer.domElement.height === ch)
    return false

  renderer.setPixelRatio(dpr)
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  afterResize?.()
  return true
}

const ensureWorldOriginAxes = () => {}

const updateWorldOriginAxesScale = (_size?: number | null) => {}

const fitCameraToObject = (
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  object: THREE.Object3D,
) => {
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  if (!Number.isFinite(size.x + size.y + size.z)) return
  const maxDim = Math.max(size.x, size.y, size.z)
  if (maxDim <= 0) return
  pointcloudMaxDim = maxDim
  updateWorldOriginAxesScale(Math.max(maxDim * 0.12, 1))

  const fov = THREE.MathUtils.degToRad(camera.fov)
  const distance = maxDim / 2 / Math.tan(fov / 2)

  controls.target.copy(center)
  camera.position.set(
    center.x,
    center.y + maxDim * 0.15,
    center.z + distance * 2.2,
  )
  camera.near = Math.max(0.01, distance / 100)
  camera.far = Math.max(100000, distance * 200)
  camera.updateProjectionMatrix()
  controls.update()
}

const fitCameraToSphere = (
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  center: THREE.Vector3,
  radius: number,
) => {
  const r = Number.isFinite(radius) && radius > 0 ? radius : 1
  const maxDim = r * 2
  pointcloudMaxDim = maxDim
  updateWorldOriginAxesScale(Math.max(maxDim * 0.12, 1))
  const fov = THREE.MathUtils.degToRad(camera.fov)
  const distance = maxDim / 2 / Math.tan(fov / 2)

  controls.target.copy(center)
  camera.position.set(
    center.x,
    center.y + maxDim * 0.15,
    center.z + distance * 2.2,
  )
  camera.near = Math.max(0.01, distance / 100)
  camera.far = Math.max(100000, distance * 200)
  camera.updateProjectionMatrix()
  controls.update()
}

const setTopView = (
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  center: THREE.Vector3,
  height: number,
) => {
  const h = Number.isFinite(height) && height > 0 ? height : 10
  controls.target.copy(center)
  camera.position.set(center.x, center.y + h, center.z + 0.1)
  camera.lookAt(center)
  camera.near = 0.01
  camera.far = Math.max(5000, h * 200)
  camera.updateProjectionMatrix()
  controls.update()
}

const markerColors: Record<'default' | 'editing' | 'saved', number> = {
  default: 0x2f6bff,
  editing: 0xfacc15,
  saved: 0x22c55e,
}
const annotationMarkerBaseRadius = 1

const resolveAnnotationStatus = (value?: string) =>
  value === 'editing' || value === 'saved' ? value : 'default'

const applyAnnotationMarkerStyle = (
  status?: string,
  marker?: THREE.Group | null,
) => {
  const target = marker ?? annotationMarker
  if (!target) return
  const outerMaterial = target.userData.outerMaterial as
    | THREE.MeshBasicMaterial
    | undefined
  if (!outerMaterial) return
  outerMaterial.color.setHex(markerColors[resolveAnnotationStatus(status)])
  requestRender()
}

const applyAnnotationMarkerScale = (
  marker: THREE.Group | null,
  highlighted?: boolean,
) => {
  if (!marker) return
  const isHighlighted = highlighted ?? Boolean(marker.userData.highlighted)
  marker.userData.highlighted = isHighlighted
  marker.visible = props.annotationMarkersVisible !== false
  if (!marker.userData.worldRadius) {
    const distance = Math.max(
      pointcloudCamera?.position.distanceTo(marker.position) ?? 1,
      pointcloudCamera?.near ? pointcloudCamera.near * 2 : 0.1,
      0.1,
    )
    const viewportHeight = Math.max(pointcloudViewportEl.value?.clientHeight || 1, 1)
    const worldUnitsPerPixel = pointcloudCamera
      ? (2 * Math.tan(THREE.MathUtils.degToRad(pointcloudCamera.fov) / 2) * distance) /
        viewportHeight
      : 0.01
    marker.userData.worldRadius = Math.max(worldUnitsPerPixel * 6, 0.002)
  }
  marker.scale.setScalar(
    (marker.userData.worldRadius / annotationMarkerBaseRadius) *
      (isHighlighted ? 1.3 : 1),
  )
}

const buildAnnotationMarker = () => {
  const outerGeometry = new THREE.SphereGeometry(
    annotationMarkerBaseRadius,
    18,
    18,
  )
  const innerGeometry = new THREE.SphereGeometry(
    annotationMarkerBaseRadius * 0.55,
    18,
    18,
  )
  const outerMaterial = new THREE.MeshBasicMaterial({ color: 0x2f6bff })
  const innerMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff })
  outerMaterial.depthTest = true
  outerMaterial.depthWrite = false
  innerMaterial.depthTest = true
  innerMaterial.depthWrite = false

  const outerMesh = new THREE.Mesh(outerGeometry, outerMaterial)
  const innerMesh = new THREE.Mesh(innerGeometry, innerMaterial)
  outerMesh.renderOrder = 999
  innerMesh.renderOrder = 1000

  const group = new THREE.Group()
  group.name = 'annotation-marker'
  group.renderOrder = 999
  group.userData.outerMaterial = outerMaterial
  group.userData.isAnnotationMarker = true
  group.userData.highlighted = false
  group.add(outerMesh, innerMesh)
  return group
}

const refreshAnnotationMarkerScales = () => {
  applyAnnotationMarkerScale(annotationMarker)
  for (const marker of annotationStashMarkerMap.values()) {
    applyAnnotationMarkerScale(marker)
  }
}

const resolveAnnotationMarkerFromHit = (object: THREE.Object3D | null) => {
  let current: THREE.Object3D | null = object
  while (current) {
    if (current.userData?.isAnnotationMarker) {
      return current as THREE.Group
    }
    current = current.parent
  }
  return null
}

const setAnnotationMarker = (point: THREE.Vector3 | null) => {
  if (!pointcloudScene) return
  if (!point) {
    if (annotationMarker) {
      pointcloudScene.remove(annotationMarker)
      disposeObject3D(annotationMarker)
      annotationMarker = null
      requestRender()
    }
    return
  }

  if (!annotationMarker) {
    annotationMarker = buildAnnotationMarker()
    pointcloudScene.add(annotationMarker)
  }
  annotationMarker.position.copy(point)
  annotationMarker.userData.worldRadius = undefined
  applyAnnotationMarkerStyle(props.annotationStatus, annotationMarker)
  applyAnnotationMarkerScale(annotationMarker, props.annotationHighlightCurrent)
  requestRender()
}

const getPickOffset = () => Math.max(0.005, pointcloudMaxDim * 0.002)

const applyPickOffset = (point: THREE.Vector3) => {
  const offset = getPickOffset()
  return point
    .clone()
    .addScaledVector(annotationRaycaster.ray.direction, -offset)
}

const applyPointPickThreshold = () => {
  const threshold = Math.max(0.05, pointcloudMaxDim * 0.001)
  if (!annotationRaycaster.params.Points) {
    annotationRaycaster.params.Points = { threshold }
  } else {
    annotationRaycaster.params.Points.threshold = threshold
  }
}

const pickAnnotationMarker = (event: PointerEvent) => {
  if (!pointcloudRenderer || !pointcloudCamera) return null
  const rect = pointcloudRenderer.domElement.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  annotationRaycaster.setFromCamera(new THREE.Vector2(x, y), pointcloudCamera)
  applyPointPickThreshold()

  if (props.annotationMarkersVisible !== false && annotationMarker?.visible) {
    const markerHits = annotationRaycaster.intersectObject(
      annotationMarker,
      true,
    )
    if (markerHits.length > 0) {
      return { point: annotationMarker.position.clone() }
    }
  }

  if (props.annotationMarkersVisible !== false && annotationStashGroup) {
    const stashHits = annotationRaycaster.intersectObject(
      annotationStashGroup,
      true,
    )
    if (stashHits.length > 0) {
      const markerGroup = resolveAnnotationMarkerFromHit(stashHits[0].object)
      if (markerGroup) {
        return {
          point: markerGroup.position.clone(),
          key: markerGroup.userData.annotationKey as string,
          synced: Boolean(markerGroup.userData.isSynced),
        }
      }
    }
  }

  const pointcloudTarget = pointcloudTilesetWrapper ?? pointcloudTileset?.group
  if (pointcloudTarget) {
    const hits = annotationRaycaster.intersectObject(pointcloudTarget, true)
    if (hits.length > 0) {
      return { point: applyPickOffset(hits[0].point) }
    }
  }

  return null
}

const ensureAnnotationStashGroup = () => {
  if (!pointcloudScene) return
  if (!annotationStashGroup) {
    annotationStashGroup = new THREE.Group()
    annotationStashGroup.name = 'annotation-stash-group'
    pointcloudScene.add(annotationStashGroup)
  }
}

const syncAnnotationStashMarkers = (
  markers: {
    key: string
    point: { x: number; y: number; z: number }
    status: 'default' | 'editing' | 'saved'
    highlighted: boolean
    synced: boolean
  }[] = [],
) => {
  if (!pointcloudScene) return
  ensureAnnotationStashGroup()
  const nextKeys = new Set(markers.map((item) => item.key))
  for (const [key, marker] of annotationStashMarkerMap) {
    if (nextKeys.has(key)) continue
    annotationStashGroup?.remove(marker)
    disposeObject3D(marker)
    annotationStashMarkerMap.delete(key)
  }
  markers.forEach((item) => {
    let marker = annotationStashMarkerMap.get(item.key)
    if (!marker) {
      marker = buildAnnotationMarker()
      marker.userData.annotationKey = item.key
      annotationStashMarkerMap.set(item.key, marker)
      annotationStashGroup?.add(marker)
    }
    marker.userData.isSynced = item.synced
    marker.userData.highlighted = item.highlighted
    marker.position.set(item.point.x, item.point.y, item.point.z)
    marker.userData.worldRadius = undefined
    applyAnnotationMarkerScale(marker, item.highlighted)
    applyAnnotationMarkerStyle(item.status, marker)
  })
  requestRender()
}

const setFixedViewBySize = (size: number) => {
  if (!pointcloudCamera || !pointcloudControls) return
  const dim = Number.isFinite(size) && size > 0 ? size : pointcloudMaxDim || 1
  fixedViewSize = dim
  setTopView(
    pointcloudCamera,
    pointcloudControls,
    pointcloudControls.target.clone(),
    dim * 1.2,
  )
  requestRender()
}

/** 作用：把当前点大小应用到场景中所有点材质 */
const applyPointSizeToScene = () => {
  if (desiredPointSize === null || !pointcloudScene) return
  pointcloudScene.traverse((obj: any) => {
    if (!obj?.isPoints) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    mats.forEach((m: any) => {
      if (!m) return
      if ('size' in m) m.size = desiredPointSize
      // 与参考页一致：屏幕空间固定像素点，不随距离缩放；开启深度写入
      if ('sizeAttenuation' in m) m.sizeAttenuation = false
      if ('depthWrite' in m) m.depthWrite = true
    })
  })
}

/** 作用：设置点云点大小（供预览页滑块调用） */
const setPointSize = (size: number) => {
  const next = Number(size)
  if (!Number.isFinite(next) || next <= 0) return
  desiredPointSize = next
  applyPointSizeToScene()
  requestRender()
}

/** 作用：切换 EDL 显示增强 */
const setEdlEnabled = (enabled: boolean) => {
  edlEnabled = !!enabled
  if (edlPipeline) edlPipeline.enabled = edlEnabled
  if (edlPipelineWebgl) edlPipelineWebgl.setEnabled(edlEnabled)
  requestRender()
}

/** 作用：切换点云场景参考网格 */
const setShowGrid = (show: boolean) => {
  pointcloudGroundGridVisible = !!show
  if (!pointcloudScene) return
  // WebGL：使用与参考页一致的 GLSL 无限网格
  if (rendererMode === 'webgl') {
    if (!pointcloudGroundGridWebgl) {
      pointcloudGroundGridWebgl = new InfiniteGroundGridWebgl()
      pointcloudScene.add(pointcloudGroundGridWebgl)
    }
    pointcloudGroundGridWebgl.visible = pointcloudGroundGridVisible
    if (pointcloudGroundGridVisible) {
      const box = getPointcloudWorldBox()
      if (box && !box.isEmpty()) pointcloudGroundGridWebgl.setBounds(box)
      if (pointcloudCamera) {
        pointcloudGroundGridWebgl.updateForCamera(pointcloudCamera)
      }
    }
    requestRender()
    return
  }
  if (rendererMode !== 'webgpu') return
  if (!pointcloudGroundGrid) {
    pointcloudGroundGrid = new InfiniteGroundGrid()
    pointcloudScene.add(pointcloudGroundGrid)
  }
  pointcloudGroundGrid.visible = pointcloudGroundGridVisible
  if (pointcloudGroundGridVisible) {
    const box = getPointcloudWorldBox()
    if (box && !box.isEmpty()) pointcloudGroundGrid.setBounds(box)
    if (pointcloudCamera) pointcloudGroundGrid.updateForCamera(pointcloudCamera)
  }
  requestRender()
}

const getRotationLookDistance = () => {
  if (!pointcloudCamera || !pointcloudControls) return 10
  return Math.max(
    pointcloudCamera.position.distanceTo(pointcloudControls.target),
    0.5,
  )
}

const getResolvedFirstPersonEyeHeight = () =>
  firstPersonEyeHeight ?? DEFAULT_FIRST_PERSON_EYE_HEIGHT

const raycastPointcloudGroundHeight = (
  origin: THREE.Vector3,
  distance: number,
) => {
  const pointcloudTarget = getPointcloudRoot()
  if (!pointcloudTarget || !pointcloudLoaded.value) return null
  const raycaster = new THREE.Raycaster(
    origin,
    new THREE.Vector3(0, -1, 0),
    0,
    distance,
  )
  if (!raycaster.params.Points) {
    raycaster.params.Points = { threshold: FIRST_PERSON_GROUND_POINT_THRESHOLD }
  } else {
    raycaster.params.Points.threshold = FIRST_PERSON_GROUND_POINT_THRESHOLD
  }
  const hit = raycaster.intersectObject(pointcloudTarget, true)[0]
  return hit?.point?.y ?? null
}

const samplePointcloudGroundHeight = (position: THREE.Vector3) => {
  const localOrigin = position.clone()
  localOrigin.y += 0.2
  const localDistance = Math.max(
    FIRST_PERSON_GROUND_PROBE_DISTANCE,
    getResolvedFirstPersonEyeHeight() * 4,
  )
  const localGround = raycastPointcloudGroundHeight(localOrigin, localDistance)
  if (localGround !== null) return localGround

  const worldBox = getPointcloudWorldBox()
  if (!worldBox) return null
  const globalOrigin = new THREE.Vector3(
    position.x,
    worldBox.max.y + pointcloudMaxDim * 0.5,
    position.z,
  )
  const globalDistance = Math.max(pointcloudMaxDim * 3, 30)
  return raycastPointcloudGroundHeight(globalOrigin, globalDistance)
}

const refreshPointcloudFirstPersonEyeHeight = () => {
  if (!pointcloudCamera) return
  const groundHeight = samplePointcloudGroundHeight(pointcloudCamera.position)
  if (groundHeight === null) {
    firstPersonEyeHeight = DEFAULT_FIRST_PERSON_EYE_HEIGHT
    return
  }

  const measuredEyeHeight = pointcloudCamera.position.y - groundHeight
  if (measuredEyeHeight > 1.2 && measuredEyeHeight < 2.2) {
    firstPersonEyeHeight = THREE.MathUtils.clamp(
      measuredEyeHeight,
      FIRST_PERSON_MIN_EYE_HEIGHT,
      FIRST_PERSON_MAX_EYE_HEIGHT,
    )
    return
  }

  firstPersonEyeHeight = DEFAULT_FIRST_PERSON_EYE_HEIGHT
}

const resolvePointcloudGroundFollowingPosition = (
  targetPosition: THREE.Vector3,
  options?: { snapImmediately?: boolean },
) => {
  if (!firstPersonActive.value) return targetPosition
  if (!pointcloudCamera) return targetPosition
  const groundHeight = samplePointcloudGroundHeight(targetPosition)
  if (groundHeight === null) return targetPosition

  const desiredY = groundHeight + getResolvedFirstPersonEyeHeight()
  const currentY = pointcloudCamera.position.y
  const deltaY = desiredY - currentY

  const resolved = targetPosition.clone()
  if (options?.snapImmediately) {
    resolved.y = desiredY
    return resolved
  }
  resolved.y =
    currentY +
    THREE.MathUtils.clamp(
      deltaY,
      -FIRST_PERSON_MAX_STEP_DOWN,
      FIRST_PERSON_MAX_STEP_UP,
    )
  return resolved
}

const applyFirstPersonPointcloudRotationDelta = (
  currentRot: { lon: number; lat: number },
  deltaX: number,
  deltaY: number,
) => {
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

  applyRotationOnly(
    {
      lon: normalizeLon(
        currentRot.lon - limitedDeltaX * FIRST_PERSON_ROTATION_SENSITIVITY,
      ),
      lat: clampFirstPersonLat(
        currentRot.lat - limitedDeltaY * FIRST_PERSON_ROTATION_SENSITIVITY,
      ),
    },
    { emitChange: true },
  )
}

const hasFirstPersonPointcloudCollision = (
  currentPosition: THREE.Vector3,
  nextPosition: THREE.Vector3,
  direction: THREE.Vector3,
) => {
  if (!firstPersonActive.value) return false
  const pointcloudTarget = pointcloudTilesetWrapper ?? pointcloudTileset?.group
  if (!pointcloudTarget || !pointcloudLoaded.value) return false
  const rayDirection = direction.clone().normalize()
  if (rayDirection.lengthSq() < 1e-8) return false
  const raycaster = new THREE.Raycaster(
    currentPosition,
    rayDirection,
    0,
    currentPosition.distanceTo(nextPosition) + FIRST_PERSON_COLLISION_RADIUS,
  )
  if (!raycaster.params.Points) {
    raycaster.params.Points = { threshold: FIRST_PERSON_COLLISION_RADIUS }
  } else {
    raycaster.params.Points.threshold = FIRST_PERSON_COLLISION_RADIUS
  }
  return raycaster.intersectObject(pointcloudTarget, true).length > 0
}

const movePointcloudCamera = (direction: MoveDirection) => {
  if (!firstPersonActive.value) return
  if (!pointcloudCamera || !pointcloudControls) return
  const currentRot = getCameraOrientation()
  if (!currentRot) return

  const moveDistance = 0.8
  const forward = rotationToDirection({
    lon: currentRot.lon,
    lat: 0,
  })
  const right = new THREE.Vector3()
  if (forward.lengthSq() < 1e-8) return
  forward.normalize()
  right.crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize()

  const offset = new THREE.Vector3()
  switch (direction) {
    case 'up':
      offset.copy(forward).multiplyScalar(moveDistance)
      break
    case 'down':
      offset.copy(forward).multiplyScalar(-moveDistance)
      break
    case 'left':
      offset.copy(right).multiplyScalar(moveDistance)
      break
    case 'right':
      offset.copy(right).multiplyScalar(-moveDistance)
      break
  }

  const currentPosition = pointcloudCamera.position.clone()
  const nextHorizontalPosition = currentPosition.clone().add(offset)
  if (
    hasFirstPersonPointcloudCollision(
      currentPosition,
      nextHorizontalPosition,
      offset,
    )
  ) {
    return
  }

  const nextPosition = resolvePointcloudGroundFollowingPosition(
    nextHorizontalPosition,
  )
  pointcloudCamera.position.copy(nextPosition)
  applyRotationOnly(
    {
      lon: currentRot.lon,
      lat: clampFirstPersonLat(currentRot.lat),
    },
    { emitChange: true },
  )
}

const updateFirstPersonMovement = (timestamp: number) => {
  if (!firstPersonActive.value || !pointcloudCamera || !pointcloudControls) {
    activeFirstPersonMoveDirections.clear()
    lastFirstPersonMoveAt = 0
    return false
  }
  if (activeFirstPersonMoveDirections.size === 0) {
    lastFirstPersonMoveAt = 0
    return false
  }

  const currentRot = getCameraOrientation()
  if (!currentRot) return false

  const deltaSeconds = lastFirstPersonMoveAt
    ? Math.min((timestamp - lastFirstPersonMoveAt) / 1000, 0.05)
    : 1 / 60
  lastFirstPersonMoveAt = timestamp

  const forward = rotationToDirection({
    lon: currentRot.lon,
    lat: 0,
  })
  if (forward.lengthSq() < 1e-8) return false
  forward.normalize()
  const right = new THREE.Vector3()
    .crossVectors(new THREE.Vector3(0, 1, 0), forward)
    .normalize()

  const offset = new THREE.Vector3()
  const moveDistance = FIRST_PERSON_MOVE_SPEED * deltaSeconds
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

  const currentPosition = pointcloudCamera.position.clone()
  const nextHorizontalPosition = currentPosition.clone().add(offset)
  if (
    hasFirstPersonPointcloudCollision(
      currentPosition,
      nextHorizontalPosition,
      offset,
    )
  ) {
    return false
  }

  const nextPosition = resolvePointcloudGroundFollowingPosition(
    nextHorizontalPosition,
  )
  if (nextPosition.distanceToSquared(currentPosition) <= 1e-8) return false

  pointcloudCamera.position.copy(nextPosition)
  applyRotationOnly(
    {
      lon: currentRot.lon,
      lat: clampFirstPersonLat(currentRot.lat),
    },
    { emitChange: true },
  )
  return true
}

const applyRotationOnly = (
  rot: { lon: number; lat: number },
  options?: { emitChange?: boolean },
) => {
  if (!pointcloudCamera || !pointcloudControls) return
  const direction = rotationToDirection(rot)
  const lookDistance = getRotationLookDistance()
  const target = pointcloudCamera.position
    .clone()
    .addScaledVector(direction, lookDistance)
  pointcloudCamera.up.set(0, 1, 0)
  pointcloudControls.target.copy(target)
  pointcloudCamera.lookAt(pointcloudControls.target)
  pointcloudCamera.updateMatrixWorld()
  pointcloudControls.update()
  requestRender()
  if (options?.emitChange) emitCameraOrientation()
}

const applyRotationLockState = () => {
  if (!pointcloudControls) return
  const locked = Boolean(props.rotationLock)
  const enableOrbit = !locked && !firstPersonActive.value
  pointcloudControls.enabled = enableOrbit
  pointcloudControls.enableRotate = enableOrbit
  pointcloudControls.enablePan = enableOrbit
  pointcloudControls.enableZoom = enableOrbit
}

const clearFirstPersonPointerState = () => {
  firstPersonPointerDown = null
}

const setFirstPersonActive = (value: boolean) => {
  if (firstPersonActive.value === value) return
  firstPersonActive.value = value
  emit('first-person-change', value)
}

const exitFirstPersonMode = () => {
  setFirstPersonActive(false)
  firstPersonEyeHeight = null
  activeFirstPersonMoveDirections.clear()
  lastFirstPersonMoveAt = 0
  clearFirstPersonPointerState()
  applyRotationLockState()
}

const enterFirstPersonMode = () => {
  if (!pointcloudLoaded.value) return
  if (props.rotationLock) return
  if (firstPersonActive.value) return
  focusPointcloudViewport()
  setFirstPersonActive(true)
  activeFirstPersonMoveDirections.clear()
  lastFirstPersonMoveAt = 0
  refreshPointcloudFirstPersonEyeHeight()
  if (pointcloudCamera) {
    pointcloudCamera.up.set(0, 1, 0)
    const groundedPosition = resolvePointcloudGroundFollowingPosition(
      pointcloudCamera.position.clone(),
      { snapImmediately: true },
    )
    const currentRot = getCameraOrientation()
    pointcloudCamera.position.copy(groundedPosition)
    if (currentRot) {
      applyRotationOnly(
        {
          lon: normalizeLon(currentRot.lon),
          lat: clampFirstPersonLat(currentRot.lat),
        },
        { emitChange: true },
      )
    }
  }
  applyRotationLockState()
}

const emitCameraOrientation = () => {
  if (!pointcloudLoaded.value) return
  const rot = getCameraOrientation()
  if (!rot) return
  emit('camera-change', rot)
}

const initPointcloudViewer = async () => {
  if (!pointcloudViewportEl.value) return
  if (pointcloudRenderer && rendererReady) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    if (!pointcloudViewportEl.value) return

    const supportsWebGPU =
      !props.preferWebgl &&
      typeof navigator !== 'undefined' &&
      'gpu' in navigator
    const w = pointcloudViewportEl.value.clientWidth || 1
    const h = pointcloudViewportEl.value.clientHeight || 1

    pointcloudScene = new THREE.Scene()
    pointcloudScene.background = new THREE.Color(defaultBgColor)
    pointcloudClippingGroup = new ClippingGroup()
    pointcloudScene.add(pointcloudClippingGroup)
    pointcloudContentGroup = new THREE.Group()
    pointcloudClippingGroup.add(pointcloudContentGroup)
    ensureWorldOriginAxes()
    pointcloudCamera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100000)
    pointcloudCamera.position.set(0, 10, 20)

    const setupRendererCommon = () => {
      if (!pointcloudRenderer || !pointcloudCamera) return
      pointcloudControls = new OrbitControls(
        pointcloudCamera,
        pointcloudRenderer.domElement,
      )
      pointcloudControls.enableDamping = false
      // Match the BIM viewer: right-button vertical drags pan in screen space.
      pointcloudControls.screenSpacePanning = true
      pointcloudControls.addEventListener('change', () => {
        requestRender()
        emitCameraOrientation()
      })
      applyRotationLockState()

      const ambient = new THREE.AmbientLight(0xffffff, 0.7)
      const dir = new THREE.DirectionalLight(0xffffff, 0.9)
      dir.position.set(10, 10, 10)
      pointcloudScene?.add(ambient, dir)

      // EDL（显示增强）后处理
      // - WebGL：1:1 使用 cloudBIM-viewer 的 GLSL 管线
      // - WebGPU：使用 TSL 等价实现
      if (pointcloudRenderer && pointcloudScene && pointcloudCamera) {
        try {
          if (rendererMode === 'webgl' && !edlPipelineWebgl) {
            edlPipelineWebgl = new PointCloudEdlPipelineWebgl(
              pointcloudRenderer as THREE.WebGLRenderer,
              { enabled: edlEnabled, strength: 1, radius: 1 },
            )
          } else if (rendererMode === 'webgpu' && !edlPipeline) {
            edlPipeline = new PointCloudEdlPipeline(
              pointcloudRenderer,
              pointcloudScene,
              pointcloudCamera,
            )
            edlPipeline.enabled = edlEnabled
          }
        } catch (error) {
          console.warn('[PointCloudViewer] EDL 初始化失败，回退直渲', error)
          edlPipeline = null
          edlPipelineWebgl = null
          edlEnabled = false
        }
      }

      if (!resizeObserver && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (
            pointcloudRenderer &&
            pointcloudCamera &&
            pointcloudViewportEl.value
          ) {
            if (
              syncRendererSize(
                pointcloudRenderer,
                pointcloudCamera,
                pointcloudViewportEl.value,
                updateTilesetResolution,
              )
            ) {
              requestRender()
            }
          }
        })
        resizeObserver.observe(pointcloudViewportEl.value)
      }

      if (pointcloudRenderer?.domElement) {
        pointcloudRenderer.domElement.addEventListener(
          'pointerdown',
          handleAnnotationPointerDown,
        )
        pointcloudRenderer.domElement.addEventListener(
          'pointermove',
          handleAnnotationPointerMove,
        )
        pointcloudRenderer.domElement.addEventListener(
          'pointerup',
          handleAnnotationPointerUp,
        )
        pointcloudRenderer.domElement.addEventListener(
          'pointercancel',
          handleAnnotationPointerUp,
        )
        pointcloudRenderer.domElement.addEventListener(
          'pointerdown',
          handleRotationPointerDown,
        )
        pointcloudRenderer.domElement.addEventListener(
          'pointermove',
          handleRotationPointerMove,
        )
        pointcloudRenderer.domElement.addEventListener(
          'pointerup',
          handleRotationPointerUp,
        )
        pointcloudRenderer.domElement.addEventListener(
          'pointercancel',
          handleRotationPointerUp,
        )
        pointcloudRenderer.domElement.addEventListener(
          'wheel',
          handleRotationWheel,
          { passive: false },
        )
        pointcloudRenderer.domElement.addEventListener(
          'pointerdown',
          handleFirstPersonPointerDown,
        )
        pointcloudRenderer.domElement.addEventListener(
          'pointermove',
          handleFirstPersonPointerMove,
        )
        pointcloudRenderer.domElement.addEventListener(
          'pointerup',
          handleFirstPersonPointerUp,
        )
        pointcloudRenderer.domElement.addEventListener(
          'pointercancel',
          handleFirstPersonPointerUp,
        )
      }
    }

    const buildWebGLRenderer = () => {
      rendererMode = 'webgl'
      pointcloudRenderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
      })
      pointcloudRenderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, getResolvedPixelRatioCap()),
      )
      pointcloudRenderer.setSize(w, h)
      pointcloudRenderer.setClearColor(new THREE.Color(defaultBgColor), 1)
      pointcloudRenderer.toneMapping = THREE.ACESFilmicToneMapping
      pointcloudRenderer.toneMappingExposure = 1.0
      pointcloudRenderer.localClippingEnabled = true
      if ('outputColorSpace' in pointcloudRenderer) {
        pointcloudRenderer.outputColorSpace = THREE.SRGBColorSpace
      }
      pointcloudViewportEl.value?.appendChild(pointcloudRenderer.domElement)
      rendererReady = true
      setupRendererCommon()
    }

    const buildWebGPURenderer = async () => {
      rendererMode = 'webgpu'
      pointcloudRenderer = new WebGPURenderer({ antialias: true })
      pointcloudRenderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, getResolvedPixelRatioCap()),
      )
      pointcloudRenderer.setSize(w, h)
      pointcloudRenderer.setClearColor(new THREE.Color(defaultBgColor), 1)
      pointcloudRenderer.toneMapping = THREE.ACESFilmicToneMapping
      pointcloudRenderer.toneMappingExposure = 1.0
      pointcloudViewportEl.value?.appendChild(pointcloudRenderer.domElement)
      await (pointcloudRenderer as WebGPURenderer).init?.()
      rendererReady = true
      setupRendererCommon()
    }

    rendererReady = false
    if (supportsWebGPU) {
      try {
        await buildWebGPURenderer()
      } catch (error) {
        rendererReady = false
        return
      }
    } else {
      buildWebGLRenderer()
    }

    if (!rendererReady) return

    syncAnnotationStashMarkers(props.annotationStashMarkers ?? [])
    if (props.annotationPoint) {
      setAnnotationMarker(
        new THREE.Vector3(
          props.annotationPoint.x,
          props.annotationPoint.y,
          props.annotationPoint.z,
        ),
      )
    }
    requestRender()
  })()

  await initPromise
}

const requestRender = () => {
  needsRender = true
  if (isRendering) return
  isRendering = true
  animationId = requestAnimationFrame(renderPointcloud)
}

/** 作用：渲染一帧（EDL 开启时走 TSL 后处理） */
const renderSceneFrame = () => {
  if (!pointcloudRenderer || !pointcloudScene || !pointcloudCamera) return
  if (edlEnabled && edlPipelineWebgl) {
    edlPipelineWebgl.enabled = true
    edlPipelineWebgl.render(pointcloudScene, pointcloudCamera)
    return
  }
  if (edlEnabled && edlPipeline) {
    const dom = pointcloudRenderer.domElement
    const dpr = pointcloudRenderer.getPixelRatio?.() ?? 1
    edlPipeline.render(
      pointcloudCamera,
      Math.max(1, dom.clientWidth) * dpr,
      Math.max(1, dom.clientHeight) * dpr,
    )
    return
  }
  pointcloudRenderer.render(pointcloudScene, pointcloudCamera)
}

const forceCaptureDataUrl = async () => {
  if (
    !pointcloudRenderer ||
    !pointcloudScene ||
    !pointcloudCamera ||
    !rendererReady
  )
    return null
  try {
    if (
      rendererMode === 'webgpu' &&
      (pointcloudRenderer as WebGPURenderer).renderAsync
    ) {
      const width = pointcloudRenderer.domElement.width
      const height = pointcloudRenderer.domElement.height
      const dataUrl =
        (width && height ? await renderSceneToDataUrl(width, height) : null) ||
        (await readWebGPUCanvas()) ||
        pointcloudRenderer.domElement.toDataURL('image/png')
      return {
        dataUrl,
        rect: pointcloudRenderer.domElement.getBoundingClientRect(),
      }
    }

    renderSceneFrame()
    const gl = (pointcloudRenderer as THREE.WebGLRenderer).getContext?.()
    try {
      if (gl) {
        const pixel = new Uint8Array(4)
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
      }
    } catch {
      // ignore readPixels failures
    }
    return {
      dataUrl: pointcloudRenderer.domElement.toDataURL('image/png'),
      rect: pointcloudRenderer.domElement.getBoundingClientRect(),
    }
  } catch {
    return null
  }
}

const bumpTilesLoading = (delta: number) => {
  tilesLoadingCount = Math.max(0, tilesLoadingCount + delta)
  requestRender()
}

const renderPointcloud = () => {
  if (
    !pointcloudRenderer ||
    !pointcloudScene ||
    !pointcloudCamera ||
    !rendererReady
  ) {
    isRendering = false
    animationId = 0
    return
  }

  try {
    if (pointcloudViewportEl.value) {
      if (
        syncRendererSize(
          pointcloudRenderer,
          pointcloudCamera,
          pointcloudViewportEl.value,
          updateTilesetResolution,
        )
      ) {
        needsRender = true
      }
    }
    const didUpdate = pointcloudControls?.update() ?? false
    const didMove = updateFirstPersonMovement(performance.now())
    pointcloudCamera.updateMatrixWorld()
    if (pointcloudGroundGrid?.visible) {
      pointcloudGroundGrid.updateForCamera(pointcloudCamera)
    }
    if (pointcloudGroundGridWebgl?.visible) {
      pointcloudGroundGridWebgl.updateForCamera(pointcloudCamera)
    }
    refreshAnnotationMarkerScales()
    const isTilesLoading = tilesLoadingCount > 0
    if (pointcloudTileset) {
      applyTilesErrorTarget()
      try {
        pointcloudTileset.setCamera(pointcloudCamera)
        pointcloudTileset.update()
      } catch {
        // ignore
      }
    }
    const isActiveLoading = isTilesLoading || isPointcloudLoading
    if (didMove) {
      needsRender = true
    }
    if (needsRender || didUpdate || isActiveLoading || didMove) {
      renderSceneFrame()
      needsRender = false
    }

    if (needsRender || didUpdate || isActiveLoading || didMove) {
      animationId = requestAnimationFrame(renderPointcloud)
    } else {
      isRendering = false
      animationId = 0
    }
  } catch (error) {
    isRendering = false
    animationId = 0
  }
}

const loadPointcloudTileset = async (
  url: string,
  projectId?: number | null,
  scanFileId?: number | null,
) => {
  await initPointcloudViewer()
  if (
    !rendererReady ||
    !pointcloudScene ||
    !pointcloudCamera ||
    !pointcloudRenderer
  )
    return

  pointcloudStatusText.value = `Loading tileset: ${url}`
  pointcloudLoaded.value = false
  tilesLoadingCount = 0
  isPointcloudLoading = true
  requestRender()

  try {
    if (pointcloudTileset) {
      if (pointcloudTilesetWrapper) {
        if (pointcloudClipHost)
          pointcloudClipHost.remove(pointcloudTilesetWrapper)
        else pointcloudContentGroup?.remove(pointcloudTilesetWrapper)
        pointcloudTilesetWrapper = null
      } else {
        pointcloudContentGroup?.remove(pointcloudTileset.group)
      }
      if (pointcloudClipHost) {
        pointcloudContentGroup?.remove(pointcloudClipHost)
        pointcloudClipHost = null
      }
      pointcloudTileset.dispose?.()
      pointcloudTileset = null
    }

    const tr = new TilesRenderer(url)
    tr.errorTarget = getTilesErrorTarget()
    if (props.renderAllPoints === true) {
      // Keep every loaded leaf tile resident. Otherwise the renderer's
      // default 0.4 GB LRU limit can evict dense tiles while zooming, making
      // the same point cloud appear to lose density from one camera pose to
      // another.
      tr.lruCache.minSize = Infinity
      tr.lruCache.maxSize = Infinity
      tr.lruCache.minBytesSize = Infinity
      tr.lruCache.maxBytesSize = Infinity
    }
    pointcloudTileset = tr

    if (projectId && scanFileId) {
      const prefix = `/api/projects/${projectId}/files/${scanFileId}/scan/tiles/`
      const tilesetBaseUrl = new URL(url, window.location.href)
      tr.registerPlugin({
        fetchData: async (uri: any, options: any) => {
          const raw = typeof uri === 'string' ? uri : uri?.toString?.() || ''
          if (!raw) return null

          let pathname = ''
          let resolvedUrl = raw
          try {
            const urlObj = new URL(raw, tilesetBaseUrl)
            resolvedUrl = urlObj.toString()
            pathname = urlObj.pathname
          } catch {
            pathname = raw
          }

          if (!pathname.startsWith(prefix)) {
            return fetch(resolvedUrl, options)
          }

          const assetPath = decodeURIComponent(pathname.slice(prefix.length))
          const ext = assetPath.split('.').pop()?.toLowerCase()
          if (ext === 'json') {
            return getScanTilesAsset(projectId, scanFileId, assetPath, 'json')
          }
          return getScanTilesAsset(
            projectId,
            scanFileId,
            assetPath,
            'arraybuffer',
          )
        },
      } as any)
    }

    const dracoLoader = new DRACOLoader(tr.manager)
    dracoLoader.setDecoderPath('/draco/')
    dracoLoader.preload()
    tr.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader }))

    tr.setCamera(pointcloudCamera)
    updateTilesetResolution()
    const wrapper = new THREE.Group()
    if (props.applyTilesetTransform === true) {
      wrapper.rotation.x = -Math.PI / 2
    }
    wrapper.add(tr.group)
    const clipHost = new ClippingGroup()
    clipHost.add(wrapper)
    pointcloudContentGroup?.add(clipHost)
    pointcloudClipHost = clipHost
    pointcloudTilesetWrapper = wrapper

    tr.addEventListener('tiles-load-start', () => {
      pointcloudStatusText.value = '点云加载中...'
      bumpTilesLoading(1)
      isPointcloudLoading = true
    })
    tr.addEventListener('tiles-load-end', () => {
      pointcloudStatusText.value = '点云加载完成'
      pointcloudLoaded.value = true
      bumpTilesLoading(-1)
      if (tilesLoadingCount === 0) {
        isPointcloudLoading = false
      }
    })
    tr.addEventListener('load-model', ({ scene: tileScene }: any) => {
      if (!tileScene) return
      if (rendererMode === 'webgpu') {
        sanitizeObjectForWebGPU(tileScene)
      }
      // 从 pnts batch table 提取 INTENSITY / CLASSIFICATION 属性，供强度 / 台面分色着色
      applyPointAttributes(tileScene)
      applyMaterialMode(tileScene)
      applyPointSizeToScene()
      applyManualClipBox()
      requestRender()
    })
    tr.addEventListener('load-error', (e: any) => {
      pointcloudStatusText.value = `点云加载失败：${String(e?.error?.message ?? e?.error ?? 'unknown')}`
      pointcloudLoaded.value = false
      tilesLoadingCount = 0
      isPointcloudLoading = false
      requestRender()
    })
    tr.addEventListener('load-root-tileset', () => {
      if (!pointcloudCamera || !pointcloudControls) return
      if (rendererMode === 'webgpu') {
        sanitizeObjectForWebGPU(tr.group)
      }
      applyPointAttributes(tr.group)
      applyMaterialMode(tr.group)
      applyPointSizeToScene()
      applyManualClipBox()
      wrapper.updateMatrixWorld(true)
      tr.group.updateMatrixWorld(true)
      const sphere = new THREE.Sphere()
      if (tr.getBoundingSphere?.(sphere)) {
        const sphereCenterWorld = sphere.center
          .clone()
          .applyMatrix4(wrapper.matrixWorld)
        // Keep the LOD distance scale correct even when auto-fit is disabled
        // (the quad view synchronizes its camera from the other panels).
        pointcloudMaxDim = Math.max(sphere.radius * 2, 1)
        if (props.autoFitOnLoad !== false) {
          fitCameraToSphere(
            pointcloudCamera,
            pointcloudControls,
            sphereCenterWorld,
            sphere.radius,
          )
          setTopView(
            pointcloudCamera,
            pointcloudControls,
            sphereCenterWorld,
            sphere.radius * 2.2,
          )
        }
        emit('world-ready')
        requestRender()
        return
      }
      // Some tilesets do not expose a bounding sphere. Still derive a size
      // reference for LOD selection without moving the synchronized camera.
      const bounds = new THREE.Box3().setFromObject(wrapper)
      const boundsSize = bounds.getSize(new THREE.Vector3())
      pointcloudMaxDim = Math.max(boundsSize.x, boundsSize.y, boundsSize.z, 1)
      if (props.autoFitOnLoad !== false) {
        fitCameraToObject(pointcloudCamera, pointcloudControls, wrapper)
      }
      emit('world-ready')
      requestRender()
    })

    requestRender()
  } catch (error: any) {
    pointcloudStatusText.value = error?.message || '点云加载失败'
    pointcloudLoaded.value = false
  }
}

const onLoadTilesClick = () => {
  const url = tilesetUrl.value.trim()
  if (!url) return
  void loadPointcloudTileset(url)
}

const loadPointcloudByScanId = async (
  projectId: number,
  scanFileId: number | null,
) => {
  if (!scanFileId) {
    pointcloudStatusText.value = '未选择点云文件'
    pointcloudLoaded.value = false
    return
  }

  const url = getScanTilesetUrl(projectId, scanFileId, 'tileset.json')
  tilesetUrl.value = url
  await loadPointcloudTileset(url, projectId, scanFileId)
}

const getPointcloudLocalFromTrajectory = (point: TrajectoryPoint) => {
  return new THREE.Vector3(point.x, point.y, point.z)
}

const syncFromTrajectory = (point: TrajectoryPoint) => {
  if (!pointcloudLoaded.value) return
  if (!pointcloudCamera || !pointcloudControls) return

  const pose = buildGaussianTrajectoryYUpPose(point)
  pointcloudCamera.position.copy(pose.camera)
  pointcloudCamera.lookAt(pose.target)
  pointcloudControls.target.copy(pose.target)
  pointcloudCamera.updateMatrixWorld()
  pointcloudControls.update()
  requestRender()
}

const getCameraOrientation = () => {
  if (!pointcloudCamera || !pointcloudControls) return null
  const dir = new THREE.Vector3()
    .subVectors(pointcloudControls.target, pointcloudCamera.position)
    .normalize()
  return directionToRotation(dir)
}

const getPointcloudGroupWorldMatrix = () => {
  if (pointcloudTilesetWrapper) {
    pointcloudTilesetWrapper.updateMatrixWorld?.(true)
    return pointcloudTilesetWrapper.matrixWorld.clone()
  }
  if (!pointcloudTileset?.group) return null
  pointcloudTileset.group.updateMatrixWorld?.(true)
  return pointcloudTileset.group.matrixWorld.clone()
}

const formatMatrix = (matrix?: THREE.Matrix4 | null) => {
  if (!matrix) return null
  return matrix.toArray().map((value) => Number(value.toFixed(6)))
}

const clampPanoramaFov = (value: number) => Math.max(30, Math.min(120, value))

const syncFromPanoramaRotation = (rot: { lon: number; lat: number }) => {
  applyRotationOnly(rot)
}

const syncFromPanoramaFov = (fov: number) => {
  if (!pointcloudCamera) return
  const nextFov = clampPanoramaFov(fov)
  if (Math.abs(pointcloudCamera.fov - nextFov) < 0.01) return
  pointcloudCamera.fov = nextFov
  pointcloudCamera.updateProjectionMatrix()
  requestRender()
}

const syncFromExternalPose = (
  pose: { camera: THREE.Vector3; target: THREE.Vector3 } | null,
) => {
  if (!pointcloudCamera || !pointcloudControls || !pose) return
  pointcloudCamera.position.copy(pose.camera)
  pointcloudControls.target.copy(pose.target)
  pointcloudCamera.lookAt(pointcloudControls.target)
  pointcloudControls.update()
  requestRender()
}

const handleResetView = () => {
  if (props.currentTrajectoryPoint) {
    const pose = buildGaussianTrajectoryYUpPose(props.currentTrajectoryPoint)
    syncFromExternalPose(pose)
    return
  }
  resetPointcloudView()
}

const resetPointcloudView = () => {
  if (!pointcloudCamera || !pointcloudControls) return
  if (fixedViewSize) {
    setFixedViewBySize(fixedViewSize)
    return
  }
  if (pointcloudTileset) {
    const sphere = new THREE.Sphere()
    if (pointcloudTileset.getBoundingSphere?.(sphere)) {
      pointcloudTilesetWrapper?.updateMatrixWorld?.(true)
      pointcloudTileset.group.updateMatrixWorld?.(true)
      const sphereCenterWorld = sphere.center
        .clone()
        .applyMatrix4(
          pointcloudTilesetWrapper?.matrixWorld ??
            pointcloudTileset.group.matrixWorld,
        )
      fitCameraToSphere(
        pointcloudCamera,
        pointcloudControls,
        sphereCenterWorld,
        sphere.radius,
      )
      setTopView(
        pointcloudCamera,
        pointcloudControls,
        sphereCenterWorld,
        sphere.radius * 2.2,
      )
      requestRender()
      return
    }
    fitCameraToObject(
      pointcloudCamera,
      pointcloudControls,
      pointcloudTilesetWrapper ?? pointcloudTileset.group,
    )
    requestRender()
    return
  }
  pointcloudControls.target.set(0, 0, 0)
  pointcloudCamera.position.set(0, 10, 20)
  pointcloudCamera.updateProjectionMatrix()
  pointcloudControls.update()
  requestRender()
}

const toggleFirstPersonMode = () => {
  if (firstPersonActive.value) exitFirstPersonMode()
  else enterFirstPersonMode()
}

const getCameraPose = () => {
  if (!pointcloudCamera || !pointcloudControls) return null
  return {
    camera: pointcloudCamera.position.clone(),
    target: pointcloudControls.target.clone(),
  }
}

const pickPointFromScreen = (clientX: number, clientY: number) => {
  const result = pickAnnotationMarker({
    clientX,
    clientY,
  } as PointerEvent)
  if (!result) return null
  return {
    x: result.point.x,
    y: result.point.y,
    z: result.point.z,
    key: result.key,
    synced: result.synced,
  }
}

const handleAnnotationPointerDown = (event: PointerEvent) => {
  if (!props.annotationEnabled || !pointcloudLoaded.value) return
  if (firstPersonActive.value) return
  if (event.button !== 0) return
  annotationPointerDown = { x: event.clientX, y: event.clientY }
  annotationPointerDragging = false
  annotationPointerId = event.pointerId
  pointcloudRenderer?.domElement.setPointerCapture?.(event.pointerId)
}

const handleAnnotationPointerMove = (event: PointerEvent) => {
  if (!annotationPointerDown) return
  const dx = event.clientX - annotationPointerDown.x
  const dy = event.clientY - annotationPointerDown.y
  if (dx * dx + dy * dy > 16) {
    annotationPointerDragging = true
  }
}

const handleAnnotationPointerUp = (event: PointerEvent) => {
  if (!annotationPointerDown) return
  if (annotationPointerId !== null) {
    pointcloudRenderer?.domElement.releasePointerCapture?.(annotationPointerId)
  }
  annotationPointerId = null
  const wasDragging = annotationPointerDragging
  annotationPointerDown = null
  annotationPointerDragging = false
  if (wasDragging) return
  if (!props.annotationEnabled || !pointcloudLoaded.value) return
  if (firstPersonActive.value) return
  if (event.button !== 0) return
  const result = pickAnnotationMarker(event)
  if (!result) return
  emit('annotation-pick', {
    point: { x: result.point.x, y: result.point.y, z: result.point.z },
    screen: { x: event.clientX, y: event.clientY },
    source: 'pointcloud',
    key: result.key,
    synced: result.synced,
  })
  setAnnotationMarker(result.point)
}

const handleRotationPointerDown = (event: PointerEvent) => {
  if (!props.rotationLock || !pointcloudLoaded.value) return
  if (event.button !== 0) return
  rotationPointerId = event.pointerId
  rotationPointerDown = { x: event.clientX, y: event.clientY }
  pointcloudRenderer?.domElement.setPointerCapture?.(event.pointerId)
}

const handleRotationPointerMove = (event: PointerEvent) => {
  if (!props.rotationLock || !rotationPointerDown) return
  const currentRot = getCameraOrientation()
  if (!currentRot) return

  const deltaX = event.clientX - rotationPointerDown.x
  const deltaY = event.clientY - rotationPointerDown.y
  if (deltaX === 0 && deltaY === 0) return

  rotationPointerDown = { x: event.clientX, y: event.clientY }
  applyRotationOnly(
    {
      lon: currentRot.lon - deltaX * 0.2,
      lat: clampLat(currentRot.lat - deltaY * 0.2),
    },
    { emitChange: true },
  )
}

const clearRotationPointerState = () => {
  if (rotationPointerId !== null) {
    try {
      pointcloudRenderer?.domElement.releasePointerCapture?.(rotationPointerId)
    } catch {
      // ignore stale pointer capture
    }
  }
  rotationPointerId = null
  rotationPointerDown = null
}

const handleRotationPointerUp = () => {
  clearRotationPointerState()
}

const handleRotationWheel = (event: WheelEvent) => {
  if (!props.rotationLock) return
  event.preventDefault()
}

const handleFirstPersonPointerDown = (event: PointerEvent) => {
  if (event.button !== 0) return
  if (!pointcloudLoaded.value) return
  if (props.rotationLock) return
  if (!firstPersonActive.value) {
    if (props.clickToEnterFirstPerson === false) return
    enterFirstPersonMode()
  }
  firstPersonPointerDown = { x: event.clientX, y: event.clientY }
}

const handleFirstPersonPointerMove = (event: PointerEvent) => {
  if (!firstPersonActive.value || !firstPersonPointerDown) return
  const currentRot = getCameraOrientation()
  if (!currentRot) return

  const deltaX = event.clientX - firstPersonPointerDown.x
  const deltaY = event.clientY - firstPersonPointerDown.y
  if (deltaX === 0 && deltaY === 0) return

  firstPersonPointerDown = { x: event.clientX, y: event.clientY }
  applyFirstPersonPointcloudRotationDelta(currentRot, deltaX, deltaY)
}

const handleFirstPersonPointerUp = () => {
  clearFirstPersonPointerState()
}

const handleKeydown = (event: KeyboardEvent) => {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement
  ) {
    return
  }
  if (!hasPointcloudKeyboardFocus()) return
  if (!firstPersonActive.value || !pointcloudLoaded.value) return
  if (props.rotationLock) return

  switch (event.key.toLowerCase()) {
    case 'w':
      event.preventDefault()
      activeFirstPersonMoveDirections.add('up')
      requestRender()
      break
    case 's':
      event.preventDefault()
      activeFirstPersonMoveDirections.add('down')
      requestRender()
      break
    case 'a':
      event.preventDefault()
      activeFirstPersonMoveDirections.add('left')
      requestRender()
      break
    case 'd':
      event.preventDefault()
      activeFirstPersonMoveDirections.add('right')
      requestRender()
      break
    case 'escape':
      event.preventDefault()
      exitFirstPersonMode()
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

const cleanup = () => {
  if (cleaningUp) return
  cleaningUp = true

  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = 0
  }
  isRendering = false
  needsRender = false
  tilesLoadingCount = 0
  isPointcloudLoading = false

  runCleanupSafely('ResizeObserver清理', () => {
    resizeObserver?.disconnect?.()
  })
  resizeObserver = null

  if (pointcloudRenderer?.domElement) {
    runCleanupSafely('点云事件解绑', () => {
      pointcloudRenderer?.domElement.removeEventListener(
        'pointerdown',
        handleAnnotationPointerDown,
      )
      pointcloudRenderer?.domElement.removeEventListener(
        'pointermove',
        handleAnnotationPointerMove,
      )
      pointcloudRenderer?.domElement.removeEventListener(
        'pointerup',
        handleAnnotationPointerUp,
      )
      pointcloudRenderer?.domElement.removeEventListener(
        'pointercancel',
        handleAnnotationPointerUp,
      )
      pointcloudRenderer?.domElement.removeEventListener(
        'pointerdown',
        handleRotationPointerDown,
      )
      pointcloudRenderer?.domElement.removeEventListener(
        'pointermove',
        handleRotationPointerMove,
      )
      pointcloudRenderer?.domElement.removeEventListener(
        'pointerup',
        handleRotationPointerUp,
      )
      pointcloudRenderer?.domElement.removeEventListener(
        'pointercancel',
        handleRotationPointerUp,
      )
      pointcloudRenderer?.domElement.removeEventListener(
        'wheel',
        handleRotationWheel,
      )
      pointcloudRenderer?.domElement.removeEventListener(
        'pointerdown',
        handleFirstPersonPointerDown,
      )
      pointcloudRenderer?.domElement.removeEventListener(
        'pointermove',
        handleFirstPersonPointerMove,
      )
      pointcloudRenderer?.domElement.removeEventListener(
        'pointerup',
        handleFirstPersonPointerUp,
      )
      pointcloudRenderer?.domElement.removeEventListener(
        'pointercancel',
        handleFirstPersonPointerUp,
      )
    })
  }
  clearRotationPointerState()
  clearFirstPersonPointerState()
  setFirstPersonActive(false)

  if (annotationMarker && pointcloudScene) {
    runCleanupSafely('当前批注标记释放', () => {
      pointcloudScene?.remove(annotationMarker!)
      disposeObject3D(annotationMarker!)
    })
    annotationMarker = null
  }

  if (annotationStashGroup && pointcloudScene) {
    runCleanupSafely('批注列表标记释放', () => {
      for (const marker of annotationStashMarkerMap.values()) {
        annotationStashGroup?.remove(marker)
        disposeObject3D(marker)
      }
    })
    annotationStashMarkerMap.clear()
    runCleanupSafely('批注列表标记组移除', () => {
      pointcloudScene?.remove(annotationStashGroup!)
    })
    annotationStashGroup = null
  }

  if (worldOriginAxes && pointcloudScene) {
    runCleanupSafely('世界原点坐标轴释放', () => {
      pointcloudScene?.remove(worldOriginAxes!)
      disposeObject3D(worldOriginAxes!)
    })
  }

  runCleanupSafely('点云Tiles释放', () => {
    pointcloudTileset?.dispose?.()
  })
  pointcloudTileset = null
  pointcloudTilesetWrapper = null
  manualClipBox = null
  manualTilesErrorTarget = null
  worldOriginAxes = null

  runCleanupSafely('点云控制器释放', () => {
    pointcloudControls?.dispose?.()
  })

  if (pointcloudRenderer) {
    const renderer = pointcloudRenderer
    const canvas = renderer.domElement
    runCleanupSafely('点云渲染器释放', () => {
      renderer.dispose()
    })
    if (canvas?.parentElement) {
      runCleanupSafely('点云Canvas移除', () => {
        canvas.parentElement?.removeChild(canvas)
      })
    }
  }

  runCleanupSafely('截图RenderTarget释放', () => {
    captureTarget?.dispose?.()
  })
  captureTarget = null

  runCleanupSafely('参考网格释放', () => {
    if (pointcloudGroundGrid) {
      pointcloudScene?.remove(pointcloudGroundGrid)
      pointcloudGroundGrid.dispose()
    }
    if (pointcloudGroundGridWebgl) {
      pointcloudScene?.remove(pointcloudGroundGridWebgl)
      pointcloudGroundGridWebgl.dispose()
    }
  })
  pointcloudGroundGrid = null
  pointcloudGroundGridWebgl = null
  pointcloudGroundGridVisible = false

  runCleanupSafely('EDL 后处理释放', () => {
    edlPipeline?.dispose?.()
    edlPipelineWebgl?.dispose?.()
  })
  edlPipeline = null
  edlPipelineWebgl = null

  pointcloudScene = null
  pointcloudCamera = null
  pointcloudRenderer = null
  pointcloudControls = null
  pointcloudClippingGroup = null
  pointcloudContentGroup = null
  pointcloudClipHost = null
  rendererReady = false
  initPromise = null
  rendererMode = null
  lastTilesErrorTarget = -1
  cleaningUp = false
}

watch(
  () => pointcloudLoaded.value,
  (value) => {
    if (!value) exitFirstPersonMode()
    emit('loaded-change', value)
  },
)

watch(
  () => props.renderAllPoints,
  () => {
    lastTilesErrorTarget = -1
    requestRender()
  },
)

watch(
  () => props.annotationPoint,
  (value) => {
    if (!value) {
      setAnnotationMarker(null)
      return
    }
    setAnnotationMarker(new THREE.Vector3(value.x, value.y, value.z))
  },
  { immediate: true },
)

watch(
  () => props.annotationStatus,
  (status) => {
    applyAnnotationMarkerStyle(status, annotationMarker)
  },
  { immediate: true },
)

watch(
  () => props.annotationHighlightCurrent,
  (highlighted) => {
    applyAnnotationMarkerScale(annotationMarker, highlighted)
  },
  { immediate: true },
)

watch(
  () => props.annotationMarkersVisible,
  () => {
    if (annotationMarker) annotationMarker.visible = props.annotationMarkersVisible !== false
    for (const marker of annotationStashMarkerMap.values()) {
      marker.visible = props.annotationMarkersVisible !== false
    }
    requestRender()
  },
  { immediate: true },
)

watch(
  () => props.annotationStashMarkers,
  (markers) => {
    syncAnnotationStashMarkers(markers ?? [])
  },
  { immediate: true, deep: true },
)

watch(
  () => props.rotationLock,
  () => {
    applyRotationLockState()
    if (props.rotationLock) {
      exitFirstPersonMode()
    } else {
      clearRotationPointerState()
    }
  },
  { immediate: true },
)

onMounted(() => {
  void initPointcloudViewer()
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('keyup', handleKeyup)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('keyup', handleKeyup)
  cleanup()
})

defineExpose({
  loadPointcloudByScanId,
  syncFromTrajectory,
  syncFromPanoramaRotation,
  syncFromPanoramaFov,
  getCameraOrientation,
  getCameraPose,
  pickPointFromScreen,
  getPointcloudGroupWorldMatrix,
  syncFromExternalPose,
  cleanup,
  resetView: resetPointcloudView,
  setFixedViewBySize,
  enterFirstPersonMode,
  exitFirstPersonMode,
  toggleFirstPersonMode,
  isFirstPersonActive: () => firstPersonActive.value,
  getPointcloudMaxDim: () => pointcloudMaxDim || 1,
  getAnnotationMarkerPosition: () => {
    if (!annotationMarker) return null
    return {
      x: annotationMarker.position.x,
      y: annotationMarker.position.y,
      z: annotationMarker.position.z,
    }
  },
  forceCaptureDataUrl,
  getThreeContext: () => ({
    scene: pointcloudScene,
    camera: pointcloudCamera,
    renderer: pointcloudRenderer,
    controls: pointcloudControls,
  }),
  getPointcloudWorldBox: () => getPointcloudWorldBox()?.clone() ?? null,
  setTilesErrorTargetOverride: (value: number | null) => {
    if (value === null || !Number.isFinite(value)) {
      manualTilesErrorTarget = null
    } else {
      manualTilesErrorTarget = clamp(
        Number(value),
        tilesErrorTargetMin,
        tilesErrorTargetMax,
      )
    }
    if (pointcloudTileset && manualTilesErrorTarget !== null) {
      pointcloudTileset.errorTarget = manualTilesErrorTarget
      lastTilesErrorTarget = manualTilesErrorTarget
    } else if (pointcloudTileset) {
      lastTilesErrorTarget = -1
      applyTilesErrorTarget()
    }
    requestRender()
  },
  setPointSize,
  setShowGrid,
  setEdlEnabled,
  setColorMode,
  getColorRange: () => [...pointColorRange] as [number, number],
  isColorAttributeAvailable: () => pointAttributeAvailable,
  requestRender,
  setClipBox: (box: THREE.Box3 | null) => {
    manualClipBox = box ? box.clone() : null
    applyManualClipBox()
  },
  setControlsEnabled: (enabled: boolean) => {
    if (!pointcloudControls) return
    if (!enabled) {
      pointcloudControls.enabled = false
      pointcloudControls.enableRotate = false
      pointcloudControls.enablePan = false
      pointcloudControls.enableZoom = false
      return
    }
    applyRotationLockState()
  },
  setStatusText: (text: string) => {
    pointcloudStatusText.value = text
  },
})
</script>

<style scoped>
.pointcloud-viewport:focus {
  outline: none;
}
</style>
