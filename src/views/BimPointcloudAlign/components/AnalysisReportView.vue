<template>
  <div class="analysis-report-view">
    <div class="analysis-report-view__preview">
      <div v-if="preparing" class="analysis-report-view__state">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>正在准备报告预览…</span>
      </div>
      <div
        v-else-if="!reportId"
        class="analysis-report-view__state is-empty"
        :class="{ 'is-blocked': !ready }"
      >
        <strong>{{ ready ? '组装本次检测报告' : '暂不可生成报告' }}</strong>
        <span>
          {{
            errorMessage ||
            readyReason ||
            (ready
              ? `已选 ${selectedCount} / ${annotations.length} 条批注，可在右侧配置后生成`
              : '请先完成配准与批注后再出报告')
          }}
        </span>
        <div v-if="ready" class="report-empty-actions">
          <el-button @click="openSelector">
            选择批注（{{ selectedCount }}/{{ annotations.length }}）
          </el-button>
          <el-button
            type="primary"
            :loading="creating"
            :disabled="!canGenerate"
            @click="createAndPreview"
          >
            生成报告
          </el-button>
        </div>
      </div>
      <ReportDetail v-else ref="detailRef" :report-id="reportId" embedded />
    </div>

    <!-- 出报告：报告配置面板 -->
    <aside class="report-config-panel" aria-label="出报告">
      <div class="control-panel-header">
        <div class="panel-heading">
          <strong>出报告</strong>
        </div>
        <div class="panel-step-actions">
          <button
            class="panel-step-count panel-next-step panel-prev-step"
            type="button"
            @click="emit('prev-step')"
          >
            <el-icon aria-hidden="true"><DArrowLeft /></el-icon>
            上一步
          </button>
        </div>
      </div>

      <div class="panel-body">
        <div v-if="!ready" class="report-ready-block">
          <strong>暂不可生成报告</strong>
          <span>{{ readyReason || '请先完成配准与批注后再出报告' }}</span>
        </div>

        <template v-else>
          <div class="panel-section report-annotation-panel">
            <div class="report-row">
              <span class="report-row__label">报告批注</span>
              <span class="report-row__value">
                {{ selectedCount }} / {{ annotations.length }}
              </span>
              <button
                type="button"
                class="report-mini-btn"
                :disabled="!annotations.length"
                @click="openSelector"
              >
                {{ selectedCount ? '重新选择' : '选择批注' }}
              </button>
            </div>
          </div>

          <div class="panel-section report-config">
            <label v-if="reportId" class="field-block">
              <span>报告名称</span>
              <el-input
                v-model="reportTitle"
                maxlength="40"
                class="square-input"
              />
            </label>

            <div class="field-block field-block--inline">
              <span>输出格式</span>
              <div class="format-segment">
                <button
                  type="button"
                  :class="{ active: reportFormat === 'pdf' }"
                  @click="reportFormat = 'pdf'"
                >
                  PDF
                </button>
                <button
                  type="button"
                  :class="{ active: reportFormat === 'docx' }"
                  @click="reportFormat = 'docx'"
                >
                  Word
                </button>
              </div>
            </div>

            <div class="content-config-heading">
              <div>
                <strong>报告内容配置</strong>
                <span>
                  {{ enabledCount }} / {{ reportContents.length }} 已显示
                </span>
              </div>
              <button
                class="reset-content-button"
                type="button"
                title="全部开启"
                aria-label="全部开启报告章节"
                @click="reportContents.forEach((item) => (item.enabled = true))"
              >
                <el-icon><RefreshLeft /></el-icon>
              </button>
            </div>

            <div class="dynamic-content-list">
              <article
                v-for="item in reportContents"
                :key="item.id"
                :class="{ disabled: !item.enabled }"
              >
                <el-checkbox
                  v-model="item.enabled"
                  size="small"
                  :aria-label="`显示${item.title}`"
                />
                <input
                  v-if="editingContentId === item.id"
                  :ref="bindContentTitleInput"
                  v-model="item.title"
                  class="content-title-input"
                  maxlength="40"
                  @blur="endEditContent"
                  @keyup.enter="endEditContent"
                  @keyup.esc="endEditContent"
                />
                <button
                  v-else
                  type="button"
                  class="content-title-text"
                  :title="`点击编辑：${item.title}`"
                  @click="startEditContent(item.id)"
                >
                  {{ item.title }}
                </button>
              </article>
            </div>
          </div>
        </template>

        <div class="report-config-footer">
          <el-button
            class="report-generate-btn"
            type="primary"
            size="large"
            :loading="creating"
            :disabled="!canGenerate"
            @click="createAndPreview"
          >
            {{ reportId ? '重新生成报告' : '生成报告' }}
          </el-button>
          <span v-if="!ready" class="report-generate-hint">
            {{ readyReason || '当前扫描暂不满足报告生成条件' }}
          </span>
          <span v-else-if="!selectedCount" class="report-generate-hint">
            请先选择至少一条批注
          </span>
        </div>
      </div>
    </aside>

    <!-- 报告批注选择弹窗（可随时重新打开） -->
    <el-dialog
      v-model="selectorVisible"
      class="report-selector-dialog cb-shell"
      width="760px"
      align-center
      append-to-body
      :close-on-click-modal="false"
    >
      <template #header>
        <div class="report-selector__header">
          <div class="report-selector__heading">
            <h3>选择报告批注</h3>
            <p>勾选需要纳入报告的批注，默认已全选</p>
          </div>
          <div class="report-selector__stat">
            <strong>{{ draftCount }}</strong>
            <span>/ {{ annotations.length }} 已选</span>
          </div>
        </div>
      </template>

      <div class="report-selector">
        <div class="report-selector__toolbar">
          <el-input
            v-model="selectorKeyword"
            class="report-selector__search"
            placeholder="搜索批注 / 构件"
            clearable
            :prefix-icon="Search"
          />
          <div class="report-selector__actions">
            <el-button
              size="small"
              :disabled="!annotations.length || draftAllSelected"
              @click="draftSelectAll"
            >
              全选
            </el-button>
            <el-button size="small" :disabled="!draftCount" @click="draftClear">
              清空
            </el-button>
          </div>
        </div>

        <div v-if="annotationsLoading" class="report-selector__state">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>正在加载批注…</span>
        </div>
        <div v-else-if="!annotations.length" class="report-selector__state">
          暂无批注，请先回到「批注」步骤添加
        </div>
        <div
          v-else-if="!filteredAnnotations.length"
          class="report-selector__state"
        >
          没有匹配「{{ selectorKeyword }}」的批注
        </div>
        <div v-else v-bind="containerProps" class="report-selector__body">
          <div v-bind="wrapperProps">
            <div
              v-for="row in virtualRows"
              :key="row.index"
              class="report-selector-item"
              :class="{ 'is-selected': isDraftSelected(row.data.id) }"
            >
              <label class="report-selector-item__label">
                <input
                  class="report-selector-item__check"
                  type="checkbox"
                  :checked="isDraftSelected(row.data.id)"
                  @change="
                    (event) =>
                      toggleDraft(
                        row.data.id,
                        (event.target as HTMLInputElement).checked,
                      )
                  "
                />
                <span class="report-selector-item__body">
                  <span class="report-selector-item__row">
                    <button
                      type="button"
                      class="report-selector-item__name"
                      :title="row.data.name"
                      @click.stop.prevent="openAnnotationDetail(row.data)"
                    >
                      {{ row.data.name || `批注 #${row.data.id}` }}
                    </button>
                    <span
                      class="report-selector-item__sev"
                      :class="`is-${row.data.severity || 'low'}`"
                    >
                      {{ severityLabel(row.data.severity) }}
                    </span>
                  </span>
                  <span class="report-selector-item__meta">
                    {{ sourceLabel(row.data.source) }}
                    <template v-if="row.data.componentName">
                      · {{ row.data.componentName }}
                    </template>
                    <template v-if="periodText(row.data)">
                      · {{ periodText(row.data) }}
                    </template>
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="selectorVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmSelector">
          确定（{{ draftCount }}）
        </el-button>
      </template>
    </el-dialog>

    <AnnotationDetailDialog
      v-model="detailVisible"
      :title="detailAnnotation?.name"
      :source="detailAnnotation?.source"
      :severity="detailAnnotation?.severity"
      :period="detailPeriod"
      :component-name="detailAnnotation?.componentName"
      :component-id="detailAnnotation?.componentId"
      :component-type="detailAnnotation?.componentType"
      :project-id="projectId"
      :scan-file-id="scanFileId"
      :annotation-id="detailAnnotation?.id ?? 0"
      :inline-screenshots="detailAnnotation?.screenshots"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useVirtualList } from '@vueuse/core'
import { ElMessage } from 'element-plus'
import {
  DArrowLeft,
  Loading,
  RefreshLeft,
  Search,
} from '@element-plus/icons-vue'
import {
  checkReportReady,
  createReportTask,
  listReportTemplates,
  listReports,
  type ReportTemplate,
} from '@/api/report'
import { getCurrentUser } from '@/api/user'
import { getAnnotationList, type Annotation } from '@/api/annotation'
import ReportDetail from '@/views/data/report-detail/index.vue'
import AnnotationDetailDialog from '@/views/annotationWorkbench/components/AnnotationDetailDialog.vue'

const props = defineProps<{
  projectId: number
  scanFileId: number
  projectName?: string
  scanFileName?: string
}>()

const emit = defineEmits<{
  (e: 'prev-step'): void
}>()

const detailRef = ref<InstanceType<typeof ReportDetail> | null>(null)

const preparing = ref(true)
const creating = ref(false)
const reportId = ref<number | null>(null)
const errorMessage = ref('')
const ready = ref(false)
const readyReason = ref('')

/** 已保存批注（供报告选择，默认全选）。 */
const annotations = ref<Annotation[]>([])
const annotationsLoading = ref(false)
const selectedAnnotationIds = ref<number[]>([])
const templates = ref<ReportTemplate[]>([])

/** 选择弹窗状态 */
const selectorVisible = ref(false)
const selectorKeyword = ref('')
const draftSelectedIds = ref<number[]>([])

/** 批注详情弹窗 */
const detailVisible = ref(false)
const detailAnnotation = ref<Annotation | null>(null)
const detailPeriod = computed<[string, string]>(() => [
  detailAnnotation.value?.startDate || '',
  detailAnnotation.value?.endDate || '',
])
const openAnnotationDetail = (item: Annotation) => {
  detailAnnotation.value = item
  detailVisible.value = true
}

const selectedCount = computed(() => selectedAnnotationIds.value.length)
const draftCount = computed(() => draftSelectedIds.value.length)
const draftAllSelected = computed(
  () =>
    annotations.value.length > 0 &&
    draftSelectedIds.value.length === annotations.value.length,
)
const filteredAnnotations = computed(() => {
  const keyword = selectorKeyword.value.trim().toLowerCase()
  if (!keyword) return annotations.value
  return annotations.value.filter((item) =>
    [item.name, item.componentName, item.componentId, item.componentType]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(keyword)),
  )
})
/** 虚拟滚动：标注过多时不渲染全部 DOM，滚动流畅 */
const {
  list: virtualRows,
  containerProps,
  wrapperProps,
} = useVirtualList(filteredAnnotations, {
  itemHeight: 62,
  overscan: 6,
})
const canGenerate = computed(
  () => ready.value && selectedCount.value > 0 && !creating.value,
)

/** 报告名称：直接读写预览页的报告标题（双向绑定）。 */
const reportTitle = computed({
  get: () => (detailRef.value as any)?.reviewForm?.reportTitle ?? '',
  set: (value: string) => {
    const form = (detailRef.value as any)?.reviewForm
    if (form) form.reportTitle = value
  },
})

/** 输出格式（创建报告时下发给后端）。 */
const reportFormat = ref<'pdf' | 'docx'>('pdf')
const reportIncludeScreenshots = ref(true)

/** 报告内容配置（本地章节开关）。 */
const reportContents = ref([
  { id: 'cover', title: '报告封面', enabled: true },
  { id: 'summary', title: '偏差对比摘要', enabled: true },
  { id: 'statistics', title: '偏差统计与分布', enabled: true },
  { id: 'histogram', title: '偏差直方图', enabled: true },
  { id: 'conclusion', title: '结论与建议', enabled: true },
])

const enabledCount = computed(
  () => reportContents.value.filter((item) => item.enabled).length,
)

/** 章节标题的“点击即改”内联编辑状态（一次只编辑一个）。 */
const editingContentId = ref<string | null>(null)
const contentTitleInputEl = ref<HTMLInputElement | null>(null)
const bindContentTitleInput = (el: unknown) => {
  contentTitleInputEl.value = (el as HTMLInputElement) ?? null
}
const startEditContent = async (id: string) => {
  editingContentId.value = id
  await nextTick()
  contentTitleInputEl.value?.focus()
  contentTitleInputEl.value?.select()
}

const CONTENT_TITLE_FALLBACK: Record<string, string> = {
  cover: '报告封面',
  summary: '偏差对比摘要',
  statistics: '偏差统计与分布',
  histogram: '偏差直方图',
  conclusion: '结论与建议',
}

const endEditContent = () => {
  if (reportContents.value.some((item) => !item.title.trim())) {
    // 标题留空时回退到默认文案，避免出现空章节。
    reportContents.value.forEach((item) => {
      if (!item.title.trim()) item.title = CONTENT_TITLE_FALLBACK[item.id] ?? ''
    })
  }
  editingContentId.value = null
}

const severityLabel = (severity?: string) =>
  severity === 'high' ? '高' : severity === 'medium' ? '中' : '低'

const SOURCE_LABELS: Record<string, string> = {
  bim: 'BIM',
  pointcloud: '点云',
  gaussian: '高斯',
  consistencyResult: '实模一致',
}
const sourceLabel = (source?: string) =>
  (source && SOURCE_LABELS[source]) || source || '—'

const formatDate = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return `${date.getMonth() + 1}/${date.getDate()}`
}
const periodText = (item: Annotation) => {
  const start = formatDate(item.startDate)
  const end = formatDate(item.endDate)
  if (start && end) return `${start} ~ ${end}`
  return start || end || ''
}

const isDraftSelected = (id: number) => draftSelectedIds.value.includes(id)

const toggleIds = (list: number[], id: number, checked: boolean) => {
  const set = new Set(list)
  if (checked) set.add(id)
  else set.delete(id)
  return [...set]
}

const openSelector = () => {
  draftSelectedIds.value = [...selectedAnnotationIds.value]
  selectorKeyword.value = ''
  selectorVisible.value = true
}
const confirmSelector = () => {
  selectedAnnotationIds.value = [...draftSelectedIds.value]
  selectorVisible.value = false
}
const toggleDraft = (id: number, value: boolean | string | number) => {
  draftSelectedIds.value = toggleIds(draftSelectedIds.value, id, Boolean(value))
}
const draftSelectAll = () => {
  draftSelectedIds.value = annotations.value.map((item) => item.id)
}
const draftClear = () => {
  draftSelectedIds.value = []
}

/** 作用：分页拉取当前扫描的全部批注（默认全选，支持大量标注）。 */
async function loadAnnotations() {
  if (!props.projectId || !props.scanFileId) return
  annotationsLoading.value = true
  try {
    const pageSize = 200
    const maxPages = 50
    const collected: Annotation[] = []
    let total = Number.POSITIVE_INFINITY
    let page = 1
    while (collected.length < total && page <= maxPages) {
      const res = await getAnnotationList(props.projectId, props.scanFileId, {
        page,
        pageSize,
      })
      const list = res.data?.list ?? []
      total = Number(res.data?.total ?? list.length)
      collected.push(...list)
      if (!list.length) break
      page += 1
    }
    annotations.value = collected
    selectedAnnotationIds.value = collected.map((item) => item.id)
  } catch (error) {
    console.warn('[AnalysisReportView] 加载批注失败:', error)
    annotations.value = []
    selectedAnnotationIds.value = []
  } finally {
    annotationsLoading.value = false
  }
}

async function ensureTemplates() {
  try {
    templates.value = await listReportTemplates()
  } catch {
    templates.value = []
  }
}

const resolveTemplateId = () =>
  templates.value.find((item) => item.isDefault)?.id ||
  templates.value[0]?.id ||
  // 后端模板接口异常时兜底，避免空 templateId 触发服务端错误
  'standard_v1'

async function resolveReportCreator() {
  try {
    const res = await getCurrentUser()
    return res.code === 200 ? String(res.data?.username || '').trim() : ''
  } catch {
    return ''
  }
}

const resolveScanDate = () => {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** 作用：准备报告——检查就绪、加载批注与模板、加载最近一次报告预览。 */
async function prepare() {
  preparing.value = true
  errorMessage.value = ''
  reportId.value = null
  try {
    if (!props.projectId || !props.scanFileId) {
      errorMessage.value = '缺少项目或扫描信息，无法预览报告'
      return
    }

    const readiness = await checkReportReady(props.projectId, props.scanFileId)
    ready.value = readiness.ready
    readyReason.value = readiness.reason || ''

    await Promise.all([loadAnnotations(), ensureTemplates()])

    const result = await listReports({
      projectId: props.projectId,
      scanFileId: props.scanFileId,
      page: 1,
      pageSize: 1,
    })
    const latest = result.list[0]
    if (latest) reportId.value = latest.id
  } catch (error: any) {
    errorMessage.value = error?.message || '准备报告预览失败'
  } finally {
    preparing.value = false
  }
}

const resolveApiErrorMessage = (error: any, fallback: string) => {
  const data = error?.response?.data ?? error?.data
  if (typeof data === 'string' && data.trim()) return data
  if (data && typeof data === 'object') {
    if (typeof data.msg === 'string' && data.msg.trim()) return data.msg
    if (typeof data.message === 'string' && data.message.trim())
      return data.message
  }
  if (typeof error?.msg === 'string' && error.msg.trim()) return error.msg
  return error?.message || fallback
}

/** 作用：按当前选择的批注创建报告任务并预览。 */
async function createAndPreview() {
  if (!props.projectId || !props.scanFileId) {
    ElMessage.warning('缺少项目或扫描信息，无法生成报告')
    return
  }
  if (!ready.value) {
    ElMessage.warning(readyReason.value || '当前扫描不满足报告生成条件')
    return
  }
  if (!selectedCount.value) {
    ElMessage.warning('请至少选择一条批注再生成报告')
    return
  }
  creating.value = true
  try {
    if (!templates.value.length) await ensureTemplates()
    const reportCreator = await resolveReportCreator()

    const created = await createReportTask({
      projectId: props.projectId,
      scanFileId: props.scanFileId,
      projectName: props.projectName || `项目-${props.projectId}`,
      scanFileName: props.scanFileName || '',
      scanDate: resolveScanDate(),
      reportCreator,
      config: {
        templateId: resolveTemplateId(),
        includeScreenshots: reportIncludeScreenshots.value,
        language: 'zh-CN',
        exportFormat: reportFormat.value,
      },
      annotationSnapshot: {
        annotationCount: selectedCount.value,
        annotationIds: [...selectedAnnotationIds.value],
      },
    })
    reportId.value = created.id
    ElMessage.success('报告已生成')
  } catch (error: any) {
    errorMessage.value = resolveApiErrorMessage(error, '生成报告失败')
    ElMessage.error(errorMessage.value)
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  void prepare()
})
</script>

<style lang="scss" scoped>
.analysis-report-view {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: row;
  min-width: 0;
  min-height: 0;
  height: 100%;
  background: var(--bg-page-deep);
}

.analysis-report-view__preview {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.analysis-report-view__state {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-sm);
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.analysis-report-view__state.is-empty strong {
  color: var(--text-primary);
  font-size: var(--font-size-md);
}

.analysis-report-view__state.is-empty.is-blocked strong {
  color: var(--text-tertiary);
}

.report-empty-actions {
  display: inline-flex;
  gap: 10px;
  margin-top: 6px;
}

/* 右侧「出报告」面板 */
.report-config-panel {
  flex: 0 0 var(--editor-panel-width, 360px);
  width: var(--editor-panel-width, 360px);
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text-primary);
  background: var(--bg-page);
  border-left: 1px solid var(--border-color-light);
}

.report-config-panel .control-panel-header {
  flex: 0 0 auto;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: 0px 16px 0px;
  background: var(--bg-muted);
  border-bottom: 1px solid var(--border-color);
}

.report-config-panel .panel-heading strong {
  color: var(--text-primary);
  font-size: var(--font-size-md);
  font-weight: 650;
}

.report-config-panel .panel-step-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.report-config-panel .panel-step-count {
  color: var(--text-tertiary);
  font-family: var(--font-family-number);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.report-config-panel .panel-next-step {
  height: 32px;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 9px 0 11px;
  color: var(--text-secondary);
  background: var(--bg-control);
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-family-base);
  font-size: var(--font-size-xs);
  font-weight: 600;
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.report-config-panel .panel-next-step:hover {
  color: var(--color-primary);
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}

.report-config-panel .panel-next-step .el-icon {
  font-size: 13px;
}

.report-config-panel .panel-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: var(--bg-card);
}

.report-ready-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-sm);
  background: var(--bg-control);
}

.report-ready-block strong {
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.report-ready-block span {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.report-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.report-row__label {
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.report-row__value {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.report-row .report-mini-btn {
  margin-left: auto;
}

.report-mini-btn {
  height: 28px;
  padding: 0 12px;
  color: var(--text-secondary);
  background: var(--bg-control);
  border: 1px solid var(--border-color-light);
  border-radius: 0;
  cursor: pointer;
  font-family: var(--font-family-base);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.report-mini-btn:hover:not(:disabled) {
  color: var(--color-primary);
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}

.report-mini-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.report-config .field-block {
  display: grid;
  gap: 8px;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.report-config .field-block + .field-block {
  margin-top: 16px;
}

.report-config .field-block--inline {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.report-config .square-input :deep(.el-input__wrapper) {
  border-radius: 0;
}

.report-config .format-segment {
  display: inline-flex;
  gap: 0;
  border: 1px solid var(--border-color);
  border-radius: 0;
  overflow: hidden;
}

.report-config .format-segment button {
  padding: 4px 18px;
  color: var(--text-secondary);
  font-family: var(--font-family-base);
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
  background: var(--bg-control);
  border: none;
  border-radius: 0;
  transition:
    color 0.15s ease,
    background 0.15s ease;
}

.report-config .format-segment button + button {
  border-left: 1px solid var(--border-color);
}

.report-config .format-segment button:hover {
  color: var(--color-primary);
}

.report-config .format-segment button.active {
  color: #fff;
  background: var(--color-primary);
}

.report-config .content-config-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 16px;
  margin-top: 18px;
  margin-bottom: 12px;
  border-top: 1px solid var(--border-color-light);
}

.report-config .content-config-heading strong {
  display: block;
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: 650;
}

.report-config .content-config-heading span {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.report-config .reset-content-button {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  color: var(--text-secondary);
  background: var(--bg-control);
  border: 1px solid var(--border-color-light);
  border-radius: 0;
  cursor: pointer;
}

.report-config .reset-content-button:hover {
  color: var(--color-primary);
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}

.report-config .dynamic-content-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 16px;
}

.report-config .dynamic-content-list article {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 2px 0;
  background: none;
  border: none;
}

.report-config .dynamic-content-list article.disabled {
  opacity: 0.55;
}

.report-config .dynamic-content-list :deep(.el-checkbox) {
  flex: none;
  height: auto;
  margin-right: 0;
}

.report-config .dynamic-content-list :deep(.el-checkbox__label) {
  display: none;
}

.report-config .content-title-text {
  flex: 1;
  min-width: 0;
  padding: 1px 2px;
  overflow: hidden;
  color: var(--text-primary);
  font-size: var(--font-size-xs);
  text-align: left;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: text;
  background: none;
  border: none;
}

.report-config .content-title-text:hover {
  color: var(--color-primary);
}

.report-config .content-title-input {
  flex: 1;
  min-width: 0;
  height: 22px;
  padding: 0 6px;
  color: var(--text-primary);
  font-size: var(--font-size-xs);
  background: var(--bg-card);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-xs);
  outline: none;
}

.report-config-footer {
  position: sticky;
  bottom: -16px;
  display: grid;
  gap: 6px;
  padding: 12px 0 4px;
  margin-top: auto;
  background: var(--bg-card);
}

.report-config-footer .report-generate-btn {
  width: 100%;
  border-radius: 0;
}

.report-generate-hint {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  text-align: center;
}
</style>

<!-- 弹窗内容会被 teleport 到 body，需非 scoped 样式 -->
<style>
/* 弹窗容器：使用 Element Plus 主题变量，随亮/暗主题一致 */
.report-selector-dialog {
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 14px;
}

/* 覆盖 .cb-shell 的页面底色，让弹窗使用浮层底色 */
.el-dialog.report-selector-dialog {
  background: var(--el-bg-color-overlay);
}

.report-selector-dialog .el-dialog__body {
  padding: 0;
}

.report-selector-dialog .el-dialog__footer {
  /* padding: 14px 22px 18px; */
}

.report-selector__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.report-selector__heading h3 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 17px;
  font-weight: 650;
  letter-spacing: 0.2px;
}

.report-selector__heading p {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.report-selector__stat {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 10px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
}

.report-selector__stat strong {
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
}

.report-selector__stat span {
  font-size: 12px;
  opacity: 0.85;
}

.report-selector {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.report-selector__toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 22px;
}

.report-selector__search {
  flex: 1 1 auto;
}

.report-selector__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.report-selector__body {
  height: 460px;
  max-height: 46vh;
  min-height: 200px;
  padding: 0 22px;
}

.report-selector__state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 200px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.report-selector__list {
  display: grid;
  gap: 8px;
  padding: 2px 2px 4px;
  margin: 0;
  list-style: none;
}

/* 虚拟滚动要求每个条目等高于 itemHeight（62px） */
.report-selector-item {
  height: 62px;
  box-sizing: border-box;
  padding: 0 0 8px;
}

.report-selector-item__label {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  height: 54px;
  box-sizing: border-box;
  padding: 9px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.report-selector-item__label:hover {
  border-color: var(--el-border-color);
  background: var(--el-fill-color-light);
}

.report-selector-item.is-selected .report-selector-item__label {
  border-color: color-mix(
    in srgb,
    var(--el-color-primary) 45%,
    var(--el-border-color-lighter)
  );
  background: color-mix(
    in srgb,
    var(--el-color-primary) 7%,
    var(--el-bg-color)
  );
}

.report-selector-item__check {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  margin: 2px 0 0;
  accent-color: var(--el-color-primary);
  cursor: pointer;
}

.report-selector-item__body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}

.report-selector-item__row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.report-selector-item__name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  padding: 0;
  border: none;
  color: var(--el-text-color-primary);
  background: transparent;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 600;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.report-selector-item__name:hover {
  color: var(--el-color-primary);
  text-decoration: underline;
}

.report-selector-item__meta {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-selector-item__sev {
  flex: 0 0 auto;
  padding: 1px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.report-selector-item__sev.is-high {
  color: var(--el-color-danger);
  background: color-mix(in srgb, var(--el-color-danger) 14%, transparent);
}

.report-selector-item__sev.is-medium {
  color: var(--el-color-warning);
  background: color-mix(in srgb, var(--el-color-warning) 16%, transparent);
}

.report-selector-item__sev.is-low {
  color: var(--el-color-success);
  background: color-mix(in srgb, var(--el-color-success) 16%, transparent);
}

.report-selector__body::-webkit-scrollbar {
  width: 8px;
}

.report-selector__body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--el-border-color);
}

.report-selector__body::-webkit-scrollbar-track {
  background: transparent;
}
</style>
