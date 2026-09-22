<template>
  <div class="analysis-report-view">
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
    <ReportDetail v-else :report-id="reportId" embedded />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
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

const preparing = ref(true)
const creating = ref(false)
const reportId = ref<number | null>(null)
const errorMessage = ref('')
const ready = ref(false)
const readyReason = ref('')

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
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-page-deep);
  grid-column: 1 / -1;
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
</style>
