<template>
  <el-dialog
    v-model="visible"
    width="680px"
    :before-close="handleClose"
    class="user-assignment-modal"
  >
  <template #header>
    <el-icon class="header-icon">
      <UserFilled />
    </el-icon>
      <strong style="font-size: 20px">分配用户到角色: {{ currentRole?.name || '' }}</strong>
      <div style="color: #727272; margin-left: 20px;">
        选择要分配到该角色的用户成员
      </div>
    </template>
    <div class="modal-content" v-loading="loading">
      <div class="search-section">
        <el-input
          v-model="searchQuery"
          placeholder="搜索用户姓名、邮箱或手机号..."
          :prefix-icon="Search"
          size="large"
          clearable
          class="search-input"
        />
      </div>
      <div class="status-section">
        <span class="status-text">
          已分配:&nbsp; <span class="count">{{ selectedUsers.length }}</span> 人 &nbsp; 总人数:&nbsp; <span class="total-count">{{ allUsers.length }}</span> 人
        </span>
      </div>

      <div class="user-list">
        <el-empty v-if="filteredUsers.length === 0 && !loading" description="暂无用户数据" :image-size="100" />
        <div
          v-for="user in filteredUsers"
          :key="user.id"
          class="user-item"
          :class="{ 'selected': selectedUsers.includes(user.id) }"
          @click="toggleUserSelection(user.id)"
        >
          <div class="checkbox-section">
            <el-checkbox
              :model-value="selectedUsers.includes(user.id)"
              @change="toggleUserSelection(user.id)"
            />
          </div>

          <div class="avatar-section">
            <el-avatar :size="42" :src="user.avatar">
              {{ user.name.charAt(0) }}
            </el-avatar>
          </div>

          <div class="user-info-left">
            <div class="user-name">{{ user.name }}</div>
            <div class="user-email">{{ user.email }}</div>
          </div>

          <div class="user-info-right">
            <div class="user-phone">{{ user.phone || '-' }}</div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="modal-footer">
        <el-button @click="handleClose" size="large">
          取消
        </el-button>
        <el-button
          type="primary"
          @click="handleConfirm"
          size="large"
          class="confirm-btn"
        >
          完成
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { UserFilled, Search } from '@element-plus/icons-vue'
import { getMembers } from '@/api/member'
import { getRoleMembers } from '@/api/role'

interface User {
  id: number
  name: string
  email: string
  phone: string
  avatar?: string
}

interface Role {
  id: number
  name: string
}

interface Props {
  modelValue: boolean
  currentRole?: Role | null
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', userIds: number[]): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  currentRole: null
})

const emit = defineEmits<Emits>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const searchQuery = ref('')
const selectedUsers = ref<number[]>([])
const allUsers = ref<User[]>([])
const loading = ref(false)

const loadAllMembers = async () => {
  try {
    const response = await getMembers(1, 100)
    if (response.code === 200 || response.code === 0) {
      allUsers.value = response.data.list.map(member => ({
        id: member.userId,
        name: member.displayName,
        email: member.email,
        phone: member.phone,
        avatar: ''
      }))
    }
  } catch (error) {
    console.error('Failed to load members:', error)
  }
}

const loadAssignedMembers = async (roleId: number) => {
  try {
    const response = await getRoleMembers(roleId, 1, 100)
    if (response.code === 200 || response.code === 0) {
      selectedUsers.value = response.data.list.map(member => member.userId)
    }
  } catch (error) {
    console.error('Failed to load role members:', error)
    selectedUsers.value = []
  }
}

const filteredUsers = computed(() => {
  if (!searchQuery.value.trim()) {
    return allUsers.value
  }

  const query = searchQuery.value.toLowerCase()
  return allUsers.value.filter(user =>
    user.name.toLowerCase().includes(query) ||
    user.email.toLowerCase().includes(query) ||
    user.phone.toLowerCase().includes(query)
  )
})
const toggleUserSelection = (userId: number) => {
  const index = selectedUsers.value.indexOf(userId)
  if (index > -1) {
    selectedUsers.value.splice(index, 1)
  } else {
    selectedUsers.value.push(userId)
  }
}

const handleClose = () => {
  visible.value = false
}

const handleConfirm = () => {
  emit('confirm', selectedUsers.value)
  handleClose()
}

watch(() => props.modelValue, async (newVal) => {
  if (newVal) {
    searchQuery.value = ''
    loading.value = true
    try {
      await loadAllMembers()
      if (props.currentRole?.id) {
        await loadAssignedMembers(props.currentRole.id)
      } else {
        selectedUsers.value = []
      }
    } finally {
      loading.value = false
    }
  }
})
</script>

<style scoped lang="scss">
.user-assignment-modal {
  .header-icon {
    margin: 20px 0 10px 20px;
    font-size: 20px;
  }
  :deep(.el-dialog) {
    border-radius: 12px;
    overflow: hidden;
  }

  :deep(.el-dialog__header) {
    padding: 20px 24px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  :deep(.el-dialog__title) {
    font-size: 16px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  :deep(.el-dialog__body) {
    padding: 0;
  }

  :deep(.el-dialog__footer) {
    padding: 0;
  }
}

.modal-content {
  padding: 14px 24px;
  max-height: 500px;
  overflow-y: auto;
}

.search-section {
  margin-bottom: 16px;

  .search-input {
    :deep(.el-input__wrapper) {
      border-radius: 8px;
      // padding: 12px 16px;
    }

    :deep(.el-input__inner) {
      font-size: 16px;
    }
  }
}

.status-section {
  margin-bottom: 20px;

  .status-text {
    font-size: 16px;
    color: var(--el-text-color-regular);

    .count {
      font-weight: 500;
      color: var(--el-color-primary);
    }

    .total-count {
      font-weight: 500;
      color: var(--el-text-color-primary);
    }
  }
}

.user-list {
  .user-item {
    display: flex;
    align-items: center;
    padding: 16px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid var(--el-border-color-lighter);
    margin-bottom: 8px;

    &:hover {
      background-color: var(--el-fill-color-light);
    }

    &.selected {
      background-color: var(--el-color-primary-light-9);
      border-color: var(--el-color-primary-light-6);
    }

    .checkbox-section {
      margin-right: 12px;
      display: flex;
      align-items: center;
    }

    .avatar-section {
      margin-right: 12px;
    }

    .user-info-left {
      flex: 1;
      margin-right: 12px;

      .user-name {
        font-size: 16px;
        font-weight: 500;
        color: var(--el-text-color-primary);
        margin-bottom: 4px;
      }

      .user-email {
        font-size: 14px;
        color: var(--el-text-color-regular);
      }
    }

    .user-info-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      min-width: 120px;

      .user-phone {
        font-size: 14px;
        color: var(--el-text-color-regular);
      }
    }
  }
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid var(--el-border-color-lighter);

  .confirm-btn {
    min-width: 80px;
  }
}

// Dark mode support
[data-theme='dark'] {
  .user-item {
    &:hover {
      background-color: var(--el-fill-color-dark);
    }

    &.selected {
      background-color: var(--el-color-primary-light-8);
    }
  }
}

// 暗黑模式
html.dark {
  .user-assignment-modal {
    .modal-content {
      .user-list .user-item {
        background: var(--el-bg-color) !important;
        border-color: var(--el-border-color) !important;

        &:hover {
          background: var(--el-fill-color-dark) !important;
        }

        &.selected {
          background-color: #1e40af !important; // 蓝色背景，选中的用户会显示白色文字
          border-color: #3b82f6 !important;

          // 确保选中的用户文字是白色的
          .user-info-left,
          .user-info-right {
            .user-name,
            .user-email,
            .user-department,
            .user-position {
              color: #ffffff !important;
            }
          }
        }
      }
    }
  }
}
</style>
