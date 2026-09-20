<template>
  <div class="two-screen-header">
    <div class="header-left">
      <el-button class="back-button" circle @click="handleBack">
        <el-icon><ArrowLeft /></el-icon>
      </el-button>
      <span class="project-name">{{ projectName }}</span>
    </div>
    <div class="header-right">
      <div v-if="showBuildingFloor" class="building-floor-group">
        <div class="building-floor-item">
          <el-select
            :model-value="buildingValue"
            class="building-floor-select"
            placeholder="选择幢"
            :disabled="buildingDisabled"
            @change="handleBuildingChange"
          >
            <template #prefix>
              <el-icon class="building-floor-icon"><OfficeBuilding /></el-icon>
            </template>
            <el-option
              v-for="option in buildingOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
              :disabled="option.disabled"
            />
          </el-select>
        </div>
        <div class="building-floor-item">
          <el-select
            :model-value="floorValue"
            class="building-floor-select is-floor"
            placeholder="选择楼层"
            :disabled="floorDisabled"
            @change="handleFloorChange"
          >
            <template #prefix>
              <el-icon class="building-floor-icon"><House /></el-icon>
            </template>
            <el-option
              v-for="option in floorOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
              :disabled="option.disabled"
            />
          </el-select>
        </div>
      </div>
      <div class="demo-date-picker">
        <div class="block">
          <el-date-picker
            v-model="value"
            type="daterange"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            :default-time="defaultTime"
          />
        </div>
      </div>
      <el-popover
        v-if="showAnnotationList"
        v-model:visible="annotationListVisible"
        trigger="click"
        placement="bottom"
        width="460"
        popper-class="annotation-list-popover"
      >
        <template #reference>
          <el-button class="annotation-list-btn" plain>
            <el-icon><Document /></el-icon>
            批注列表
            <span class="annotation-count">{{ annotationItems.length }}</span>
          </el-button>
        </template>
        <div class="annotation-list">
          <div class="annotation-list-toolbar">
            <div class="annotation-toolbar-left">
              <span class="annotation-list-summary">
                已保存 {{ annotationItems.length }} 条，当前
                {{ filteredAnnotationItems.length }} 条
              </span>
              <el-checkbox
                class="annotation-select-all"
                :model-value="isAllGenerateSelected"
                :indeterminate="isGenerateIndeterminate"
                :disabled="filteredAnnotationItems.length === 0"
                @change="handleToggleGenerateSelectAll"
              >
                全选
              </el-checkbox>
              <el-checkbox
                v-model="highRiskOnly"
                class="annotation-high-risk-only"
              >
                仅高风险
              </el-checkbox>
            </div>
            <div class="annotation-toolbar-actions">
              <el-button
                class="annotation-invite-btn"
                size="small"
                type="primary"
                plain
                :disabled="annotationItems.length === 0"
                @click.stop="handleAnnotationInviteClick"
              >
                邀请成员查看
              </el-button>
              <el-button
                size="small"
                type="primary"
                :disabled="
                  !canGenerateReport ||
                  selectedGenerateKeysForAction.length === 0
                "
                @click.stop="handleGenerateReportClick"
              >
                生成报告({{ selectedGenerateKeysForAction.length }})
              </el-button>
            </div>
          </div>
          <div
            v-if="annotationItems.length === 0"
            class="annotation-list-empty"
          >
            暂无已保存批注
          </div>
          <div
            v-else-if="filteredAnnotationItems.length === 0"
            class="annotation-list-empty"
          >
            当前筛选暂无批注
          </div>
          <div
            v-for="item in filteredAnnotationItems"
            :key="item.key"
            class="annotation-list-item"
            :class="{ 'is-selected': item.key === selectedAnnotationKey }"
            role="button"
            tabindex="0"
            @click="emit('annotation-select', item.key)"
            @keydown.enter.prevent="emit('annotation-select', item.key)"
            @keydown.space.prevent="emit('annotation-select', item.key)"
          >
            <div class="annotation-list-item-check" @click.stop>
              <el-checkbox
                :model-value="isAnnotationSelectedForGenerate(item.key)"
                @change="
                  (value) =>
                    handleGenerateSelectChange(item.key, Boolean(value))
                "
              />
            </div>
            <div class="annotation-card-left">
              <div class="annotation-card-top">
                <button
                  class="annotation-card-title"
                  type="button"
                  @click.stop="openDetail(item)"
                  @keydown.enter.prevent="openDetail(item)"
                  @keydown.space.prevent="openDetail(item)"
                >
                  {{ item.title }}
                </button>
                <div class="annotation-card-right">
                  <div
                    class="annotation-status-pill"
                    :class="severityClass(item.severity)"
                  >
                    <span class="annotation-status-dot" />
                    {{ severityLabel(item.severity) }}
                  </div>
                </div>
              </div>
              <div class="annotation-card-fields">
                <div class="annotation-card-field">
                  <span class="annotation-field-label">标注时间</span>
                  <span class="annotation-field-value">
                    {{ formatAnnotationTime(item.period) }}
                  </span>
                </div>
                <div class="annotation-card-field">
                  <span class="annotation-field-label">整改周期</span>
                  <span class="annotation-field-value">
                    {{ formatPeriod(item.period) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-popover>
      <el-button
        class="reset-latest-btn"
        type="primary"
        plain
        :icon="RefreshRight"
        @click="emit('reset-latest')"
      >
        最近一次
      </el-button>
    </div>
  </div>
  <el-dialog
    v-model="detailVisible"
    class="annotation-detail-dialog"
    width="520px"
  >
    <template #header>
      <div class="annotation-detail-header">
        <div class="annotation-detail-title">
          {{ detailItem?.title ?? '批注详情' }}
        </div>
        <div class="annotation-detail-tags">
          <span class="annotation-detail-pill">
            {{ sourceLabel(detailItem?.source) }}
          </span>
          <span class="annotation-detail-pill">
            {{ severityLabel(detailItem?.severity) }}
          </span>
        </div>
      </div>
    </template>
    <div v-if="detailItem" class="annotation-detail-body">
      <div class="detail-row">
        <span class="detail-label">标注时间</span>
        <span class="detail-value">
          {{ formatAnnotationTime(detailItem.period) }}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">构件名称</span>
        <span class="detail-value">{{ detailItem.componentName || '-' }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">构件ID</span>
        <span class="detail-value">{{ detailItem.componentId || '-' }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">构件类型</span>
        <span class="detail-value">{{ detailItem.componentType || '-' }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">整改周期</span>
        <span class="detail-value">{{ formatPeriod(detailItem.period) }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">整改时长</span>
        <span class="detail-value">
          {{ formatDurationLine(detailItem.period) }}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">备注</span>
        <span class="detail-value">{{ detailItem.remark || '-' }}</span>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">截图</div>
        <div
          v-if="detailItem.screenshotUrls?.length"
          class="detail-screenshot-grid"
        >
          <el-image
            v-for="(url, idx) in detailItem.screenshotUrls"
            :key="`${detailItem.key}-${idx}`"
            :src="url"
            fit="cover"
            :preview-src-list="detailItem.screenshotUrls"
            :initial-index="idx"
            class="detail-screenshot-item"
          />
        </div>
        <div v-else class="detail-empty">暂无截图</div>
      </div>
    </div>
  </el-dialog>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowLeft,
  RefreshRight,
  Document,
  OfficeBuilding,
  House,
} from '@element-plus/icons-vue'

type AnnotationItem = {
  key: string
  title: string
  period: string[]
  severity: string
  source: 'bim' | 'pointcloud' | 'gaussian' | 'consistencyResult'
  componentId: string
  componentName: string
  componentType: string
  remark: string
  screenshotUrls: string[]
}

const props = defineProps<{
  projectName: string
  rangeValue?: [string, string] | ''
  annotationItems?: AnnotationItem[]
  showAnnotationList?: boolean
  selectedAnnotationKey?: string
  showBuildingFloor?: boolean
  buildingValue?: string
  floorValue?: string
  buildingOptions?: Array<{ label: string; value: string; disabled?: boolean }>
  floorOptions?: Array<{ label: string; value: string; disabled?: boolean }>
  canGenerateReport?: boolean
}>()

const emit = defineEmits<{
  'range-change': [{ start: number; end: number } | null]
  'reset-latest': []
  'annotation-select': [string]
  'annotation-detail': [string]
  'annotation-invite': [string]
  'annotation-generate': [string[]]
  'building-change': [string]
  'floor-change': [string]
}>()

const value = ref<[string, string] | ''>('')
const isSyncingRange = ref(false)
const annotationItems = ref(props.annotationItems ?? [])
const showAnnotationList = ref(Boolean(props.showAnnotationList))
const showBuildingFloor = ref(props.showBuildingFloor ?? true)
const selectedAnnotationKey = ref(props.selectedAnnotationKey ?? '')
const canGenerateReport = computed(() => Boolean(props.canGenerateReport))
const selectedGenerateKeys = ref<string[]>([])
const highRiskOnly = ref(false)
const annotationListVisible = ref(false)
const detailVisible = ref(false)
const detailItem = ref<AnnotationItem | null>(null)
const router = useRouter()
const defaultTime = ref<[Date, Date]>([
  new Date(2000, 1, 1, 0, 0, 0),
  new Date(2000, 2, 1, 23, 59, 59),
])
const buildingOptions = computed(() => props.buildingOptions ?? [])
const floorOptions = computed(() => props.floorOptions ?? [])
const buildingValue = computed(() => String(props.buildingValue || '').trim())
const floorValue = computed(() => String(props.floorValue || '').trim())
const buildingDisabled = computed(() => buildingOptions.value.length === 0)
const floorDisabled = computed(() => floorOptions.value.length === 0)

const handleBack = () => {
  router.back()
}

const handleBuildingChange = (value: string | number | boolean) => {
  emit('building-change', String(value ?? '').trim())
}

const handleFloorChange = (value: string | number | boolean) => {
  emit('floor-change', String(value ?? '').trim())
}

const parseRange = (rangeValue: string | [string, string] | '') => {
  if (!Array.isArray(rangeValue) || rangeValue.length < 2) return null
  const [startText, endText] = rangeValue
  const start = new Date(startText).getTime()
  const end = new Date(endText).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  return { start: Math.min(start, end), end: Math.max(start, end) }
}

const formatPeriod = (period: string[]) => {
  if (!Array.isArray(period) || period.length < 2) return '未设置周期'
  const [start, end] = period
  return `${start} ~ ${end}`
}

const formatAnnotationTime = (period: string[]) => {
  if (!Array.isArray(period) || period.length < 1) return '—'
  return period[0] || '—'
}

const formatDurationLine = (period: string[]) => {
  if (!Array.isArray(period) || period.length < 2) return '—'
  const [start, end] = period
  const startTime = new Date(start).getTime()
  const endTime = new Date(end).getTime()
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime))
    return `${start} · —`
  const dayMs = 24 * 60 * 60 * 1000
  const days = Math.max(1, Math.round((endTime - startTime) / dayMs) + 1)
  return `${start} · ${days}天`
}

const severityLabel = (value?: string) => {
  if (value === 'high') return '高风险'
  if (value === 'medium') return '中风险'
  if (value === 'low') return '低风险'
  return '未设置'
}

const severityClass = (value?: string) => {
  if (value === 'high') return 'is-high'
  if (value === 'medium') return 'is-medium'
  if (value === 'low') return 'is-low'
  return 'is-unknown'
}

const sourceLabel = (value?: AnnotationItem['source']) => {
  if (value === 'bim') return 'BIM'
  if (value === 'pointcloud') return '点云'
  return '未知来源'
}

const openDetail = (item: AnnotationItem) => {
  emit('annotation-detail', item.key)
  detailItem.value = item
  detailVisible.value = true
}

const handleAnnotationInviteClick = () => {
  const preferred =
    selectedAnnotationKey.value || annotationItems.value[0]?.key || ''
  if (!preferred) return
  emit('annotation-invite', preferred)
}

const filteredAnnotationItems = computed(() =>
  highRiskOnly.value
    ? annotationItems.value.filter((item) => item.severity === 'high')
    : annotationItems.value,
)

const filteredAnnotationKeys = computed(() =>
  filteredAnnotationItems.value.map((item) => item.key),
)

const selectedGenerateKeysForAction = computed(() => {
  const keySet = new Set(filteredAnnotationKeys.value)
  return selectedGenerateKeys.value.filter((key) => keySet.has(key))
})

const isAnnotationSelectedForGenerate = (key: string) =>
  selectedGenerateKeys.value.includes(key)

const isAllGenerateSelected = computed(
  () =>
    filteredAnnotationItems.value.length > 0 &&
    selectedGenerateKeysForAction.value.length ===
      filteredAnnotationItems.value.length,
)

const isGenerateIndeterminate = computed(
  () =>
    selectedGenerateKeysForAction.value.length > 0 &&
    selectedGenerateKeysForAction.value.length <
      filteredAnnotationItems.value.length,
)

const handleToggleGenerateSelectAll = (value: unknown) => {
  const checked = Boolean(value)
  const filteredKeys = filteredAnnotationKeys.value
  const keySet = new Set(selectedGenerateKeys.value)
  filteredKeys.forEach((key) => {
    if (checked) {
      keySet.add(key)
    } else {
      keySet.delete(key)
    }
  })
  selectedGenerateKeys.value = annotationItems.value
    .map((item) => item.key)
    .filter((key) => keySet.has(key))
}

const handleGenerateSelectChange = (key: string, checked: boolean) => {
  const set = new Set(selectedGenerateKeys.value)
  if (checked) {
    set.add(key)
  } else {
    set.delete(key)
  }
  selectedGenerateKeys.value = annotationItems.value
    .map((item) => item.key)
    .filter((itemKey) => set.has(itemKey))
}

const syncGenerateSelectionByItems = (items: AnnotationItem[]) => {
  const nextKeys = items.map((item) => item.key)
  if (!nextKeys.length) {
    selectedGenerateKeys.value = []
    return
  }
  const currentSet = new Set(selectedGenerateKeys.value)
  const retained = nextKeys.filter((key) => currentSet.has(key))
  const addedDefaults = nextKeys.filter((key) => !currentSet.has(key))
  selectedGenerateKeys.value = [...retained, ...addedDefaults]
}

const handleGenerateReportClick = () => {
  if (!selectedGenerateKeysForAction.value.length) return
  emit('annotation-generate', [...selectedGenerateKeysForAction.value])
}

watch(
  () => props.rangeValue,
  (next) => {
    isSyncingRange.value = true
    value.value = Array.isArray(next) ? [...next] : ''
    void nextTick(() => {
      isSyncingRange.value = false
    })
  },
  { immediate: true },
)

watch(
  () => props.annotationItems,
  (next) => {
    annotationItems.value = next ?? []
    syncGenerateSelectionByItems(annotationItems.value)
    if (detailVisible.value && detailItem.value) {
      const match = annotationItems.value.find(
        (item) => item.key === detailItem.value?.key,
      )
      if (match) {
        detailItem.value = match
      }
    }
  },
  { immediate: true, deep: true },
)

watch(
  () => props.selectedAnnotationKey,
  (next) => {
    selectedAnnotationKey.value = next ?? ''
  },
  { immediate: true },
)

watch(
  () => props.showAnnotationList,
  (next) => {
    showAnnotationList.value = Boolean(next)
    if (!showAnnotationList.value) {
      annotationListVisible.value = false
    }
  },
  { immediate: true },
)

watch(
  () => props.showBuildingFloor,
  (next) => {
    showBuildingFloor.value = next ?? true
  },
  { immediate: true },
)

watch(value, (next) => {
  if (isSyncingRange.value) return
  emit('range-change', parseRange(next))
})

const closeAnnotationList = () => {
  annotationListVisible.value = false
}

defineExpose({
  closeAnnotationList,
})
</script>

<style scoped>
.two-screen-header {
  display: flex;
  justify-content: space-between;
  height: 44px;
  backdrop-filter: blur(12px);
}

.header-left {
  display: flex;
  gap: 8px;
}

.back-button {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  border: 1px solid rgba(19, 83, 122, 0.5);
  background: rgba(200, 225, 244, 0.35);
  color: #196a9d;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 18px rgba(139, 175, 233, 0.25);
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    background 180ms ease;
}

.back-button:hover {
  transform: translateY(-1px) scale(1.05);
  background: rgba(1, 90, 168, 0.5);
  color: #fff;
  box-shadow: 0 12px 24px rgba(19, 83, 122, 0.2);
}

.back-button :deep(.el-icon) {
  font-size: 16px;
}

.project-name {
  font-size: 18px;
  font-weight: 600;
  color: #151515;
  margin-left: 20px;
  margin-top: 3px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.building-floor-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.building-floor-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.building-floor-icon {
  color: rgba(1, 49, 86, 0.85);
  font-size: 16px;
}

.building-floor-select {
  width: 128px;
}

.building-floor-select.is-floor {
  width: 110px;
}

.building-floor-select :deep(.el-input__wrapper) {
  height: 34px;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px rgba(120, 144, 156, 0.25);
}

.building-floor-select :deep(.el-input__prefix) {
  margin-right: 4px;
}

.building-floor-select :deep(.el-input__prefix-inner) {
  display: flex;
  align-items: center;
}

.building-floor-select :deep(.el-input__inner) {
  color: #1f2937;
  font-weight: 600;
}

.demo-date-picker {
  width: 250px;
  display: flex;
  padding: 0;
  flex-wrap: wrap;
}

.demo-date-picker .block {
  padding: 0;
  text-align: center;
  border-right: none;
  flex: 1;
}

.range-label {
  margin: 0 0 6px;
  font-size: 12px;
  color: rgba(245, 255, 253, 0.7);
}

:deep(.el-date-editor) {
  width: 200px;
}

:deep(.el-date-editor--daterange .el-input__wrapper) {
  height: 44px;
  border-radius: 18px;
  background: rgba(81, 122, 151, 0.45);
  box-shadow: inset 0 0 0 1px rgba(54, 255, 223, 0.2);
  backdrop-filter: blur(12px);
}

:deep(.el-date-editor--daterange .el-input__inner) {
  color: #eafbf7;
  font-weight: 600;
}

:deep(.el-date-editor--daterange .el-range-separator),
:deep(.el-date-editor--daterange .el-range-input) {
  color: rgba(11, 11, 11, 0.85);
}

:deep(.el-date-editor--daterange .el-range__icon),
:deep(.el-date-editor--daterange .el-range__close-icon) {
  color: rgba(1, 49, 86, 0.85);
}

.reset-latest-btn {
  height: 30px;
  border: 1px solid #d0d0d0;
  background: #ffffff;
  color: #545353;
  font-weight: 600;
  box-shadow: none;
  backdrop-filter: none;
}

.reset-latest-btn:hover {
  background: #f7f7f7;
  border-color: #bdbdbd;
  color: #0b0b0b;
}

.reset-latest-btn :deep(.el-icon) {
  color: #666666;
}

.annotation-list-btn {
  height: 30px;
  border: 1px solid #d0d0d0;
  background: #ffffff;
  color: #545353;
  font-weight: 600;
  box-shadow: none;
  backdrop-filter: none;
}

.annotation-list-btn:hover {
  background: #f7f7f7;
  border-color: #bdbdbd;
  color: #0b0b0b;
}

.annotation-count {
  display: inline-flex;
  min-width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 999px;
  background: #e8eef6;
  color: #2f6bff;
  font-size: 12px;
  font-weight: 700;
}

.annotation-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100vh - 110px);
  max-height: calc(100vh - 110px);
  overflow: auto;
  padding: 14px;
  background: linear-gradient(180deg, #f6f7f9 0%, #f0f2f5 100%);
  border-radius: 16px;
}

.annotation-list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 2px 2px 6px;
  flex-wrap: wrap;
}

.annotation-toolbar-left {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.annotation-toolbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.annotation-select-all {
  color: #475569;
  font-size: 12px;
}

.annotation-select-all :deep(.el-checkbox__label) {
  font-size: 12px;
  color: #475569;
}

.annotation-high-risk-only {
  color: #475569;
  font-size: 12px;
}

.annotation-high-risk-only :deep(.el-checkbox__label) {
  font-size: 12px;
  color: #475569;
}

.annotation-list-summary {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
}

.annotation-list-empty {
  padding: 16px;
  border-radius: 10px;
  color: #9aa0a6;
  font-size: 13px;
  text-align: center;
  background: #ffffff;
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.06);
}

.annotation-list-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-radius: 14px;
  background: linear-gradient(180deg, #ffffff 0%, #fafafa 100%);
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
  cursor: pointer;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.annotation-list-item-check {
  padding-top: 2px;
}

.annotation-list-item:hover {
  border-color: rgba(71, 85, 105, 0.25);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12);
  transform: translateY(-1px);
}

.annotation-list-item.is-selected {
  border-color: rgba(47, 107, 255, 0.6);
  box-shadow: 0 4px 10px rgba(47, 107, 255, 0.2);
  transform: translateY(-2px);
}

.annotation-card-left {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.annotation-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.annotation-card-title {
  align-self: flex-start;
  font-size: 16px;
  font-weight: 600;
  color: #121417;
  text-align: left;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: none;
  text-underline-offset: 4px;
  text-decoration-thickness: 2px;
  transition:
    color 160ms ease,
    text-decoration-color 160ms ease;
}

.annotation-card-title:hover {
  color: #2f6bff;
  text-decoration: underline;
}

.annotation-card-title:focus-visible {
  color: #2f6bff;
  text-decoration: underline;
  outline: 2px solid rgba(47, 107, 255, 0.35);
  outline-offset: 2px;
  border-radius: 4px;
}

.annotation-card-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.annotation-card-field {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  min-width: 0;
}

.annotation-bullet {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c4c9cf;
}

.annotation-field-label {
  flex: 0 0 60px;
  color: #9aa0a6;
  font-weight: 500;
}

.annotation-field-value {
  color: #6b7280;
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.annotation-card-right {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
}

.annotation-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 12px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
}

.annotation-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #9ca3af;
}

.annotation-status-pill.is-high {
  background: #fee2e2;
  color: #b91c1c;
}

.annotation-status-pill.is-high .annotation-status-dot {
  background: #ef4444;
}

.annotation-status-pill.is-medium {
  background: #ffedd5;
  color: #c2410c;
}

.annotation-status-pill.is-medium .annotation-status-dot {
  background: #f97316;
}

.annotation-status-pill.is-low {
  background: #dcfce7;
  color: #15803d;
}

.annotation-status-pill.is-low .annotation-status-dot {
  background: #22c55e;
}

.annotation-status-pill.is-unknown {
  background: #f3f4f6;
  color: #6b7280;
}

.annotation-status-pill.is-unknown .annotation-status-dot {
  background: #9ca3af;
}

:deep(.annotation-list-popover) {
  padding: 0;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.12);
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
}

:deep(.annotation-detail-dialog) {
  border-radius: 16px;
}

.annotation-detail-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.annotation-detail-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.annotation-detail-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.annotation-detail-pill {
  padding: 4px 10px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 12px;
  font-weight: 600;
}

.annotation-detail-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.15);
}

.detail-label {
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
}

.detail-value {
  color: #111827;
  font-size: 13px;
  font-weight: 600;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}

.detail-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.detail-screenshot-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.detail-screenshot-item {
  width: 100%;
  height: 78px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.detail-empty {
  padding: 12px;
  border-radius: 10px;
  text-align: center;
  color: #9aa0a6;
  background: #f8fafc;
}
</style>
