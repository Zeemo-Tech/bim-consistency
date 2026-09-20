<template>
  <el-card class="search-form-card" shadow="never">
    <!-- 搜索表单区域 -->
    <el-form :inline="true" :model="form" class="search-form">
      <el-form-item label="项目名称">
        <el-input
          v-model="form.projectName"
          placeholder="请输入项目名称"
          clearable
          style="width: 200px"
          @keyup.enter="handleSearch"
        />
      </el-form-item>

      <el-form-item label="文件名称">
        <el-input
          v-model="form.fileName"
          placeholder="请输入文件名称"
          clearable
          style="width: 200px"
          @keyup.enter="handleSearch"
        />
      </el-form-item>

      <el-form-item label="所属项目">
        <el-select
          v-model="form.projectId"
          placeholder="请选择项目"
          clearable
          filterable
          style="width: 220px"
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

      <el-form-item label="文件类型">
        <el-select
          v-model="form.fileType"
          placeholder="请选择文件类型"
          clearable
          style="width: 180px"
          @change="handleSearch"
        >
          <el-option label="全部类型" value="" />
          <el-option label="BIM 模型" value="bim" />
          <el-option label="CAD 图纸" value="cad" />
          <el-option label="点云文件" value="scan" />
          <el-option label="高斯模型" value="gauss" />
        </el-select>
      </el-form-item>

      <el-form-item label="所属幢">
        <el-select
          v-model="form.buildingName"
          placeholder="请选择所属幢"
          clearable
          filterable
          allow-create
          default-first-option
          reserve-keyword
          :disabled="!form.projectId"
          style="width: 180px"
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

      <el-form-item label="所属层">
        <el-select
          v-model="form.floorName"
          placeholder="请选择所属层"
          clearable
          filterable
          allow-create
          default-first-option
          reserve-keyword
          :disabled="!form.projectId || !form.buildingName"
          style="width: 180px"
          @change="handleSearch"
        >
          <el-option
            v-for="floor in floorOptions"
            :key="floor"
            :label="floor"
            :value="floor"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="上传时间">
        <el-date-picker
          v-model="form.dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 240px"
          @change="handleSearch"
        />
      </el-form-item>

      <el-form-item>
        <el-button type="primary" :icon="Search" @click="handleSearch">
          搜索
        </el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- 操作按钮区域 -->
    <div class="action-buttons">
      <el-button type="primary" :icon="Upload" @click="handleUpload">
        上传文件
      </el-button>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Search, Refresh, Upload } from '@element-plus/icons-vue'

interface ProjectOption {
  id: number
  name: string
}

/**
 * 组件属性定义
 */
interface Props {
  buildingOptions?: string[]
  modelValue?: {
    buildingName: string
    fileName: string
    projectName: string
    projectId: number | null
    fileType: string
    floorName: string
    dateRange: string[]
  }
  floorOptions?: string[]
  projectList?: ProjectOption[]
}

/**
 * 组件事件定义
 */
interface Emits {
  (e: 'update:modelValue', value: any): void
  (e: 'search'): void
  (e: 'reset'): void
  (e: 'upload'): void
  (e: 'addProject'): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({
    buildingName: '',
    fileName: '',
    projectName: '',
    projectId: null,
    fileType: '',
    floorName: '',
    dateRange: [],
  }),
  projectList: () => [],
  buildingOptions: () => [],
  floorOptions: () => [],
})

const emit = defineEmits<Emits>()

const normalizeValue = (value?: string | null) => value?.trim() || ''

const isSameFormValue = (
  left: Props['modelValue'],
  right: Props['modelValue'],
) => {
  if (!left || !right) return left === right
  return (
    normalizeValue(left.buildingName) === normalizeValue(right.buildingName) &&
    normalizeValue(left.fileName) === normalizeValue(right.fileName) &&
    normalizeValue(left.projectName) === normalizeValue(right.projectName) &&
    left.projectId === right.projectId &&
    normalizeValue(left.fileType) === normalizeValue(right.fileType) &&
    normalizeValue(left.floorName) === normalizeValue(right.floorName) &&
    JSON.stringify(left.dateRange || []) ===
      JSON.stringify(right.dateRange || [])
  )
}

/**
 * 表单数据
 */
const form = ref({
  buildingName: props.modelValue.buildingName,
  fileName: props.modelValue.fileName,
  projectName: props.modelValue.projectName,
  projectId: props.modelValue.projectId,
  fileType: props.modelValue.fileType,
  floorName: props.modelValue.floorName,
  dateRange: props.modelValue.dateRange,
})

const syncFormValue = () => {
  emit('update:modelValue', { ...form.value })
}

/**
 * 监听表单变化，同步到父组件
 */
watch(
  () => form.value,
  (newVal) => {
    if (isSameFormValue(newVal, props.modelValue)) return
    emit('update:modelValue', { ...newVal })
  },
  { deep: true },
)

/**
 * 监听父组件数据变化
 */
watch(
  () => props.modelValue,
  (newVal) => {
    if (isSameFormValue(newVal, form.value)) return
    form.value = { ...newVal }
  },
  { deep: true },
)

/**
 * 处理搜索操作
 */
const handleSearch = () => {
  syncFormValue()
  emit('search')
}

const handleProjectChange = () => {
  form.value.buildingName = ''
  form.value.floorName = ''
  handleSearch()
}

const handleBuildingChange = () => {
  form.value.floorName = ''
  handleSearch()
}

/**
 * 处理重置操作
 */
const handleReset = () => {
  form.value = {
    buildingName: '',
    fileName: '',
    projectName: '',
    projectId: null,
    fileType: '',
    floorName: '',
    dateRange: [],
  }
  emit('reset')
}

/**
 * 处理上传文件操作
 */
const handleUpload = () => {
  emit('upload')
}
</script>

<style lang="scss" scoped>
.search-form-card {
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
</style>
