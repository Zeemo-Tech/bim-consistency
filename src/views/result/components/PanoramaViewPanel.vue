<template>
  <div class="panorama-view-panel">
    <div class="panel-header">
      <span class="panel-title">全景图视图</span>
    </div>

    <div v-if="!currentImageUrl" class="empty-placeholder">
      <div class="placeholder-content">
        <el-icon class="placeholder-icon"><Picture /></el-icon>
        <p class="placeholder-text">点击图纸轨迹查看全景图</p>
      </div>
    </div>

    <div ref="panoramaContainer" class="panorama-container" />
  </div>
</template>

<script setup lang="ts">
import {
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  markRaw,
  nextTick,
  computed,
} from 'vue'
import { ElMessage } from 'element-plus'
import { Picture } from '@element-plus/icons-vue'
import * as THREE from 'three'
import { getTrajectoryImage, type TrajectoryPoint } from '@/api/calibration'
import { resolveTrajectoryHeadingDegrees } from '@/utils/trajectoryOrientation'

const props = defineProps<{
  projectId: number | null
  scanFileId: number | null
}>()

const emit = defineEmits<{
  (e: 'image-info-change', value: any | null): void
  (e: 'panorama-rot-change', value: { lon: number; lat: number }): void
  (e: 'panorama-fov-change', value: number): void
}>()

const panoramaContainer = ref<HTMLDivElement | null>(null)
const currentImageUrl = ref<string>('')
const currentImageInfo = ref<any>(null)
const imageCache = new Map<string, string>()
const RAW_TARGET_DEGREES = -90

let destroyed = false
let panoramaAnimationId = 0
let panoramaRenderQueued = false
let panoramaResizeObserver: ResizeObserver | null = null

const panoramaViewer = shallowRef<{
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  sphere: THREE.Mesh
  texture: THREE.Texture | null
} | null>(null)
const panoramaMouseDown = ref(false)
const panoramaMousePos = ref({ x: 0, y: 0 })
const panoramaCameraRot = ref({ lon: 0, lat: 0 })
const currentYawDegrees = computed(() =>
  resolveTrajectoryHeadingDegrees(currentImageInfo.value ?? {}),
)

const emitRotation = () => {
  emit('panorama-rot-change', { ...panoramaCameraRot.value })
}

const emitFov = () => {
  if (!panoramaViewer.value) return
  emit('panorama-fov-change', panoramaViewer.value.camera.fov)
}

const showTrajectoryImage = async (point: TrajectoryPoint) => {
  if (destroyed) return
  if (!point?.imageName) return
  if (!props.projectId || !props.scanFileId) return

  const key = String(point.imageName)
  const resolvedHeadingDegrees = resolveTrajectoryHeadingDegrees(point)
  currentImageInfo.value = {
    timestamp: point.timestamp,
    imageName: point.imageName,
    yaw: resolvedHeadingDegrees,
    x: point.x,
    y: point.y,
    qx: point.qx,
    qy: point.qy,
    qz: point.qz,
    qw: point.qw,
    point,
  }
  emit('image-info-change', currentImageInfo.value)

  const currentYaw = resolvedHeadingDegrees

  try {
    let imageUrl: string

    if (imageCache.has(key)) {
      imageUrl = imageCache.get(key)!
    } else {
      const res = await getTrajectoryImage(
        props.projectId,
        props.scanFileId,
        point.imageName,
      )

      if (destroyed) return

      if (res.code === 200 && res.data?.dataUrl) {
        imageCache.set(key, res.data.dataUrl)
        imageUrl = res.data.dataUrl
      } else {
        throw new Error('加载图片失败')
      }
    }

    currentImageUrl.value = imageUrl

    if (!panoramaViewer.value) {
      await nextTick()
      initPanoramaViewer()
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    await loadPanoramaImage(imageUrl, currentYaw)
  } catch (error: any) {
    console.error('加载图片失败:', error)
    ElMessage.error(error?.message || '加载图片失败')
  }
}

const initPanoramaViewer = () => {
  if (destroyed || !panoramaContainer.value || panoramaViewer.value) {
    return
  }
  const container = panoramaContainer.value
  const width = container.clientWidth || 800
  const height = container.clientHeight || 600

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(55, width / height, 1, 1100)
  camera.position.set(0, 0, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  container.appendChild(renderer.domElement)

  const geometry = new THREE.SphereGeometry(500, 60, 40)
  geometry.scale(-1, 1, 1)

  const material = new THREE.MeshBasicMaterial({
    side: THREE.FrontSide,
  })
  const sphere = new THREE.Mesh(geometry, material)
  scene.add(sphere)

  panoramaViewer.value = markRaw({
    scene,
    camera,
    renderer,
    sphere,
    texture: null,
  })

  setupPanoramaControls()
  setupPanoramaResizeObserver()
  updatePanoramaCamera()
  emitFov()
  schedulePanoramaRender()
}

const schedulePanoramaRender = () => {
  if (destroyed || !panoramaViewer.value) return
  if (panoramaRenderQueued) return

  panoramaRenderQueued = true
  panoramaAnimationId = requestAnimationFrame(() => {
    panoramaRenderQueued = false
    panoramaAnimationId = 0
    if (destroyed || !panoramaViewer.value) return
    syncRendererSize()
    const viewer = panoramaViewer.value
    viewer.renderer.render(viewer.scene, viewer.camera)
  })
}

const setupPanoramaResizeObserver = () => {
  if (!panoramaContainer.value || panoramaResizeObserver) return
  if (typeof ResizeObserver === 'undefined') return

  panoramaResizeObserver = new ResizeObserver(() => {
    schedulePanoramaRender()
  })
  panoramaResizeObserver.observe(panoramaContainer.value)
}

const setupPanoramaControls = () => {
  if (!panoramaContainer.value) return

  const container = panoramaContainer.value

  const onMouseDown = (event: MouseEvent) => {
    panoramaMouseDown.value = true
    panoramaMousePos.value = { x: event.clientX, y: event.clientY }
  }

  const onMouseMove = (event: MouseEvent) => {
    if (!panoramaMouseDown.value) return

    const deltaX = event.clientX - panoramaMousePos.value.x
    const deltaY = event.clientY - panoramaMousePos.value.y

    panoramaMousePos.value = { x: event.clientX, y: event.clientY }

    panoramaCameraRot.value.lon += deltaX * 0.2
    panoramaCameraRot.value.lat -= deltaY * 0.2

    panoramaCameraRot.value.lat = Math.max(
      -85,
      Math.min(85, panoramaCameraRot.value.lat),
    )

    updatePanoramaCamera()
    emitRotation()
    schedulePanoramaRender()
  }

  const onMouseUp = () => {
    panoramaMouseDown.value = false
  }

  const onMouseLeave = () => {
    panoramaMouseDown.value = false
  }

  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    if (!panoramaViewer.value) return

    const delta = event.deltaY > 0 ? 5 : -5
    const camera = panoramaViewer.value.camera
    const newFov = Math.max(30, Math.min(120, camera.fov + delta))
    camera.fov = newFov
    camera.updateProjectionMatrix()
    emit('panorama-fov-change', newFov)
    schedulePanoramaRender()
  }

  container.addEventListener('mousedown', onMouseDown)
  container.addEventListener('mousemove', onMouseMove)
  container.addEventListener('mouseup', onMouseUp)
  container.addEventListener('mouseleave', onMouseLeave)
  container.addEventListener('wheel', onWheel, { passive: false })

  const cleanup = () => {
    container.removeEventListener('mousedown', onMouseDown)
    container.removeEventListener('mousemove', onMouseMove)
    container.removeEventListener('mouseup', onMouseUp)
    container.removeEventListener('mouseleave', onMouseLeave)
    container.removeEventListener('wheel', onWheel)
  }

  onBeforeUnmount(cleanup)
}

const updatePanoramaCamera = () => {
  if (!panoramaViewer.value) return

  const phi = THREE.MathUtils.degToRad(90 - panoramaCameraRot.value.lat)
  const theta = THREE.MathUtils.degToRad(panoramaCameraRot.value.lon)

  const camera = panoramaViewer.value.camera
  const target = new THREE.Vector3(
    500 * Math.sin(phi) * Math.cos(theta),
    500 * Math.cos(phi),
    500 * Math.sin(phi) * Math.sin(theta),
  )
  camera.lookAt(target)
  schedulePanoramaRender()
}

const syncFromRotation = (rot: { lon: number; lat: number } | null) => {
  if (!rot) return
  panoramaCameraRot.value = {
    lon: rot.lon,
    lat: Math.max(-85, Math.min(85, rot.lat)),
  }
  updatePanoramaCamera()
  schedulePanoramaRender()
}

const alignPanoramaToHeading = (headingDegrees: number) => {
  if (!panoramaViewer.value) return
  const offsetDegrees = RAW_TARGET_DEGREES - headingDegrees
  const sphereRotY = THREE.MathUtils.degToRad(headingDegrees + offsetDegrees)
  panoramaViewer.value.sphere.rotation.y = sphereRotY
  panoramaCameraRot.value = { lon: 0, lat: 0 }
  updatePanoramaCamera()
  emitRotation()
}

const loadPanoramaImage = async (imageUrl: string, yaw: number = 0) => {
  if (destroyed) return

  if (!panoramaViewer.value) {
    let attempts = 0
    while (!panoramaContainer.value && attempts < 20) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      attempts++
    }

    if (panoramaContainer.value) {
      initPanoramaViewer()
      await new Promise((resolve) => setTimeout(resolve, 100))
    } else {
      console.error('容器未找到，无法初始化查看器')
      return
    }
  }

  if (!panoramaViewer.value || destroyed) {
    console.error('查看器初始化失败')
    return
  }

  const img = new Image()
  img.crossOrigin = 'anonymous'

  img.onload = () => {
    if (destroyed || !panoramaViewer.value) {
      return
    }

    const maxSize = panoramaViewer.value.renderer.capabilities.maxTextureSize

    let finalImage = img

    if (img.width > maxSize || img.height > maxSize) {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!

      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
      canvas.width = Math.floor(img.width * scale)
      canvas.height = Math.floor(img.height * scale)

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      finalImage = canvas as any
    }

    const texture = new THREE.Texture(finalImage)
    texture.needsUpdate = true
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = false
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping

    if (panoramaViewer.value.texture) {
      panoramaViewer.value.texture.dispose()
    }

    const rawTexture = markRaw(texture)
    panoramaViewer.value.texture = rawTexture
    const material = panoramaViewer.value.sphere
      .material as THREE.MeshBasicMaterial
    material.map = rawTexture
    material.needsUpdate = true

    alignPanoramaToHeading(yaw)
    schedulePanoramaRender()
  }

  img.onerror = (error) => {
    console.error('加载全景图片失败:', error)
  }

  img.src = imageUrl
}

const syncRendererSize = () => {
  if (!panoramaViewer.value || !panoramaContainer.value) return
  const rect = panoramaContainer.value.getBoundingClientRect()
  const w = Math.max(1, Math.floor(rect.width || 1))
  const h = Math.max(1, Math.floor(rect.height || 1))
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const cw = Math.floor(w * dpr)
  const ch = Math.floor(h * dpr)
  const renderer = panoramaViewer.value.renderer
  if (renderer.domElement.width === cw && renderer.domElement.height === ch) {
    return
  }
  renderer.setPixelRatio(dpr)
  renderer.setSize(w, h)
  panoramaViewer.value.camera.aspect = w / h
  panoramaViewer.value.camera.updateProjectionMatrix()
}

const cleanupPanoramaViewer = () => {
  if (!panoramaViewer.value) return

  if (panoramaAnimationId) {
    cancelAnimationFrame(panoramaAnimationId)
    panoramaAnimationId = 0
  }
  panoramaRenderQueued = false
  panoramaResizeObserver?.disconnect?.()
  panoramaResizeObserver = null

  try {
    if (panoramaViewer.value.texture) {
      panoramaViewer.value.texture.dispose()
    }

    panoramaViewer.value.sphere.geometry.dispose()
    ;(panoramaViewer.value.sphere.material as THREE.Material).dispose()

    panoramaViewer.value.renderer.dispose()

    if (panoramaContainer.value) {
      panoramaContainer.value.innerHTML = ''
    }

    panoramaViewer.value = null
  } catch (error) {
    console.error('清理全景查看器失败:', error)
  }

  imageCache.clear()
}

const clearImage = () => {
  currentImageUrl.value = ''
  currentImageInfo.value = null
  emit('image-info-change', null)
  panoramaCameraRot.value = { lon: 0, lat: 0 }
  emitRotation()
}

const resetPanoramaView = () => {
  if (!currentImageInfo.value) {
    panoramaCameraRot.value = { lon: 0, lat: 0 }
    updatePanoramaCamera()
    emitRotation()
    schedulePanoramaRender()
    return
  }

  alignPanoramaToHeading(currentYawDegrees.value)
  schedulePanoramaRender()
}

const setFov = (fov: number) => {
  if (!panoramaViewer.value) return
  const clamped = Math.max(30, Math.min(120, fov))
  panoramaViewer.value.camera.fov = clamped
  panoramaViewer.value.camera.updateProjectionMatrix()
  emit('panorama-fov-change', clamped)
  schedulePanoramaRender()
}

onBeforeUnmount(() => {
  destroyed = true
  cleanupPanoramaViewer()
})

onMounted(() => {
  destroyed = false
})

defineExpose({
  showTrajectoryImage,
  clearImage,
  setFov,
  syncFromRotation,
  resetPanoramaView,
  cleanup: cleanupPanoramaViewer,
})
</script>
