<template>
  <div class="pointcloud-view-panel">
    <div class="panel-header">
      <span class="panel-title">点云视图</span>
      <div class="panel-controls">
        <template v-if="isPresetMode">
          <span class="panel-hint">{{ pointcloudStatusText }}</span>
        </template>
        <template v-else>
          <el-input
            v-model="tilesetUrl"
            class="tileset-input"
            size="small"
            placeholder="https://.../tileset.json"
            clearable
          >
            <template #append>
              <el-button
                size="small"
                :disabled="!tilesetUrl"
                @click="onLoadTilesClick"
              >
                加载
              </el-button>
            </template>
          </el-input>
          <span class="panel-hint">{{ pointcloudStatusText }}</span>
        </template>
      </div>
    </div>

    <div v-if="!pointcloudLoaded" class="empty-placeholder">
      <div class="placeholder-content">
        <el-icon class="placeholder-icon"><View /></el-icon>
        <p class="placeholder-text">
          {{ isPresetMode ? '自动加载点云中...' : '输入 3D Tiles 地址并加载' }}
        </p>
      </div>
    </div>
    <div ref="pointcloudViewportEl" class="pointcloud-viewport" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { View } from '@element-plus/icons-vue'
import * as THREE from 'three'
import { NodeMaterial, WebGPURenderer } from 'three/webgpu'
import { color as tslColor, vertexColor as tslVertexColor } from 'three/tsl'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { TilesRenderer } from '3d-tiles-renderer'
import { GLTFExtensionsPlugin } from '3d-tiles-renderer/three/plugins'
import type { TrajectoryPoint } from '@/api/calibration'
import { getScanTilesetUrl, getScanTilesAsset } from '@/api/fileManage'

type PointcloudOffset = { x: number; y: number; z: number }
type CameraPose = { camera: THREE.Vector3; target: THREE.Vector3 }

const props = defineProps<{
  isPresetMode: boolean
}>()

const emit = defineEmits<{
  (e: 'loaded-change', value: boolean): void
}>()

const pointcloudViewportEl = ref<HTMLDivElement | null>(null)
const tilesetUrl = ref<string>('')
const pointcloudStatusText = ref('')
const pointcloudLoaded = ref(false)
const pointcloudOffset = ref<PointcloudOffset>({ x: 0, y: 0, z: 0 })
let pointcloudRecentered = false
const tilesErrorTargetMin = 1
const tilesErrorTargetMax = 28
const tilesErrorTargetNear = 0.45
const tilesErrorTargetFar = 3.2
const tilesetZUpRotationX = -Math.PI / 2
const tilesetZUpQuat = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  tilesetZUpRotationX,
)
const useUnlitMaterial = false
const defaultBgColor = '#0b1020'
const dprCap = 1.25
const unlitMaterialCache = new WeakMap<any, THREE.Material>()
const unlitTSLMaterialCache = new WeakMap<any, { v0?: any; v1?: any }>()

let pointcloudScene: THREE.Scene | null = null
let pointcloudCamera: THREE.PerspectiveCamera | null = null
let pointcloudRenderer: WebGPURenderer | THREE.WebGLRenderer | null = null
let pointcloudControls: OrbitControls | null = null
let pointcloudTileset: TilesRenderer | null = null
let pointcloudTilesetWrapper: THREE.Group | null = null
let animationId = 0
let isRendering = false
let needsRender = false
let tilesLoadingCount = 0
let isPointcloudLoading = false
let resizeObserver: ResizeObserver | null = null
let pointcloudMaxDim = 1
const fixedViewSize: number | null = null
let lastTilesErrorTarget = -1
let rendererReady = false
let initPromise: Promise<void> | null = null
let rendererMode: 'webgpu' | 'webgl' | null = null
let cleaningUp = false

const runCleanupSafely = (label: string, task: () => void) => {
  try {
    task()
  } catch (error) {
    console.warn(`[Result Pointcloud] ${label}失败:`, error)
  }
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
      size: src?.size ?? 1,
      sizeAttenuation: src?.sizeAttenuation ?? true,
      color: baseColor,
      vertexColors: opts.vertexColors,
    })
    if (src?.map) next.map = src.map
    applySharedMaterialFlags(next, src)
    next.toneMapped = false
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

const applyMaterialMode = (root: any) => {
  if (!useUnlitMaterial) return
  root.traverse((obj: any) => {
    if (!obj?.material) return
    const hasVertexColors = !!obj.geometry?.attributes?.color
    if (rendererMode === 'webgpu') {
      if (Array.isArray(obj.material)) return
      const src =
        (obj.material as any)?.__viewerOriginalMaterial ?? obj.material
      const next = getOrCreateUnlitTSLMaterial(src, {
        vertexColors: hasVertexColors,
      })
      if (obj.material !== next) obj.material = next
      return
    }

    const opts = {
      vertexColors: hasVertexColors,
      isPoints: Boolean(obj.isPoints),
    }
    if (Array.isArray(obj.material)) {
      const next = obj.material.map((item: any) =>
        getOrCreateUnlitMaterialWebGL(item, opts),
      )
      const isSame = obj.material.every(
        (item: any, index: number) => item === next[index],
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
  for (const attr of Object.values(attrs) as any[]) {
    const array = attr?.isInterleavedBufferAttribute
      ? attr.data?.array
      : attr?.array
    if (array?.byteLength) bytes += array.byteLength
  }
  return bytes
}

const ensureWebGPUVertexAlignment = (geometry: any) => {
  if (!geometry?.attributes) return 0

  let fixed = 0
  for (const [name, attr] of Object.entries(geometry.attributes)) {
    const a = attr as any
    if (!a || a.isInterleavedBufferAttribute) continue

    const array = a.array
    const bytesPerElement = array?.BYTES_PER_ELEMENT ?? 0
    const itemSize = a.itemSize ?? 0
    const stride = bytesPerElement * itemSize
    if (!bytesPerElement || !itemSize || stride % 4 === 0) continue
    if (itemSize > 4) continue

    const count = a.count ?? 0
    const paddedSize = 4
    const paddedArray = new array.constructor(count * paddedSize)
    for (let i = 0; i < count; i += 1) {
      const srcIndex = i * itemSize
      const dstIndex = i * paddedSize
      for (let c = 0; c < itemSize; c += 1) {
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
    fixed += 1
  }

  return fixed
}

const sanitizeObjectForWebGPU = (root: any) => {
  const maxBufferBytes = 256 * 1024 * 1024
  const softLimit = maxBufferBytes - 8 * 1024 * 1024

  root.traverse((obj: any) => {
    const geom = obj?.geometry
    if (!geom?.isBufferGeometry) return

    ensureWebGPUVertexAlignment(geom)
    const bytes = estimateGeometryBytes(geom)
    if (bytes > softLimit) {
      obj.visible = false
    }
  })
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const getTilesErrorTarget = () => {
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

const updateTilesetResolution = () => {
  if (!pointcloudViewportEl.value || !pointcloudTileset || !pointcloudCamera)
    return
  const rect = pointcloudViewportEl.value.getBoundingClientRect()
  const w = Math.max(1, Math.floor(rect.width || 1))
  const h = Math.max(1, Math.floor(rect.height || 1))
  pointcloudTileset.setResolution?.(pointcloudCamera, w, h)
  if (rendererMode === 'webgl' && pointcloudRenderer) {
    pointcloudTileset.setResolutionFromRenderer?.(
      pointcloudCamera,
      pointcloudRenderer as THREE.WebGLRenderer,
    )
  }
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

const initPointcloudViewer = async () => {
  if (!pointcloudViewportEl.value) return
  if (pointcloudRenderer && rendererReady) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    if (!pointcloudViewportEl.value) return

    const supportsWebGPU =
      typeof navigator !== 'undefined' && 'gpu' in navigator
    const w = pointcloudViewportEl.value.clientWidth || 1
    const h = pointcloudViewportEl.value.clientHeight || 1

    pointcloudScene = new THREE.Scene()
    pointcloudScene.background = new THREE.Color(defaultBgColor)
    pointcloudCamera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100000)
    pointcloudCamera.position.set(0, 10, 20)

    const setupRendererCommon = () => {
      if (!pointcloudRenderer || !pointcloudCamera) return
      pointcloudControls = new OrbitControls(
        pointcloudCamera,
        pointcloudRenderer.domElement,
      )
      pointcloudControls.enableDamping = false
      pointcloudControls.addEventListener('change', requestRender)

      const ambient = new THREE.AmbientLight(0xffffff, 0.7)
      const dir = new THREE.DirectionalLight(0xffffff, 0.9)
      dir.position.set(10, 10, 10)
      pointcloudScene?.add(ambient, dir)

      if (!resizeObserver && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (
            pointcloudRenderer &&
            pointcloudCamera &&
            pointcloudViewportEl.value &&
            syncRendererSize(
              pointcloudRenderer,
              pointcloudCamera,
              pointcloudViewportEl.value,
              updateTilesetResolution,
            )
          ) {
            requestRender()
          }
        })
        resizeObserver.observe(pointcloudViewportEl.value)
      }
    }

    const buildWebGLRenderer = () => {
      rendererMode = 'webgl'
      pointcloudRenderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
      })
      pointcloudRenderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, dprCap),
      )
      pointcloudRenderer.setSize(w, h)
      pointcloudRenderer.setClearColor(new THREE.Color(defaultBgColor), 1)
      pointcloudRenderer.toneMapping = THREE.ACESFilmicToneMapping
      pointcloudRenderer.toneMappingExposure = 1.0
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
        Math.min(window.devicePixelRatio || 1, dprCap),
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
        console.error('[Result] WebGPU 初始化失败，回退 WebGL:', error)
        rendererReady = false
        buildWebGLRenderer()
      }
    } else {
      buildWebGLRenderer()
    }

    if (!rendererReady) return
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
    if (
      pointcloudViewportEl.value &&
      syncRendererSize(
        pointcloudRenderer,
        pointcloudCamera,
        pointcloudViewportEl.value,
        updateTilesetResolution,
      )
    ) {
      needsRender = true
    }

    const didUpdate = pointcloudControls?.update() ?? false
    pointcloudCamera.updateMatrixWorld()

    if (pointcloudTileset) {
      applyTilesErrorTarget()
      try {
        pointcloudTileset.setCamera(pointcloudCamera)
        pointcloudTileset.update()
      } catch {
        // ignore
      }
    }

    const isActiveLoading = tilesLoadingCount > 0 || isPointcloudLoading
    if (needsRender || didUpdate || isActiveLoading) {
      pointcloudRenderer.render(pointcloudScene, pointcloudCamera)
      needsRender = false
    }

    if (needsRender || didUpdate || isActiveLoading) {
      animationId = requestAnimationFrame(renderPointcloud)
    } else {
      isRendering = false
      animationId = 0
    }
  } catch (error) {
    console.error('[Result] 点云渲染失败:', error)
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
  pointcloudOffset.value = { x: 0, y: 0, z: 0 }
  pointcloudRecentered = false
  tilesLoadingCount = 0
  isPointcloudLoading = true
  requestRender()

  try {
    if (pointcloudTileset) {
      if (pointcloudTilesetWrapper) {
        pointcloudScene.remove(pointcloudTilesetWrapper)
        pointcloudTilesetWrapper = null
      } else {
        pointcloudScene.remove(pointcloudTileset.group)
      }
      pointcloudTileset.dispose?.()
      pointcloudTileset = null
    }

    const tr = new TilesRenderer(url)
    tr.errorTarget = getTilesErrorTarget()
    pointcloudTileset = tr

    if (projectId && scanFileId) {
      const prefix = `/api/projects/${projectId}/files/${scanFileId}/scan/tiles/`
      tr.registerPlugin({
        fetchData: async (uri: any, options: any) => {
          const raw = typeof uri === 'string' ? uri : uri?.toString?.() || ''
          if (!raw) return null

          let pathname = ''
          try {
            pathname = new URL(raw, window.location.href).pathname
          } catch {
            pathname = raw
          }

          if (!pathname.startsWith(prefix)) {
            return fetch(raw, options)
          }

          const assetPath = pathname.slice(prefix.length)
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
    wrapper.rotation.x = tilesetZUpRotationX
    wrapper.add(tr.group)
    pointcloudScene.add(wrapper)
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
      applyMaterialMode(tileScene)
      requestRender()
    })
    tr.addEventListener('load-error', (e: any) => {
      console.error(e)
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
      applyMaterialMode(tr.group)

      const sphere = new THREE.Sphere()
      if (tr.getBoundingSphere?.(sphere)) {
        wrapper.updateMatrixWorld(true)
        tr.group.updateMatrixWorld(true)
        const sphereCenterWorld = sphere.center
          .clone()
          .applyMatrix4(tr.group.matrixWorld)
        pointcloudOffset.value = { x: 0, y: 0, z: 0 }
        pointcloudRecentered = false
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

      fitCameraToObject(pointcloudCamera, pointcloudControls, tr.group)
      pointcloudOffset.value = { x: 0, y: 0, z: 0 }
      pointcloudRecentered = false
      requestRender()
    })

    requestRender()
  } catch (error: any) {
    console.error(error)
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

  const yaw = point.yaw || 0
  const yawRad = THREE.MathUtils.degToRad(yaw)
  const lookDistance = 5
  const pcLocal = getPointcloudLocalFromTrajectory(point)

  const dirWorldPc = new THREE.Vector3(
    Math.cos(yawRad),
    Math.sin(yawRad),
    0,
  ).normalize()
  const pcLookAtLocal = pcLocal
    .clone()
    .addScaledVector(dirWorldPc, lookDistance)
  const pcCameraPosLocal = pcLocal
    .clone()
    .addScaledVector(dirWorldPc, -lookDistance * 1.5)

  const pcLookAt = pcLookAtLocal.clone().applyQuaternion(tilesetZUpQuat)
  const pcCameraPos = pcCameraPosLocal.clone().applyQuaternion(tilesetZUpQuat)

  pointcloudCamera.position.copy(pcCameraPos)
  pointcloudCamera.lookAt(pcLookAt)
  pointcloudControls.target.copy(pcLookAt)
  pointcloudCamera.updateMatrixWorld()
  pointcloudControls.update()
  requestRender()
}

const getOffset = () => ({ ...pointcloudOffset.value })

const isRecentered = () => pointcloudRecentered

const getCameraPose = () => {
  if (!pointcloudCamera || !pointcloudControls) return null
  return {
    camera: pointcloudCamera.position.clone(),
    target: pointcloudControls.target.clone(),
  }
}

const getPointcloudGroupWorldMatrix = () => {
  if (!pointcloudTileset?.group) return null
  pointcloudTileset.group.updateMatrixWorld?.(true)
  return pointcloudTileset.group.matrixWorld.clone()
}

const syncFromExternalPose = (pose: CameraPose | null) => {
  if (!pose) return
  if (!pointcloudCamera || !pointcloudControls) return

  pointcloudCamera.position.copy(pose.camera)
  pointcloudControls.target.copy(pose.target)
  pointcloudCamera.lookAt(pose.target)
  pointcloudCamera.updateMatrixWorld()
  pointcloudControls.update()
  requestRender()
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

  runCleanupSafely('点云Tiles释放', () => {
    pointcloudTileset?.dispose?.()
  })
  pointcloudTileset = null
  pointcloudTilesetWrapper = null
  pointcloudRecentered = false

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

  pointcloudScene = null
  pointcloudCamera = null
  pointcloudRenderer = null
  pointcloudControls = null
  rendererReady = false
  initPromise = null
  rendererMode = null
  lastTilesErrorTarget = -1
  cleaningUp = false
}

watch(
  () => pointcloudLoaded.value,
  (value) => emit('loaded-change', value),
)

onMounted(() => {
  void initPointcloudViewer()
})

onBeforeUnmount(() => {
  cleanup()
})

defineExpose({
  loadPointcloudByScanId,
  syncFromTrajectory,
  getOffset,
  isRecentered,
  getCameraPose,
  getPointcloudGroupWorldMatrix,
  syncFromExternalPose,
  cleanup,
  setStatusText: (text: string) => {
    pointcloudStatusText.value = text
  },
})
</script>
