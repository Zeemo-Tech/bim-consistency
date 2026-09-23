<template>
  <el-dialog
    v-model="visible"
    class="simple-upload-dialog"
    title="上传设计模型"
    width="min(650px, calc(100vw - 82px))"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    @opened="handleOpened"
  >
    <section class="simple-upload-page" :aria-busy="uploading">
      <input
        ref="fileInput"
        class="hidden-input"
        type="file"
        accept=".ifc"
        @change="handleFileChange"
      />
      <div
        class="file-selection"
        :class="{ 'has-file': Boolean(selectedFile) }"
        @dragover.prevent
        @drop.prevent="handleDrop"
      >
        <el-icon class="file-symbol" :size="24"><Document /></el-icon>
        <div class="file-details">
          <strong :title="selectedFile?.name">
            {{ selectedFile ? selectedFile.name : '选择 IFC 模型文件' }}
          </strong>
          <span v-if="selectedFile">
            {{ formatFileSize(selectedFile.size) }} · IFC
          </span>
          <span v-else>IFC · 可将文件拖放到此处</span>
        </div>
        <div class="file-actions">
          <button
            class="choose-file-button"
            type="button"
            :disabled="uploading"
            @click="chooseFile"
          >
            {{ selectedFile ? '更换文件' : '选择文件' }}
          </button>
          <button
            v-if="selectedFile"
            class="clear-btn"
            type="button"
            title="清除已选文件"
            aria-label="清除已选文件"
            :disabled="uploading"
            @click="clearFile"
          >
            <el-icon><Close /></el-icon>
          </button>
        </div>
      </div>

      <section class="archive-form">
        <div class="archive-form-heading">
          <div>
            <h2>归档信息</h2>
            <p>模型与点云通过归档编号自动关联</p>
          </div>
          <code :title="archiveCode">{{ archiveCode || '待生成' }}</code>
        </div>
        <div class="archive-fields">
          <div class="archive-field">
            <span>楼栋</span>
            <el-input
              v-model="form.buildingName"
              placeholder="如 2#"
              clearable
            />
          </div>
          <div class="archive-field">
            <span>楼层</span>
            <el-input v-model="form.floorName" placeholder="如 16F" clearable />
          </div>
          <div class="archive-field">
            <span>楼板类型</span>
            <el-select
              v-model="form.componentType"
              filterable
              allow-create
              default-first-option
              clearable
              placeholder="选择类型"
            >
              <el-option
                v-for="item in ARCHIVE_COMPONENT_TYPES"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </div>
          <div class="archive-field">
            <span>归档序号</span>
            <el-input
              v-model="form.archiveSerial"
              placeholder="如 21"
              clearable
            />
          </div>
        </div>
      </section>

      <div
        v-if="uploading || progress > 0"
        class="upload-progress"
        role="status"
      >
        <el-progress
          :percentage="Math.round(progress)"
          :status="progress >= 100 ? 'success' : undefined"
        />
        <span>
          {{ progress >= 100 ? '上传处理完成' : '正在上传并处理文件…' }}
        </span>
      </div>

      <footer class="upload-footer">
        <span>
          {{
            selectedFile
              ? '确认归档信息后开始上传'
              : '请先选择文件，再填写归档信息'
          }}
        </span>
        <button
          class="submit-btn"
          type="button"
          :aria-label="uploading ? '正在上传' : '开始上传'"
          :disabled="!selectedFile || uploading"
          @click="submit"
        >
          <el-icon :class="{ 'is-loading': uploading }">
            <Loading v-if="uploading" />
            <Upload v-else />
          </el-icon>
          {{ uploading ? '上传中…' : '开始上传' }}
        </button>
      </footer>
    </section>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { Close, Document, Loading, Upload } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  ARCHIVE_COMPONENT_TYPES,
  buildArchiveCode,
  type ArchiveComponentType,
} from '@/api/fileManage'

defineOptions({ name: 'DesignModelUploadDialog' })

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    projectId?: number | null
  }>(),
  { projectId: null },
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'complete'): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const fileInput = ref<HTMLInputElement>()
const selectedFile = ref<File>()
const uploading = ref(false)
const progress = ref(0)

const form = reactive({
  buildingName: '',
  floorName: '',
  componentType: '' as ArchiveComponentType | '',
  archiveSerial: '',
})

const archiveCode = computed(() =>
  buildArchiveCode(form.floorName, form.componentType, form.archiveSerial),
)

function handleOpened() {
  resetForm()
}

function chooseFile() {
  if (!uploading.value) fileInput.value?.click()
}
function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) acceptFile(file)
  input.value = ''
}
function handleDrop(event: DragEvent) {
  if (uploading.value) return
  const file = event.dataTransfer?.files?.[0]
  if (file) acceptFile(file)
}
function acceptFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  if (extension !== 'ifc') {
    ElMessage.warning('这里只能上传 IFC 文件')
    return
  }
  selectedFile.value = file
  progress.value = 0
}
function clearFile() {
  if (!uploading.value) {
    selectedFile.value = undefined
    progress.value = 0
  }
}

async function submit() {
  if (!selectedFile.value) {
    ElMessage.warning('请先选择 IFC 模型文件')
    return
  }
  if (!props.projectId) {
    ElMessage.warning('缺少项目信息')
    return
  }
  if (
    !form.buildingName.trim() ||
    !form.floorName.trim() ||
    !form.componentType ||
    !form.archiveSerial.trim()
  ) {
    ElMessage.warning('请完整填写楼栋、楼层、楼板类型和归档序号')
    return
  }

  uploading.value = true
  progress.value = 0
  try {
    const { uploadFile } = await import('@/utils/upload')
    await uploadFile({
      projectId: props.projectId,
      type: 'bim',
      file: selectedFile.value,
      buildingName: form.buildingName.trim(),
      floorName: form.floorName.trim(),
      componentType: form.componentType,
      archiveSerial: form.archiveSerial.trim(),
      archiveCode: archiveCode.value,
      onProgress: (value) => {
        progress.value = value
      },
    })
    progress.value = 100
    ElMessage.success('设计模型已上传并进入处理')
    emit('complete')
    visible.value = false
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '上传失败')
  } finally {
    uploading.value = false
  }
}

function resetForm() {
  form.buildingName = ''
  form.floorName = ''
  form.componentType = ''
  form.archiveSerial = ''
  selectedFile.value = undefined
  progress.value = 0
  uploading.value = false
}

function formatFileSize(size: number) {
  if (!size) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(
    Math.floor(Math.log(size) / Math.log(1024)),
    units.length - 1,
  )
  return `${(size / 1024 ** index).toFixed(index === 0 ? 0 : 2)} ${units[index]}`
}
</script>

<style lang="scss" scoped>
.simple-upload-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.hidden-input {
  display: none;
}

.file-selection {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
  min-height: 96px;
  padding: 16px;
  border: 1px dashed var(--border-color-hover);
  border-radius: var(--radius-sm);
  background: var(--bg-control);

  &.has-file {
    border-style: solid;
  }
}

.file-symbol {
  color: var(--color-primary);
  flex: 0 0 32px;
}

.file-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;

  strong {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  > span {
    color: var(--text-secondary);
    font-size: 12px;
  }
}

.file-actions {
  display: flex;
  gap: 8px;
}

.choose-file-button,
.clear-btn,
.submit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  padding: 0 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background-color var(--transition-fast);

  &:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.clear-btn {
  width: 36px;
  padding: 0;
}

.archive-form {
  min-width: 0;
}

.archive-form-heading {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;

  > div {
    min-width: 0;
    flex: 1;
  }

  h2 {
    margin: 0;
    font-size: 16px;
    color: var(--text-primary);
  }

  p {
    margin: 4px 0 0;
    color: var(--text-secondary);
    font-size: 12px;
  }

  code {
    max-width: 45%;
    padding: 4px 8px;
    border-radius: var(--radius-xs);
    background: var(--bg-control);
    color: var(--text-secondary);
    overflow-wrap: anywhere;
    font-size: 12px;
  }
}

.archive-fields {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.archive-field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;

  > span {
    color: var(--text-secondary);
    font-size: 14px;
  }

  :deep(.el-select),
  :deep(.el-input) {
    width: 100%;
    min-width: 0;
  }
}

.upload-progress {
  display: grid;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.upload-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color-light);

  > span {
    color: var(--text-secondary);
    font-size: 12px;
  }
}

.submit-btn {
  flex-shrink: 0;
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;

  &:hover:not(:disabled) {
    background: var(--color-primary-hover);
    color: #fff;
  }

  :deep(.el-icon) {
    font-size: 16px;
  }

  :deep(.is-loading) {
    animation: rotating 2s linear infinite;
  }
}

@keyframes rotating {
  from {
    transform: rotate(0);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 720px) {
  .archive-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

<style lang="scss">
.simple-upload-dialog.el-dialog {
  --el-color-primary: var(--color-primary, #4e66cc);
  --el-color-primary-light-9: var(--color-primary-soft, #eef1fb);
  --el-color-primary-dark-2: var(--color-primary-active, #102375);
  --el-text-color-primary: var(--text-primary, #1b2f4a);
  --el-text-color-regular: var(--text-secondary, #425a7a);
  --el-border-color: var(--border-color, #d6dfec);
  --el-border-color-hover: var(--border-color-focus, #4e66cc);
  --el-font-family: var(--font-family-base, inherit);

  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  box-shadow: var(--shadow-md);

  .el-dialog__header {
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-color-light);
  }

  .el-dialog__title {
    font-size: 20px;
    font-weight: 620;
    color: var(--text-primary);
  }

  .el-dialog__headerbtn .el-dialog__close {
    color: var(--text-tertiary);

    &:hover {
      color: var(--color-primary);
    }
  }

  .el-dialog__body {
    padding-top: 20px;
  }

  .el-dialog__footer {
    display: none;
  }
}
</style>
