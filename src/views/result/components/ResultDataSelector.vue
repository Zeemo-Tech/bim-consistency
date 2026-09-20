<template>
  <el-row ref="containerRef" class="data-selector" :gutter="16" align="middle">
    <div class="selector-form-wrap">
      <el-form :model="formData" inline size="default">
        <template v-if="isPresetMode">
          <el-form-item label="项目">
            <div class="readonly-value">{{ resolvedProjectName || '—' }}</div>
          </el-form-item>
          <el-form-item label="扫描文件">
            <div class="readonly-value">{{ resolvedScanName || '—' }}</div>
          </el-form-item>
          <el-form-item label="CAD文件">
            <div class="readonly-value">{{ resolvedCadName || '—' }}</div>
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              :loading="loading"
              @click="emit('reload-preset')"
            >
              重新加载
            </el-button>
          </el-form-item>
          <el-form-item>
            <el-button
              :type="syncActive ? 'success' : 'default'"
              @click="emit('toggle-sync')"
            >
              {{ syncActive ? '退出同步' : '视角同步' }}
            </el-button>
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="项目">
            <el-select
              :model-value="formData.projectId"
              placeholder="请选择项目"
              filterable
              @update:modelValue="onProjectSelect"
            >
              <el-option
                v-for="project in projectList"
                :key="project.projectId"
                :label="project.projectName"
                :value="project.projectId"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="扫描文件">
            <el-select
              :model-value="formData.scanFileId"
              placeholder="请选择扫描文件"
              :disabled="!formData.projectId"
              @update:modelValue="onScanFileSelect"
            >
              <el-option
                v-for="file in scanFiles"
                :key="file.id"
                :label="file.originalName"
                :value="file.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="CAD文件">
            <el-select
              :model-value="formData.cadFileId"
              placeholder="请选择CAD文件"
              :disabled="!formData.projectId"
              @update:modelValue="onCadFileSelect"
            >
              <el-option
                v-for="file in cadFiles"
                :key="file.id"
                :label="file.originalName"
                :value="file.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item>
            <el-button
              type="primary"
              :disabled="!canLoad"
              :loading="loading"
              @click="emit('load-data')"
            >
              加载结果
            </el-button>
          </el-form-item>
          <el-form-item>
            <el-button
              :type="syncActive ? 'success' : 'default'"
              @click="emit('toggle-sync')"
            >
              {{ syncActive ? '退出同步' : '视角同步' }}
            </el-button>
          </el-form-item>
        </template>
      </el-form>
    </div>
  </el-row>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { ProjectFileInfo } from '@/api/fileManage'

type FormData = {
  projectId: number | null
  scanFileId: number | null
  cadFileId: number | null
}

type ProjectInfo = {
  projectId: number
  projectName: string
  types: any[]
}

const props = defineProps<{
  formData: FormData
  projectList: ProjectInfo[]
  scanFiles: ProjectFileInfo[]
  cadFiles: ProjectFileInfo[]
  isPresetMode: boolean
  resolvedProjectName: string
  resolvedScanName: string
  resolvedCadName: string
  canLoad: boolean
  loading: boolean
  syncActive: boolean
}>()

const emit = defineEmits<{
  (e: 'update:form-data', value: FormData): void
  (e: 'project-change', value: number | null): void
  (e: 'file-change', value: number | null): void
  (e: 'load-data'): void
  (e: 'reload-preset'): void
  (e: 'toggle-sync'): void
}>()

const containerRef = ref<HTMLElement | null>(null)

defineExpose({
  getEl: () => containerRef.value,
})

const updateFormData = (patch: Partial<FormData>) => {
  emit('update:form-data', { ...props.formData, ...patch })
}

const onProjectSelect = (value: number | null) => {
  if (props.formData.projectId === value) return
  updateFormData({ projectId: value })
  emit('project-change', value)
}

const onScanFileSelect = (value: number | null) => {
  if (props.formData.scanFileId === value) return
  updateFormData({ scanFileId: value })
  emit('file-change', value)
}

const onCadFileSelect = (value: number | null) => {
  if (props.formData.cadFileId === value) return
  updateFormData({ cadFileId: value })
  emit('file-change', value)
}
</script>
