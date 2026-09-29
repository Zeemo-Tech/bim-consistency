<template>
  <CloudBimShell variant="workspace" :sidebar="false" active="devices">
    <div class="devices-page">
      <div class="cb-heading devices-heading">
        <div>
          <h1>设备中心</h1>
          <p>维护扫描设备字典（能力：高斯 / 全景图），上传点云时可选择设备。</p>
        </div>
        <el-button type="primary" :icon="Plus" @click="openCreate">
          新增设备
        </el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="devices"
        class="devices-table"
        row-key="id"
      >
        <el-table-column label="设备名称" prop="name" min-width="200" />
        <el-table-column label="能力" min-width="220">
          <template #default="{ row }">
            <div class="device-caps">
              <el-tag
                :type="row.hasGaussian ? 'success' : 'info'"
                effect="light"
                size="small"
              >
                高斯{{ row.hasGaussian ? '' : '（无）' }}
              </el-tag>
              <el-tag
                :type="row.hasPanorama ? 'success' : 'info'"
                effect="light"
                size="small"
              >
                全景图{{ row.hasPanorama ? '' : '（无）' }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="排序" prop="sort" width="90" />
        <el-table-column label="操作" width="150" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">
              编辑
            </el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <div class="devices-empty">暂无设备，点击右上角新增。</div>
        </template>
      </el-table>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="editing ? '编辑设备' : '新增设备'"
      width="min(460px, calc(100vw - 32px))"
      append-to-body
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="设备名称" prop="name">
          <el-input
            v-model="form.name"
            placeholder="如 XGRIDS 其域创新"
            clearable
          />
        </el-form-item>
        <el-form-item label="具备高斯能力">
          <el-switch v-model="form.hasGaussian" />
        </el-form-item>
        <el-form-item label="具备全景图能力">
          <el-switch v-model="form.hasPanorama" />
        </el-form-item>
        <el-form-item label="排序（越小越靠前）">
          <el-input-number v-model="form.sort" :min="0" :step="1" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">
          保存
        </el-button>
      </template>
    </el-dialog>
  </CloudBimShell>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import CloudBimShell from '@/layout/cloudbim/CloudBimShell.vue'
import {
  createDevice,
  deleteDevice,
  getDevices,
  updateDevice,
  type Device,
} from '@/api/device'

defineOptions({ name: 'CloudBimDevices' })

const loading = ref(false)
const saving = ref(false)
const devices = ref<Device[]>([])
const dialogVisible = ref(false)
const editing = ref<Device | null>(null)
const formRef = ref<FormInstance>()

const form = reactive({
  name: '',
  hasGaussian: true,
  hasPanorama: true,
  sort: 0,
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入设备名称', trigger: 'blur' }],
}

async function loadDevices() {
  loading.value = true
  try {
    const res = await getDevices()
    devices.value = res.data || []
  } catch {
    devices.value = []
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.name = ''
  form.hasGaussian = true
  form.hasPanorama = true
  form.sort = 0
  formRef.value?.clearValidate()
}

function openCreate() {
  editing.value = null
  resetForm()
  dialogVisible.value = true
}

function openEdit(row: Device) {
  editing.value = row
  form.name = row.name
  form.hasGaussian = row.hasGaussian
  form.hasPanorama = row.hasPanorama
  form.sort = row.sort
  dialogVisible.value = true
}

async function submit() {
  if (!(await formRef.value?.validate().catch(() => false))) return
  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      hasGaussian: form.hasGaussian,
      hasPanorama: form.hasPanorama,
      sort: form.sort,
    }
    if (editing.value) {
      await updateDevice(editing.value.id, payload)
      ElMessage.success('设备已更新')
    } else {
      await createDevice(payload)
      ElMessage.success('设备已新增')
    }
    dialogVisible.value = false
    await loadDevices()
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function remove(row: Device) {
  try {
    await ElMessageBox.confirm(`确定删除设备「${row.name}」吗？`, '删除设备', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await deleteDevice(row.id)
    ElMessage.success('设备已删除')
    await loadDevices()
  } catch (error: any) {
    ElMessage.error(error?.message || '删除失败')
  }
}

loadDevices()
</script>

<style lang="scss" scoped>
.devices-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.devices-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.devices-table {
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-sm);
}

.device-caps {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.devices-empty {
  padding: 24px 0;
  color: var(--text-secondary);
  font-size: 13px;
}
</style>
