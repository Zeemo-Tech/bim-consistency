<template>
  <div class="project-management-container">
    <!-- 列表页面 -->
    <div v-if="!detailVisible" class="list-view">
      <!-- 操作区域 -->
      <el-card class="action-card" shadow="never">
        <el-form :inline="true" :model="searchForm" class="search-form">
          <el-form-item label="项目名称">
            <el-input
              v-model="searchForm.keyword"
              placeholder="请输入项目名称或地点"
              clearable
              style="width: 200px"
            />
          </el-form-item>
          <el-form-item label="项目状态">
            <el-select
              v-model="searchForm.status"
              placeholder="请选择状态"
              clearable
              style="width: 150px"
            >
              <el-option label="全部状态" value="" />
              <el-option label="规划中" value="planning" />
              <el-option label="进行中" value="in_progress" />
              <el-option label="已完成" value="completed" />
              <el-option label="已归档" value="archived" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :icon="Search" @click="handleSearch">
              搜索
            </el-button>
            <el-button :icon="Refresh" @click="handleReset">重置</el-button>
          </el-form-item>
        </el-form>

        <div class="action-buttons">
          <el-button type="primary" :icon="Plus" @click="handleCreate">
            新建项目
          </el-button>
          <el-button
            :icon="Delete"
            type="danger"
            plain
            :disabled="selectedRows.length === 0"
            @click="handleBatchDelete"
          >
            批量删除
          </el-button>
        </div>
      </el-card>

      <!-- 表格区域 -->
      <el-card class="table-card" shadow="never">
        <el-table
          v-loading="loading"
          :data="tableData"
          border
          stripe
          :style="{ width: '100%' }"
          :header-cell-style="{ background: '#f5f7fa', color: '#606266' }"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="55" align="center" />
          <el-table-column prop="name" label="项目名称" show-overflow-tooltip />
          <el-table-column
            prop="location"
            label="项目地点"
            show-overflow-tooltip
          />
          <el-table-column prop="status" label="项目状态" align="center">
            <template #default="{ row }">
              <el-tag :type="getStatusTag(row.status)">
                {{ getStatusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="deadline"
            label="截止日期"
            width="180"
            align="center"
            sortable
          >
            <template #default="{ row }">
              {{ formatISODate(row.deadline) }}
            </template>
          </el-table-column>
          <el-table-column
            prop="memberCount"
            label="成员数量"
            width="100"
            align="center"
          >
            <template #default="{ row }">
              {{ row.memberCount || 0 }}
            </template>
          </el-table-column>
          <el-table-column
            label="操作"
            width="250"
            align="center"
            fixed="right"
          >
            <template #default="{ row }">
              <div class="row-actions">
                <el-tooltip
                  placement="top"
                  :disabled="canEnterFourScreen(row)"
                  :content="fourScreenTip(row)"
                >
                  <span class="action-button-wrapper">
                    <el-button
                      text
                      type="primary"
                      :icon="DataAnalysis"
                      :disabled="!canEnterFourScreen(row)"
                      @click="handleFourScreen(row)"
                    >
                      四分屏
                    </el-button>
                  </span>
                </el-tooltip>
                <el-tooltip
                  placement="top"
                  :disabled="canEnterReportCenter(row)"
                  :content="reportEntryTip(row)"
                >
                  <span class="action-button-wrapper">
                    <el-button
                      text
                      type="primary"
                      :icon="Document"
                      :loading="isReportEntryChecking(row)"
                      :disabled="!canEnterReportCenter(row)"
                      @click="handleReportCenter(row)"
                    >
                      报告中心
                    </el-button>
                  </span>
                </el-tooltip>
                <el-dropdown trigger="click">
                  <el-button text class="more-trigger">
                    <el-icon class="more-icon"><MoreFilled /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item :icon="Edit" @click="handleEdit(row)">
                        编辑
                      </el-dropdown-item>
                      <el-dropdown-item :icon="View" @click="handleView(row)">
                        查看
                      </el-dropdown-item>
                      <el-dropdown-item
                        :icon="Delete"
                        divided
                        @click="handleDelete(row)"
                      >
                        删除
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <div class="pagination-container">
          <el-pagination
            v-model:current-page="pagination.currentPage"
            v-model:page-size="pagination.pageSize"
            :total="pagination.total"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </el-card>

      <!-- 新建/编辑项目弹窗 -->
      <el-dialog
        v-model="dialogVisible"
        :title="isEdit ? '编辑项目' : '新建项目'"
        width="600px"
        :close-on-click-modal="false"
      >
        <el-form
          ref="formRef"
          :model="projectForm"
          :rules="formRules"
          label-width="100px"
        >
          <el-form-item label="项目名称" prop="name">
            <el-input
              v-model="projectForm.name"
              placeholder="请输入项目名称"
              maxlength="50"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="项目地点" prop="location">
            <el-input
              v-model="projectForm.location"
              placeholder="请输入项目地点"
              maxlength="100"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="项目状态" prop="status">
            <el-select
              v-model="projectForm.status"
              placeholder="请选择项目状态"
              style="width: 100%"
            >
              <el-option label="规划中" value="planning" />
              <el-option label="进行中" value="in_progress" />
              <el-option label="已完成" value="completed" />
              <el-option label="已归档" value="archived" />
            </el-select>
          </el-form-item>
          <el-form-item label="截止日期" prop="deadline">
            <el-date-picker
              v-model="projectForm.deadline"
              type="datetime"
              placeholder="请选择截止日期"
              style="width: 100%"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss"
              :disabled-date="disabledDate"
            />
          </el-form-item>
          <el-form-item label="项目描述" prop="description">
            <el-input
              v-model="projectForm.description"
              type="textarea"
              :rows="3"
              placeholder="请输入项目描述"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <div class="dialog-footer">
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button
              type="primary"
              :loading="submitLoading"
              @click="handleSubmit"
            >
              确定
            </el-button>
          </div>
        </template>
      </el-dialog>
    </div>

    <!-- 项目详情页 -->
    <ProjectDetail
      v-else
      :project-id="currentProjectId!"
      @back="handleDetailBack"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import {
  Search,
  Refresh,
  Plus,
  Edit,
  Delete,
  View,
  Document,
  DataAnalysis,
  MoreFilled,
} from '@element-plus/icons-vue'
import {
  ElMessage,
  ElMessageBox,
  type FormInstance,
  type FormRules,
} from 'element-plus'
import {
  createProject,
  getProjectList,
  updateProject,
  deleteProject,
  type ProjectData,
  type ProjectListParams,
} from '@/api/project'
import {
  getProjectScans,
  getScanCalibration,
  type ScanListItem,
} from '@/api/scan'
import {
  getProjectFilesByProjectId,
  type FileTypeGroup,
} from '@/api/fileManage'
import { checkReportReady } from '@/api/report'
import { useReportAccessStoreHook } from '@/store/modules/report-access'
import ProjectDetail from './components/ProjectDetail.vue'

defineOptions({
  name: 'ProjectManagement',
})

// 搜索表单
const searchForm = ref({
  keyword: '',
  status: '',
})

const router = useRouter()
const reportAccessStore = useReportAccessStoreHook()

// 表格数据
const tableData = ref<ProjectData[]>([])
const loading = ref(false)
const selectedRows = ref<ProjectData[]>([])
const fourScreenEntryMap = ref<Record<string, number | null>>({})
const fourScreenTipMap = ref<Record<string, string>>({})
const reportEntryMap = ref<Record<string, number | null>>({})
const reportStatusLoadingMap = ref<Record<string, boolean>>({})
const projectDetailEntryMap = ref<Record<string, boolean>>({})
const projectDetailStatusLoadingMap = ref<Record<string, boolean>>({})

// 分页
const pagination = ref({
  currentPage: 1,
  pageSize: 20,
  total: 0,
})

// 弹窗控制
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitLoading = ref(false)
const formRef = ref<FormInstance>()

// 详情页控制
const detailVisible = ref(false)
const currentProjectId = ref<number>()

// 项目表单
const projectForm = reactive<Partial<ProjectData>>({
  name: '',
  description: '',
  location: '',
  status: 'planning',
  deadline: '',
})

// 表单校验规则
const formRules: FormRules = {
  name: [
    { required: true, message: '请输入项目名称', trigger: 'blur' },
    {
      min: 2,
      max: 50,
      message: '项目名称长度在 2 到 50 个字符',
      trigger: 'blur',
    },
  ],
  location: [{ required: true, message: '请输入项目地点', trigger: 'blur' }],
  status: [{ required: true, message: '请选择项目状态', trigger: 'change' }],
  deadline: [
    { required: false, message: '请选择截止日期', trigger: 'change' },
    {
      validator: (rule, value, callback) => {
        if (!value) {
          callback() // 截止日期为可选
          return
        }
        const selectedDate = new Date(value)
        const today = new Date()
        today.setHours(0, 0, 0, 0) // 设置为今天开始时间

        if (selectedDate < today) {
          callback(new Error('截止日期不能是过去的日期'))
        } else {
          callback()
        }
      },
      trigger: 'change',
    },
  ],
}

// 获取状态标签类型
const getStatusTag = (status: string) => {
  const statusMap: Record<string, 'info' | 'primary' | 'success' | 'warning'> =
    {
      planning: 'info',
      in_progress: 'primary',
      completed: 'success',
      archived: 'warning',
    }
  return statusMap[status] || 'info'
}

// 获取状态文本
const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    planning: '规划中',
    in_progress: '进行中',
    completed: '已完成',
    archived: '已归档',
  }
  return statusMap[status] || status
}

const isFileReady = (
  groups: FileTypeGroup[],
  type: 'scan' | 'cad' | 'bim' | 'gauss',
  fileId: number | null | undefined,
) => {
  if (!fileId || !Number.isFinite(fileId)) return false
  const targetGroup = groups.find((item) => item.type === type)
  const targetFile = targetGroup?.files.find(
    (item) => Number(item.id) === Number(fileId),
  )
  return Boolean(
    targetFile && ['stored', 'completed'].includes(targetFile.status),
  )
}

const hasReadyFileByType = (
  groups: FileTypeGroup[],
  type: 'scan' | 'cad' | 'bim' | 'gauss',
) => {
  const targetGroup = groups.find((item) => item.type === type)
  return Boolean(
    targetGroup?.files.some((item) =>
      ['stored', 'completed'].includes(item.status),
    ),
  )
}

const fetchProjectScanList = async (projectId: number) => {
  const all: ScanListItem[] = []
  let page = 1
  const pageSize = 200

  while (true) {
    const response = await getProjectScans(projectId, { page, pageSize })
    if (response.code !== 200) {
      throw new Error(response.msg || '扫描记录查询失败')
    }
    const list = response.data?.list || []
    all.push(...list)
    const total = response.data?.total ?? all.length
    if (list.length === 0 || all.length >= total) break
    page += 1
  }

  return all
}

const findFourScreenReadyScanId = async (projectId: number) => {
  const [scans, filesResponse] = await Promise.all([
    fetchProjectScanList(projectId),
    getProjectFilesByProjectId(projectId),
  ])

  if (filesResponse.code !== 200 || !Array.isArray(filesResponse.data)) {
    throw new Error(filesResponse.msg || '项目文件列表查询失败')
  }

  const groups = filesResponse.data
  const calibrated = scans.filter((item) => item.calibrated)
  calibrated.sort((a, b) => {
    const diff = parseScanDateMs(b.producedAt) - parseScanDateMs(a.producedAt)
    if (diff !== 0) return diff
    return b.scanFileId - a.scanFileId
  })

  let hasDeletedOrUnavailableBinding = false

  for (const item of calibrated) {
    if (!isFileReady(groups, 'scan', item.scanFileId)) {
      hasDeletedOrUnavailableBinding = true
      continue
    }

    let calibration
    try {
      const calibrationResponse = await getScanCalibration(
        projectId,
        item.scanFileId,
      )
      if (calibrationResponse.code !== 200 || !calibrationResponse.data) {
        continue
      }
      calibration = calibrationResponse.data
    } catch (error) {
      console.warn('扫描校准绑定校验失败:', error)
      continue
    }

    if (
      !calibration.bimFileId ||
      !calibration.cadFileId ||
      !calibration.hasGaussBinding ||
      !calibration.gaussFileId
    ) {
      continue
    }

    if (!isFileReady(groups, 'bim', calibration.bimFileId)) {
      hasDeletedOrUnavailableBinding = true
      continue
    }

    if (!isFileReady(groups, 'cad', calibration.cadFileId)) {
      hasDeletedOrUnavailableBinding = true
      continue
    }

    if (!isFileReady(groups, 'gauss', calibration.gaussFileId)) {
      hasDeletedOrUnavailableBinding = true
      continue
    }

    return {
      scanId: item.scanFileId,
      tip: '',
    }
  }

  if (hasDeletedOrUnavailableBinding) {
    return {
      scanId: null,
      tip: '关联文件已被删除或不可用，请先去文件管理重新绑定',
    }
  }

  return {
    scanId: null,
    tip: '请先去文件管理完成 BIM、CAD、高斯模型绑定后再进入四分屏',
  }
}

const ensureFourScreenEntry = async (projectId: number) => {
  const key = String(projectId)
  const result = await findFourScreenReadyScanId(projectId)
  fourScreenEntryMap.value[key] = result.scanId
  fourScreenTipMap.value[key] = result.tip
  return result.scanId
}

const prefetchFourScreenEntryStatus = async (projects: ProjectData[]) => {
  const targets = projects
    .map((project) => Number(project.id))
    .filter((projectId) => Number.isFinite(projectId) && projectId > 0)

  await Promise.all(
    targets.map((projectId) =>
      ensureFourScreenEntry(projectId).catch((error) => {
        const key = String(projectId)
        console.warn('四分屏入口预加载失败:', error)
        fourScreenEntryMap.value[key] = null
        fourScreenTipMap.value[key] = '四分屏入口校验失败，请稍后重试'
      }),
    ),
  )
}

const canEnterFourScreen = (row: ProjectData) => {
  const key = String(row.id)
  return Number.isFinite(fourScreenEntryMap.value[key])
}

const fourScreenTip = (row: ProjectData) => {
  const key = String(row.id)
  return (
    fourScreenTipMap.value[key] ||
    '请先去文件管理完成 BIM、CAD、高斯模型绑定后再进入四分屏'
  )
}

const isReportEntryChecking = (row: ProjectData) => {
  const key = String(row.id)
  return Boolean(reportStatusLoadingMap.value[key])
}

const canEnterReportCenter = (row: ProjectData) => {
  const key = String(row.id)
  return Number.isFinite(reportEntryMap.value[key])
}

const reportEntryTip = (row: ProjectData) => {
  if (isReportEntryChecking(row)) return '正在校验可用扫描'
  if (canEnterReportCenter(row)) return ''
  return '需存在“已校准且有批注”的扫描后才可进入'
}

const parseScanDateMs = (value?: string) => {
  if (!value) return 0
  const date = new Date(`${value}T00:00:00`)
  const ms = date.getTime()
  return Number.isFinite(ms) ? ms : 0
}

const findReportReadyScanId = async (projectId: number) => {
  const scans = await fetchProjectScanList(projectId)
  const sortedScans = [...scans].sort((a, b) => {
    const diff = parseScanDateMs(b.producedAt) - parseScanDateMs(a.producedAt)
    if (diff !== 0) return diff
    return b.scanFileId - a.scanFileId
  })

  for (const item of sortedScans) {
    try {
      const ready = await checkReportReady(projectId, item.scanFileId)
      if (ready.ready) return item.scanFileId
    } catch (error) {
      console.warn('报告就绪状态查询失败:', projectId, item.scanFileId, error)
    }
  }

  return null
}

const ensureReportEntry = async (projectId: number) => {
  const key = String(projectId)
  if (key in reportEntryMap.value) return reportEntryMap.value[key]
  reportStatusLoadingMap.value[key] = true
  try {
    const scanId = await findReportReadyScanId(projectId)
    reportEntryMap.value[key] = scanId
    return scanId
  } catch (error) {
    console.warn('报告入口状态查询失败:', error)
    reportEntryMap.value[key] = null
    return null
  } finally {
    reportStatusLoadingMap.value[key] = false
  }
}

const prefetchReportEntryStatus = async (projects: ProjectData[]) => {
  const targets = projects
    .map((project) => Number(project.id))
    .filter((projectId) => Number.isFinite(projectId) && projectId > 0)

  await Promise.all(targets.map((projectId) => ensureReportEntry(projectId)))
}

const handleFourScreen = async (row: ProjectData) => {
  const projectId = Number(row.id)
  if (!projectId || Number.isNaN(projectId)) {
    ElMessage.warning('缺少项目ID，无法进入四分屏')
    return
  }

  try {
    const scanId = await ensureFourScreenEntry(projectId)
    if (!scanId) {
      ElMessage.warning(
        fourScreenTipMap.value[String(projectId)] ||
          '请先去文件管理完成 BIM、CAD、高斯模型绑定后再进入四分屏',
      )
      return
    }

    router.push({
      name: 'TwoScreenIndex',
      query: {
        projectId: String(projectId),
        projectName: row.name,
        scanFileId: String(scanId),
      },
    })
  } catch (error: any) {
    console.error('四分屏入口校验失败:', error)
    ElMessage.error(error?.message || '四分屏入口校验失败')
    return
  }
}

const handleReportCenter = async (row: ProjectData) => {
  const projectId = Number(row.id)
  if (!projectId || Number.isNaN(projectId)) {
    ElMessage.warning('缺少项目ID，无法进入报告中心')
    return
  }

  const scanId = await ensureReportEntry(projectId)
  if (!scanId) {
    ElMessage.warning('该项目暂无“已校准且有批注”的扫描')
    return
  }

  reportAccessStore.activateForProject(projectId, scanId)

  router.push({
    name: 'ReportCenter',
    query: {
      projectId: String(projectId),
      scanFileId: String(scanId),
      projectName: row.name,
    },
  })
}

// 禁用过去的日期
const disabledDate = (time: Date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return time.getTime() < today.getTime()
}

// 转换日期格式为 ISO 8601 格式 (2025-11-20T11:08:22+08:00)
const formatDateTimeToISO = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  // 获取时区偏移
  const timeZoneOffset = -date.getTimezoneOffset()
  const offsetSign = timeZoneOffset >= 0 ? '+' : '-'
  const offsetHours = Math.floor(Math.abs(timeZoneOffset) / 60)
  const offsetMinutes = Math.abs(timeZoneOffset) % 60
  const offsetString = `${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')}`

  // 格式化为 YYYY-MM-DDTHH:mm:ss+08:00
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetString}`
}

// 格式化ISO日期为本地显示格式
const formatISODate = (isoDateString: string) => {
  if (!isoDateString) return '未设置'

  try {
    const date = new Date(isoDateString)
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')

    return `${year}-${month}-${day} ${hours}:${minutes}`
  } catch (error) {
    return isoDateString
  }
}

// 搜索
const handleSearch = () => {
  pagination.value.currentPage = 1
  loadTableData()
}

// 重置
const handleReset = () => {
  searchForm.value = {
    keyword: '',
    status: '',
  }
  pagination.value.currentPage = 1
  loadTableData()
}

// 新建项目
const handleCreate = () => {
  isEdit.value = false
  dialogVisible.value = true
  resetForm()
}

// 编辑项目
const handleEdit = (row: ProjectData) => {
  isEdit.value = true
  dialogVisible.value = true

  // 处理日期格式转换，将ISO格式转换为datetime组件需要的格式
  const formData = { ...row }
  if (row.deadline) {
    // 将 ISO 格式 (2025-11-20T11:08:22+08:00) 转换为 YYYY-MM-DD HH:mm:ss
    const date = new Date(row.deadline)
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')
    formData.deadline = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  Object.assign(projectForm, formData)
}

// 查看项目详情
const handleView = (row: ProjectData) => {
  void openProjectDetail(row)
}

const ensureProjectDetailEntry = async (projectId: number) => {
  const key = String(projectId)
  if (key in projectDetailEntryMap.value)
    return projectDetailEntryMap.value[key]

  projectDetailStatusLoadingMap.value[key] = true
  try {
    const response = await getProjectFilesByProjectId(projectId)
    if (response.code !== 200 || !Array.isArray(response.data)) {
      throw new Error(response.msg || '项目文件列表查询失败')
    }

    const hasGauss = hasReadyFileByType(response.data, 'gauss')
    projectDetailEntryMap.value[key] = hasGauss
    return hasGauss
  } finally {
    projectDetailStatusLoadingMap.value[key] = false
  }
}

const openProjectDetail = async (row: ProjectData) => {
  const projectId = Number(row.id)
  if (!projectId || Number.isNaN(projectId)) {
    ElMessage.warning('缺少项目ID，无法进入项目管理')
    return
  }

  try {
    const hasGauss = await ensureProjectDetailEntry(projectId)
    if (!hasGauss) {
      ElMessage.warning('当前项目暂无可用高斯模型，暂不可进入项目管理')
      return
    }

    currentProjectId.value = projectId
    detailVisible.value = true
  } catch (error: any) {
    console.error('项目管理入口校验失败:', error)
    ElMessage.error(error?.message || '项目管理入口校验失败')
  }
}

// 详情页返回
const handleDetailBack = () => {
  detailVisible.value = false
  currentProjectId.value = undefined
}

// 删除项目
const handleDelete = (row: ProjectData) => {
  ElMessageBox.confirm(`确定要删除项目 "${row.name}" 吗？`, '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(async () => {
      try {
        await deleteProject(row.id!)
        ElMessage.success('删除成功')
        loadTableData()
      } catch (error) {
        console.error('删除项目失败', error)
      }
    })
    .catch(() => {
      // 用户取消删除
    })
}

// 批量删除
const handleBatchDelete = () => {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要删除的项目')
    return
  }

  ElMessageBox.confirm(
    `确定要删除选中的 ${selectedRows.value.length} 个项目吗？`,
    '警告',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    },
  ).then(async () => {
    try {
      const deletePromises = selectedRows.value.map((row) =>
        deleteProject(row.id!),
      )
      await Promise.all(deletePromises)
      ElMessage.success(`成功删除 ${selectedRows.value.length} 个项目`)
      loadTableData()
    } catch (error) {
      console.error('批量删除项目失败', error)
    }
  })
}

// 选择变化
const handleSelectionChange = (selection: ProjectData[]) => {
  selectedRows.value = selection
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    submitLoading.value = true

    // 准备提交数据，转换日期格式
    const submitData = {
      ...projectForm,
      deadline: projectForm.deadline
        ? formatDateTimeToISO(projectForm.deadline)
        : undefined,
    }

    if (isEdit.value) {
      // 编辑项目
      const response = await updateProject(projectForm.id!, submitData)
      ElMessage.success('更新成功')
    } else {
      // 新建项目
      const response = await createProject(
        submitData as Omit<
          ProjectData,
          'id' | 'memberCount' | 'organizationId'
        >,
      )
      ElMessage.success('创建成功')
    }

    dialogVisible.value = false
    loadTableData()
  } catch (error) {
    console.error('提交表单失败', error)

    let errorMsg = '操作失败，请稍后重试'

    if (error) {
      // 后端有返回业务错误信息
      errorMsg =
        error.response?.data?.msg ||
        error.response?.data?.message ||
        error.message
    }

    ElMessage.error(errorMsg)
  } finally {
    submitLoading.value = false
  }
}

// 重置表单
const resetForm = () => {
  Object.assign(projectForm, {
    name: '',
    description: '',
    location: '',
    status: 'planning',
    deadline: '',
  })
  formRef.value?.clearValidate()
}

// 分页处理
const handleSizeChange = (size: number) => {
  pagination.value.pageSize = size
  loadTableData()
}

const handleCurrentChange = (page: number) => {
  pagination.value.currentPage = page
  loadTableData()
}

// 加载表格数据
const loadTableData = async () => {
  loading.value = true
  try {
    const params: ProjectListParams = {
      page: pagination.value.currentPage,
      pageSize: pagination.value.pageSize,
      keyword: searchForm.value.keyword || undefined,
      status: searchForm.value.status || undefined,
    }

    const response = await getProjectList(params)

    tableData.value = response.data?.list || []
    pagination.value.total = response.data?.total || 0
    projectDetailEntryMap.value = {}
    projectDetailStatusLoadingMap.value = {}
    void prefetchFourScreenEntryStatus(tableData.value)
    void prefetchReportEntryStatus(tableData.value)
  } catch (error) {
    console.error('加载表格数据失败', error)
    ElMessage.error('加载项目列表失败')
    tableData.value = []
    pagination.value.total = 0
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTableData()
})
</script>

<style lang="scss" scoped>
.project-management-container {
  padding: 0;
  width: 100%;
  height: 100%;
  overflow-y: auto;

  .action-card {
    margin-bottom: 20px;
    border-radius: 8px;

    .search-form {
      margin-bottom: 16px;
    }

    .action-buttons {
      display: flex;
      gap: 12px;
    }
  }

  .table-card {
    border-radius: 8px;

    .pagination-container {
      display: flex;
      justify-content: flex-end;
      margin-top: 20px;
    }
  }

  .row-actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .action-button-wrapper {
    display: inline-flex;
  }

  .more-icon {
    transform: rotate(90deg);
  }

  .more-trigger {
    padding: 0 6px;
  }

  .dialog-footer {
    text-align: right;
  }
}

@media screen and (max-width: 768px) {
  .project-management-container {
    .search-form {
      :deep(.el-form-item) {
        display: block;
        margin-right: 0;
      }
    }

    .action-buttons {
      flex-wrap: wrap;
    }
  }
}
</style>
