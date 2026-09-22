<template>
  <section class="analysis-report-step">
    <div class="report-step-card">
      <header class="report-step-head">
        <div class="report-step-head__copy">
          <h2>生成分析成果报告</h2>
          <p>基于当前点云与 BIM 的配准结果生成检测报告，可预览、导出与归档。</p>
        </div>
        <div class="report-step-head__meta">
          <span>{{ projectName || '未命名项目' }}</span>
          <small>{{ scanFileName || '未选择点云' }}</small>
        </div>
      </header>

      <div class="report-ready" :class="`is-${readyTone}`">
        <span class="report-ready__dot" />
        <span class="report-ready__text">{{ readyText }}</span>
        <span v-if="readyDetail" class="report-ready__detail">
          {{ readyDetail }}
        </span>
      </div>

      <div class="report-form">
        <label class="report-field">
          <span class="report-field__label">报告模板</span>
          <el-select
            v-model="form.templateId"
            class="report-field__control"
            placeholder="请选择模板"
            :loading="templatesLoading"
          >
            <el-option
              v-for="item in templates"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </label>

        <label class="report-field">
          <span class="report-field__label">报告语言</span>
          <el-select v-model="form.language" class="report-field__control">
            <el-option label="简体中文" value="zh-CN" />
            <el-option label="English" value="en-US" />
          </el-select>
        </label>

        <label class="report-field">
          <span class="report-field__label">导出格式</span>
          <el-select v-model="form.exportFormat" class="report-field__control">
            <el-option label="PDF" value="pdf" />
            <el-option label="Word (docx)" value="docx" />
          </el-select>
        </label>

        <label class="report-field report-field--switch">
          <span class="report-field__label">包含截图</span>
          <el-switch v-model="form.includeScreenshots" />
        </label>

        <button
          class="report-generate"
          type="button"
          :disabled="generating || !canGenerate"
          @click="handleGenerate"
        >
          {{ generating ? '生成中...' : '生成报告' }}
        </button>
      </div>

      <div class="report-list">
        <div class="report-list__head">
          <h3>历史报告</h3>
          <button
            type="button"
            class="report-list__refresh"
            @click="loadReports"
          >
            刷新
          </button>
        </div>

        <div v-if="reportsLoading" class="report-empty">加载中...</div>
        <div v-else-if="!reports.length" class="report-empty">
          暂无报告，点击「生成报告」创建
        </div>
        <ul v-else class="report-items">
          <li v-for="item in reports" :key="item.id" class="report-item">
            <div class="report-item__main">
              <strong>
                {{ item.reportTitle || item.reportNo || `报告 #${item.id}` }}
              </strong>
              <small>
                {{ statusLabel(item.status) }} ·
                {{ item.updatedAt || item.createdAt }}
              </small>
            </div>
            <div class="report-item__actions">
              <button type="button" @click="openReport(item)">预览</button>
              <button
                type="button"
                class="is-danger"
                :disabled="deletingId === item.id"
                @click="removeReport(item)"
              >
                删除
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  checkReportReady,
  createReportTask,
  deleteReport,
  listReportTemplates,
  listReports,
  type ReportExportFormat,
  type ReportLanguage,
  type ReportRecord,
  type ReportStatus,
  type ReportTemplate,
} from '@/api/report'

const props = defineProps<{
  projectId: number
  scanFileId: number
  projectName?: string
  scanFileName?: string
}>()

const router = useRouter()

const ready = ref(false)
const readyReason = ref('')
const annotationTotal = ref(0)
const readyLoading = ref(false)

const templates = ref<ReportTemplate[]>([])
const templatesLoading = ref(false)

const reports = ref<ReportRecord[]>([])
const reportsLoading = ref(false)
const generating = ref(false)
const deletingId = ref<number | null>(null)

const form = reactive<{
  templateId: string
  language: ReportLanguage
  exportFormat: ReportExportFormat
  includeScreenshots: boolean
}>({
  templateId: '',
  language: 'zh-CN',
  exportFormat: 'pdf',
  includeScreenshots: true,
})

const canGenerate = computed(() =>
  Boolean(props.projectId && props.scanFileId && ready.value),
)

const readyTone = computed(() => {
  if (readyLoading.value) return 'loading'
  return ready.value ? 'ok' : 'warn'
})

const readyText = computed(() => {
  if (readyLoading.value) return '正在检查报告生成条件...'
  return ready.value ? '满足报告生成条件' : '暂不满足报告生成条件'
})

const readyDetail = computed(() => {
  if (readyLoading.value) return ''
  if (ready.value) {
    return annotationTotal.value > 0
      ? `已关联 ${annotationTotal.value} 条批注`
      : '配准已完成，可直接生成报告'
  }
  return readyReason.value || '请先完成点云与工程坐标配准'
})

const statusLabels: Record<ReportStatus, string> = {
  queued: '排队中',
  running: '生成中',
  review_pending: '待复核',
  done: '已完成',
  failed: '生成失败',
}

function statusLabel(status: ReportStatus) {
  return statusLabels[status] || status
}

async function loadReadiness() {
  if (!props.projectId || !props.scanFileId) return
  readyLoading.value = true
  try {
    const result = await checkReportReady(props.projectId, props.scanFileId)
    ready.value = result.ready
    readyReason.value = result.reason || ''
    annotationTotal.value = result.annotationTotal
  } catch (error: any) {
    ready.value = false
    readyReason.value = error?.message || '报告条件检查失败'
  } finally {
    readyLoading.value = false
  }
}

async function loadTemplates() {
  templatesLoading.value = true
  try {
    templates.value = await listReportTemplates()
    const exists = templates.value.some((item) => item.id === form.templateId)
    if (!exists && templates.value.length) {
      form.templateId = templates.value[0].id
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '加载报告模板失败')
  } finally {
    templatesLoading.value = false
  }
}

async function loadReports() {
  if (!props.projectId || !props.scanFileId) return
  reportsLoading.value = true
  try {
    const result = await listReports({
      projectId: props.projectId,
      scanFileId: props.scanFileId,
      page: 1,
      pageSize: 50,
    })
    reports.value = result.list
  } catch (error: any) {
    ElMessage.error(error?.message || '加载报告列表失败')
  } finally {
    reportsLoading.value = false
  }
}

async function handleGenerate() {
  if (generating.value) return
  if (!props.projectId || !props.scanFileId) {
    ElMessage.warning('缺少项目或扫描信息，无法生成报告')
    return
  }
  if (!ready.value) {
    ElMessage.warning(readyReason.value || '当前扫描不满足报告生成条件')
    return
  }
  if (!form.templateId) {
    ElMessage.warning('请先选择报告模板')
    return
  }
  generating.value = true
  try {
    const created = await createReportTask({
      projectId: props.projectId,
      scanFileId: props.scanFileId,
      projectName: props.projectName,
      scanFileName: props.scanFileName,
      config: {
        templateId: form.templateId,
        includeScreenshots: form.includeScreenshots,
        language: form.language,
        exportFormat: form.exportFormat,
      },
    })
    ElMessage.success('报告任务已创建，正在进入预览页')
    await router.push({
      name: 'ReportDetail',
      params: { reportId: created.id },
    })
  } catch (error: any) {
    ElMessage.error(error?.message || '报告生成失败')
  } finally {
    generating.value = false
  }
}

function openReport(report: ReportRecord) {
  void router.push({ name: 'ReportDetail', params: { reportId: report.id } })
}

async function removeReport(report: ReportRecord) {
  try {
    await ElMessageBox.confirm(
      `确定删除报告「${report.reportTitle || report.reportNo || report.id}」吗？`,
      '删除报告',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  deletingId.value = report.id
  try {
    await deleteReport(report.id)
    ElMessage.success('报告已删除')
    await loadReports()
  } catch (error: any) {
    ElMessage.error(error?.message || '删除报告失败')
  } finally {
    deletingId.value = null
  }
}

onMounted(() => {
  void loadReadiness()
  void loadTemplates()
  void loadReports()
})
</script>

<style scoped lang="scss">
.analysis-report-step {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: auto;
  position: relative;
  padding: 22px 22px 34px;
  background: var(--bg-page-deep);
}

.report-step-card {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 24px;
  border: 1px solid var(--border-color-light, rgba(255, 255, 255, 0.12));
  border-radius: 12px;
  background: var(--bg-card, rgba(255, 255, 255, 0.04));
}

.report-step-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;

  h2 {
    margin: 0 0 6px;
    font-size: 18px;
    font-weight: 600;
  }

  p {
    margin: 0;
    font-size: 13px;
    color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  }
}

.report-step-head__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  font-size: 13px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));

  small {
    font-size: 12px;
    opacity: 0.8;
  }
}

.report-ready {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  border: 1px solid transparent;

  &.is-ok {
    background: rgba(82, 196, 26, 0.12);
    border-color: rgba(82, 196, 26, 0.35);
    color: #b7eb8f;
  }

  &.is-warn {
    background: rgba(250, 173, 20, 0.12);
    border-color: rgba(250, 173, 20, 0.35);
    color: #ffe58f;
  }

  &.is-loading {
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  }
}

.report-ready__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  flex: 0 0 auto;
}

.report-ready__detail {
  opacity: 0.85;
}

.report-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px 18px;
  align-items: end;
}

.report-field {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &--switch {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.report-field__label {
  font-size: 13px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
}

.report-field__control {
  width: 100%;
}

.report-generate {
  grid-column: 1 / -1;
  justify-self: flex-start;
  padding: 0 22px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: var(--color-primary, #409eff);
  color: #fff;
  font-size: 14px;
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.report-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px solid var(--border-color-light, rgba(255, 255, 255, 0.12));
  padding-top: 16px;
}

.report-list__head {
  display: flex;
  align-items: center;
  justify-content: space-between;

  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }
}

.report-list__refresh {
  padding: 4px 12px;
  border: 1px solid var(--border-color-light, rgba(255, 255, 255, 0.16));
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}

.report-empty {
  padding: 22px;
  text-align: center;
  font-size: 13px;
  color: var(--text-tertiary, rgba(255, 255, 255, 0.45));
}

.report-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.report-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border-color-light, rgba(255, 255, 255, 0.12));
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
}

.report-item__main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;

  strong {
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    font-size: 12px;
    color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  }
}

.report-item__actions {
  display: flex;
  gap: 8px;
  flex: 0 0 auto;

  button {
    padding: 5px 12px;
    border: 1px solid var(--border-color-light, rgba(255, 255, 255, 0.16));
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font-size: 12px;
    cursor: pointer;

    &.is-danger:hover {
      color: #ff7875;
      border-color: #ff7875;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}
</style>
