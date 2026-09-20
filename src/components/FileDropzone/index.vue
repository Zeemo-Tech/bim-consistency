<template>
  <div
    class="file-dropzone"
    :class="{
      'is-dragging': isDragging,
      'has-file': hasFile,
      'is-disabled': disabled
    }"
    @drop="handleDrop"
    @dragover="handleDragOver"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
  >
    <!-- 文件选择器 -->
    <el-upload
      ref="uploadRef"
      :auto-upload="false"
      :show-file-list="false"
      :multiple="multiple"
      :accept="accept"
      :on-change="handleFileChange"
      :disabled="disabled"
      class="upload-wrapper"
    >
      <div class="dropzone-content">
        <!-- 文件预览 -->
        <div v-if="previewFile" class="file-preview">
          <div class="preview-icon">
            <el-icon :size="48" :class="getPreviewIconClass">
              <component :is="getPreviewIcon" />
            </el-icon>
          </div>
          <div class="preview-info">
            <div class="preview-name">{{ previewFile.name }}</div>
            <div class="preview-meta">
              <span>{{ formatFileSize(previewFile.size) }}</span>
              <span class="separator">•</span>
              <span>{{ getFileTypeLabel(previewFile.name) }}</span>
            </div>
          </div>
          <div class="preview-actions">
            <el-button
              type="danger"
              size="small"
              :icon="Delete"
              @click.stop="handleRemoveFile"
            >
              移除
            </el-button>
            <el-button
              type="primary"
              size="small"
              :icon="Edit"
              @click.stop="handleReplaceFile"
            >
              替换
            </el-button>
          </div>
        </div>

        <!-- 默认拖拽区域 -->
        <div v-else class="dropzone-default">
          <div class="dropzone-icon">
            <el-icon :size="64">
              <UploadFilled />
            </el-icon>
          </div>
          <div class="dropzone-text">
            <h3>{{ title || '拖拽文件到此处上传' }}</h3>
            <p>{{ subtitle || '或者点击选择文件' }}</p>
          </div>
          <div class="dropzone-hints">
            <div class="hint-item" v-if="fileTypes">
              <el-icon :size="16"><Document /></el-icon>
              <span>支持格式: {{ fileTypes }}</span>
            </div>
            <div class="hint-item" v-if="maxSize">
              <el-icon :size="16"><ScaleToOriginal /></el-icon>
              <span>最大文件: {{ formatFileSize(maxSize) }}</span>
            </div>
          </div>
          <el-button
            type="primary"
            :icon="FolderOpened"
            class="select-btn"
          >
            选择文件
          </el-button>
        </div>

        <!-- 拖拽时的覆盖层 -->
        <div v-if="isDragging" class="drag-overlay">
          <div class="drag-content">
            <el-icon :size="80" class="drag-icon">
              <UploadFilled />
            </el-icon>
            <h3>松开鼠标上传文件</h3>
          </div>
        </div>
      </div>
    </el-upload>

    <!-- 多个文件列表 -->
    <div v-if="multiple && files.length > 1" class="files-list">
      <div class="files-header">
        <span>已选择 {{ files.length }} 个文件</span>
        <el-button
          type="danger"
          size="small"
          text
          @click="handleClearAll"
        >
          清空
        </el-button>
      </div>
      <div class="files-grid">
        <div
          v-for="(file, index) in files"
          :key="index"
          class="file-item"
        >
          <div class="file-icon">
            <el-icon :size="24" :class="getFileIconClass(file.name)">
              <component :is="getFileIcon(file.name)" />
            </el-icon>
          </div>
          <div class="file-info">
            <div class="file-name">{{ file.name }}</div>
            <div class="file-size">{{ formatFileSize(file.size) }}</div>
          </div>
          <div class="file-actions">
            <el-button
              type="danger"
              size="small"
              text
              :icon="Delete"
              @click="handleRemoveFileByIndex(index)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  UploadFilled,
  FolderOpened,
  Document,
  ScaleToOriginal,
  Delete,
  Edit,
  Files,
  Folder,
  VideoPlay
} from '@element-plus/icons-vue'
import type { UploadFile, UploadFiles } from 'element-plus'

/**
 * 组件属性定义
 */
interface Props {
  modelValue?: File | File[]
  accept?: string
  multiple?: boolean
  maxSize?: number // 最大文件大小（字节）
  fileTypes?: string // 支持的文件类型描述
  title?: string
  subtitle?: string
  disabled?: boolean
}

/**
 * 组件事件定义
 */
interface Emits {
  (e: 'update:modelValue', value: File | File[]): void
  (e: 'change', file: File | File[]): void
  (e: 'file-remove', index: number): void
}

const props = withDefaults(defineProps<Props>(), {
  multiple: false
})

const emit = defineEmits<Emits>()

/**
 * 组件状态
 */
const uploadRef = ref()
const isDragging = ref(false)
const files = ref<File[]>([])

/**
 * 计算属性
 */
const previewFile = computed<File | null>(() => {
  if (props.multiple) {
    return files.value[0] || null
  }
  if (props.modelValue) {
    return Array.isArray(props.modelValue)
      ? props.modelValue[0] || null
      : props.modelValue
  }
  return files.value[0] || null
})

const hasFile = computed(() => {
  if (props.multiple) {
    return files.value.length > 0
  }
  return !!(props.modelValue || files.value[0])
})

/**
 * 文件图标相关
 */
const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (['rvt', 'ifc'].includes(ext || '')) return Files
  if (['dwg', 'dxf'].includes(ext || '')) return Folder
  if (['zip'].includes(ext || '')) return FolderOpened
  return VideoPlay
}

const getFileIconClass = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (['rvt', 'ifc'].includes(ext || '')) return 'icon-bim'
  if (['dwg', 'dxf'].includes(ext || '')) return 'icon-cad'
  if (['las', 'laz', 'e57'].includes(ext || '')) return 'icon-pointcloud'
  if (['zip'].includes(ext || '')) return 'icon-scan'
  return 'icon-file'
}

const getPreviewIcon = computed(() => {
  if (!previewFile.value) return VideoPlay
  return getFileIcon(previewFile.value.name)
})

const getPreviewIconClass = computed(() => {
  if (!previewFile.value) return 'icon-file'
  return getFileIconClass(previewFile.value.name)
})

const getFileTypeLabel = (fileName: string): string => {
  const typeMap: Record<string, string> = {
    'rvt': 'BIM 模型',
    'ifc': 'BIM 模型',
    'dwg': 'CAD 图纸',
    'dxf': 'CAD 图纸',
    'las': '点云文件',
    'laz': '点云文件',
    'e57': '点云文件',
    'csv': '轨迹数据',
    'zip': '扫描数据'
  }
  const ext = fileName.split('.').pop()?.toLowerCase()
  return typeMap[ext || ''] || '未知类型'
}

/**
 * 拖拽事件处理
 */
const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
}

const handleDragEnter = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  if (!props.disabled) {
    isDragging.value = true
  }
}

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = false
}

const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = false

  if (props.disabled) return

  const droppedFiles = Array.from(e.dataTransfer?.files || [])
  if (droppedFiles.length === 0) return

  if (props.multiple) {
    const newFiles = [...files.value, ...droppedFiles]
    files.value = newFiles
    emit('update:modelValue', newFiles)
    emit('change', newFiles)
  } else {
    const file = droppedFiles[0]
    files.value = [file]
    emit('update:modelValue', file)
    emit('change', file)
  }
}

/**
 * 文件选择处理
 */
const handleFileChange = (uploadFile: UploadFile, fileList: UploadFiles) => {
  if (props.disabled) return

  const file = uploadFile.raw
  if (!file) return

  // 检查文件大小
  if (props.maxSize && file.size > props.maxSize) {
    ElMessage.error(`文件大小不能超过 ${formatFileSize(props.maxSize)}`)
    return
  }

  if (props.multiple) {
    const newFiles = [...files.value, file]
    files.value = newFiles
    emit('update:modelValue', newFiles)
    emit('change', newFiles)
  } else {
    files.value = [file]
    emit('update:modelValue', file)
    emit('change', file)
  }
}

/**
 * 文件移除处理
 */
const handleRemoveFile = () => {
  files.value = []
  emit('update:modelValue', props.multiple ? [] : null as any)
  emit('change', props.multiple ? [] : null as any)
}

const handleRemoveFileByIndex = (index: number) => {
  const newFiles = files.value.filter((_, i) => i !== index)
  files.value = newFiles
  emit('update:modelValue', props.multiple ? newFiles : (newFiles[0] || null))
  emit('change', props.multiple ? newFiles : (newFiles[0] || null))
  emit('file-remove', index)
}

const handleClearAll = () => {
  files.value = []
  emit('update:modelValue', [])
  emit('change', [])
}

const handleReplaceFile = () => {
  uploadRef.value?.$el.querySelector('input[type="file"]')?.click()
}

/**
 * 工具函数
 */
const formatFileSize = (size: number): string => {
  if (size === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(size) / Math.log(k))
  return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 重置文件选择
 */
const reset = () => {
  files.value = []
  // 清空 el-upload 组件的文件列表
  if (uploadRef.value) {
    uploadRef.value.clearFiles()
  }
  // 通知外部组件重置
  emit('update:modelValue', props.multiple ? [] : null as any)
  emit('change', props.multiple ? [] : null as any)
}

/**
 * 监听外部值变化
 */
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    if (props.multiple) {
      files.value = Array.isArray(newValue) ? newValue : [newValue]
    } else {
      files.value = Array.isArray(newValue) ? newValue : (newValue ? [newValue] : [])
    }
  } else {
    // 当外部值为 null 或 undefined 时，清空内部文件数组
    files.value = []
  }
}, { immediate: true })

// 暴露重置方法给父组件
defineExpose({
  reset
})
</script>

<style lang="scss" scoped>
.file-dropzone {
  position: relative;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;

  &.is-dragging {
    .dropzone-content {
      border-color: #3b82f6;
      background: #f0f9ff;
    }
  }

  &.has-file {
    .dropzone-content {
      border-color: #e5e7eb;
      background: #fafafa;
    }
  }

  &.is-disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.upload-wrapper {
  width: 100%;
  :deep(.el-upload) {
    width: 100%;
  }
  :deep(.el-upload-dragger) {
    width: 100%;
    height: auto;
    border: none;
    background: transparent;
  }
}

.dropzone-content {
  position: relative;
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  background: #ffffff;
  min-height: 240px;
  padding: 32px;
  transition: all 0.3s ease;
  cursor: pointer;

  &:hover {
    border-color: #9ca3af;
    background: #f9fafb;
  }
}

.file-preview {
  display: flex;
  align-items: center;
  gap: 20px;

  .preview-icon {
    width: 80px;
    height: 80px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    .icon-bim { color: #3b82f6; background: #eff6ff; }
    .icon-cad { color: #10b981; background: #ecfdf5; }
    .icon-pointcloud { color: #f59e0b; background: #fef3c7; }
    .icon-scan { color: #8b5cf6; background: #f5f3ff; }
    .icon-file { color: #6b7280; background: #f3f4f6; }
  }

  .preview-info {
    flex: 1;
    min-width: 0;

    .preview-name {
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .preview-meta {
      font-size: 14px;
      color: #6b7280;
      display: flex;
      align-items: center;
      gap: 8px;

      .separator {
        color: #d1d5db;
      }
    }
  }

  .preview-actions {
    display: flex;
    gap: 8px;
  }
}

.dropzone-default {
  text-align: center;

  .dropzone-icon {
    margin-bottom: 16px;
    color: #9ca3af;
  }

  .dropzone-text {
    margin-bottom: 24px;

    h3 {
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
    }

    p {
      font-size: 14px;
      color: #6b7280;
      margin: 0;
    }
  }

  .dropzone-hints {
    display: flex;
    justify-content: center;
    gap: 24px;
    margin-bottom: 24px;

    .hint-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #6b7280;

      svg {
        color: #9ca3af;
      }
    }
  }

  .select-btn {
    padding: 12px 24px;
    font-size: 16px;
  }
}

.drag-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(59, 130, 246, 0.1);
  border: 2px solid #3b82f6;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;

  .drag-content {
    text-align: center;

    .drag-icon {
      color: #3b82f6;
      margin-bottom: 16px;
      animation: bounce 2s infinite;
    }

    h3 {
      font-size: 18px;
      font-weight: 600;
      color: #1e40af;
      margin: 0;
    }
  }
}

.files-list {
  margin-top: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;

  .files-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #f9fafb;
    font-size: 14px;
    font-weight: 500;
    color: #374151;
  }

  .files-grid {
    max-height: 200px;
    overflow-y: auto;
  }

  .file-item {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #f3f4f6;

    &:last-child {
      border-bottom: none;
    }

    .file-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;

      .icon-bim { color: #3b82f6; background: #eff6ff; }
      .icon-cad { color: #10b981; background: #ecfdf5; }
      .icon-pointcloud { color: #f59e0b; background: #fef3c7; }
      .icon-scan { color: #8b5cf6; background: #f5f3ff; }
      .icon-file { color: #6b7280; background: #f3f4f6; }
    }

    .file-info {
      flex: 1;
      min-width: 0;

      .file-name {
        font-size: 14px;
        font-weight: 500;
        color: #1f2937;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-bottom: 2px;
      }

      .file-size {
        font-size: 12px;
        color: #6b7280;
      }
    }
  }
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
}
</style>
