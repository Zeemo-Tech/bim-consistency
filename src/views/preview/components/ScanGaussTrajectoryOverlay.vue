<template>
  <div ref="hostRef" class="scan-attach-overlay">
    <div
      v-if="
        gaussStatus === 'unbound' ||
        gaussStatus === 'loading' ||
        gaussStatus === 'error'
      "
      class="scan-overlay-status"
      :class="`is-${gaussStatus}`"
    >
      高斯：{{ statusLabel }}
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 点云预览页的「叠加层」：把高斯（LCCRender）与轨迹线按点云坐标系叠加显示。
 *
 * 设计对齐 twoScreen/BimPointcloudMixViewer 的混合模式：
 * - 透明 WebGL 画布覆盖在点云画布之上，相机完全跟随点云相机；
 * - 高斯用 LCCRender 加载，modelMatrix = Z-up→Y-up（与点云 tileset 的 wrapper 旋转一致）；
 * - 逐帧调用 checkRenderNextFrame + LCCRender.update，并按首屏/增强两档设置 LOD；
 * - 轨迹点按同样 Z-up→Y-up 变换画成 Line + Points，renderOrder 置顶保证可见。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { LCCRender } from '@/libs/lcc-0.5.4.js'
import type { TrajectoryPoint } from '@/api/calibration'

type GaussStatus = 'idle' | 'unbound' | 'loading' | 'loaded' | 'error'
const STATUS_LABELS: Record<GaussStatus, string> = {
  idle: '',
  unbound: '未绑定高斯文件',
  loading: '加载中…',
  loaded: '已加载',
  error: '加载失败',
}

const FIRST_SCREEN_MAX_SPLATS = 700000
const FIRST_SCREEN_MAX_DISTANCE = 80
const ENHANCED_MAX_SPLATS = 1500000
const ENHANCED_MAX_DISTANCE = 120
const ENHANCED_UPGRADE_DELAY = 2500

const props = withDefaults(
  defineProps<{
    /** 点云相机位姿（来自 PointCloudViewer.getCameraPose），叠加层相机跟随之 */
    getCameraPose?: () => {
      camera: THREE.Vector3
      target: THREE.Vector3
    } | null
    showGaussian?: boolean
    showTrajectory?: boolean
    /** 高斯资源 URL（含鉴权参数），空则跳过加载 */
    gaussDataPath?: string
    trajectoryPoints?: TrajectoryPoint[]
    /** 当前选中的轨迹点索引（用绿色高亮） */
    selectedIndex?: number | null
    /** 世界坐标裁切盒（剖切用），null 表示不裁切 */
    clipBox?: {
      min: [number, number, number]
      max: [number, number, number]
    } | null
    /** 当前高亮的剖切轴/方向（用于箭头高亮） */
    clipAxis?: 'x' | 'y' | 'z'
    clipInvert?: boolean
  }>(),
  {
    getCameraPose: () => null,
    showGaussian: false,
    showTrajectory: false,
    gaussDataPath: '',
    trajectoryPoints: () => [],
    selectedIndex: null,
    clipBox: null,
    clipAxis: 'z',
    clipInvert: false,
  },
)

const hostRef = ref<HTMLDivElement | null>(null)
const gaussStatus = ref<GaussStatus>('idle')
const statusLabel = computed(() => STATUS_LABELS[gaussStatus.value])

const zUpToYUpRotationX = -Math.PI / 2
const zUpToYUpMatrix = new THREE.Matrix4().makeRotationX(zUpToYUpRotationX)

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let frame = 0
let lccObject: any = null
let lccLoadToken = 0
let activeGaussPath = ''
let pendingGaussLoad = false
let pendingGaussRetry = 0
let gaussWatchdog = 0
let resizeObserver: ResizeObserver | null = null
let enhancedUpgradeTimer: number | null = null
let trajectoryGroup: THREE.Group | null = null
let clipBoxHelper: THREE.Box3Helper | null = null
let clipHandlesGroup: THREE.Group | null = null
const clipHandlePickers: THREE.Object3D[] = []
const clipRaycaster = new THREE.Raycaster()
let selectedMarker: THREE.Points | null = null
let circleTexture: THREE.Texture | null = null
const zUpGroup = new THREE.Group()

function getCircleTexture(): THREE.Texture {
  if (circleTexture) return circleTexture
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, size, size)
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
  }
  circleTexture = new THREE.CanvasTexture(canvas)
  circleTexture.colorSpace = THREE.SRGBColorSpace
  return circleTexture
}

/** 屏幕拾取：返回离点击位置最近的轨迹点索引（阈值内），用于在视图里点控制点。 */
function pickTrajectoryIndex(clientX: number, clientY: number): number | null {
  const host = hostRef.value
  if (!host || !camera) return null
  if (!props.showTrajectory) return null
  const points = props.trajectoryPoints ?? []
  if (!points.length) return null
  const rect = host.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
  const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1
  const v = new THREE.Vector3()
  let best = -1
  let bestDist = Infinity
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]
    v.set(Number(p.x) || 0, Number(p.y) || 0, Number(p.z) || 0)
      .applyMatrix4(zUpGroup.matrixWorld)
      .project(camera)
    if (v.z < -1 || v.z > 1) continue
    const d = Math.hypot(v.x - ndcX, v.y - ndcY)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best >= 0 && bestDist <= 0.03 ? best : null
}

defineExpose({ pickTrajectoryIndex, reloadGaussian, pickClipHandle })

function syncCameraFromPointcloud() {
  const pose = props.getCameraPose?.()
  if (!camera || !pose?.camera) return
  camera.position.copy(pose.camera)
  camera.up.set(0, 1, 0)
  if (pose.target) camera.lookAt(pose.target)
  camera.updateMatrixWorld()
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert()
}

function syncSize() {
  const host = hostRef.value
  if (!renderer || !host || !camera) return
  const width = Math.max(1, Math.floor(host.clientWidth || 1))
  const height = Math.max(1, Math.floor(host.clientHeight || 1))
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  const aspect = width / height
  if (Math.abs(camera.aspect - aspect) > 1e-6) {
    camera.aspect = aspect
    camera.updateProjectionMatrix()
  }
  if (
    renderer.domElement.width === Math.floor(width * dpr) &&
    renderer.domElement.height === Math.floor(height * dpr)
  ) {
    return
  }
  renderer.setPixelRatio(dpr)
  renderer.setSize(width, height)
}

function renderLoop() {
  frame = window.requestAnimationFrame(renderLoop)
  if (!renderer || !scene || !camera) return
  syncSize()
  syncCameraFromPointcloud()
  renderer.clear(true, true, true)
  if (props.showGaussian && lccObject) {
    if (typeof lccObject.checkRenderNextFrame === 'function') {
      lccObject.checkRenderNextFrame()
    }
    if (typeof (LCCRender as any)?.update === 'function') {
      ;(LCCRender as any).update()
    }
  }
  renderer.render(scene, camera)
}

function clearEnhancedUpgradeTimer() {
  if (enhancedUpgradeTimer !== null) {
    window.clearTimeout(enhancedUpgradeTimer)
    enhancedUpgradeTimer = null
  }
}

function applyGaussianQuality(stage: 'first-screen' | 'enhanced') {
  if (!lccObject) return
  const maxSplats =
    stage === 'enhanced' ? ENHANCED_MAX_SPLATS : FIRST_SCREEN_MAX_SPLATS
  const maxDistance =
    stage === 'enhanced' ? ENHANCED_MAX_DISTANCE : FIRST_SCREEN_MAX_DISTANCE
  if (typeof lccObject.setMaxSplats === 'function') {
    lccObject.setMaxSplats(maxSplats)
  }
  if (typeof lccObject.setMaxDistance === 'function') {
    lccObject.setMaxDistance(maxDistance)
  }
  if (typeof lccObject.setLodAutoLevelUp === 'function') {
    lccObject.setLodAutoLevelUp(true)
  }
}

/**
 * 用世界坐标裁切盒裁切高斯（LCC setClipBox）。
 * 高斯本地坐标 = Rx(-90°)⁻¹ · 世界坐标 = (x, -z, y)，故轴向盒尺寸为 (sx, sz, sy)。
 */
function applyGaussianClipBox() {
  if (!lccObject || typeof lccObject.setClipBox !== 'function') return
  const box = props.clipBox
  if (!box) {
    try {
      lccObject.setClipBox(null)
    } catch {
      /* ignore */
    }
    return
  }
  const [minX, minY, minZ] = box.min
  const [maxX, maxY, maxZ] = box.max
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const cz = (minZ + maxZ) / 2
  const sx = Math.max(1e-4, maxX - minX)
  const sy = Math.max(1e-4, maxY - minY)
  const sz = Math.max(1e-4, maxZ - minZ)
  try {
    lccObject.setClipBox({
      position: [cx, -cz, cy],
      rotation: [0, 0, 0],
      scale: [sx, sz, sy],
      clipSide: 1,
    })
  } catch (err) {
    console.error('[scan-overlay] 高斯裁切失败', err)
  }
}

function disposeLcc() {
  lccLoadToken += 1
  clearEnhancedUpgradeTimer()
  if (gaussWatchdog) {
    window.clearTimeout(gaussWatchdog)
    gaussWatchdog = 0
  }
  const obj = lccObject
  lccObject = null
  if (obj && typeof (LCCRender as any)?.unload === 'function') {
    try {
      ;(LCCRender as any).unload(obj)
    } catch {
      /* ignore */
    }
  }
}

function loadGaussian() {
  if (!renderer || !scene || !camera) {
    pendingGaussLoad = true
    // 画布/相机尚未就绪时，稍后重试，避免“只有刷新才出高斯”。
    if (!pendingGaussRetry) {
      pendingGaussRetry = window.setTimeout(() => {
        pendingGaussRetry = 0
        loadGaussian()
      }, 300)
    }
    return
  }
  if (pendingGaussRetry) {
    window.clearTimeout(pendingGaussRetry)
    pendingGaussRetry = 0
  }
  if (!props.showGaussian) {
    gaussStatus.value = 'idle'
    activeGaussPath = ''
    disposeLcc()
    return
  }
  if (!props.gaussDataPath) {
    gaussStatus.value = 'unbound'
    activeGaussPath = ''
    disposeLcc()
    return
  }
  // 去重：同一路径正在加载或已加载则跳过，避免并发 load/unload 把 LCC 状态弄乱。
  if (
    props.gaussDataPath === activeGaussPath &&
    (gaussStatus.value === 'loading' || gaussStatus.value === 'loaded')
  ) {
    return
  }
  pendingGaussLoad = false
  disposeLcc()
  activeGaussPath = props.gaussDataPath
  const token = ++lccLoadToken
  gaussStatus.value = 'loading'
  console.info('[scan-overlay] 加载高斯', props.gaussDataPath)
  // 看门狗：若长时间仍未加载成功，自动重试一次，避免必须手动刷新页面。
  if (gaussWatchdog) window.clearTimeout(gaussWatchdog)
  gaussWatchdog = window.setTimeout(() => {
    gaussWatchdog = 0
    if (token !== lccLoadToken) return
    if (gaussStatus.value === 'loaded') return
    console.warn('[scan-overlay] 高斯加载超时，自动重试')
    activeGaussPath = ''
    loadGaussian()
  }, 15000)
  lccObject = (LCCRender as any).load(
    {
      camera,
      scene,
      dataPath: props.gaussDataPath,
      renderLib: THREE,
      canvas: renderer.domElement,
      renderer,
      useEnv: false,
      useIndexDB: true,
      useLoadingEffect: false,
      modelMatrix: zUpToYUpMatrix.clone(),
      appKey: null,
      maxHostCacheSize: 512,
      maxGpuCacheSize: 512,
    },
    () => {
      if (token !== lccLoadToken) return
      if (gaussWatchdog) {
        window.clearTimeout(gaussWatchdog)
        gaussWatchdog = 0
      }
      gaussStatus.value = 'loaded'
      console.info('[scan-overlay] 高斯已加载')
      applyGaussianQuality('first-screen')
      applyGaussianClipBox()
      clearEnhancedUpgradeTimer()
      enhancedUpgradeTimer = window.setTimeout(() => {
        enhancedUpgradeTimer = null
        if (token !== lccLoadToken) return
        applyGaussianQuality('enhanced')
      }, ENHANCED_UPGRADE_DELAY)
    },
    () => {},
    (err: unknown) => {
      if (token === lccLoadToken) {
        lccObject = null
        activeGaussPath = ''
        gaussStatus.value = 'error'
      }
      if (gaussWatchdog) {
        window.clearTimeout(gaussWatchdog)
        gaussWatchdog = 0
      }
      console.error('[scan-overlay] 高斯加载失败', err)
    },
  )
}

/** 外部触发重载：仅在应显示但尚未成功加载时重新加载（避免重复下载）。 */
function reloadGaussian() {
  if (!props.showGaussian || !props.gaussDataPath) return
  if (
    props.gaussDataPath === activeGaussPath &&
    (gaussStatus.value === 'loading' || gaussStatus.value === 'loaded')
  ) {
    return
  }
  loadGaussian()
}

/** 在叠加层里画裁切盒线框 + 6 个可拖拽箭头（独立渲染器，不被裁掉）。 */
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
  const hitRadius = Math.max(shaftRadius * 6, 0.08)
  const activeColor = new THREE.Color('#ffd04b')
  const idleColor = new THREE.Color('#409eff')
  const baseAxis = new THREE.Vector3(0, 1, 0)
  const group = new THREE.Group()
  const faces: Array<{
    axis: 'x' | 'y' | 'z'
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
    const isActive =
      face.axis === props.clipAxis && face.invert === props.clipInvert
    const color = isActive ? activeColor : idleColor

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 12),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: isActive ? 0.95 : 0.82,
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
        opacity: isActive ? 1 : 0.9,
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
      __overlayClipHandle: true,
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

function updateClipBoxHelper() {
  if (!scene) return
  if (clipBoxHelper) {
    scene.remove(clipBoxHelper)
    clipBoxHelper.geometry?.dispose?.()
    ;(clipBoxHelper.material as any)?.dispose?.()
    clipBoxHelper = null
  }
  if (clipHandlesGroup) {
    scene.remove(clipHandlesGroup)
    clipHandlesGroup.traverse?.((obj: any) => {
      obj.geometry?.dispose?.()
      obj.material?.dispose?.()
    })
    clipHandlesGroup = null
  }
  clipHandlePickers.length = 0

  const b = props.clipBox
  if (!b) return
  const box = new THREE.Box3(
    new THREE.Vector3(b.min[0], b.min[1], b.min[2]),
    new THREE.Vector3(b.max[0], b.max[1], b.max[2]),
  )
  clipBoxHelper = new THREE.Box3Helper(box, new THREE.Color('#ffcf4a'))
  clipBoxHelper.renderOrder = 9999
  ;(clipBoxHelper.material as any).depthTest = false
  ;(clipBoxHelper.material as any).depthWrite = false
  ;(clipBoxHelper.material as any).transparent = true
  scene.add(clipBoxHelper)

  const handles = buildClipHandles(box)
  clipHandlesGroup = handles
  scene.add(handles)
}

/** 拾取叠加层里的裁切箭头（世界坐标），供外层驱动拖拽。 */
function pickClipHandle(
  clientX: number,
  clientY: number,
): { axis: 'x' | 'y' | 'z'; invert: boolean } | null {
  const host = hostRef.value
  if (!host || !camera || !clipHandlePickers.length) return null
  const rect = host.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -(((clientY - rect.top) / rect.height) * 2 - 1),
  )
  if (clipRaycaster.params.Line) clipRaycaster.params.Line.threshold = 0.2
  clipRaycaster.setFromCamera(ndc, camera)
  const hits = clipRaycaster.intersectObjects(clipHandlePickers, true)
  const hit = hits[0] as any
  if (hit?.object?.userData?.__overlayClipHandle) {
    return {
      axis: hit.object.userData.axis,
      invert: !!hit.object.userData.invert,
    }
  }
  return null
}

function disposeTrajectory() {
  if (!trajectoryGroup) return
  zUpGroup.remove(trajectoryGroup)
  trajectoryGroup.traverse((obj: any) => {
    obj.geometry?.dispose?.()
    const mat = obj.material
    if (Array.isArray(mat)) mat.forEach((m: any) => m?.dispose?.())
    else mat?.dispose?.()
  })
  trajectoryGroup = null
}

function rebuildTrajectory() {
  if (!scene) return
  disposeTrajectory()
  const points = props.trajectoryPoints ?? []
  if (!props.showTrajectory || points.length < 2) return
  const vertices = points.map(
    (p) =>
      new THREE.Vector3(Number(p.x) || 0, Number(p.y) || 0, Number(p.z) || 0),
  )
  const lineGeom = new THREE.BufferGeometry().setFromPoints(vertices)
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xffcf4a,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  })
  const line = new THREE.Line(lineGeom, lineMat)
  line.renderOrder = 20
  line.frustumCulled = false
  const dotGeom = new THREE.BufferGeometry().setFromPoints(vertices)
  const dotMat = new THREE.PointsMaterial({
    color: 0xff8a3d,
    size: 6,
    sizeAttenuation: false,
    map: getCircleTexture(),
    alphaTest: 0.5,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  })
  const dots = new THREE.Points(dotGeom, dotMat)
  dots.renderOrder = 21
  dots.frustumCulled = false
  trajectoryGroup = new THREE.Group()
  trajectoryGroup.add(line)
  trajectoryGroup.add(dots)
  zUpGroup.add(trajectoryGroup)
}

/** 选中控制点：单独一个绿色圆点高亮（置顶渲染）。 */
function ensureSelectedMarker() {
  if (selectedMarker) return
  const geom = new THREE.BufferGeometry()
  geom.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(3), 3),
  )
  const mat = new THREE.PointsMaterial({
    color: 0x2ee66b,
    size: 9,
    sizeAttenuation: false,
    map: getCircleTexture(),
    alphaTest: 0.5,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  })
  selectedMarker = new THREE.Points(geom, mat)
  selectedMarker.renderOrder = 22
  selectedMarker.frustumCulled = false
  selectedMarker.visible = false
  zUpGroup.add(selectedMarker)
}

function updateSelectedMarker() {
  ensureSelectedMarker()
  if (!selectedMarker) return
  const points = props.trajectoryPoints ?? []
  const index = props.selectedIndex
  const point =
    index === null || index === undefined ? undefined : points[index]
  if (!point || !props.showTrajectory) {
    selectedMarker.visible = false
    return
  }
  const attr = selectedMarker.geometry.getAttribute('position')
  attr.setXYZ(
    0,
    Number(point.x) || 0,
    Number(point.y) || 0,
    Number(point.z) || 0,
  )
  attr.needsUpdate = true
  selectedMarker.geometry.computeBoundingSphere()
  selectedMarker.visible = true
}

function init() {
  const host = hostRef.value
  if (!host || renderer) return
  const width = Math.max(1, Math.floor(host.clientWidth || 1))
  const height = Math.max(1, Math.floor(host.clientHeight || 1))
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100000)
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  })
  renderer.autoClear = false
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.setSize(width, height)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  host.appendChild(renderer.domElement)
  zUpGroup.rotation.x = zUpToYUpRotationX
  scene.add(zUpGroup)
  // LCCRender 是模块级单例，绑定在“首次 load 时的 canvas/scene/renderer”。
  // SPA 再次进入本页时旧单例仍指向已销毁的画布，导致高斯加载不出来（刷新页面才会重置）。
  // 这里在挂载时先重置单例，确保绑定到当前叠加层的画布。
  ;(LCCRender as any)?.dispose?.()
  loadGaussian()
  rebuildTrajectory()
  updateSelectedMarker()
  updateClipBoxHelper()
  if (!frame) renderLoop()
  // 兜底：进入页面（非刷新）时 props 可能在本组件挂载后才就绪，
  // 用 nextTick + ResizeObserver 再尝试一次，避免“只有刷新才出高斯”。
  void nextTick(() => {
    syncSize()
    loadGaussian()
  })
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      syncSize()
      if (pendingGaussLoad) loadGaussian()
    })
    resizeObserver.observe(host)
  }
}

watch(
  () => [props.showGaussian, props.gaussDataPath] as const,
  () => loadGaussian(),
)
watch(
  () => [props.showTrajectory, props.trajectoryPoints] as const,
  () => {
    rebuildTrajectory()
    updateSelectedMarker()
  },
  { deep: true },
)
watch(
  () => [props.selectedIndex, props.showTrajectory] as const,
  () => updateSelectedMarker(),
)

watch(
  () => props.clipBox,
  () => {
    applyGaussianClipBox()
    updateClipBoxHelper()
  },
  { deep: true },
)

watch(
  () => [props.clipAxis, props.clipInvert] as const,
  () => updateClipBoxHelper(),
)

onMounted(init)

onBeforeUnmount(() => {
  window.cancelAnimationFrame(frame)
  frame = 0
  if (pendingGaussRetry) {
    window.clearTimeout(pendingGaussRetry)
    pendingGaussRetry = 0
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  disposeLcc()
  // 卸载时重置 LCC 单例，避免下次（SPA）进入复用已销毁的画布。
  ;(LCCRender as any)?.dispose?.()
  disposeTrajectory()
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
  if (selectedMarker) {
    selectedMarker.geometry.dispose()
    const m = selectedMarker.material
    if (Array.isArray(m)) m.forEach((mm: any) => mm?.dispose?.())
    else (m as any)?.dispose?.()
    selectedMarker = null
  }
  renderer?.dispose()
  renderer?.forceContextLoss()
  renderer?.domElement.remove()
  renderer = null
  scene = null
  camera = null
  circleTexture?.dispose()
  circleTexture = null
})
</script>

<style scoped>
.scan-attach-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.scan-attach-overlay :deep(> canvas) {
  width: 100%;
  height: 100%;
  display: block;
}

.scan-overlay-status {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 30;
  padding: 4px 10px;
  font-size: 12px;
  line-height: 1.4;
  color: #fff;
  pointer-events: none;
  background: rgb(24 42 72 / 85%);
  border: 1px solid rgb(115 162 243 / 45%);
  border-radius: 6px;
}

.scan-overlay-status.is-error {
  background: rgb(80 24 24 / 88%);
  border-color: rgb(243 115 115 / 55%);
}

.scan-overlay-status.is-unbound {
  background: rgb(60 52 24 / 88%);
  border-color: rgb(230 190 90 / 55%);
}
</style>
