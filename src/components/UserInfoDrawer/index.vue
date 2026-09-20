<template>
  <el-drawer
    v-model="visible"
    class="user-info-drawer-panel"
    :size="600"
    :before-close="handleClose"
  >
    <template #header>
      <div class="drawer-title-block">
        <strong class="drawer-title">{{ drawerTitle }}</strong>
        <div class="drawer-subtitle">{{ drawerSubtitle }}</div>
      </div>
    </template>
    <div class="user-info-drawer">
      <!-- 系统管理 -->
      <div v-if="initialSection === 'system'" class="system-panel">
        <section class="system-hero">
          <div class="system-hero-logo">
            <img :src="brandLogoUrl" alt="系统 Logo" />
          </div>
          <div class="system-hero-main">
            <div class="system-eyebrow">当前系统品牌</div>
            <div class="system-title">
              {{ currentOrganization?.name || '组织品牌' }}
            </div>
            <div class="system-meta">
              <el-tag type="primary" effect="light" size="small">
                {{ getOrgType(currentOrganization?.parentOrganizationId) }}
              </el-tag>
              <el-tag
                :type="canManageBrand ? 'success' : 'warning'"
                effect="light"
                size="small"
              >
                {{ canManageBrand ? '可编辑' : '只读' }}
              </el-tag>
            </div>
          </div>
        </section>

        <div class="system-stats">
          <div class="system-stat">
            <div class="stat-icon brand">
              <el-icon><Picture /></el-icon>
            </div>
            <div>
              <div class="stat-value">2MB</div>
              <div class="stat-label">Logo 上限</div>
            </div>
          </div>
          <div class="system-stat">
            <div class="stat-icon org">
              <el-icon><OfficeBuilding /></el-icon>
            </div>
            <div>
              <div class="stat-value">{{ allOrganizations.length || '-' }}</div>
              <div class="stat-label">关联组织</div>
            </div>
          </div>
          <div class="system-stat">
            <div class="stat-icon access">
              <el-icon><Lock /></el-icon>
            </div>
            <div>
              <div class="stat-value">
                {{ canManageBrand ? '管理' : '查看' }}
              </div>
              <div class="stat-label">当前权限</div>
            </div>
          </div>
        </div>

        <div class="info-section">
          <div class="section-header">
            <div class="header-left">
              <el-icon :size="20"><Setting /></el-icon>
              <span class="section-title">品牌设置</span>
            </div>
          </div>

          <div class="brand-card brand-card-elevated">
            <div class="brand-preview">
              <img :src="brandLogoUrl" alt="系统 Logo" />
            </div>
            <div class="brand-content">
              <div class="brand-title">导航 Logo</div>
              <div class="brand-desc">
                支持 png、jpg、jpeg、svg、webp，文件不超过 2MB。
              </div>
              <div v-if="canManageBrand" class="brand-actions">
                <el-upload
                  :show-file-list="false"
                  :auto-upload="false"
                  accept=".png,.jpg,.jpeg,.svg,.webp"
                  :on-change="handleLogoFileChange"
                >
                  <el-button
                    type="primary"
                    :icon="UploadFilled"
                    :loading="logoUploading"
                  >
                    上传 Logo
                  </el-button>
                </el-upload>
                <el-button
                  :icon="RefreshLeft"
                  :loading="logoResetting"
                  @click="handleResetLogo"
                >
                  恢复默认
                </el-button>
              </div>
              <el-alert
                v-else
                title="当前账号无权修改系统 Logo"
                type="warning"
                :closable="false"
                show-icon
              />
            </div>
          </div>
        </div>

        <div class="info-section">
          <div class="section-header">
            <div class="header-left">
              <el-icon :size="20"><OfficeBuilding /></el-icon>
              <span class="section-title">组织信息</span>
            </div>
          </div>

          <div class="system-details">
            <div class="system-detail-item">
              <span class="detail-label">组织名称</span>
              <span class="detail-value">
                {{ currentOrganization?.name || '-' }}
              </span>
            </div>
            <div class="system-detail-item">
              <span class="detail-label">组织类型</span>
              <span class="detail-value">
                {{ getOrgType(currentOrganization?.parentOrganizationId) }}
              </span>
            </div>
            <div class="system-detail-item">
              <span class="detail-label">联系人</span>
              <span class="detail-value">
                {{ currentOrganization?.contactPerson || '-' }}
              </span>
            </div>
            <div class="system-detail-item">
              <span class="detail-label">联系电话</span>
              <span class="detail-value">
                {{ currentOrganization?.contactPhone || '-' }}
              </span>
            </div>
            <div class="system-detail-item is-wide">
              <span class="detail-label">组织地址</span>
              <span class="detail-value">
                {{ currentOrganization?.address || '-' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <template v-else>
        <section class="profile-hero">
          <el-avatar :size="52" class="profile-avatar">
            {{ userInitial }}
          </el-avatar>
          <div class="profile-main">
            <div class="profile-name">{{ displayName }}</div>
            <div class="profile-email">
              {{ userInfo?.email || '未设置邮箱' }}
            </div>
            <div class="profile-tags">
              <el-tag type="success" size="small" effect="light">
                账号正常
              </el-tag>
              <el-tag
                v-if="currentRoleName"
                type="info"
                size="small"
                effect="light"
              >
                {{ currentRoleName }}
              </el-tag>
            </div>
          </div>
          <el-button
            v-if="!isEditing"
            type="primary"
            plain
            :icon="Edit"
            @click="handleEdit"
          >
            编辑资料
          </el-button>
        </section>

        <div v-if="!isEditing" class="info-section">
          <div class="section-header">
            <div class="header-left">
              <el-icon :size="20"><User /></el-icon>
              <span class="section-title">个人资料</span>
            </div>
          </div>

          <div class="profile-details">
            <div class="detail-item">
              <span class="label">姓名</span>
              <span class="value">{{ userInfo?.username || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="label">邮箱</span>
              <span class="value">{{ userInfo?.email || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="label">当前组织</span>
              <span class="value">{{ currentOrganization?.name || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="label">组织身份</span>
              <span class="value">{{ currentRoleName || '-' }}</span>
            </div>
          </div>
        </div>

        <div v-else class="info-section">
          <div class="section-header">
            <div class="header-left">
              <el-icon :size="20"><Edit /></el-icon>
              <span class="section-title">编辑资料</span>
            </div>
          </div>

          <div class="edit-panel">
            <el-form
              ref="editFormRef"
              :model="editForm"
              :rules="editRules"
              label-position="top"
            >
              <el-form-item label="姓名" prop="username" required>
                <el-input
                  v-model="editForm.username"
                  placeholder="请输入姓名"
                />
              </el-form-item>

              <el-form-item label="职位">
                <el-input
                  v-model="editForm.position"
                  placeholder="例如：项目经理"
                />
              </el-form-item>

              <el-form-item label="部门">
                <el-input
                  v-model="editForm.department"
                  placeholder="例如：工程部"
                />
              </el-form-item>

              <el-form-item label="邮箱" prop="email">
                <el-input
                  v-model="editForm.email"
                  placeholder="例如：example@email.com"
                />
              </el-form-item>
            </el-form>

            <div class="edit-actions">
              <el-button size="large" @click="handleCancelEdit">
                <el-icon><Close /></el-icon>
                取消
              </el-button>
              <el-button
                type="primary"
                size="large"
                :loading="saving"
                @click="handleSave"
              >
                <el-icon><DocumentCopy /></el-icon>
                保存
              </el-button>
            </div>
          </div>
        </div>

        <div class="info-section">
          <div class="section-header">
            <div class="header-left">
              <el-icon :size="20"><OfficeBuilding /></el-icon>
              <span class="section-title">当前组织</span>
            </div>
          </div>

          <div v-if="currentOrganization" class="current-organization">
            <div class="org-main">
              <el-avatar :size="48" class="org-avatar">
                {{ currentOrganization.name?.charAt(0) || 'O' }}
              </el-avatar>
              <div class="org-info">
                <div class="org-name-row">
                  <span class="org-name">{{ currentOrganization.name }}</span>
                  <el-tag size="small" type="warning">
                    {{ getOrgType(currentOrganization.parentOrganizationId) }}
                  </el-tag>
                </div>
                <div class="org-meta">
                  {{ currentOrganization.contactPerson || '暂无联系人' }}
                  <span v-if="currentOrganization.contactPhone">
                    · {{ currentOrganization.contactPhone }}
                  </span>
                </div>
              </div>
            </div>

            <div v-if="currentOrganization.address" class="org-address">
              <el-icon><Location /></el-icon>
              <span>{{ currentOrganization.address }}</span>
            </div>
          </div>

          <div v-else class="empty-state">
            <el-empty description="暂无组织信息" :image-size="80" />
          </div>
        </div>

        <div class="info-section">
          <div class="section-header">
            <div class="header-left">
              <el-icon :size="20"><Grid /></el-icon>
              <span class="section-title">我的组织</span>
            </div>
          </div>

          <div v-if="allOrganizations.length > 0" class="organizations-list">
            <div
              v-for="item in allOrganizations"
              :key="item.id"
              class="organization-row"
              :class="{
                'is-current': item.organization.id === currentOrganization?.id,
              }"
            >
              <el-avatar :size="36" class="org-avatar-small">
                {{ item.organization.name?.charAt(0) || 'O' }}
              </el-avatar>
              <div class="org-content">
                <div class="org-name-row">
                  <span class="org-name">{{ item.organization.name }}</span>
                  <el-tag
                    v-if="item.organization.id === currentOrganization?.id"
                    size="small"
                    type="primary"
                  >
                    当前
                  </el-tag>
                </div>
                <div class="org-meta-row">
                  <span class="org-role">
                    {{ item.displayName || '管理员' }}
                  </span>
                  <span class="org-separator">·</span>
                  <span class="org-type">
                    {{ getOrgType(item.organization.parentOrganizationId) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="empty-state">
            <el-empty description="暂无组织信息" :image-size="80" />
          </div>
        </div>

        <div class="info-section">
          <div class="section-header">
            <div class="header-left">
              <el-icon :size="20"><Lock /></el-icon>
              <span class="section-title">权限概览</span>
            </div>
          </div>

          <div v-if="permissions.length > 0" class="permissions-list">
            <el-tag
              v-for="permission in visiblePermissions"
              :key="permission.id"
              type="success"
              effect="plain"
            >
              {{ permission.displayName }}
            </el-tag>
            <el-tag
              v-if="hiddenPermissionCount > 0"
              class="permission-more-tag"
              type="info"
              effect="plain"
              @click="permissionsExpanded = true"
            >
              +{{ hiddenPermissionCount }}
            </el-tag>
          </div>

          <div v-else class="empty-state">
            <el-empty description="暂无权限信息" :image-size="80" />
          </div>
        </div>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormRules, UploadFile } from 'element-plus'
import {
  User,
  Edit,
  OfficeBuilding,
  Grid,
  Lock,
  Location,
  Close,
  DocumentCopy,
  Setting,
  Picture,
  RefreshLeft,
  UploadFilled,
} from '@element-plus/icons-vue'
import {
  getCurrentUser,
  updateCurrentUser,
  getCurrentOrganization,
  getUserOrganizations,
  getUserPermissions,
  type UserInfo,
  type Organization,
  type OrganizationMember,
  type Permission,
} from '@/api/user'
import {
  resetOrganizationLogo,
  uploadOrganizationLogo,
} from '@/api/organization'
import { setOrganizationId } from '@/utils/auth'
import { useBrandStoreHook } from '@/store/modules/brand'
import { useOrganizationStoreHook } from '@/store/modules/organization'

interface Props {
  modelValue: boolean
  initialSection?: 'profile' | 'system'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})
const initialSection = computed(() => props.initialSection || 'profile')
const drawerTitle = computed(() =>
  initialSection.value === 'system' ? '系统管理' : '我的信息',
)
const drawerSubtitle = computed(() =>
  initialSection.value === 'system'
    ? '管理当前组织的品牌展示'
    : '查看和编辑您的个人资料、组织信息和权限',
)
const brandStore = useBrandStoreHook()
const organizationStore = useOrganizationStoreHook()
const brandLogoUrl = computed(() => brandStore.logoUrl)
const canManageBrand = computed(() => organizationStore.canManageOrganization)

// 用户信息
const userInfo = ref<UserInfo | null>(null)
const currentOrganization = ref<Organization | null>(null)
const allOrganizations = ref<OrganizationMember[]>([])
const permissions = ref<Permission[]>([])
const permissionsExpanded = ref(false)

// 编辑相关
const isEditing = ref(false)
const editFormRef = ref()
const saving = ref(false)
const logoUploading = ref(false)
const logoResetting = ref(false)
const editForm = ref({
  username: '',
  position: '',
  department: '',
  email: '',
})

const editRules: FormRules = {
  username: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  email: [{ type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }],
}

const displayName = computed(() => userInfo.value?.username || '未命名用户')

const currentRoleName = computed(() => {
  const currentMember = allOrganizations.value.find(
    (item) => item.organization.id === currentOrganization.value?.id,
  )
  return (
    currentMember?.displayName || allOrganizations.value[0]?.displayName || ''
  )
})

const visiblePermissions = computed(() =>
  permissionsExpanded.value ? permissions.value : permissions.value.slice(0, 8),
)
const hiddenPermissionCount = computed(() =>
  Math.max(permissions.value.length - visiblePermissions.value.length, 0),
)

// 获取用户名首字母
const userInitial = computed(() => {
  if (editForm.value?.username) {
    return editForm.value.username.charAt(0).toUpperCase()
  }
  if (userInfo.value?.username) {
    return userInfo.value.username.charAt(0).toUpperCase()
  }
  return 'U'
})

// 获取组织类型
const getOrgType = (parentId?: number) => {
  return parentId ? '分公司' : '总公司'
}

// 加载所有数据
const loadData = async () => {
  try {
    // 先加载用户信息
    const userRes = await getCurrentUser()

    if (userRes?.data) {
      userInfo.value = userRes.data
    }

    // 并行加载其他数据
    const [orgRes, orgsRes, permsRes] = await Promise.all([
      getCurrentOrganization().catch((error) => {
        console.error('获取当前组织失败:', error)
        return null
      }),
      getUserOrganizations(1, 100).catch((error) => {
        console.error('获取组织列表失败:', error)
        return null
      }),
      getUserPermissions().catch((error) => {
        console.error('获取权限列表失败:', error)
        return null
      }),
    ])

    if (orgRes?.data) {
      currentOrganization.value = orgRes.data
      // 设置当前组织ID到全局状态
      if (orgRes.data.id) {
        setOrganizationId(orgRes.data.id)
      }
    }

    if (orgsRes?.data?.list && orgsRes.data.list.length > 0) {
      allOrganizations.value = orgsRes.data.list
      // 如果没有当前组织，则使用第一个组织
      if (
        !currentOrganization.value &&
        orgsRes.data.list[0]?.organization?.id
      ) {
        setOrganizationId(orgsRes.data.list[0].organization.id)
      }
    }

    if (permsRes?.data) {
      permissions.value = permsRes.data
    }
  } catch (error) {
    console.error('加载用户信息失败:', error)
    ElMessage.error('加载用户信息失败')
  }
}

// 监听抽屉打开，加载数据
watch(visible, (newVal) => {
  if (newVal) {
    permissionsExpanded.value = false
    loadData()
  }
})

// 处理关闭
const handleClose = () => {
  visible.value = false
  isEditing.value = false
  permissionsExpanded.value = false
}

// 处理编辑
const handleEdit = () => {
  editForm.value = {
    username: userInfo.value?.username || '',
    position: '',
    department: '',
    email: userInfo.value?.email || '',
  }
  isEditing.value = true
}

// 处理取消编辑
const handleCancelEdit = () => {
  isEditing.value = false
  editFormRef.value?.resetFields()
}

// 保存编辑
const handleSave = async () => {
  try {
    await editFormRef.value?.validate()

    saving.value = true
    const res = await updateCurrentUser({
      username: editForm.value.username,
      email: editForm.value.email || undefined,
    })

    if (res?.data) {
      userInfo.value = res.data
      ElMessage.success('保存成功')
      isEditing.value = false
      // 重新加载数据
      await loadData()
    }
  } catch (error: any) {
    console.error('保存失败:', error)
    if (error?.response?.status === 409) {
      ElMessage.error('邮箱已被使用，请更换其他邮箱')
    } else if (error?.response?.data?.msg) {
      ElMessage.error(error.response.data.msg)
    } else {
      ElMessage.error('保存失败')
    }
  } finally {
    saving.value = false
  }
}

const syncBrandOrganization = async (logoUrl?: string) => {
  brandStore.resolveLogoUrl(logoUrl)
  await organizationStore.refreshOrganizations().catch(() => undefined)
  if (currentOrganization.value?.id) {
    currentOrganization.value.logoUrl = logoUrl
  }
}

const handleLogoFileChange = async (uploadFile: UploadFile) => {
  const file = uploadFile.raw
  if (!file || !currentOrganization.value?.id) return

  const allowedTypes = [
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'image/webp',
  ]
  const allowedExt = /\.(png|jpe?g|svg|webp)$/i.test(file.name)
  if (!allowedTypes.includes(file.type) && !allowedExt) {
    ElMessage.error('logo 仅支持 png、jpg、jpeg、svg、webp')
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.error('logo 文件不能超过 2MB')
    return
  }

  try {
    logoUploading.value = true
    const res = await uploadOrganizationLogo(currentOrganization.value.id, file)
    await syncBrandOrganization(res.data.logoUrl)
    ElMessage.success('Logo 已更新')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.msg || '上传 Logo 失败')
  } finally {
    logoUploading.value = false
  }
}

const handleResetLogo = async () => {
  if (!currentOrganization.value?.id) return

  try {
    logoResetting.value = true
    const res = await resetOrganizationLogo(currentOrganization.value.id)
    await syncBrandOrganization(res.data.logoUrl)
    ElMessage.success('已恢复默认 Logo')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.msg || '恢复默认 Logo 失败')
  } finally {
    logoResetting.value = false
  }
}
</script>

<style lang="scss">
.user-info-drawer-panel .el-drawer__header {
  margin-bottom: 0 !important;
}

.user-info-drawer-panel .drawer-title-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-info-drawer-panel .drawer-title {
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.35;
}

.user-info-drawer-panel .drawer-subtitle {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.4;
}
</style>

<style lang="scss" scoped>
.user-info-drawer {
  padding: 0 20px 24px;

  .system-panel {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  .system-hero {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 20px;
    border: 1px solid var(--el-color-primary-light-5);
    border-radius: 8px;
    background:
      linear-gradient(135deg, rgba(37, 99, 235, 0.1), rgba(15, 118, 110, 0.1)),
      var(--el-bg-color);
  }

  .system-hero-logo {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 112px;
    height: 72px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);

    img {
      max-width: 84px;
      max-height: 44px;
      object-fit: contain;
    }
  }

  .system-hero-main {
    flex: 1;
    min-width: 0;
  }

  .system-eyebrow {
    margin-bottom: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
  }

  .system-title {
    overflow: hidden;
    color: var(--el-text-color-primary);
    font-size: 15px;
    font-weight: 600;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .system-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .system-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .system-stat {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding: 14px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-bg-color);
  }

  .stat-icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    font-size: 15px;

    &.brand {
      color: #1d4ed8;
      background: #dbeafe;
    }

    &.org {
      color: #0f766e;
      background: #ccfbf1;
    }

    &.access {
      color: #7c3aed;
      background: #ede9fe;
    }
  }

  .stat-value {
    overflow: hidden;
    color: var(--el-text-color-primary);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stat-label {
    margin-top: 2px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .profile-hero {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px;
    margin-bottom: 24px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: linear-gradient(
      135deg,
      var(--el-color-primary-light-9),
      var(--el-bg-color)
    );

    .profile-avatar {
      flex-shrink: 0;
      color: #fff;
      font-size: 20px;
      font-weight: 700;
      background: #2563eb;
      box-shadow: 0 10px 24px rgba(37, 99, 235, 0.22);
    }

    .profile-main {
      flex: 1;
      min-width: 0;

      .profile-name {
        font-size: 15px;
        font-weight: 600;
        line-height: 1.35;
        color: var(--el-text-color-primary);
      }

      .profile-email {
        margin-top: 5px;
        font-size: 13px;
        color: var(--el-text-color-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .profile-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
      }
    }
  }

  .info-section {
    margin-bottom: 24px;

    &:last-child {
      margin-bottom: 0;
      border-bottom: none;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;

      .header-left {
        display: flex;
        align-items: center;
        gap: 8px;

        .section-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--el-text-color-primary);
        }
      }
    }

    .brand-card {
      display: flex;
      gap: 18px;
      padding: 18px;
      border: 1px solid var(--el-border-color-light);
      border-radius: 8px;
      background: var(--el-fill-color-light);

      &.brand-card-elevated {
        background: var(--el-bg-color);
        box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
      }

      .brand-preview {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 160px;
        height: 88px;
        border-radius: 8px;
        background: var(--el-bg-color);
        border: 1px solid var(--el-border-color-lighter);
        flex-shrink: 0;

        img {
          max-width: 128px;
          max-height: 64px;
          object-fit: contain;
        }
      }

      .brand-content {
        flex: 1;
        min-width: 0;

        .brand-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--el-text-color-primary);
          margin-bottom: 6px;
        }

        .brand-desc {
          font-size: 13px;
          color: var(--el-text-color-secondary);
          margin-bottom: 14px;
          line-height: 1.5;
        }

        .brand-actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }
      }
    }
  }

  .system-details {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-bg-color);
  }

  .system-detail-item {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 12px;
    border-radius: 8px;
    background: var(--el-fill-color-lighter);

    &.is-wide {
      grid-column: 1 / -1;
    }
  }

  .detail-label {
    margin-bottom: 6px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .detail-value {
    overflow: hidden;
    color: var(--el-text-color-primary);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.45;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .profile-details {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    padding: 16px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-bg-color);

    .detail-item {
      display: flex;
      flex-direction: column;
      min-width: 0;

      .label {
        margin-bottom: 6px;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }

      .value {
        font-size: 14px;
        font-weight: 600;
        color: var(--el-text-color-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }

  .edit-panel {
    padding: 16px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-bg-color);

    .edit-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 8px;

      .el-button {
        min-width: 104px;

        .el-icon {
          margin-right: 6px;
        }
      }
    }
  }

  .current-organization {
    padding: 16px;
    border: 1px solid var(--el-color-primary-light-5);
    border-radius: 8px;
    background: var(--el-color-primary-light-9);

    .org-main {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .org-avatar {
      flex-shrink: 0;
      color: #fff;
      font-weight: 700;
      background: #0f766e;
    }

    .org-info {
      flex: 1;
      min-width: 0;

      .org-name-row {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;

        .org-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--el-text-color-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      .org-meta {
        margin-top: 5px;
        font-size: 13px;
        color: var(--el-text-color-secondary);
      }
    }

    .org-address {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid var(--el-border-color-lighter);
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }
  }

  .organizations-list {
    display: flex;
    flex-direction: column;
    gap: 10px;

    .organization-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border: 1px solid var(--el-border-color-light);
      border-radius: 8px;
      background: var(--el-bg-color);

      &.is-current {
        border-color: var(--el-color-primary-light-5);
        background: var(--el-color-primary-light-9);
      }

      .org-avatar-small {
        flex-shrink: 0;
        color: #fff;
        font-weight: 700;
        background: #64748b;
      }

      .org-content {
        flex: 1;
        min-width: 0;

        .org-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
          min-width: 0;

          .org-name {
            font-size: 14px;
            font-weight: 600;
            color: var(--el-text-color-primary);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }

        .org-meta-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--el-text-color-secondary);

          .org-separator {
            margin: 0 2px;
          }
        }
      }
    }
  }

  .permissions-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 14px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-bg-color);

    .permission-more-tag {
      cursor: pointer;
      user-select: none;
    }
  }

  .empty-state {
    padding: 20px 0;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-bg-color);
    text-align: center;
  }

  @media (width <= 640px) {
    padding: 0 14px 20px;

    .system-hero,
    .brand-card {
      align-items: stretch;
      flex-direction: column;
    }

    .system-hero-logo,
    .brand-preview {
      width: 100%;
    }

    .system-stats,
    .system-details,
    .profile-details {
      grid-template-columns: 1fr;
    }
  }
}
</style>
