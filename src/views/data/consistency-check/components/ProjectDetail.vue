<template>
  <div class="project-detail-container">
    <!-- 顶部导航区域 -->
    <div class="top-navigation">
      <div class="nav-left">
        <el-link :underline="false" class="back-link" @click="handleBack">
          <el-icon><ArrowLeft /></el-icon>
          返回项目管理
        </el-link>
        <h1 class="project-name">{{ projectInfo?.name || '项目详情' }}</h1>
      </div>
      <div class="nav-right">
        <el-tag class="status-tag" :class="getStatusClass(projectInfo?.status)">
          {{ getStatusText(projectInfo?.status) }}
        </el-tag>
        <div class="data">创建于{{ formatISODate(projectInfo?.deadline) || '未设置' }}</div>
      </div>
    </div>

    <!-- 概览卡片区域 -->
    <div class="overview-cards">
      <!-- 项目进度卡片 -->
      <div class="overview-card">
        <div class="card-header">
          <span class="card-title">项目进度</span>
          <el-icon class="card-icon"><DataAnalysis /></el-icon>
        </div>
        <div class="card-content">
          <div class="progress-value">65%</div>
          <div class="progress-info">
            <span>预计完成时间：2024-12-30</span>
          </div>
          <el-progress :percentage="65" :show-text="false" class="progress-bar" />
        </div>
      </div>

      <!-- 团队成员卡片 -->
      <div class="overview-card">
        <div class="card-header">
          <span class="card-title">团队成员</span>
          <el-icon class="card-icon"><User /></el-icon>
        </div>
        <div class="card-content">
          <div class="team-count">{{ projectInfo?.memberCount || 0 }}</div>
          <div class="team-avatars">
            <el-avatar
              v-for="(member, index) in membersList.slice(0, 3)"
              :key="member.userId"
              :size="32"
              class="avatar"
            >
              {{ member.displayName.charAt(0).toUpperCase() }}
            </el-avatar>
            <div v-if="membersList.length > 3" class="more-count">
              +{{ membersList.length - 3 }}
            </div>
          </div>
        </div>
      </div>

      <!-- 项目文件卡片 -->
      <div class="overview-card">
        <div class="card-header">
          <span class="card-title">项目文件</span>
          <el-icon class="card-icon"><Folder /></el-icon>
        </div>
        <div class="card-content">
          <div class="files-count">{{ projectInfo?.fileCount ?? 0 }}</div>
          <div class="files-info">
            <span>最近更新：2024-11-15</span>
          </div>
          <div class="files-icons">
            <el-icon class="file-icon"><Document /></el-icon>
            <el-icon class="file-icon"><Picture /></el-icon>
            <el-icon class="file-icon"><Files /></el-icon>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab导航区域 -->
    <div class="tab-navigation">
      <div
        class="tab-item"
        :class="{ active: activeTab === 'overview' }"
        @click="activeTab = 'overview'"
      >
        项目概览
      </div>
      <div
        class="tab-item"
        :class="{ active: activeTab === 'files' }"
        @click="activeTab = 'files'"
      >
        文件列表
      </div>
      <div
        class="tab-item"
        :class="{ active: activeTab === 'members' }"
        @click="activeTab = 'members'"
      >
        团队成员
      </div>
      <div
        class="tab-item"
        :class="{ active: activeTab === 'activities' }"
        @click="activeTab = 'activities'"
      >
        项目动态
      </div>
    </div>

    <!-- 内容展示区域 -->
    <div class="content-area">
      <!-- 团队成员内容 -->
      <div v-if="activeTab === 'members'" class="members-content">
        <div class="members-header">
          <h3 class="members-title">团队成员</h3>
          <el-button type="primary" :icon="Plus" class="add-member-btn" @click="handleInvite">添加成员</el-button>
        </div>

        <div class="members-list">
          <div v-if="membersLoading" class="loading-container">
            <el-skeleton :rows="5" animated />
          </div>
          <div v-else class="member-row" v-for="member in membersList" :key="member.userId">
            <div class="member-info">
              <el-avatar :size="40" class="member-avatar">
                {{ member.displayName.charAt(0).toUpperCase() }}
              </el-avatar>
              <div class="member-details">
                <div class="member-name">{{ member.displayName }}</div>
                <div class="member-position">{{ member.roleName }} · 建筑设计部</div>
              </div>
            </div>
            <div class="member-actions">
              <el-button text :icon="Edit" class="action-btn edit-btn" @click="handleEditMember(member)" />
              <el-button text :icon="Delete" class="action-btn delete-btn" @click="handleRemoveMember(member)" />
            </div>
          </div>
        </div>
      </div>

      <!-- 项目概览内容 -->
      <div v-else-if="activeTab === 'overview'" class="overview-content">
        <div class="overview-info">
          <div class="info-section">
            <h3 class="section-title">基本信息</h3>
            <div class="info-grid">
              <div class="info-item">
                <label>项目地点</label>
                <span>{{ projectInfo?.location || '-' }}</span>
              </div>
              <div class="info-item">
                <label>截止日期</label>
                <span>{{ formatISODate(projectInfo?.deadline) || '未设置' }}</span>
              </div>
              <div class="info-item">
                <label>成员数量</label>
                <span>{{ projectInfo?.memberCount || 0 }} 人</span>
              </div>
              <div class="info-item">
                <label>项目状态</label>
                <el-tag :type="getStatusTag(projectInfo?.status)" class="overview-status-tag">
                  {{ getStatusText(projectInfo?.status) }}
                </el-tag>
              </div>
            </div>
          </div>

          <div class="info-section">
            <h3 class="section-title">项目描述</h3>
            <div class="description-content">
              {{ projectInfo?.description || '暂无项目描述' }}
            </div>
          </div>
        </div>
      </div>

      <!-- 文件列表内容 -->
      <div v-else-if="activeTab === 'files'" class="files-content">
        <div v-if="filesLoading" class="loading-container">
          <el-skeleton :rows="5" animated />
        </div>
        <div v-else-if="filesList.length === 0" class="empty-state">
          <el-empty description="暂无文件" :image-size="80" />
        </div>
        <div v-else class="files-groups">
          <!-- BIM 文件组 -->
          <div v-if="getBIMFiles().length > 0" class="file-group">
            <div class="file-group-header">
              <el-icon class="group-icon"><Box /></el-icon>
              <span class="group-title">BIM 模型</span>
              <span class="group-count">{{ getBIMFiles().length }} 个文件</span>
            </div>
            <el-table :data="getBIMFiles()" border :style="{ width: '100%' }">
              <el-table-column label="类型" width="100" align="center">
                <template #default>
                  <el-tag type="primary" effect="plain" size="small">BIM</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="originalName" label="文件名称" min-width="200" show-overflow-tooltip />
              <el-table-column label="大小" width="120" align="center">
                <template #default="{ row }">
                  {{ formatFileSize(row.fileSize) }}
                </template>
              </el-table-column>
              <el-table-column label="状态" width="100" align="center">
                <template #default="{ row }">
                  <el-tag v-if="row.status === 'pending_external'" type="warning" size="small">
                    上传中
                  </el-tag>
                  <el-tag v-else-if="row.status === 'stored'" type="success" size="small">
                    已上传
                  </el-tag>
                  <el-tag v-else type="info" size="small">
                    {{ row.status }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="上传时间" width="180" align="center">
                <template #default="{ row }">
                  {{ formatISODate(row.createdAt) }}
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- CAD 文件组 -->
          <div v-if="getCADFiles().length > 0" class="file-group">
            <div class="file-group-header">
              <el-icon class="group-icon"><Document /></el-icon>
              <span class="group-title">CAD 图纸</span>
              <span class="group-count">{{ getCADFiles().length }} 个文件</span>
            </div>
            <el-table :data="getCADFiles()" border :style="{ width: '100%' }">
              <el-table-column label="类型" width="100" align="center">
                <template #default>
                  <el-tag type="success" effect="plain" size="small">CAD</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="originalName" label="文件名称" min-width="200" show-overflow-tooltip />
              <el-table-column label="大小" width="120" align="center">
                <template #default="{ row }">
                  {{ formatFileSize(row.fileSize) }}
                </template>
              </el-table-column>
              <el-table-column label="状态" width="100" align="center">
                <template #default="{ row }">
                  <el-tag v-if="row.status === 'pending_external'" type="warning" size="small">
                    上传中
                  </el-tag>
                  <el-tag v-else-if="row.status === 'stored'" type="success" size="small">
                    已上传
                  </el-tag>
                  <el-tag v-else type="info" size="small">
                    {{ row.status }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="上传时间" width="180" align="center">
                <template #default="{ row }">
                  {{ formatISODate(row.createdAt) }}
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- 点云文件组 -->
          <div v-if="getScanFiles().length > 0" class="file-group">
            <div class="file-group-header">
              <el-icon class="group-icon"><Folder /></el-icon>
              <span class="group-title">点云文件</span>
              <span class="group-count">{{ getScanFiles().length }} 个文件</span>
            </div>
            <el-table :data="getScanFiles()" border :style="{ width: '100%' }">
              <el-table-column label="类型" width="100" align="center">
                <template #default>
                  <el-tag type="warning" effect="plain" size="small">点云</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="originalName" label="文件名称" min-width="200" show-overflow-tooltip />
              <el-table-column label="大小" width="120" align="center">
                <template #default="{ row }">
                  {{ formatFileSize(row.fileSize) }}
                </template>
              </el-table-column>
              <el-table-column label="状态" width="100" align="center">
                <template #default="{ row }">
                  <el-tag v-if="row.status === 'pending_external'" type="warning" size="small">
                    上传中
                  </el-tag>
                  <el-tag v-else-if="row.status === 'stored'" type="success" size="small">
                    已上传
                  </el-tag>
                  <el-tag v-else type="info" size="small">
                    {{ row.status }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="上传时间" width="180" align="center">
                <template #default="{ row }">
                  {{ formatISODate(row.createdAt) }}
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>

    <!-- 项目动态内容 -->
      <div v-else-if="activeTab === 'activities'" class="activities-content">
        <div class="activities-list">
          <div v-if="activitiesLoading" class="loading-container">
            <el-skeleton :rows="5" animated />
          </div>
          <div v-else-if="activitiesList.length === 0" class="empty-state">
            <el-empty description="暂无动态" :image-size="80" />
          </div>
          <div v-else class="activity-item" v-for="activity in activitiesList" :key="activity.id">
            <div class="activity-avatar">
              <el-avatar :size="40">
                {{ activity.operatorName.charAt(0).toUpperCase() }}
              </el-avatar>
            </div>
            <div class="activity-main">
              <div class="activity-header">
                <span class="activity-user">{{ activity.operatorName }}</span>
                <span class="activity-action">{{ activity.action }}</span>
                <span class="activity-time">{{ formatISODate(activity.createdAt) }}</span>
              </div>
              <div class="activity-message">{{ activity.message }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 邀请成员弹窗 -->
    <el-dialog
      v-model="inviteDialogVisible"
      title="添加成员"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="inviteFormRef"
        :model="inviteForm"
        :rules="inviteFormRules"
        label-width="100px"
      >
        <el-form-item label="选择成员" prop="userIds">
          <el-select
            v-model="inviteForm.userIds"
            multiple
            placeholder="请选择要添加的成员"
            style="width: 100%"
            filterable
          >
            <el-option
              v-for="user in availableUsers"
              :key="user.userId"
              :label="`${user.displayName} (${user.email})`"
              :value="user.userId"
            >
              <div class="user-option">
                <span class="user-name">{{ user.displayName }}</span>
                <span class="user-email">{{ user.email }}</span>
                <el-tag size="small" class="user-role">{{ user.role.name }}</el-tag>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="inviteDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="inviteLoading" @click="handleInviteSubmit">
            确定
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Props {
  projectId: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  back: []
}>()

defineOptions({
  name: 'ProjectDetail',
})

import {
  ArrowLeft,
  Edit,
  User,
  Plus,
  Delete,
  DataAnalysis,
  Folder,
  Document,
  Picture,
  Files,
  Box,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  getProjectDetail,
  getProjectActivities,
  getProjectMembers,
  inviteProjectMember,
  removeProjectMember,
  getOrganizationMembers,
  type ProjectData,
  type ProjectActivity,
  type ProjectMember,
  type OrganizationMember,
  type ActivityListParams,
  type MemberListParams,
  type InviteMembersParams,
} from '@/api/project'
import {
  getProjectFilesByProjectId,
  type FileTypeGroup,
  type ProjectFileInfo,
} from '@/api/fileManage'

// 项目信息
const projectInfo = ref<ProjectData>()

// 项目成员
const membersList = ref<ProjectMember[]>([])
const membersLoading = ref(false)
const membersPagination = ref({
  page: 1,
  pageSize: 10,
  total: 0,
})

// 项目动态
const activitiesList = ref<ProjectActivity[]>([])
const activitiesLoading = ref(false)
const activitiesPagination = ref({
  page: 1,
  pageSize: 10,
  total: 0,
})

// 项目文件
const filesList = ref<FileTypeGroup[]>([])
const filesLoading = ref(false)

// 邀请成员
const inviteDialogVisible = ref(false)
const inviteLoading = ref(false)
const inviteFormRef = ref<FormInstance>()
const inviteForm = ref({
  userIds: [] as number[],
})

// 当前活跃的Tab
const activeTab = ref('members')

// 可邀请用户列表（当前组织成员）
const availableUsers = ref<OrganizationMember[]>([])

// 表单校验规则
const inviteFormRules: FormRules = {
  userIds: [
    { required: true, message: '请选择要邀请的成员', trigger: 'change' },
    { type: 'array', min: 1, message: '至少选择一个成员', trigger: 'change' },
  ],
}

// 获取状态标签类型
const getStatusTag = (status?: string) => {
  if (!status) return 'info'
  const statusMap: Record<string, "info" | "primary" | "success" | "warning"> = {
    planning: 'info',
    in_progress: 'primary',
    completed: 'success',
    archived: 'warning',
  }
  return statusMap[status] || 'info'
}

// 获取状态样式类
const getStatusClass = (status?: string) => {
  if (!status) return 'status-default'
  const classMap: Record<string, string> = {
    planning: 'status-planning',
    in_progress: 'status-progress',
    completed: 'status-completed',
    archived: 'status-archived',
  }
  return classMap[status] || 'status-default'
}

// 获取状态文本
const getStatusText = (status?: string) => {
  if (!status) return '未知'
  const statusMap: Record<string, string> = {
    planning: '规划中',
    in_progress: '进行中',
    completed: '已完成',
    archived: '已归档',
  }
  return statusMap[status] || status
}

// 格式化ISO日期为本地显示格式
const formatISODate = (isoDateString?: string) => {
  if (!isoDateString) return ''

  try {
    const date = new Date(isoDateString)
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')

    return `${year}-${month}-${day} ${hours}:${minutes}`
  } catch (error) {
    return isoDateString
  }
}

// 返回列表
const handleBack = () => {
  emit('back')
}

// 编辑项目
const handleEdit = () => {
  ElMessage.info('编辑功能待实现')
}

// 添加成员
const handleInvite = async () => {
  try {
    // 获取当前组织内可邀请的成员
    const params: MemberListParams = {
      page: 1,
      pageSize: 100, // 获取前100个成员
    }

    const response = await getOrganizationMembers(params)
    availableUsers.value = response.data?.list || []

    // 过滤掉已经是项目成员的用户
    const existingMemberIds = membersList.value.map(member => member.userId)
    availableUsers.value = availableUsers.value.filter(user => !existingMemberIds.includes(user.userId))

    inviteDialogVisible.value = true
    inviteForm.value.userIds = []
  } catch (error) {
    console.error("获取组织成员失败", error)
    ElMessage.error('获取可邀请成员失败')
  }
}

// 编辑项目成员
const handleEditMember = (member: ProjectMember) => {
  ElMessage.info(`编辑成员功能: ${member.displayName}`)
}

// 删除项目成员
const handleRemoveMember = async (member: ProjectMember) => {
  try {
    await ElMessageBox.confirm(
      `确定要移除成员 "${member.displayName}" 吗？`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    const response = await removeProjectMember(props.projectId, member.userId)
    ElMessage.success('移除成功')
    loadMembers() // 重新加载成员列表
  } catch (error) {
    if (error !== 'cancel') {
      console.error("移除项目成员失败", error)
      ElMessage.error('移除失败')
    }
  }
}

// 加载项目动态
const loadActivities = async () => {
  activitiesLoading.value = true
  try {
    const params: ActivityListParams = {
      page: activitiesPagination.value.page,
      pageSize: activitiesPagination.value.pageSize,
    }

    const response = await getProjectActivities(props.projectId, params)
    activitiesList.value = response.data?.list || []
    activitiesPagination.value.total = response.data?.total || 0
  } catch (error) {
    console.error("加载项目动态失败", error)
    ElMessage.error('加载项目动态失败')
    activitiesList.value = []
  } finally {
    activitiesLoading.value = false
  }
}

// 提交邀请
const handleInviteSubmit = async () => {
  if (!inviteFormRef.value) return

  try {
    await inviteFormRef.value.validate()
    inviteLoading.value = true

    const params: InviteMembersParams = {
      userIds: inviteForm.value.userIds,
    }

    const response = await inviteProjectMember(props.projectId, params)
    ElMessage.success('添加成功')
    inviteDialogVisible.value = false
    inviteForm.value.userIds = [] // 清空选择的用户
    loadMembers() // 重新加载成员列表
  } catch (error) {
    console.error("添加项目成员失败", error)
  } finally {
    inviteLoading.value = false
  }
}

// 加载项目详情
const loadProjectDetail = async () => {
  try {
    const response = await getProjectDetail(props.projectId)
    projectInfo.value = response.data
  } catch (error) {
    console.error("加载项目详情失败", error)
    ElMessage.error('加载项目详情失败')
  }
}

// 加载项目成员
const loadMembers = async () => {
  membersLoading.value = true
  try {
    const params: MemberListParams = {
      page: membersPagination.value.page,
      pageSize: membersPagination.value.pageSize,
    }

    const response = await getProjectMembers(props.projectId, params)
    membersList.value = response.data?.list || []
    membersPagination.value.total = response.data?.total || 0
  } catch (error) {
    console.error("加载项目成员失败", error)
    ElMessage.error('加载项目成员失败')
    membersList.value = []
  } finally {
    membersLoading.value = false
  }
}

// 加载项目文件
const loadFiles = async () => {
  filesLoading.value = true
  try {
    const response = await getProjectFilesByProjectId(props.projectId)
    if (response.code === 200) {
      filesList.value = response.data || []
    } else {
      ElMessage.error(response.msg || '加载文件列表失败')
      filesList.value = []
    }
  } catch (error) {
    console.error("加载项目文件失败", error)
    ElMessage.error('加载文件列表失败')
    filesList.value = []
  } finally {
    filesLoading.value = false
  }
}

// 获取 BIM 文件
const getBIMFiles = (): ProjectFileInfo[] => {
  const bimGroup = filesList.value.find(group => group.type === 'bim')
  return bimGroup?.files || []
}

// 获取 CAD 文件
const getCADFiles = (): ProjectFileInfo[] => {
  const cadGroup = filesList.value.find(group => group.type === 'cad')
  return cadGroup?.files || []
}

// 获取点云文件
const getScanFiles = (): ProjectFileInfo[] => {
  const scanGroup = filesList.value.find(group => group.type === 'scan')
  return scanGroup?.files || []
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

onMounted(() => {
  loadProjectDetail()
  loadMembers()
  loadActivities()
  loadFiles()
})
</script>

<style lang="scss" scoped>
.project-detail-container {
  width: 100%;
  height: 100%;
  background: #f5f7fa;
  overflow-y: auto;

  // 顶部导航区域
  .top-navigation {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px 32px;
    background: white;
    border-bottom: 1px solid #e4e7ed;

    .nav-left {
      display: flex;
      align-items: center;
      gap: 16px;

      .back-link {
        color: #606266;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 4px;

        &:hover {
          color: #409eff;
        }
      }

      .project-name {
        font-size: 24px;
        font-weight: 600;
        color: #303133;
        margin: 0;
      }
    }

    .nav-right {
      display: flex;
      align-items: center;
      gap: 16px;

      .status-tag {
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        border: none;

        &.status-planning {
          background: #f0f9ff;
          color: #0284c7;
        }

        &.status-progress {
          background: #dbeafe;
          color: #1d4ed8;
        }

        &.status-completed {
          background: #f0fdf4;
          color: #16a34a;
        }

        &.status-archived {
          background: #fefce8;
          color: #ca8a04;
        }
      }

      .edit-btn {
        border: 1px solid #d1d5db;
        background: white;
        color: #374151;
        border-radius: 8px;

        &:hover {
          border-color: #3b82f6;
          color: #3b82f6;
        }
      }
    }
  }

  // 概览卡片区域
  .overview-cards {
    display: flex;
    gap: 24px;
    padding: 24px 32px;
    background: #f5f7fa;

    .overview-card {
      flex: 1;
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;

        .card-title {
          font-size: 14px;
          color: #6b7280;
          font-weight: 500;
        }

        .card-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f3f4f6;
          color: #6b7280;
        }
      }

      .card-content {
        .progress-value,
        .team-count,
        .files-count {
          font-size: 32px;
          font-weight: 600;
          color: #111827;
          margin-bottom: 8px;
        }

        .progress-info,
        .files-info {
          font-size: 14px;
          color: #52545a;
          margin-bottom: 16px;
        }

        .progress-bar {
          :deep(.el-progress-bar__outer) {
            background: #f3f4f6;
          }

          :deep(.el-progress-bar__inner) {
            background: #3b82f6;
          }
        }

        .team-avatars {
          display: flex;
          align-items: center;
          gap: -8px;

          .avatar {
            border: 2px solid white;
            margin-left: -8px;

            &:first-child {
              margin-left: 0;
            }
          }

          .more-count {
            margin-left: 8px;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #f3f4f6;
            color: #6b7280;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 500;
            border: 2px solid white;
          }
        }

        .files-icons {
          display: flex;
          gap: 8px;

          .file-icon {
            width: 32px;
            height: 32px;
            background: #f3f4f6;
            color: #6b7280;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
        }
      }
    }
  }

  // Tab导航区域
  .tab-navigation {
    display: flex;
    background: white;
    border-bottom: 1px solid #e4e7ed;
    margin: 0 32px;
    border-radius: 12px 12px 0 0;
    overflow: hidden;

    .tab-item {
      padding: 16px 24px;
      cursor: pointer;
      color: #6b7280;
      font-weight: 500;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;

      &:hover {
        color: #3b82f6;
        background: #f8fafc;
      }

      &.active {
        color: #3b82f6;
        border-bottom-color: #3b82f6;
        background: #f8fafc;
      }
    }
  }

  // 内容展示区域
  .content-area {
    background: white;
    margin: 0 32px 32px;
    border-radius: 0 0 12px 12px;
    padding: 24px;

    .members-content {
      .members-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;

        .members-title {
          font-size: 18px;
          font-weight: 600;
          color: #111827;
          margin: 0;
        }

        .add-member-btn {
          background: #3b82f6;
          border: none;
          border-radius: 8px;

          &:hover {
            background: #2563eb;
          }
        }
      }

      .members-list {
        .loading-container {
          padding: 20px 0;
        }

        .member-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 0;
          border-bottom: 1px solid #f3f4f6;

          &:last-child {
            border-bottom: none;
          }

          .member-info {
            display: flex;
            align-items: center;
            gap: 12px;

            .member-avatar {
              background: #3b82f6;
              color: white;
              font-weight: 600;
            }

            .member-details {
              .member-name {
                font-weight: 600;
                color: #111827;
                margin-bottom: 4px;
              }

              .member-position {
                font-size: 14px;
                color: #6b7280;
              }
            }
          }

          .member-actions {
            display: flex;
            gap: 8px;

            .action-btn {
              width: 32px;
              height: 32px;
              border-radius: 6px;
              display: flex;
              align-items: center;
              justify-content: center;

              &.edit-btn {
                color: #3b82f6;
                &:hover {
                  background: #eff6ff;
                }
              }

              &.delete-btn {
                color: #ef4444;
                &:hover {
                  background: #fef2f2;
                }
              }
            }
          }
        }
      }
    }

    .overview-content {
      .overview-info {
        .info-section {
          margin-bottom: 32px;

          &:last-child {
            margin-bottom: 0;
          }

          .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #111827;
            margin-bottom: 16px;
          }

          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;

            .info-item {
              display: flex;
              flex-direction: column;
              gap: 8px;

              label {
                font-size: 14px;
                color: #6b7280;
                font-weight: 500;
              }

              span {
                font-size: 16px;
                color: #111827;
                font-weight: 500;
              }

              .overview-status-tag {
                align-self: flex-start;
              }
            }
          }

          .description-content {
            font-size: 16px;
            color: #374151;
            line-height: 1.6;
            padding: 20px;
            background: #f9fafb;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
          }
        }
      }
    }

    .activities-content {
      .activities-list {
        .loading-container {
          padding: 20px 0;
        }

        .empty-state {
          display: flex;
          justify-content: center;
          padding: 40px 0;
        }

        .activity-item {
          display: flex;
          gap: 16px;
          padding: 20px 0;
          border-bottom: 1px solid #f3f4f6;

          &:last-child {
            border-bottom: none;
          }

          .activity-avatar {
            flex-shrink: 0;
          }

          .activity-main {
            flex: 1;

            .activity-header {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 8px;

              .activity-user {
                font-weight: 600;
                color: #111827;
              }

              .activity-action {
                color: #6b7280;
                font-size: 14px;
              }

              .activity-time {
                color: #9ca3af;
                font-size: 12px;
                margin-left: auto;
              }
            }

            .activity-message {
              color: #374151;
              line-height: 1.5;
              background: #f9fafb;
              padding: 12px 16px;
              border-radius: 8px;
              border: 1px solid #e5e7eb;
            }
          }
        }
      }
    }

    .files-content {
      .loading-container {
        padding: 20px 0;
      }

      .empty-state {
        display: flex;
        justify-content: center;
        padding: 40px 0;
      }

      .files-groups {
        display: flex;
        flex-direction: column;
        gap: 24px;

        .file-group {
          .file-group-header {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-bottom: none;
            border-radius: 8px 8px 0 0;

            .group-icon {
              font-size: 20px;
              color: #409eff;
              margin-right: 8px;
            }

            .group-title {
              font-size: 15px;
              font-weight: 600;
              color: #303133;
              margin-right: 8px;
            }

            .group-count {
              font-size: 13px;
              color: #909399;
            }
          }

          :deep(.el-table) {
            border-radius: 0 0 8px 8px;
            border-top: none;
          }
        }
      }
    }
  }

  .dialog-footer {
    text-align: right;
  }

  // 用户选择器选项样式
  :deep(.el-select-dropdown__item) {
    height: auto;
    padding: 8px 20px;
    line-height: 1.4;

    .user-option {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 100%;

      .user-name {
        font-weight: 500;
        color: #111827;
      }

      .user-email {
        font-size: 12px;
        color: #6b7280;
      }

      .user-role {
        align-self: flex-start;
        margin-top: 4px;
        background: #f3f4f6;
        color: #374151;
        border: none;
      }
    }
  }
}
</style>
