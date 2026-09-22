<template>
  <div class="analysis-report-view">
    <div class="analysis-report-view__preview">
      <div v-if="preparing" class="analysis-report-view__state">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>正在准备报告预览…</span>
      </div>
      <div v-else-if="!reportId" class="analysis-report-view__state is-empty">
        <strong>暂无可预览的报告</strong>
        <span>{{ errorMessage || '请先完成配准与批注后再出报告' }}</span>
        <el-button
          v-if="ready"
          type="primary"
          :loading="creating"
          @click="createAndPreview"
        >
          生成报告
        </el-button>
      </div>
      <ReportDetail v-else ref="detailRef" :report-id="reportId" embedded />
    </div>

    <!-- 出报告：报告配置面板（对齐 cloudBIM-viewer 出报告布局） -->
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
        <div class="panel-section report-config">
          <div class="section-heading report-section-heading">
            <div>
              <h2>报告配置</h2>
              <span class="stage-state ready">{{ enabledCount }} 项</span>
            </div>
            <span class="stage-state ready">待发布</span>
          </div>

          <div class="report-flow">
            <span class="done">配置</span>
            <i />
            <span class="done">预览</span>
            <i />
            <span>导出</span>
          </div>

          <div class="workflow-form">
            <label class="field-block">
              <span>报告名称</span>
              <el-input v-model="reportTitle" maxlength="40" />
            </label>
            <div class="field-block">
              <span>输出格式</span>
              <el-radio-group v-model="reportFormat" class="compact-segment">
                <el-radio-button value="pdf">PDF</el-radio-button>
                <el-radio-button value="json">检测 JSON</el-radio-button>
                <el-radio-button value="xls">CSV · Excel</el-radio-button>
              </el-radio-group>
            </div>
          </div>

          <div class="content-config-heading">
            <div>
              <strong>报告内容配置</strong>
              <span>
                {{ reportContents.length }} 项 · {{ enabledCount }} 项显示
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
              <el-switch
                v-model="item.enabled"
                :aria-label="`显示${item.title}`"
              />
              <el-input v-model="item.title" maxlength="40" />
            </article>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { DArrowLeft, Loading, RefreshLeft } from '@element-plus/icons-vue'
import {
  checkReportReady,
  createReportTask,
  listReportTemplates,
  listReports,
} from '@/api/report'
import ReportDetail from '@/views/data/report-detail/index.vue'

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

/** 报告名称：直接读写预览页的报告标题（双向绑定）。 */
const reportTitle = computed({
  get: () => (detailRef.value as any)?.reviewForm?.reportTitle ?? '',
  set: (value: string) => {
    const form = (detailRef.value as any)?.reviewForm
    if (form) form.reportTitle = value
  },
})

/** 输出格式（本地选择项，供面板展示）。 */
const reportFormat = ref<'pdf' | 'json' | 'xls'>('pdf')

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

/** 作用：为当前扫描自动加载/创建报告，并进入预览。 */
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

    const result = await listReports({
      projectId: props.projectId,
      scanFileId: props.scanFileId,
      page: 1,
      pageSize: 1,
    })
    const latest = result.list[0]
    if (latest) {
      reportId.value = latest.id
      return
    }

    if (readiness.ready) {
      await createAndPreview()
    } else {
      errorMessage.value = readiness.reason || '当前扫描暂不满足报告生成条件'
    }
  } catch (error: any) {
    errorMessage.value = error?.message || '准备报告预览失败'
  } finally {
    preparing.value = false
  }
}

/** 作用：创建报告任务并预览。 */
async function createAndPreview() {
  if (!props.projectId || !props.scanFileId) {
    ElMessage.warning('缺少项目或扫描信息，无法生成报告')
    return
  }
  if (!ready.value) {
    ElMessage.warning(readyReason.value || '当前扫描不满足报告生成条件')
    return
  }
  creating.value = true
  preparing.value = true
  try {
    let templateId = ''
    try {
      const templates = await listReportTemplates()
      templateId =
        templates.find((item) => item.isDefault)?.id || templates[0]?.id || ''
    } catch {
      templateId = ''
    }

    const created = await createReportTask({
      projectId: props.projectId,
      scanFileId: props.scanFileId,
      projectName: props.projectName,
      scanFileName: props.scanFileName,
      config: {
        templateId,
        includeScreenshots: true,
        language: 'zh-CN',
        exportFormat: 'pdf',
      },
    })
    reportId.value = created.id
  } catch (error: any) {
    errorMessage.value = error?.message || '生成报告失败'
    ElMessage.error(errorMessage.value)
  } finally {
    creating.value = false
    preparing.value = false
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
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: 14px 16px 13px;
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
  padding: 16px;
  background: var(--bg-card);
}

.report-config .section-heading.report-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.report-config .report-section-heading > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.report-config .report-section-heading h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-md);
  font-weight: 650;
}

.report-config .stage-state {
  padding: 2px 8px;
  border-radius: var(--radius-pill, 999px);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.report-config .stage-state.ready {
  color: var(--color-primary);
  background: var(--color-primary-soft);
}

.report-config .report-flow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.report-config .report-flow span {
  padding: 2px 6px;
  border-radius: var(--radius-xs);
}

.report-config .report-flow span.done {
  color: var(--color-primary);
  font-weight: 650;
}

.report-config .report-flow i {
  flex: 1;
  height: 1px;
  background: var(--border-color-light);
}

.report-config .workflow-form {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
}

.report-config .field-block {
  display: grid;
  gap: 6px;
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
}

.report-config .compact-segment :deep(.el-radio-button__inner) {
  padding: 6px 10px;
  font-size: var(--font-size-xs);
}

.report-config .content-config-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 12px;
  margin-bottom: 10px;
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
  border-radius: var(--radius-xs);
  cursor: pointer;
}

.report-config .reset-content-button:hover {
  color: var(--color-primary);
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}

.report-config .dynamic-content-list {
  display: grid;
  gap: 8px;
}

.report-config .dynamic-content-list article {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  padding: 8px 10px;
  background: var(--bg-control);
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-sm);
}

.report-config .dynamic-content-list article.disabled {
  opacity: 0.6;
}
</style>
