<template>
  <el-dialog
    v-model="visible"
    width="760px"
    class="create-role-dialog"
    @close="handleClose"
  >
    <template #header>
      <div class="dialog-header">
        <div class="dialog-header__main">
          <h2 class="dialog-title">
            {{ props.editMode ? '编辑角色' : '创建角色' }}
          </h2>
          <p class="dialog-subtitle">
            {{
              props.editMode
                ? '调整角色名称、说明、色彩标识与权限范围。'
                : '创建新的角色模板，并一次性配置对应权限。'
            }}
          </p>
        </div>

        <div class="dialog-overview">
          <div class="overview-item">
            <span class="overview-label">已选权限</span>
            <strong class="overview-value">
              {{ selectedPermissionCount }}
            </strong>
          </div>
          <div class="overview-divider" />
          <div class="overview-item">
            <span class="overview-label">权限分类</span>
            <strong class="overview-value">{{ categoryCount }}</strong>
          </div>
        </div>
      </div>
    </template>

    <div class="dialog-content">
      <section class="surface-card">
        <div class="section-header">
          <div>
            <div class="section-title">基础信息</div>
            <div class="section-desc">设置角色名称、说明和视觉标识。</div>
          </div>
        </div>

        <div class="basic-grid">
          <div class="form-section">
            <label class="form-label">角色名称</label>
            <el-input
              v-model="form.name"
              placeholder="请输入角色名称"
              class="role-input"
              maxlength="30"
              show-word-limit
            />
          </div>

          <div class="form-section">
            <label class="form-label">角色颜色</label>
            <div class="color-selector">
              <button
                v-for="item in colors"
                :key="item.name"
                type="button"
                class="color-item"
                :class="{ active: selectedColor === item.value }"
                @click="handleColorSelect(item.value)"
              >
                <span
                  class="color-swatch"
                  :style="{ backgroundColor: item.value }"
                />
                <span class="color-name">{{ item.name }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="form-section">
          <label class="form-label">角色描述</label>
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            maxlength="120"
            show-word-limit
            placeholder="简要描述该角色负责的业务与权限边界"
            class="role-textarea"
          />
        </div>

        <div
          class="role-preview"
          :style="{ '--preview-color': selectedColor || '#4e66cc' }"
        >
          <span class="preview-dot" />
          <div class="preview-content">
            <div class="preview-name">{{ form.name.trim() || '角色预览' }}</div>
            <div class="preview-desc">
              {{
                form.description.trim() || '角色说明会显示在角色卡片和详情区。'
              }}
            </div>
          </div>
        </div>
      </section>

      <section class="surface-card">
        <div class="section-header">
          <div>
            <div class="section-title">权限配置</div>
            <div class="section-desc">按分类勾选权限，支持整组全选与取消。</div>
          </div>
          <div class="permission-summary">
            已选
            <strong>{{ selectedPermissionCount }}</strong>
            / {{ totalPermissionCount }}
          </div>
        </div>

        <div v-loading="loading" class="permissions-config">
          <el-empty
            v-if="Object.keys(permissionsByCategory).length === 0 && !loading"
            :image-size="100"
            description="暂无权限数据"
          />

          <div
            v-for="(permissions, category) in permissionsByCategory"
            :key="category"
            class="permission-group"
          >
            <div class="group-header">
              <div class="group-header__info">
                <el-checkbox
                  v-model="permissionStates[category].checked"
                  :indeterminate="permissionStates[category].indeterminate"
                  class="group-checkbox"
                  @change="handleGroupChange(category)"
                >
                  <span class="group-title">{{ category }}</span>
                </el-checkbox>
                <span class="group-count">
                  {{ getCheckedCount(category) }}/{{ permissions.length }}
                </span>
              </div>
            </div>

            <div class="group-content">
              <label
                v-for="permission in permissions"
                :key="permission.id"
                class="permission-option"
                :class="{
                  'permission-option--active': form.permissions[permission.id],
                }"
              >
                <el-checkbox
                  v-model="form.permissions[permission.id]"
                  class="permission-checkbox"
                  @change="updateGroupState(category)"
                >
                  <span class="permission-name">
                    {{ permission.displayName }}
                  </span>
                </el-checkbox>
              </label>
            </div>
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button class="footer-btn footer-btn--plain" @click="handleClose">
          取消
        </el-button>
        <el-button
          type="primary"
          class="footer-btn footer-btn--primary"
          :loading="loading"
          @click="handleConfirm"
        >
          {{ props.editMode ? '保存角色' : '创建角色' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createRole,
  getPermissions,
  updateRole,
  type Permission as ApiPermission,
} from '@/api/role'

const colors = [
  { name: '深蓝', value: '#4E66CC' },
  { name: '青绿', value: '#0F766E' },
  { name: '琥珀', value: '#C2410C' },
  { name: '紫色', value: '#7C3AED' },
  { name: '天蓝', value: '#1D4ED8' },
  { name: '松绿', value: '#15803D' },
]

const DEFAULT_ROLE_COLOR = colors[0].value

const selectedColor = ref(DEFAULT_ROLE_COLOR)

interface Permission {
  id: number
  name: string
  displayName: string
  category: string
}

interface PermissionState {
  checked: boolean
  indeterminate: boolean
}

interface PermissionStates {
  [key: string]: PermissionState
}

const props = defineProps<{
  modelValue: boolean
  editMode?: boolean
  roleData?: {
    id: number
    name: string
    description?: string
    color?: string
    permissions: ApiPermission[]
  }
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
}>()

const visible = ref(props.modelValue)

const form = reactive({
  id: 0,
  name: '',
  description: '',
  color: DEFAULT_ROLE_COLOR,
  permissions: {} as Record<number, boolean>,
})

const permissionStates = reactive<PermissionStates>({})
const permissionsByCategory = ref<Record<string, Permission[]>>({})
const loading = ref(false)

const totalPermissionCount = computed(() =>
  Object.values(permissionsByCategory.value).reduce(
    (sum, permissions) => sum + permissions.length,
    0,
  ),
)

const selectedPermissionCount = computed(
  () => Object.values(form.permissions).filter(Boolean).length,
)

const categoryCount = computed(
  () => Object.keys(permissionsByCategory.value).length,
)

const clearPermissionSelections = () => {
  Object.keys(form.permissions).forEach((key) => {
    form.permissions[parseInt(key, 10)] = false
  })
}

const syncAllGroupStates = () => {
  Object.keys(permissionsByCategory.value).forEach((category) => {
    updateGroupState(category)
  })
}

const resetForm = () => {
  form.id = 0
  form.name = ''
  form.description = ''
  form.color = DEFAULT_ROLE_COLOR
  selectedColor.value = DEFAULT_ROLE_COLOR
  clearPermissionSelections()

  Object.keys(permissionStates).forEach((key) => {
    permissionStates[key] = {
      checked: false,
      indeterminate: false,
    }
  })
}

const initFormData = () => {
  resetForm()

  if (!props.editMode || !props.roleData) {
    return
  }

  form.id = props.roleData.id
  form.name = props.roleData.name
  form.description = props.roleData.description || ''
  form.color = props.roleData.color || DEFAULT_ROLE_COLOR
  selectedColor.value = props.roleData.color || DEFAULT_ROLE_COLOR

  props.roleData.permissions.forEach((permission) => {
    form.permissions[permission.id] = true
  })

  syncAllGroupStates()
}

const loadPermissions = async () => {
  try {
    loading.value = true
    const response = await getPermissions(1, 100)
    const permissions = response.data.list || []
    const grouped: Record<string, Permission[]> = {}

    permissions.forEach((permission: ApiPermission) => {
      if (!grouped[permission.category]) {
        grouped[permission.category] = []
        permissionStates[permission.category] = {
          checked: false,
          indeterminate: false,
        }
      }
      grouped[permission.category].push(permission)
    })

    permissionsByCategory.value = grouped
    clearPermissionSelections()
    initFormData()
  } catch (error) {
    ElMessage.error('加载权限列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

const updateGroupState = (category: string) => {
  const permissions = permissionsByCategory.value[category] || []
  const checkedCount = permissions.filter(
    (permission) => form.permissions[permission.id],
  ).length
  const totalCount = permissions.length

  if (!permissionStates[category]) {
    return
  }

  permissionStates[category].checked =
    totalCount > 0 && checkedCount === totalCount
  permissionStates[category].indeterminate =
    checkedCount > 0 && checkedCount < totalCount
}

const getCheckedCount = (category: string) =>
  (permissionsByCategory.value[category] || []).filter(
    (permission) => form.permissions[permission.id],
  ).length

const handleColorSelect = (color: string) => {
  selectedColor.value = color
  form.color = color
}

const handleGroupChange = (category: string) => {
  const permissions = permissionsByCategory.value[category] || []
  const isChecked = permissionStates[category]?.checked || false

  permissions.forEach((permission) => {
    form.permissions[permission.id] = isChecked
  })

  permissionStates[category].indeterminate = false
}

const handleClose = () => {
  visible.value = false
  emit('update:modelValue', false)
  resetForm()
}

const handleConfirm = async () => {
  if (!form.name.trim()) {
    ElMessage.warning('请输入角色名称')
    return
  }

  const selectedPermissionIds = Object.keys(form.permissions)
    .filter((key) => form.permissions[parseInt(key, 10)])
    .map((key) => parseInt(key, 10))

  if (selectedPermissionIds.length === 0) {
    ElMessage.warning('请至少选择一项权限')
    return
  }

  try {
    loading.value = true
    const params = {
      name: form.name.trim(),
      description: form.description.trim(),
      color: selectedColor.value,
      permissionIds: selectedPermissionIds,
    }

    if (props.editMode && form.id) {
      await updateRole(form.id, params)
      ElMessage.success('角色更新成功')
    } else {
      await createRole(params)
      ElMessage.success('角色创建成功')
    }

    emit('confirm')
    handleClose()
  } catch (error: any) {
    ElMessage.error(
      error?.message || (props.editMode ? '更新角色失败' : '创建角色失败'),
    )
    console.error(error)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.modelValue,
  (newVal) => {
    visible.value = newVal
    if (!newVal) {
      return
    }

    if (Object.keys(permissionsByCategory.value).length === 0) {
      loadPermissions()
      return
    }

    initFormData()
  },
)

watch(
  () => props.roleData,
  () => {
    if (props.modelValue) {
      initFormData()
    }
  },
  { deep: true },
)

onMounted(() => {
  loadPermissions()
})
</script>

<style scoped lang="scss">
.create-role-dialog {
  :deep(.el-dialog) {
    overflow: hidden;
    border: 1px solid #e6ebf5;
    border-radius: 20px;
    box-shadow: 0 24px 64px rgba(15, 23, 42, 0.16);
  }

  :deep(.el-dialog__header) {
    padding: 0;
    border-bottom: 1px solid #edf1f7;
    background:
      radial-gradient(
        circle at top left,
        rgba(78, 102, 204, 0.12),
        transparent 34%
      ),
      linear-gradient(180deg, #ffffff, #fbfcff);
  }

  :deep(.el-dialog__body) {
    padding: 0;
    background: #f7f9fc;
  }

  :deep(.el-dialog__footer) {
    padding: 18px 24px 24px;
    border-top: 1px solid #edf1f7;
    background: #ffffff;
  }
}

.dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0 24px;
}

.dialog-header__main {
  min-width: 0;
}

.dialog-title {
  margin: 0;
  color: #172033;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.25;
}

.dialog-subtitle {
  margin: 8px 0 0;
  color: #6b7280;
  font-size: 14px;
}

.dialog-overview {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid #e6ebf5;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.85);
}

.overview-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.overview-label {
  color: #7b8597;
  font-size: 12px;
}

.overview-value {
  color: #172033;
  font-size: 20px;
  font-weight: 700;
}

.overview-divider {
  width: 1px;
  height: 28px;
  background: #e5e7eb;
}

.dialog-content {
  display: grid;
  gap: 16px;
  max-height: 72vh;
  padding: 0px 20px 24px 24px;
  overflow-y: auto;
}

.surface-card {
  padding: 20px;
  border: 1px solid #e6ebf5;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.04);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.section-title {
  color: #172033;
  font-size: 17px;
  font-weight: 600;
}

.section-desc {
  margin-top: 6px;
  color: #7b8597;
  font-size: 13px;
  line-height: 1.6;
}

.basic-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 320px);
  gap: 16px;
}

.form-section + .form-section {
  margin-top: 18px;
}

.basic-grid .form-section + .form-section {
  margin-top: 0;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  color: #172033;
  font-size: 14px;
  font-weight: 600;
}

.role-input {
  :deep(.el-input__wrapper) {
    min-height: 44px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: none;
    background: #fafbfc;
  }

  :deep(.el-input__wrapper.is-focus) {
    border-color: #4e66cc;
    box-shadow: 0 0 0 3px rgba(78, 102, 204, 0.12);
    background: #ffffff;
  }
}

.role-textarea {
  :deep(.el-textarea__inner) {
    border-radius: 12px;
    border-color: #e5e7eb;
    background: #fafbfc;
    box-shadow: none;
    resize: none;
  }

  :deep(.el-textarea__inner:focus) {
    border-color: #4e66cc;
    box-shadow: 0 0 0 3px rgba(78, 102, 204, 0.12);
    background: #ffffff;
  }
}

.color-selector {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.color-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fafbfc;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    transform 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.color-item:hover {
  border-color: #ccd5e3;
  background: #ffffff;
  transform: translateY(-1px);
}

.color-item.active {
  border-color: #4e66cc;
  background: #eef3ff;
  box-shadow: 0 0 0 3px rgba(78, 102, 204, 0.12);
}

.color-swatch {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 999px;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.7);
}

.color-name {
  color: #344054;
  font-size: 13px;
  font-weight: 500;
}

.role-preview {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: 14px;
  background: linear-gradient(180deg, #fbfcff, #f5f8ff);
}

.preview-dot {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  margin-top: 4px;
  border-radius: 999px;
  background: var(--preview-color);
}

.preview-content {
  min-width: 0;
}

.preview-name {
  color: #172033;
  font-size: 14px;
  font-weight: 600;
}

.preview-desc {
  margin-top: 4px;
  color: #667085;
  font-size: 13px;
  line-height: 1.6;
}

.permission-summary {
  color: #667085;
  font-size: 13px;
}

.permission-summary strong {
  color: #172033;
}

.permissions-config {
  display: grid;
  gap: 14px;
}

.permission-group {
  padding: 16px;
  border: 1px solid #edf1f7;
  border-radius: 16px;
  background: #fbfcfe;
}

.group-header {
  margin-bottom: 14px;
}

.group-header__info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.group-checkbox {
  :deep(.el-checkbox__label) {
    color: #172033;
    font-size: 14px;
    font-weight: 600;
  }
}

.group-title {
  font-size: 14px;
  font-weight: 600;
}

.group-count {
  color: #7b8597;
  font-size: 12px;
}

.group-content {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.permission-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid #e8edf5;
  border-radius: 12px;
  background: #ffffff;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.permission-option--active {
  border-color: #c7d4ff;
  background: #f6f8ff;
  box-shadow: inset 0 0 0 1px rgba(78, 102, 204, 0.08);
}

.permission-checkbox {
  margin-right: 0;

  :deep(.el-checkbox__label) {
    color: #172033;
  }
}

.permission-name {
  font-size: 13px;
  font-weight: 500;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.footer-btn {
  min-width: 112px;
  height: 42px;
  border-radius: 12px;
  font-weight: 600;
}

.footer-btn--plain {
  border-color: #d7dce5;
}

.footer-btn--primary {
  border: none;
  background: #4e66cc;
  box-shadow: 0 10px 20px rgba(78, 102, 204, 0.18);
}

.footer-btn--primary:hover,
.footer-btn--primary:focus-visible {
  background: #4259bc;
}

@media (max-width: 768px) {
  .dialog-header,
  .section-header,
  .dialog-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .dialog-content {
    padding: 16px;
  }

  .surface-card {
    padding: 16px;
  }

  .basic-grid,
  .group-content,
  .color-selector {
    grid-template-columns: 1fr;
  }

  .dialog-overview {
    width: 100%;
    justify-content: space-between;
  }

  .overview-divider {
    display: none;
  }

  .footer-btn {
    width: 100%;
  }
}
</style>
