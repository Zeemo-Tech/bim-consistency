<template>
  <div class="cb-header-actions">
    <!-- 全屏 -->
    <div class="cb-header-item" @click="toggleFullscreen">
      <el-icon :size="18" class="cb-header-icon">
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
        <div class="cb-header-item cb-org-trigger">
          <el-avatar :size="28" class="cb-org-avatar">
            <el-icon><OfficeBuilding /></el-icon>
          </el-avatar>
          <span class="cb-org-name">
            {{ currentOrganization.organization.name }}
          </span>
          <el-icon :size="14" class="cb-arrow-icon">
            <ArrowDown />
          </el-icon>
        </div>
      </template>

      <div class="cb-org-panel">
        <div v-if="hasPermissionError" class="cb-org-error">
          <el-alert
            :title="errorMessage || '仅可查看自己创建的组织'"
            type="warning"
            :closable="false"
            show-icon
          />
        </div>

        <template v-else>
          <div
            v-for="hq in headquartersList"
            :key="hq.organization.id"
            class="cb-org-section"
          >
            <div class="cb-org-section-title">
              {{ headquartersList.length > 1 ? '总公司' : '切换组织' }}
            </div>
            <div
              class="cb-org-item"
              :class="{ 'is-current': currentOrgId === hq.organization.id }"
              @click="switchOrganization(hq.organization.id)"
            >
              <el-avatar :size="32" class="cb-org-item-avatar">
                <el-icon><OfficeBuilding /></el-icon>
              </el-avatar>
              <div class="cb-org-item-info">
                <div class="cb-org-item-name">{{ hq.organization.name }}</div>
                <div class="cb-org-item-contact">
                  {{ hq.organization.contactPerson }}
                </div>
                <el-tag
                  v-if="currentOrgId === hq.organization.id"
                  size="small"
                  type="success"
                >
                  当前组织
                </el-tag>
              </div>
              <el-icon
                v-if="currentOrgId === hq.organization.id"
                class="cb-check-icon"
                color="#67c23a"
              >
                <Check />
              </el-icon>
            </div>

            <div
              v-if="branchesByHeadquarters[hq.organization.id]?.length > 0"
              class="cb-branches"
            >
              <div class="cb-org-section-title is-sub">下属分公司</div>
              <div
                v-for="branch in branchesByHeadquarters[hq.organization.id]"
                :key="branch.organization.id"
                class="cb-org-item is-branch"
                :class="{
                  'is-current': currentOrgId === branch.organization.id,
                }"
                @click="switchOrganization(branch.organization.id)"
              >
                <el-avatar :size="24" class="cb-org-item-avatar is-branch">
                  <el-icon><OfficeBuilding /></el-icon>
                </el-avatar>
                <div class="cb-org-item-info">
                  <div class="cb-org-item-name">
                    {{ branch.organization.name }}
                  </div>
                  <div class="cb-org-item-contact">
                    {{ branch.organization.contactPerson }}
                  </div>
                </div>
                <el-icon
                  v-if="currentOrgId === branch.organization.id"
                  class="cb-check-icon"
                  color="#67c23a"
                >
                  <Check />
                </el-icon>
              </div>
            </div>
          </div>
        </template>

        <div v-if="canManageOrganization" class="cb-org-footer">
          <div class="cb-manage-org" @click="goToOrganizationManagement">
            <el-icon><Setting /></el-icon>
            <span>管理组织</span>
          </div>
        </div>
      </div>
    </el-popover>

    <!-- 主题切换 -->
    <div class="cb-header-item" @click="toggleTheme">
      <el-icon :size="18" class="cb-header-icon">
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
        <div
          class="cb-header-item cb-notification-bell"
          @click="notificationVisible = !notificationVisible"
        >
          <el-badge
            :value="unreadCount"
            :hidden="unreadCount === 0"
            class="cb-notification-badge"
          >
            <el-icon :size="18" class="cb-header-icon">
              <Bell />
            </el-icon>
          </el-badge>
        </div>
      </template>

      <div v-loading="notificationLoading" class="cb-notification-panel">
        <div class="cb-notification-header">
          <span class="cb-notification-title">通知</span>
          <div class="cb-notification-actions">
            <span class="cb-mark-all-read" @click="markAllAsRead">
              全部已读
            </span>
            <span class="cb-view-all" @click="goToNotificationCenter">
              消息中心
            </span>
          </div>
        </div>

        <div class="cb-notification-list">
          <el-empty
            v-if="displayedNotifications.length === 0"
            description="暂无通知"
            :image-size="80"
          />
          <div
            v-for="notification in displayedNotifications"
            :key="notification.id"
            class="cb-notification-item"
            :class="{ 'is-read': notification.status !== 'unread' }"
            @click="handleNotificationClick(notification)"
          >
            <div class="cb-notification-content">
              <div class="cb-notification-info">
                <div class="cb-notification-title-group">
                  <span class="cb-notification-title-text">
                    {{ getNotificationTypeLabel(notification.type) }}
                  </span>
                  <el-tag
                    v-if="notification.status"
                    size="small"
                    effect="plain"
                    :type="getNotificationStatusTagType(notification.status)"
                  >
                    {{ getNotificationStatusLabel(notification.status) }}
                  </el-tag>
                </div>
                <span class="cb-notification-time">
                  {{ formatNotificationTime(notification.createdAt) }}
                </span>
              </div>
              <div class="cb-notification-desc">{{ notification.content }}</div>
            </div>
            <div
              v-if="notification.status === 'unread'"
              class="cb-notification-dot"
            />
          </div>
        </div>
      </div>
    </el-popover>

    <!-- 用户信息 -->
    <el-dropdown
      class="cb-header-item cb-user-dropdown"
      trigger="click"
      @command="handleCommand"
    >
      <div class="cb-user-info">
        <el-avatar :size="32" :src="avatarUrl" />
        <span class="cb-username">{{ username }}</span>
        <el-icon class="cb-arrow-icon"><ArrowDown /></el-icon>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="profile">
            <el-icon><User /></el-icon>
            {{ t('buttons.myInformation') }}
          </el-dropdown-item>
          <el-dropdown-item command="brand">
            <el-icon><Picture /></el-icon>
            品牌设置
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

    <UserInfoDrawer
      v-model="userInfoDrawerVisible"
      :initial-section="userInfoInitialSection"
    />
  </div>
</template>

<script lang="ts">
// 顶栏在每次切换页面时都会重新挂载，这里做会话级去重，
// 保证「通知」只在首次进入时请求一次，避免导航时重复并发请求后端
let notificationPreviewInitialized = false
</script>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
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
  FullScreen,
  Aim,
  Moon,
  Sunny,
  ArrowDown,
  User,
  SwitchButton,
  Bell,
  Check,
  OfficeBuilding,
  Picture,
  Setting,
} from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStoreHook()
const organizationStore = useOrganizationStoreHook()
const brandStore = useBrandStoreHook()
const nameSpace = responsiveStorageNameSpace()

const t = (key: string) => (i18n.global.t as any)(key)

const isFullscreen = ref(false)
const userInfoDrawerVisible = ref(false)
const userInfoInitialSection = ref<'profile' | 'system'>('profile')

const username = computed(() => {
  if (userStore.nickname) return userStore.nickname
  if (userStore.username) return userStore.username
  if (userStore.email) return userStore.email
  return '小塔'
})

const avatarUrl =
  'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png'

const isDark = ref(
  (storageLocal().getItem(`${nameSpace}layout`) as any)?.darkMode ?? false,
)

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
    notifications.value = listRes.code === 200 ? listRes.data.list : []
    unreadCount.value = countRes.code === 200 ? countRes.data.unreadCount : 0
  } catch (_error) {
    notifications.value = []
    unreadCount.value = 0
  } finally {
    notificationLoading.value = false
  }
}

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
    isFullscreen.value = true
  } else if (document.exitFullscreen) {
    document.exitFullscreen()
    isFullscreen.value = false
  }
}

const toggleTheme = () => {
  const key = `${nameSpace}layout`
  const layoutData = (storageLocal().getItem(key) as any) || {}
  layoutData.darkMode = !isDark.value
  layoutData.theme = layoutData.darkMode ? 'dark' : 'light'
  storageLocal().setItem(key, layoutData)

  isDark.value = layoutData.darkMode
  document.documentElement.classList.toggle('dark', layoutData.darkMode)
}

const handleNotificationClick = async (notification: NotificationListItem) => {
  try {
    if (notification.status === 'unread') {
      await updateNotificationStatus(notification.id, 'read')
    }
    notificationVisible.value = false
    await loadNotificationPreview()
    router.push({
      path: '/notifications',
      query: { focusId: String(notification.id), focusBox: 'inbox' },
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

const handleCommand = (command: string) => {
  switch (command) {
    case 'profile':
      userInfoInitialSection.value = 'profile'
      userInfoDrawerVisible.value = true
      break
    case 'brand':
      userInfoInitialSection.value = 'system'
      userInfoDrawerVisible.value = true
      break
    case 'system':
      router.push('/system')
      break
    case 'logout':
      userStore.logOut().then(() => {
        const permissionStore = usePermissionStoreHook()
        permissionStore.clearPermission()
        const reportAccessStore = useReportAccessStoreHook()
        reportAccessStore.clear()
        resetRouter()
        router.push('/login')
        message(t('buttons.pureLoginOutSuccess'), { type: 'success' })
      })
      break
  }
}

const currentOrganization = computed(
  () => organizationStore.currentOrganization,
)
const headquartersList = computed(() => organizationStore.headquartersList)
const branchesByHeadquarters = computed(
  () => organizationStore.branchesByHeadquarters,
)
const currentOrgId = computed(() => organizationStore.currentOrgId)
const hasPermissionError = computed(() => organizationStore.hasPermissionError)
const errorMessage = computed(() => organizationStore.error)
const canManageOrganization = computed(
  () => organizationStore.canManageOrganization,
)

const switchOrganization = async (orgId: number) => {
  if (orgId === currentOrgId.value) return
  await organizationStore.switchOrganization(orgId)
  await brandStore.fetchBrand()
  message('组织切换成功', { type: 'success' })
  setTimeout(() => {
    window.location.reload()
  }, 500)
}

const goToOrganizationManagement = () => {
  router.push('/system')
}

onMounted(() => {
  if (!userStore.username) {
    userStore.initUserInfo()
  }
  if (!notificationPreviewInitialized) {
    notificationPreviewInitialized = true
    void loadNotificationPreview()
  }
  void organizationStore.ensureOrganizations()
})
</script>

<style lang="scss" scoped>
.cb-header-actions {
  display: flex;
  flex: 0 0 auto;
  gap: var(--spacing-md);
  align-items: center;
}

.cb-header-item {
  display: flex;
  align-items: center;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color var(--transition-fast);
}

.cb-header-item:hover {
  color: var(--color-primary);
}

.cb-header-icon {
  display: flex;
  align-items: center;
}

.cb-arrow-icon {
  font-size: 12px;
  transition: transform var(--transition-fast);
}

.cb-org-trigger {
  gap: var(--spacing-sm);
  padding: 5px 12px;
  background: var(--bg-control);
  border-radius: var(--radius-sm);
}

.cb-org-trigger:hover {
  background: var(--bg-control-hover);
}

.cb-org-avatar {
  color: #fff;
  background: var(--color-primary);
}

.cb-org-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
}

.cb-org-trigger:hover .cb-arrow-icon,
.cb-user-dropdown:hover .cb-arrow-icon {
  transform: rotate(180deg);
}

.cb-notification-bell :deep(.el-badge__content) {
  transform: translateX(-4px) translateY(-4px);
}

.cb-user-info {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
  cursor: pointer;
}

.cb-username {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
}

.cb-user-dropdown:hover .cb-arrow-icon {
  transform: rotate(180deg);
}

.cb-org-panel {
  padding: 0;
}

.cb-org-error {
  padding: 16px;
}

.cb-org-section {
  padding: 12px 0;
}

.cb-org-section:not(:last-child) {
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.cb-org-section-title {
  padding: 0 16px 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
}

.cb-org-section-title.is-sub {
  padding-left: 32px;
  margin-top: 8px;
  font-size: 11px;
}

.cb-org-item {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.cb-org-item:hover {
  background: var(--el-fill-color-lighter);
}

.cb-org-item.is-current {
  background: var(--el-color-primary-light-9);
}

.cb-org-item.is-branch {
  padding-left: 32px;
  background: var(--el-fill-color-lighter);
}

.cb-org-item-avatar {
  flex-shrink: 0;
  color: #fff;
  background: var(--el-color-primary);
}

.cb-org-item-avatar.is-branch {
  background: var(--el-color-info);
}

.cb-org-item-info {
  flex: 1;
  min-width: 0;
}

.cb-org-item-name {
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.cb-org-item-contact {
  font-size: 12px;
  color: var(--el-text-color-regular);
  opacity: 0.8;
}

.cb-check-icon {
  flex-shrink: 0;
  font-size: 18px;
}

.cb-org-footer {
  padding: 8px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.cb-manage-org {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--el-color-primary);
  cursor: pointer;
  background: var(--el-color-primary-light-9);
  border-radius: 6px;
}

.cb-notification-panel {
  display: flex;
  flex-direction: column;
  max-height: 480px;
  padding: 0;
  overflow: hidden;
}

.cb-notification-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.cb-notification-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.cb-notification-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.cb-mark-all-read {
  font-size: 13px;
  color: var(--el-color-primary);
  cursor: pointer;
}

.cb-view-all {
  font-size: 13px;
  color: var(--el-text-color-regular);
  cursor: pointer;
}

.cb-notification-list {
  flex: 1;
  max-height: 360px;
  overflow-y: auto;
}

.cb-notification-item {
  position: relative;
  display: flex;
  padding: 16px 20px;
  cursor: pointer;
  border-bottom: 1px solid var(--el-border-color-lighter);
  transition: background-color var(--transition-fast);
}

.cb-notification-item:hover {
  background: var(--el-fill-color-lighter);
}

.cb-notification-item:last-child {
  border-bottom: none;
}

.cb-notification-content {
  flex: 1;
  min-width: 0;
  margin-right: 8px;
}

.cb-notification-info {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.cb-notification-title-group {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.cb-notification-title-text {
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.cb-notification-time {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.cb-notification-desc {
  font-size: 13px;
  line-height: 1.4;
  color: var(--el-text-color-regular);
}

.cb-notification-dot {
  position: absolute;
  top: 18px;
  right: 16px;
  width: 8px;
  height: 8px;
  background: var(--el-color-primary);
  border-radius: 50%;
}
</style>
