<template>
  <div class="permissions-container">
    <section class="toolbar-section">
      <div class="toolbar-main">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索角色名称或描述"
          class="search-input"
          clearable
          @input="handleSearch"
          @clear="handleSearchImmediately"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <div class="toolbar-stats">
        <div class="stat-pill">
          <span class="stat-label">角色总数</span>
          <span class="stat-value">{{ total }}</span>
        </div>
        <div class="stat-pill">
          <span class="stat-label">权限项</span>
          <span class="stat-value">{{ totalPermissionCount }}</span>
        </div>
        <div class="stat-pill">
          <span class="stat-label">权限分类</span>
          <span class="stat-value">{{ permissionCategoryCount }}</span>
        </div>
      </div>
      <el-button type="primary" class="create-btn" @click="handleOpenDialog">
        <el-icon><Plus /></el-icon>
        创建角色
      </el-button>
    </section>

    <section class="content-grid">
      <div v-loading="loading" class="panel roles-panel">
        <div class="panel-header">
          <div>
            <div class="panel-title">角色列表</div>
            <div class="panel-subtitle">
              当前展示
              {{ roles.length }}
              个角色，系统内置角色不可编辑，自定义角色可直接分配成员和调整权限。
            </div>
          </div>
          <el-tag effect="plain" class="panel-tag">
            {{ searchKeyword ? '筛选结果' : '全部角色' }}
          </el-tag>
        </div>

        <el-empty
          v-if="roles.length === 0 && !loading"
          :image-size="150"
          description="暂无角色数据"
        />

        <div v-else class="role-list">
          <article
            v-for="role in roles"
            :key="role.id"
            class="role-card"
            :style="{ '--role-accent': role.accentColor }"
          >
            <div class="role-card__top">
              <div class="role-card__title">
                <div class="role-name-row">
                  <span class="role-accent-dot" />
                  <h3 class="role-name">{{ role.name }}</h3>
                  <span
                    v-if="role.isSystem"
                    class="role-status-chip role-status-chip--system"
                  >
                    <el-icon><Lock /></el-icon>
                    系统内置
                  </span>
                  <span
                    v-if="role.bypassPermission"
                    class="role-status-chip role-status-chip--all"
                  >
                    全部权限
                  </span>
                </div>
                <p class="role-description">
                  {{ role.resolvedDescription }}
                </p>
              </div>

              <div class="role-card__aside">
                <el-dropdown trigger="click" @command="handleRoleAction">
                  <button class="card-menu" type="button" aria-label="更多操作">
                    <el-icon><MoreFilled /></el-icon>
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item :command="`assign-${role.id}`">
                        <el-icon><UserFilled /></el-icon>
                        分配用户
                      </el-dropdown-item>
                      <el-dropdown-item
                        v-if="role.isEditable"
                        :command="`edit-${role.id}`"
                      >
                        <el-icon><Edit /></el-icon>
                        编辑角色
                      </el-dropdown-item>
                      <el-dropdown-item
                        v-if="role.isEditable"
                        :command="`delete-${role.id}`"
                        class="delete-item"
                      >
                        <el-icon><Delete /></el-icon>
                        删除角色
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>

            <div class="role-meta-grid">
              <div class="meta-card">
                <span class="meta-label">成员数</span>
                <strong class="meta-value">{{ role.userCount }}</strong>
              </div>
              <div class="meta-card">
                <span class="meta-label">权限项</span>
                <strong class="meta-value">
                  {{ role.permissionStatText }}
                </strong>
              </div>
              <div class="meta-card">
                <span class="meta-label">权限分类</span>
                <strong class="meta-value">{{ role.categoryStatText }}</strong>
              </div>
            </div>

            <div class="role-permissions">
              <div class="section-caption">
                {{ role.bypassPermission ? '权限范围' : '已授予权限' }}
              </div>
              <div class="permission-chip-list">
                <span
                  v-for="permission in role.displayPermissions"
                  :key="permission"
                  class="permission-chip"
                >
                  {{ permission }}
                </span>
                <span
                  v-if="role.displayPermissions.length === 0"
                  class="permission-empty"
                >
                  {{ role.scopeSummary }}
                </span>
                <button
                  v-if="
                    !role.bypassPermission &&
                    role.permissionCount > role.displayPermissions.length
                  "
                  type="button"
                  class="permission-chip permission-chip--ghost"
                  @click="showMorePermissions(role)"
                >
                  +{{ role.permissionCount - role.displayPermissions.length }}
                </button>
              </div>
            </div>
          </article>
        </div>

        <div v-if="total > 0" class="pagination-section">
          <el-pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="total"
            layout="total, prev, pager, next"
            @current-change="handlePageChange"
          />
        </div>
      </div>

      <div v-loading="isMatrixLoading" class="panel matrix-panel">
        <div class="panel-header">
          <div>
            <div class="panel-title">权限覆盖矩阵</div>
            <div class="panel-subtitle">
              按权限分类查看当前角色集合的授权覆盖情况。
            </div>
          </div>
          <div class="matrix-note">
            共 {{ matrixRoles.length }} 个角色参与对照
          </div>
        </div>

        <el-empty
          v-if="
            Object.keys(permissionsByCategory).length === 0 && !isMatrixLoading
          "
          description="暂无权限数据"
          :image-size="120"
        />

        <div
          v-for="(permissions, category) in permissionsByCategory"
          :key="category"
          class="matrix-group"
        >
          <div class="matrix-group__header">
            <div>
              <h3 class="group-title">{{ category }}</h3>
              <p class="group-meta">{{ permissions.length }} 项权限</p>
            </div>
          </div>

          <div class="matrix-list">
            <article
              v-for="permission in permissions"
              :key="permission.id"
              class="matrix-row"
            >
              <div class="matrix-row__main">
                <div class="permission-title">{{ permission.displayName }}</div>
              </div>

              <div class="matrix-row__roles">
                <template
                  v-if="getRolesForPermission(permission.id).length > 0"
                >
                  <span
                    v-for="role in getRolesForPermission(permission.id)"
                    :key="role.id"
                    class="matrix-role-chip"
                    :style="{
                      '--role-accent': role.accentColor,
                      '--role-accent-soft': getSoftColor(role.accentColor),
                    }"
                  >
                    {{ role.name }}
                  </span>
                </template>
                <span v-else class="no-roles">暂无角色覆盖</span>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>

    <CreateRoleDialog
      v-model="showCreateDialog"
      :edit-mode="editMode"
      :role-data="editingRole"
      @confirm="handleCreateRole"
    />

    <UserAssignmentModal
      v-model="showUserAssignmentDialog"
      :current-role="currentRole"
      @confirm="handleUserAssignmentConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { ElMessage, ElMessageBox } from 'element-plus'
import CreateRoleDialog from './components/CreateRoleDialog.vue'
import UserAssignmentModal from './components/UserAssignmentModal.vue'
import {
  Plus,
  UserFilled,
  MoreFilled,
  Edit,
  Delete,
  Search,
  Lock,
} from '@element-plus/icons-vue'
import {
  getRoles,
  deleteRole,
  getPermissions,
  assignRoleMembers,
  getRoleMembers,
  type Role as ApiRole,
  type Permission as ApiPermission,
} from '@/api/role'

interface UIRole extends ApiRole {
  tagType: 'danger' | 'primary' | 'success' | 'info'
  userCount: number
  displayPermissions: string[]
  permissionCount: number
  categoryCount: number
  accentColor: string
  resolvedDescription: string
  scopeSummary: string
  permissionStatText: string
  categoryStatText: string
  isEditable: boolean
}

const MATRIX_ROLE_FETCH_LIMIT = 500
const pageSize = ref(3)
const roleToneTypes: Array<'danger' | 'primary' | 'success' | 'info'> = [
  'danger',
  'primary',
  'success',
  'info',
]
const roleAccentPalette = [
  '#4e66cc',
  '#0f766e',
  '#c2410c',
  '#7c3aed',
  '#be123c',
  '#1d4ed8',
]
const SYSTEM_ROLE_VISUALS: Record<
  string,
  { color: string; description: string }
> = {
  管理员: {
    color: '#BE123C',
    description: '内置管理员角色，默认拥有当前组织下全部权限，禁止编辑。',
  },
  普通用户: {
    color: '#475569',
    description: '内置普通用户角色，系统默认不分配任何权限，禁止编辑',
  },
}
const DEFAULT_SYSTEM_ROLE_DESCRIPTION =
  '内置系统角色，用于承载组织基础权限配置。'
const SYSTEM_ROLE_ORDER: Record<string, number> = {
  管理员: 0,
  普通用户: 1,
}

const showCreateDialog = ref(false)
const showUserAssignmentDialog = ref(false)
const currentRole = ref<UIRole | null>(null)
const loading = ref(false)
const matrixRolesLoading = ref(false)
const editMode = ref(false)
const editingRole = ref<UIRole | null>(null)
const roles = ref<UIRole[]>([])
const matrixRoles = ref<UIRole[]>([])
const currentPage = ref(1)
const total = ref(0)
const searchKeyword = ref('')
const permissionsByCategory = ref<Record<string, ApiPermission[]>>({})
const permissionsLoading = ref(false)

const permissionCategoryCount = computed(
  () => Object.keys(permissionsByCategory.value).length,
)
const totalPermissionCount = computed(() =>
  Object.values(permissionsByCategory.value).reduce(
    (sum, permissions) => sum + permissions.length,
    0,
  ),
)
const isMatrixLoading = computed(
  () => permissionsLoading.value || matrixRolesLoading.value,
)

const getRoleTagType = (
  roleId: number,
): 'danger' | 'primary' | 'success' | 'info' =>
  roleToneTypes[roleId % roleToneTypes.length]

const getSystemRoleVisual = (role: ApiRole) => SYSTEM_ROLE_VISUALS[role.name]

const getRoleAccentColor = (role: ApiRole) =>
  getSystemRoleVisual(role)?.color ||
  role.color ||
  roleAccentPalette[role.id % roleAccentPalette.length]

const getRoleDescription = (role: ApiRole) =>
  role.description?.trim() ||
  getSystemRoleVisual(role)?.description ||
  (role.isSystem ? DEFAULT_SYSTEM_ROLE_DESCRIPTION : '未填写角色说明')

const getSoftColor = (color: string) => `${color}1a`

const sortRolesDescending = (roleList: ApiRole[]) =>
  [...roleList].sort((left, right) => {
    const leftSystemOrder = SYSTEM_ROLE_ORDER[left.name]
    const rightSystemOrder = SYSTEM_ROLE_ORDER[right.name]
    const leftHasSystemOrder = leftSystemOrder !== undefined
    const rightHasSystemOrder = rightSystemOrder !== undefined

    if (leftHasSystemOrder || rightHasSystemOrder) {
      if (leftHasSystemOrder && rightHasSystemOrder) {
        return leftSystemOrder - rightSystemOrder
      }
      return leftHasSystemOrder ? -1 : 1
    }

    if (left.isSystem !== right.isSystem) {
      return left.isSystem ? -1 : 1
    }

    if (left.bypassPermission !== right.bypassPermission) {
      return left.bypassPermission ? -1 : 1
    }

    return right.id - left.id
  })

const toUiRole = (role: ApiRole, userCount: number = 0): UIRole => ({
  ...role,
  tagType: getRoleTagType(role.id),
  userCount,
  displayPermissions: role.permissions
    .slice(0, 4)
    .map((permission) => permission.displayName),
  permissionCount: role.permissions.length,
  categoryCount: new Set(
    role.permissions.map((permission) => permission.category),
  ).size,
  accentColor: getRoleAccentColor(role),
  resolvedDescription: getRoleDescription(role),
  scopeSummary: role.bypassPermission
    ? '拥有当前组织下全部权限'
    : role.isSystem
      ? '按系统预设权限规则访问'
      : '未配置显式权限',
  permissionStatText: role.bypassPermission
    ? '全部'
    : `${role.permissions.length}`,
  categoryStatText: role.bypassPermission
    ? '全部'
    : `${new Set(role.permissions.map((permission) => permission.category)).size}`,
  isEditable: !role.isSystem,
})

const loadRoles = async () => {
  try {
    loading.value = true
    const response = await getRoles(
      currentPage.value,
      pageSize.value,
      searchKeyword.value,
    )
    const roleList = sortRolesDescending(response.data.list || [])
    const totalCount = response.data.total || roleList.length

    if (roleList.length === 0 && totalCount > 0 && currentPage.value > 1) {
      currentPage.value -= 1
      await loadRoles()
      return
    }

    const memberCountResults = await Promise.all(
      roleList.map(async (role) => {
        try {
          const membersResponse = await getRoleMembers(role.id, 1, 1)
          if (membersResponse.code === 200 || membersResponse.code === 0) {
            return membersResponse.data.total
          }
        } catch (error) {
          console.error('Failed to get role members count:', error)
        }
        return 0
      }),
    )

    roles.value = roleList.map((role, index) =>
      toUiRole(role, memberCountResults[index]),
    )
    total.value = totalCount
  } catch (error: any) {
    ElMessage.error(error?.message || '加载角色列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

const loadMatrixRoles = async () => {
  try {
    matrixRolesLoading.value = true
    const response = await getRoles(
      1,
      MATRIX_ROLE_FETCH_LIMIT,
      searchKeyword.value,
    )
    matrixRoles.value = sortRolesDescending(response.data.list || []).map(
      (role) => toUiRole(role),
    )
  } catch (error) {
    console.error('加载矩阵角色失败:', error)
  } finally {
    matrixRolesLoading.value = false
  }
}

const loadPermissionsMatrix = async () => {
  try {
    permissionsLoading.value = true
    const response = await getPermissions(1, 200)
    const allPermissions = response.data.list || []
    const grouped: Record<string, ApiPermission[]> = {}

    allPermissions.forEach((permission) => {
      if (!grouped[permission.category]) {
        grouped[permission.category] = []
      }
      grouped[permission.category].push(permission)
    })

    permissionsByCategory.value = grouped
  } catch (error) {
    console.error('加载权限矩阵失败:', error)
  } finally {
    permissionsLoading.value = false
  }
}

const loadRoleViews = async () => {
  await Promise.all([loadRoles(), loadMatrixRoles()])
}

const openEditRole = (role: UIRole) => {
  if (role.isSystem) {
    ElMessage.info('系统内置角色不支持编辑')
    return
  }
  editingRole.value = role
  editMode.value = true
  showCreateDialog.value = true
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  loadRoles()
}

const debouncedSearch = useDebounceFn(() => {
  currentPage.value = 1
  loadRoleViews()
}, 220)

const handleSearch = () => {
  debouncedSearch()
}

const handleSearchImmediately = () => {
  currentPage.value = 1
  loadRoleViews()
}

const getRolesForPermission = (permissionId: number): UIRole[] =>
  matrixRoles.value.filter(
    (role) =>
      role.bypassPermission ||
      role.permissions.some((permission) => permission.id === permissionId),
  )

const showMorePermissions = (role: UIRole) => {
  const allPermissions = role.permissions
    .map((permission) => permission.displayName)
    .join('、')
  ElMessage.info(`${role.name}的全部权限：${allPermissions}`)
}

const handleRoleAction = async (command: string) => {
  const [action, roleIdStr] = command.split('-')
  const roleId = parseInt(roleIdStr, 10)
  const role = roles.value.find((item) => item.id === roleId)

  if (!role) {
    return
  }

  switch (action) {
    case 'assign':
      handleAssignUsers(role)
      break
    case 'edit':
      openEditRole(role)
      break
    case 'delete':
      if (role.isSystem) {
        ElMessage.warning('系统内置角色不支持删除')
        return
      }
      try {
        await ElMessageBox.confirm(
          `确定要删除角色“${role.name}”吗？此操作不可恢复。`,
          '确认删除',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning',
          },
        )

        await deleteRole(roleId)
        ElMessage.success('删除成功')
        await loadRoleViews()
      } catch (error: any) {
        if (error !== 'cancel') {
          ElMessage.error(error?.message || '删除失败')
          console.error(error)
        }
      }
      break
  }
}

const handleOpenDialog = () => {
  editMode.value = false
  editingRole.value = null
  showCreateDialog.value = true
}

const handleCreateRole = async () => {
  await loadRoleViews()
}

watch(showCreateDialog, (visible) => {
  if (!visible) {
    editMode.value = false
    editingRole.value = null
  }
})

const handleAssignUsers = (role: UIRole) => {
  currentRole.value = role
  showUserAssignmentDialog.value = true
}

const handleUserAssignmentConfirm = async (userIds: number[]) => {
  if (!currentRole.value) {
    return
  }

  try {
    const response = await assignRoleMembers(currentRole.value.id, { userIds })
    if (response.code === 200 || response.code === 201 || response.code === 0) {
      ElMessage.success(
        `已为 ${currentRole.value.name} 分配 ${userIds.length} 个用户`,
      )
      await loadRoleViews()
      return
    }

    ElMessage.error(response.msg || '分配用户失败')
  } catch (error: any) {
    ElMessage.error(error?.message || '分配用户失败')
    console.error(error)
  }
}

onMounted(() => {
  Promise.all([loadRoleViews(), loadPermissionsMatrix()])
})
</script>

<style scoped lang="scss">
.permissions-container {
  height: 100%;
  padding: 24px;
  background: #f6f8fc;
  overflow-y: scroll;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 18px;
}

.create-btn {
  height: 40px;
  padding: 0 18px;
  border: none;
  border-radius: 10px;
  background: #409eff;
  box-shadow: 0 8px 18px rgba(78, 102, 204, 0.16);
  font-weight: 600;

  &:hover,
  &:focus-visible {
    background: #4259bc;
  }
}

.toolbar-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  padding: 18px 20px;
  border: 1px solid #e6ebf5;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
}

.toolbar-main {
  flex: 1;
}

.search-input {
  max-width: 380px;

  :deep(.el-input__wrapper) {
    min-height: 42px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    box-shadow: none;
    background: #f8fafc;
  }

  :deep(.el-input__wrapper:hover) {
    border-color: #cbd5e1;
    background: #ffffff;
  }

  :deep(.el-input__wrapper.is-focus) {
    border-color: #4e66cc;
    background: #ffffff;
    box-shadow: 0 0 0 3px rgba(78, 102, 204, 0.12);
  }
}

.toolbar-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.stat-pill {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 999px;
  background: #f8fafc;
  color: #64748b;
}

.stat-label {
  font-size: 13px;
}

.stat-value {
  color: #172033;
  font-size: 16px;
  font-weight: 700;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(360px, 0.95fr) minmax(420px, 1.25fr);
  gap: 18px;
  align-items: start;
}

.panel {
  border: 1px solid #e6ebf5;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px 18px;
  border-bottom: 1px solid #edf1f7;
}

.panel-title {
  color: #172033;
  font-size: 18px;
  font-weight: 600;
}

.panel-subtitle {
  margin-top: 6px;
  color: #7b8597;
  font-size: 13px;
  line-height: 1.6;
}

.panel-tag,
.matrix-note {
  color: #7280a7;
  font-size: 12px;
}

.roles-panel {
  min-height: 640px;
}

.role-list {
  display: grid;
  gap: 14px;
  padding: 18px 18px 0;
}

.role-card {
  position: relative;
  padding: 18px;
  border: 1px solid #eef2f7;
  border-radius: 16px;
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.98),
      rgba(248, 250, 252, 0.98)
    ),
    linear-gradient(135deg, var(--role-accent), transparent 50%);
  transition:
    border-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.role-card::before {
  content: '';
  position: absolute;
  top: 16px;
  bottom: 16px;
  left: 0;
  width: 3px;
  border-radius: 999px;
  background: var(--role-accent);
}

.role-card:hover {
  border-color: rgba(78, 102, 204, 0.18);
  transform: translateY(-1px);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.06);
}

.role-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.role-card__title {
  min-width: 0;
}

.role-name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.role-accent-dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--role-accent);
}

.role-name {
  margin: 0;
  color: #172033;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
}

.role-description {
  margin: 10px 0 0;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.7;
}

.role-status-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.role-status-chip--system {
  background: rgba(15, 23, 42, 0.06);
  color: #475569;
}

.role-status-chip--all {
  background: rgba(64, 158, 255, 0.12);
  color: #1d4ed8;
}

.card-menu {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #ffffff;
  color: #667085;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.card-menu:hover {
  border-color: #d8deea;
  background: #f8fafc;
  color: #172033;
}

.role-card__aside {
  display: flex;
  min-height: 34px;
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
}

.role-meta-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.meta-card {
  padding: 12px 12px 10px;
  border-radius: 12px;
  background: #f8fafc;
}

.meta-label {
  display: block;
  color: #8a94a6;
  font-size: 12px;
}

.meta-value {
  display: block;
  margin-top: 6px;
  color: #172033;
  font-size: 18px;
  font-weight: 700;
}

.role-permissions {
  margin-top: 16px;
}

.section-caption {
  margin-bottom: 10px;
  color: #7b8597;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.permission-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.permission-chip {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border: none;
  border-radius: 999px;
  background: #eef3ff;
  color: #354669;
  font-size: 12px;
  line-height: 1;
}

.permission-chip--ghost {
  background: #f3f4f6;
  color: #667085;
  cursor: pointer;
}

.permission-empty {
  color: #8a94a6;
  font-size: 12px;
  line-height: 1.6;
}



.pagination-section {
  display: flex;
  justify-content: center;
  padding: 18px 18px 22px;
}

.matrix-panel {
  padding-bottom: 10px;
}

.matrix-group {
  padding: 0 18px 18px;
}

.matrix-group__header {
  padding: 18px 6px 12px;
}

.group-title {
  margin: 0;
  color: #172033;
  font-size: 16px;
  font-weight: 600;
}

.group-meta {
  margin: 6px 0 0;
  color: #8a94a6;
  font-size: 12px;
}

.matrix-list {
  display: grid;
  gap: 10px;
}

.matrix-row {
  display: grid;
  grid-template-columns: minmax(160px, 220px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  padding: 16px;
  border: 1px solid #eef2f7;
  border-radius: 14px;
  background: #fbfcfe;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.matrix-row:hover {
  border-color: #dde5f2;
  background: #ffffff;
}

.matrix-row__main {
  min-width: 0;
}

.permission-title {
  color: #172033;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
}

.matrix-row__roles {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  min-height: 34px;
}

.matrix-role-chip {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid var(--role-accent);
  border-radius: 999px;
  background: var(--role-accent-soft);
  color: var(--role-accent);
  font-size: 12px;
  font-weight: 600;
}

.no-roles {
  color: #98a2b3;
  font-size: 13px;
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
}

:deep(.el-dropdown-menu__item.delete-item) {
  color: #dc2626;
}

:deep(.el-dropdown-menu__item.delete-item:not(.is-disabled):hover) {
  background: #fff1f2;
  color: #b91c1c;
}

@media (max-width: 1180px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .page-header,
  .toolbar-section,
  .panel-header {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input {
    max-width: none;
  }
}

@media (max-width: 768px) {
  .permissions-container {
    padding: 16px;
  }

  .toolbar-section,
  .panel-header {
    padding-right: 16px;
    padding-left: 16px;
  }

  .role-list,
  .matrix-group {
    padding-right: 14px;
    padding-left: 14px;
  }

  .role-meta-grid {
    grid-template-columns: 1fr;
  }

  .matrix-row {
    grid-template-columns: 1fr;
  }

  .create-btn {
    width: 100%;
  }
}
</style>
