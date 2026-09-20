<template>
  <div
    class="consistency-viewer"
    :class="{ 'consistency-viewer--transparent': transparentBackground }"
  >
    <button
      class="panel-refresh-btn"
      type="button"
      aria-label="重新加载实模一致结果"
      :disabled="loading"
      @click="reload"
    >
      <el-icon><RefreshRight /></el-icon>
    </button>

    <div v-if="loading || !meshLoaded" class="consistency-viewer__placeholder">
      <div class="consistency-viewer__placeholder-card">
        <el-icon
          class="consistency-viewer__placeholder-icon"
          :class="{ 'is-loading': loading }"
        >
          <Loading v-if="loading" />
          <View v-else />
        </el-icon>
        <p class="consistency-viewer__placeholder-title">
          {{ loading ? '实模一致结果加载中' : emptyTitle }}
        </p>
        <p class="consistency-viewer__placeholder-text">
          {{ statusText }}
        </p>
      </div>
    </div>

    <div ref="viewportEl" class="consistency-viewer__viewport" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Loading, RefreshRight, View } from '@element-plus/icons-vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js'
import { getC2MColoredPlyUrl } from '@/api/c2m'
import { formatToken, getOrganizationId, getToken } from '@/utils/auth'
import { buildFusionBimWorldMatrix } from '../utils/fusionTransforms'

const props = defineProps<{
  projectId?: number | null
  scanFileId?: number | null
  bimFileId?: number | null
  transparentBackground?: boolean
  calibration?: { modelMatrix: number[] } | null
  pointcloudWorldMatrix?: number[] | null
  cameraPose?: {
    camera: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
  } | null
  annotationEnabled?: boolean
  annotationPoint?: { x: number; y: number; z: number } | null
  annotationStatus?: 'default' | 'editing' | 'saved'
  annotationPersist?: boolean
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

const emit = defineEmits<{
  'loaded-change': [boolean]
  'ready-state-change': ['pending' | 'loaded' | 'optional' | 'error']
  'annotation-pick': [
    {
      point: { x: number; y: number; z: number } | null
      screen: { x: number; y: number } | null
      source: 'consistencyResult'
      key?: string
      synced?: boolean
      componentId?: string
      componentInfo?: {
        id?: string | number
        name?: string
        type?: string
      } | null
    },
  ]
}>()

const CONSISTENCY_RESULT_NOT_FOUND_MESSAGE = '当前扫描尚未生成实模一致结果'

const viewportEl = ref<HTMLDivElement | null>(null)
const loading = ref(false)
const meshLoaded = ref(false)
const statusText = ref('等待批注模式加载实模一致结果')
const transparentBackground = computed(
  () => props.transparentBackground === true,
)

const emptyTitle = computed(() => {
  if (!props.projectId || !props.scanFileId) return '暂无扫描信息'
  if (!props.bimFileId) return '暂无 BIM 信息'
  return '暂无实模一致结果'
})

let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let resizeObserver: ResizeObserver | null = null
let animationId = 0
let currentMesh: THREE.Mesh | null = null
let currentBlobUrl: string | null = null
let latestRequestId = 0
let currentModelMaxDim = 1
let loadConsistencyPromise: Promise<void> | null = null
let annotationMarker: THREE.Group | null = null
let annotationStashGroup: THREE.Group | null = null
const annotationStashMarkerMap = new Map<string, THREE.Group>()
const annotationRaycaster = new THREE.Raycaster()
let annotationPointerId: number | null = null
let annotationPointerDown: { x: number; y: number } | null = null
let annotationPointerDragging = false

const dprCap = 1.25
const backgroundColor = '#0b1120'
const markerColors: Record<'default' | 'editing' | 'saved', number> = {
  default: 0x2f6bff,
  editing: 0xfacc15,
  saved: 0x22c55e,
}
const annotationMarkerBaseRadius = 1

const disposeObject3D = (obj: THREE.Object3D) => {
  obj.traverse((child: any) => {
    if (child?.geometry) child.geometry.dispose?.()
    const material = child?.material
    if (Array.isArray(material)) {
      material.forEach((item) => item?.dispose?.())
    } else {
      material?.dispose?.()
    }
  })
}

const resolveAnnotationStatus = (value?: string) =>
  value === 'editing' || value === 'saved' ? value : 'default'

const applyCameraPose = (
  pose?: {
    camera: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
  } | null,
) => {
  if (!pose || !camera || !controls) return false
  camera.position.set(pose.camera.x, pose.camera.y, pose.camera.z)
  controls.target.set(pose.target.x, pose.target.y, pose.target.z)
  camera.lookAt(controls.target)
  camera.updateProjectionMatrix()
  controls.update()
  renderFrame()
  return true
}

const buildAuthHeaders = () => {
  const headers = new Headers()
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

const revokeBlobUrl = () => {
  if (!currentBlobUrl) return
  URL.revokeObjectURL(currentBlobUrl)
  currentBlobUrl = null
}

const disposeMesh = () => {
  if (!currentMesh) return
  scene?.remove(currentMesh)
  currentMesh.geometry?.dispose?.()
  const material = currentMesh.material
  if (Array.isArray(material)) {
    material.forEach((item) => item?.dispose?.())
  } else {
    material?.dispose?.()
  }
  currentMesh = null
  currentModelMaxDim = 1
}

const renderFrame = () => {
  if (!renderer || !scene || !camera) return
  renderer.render(scene, camera)
}

const loadImageFromDataUrl = (url: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })

const normalizeTransparentCapture = async (dataUrl: string) => {
  if (!transparentBackground.value) return dataUrl

  const image = await loadImageFromDataUrl(dataUrl)
  if (!image) return dataUrl

  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  if (!width || !height) return dataUrl

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl

  ctx.drawImage(image, 0, 0, width, height)
  const imageData = ctx.getImageData(0, 0, width, height)
  const pixels = imageData.data
  const getOffset = (x: number, y: number) => (y * width + x) * 4
  const cornerOffsets = [
    getOffset(0, 0),
    getOffset(width - 1, 0),
    getOffset(0, height - 1),
    getOffset(width - 1, height - 1),
  ]
  const referenceColor = cornerOffsets.map((offset) => [
    pixels[offset],
    pixels[offset + 1],
    pixels[offset + 2],
    pixels[offset + 3],
  ])

  if (referenceColor.some(([, , , alpha]) => alpha < 250)) {
    return dataUrl
  }

  const [targetRed, targetGreen, targetBlue] = referenceColor[0]
  const colorTolerance = 6
  const matchesBackground = (offset: number) =>
    Math.abs(pixels[offset] - targetRed) <= colorTolerance &&
    Math.abs(pixels[offset + 1] - targetGreen) <= colorTolerance &&
    Math.abs(pixels[offset + 2] - targetBlue) <= colorTolerance &&
    pixels[offset + 3] >= 250

  if (!cornerOffsets.every((offset) => matchesBackground(offset))) {
    return dataUrl
  }

  const visited = new Uint8Array(width * height)
  const queue: number[] = []
  const enqueue = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return
    const index = y * width + x
    if (visited[index]) return
    visited[index] = 1
    const offset = index * 4
    if (!matchesBackground(offset)) return
    queue.push(index)
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0)
    enqueue(x, height - 1)
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y)
    enqueue(width - 1, y)
  }

  let changed = false
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head]
    const x = index % width
    const y = Math.floor(index / width)
    const offset = index * 4
    if (!matchesBackground(offset)) continue

    pixels[offset + 3] = 0
    changed = true

    enqueue(x - 1, y)
    enqueue(x + 1, y)
    enqueue(x, y - 1)
    enqueue(x, y + 1)
  }

  if (!changed) return dataUrl

  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

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
      camera?.position.distanceTo(marker.position) ?? 1,
      camera?.near ? camera.near * 2 : 0.1,
      0.1,
    )
    const viewportHeight = Math.max(viewportEl.value?.clientHeight || 1, 1)
    const worldUnitsPerPixel = camera
      ? (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * distance) /
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

const setAnnotationMarker = (point: THREE.Vector3 | null) => {
  if (!scene) return
  if (!point) {
    if (annotationMarker) {
      scene.remove(annotationMarker)
      disposeObject3D(annotationMarker)
      annotationMarker = null
    }
    renderFrame()
    return
  }

  if (!annotationMarker) {
    annotationMarker = buildAnnotationMarker()
    scene.add(annotationMarker)
  }
  annotationMarker.position.copy(point)
  annotationMarker.userData.worldRadius = undefined
  applyAnnotationMarkerStyle(props.annotationStatus, annotationMarker)
  applyAnnotationMarkerScale(annotationMarker, props.annotationHighlightCurrent)
  renderFrame()
}

const ensureAnnotationStashGroup = () => {
  if (!scene) return
  if (!annotationStashGroup) {
    annotationStashGroup = new THREE.Group()
    annotationStashGroup.name = 'annotation-stash-group'
    scene.add(annotationStashGroup)
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
  if (!scene) return
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
  renderFrame()
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

const getPickOffset = () => Math.max(0.005, currentModelMaxDim * 0.002)

const applyPickOffset = (point: THREE.Vector3) =>
  point
    .clone()
    .addScaledVector(annotationRaycaster.ray.direction, -getPickOffset())

const pickAnnotationPoint = (event: PointerEvent) => {
  return pickAnnotationPointFromClient(event.clientX, event.clientY)
}

const pickAnnotationPointFromClient = (clientX: number, clientY: number) => {
  if (!renderer || !camera) return null
  const rect = renderer.domElement.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  const x = ((clientX - rect.left) / rect.width) * 2 - 1
  const y = -((clientY - rect.top) / rect.height) * 2 + 1
  annotationRaycaster.setFromCamera(new THREE.Vector2(x, y), camera)

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

  if (!currentMesh) return null
  const hits = annotationRaycaster.intersectObject(currentMesh, true)
  if (hits.length <= 0) return null
  return { point: applyPickOffset(hits[0].point) }
}

const pickPointFromScreen = (clientX: number, clientY: number) => {
  const result = pickAnnotationPointFromClient(clientX, clientY)
  if (!result?.point) return null
  return {
    x: result.point.x,
    y: result.point.y,
    z: result.point.z,
    key: result.key,
    synced: result.synced,
  }
}

const handleAnnotationPointerDown = (event: PointerEvent) => {
  if (!props.annotationEnabled || !meshLoaded.value) return
  if (event.button !== 0) return
  annotationPointerDown = { x: event.clientX, y: event.clientY }
  annotationPointerDragging = false
  annotationPointerId = event.pointerId
  renderer?.domElement.setPointerCapture?.(event.pointerId)
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
    renderer?.domElement.releasePointerCapture?.(annotationPointerId)
  }
  annotationPointerId = null
  const wasDragging = annotationPointerDragging
  annotationPointerDown = null
  annotationPointerDragging = false
  if (wasDragging) return
  if (!props.annotationEnabled || !meshLoaded.value) return
  if (event.button !== 0) return

  const result = pickAnnotationPoint(event)
  if (!result) {
    if (props.annotationPersist) return
    emit('annotation-pick', {
      point: null,
      screen: { x: event.clientX, y: event.clientY },
      source: 'consistencyResult',
    })
    setAnnotationMarker(null)
    return
  }

  emit('annotation-pick', {
    point: { x: result.point.x, y: result.point.y, z: result.point.z },
    screen: { x: event.clientX, y: event.clientY },
    source: 'consistencyResult',
    key: result.key,
    synced: result.synced,
  })
  setAnnotationMarker(result.point)
}

const fitCameraToObject = (object: THREE.Object3D) => {
  if (!camera || !controls) return
  const box = new THREE.Box3().setFromObject(object)
  if (box.isEmpty()) return
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z, 1)
  const fov = THREE.MathUtils.degToRad(camera.fov)
  const distance = (maxDim / 2 / Math.tan(fov / 2)) * 1.8
  camera.position.set(center.x, center.y + maxDim * 0.2, center.z + distance)
  camera.near = Math.max(0.01, distance / 100)
  camera.far = Math.max(5000, distance * 100)
  camera.lookAt(center)
  camera.updateProjectionMatrix()
  controls.target.copy(center)
  controls.update()
  renderFrame()
}

const handleResize = () => {
  if (!viewportEl.value || !renderer || !camera) return
  const width = viewportEl.value.clientWidth || 1
  const height = viewportEl.value.clientHeight || 1
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap))
  renderer.setSize(width, height, false)
  refreshAnnotationMarkerScales()
  renderFrame()
}

const startRenderLoop = () => {
  const tick = () => {
    controls?.update()
    camera?.updateMatrixWorld()
    refreshAnnotationMarkerScales()
    renderFrame()
    animationId = window.requestAnimationFrame(tick)
  }
  animationId = window.requestAnimationFrame(tick)
}

const stopRenderLoop = () => {
  if (!animationId) return
  window.cancelAnimationFrame(animationId)
  animationId = 0
}

const ensureScene = async () => {
  if (scene || !viewportEl.value) return
  scene = new THREE.Scene()
  if (!transparentBackground.value) {
    scene.background = new THREE.Color(backgroundColor)
  }

  camera = new THREE.PerspectiveCamera(60, 1, 0.01, 10000)
  camera.position.set(0, 0.8, 3)

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: transparentBackground.value,
    preserveDrawingBuffer: true,
  })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(backgroundColor, transparentBackground.value ? 0 : 1)
  viewportEl.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = false
  renderer.domElement.addEventListener(
    'pointerdown',
    handleAnnotationPointerDown,
  )
  renderer.domElement.addEventListener(
    'pointermove',
    handleAnnotationPointerMove,
  )
  renderer.domElement.addEventListener('pointerup', handleAnnotationPointerUp)
  renderer.domElement.addEventListener(
    'pointercancel',
    handleAnnotationPointerUp,
  )

  const ambient = new THREE.AmbientLight(0xffffff, 1.2)
  const dir = new THREE.DirectionalLight(0xffffff, 0.75)
  dir.position.set(2, 3, 4)
  scene.add(ambient)
  scene.add(dir)

  resizeObserver = new ResizeObserver(() => handleResize())
  resizeObserver.observe(viewportEl.value)
  await nextTick()
  handleResize()
  startRenderLoop()
}

const fetchPlyBlobUrl = async (url: string) => {
  const resp = await fetch(url, {
    headers: buildAuthHeaders(),
    cache: 'no-store',
  })
  if (resp.status === 404) {
    throw new Error(CONSISTENCY_RESULT_NOT_FOUND_MESSAGE)
  }
  if (!resp.ok) {
    throw new Error(`加载失败 HTTP ${resp.status}`)
  }
  const blob = await resp.blob()
  return URL.createObjectURL(blob)
}

const resolveConsistencyWorldMatrix = () => {
  const pointcloudWorldMatrix = Array.isArray(props.pointcloudWorldMatrix)
    ? new THREE.Matrix4().fromArray(props.pointcloudWorldMatrix)
    : null
  return buildFusionBimWorldMatrix(
    pointcloudWorldMatrix,
    props.calibration?.modelMatrix,
  )
}

const applyMeshTransform = (mesh: THREE.Mesh, plyCenter: THREE.Vector3) => {
  const bimWorldMatrix = resolveConsistencyWorldMatrix()
  if (!bimWorldMatrix) return false
  mesh.matrixAutoUpdate = false
  mesh.matrix
    .copy(bimWorldMatrix)
    .multiply(
      new THREE.Matrix4().makeTranslation(
        plyCenter.x,
        plyCenter.y,
        plyCenter.z,
      ),
    )
  mesh.matrixWorldNeedsUpdate = true
  mesh.updateMatrixWorld(true)
  return true
}

const performLoadConsistencyResult = async () => {
  const projectId = props.projectId ?? null
  const scanFileId = props.scanFileId ?? null
  const bimFileId = props.bimFileId ?? null

  disposeMesh()
  revokeBlobUrl()
  meshLoaded.value = false
  emit('loaded-change', false)
  emit('ready-state-change', 'pending')

  if (!projectId || !scanFileId) {
    statusText.value = '当前扫描信息不完整，暂无法加载实模一致结果'
    emit('ready-state-change', 'optional')
    renderFrame()
    return
  }
  if (!bimFileId) {
    statusText.value = '当前扫描未绑定 BIM，暂无法展示实模一致结果'
    emit('ready-state-change', 'optional')
    renderFrame()
    return
  }
  if (!resolveConsistencyWorldMatrix()) {
    statusText.value = 'BIM 与点云对齐矩阵未就绪，暂无法展示实模一致结果'
    emit('ready-state-change', 'optional')
    renderFrame()
    return
  }

  const requestId = ++latestRequestId
  loading.value = true
  statusText.value = '正在请求实模一致结果 PLY...'

  try {
    await ensureScene()
    const plyUrl = getC2MColoredPlyUrl(projectId, scanFileId, bimFileId)
    const blobUrl = await fetchPlyBlobUrl(plyUrl)
    if (requestId !== latestRequestId) {
      URL.revokeObjectURL(blobUrl)
      return
    }
    currentBlobUrl = blobUrl

    statusText.value = '正在解析 PLY 模型...'
    const geometry = await new PLYLoader().loadAsync(blobUrl)
    if (requestId !== latestRequestId) {
      geometry.dispose()
      return
    }

    if (!geometry.attributes.normal) {
      geometry.computeVertexNormals()
    }
    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    let plyCenter = new THREE.Vector3()
    if (box) {
      plyCenter = box.getCenter(new THREE.Vector3())
      geometry.translate(-plyCenter.x, -plyCenter.y, -plyCenter.z)
      geometry.computeBoundingBox()
      geometry.computeBoundingSphere()
    }

    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geometry, material)
    const transformed = applyMeshTransform(mesh, plyCenter)
    if (!transformed) {
      geometry.dispose()
      material.dispose()
      throw new Error('BIM 与点云对齐矩阵未就绪，无法定位实模一致结果')
    }

    currentMesh = mesh
    scene?.add(mesh)
    const meshBox = new THREE.Box3().setFromObject(mesh)
    if (!meshBox.isEmpty()) {
      const meshSize = meshBox.getSize(new THREE.Vector3())
      currentModelMaxDim = Math.max(meshSize.x, meshSize.y, meshSize.z, 1)
    }
    meshLoaded.value = true
    emit('loaded-change', true)
    emit('ready-state-change', 'loaded')
    statusText.value = `已加载 ${geometry.attributes.position.count.toLocaleString()} 个顶点`
    if (!applyCameraPose(props.cameraPose)) {
      fitCameraToObject(mesh)
    }
    refreshAnnotationMarkerScales()
  } catch (error) {
    if (requestId !== latestRequestId) return
    emit('loaded-change', false)
    emit(
      'ready-state-change',
      error instanceof Error &&
        error.message === CONSISTENCY_RESULT_NOT_FOUND_MESSAGE
        ? 'optional'
        : 'error',
    )
    statusText.value =
      error instanceof Error ? error.message : '实模一致结果加载失败'
  } finally {
    if (requestId === latestRequestId) {
      loading.value = false
      renderFrame()
    }
  }
}

const loadConsistencyResult = async () => {
  if (loadConsistencyPromise) return loadConsistencyPromise
  loadConsistencyPromise = (async () => {
    try {
      await performLoadConsistencyResult()
    } finally {
      loadConsistencyPromise = null
    }
  })()
  return loadConsistencyPromise
}

const reload = () => {
  void loadConsistencyResult()
}

const forceCaptureDataUrl = async () => {
  await ensureScene()

  if (loadConsistencyPromise) {
    await loadConsistencyPromise
  } else if (
    !meshLoaded.value &&
    props.projectId &&
    props.scanFileId &&
    props.bimFileId &&
    resolveConsistencyWorldMatrix()
  ) {
    await loadConsistencyResult()
  }

  await nextTick()
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })

  if (!renderer || !scene || !camera) return null

  if (
    !meshLoaded.value &&
    !annotationMarker &&
    !annotationStashMarkerMap.size
  ) {
    return null
  }

  const previousBackground = scene.background
  const previousClearAlpha = renderer.getClearAlpha()
  const previousClearColor = renderer.getClearColor(new THREE.Color())

  try {
    if (transparentBackground.value) {
      scene.background = null
      renderer.setClearColor(previousClearColor, 0)
      renderer.clear(true, true, true)
    }

    renderer.render(scene, camera)
    const gl = renderer.getContext()
    try {
      const pixel = new Uint8Array(4)
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
    } catch {
      // ignore readPixels failures
    }

    const dataUrl = await normalizeTransparentCapture(
      renderer.domElement.toDataURL('image/png'),
    )
    return {
      dataUrl,
      rect: renderer.domElement.getBoundingClientRect(),
    }
  } catch {
    return null
  } finally {
    if (transparentBackground.value && renderer && scene) {
      scene.background = previousBackground
      renderer.setClearColor(previousClearColor, previousClearAlpha)
      renderFrame()
    }
  }
}

const getCameraPose = () => {
  if (!camera || !controls) return null
  return {
    camera: {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    },
    target: {
      x: controls.target.x,
      y: controls.target.y,
      z: controls.target.z,
    },
  }
}

const setCameraPose = (
  pose?: {
    camera: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
  } | null,
) => {
  applyCameraPose(pose)
}

watch(
  () => [
    props.projectId,
    props.scanFileId,
    props.bimFileId,
    JSON.stringify(props.calibration?.modelMatrix ?? null),
    JSON.stringify(props.pointcloudWorldMatrix ?? null),
  ],
  () => {
    void loadConsistencyResult()
  },
)

watch(
  () => props.cameraPose,
  (pose) => {
    if (!meshLoaded.value) return
    applyCameraPose(pose)
  },
  { deep: true },
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
    renderFrame()
  },
  { immediate: true },
)

watch(
  () => props.annotationHighlightCurrent,
  (highlighted) => {
    applyAnnotationMarkerScale(annotationMarker, highlighted)
    renderFrame()
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
    renderFrame()
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

onMounted(() => {
  void ensureScene().then(() => {
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
    void loadConsistencyResult()
  })
})

onBeforeUnmount(() => {
  latestRequestId += 1
  stopRenderLoop()
  resizeObserver?.disconnect()
  resizeObserver = null
  if (renderer?.domElement) {
    renderer.domElement.removeEventListener(
      'pointerdown',
      handleAnnotationPointerDown,
    )
    renderer.domElement.removeEventListener(
      'pointermove',
      handleAnnotationPointerMove,
    )
    renderer.domElement.removeEventListener(
      'pointerup',
      handleAnnotationPointerUp,
    )
    renderer.domElement.removeEventListener(
      'pointercancel',
      handleAnnotationPointerUp,
    )
  }
  controls?.dispose()
  controls = null
  if (annotationMarker && scene) {
    scene.remove(annotationMarker)
    disposeObject3D(annotationMarker)
    annotationMarker = null
  }
  if (annotationStashGroup && scene) {
    for (const marker of annotationStashMarkerMap.values()) {
      annotationStashGroup.remove(marker)
      disposeObject3D(marker)
    }
    annotationStashMarkerMap.clear()
    scene.remove(annotationStashGroup)
    annotationStashGroup = null
  }
  disposeMesh()
  revokeBlobUrl()
  if (renderer) {
    renderer.dispose()
    renderer.domElement.parentElement?.removeChild(renderer.domElement)
  }
  renderer = null
  camera = null
  scene = null
})

defineExpose({
  getCameraPose,
  setCameraPose,
  pickPointFromScreen,
  getAnnotationMarkerPosition: () => {
    if (!annotationMarker) return null
    return {
      x: annotationMarker.position.x,
      y: annotationMarker.position.y,
      z: annotationMarker.position.z,
    }
  },
  forceCaptureDataUrl,
})
</script>

<style scoped>
.consistency-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  background:
    radial-gradient(
      circle at top left,
      rgba(34, 197, 94, 0.16),
      transparent 36%
    ),
    radial-gradient(
      circle at bottom right,
      rgba(59, 130, 246, 0.14),
      transparent 34%
    ),
    linear-gradient(180deg, #0f172a 0%, #111827 100%);
}

.consistency-viewer--transparent {
  background: transparent;
}

.panel-refresh-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 3;
  width: 34px;
  height: 34px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.84);
  color: #e5eef7;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.panel-refresh-btn:hover:not(:disabled) {
  border-color: rgba(56, 189, 248, 0.58);
  color: #fff;
}

.panel-refresh-btn:disabled {
  cursor: wait;
  opacity: 0.65;
}

.consistency-viewer__viewport {
  width: 100%;
  height: 100%;
}

.consistency-viewer__placeholder {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  pointer-events: none;
}

.consistency-viewer__placeholder-card {
  width: min(100%, 340px);
  padding: 28px 24px;
  border: 1px dashed rgba(148, 163, 184, 0.32);
  border-radius: 20px;
  background: rgba(15, 23, 42, 0.5);
  text-align: center;
  backdrop-filter: blur(8px);
}

.consistency-viewer__placeholder-icon {
  margin-bottom: 12px;
  font-size: 26px;
  color: #93c5fd;
}

.consistency-viewer__placeholder-icon.is-loading {
  animation: consistency-spin 1s linear infinite;
}

.consistency-viewer__placeholder-title {
  margin: 0 0 10px;
  font-size: 16px;
  font-weight: 600;
  color: #f8fafc;
}

.consistency-viewer__placeholder-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: rgba(226, 232, 240, 0.78);
}

@keyframes consistency-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
