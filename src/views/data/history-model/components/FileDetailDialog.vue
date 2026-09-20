<template>
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="600px"
    :before-close="handleClose"
    destroy-on-close
    class="file-detail-dialog"
  >
    <div class="file-detail-content">
      <!-- 文件基本信息 -->
      <div class="file-info-section">
        <h3 class="section-title">文件信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">文件名称：</span>
            <span class="info-value" :title="fileData.name">
              {{ fileData.name }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">文件类型：</span>
            <el-tag :type="getFileTypeTag(fileData.type)" size="small">
              {{ fileData.type }}
            </el-tag>
          </div>
          <div class="info-item">
            <span class="info-label">文件大小：</span>
            <span class="info-value">{{ fileData.size }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">文件状态：</span>
            <el-tag :type="getStatusTag(fileData.status)" size="small">
              {{ getStatusText(fileData.status) }}
            </el-tag>
          </div>
          <div class="info-item">
            <span class="info-label">上传人：</span>
            <span class="info-value">{{ fileData.uploader }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">上传时间：</span>
            <span class="info-value">{{ fileData.uploadTime }}</span>
          </div>
          <div v-if="fileData.fileType" class="info-item">
            <span class="info-label">文件格式：</span>
            <span class="info-value">
              {{ getFileFormat(fileData.fileType) }}
            </span>
          </div>
          <div v-if="fileData.meshRemesh?.supported" class="info-item">
            <span class="info-label">网格均匀化：</span>
            <el-tag
              :type="getMeshRemeshTag(fileData.meshRemesh.status)"
              size="small"
            >
              {{ getMeshRemeshText(fileData.meshRemesh.status) }}
            </el-tag>
          </div>
        </div>
      </div>

      <!-- 文件预览缩略图 -->
      <div v-if="showPreview" class="file-preview-section">
        <h3 class="section-title">预览</h3>
        <div class="preview-container">
          <div class="preview-card" :class="`preview-${previewMeta.tone}`">
            <div v-if="previewImageUrl" class="preview-thumb">
              <img :src="previewImageUrl" alt="预览缩略图" />
            </div>
            <div v-else class="preview-placeholder">
              <el-icon class="preview-icon">
                <component :is="previewMeta.icon" />
              </el-icon>
              <div class="preview-title">{{ previewMeta.title }}</div>
              <div class="preview-tip">{{ previewMeta.tip }}</div>
            </div>

            <div v-if="isPreviewLoading" class="preview-mask">
              <span>正在生成缩略图...</span>
            </div>
            <div v-else-if="previewError" class="preview-mask is-error">
              <span>{{ previewError }}</span>
            </div>

            <div class="preview-footer">
              <div class="preview-meta">
                <span class="preview-chip">
                  {{ fileData.type || '未知类型' }}
                </span>
                <span
                  v-if="fileData.fileType"
                  class="preview-format"
                  :title="getFileFormat(fileData.fileType)"
                >
                  {{ getFileFormat(fileData.fileType) }}
                </span>
              </div>
              <el-tag
                size="small"
                effect="light"
                :type="getStatusTag(fileData.status || '')"
              >
                {{ getStatusText(fileData.status || '') }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作记录 -->
      <div v-if="operationRecords.length > 0" class="file-operations-section">
        <h3 class="section-title">操作记录</h3>
        <el-timeline size="small">
          <el-timeline-item
            v-for="(record, index) in operationRecords"
            :key="index"
            :timestamp="record.time"
            placement="top"
          >
            <div class="operation-content">
              <span class="operation-action">{{ record.action }}</span>
              <span class="operation-user">{{ record.user }}</span>
            </div>
          </el-timeline-item>
        </el-timeline>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">关闭</el-button>
        <el-button
          v-if="canPreview"
          type="primary"
          :icon="View"
          @click="handlePreview"
        >
          预览文件
        </el-button>
        <el-button
          v-if="canDownload"
          type="success"
          :icon="Download"
          @click="handleDownload"
        >
          下载文件
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Box,
  Document,
  Location,
  Share,
  View,
  Download,
} from '@element-plus/icons-vue'
import type { FileData } from './ProjectTable.vue'
import { getScanPreview } from '@/api/calibration'

interface OperationRecord {
  time: string
  action: string
  user: string
}

type FileDataWithPreview = FileData & {
  previewUrl?: string
  thumbnailUrl?: string
}

interface Props {
  modelValue?: boolean
  fileData?: FileDataWithPreview
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'preview', file: FileData): void
  (e: 'download', file: FileData): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  fileData: () => ({
    id: '',
    type: '',
    name: '',
    size: '',
    status: '',
    uploader: '',
    uploadTime: '',
    fileType: '',
  }),
})

const emit = defineEmits<Emits>()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const dialogTitle = computed(() => {
  return `文件详情 - ${props.fileData.name || '未知文件'}`
})

// 是否可以预览
const canPreview = computed(() => {
  return (
    ['stored', '已上传'].includes(props.fileData.status || '') &&
    !!props.fileData.fileType
  )
})

// 是否可以下载
const canDownload = computed(() => {
  return ['stored', '已上传'].includes(props.fileData.status || '')
})

// 是否显示预览区域
const showPreview = computed(() => {
  return !!props.fileData.fileType
})

const previewImageUrl = ref('')
const previewError = ref('')
const isPreviewLoading = ref(false)
let previewToken = 0

const previewMeta = computed(() => {
  if (props.fileData.fileType === 'bim') {
    return {
      icon: Box,
      title: 'BIM 模型',
      tip: canPreview.value ? '点击预览按钮查看 3D 模型' : '上传完成后可预览',
      tone: 'bim',
    }
  }
  if (props.fileData.fileType === 'cad') {
    return {
      icon: Document,
      title: 'CAD 图纸',
      tip: canPreview.value ? '点击预览按钮查看图纸' : '上传完成后可预览',
      tone: 'cad',
    }
  }
  if (props.fileData.fileType === 'scan') {
    return {
      icon: Location,
      title: '点云文件',
      tip: canPreview.value ? '点击预览按钮查看点云数据' : '上传完成后可预览',
      tone: 'scan',
    }
  }
  if (props.fileData.fileType === 'gauss') {
    return {
      icon: Share,
      title: '高斯模型',
      tip: canPreview.value ? '点击预览按钮查看高斯模型' : '上传完成后可预览',
      tone: 'gauss',
    }
  }
  return {
    icon: Document,
    title: `${props.fileData.type || '未知类型'}文件`,
    tip: '此文件类型暂不支持预览',
    tone: 'default',
  }
})

const getMeshRemeshText = (status?: string) => {
  const textMap: Record<string, string> = {
    queued: '排队中',
    processing: '处理中',
    succeeded: '已完成',
    failed: '已失败',
  }
  return textMap[status || ''] || '未知'
}

const getMeshRemeshTag = (
  status?: string,
): 'warning' | 'primary' | 'success' | 'danger' | 'info' => {
  const tagMap: Record<
    string,
    'warning' | 'primary' | 'success' | 'danger' | 'info'
  > = {
    queued: 'warning',
    processing: 'primary',
    succeeded: 'success',
    failed: 'danger',
  }
  return tagMap[status || ''] || 'info'
}

// 模拟操作记录
const operationRecords = ref<OperationRecord[]>([])

const loadPreviewThumbnail = async (file: FileDataWithPreview) => {
  previewToken += 1
  const token = previewToken

  previewImageUrl.value = ''
  previewError.value = ''
  isPreviewLoading.value = false

  if (!file.fileType) return

  const inlinePreviewUrl = file.previewUrl || file.thumbnailUrl
  if (inlinePreviewUrl) {
    previewImageUrl.value = inlinePreviewUrl
    return
  }

  if (file.fileType !== 'scan') return
  if (!canPreview.value) {
    previewError.value = '文件未上传完成'
    return
  }
  if (!file.projectId) {
    previewError.value = '缺少项目信息'
    return
  }

  isPreviewLoading.value = true
  try {
    const res = await getScanPreview(Number(file.projectId), Number(file.id), {
      size: 360,
    })
    if (token !== previewToken) return
    if (res.code !== 200 || !res.data?.preview?.pngBase64) {
      previewError.value = res.msg || '缩略图获取失败'
      return
    }
    previewImageUrl.value = `data:image/png;base64,${res.data.preview.pngBase64}`
  } catch (error) {
    if (token !== previewToken) return
    previewError.value = '缩略图获取失败'
  } finally {
    if (token === previewToken) {
      isPreviewLoading.value = false
    }
  }
}

// 监听文件变化，生成操作记录
watch(
  [() => props.fileData, () => props.modelValue],
  ([newFile, isVisible]) => {
    if (newFile.id) {
      // 生成模拟的操作记录
      operationRecords.value = [
        {
          time: newFile.uploadTime || '未知时间',
          action: '上传文件',
          user: newFile.uploader || '未知用户',
        },
        ...(newFile.status === 'stored'
          ? [
              {
                time: newFile.uploadTime || '未知时间',
                action: '文件上传完成',
                user: '系统',
              },
            ]
          : []),
      ]
    } else {
      operationRecords.value = []
    }

    if (isVisible) {
      loadPreviewThumbnail(newFile)
    } else {
      previewImageUrl.value = ''
      previewError.value = ''
      isPreviewLoading.value = false
    }
  },
  { immediate: true, deep: true },
)

/**
 * 获取文件类型标签颜色
 */
const getFileTypeTag = (
  type: string,
): 'primary' | 'success' | 'warning' | 'danger' | 'info' => {
  const tagMap: Record<
    string,
    'primary' | 'success' | 'warning' | 'danger' | 'info'
  > = {
    BIM: 'primary',
    CAD: 'success',
    高斯模型: 'info',
    扫描记录: 'warning',
    点云文件: 'info',
  }
  return tagMap[type] || 'info'
}

/**
 * 获取状态标签颜色
 */
const getStatusTag = (
  status: string,
): 'primary' | 'success' | 'warning' | 'danger' | 'info' => {
  const tagMap: Record<
    string,
    'primary' | 'success' | 'warning' | 'danger' | 'info'
  > = {
    stored: 'success',
    已上传: 'success',
    pending_external: 'warning',
    上传中: 'warning',
    failed: 'danger',
    failed_external: 'danger',
  }
  return tagMap[status] || 'info'
}

/**
 * 获取状态文本
 */
const getStatusText = (status: string): string => {
  const textMap: Record<string, string> = {
    stored: '已上传',
    pending_external: '上传中',
    failed: '上传失败',
    failed_external: '上传失败',
  }
  return textMap[status] || status || '未知状态'
}

/**
 * 获取文件格式说明
 */
const getFileFormat = (fileType: string): string => {
  const formatMap: Record<string, string> = {
    bim: 'Revit 模型文件 (.rvt)',
    cad: 'CAD 图纸文件 (.dwg)',
    scan: '点云扫描文件 (.las/.laz)',
    gauss: '高斯模型压缩包 (.zip，内部包含 .lcc 资源)',
  }
  return formatMap[fileType] || '未知格式'
}

/**
 * 处理关闭弹窗
 */
const handleClose = () => {
  dialogVisible.value = false
}

/**
 * 处理预览文件
 */
const handlePreview = () => {
  emit('preview', props.fileData)
  handleClose()
}

/**
 * 处理下载文件
 */
const handleDownload = () => {
  emit('download', props.fileData)
  handleClose()
}
</script>

<style lang="scss" scoped>
.file-detail-dialog {
  :deep(.el-dialog__header) {
    padding: 16px 20px 12px;
    border-bottom: 1px solid #e6e8ef;
  }

  :deep(.el-dialog__title) {
    font-size: 15px;
    font-weight: 600;
    color: #1f2937;
  }

  :deep(.el-dialog__body) {
    padding: 16px 20px 12px;
  }

  :deep(.el-dialog__footer) {
    padding: 12px 20px 18px;
  }

  .file-detail-content {
    display: flex;
    flex-direction: column;
    gap: 20px;

    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: #4b5563;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      letter-spacing: 0.4px;
    }

    .section-title::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e6e8ef;
    }

    .file-info-section {
      .info-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px 16px;
        padding: 14px 16px;
        border-radius: 10px;
        border: 1px solid #e6e9ef;
        background: #f8fafc;

        .info-item {
          display: grid;
          grid-template-columns: 86px 1fr;
          align-items: center;
          min-height: 32px;
          gap: 8px;

          .info-label {
            color: #6b7280;
            font-size: 12px;
            flex-shrink: 1;
          }

          .info-value {
            color: #111827;
            font-size: 14px;
            font-weight: 500;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      }
    }

    .file-preview-section {
      .preview-container {
        padding: 12px;
        border-radius: 12px;
        border: 1px solid #e6e9ef;
        background: #f8fafc;
      }

      .preview-card {
        position: relative;
        border-radius: 10px;
        border: 1px solid #e6e9ef;
        overflow: hidden;
        background: #ffffff;
        min-height: 220px;
        display: flex;
        flex-direction: column;
        --preview-accent: #6b7280;
        --preview-chip-bg: #f3f4f6;
        --preview-chip-color: #6b7280;
      }

      .preview-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: var(--preview-accent);
      }

      .preview-bim {
        --preview-accent: #2563eb;
        --preview-chip-bg: #e8f1ff;
        --preview-chip-color: #1d4ed8;
      }

      .preview-cad {
        --preview-accent: #059669;
        --preview-chip-bg: #ecfdf3;
        --preview-chip-color: #047857;
      }

      .preview-scan {
        --preview-accent: #d97706;
        --preview-chip-bg: #fff7ed;
        --preview-chip-color: #b45309;
      }

      .preview-default {
        --preview-accent: #6b7280;
        --preview-chip-bg: #f3f4f6;
        --preview-chip-color: #6b7280;
      }

      .preview-thumb {
        height: 200px;

        img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      }

      .preview-placeholder {
        flex: 1;
        padding: 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        background: linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%);
        color: #6b7280;
      }

      .preview-icon {
        font-size: 42px;
        color: #9ca3af;
        margin-bottom: 10px;
      }

      .preview-title {
        font-size: 14px;
        font-weight: 600;
        color: #374151;
      }

      .preview-tip {
        font-size: 12px;
        color: #9ca3af;
        margin-top: 6px;
      }

      .preview-mask {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: #6b7280;
        background: rgba(255, 255, 255, 0.78);
        backdrop-filter: blur(2px);
      }

      .preview-mask.is-error {
        color: #b91c1c;
        background: rgba(254, 242, 242, 0.9);
      }

      .preview-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border-top: 1px solid #eef2f7;
        background: #f9fafb;
      }

      .preview-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .preview-chip {
        font-size: 12px;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 999px;
        background: var(--preview-chip-bg);
        color: var(--preview-chip-color);
        white-space: nowrap;
      }

      .preview-format {
        font-size: 12px;
        color: #6b7280;
        max-width: 240px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .file-operations-section {
      :deep(.el-timeline) {
        padding-left: 0;
      }

      .operation-content {
        .operation-action {
          font-weight: 500;
          color: #303133;
          margin-right: 8px;
        }

        .operation-user {
          color: #909399;
          font-size: 13px;
        }
      }
    }
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}

// 响应式布局
@media (max-width: 768px) {
  .file-detail-dialog {
    .file-detail-content {
      .file-info-section {
        .info-grid {
          grid-template-columns: 1fr;
        }
      }
    }
  }
}
</style>
