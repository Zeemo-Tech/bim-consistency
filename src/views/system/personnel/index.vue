<template>
  <div class="personnel-container">
    <section class="page-header">
      <el-button type="primary" class="invite-button" @click="handleInvite">
        <el-icon><Plus /></el-icon>
        邀请成员
      </el-button>
    </section>

    <section class="table-panel">
      <div class="toolbar">
        <div class="toolbar-filters">
          <el-input
            v-model="searchQuery"
            placeholder="搜索成员姓名、邮箱或账号"
            class="toolbar-input toolbar-search"
            clearable
            @input="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>

          <el-select
            v-model="selectedRole"
            class="toolbar-input toolbar-select"
            placeholder="全部角色"
            @change="handleFilterChange"
          >
            <el-option label="全部角色" value="all" />
            <el-option
              v-for="role in roleOptions"
              :key="role"
              :label="role"
              :value="role"
            />
          </el-select>

          <el-select
            v-model="selectedStatus"
            class="toolbar-input toolbar-select"
            placeholder="全部状态"
            @change="handleFilterChange"
          >
            <el-option label="全部状态" value="all" />
            <el-option label="已加入" value="joined" />
            <el-option label="待激活" value="pending" />
          </el-select>
        </div>

        <div class="toolbar-summary">
          <div class="summary-item">
            <span class="summary-label">总人数</span>
            <span class="summary-value">{{ totalMembers }}</span>
          </div>
          <div class="summary-divider" />
          <div class="summary-item">
            <span class="summary-label">已加入</span>
            <span class="summary-value">{{ joinedMembers }}</span>
          </div>
          <div class="summary-divider" />
          <div class="summary-item">
            <span class="summary-label">活跃率</span>
            <span class="summary-value">{{ activeRate }}%</span>
          </div>
        </div>
      </div>

      <el-table
        v-loading="loading"
        :data="paginatedPersonnel"
        class="personnel-table"
        empty-text="暂无成员数据"
        style="width: 100%"
      >
        <el-table-column label="成员" min-width="260">
          <template #default="{ row }">
            <div class="member-cell">
              <el-avatar :size="36" class="member-avatar">
                {{ row.displayName[0] }}
              </el-avatar>
              <div class="member-info">
                <div class="member-name">{{ row.displayName }}</div>
                <div class="member-id">@{{ row.username }}</div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="邮箱" min-width="220" prop="email" />

        <el-table-column label="电话" min-width="170">
          <template #default="{ row }">
            <span class="muted-text">{{ row.phone || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="角色" min-width="180">
          <template #default="{ row }">
            <el-tag
              :type="getRoleTagType(row.role.name) as any"
              effect="plain"
              class="role-tag"
            >
              {{ row.role.name }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="状态" min-width="140">
          <template #default="{ row }">
            <el-tag
              :type="isJoinedStatus(row.status) ? 'success' : 'warning'"
              effect="plain"
              class="status-tag"
            >
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="150" fixed="right" align="left">
          <template #default="{ row }">
            <div class="action-cell">
              <el-button
                text
                size="small"
                class="action-btn"
                @click="handleEdit(row)"
              >
                编辑
              </el-button>
              <el-button
                text
                size="small"
                class="action-btn action-btn--danger"
                @click="handleDelete(row)"
              >
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <div class="pagination-meta">
          当前显示 {{ paginatedPersonnel.length }} /
          {{ filteredPersonnel.length }} 名成员
        </div>
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="filteredPersonnel.length"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </section>

    <MemberDialog
      v-model:visible="memberDialogVisible"
      :member="currentMember"
      :mode="dialogMode"
      @success="handleMemberSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import MemberDialog from './components/MemberDialog.vue'
import { deleteMember, getMembers, type Member } from '@/api/member'
import { initOrganizationId } from '@/utils/auth'

defineOptions({
  name: 'PersonnelManagement',
})

const MEMBER_FETCH_LIMIT = 9999

interface MemberFormData {
  id?: number
  userId?: number
  displayName: string
  email: string
  phone: string
  roleId: number | null
  role: string
  department: string
  employeeId: string
  status: boolean
  avatar?: string
}

const searchQuery = ref('')
const selectedRole = ref('all')
const selectedStatus = ref<'all' | 'joined' | 'pending'>('all')
const currentPage = ref(1)
const pageSize = ref(10)
const memberDialogVisible = ref(false)
const currentMember = ref<MemberFormData | null>(null)
const dialogMode = ref<'invite' | 'edit'>('invite')
const loading = ref(false)

const personnelList = ref<Member[]>([])

const roleOptions = computed(() =>
  Array.from(
    new Set(
      personnelList.value
        .map((member) => member.role?.name)
        .filter((role): role is string => Boolean(role)),
    ),
  ),
)

const totalMembers = computed(() => personnelList.value.length)
const joinedMembers = computed(
  () =>
    personnelList.value.filter((member) => isJoinedStatus(member.status))
      .length,
)
const activeRate = computed(() => {
  if (!totalMembers.value) {
    return 0
  }
  return Math.round((joinedMembers.value / totalMembers.value) * 100)
})

const filteredPersonnel = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()

  return personnelList.value.filter((person) => {
    const matchKeyword =
      !keyword ||
      person.displayName?.toLowerCase().includes(keyword) ||
      person.email?.toLowerCase().includes(keyword) ||
      person.username?.toLowerCase().includes(keyword)

    const matchRole =
      selectedRole.value === 'all' || person.role?.name === selectedRole.value

    const matchStatus =
      selectedStatus.value === 'all' ||
      (selectedStatus.value === 'joined'
        ? isJoinedStatus(person.status)
        : !isJoinedStatus(person.status))

    return Boolean(matchKeyword && matchRole && matchStatus)
  })
})

const paginatedPersonnel = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredPersonnel.value.slice(start, start + pageSize.value)
})

const getRoleTagType = (
  role: string,
): 'success' | 'warning' | 'danger' | 'info' | 'primary' | '' => {
  const roleTypes: Record<
    string,
    'success' | 'warning' | 'danger' | 'info' | 'primary' | ''
  > = {
    项目总监: 'danger',
    主创建筑师: 'warning',
    施工经理: 'success',
    结构工程师: 'info',
    BIM工程师: 'primary',
    造价工程师: '',
  }
  return roleTypes[role] || ''
}

const isJoinedStatus = (status?: string) => status === 'joined'

const getStatusLabel = (status?: string) =>
  isJoinedStatus(status) ? '已加入' : '待激活'

const resetPagination = () => {
  currentPage.value = 1
}

const loadMembers = async () => {
  try {
    loading.value = true
    const response = await getMembers(1, MEMBER_FETCH_LIMIT)

    if (response.code === 200 || response.code === 0) {
      personnelList.value = response.data.list || []
      return
    }

    ElMessage.error(response.msg || '获取成员列表失败')
  } catch (error) {
    console.error('加载成员列表失败:', error)
    ElMessage.error('获取成员列表失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  resetPagination()
}

const handleFilterChange = () => {
  resetPagination()
}

const handleSizeChange = (size: number) => {
  pageSize.value = size
  resetPagination()
}

const handleCurrentChange = (page: number) => {
  currentPage.value = page
}

const handleInvite = () => {
  currentMember.value = null
  dialogMode.value = 'invite'
  memberDialogVisible.value = true
}

const handleEdit = (member: Member) => {
  currentMember.value = {
    id: member.id,
    userId: member.userId,
    displayName: member.displayName,
    email: member.email,
    phone: member.phone || '',
    roleId: member.role.id,
    role: member.role.name,
    department: '',
    employeeId: member.username,
    status: member.status === 'joined',
    avatar: '',
  }
  dialogMode.value = 'edit'
  memberDialogVisible.value = true
}

const handleDelete = async (member: Member) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除成员 ${member.displayName} 吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )

    const response = await deleteMember(member.userId)
    if (response.code === 204) {
      ElMessage.success('删除成功')
      await loadMembers()
      return
    }

    ElMessage.error(response.msg || '删除失败')
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除成员失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

const handleMemberSuccess = async () => {
  await loadMembers()
}

watch(filteredPersonnel, (members) => {
  const maxPage = Math.max(1, Math.ceil(members.length / pageSize.value))
  if (currentPage.value > maxPage) {
    currentPage.value = maxPage
  }
})

onMounted(async () => {
  await initOrganizationId()
  await loadMembers()
})
</script>

<style lang="scss" scoped>
.personnel-container {
  min-height: 100%;

  overflow-y: auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  margin-bottom: 16px;
}

.invite-button {
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

.table-panel {
  overflow: hidden;
  border: 1px solid #e6ebf5;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 28px 18px;
  border-bottom: 1px solid #edf1f7;
}

.toolbar-filters {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 12px;
}

.toolbar-input {
  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper) {
    min-height: 40px;
    border-radius: 10px;
    box-shadow: none;
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    transition:
      border-color 0.2s ease,
      background-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  :deep(.el-input__wrapper:hover),
  :deep(.el-select__wrapper:hover) {
    border-color: #cbd5e1;
    background: #ffffff;
  }

  :deep(.is-focus) {
    border-color: #4e66cc;
    background: #ffffff;
    box-shadow: 0 0 0 3px rgba(78, 102, 204, 0.12);
  }
}

.toolbar-search {
  max-width: 360px;
}

.toolbar-select {
  width: 150px;
}

.toolbar-summary {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 14px;
  padding: 0 4px;
  color: #6b7280;
}

.summary-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  white-space: nowrap;
}

.summary-label {
  font-size: 13px;
}

.summary-value {
  font-size: 18px;
  font-weight: 600;
  color: #172033;
}

.summary-divider {
  width: 1px;
  height: 18px;
  background: #e5e7eb;
}

.personnel-table {
  :deep(.el-table__inner-wrapper::before) {
    display: none;
  }

  :deep(th.el-table__cell) {
    height: 48px;
    background: #fafbfc;
    border-bottom: 1px solid #edf1f7;
    padding-right: 24px;
    padding-left: 24px;
  }

  :deep(.el-table__header-wrapper th) {
    font-size: 13px;
    font-weight: 600;
    color: #6b7280;
  }

  :deep(.el-table__cell) {
    padding: 14px 24px;
    border-bottom: 1px solid #f1f5f9;
  }

  :deep(.el-table__row) {
    transition: background-color 0.2s ease;
  }

  :deep(.el-table__row:hover > td.el-table__cell) {
    background: #fafcff;
  }
}

.member-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.member-avatar {
  flex-shrink: 0;
  background: linear-gradient(135deg, #6f86e8 0%, #4e66cc 100%);
  color: #ffffff;
  font-weight: 600;
}

.member-info {
  min-width: 0;
}

.member-name {
  overflow: hidden;
  color: #172033;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-id {
  margin-top: 2px;
  overflow: hidden;
  color: #8a94a6;
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.muted-text {
  color: #4b5563;
}

.role-tag,
.status-tag {
  border-radius: 999px;
  padding: 0 10px;
  font-weight: 500;
}

.action-cell {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}

.action-btn {
  margin-left: 0;
  color: #52607a;
  font-weight: 500;
}

.action-btn:hover {
  color: #2f3d58;
  background: #f4f7fb;
}

.action-btn--danger {
  color: #8c96a8;
}

.action-btn--danger:hover {
  color: #c24141;
  background: #fff5f5;
}

.pagination-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 28px 22px;
}

.pagination-meta {
  color: #8a94a6;
  font-size: 13px;
}

@media (max-width: 1080px) {
  .page-header,
  .toolbar,
  .pagination-wrapper {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-summary {
    justify-content: flex-start;
    padding: 0;
  }
}

@media (max-width: 768px) {
  .personnel-container {
    padding: 16px;
  }

  .invite-button,
  .toolbar-search,
  .toolbar-select {
    width: 100%;
    max-width: none;
  }

  .toolbar {
    padding: 18px 18px 14px;
  }

  .toolbar-summary {
    flex-wrap: wrap;
    gap: 10px;
  }

  .summary-divider {
    display: none;
  }

  .pagination-wrapper {
    padding: 16px 18px 18px;
  }
}
</style>
