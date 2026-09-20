<template>
  <div class="bim-view-panel">
    <div class="panel-header">
      <div class="panel-title-wrap">
        <span class="panel-title">BIM模型视图</span>
        <el-button size="small" @click="emit('sync-view')">
          {{ props.syncActive ? '退出' : '同步' }}
        </el-button>
      </div>
      <div class="panel-controls">
        <template v-if="isPresetMode">
          <span class="panel-hint">{{ bimStatusText }}</span>
        </template>
        <template v-else>
          <input
            ref="bimFileInputEl"
            class="bim-file-input"
            type="file"
            accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
            @change="onBimFileChange"
          />
          <el-button type="primary" size="small" @click="openBimFilePicker">
            导入 glTF/GLB
          </el-button>
        </template>
      </div>
    </div>

    <div v-if="!bimModelLoaded" class="empty-placeholder">
      <div class="placeholder-content">
        <el-icon class="placeholder-icon"><View /></el-icon>
        <p class="placeholder-text" style="color: #fff">{{ bimStatusText }}</p>
      </div>
    </div>
    <div ref="bimViewportEl" class="bim-viewport" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { View } from '@element-plus/icons-vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import type { TrajectoryPoint } from '@/api/calibration'
import { getIfcGlbFile } from '@/api/fileManage'

type Calibration = {
  modelMatrix: number[]
}

type CameraPose = { camera: THREE.Vector3; target: THREE.Vector3 }

const toRigidMatrix = (matrix: THREE.Matrix4) => {
  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  matrix.decompose(pos, quat, new THREE.Vector3())
  return new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 1, 1))
}

const props = defineProps<{
  isPresetMode: boolean
  syncActive: boolean
  calibration?: Calibration | null
}>()

const emit = defineEmits<{
  (e: 'loaded-change', value: boolean): void
  (e: 'sync-view'): void
  (e: 'camera-change', pose: CameraPose): void
}>()

const bimFileInputEl = ref<HTMLInputElement | null>(null)
const bimViewportEl = ref<HTMLDivElement | null>(null)
const bimStatusText = ref('等待导入 glTF/GLB...')
const bimModelLoaded = ref(false)

let bimScene: THREE.Scene | null = null
let bimCamera: THREE.PerspectiveCamera | null = null
let bimRenderer: THREE.WebGLRenderer | null = null
let bimControls: OrbitControls | null = null
let bimModelRoot: THREE.Object3D | null = null
const bimModelCenter = new THREE.Vector3()
let bimModelMaxDim = 1
let animationId = 0
let resizeObserver: ResizeObserver | null = null
const tilesetZUpRotationX = -Math.PI / 2
const tilesetZUpQuat = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  tilesetZUpRotationX,
)

const disposeObject3D = (obj: THREE.Object3D) => {
  obj.traverse((child: any) => {
    if (child?.geometry) child.geometry.dispose?.()
    const material = child?.material
    if (Array.isArray(material)) material.forEach((m) => m?.dispose?.())
    else material?.dispose?.()
  })
}

const emitCameraPoseChange = () => {
  if (!bimCamera || !bimControls) return
  emit('camera-change', {
    camera: bimCamera.position.clone(),
    target: bimControls.target.clone(),
  })
}

const requestRender = () => {
  if (animationId) return
  animationId = requestAnimationFrame(() => {
    animationId = 0
    if (!bimRenderer || !bimScene || !bimCamera) return

    try {
      if (bimViewportEl.value) {
        syncRendererSize(bimRenderer, bimCamera, bimViewportEl.value)
      }
      bimRenderer.render(bimScene, bimCamera)
    } catch (error) {
      console.error('[Result] BIM渲染失败:', error)
    }
  })
}

const onControlsChange = () => {
  emitCameraPoseChange()
  requestRender()
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

  const fov = THREE.MathUtils.degToRad(camera.fov)
  const distance = maxDim / 2 / Math.tan(fov / 2)

  controls.target.copy(center)
  camera.position.set(
    center.x,
    center.y + maxDim * 0.15,
    center.z + distance * 2.2,
  )
  camera.near = Math.max(0.01, distance / 100)
  camera.far = Math.max(5000, distance * 100)
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

const syncRendererSize = (
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  containerEl: HTMLElement,
) => {
  const rect = containerEl.getBoundingClientRect()
  const w = Math.max(1, Math.floor(rect.width || 1))
  const h = Math.max(1, Math.floor(rect.height || 1))
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const cw = Math.floor(w * dpr)
  const ch = Math.floor(h * dpr)
  if (renderer.domElement.width === cw && renderer.domElement.height === ch)
    return

  renderer.setPixelRatio(dpr)
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

const initBimViewer = () => {
  if (!bimViewportEl.value || bimRenderer) return

  bimScene = new THREE.Scene()
  bimScene.background = new THREE.Color(0x0f0f0f)

  const w = bimViewportEl.value.clientWidth || 1
  const h = bimViewportEl.value.clientHeight || 1
  bimCamera = new THREE.PerspectiveCamera(55, w / h, 0.1, 5000)
  bimCamera.position.set(3, 2, 5)

  bimRenderer = new THREE.WebGLRenderer({ antialias: true })
  bimRenderer.setPixelRatio(window.devicePixelRatio)
  bimRenderer.setSize(w, h)
  bimViewportEl.value.appendChild(bimRenderer.domElement)

  bimControls = new OrbitControls(bimCamera, bimRenderer.domElement)
  bimControls.enableDamping = false
  bimControls.addEventListener('change', onControlsChange)

  const ambient = new THREE.AmbientLight(0xffffff, 0.6)
  const dir = new THREE.DirectionalLight(0xffffff, 0.8)
  dir.position.set(10, 10, 10)
  bimScene.add(ambient, dir)
}

const createCenteredPivot = (root: THREE.Object3D) => {
  const box = new THREE.Box3().setFromObject(root)
  const center = box.getCenter(new THREE.Vector3())

  const pivot = new THREE.Group()
  pivot.userData = pivot.userData ?? {}
  pivot.userData.__viewerNormalizationCenter = center.clone()

  root.position.sub(center)
  pivot.add(root)
  pivot.updateMatrixWorld?.(true)

  return pivot
}

const updateBimModelMetrics = () => {
  if (!bimModelRoot) return
  bimModelRoot.updateMatrixWorld?.(true)

  const box = new THREE.Box3().setFromObject(bimModelRoot)
  if (box.isEmpty()) {
    bimModelCenter.set(0, 0, 0)
    bimModelMaxDim = 1
    return
  }

  const size = box.getSize(new THREE.Vector3())
  bimModelCenter.copy(box.getCenter(new THREE.Vector3()))
  bimModelMaxDim = Math.max(size.x, size.y, size.z) || 1
}

const buildBimPointcloudTransform = (params?: Calibration | null) => {
  if (!Array.isArray(params?.modelMatrix) || params.modelMatrix.length !== 16) {
    return null
  }
  return toRigidMatrix(new THREE.Matrix4().fromArray(params.modelMatrix))
}

const applyCalibrationToBimModel = (options?: { refitCamera?: boolean }) => {
  if (!bimModelRoot) return false

  bimModelRoot.position.set(0, 0, 0)
  bimModelRoot.quaternion.identity()
  bimModelRoot.scale.set(1, 1, 1)

  const center = bimModelRoot.userData?.__viewerNormalizationCenter as
    | THREE.Vector3
    | undefined
  const transform = buildBimPointcloudTransform(props.calibration)

  if (center && transform) {
    // 把 BIM 放到点云结果页当前使用的显示坐标系里，而不是只用矩阵做相机换算。
    const localMatrix = new THREE.Matrix4()
      .makeRotationFromQuaternion(tilesetZUpQuat)
      .multiply(transform.clone().invert())
      .multiply(
        new THREE.Matrix4().makeTranslation(center.x, center.y, center.z),
      )

    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    localMatrix.decompose(pos, quat, scale)
    bimModelRoot.position.copy(pos)
    bimModelRoot.quaternion.copy(quat)
    bimModelRoot.scale.set(1, 1, 1)
  }

  bimModelRoot.updateMatrixWorld?.(true)
  updateBimModelMetrics()

  if (options?.refitCamera && bimCamera && bimControls) {
    fitCameraToObject(bimCamera, bimControls, bimModelRoot)
    setTopView(bimCamera, bimControls, bimModelCenter, bimModelMaxDim * 1.2)
  }

  requestRender()

  return true
}

const loadBimBlob = async (blob: Blob, name: string) => {
  initBimViewer()
  if (!bimScene || !bimCamera || !bimControls) return

  const displayName = name || 'BIM模型'
  bimStatusText.value = `加载中：${displayName}`
  bimModelLoaded.value = false

  const url = URL.createObjectURL(blob)
  const loader = new GLTFLoader()
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('/draco/')
  loader.setDRACOLoader(dracoLoader)

  loader.load(
    url,
    (gltf) => {
      URL.revokeObjectURL(url)
      dracoLoader.dispose()

      if (!bimScene || !bimCamera || !bimControls) return
      if (bimModelRoot) {
        bimScene.remove(bimModelRoot)
        disposeObject3D(bimModelRoot)
      }

      bimModelRoot = createCenteredPivot(gltf.scene)
      bimScene.add(bimModelRoot)
      applyCalibrationToBimModel({ refitCamera: true })
      bimModelLoaded.value = true
      bimStatusText.value = `已加载：${displayName}`
      requestRender()
    },
    undefined,
    (err) => {
      URL.revokeObjectURL(url)
      dracoLoader.dispose()
      console.error(err)
      bimStatusText.value = `加载失败：${displayName}`
      bimModelLoaded.value = false
    },
  )
}

const loadBimFile = async (file: File) => {
  await loadBimBlob(file, file.name)
}

const loadBimByFileId = async (
  projectId: number,
  fileId: number | null,
  displayName?: string,
) => {
  if (!fileId) {
    bimStatusText.value = '未选择BIM模型'
    bimModelLoaded.value = false
    return
  }

  try {
    bimStatusText.value = '加载BIM模型中...'
    const blob = await getIfcGlbFile(projectId, fileId)
    await loadBimBlob(blob, displayName || `BIM-${fileId}`)
  } catch (error: any) {
    console.error('加载BIM模型失败:', error)
    bimStatusText.value = error?.message || 'BIM模型加载失败'
    bimModelLoaded.value = false
  }
}

const openBimFilePicker = () => {
  bimFileInputEl.value?.click()
}

const onBimFileChange = (ev: Event) => {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  void loadBimFile(file)
  input.value = ''
}

const getPointcloudLocalFromTrajectory = (point: TrajectoryPoint) => {
  return new THREE.Vector3(point.x, point.y, point.z)
}

const syncFromTrajectory = (
  point: TrajectoryPoint,
  calibration: Calibration | null,
  _pointcloudWorldMatrix: THREE.Matrix4 | null,
) => {
  if (!bimModelLoaded.value) return
  if (!bimCamera || !bimControls) return
  if (!calibration) return
  const lookDistance = 5

  const yaw = point.yaw || 0
  const yawRad = THREE.MathUtils.degToRad(yaw)

  const pcLocal = getPointcloudLocalFromTrajectory(point)
  const dirLocal = new THREE.Vector3(
    Math.cos(yawRad),
    Math.sin(yawRad),
    0,
  ).normalize()
  const pcLookAtLocal = pcLocal.clone().addScaledVector(dirLocal, lookDistance)
  const pcCameraPosLocal = pcLocal
    .clone()
    .addScaledVector(dirLocal, -lookDistance * 1.5)

  const bimLookAt = pcLookAtLocal.clone().applyQuaternion(tilesetZUpQuat)
  const bimCameraPos = pcCameraPosLocal.clone().applyQuaternion(tilesetZUpQuat)

  bimCamera.position.copy(bimCameraPos)
  bimCamera.lookAt(bimLookAt)
  bimControls.target.copy(bimLookAt)
  bimCamera.updateMatrixWorld()
  requestRender()
}

const syncFromPointcloudPose = (
  pose: CameraPose | null,
  calibration: Calibration | null,
  _pointcloudWorldMatrix: THREE.Matrix4 | null,
) => {
  if (!bimModelLoaded.value) return
  if (!bimCamera || !bimControls) return
  if (!calibration || !pose) return

  bimCamera.position.copy(pose.camera)
  bimCamera.lookAt(pose.target)
  bimControls.target.copy(pose.target)
  bimCamera.updateMatrixWorld()
  requestRender()
}

const setStatusText = (text: string) => {
  bimStatusText.value = text
}

const getCameraPose = () => {
  if (!bimCamera || !bimControls) return null
  return {
    camera: bimCamera.position.clone(),
    target: bimControls.target.clone(),
  }
}

const getModelCenter = () => ({
  x: bimModelCenter.x,
  y: bimModelCenter.y,
  z: bimModelCenter.z,
})

const getModelWorldMatrix = () => {
  if (!bimModelRoot) return null
  bimModelRoot.updateMatrixWorld?.(true)
  return bimModelRoot.matrixWorld.clone()
}

const cleanup = () => {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = 0
  }

  resizeObserver?.disconnect?.()
  resizeObserver = null

  if (bimModelRoot && bimScene) {
    bimScene.remove(bimModelRoot)
    disposeObject3D(bimModelRoot)
    bimModelRoot = null
  }
  bimModelCenter.set(0, 0, 0)
  bimModelMaxDim = 1

  bimControls?.removeEventListener?.('change', onControlsChange)
  bimControls?.dispose?.()

  if (bimRenderer) {
    bimRenderer.dispose()
    if (bimRenderer.domElement?.parentElement) {
      bimRenderer.domElement.parentElement.removeChild(bimRenderer.domElement)
    }
  }

  bimScene = null
  bimCamera = null
  bimRenderer = null
  bimControls = null
}

watch(
  () => bimModelLoaded.value,
  (value) => emit('loaded-change', value),
)

watch(
  () => props.calibration,
  () => {
    if (!bimModelRoot) return
    applyCalibrationToBimModel({ refitCamera: true })
  },
  { deep: true },
)

onMounted(() => {
  initBimViewer()
  if (
    !resizeObserver &&
    typeof ResizeObserver !== 'undefined' &&
    bimViewportEl.value
  ) {
    resizeObserver = new ResizeObserver(() => {
      if (bimRenderer && bimCamera && bimViewportEl.value) {
        syncRendererSize(bimRenderer, bimCamera, bimViewportEl.value)
        requestRender()
      }
    })
    resizeObserver.observe(bimViewportEl.value)
  }
  requestRender()
})

onBeforeUnmount(() => {
  cleanup()
})

defineExpose({
  loadBimBlob,
  loadBimByFileId,
  getCameraPose,
  getModelCenter,
  getModelWorldMatrix,
  syncFromTrajectory,
  syncFromPointcloudPose,
  setStatusText,
  cleanup,
})
</script>
