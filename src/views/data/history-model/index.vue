<!-- 文件管理 -->
<template>
  <div class="history-model-container">
    <!-- 搜索表单组件 -->
    <SearchForm
      v-model="searchForm"
      :project-list="searchProjectList"
      :building-options="searchBuildingOptions"
      :floor-options="searchFloorOptions"
      @search="handleSearch"
      @reset="handleReset"
      @upload="handleUpload"
      @add-project="handleAddProject"
    />

    <!-- 统计卡片组件 -->
    <StatisticsCards :statistics="statistics" />

    <!-- 上传中提示 -->
    <el-alert
      v-if="hasUploadingFiles"
      title="有文件正在上传中"
      type="warning"
      :closable="false"
      show-icon
      class="uploading-alert"
    >
      <template #default>
        <span>
          检测到有文件正在上传处理中，可通过下方列表右上角的“刷新列表”查看最新状态
        </span>
      </template>
    </el-alert>

    <!-- 项目表格组件 -->
    <ProjectTable
      :table-data="projectTableData"
      :loading="loading"
      :toolbar-notice="remeshToolbarNotice"
      :pagination="pagination"
      @refresh="loadTableData"
      @view-calendar="handleViewCalendar"
      @file-command="handleFileCommand"
      @scan-calibration="handleScanCalibration"
      @page-change="handleCurrentChange"
      @size-change="handleSizeChange"
    />

    <!-- 扫描历史日历弹窗 -->
    <ScanCalendarDialog
      v-model="scanCalendarVisible"
      :project-name="currentProjectName"
      :scan-count="selectedProjectScanCount"
      :scan-records="currentProjectScanRecords"
      @calibrate="handleOpenCalibration"
      @delete="handleDeleteScan"
      @view-point-cloud="handleViewPointCloud"
      @view-trajectory="handleViewTrajectory"
      @calibration="handleCalibration"
    />

    <!-- 上传文件弹窗 -->
    <UploadDialog
      ref="uploadDialogRef"
      v-model="uploadDialogVisible"
      @confirm="handleUploadConfirm"
      @resume-upload="handleResumeUpload"
      @pause-upload="handlePauseUpload"
    />

    <!-- 3D坐标校准弹窗 -->
    <CalibrationDialog
      ref="calibrationDialogRef"
      v-model="calibrationVisible"
      :scan-data="currentScanData"
      :bim-list="currentProjectBimList"
      :cad-list="currentProjectCadList"
      :gauss-list="currentProjectGaussList"
      :is-deleted="isScanDeleted"
      @selection-change="handleCalibrationSelectionChange"
      @complete="handleCalibrationComplete"
      @calibrate-b-i-m="handleCalibrateBIM"
      @calibrate-c-a-d="handleCalibrateCAD"
    />

    <!-- 文件详情弹窗 -->
    <FileDetailDialog
      v-model="fileDetailVisible"
      :file-data="selectedFile"
      @preview="handlePreviewFile"
      @download="handleDownloadFile"
    />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import SearchForm from './components/SearchForm.vue'
import StatisticsCards from './components/StatisticsCards.vue'
import ProjectTable from './components/ProjectTable.vue'
import ScanCalendarDialog from './components/ScanCalendarDialog.vue'
import UploadDialog from './components/UploadDialog.vue'
import CalibrationDialog from './components/CalibrationDialog.vue'
import FileDetailDialog from './components/FileDetailDialog.vue'
import type { ProjectData, FileData } from './components/ProjectTable.vue'
import type { ScanRecord } from './components/ScanCalendarDialog.vue'
import type { ScanData } from './components/CalibrationDialog.vue'
import type { UploadFormData } from './components/UploadDialog.vue'
import type { StatisticsData } from './components/StatisticsCards.vue'
import {
  getProjectFiles,
  getProjectFilesByProjectId,
  deleteProjectFile,
  getProjectBuildings,
  type MeshRemeshSummary,
  type ProjectBuildingInfo,
  type ProjectInfo,
  type FileTypeGroup,
} from '@/api/fileManage'
import { remeshBimFile } from '@/api/mesh'
import {
  getProjectScans,
  getScanCalibration,
  type ScanCalibration,
  type ScanListItem,
} from '@/api/scan'
import { saveGaussAlignment } from '@/api/calibration'
import { getAllProjects } from '@/api/project'

/**
 * 组件定义
 */
defineOptions({
  name: 'HistoryModel',
})

const router = useRouter()

const CALIBRATION_RETURN_KEY = 'calibration:return'
const HISTORY_MODEL_RELOAD_KEY = 'history-model:reload-once'
const HISTORY_MODEL_BACK_RELOAD_GUARD_KEY = 'history-model:back-reload-guard'
const SCAN_GAUSS_SELECTION_KEY = 'history-model:scan-gauss-selection'

const resolveGaussAssetPath = (_fileName: string) => {
  return 'meta.lcc'
}

interface FileSelectionOption {
  id: string
  name: string
  buildingName?: string | null
  floorName?: string | null
}

interface SearchProjectOption {
  id: number
  name: string
}

const loadScanGaussSelectionMap = (): Record<
  string,
  { gaussId: string; gaussName: string; gaussAssetPath: string }
> => {
  const raw = sessionStorage.getItem(SCAN_GAUSS_SELECTION_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    // ignore
  }
  return {}
}

const saveScanGaussSelection = (
  scanId: string,
  selection: { gaussId: string; gaussName: string; gaussAssetPath: string },
) => {
  if (!scanId) return
  const map = loadScanGaussSelectionMap()
  map[scanId] = selection
  sessionStorage.setItem(SCAN_GAUSS_SELECTION_KEY, JSON.stringify(map))
}

const getScanGaussSelection = (scanId: string) => {
  if (!scanId) return null
  const map = loadScanGaussSelectionMap()
  return map[scanId] || null
}

const applyCalibrationReturnState = async () => {
  const raw = sessionStorage.getItem(CALIBRATION_RETURN_KEY)
  if (!raw) return

  sessionStorage.removeItem(CALIBRATION_RETURN_KEY)

  let state: any
  try {
    state = JSON.parse(raw)
  } catch {
    return
  }

  const scanId = typeof state?.scanId === 'string' ? state.scanId : ''
  if (!scanId) return

  const project = projectTableData.value.find((p) =>
    (p.files || []).some(
      (f) =>
        String(f.id) === scanId &&
        (f.fileType === 'scan' || f.type === '扫描数据'),
    ),
  )
  const fallbackProjectId =
    typeof state?.projectId === 'string' ? state.projectId : ''
  const fallbackProjectName =
    typeof state?.projectName === 'string' ? state.projectName : ''
  const resolveCadSelectionForBim = (
    bimId: string,
    preferredCadId: string,
    preferredCadName: string,
  ) => {
    const bimBuildingName =
      currentProjectBimList.value.find((item) => item.id === bimId)
        ?.buildingName || ''

    if (!preferredCadId) {
      return {
        cadId: '',
        cadName: '',
      }
    }

    const preferredCad = currentProjectCadList.value.find(
      (item) => item.id === preferredCadId,
    )
    if (!bimBuildingName) {
      return {
        cadId: preferredCadId,
        cadName: preferredCadName || preferredCad?.name || '',
      }
    }

    if (preferredCad?.buildingName === bimBuildingName) {
      return {
        cadId: preferredCadId,
        cadName: preferredCadName || preferredCad.name,
      }
    }

    const matchedCad = currentProjectCadList.value.find(
      (item) => item.buildingName === bimBuildingName,
    )
    return {
      cadId: matchedCad?.id || '',
      cadName: matchedCad?.name || '',
    }
  }

  if (project) {
    currentProjectName.value = project.name
    currentProjectBimList.value = buildProjectBimList(project)
    currentProjectCadList.value = buildProjectCadList(project)
    currentProjectGaussList.value = buildProjectGaussList(project)
  } else {
    if (fallbackProjectName) {
      currentProjectName.value = fallbackProjectName
    }
    const fallbackProjectIdNum = Number(fallbackProjectId)
    if (Number.isFinite(fallbackProjectIdNum) && fallbackProjectIdNum > 0) {
      const groups = await fetchProjectFileGroups(fallbackProjectIdNum)
      if (groups.length > 0) {
        currentProjectBimList.value = buildListFromFileGroups(groups, 'bim')
        currentProjectCadList.value = buildListFromFileGroups(groups, 'cad')
        currentProjectGaussList.value = buildListFromFileGroups(groups, 'gauss')
      }
    }
  }

  currentScanData.value = {
    id: scanId,
    title:
      typeof state?.title === 'string' && state.title
        ? state.title
        : currentScanData.value.title,
    date:
      typeof state?.date === 'string' && state.date
        ? state.date
        : currentScanData.value.date,
    uploader:
      typeof state?.uploader === 'string' && state.uploader
        ? state.uploader
        : currentScanData.value.uploader,
    projectId:
      project?.id || fallbackProjectId || currentScanData.value.projectId || '',
    projectName:
      project?.name ||
      fallbackProjectName ||
      currentProjectName.value ||
      currentScanData.value.projectName ||
      '',
    bimFileId:
      typeof state?.bimId === 'string' && state.bimId
        ? state.bimId
        : currentScanData.value.bimFileId,
    bimFile:
      typeof state?.bimName === 'string' && state.bimName
        ? state.bimName
        : currentScanData.value.bimFile,
    cadFileId:
      typeof state?.cadId === 'string' && state.cadId
        ? state.cadId
        : currentScanData.value.cadFileId,
    cadFile:
      typeof state?.cadName === 'string' && state.cadName
        ? state.cadName
        : currentScanData.value.cadFile,
    gaussFileId:
      typeof state?.gaussId === 'string' && state.gaussId
        ? state.gaussId
        : currentScanData.value.gaussFileId,
    gaussFile:
      typeof state?.gaussName === 'string' && state.gaussName
        ? state.gaussName
        : currentScanData.value.gaussFile,
    gaussAssetPath:
      typeof state?.gaussAssetPath === 'string' && state.gaussAssetPath
        ? state.gaussAssetPath
        : currentScanData.value.gaussAssetPath,
    pointCloudFile:
      typeof state?.pointCloudName === 'string' && state.pointCloudName
        ? state.pointCloudName
        : currentScanData.value.pointCloudFile,
  }

  const fallbackBimId =
    typeof state?.bimId === 'string' && state.bimId ? state.bimId : ''
  const fallbackBimName =
    typeof state?.bimName === 'string' && state.bimName ? state.bimName : ''
  if (fallbackBimId && fallbackBimName) {
    const hasBim = currentProjectBimList.value.some(
      (item) => item.id === fallbackBimId,
    )
    if (!hasBim) {
      currentProjectBimList.value = [
        { id: fallbackBimId, name: fallbackBimName },
        ...currentProjectBimList.value,
      ]
    }
  }

  const fallbackCadId =
    typeof state?.cadId === 'string' && state.cadId ? state.cadId : ''
  const fallbackCadName =
    typeof state?.cadName === 'string' && state.cadName ? state.cadName : ''
  if (fallbackCadId && fallbackCadName) {
    const hasCad = currentProjectCadList.value.some(
      (item) => item.id === fallbackCadId,
    )
    if (!hasCad) {
      currentProjectCadList.value = [
        { id: fallbackCadId, name: fallbackCadName },
        ...currentProjectCadList.value,
      ]
    }
  }

  const fallbackGaussId =
    typeof state?.gaussId === 'string' && state.gaussId ? state.gaussId : ''
  const fallbackGaussName =
    typeof state?.gaussName === 'string' && state.gaussName
      ? state.gaussName
      : ''
  if (fallbackGaussId && fallbackGaussName) {
    const hasGauss = currentProjectGaussList.value.some(
      (item) => item.id === fallbackGaussId,
    )
    if (!hasGauss) {
      currentProjectGaussList.value = [
        { id: fallbackGaussId, name: fallbackGaussName },
        ...currentProjectGaussList.value,
      ]
    }
  }

  let resolvedBimCompleted = Boolean(state?.bimCompleted)
  let resolvedCadCompleted = Boolean(state?.cadCompleted)

  const projectId = Number(currentScanData.value.projectId)
  const scanFileId = Number(scanId)
  if (
    Number.isFinite(projectId) &&
    projectId > 0 &&
    Number.isFinite(scanFileId) &&
    scanFileId > 0
  ) {
    const calibration = await fetchScanCalibration(projectId, scanFileId)
    if (calibration) {
      const calibrationBimFileId =
        calibration.bimFileId != null ? String(calibration.bimFileId) : ''
      const calibrationCadFileId =
        calibration.cadFileId != null ? String(calibration.cadFileId) : ''
      const bimFile =
        currentProjectBimList.value.find(
          (item) => item.id === calibrationBimFileId,
        )?.name || ''
      const cadFile =
        currentProjectCadList.value.find(
          (item) => item.id === calibrationCadFileId,
        )?.name || ''
      const shouldKeepStateBimSelection =
        typeof state?.bimId === 'string' &&
        !!state.bimId &&
        currentProjectBimList.value.some((item) => item.id === state.bimId)
      const nextBimId = shouldKeepStateBimSelection
        ? state.bimId
        : calibrationBimFileId
      const nextBimName =
        shouldKeepStateBimSelection && typeof state?.bimName === 'string'
          ? state.bimName
          : bimFile || currentScanData.value.bimFile
      const shouldKeepStateCadSelection =
        typeof state?.cadId === 'string' && !!state.cadId
      const { cadId: nextCadId, cadName: nextCadName } =
        resolveCadSelectionForBim(
          nextBimId,
          shouldKeepStateCadSelection ? state.cadId : calibrationCadFileId,
          shouldKeepStateCadSelection && typeof state?.cadName === 'string'
            ? state.cadName
            : cadFile,
        )

      if (
        calibrationBimFileId &&
        !currentProjectBimList.value.some(
          (item) => item.id === calibrationBimFileId,
        )
      ) {
        currentProjectBimList.value = [
          {
            id: calibrationBimFileId,
            name: bimFile || `BIM ${calibrationBimFileId}`,
            buildingName: calibration.bimBuildingName,
          },
          ...currentProjectBimList.value,
        ]
      }

      if (
        calibrationCadFileId &&
        !currentProjectCadList.value.some(
          (item) => item.id === calibrationCadFileId,
        )
      ) {
        currentProjectCadList.value = [
          {
            id: calibrationCadFileId,
            name: cadFile || `CAD ${calibrationCadFileId}`,
            buildingName: calibration.cadBuildingName,
            floorName: calibration.cadFloorName,
          },
          ...currentProjectCadList.value,
        ]
      }

      currentScanData.value = {
        ...currentScanData.value,
        bimFileId: nextBimId,
        cadFileId: nextCadId,
        bimFile: nextBimName,
        cadFile: nextCadName || currentScanData.value.cadFile,
      }

      updateScanRecordCalibration(scanId, calibration)
      resolvedBimCompleted =
        calibration.hasBimAlignment &&
        (!nextBimId || String(calibration.bimFileId ?? '') === nextBimId)
      resolvedCadCompleted =
        calibration.hasCadAlignment &&
        (!nextCadId || String(calibration.cadFileId ?? '') === nextCadId)
    }
  }

  isScanDeleted.value = false
  calibrationVisible.value = true

  await nextTick()
  calibrationDialogRef.value?.resetCalibration?.()
  if (resolvedBimCompleted) {
    calibrationDialogRef.value?.setBimCalibrationCompleted?.(true)
  }
  if (resolvedCadCompleted) {
    if (!resolvedBimCompleted && state?.bimCompleted) {
      calibrationDialogRef.value?.setBimCalibrationCompleted?.(true)
    }
    calibrationDialogRef.value?.setCadCalibrationCompleted?.(true)
  }
  if (resolvedBimCompleted || resolvedCadCompleted) {
    calibrationDialogRef.value?.goToStep?.('cad')
  }
}

const buildListFromFileGroups = (
  groups: FileTypeGroup[],
  type: 'bim' | 'cad' | 'gauss',
): FileSelectionOption[] => {
  const group = groups.find((item) => item.type === type)
  if (!group?.files?.length) return []
  const sorted = [...group.files].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
  return sorted.map((file) => ({
    id: String(file.id),
    name: formatDisplayFileName(
      type,
      file.originalName,
      file.buildingName,
      file.floorName,
    ),
    buildingName: file.buildingName,
    floorName: file.floorName,
  }))
}

const fetchProjectFileGroups = async (
  projectId: number,
): Promise<FileTypeGroup[]> => {
  try {
    const res = await getProjectFilesByProjectId(projectId)
    if (res.code === 200 && Array.isArray(res.data)) {
      return res.data
    }
  } catch (error) {
    console.warn('获取项目文件列表失败:', error)
  }
  return []
}

/**
 * 搜索表单数据
 */
const searchForm = ref({
  buildingName: '',
  fileName: '',
  projectName: '',
  projectId: null as number | null,
  fileType: '',
  floorName: '',
  dateRange: [],
})

const searchProjectList = ref<SearchProjectOption[]>([])
const searchProjectBuildings = ref<ProjectBuildingInfo[]>([])
const searchProjectBuildingsCache = ref<Record<number, ProjectBuildingInfo[]>>(
  {},
)

const normalizeSlotName = (value?: string | null) => value?.trim() || ''

const mergeUniqueFilterOptions = (
  ...groups: Array<Array<string | undefined>>
) =>
  Array.from(
    new Set(
      groups
        .flat()
        .map((item) => normalizeSlotName(item))
        .filter((item) => !!item),
    ),
  )

const loadSearchProjectList = async () => {
  try {
    const response = await getAllProjects()
    if (response.code === 200) {
      searchProjectList.value = response.data.list.map((project) => ({
        id: project.id,
        name: project.name,
      }))
    }
  } catch (error) {
    console.error('加载筛选项目列表失败:', error)
  }
}

const loadSearchProjectBuildings = async (projectId: number, force = false) => {
  const cached = searchProjectBuildingsCache.value[projectId]
  if (!force && cached) {
    searchProjectBuildings.value = cached
    return cached
  }

  try {
    const response = await getProjectBuildings(projectId)
    const buildings =
      response.code === 200 && Array.isArray(response.data) ? response.data : []
    searchProjectBuildingsCache.value = {
      ...searchProjectBuildingsCache.value,
      [projectId]: buildings,
    }
    if (searchForm.value.projectId === projectId) {
      searchProjectBuildings.value = buildings
    }
    return buildings
  } catch (error) {
    console.error('加载筛选幢层树失败:', error)
    if (searchForm.value.projectId === projectId) {
      searchProjectBuildings.value = []
    }
    return []
  }
}

const searchBuildingOptions = computed(() =>
  mergeUniqueFilterOptions(
    searchProjectBuildings.value.map((item) => item.buildingName),
  ),
)

const searchFloorOptions = computed(() => {
  const buildingName = normalizeSlotName(searchForm.value.buildingName)
  if (!buildingName) return []
  const floors =
    searchProjectBuildings.value
      .find((item) => item.buildingName === buildingName)
      ?.floors.map((item) => item.floorName) || []
  return mergeUniqueFilterOptions(floors)
})

/**
 * 统计数据
 */
const statistics = ref<StatisticsData>({
  bimCount: 0,
  cadCount: 0,
  pointCloudCount: 0,
  gaussCount: 0,
  usedStorage: 0,
  projectCount: 0,
})

/**
 * 项目表格数据
 */
const projectTableData = ref<ProjectData[]>([])

/**
 * 表格加载状态
 */
const loading = ref(false)

/**
 * 分页配置
 */
const pagination = ref({
  currentPage: 1,
  pageSize: 10,
  total: 0,
})

/**
 * 扫描日历弹窗显示状态
 */
const scanCalendarVisible = ref(false)

/**
 * 当前项目名称
 */
const currentProjectName = ref('')

/**
 * 当前项目扫描数量
 */
const selectedProjectScanCount = ref(0)

/**
 * 当前项目扫描记录（用于日历右侧详情）
 */
const currentProjectScanRecords = ref<Record<string, ScanRecord[]>>({})

/**
 * 当前项目 BIM 文件列表（用于校准时选择）
 */
const currentProjectBimList = ref<FileSelectionOption[]>([])

/**
 * 当前项目 CAD 文件列表（用于校准时选择）
 */
const currentProjectCadList = ref<FileSelectionOption[]>([])

/**
 * 当前项目 高斯文件列表（用于校准时选择）
 */
const currentProjectGaussList = ref<FileSelectionOption[]>([])

/**
 * 上传文件弹窗显示状态
 */
const uploadDialogVisible = ref(false)

/**
 * 上传弹窗引用
 */
const uploadDialogRef = ref()

/**
 * 当前上传器实例
 */
const currentUploader = ref<any | null>(null)

/**
 * 检测是否有文件正在上传中
 */
const hasUploadingFiles = computed(() => {
  return projectTableData.value.some((project) =>
    project.files.some((file) => file.status === 'pending_external'),
  )
})

const activeRemeshCount = computed(() => {
  return projectTableData.value.reduce((count, project) => {
    return (
      count +
      project.files.filter((file) => {
        return (
          file.fileType === 'bim' &&
          file.meshRemesh?.supported &&
          ['queued', 'processing'].includes(file.meshRemesh.status || '')
        )
      }).length
    )
  }, 0)
})

const remeshToolbarNotice = computed(() => {
  if (!activeRemeshCount.value) return ''
  return `当前有 ${activeRemeshCount.value} 个 BIM 文件处于网格均匀化任务处理中，可通过刷新列表立即查看最新状态`
})

/**
 * 校准弹窗显示状态
 */
const calibrationVisible = ref(false)

/**
 * 校准弹窗引用
 */
const calibrationDialogRef = ref()

/**
 * 当前扫描数据
 */
const currentScanData = ref<ScanData>({
  id: '',
  title: '',
  date: '',
  uploader: '',
  projectId: '',
  projectName: '',
  pointCloudBuildingName: '',
  pointCloudFloorName: '',
  bimFileId: '',
  bimFile: '',
  cadFileId: '',
  cadFile: '',
  gaussFileId: '',
  gaussFile: '',
  gaussAssetPath: 'meta.lcc',
  pointCloudFile: '',
})

/**
 * 扫描记录删除状态
 */
const isScanDeleted = ref(false)

/**
 * 文件详情弹窗显示状态
 */
const fileDetailVisible = ref(false)

/**
 * 选中的文件
 */
const selectedFile = ref<FileData>({
  id: '',
  type: '',
  name: '',
  size: '',
  status: '',
  uploader: '',
  uploadTime: '',
  fileType: '',
})

let remeshPollingTimer: number | null = null

const clearRemeshPollingTimer = () => {
  if (remeshPollingTimer) {
    window.clearTimeout(remeshPollingTimer)
    remeshPollingTimer = null
  }
}

const scheduleRemeshPolling = () => {
  clearRemeshPollingTimer()
  if (!activeRemeshCount.value) return
  remeshPollingTimer = window.setTimeout(() => {
    void loadTableData()
  }, 5000)
}

/**
 * 构建项目 BIM 列表（按上传时间倒序）
 */
const buildProjectBimList = (project: ProjectData): FileSelectionOption[] => {
  const bimFiles = (project.files || [])
    .filter((file) => file.fileType === 'bim' || file.type === 'BIM')
    .map((file) => ({
      buildingName: file.buildingName,
      id: file.id,
      name: file.name,
      floorName: file.floorName,
      uploadTime: file.uploadTime || '',
    }))
    .sort((a, b) => b.uploadTime.localeCompare(a.uploadTime))
  return bimFiles.map(({ id, name, buildingName, floorName }) => ({
    id,
    name,
    buildingName,
    floorName,
  }))
}

/**
 * 构建项目 CAD 列表（按上传时间倒序）
 */
const buildProjectCadList = (project: ProjectData): FileSelectionOption[] => {
  const cadFiles = (project.files || [])
    .filter((file) => file.fileType === 'cad' || file.type === 'CAD')
    .map((file) => ({
      buildingName: file.buildingName,
      id: file.id,
      name: file.name,
      floorName: file.floorName,
      uploadTime: file.uploadTime || '',
    }))
    .sort((a, b) => b.uploadTime.localeCompare(a.uploadTime))
  return cadFiles.map(({ id, name, buildingName, floorName }) => ({
    id,
    name,
    buildingName,
    floorName,
  }))
}

/**
 * 构建项目高斯列表（按上传时间倒序）
 */
const buildProjectGaussList = (project: ProjectData): FileSelectionOption[] => {
  const gaussFiles = (project.files || [])
    .filter((file) => file.fileType === 'gauss' || file.type === '高斯模型')
    .map((file) => ({
      buildingName: file.buildingName,
      floorName: file.floorName,
      id: file.id,
      name: file.name,
      uploadTime: file.uploadTime || '',
    }))
    .sort((a, b) => b.uploadTime.localeCompare(a.uploadTime))
  return gaussFiles.map(({ id, name, buildingName, floorName }) => ({
    id,
    name,
    buildingName,
    floorName,
  }))
}

const resolvePreferredBimForScan = (
  scan: ScanRecord,
  bimList: FileSelectionOption[],
) => {
  if (bimList.length === 0) return undefined

  const scanBuildingName = normalizeSlotName(scan.buildingName)
  if (!scanBuildingName) return bimList[0]

  const sameBuildingBims = bimList.filter(
    (item) => normalizeSlotName(item.buildingName) === scanBuildingName,
  )
  if (sameBuildingBims.length === 0) return bimList[0]

  return sameBuildingBims[0]
}

const resolvePreferredCadForScan = (
  scan: ScanRecord,
  preferredBim: FileSelectionOption | undefined,
  cadList: FileSelectionOption[],
) => {
  if (cadList.length === 0) return undefined

  const targetBuildingName =
    normalizeSlotName(preferredBim?.buildingName) ||
    normalizeSlotName(scan.buildingName)
  const scanFloorName = normalizeSlotName(scan.floorName)

  if (!targetBuildingName) return cadList[0]

  const sameBuildingCads = cadList.filter(
    (item) => normalizeSlotName(item.buildingName) === targetBuildingName,
  )
  if (sameBuildingCads.length === 0) return cadList[0]

  if (scanFloorName) {
    const exactFloorCad = sameBuildingCads.find(
      (item) => normalizeSlotName(item.floorName) === scanFloorName,
    )
    if (exactFloorCad) return exactFloorCad
  }

  return sameBuildingCads[0]
}

const resolvePreferredGaussForScan = (
  scan: ScanRecord,
  gaussList: FileSelectionOption[],
) => {
  if (gaussList.length === 0) return undefined

  const scanBuildingName = normalizeSlotName(scan.buildingName)
  const scanFloorName = normalizeSlotName(scan.floorName)
  if (!scanBuildingName || !scanFloorName) return undefined

  return gaussList.find(
    (item) =>
      normalizeSlotName(item.buildingName) === scanBuildingName &&
      normalizeSlotName(item.floorName) === scanFloorName,
  )
}

/**
 * 构建项目扫描记录（按 YYYY-MM-DD 分组）
 */
const buildProjectScanRecords = (
  project: ProjectData,
): Record<string, ScanRecord[]> => {
  const grouped: Record<string, ScanRecord[]> = {}

  const scanFiles = (project.files || []).filter(
    (file) => file.fileType === 'scan' || file.type === '扫描数据',
  )

  scanFiles.forEach((file) => {
    const uploadTime = file.uploadTime || ''
    const dateKey = uploadTime.split(' ')[0]
    if (!dateKey) return

    if (!grouped[dateKey]) grouped[dateKey] = []
    grouped[dateKey].push({
      id: file.id,
      title: file.name,
      size: file.size || '',
      buildingName: file.buildingName,
      floorName: file.floorName,
      hasBimAlignment: false,
      hasCadAlignment: false,
      calibrated: false,
      pointCloudSize: '1个',
      trackSize: '1条',
      date: uploadTime || dateKey,
    })
  })

  Object.keys(grouped).forEach((date) => {
    grouped[date].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  })

  return grouped
}

/**
 * 获取扫描文件元信息
 */
const getScanFileMeta = (project: ProjectData, scanFileId: number | string) => {
  const targetId = String(scanFileId)
  const scanFile = (project.files || []).find(
    (file) =>
      String(file.id) === targetId &&
      (file.fileType === 'scan' || file.type === '扫描数据'),
  )
  return scanFile
}

/**
 * 根据接口扫描列表构建扫描记录
 */
const buildProjectScanRecordsFromApi = (
  project: ProjectData,
  scanItems: ScanListItem[],
): Record<string, ScanRecord[]> => {
  const grouped: Record<string, ScanRecord[]> = {}

  scanItems.forEach((item) => {
    const meta = getScanFileMeta(project, item.scanFileId)
    const producedAt = item.producedAt || ''
    const uploadTime = meta?.uploadTime || ''
    const fallbackDate = uploadTime ? uploadTime.split(' ')[0] : ''
    const dateKey = producedAt || fallbackDate
    if (!dateKey) return

    if (!grouped[dateKey]) grouped[dateKey] = []
    grouped[dateKey].push({
      id: String(item.scanFileId),
      title: meta?.name || `扫描 ${item.scanFileId}`,
      size: meta?.size || '',
      buildingName: item.buildingName ?? meta?.buildingName,
      floorName: item.floorName ?? meta?.floorName,
      hasBimAlignment: item.hasBimAlignment,
      hasCadAlignment: item.hasCadAlignment,
      calibrated:
        item.calibrated || (item.hasBimAlignment && item.hasCadAlignment),
      pointCloudSize: '1个',
      trackSize: '1条',
      date: producedAt || uploadTime || dateKey,
    })
  })

  Object.keys(grouped).forEach((date) => {
    grouped[date].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  })

  return grouped
}

/**
 * 获取项目扫描列表（分页拉取）
 */
const fetchProjectScans = async (
  projectId: number,
  from?: string,
  to?: string,
) => {
  const all: ScanListItem[] = []
  let page = 1
  const pageSize = 200

  while (true) {
    const response = await getProjectScans(projectId, {
      from,
      to,
      page,
      pageSize,
    })
    if (response.code !== 200) {
      throw new Error(response.msg || '加载扫描记录失败')
    }

    const list = response.data?.list || []
    const total = response.data?.total ?? list.length
    all.push(...list)

    if (all.length >= total || list.length === 0) {
      break
    }

    page += 1
  }

  return all
}

/**
 * 获取扫描校准信息
 */
const fetchScanCalibration = async (
  projectId: number,
  scanFileId: number,
): Promise<ScanCalibration | null> => {
  try {
    const response = await getScanCalibration(projectId, scanFileId)
    if (response.code !== 200) {
      throw new Error(response.msg || '获取校准信息失败')
    }
    return response.data
  } catch (error: any) {
    console.error('获取校准信息失败:', error)
    ElMessage.error(error?.message || '获取校准信息失败')
    return null
  }
}

/**
 * 更新当前扫描记录的校准状态
 */
const updateScanRecordCalibration = (
  scanFileId: string,
  calibration: ScanCalibration,
) => {
  const nextRecords: Record<string, ScanRecord[]> = {}

  Object.entries(currentProjectScanRecords.value).forEach(([date, records]) => {
    nextRecords[date] = records.map((record) => {
      if (record.id !== scanFileId) return record
      const hasBimAlignment = calibration.hasBimAlignment
      const hasCadAlignment = calibration.hasCadAlignment
      return {
        ...record,
        hasBimAlignment,
        hasCadAlignment,
        calibrated:
          calibration.calibrated || (hasBimAlignment && hasCadAlignment),
      }
    })
  })

  currentProjectScanRecords.value = nextRecords
}

watch(
  () => searchForm.value.projectId,
  async (projectId) => {
    searchForm.value.buildingName = ''
    searchForm.value.floorName = ''

    if (!projectId) {
      searchProjectBuildings.value = []
      return
    }

    await loadSearchProjectBuildings(projectId)
  },
)

watch(
  () => searchForm.value.buildingName,
  (buildingName, previousBuildingName) => {
    if (buildingName !== previousBuildingName) {
      searchForm.value.floorName = ''
    }
  },
)

/**
 * 处理搜索操作
 */
const handleSearch = () => {
  pagination.value.currentPage = 1
  loadTableData()
}

/**
 * 处理重置操作
 */
const handleReset = () => {
  searchForm.value = {
    buildingName: '',
    fileName: '',
    projectName: '',
    projectId: null,
    fileType: '',
    floorName: '',
    dateRange: [],
  }
  pagination.value.currentPage = 1
  loadTableData()
}

/**
 * 处理上传文件操作
 */
const handleUpload = () => {
  uploadDialogVisible.value = true
}

/**
 * 处理新建项目操作
 */
const handleAddProject = () => {
  ElMessage.success('新建项目功能待实现')
}

/**
 * 处理查看日历操作
 */
const handleViewCalendar = async (project: ProjectData) => {
  currentProjectName.value = project.name

  currentProjectBimList.value = buildProjectBimList(project)
  currentProjectCadList.value = buildProjectCadList(project)
  currentProjectGaussList.value = buildProjectGaussList(project)

  currentProjectScanRecords.value = {}
  selectedProjectScanCount.value = 0
  scanCalendarVisible.value = true

  const projectId = Number(project.id)
  if (!Number.isFinite(projectId) || projectId <= 0) {
    currentProjectScanRecords.value = buildProjectScanRecords(project)
    selectedProjectScanCount.value = Object.values(
      currentProjectScanRecords.value,
    ).reduce((sum, scans) => sum + scans.length, 0)
    return
  }

  try {
    const scanItems = await fetchProjectScans(projectId)
    currentProjectScanRecords.value = buildProjectScanRecordsFromApi(
      project,
      scanItems,
    )
    selectedProjectScanCount.value = Object.values(
      currentProjectScanRecords.value,
    ).reduce((sum, scans) => sum + scans.length, 0)
  } catch (error: any) {
    console.error('加载扫描日历失败:', error)
    ElMessage.error(error?.message || '加载扫描日历失败')
    currentProjectScanRecords.value = buildProjectScanRecords(project)
    selectedProjectScanCount.value = Object.values(
      currentProjectScanRecords.value,
    ).reduce((sum, scans) => sum + scans.length, 0)
  }
}

/**
 * 处理下载文件操作
 */
const handleDownloadFile = (file: FileData) => {
  ElMessage.success(`正在下载: ${file.name}`)
}

/**
 * 处理文件操作菜单
 */
const handleFileCommand = async (command: string, file: FileData) => {
  switch (command) {
    case 'preview':
      await handlePreviewFile(file)
      break
    case 'detail':
      handleViewFileDetail(file)
      break
    case 'retry-remesh':
      await handleRetryRemesh(file)
      break
    case 'delete':
      await handleDeleteFile(file)
      break
  }
}

const getRemeshStatusLabel = (meshRemesh?: MeshRemeshSummary) => {
  if (!meshRemesh?.supported) return '当前文件不支持网格均匀化'
  const textMap: Record<string, string> = {
    queued: '已进入均匀化队列',
    processing: '均匀化处理中',
    succeeded: '均匀化已完成',
    failed: '均匀化失败',
  }
  return textMap[meshRemesh.status || ''] || '均匀化状态未知'
}

const handleRetryRemesh = async (file: FileData) => {
  if (!file.projectId) {
    ElMessage.error('缺少项目ID，无法重试均匀化')
    return
  }
  if (!file.meshRemesh?.supported) {
    ElMessage.warning('当前文件不支持网格均匀化')
    return
  }
  if (!file.meshRemesh.canManualRetry) {
    ElMessage.warning('当前状态不允许手动重试均匀化')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定重新触发 BIM 文件「${file.name}」的网格均匀化吗？`,
      '重试均匀化',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )

    await remeshBimFile(Number(file.projectId), Number(file.id), {
      algorithm: 'bim_preprocessor',
      params: {},
      force: true,
    })

    ElMessage.success('已重新触发网格均匀化')
    await loadTableData()
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return

    const status = error?.response?.status
    const message =
      error?.response?.data?.msg || error?.message || '重试均匀化失败'
    if (status === 409) {
      ElMessage.warning(message)
    } else {
      ElMessage.error(message)
    }
    await loadTableData()
  }
}

/**
 * 处理扫描文件图纸校验
 */
const handleScanCalibration = (file: FileData) => {
  router.push({
    name: 'DrawingCalibration',
    query: {
      fileId: file.id,
      fileName: file.name,
      projectId: file.projectId,
    },
  })
}

/**
 * 处理查看文件详情
 */
const handleViewFileDetail = (file: FileData) => {
  selectedFile.value = { ...file }
  fileDetailVisible.value = true
}

/**
 * 处理文件预览
 */
const handlePreviewFile = async (file: FileData) => {
  try {
    // 检查文件状态，只有已上传的文件才能预览
    if (file.status !== 'stored') {
      ElMessage.warning('文件尚未上传完成，无法预览')
      return
    }

    // 检查是否有项目ID
    if (!file.projectId) {
      ElMessage.error('缺少项目ID，无法预览文件')
      return
    }

    // 高斯模型预览：跳转到高斯模型页，并携带项目与文件信息
    if (file.fileType === 'gauss') {
      await router.push({
        name: 'GaussianModel',
        query: {
          projectId: file.projectId,
          fileId: file.id,
          fileName: file.name,
          assetPath: 'meta.lcc',
        },
      })
      return
    }

    const routeName =
      file.fileType === 'cad'
        ? 'PreviewCad'
        : file.fileType === 'scan'
          ? 'PreviewScan'
          : 'PreviewFile'

    // fileId 通过 params 传递，projectId/fileName/fileType 通过 query 传递
    await router.push({
      name: routeName,
      params: { id: file.id },
      query: {
        projectId: file.projectId,
        fileName: file.name,
        fileType: file.fileType,
      },
    })
  } catch (error) {
    console.error('预览文件失败:', error)
    ElMessage.error('预览文件失败，请稍后重试')
  }
}

/**
 * 处理删除文件
 */
const handleDeleteFile = async (file: FileData) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除文件 "${file.name}" 吗？删除后将同步删除本地文件，此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )

    // 检查是否有项目ID（扫描记录等不应该被删除）
    if (!file.projectId) {
      ElMessage.error('缺少项目ID，无法删除文件')
      return
    }

    // 跳过扫描记录的删除
    if (file.type === '扫描记录') {
      ElMessage.warning('扫描记录不支持直接删除，请删除具体的点云文件')
      return
    }

    // 调用删除接口
    await deleteProjectFile(parseInt(file.projectId), parseInt(file.id))

    // 204 No Content 没有响应体，如果请求成功（没抛出异常），则认为删除成功
    ElMessage.success('文件删除成功')
    // 重新加载数据
    await loadTableData()
  } catch (error: any) {
    // 用户取消删除
    if (error === 'cancel') {
      return
    }
    console.error('删除文件失败:', error)
    ElMessage.error(error.message || '文件删除失败')
  }
}

/**
 * 处理页码变化
 */
const handleCurrentChange = (page: number) => {
  pagination.value.currentPage = page
  loadTableData()
}

/**
 * 处理每页显示数量变化
 */
const handleSizeChange = (size: number) => {
  pagination.value.pageSize = size
  pagination.value.currentPage = 1
  loadTableData()
}

/**
 * 暂停上传（断点续传）
 */
const handlePauseUpload = () => {
  if (currentUploader.value) {
    currentUploader.value.pause()
    ElMessage.info('上传已暂停，您可以稍后继续上传')
    uploadDialogRef.value?.setUploadPaused()
    // 注意：不将 currentUploader.value 置为 null，这样后续可以继续
  }
}

/**
 * 继续上传（从暂停状态恢复）
 */
const handleResumeUpload = async () => {
  if (currentUploader.value && currentUploader.value.getUploadId()) {
    try {
      uploadDialogRef.value?.setUploading(true)
      uploadDialogRef.value?.setUploadPhase?.('uploading')
      await currentUploader.value.resume()
    } catch (error: any) {
      console.error('继续上传失败:', error)
      uploadDialogRef.value?.setUploadFailed?.(error.message || '继续上传失败')
      ElMessage.error(error.message || '继续上传失败')
    }
  } else {
    ElMessage.warning('没有可继续的上传任务')
  }
}

/**
 * 处理上传确认
 */
const handleUploadConfirm = async (data: UploadFormData) => {
  if (!data.file) {
    ElMessage.warning('请选择要上传的文件')
    return
  }

  if (!data.projectId) {
    ElMessage.warning('请选择项目')
    return
  }

  uploadDialogRef.value?.setUploading(true)

  try {
    const normalizeUploadSlotName = (value?: string) => value?.trim()

    // 映射文件类型
    const typeMap: Record<string, 'scan' | 'bim' | 'cad' | 'gauss'> = {
      BIM: 'bim',
      CAD: 'cad',
      scan: 'scan',
      gauss: 'gauss',
    }

    const fileType = typeMap[data.fileType] || 'scan'

    // 动态导入上传工具
    const { FileUploader } = await import('@/utils/upload')

    // 创建上传实例
    const resumeUploadState = uploadDialogRef.value?.resumeUploadState?.value
    const uploader = new FileUploader({
      projectId: data.projectId,
      type: fileType,
      file: data.file,
      buildingName: ['bim', 'cad', 'scan', 'gauss'].includes(fileType)
        ? normalizeUploadSlotName(data.buildingName)
        : undefined,
      floorName: ['cad', 'scan', 'gauss'].includes(fileType)
        ? normalizeUploadSlotName(data.floorName)
        : undefined,
      producedAt: fileType === 'scan' ? data.producedAt : undefined,
      description: data.description,
      resumeFromState: uploadDialogRef.value?.isResumingUpload?.value || false, // 支持断点续传
      existingUploadId: resumeUploadState?.uploadId,
      existingFileHash: resumeUploadState?.fileHash,
      onHashProgress: (progress) => {
        uploadDialogRef.value?.setHashProgress?.(progress)
      },
      onPhaseChange: (phase) => {
        uploadDialogRef.value?.setUploadPhase?.(phase)
      },
      onProgress: (progress) => {
        uploadDialogRef.value?.setProgress?.(progress)
      },
      onChunkProgress: (state) => {
        uploadDialogRef.value?.setChunkProgress?.(state)
      },
      onSuccess: (fileInfo) => {
        if (fileInfo.meshRemesh?.supported) {
          ElMessage.success(
            `文件上传成功，${getRemeshStatusLabel(fileInfo.meshRemesh)}`,
          )
        } else {
          ElMessage.success('文件上传成功')
        }
        uploadDialogRef.value?.setUploading(false)
        void uploadDialogRef.value?.reloadProjectBuildings?.(
          data.projectId,
          true,
        )
        if (searchForm.value.projectId === data.projectId) {
          void loadSearchProjectBuildings(data.projectId, true)
        }
        uploadDialogRef.value?.close()
        currentUploader.value = null
        // 重新加载数据
        void loadTableData()
      },
      onError: () => {},
    })

    // 保存上传器实例
    currentUploader.value = uploader

    // 开始上传
    await uploader.start()
  } catch (error: any) {
    if (error?.message === '上传已取消') {
      return
    }

    console.error('上传失败:', error)

    // 根据错误类型显示不同的提示
    const errorMessage = error.message || '文件上传失败'

    if (
      error.message?.includes('已存在') ||
      error.message?.includes('正在上传')
    ) {
      ElMessage({
        type: 'warning',
        message: errorMessage,
        duration: 5000,
        showClose: true,
      })
    } else {
      uploadDialogRef.value?.setUploadFailed?.(errorMessage)
      ElMessage.error(errorMessage)
    }

    currentUploader.value = null
  }
}

/**
 * 处理打开校准弹窗
 */
const handleOpenCalibration = async (scan: ScanRecord) => {
  const project = projectTableData.value.find((p) =>
    (p.files || []).some(
      (f) =>
        f.id === scan.id && (f.fileType === 'scan' || f.type === '扫描数据'),
    ),
  )
  if (project) {
    currentProjectName.value = project.name
    currentProjectBimList.value = buildProjectBimList(project)
    currentProjectCadList.value = buildProjectCadList(project)
    currentProjectGaussList.value = buildProjectGaussList(project)
  }

  if (currentProjectBimList.value.length === 0) {
    const projectFallback = projectTableData.value.find((p) =>
      (p.files || []).some(
        (f) =>
          f.id === scan.id && (f.fileType === 'scan' || f.type === '扫描数据'),
      ),
    )
    if (projectFallback) {
      currentProjectName.value = projectFallback.name
      currentProjectBimList.value = buildProjectBimList(projectFallback)
      currentProjectCadList.value = buildProjectCadList(projectFallback)
      currentProjectGaussList.value = buildProjectGaussList(projectFallback)
    }
  }

  const defaultBim = resolvePreferredBimForScan(
    scan,
    currentProjectBimList.value,
  )
  const defaultCad = resolvePreferredCadForScan(
    scan,
    defaultBim,
    currentProjectCadList.value,
  )
  const defaultGauss = resolvePreferredGaussForScan(
    scan,
    currentProjectGaussList.value,
  )
  const savedGaussSelection = getScanGaussSelection(scan.id)
  const savedGaussId = savedGaussSelection?.gaussId || ''
  const savedGaussName = savedGaussSelection?.gaussName || ''
  const scanBuildingName = normalizeSlotName(scan.buildingName)
  const scanFloorName = normalizeSlotName(scan.floorName)
  const isSavedGaussValid =
    !!savedGaussId &&
    currentProjectGaussList.value.some(
      (item) =>
        item.id === savedGaussId &&
        normalizeSlotName(item.buildingName) === scanBuildingName &&
        normalizeSlotName(item.floorName) === scanFloorName,
    )
  // 设置当前扫描数据
  currentScanData.value = {
    id: scan.id,
    title: scan.title,
    date: scan.date.split(' ')[0],
    uploader: '张强',
    projectId: project?.id || currentScanData.value.projectId || '',
    projectName:
      project?.name ||
      currentProjectName.value ||
      currentScanData.value.projectName ||
      '',
    pointCloudBuildingName: scan.buildingName || '',
    pointCloudFloorName: scan.floorName || '',
    bimFileId: defaultBim?.id || '',
    bimFile: defaultBim?.name || '',
    cadFileId: defaultCad?.id || '',
    cadFile: defaultCad?.name || '',
    gaussFileId: isSavedGaussValid ? savedGaussId : defaultGauss?.id || '',
    gaussFile: isSavedGaussValid ? savedGaussName : defaultGauss?.name || '',
    gaussAssetPath:
      savedGaussSelection?.gaussAssetPath ||
      resolveGaussAssetPath(
        isSavedGaussValid ? savedGaussName : defaultGauss?.name || '',
      ),
    pointCloudFile: scan.title,
  }
  isScanDeleted.value = false

  const projectId = Number(currentScanData.value.projectId)
  const scanFileId = Number(scan.id)
  let resolvedHasBim = scan.hasBimAlignment
  let resolvedHasCad = scan.hasCadAlignment
  let resolvedCalibrated = scan.calibrated

  if (
    Number.isFinite(projectId) &&
    projectId > 0 &&
    Number.isFinite(scanFileId) &&
    scanFileId > 0
  ) {
    const calibration = await fetchScanCalibration(projectId, scanFileId)
    if (calibration) {
      const bimMatchesScanBuilding =
        !scanBuildingName ||
        normalizeSlotName(calibration.bimBuildingName) === scanBuildingName
      const cadMatchesScanBuilding =
        !scanBuildingName ||
        normalizeSlotName(calibration.cadBuildingName) === scanBuildingName
      const gaussMatchesScanSlot =
        !!scanBuildingName &&
        !!scanFloorName &&
        normalizeSlotName(calibration.gaussBuildingName) === scanBuildingName &&
        normalizeSlotName(calibration.gaussFloorName) === scanFloorName

      resolvedHasBim = calibration.hasBimAlignment && bimMatchesScanBuilding
      resolvedHasCad = calibration.hasCadAlignment && cadMatchesScanBuilding
      resolvedCalibrated =
        calibration.calibrated || (resolvedHasBim && resolvedHasCad)

      const bimFileId =
        bimMatchesScanBuilding && calibration.bimFileId != null
          ? String(calibration.bimFileId)
          : ''
      const cadFileId =
        cadMatchesScanBuilding && calibration.cadFileId != null
          ? String(calibration.cadFileId)
          : ''
      const gaussFileId =
        gaussMatchesScanSlot && calibration.gaussFileId != null
          ? String(calibration.gaussFileId)
          : ''
      const bimFile =
        currentProjectBimList.value.find((item) => item.id === bimFileId)
          ?.name || ''
      const cadFile =
        currentProjectCadList.value.find((item) => item.id === cadFileId)
          ?.name || ''
      const gaussFile =
        currentProjectGaussList.value.find((item) => item.id === gaussFileId)
          ?.name || ''

      currentScanData.value = {
        ...currentScanData.value,
        bimFileId: bimFileId || currentScanData.value.bimFileId,
        cadFileId: cadFileId || currentScanData.value.cadFileId,
        gaussFileId: gaussFileId || currentScanData.value.gaussFileId,
        bimFile: bimFile || currentScanData.value.bimFile,
        cadFile: cadFile || currentScanData.value.cadFile,
        gaussFile: gaussFile || currentScanData.value.gaussFile,
      }

      updateScanRecordCalibration(scan.id, calibration)
    }
  }

  calibrationVisible.value = true
  scanCalendarVisible.value = false

  await nextTick()
  calibrationDialogRef.value?.resetCalibration?.()
  if (resolvedCalibrated || resolvedHasBim || resolvedHasCad) {
    calibrationDialogRef.value?.setBimCalibrationCompleted?.(
      resolvedHasBim || resolvedCalibrated,
    )
    calibrationDialogRef.value?.setCadCalibrationCompleted?.(
      resolvedHasCad || resolvedCalibrated,
    )
  }
}

/**
 * 处理删除扫描记录
 */
const handleDeleteScan = (scanId: string) => {
  const nextRecords: Record<string, ScanRecord[]> = {}

  Object.keys(currentProjectScanRecords.value).forEach((date) => {
    const scanList = currentProjectScanRecords.value[date] || []
    const filtered = scanList.filter((scan) => scan.id !== scanId)
    if (filtered.length > 0) nextRecords[date] = filtered
  })

  currentProjectScanRecords.value = nextRecords

  selectedProjectScanCount.value = Object.values(
    currentProjectScanRecords.value,
  ).reduce((sum, scans) => sum + scans.length, 0)

  // 如果删除的是当前打开校准弹窗的扫描记录，设置删除状态
  if (currentScanData.value.id === scanId) {
    isScanDeleted.value = true
  }
}

/**
 * 处理查看点云详情
 */
const handleViewPointCloud = (scan: ScanRecord) => {
  ElMessage.info(`查看点云详情: ${scan.title}`)
}

/**
 * 处理查看轨迹详情
 */
const handleViewTrajectory = (scan: ScanRecord) => {
  ElMessage.info(`查看轨迹详情: ${scan.title}`)
}

/**
 * 处理标定
 */
const handleCalibration = (scan: ScanRecord) => {
  handleOpenCalibration(scan)
}

/**
 * 处理BIM校准
 */
const handleCalibrateBIM = (scanId: string) => {
  console.log('开始BIM校准:', scanId)
  // 这里可以调用实际的校准API
}

/**
 * 处理CAD校准
 */
const handleCalibrateCAD = (data: { scanId: string; cadId: string }) => {
  console.log('开始CAD校准:', data)
  // 这里可以调用实际的校准API
}

const handleCalibrationSelectionChange = (data: {
  bimId: string
  bimName: string
  cadId: string
  cadName: string
  gaussId: string
  gaussName: string
}) => {
  if (!currentScanData.value.id) return
  if (
    currentScanData.value.bimFileId === data.bimId &&
    currentScanData.value.bimFile === data.bimName &&
    currentScanData.value.cadFileId === data.cadId &&
    currentScanData.value.cadFile === data.cadName &&
    currentScanData.value.gaussFileId === data.gaussId &&
    currentScanData.value.gaussFile === data.gaussName
  ) {
    return
  }

  currentScanData.value = {
    ...currentScanData.value,
    bimFileId: data.bimId,
    bimFile: data.bimName,
    cadFileId: data.cadId,
    cadFile: data.cadName,
    gaussFileId: data.gaussId,
    gaussFile: data.gaussName,
  }
}

/**
 * 处理校准完成
 */
const handleCalibrationComplete = async (data: {
  scanId: string
  bimId: string
  bimName: string
  cadId: string
  cadName: string
  gaussId: string
  gaussName: string
}) => {
  console.log('校准完成:', data)
  ElMessage.success('3D坐标校准已完成，可以开始预览')
  const scanData = currentScanData.value
  const projectId = scanData.projectId ? String(scanData.projectId) : ''
  const projectName = scanData.projectName || currentProjectName.value || ''
  const scanName = scanData.title || ''
  const cadName =
    data.cadName ||
    currentProjectCadList.value.find((cad) => cad.id === data.cadId)?.name ||
    scanData.cadFile ||
    ''
  const bimId =
    data.bimId || (scanData.bimFileId ? String(scanData.bimFileId) : '')
  const bimName = data.bimName || scanData.bimFile || ''
  const gaussId = data.gaussId || scanData.gaussFileId || ''
  const gaussName =
    data.gaussName ||
    currentProjectGaussList.value.find((gauss) => gauss.id === gaussId)?.name ||
    scanData.gaussFile ||
    ''
  const gaussAssetPath =
    scanData.gaussAssetPath || resolveGaussAssetPath(gaussName)
  const pointCloudName = scanData.pointCloudFile || ''

  currentScanData.value = {
    ...currentScanData.value,
    bimFileId: bimId,
    bimFile: bimName,
    cadFileId: data.cadId,
    cadFile: cadName,
    gaussFileId: gaussId,
    gaussFile: gaussName,
    gaussAssetPath,
  }

  const projectIdNum = Number(projectId)
  const scanIdNum = Number(data.scanId)
  const gaussIdNum = Number(gaussId)

  if (
    Number.isFinite(projectIdNum) &&
    projectIdNum > 0 &&
    Number.isFinite(scanIdNum) &&
    scanIdNum > 0 &&
    Number.isFinite(gaussIdNum) &&
    gaussIdNum > 0
  ) {
    try {
      await saveGaussAlignment(projectIdNum, {
        scanFileId: scanIdNum,
        gaussFileId: gaussIdNum,
      })
    } catch (error: any) {
      console.error('保存高斯绑定失败:', error)
      ElMessage.error(error?.message || '保存高斯绑定失败')
      return
    }
  }

  saveScanGaussSelection(data.scanId, {
    gaussId,
    gaussName,
    gaussAssetPath,
  })

  void router.push({
    name: 'ResultIndex',
    query: {
      projectId,
      projectName,
      scanId: data.scanId,
      scanName,
      cadId: data.cadId,
      cadName,
      bimId,
      bimName,
      gaussId,
      gaussName,
      gaussAssetPath,
      pointCloudName,
    },
  })
}

/**
 * 计算统计数据
 */
const calculateStatistics = (data: ProjectData[]) => {
  let bimCount = 0
  let cadCount = 0
  let pointCloudCount = 0
  let gaussCount = 0
  let usedStorage = 0

  data.forEach((project) => {
    bimCount += project.bimCount
    cadCount += project.cadCount
    pointCloudCount += project.pointCloudCount
    gaussCount += project.gaussCount || 0
    usedStorage += parseFloat(project.usedStorage)
  })

  statistics.value = {
    bimCount,
    cadCount,
    pointCloudCount,
    gaussCount,
    usedStorage: parseFloat(usedStorage.toFixed(1)),
    projectCount: data.length,
  }
}

/**
 * 格式化文件大小
 */
const formatFileSize = (size: number): string => {
  if (size === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(size) / Math.log(k))
  return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 格式化日期
 */
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date
    .toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(/\//g, '-')
}

/**
 * 根据文件类型获取显示类型
 */
const getFileTypeDisplay = (type: string): string => {
  const displayMap: Record<string, string> = {
    bim: 'BIM',
    cad: 'CAD',
    scan: '扫描数据',
    gauss: '高斯模型',
  }
  return displayMap[type] || '未知类型'
}

const formatDisplayFileName = (
  type: string,
  originalName: string,
  buildingName?: string | null,
  floorName?: string | null,
) => {
  if (type === 'bim' && buildingName) {
    return `${buildingName}-${originalName}`
  }
  if (type === 'cad') {
    if (buildingName && floorName) {
      return `${buildingName}-${floorName}-${originalName}`
    }
    if (floorName) {
      return `${floorName}-${originalName}`
    }
    if (buildingName) {
      return `${buildingName}-${originalName}`
    }
  }
  return originalName
}

/**
 * 将API数据转换为表格数据格式
 */
const convertApiDataToTableData = (
  apiProjects: ProjectInfo[],
): ProjectData[] => {
  return apiProjects.map((project) => {
    // 统计各类型文件数量
    let bimCount = 0
    let cadCount = 0
    let pointCloudCount = 0
    let gaussCount = 0
    let totalSize = 0

    // 转换文件数据
    const files: FileData[] = []

    project.types.forEach((typeGroup) => {
      const fileTypeCount = typeGroup.files.length

      // 统计数量
      if (typeGroup.type === 'bim') {
        bimCount = fileTypeCount
      } else if (typeGroup.type === 'cad') {
        cadCount = fileTypeCount
      } else if (typeGroup.type === 'scan') {
        pointCloudCount = fileTypeCount
      } else if (typeGroup.type === 'gauss') {
        gaussCount = fileTypeCount
      }

      // 转换文件数据
      typeGroup.files.forEach((file) => {
        totalSize += file.fileSize

        files.push({
          id: file.id.toString(),
          meshRemesh: file.meshRemesh,
          type: getFileTypeDisplay(typeGroup.type),
          name: file.originalName,
          size: formatFileSize(file.fileSize),
          status: file.status,
          uploader: '系统',
          uploadTime: formatDate(file.createdAt),
          projectId: project.projectId.toString(),
          fileType: typeGroup.type,
          buildingName: file.buildingName,
          floorName: file.floorName,
        })
      })
    })

    // 如果有点云文件，添加扫描记录卡片
    if (pointCloudCount > 0) {
      const scanRecordFile: FileData = {
        id: `scan_record_${project.projectId}`,
        type: '扫描记录',
        name: `共 ${pointCloudCount} 次扫描记录`,
        size: formatFileSize(totalSize),
        uploader: '系统',
        uploadTime: '最近',
        projectId: project.projectId.toString(),
      }
      files.push(scanRecordFile)
    }

    return {
      id: project.projectId.toString(),
      rowKey: `api-${project.projectId}`,
      name: project.projectName,
      bimCount,
      cadCount,
      pointCloudCount,
      gaussCount,
      usedStorage: (totalSize / (1024 * 1024)).toFixed(1),
      fileCount: bimCount + cadCount + pointCloudCount + gaussCount,
      files,
    }
  })
}

/**
 * 加载表格数据
 */
const loadTableData = async () => {
  clearRemeshPollingTimer()
  loading.value = true

  try {
    const buildingName = normalizeSlotName(searchForm.value.buildingName)
    const floorName = normalizeSlotName(searchForm.value.floorName)
    const projectName = searchForm.value.projectName.trim()
    const fileName = searchForm.value.fileName.trim()
    const dateRange = Array.isArray(searchForm.value.dateRange)
      ? searchForm.value.dateRange
      : []
    const uploadedAtFrom = dateRange[0] || undefined
    const uploadedAtTo = dateRange[1] || undefined

    if (floorName && !buildingName) {
      ElMessage.warning('选择所属层时，请先选择所属幢')
      projectTableData.value = []
      pagination.value.total = 0
      calculateStatistics([])
      return
    }

    if (
      uploadedAtFrom &&
      uploadedAtTo &&
      uploadedAtFrom.localeCompare(uploadedAtTo) > 0
    ) {
      ElMessage.warning('上传时间区间非法')
      projectTableData.value = []
      pagination.value.total = 0
      calculateStatistics([])
      return
    }

    const response = await getProjectFiles({
      buildingName: buildingName || undefined,
      fileName: fileName || undefined,
      floorName: floorName || undefined,
      page: pagination.value.currentPage,
      pageSize: pagination.value.pageSize,
      projectId: searchForm.value.projectId || undefined,
      projectName: projectName || undefined,
      type: (searchForm.value.fileType || undefined) as
        | 'scan'
        | 'bim'
        | 'cad'
        | 'gauss'
        | undefined,
      uploadedAtFrom,
      uploadedAtTo,
    })

    if (response.code === 200) {
      const apiData = response.data

      const convertedData = convertApiDataToTableData(apiData.list)
      projectTableData.value = convertedData

      pagination.value.total = apiData.total ?? convertedData.length

      calculateStatistics(convertedData)
      scheduleRemeshPolling()
    } else {
      console.error('加载项目文件数据失败:', response.msg)
      if (response.code === 400) {
        ElMessage.warning(response.msg || '筛选条件有误')
      } else {
        ElMessage.error(response.msg || '加载数据失败')
      }

      projectTableData.value = []
      pagination.value.total = 0
      calculateStatistics([])
    }
  } catch (error) {
    console.error('加载项目文件数据异常:', error)
    ElMessage.error('加载数据失败')

    projectTableData.value = []
    pagination.value.total = 0
    calculateStatistics([])
  } finally {
    loading.value = false
  }
}

/**
 * 组件挂载时加载数据
 */
onMounted(() => {
  void (async () => {
    await loadSearchProjectList()
    await loadTableData()
    await applyCalibrationReturnState()
  })()
})

onActivated(() => {
  const routeState = window.history.state as { forward?: string } | null
  const forwardPath =
    typeof routeState?.forward === 'string' ? routeState.forward : ''
  const isBackFromResult =
    forwardPath.startsWith('/result/index') ||
    forwardPath.startsWith('/result?') ||
    forwardPath === '/result'
  const hasManualReloadFlag =
    sessionStorage.getItem(HISTORY_MODEL_RELOAD_KEY) === '1'

  if (isBackFromResult || hasManualReloadFlag) {
    if (sessionStorage.getItem(HISTORY_MODEL_BACK_RELOAD_GUARD_KEY) !== '1') {
      sessionStorage.setItem(HISTORY_MODEL_BACK_RELOAD_GUARD_KEY, '1')
      sessionStorage.removeItem(HISTORY_MODEL_RELOAD_KEY)
      window.location.reload()
      return
    }
  }

  sessionStorage.removeItem(HISTORY_MODEL_RELOAD_KEY)
  sessionStorage.removeItem(HISTORY_MODEL_BACK_RELOAD_GUARD_KEY)
  applyCalibrationReturnState()
  scheduleRemeshPolling()
})

onBeforeUnmount(() => {
  clearRemeshPollingTimer()
})

onDeactivated(() => {
  clearRemeshPollingTimer()
})
</script>

<style lang="scss" scoped>
.history-model-container {
  padding: 0;
  width: 100%;
  height: 100%;
  overflow-y: auto;
}

.uploading-alert {
  margin-bottom: 16px;

  :deep(.el-alert__content) {
    display: flex;
    align-items: center;
  }
}
</style>
