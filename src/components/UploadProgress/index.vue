<template>
  <div class="upload-progress-container">
    <div class="file-info-card">
      <div class="file-header">
        <div class="file-icon-wrapper">
          <el-icon :class="getFileIconClass" :size="28">
            <component :is="getFileIcon" />
          </el-icon>
        </div>
        <div class="file-details">
          <div class="file-name">{{ fileName }}</div>
          <div class="file-meta">
            <span class="file-size">{{ formatFileSize(fileSize) }}</span>
            <span class="separator">•</span>
            <span class="file-type">{{ fileTypeLabel }}</span>
          </div>
        </div>
        <div class="status-indicator">
          <el-icon v-if="!isCompleted" :class="getStatusIconClass" :size="20">
            <component :is="getStatusIcon" />
          </el-icon>
          <el-icon v-else class="status-success" :size="20">
            <CircleCheck />
          </el-icon>
        </div>
      </div>
    </div>

    <div class="progress-section">
      <div class="progress-header">
        <div class="progress-title-group">
          <span class="progress-label">{{ progressLabel }}</span>
          <span class="progress-caption">{{ progressCaption }}</span>
        </div>
        <span class="progress-percentage">{{ Math.round(progress) }}%</span>
      </div>

      <div class="progress-bar-main">
        <div
          class="progress-fill"
          :style="{ width: `${progress}%` }"
          :class="getProgressClass"
        >
          <div v-if="isUploading" class="progress-shine" />
        </div>
        <div class="progress-bg" />
      </div>

      <div class="progress-details">
        <div v-if="uploadSpeed > 0" class="detail-item">
          <el-icon :size="14"><Download /></el-icon>
          <span>{{ formatSpeed(uploadSpeed) }}</span>
        </div>
        <div class="detail-item">
          <el-icon :size="14"><Clock /></el-icon>
          <span>{{ remainingTime || '--' }}</span>
        </div>
        <div v-if="hasChunkProgress" class="detail-item">
          <el-icon :size="14"><Grid /></el-icon>
          <span>{{ completedChunks }}/{{ totalChunks }} 分片已完成</span>
        </div>
      </div>
    </div>

    <div
      v-if="showChunkVisualization && hasChunkProgress"
      class="chunk-summary"
    >
      <div class="chunk-summary-header">
        <div>
          <div class="chunk-summary-title">分片概览</div>
          <div class="chunk-summary-caption">
            {{ chunkSummaryText }}
          </div>
        </div>
        <div class="chunk-summary-total">共 {{ totalChunks }} 片</div>
      </div>

      <div class="chunk-progress-track">
        <div
          class="chunk-progress-fill chunk-progress-completed"
          :style="{ width: `${completedChunkPercent}%` }"
        />
        <div
          v-if="activeChunkPercent > 0"
          class="chunk-progress-fill chunk-progress-active"
          :style="{
            left: `${completedChunkPercent}%`,
            width: `${activeChunkPercent}%`,
          }"
        />
        <div
          v-if="failedChunkPercent > 0"
          class="chunk-progress-fill chunk-progress-failed"
          :style="{
            left: `${completedChunkPercent + activeChunkPercent}%`,
            width: `${failedChunkPercent}%`,
          }"
        />
      </div>

      <div class="chunk-preview-strip">
        <div
          v-for="(segment, index) in chunkPreviewSegments"
          :key="index"
          class="chunk-preview-segment"
          :class="`chunk-preview-${segment}`"
        />
      </div>

      <div class="chunk-stats">
        <div class="chunk-stat">
          <span class="stat-dot stat-dot-completed" />
          <span>已完成 {{ completedChunks }}</span>
        </div>
        <div class="chunk-stat">
          <span class="stat-dot stat-dot-active" />
          <span>进行中 {{ activeChunks }}</span>
        </div>
        <div class="chunk-stat">
          <span class="stat-dot stat-dot-pending" />
          <span>待上传 {{ pendingChunks }}</span>
        </div>
        <div v-if="failedChunks > 0" class="chunk-stat">
          <span class="stat-dot stat-dot-failed" />
          <span>失败 {{ failedChunks }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Upload,
  Folder,
  Files,
  Share,
  VideoPause,
  Download,
  Clock,
  Grid,
  CircleCheck,
  Loading,
  Warning,
} from '@element-plus/icons-vue'

type ChunkPreviewState = 'pending' | 'active' | 'completed' | 'failed'

interface ChunkProgress {
  completed: number
  total: number
  active?: number
  failed?: number
}

type UploadPhase = 'idle' | 'hashing' | 'uploading' | 'merging'

interface Props {
  fileName: string
  fileSize: number
  fileType: string
  progress: number
  status: 'uploading' | 'paused' | 'completed' | 'failed'
  phase?: UploadPhase
  hashProgress?: number
  uploadSpeed?: number
  remainingTime?: string
  chunkProgress?: ChunkProgress
  showChunkVisualization?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  phase: 'idle',
  hashProgress: 0,
  uploadSpeed: 0,
  remainingTime: '',
  showChunkVisualization: true,
})

const PREVIEW_SEGMENT_COUNT = 24

const normalizedFileType = computed(() => props.fileType.toLowerCase())

const getFileIcon = computed(() => {
  if (['rvt', 'ifc', 'bim'].includes(normalizedFileType.value)) return Files
  if (['dwg', 'dxf', 'cad'].includes(normalizedFileType.value)) return Folder
  if (['gauss'].includes(normalizedFileType.value)) return Share
  return Upload
})

const getFileIconClass = computed(() => {
  if (['rvt', 'ifc', 'bim'].includes(normalizedFileType.value))
    return 'icon-bim'
  if (['dwg', 'dxf', 'cad'].includes(normalizedFileType.value))
    return 'icon-cad'
  if (['las', 'laz', 'e57', 'scan'].includes(normalizedFileType.value))
    return 'icon-pointcloud'
  if (['gauss'].includes(normalizedFileType.value)) return 'icon-gauss'
  return 'icon-file'
})

const fileTypeLabel = computed(() => {
  const typeMap: Record<string, string> = {
    rvt: 'BIM 模型',
    ifc: 'BIM 模型',
    bim: 'BIM 模型',
    dwg: 'CAD 图纸',
    dxf: 'CAD 图纸',
    cad: 'CAD 图纸',
    las: '点云文件',
    laz: '点云文件',
    e57: '点云文件',
    scan: '扫描数据',
    csv: '轨迹数据',
    gauss: '高斯模型',
  }
  return typeMap[normalizedFileType.value] || '未知类型'
})

const isUploading = computed(() => props.status === 'uploading')
const isPaused = computed(() => props.status === 'paused')
const isCompleted = computed(() => props.status === 'completed')
const isFailed = computed(() => props.status === 'failed')

const getStatusIcon = computed(() => {
  if (isUploading.value) return Loading
  if (isPaused.value) return VideoPause
  if (isFailed.value) return Warning
  return CircleCheck
})

const getStatusIconClass = computed(() => {
  if (isUploading.value) return 'status-uploading'
  if (isPaused.value) return 'status-paused'
  if (isFailed.value) return 'status-failed'
  return 'status-success'
})

const getProgressClass = computed(() => {
  if (isUploading.value) return 'progress-uploading'
  if (isCompleted.value) return 'progress-complete'
  if (isFailed.value) return 'progress-failed'
  return 'progress-paused'
})

const progressLabel = computed(() => {
  switch (props.status) {
    case 'uploading':
      if (props.phase === 'hashing' || props.progress < 10) {
        return '正在准备上传'
      }
      if (props.phase === 'merging') {
        return '正在合并文件'
      }
      return '正在上传'
    case 'paused':
      return '已暂停'
    case 'completed':
      return '上传完成'
    case 'failed':
      return '上传失败'
    default:
      return '准备中'
  }
})

const progressCaption = computed(() => {
  if (isCompleted.value) {
    return '文件已上传，等待后续处理'
  }
  if (isPaused.value) {
    return '已保留断点，可继续上传'
  }
  if (isFailed.value) {
    return '请检查网络或重试上传'
  }
  if (props.phase === 'hashing') {
    return `正在检查文件 ${Math.round(props.hashProgress)}%`
  }
  if (props.phase === 'merging') {
    return '文件已经传完，正在做最后处理'
  }
  return '大文件会自动保持上传进度'
})

const hasChunkProgress = computed(() => {
  return Boolean(props.chunkProgress && props.chunkProgress.total > 0)
})

const totalChunks = computed(() => props.chunkProgress?.total ?? 0)

const completedChunks = computed(() => {
  const completed = props.chunkProgress?.completed ?? 0
  return Math.min(Math.max(completed, 0), totalChunks.value)
})

const failedChunks = computed(() => {
  const failed = props.chunkProgress?.failed ?? 0
  return Math.min(
    Math.max(failed, 0),
    Math.max(totalChunks.value - completedChunks.value, 0),
  )
})

const activeChunks = computed(() => {
  if (!hasChunkProgress.value || !isUploading.value) {
    return 0
  }

  const active = props.chunkProgress?.active
  if (typeof active === 'number') {
    return Math.min(
      Math.max(active, 0),
      Math.max(
        totalChunks.value - completedChunks.value - failedChunks.value,
        0,
      ),
    )
  }

  const remaining =
    totalChunks.value - completedChunks.value - failedChunks.value
  return remaining > 0 ? 1 : 0
})

const pendingChunks = computed(() => {
  return Math.max(
    totalChunks.value -
      completedChunks.value -
      activeChunks.value -
      failedChunks.value,
    0,
  )
})

const completedChunkPercent = computed(() => {
  if (!totalChunks.value) return 0
  return (completedChunks.value / totalChunks.value) * 100
})

const activeChunkPercent = computed(() => {
  if (!totalChunks.value) return 0
  return (activeChunks.value / totalChunks.value) * 100
})

const failedChunkPercent = computed(() => {
  if (!totalChunks.value) return 0
  return (failedChunks.value / totalChunks.value) * 100
})

const chunkSummaryText = computed(() => {
  if (isCompleted.value) {
    return `全部 ${totalChunks.value} 个分片已上传完成`
  }
  if (isFailed.value && failedChunks.value > 0) {
    return `已完成 ${completedChunks.value} 个，${failedChunks.value} 个失败`
  }
  if (isPaused.value) {
    return `已完成 ${completedChunks.value} 个分片，剩余 ${pendingChunks.value} 个`
  }
  return `当前已完成 ${completedChunks.value} 个分片，剩余 ${pendingChunks.value} 个`
})

const chunkPreviewSegments = computed<ChunkPreviewState[]>(() => {
  if (!hasChunkProgress.value) {
    return []
  }

  const segmentCount = Math.min(totalChunks.value, PREVIEW_SEGMENT_COUNT)
  const segments: ChunkPreviewState[] = []

  for (let index = 0; index < segmentCount; index += 1) {
    const rangeStart = (index / segmentCount) * totalChunks.value
    const rangeEnd = ((index + 1) / segmentCount) * totalChunks.value

    if (rangeEnd <= completedChunks.value) {
      segments.push('completed')
      continue
    }

    if (
      rangeStart < completedChunks.value + activeChunks.value &&
      rangeEnd > completedChunks.value
    ) {
      segments.push('active')
      continue
    }

    if (
      failedChunks.value > 0 &&
      rangeStart <
        completedChunks.value + activeChunks.value + failedChunks.value &&
      rangeEnd > completedChunks.value + activeChunks.value
    ) {
      segments.push('failed')
      continue
    }

    segments.push('pending')
  }

  return segments
})

const formatFileSize = (size: number): string => {
  if (size === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(size) / Math.log(k))
  return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatSpeed = (speed: number): string => {
  if (speed === 0) return '0 B/s'
  const k = 1024
  const sizes = ['B/s', 'KB/s', 'MB/s']
  const i = Math.floor(Math.log(speed) / Math.log(k))
  return parseFloat((speed / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
</script>

<style lang="scss" scoped>
.upload-progress-container {
  width: 100%;
  padding: 20px;
  margin: 16px 0;
  background: linear-gradient(180deg, #fff 0%, #fbfdff 100%);
  border: 1px solid #e6edf5;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgb(15 23 42 / 0.06);
  transition:
    box-shadow 0.3s ease,
    transform 0.3s ease;

  &:hover {
    box-shadow: 0 14px 36px rgb(15 23 42 / 0.1);
    transform: translateY(-1px);
  }
}

.file-info-card {
  .file-header {
    display: flex;
    gap: 16px;
    align-items: center;
    margin-bottom: 20px;
  }

  .file-icon-wrapper {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 16px;

    .icon-bim,
    .icon-cad,
    .icon-pointcloud,
    .icon-gauss,
    .icon-file {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 16px;
    }

    .icon-bim {
      color: #2563eb;
      background: linear-gradient(135deg, #e0ecff 0%, #f2f7ff 100%);
    }

    .icon-cad {
      color: #0f766e;
      background: linear-gradient(135deg, #dcfce7 0%, #f0fdf4 100%);
    }

    .icon-pointcloud {
      color: #c2410c;
      background: linear-gradient(135deg, #ffedd5 0%, #fff7ed 100%);
    }

    .icon-gauss {
      color: #7c3aed;
      background: linear-gradient(135deg, #ede9fe 0%, #f5f3ff 100%);
    }

    .icon-file {
      color: #475569;
      background: linear-gradient(135deg, #e2e8f0 0%, #f8fafc 100%);
    }
  }

  .file-details {
    flex: 1;
    min-width: 0;
  }

  .file-name {
    margin-bottom: 4px;
    overflow: hidden;
    font-size: 16px;
    font-weight: 600;
    color: #0f172a;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-meta {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 13px;
    color: #64748b;
  }

  .separator {
    color: #cbd5e1;
  }

  .status-indicator {
    .status-uploading {
      color: #2563eb;
      animation: spin 1s linear infinite;
    }

    .status-paused {
      color: #d97706;
    }

    .status-failed {
      color: #dc2626;
    }

    .status-success {
      color: #059669;
    }
  }
}

.progress-section {
  margin-bottom: 18px;
}

.progress-header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 10px;
}

.progress-title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress-label {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}

.progress-caption {
  font-size: 12px;
  color: #64748b;
}

.progress-percentage {
  flex-shrink: 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.progress-bar-main {
  position: relative;
  height: 12px;
  overflow: hidden;
  background: #e8eef5;
  border-radius: 999px;
}

.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  height: 100%;
  overflow: hidden;
  border-radius: 999px;
  transition: width 0.3s ease;

  &.progress-uploading {
    background: linear-gradient(90deg, #2563eb 0%, #60a5fa 100%);
  }

  &.progress-complete {
    background: linear-gradient(90deg, #059669 0%, #34d399 100%);
  }

  &.progress-failed {
    background: linear-gradient(90deg, #dc2626 0%, #fb7185 100%);
  }

  &.progress-paused {
    background: linear-gradient(90deg, #d97706 0%, #fbbf24 100%);
  }
}

.progress-shine {
  position: absolute;
  top: 0;
  left: -120%;
  width: 80%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgb(255 255 255 / 0.5),
    transparent
  );
  animation: shine 1.8s ease-in-out infinite;
}

.progress-bg {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(
    90deg,
    rgb(255 255 255 / 0.08) 0%,
    transparent 100%
  );
}

.progress-details {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}

.detail-item {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 6px 10px;
  font-size: 12px;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 999px;

  svg {
    color: #64748b;
  }
}

.chunk-summary {
  padding: 16px;
  background: linear-gradient(180deg, #f8fbff 0%, #f6f8fc 100%);
  border: 1px solid #e2e8f0;
  border-radius: 14px;
}

.chunk-summary-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.chunk-summary-title {
  margin-bottom: 4px;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.chunk-summary-caption {
  font-size: 12px;
  color: #64748b;
}

.chunk-summary-total {
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  background: #fff;
  border: 1px solid #dbe4ee;
  border-radius: 999px;
}

.chunk-progress-track {
  position: relative;
  height: 10px;
  margin-bottom: 12px;
  overflow: hidden;
  background: #dfe7ef;
  border-radius: 999px;
}

.chunk-progress-fill {
  position: absolute;
  top: 0;
  height: 100%;
  transition:
    width 0.3s ease,
    left 0.3s ease;
}

.chunk-progress-completed {
  left: 0;
  background: linear-gradient(90deg, #10b981 0%, #34d399 100%);
}

.chunk-progress-active {
  background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
  animation: pulse 1.4s ease-in-out infinite;
}

.chunk-progress-failed {
  background: linear-gradient(90deg, #ef4444 0%, #fb7185 100%);
}

.chunk-preview-strip {
  display: grid;
  grid-template-columns: repeat(24, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 14px;
}

.chunk-preview-segment {
  height: 8px;
  border-radius: 999px;
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;

  &:hover {
    transform: translateY(-1px);
  }
}

.chunk-preview-completed {
  background: #10b981;
}

.chunk-preview-active {
  background: #3b82f6;
  box-shadow: 0 0 0 2px rgb(59 130 246 / 0.15);
}

.chunk-preview-failed {
  background: #ef4444;
}

.chunk-preview-pending {
  background: #cbd5e1;
}

.chunk-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.chunk-stat {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  min-width: 110px;
  padding: 8px 10px;
  font-size: 12px;
  color: #334155;
  background: rgb(255 255 255 / 0.78);
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.stat-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.stat-dot-completed {
  background: #10b981;
}

.stat-dot-active {
  background: #3b82f6;
}

.stat-dot-pending {
  background: #94a3b8;
}

.stat-dot-failed {
  background: #ef4444;
}

@media (max-width: 768px) {
  .upload-progress-container {
    padding: 16px;
  }

  .progress-header,
  .chunk-summary-header {
    flex-direction: column;
  }

  .progress-percentage,
  .chunk-summary-total {
    align-self: flex-start;
  }

  .chunk-preview-strip {
    gap: 4px;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes shine {
  from {
    left: -120%;
  }

  to {
    left: 140%;
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.65;
  }
}
</style>
