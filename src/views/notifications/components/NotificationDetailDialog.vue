<template>
  <el-dialog
    :model-value="modelValue"
    width="760px"
    top="6vh"
    class="notification-detail-dialog"
    @update:model-value="(value) => emit('update:modelValue', value)"
  >
    <template #header>
      <div class="detail-header">
        <div class="title-wrap">
          <div class="detail-title">
            {{ notification?.title || '消息详情' }}
          </div>
          <div v-if="notification" class="detail-time">
            {{ formatDateTime(notification.createdAt) }}
          </div>
        </div>
        <el-tag
          v-if="notification"
          size="small"
          effect="light"
          type="primary"
          round
        >
          {{ getNotificationTypeLabel(notification.type) }}
        </el-tag>
        <el-tag
          v-if="notification?.status"
          size="small"
          effect="light"
          :type="getNotificationStatusTagType(notification.status)"
          round
        >
          {{ getNotificationStatusLabel(notification.status) }}
        </el-tag>
      </div>
    </template>

    <div v-if="notification" class="detail-content">
      <section class="meta-grid">
        <article class="meta-card">
          <span class="meta-label">消息视角</span>
          <span class="meta-value">
            {{ box === 'sent' ? '已发送' : '收件箱' }}
          </span>
        </article>
        <article class="meta-card">
          <span class="meta-label">发送人</span>
          <span class="meta-value">{{ notification.sender.name }}</span>
        </article>
        <article v-if="notification.status" class="meta-card">
          <span class="meta-label">当前状态</span>
          <span class="meta-value">
            {{ getNotificationStatusLabel(notification.status) }}
          </span>
        </article>
        <article class="meta-card full-width">
          <span class="meta-label">接收人</span>
          <span class="meta-value recipients">{{ recipientText }}</span>
        </article>
      </section>

      <section
        v-if="notification.recipients?.length"
        class="detail-section recipient-section"
      >
        <div class="section-head">接收人处理状态</div>
        <div class="recipient-list">
          <div
            v-for="recipient in notification.recipients"
            :key="recipient.userId"
            class="recipient-row"
          >
            <div class="recipient-main">
              <span class="recipient-name">{{ recipient.name }}</span>
              <span class="recipient-email">{{ recipient.email || '-' }}</span>
            </div>
            <div class="recipient-side">
              <el-tag
                size="small"
                effect="plain"
                :type="getNotificationStatusTagType(recipient.status)"
              >
                {{ getNotificationStatusLabel(recipient.status) }}
              </el-tag>
              <span class="recipient-time">
                {{
                  recipient.statusChangedAt
                    ? formatDateTime(recipient.statusChangedAt)
                    : '--'
                }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section class="detail-section">
        <div class="section-head">消息正文</div>
        <div class="section-body">{{ notification.content || '-' }}</div>
      </section>

      <section
        v-if="notification.payload"
        class="detail-section annotation-section"
      >
        <div class="section-head-wrap">
          <div class="section-head">批注表单</div>
          <div class="annotation-head-tags">
            <el-tag size="small" effect="plain" type="info">只读</el-tag>
            <el-tag
              v-if="annotationListForView.length > 0"
              size="small"
              effect="plain"
              type="primary"
            >
              共 {{ annotationListForView.length }} 条批注
            </el-tag>
          </div>
        </div>

        <div v-if="annotationSummary.hasAnyData" class="annotation-grid">
          <div class="annotation-item full-width">
            <span class="annotation-label">邀请文案</span>
            <span class="annotation-value multiline">
              {{ annotationSummary.inviteMessage }}
            </span>
          </div>
          <div class="annotation-item">
            <span class="annotation-label">批注标识</span>
            <span class="annotation-value">
              {{ annotationSummary.subjectId }}
            </span>
          </div>
          <div class="annotation-item">
            <span class="annotation-label">项目ID</span>
            <span class="annotation-value">
              {{ annotationSummary.projectId }}
            </span>
          </div>
          <div class="annotation-item">
            <span class="annotation-label">扫描文件ID</span>
            <span class="annotation-value">
              {{ annotationSummary.scanFileId }}
            </span>
          </div>
        </div>

        <div v-if="annotationListForView.length > 0" class="annotation-list">
          <article
            v-for="(annotation, index) in annotationListForView"
            :key="annotation.cacheKey"
            class="annotation-card"
          >
            <div class="annotation-card-head">
              <div class="annotation-card-title">
                {{ index + 1 }}. {{ annotation.title }}
              </div>
              <div class="annotation-card-actions">
                <el-tag
                  size="small"
                  effect="light"
                  :type="annotation.severityTagType"
                >
                  {{ annotation.severity }}
                </el-tag>
                <el-button
                  size="small"
                  type="primary"
                  plain
                  :disabled="!canReplayAnnotation(annotation)"
                  @click="handleReplayAnnotation(annotation)"
                >
                  查看
                </el-button>
              </div>
            </div>
            <div class="annotation-grid">
              <div class="annotation-item">
                <span class="annotation-label">整改周期</span>
                <span class="annotation-value">{{ annotation.period }}</span>
              </div>
              <div class="annotation-item">
                <span class="annotation-label">批注来源</span>
                <span class="annotation-value">{{ annotation.source }}</span>
              </div>
              <div class="annotation-item">
                <span class="annotation-label">构件名称</span>
                <span class="annotation-value">
                  {{ annotation.componentName }}
                </span>
              </div>
              <div class="annotation-item">
                <span class="annotation-label">构件ID</span>
                <span class="annotation-value">
                  {{ annotation.componentId }}
                </span>
              </div>
              <div class="annotation-item">
                <span class="annotation-label">构件类型</span>
                <span class="annotation-value">
                  {{ annotation.componentType }}
                </span>
              </div>
              <div class="annotation-item">
                <span class="annotation-label">批注坐标</span>
                <span class="annotation-value">{{ annotation.point }}</span>
              </div>
              <div class="annotation-item full-width">
                <span class="annotation-label">备注</span>
                <span class="annotation-value multiline">
                  {{ annotation.remark }}
                </span>
              </div>
              <div class="annotation-item full-width">
                <span class="annotation-label">截图/证据</span>
                <div
                  v-if="
                    shouldShowScreenshotGrid(annotation) || screenshotLoading
                  "
                  class="annotation-screenshot-grid"
                >
                  <div
                    v-if="screenshotLoading"
                    class="annotation-screenshot-loading"
                  >
                    截图加载中...
                  </div>
                  <el-image
                    v-for="(url, screenshotIndex) in getResolvedScreenshotUrls(
                      annotation.cacheKey,
                    )"
                    :key="`${url}-${screenshotIndex}`"
                    :src="url"
                    fit="cover"
                    :preview-src-list="
                      getResolvedScreenshotUrls(annotation.cacheKey)
                    "
                    :initial-index="screenshotIndex"
                    class="annotation-screenshot-item"
                  />
                  <span
                    v-if="
                      !screenshotLoading &&
                      getResolvedScreenshotUrls(annotation.cacheKey).length ===
                        0
                    "
                    class="annotation-value"
                  >
                    截图加载失败
                  </span>
                </div>
                <span v-else class="annotation-value">暂无截图</span>
                <div
                  v-if="getScreenshotFallbackCount(annotation.cacheKey) > 0"
                  class="annotation-screenshot-hint"
                >
                  检测到
                  {{ getScreenshotFallbackCount(annotation.cacheKey) }}
                  张截图地址已失效
                </div>
              </div>
            </div>
          </article>
        </div>
        <div v-else class="annotation-empty">暂无批注列表数据</div>
      </section>
    </div>

    <template #footer>
      <el-button
        v-if="box === 'inbox' && notification?.status === 'unread'"
        type="primary"
        plain
        @click="emit('change-status', 'read')"
      >
        标记已读
      </el-button>
      <el-button
        v-if="box === 'inbox' && notification?.status !== 'done'"
        type="success"
        plain
        @click="emit('change-status', 'done')"
      >
        标记已完成
      </el-button>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getNotificationStatusLabel,
  getNotificationStatusTagType,
  getNotificationTypeLabel,
  type NotificationBox,
  type NotificationDetail,
  type NotificationStatus,
} from '@/api/notification'
import {
  getAnnotationScreenshotBlob,
  getAnnotationScreenshots,
  type AnnotationScreenshot,
} from '@/api/annotation'

interface Props {
  modelValue: boolean
  notification: NotificationDetail | null
  box?: NotificationBox
}

const props = withDefaults(defineProps<Props>(), {
  box: 'inbox',
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  'change-status': [Extract<NotificationStatus, 'read' | 'done'>]
  replay: [
    {
      projectId: number
      scanFileId: number
      annotationId: number
      annotationKey?: string
      gaussAssetPath?: string
      annotationSnapshot?: ReplayAnnotationSnapshot | null
    },
  ]
}>()

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  const second = `${date.getSeconds()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

const recipientText = computed(() => {
  if (!props.notification?.recipients?.length) return '-'
  return props.notification.recipients.map((item) => item.name).join('、')
})

const notificationPayloadData = computed(
  () => (props.notification?.payload?.data || {}) as Record<string, any>,
)
const subjectData = computed(
  () => (notificationPayloadData.value.subject || {}) as Record<string, any>,
)
const snapshotData = computed(
  () => (notificationPayloadData.value.snapshot || {}) as Record<string, any>,
)
const actionData = computed(
  () => (notificationPayloadData.value.action || {}) as Record<string, any>,
)

const resolvedScreenshotUrlsMap = ref<Record<string, string[]>>({})
const screenshotItemCountMap = ref<Record<string, number>>({})
const screenshotLoading = ref(false)
const screenshotFallbackCountMap = ref<Record<string, number>>({})
const createdObjectUrls = ref<string[]>([])
let screenshotResolveToken = 0
const scanGaussSelectionStorageKey = 'history-model:scan-gauss-selection'

interface AnnotationScreenshotItem {
  id: number | null
  url: string
  fileId: number | null
  sortOrder: number
}

interface AnnotationViewItem {
  cacheKey: string
  key: string
  id: number | null
  title: string
  severity: string
  severityTagType: 'danger' | 'warning' | 'info'
  period: string
  source: string
  componentName: string
  componentId: string
  componentType: string
  point: string
  remark: string
  screenshotItems: AnnotationScreenshotItem[]
  replaySnapshot: ReplayAnnotationSnapshot | null
}

interface ReplayAnnotationScreenshotItem {
  id: number | null
  url: string
  fileId: number | null
  originalName?: string
  fileSize?: number | null
  sortOrder: number
}

interface ReplayAnnotationSnapshot {
  id: number | null
  key: string
  title: string
  period: string[]
  severity: string
  source: 'bim' | 'pointcloud'
  componentName: string
  componentId: string
  componentType: string
  point: { x: number; y: number; z: number } | null
  remark: string
  screenshots: ReplayAnnotationScreenshotItem[]
  viewState?: Record<string, any> | null
}

const toSafeText = (value: unknown) => {
  if (value == null) return '-'
  const text = String(value).trim()
  return text || '-'
}

const formatSeverity = (value: unknown) => {
  if (value === 'high') return '高'
  if (value === 'medium') return '中'
  if (value === 'low') return '低'
  return '-'
}

const formatSource = (value: unknown) => {
  if (value === 'bim') return 'BIM'
  if (value === 'pointcloud') return '点云'
  return '-'
}

const formatSeverityTagType = (
  value: unknown,
): 'danger' | 'warning' | 'info' => {
  if (value === 'high') return 'danger'
  if (value === 'medium') return 'warning'
  return 'info'
}

const formatPoint = (value: any) => {
  if (!value || typeof value !== 'object') return '-'
  const x = Number(value.x)
  const y = Number(value.y)
  const z = Number(value.z)
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z))
    return '-'
  return `(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`
}

const toValidNumber = (value: unknown): number | null => {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return null
  return num
}

const normalizeGaussAssetPath = (value: unknown) => {
  const text = String(value ?? '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim()
  return text || ''
}

const loadScanGaussSelectionMap = (): Record<
  string,
  { gaussId?: string; gaussName?: string; gaussAssetPath?: string }
> => {
  try {
    const raw = window.sessionStorage.getItem(scanGaussSelectionStorageKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<
        string,
        { gaussId?: string; gaussName?: string; gaussAssetPath?: string }
      >
    }
  } catch (error) {}
  return {}
}

const resolveReplayGaussAssetPath = (
  scanFileId: number,
  actionGaussAssetPath: unknown,
) => {
  const routePath = normalizeGaussAssetPath(actionGaussAssetPath)
  const savedPath = normalizeGaussAssetPath(
    loadScanGaussSelectionMap()[String(scanFileId)]?.gaussAssetPath,
  )
  if (routePath && routePath !== 'meta.lcc') return routePath
  return savedPath || routePath || undefined
}

const parseScreenshotIdFromUrl = (value: unknown) => {
  const text = String(value ?? '').trim()
  const match = text.match(/\/screenshots\/(\d+)(?:[/?#]|$)/i)
  if (!match) return null
  return toValidNumber(match[1])
}

const resolveScreenshotResourceId = (value: unknown) => {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  const fieldCandidates = [
    data.id,
    data.screenshotId,
    data.screenshotID,
    data.screenshot_id,
    data.recordId,
    data.recordID,
    data.record_id,
    data.imageId,
    data.imageID,
    data.image_id,
  ]
  for (const candidate of fieldCandidates) {
    const resolved = toValidNumber(candidate)
    if (resolved) return resolved
  }
  const urlCandidates = [
    data.url,
    data.previewUrl,
    data.previewURL,
    data.downloadUrl,
    data.downloadURL,
    data.path,
  ]
  for (const candidate of urlCandidates) {
    const resolved = parseScreenshotIdFromUrl(candidate)
    if (resolved) return resolved
  }
  return toValidNumber(data.fileId)
}

const resolveScreenshotUrl = (value: unknown) => {
  if (!value || typeof value !== 'object') return ''
  const data = value as Record<string, unknown>
  const candidates = [
    data.url,
    data.previewUrl,
    data.previewURL,
    data.downloadUrl,
    data.downloadURL,
    data.path,
    data.src,
  ]
  for (const candidate of candidates) {
    const text = String(candidate ?? '').trim()
    if (text) return text
  }
  return ''
}

const normalizeScreenshotUrl = (rawUrl?: string) => {
  const url = String(rawUrl || '').trim()
  if (!url) return ''
  if (
    /^https?:\/\//i.test(url) ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return url
  }
  if (url.startsWith('/api/')) return url
  if (url.startsWith('/projects/')) return `/api${url}`
  if (url.startsWith('/')) return `/api${url}`
  return `/api/${url}`
}

const parseAnnotationIdFromText = (value: unknown) => {
  const text = String(value ?? '').trim()
  const match = text.match(/annotation:(\d+)/)
  if (!match) return null
  return toValidNumber(match[1])
}

const parseAnnotationId = (
  subjectId: unknown,
  annotationId: unknown,
  annotationKey?: unknown,
) => {
  const fromAnnotation = toValidNumber(annotationId)
  if (fromAnnotation) return fromAnnotation
  const fromKey = parseAnnotationIdFromText(annotationKey)
  if (fromKey) return fromKey
  return parseAnnotationIdFromText(subjectId)
}

const revokeObjectUrls = () => {
  createdObjectUrls.value.forEach((url) => URL.revokeObjectURL(url))
  createdObjectUrls.value = []
}

const formatPeriod = (
  period: unknown,
  startDate: unknown,
  endDate: unknown,
) => {
  if (Array.isArray(period) && period.length >= 2) {
    const [start, end] = period
    return `${toSafeText(start)} ~ ${toSafeText(end)}`
  }
  const start = toSafeText(startDate)
  const end = toSafeText(endDate)
  if (start === '-' && end === '-') return '-'
  return `${start} ~ ${end}`
}

const normalizePeriodArray = (
  period: unknown,
  startDate: unknown,
  endDate: unknown,
) => {
  if (Array.isArray(period)) {
    return period
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
      .slice(0, 2)
  }
  const start = String(startDate ?? '').trim()
  const end = String(endDate ?? '').trim()
  return [start, end].filter(Boolean)
}

const normalizePoint = (value: unknown) => {
  if (!value || typeof value !== 'object') return null
  const point = value as Record<string, unknown>
  const x = Number(point.x)
  const y = Number(point.y)
  const z = Number(point.z)
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z))
    return null
  return { x, y, z }
}

const normalizeReplaySnapshot = (
  annotation: Record<string, any>,
  fallbackTitle: string,
): ReplayAnnotationSnapshot => {
  const screenshots = Array.isArray(annotation.screenshots)
    ? annotation.screenshots
        .map((item: any): ReplayAnnotationScreenshotItem | null => {
          const screenshotId = resolveScreenshotResourceId(item)
          const url = normalizeScreenshotUrl(resolveScreenshotUrl(item))
          if (!screenshotId && !url) return null
          return {
            id: screenshotId,
            url,
            fileId: toValidNumber(item?.fileId),
            originalName:
              typeof item?.originalName === 'string'
                ? item.originalName.trim()
                : undefined,
            fileSize: toValidNumber(item?.fileSize),
            sortOrder: Number(item?.sortOrder) || 0,
          }
        })
        .filter(
          (item): item is ReplayAnnotationScreenshotItem => Boolean(item),
        )
        .sort((left, right) => left.sortOrder - right.sortOrder)
    : []

  return {
    id: toValidNumber(annotation.id),
    key: typeof annotation.key === 'string' ? annotation.key.trim() : '',
    title: String(annotation.title || fallbackTitle || '').trim(),
    period: normalizePeriodArray(
      annotation.period,
      annotation.startDate,
      annotation.endDate,
    ),
    severity: String(annotation.severity || '').trim(),
    source: annotation.source === 'pointcloud' ? 'pointcloud' : 'bim',
    componentName: String(annotation.componentName || '').trim(),
    componentId: String(annotation.componentId || '').trim(),
    componentType: String(annotation.componentType || '').trim(),
    point: normalizePoint(annotation.point),
    remark: String(annotation.remark || '').trim(),
    screenshots,
    viewState:
      annotation.viewState && typeof annotation.viewState === 'object'
        ? annotation.viewState
        : null,
  }
}

const annotationSummary = computed(() => {
  const subject = subjectData.value
  const action = actionData.value
  const inviteMessage = toSafeText(
    action.message || props.notification?.content,
  )
  const summary = {
    inviteMessage,
    subjectId: toSafeText(subject.id),
    projectId: toSafeText(subject.projectId),
    scanFileId: toSafeText(subject.scanFileId),
  }
  const hasAnyData = Object.values(summary).some((item) => item !== '-')
  return {
    ...summary,
    hasAnyData,
  }
})

const annotationListForView = computed<AnnotationViewItem[]>(() => {
  const snapshot = snapshotData.value
  const annotations = Array.isArray(snapshot.annotations)
    ? snapshot.annotations
    : []
  const fallbackAnnotation = snapshot.annotation
  const sourceList =
    annotations.length > 0
      ? annotations
      : fallbackAnnotation && typeof fallbackAnnotation === 'object'
        ? [fallbackAnnotation]
        : []

  return sourceList.map((rawAnnotation: any, index: number) => {
    const annotation = (rawAnnotation || {}) as Record<string, any>
    const key = typeof annotation.key === 'string' ? annotation.key.trim() : ''
    const id = toValidNumber(annotation.id)
    const cacheKey =
      key || (id ? `annotation:${id}` : `annotation-index:${index}`)
    const replaySnapshot = normalizeReplaySnapshot(
      annotation,
      String(props.notification?.title || ''),
    )
    const screenshotItems = replaySnapshot.screenshots.map((item) => ({
      id: item.id,
      url: item.url,
      fileId: item.fileId,
      sortOrder: item.sortOrder,
    }))

    return {
      cacheKey,
      key,
      id,
      title: toSafeText(annotation.title || props.notification?.title),
      severity: formatSeverity(annotation.severity),
      severityTagType: formatSeverityTagType(annotation.severity),
      period: formatPeriod(
        annotation.period,
        annotation.startDate,
        annotation.endDate,
      ),
      source: formatSource(annotation.source),
      componentName: toSafeText(annotation.componentName),
      componentId: toSafeText(annotation.componentId),
      componentType: toSafeText(annotation.componentType),
      point: formatPoint(annotation.point),
      remark: toSafeText(annotation.remark),
      screenshotItems,
      replaySnapshot,
    }
  })
})

const annotationScreenshotFingerprint = computed(() =>
  annotationListForView.value
    .map((annotation) => {
      const screenshotKey = annotation.screenshotItems
        .map((item) => `${item.id ?? item.fileId ?? '-'}:${item.url}`)
        .join('|')
      return `${annotation.cacheKey}:${annotation.id ?? '-'}:${screenshotKey}`
    })
    .join(';'),
)

const getResolvedScreenshotUrls = (cacheKey: string) =>
  resolvedScreenshotUrlsMap.value[cacheKey] || []

const getScreenshotFallbackCount = (cacheKey: string) =>
  screenshotFallbackCountMap.value[cacheKey] || 0

const shouldShowScreenshotGrid = (annotation: AnnotationViewItem) => {
  const count = screenshotItemCountMap.value[annotation.cacheKey]
  if (typeof count === 'number') return count > 0
  return annotation.screenshotItems.length > 0
}

const resolveReplayPayload = (annotation: AnnotationViewItem) => {
  const subject = subjectData.value
  const action = actionData.value
  const projectId = toValidNumber(subject.projectId)
  const scanFileId = toValidNumber(subject.scanFileId)
  const annotationId = parseAnnotationId(
    subject.id,
    annotation.id,
    annotation.key,
  )
  if (!projectId || !scanFileId || !annotationId) return null
  return {
    projectId,
    scanFileId,
    annotationId,
    annotationKey: annotation.key || undefined,
    gaussAssetPath: resolveReplayGaussAssetPath(
      scanFileId,
      action.gaussAssetPath,
    ),
    annotationSnapshot: annotation.replaySnapshot,
  }
}

const canReplayAnnotation = (annotation: AnnotationViewItem) =>
  Boolean(resolveReplayPayload(annotation))

const handleReplayAnnotation = (annotation: AnnotationViewItem) => {
  const payload = resolveReplayPayload(annotation)
  if (!payload) {
    ElMessage.warning('当前批注缺少复现参数，无法跳转')
    return
  }
  emit('replay', payload)
}

const resetScreenshotState = () => {
  screenshotResolveToken += 1
  screenshotLoading.value = false
  resolvedScreenshotUrlsMap.value = {}
  screenshotItemCountMap.value = {}
  screenshotFallbackCountMap.value = {}
  revokeObjectUrls()
}

const resolveScreenshots = async () => {
  const token = ++screenshotResolveToken
  revokeObjectUrls()
  resolvedScreenshotUrlsMap.value = {}
  screenshotItemCountMap.value = {}
  screenshotFallbackCountMap.value = {}

  const subject = subjectData.value
  const projectId = toValidNumber(subject.projectId)
  const scanFileId = toValidNumber(subject.scanFileId)
  const annotationList = annotationListForView.value

  screenshotLoading.value = true
  try {
    const nextUrlMap: Record<string, string[]> = {}
    const nextCountMap: Record<string, number> = {}
    const nextFallbackMap: Record<string, number> = {}
    for (const annotation of annotationList) {
      if (token !== screenshotResolveToken) return
      const nextUrls: string[] = []
      let fallbackCount = 0
      const annotationId = parseAnnotationId(
        subject.id,
        annotation.id,
        annotation.key,
      )
      let screenshotItems = annotation.screenshotItems.map((item) => ({
        ...item,
      }))

      if (projectId && scanFileId && annotationId) {
        try {
          const res = await getAnnotationScreenshots(
            projectId,
            scanFileId,
            annotationId,
          )
          if (res.code === 200 && Array.isArray(res.data)) {
            const normalized = [...res.data]
              .sort(
                (left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0),
              )
              .map((item: AnnotationScreenshot) => ({
                id: resolveScreenshotResourceId(item),
                url: normalizeScreenshotUrl(resolveScreenshotUrl(item)),
                fileId: toValidNumber(item.fileId),
                sortOrder: Number(item.sortOrder) || 0,
              }))
              .filter((item) => item.id || item.url)
            if (normalized.length > 0) {
              screenshotItems = normalized
            }
          }
        } catch {
          // fall back to snapshot screenshots
        }
      }

      nextCountMap[annotation.cacheKey] = screenshotItems.length

      for (const item of screenshotItems) {
        if (token !== screenshotResolveToken) return
        const rawUrl = item.url
        const isBlobUrl = rawUrl.startsWith('blob:')
        const screenshotId = item.id ?? item.fileId
        if (projectId && scanFileId && annotationId && screenshotId) {
          try {
            const blob = await getAnnotationScreenshotBlob(
              projectId,
              scanFileId,
              annotationId,
              screenshotId,
            )
            if (token !== screenshotResolveToken) return
            const objectUrl = URL.createObjectURL(blob)
            createdObjectUrls.value.push(objectUrl)
            nextUrls.push(objectUrl)
            continue
          } catch {
            // no-op, fallback handled below
          }
        }
        if (rawUrl && !isBlobUrl) {
          nextUrls.push(rawUrl)
          continue
        }
        if (isBlobUrl) {
          fallbackCount += 1
          continue
        }
        if (rawUrl) {
          nextUrls.push(rawUrl)
        }
      }

      nextUrlMap[annotation.cacheKey] = nextUrls
      if (fallbackCount > 0) {
        nextFallbackMap[annotation.cacheKey] = fallbackCount
      }
    }
    if (token !== screenshotResolveToken) return
    resolvedScreenshotUrlsMap.value = nextUrlMap
    screenshotItemCountMap.value = nextCountMap
    screenshotFallbackCountMap.value = nextFallbackMap
  } finally {
    if (token === screenshotResolveToken) {
      screenshotLoading.value = false
    }
  }
}

watch(
  () => [
    props.modelValue,
    props.notification?.id,
    subjectData.value.id,
    subjectData.value.projectId,
    subjectData.value.scanFileId,
    annotationScreenshotFingerprint.value,
  ],
  () => {
    if (!props.modelValue) {
      resetScreenshotState()
      return
    }
    void resolveScreenshots()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  resetScreenshotState()
})
</script>

<style scoped lang="scss">
:deep(.notification-detail-dialog .el-dialog) {
  border-radius: 20px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.12);
  overflow: hidden;
}

:deep(.notification-detail-dialog .el-dialog__header) {
  margin-right: 0;
  padding: 22px 24px 12px;
}

:deep(.notification-detail-dialog .el-dialog__body) {
  padding: 10px 24px 12px;
}

:deep(.notification-detail-dialog .el-dialog__footer) {
  padding: 8px 24px 20px;
}

:deep(.notification-detail-dialog .el-button) {
  border-radius: 10px;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;

  .title-wrap {
    min-width: 0;

    .detail-title {
      font-size: 20px;
      font-weight: 600;
      color: #1d1d1f;
      line-height: 1.3;
    }

    .detail-time {
      margin-top: 8px;
      color: #8a8a91;
      font-size: 12px;
    }
  }
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;

    .meta-card {
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      background: #f8f9fb;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .meta-label {
        color: #8a8a91;
        font-size: 12px;
      }

      .meta-value {
        color: #1d1d1f;
        font-size: 14px;
        font-weight: 500;
        line-height: 1.5;

        &.recipients {
          word-break: break-all;
        }
      }

      &.full-width {
        grid-column: span 2;
      }
    }
  }

  .detail-section {
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    background: #fff;
    padding: 14px;

    .section-head {
      font-size: 13px;
      font-weight: 600;
      color: #4d4d52;
    }

    .section-body {
      margin-top: 8px;
      color: #1d1d1f;
      font-size: 14px;
      line-height: 1.7;
      white-space: pre-wrap;
      word-break: break-word;
    }
  }

  .recipient-section {
    .recipient-list {
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .recipient-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid #e5e7eb;
      background: #f8f9fb;
    }

    .recipient-main {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .recipient-name {
      color: #1d1d1f;
      font-size: 14px;
      font-weight: 500;
    }

    .recipient-email,
    .recipient-time {
      color: #8a8a91;
      font-size: 12px;
    }

    .recipient-side {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
    }
  }

  .annotation-section {
    background: #f8f9fb;

    .section-head-wrap {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }

    .annotation-head-tags {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .annotation-list {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .annotation-card {
      border: 1px solid #dbe1ea;
      border-radius: 10px;
      background: #ffffff;
      padding: 10px;
    }

    .annotation-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
    }

    .annotation-card-title {
      color: #1d1d1f;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.4;
    }

    .annotation-card-actions {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .annotation-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .annotation-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px;
      background: #fff;
      border-radius: 8px;
      border: 1px solid #e5e7eb;

      &.full-width {
        grid-column: span 2;
      }
    }

    .annotation-label {
      color: #8a8a91;
      font-size: 12px;
    }

    .annotation-value {
      color: #1d1d1f;
      font-size: 13px;
      line-height: 1.6;
      word-break: break-word;

      &.multiline {
        white-space: pre-wrap;
      }
    }

    .annotation-screenshot-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .annotation-screenshot-loading {
      grid-column: span 3;
      color: #8a8a91;
      font-size: 12px;
      padding: 8px 0;
    }

    .annotation-screenshot-item {
      width: 100%;
      height: 78px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid rgba(15, 23, 42, 0.08);
    }

    .annotation-empty {
      color: #8a8a91;
      font-size: 13px;
      background: #fff;
      border-radius: 8px;
      border: 1px dashed #d1d5db;
      padding: 14px;
      text-align: center;
    }

    .annotation-screenshot-hint {
      margin-top: 8px;
      color: #d97706;
      font-size: 12px;
    }
  }

  @media (max-width: 760px) {
    .meta-grid {
      grid-template-columns: 1fr;

      .meta-card.full-width {
        grid-column: span 1;
      }
    }

    .annotation-section {
      .annotation-grid {
        grid-template-columns: 1fr;
      }

      .annotation-item.full-width {
        grid-column: span 1;
      }

      .annotation-screenshot-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    .recipient-section {
      .recipient-row {
        flex-direction: column;
        align-items: flex-start;
      }

      .recipient-side {
        align-items: flex-start;
      }
    }
  }
}
</style>
