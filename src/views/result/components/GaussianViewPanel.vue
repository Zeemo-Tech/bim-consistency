<template>
  <div class="gaussian-result-panel viewer-shell">
    <div class="panel-header">
      <span class="panel-title">高斯模型视图</span>
      <div class="panel-controls">
        <el-tooltip
          :content="firstPersonActive ? '退出第一人称' : '进入第一人称'"
          placement="top"
        >
          <el-button
            size="small"
            :icon="User"
            circle
            :class="{ 'is-first-person-active': firstPersonActive }"
            @click="handleToggleFirstPerson"
          />
        </el-tooltip>
        <el-tooltip content="重置视角" placement="top">
          <el-button
            size="small"
            :icon="RefreshLeft"
            circle
            @click="handleResetView"
          />
        </el-tooltip>
      </div>
    </div>

    <div class="panel-body">
      <GaussianViewerSimple
        ref="gaussianViewerRef"
        class="panel-viewer"
        :project-id="props.projectId"
        :gauss-file-id="props.gaussFileId"
        :gauss-asset-path="props.gaussAssetPath"
        :current-image-info="props.currentImageInfo"
        :current-trajectory-point="props.currentTrajectoryPoint"
        :panorama-camera-rot="panoramaCameraRot"
        :panorama-fov="panoramaFov"
        :rotation-lock="false"
        @loaded-change="handleLoadedChange"
        @camera-change="handleCameraChange"
        @error="emit('error')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RefreshLeft, User } from '@element-plus/icons-vue'
import type { TrajectoryPoint } from '@/api/calibration'
import GaussianViewerSimple from '@/views/twoScreen/components/GaussianViewerSimple.vue'

const props = defineProps<{
  projectId: number | null
  gaussFileId: number | null
  gaussAssetPath: string
  currentTrajectoryPoint?: TrajectoryPoint | null
  currentImageInfo: any
}>()

const emit = defineEmits<{
  (e: 'loaded-change', value: boolean): void
  (e: 'error'): void
  (e: 'camera-change', value: { lon: number; lat: number }): void
}>()

const gaussianViewerRef = ref<InstanceType<typeof GaussianViewerSimple> | null>(
  null,
)
const firstPersonActive = ref(false)
const panoramaCameraRot = ref({ lon: 0, lat: 0 })
const panoramaFov = ref<number | null>(null)

const handleLoadedChange = (value: boolean) => {
  emit('loaded-change', value)
}

const handleCameraChange = (value: { lon: number; lat: number }) => {
  emit('camera-change', value)
}

const handleToggleFirstPerson = () => {
  gaussianViewerRef.value?.toggleFirstPersonMode?.()
  firstPersonActive.value =
    gaussianViewerRef.value?.isFirstPersonActive?.() ?? false
}

const handleResetView = () => {
  if (props.currentTrajectoryPoint) {
    gaussianViewerRef.value?.syncFromTrajectory?.(props.currentTrajectoryPoint)
    return
  }
  gaussianViewerRef.value?.reloadModel?.()
}

defineExpose({
  init: () => gaussianViewerRef.value?.init?.(),
  reloadModel: () => gaussianViewerRef.value?.reloadModel?.(),
  syncFromTrajectory: (point: TrajectoryPoint) =>
    gaussianViewerRef.value?.syncFromTrajectory?.(point),
  cleanup: () => gaussianViewerRef.value?.cleanup?.(),
  getCameraPose: () => gaussianViewerRef.value?.getCameraPose?.() ?? null,
  getCameraOrientation: () =>
    gaussianViewerRef.value?.getCameraOrientation?.() ?? null,
  setCameraPose: (pose: { camera: any; target: any } | null) =>
    gaussianViewerRef.value?.setCameraPose?.(pose),
  syncFromPanoramaRotation: (rot: { lon: number; lat: number }) =>
    gaussianViewerRef.value?.syncFromPanoramaRotation?.(rot),
})
</script>

<style scoped>
.viewer-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.panel-body {
  position: relative;
  flex: 1;
  min-height: 0;
}

.panel-viewer {
  width: 100%;
  height: 100%;
}

:deep(.panel-viewer > .gaussian-view-panel) {
  position: relative;
  width: 100%;
  height: 100%;
}

:deep(.panel-viewer > .gaussian-view-panel > .gaussian-container) {
  inset: 0;
  width: 100%;
  height: 100%;
}

:deep(.panel-viewer > .panel-actions) {
  display: none;
}

:deep(.panel-viewer > .panel-header) {
  display: none;
}
</style>
