<template>
  <div class="report-center-page">
    <el-card class="search-card" shadow="never">
      <el-form :inline="true" :model="filters">
        <el-form-item label="关键词">
          <el-input
            v-model="filters.keyword"
            placeholder="项目名/报告编号/扫描ID"
            clearable
            style="width: 220px"
          />
        </el-form-item>
        <el-form-item label="风险">
          <el-select
            v-model="filters.riskLevel"
            clearable
            placeholder="全部风险"
            style="width: 160px"
          >
            <el-option label="高风险" value="high" />
            <el-option label="中风险" value="medium" />
            <el-option label="低风险" value="low" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadReports">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card" shadow="never">
      <el-table v-loading="loading" :data="tableData" border stripe>
        <el-table-column prop="reportNo" label="报告编号" min-width="180" />
        <el-table-column label="项目/扫描" min-width="190">
          <template #default="{ row }">
            <div class="pair-cell">
              <div>{{ row.projectName }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="版本" width="88" align="center">
          <template #default="{ row }">{{ row.version }}</template>
        </el-table-column>
        <el-table-column label="风险" width="88" align="center">
          <template #default="{ row }">
            <el-tag :type="riskTagType(row.riskLevel)" effect="plain">
              {{ riskLabel(row.riskLevel) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="问题统计" width="180" align="center">
          <template #default="{ row }">
            共 {{ row.issueTotal }} / 高 {{ row.highIssueCount }} / 中
            {{ row.mediumIssueCount }} / 低 {{ row.lowIssueCount }}
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="170" align="center">
          <template #default="{ row }">
            {{ formatDateTime(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right" align="center">
          <template #default="{ row }">
            <div class="actions">
              <el-button type="primary" link @click="goDetail(row.id)">
                预览并导出
              </el-button>
              <el-button type="danger" link @click="handleDelete(row.id)">
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadReports"
          @current-change="loadReports"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useReportAccessStoreHook } from '@/store/modules/report-access'
import {
  deleteReport,
  listReports,
  type ReportRecord,
  type ReportRiskLevel,
} from '@/api/report'

defineOptions({
  name: 'ReportCenter',
})

const route = useRoute()
const router = useRouter()
const reportAccessStore = useReportAccessStoreHook()

const parseQueryNumber = (value: unknown) => {
  const num = Number(Array.isArray(value) ? value[0] : value)
  if (!Number.isFinite(num) || num <= 0) return null
  return num
}

const currentContext = computed(() => ({
  projectId: parseQueryNumber(route.query.projectId),
  scanFileId: parseQueryNumber(route.query.scanFileId),
}))

const filters = reactive<{
  keyword: string
  riskLevel: '' | ReportRiskLevel
}>({
  keyword: '',
  riskLevel: '',
})

const loading = ref(false)
const tableData = ref<ReportRecord[]>([])
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
})

let pollTimer: number | null = null

const riskLabel = (risk: ReportRecord['riskLevel']) => {
  if (risk === 'high') return '高'
  if (risk === 'medium') return '中'
  return '低'
}

const riskTagType = (
  risk: ReportRecord['riskLevel'],
): 'danger' | 'warning' | 'success' => {
  if (risk === 'high') return 'danger'
  if (risk === 'medium') return 'warning'
  return 'success'
}

const hasPendingTask = computed(() =>
  tableData.value.some(
    (item) => item.status === 'queued' || item.status === 'running',
  ),
)

const startPolling = () => {
  if (pollTimer) return
  pollTimer = window.setInterval(() => {
    void loadReports()
  }, 4000)
}

const stopPolling = () => {
  if (!pollTimer) return
  window.clearInterval(pollTimer)
  pollTimer = null
}

const formatDateTime = (value?: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

const loadReports = async () => {
  loading.value = true
  try {
    const res = await listReports({
      page: pagination.page,
      pageSize: pagination.pageSize,
      keyword: filters.keyword.trim() || undefined,
      riskLevel: filters.riskLevel || undefined,
      projectId: currentContext.value.projectId || undefined,
      scanFileId: currentContext.value.scanFileId || undefined,
    })
    tableData.value = res.list
    pagination.total = res.total
    if (hasPendingTask.value) {
      startPolling()
    } else {
      stopPolling()
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '加载报告列表失败')
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.keyword = ''
  filters.riskLevel = ''
  pagination.page = 1
  void loadReports()
}

const goDetail = (reportId: number) => {
  router.push({
    name: 'ReportDetail',
    params: { reportId },
  })
}

const handleDelete = async (reportId: number) => {
  try {
    await ElMessageBox.confirm(
      '确认删除该报告吗？删除后不可恢复。',
      '删除确认',
      {
        type: 'warning',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }

  try {
    await deleteReport(reportId)
    ElMessage.success('报告已删除')
    await loadReports()
  } catch (error: any) {
    ElMessage.error(error?.message || '删除失败')
  }
}

watch(
  () => [route.query.projectId, route.query.scanFileId],
  async () => {
    const projectId = currentContext.value.projectId
    const scanFileId = currentContext.value.scanFileId
    if (projectId && scanFileId) {
      reportAccessStore.activateForProject(projectId, scanFileId)
    } else {
      reportAccessStore.clear()
    }
    pagination.page = 1
    await loadReports()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<style scoped>
.report-center-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pair-cell {
  line-height: 1.35;
}

.actions {
  display: inline-flex;
  gap: 2px;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
