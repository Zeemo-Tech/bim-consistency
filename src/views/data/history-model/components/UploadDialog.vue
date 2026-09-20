<template>
  <el-dialog
    v-model="visible"
    title="上传文件"
    width="600px"
    :close-on-click-modal="false"
    class="upload-dialog"
    @close="handleClose"
  >
    <div class="upload-dialog-subtitle">
      上传BIM模型、CAD图纸、扫描数据或高斯模型到指定项目
    </div>

    <!-- 未完成上传提示 -->
    <el-alert
      v-if="pendingUploads.length > 0 && !uploading"
      type="info"
      :closable="false"
      class="pending-uploads-alert"
    >
      <template #title>
        <div class="alert-header">
          <span>发现 {{ pendingUploads.length }} 个可继续上传的文件</span>
          <el-button
            text
            type="primary"
            size="small"
            @click="showPendingUploadsDialog = true"
          >
            查看详情
          </el-button>
        </div>
      </template>
    </el-alert>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="100px"
      class="upload-form"
    >
      <el-form-item label="选择项目" prop="projectId" required>
        <el-select
          v-model="form.projectId"
          placeholder="请先选择项目"
          style="width: 100%"
          clearable
          @change="handleProjectChange"
        >
          <el-option
            v-for="project in projectList"
            :key="project.id"
            :label="project.name"
            :value="project.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="文件类型" prop="fileType" required>
        <el-select
          v-model="form.fileType"
          placeholder="请选择文件类型"
          style="width: 100%"
          :disabled="!form.projectId"
          @change="handleFileTypeChange"
        >
          <el-option label="BIM 模型" value="BIM" />
          <el-option label="CAD 图纸" value="CAD" />
          <el-option label="扫描数据" value="scan" />
          <el-option label="高斯模型" value="gauss" />
        </el-select>
      </el-form-item>

      <el-form-item
        v-if="requiresBuildingName"
        label="所属幢"
        prop="buildingName"
        :required="!isUploadMetadataLocked"
      >
        <el-select
          v-model="form.buildingName"
          placeholder="请选择或输入所属幢，如：1号楼"
          clearable
          filterable
          allow-create
          default-first-option
          reserve-keyword
          style="width: 100%"
          :disabled="isUploadMetadataLocked"
          @change="handleBuildingChange"
        >
          <el-option
            v-for="building in buildingOptions"
            :key="building"
            :label="building"
            :value="building"
          />
        </el-select>
      </el-form-item>

      <el-form-item
        v-if="showsFloorName"
        label="所属层"
        prop="floorName"
        :required="requiresFloorName && !isUploadMetadataLocked"
      >
        <el-select
          v-model="form.floorName"
          placeholder="请选择或输入所属层，如：B1、1F"
          clearable
          filterable
          allow-create
          default-first-option
          reserve-keyword
          style="width: 100%"
          :disabled="isUploadMetadataLocked || !normalizedBuildingName"
          @change="handleFloorChange"
        >
          <el-option
            v-for="floor in floorOptions"
            :key="floor"
            :label="floor"
            :value="floor"
          />
        </el-select>
      </el-form-item>

      <el-form-item
        v-if="form.fileType === 'scan'"
        label="扫描日期"
        prop="producedAt"
        required
      >
        <el-date-picker
          v-model="form.producedAt"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="请选择扫描日期"
          style="width: 100%"
          :disabled="isResumingUpload || isResumingFromPause"
        />
      </el-form-item>

      <!-- 文件选择区域：普通上传或从未完成列表恢复时显示 -->
      <el-form-item
        v-if="
          !uploading &&
          (uploadProgress === 0 || isResumingUpload) &&
          !isResumingFromPause
        "
        label="选择文件"
        prop="file"
        :required="!isResumingUpload"
      >
        <FileDropzone
          ref="fileDropzoneRef"
          v-model="form.file"
          :accept="acceptFileTypes"
          :file-types="getFileTypeDescription()"
          :max-size="50 * 1024 * 1024 * 1024"
          :title="fileDropzoneTitle"
          :disabled="!canSelectFile"
          @change="handleFileChange"
        />
      </el-form-item>

      <el-form-item label="文件说明" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="请输入文件说明或备注..."
          maxlength="200"
          show-word-limit
        />
      </el-form-item>

      <!-- 上传进度 -->
      <el-form-item v-if="uploading || uploadProgress > 0" label="上传进度">
        <UploadProgress
          :file-name="form.fileName"
          :file-size="form.file?.size || 0"
          :file-type="form.fileType"
          :progress="uploadProgress"
          :status="getUploadStatus()"
          :phase="uploadPhase"
          :hash-progress="hashProgress"
          :upload-speed="uploadSpeed"
          :remaining-time="remainingTime"
          :chunk-progress="chunkProgress"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button :disabled="uploading" @click="handleCancel">取消</el-button>
        <!-- 未上传状态：显示上传按钮 -->
        <el-button
          v-if="!uploading && uploadProgress === 0"
          type="primary"
          @click="handleConfirm"
        >
          上传
        </el-button>
        <!-- 上传中状态：显示暂停和停止上传按钮 -->
        <template v-else-if="uploading">
          <el-button
            type="warning"
            :icon="VideoPause"
            @click="handleUploadPause"
          >
            暂停
          </el-button>
        </template>
        <!-- 断点恢复：继续上传（走重新选择文件后的上传流程） -->
        <el-button
          v-else-if="!uploading && uploadProgress > 0 && isResumingUpload"
          type="primary"
          :icon="VideoPlay"
          @click="handleConfirm"
        >
          继续上传
        </el-button>
        <!-- 暂停状态：继续上传 -->
        <el-button
          v-else-if="
            !uploading && uploadProgress > 0 && getUploadStatus() === 'paused'
          "
          type="primary"
          :icon="VideoPlay"
          @click="handleResumeCurrentUpload"
        >
          继续上传
        </el-button>
      </div>
    </template>
  </el-dialog>

  <!-- 未完成上传列表对话框 -->
  <el-dialog
    v-model="showPendingUploadsDialog"
    title="可继续上传"
    width="700px"
    class="pending-uploads-dialog"
  >
    <div class="pending-uploads-list">
      <div
        v-for="upload in pendingUploads"
        :key="upload.uploadId"
        class="pending-upload-item"
      >
        <div class="upload-info">
          <div class="file-name">{{ upload.fileName }}</div>
          <div class="file-meta">
            <span>{{ formatFileSize(upload.fileSize) }}</span>
            <span class="separator">•</span>
            <span>进度: {{ Math.round(upload.progress) }}%</span>
            <span class="separator">•</span>
            <span>{{ formatTimestamp(upload.timestamp) }}</span>
          </div>
        </div>
        <div class="upload-actions">
          <el-button
            type="primary"
            size="small"
            @click="handleResumeUpload(upload)"
          >
            继续上传
          </el-button>
          <el-button
            type="danger"
            size="small"
            @click="handleDeletePendingUpload(upload.uploadId)"
          >
            删除
          </el-button>
        </div>
      </div>
      <el-empty
        v-if="pendingUploads.length === 0"
        description="当前没有可继续上传的文件"
      />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { FormInstance } from 'element-plus'
import { VideoPause, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAllProjects } from '@/api/project'
import { getProjectBuildings, type ProjectBuildingInfo } from '@/api/fileManage'
import UploadProgress from '@/components/UploadProgress/index.vue'
import FileDropzone from '@/components/FileDropzone/index.vue'
import {
  UploadStateManager,
  type UploadState,
} from '@/utils/uploadStateManager'

/**
 * 项目列表项类型定义
 */
export interface ProjectItem {
  id: number
  name: string
}

interface UploadProjectDraftState {
  buildings: string[]
  floorsByBuilding: Record<string, string[]>
  lastBuildingName: string
  lastSelectionByType: Partial<
    Record<string, { buildingName: string; floorName: string }>
  >
}

/**
 * 上传表单数据类型定义
 */
export interface UploadFormData {
  buildingName?: string
  projectId: number | null
  fileType: string
  file: File | null
  fileName: string
  description: string
  floorName?: string
  producedAt?: string
}

/**
 * 组件属性定义
 */
interface Props {
  modelValue?: boolean
}

/**
 * 组件事件定义
 */
interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', data: UploadFormData): void
  (e: 'resume-upload'): void // 从暂停状态继续上传
  (e: 'pause-upload'): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
})

const emit = defineEmits<Emits>()

/**
 * 弹窗显示状态
 */
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

/**
 * 表单引用
 */
const formRef = ref<FormInstance>()

/**
 * 文件拖拽组件引用
 */
const fileDropzoneRef = ref()

/**
 * 上传中状态
 */
const uploading = ref(false)

/**
 * 上传进度
 */
const uploadProgress = ref(0)

/**
 * 上传状态
 */
const uploadStatus = ref<'success' | 'exception' | 'warning' | undefined>(
  undefined,
)

/**
 * 上传进度文本
 */
const uploadProgressText = computed(() => {
  if (uploadProgress.value === 100) {
    return '上传完成，正在处理...'
  }
  return `正在上传... ${uploadProgress.value}%`
})

/**
 * 项目列表数据
 */
const projectList = ref<ProjectItem[]>([])
const projectBuildings = ref<ProjectBuildingInfo[]>([])
const projectBuildingCache = ref<Record<number, ProjectBuildingInfo[]>>({})
const uploadProjectDrafts = ref<Record<number, UploadProjectDraftState>>({})

/**
 * 上传速度（bytes/s）
 */
const uploadSpeed = ref(0)

/**
 * 剩余时间
 */
const remainingTime = ref('')

/**
 * 分片进度
 */
const chunkProgress = ref({
  completed: 0,
  total: 0,
  active: 0,
  failed: 0,
})

const uploadPhase = ref<'idle' | 'hashing' | 'uploading' | 'merging'>('idle')
const hashProgress = ref(0)

/**
 * 上传开始时间
 */
const uploadStartTime = ref<number>(0)

/**
 * 上传已上传字节数
 */
const uploadedBytes = ref(0)
const lastProgressTime = ref(0)

/**
 * 加载项目列表
 */
const loadProjectList = async () => {
  try {
    const response = await getAllProjects()
    if (response.code === 200) {
      projectList.value = response.data.list.map((project) => ({
        id: project.id,
        name: project.name,
      }))
    }
  } catch (error) {
    console.error('加载项目列表失败:', error)
    ElMessage.error('加载项目列表失败')
  }
}

/**
 * 表单数据
 */
const form = ref<UploadFormData>({
  buildingName: '',
  projectId: null as any, // 使用 null 表示未选择
  fileType: '',
  file: null,
  fileName: '',
  description: '',
  floorName: '',
  producedAt: '',
})

const normalizeSlotName = (value?: string) => value?.trim() ?? ''

const ensureProjectDraftState = (projectId: number) => {
  const existing = uploadProjectDrafts.value[projectId]
  if (existing) return existing

  const nextState: UploadProjectDraftState = {
    buildings: [],
    floorsByBuilding: {},
    lastBuildingName: '',
    lastSelectionByType: {},
  }
  uploadProjectDrafts.value = {
    ...uploadProjectDrafts.value,
    [projectId]: nextState,
  }
  return nextState
}

const mergeUniqueOptions = (...groups: Array<Array<string | undefined>>) => {
  const values = groups
    .flat()
    .map((item) => normalizeSlotName(item))
    .filter((item) => !!item)
  return Array.from(new Set(values))
}

const setProjectBuildings = (
  projectId: number,
  buildings: ProjectBuildingInfo[],
) => {
  projectBuildingCache.value = {
    ...projectBuildingCache.value,
    [projectId]: buildings,
  }
  if (form.value.projectId === projectId) {
    projectBuildings.value = buildings
  }
}

const loadProjectBuildings = async (projectId: number, force = false) => {
  const cached = projectBuildingCache.value[projectId]
  if (!force && cached) {
    projectBuildings.value = cached
    return cached
  }

  try {
    const response = await getProjectBuildings(projectId)
    const buildings =
      response.code === 200 && Array.isArray(response.data) ? response.data : []
    setProjectBuildings(projectId, buildings)
    return buildings
  } catch (error) {
    console.error('加载项目幢层树失败:', error)
    if (form.value.projectId === projectId) {
      ElMessage.error('加载项目幢层树失败')
    }
    setProjectBuildings(projectId, [])
    return []
  }
}

const syncDraftBuildingOption = (projectId: number, buildingName: string) => {
  const normalizedBuildingName = normalizeSlotName(buildingName)
  if (!normalizedBuildingName) return

  const draft = ensureProjectDraftState(projectId)
  uploadProjectDrafts.value = {
    ...uploadProjectDrafts.value,
    [projectId]: {
      ...draft,
      buildings: mergeUniqueOptions(draft.buildings, [normalizedBuildingName]),
      lastBuildingName: normalizedBuildingName,
    },
  }
}

const syncDraftFloorOption = (
  projectId: number,
  buildingName: string,
  floorName: string,
) => {
  const normalizedBuildingName = normalizeSlotName(buildingName)
  const normalizedFloorName = normalizeSlotName(floorName)
  if (!normalizedBuildingName || !normalizedFloorName) return

  const draft = ensureProjectDraftState(projectId)
  uploadProjectDrafts.value = {
    ...uploadProjectDrafts.value,
    [projectId]: {
      ...draft,
      floorsByBuilding: {
        ...draft.floorsByBuilding,
        [normalizedBuildingName]: mergeUniqueOptions(
          draft.floorsByBuilding[normalizedBuildingName] || [],
          [normalizedFloorName],
        ),
      },
    },
  }
}

const rememberSelectionForCurrentType = () => {
  const projectId = form.value.projectId
  if (!projectId || !form.value.fileType) return

  const buildingName = normalizeSlotName(form.value.buildingName)
  const floorName = normalizeSlotName(form.value.floorName)
  if (!buildingName) return

  const draft = ensureProjectDraftState(projectId)
  uploadProjectDrafts.value = {
    ...uploadProjectDrafts.value,
    [projectId]: {
      ...draft,
      lastBuildingName: buildingName,
      lastSelectionByType: {
        ...draft.lastSelectionByType,
        [form.value.fileType]: {
          buildingName,
          floorName,
        },
      },
    },
  }
}

const getPreferredSelectionForType = (projectId: number, fileType: string) => {
  const draft = uploadProjectDrafts.value[projectId]
  if (!draft) {
    return {
      buildingName: '',
      floorName: '',
    }
  }

  const currentTypeSelection = draft.lastSelectionByType[fileType]
  if (currentTypeSelection?.buildingName) {
    return currentTypeSelection
  }

  if (fileType === 'CAD') {
    const bimSelection = draft.lastSelectionByType.BIM
    if (bimSelection?.buildingName) {
      return {
        buildingName: bimSelection.buildingName,
        floorName: '',
      }
    }
  }

  return {
    buildingName: draft.lastBuildingName || '',
    floorName: '',
  }
}

const normalizedBuildingName = computed(() =>
  normalizeSlotName(form.value.buildingName),
)

const currentProjectDraft = computed(() => {
  const projectId = form.value.projectId
  if (!projectId) return null
  return uploadProjectDrafts.value[projectId] || null
})

const buildingOptions = computed(() => {
  const apiBuildings = projectBuildings.value.map((item) => item.buildingName)
  return mergeUniqueOptions(
    apiBuildings,
    currentProjectDraft.value?.buildings || [],
  )
})

const floorOptions = computed(() => {
  if (!normalizedBuildingName.value) return []

  const apiFloors =
    projectBuildings.value
      .find((item) => item.buildingName === normalizedBuildingName.value)
      ?.floors.map((item) => item.floorName) || []
  const draftFloors =
    currentProjectDraft.value?.floorsByBuilding[normalizedBuildingName.value] ||
    []
  return mergeUniqueOptions(apiFloors, draftFloors)
})

const requiresBuildingName = computed(() => {
  return ['BIM', 'CAD', 'scan', 'gauss'].includes(form.value.fileType)
})

const showsFloorName = computed(() => {
  return ['CAD', 'scan', 'gauss'].includes(form.value.fileType)
})

const requiresFloorName = computed(() => {
  return ['CAD', 'scan', 'gauss'].includes(form.value.fileType)
})

const isUploadMetadataLocked = computed(() => {
  return isResumingUpload.value || isResumingFromPause.value
})

/**
 * 表单验证规则
 */
const rules = computed(() => ({
  projectId: [{ required: true, message: '请选择项目', trigger: 'change' }],
  fileType: [{ required: true, message: '请选择文件类型', trigger: 'change' }],
  buildingName:
    requiresBuildingName.value && !isUploadMetadataLocked.value
      ? [{ required: true, message: '请输入所属幢', trigger: 'change' }]
      : [],
  floorName:
    requiresFloorName.value && !isUploadMetadataLocked.value
      ? [{ required: true, message: '请输入所属层', trigger: 'change' }]
      : [],
  file: isResumingUpload.value
    ? []
    : [{ required: true, message: '请选择文件', trigger: 'change' }],
  producedAt:
    form.value.fileType === 'scan' &&
    !isResumingUpload.value &&
    !isResumingFromPause.value
      ? [{ required: true, message: '请选择扫描日期', trigger: 'change' }]
      : [],
}))

/**
 * 是否可以选择文件 - 必须先选择项目和文件类型
 */
const canSelectFile = computed(() => {
  return !!(form.value.projectId && form.value.fileType)
})

/**
 * 文件拖拽区域标题
 */
const fileDropzoneTitle = computed(() => {
  if (!form.value.projectId) {
    return '请先选择项目'
  }
  if (!form.value.fileType) {
    return '请先选择文件类型'
  }
  if (isResumingUpload.value) {
    return '重新选择刚才那份文件后即可继续上传'
  }
  return '上传BIM模型、CAD图纸、扫描数据或高斯模型'
})

const allowedUIFileTypes = new Set(['BIM', 'CAD', 'scan', 'gauss'])

/**
 * 根据文件类型动态获取接受的文件扩展名
 */
const acceptFileTypes = computed(() => {
  const fileType = form.value.fileType
  const typeMap: Record<string, string> = {
    BIM: '.ifc,.IFC',
    CAD: '.dwg,.dxf,.DWG,.DXF',
    scan: '.zip,.ZIP',
    gauss: '.zip,.ZIP',
  }
  return typeMap[fileType] || '.ifc,.dwg,.dxf,.zip,.IFC,.DWG,.DXF,.ZIP'
})

/**
 * 获取文件格式提示
 */
const getFileTypeTip = computed(() => {
  const fileType = form.value.fileType
  const tipMap: Record<string, string> = {
    BIM: '支持 .ifc 格式',
    CAD: '支持 .dwg, .dxf 格式',
    scan: '支持 .zip 格式',
    gauss: '支持 .zip 格式（压缩包内需包含且仅包含一个 .lcc 文件）',
  }
  return tipMap[fileType] || '支持 .ifc, .dwg, .dxf, .zip 格式'
})

/**
 * 获取文件类型描述
 */
const getFileTypeDescription = (): string => {
  const fileType = form.value.fileType
  const descMap: Record<string, string> = {
    BIM: '.ifc',
    CAD: '.dwg, .dxf',
    scan: '.zip',
    gauss: '.zip',
  }
  return descMap[fileType] || '.ifc, .dwg, .dxf, .zip'
}

/**
 * 未完成的上传列表
 */
const pendingUploads = ref<UploadState[]>([])

/**
 * 是否显示未完成上传对话框
 */
const showPendingUploadsDialog = ref(false)

/**
 * 是否正在从断点恢复上传（从未完成列表恢复）
 */
const isResumingUpload = ref(false)

/**
 * 是否是从暂停状态继续上传
 */
const isResumingFromPause = ref(false)

/**
 * 要恢复的 uploadId
 */
const resumeUploadId = ref<number | null>(null)
const resumeUploadState = ref<UploadState | null>(null)
const isCheckingResumeFile = ref(false)
const resumeFileVerified = ref(false)

/**
 * 加载未完成的上传
 */
const loadPendingUploads = () => {
  pendingUploads.value = UploadStateManager.getAllUploadStates()
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
 * 格式化时间戳
 */
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  return `${days}天前`
}

/**
 * 处理恢复上传
 */
const handleResumeUpload = async (upload: UploadState) => {
  try {
    const uiFileType = getUIFileType(upload.fileType)
    if (!uiFileType || !allowedUIFileTypes.has(uiFileType)) {
      ElMessage.warning('该文件类型已不支持上传，请删除这条可继续记录')
      return
    }

    // 关闭未完成上传对话框
    showPendingUploadsDialog.value = false

    // 设置表单数据
    form.value.projectId = upload.projectId
    form.value.fileType = uiFileType
    form.value.fileName = upload.fileName
    form.value.description = upload.description || ''
    form.value.buildingName = normalizeSlotName(upload.buildingName)
    form.value.floorName = normalizeSlotName(upload.floorName)
    form.value.producedAt = upload.producedAt || ''

    // 设置恢复上传标志
    isResumingUpload.value = true
    isResumingFromPause.value = false
    resumeUploadState.value = upload
    isCheckingResumeFile.value = false
    resumeFileVerified.value = false

    // 设置初始进度
    uploadProgress.value = upload.progress
    setChunkProgress(upload.uploadedChunks.length, upload.totalChunks)
    setUploadPhase('uploading')

    // 保存要恢复的 uploadId，用于后续处理
    resumeUploadId.value = upload.uploadId

    ElMessage.info('重新选择刚才那份文件后即可继续上传')
  } catch (error) {
    console.error('恢复上传失败:', error)
    ElMessage.error('恢复上传失败')
  }
}

/**
 * 将 API 文件类型转换为 UI 文件类型
 */
const getUIFileType = (apiType: string): string => {
  const typeMap: Record<string, string> = {
    bim: 'BIM',
    cad: 'CAD',
    scan: 'scan',
    gauss: 'gauss',
  }
  return typeMap[apiType] || ''
}

/**
 * 处理删除未完成的上传
 */
const handleDeletePendingUpload = async (uploadId: number) => {
  try {
    await ElMessageBox.confirm(
      '确定移除这条可继续上传记录吗？移除后将无法继续。',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )

    const uploadToDelete = pendingUploads.value.find(
      (u) => u.uploadId === uploadId,
    )

    // 检查是否正在显示该上传的进度
    if (uploadToDelete) {
      // 检查是否是当前正在恢复的上传
      if (resumeUploadId.value === uploadId) {
        // 重置恢复状态
        isResumingUpload.value = false
        resumeUploadId.value = null
        resumeUploadState.value = null
        isCheckingResumeFile.value = false
        resumeFileVerified.value = false
        // 并清除进度（因为当前显示的就是这个）
        uploadProgress.value = 0
        uploading.value = false
        resetUploadState()

        // 如果文件匹配，也清空文件选择
        if (
          form.value.file &&
          form.value.file.name === uploadToDelete.fileName &&
          form.value.file.size === uploadToDelete.fileSize
        ) {
          form.value.file = null
          form.value.fileName = ''
          fileDropzoneRef.value?.reset()
          ElMessage.info('已清除相关的上传进度')
        } else {
          ElMessage.info('已清除上传进度')
        }
      }
      // 即使不是恢复状态，如果当前有进度显示且文件匹配，也应该清除
      else if (
        form.value.file &&
        form.value.file.name === uploadToDelete.fileName &&
        form.value.file.size === uploadToDelete.fileSize &&
        uploadProgress.value > 0 &&
        !uploading.value
      ) {
        // 重置上传进度和状态
        uploadProgress.value = 0
        uploading.value = false
        resetUploadState()

        // 清空文件选择
        form.value.file = null
        form.value.fileName = ''
        fileDropzoneRef.value?.reset()

        ElMessage.info('已清除相关的上传进度')
      }
    }

    // 删除保存的上传状态
    UploadStateManager.removeUploadState(uploadId)

    // 重新加载未完成上传列表
    loadPendingUploads()

    ElMessage.success('已删除')
  } catch (error) {
    // 用户取消删除
  }
}

/**
 * 检查文件是否匹配
 */
const checkFileMatch = async (selectedFile: File) => {
  if (!resumeUploadId.value) return

  try {
    // 获取保存的上传状态
    const uploadState =
      resumeUploadState.value ||
      UploadStateManager.getUploadState(resumeUploadId.value)
    if (!uploadState) return

    isCheckingResumeFile.value = true
    resumeFileVerified.value = false

    const isLikelySameLocalFile =
      uploadState.fileName === selectedFile.name &&
      uploadState.fileSize === selectedFile.size &&
      typeof uploadState.fileLastModified === 'number' &&
      uploadState.fileLastModified === selectedFile.lastModified

    if (isLikelySameLocalFile) {
      resumeFileVerified.value = true
      ElMessage.success('文件已确认，可以继续上传')
      return
    }

    // 动态导入计算 hash 的函数
    const { calculateFileHash } = await import('@/utils/upload')

    // 计算所选文件的校验值
    ElMessage.info('正在检查文件...')
    const fileHash = await calculateFileHash(selectedFile)

    // 检查 hash 是否匹配
    if (fileHash === uploadState.fileHash) {
      resumeFileVerified.value = true
      ElMessage.success('文件已确认，可以继续上传')
    } else {
      ElMessage.warning('不是刚才那份文件，请重新选择')
      // 重置恢复状态
      isResumingUpload.value = false
      resumeUploadId.value = null
      resumeUploadState.value = null
      form.value.file = null
      form.value.fileName = ''
      fileDropzoneRef.value?.reset()
      uploadProgress.value = 0
      resetUploadState()
    }
  } catch (error) {
    console.error('文件验证失败:', error)
    ElMessage.error('文件检查失败')
  } finally {
    isCheckingResumeFile.value = false
  }
}

/**
 * 处理从当前暂停状态继续上传
 */
const handleResumeCurrentUpload = () => {
  // 触发继续上传事件
  emit('resume-upload')
}

/**
 * 监听弹窗打开，重置表单和加载项目列表
 */
watch(visible, (newVal) => {
  if (newVal) {
    resetForm()
    loadProjectList()
    loadPendingUploads()
  }
})

watch(
  () => form.value.projectId,
  async (projectId) => {
    if (!projectId) {
      projectBuildings.value = []
      return
    }
    await loadProjectBuildings(projectId)
  },
)

/**
 * 监听项目和文件类型变化，清空已选择的文件
 */
watch([() => form.value.projectId, () => form.value.fileType], () => {
  // 如果项目或文件类型发生变化，清空已选择的文件
  if (form.value.file) {
    form.value.file = null
    form.value.fileName = ''
    fileDropzoneRef.value?.reset()
  }
  resumeFileVerified.value = false
  isCheckingResumeFile.value = false
})

/**
 * 处理项目选择变化
 */
const handleProjectChange = () => {
  // 清空文件类型和已选择的文件
  form.value.buildingName = ''
  form.value.floorName = ''
  form.value.fileType = ''
  form.value.file = null
  form.value.fileName = ''
  form.value.producedAt = ''
  fileDropzoneRef.value?.reset()
  resumeFileVerified.value = false
  isCheckingResumeFile.value = false
}

/**
 * 处理文件类型选择变化
 */
const handleFileTypeChange = () => {
  // 清空已选择的文件
  form.value.file = null
  form.value.fileName = ''
  form.value.producedAt = ''
  fileDropzoneRef.value?.reset()
  resumeFileVerified.value = false
  isCheckingResumeFile.value = false

  if (!form.value.projectId || isUploadMetadataLocked.value) {
    form.value.buildingName = ''
    form.value.floorName = ''
    return
  }

  const nextSelection = getPreferredSelectionForType(
    form.value.projectId,
    form.value.fileType,
  )
  form.value.buildingName = nextSelection.buildingName
  form.value.floorName = showsFloorName.value ? nextSelection.floorName : ''
}

const handleBuildingChange = (value: string) => {
  const normalized = normalizeSlotName(value)

  if (normalized !== value) {
    form.value.buildingName = normalized
  }

  if (form.value.projectId && normalized) {
    syncDraftBuildingOption(form.value.projectId, normalized)
  }

  form.value.floorName = ''
  rememberSelectionForCurrentType()
}

const handleFloorChange = (value: string) => {
  const normalized = normalizeSlotName(value)

  if (normalized !== value) {
    form.value.floorName = normalized
  }

  if (form.value.projectId && normalizedBuildingName.value && normalized) {
    syncDraftFloorOption(
      form.value.projectId,
      normalizedBuildingName.value,
      normalized,
    )
  }

  rememberSelectionForCurrentType()
}

/**
 * 处理文件选择变化
 */
const handleFileChange = (file: File | File[] | null) => {
  const validateFileType = (selectedFile: File): boolean => {
    if (!allowedUIFileTypes.has(form.value.fileType)) return false

    const ext = selectedFile.name.split('.').pop()?.toLowerCase() || ''
    const allowedExtMap: Record<string, string[]> = {
      BIM: ['ifc'],
      CAD: ['dwg', 'dxf'],
      scan: ['zip'],
      gauss: ['zip'],
    }
    return allowedExtMap[form.value.fileType]?.includes(ext) ?? false
  }

  const rejectFile = () => {
    ElMessage.error('文件格式不支持，请重新选择')
    form.value.file = null
    form.value.fileName = ''
    fileDropzoneRef.value?.reset()
    resumeFileVerified.value = false
    isCheckingResumeFile.value = false
  }

  if (Array.isArray(file)) {
    // 多文件情况，只处理第一个
    if (file.length > 0) {
      if (!validateFileType(file[0])) {
        rejectFile()
        return
      }

      form.value.file = file[0]
      form.value.fileName = file[0].name
      resumeFileVerified.value = !isResumingUpload.value
      // 如果是恢复上传状态，检查文件是否匹配
      if (isResumingUpload.value && resumeUploadId.value) {
        void checkFileMatch(file[0])
      }
    }
  } else if (file) {
    if (!validateFileType(file)) {
      rejectFile()
      return
    }

    form.value.file = file
    form.value.fileName = file.name
    resumeFileVerified.value = !isResumingUpload.value
    // 如果是恢复上传状态，检查文件是否匹配
    if (isResumingUpload.value && resumeUploadId.value) {
      void checkFileMatch(file)
    }
  } else {
    resumeFileVerified.value = false
    isCheckingResumeFile.value = false
  }
}

/**
 * 处理取消操作
 */
const handleCancel = () => {
  resetForm()
  visible.value = false
}

/**
 * 处理确认上传
 */
const handleConfirm = async () => {
  if (!formRef.value) return

  await formRef.value.validate((valid: boolean) => {
    if (valid) {
      // 验证项目是否选择
      if (!form.value.projectId) {
        ElMessage.warning('请先选择项目')
        return
      }

      // 验证文件类型是否选择
      if (!form.value.fileType) {
        ElMessage.warning('请先选择文件类型')
        return
      }

      if (!allowedUIFileTypes.has(form.value.fileType)) {
        ElMessage.error('不支持该文件类型上传')
        return
      }

      if (
        requiresBuildingName.value &&
        !isUploadMetadataLocked.value &&
        !form.value.buildingName?.trim()
      ) {
        ElMessage.warning('请输入所属幢')
        return
      }

      if (
        requiresFloorName.value &&
        !isUploadMetadataLocked.value &&
        !form.value.floorName?.trim()
      ) {
        ElMessage.warning('请输入所属层')
        return
      }

      // 验证文件是否选择
      if (!form.value.file) {
        // 如果是恢复上传状态，提示用户选择文件
        if (isResumingUpload.value) {
          ElMessage.warning('请重新选择刚才那份文件以继续上传')
          return
        } else {
          // 非恢复模式，提示选择文件
          ElMessage.warning('请选择要上传的文件')
          return
        }
      }

      if (isResumingUpload.value) {
        if (isCheckingResumeFile.value) {
          ElMessage.info('正在检查文件，请稍候')
          return
        }
        if (!resumeFileVerified.value) {
          ElMessage.warning('请重新选择刚才那份文件')
          return
        }
      }

      emit('confirm', {
        ...form.value,
        buildingName: normalizeSlotName(form.value.buildingName),
        floorName: normalizeSlotName(form.value.floorName),
      })
    } else {
      ElMessage.warning('请完善表单信息')
    }
  })
}

/**
 * 处理暂停上传（断点续传）
 */
const handleUploadPause = () => {
  // 设置标志，表示这是从暂停状态的继续上传
  isResumingFromPause.value = true

  // 触发暂停事件，由父组件处理
  emit('pause-upload')
}

/**
 * 处理关闭弹窗
 */
const handleClose = () => {
  resetForm()
  visible.value = false
}

/**
 * 重置表单
 */
const resetForm = () => {
  form.value = {
    buildingName: '',
    projectId: null as any, // 使用 null 表示未选择
    fileType: '',
    file: null,
    fileName: '',
    description: '',
    floorName: '',
    producedAt: '',
  }

  // 重置所有上传状态标志
  isResumingUpload.value = false
  isResumingFromPause.value = false
  resumeUploadId.value = null
  resumeUploadState.value = null
  isCheckingResumeFile.value = false
  resumeFileVerified.value = false

  if (!uploading.value) {
    uploadProgress.value = 0
    uploadStatus.value = undefined
    resetUploadState()
  }

  // 重置文件拖拽组件状态
  fileDropzoneRef.value?.reset()
  formRef.value?.clearValidate()
}

/**
 * 设置上传中状态
 */
const setUploading = (value: boolean) => {
  uploading.value = value

  if (value) {
    // 开始上传时记录开始时间
    const now = Date.now()
    uploadStartTime.value = now
    lastProgressTime.value = now
    uploadedBytes.value = 0
    if (uploadPhase.value === 'idle') {
      uploadPhase.value = 'hashing'
    }
  } else {
    // 结束上传时重置状态
    uploadProgress.value = 0
    uploadStatus.value = undefined
    resumeFileVerified.value = false
    isCheckingResumeFile.value = false
    resetUploadState()
  }
}

/**
 * 设置上传进度
 */
const setProgress = (progress: number) => {
  uploadProgress.value = progress

  // 计算上传速度和剩余时间
  if (uploadStartTime.value > 0 && form.value.file) {
    if (uploadPhase.value === 'hashing') {
      uploadSpeed.value = 0
      remainingTime.value = '准备中'
      return
    }

    const currentTime = Date.now()
    const totalBytes = form.value.file.size
    const currentBytes = Math.round((progress / 100) * totalBytes)
    const elapsedTime = (currentTime - lastProgressTime.value) / 1000 // 秒

    if (elapsedTime > 0 && currentBytes > uploadedBytes.value) {
      const speed = (currentBytes - uploadedBytes.value) / elapsedTime
      uploadSpeed.value = Math.round(speed)

      const remainingBytes = totalBytes - currentBytes
      if (speed > 0) {
        const remainingSeconds = Math.round(remainingBytes / speed)
        remainingTime.value = formatRemainingTime(remainingSeconds)
      }

      uploadedBytes.value = currentBytes
      lastProgressTime.value = currentTime
    }
  }

  if (progress === 100) {
    uploadStatus.value = 'success'
  }
}

/**
 * 格式化剩余时间
 */
const formatRemainingTime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.round(seconds / 60)}分钟`
  return `${Math.round(seconds / 3600)}小时`
}

/**
 * 获取上传状态
 */
const getUploadStatus = () => {
  if (uploadStatus.value === 'exception') return 'failed'
  if (uploadStatus.value === 'warning') return 'paused'
  if (uploading.value) return 'uploading'
  if (uploadStatus.value === 'success' || uploadProgress.value === 100)
    return 'completed'
  if (uploadProgress.value > 0 && !uploading.value) return 'paused'
  return 'uploading'
}

/**
 * 设置上传为暂停状态
 */
const setUploadPaused = () => {
  uploading.value = false
  uploadStatus.value = 'warning'
  uploadPhase.value = 'uploading'
}

/**
 * 设置上传为失败状态
 */
const setUploadFailed = (error?: string) => {
  uploading.value = false
  uploadStatus.value = 'exception'
  if (chunkProgress.value.total > chunkProgress.value.completed) {
    chunkProgress.value.failed = 1
  }
  if (error) {
    ElMessage.error(error)
  }
}

/**
 * 设置分片进度
 */
const setChunkProgress = (
  completedOrState:
    | number
    | { completed: number; total: number; active?: number; failed?: number },
  total?: number,
) => {
  if (typeof completedOrState === 'number') {
    chunkProgress.value.completed = completedOrState
    chunkProgress.value.total = total ?? 0
    chunkProgress.value.active = 0
    chunkProgress.value.failed = 0
    return
  }

  chunkProgress.value.completed = completedOrState.completed
  chunkProgress.value.total = completedOrState.total
  chunkProgress.value.active = completedOrState.active ?? 0
  chunkProgress.value.failed = completedOrState.failed ?? 0
}

const setUploadPhase = (
  phase: 'idle' | 'hashing' | 'uploading' | 'merging',
) => {
  uploadPhase.value = phase
}

const setHashProgress = (progress: number) => {
  hashProgress.value = progress
  if (progress > 0 && uploadPhase.value === 'idle') {
    uploadPhase.value = 'hashing'
  }
}

/**
 * 重置上传状态
 */
const resetUploadState = () => {
  uploadSpeed.value = 0
  remainingTime.value = ''
  hashProgress.value = 0
  uploadedBytes.value = 0
  lastProgressTime.value = 0
  uploadStartTime.value = 0
  uploadPhase.value = 'idle'
  chunkProgress.value = {
    completed: 0,
    total: 0,
    active: 0,
    failed: 0,
  }
}

/**
 * 关闭弹窗
 */
const close = () => {
  visible.value = false
}

const reloadProjectBuildings = async (
  projectId = form.value.projectId,
  force = false,
) => {
  if (!projectId) return []
  return loadProjectBuildings(projectId, force)
}

defineExpose({
  setUploading,
  setProgress,
  setChunkProgress,
  setUploadPaused,
  setUploadFailed,
  setUploadPhase,
  setHashProgress,
  close,
  resetForm,
  reloadProjectBuildings,
  isResumingUpload, // 暴露从未完成列表恢复的标志
  isResumingFromPause, // 暴露从暂停状态恢复的标志
  resumeUploadState,
})
</script>

<style lang="scss" scoped>
.upload-dialog {
  :deep(.el-dialog__body) {
    padding: 20px;
  }
}

.upload-dialog-subtitle {
  font-size: 13px;
  color: #909399;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.upload-form {
  .upload-area {
    width: 100%;

    :deep(.el-upload) {
      width: 100%;
    }

    :deep(.el-upload-dragger) {
      width: 100%;
      height: 180px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px dashed #dcdfe6;
      border-radius: 8px;
      background: #fafafa;
      transition: all 0.3s;

      &:hover {
        border-color: #409eff;
        background: #f5f7fa;
      }
    }

    .upload-content {
      text-align: center;

      .upload-icon {
        color: #909399;
        margin-bottom: 12px;
      }

      .upload-text {
        margin-bottom: 8px;

        .upload-hint {
          font-size: 14px;
          color: #606266;
          margin: 0;
        }

        .upload-filename {
          font-size: 14px;
          color: #409eff;
          font-weight: 600;
          margin: 0;
        }
      }

      .upload-tip {
        font-size: 12px;
        color: #909399;
      }
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.progress-text {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
  text-align: center;
}

.pending-uploads-alert {
  margin-bottom: 20px;

  .alert-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }
}

.pending-uploads-dialog {
  .pending-uploads-list {
    max-height: 400px;
    overflow-y: auto;
  }

  .pending-upload-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    margin-bottom: 12px;
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    transition: all 0.3s;

    &:hover {
      border-color: #409eff;
      background: #f5f7fa;
    }

    .upload-info {
      flex: 1;
      min-width: 0;

      .file-name {
        font-size: 14px;
        font-weight: 600;
        color: #303133;
        margin-bottom: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .file-meta {
        font-size: 12px;
        color: #909399;
        display: flex;
        align-items: center;
        gap: 8px;

        .separator {
          color: #dcdfe6;
        }
      }
    }

    .upload-actions {
      display: flex;
      gap: 8px;
      margin-left: 16px;
    }
  }
}
</style>
