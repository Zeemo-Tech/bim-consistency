<template>
  <div class="layout-header">
    <!-- 左侧区域 -->
    <div class="header-left">
      <!-- 折叠按钮 -->
      <div class="collapse-btn" @click="toggleCollapse">
        <el-icon :size="20">
          <Expand v-if="isCollapse" />
          <Fold v-else />
        </el-icon>
      </div>

      <!-- 面包屑导航 -->
      <el-breadcrumb separator="/" class="breadcrumb">
        <el-breadcrumb-item
          v-for="(item, index) in breadcrumbs"
          :key="index"
          :to="item.path"
        >
          {{ t(item.meta?.title || '') }}
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <!-- 右侧区域 -->
    <div class="header-right">


      <!-- 全屏 -->
      <div class="header-item" @click="toggleFullscreen">
        <el-icon :size="18" class="header-icon">
          <FullScreen v-if="!isFullscreen" />
          <Aim v-else />
        </el-icon>
      </div>

      <!-- 组织切换 -->
      <el-popover
        v-if="currentOrganization"
        placement="bottom-end"
        :width="320"
        trigger="click"
      >
        <template #reference>
          <div class="header-item org-switcher-trigger">
            <el-avatar :size="28" class="org-avatar">
              <el-icon><OfficeBuilding /></el-icon>
            </el-avatar>
            <span class="org-name">{{ currentOrganization.organization.name }}</span>
            <el-icon :size="14" class="arrow-icon-small">
              <ArrowDown />
            </el-icon>
          </div>
        </template>

        <div class="org-switcher-panel">
          <!-- 权限错误提示 -->
          <div v-if="hasPermissionError" class="org-error-section">
            <el-alert
              :title="errorMessage || '仅可查看自己创建的组织'"
              type="warning"
              :closable="false"
              show-icon
            />
          </div>

          <!-- 正常组织展示 -->
          <template v-else>
            <!-- 组织切换 -->
            <div v-for="hq in headquartersList" :key="hq.organization.id" class="org-section">
              <div class="section-title">{{ headquartersList.length > 1 ? '总公司' : '切换组织' }}</div>
              <div
                class="org-item"
                :class="{ 'is-current': currentOrgId === hq.organization.id }"
                @click="switchOrganization(hq.organization.id)"
              >
                <el-avatar :size="32" class="org-item-avatar">
                  <el-icon><OfficeBuilding /></el-icon>
                </el-avatar>
                <div class="org-item-info">
                  <div class="org-item-name">{{ hq.organization.name }}</div>
                  <div class="org-item-contact">{{ hq.organization.contactPerson }}</div>
                  <el-tag v-if="currentOrgId === hq.organization.id" size="small" type="success">
                    当前组织
                  </el-tag>
                </div>
                <el-icon v-if="currentOrgId === hq.organization.id" class="check-icon" color="#67c23a">
                  <Check />
                </el-icon>
              </div>

              <!-- 该总公司下的分公司 -->
              <div v-if="branchesByHeadquarters[hq.organization.id]?.length > 0" class="branches-group">
                <div class="section-title section-subtitle">下属分公司</div>
                <div
                  v-for="branch in branchesByHeadquarters[hq.organization.id]"
                  :key="branch.organization.id"
                  class="org-item branch-item"
                  :class="{ 'is-current': currentOrgId === branch.organization.id }"
                  @click="switchOrganization(branch.organization.id)"
                >
                  <el-avatar :size="24" class="org-item-avatar branch">
                    <el-icon><OfficeBuilding /></el-icon>
                  </el-avatar>
                  <div class="org-item-info">
                    <div class="org-item-name">{{ branch.organization.name }}</div>
                    <div class="org-item-contact">{{ branch.organization.contactPerson }}</div>
                  </div>
                  <el-icon v-if="currentOrgId === branch.organization.id" class="check-icon" color="#67c23a">
                    <Check />
                  </el-icon>
                </div>
              </div>
            </div>
          </template>

          <!-- 管理组织 -->
          <div v-if="canManageOrganization" class="org-footer">
            <div class="manage-org-btn" @click="goToOrganizationManagement">
              <el-icon><Setting /></el-icon>
              <span>管理组织</span>
            </div>
          </div>
        </div>
      </el-popover>

      <!-- 主题切换 -->
      <div class="header-item" @click="toggleTheme">
        <el-icon :size="18" class="header-icon">
          <Moon v-if="!isDark" />
          <Sunny v-else />
        </el-icon>
      </div>

      <!-- 通知 -->
      <el-popover
        placement="bottom-end"
        :width="380"
        trigger="click"
        :visible="notificationVisible"
        @show="handleNotificationPanelShow"
        @hide="notificationVisible = false"
      >
        <template #reference>
          <div class="header-item notification-bell" @click="notificationVisible = !notificationVisible">
            <el-badge :value="unreadCount" :hidden="unreadCount === 0" class="notification-badge">
              <el-icon :size="18" class="header-icon">
                <Bell />
              </el-icon>
            </el-badge>
          </div>
        </template>

        <div class="notification-panel" v-loading="notificationLoading">
          <!-- 头部 -->
          <div class="notification-header">
            <span class="notification-title">通知</span>
            <div class="notification-actions">
              <span class="mark-all-read" @click="markAllAsRead">
                全部已读
              </span>
              <span class="view-all" @click="goToNotificationCenter">
                消息中心
              </span>
            </div>
          </div>

          <!-- 通知列表 -->
          <div class="notification-list">
            <el-empty
              v-if="displayedNotifications.length === 0"
              description="暂无通知"
              :image-size="80"
            />
            <div
              v-for="notification in displayedNotifications"
              :key="notification.id"
              class="notification-item"
              :class="{ 'is-read': notification.status !== 'unread' }"
              @click="handleNotificationClick(notification)"
            >
              <div class="notification-content">
                <div class="notification-header-info">
                  <div class="notification-title-group">
                    <span class="notification-title-text">{{ getNotificationTypeLabel(notification.type) }}</span>
                    <el-tag
                      v-if="notification.status"
                      size="small"
                      effect="plain"
                      :type="getNotificationStatusTagType(notification.status)"
                    >
                      {{ getNotificationStatusLabel(notification.status) }}
                    </el-tag>
                  </div>
                  <span class="notification-time">{{ formatNotificationTime(notification.createdAt) }}</span>
                </div>
                <div class="notification-desc">{{ notification.content }}</div>
              </div>
              <div
                v-if="notification.status === 'unread'"
                class="notification-dot"
              ></div>
            </div>
          </div>
        </div>
      </el-popover>

      <!-- 用户信息 -->
      <el-dropdown class="header-item user-dropdown" trigger="click" @command="handleCommand">
        <div class="user-info">
          <el-avatar :size="32" src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png" />
          <span class="username">{{ username }}</span>
          <el-icon class="arrow-icon">
            <ArrowDown />
          </el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="profile">
              <el-icon><User /></el-icon>
              {{ t('buttons.myInformation') }}
            </el-dropdown-item>
            <el-dropdown-item command="system">
              <el-icon><Setting /></el-icon>
              系统管理
            </el-dropdown-item>
            <el-dropdown-item divided command="logout">
              <el-icon><SwitchButton /></el-icon>
              {{ t('buttons.pureLoginOut') }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <!-- 用户信息抽屉 -->
    <UserInfoDrawer v-model="userInfoDrawerVisible" :initial-section="userInfoInitialSection" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { i18n } from '@/plugins/i18n'
import { useUserStoreHook } from '@/store/modules/user'
import { usePermissionStoreHook } from '@/store/modules/permission'
import { useReportAccessStoreHook } from '@/store/modules/report-access'
import { useOrganizationStoreHook } from '@/store/modules/organization'
import { useBrandStoreHook } from '@/store/modules/brand'
import { resetRouter } from '@/router'
import { storageLocal } from '@pureadmin/utils'
import { responsiveStorageNameSpace } from '@/config'
import { message } from '@/utils/message'
import UserInfoDrawer from '@/components/UserInfoDrawer/index.vue'
import {
  formatNotificationTime,
  getNotificationList,
  getNotificationStatusLabel,
  getNotificationStatusTagType,
  getNotificationTypeLabel,
  getNotificationUnreadCount,
  markAllNotificationsAsRead,
  updateNotificationStatus,
  type NotificationListItem,
} from '@/api/notification'
import {
  Search,
  FullScreen,
  Aim,
  Moon,
  Sunny,
  ArrowDown,
  User,
  SwitchButton,
  Expand,
  Fold,
  Bell,
  Check,
  OfficeBuilding,
  Setting,
} from '@element-plus/icons-vue'

const props = defineProps<{
  isCollapse: boolean
}>()

const emit = defineEmits<{
  'update:isCollapse': [value: boolean]
}>()

const router = useRouter()
const route = useRoute()
const userStore = useUserStoreHook()
const organizationStore = useOrganizationStoreHook()
const brandStore = useBrandStoreHook()
const nameSpace = responsiveStorageNameSpace()

const t = (key: string) => (i18n.global.t as any)(key)

// 全屏状态
const isFullscreen = ref(false)

// 用户信息抽屉
const userInfoDrawerVisible = ref(false)
const userInfoInitialSection = ref<'profile' | 'system'>('profile')

// 用户名 - 优先显示nickname，没有则显示username，都没有则显示邮箱或默认值
const username = computed(() => {
  if (userStore.nickname) return userStore.nickname;
  if (userStore.username) return userStore.username;
  if (userStore.email) return userStore.email;
  // 最后的备选方案
  return '小塔';
})

// 暗黑模式
const isDark = ref(
  (storageLocal().getItem(`${nameSpace}layout`) as any)?.darkMode ?? false
)

// 面包屑
const breadcrumbs = computed(() => {
  const matched = route.matched.filter((item) => {
    // 过滤掉根路由（避免页面都显示"首页"）
    if (item.path === '/') return false
    // 过滤掉没有title的路由
    if (!item.meta?.title) return false
    // 过滤掉 showLink 为 false 的路由
    if (item.meta?.showLink === false) return false
    return true
  })

  return matched
})

// 通知相关数据
const notificationPreviewLimit = 6
const notifications = ref<NotificationListItem[]>([])
const notificationVisible = ref(false)
const notificationLoading = ref(false)
const unreadCount = ref(0)

const displayedNotifications = computed(() => notifications.value)

const loadNotificationPreview = async () => {
  notificationLoading.value = true
  try {
    const [listRes, countRes] = await Promise.all([
      getNotificationList({
        box: 'inbox',
        page: 1,
        pageSize: notificationPreviewLimit,
      }),
      getNotificationUnreadCount(),
    ])
    if (listRes.code === 200) {
      notifications.value = listRes.data.list
    } else {
      notifications.value = []
    }
    unreadCount.value = countRes.code === 200 ? countRes.data.unreadCount : 0
  } catch (_error) {
    notifications.value = []
    unreadCount.value = 0
  } finally {
    notificationLoading.value = false
  }
}

// 折叠/展开侧边栏
const toggleCollapse = () => {
  emit('update:isCollapse', !props.isCollapse)
}

// 切换全屏
const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
    isFullscreen.value = true
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen()
      isFullscreen.value = false
    }
  }
}

// 切换主题
const toggleTheme = () => {
  const key = `${nameSpace}layout`
  const layoutData = (storageLocal().getItem(key) as any) || {}
  layoutData.darkMode = !isDark.value
  layoutData.theme = layoutData.darkMode ? 'dark' : 'light'
  storageLocal().setItem(key, layoutData)

  isDark.value = layoutData.darkMode // ✅ 更新响应式状态

  document.documentElement.classList.toggle('dark', layoutData.darkMode)
}
// 通知相关方法
const handleNotificationClick = async (notification: NotificationListItem) => {
  try {
    if (notification.status === 'unread') {
      await updateNotificationStatus(notification.id, 'read')
    }
    notificationVisible.value = false
    await loadNotificationPreview()
    router.push({
      path: '/notifications',
      query: {
        focusId: String(notification.id),
        focusBox: 'inbox',
      },
    })
  } catch (_error) {
    message('通知跳转失败', { type: 'error' })
  }
}

const markAllAsRead = async () => {
  await markAllNotificationsAsRead()
  await loadNotificationPreview()
}

const goToNotificationCenter = () => {
  notificationVisible.value = false
  router.push('/notifications')
}

const handleNotificationPanelShow = () => {
  void loadNotificationPreview()
}

// 用户菜单命令
const handleCommand = (command: string) => {
  switch (command) {
    case 'profile':
      userInfoInitialSection.value = 'profile'
      userInfoDrawerVisible.value = true
      break
    case 'system':
      userInfoInitialSection.value = 'system'
      userInfoDrawerVisible.value = true
      break
    case 'logout':
      userStore.logOut().then(() => {
        // 清空权限和菜单数据
        const permissionStore = usePermissionStoreHook()
        permissionStore.clearPermission()
        const reportAccessStore = useReportAccessStoreHook()
        reportAccessStore.clear()

        // 重置路由
        resetRouter()

        // 跳转到登录页
        router.push('/login')
        message(t('buttons.pureLoginOutSuccess'), { type: 'success' })
      })
      break
  }
}

// ==================== 组织切换相关 ====================
// 使用 store 中的组织数据
const currentOrganization = computed(() => organizationStore.currentOrganization)
const headquartersList = computed(() => organizationStore.headquartersList)
const branchesByHeadquarters = computed(() => organizationStore.branchesByHeadquarters)
const currentOrgId = computed(() => organizationStore.currentOrgId)
const hasPermissionError = computed(() => organizationStore.hasPermissionError)
const errorMessage = computed(() => organizationStore.error)
const canManageOrganization = computed(() => organizationStore.canManageOrganization)

// 切换组织
const switchOrganization = async (orgId: number) => {
  if (orgId === currentOrgId.value) return

  await organizationStore.switchOrganization(orgId)
  await brandStore.fetchBrand()
  message('组织切换成功', { type: 'success' })

  // 刷新页面以应用新的组织ID
  setTimeout(() => {
    window.location.reload()
  }, 500)
}

// 跳转到组织管理页面
const goToOrganizationManagement = () => {
  router.push('/system/organizations')
}

// 初始化
onMounted(() => {
  // 初始化用户信息（解决刷新后用户名显示问题）
  if (!userStore.username) {
    userStore.initUserInfo()
  }

  void loadNotificationPreview()
  organizationStore.fetchOrganizations()
})
</script>

<style lang="scss" scoped>
.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
  padding: 0 20px;
  background-color: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);

  .header-left {
    display: flex;
    align-items: center;
    gap: 20px;

    .collapse-btn {
      display: flex;
      align-items: center;
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        color: var(--el-color-primary);
      }
    }

    .breadcrumb {
      font-size: 14px;
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 15px;

    .header-item {
      display: flex;
      align-items: center;
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        color: var(--el-color-primary);
      }

      .header-icon {
        display: flex;
        align-items: center;
      }

    }

    .user-dropdown {
      .user-info {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;

        .username {
          font-size: 14px;
          font-weight: 500;
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .arrow-icon {
          font-size: 12px;
          transition: transform 0.3s;
        }
      }

      &:hover .arrow-icon {
        transform: rotate(180deg);
      }
    }
  }
}

// 通知相关样式
.notification-bell {
  position: relative;

  .notification-badge {
    :deep(.el-badge__content) {
      transform: translateX(-4px) translateY(-4px);
    }
  }
}

.notification-panel {
  padding: 0;
  max-height: 480px;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .notification-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--el-border-color-light);

    .notification-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    .notification-actions {
      display: flex;
      align-items: center;
      gap: 10px;

      .mark-all-read {
        font-size: 13px;
        color: var(--el-color-primary);
        cursor: pointer;

        &:hover {
          color: var(--el-color-primary-light-3);
        }
      }

      .view-all {
        font-size: 13px;
        color: var(--el-text-color-regular);
        cursor: pointer;

        &:hover {
          color: var(--el-color-primary);
        }
      }
    }
  }

  .notification-list {
    flex: 1;
    overflow-y: auto;
    max-height: 360px;

    .notification-item {
      position: relative;
      padding: 16px 20px;
      cursor: pointer;
      transition: background-color 0.3s;
      border-bottom: 1px solid var(--el-border-color-lighter);

      &:hover {
        background-color: var(--el-fill-color-lighter);
      }

      &.is-read {
        .notification-title-text {
          color: var(--el-text-color-regular);
        }
        .notification-desc {
          color: var(--el-text-color-secondary);
        }
      }

      &:last-child {
        border-bottom: none;
      }

      .notification-content {
        flex: 1;
        margin-right: 8px;

        .notification-header-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 6px;

          .notification-title-group {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
          }

          .notification-title-text {
            font-size: 14px;
            font-weight: 500;
            color: var(--el-text-color-primary);
            min-width: 0;
          }

          .notification-time {
            flex-shrink: 0;
            font-size: 12px;
            color: var(--el-text-color-placeholder);
          }
        }

        .notification-desc {
          font-size: 13px;
          color: var(--el-text-color-regular);
          line-height: 1.4;
        }
      }

      .notification-dot {
        position: absolute;
        top: 18px;
        right: 16px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: var(--el-color-primary);
      }
    }

    :deep(.el-empty) {
      margin: 16px 0;
    }
  }
}

// 组织切换相关样式
.org-switcher-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 8px;
  background-color: var(--el-fill-color-lighter);
  transition: all 0.3s;

  &:hover {
    background-color: var(--el-fill-color);
  }

  .org-avatar {
    background-color: var(--el-color-primary);
    color: #fff;
  }

  .org-name {
    font-size: 14px;
    font-weight: 500;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .arrow-icon-small {
    transition: transform 0.3s;
  }
}

.org-switcher-panel {
  padding: 0;

  .org-error-section {
    padding: 16px;
  }

  .org-section {
    padding: 12px 0;

    &:not(:last-child) {
      border-bottom: 1px solid var(--el-border-color-lighter);
    }

    .section-title {
      padding: 0 16px 8px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      font-weight: 500;

      &.section-subtitle {
        padding-left: 32px;
        margin-top: 8px;
        font-size: 11px;
      }
    }

    .org-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      cursor: pointer;
      transition: all 0.3s;
      position: relative;

      &:hover {
        background-color: var(--el-fill-color-lighter);
      }

      &.is-current {
        background-color: var(--el-color-primary-light-9);
      }

      &.branch-item {
        padding-left: 32px;
      }

      .org-item-avatar {
        flex-shrink: 0;
        background-color: var(--el-color-primary);
        color: #fff;

        &.branch {
          background-color: var(--el-color-info);
        }
      }

      .org-item-info {
        flex: 1;
        min-width: 0;

        .org-item-name {
          font-size: 14px;
          font-weight: 500;
          color: var(--el-text-color-primary);
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .org-item-contact {
          font-size: 12px;
          color: var(--el-text-color-regular);
          opacity: 0.8;
        }
      }

      .check-icon {
        flex-shrink: 0;
        font-size: 18px;
      }
    }

    .branches-group {
      .branch-item {
        background-color: var(--el-fill-color-lighter);

        &:hover {
          background-color: var(--el-fill-color);
        }

        &.is-current {
          background-color: var(--el-color-primary-light-9);
        }
      }
    }
  }

  .org-footer {
    padding: 8px 16px;
    border-top: 1px solid var(--el-border-color-lighter);

    .manage-org-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      color: var(--el-color-primary);
      background-color: var(--el-color-primary-light-9);
      transition: all 0.3s;

      &:hover {
        background-color: var(--el-color-primary-light-8);
      }

      span {
        font-weight: 500;
      }
    }
  }
}

</style>
