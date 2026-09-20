<template>
  <div class="bim-view-panel viewer-shell">
    <div class="panel-header">
      <span class="panel-title">BIM模型视图</span>
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
            @click="viewerRef?.toggleFirstPersonMode?.()"
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
      <BimViewer
        ref="viewerRef"
        class="panel-viewer"
        :is-preset-mode="isPresetMode"
        :show-internal-controls="false"
        :click-to-enter-first-person="false"
        :calibration="calibration"
        :pointcloud-world-matrix="pointcloudWorldMatrix"
        @loaded-change="(value) => emit('loaded-change', value)"
        @camera-change="(value) => emit('camera-change', value)"
        @first-person-change="(value) => (firstPersonActive = value)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RefreshLeft, User } from '@element-plus/icons-vue'
import type { TrajectoryPoint } from '@/api/calibration'
import BimViewer from '../../twoScreen/components/BimViewer.vue'
import { buildGaussianTrajectoryYUpPose } from '../../twoScreen/utils/fusionTransforms'

type Calibration = {
  modelMatrix: number[]
} | null

const props = defineProps<{
  isPresetMode: boolean
  calibration?: Calibration
  pointcloudWorldMatrix?: number[] | null
  currentTrajectoryPoint?: TrajectoryPoint | null
}>()

const emit = defineEmits<{
  (e: 'loaded-change', value: boolean): void
  (e: 'camera-change', value: { lon: number; lat: number }): void
}>()

const viewerRef = ref<InstanceType<typeof BimViewer> | null>(null)
const firstPersonActive = ref(false)

const setStatusText = (text: string) => {
  viewerRef.value?.setStatusText?.(text)
}

const handleResetView = () => {
  if (props.currentTrajectoryPoint) {
    const pose = buildGaussianTrajectoryYUpPose(props.currentTrajectoryPoint)
    viewerRef.value?.setCameraPose?.(pose)
    return
  }
  viewerRef.value?.resetView?.()
}

defineExpose({
  loadBimByFileId: (
    ...args: Parameters<InstanceType<typeof BimViewer>['loadBimByFileId']>
  ) => viewerRef.value?.loadBimByFileId?.(...args),
  syncFromPanoramaFov: (
    ...args: Parameters<InstanceType<typeof BimViewer>['syncFromPanoramaFov']>
  ) => viewerRef.value?.syncFromPanoramaFov?.(...args),
  syncFromPanoramaRotation: (
    ...args: Parameters<
      InstanceType<typeof BimViewer>['syncFromPanoramaRotation']
    >
  ) => viewerRef.value?.syncFromPanoramaRotation?.(...args),
  syncFromTrajectory: (
    ...args: Parameters<InstanceType<typeof BimViewer>['syncFromTrajectory']>
  ) => viewerRef.value?.syncFromTrajectory?.(...args),
  setCameraPose: (
    ...args: Parameters<InstanceType<typeof BimViewer>['setCameraPose']>
  ) => viewerRef.value?.setCameraPose?.(...args),
  getCameraOrientation: () => viewerRef.value?.getCameraOrientation?.() ?? null,
  setStatusText,
  enterFirstPersonMode: () => viewerRef.value?.enterFirstPersonMode?.(),
  exitFirstPersonMode: () => viewerRef.value?.exitFirstPersonMode?.(),
  toggleFirstPersonMode: () => viewerRef.value?.toggleFirstPersonMode?.(),
  isFirstPersonActive: () => viewerRef.value?.isFirstPersonActive?.() ?? false,
  getModelWorldMatrix: () => viewerRef.value?.getModelWorldMatrix?.() ?? null,
  cleanup: () => viewerRef.value?.cleanup?.(),
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

:deep(.panel-viewer > .panel-refresh-btn) {
  display: none;
}

:deep(.panel-viewer > .panel-actions) {
  display: none;
}
</style>
