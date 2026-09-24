<template>
  <div class="organization-container">
    <!-- 操作栏 -->
    <div class="action-bar">
      <div v-if="hasOrganization" class="search-section">
        <el-input
          v-model="searchQuery"
          :placeholder="t('organization.searchPlaceholder')"
          class="search-input"
          clearable
          size="large"
          @input="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <div
        class="action-section"
        :style="{ marginLeft: hasOrganization ? '' : 'auto' }"
      >
        <el-button type="primary" class="create-btn" @click="handleCreate">
          <el-icon><Plus /></el-icon>
          {{ createButtonText }}
        </el-button>
      </div>
    </div>
    <!-- 展示列表 -->
    <div v-if="hasOrganization" class="company-list">
      <div class="summary-card summary-card--primary">
        <div class="count">
          <span class="desc">集团总部</span>
          <span class="num">{{ currentOrganization?.name || '实模一致' }}</span>
        </div>
        <div class="icon">
          <el-icon><OfficeBuilding /></el-icon>
        </div>
      </div>
      <div class="summary-card">
        <div class="count">
          <span class="desc">分公司数量</span>
          <span class="num">{{ subsidiariesCount }}</span>
        </div>
        <div class="icon">
          <el-icon><OfficeBuilding /></el-icon>
        </div>
      </div>
      <div class="summary-card">
        <div class="count">
          <span class="desc">总成员数量</span>
          <span class="num">{{ totalMembersCount }}</span>
        </div>
        <div class="icon">
          <el-icon><User /></el-icon>
        </div>
      </div>
    </div>
    <!-- 组织卡片列表 -->
    <div v-loading="loading" class="organization-list">
      <!-- 空状态 -->
      <el-empty
        v-if="!hasOrganization && !loading"
        description="暂无组织，请先创建总公司"
        :image-size="200"
      />

      <div v-else-if="currentOrganization" class="company-card">
        <!-- 主公司卡片 -->
        <div class="main-company">
          <div class="company-header">
            <div class="company-info">
              <div class="company-logo">
                <span>{{ currentOrganization.name.slice(0, 1) }}</span>
              </div>
              <div class="company-details">
                <h3 class="company-name">{{ currentOrganization.name }}</h3>
                <div class="company-badges">
                  <el-tag size="small" class="type-tag">总公司</el-tag>
                  <el-tag type="success" size="small" class="status-tag">
                    {{ t('organization.active') }}
                  </el-tag>
                </div>
                <p class="company-description">
                  {{ currentOrganization.description || '-' }}
                </p>
              </div>
            </div>

            <div class="company-actions">
              <el-button
                v-if="subsidiaries && subsidiaries.length > 0"
                text
                type="primary"
                @click="toggleExpand()"
              >
                <el-icon>
                  <ArrowDown v-if="!expanded" />
                  <ArrowUp v-else />
                </el-icon>
                {{
                  expanded
                    ? t('organization.collapse')
                    : t('organization.expand')
                }}
              </el-button>

              <el-dropdown trigger="click">
                <el-button text>
                  <el-icon><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="handleEdit(currentOrganization)">
                      <el-icon><Edit /></el-icon>
                      {{ t('common.edit') }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
          <!-- 公司详细信息 -->
          <div class="company-meta">
            <div class="meta-item">
              <el-icon><Location /></el-icon>
              <span>{{ currentOrganization.address || '-' }}</span>
            </div>
            <div class="meta-item">
              <el-icon><Phone /></el-icon>
              <span>{{ currentOrganization.contactPhone || '-' }}</span>
            </div>
            <div class="meta-item">
              <el-icon><Avatar /></el-icon>
              <span>{{ currentOrganization.contactPerson || '-' }}</span>
            </div>
            <div class="meta-item">
              <el-icon><Message /></el-icon>
              <span>{{ currentOrganization.email || '-' }}</span>
            </div>
            <div class="meta-item">
              <el-icon><User /></el-icon>
              <span>
                {{
                  t('organization.memberCount', {
                    count: currentOrganization.memberCount || 0,
                  })
                }}
              </span>
            </div>
            <div class="meta-item subsidiary-item">
              <el-icon class="subsidiary-icon"><OfficeBuilding /></el-icon>
              <span>{{ total }}家分公司</span>
            </div>
          </div>
        </div>

        <!-- 子公司列表 -->
        <div
          v-if="expanded && subsidiaries && subsidiaries.length > 0"
          class="subsidiaries"
        >
          <div
            v-for="subsidiary in subsidiaries"
            :key="subsidiary.id"
            class="subsidiary-card"
          >
            <div class="subsidiary-content">
              <div class="subsidiary-info">
                <div class="subsidiary-title">
                  <h4 class="subsidiary-name">{{ subsidiary.name }}</h4>
                  <div class="company-badges">
                    <el-tag type="info" size="small" class="type-tag1">
                      分公司
                    </el-tag>
                  </div>
                </div>
                <p class="subsidiary-description">
                  {{ subsidiary.description || '-' }}
                </p>

                <div class="subsidiary-meta">
                  <div class="meta-item">
                    <el-icon><Location /></el-icon>
                    <span>{{ subsidiary.address || '-' }}</span>
                  </div>
                  <div class="meta-item">
                    <el-icon><Phone /></el-icon>
                    <span>{{ subsidiary.contactPhone || '-' }}</span>
                  </div>
                  <div class="meta-item">
                    <el-icon><Avatar /></el-icon>
                    <span>{{ subsidiary.contactPerson || '-' }}</span>
                  </div>
                  <div class="meta-item">
                    <el-icon><Message /></el-icon>
                    <span>{{ subsidiary.email || '-' }}</span>
                  </div>
                  <div class="meta-item">
                    <el-icon><User /></el-icon>
                    <span>
                      {{
                        t('organization.memberCount', {
                          count: subsidiary.memberCount || 0,
                        })
                      }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="subsidiary-actions">
                <el-dropdown trigger="click">
                  <el-button text>
                    <el-icon><MoreFilled /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="handleEdit(subsidiary)">
                        <el-icon><Edit /></el-icon>
                        {{ t('common.edit') }}
                      </el-dropdown-item>
                      <el-dropdown-item @click="handleDelete(subsidiary)">
                        <el-icon><Delete /></el-icon>
                        {{ t('common.delete') }}
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
          </div>

          <!-- 分页组件 -->
          <div class="pagination-container">
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :total="total"
              :page-sizes="[10, 20, 50, 100]"
              layout="total, sizes, prev, pager, next, jumper"
              @current-change="handlePageChange"
              @size-change="handlePageChange"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 新建/编辑组织对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? t('organization.edit') : t('organization.create')"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        label-position="top"
        :model="formData"
        :rules="formRules"
        label-width="100px"
        size="large"
      >
        <el-row :gutter="20">
          <el-col :span="24">
            <el-form-item :label="t('organization.type')" prop="type">
              <el-select
                v-model="formData.type"
                :placeholder="t('organization.typePlaceholder')"
                disabled
                style="width: 100%"
              >
                <el-option
                  v-if="!isEdit && !hasOrganization"
                  label="总公司"
                  value="headquarters"
                />
                <el-option v-else label="分公司" value="branch" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item :label="t('organization.name')" prop="name">
          <el-input
            v-model="formData.name"
            :placeholder="t('organization.namePlaceholder')"
          />
        </el-form-item>

        <el-form-item
          :label="t('organization.contactPerson')"
          prop="contactPerson"
        >
          <el-input
            v-model="formData.contactPerson"
            :placeholder="t('organization.contactPersonPlaceholder')"
          />
        </el-form-item>

        <el-form-item
          :label="t('organization.contactPhone')"
          prop="contactPhone"
        >
          <el-input
            v-model="formData.contactPhone"
            :placeholder="t('organization.contactPhonePlaceholder')"
          />
        </el-form-item>

        <el-form-item :label="t('organization.email')" prop="email">
          <el-input
            v-model="formData.email"
            :placeholder="t('organization.emailPlaceholder')"
          />
        </el-form-item>

        <el-form-item :label="t('organization.address')" prop="address">
          <el-input
            v-model="formData.address"
            type="textarea"
            :rows="3"
            :placeholder="t('organization.addressPlaceholder')"
          />
        </el-form-item>

        <el-form-item :label="t('organization.description')" prop="description">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            :placeholder="t('organization.descriptionPlaceholder')"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">
            {{ t('common.cancel') }}
          </el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">
            {{ t('common.confirm') }}
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import {
  Search,
  Plus,
  ArrowDown,
  ArrowUp,
  MoreFilled,
  Edit,
  OfficeBuilding,
  Delete,
  Location,
  Phone,
  Message,
  User,
  Folder,
  Avatar,
} from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import {
  getOrganizations,
  getMyOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  type Organization,
  type OrganizationsResponse,
} from '@/api/organization'
import { useOrganizationStoreHook } from '@/store/modules/organization'

const { t } = useI18n()
const organizationStore = useOrganizationStoreHook()

defineOptions({
  name: 'OrganizationManagement',
})

// 搜索
const searchQuery = ref('')

// 对话框
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()

// 分页参数
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const loading = ref(false)

// 组织数据
const currentOrganization = ref<Organization | null>(null)
const subsidiaries = ref<Organization[]>([])

// 是否有组织（用于判断显示"创建总公司"还是"新建分公司"）
const hasOrganization = ref(false)

// 表单数据
const formData = reactive({
  id: 0,
  name: '',
  type: 'headquarters',
  contactPerson: '',
  contactPhone: '',
  email: '',
  address: '',
  description: '',
  status: 'active',
})

// 表单验证规则
const formRules: FormRules = {
  name: [
    {
      required: true,
      message: t('organization.nameRequired'),
      trigger: 'blur',
    },
    { min: 2, max: 50, message: t('organization.nameLength'), trigger: 'blur' },
  ],
  contactPerson: [
    {
      required: true,
      message: t('organization.contactPersonRequired'),
      trigger: 'blur',
    },
  ],
  contactPhone: [
    {
      pattern: /^1[3-9]\d{9}$/,
      message: t('organization.contactPhoneInvalid'),
      trigger: 'blur',
    },
  ],
  email: [
    {
      required: true,
      message: '请填入正确的邮箱',
      trigger: 'blur',
    },
    {
      type: 'email',
      message: t('organization.emailInvalid'),
      trigger: 'blur',
    },
  ],
  status: [
    {
      required: true,
      message: t('organization.statusRequired'),
      trigger: 'change',
    },
  ],
}

// 默认展开状态
const expanded = ref(true)

// 检查用户是否有组织
const checkMyOrganizations = async () => {
  try {
    const { data } = await getMyOrganizations()
    hasOrganization.value = Array.isArray(data.list) && data.list.length > 0

    if (hasOrganization.value && data.list.length > 0) {
      const { getOrganizationId, setOrganizationId } = await import(
        '@/utils/auth'
      )
      const currentOrgId = getOrganizationId()
      if (!currentOrgId) {
        const rootOrg = data.list.find((item) => {
          const parentId = item.organization?.parentOrganizationId
          return !parentId || parentId === 0
        })

        if (rootOrg && rootOrg.organization?.id) {
          setOrganizationId(rootOrg.organization.id)
        } else {
          const firstOrgId = data.list[0].organization?.id
          if (firstOrgId) {
            setOrganizationId(firstOrgId)
          }
        }
      }
    }
  } catch (error) {
    console.error('检查组织失败:', error)
    hasOrganization.value = false
  }
}

const loadOrganizations = async () => {
  if (!hasOrganization.value) {
    loading.value = false
    return
  }

  const { getOrganizationId } = await import('@/utils/auth')
  const orgId = getOrganizationId()
  if (!orgId) {
    loading.value = false
    return
  }

  try {
    loading.value = true
    const data = await getOrganizations(currentPage.value, pageSize.value)

    if (data && (data.code === 0 || data.code === 200) && data.data) {
      currentOrganization.value = data.data.current
      subsidiaries.value = data.data.children?.list || []
      total.value = data.data.children?.total || 0
    } else if (data && data.data.current) {
      currentOrganization.value = data.data.current
      subsidiaries.value = data.data.children?.list || []
      total.value = data.data.children?.total || 0
    } else {
      console.warn('未找到预期的数据结构，data:', data)
    }
  } catch (error) {
    ElMessage.error('加载组织数据失败')
    console.error('加载组织数据失败:', error)
  } finally {
    loading.value = false
  }
}

// 动态计算统计数据
const subsidiariesCount = computed(() => {
  return total.value
})

const totalMembersCount = computed(() => {
  const currentMembers = currentOrganization.value?.memberCount || 0
  const subsidiaryMembers = subsidiaries.value.reduce(
    (sum, sub) => sum + (sub.memberCount || 0),
    0,
  )
  return currentMembers + subsidiaryMembers
})

// 创建按钮文本
const createButtonText = computed(() => {
  return hasOrganization.value ? '新建分公司' : '创建总公司'
})

// 分页变化处理
const handlePageChange = (page: number) => {
  currentPage.value = page
  loadOrganizations()
}

// 初始化数据
onMounted(async () => {
  await checkMyOrganizations()
  await loadOrganizations()
})

// 获取状态类型
const getStatusType = (status: string) => {
  const statusMap: Record<string, string> = {
    active: 'success',
    inactive: 'danger',
    pending: 'warning',
  }
  return statusMap[status] || 'info'
}

// 获取状态文本
const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    active: t('organization.active'),
    inactive: t('organization.inactive'),
    pending: t('organization.pending'),
  }
  return statusMap[status] || status
}

// 获取标签类型
const getTagType = (type: string) => {
  const tagMap: Record<string, string> = {
    headquarters: '',
    branch: 'info',
    subsidiary: 'warning',
  }
  return tagMap[type] || ''
}

// 获取标签文本
const getTagText = (type: string) => {
  const tagMap: Record<string, string> = {
    headquarters: t('organization.headquarters'),
    branch: t('organization.branch'),
    subsidiary: t('organization.subsidiary'),
  }
  return tagMap[type] || type
}

// 展开/收起子公司
const toggleExpand = () => {
  expanded.value = !expanded.value
}

// 搜索处理
const handleSearch = () => {
  currentPage.value = 1
  loadOrganizations()
}

// 新建组织
const handleCreate = () => {
  isEdit.value = false
  resetForm()
  dialogVisible.value = true
}

// 编辑组织
const handleEdit = (org: Organization) => {
  isEdit.value = true
  // 根据 parentOrganizationId 判断是总公司还是分公司
  const orgType = org.parentOrganizationId ? 'branch' : '总公司'
  Object.assign(formData, {
    id: org.id,
    name: org.name,
    type: orgType,
    contactPerson: org.contactPerson || '',
    contactPhone: org.contactPhone || '',
    email: org.email || '',
    address: org.address || '',
    description: org.description || '',
    status: 'active',
  })
  dialogVisible.value = true
}

// 删除组织
const handleDelete = async (org: Organization) => {
  try {
    await ElMessageBox.confirm(
      t('organization.deleteConfirm', { name: org.name }),
      t('organization.deleteTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      },
    )

    const response = await deleteOrganization(org.id)

    // 检查响应码
    if (response.code === 204 || response.code === 200 || response.code === 0) {
      ElMessage.success(t('organization.deleteSuccess'))
      // 只重新加载组织数据，不重新检查组织状态
      await loadOrganizations()
      // 刷新 Header 中的组织列表
      await organizationStore.refreshOrganizations()
    } else {
      ElMessage.error(response.msg || '删除组织失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除组织失败')
      console.error('删除组织失败:', error)
    }
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    submitting.value = true

    // 构建参数
    const params: any = {
      name: formData.name,
      contactPerson: formData.contactPerson,
      contactPhone: formData.contactPhone,
      email: formData.email,
      address: formData.address,
      description: formData.description,
    }

    // 创建分公司时传递 parentOrganizationId
    if (!isEdit.value && formData.type === 'branch') {
      const { getOrganizationId } = await import('@/utils/auth')
      const orgId = getOrganizationId()

      if (orgId) {
        params.parentOrganizationId = orgId
      } else {
        console.warn('无法获取父组织ID')
        ElMessage.error('无法获取父组织ID，请刷新页面后重试')
        return
      }
    }

    if (isEdit.value) {
      // 编辑
      const response = await updateOrganization(formData.id, params)

      // 检查响应码和数据
      if (
        (response.code === 200 || response.code === 0) &&
        response.data &&
        response.data.id
      ) {
        ElMessage.success(t('organization.editSuccess'))
        dialogVisible.value = false
        // 重新加载组织数据
        await loadOrganizations()
        // 刷新 Header 中的组织列表
        await organizationStore.refreshOrganizations()
      } else {
        ElMessage.error(response.msg || '编辑失败')
      }
    } else {
      // 新建
      const response = await createOrganization(params)

      // 检查响应码和数据
      if (
        (response.code === 201 ||
          response.code === 200 ||
          response.code === 0) &&
        response.data &&
        response.data.id
      ) {
        ElMessage.success(t('organization.createSuccess'))
        dialogVisible.value = false

        // 如果是创建总公司，直接设置当前组织
        if (!hasOrganization.value) {
          currentOrganization.value = response.data
          hasOrganization.value = true

          // 重要：创建总公司后，设置组织ID到 localStorage 和 store
          const { setOrganizationId } = await import('@/utils/auth')
          setOrganizationId(response.data.id)
        } else {
          // 创建分公司后，不改变当前组织ID，只重新加载组织数据
          console.log('创建了分公司，ID:', response.data.id, '不改变当前组织ID')
        }

        // 重新加载数据（不需要再调用checkMyOrganizations，避免重新设置组织ID）
        await loadOrganizations()
        // 刷新 Header 中的组织列表
        await organizationStore.refreshOrganizations()
      } else {
        ElMessage.error(response.msg || '创建失败')
      }
    }
  } catch (error) {
    console.error('表单操作失败:', error)
  } finally {
    submitting.value = false
  }
}

// 重置表单
const resetForm = () => {
  if (formRef.value) {
    formRef.value.resetFields()
  }
  Object.assign(formData, {
    id: 0,
    name: '',
    type: hasOrganization.value ? 'branch' : 'headquarters',
    contactPerson: '',
    contactPhone: '',
    email: '',
    address: '',
    description: '',
    status: 'active',
  })
}
</script>

<style lang="scss" scoped>
.organization-container {
  height: 100%;
  background-color: #f6f8fc;
  padding: 24px;
  overflow-y: auto;
  margin-bottom: 48px;

  // 暗黑模式适配
  html.dark & {
    background-color: #1a1a1a;
    color: #ffffff;
  }

  .action-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18px;
    gap: 16px;
    flex-wrap: wrap;

    .search-section {
      flex: 1;
      min-width: 320px;
      max-width: 480px;

      .search-input {
        :deep(.el-input__wrapper) {
          min-height: 42px;
          border-radius: 12px;
          box-shadow: none;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          transition: all 0.2s ease;

          &:hover {
            border-color: #d1d5db;
            background: #ffffff;
          }

          &.is-focus {
            border-color: #4e66cc;
            box-shadow: 0 0 0 3px rgba(78, 102, 204, 0.12);
            background: #ffffff;
          }
        }

        :deep(.el-input__inner) {
          font-size: 14px;
        }
      }
    }

    .action-section {
      flex-shrink: 0;

      .create-btn {
        height: 40px;
        padding: 0 18px;
        border: none;
        border-radius: 10px;
        background: #409eff;
        box-shadow: 0 8px 18px rgba(78, 102, 204, 0.16);
        font-weight: 600;

        &:hover {
          background: #4259bc;
        }
      }
    }
  }

  .company-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 18px;

    .summary-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 116px;
      padding: 22px;
      border: 1px solid #e6ebf5;
      border-radius: 18px;
      background: #ffffff;
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.04);
      transition:
        transform 0.2s ease,
        border-color 0.2s ease,
        box-shadow 0.2s ease;

      html.dark & {
        background-color: #2a2a2a;
        border-color: #3a3a3a;
      }

      &:hover {
        transform: translateY(-1px);
        border-color: #d7deec;
        box-shadow: 0 14px 30px rgba(15, 23, 42, 0.06);
      }

      &.summary-card--primary {
        background:
          radial-gradient(
            circle at top left,
            rgba(78, 102, 204, 0.12),
            transparent 36%
          ),
          #ffffff;
      }

      .count {
        display: flex;
        flex-direction: column;

        .desc {
          margin-bottom: 10px;
          font-size: 13px;
          color: #7b8597;
          font-weight: 600;

          html.dark & {
            color: #a0a0a0;
          }
        }

        .num {
          font-size: 24px;
          color: #1a1a1a;
          font-weight: 700;
          line-height: 1.2;

          html.dark & {
            color: #ffffff;
          }
        }
      }
      .icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 52px;
        height: 52px;
        border-radius: 16px;
        background: #f8fafc;
        font-size: 26px;
      }
    }

    .summary-card:nth-child(1) .icon {
      color: #3b82f6;

      html.dark & {
        color: #60a5fa;
      }
    }

    .summary-card:nth-child(2) .icon {
      color: #2c9b33;

      html.dark & {
        color: #4ade80;
      }
    }

    .summary-card:nth-child(3) .icon {
      color: #832c9b;

      html.dark & {
        color: #c084fc;
      }
    }
  }
  .organization-list {
    display: flex;
    flex-direction: column;
    gap: 20px;

    .company-card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
      transition: all 0.3s ease;
      overflow: hidden;

      html.dark & {
        background: #2a2a2a;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
        border: 1px solid #3a3a3a;

        &:hover {
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.9);
        }
      }

      &:hover {
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        transform: translateY(-2px);
      }

      .main-company {
        padding: 24px;

        .company-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 20px;

          .company-info {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            flex: 1;

            .company-logo {
              width: 64px;
              height: 64px;
              border-radius: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: linear-gradient(135deg, #409eff 0%, #7cc5ff 100%);
              color: #ffffff;
              font-size: 24px;
              font-weight: 700;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
              flex-shrink: 0;
            }

            .company-details {
              flex: 1;

              .company-name {
                margin: 0 0 8px 0;
                font-size: 20px;
                font-weight: 600;
                color: #1a1a1a;
                line-height: 1.3;

                html.dark & {
                  color: #ffffff;
                }
              }

              .company-badges {
                display: flex;
                gap: 8px;
                margin-bottom: 12px;

                .type-tag {
                  font-weight: 500;
                  height: 25px;
                  border-radius: 10px;
                  width: 60px;
                  background-color: #000;
                  color: #fff;

                  html.dark & {
                    background-color: #3a3a3a;
                    color: #ffffff;
                  }
                }

                .status-tag {
                  font-weight: 500;
                  height: 25px;
                  border-radius: 10px;
                  width: 60px;
                }
              }

              .company-description {
                margin: 0;
                font-size: 16px;
                color: #3f4248;
                line-height: 1.5;

                html.dark & {
                  color: #a0a0a0;
                }
              }
            }
          }

          .company-actions {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-shrink: 0;

            .el-button {
              border-radius: 6px;
              font-size: 14px;
              transition: all 0.3s ease;

              &:hover {
                transform: translateY(-1px);
              }
            }

            .el-dropdown {
              .el-button {
                padding: 8px;
                border-radius: 6px;
              }
            }
          }
        }

        .company-meta {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid #f3f4f6;

          html.dark & {
            border-top-color: #3a3a3a;
          }

          .meta-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 16px;
            color: #3f4248;

            html.dark & {
              color: #a0a0a0;
            }

            .el-icon {
              color: #9ca3af;
              font-size: 16px;

              html.dark & {
                color: #6b7280;
              }
            }

            span {
              line-height: 1.4;
            }

            &.subsidiary-item {
              .subsidiary-icon {
                font-size: 16px;
              }
            }
          }
        }
      }

      .subsidiaries {
        background-color: #fff;
        border-top: 1px solid #e5e7eb;
        padding: 20px 24px;

        html.dark & {
          background-color: #252525;
          border-top-color: #3a3a3a;
        }

        .subsidiary-card {
          background-color: #fbfeff;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
          border: 1px solid #e5e7eb;
          transition: all 0.3s ease;

          html.dark & {
            background-color: #1f1f1f;
            border-color: #3a3a3a;

            &:hover {
              border-color: #4a4a4a;
            }
          }

          &:last-child {
            margin-bottom: 0;
          }

          &:hover {
            border-color: #d1d5db;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
            transform: translateX(4px);

            html.dark & {
              box-shadow: 0 2px 8px rgba(255, 255, 255, 0.1);
            }
          }

          .subsidiary-content {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;

            .subsidiary-info {
              flex: 1;
              .subsidiary-title {
                display: flex;
                .subsidiary-name {
                  margin: 0 0 8px 0;
                  font-size: 18px;
                  font-weight: 600;
                  color: #3c4149;

                  html.dark & {
                    color: #ffffff;
                  }
                }
                .type-tag1 {
                  margin-left: 20px;
                  font-weight: 500;
                  height: 25px;
                  border-radius: 10px;
                  width: 60px;
                  background-color: #edeff2;
                  color: #1b1b1b;

                  html.dark & {
                    background-color: #3a3a3a;
                    color: #ffffff;
                  }
                }
              }

              .subsidiary-description {
                margin: 0 0 12px 0;
                font-size: 16px;
                color: #3f4248;
                line-height: 1.4;

                html.dark & {
                  color: #a0a0a0;
                }
              }

              .subsidiary-meta {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 8px;

                .meta-item {
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  font-size: 16px;
                  color: #55585e;

                  html.dark & {
                    color: #6b7280;
                  }

                  .el-icon {
                    color: #55585e;
                    font-size: 14px;

                    html.dark & {
                      color: #4b5563;
                    }
                  }
                }
              }
            }

            .subsidiary-actions {
              flex-shrink: 0;
              margin-left: 16px;

              .el-dropdown {
                .el-button {
                  padding: 6px;
                  border-radius: 6px;
                  color: #9ca3af;

                  &:hover {
                    color: #6b7280;
                    background-color: #f3f4f6;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // 对话框样式
  :deep(.el-dialog) {
    border-radius: 16px;
    overflow: hidden;

    html.dark & {
      background-color: #2a2a2a;
      border: 1px solid #3a3a3a;
    }

    .el-dialog__header {
      padding: 24px 24px 10px;

      html.dark & {
        background-color: #2a2a2a;
        border-bottom: 1px solid #3a3a3a;
      }

      .el-dialog__title {
        font-size: 22px;
        font-weight: 600;
        color: #1a1a1a;

        html.dark & {
          color: #ffffff;
        }
      }
    }

    .el-dialog__body {
      padding: 24px;

      html.dark & {
        background-color: #2a2a2a;
      }
    }

    .el-dialog__footer {
      padding: 16px 24px 24px;
      border-top: 1px solid #e5e7eb;

      html.dark & {
        background-color: #2a2a2a;
        border-top-color: #3a3a3a;
      }
    }
  }

  // 表单样式
  :deep(.el-form) {
    .el-form-item__label {
      color: #0f0f0f;
      font-weight: 500;
      font-size: 16px;

      html.dark & {
        color: #ffffff;
      }
    }
    .el-select__wrapper {
      font-size: 16px;
    }
    .el-input__wrapper,
    .el-textarea__inner,
    .el-select .el-input__wrapper {
      font-size: 16px;
      border-radius: 8px;
      transition: all 0.3s ease;
      &:hover {
        border-color: #d1d5db;
      }

      &.is-focus {
        border-color: #3b82f6;
      }

      html.dark & {
        background-color: #1a1a1a;
        border-color: #3a3a3a;

        &:hover {
          border-color: #4a4a4a;
        }

        &.is-focus {
          border-color: #60a5fa;
        }

        .el-input__inner {
          color: #ffffff;
        }

        .el-textarea__inner {
          color: #ffffff;
        }
      }
    }

    .el-textarea__inner {
      resize: vertical;

      html.dark & {
        background-color: #1a1a1a;
        color: #ffffff;
      }
    }
  }

  // 分页容器样式
  .pagination-container {
    display: flex;
    justify-content: center;
    margin-top: 24px;
    padding: 16px 0;

    :deep(.el-pagination) {
      .el-pagination__total,
      .el-pagination__jump {
        html.dark & {
          color: #a0a0a0;
        }
      }

      .el-pager li {
        background-color: transparent;
        color: #6b7280;

        html.dark & {
          color: #a0a0a0;
          background-color: transparent;
        }

        &.is-active {
          color: #3b82f6;
          background-color: rgba(59, 130, 246, 0.1);

          html.dark & {
            color: #60a5fa;
            background-color: rgba(96, 165, 250, 0.1);
          }
        }

        &:hover {
          color: #3b82f6;

          html.dark & {
            color: #60a5fa;
          }
        }
      }

      .el-select {
        html.dark & {
          .el-input__wrapper {
            background-color: #1a1a1a;
            border-color: #3a3a3a;
          }
        }
      }
    }
  }
}

// 响应式设计
@media screen and (max-width: 1024px) {
  .organization-container {
    padding: 16px;

    .company-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .action-bar {
      flex-direction: column;
      align-items: stretch;
      gap: 16px;

      .search-section {
        max-width: none;
      }

      .filter-section {
        display: flex;
        justify-content: center;
      }

      .action-section {
        display: flex;
        justify-content: center;
      }
    }

    .organization-list {
      .company-card {
        .main-company {
          padding: 20px;

          .company-header {
            flex-direction: column;
            align-items: stretch;
            gap: 16px;

            .company-info {
              .company-logo {
                width: 56px;
                height: 56px;
              }

              .company-details {
                .company-name {
                  font-size: 18px;
                }
              }
            }

            .company-actions {
              justify-content: flex-end;
            }
          }

          .company-meta {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          }
        }

        .subsidiaries {
          padding: 16px 20px;

          .subsidiary-card {
            .subsidiary-content {
              flex-direction: column;
              align-items: stretch;
              gap: 12px;

              .subsidiary-actions {
                margin-left: 0;
                align-self: flex-end;
              }
            }
          }
        }
      }
    }
  }
}

@media screen and (max-width: 640px) {
  .organization-container {
    padding: 12px;

    .company-list {
      grid-template-columns: 1fr;
    }

    .organization-list {
      .company-card {
        border-radius: 12px;

        .main-company {
          padding: 16px;

          .company-header {
            .company-info {
              gap: 12px;

              .company-logo {
                width: 48px;
                height: 48px;
                border-radius: 8px;
              }

              .company-details {
                .company-name {
                  font-size: 16px;
                }

                .company-badges {
                  .el-tag {
                    font-size: 12px;
                  }
                }

                .company-description {
                  font-size: 13px;
                }
              }
            }
          }

          .company-meta {
            grid-template-columns: 1fr;
            gap: 8px;

            .meta-item {
              font-size: 12px;
            }
          }
        }

        .subsidiaries {
          padding: 12px 16px;

          .subsidiary-card {
            padding: 12px;
            border-radius: 8px;

            .subsidiary-content {
              .subsidiary-info {
                .subsidiary-name {
                  font-size: 14px;
                  .type-tag1 {
                    font-weight: 500;
                    height: 25px;
                    border-radius: 10px;
                    width: 60px;
                    background-color: #f4f4f5;
                    color: #626161;
                  }
                }

                .subsidiary-description {
                  font-size: 12px;
                }

                .subsidiary-meta {
                  grid-template-columns: 1fr;
                  gap: 6px;

                  .meta-item {
                    font-size: 11px;
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
</style>
