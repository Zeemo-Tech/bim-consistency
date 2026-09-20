<template>
  <el-dialog
    v-model="visible"
    :title="`3D坐标校准 - ${scanData.title || '场地现状测量'}`"
    width="650px"
    :close-on-click-modal="false"
    class="calibration-dialog"
    @close="handleClose"
  >
    <!-- 扫描信息头部 -->
    <div class="scan-info-header">
      <span class="info-item">
        扫描日期：{{ scanData.date || '2025-11-05' }}
      </span>
      <span class="divider">|</span>
      <span class="info-item">
        当前所属幢：{{ pointCloudBuildingName || '未设置' }}
      </span>
    </div>

    <div class="calibration-content">
      <!-- 步骤1: BIM模型与点云校准 -->
      <div
        ref="bimStepEl"
        class="calibration-step"
        :class="{
          completed: bimCalibrationCompleted,
          active: currentStep === 'bim',
        }"
      >
        <div class="step-header">
          <el-icon
            class="step-icon"
            :class="{
              success: bimCalibrationCompleted,
              loading: calibratingBIM,
            }"
          >
            <component
              :is="
                bimCalibrationCompleted
                  ? SuccessFilled
                  : calibratingBIM
                    ? Loading
                    : Loading
              "
            />
          </el-icon>
          <div class="step-title-wrapper">
            <span class="step-title">步骤1：BIM模型与点云校准</span>
            <el-tag
              v-if="bimCalibrationCompleted"
              type="success"
              size="small"
              effect="plain"
              class="status-tag"
            >
              已完成
            </el-tag>
          </div>
        </div>

        <div class="step-description">
          对BIM模型和点云数据进行3D坐标校准，确保两者在空间中正确锚对齐（重新校准会覆盖当前绑定）
        </div>
        <div class="file-mapping">
          <div class="file-item bim-file">
            <el-icon class="file-icon"><Box /></el-icon>
            <div class="file-info">
              <div class="file-label">BIM:</div>
              <div class="file-name">{{ bimFileName }}</div>
            </div>
          </div>

          <el-icon class="arrow-icon" :size="20"><Right /></el-icon>

          <div class="file-item pointcloud-file">
            <el-icon class="file-icon"><Histogram /></el-icon>
            <div class="file-info">
              <div class="file-label">点云:</div>
              <div class="file-name">{{ pointCloudFileName }}</div>
            </div>
          </div>
        </div>

        <div class="gauss-selection">
          <div class="selection-label">高斯模型:</div>
          <el-select
            v-model="selectedGaussId"
            size="small"
            filterable
            placeholder="请选择高斯模型"
            style="width: 100%"
            :disabled="gaussOptions.length === 0"
          >
            <el-option
              v-for="item in gaussOptions"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
          <div
            v-if="gaussOptions.length === 0"
            class="selection-tip selection-tip--warning"
          >
            当前点云所属幢层下暂无可用高斯模型
          </div>
        </div>

        <div v-if="bimCalibrationCompleted && !isDeleted" class="step-action">
          <el-button
            plain
            size="default"
            :disabled="false"
            @click="handleRecalibrateBIM"
          >
            重新校准
          </el-button>
        </div>
        <div v-else class="step-action">
          <el-button
            type="primary"
            size="default"
            :loading="calibratingBIM"
            @click="handleStartBIMCalibration"
          >
            {{ calibratingBIM ? '校准中...' : '开始校准' }}
          </el-button>
        </div>
      </div>

      <!-- 步骤2: CAD图纸与巡检轨迹校准 -->
      <div
        ref="cadStepEl"
        class="calibration-step"
        :class="{
          disabled: !isCadStepEnabled,
          completed: cadCalibrationCompleted,
          active: currentStep === 'cad',
        }"
      >
        <div class="step-header">
          <el-icon
            class="step-icon"
            :class="{
              success: cadCalibrationCompleted,
              disabled: !bimCalibrationCompleted && !cadCalibrationCompleted,
              loading:
                bimCalibrationCompleted &&
                !cadCalibrationCompleted &&
                calibratingCAD,
            }"
          >
            <component
              :is="
                cadCalibrationCompleted
                  ? SuccessFilled
                  : bimCalibrationCompleted && !calibratingCAD
                    ? Loading
                    : !bimCalibrationCompleted
                      ? CircleClose
                      : Loading
              "
            />
          </el-icon>
          <div class="step-title-wrapper">
            <span class="step-title">步骤2：CAD图纸与巡检轨迹校准</span>
            <el-tag
              v-if="cadCalibrationCompleted"
              type="success"
              size="small"
              effect="plain"
              class="status-tag"
            >
              已完成
            </el-tag>
          </div>
        </div>

        <div class="step-description">
          基础CAD图纸与巡检轨迹进行2D平面校准（重新校准会覆盖当前绑定）
        </div>

        <div class="cad-selection">
          <div class="selection-label">CAD 图纸:</div>
          <el-select
            v-model="selectedCadId"
            size="small"
            filterable
            placeholder="请选择 CAD 图纸"
            style="width: 100%"
            :disabled="!isCadStepEnabled"
          >
            <el-option
              v-for="item in cadOptions"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
          <div v-if="selectedBimBuildingName" class="selection-tip">
            当前 BIM 所属幢为“{{ selectedBimBuildingName }}”，下拉仅展示同幢 CAD
            图纸供选择
          </div>
          <div
            v-if="isCadStepEnabled && cadOptions.length === 0"
            class="selection-tip selection-tip--warning"
          >
            当前 BIM 所属幢下暂无可用 CAD 图纸，请先上传同幢 CAD 文件
          </div>
        </div>

        <div v-if="cadCalibrationCompleted && !isDeleted" class="step-action">
          <el-button
            plain
            size="default"
            :disabled="!isCadStepEnabled"
            @click="handleRecalibrateCAD"
          >
            重新校准
          </el-button>
        </div>
        <div v-else class="step-action">
          <el-button
            type="primary"
            size="default"
            plain
            :disabled="!isCadStepEnabled"
            :loading="calibratingCAD"
            @click="handleStartCADCalibration"
          >
            {{ calibratingCAD ? '校准中...' : '开始CAD校准' }}
          </el-button>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button
          type="primary"
          :disabled="!bimCalibrationCompleted || !cadCalibrationCompleted"
          @click="handleComplete"
        >
          完成校准
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { nextTick, ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  SuccessFilled,
  Loading,
  CircleClose,
  Box,
  Histogram,
  Right,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

/**
 * 扫描数据类型定义
 */
export interface ScanData {
  id: string
  title: string
  date?: string
  uploader?: string
  projectId?: string
  projectName?: string
  pointCloudBuildingName?: string | null
  pointCloudFloorName?: string | null
  bimFileId?: string
  bimFile?: string
  cadFileId?: string
  cadFile?: string
  gaussFileId?: string
  gaussFile?: string
  gaussAssetPath?: string
  pointCloudFile?: string
}

/**
 * BIM文件类型定义
 */
interface BIMFile {
  id: string
  name: string
  buildingName?: string | null
  floorName?: string | null
}

/**
 * CAD文件类型定义
 */
interface CADFile {
  id: string
  name: string
  buildingName?: string | null
  floorName?: string | null
}

/**
 * 高斯模型类型定义
 */
interface GaussFile {
  id: string
  name: string
  buildingName?: string | null
  floorName?: string | null
}

/**
 * 组件属性定义
 */
interface Props {
  modelValue?: boolean
  scanData?: ScanData
  bimList?: BIMFile[]
  cadList?: CADFile[]
  gaussList?: GaussFile[]
  isDeleted?: boolean
}

/**
 * 组件事件定义
 */
interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (
    e: 'complete',
    data: {
      scanId: string
      bimId: string
      bimName: string
      cadId: string
      cadName: string
      gaussId: string
      gaussName: string
    },
  ): void
  (e: 'calibrateBIM', scanId: string): void
  (e: 'calibrateCAD', data: { scanId: string; cadId: string }): void
  (
    e: 'selection-change',
    data: {
      bimId: string
      bimName: string
      cadId: string
      cadName: string
      gaussId: string
      gaussName: string
    },
  ): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  scanData: () => ({
    id: '',
    title: '场地现状测量',
    date: '2025-11-05',
    uploader: '张强',
  }),
  bimList: () => [],
  cadList: () => [],
  gaussList: () => [],
  isDeleted: false,
})

const emit = defineEmits<Emits>()

/**
 * 路由实例
 */
const router = useRouter()

const currentStep = ref<'bim' | 'cad'>('bim')
const bimStepEl = ref<HTMLElement | null>(null)
const cadStepEl = ref<HTMLElement | null>(null)

const scrollToStep = async (step: 'bim' | 'cad') => {
  await nextTick()
  const el = step === 'bim' ? bimStepEl.value : cadStepEl.value
  el?.scrollIntoView({ block: 'start' })
}

/**
 * 弹窗显示状态
 */
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const hasStoredBimAlignment = ref(false)
const hasStoredCadAlignment = ref(false)
const alignedBimId = ref('')
const alignedCadId = ref('')

/**
 * BIM校准中状态
 */
const calibratingBIM = ref(false)

/**
 * CAD校准中状态
 */
const calibratingCAD = ref(false)

const isDeleted = computed(() => props.isDeleted ?? false)
const isCadStepEnabled = computed(
  () => bimCalibrationCompleted.value && !isDeleted.value,
)

/**
 * 当前项目 BIM 列表
 */
const bimList = computed(() => props.bimList || [])

/**
 * 当前项目 CAD 列表
 */
const cadList = computed(() => props.cadList || [])

const selectedBim = computed(
  () => bimList.value.find((item) => item.id === selectedBimId.value) || null,
)

const selectedBimBuildingName = computed(
  () => selectedBim.value?.buildingName || '',
)

const bimSelectionMatchesAligned = computed(() => {
  if (!alignedBimId.value) return false
  return selectedBimId.value === alignedBimId.value
})

const cadSelectionMatchesAligned = computed(() => {
  if (!alignedCadId.value) return false
  return selectedCadId.value === alignedCadId.value
})

/**
 * BIM校准完成状态
 */
const bimCalibrationCompleted = computed(
  () => hasStoredBimAlignment.value && bimSelectionMatchesAligned.value,
)

/**
 * CAD校准完成状态
 */
const cadCalibrationCompleted = computed(
  () =>
    hasStoredCadAlignment.value &&
    bimSelectionMatchesAligned.value &&
    cadSelectionMatchesAligned.value,
)

const sameBuildingCadList = computed(() => {
  const currentBuilding = selectedBimBuildingName.value
  if (!currentBuilding) return cadList.value
  return cadList.value.filter((item) => item.buildingName === currentBuilding)
})

const cadOptions = computed(() => sameBuildingCadList.value)

/**
 * 当前项目 高斯列表
 */
const pointCloudBuildingName = computed(() =>
  String(props.scanData?.pointCloudBuildingName || '').trim(),
)

const pointCloudFloorName = computed(() =>
  String(props.scanData?.pointCloudFloorName || '').trim(),
)

const gaussList = computed(() => props.gaussList || [])

const gaussOptions = computed(() => {
  const buildingName = pointCloudBuildingName.value
  const floorName = pointCloudFloorName.value
  if (!buildingName || !floorName) return gaussList.value
  return gaussList.value.filter(
    (item) =>
      String(item.buildingName || '').trim() === buildingName &&
      String(item.floorName || '').trim() === floorName,
  )
})

/**
 * BIM文件名称
 */
const selectedBimId = ref('')

const syncBimSelection = () => {
  const list = bimList.value
  const desired = props.scanData?.bimFileId || ''
  if (desired && list.some((item) => item.id === desired)) {
    selectedBimId.value = desired
    return
  }
  if (
    selectedBimId.value &&
    list.some((item) => item.id === selectedBimId.value)
  ) {
    return
  }
  selectedBimId.value = list[0]?.id || ''
}

const bimFileName = computed(() => {
  const list = bimList.value
  if (selectedBimId.value) {
    const matched = list.find((item) => item.id === selectedBimId.value)
    if (matched) return matched.name
  }
  if (props.scanData?.bimFile) return props.scanData.bimFile
  if (list.length === 1) return list[0].name
  if (list.length === 0) return '暂无 BIM 模型'
  return '未选择 BIM 模型'
})

/**
 * CAD文件名称
 */
const selectedCadId = ref('')

const syncCadSelection = () => {
  const list = cadOptions.value
  const desired = props.scanData?.cadFileId || ''
  if (desired && list.some((item) => item.id === desired)) {
    selectedCadId.value = desired
    return
  }
  if (
    selectedCadId.value &&
    list.some((item) => item.id === selectedCadId.value)
  ) {
    return
  }
  selectedCadId.value = list[0]?.id || ''
}

const cadFileName = computed(() => {
  const list = cadOptions.value
  if (selectedCadId.value) {
    const matched = list.find((item) => item.id === selectedCadId.value)
    if (matched) return matched.name
  }
  if (props.scanData?.cadFile) return props.scanData.cadFile
  if (list.length === 1) return list[0].name
  if (list.length === 0) return '暂无 CAD 图纸'
  return '未选择 CAD 图纸'
})

const ensureCadSelectionMatchesBim = (showMessage = false) => {
  const list = cadOptions.value
  if (
    selectedCadId.value &&
    list.some((item) => item.id === selectedCadId.value)
  ) {
    return
  }

  const currentFloor = props.scanData?.pointCloudFloorName || ''
  const preferredCad =
    (currentFloor
      ? list.find((item) => item.floorName === currentFloor)
      : undefined) || list[0]

  const previousCadId = selectedCadId.value
  selectedCadId.value = preferredCad?.id || ''
  if (showMessage && previousCadId && previousCadId !== selectedCadId.value) {
    ElMessage.warning('已按当前 BIM 所属幢重置 CAD 图纸选项')
  }
}

/**
 * 高斯模型名称
 */
const selectedGaussId = ref('')

const syncGaussSelection = () => {
  const list = gaussOptions.value
  const desired = props.scanData?.gaussFileId || ''
  if (desired && list.some((item) => item.id === desired)) {
    selectedGaussId.value = desired
    return
  }
  if (
    selectedGaussId.value &&
    list.some((item) => item.id === selectedGaussId.value)
  ) {
    return
  }
  selectedGaussId.value = ''
}

const gaussFileName = computed(() => {
  const list = gaussOptions.value
  if (selectedGaussId.value) {
    const matched = list.find((item) => item.id === selectedGaussId.value)
    if (matched) return matched.name
  }
  if (
    props.scanData?.gaussFile &&
    props.scanData?.gaussFileId &&
    list.some((item) => item.id === props.scanData?.gaussFileId)
  ) {
    return props.scanData.gaussFile
  }
  if (list.length === 1) return list[0].name
  if (list.length === 0) return '暂无高斯模型'
  return '未选择高斯模型'
})

/**
 * 点云文件名称
 */
const pointCloudFileName = computed(() => {
  return props.scanData?.pointCloudFile || '—'
})

const lastEmittedSelectionKey = ref('')

const buildSelectionPayload = () => ({
  bimId: selectedBimId.value,
  bimName: bimFileName.value,
  cadId: selectedCadId.value,
  cadName: cadFileName.value,
  gaussId: selectedGaussId.value,
  gaussName: gaussFileName.value,
})

const emitSelectionChange = (force = false) => {
  const payload = buildSelectionPayload()
  const selectionKey = JSON.stringify(payload)
  if (!force && selectionKey === lastEmittedSelectionKey.value) {
    return
  }
  lastEmittedSelectionKey.value = selectionKey

  emit('selection-change', payload)
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) {
      lastEmittedSelectionKey.value = ''
      return
    }

    syncBimSelection()
    syncCadSelection()
    syncGaussSelection()
    emitSelectionChange(true)
  },
  { immediate: true },
)

watch(
  () => [props.scanData?.bimFileId, props.bimList],
  () => {
    if (!props.modelValue) return
    syncBimSelection()
    ensureCadSelectionMatchesBim()
    emitSelectionChange()
  },
)

watch(
  () => [props.scanData?.cadFileId, props.cadList],
  () => {
    if (!props.modelValue) return
    syncCadSelection()
    ensureCadSelectionMatchesBim()
    emitSelectionChange()
  },
)

watch(
  () => [
    props.scanData?.gaussFileId,
    props.gaussList,
    props.scanData?.pointCloudBuildingName,
    props.scanData?.pointCloudFloorName,
  ],
  () => {
    if (!props.modelValue) return
    syncGaussSelection()
    emitSelectionChange()
  },
)

watch(
  () => selectedBimId.value,
  (newVal, oldVal) => {
    if (!props.modelValue || !oldVal || !newVal || newVal === oldVal) return
    ensureCadSelectionMatchesBim(true)
    emitSelectionChange()
  },
)

watch(
  () => selectedCadId.value,
  (newVal, oldVal) => {
    if (!props.modelValue || newVal === oldVal) return
    emitSelectionChange()
  },
)

watch(
  () => selectedGaussId.value,
  (newVal, oldVal) => {
    if (!props.modelValue || newVal === oldVal) return
    emitSelectionChange()
  },
)

/**
 * 处理开始BIM校准
 */
const handleStartBIMCalibration = async () => {
  ensureCadSelectionMatchesBim()
  emitSelectionChange()
  calibratingBIM.value = true
  emit('calibrateBIM', props.scanData.id)

  try {
    const returnTo = router.currentRoute.value.fullPath
    currentStep.value = 'bim'
    // 跳转到 BIM-点云校准页面（/alignment/model）
    await router.push({
      name: 'AlignmentModel',
      query: {
        projectId: props.scanData.projectId || '',
        projectName: props.scanData.projectName || '',
        scanId: props.scanData.id,
        title: props.scanData.title,
        date: props.scanData.date || '2025-11-05',
        uploader: props.scanData.uploader || '张强',
        bimId: selectedBimId.value,
        bimName: bimFileName.value,
        cadId: selectedCadId.value,
        cadName: cadFileName.value,
        gaussId: selectedGaussId.value,
        gaussName: gaussFileName.value,
        gaussAssetPath: props.scanData.gaussAssetPath || 'meta.lcc',
        pointCloudName: pointCloudFileName.value,
        step: 'bim',
        returnTo,
      },
    })
  } finally {
    calibratingBIM.value = false
  }
}

/**
 * 处理重新校准BIM
 */
const handleRecalibrateBIM = () => {
  hasStoredBimAlignment.value = false
  hasStoredCadAlignment.value = false
  alignedBimId.value = ''
  alignedCadId.value = ''
  currentStep.value = 'bim'
  void scrollToStep('bim')
}

/**
 * 处理重新校准CAD
 */
const handleRecalibrateCAD = () => {
  hasStoredCadAlignment.value = false
  alignedCadId.value = ''
  currentStep.value = 'cad'
  void scrollToStep('cad')
}

/**
 * 处理开始CAD校准
 */
const handleStartCADCalibration = async () => {
  if (!bimCalibrationCompleted.value) {
    ElMessage.warning('请先完成BIM模型与点云校准')
    return
  }

  if (cadList.value.length === 0) {
    ElMessage.warning('该项目暂无 CAD 图纸，无法开始 CAD 校准')
    return
  }
  if (sameBuildingCadList.value.length === 0) {
    ElMessage.warning('当前 BIM 所属幢下暂无可用 CAD 图纸，请选择同幢文件')
    return
  }
  if (!selectedCadId.value) {
    ElMessage.warning('请选择与 BIM 同幢的 CAD 图纸')
    return
  }

  calibratingCAD.value = true
  currentStep.value = 'cad'
  emit('calibrateCAD', {
    scanId: props.scanData.id,
    cadId: selectedCadId.value,
  })

  try {
    const returnTo = router.currentRoute.value.fullPath
    await router.push({
      name: 'DrawingCalibration',
      query: {
        projectId: props.scanData.projectId || '',
        projectName: props.scanData.projectName || '',
        scanId: props.scanData.id,
        cadId: selectedCadId.value,
        cadName: cadFileName.value,
        title: props.scanData.title,
        date: props.scanData.date || '2025-11-05',
        uploader: props.scanData.uploader || '张强',
        bimId: selectedBimId.value,
        bimName: bimFileName.value,
        gaussId: selectedGaussId.value,
        gaussName: gaussFileName.value,
        gaussAssetPath: props.scanData.gaussAssetPath || 'meta.lcc',
        pointCloudName: pointCloudFileName.value,
        step: 'cad',
        returnTo,
      },
    })
  } finally {
    calibratingCAD.value = false
  }
}

/**
 * 处理完成校准
 */
const handleComplete = () => {
  if (!bimCalibrationCompleted.value || !cadCalibrationCompleted.value) {
    ElMessage.warning('请完成所有校准步骤')
    return
  }

  emit('complete', {
    scanId: props.scanData.id,
    bimId: selectedBimId.value,
    bimName: bimFileName.value,
    cadId: selectedCadId.value,
    cadName: cadFileName.value,
    gaussId: selectedGaussId.value,
    gaussName: gaussFileName.value,
  })

  ElMessage.success('3D坐标校准已完成')
  handleClose()
}

/**
 * 处理关闭弹窗
 */
const handleClose = () => {
  selectedGaussId.value = ''
  visible.value = false
}

/**
 * 重置校准状态
 */
const resetCalibration = () => {
  hasStoredBimAlignment.value = false
  hasStoredCadAlignment.value = false
  alignedBimId.value = ''
  alignedCadId.value = ''
  calibratingBIM.value = false
  calibratingCAD.value = false
  currentStep.value = 'bim'
  syncBimSelection()
  syncCadSelection()
  syncGaussSelection()
  emitSelectionChange(true)
}

const setBimCalibrationCompleted = (value: boolean) => {
  hasStoredBimAlignment.value = value
  alignedBimId.value = value
    ? selectedBimId.value || props.scanData?.bimFileId || ''
    : ''
  calibratingBIM.value = false
  if (!value) {
    hasStoredCadAlignment.value = false
    alignedCadId.value = ''
    calibratingCAD.value = false
    currentStep.value = 'bim'
    void scrollToStep('bim')
  } else {
    currentStep.value = 'cad'
    void scrollToStep('cad')
  }
}

const setCadCalibrationCompleted = (value: boolean) => {
  hasStoredCadAlignment.value = value
  alignedCadId.value = value
    ? selectedCadId.value || props.scanData?.cadFileId || ''
    : ''
  calibratingCAD.value = false
  if (value) {
    currentStep.value = 'cad'
    void scrollToStep('cad')
  }
}

const goToStep = (step: 'bim' | 'cad') => {
  currentStep.value = step
  void scrollToStep(step)
}

defineExpose({
  resetCalibration,
  setBimCalibrationCompleted,
  setCadCalibrationCompleted,
  goToStep,
})
</script>

<style lang="scss" scoped>
.calibration-dialog {
  :deep(.el-dialog__header) {
    border-bottom: 1px solid #e4e7ed;
    padding: 20px;
  }

  :deep(.el-dialog__body) {
    padding: 0;
  }

  :deep(.el-dialog__footer) {
    border-top: 1px solid #e4e7ed;
  }
}

.scan-info-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;

  .info-item {
    font-size: 13px;
    color: #606266;
  }

  .divider {
    color: #dcdfe6;
  }
}

.calibration-content {
  padding: 20px;
}

.calibration-step {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  transition: all 0.3s ease;

  &:last-child {
    margin-bottom: 0;
  }

  &.completed {
    background: #f0f9ff;
    border-color: #b3e0ff;
  }

  &.active {
    border-color: #409eff;
    box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.15);
  }

  &.disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .step-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;

    .step-icon {
      font-size: 24px;
      color: #909399;
      flex-shrink: 0;
      transition: all 0.3s ease;

      &.success {
        color: #67c23a;
      }

      &.loading {
        color: #e6a23c;
        animation: rotate 2s linear infinite;
      }

      &.disabled {
        color: #c0c4cc;
      }

      @keyframes rotate {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
    }

    .step-title-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;

      .step-title {
        font-size: 15px;
        font-weight: 600;
        color: #303133;
      }

      .status-tag {
        font-size: 12px;
      }
    }
  }

  .step-description {
    font-size: 13px;
    color: #606266;
    line-height: 1.6;
    margin-bottom: 16px;
    padding-left: 36px;
  }

  .file-mapping {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
    padding: 16px;
    background: #fafafa;
    border-radius: 8px;

    .file-item {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      background: #fff;
      border: 1px solid #e4e7ed;
      border-radius: 6px;

      .file-icon {
        font-size: 20px;
        flex-shrink: 0;
      }

      &.bim-file .file-icon {
        color: #409eff;
      }

      &.pointcloud-file .file-icon {
        color: #e6a23c;
      }

      .file-info {
        flex: 1;
        min-width: 0;

        .file-label {
          font-size: 11px;
          color: #909399;
          margin-bottom: 2px;
        }

        .file-name {
          font-size: 12px;
          color: #303133;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }

    .arrow-icon {
      color: #909399;
      flex-shrink: 0;
    }
  }

  .cad-selection {
    margin-bottom: 16px;
    padding-left: 36px;

    .selection-label {
      font-size: 13px;
      color: #606266;
      margin-bottom: 8px;
    }

    .selection-tip {
      margin-top: 8px;
      font-size: 12px;
      line-height: 1.5;
      color: #909399;
    }

    .selection-tip--warning {
      color: #e6a23c;
    }
  }

  .gauss-selection {
    margin-bottom: 16px;
    padding-left: 36px;

    .selection-label {
      font-size: 13px;
      color: #606266;
      margin-bottom: 8px;
    }

    .selection-tip {
      margin-top: 8px;
      font-size: 12px;
      line-height: 1.5;
      color: #909399;
    }

    .selection-tip--warning {
      color: #e6a23c;
    }
  }

  .step-action {
    padding-left: 36px;

    .el-button {
      min-width: 120px;
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
