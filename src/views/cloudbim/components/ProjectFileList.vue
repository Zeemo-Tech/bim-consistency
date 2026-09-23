<template>
  <section v-loading="loading" class="design-page workspace-list">
    <WorkspaceHeading :title="props.title" :description="props.description" />

    <header class="project-header">
      <div class="project-toolbar workspace-toolbar">
        <div class="toolbar-filters workspace-filters">
          <el-input
            v-model="filters.keyword"
            class="bim-search-input workspace-search"
            placeholder="搜索文件名称"
            :prefix-icon="Search"
            clearable
          />
          <el-select
            v-model="filters.building"
            class="workspace-select"
            placeholder="所属幢"
            clearable
          >
            <el-option label="所属幢" value="" />
            <el-option
              v-for="building in buildingOptions"
              :key="building"
              :label="building"
              :value="building"
            />
          </el-select>
          <el-select
            v-model="filters.status"
            class="bim-status-select workspace-select"
            placeholder="文件状态"
          >
            <el-option label="文件状态" value="all" />
            <el-option label="已上传" value="stored" />
            <el-option label="处理中" value="processing" />
            <el-option label="已完成" value="completed" />
            <el-option label="上传失败" value="failed" />
            <el-option label="待续传" value="pending_chunks" />
          </el-select>
          <el-date-picker
            v-model="filters.dateRange"
            class="bim-date-range workspace-date"
            type="daterange"
            unlink-panels
            format="YYYY/MM/DD"
            range-separator="-"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            clearable
          />
        </div>
        <div class="toolbar-actions workspace-actions">
          <button
            class="bim-toolbar-button is-primary"
            type="button"
            @click="openUpload"
          >
            <el-icon :size="16"><Upload /></el-icon>
            {{ props.uploadLabel }}
          </button>
          <button
            class="bim-toolbar-button"
            type="button"
            @click="resetFilters"
          >
            <el-icon :size="16"><Refresh /></el-icon>
            重置
          </button>
          <button class="bim-toolbar-button" type="button" @click="reload">
            <el-icon :size="16"><Refresh /></el-icon>
            刷新
          </button>
        </div>
      </div>
    </header>

    <section class="bim-table-card workspace-table-card">
      <div class="bim-table-heading">
        <h2>文件列表</h2>
      </div>
      <el-table
        class="bim-table workspace-table"
        :fit="true"
        :data="pagedFiles"
        row-key="id"
        tabindex="0"
        :aria-label="`${props.title}文件列表`"
      >
        <el-table-column label="文件名称" min-width="240" align="left">
          <template #default="{ row }">
            <div class="bim-name-cell">
              <span :title="row.originalName">{{ row.originalName }}</span>
              <small class="bim-name-meta">
                {{ row.buildingName || '—' }} · {{ row.floorName || '—' }}
              </small>
              <small
                v-if="isScanList"
                class="bim-name-related"
                :class="{ 'is-ready': linkedBimName(row) }"
                :title="linkedBimName(row) || '未匹配设计模型'"
              >
                关联：{{ linkedBimName(row) || '未匹配设计模型' }}
              </small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="文件大小" min-width="100" align="left">
          <template #default="{ row }">
            {{ formatFileSize(row.fileSize) }}
          </template>
        </el-table-column>
        <el-table-column label="上传时间" min-width="160" align="left">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="96" align="left">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTagType(row.status)">
              {{ statusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          v-if="showRemesh"
          label="网格均匀化"
          min-width="120"
          align="left"
        >
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="meshRemeshTagType(row.meshRemesh?.status)"
            >
              {{ meshRemeshText(row.meshRemesh?.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          :width="isScanList ? 312 : 172"
          align="right"
          class-name="bim-operation-column"
          label-class-name="bim-operation-column"
        >
          <template #default="{ row }">
            <div class="bim-row-actions workspace-row-actions">
              <button
                v-if="isScanList"
                class="bim-action-button bim-action-button--primary"
                type="button"
                :title="
                  canEnterAnalysis(row)
                    ? '进入分析'
                    : linkedBimName(row)
                      ? '文件尚未处理完成'
                      : '未匹配到设计模型（BIM）'
                "
                aria-label="进入分析"
                :disabled="!canEnterAnalysis(row)"
                @click="enterAnalysis(row)"
              >
                <el-icon><Aim /></el-icon>
                <span>进入分析</span>
              </button>
              <button
                v-if="isScanList"
                class="bim-action-button bim-action-button--text"
                type="button"
                title="四分屏"
                aria-label="四分屏"
                :disabled="row.status !== 'stored'"
                @click="openFourScreen(row)"
              >
                <el-icon><Grid /></el-icon>
                <span>四分屏</span>
              </button>
              <button
                class="bim-action-button"
                :class="{ 'bim-action-button--primary': !isScanList }"
                type="button"
                :title="isScanList ? '预览点云' : '预览文件'"
                aria-label="预览文件"
                :disabled="row.status !== 'stored'"
                @click="previewFile(row)"
              >
                <el-icon><View /></el-icon>
                <span v-if="!isScanList">预览</span>
              </button>
              <button
                class="bim-action-button is-delete"
                type="button"
                :title="`删除${props.title}`"
                :aria-label="`删除${props.title}`"
                @click="removeFile(row)"
              >
                <el-icon><Delete /></el-icon>
              </button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <div class="bim-table-empty">
            <strong>
              {{ hasFiles ? '没有匹配的文件' : `当前项目暂无${props.title}` }}
            </strong>
            <span>
              {{
                hasFiles
                  ? '当前筛选条件下没有结果'
                  : '上传文件后可在此查看和管理'
              }}
            </span>
            <button type="button" @click="handleEmptyAction">
              {{ hasActiveFilters ? '清除筛选' : props.uploadLabel }}
            </button>
          </div>
        </template>
      </el-table>
    </section>

    <NeumorphicPagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :total="filteredFiles.length"
      :page-size-options="[10, 20, 50]"
      :aria-label="`${props.title}分页`"
    />

    <DataUploadDialog
      v-if="isScanList"
      v-model="uploadDialogVisible"
      :project-id="projectId || null"
      @complete="handleScanComplete"
    />
    <DesignModelUploadDialog
      v-else-if="isBimList"
      v-model="uploadDialogVisible"
      :project-id="projectId || null"
      @complete="handleScanComplete"
    />
    <UploadDialog
      v-else
      ref="uploadDialogRef"
      v-model="uploadDialogVisible"
      @confirm="handleUploadConfirm"
      @pause-upload="handlePauseUpload"
      @resume-upload="handleResumeUpload"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  Aim,
  Delete,
  Grid,
  Refresh,
  Search,
  Upload,
  View,
} from '@element-plus/icons-vue'
import type { FileType, ProjectFileInfo } from '@/api/fileManage'
import UploadDialog from '@/views/data/history-model/components/UploadDialog.vue'
import DataUploadDialog from '@/views/data/components/DataUploadDialog.vue'
import DesignModelUploadDialog from '@/views/data/components/DesignModelUploadDialog.vue'
import WorkspaceHeading from './WorkspaceHeading.vue'
import NeumorphicPagination from './NeumorphicPagination.vue'
import { useProjectFileList } from '../composables/useProjectFileList'
import { useProjectUpload } from '../composables/useProjectUpload'
import {
  formatDate,
  formatFileSize,
  meshRemeshTagType,
  meshRemeshText,
  statusTagType,
  statusText,
} from '../utils/fileFormat'

const props = defineProps<{
  title: string
  description: string
  uploadLabel: string
  kinds: FileType[]
}>()

const {
  projectId,
  files,
  loading,
  buildingOptions,
  loadFiles,
  loadBuildings,
  linkedBimForFile,
  removeFile,
  previewFile,
  enterAnalysis,
  openFourScreen,
} = useProjectFileList(props.kinds)

const isScanList = computed(() => props.kinds.includes('scan'))
const isBimList = computed(() => props.kinds.includes('bim'))

/** 作用：扫描点云关联的设计模型（BIM）名称，用于列表展示与进入分析校验。 */
function linkedBimName(file: ProjectFileInfo) {
  return linkedBimForFile(file)?.originalName || ''
}
function canEnterAnalysis(file: ProjectFileInfo) {
  if (file.status !== 'stored') return false
  if (file.type !== 'scan') return true
  return Boolean(linkedBimForFile(file))
}

const {
  uploadDialogRef,
  uploadDialogVisible,
  openUpload,
  handleUploadConfirm,
  handlePauseUpload,
  handleResumeUpload,
} = useProjectUpload({
  onUploaded: () => {
    void loadFiles()
    void loadBuildings()
  },
})

/** 点云上传完成：刷新列表与幢层选项。 */
function handleScanComplete() {
  void loadFiles()
  void loadBuildings()
}

const showRemesh = computed(() => props.kinds.includes('bim'))

const filters = reactive({
  keyword: '',
  building: '',
  status: 'all',
  dateRange: null as [Date, Date] | null,
})

const currentPage = ref(1)
const pageSize = ref(10)

const sortedFiles = computed(() =>
  [...files.value].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  ),
)

const filteredFiles = computed(() =>
  sortedFiles.value.filter((file) => {
    const keyword = filters.keyword.trim().toLowerCase()
    const createdAt = new Date(file.createdAt).getTime()
    const matchesDate =
      !filters.dateRange ||
      (createdAt >= new Date(filters.dateRange[0]).setHours(0, 0, 0, 0) &&
        createdAt <= new Date(filters.dateRange[1]).setHours(23, 59, 59, 999))

    return (
      (!keyword || file.originalName.toLowerCase().includes(keyword)) &&
      (!filters.building || file.buildingName === filters.building) &&
      (filters.status === 'all' || file.status === filters.status) &&
      matchesDate
    )
  }),
)

const pagedFiles = computed(() =>
  filteredFiles.value.slice(
    (currentPage.value - 1) * pageSize.value,
    currentPage.value * pageSize.value,
  ),
)

const hasFiles = computed(() => files.value.length > 0)

const hasActiveFilters = computed(() =>
  Boolean(
    filters.keyword.trim() ||
      filters.building ||
      filters.status !== 'all' ||
      filters.dateRange,
  ),
)

function resetFilters() {
  filters.keyword = ''
  filters.building = ''
  filters.status = 'all'
  filters.dateRange = null
  currentPage.value = 1
}

function reload() {
  void loadFiles()
  void loadBuildings()
}

function handleEmptyAction() {
  if (hasActiveFilters.value) resetFilters()
  else openUpload()
}

watch([() => filteredFiles.value.length, pageSize], () => {
  if (
    currentPage.value >
    Math.max(1, Math.ceil(filteredFiles.value.length / pageSize.value))
  ) {
    currentPage.value = Math.max(
      1,
      Math.ceil(filteredFiles.value.length / pageSize.value),
    )
  }
})

watch(
  [
    () => filters.keyword,
    () => filters.building,
    () => filters.status,
    () => filters.dateRange,
  ],
  () => {
    currentPage.value = 1
  },
)

onMounted(() => {
  void loadFiles()
  void loadBuildings()
})
</script>

<style lang="scss" scoped>
@use '../styles/workspace-controls.scss' as controls;

.design-page {
  min-height: 100%;
  padding: 0;
  color: var(--text-primary);
}

.workspace-list {
  @include controls.list-surface;
}

.bim-toolbar {
  @include controls.filters;

  flex-wrap: wrap;
}

.bim-filters {
  flex-wrap: wrap;
}

.bim-search-input {
  flex-basis: 240px;
  max-width: 320px;
}

.bim-toolbar-button {
  @include controls.action;
}

.bim-toolbar-button.is-primary {
  @include controls.primary;
}

.bim-action-button {
  @include controls.action;

  width: var(--control-height);
  padding: 0;
}

.bim-action-button--primary {
  @include controls.primary;

  width: auto;
  padding: 0 var(--spacing-compact);
}

/* 带文字的次要操作按钮（如「四分屏」），保持与主按钮一致的间距与高度 */
.bim-action-button--text {
  width: auto;
  padding: 0 var(--spacing-compact);
  white-space: nowrap;
}

.bim-action-button.is-delete:hover {
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border-color: var(--color-danger);
}

.bim-table-card {
  padding: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-md);
  box-shadow: none;
}

.bim-table-heading {
  margin-bottom: var(--spacing-compact);
}

.bim-table-heading h2 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
}

.bim-name-cell {
  min-width: 0;
}

.bim-name-cell > span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bim-name-meta {
  display: block;
  margin-top: 2px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.bim-name-related {
  display: block;
  overflow: hidden;
  margin-top: 2px;
  font-size: var(--font-size-xs);
  color: var(--color-warning, #b45309);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bim-name-related.is-ready {
  color: var(--color-success, #15803d);
}

.bim-table-empty {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  align-items: center;
  justify-content: center;
  min-height: 180px;
  color: var(--text-secondary);
}

.bim-table-empty strong {
  color: var(--text-primary);
}

.bim-table-empty button {
  @include controls.action;
  @include controls.primary;

  margin-top: var(--spacing-sm);
}
</style>
