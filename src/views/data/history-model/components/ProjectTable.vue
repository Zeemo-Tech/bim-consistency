<template>
  <el-card class="project-table-card" shadow="never">
    <div class="table-card-toolbar">
      <div class="table-card-toolbar__content">
        <div class="table-card-toolbar__title">项目文件列表</div>
      </div>
      <div class="table-card-toolbar__actions">
        <div v-if="toolbarNotice" class="table-card-toolbar__notice">
          <el-icon class="table-card-toolbar__notice-icon">
            <WarningFilled />
          </el-icon>
          {{ toolbarNotice }}
        </div>
        <el-button
          class="table-card-toolbar__refresh"
          type="primary"
          :icon="RefreshRight"
          @click="handleRefresh"
        >
          刷新列表
        </el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="tableData"
      border
      :style="{ width: '100%' }"
      :header-cell-style="{ background: '#f5f7fa', color: '#606266' }"
      :expand-row-keys="expandedRows"
      :row-key="getProjectRowKey"
      @expand-change="handleExpandChange"
    >
      <!-- 展开行 -->
      <el-table-column type="expand">
        <template #default="{ row }">
          <div class="file-table-wrapper">
            <!-- 扫描记录模块 -->
            <div class="scan-record-section">
              <div class="scan-record-card">
                <div class="scan-record-content">
                  <div class="scan-record-main">
                    <div class="scan-record-title">
                      <span v-if="getScanRecordInfo(row).count > 0">
                        共 {{ getScanRecordInfo(row).count }} 次扫描
                      </span>
                      <span v-else>暂无扫描记录</span>
                    </div>
                    <div class="scan-record-subtitle">
                      <template v-if="getScanRecordInfo(row).count > 0">
                        共 {{ getScanRecordInfo(row).count }} 点云 · 共
                        {{ getScanRecordInfo(row).count }} 轨迹 · 总计
                        {{ getScanRecordInfo(row).totalSize }} · 最近：{{
                          getScanRecordInfo(row).lastTime
                        }}
                      </template>
                      <template v-else>点击查看日历</template>
                    </div>
                  </div>
                  <div class="scan-record-action">
                    <el-button
                      type="primary"
                      :icon="Calendar"
                      @click="handleViewCalendar(row)"
                    >
                      查看日历
                    </el-button>
                  </div>
                </div>
              </div>
            </div>

            <!-- BIM 模型模块 -->
            <div
              v-if="getFilesByType(row.files, 'BIM').length > 0"
              class="file-group-section"
            >
              <div class="file-group-header">
                <el-icon class="group-icon"><Box /></el-icon>
                <span class="group-title">BIM 模型</span>
                <span class="group-count">
                  {{ getFilesByType(row.files, 'BIM').length }} 个文件
                </span>
              </div>
              <el-table
                class="file-inner-table"
                :data="getFilesByType(row.files, 'BIM')"
                border
                table-layout="fixed"
                :style="{ width: '100%' }"
                :header-cell-style="{
                  background: '#fafafa',
                  color: '#606266',
                  fontSize: '13px',
                }"
              >
                <el-table-column label="类型" width="100" align="center">
                  <template #default="{ row: file }">
                    <el-tag type="primary" effect="plain" size="small">
                      {{ file.type }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="文件名称" min-width="340">
                  <template #default="{ row: file }">
                    <div class="file-name-cell">
                      <div class="file-name-cell__title" :title="file.name">
                        {{ file.name }}
                      </div>
                      <div class="file-name-cell__meta">
                        <el-tag
                          :type="getUploadStatusTagType(file.status)"
                          size="small"
                          effect="plain"
                        >
                          {{ getUploadStatusText(file.status) }}
                        </el-tag>
                        <el-tag
                          v-if="file.meshRemesh?.supported"
                          :type="getMeshRemeshTagType(file.meshRemesh.status)"
                          size="small"
                          effect="plain"
                        >
                          {{ getMeshRemeshText(file.meshRemesh.status) }}
                        </el-tag>
                      </div>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="所属幢" width="90" align="center">
                  <template #default="{ row: file }">
                    <span class="slot-value">
                      {{ formatSlotValue(file.buildingName) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="所属层" width="90" align="center">
                  <template #default="{ row: file }">
                    <span class="slot-value">
                      {{ formatSlotValue(file.floorName) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column
                  prop="size"
                  label="大小"
                  width="140"
                  align="center"
                />
                <el-table-column
                  prop="uploadTime"
                  label="上传时间"
                  min-width="170"
                  align="center"
                />
                <el-table-column
                  label="操作"
                  width="156"
                  align="center"
                  fixed="right"
                >
                  <template #default="{ row: file }">
                    <div class="action-cell">
                      <el-tooltip
                        v-if="file.meshRemesh?.canManualRetry"
                        content="重新触发网格均匀化"
                        placement="top"
                      >
                        <el-button
                          text
                          :icon="RefreshRight"
                          class="action-icon action-icon--retry"
                          @click="handleFileCommand('retry-remesh', file)"
                        />
                      </el-tooltip>
                      <el-tooltip content="预览文件" placement="top">
                        <el-button
                          text
                          :icon="View"
                          class="action-icon action-icon--preview"
                          @click="handleFileCommand('preview', file)"
                        />
                      </el-tooltip>
                      <el-tooltip content="查看详情" placement="top">
                        <el-button
                          text
                          :icon="Document"
                          class="action-icon action-icon--detail"
                          @click="handleFileCommand('detail', file)"
                        />
                      </el-tooltip>
                      <el-tooltip content="删除" placement="top">
                        <el-button
                          text
                          :icon="Delete"
                          class="action-icon action-icon--danger"
                          @click="handleFileCommand('delete', file)"
                        />
                      </el-tooltip>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </div>

            <!-- CAD 图纸模块 -->
            <div
              v-if="getFilesByType(row.files, 'CAD').length > 0"
              class="file-group-section"
            >
              <div class="file-group-header">
                <el-icon class="group-icon"><Document /></el-icon>
                <span class="group-title">CAD 图纸</span>
                <span class="group-count">
                  {{ getFilesByType(row.files, 'CAD').length }} 个文件
                </span>
              </div>
              <el-table
                class="file-inner-table"
                :data="getFilesByType(row.files, 'CAD')"
                border
                table-layout="fixed"
                :style="{ width: '100%' }"
                :header-cell-style="{
                  background: '#fafafa',
                  color: '#606266',
                  fontSize: '13px',
                }"
              >
                <el-table-column label="类型" width="100" align="center">
                  <template #default="{ row: file }">
                    <el-tag type="success" effect="plain" size="small">
                      {{ file.type }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="文件名称" min-width="340">
                  <template #default="{ row: file }">
                    <div class="file-name-cell">
                      <div class="file-name-cell__title" :title="file.name">
                        {{ file.name }}
                      </div>
                      <div class="file-name-cell__meta">
                        <el-tag
                          :type="getUploadStatusTagType(file.status)"
                          size="small"
                          effect="plain"
                        >
                          {{ getUploadStatusText(file.status) }}
                        </el-tag>
                      </div>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="所属幢" width="90" align="center">
                  <template #default="{ row: file }">
                    <span class="slot-value">
                      {{ formatSlotValue(file.buildingName) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="所属层" width="90" align="center">
                  <template #default="{ row: file }">
                    <span class="slot-value">
                      {{ formatSlotValue(file.floorName) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column
                  prop="size"
                  label="大小"
                  width="140"
                  align="center"
                />
                <el-table-column
                  prop="uploadTime"
                  label="上传时间"
                  min-width="170"
                  align="center"
                />
                <el-table-column
                  label="操作"
                  width="156"
                  align="center"
                  fixed="right"
                >
                  <template #default="{ row: file }">
                    <div class="action-cell">
                      <el-tooltip content="预览文件" placement="top">
                        <el-button
                          text
                          :icon="View"
                          class="action-icon action-icon--preview"
                          @click="handleFileCommand('preview', file)"
                        />
                      </el-tooltip>
                      <el-tooltip content="查看详情" placement="top">
                        <el-button
                          text
                          :icon="Document"
                          class="action-icon action-icon--detail"
                          @click="handleFileCommand('detail', file)"
                        />
                      </el-tooltip>
                      <el-tooltip content="删除" placement="top">
                        <el-button
                          text
                          :icon="Delete"
                          class="action-icon action-icon--danger"
                          @click="handleFileCommand('delete', file)"
                        />
                      </el-tooltip>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </div>

            <!-- 扫描数据/点云文件模块 -->
            <div
              v-if="getFilesByType(row.files, '扫描数据').length > 0"
              class="file-group-section"
            >
              <div class="file-group-header">
                <el-icon class="group-icon"><Upload /></el-icon>
                <span class="group-title">扫描数据</span>
                <span class="group-count">
                  {{ getFilesByType(row.files, '扫描数据').length }} 个文件
                </span>
              </div>
              <el-table
                class="file-inner-table"
                :data="getFilesByType(row.files, '扫描数据')"
                border
                table-layout="fixed"
                :style="{ width: '100%' }"
                :header-cell-style="{
                  background: '#fafafa',
                  color: '#606266',
                  fontSize: '13px',
                }"
              >
                <el-table-column label="类型" width="100" align="center">
                  <template #default="{ row: file }">
                    <el-tag type="warning" effect="plain" size="small">
                      {{ file.type }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="文件名称" min-width="340">
                  <template #default="{ row: file }">
                    <div class="file-name-cell">
                      <div class="file-name-cell__title" :title="file.name">
                        {{ file.name }}
                      </div>
                      <div class="file-name-cell__meta">
                        <el-tag
                          :type="getUploadStatusTagType(file.status)"
                          size="small"
                          effect="plain"
                        >
                          {{ getUploadStatusText(file.status) }}
                        </el-tag>
                      </div>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="所属幢" width="90" align="center">
                  <template #default="{ row: file }">
                    <span class="slot-value">
                      {{ formatSlotValue(file.buildingName) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="所属层" width="90" align="center">
                  <template #default="{ row: file }">
                    <span class="slot-value">
                      {{ formatSlotValue(file.floorName) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column
                  prop="size"
                  label="大小"
                  width="140"
                  align="center"
                />
                <el-table-column
                  prop="uploadTime"
                  label="上传时间"
                  min-width="170"
                  align="center"
                />
                <el-table-column
                  label="操作"
                  width="156"
                  align="center"
                  fixed="right"
                >
                  <template #default="{ row: file }">
                    <div class="action-cell">
                      <el-tooltip content="预览文件" placement="top">
                        <el-button
                          text
                          :icon="View"
                          class="action-icon action-icon--preview"
                          @click="handleScanFileCommand('preview', file)"
                        />
                      </el-tooltip>
                      <el-tooltip content="删除" placement="top">
                        <el-button
                          text
                          :icon="Delete"
                          class="action-icon action-icon--danger"
                          @click="handleScanFileCommand('delete', file)"
                        />
                      </el-tooltip>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </div>

            <!-- 高斯模型文件模块 -->
            <div
              v-if="getFilesByType(row.files, '高斯模型').length > 0"
              class="file-group-section"
            >
              <div class="file-group-header">
                <el-icon class="group-icon"><Share /></el-icon>
                <span class="group-title">高斯模型</span>
                <span class="group-count">
                  {{ getFilesByType(row.files, '高斯模型').length }} 个文件
                </span>
              </div>
              <el-table
                class="file-inner-table"
                :data="getFilesByType(row.files, '高斯模型')"
                border
                table-layout="fixed"
                :style="{ width: '100%' }"
                :header-cell-style="{
                  background: '#fafafa',
                  color: '#606266',
                  fontSize: '13px',
                }"
              >
                <el-table-column label="类型" width="100" align="center">
                  <template #default="{ row: file }">
                    <el-tag type="info" effect="plain" size="small">
                      {{ file.type }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="文件名称" min-width="340">
                  <template #default="{ row: file }">
                    <div class="file-name-cell">
                      <div class="file-name-cell__title" :title="file.name">
                        {{ file.name }}
                      </div>
                      <div class="file-name-cell__meta">
                        <el-tag
                          :type="getUploadStatusTagType(file.status)"
                          size="small"
                          effect="plain"
                        >
                          {{ getUploadStatusText(file.status) }}
                        </el-tag>
                      </div>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="所属幢" width="90" align="center">
                  <template #default="{ row: file }">
                    <span class="slot-value">
                      {{ formatSlotValue(file.buildingName) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="所属层" width="90" align="center">
                  <template #default="{ row: file }">
                    <span class="slot-value">
                      {{ formatSlotValue(file.floorName) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column
                  prop="size"
                  label="大小"
                  width="140"
                  align="center"
                />
                <el-table-column
                  prop="uploadTime"
                  label="上传时间"
                  min-width="170"
                  align="center"
                />
                <el-table-column
                  label="操作"
                  width="156"
                  align="center"
                  fixed="right"
                >
                  <template #default="{ row: file }">
                    <div class="action-cell">
                      <el-tooltip content="预览文件" placement="top">
                        <el-button
                          text
                          :icon="View"
                          class="action-icon action-icon--preview"
                          @click="handleFileCommand('preview', file)"
                        />
                      </el-tooltip>
                      <el-tooltip content="删除" placement="top">
                        <el-button
                          text
                          :icon="Delete"
                          class="action-icon action-icon--danger"
                          @click="handleFileCommand('delete', file)"
                        />
                      </el-tooltip>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </template>
      </el-table-column>

      <!-- 项目名称列 -->
      <el-table-column
        prop="name"
        label="项目名称"
        min-width="200"
        show-overflow-tooltip
      />

      <!-- 文件统计列 -->
      <el-table-column label="文件统计" width="280" align="center">
        <template #default="{ row }">
          <div class="file-stats">
            <el-tag type="primary" size="small" effect="plain">
              BIM {{ row.bimCount }}
            </el-tag>
            <el-tag type="success" size="small" effect="plain">
              CAD {{ row.cadCount }}
            </el-tag>
            <el-tag type="warning" size="small" effect="plain">
              扫描 {{ row.pointCloudCount }}
            </el-tag>
            <el-tag type="info" size="small" effect="plain">
              高斯 {{ row.gaussCount || 0 }}
            </el-tag>
          </div>
        </template>
      </el-table-column>

      <!-- 已使用空间列 -->
      <el-table-column
        prop="usedStorage"
        label="已使用空间"
        width="150"
        align="center"
      >
        <template #default="{ row }">
          <span>{{ row.usedStorage }} MB</span>
        </template>
      </el-table-column>

      <!-- 文件数量列 -->
      <el-table-column
        prop="fileCount"
        label="文件数量"
        width="120"
        align="center"
      >
        <template #default="{ row }">
          <el-tag type="info" size="small">{{ row.fileCount }}</el-tag>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-container">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Calendar,
  Box,
  Document,
  RefreshRight,
  View,
  Upload,
  Share,
  Delete,
  WarningFilled,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

/**
 * 文件数据类型定义
 */
export interface FileData {
  buildingName?: string | null
  id: string
  floorName?: string | null
  type: string
  name: string
  size: string
  meshRemesh?: {
    supported: boolean
    status?: 'queued' | 'processing' | 'succeeded' | 'failed'
    canManualRetry: boolean
  }
  status?: string
  uploader: string
  uploadTime: string
  projectId?: string
  fileType?: string
}

/**
 * 项目数据类型定义
 */
export interface ProjectData {
  id: string
  rowKey?: string
  name: string
  bimCount: number
  cadCount: number
  pointCloudCount: number
  gaussCount?: number
  usedStorage: string
  fileCount: number
  files: FileData[]
}

/**
 * 组件属性定义
 */
interface Props {
  tableData: ProjectData[]
  loading?: boolean
  toolbarNotice?: string
  pagination?: {
    currentPage: number
    pageSize: number
    total: number
  }
}

/**
 * 组件事件定义
 */
interface Emits {
  (e: 'viewCalendar', project: ProjectData): void
  (e: 'fileCommand', command: string, file: FileData): void
  (e: 'scanCalibration', file: FileData): void
  (e: 'pageChange', page: number): void
  (e: 'sizeChange', size: number): void
  (e: 'refresh'): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  pagination: () => ({
    currentPage: 1,
    pageSize: 10,
    total: 0,
  }),
})

const emit = defineEmits<Emits>()

/**
 * 展开的行ID数组
 */
const expandedRows = ref<string[]>([])

/**
 * 获取项目行唯一Key（避免不同数据源出现相同id导致展开联动）
 */
const getProjectRowKey = (project: ProjectData) =>
  project.rowKey || `project-${project.id}`

/**
 * 当前页码
 */
const currentPage = computed({
  get: () => props.pagination.currentPage,
  set: (val) => emit('pageChange', val),
})

/**
 * 每页显示数量
 */
const pageSize = computed({
  get: () => props.pagination.pageSize,
  set: (val) => emit('sizeChange', val),
})

/**
 * 数据总数
 */
const total = computed(() => props.pagination.total)

/**
 * 按类型筛选文件
 */
const getFilesByType = (files: FileData[], type: string): FileData[] => {
  if (!files) return []
  return files.filter((file) => file.type === type)
}

const formatSlotValue = (value?: string | null) => value || '--'

const getMeshRemeshText = (status?: string) => {
  const textMap: Record<string, string> = {
    queued: '均匀化排队中',
    processing: '均匀化处理中',
    succeeded: '均匀化已完成',
    failed: '均匀化失败',
  }
  return textMap[status || ''] || '均匀化未知'
}

const getMeshRemeshTagType = (status?: string) => {
  const typeMap: Record<
    string,
    'warning' | 'primary' | 'success' | 'danger' | 'info'
  > = {
    queued: 'warning',
    processing: 'primary',
    succeeded: 'success',
    failed: 'danger',
  }
  return typeMap[status || ''] || 'info'
}

/**
 * 获取扫描记录信息
 */
const getScanRecordInfo = (project: ProjectData) => {
  const scanFiles = project.files?.filter(
    (file) =>
      file.type === '扫描记录' ||
      file.type === '点云' ||
      file.type === '扫描数据',
  )

  if (!scanFiles || scanFiles.length === 0) {
    return {
      count: 0,
      totalSize: '0 MB',
      lastTime: '-',
    }
  }

  // 计算总大小
  let totalSizeInMB = 0
  scanFiles.forEach((file) => {
    const sizeStr = file.size.replace(/[^0-9.]/g, '')
    totalSizeInMB += parseFloat(sizeStr)
  })

  // 获取最近的上传时间
  const lastTime = scanFiles[0]?.uploadTime || '-'

  return {
    count: project.pointCloudCount ?? scanFiles.length,
    totalSize: `${totalSizeInMB.toFixed(1)} MB`,
    lastTime,
  }
}

const getUploadStatusText = (status?: string) => {
  const textMap: Record<string, string> = {
    pending_external: '上传中',
    queued: '排队中',
    stored: '已上传',
    processing: '处理中',
    failed: '上传失败',
    failed_external: '上传失败',
  }
  return textMap[status || ''] || status || '状态未知'
}

const getUploadStatusTagType = (status?: string) => {
  const typeMap: Record<
    string,
    'warning' | 'success' | 'primary' | 'danger' | 'info'
  > = {
    pending_external: 'warning',
    queued: 'warning',
    stored: 'success',
    processing: 'primary',
    failed: 'danger',
    failed_external: 'danger',
  }
  return typeMap[status || ''] || 'info'
}

/**
 * 处理展开行变化
 */
const handleExpandChange = (
  row: ProjectData,
  expandedRowsData: ProjectData[],
) => {
  expandedRows.value = expandedRowsData.map((r) => getProjectRowKey(r))
}

/**
 * 处理查看日历
 */
const handleViewCalendar = (project: ProjectData) => {
  emit('viewCalendar', project)
}

/**
 * 处理文件操作菜单
 */
const handleFileCommand = (command: string, file: FileData) => {
  emit('fileCommand', command, file)
}

/**
 * 处理扫描文件操作菜单
 */
const handleScanFileCommand = (command: string, file: FileData) => {
  if (command === 'preview' || command === 'delete') {
    emit('fileCommand', command, file)
  }
}

/**
 * 处理每页显示数量变化
 */
const handleSizeChange = (size: number) => {
  emit('sizeChange', size)
}

/**
 * 处理页码变化
 */
const handleCurrentChange = (page: number) => {
  emit('pageChange', page)
}

const handleRefresh = () => {
  emit('refresh')
}
</script>

<style lang="scss" scoped>
.project-table-card {
  border-radius: 8px;

  .table-card-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 18px;
    padding: 4px 4px 18px;
    border-bottom: 1px solid #eef2f7;
  }

  .table-card-toolbar__content {
    min-width: 0;
  }

  .table-card-toolbar__actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .table-card-toolbar__title {
    color: #1f2937;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.2;
  }

  .table-card-toolbar__notice {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 600px;
    color: #a2abb4;
    font-size: 13px;
    line-height: 1.5;
    text-align: right;
  }

  .table-card-toolbar__notice-icon {
    flex-shrink: 0;
    font-size: 14px;
  }

  .table-card-toolbar__refresh {
    flex-shrink: 0;
  }

  .file-table-wrapper {
    padding: 16px;
    background: #fafafa;

    // 扫描记录区域
    .scan-record-section {
      margin-bottom: 16px;

      .scan-record-card {
        background: #f5f7fa;
        border: 1px solid #e4e7ed;
        border-radius: 8px;
        padding: 16px 20px;

        .scan-record-content {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .scan-record-main {
            flex: 1;

            .scan-record-title {
              font-size: 15px;
              font-weight: 600;
              color: #303133;
              margin-bottom: 6px;
            }

            .scan-record-subtitle {
              font-size: 13px;
              color: #606266;
            }
          }

          .scan-record-action {
            margin-left: 20px;
          }
        }
      }
    }

    // 文件分组区域
    .file-group-section {
      margin-bottom: 16px;

      &:last-child {
        margin-bottom: 0;
      }

      .file-group-header {
        display: flex;
        align-items: center;
        padding: 10px 16px;
        background: #fff;
        border: 1px solid #e4e7ed;
        border-bottom: none;
        border-radius: 4px 4px 0 0;

        .group-icon {
          font-size: 18px;
          color: #409eff;
          margin-right: 8px;
        }

        .group-title {
          font-size: 14px;
          font-weight: 600;
          color: #303133;
          margin-right: 8px;
        }

        .group-count {
          font-size: 12px;
          color: #909399;
        }
      }

      :deep(.el-table) {
        border-radius: 0 0 4px 4px;
      }
    }
  }

  .file-stats {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .file-name-cell {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 2px 0;
  }

  .file-name-cell__title {
    overflow: hidden;
    flex: 1;
    color: #303133;
    font-size: 13px;
    line-height: 1.45;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-name-cell__meta {
    display: flex;
    flex-shrink: 0;
    justify-content: flex-end;
    gap: 6px;
    white-space: nowrap;
  }

  .slot-value {
    color: #4b5563;
    font-size: 13px;
  }

  .action-cell {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    flex-wrap: nowrap;
  }

  :deep(.action-cell .el-button + .el-button) {
    margin-left: 0;
  }

  :deep(.file-inner-table .el-table__cell) {
    padding: 10px 12px;
  }

  :deep(.file-inner-table .cell) {
    overflow: hidden;
  }

  .action-icon {
    min-width: auto;
    height: 24px;
    margin: 0;
    border: none;
    padding: 4px;
    background: transparent;
    box-shadow: none;
    transition:
      color 0.2s ease,
      transform 0.2s ease;
  }

  .action-icon:hover {
    transform: translateY(-1px);
  }

  .action-icon--preview {
    color: #3b82f6;
  }

  .action-icon--preview:hover {
    color: #1d4ed8;
  }

  .action-icon--detail {
    color: #16a34a;
  }

  .action-icon--detail:hover {
    color: #15803d;
  }

  .action-icon--retry {
    color: #7c3aed;
  }

  .action-icon--retry:hover {
    color: #6d28d9;
  }

  .action-icon--danger {
    color: #ef4444;
  }

  .action-icon--danger:hover {
    color: #dc2626;
  }

  .pagination-container {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
  }

  @media (max-width: 768px) {
    .table-card-toolbar {
      flex-direction: column;
      align-items: stretch;
    }

    .table-card-toolbar__actions {
      flex-direction: column;
      align-items: stretch;
    }

    .table-card-toolbar__notice {
      max-width: none;
      text-align: left;
    }

    .table-card-toolbar__refresh {
      width: 100%;
    }
  }
}
</style>
