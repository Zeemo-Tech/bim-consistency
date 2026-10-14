<template>
  <el-dialog
    :model-value="modelValue"
    class="annotation-detail-dialog"
    width="520px"
    append-to-body
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
  >
    <template #header>
      <div class="annotation-detail-header">
        <div class="annotation-detail-title">{{ title || '批注详情' }}</div>
        <div class="annotation-detail-tags">
          <span class="annotation-detail-pill">{{ sourceLabel }}</span>
          <span class="annotation-detail-pill">{{ severityLabel }}</span>
        </div>
      </div>
    </template>
    <div class="annotation-detail-body">
      <div class="detail-row">
        <span class="detail-label">标注时间</span>
        <span class="detail-value">{{ annotationTime }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">构件名称</span>
        <span class="detail-value">{{ componentName || '-' }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">构件ID</span>
        <span class="detail-value">{{ componentId || '-' }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">构件类型</span>
        <span class="detail-value">{{ componentType || '-' }}</span>
      </div>
      <div v-if="coordinate" class="detail-row">
        <span class="detail-label">坐标位置</span>
        <span class="detail-value">{{ coordinate }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">整改周期</span>
        <span class="detail-value">{{ periodText }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">整改时长</span>
        <span class="detail-value">{{ durationText }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">备注</span>
        <span class="detail-value">{{ remark || '-' }}</span>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">截图</div>
        <div v-if="screenshotsLoading" class="detail-empty">正在加载截图…</div>
        <div
          v-else-if="displayScreenshots.length"
          class="detail-screenshot-grid"
        >
          <el-image
            v-for="(url, idx) in displayScreenshots"
            :key="idx"
            :src="url"
            fit="cover"
            :preview-src-list="displayScreenshots"
            :initial-index="idx"
            class="detail-screenshot-item"
          />
        </div>
        <div v-else class="detail-empty">暂无截图</div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  peekAnnotationScreenshotUrls,
  resolveAnnotationScreenshotUrls,
  type AnnotationScreenshotLike,
} from '@/utils/annotationScreenshots'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    source?: string
    severity?: string
    /** [开始时间, 结束时间] */
    period?: string[]
    componentName?: string
    componentId?: string
    componentType?: string
    coordinate?: string
    remark?: string
    /** 直接展示的截图地址（可选，作为兜底） */
    screenshotUrls?: string[]
    /** 后端若在列表里带上截图，可直接传入以避免额外请求 */
    inlineScreenshots?: AnnotationScreenshotLike[]
    /** 提供以下三项时，会按需拉取该批注的截图（带鉴权，避免图片 401） */
    projectId?: number
    scanFileId?: number
    annotationId?: number
  }>(),
  {
    title: '',
    source: '',
    severity: '',
    period: () => [],
    componentName: '',
    componentId: '',
    componentType: '',
    coordinate: '',
    remark: '',
    screenshotUrls: () => [],
    inlineScreenshots: () => [],
    projectId: 0,
    scanFileId: 0,
    annotationId: 0,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

/** 解析后的截图地址（blob URL / 绝对 URL），来自共享缓存。 */
const remoteScreenshotUrls = ref<string[]>([])
const screenshotsLoading = ref(false)

const loadScreenshots = async () => {
  const { projectId, scanFileId, annotationId, inlineScreenshots } = props
  remoteScreenshotUrls.value = []
  if (!projectId || !scanFileId || !annotationId) return
  // 命中缓存则同步秒开
  const cached = peekAnnotationScreenshotUrls(
    projectId,
    scanFileId,
    annotationId,
  )
  if (cached) {
    remoteScreenshotUrls.value = cached
    return
  }
  screenshotsLoading.value = true
  try {
    remoteScreenshotUrls.value = await resolveAnnotationScreenshotUrls(
      projectId,
      scanFileId,
      annotationId,
      inlineScreenshots,
    )
  } catch (error) {
    console.warn('[AnnotationDetailDialog] 加载截图失败:', error)
  } finally {
    screenshotsLoading.value = false
  }
}

const displayScreenshots = computed(() =>
  remoteScreenshotUrls.value.length
    ? remoteScreenshotUrls.value
    : (props.screenshotUrls ?? []),
)

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) void loadScreenshots()
  },
)

const SOURCE_LABELS: Record<string, string> = {
  bim: 'BIM',
  pointcloud: '点云',
  gaussian: '高斯',
  consistencyResult: '实模一致',
}
const sourceLabel = computed(
  () => SOURCE_LABELS[props.source] || props.source || '未知来源',
)
const severityLabel = computed(() => {
  if (props.severity === 'high') return '高风险'
  if (props.severity === 'medium') return '中风险'
  if (props.severity === 'low') return '低风险'
  return '未设置'
})

const annotationTime = computed(() => props.period?.[0] || '—')
const periodText = computed(() => {
  const [start, end] = props.period ?? []
  if (!start || !end) return '未设置周期'
  return `${start} ~ ${end}`
})
const durationText = computed(() => {
  const [start, end] = props.period ?? []
  if (!start || !end) return '—'
  const startTime = new Date(start).getTime()
  const endTime = new Date(end).getTime()
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime))
    return `${start} · —`
  const dayMs = 24 * 60 * 60 * 1000
  const days = Math.max(1, Math.round((endTime - startTime) / dayMs) + 1)
  return `${start} · ${days}天`
})
</script>

<style>
.annotation-detail-dialog {
  border-radius: 16px;
}

.annotation-detail-dialog .annotation-detail-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.annotation-detail-dialog .annotation-detail-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.annotation-detail-dialog .annotation-detail-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.annotation-detail-dialog .annotation-detail-pill {
  padding: 4px 10px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 12px;
  font-weight: 600;
}

.annotation-detail-dialog .annotation-detail-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.annotation-detail-dialog .detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.15);
}

.annotation-detail-dialog .detail-label {
  flex: 0 0 auto;
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
}

.annotation-detail-dialog .detail-value {
  color: #111827;
  font-size: 13px;
  font-weight: 600;
  text-align: right;
  word-break: break-all;
}

.annotation-detail-dialog .detail-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}

.annotation-detail-dialog .detail-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.annotation-detail-dialog .detail-screenshot-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.annotation-detail-dialog .detail-screenshot-item {
  width: 100%;
  height: 78px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.08);
  cursor: zoom-in;
}

.annotation-detail-dialog .detail-empty {
  padding: 12px;
  border-radius: 10px;
  text-align: center;
  color: #9aa0a6;
  background: #f8fafc;
  font-size: 13px;
}
</style>
