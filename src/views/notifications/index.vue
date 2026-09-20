<template>
  <div class="notifications-page">
    <section class="hero-card">
      <div class="hero-main">
        <p class="hero-kicker">Notification Center</p>
        <h2 class="page-title">消息中心</h2>
        <p class="page-subtitle">
          统一查看收件箱与已发送消息，快速筛选、精准定位、追踪历史通知。
        </p>
        <div class="hero-meta">
          <el-tag effect="plain" round>{{ activeBoxLabel }}</el-tag>
          <span class="refresh-time">最后刷新：{{ refreshedAt || '--' }}</span>
        </div>
      </div>

      <div class="hero-stats">
        <div
          v-for="item in summaryCards"
          :key="item.key"
          class="stat-card"
          :class="`is-${item.key}`"
        >
          <div class="stat-label">{{ item.label }}</div>
          <div class="stat-value">{{ item.value }}</div>
        </div>
      </div>
    </section>

    <section class="panel-card list-panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">消息列表</div>
          <div class="panel-subtitle">
            点击任意行可查看详情，收件箱未读消息会自动置为已读。
          </div>
        </div>
        <div class="list-actions">
          <el-tag effect="plain" type="info">共 {{ total }} 条</el-tag>
          <el-button
            text
            type="primary"
            :loading="loading"
            @click="handleManualRefresh"
          >
            刷新数据
          </el-button>
        </div>
      </div>

      <div class="list-toolbar">
        <el-tabs
          v-model="activeTab"
          class="list-tabs"
          @tab-change="handleTabChange"
        >
          <el-tab-pane label="已接收" name="inbox" />
          <el-tab-pane label="已发送" name="sent" />
        </el-tabs>

        <div class="toolbar-filters">
          <el-select
            v-model="statusFilter"
            class="toolbar-filter-item status-select"
            :disabled="activeTab === 'sent'"
          >
            <el-option label="全部状态" value="all" />
            <el-option label="未读" value="unread" />
            <el-option label="已读" value="read" />
            <el-option label="已完成" value="done" />
          </el-select>

          <el-select
            v-model="typeFilter"
            class="toolbar-filter-item type-select"
          >
            <el-option label="全部类型" value="all" />
            <el-option label="批注邀请" value="annotation_invite" />
            <el-option label="系统公告" value="system_announcement" />
          </el-select>

          <el-input
            v-model="senderFilter"
            clearable
            class="toolbar-filter-item sender-input"
            placeholder="按标题/内容/发送人筛选"
            @keyup.enter="handleFilterSearch"
          />

          <el-button type="primary" @click="handleFilterSearch">筛选</el-button>
          <el-button @click="handleFilterReset">重置</el-button>
        </div>
      </div>

      <div class="list-content">
        <NotificationListTable
          ref="tableRef"
          :items="list"
          :loading="loading"
          :page="page"
          :page-size="pageSize"
          :total="total"
          :focus-id="focusId"
          @row-click="handleRowClick"
          @page-change="handlePageChange"
        />
      </div>
    </section>

    <NotificationDetailDialog
      v-model="detailVisible"
      :notification="currentDetail"
      :box="activeTab"
      @change-status="handleChangeNotificationStatus"
      @replay="handleReplayAnnotation"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  getNotificationDetail,
  getNotificationList,
  getNotificationUnreadCount,
  updateNotificationStatus,
  type NotificationBox,
  type NotificationDetail,
  type NotificationListItem,
  type NotificationStatus,
  type NotificationType,
} from '@/api/notification'
import NotificationListTable from './components/NotificationListTable.vue'
import NotificationDetailDialog from './components/NotificationDetailDialog.vue'

const annotationReplayStorageKeyPrefix = 'two-screen:annotation-replay:'

interface ReplayAnnotationSnapshot {
  id: number | null
  key: string
  title: string
  period: string[]
  severity: string
  source: 'bim' | 'pointcloud'
  componentName: string
  componentId: string
  componentType: string
  point: { x: number; y: number; z: number } | null
  remark: string
  screenshots: Array<{
    url: string
    fileId: number | null
    originalName?: string
    fileSize?: number | null
    sortOrder: number
  }>
  viewState?: Record<string, any> | null
}

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const list = ref<NotificationListItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const focusId = ref<number | null>(null)
const activeTab = ref<NotificationBox>('inbox')
const statusFilter = ref<'all' | NotificationStatus>('all')
const typeFilter = ref<'all' | NotificationType>('all')
const senderFilter = ref('')

const detailVisible = ref(false)
const currentDetail = ref<NotificationDetail | null>(null)
const refreshedAt = ref('')

const overview = reactive({
  unread: 0,
  inbox: 0,
  sent: 0,
  all: 0,
})

const tableRef = ref<InstanceType<typeof NotificationListTable> | null>(null)

const activeBoxLabel = computed(() => {
  return activeTab.value === 'inbox' ? '当前视角：已接收' : '当前视角：已发送'
})

const summaryCards = computed(() => {
  return [
    { key: 'unread', label: '未读消息', value: overview.unread },
    { key: 'inbox', label: '收件箱总数', value: overview.inbox },
    { key: 'sent', label: '已发送总数', value: overview.sent },
    { key: 'all', label: '全部消息', value: overview.all },
  ]
})

const formatNow = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  const second = `${date.getSeconds()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

const buildListQuery = () => {
  const query: Parameters<typeof getNotificationList>[0] = {
    page: page.value,
    pageSize: pageSize.value,
    box: activeTab.value,
    keyword: senderFilter.value.trim() || undefined,
  }
  if (activeTab.value === 'inbox' && statusFilter.value !== 'all') {
    query.status = statusFilter.value
  }
  if (typeFilter.value !== 'all') {
    query.type = typeFilter.value
  }
  return query
}

const loadList = async () => {
  loading.value = true
  try {
    const res = await getNotificationList(buildListQuery())
    if (res.code !== 200) {
      throw new Error(res.msg || '消息加载失败')
    }
    list.value = res.data.list || []
    total.value = res.data.total || 0
    refreshedAt.value = formatNow()
    await nextTick()
    if (focusId.value != null) {
      tableRef.value?.scrollToNotification(focusId.value)
    }
  } catch (error: any) {
    list.value = []
    total.value = 0
    ElMessage.error(error?.message || '消息加载失败')
  } finally {
    loading.value = false
  }
}

const loadOverview = async () => {
  try {
    const [unreadRes, inboxRes, sentRes] = await Promise.all([
      getNotificationUnreadCount(),
      getNotificationList({ page: 1, pageSize: 1, box: 'inbox' }),
      getNotificationList({ page: 1, pageSize: 1, box: 'sent' }),
    ])

    overview.unread = unreadRes.code === 200 ? unreadRes.data.unreadCount : 0
    overview.inbox = inboxRes.code === 200 ? inboxRes.data.total : 0
    overview.sent = sentRes.code === 200 ? sentRes.data.total : 0
    overview.all = overview.inbox + overview.sent
  } catch (_error) {
    overview.unread = 0
    overview.inbox = 0
    overview.sent = 0
    overview.all = 0
  }
}

const openNotificationDetail = async (notificationId: number) => {
  const detail = await getNotificationDetail(notificationId)
  if (detail.code !== 200 || !detail.data) {
    throw new Error(detail.msg || '消息详情加载失败')
  }
  currentDetail.value = detail.data
  detailVisible.value = true
}

const handleRowClick = async (row: NotificationListItem) => {
  try {
    if (activeTab.value === 'inbox' && row.status === 'unread') {
      await updateNotificationStatus(row.id, 'read')
      row.status = 'read'
    }
    await openNotificationDetail(row.id)
    await Promise.all([loadList(), loadOverview()])
  } catch (error: any) {
    ElMessage.error(error?.message || '打开消息详情失败')
  }
}

const handlePageChange = (nextPage: number) => {
  page.value = nextPage
  void loadList()
}

const handleTabChange = () => {
  if (activeTab.value === 'sent') {
    statusFilter.value = 'all'
  }
  page.value = 1
  focusId.value = null
  void loadList()
}

const handleFilterSearch = () => {
  page.value = 1
  void loadList()
}

const handleFilterReset = () => {
  statusFilter.value = 'all'
  typeFilter.value = 'all'
  senderFilter.value = ''
  page.value = 1
  void loadList()
}

const handleManualRefresh = async () => {
  await Promise.all([loadList(), loadOverview()])
}

const handleChangeNotificationStatus = async (
  status: Extract<NotificationStatus, 'read' | 'done'>,
) => {
  if (!currentDetail.value) return
  try {
    await updateNotificationStatus(currentDetail.value.id, status)
    currentDetail.value = {
      ...currentDetail.value,
      status,
    }
    await Promise.all([loadList(), loadOverview()])
    ElMessage.success(
      status === 'done' ? '已标记为完成' : '已标记为已读',
    )
  } catch (error: any) {
    ElMessage.error(error?.message || '更新通知状态失败')
  }
}

const handleReplayAnnotation = (payload: {
  projectId: number
  scanFileId: number
  annotationId: number
  annotationKey?: string
  gaussAssetPath?: string
  annotationSnapshot?: ReplayAnnotationSnapshot | null
}) => {
  const snapshot = (currentDetail.value?.payload?.data?.snapshot ||
    {}) as Record<string, any>
  const projectName =
    typeof snapshot.projectName === 'string' ? snapshot.projectName.trim() : ''
  const replayToken = `${Date.now()}-${payload.annotationId}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
  try {
    window.sessionStorage.setItem(
      `${annotationReplayStorageKeyPrefix}${replayToken}`,
      JSON.stringify({
        projectId: payload.projectId,
        scanFileId: payload.scanFileId,
        annotationId: payload.annotationId,
        annotationKey: payload.annotationKey || '',
        annotation: payload.annotationSnapshot ?? null,
      }),
    )
  } catch (error) {
    console.warn('[Notifications] 写入批注回放快照失败:', error)
  }
  detailVisible.value = false
  router.push({
    path: '/twoScreen/index',
    query: {
      projectId: String(payload.projectId),
      scanFileId: String(payload.scanFileId),
      annotationId: String(payload.annotationId),
      annotationKey: payload.annotationKey || '',
      gaussAssetPath: payload.gaussAssetPath || '',
      replayToken,
      mode: 'annotation',
      projectName,
    },
  })
}

const locateFocusPage = async (targetId: number) => {
  const probeSize = 50
  const maxProbePages = 20
  for (let probePage = 1; probePage <= maxProbePages; probePage += 1) {
    const res = await getNotificationList({
      page: probePage,
      pageSize: probeSize,
      box: activeTab.value,
      keyword: senderFilter.value.trim() || undefined,
      type: typeFilter.value === 'all' ? undefined : typeFilter.value,
      status:
        activeTab.value === 'inbox' && statusFilter.value !== 'all'
          ? statusFilter.value
          : undefined,
    })
    if (res.code !== 200) return false
    const list = res.data.list || []
    const index = list.findIndex((item) => item.id === targetId)
    if (index >= 0) {
      const absoluteIndex = (probePage - 1) * probeSize + index
      page.value = Math.floor(absoluteIndex / pageSize.value) + 1
      return true
    }
    if (probePage * probeSize >= res.data.total) break
  }
  return false
}

const applyRouteFocus = async () => {
  const focusBoxRaw = route.query.focusBox
  const focusBox = Array.isArray(focusBoxRaw) ? focusBoxRaw[0] : focusBoxRaw
  if (focusBox === 'inbox' || focusBox === 'sent') {
    activeTab.value = focusBox
  }
  if (activeTab.value === 'sent') {
    statusFilter.value = 'all'
  }

  const raw = route.query.focusId
  const targetId = Array.isArray(raw) ? raw[0] : raw
  if (!targetId) {
    focusId.value = null
    page.value = 1
    await loadList()
    return
  }

  const parsedId = Number(targetId)
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    focusId.value = null
    page.value = 1
    await loadList()
    return
  }
  focusId.value = parsedId
  page.value = 1
  await loadList()
  if (!list.value.some((item) => item.id === parsedId)) {
    const located = await locateFocusPage(parsedId)
    if (located) {
      await loadList()
    }
  }
}

onMounted(async () => {
  await Promise.all([applyRouteFocus(), loadOverview()])
})

watch(
  () => [route.query.focusId, route.query.focusBox],
  async () => {
    await applyRouteFocus()
  },
)
</script>

<style scoped lang="scss">
.notifications-page {
  font-family:
    'SF Pro Display', 'SF Pro Text', 'PingFang SC', 'Helvetica Neue',
    'Microsoft YaHei', sans-serif;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 16px;

  .hero-card {
    border-radius: 22px;
    border: 1px solid var(--card-border);
    box-shadow: var(--card-shadow);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), #ffffff);
    padding: 22px 24px;
    display: grid;
    gap: 18px;
    grid-template-columns: minmax(280px, 1fr) minmax(300px, 470px);
    opacity: 0;
    transform: translateY(8px);
    animation: card-enter 340ms ease-out forwards;

    .hero-main {
      .hero-kicker {
        margin: 0;
        font-size: 12px;
        line-height: 1;
        letter-spacing: 0.5px;
        color: var(--text-secondary);
        font-weight: 600;
      }

      .page-title {
        margin: 10px 0 0;
        font-size: 30px;
        line-height: 1.15;
        color: var(--text-primary);
        font-weight: 600;
      }

      .page-subtitle {
        margin: 12px 0 0;
        max-width: 700px;
        font-size: 14px;
        color: var(--text-secondary);
        line-height: 1.75;
      }

      .hero-meta {
        margin-top: 16px;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;

        .refresh-time {
          font-size: 12px;
          color: var(--text-secondary);
        }

        :deep(.el-tag) {
          border-radius: 999px;
          border-color: rgba(0, 113, 227, 0.24);
          color: #005bb7;
          background: rgba(0, 113, 227, 0.08);
          font-weight: 500;
        }
      }
    }

    .hero-stats {
      display: grid;
      margin-top: 40px;
      gap: 12px;
      height: 90px;
      grid-template-columns: repeat(4, minmax(0, 1fr));

      .stat-card {
        border-radius: 14px;
        border: 1px solid #e6e8ed;
        background: #f9fafb;
        padding: 14px 16px;
        transition:
          transform 180ms ease,
          box-shadow 180ms ease,
          border-color 180ms ease;

        &:hover {
          transform: translateY(-1px);
          border-color: #d3d7de;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
        }

        .stat-label {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 10px;
        }

        .stat-value {
          font-size: 26px;
          line-height: 1;
          font-weight: 600;
          color: var(--text-primary);
        }

        &.is-unread {
          background: linear-gradient(135deg, #f7fbff, #f4f9ff);
          border-color: rgba(0, 113, 227, 0.2);

          .stat-value {
            color: var(--accent);
          }
        }
      }
    }
  }

  .panel-card {
    border-radius: 20px;
    border: 1px solid var(--card-border);
    box-shadow: var(--card-shadow);
    background: var(--card-bg);
    padding: 18px 20px;
    opacity: 0;
    transform: translateY(8px);
    animation: card-enter 340ms ease-out forwards;

    .panel-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 14px;

      .panel-title {
        font-size: 17px;
        color: var(--text-primary);
        font-weight: 600;
      }

      .panel-subtitle {
        margin-top: 8px;
        font-size: 13px;
        color: var(--text-secondary);
      }

      :deep(.el-tag) {
        border-radius: 999px;
      }
    }
  }

  .panel-card:nth-of-type(2) {
    animation-delay: 80ms;
  }

  .list-panel {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;

    .list-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .list-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 14px;
      background: #f8f9fb;
      padding: 0 12px 0px;
      margin-bottom: 12px;

      .list-tabs {
        flex-shrink: 0;
        margin-top: 10px;
        min-width: 180px;
        :deep(.el-tabs__nav-wrap::after) {
          display: none;
        }
      }

      .toolbar-filters {
        flex: 1;
        min-width: 0;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 10px;
      }

      .toolbar-filter-item {
        width: 180px;
      }

      .sender-input {
        width: 220px;
      }
    }

    .list-content {
      flex: 1;
      min-height: 0;
    }
  }

  @media (max-width: 1280px) {
    .hero-card {
      grid-template-columns: 1fr;
    }

    .hero-stats {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (max-width: 900px) {
    padding: 14px;

    .hero-card {
      padding: 16px;

      .hero-main {
        .page-title {
          font-size: 24px;
        }
      }

      .hero-stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    .panel-card {
      padding: 14px;
    }

    .list-panel {
      .list-toolbar {
        flex-direction: column;
        align-items: stretch;
        padding: 0 10px 10px;

        .toolbar-filters {
          justify-content: flex-start;
          flex-wrap: wrap;
        }

        .toolbar-filter-item,
        .sender-input {
          width: 100%;
        }
      }
    }
  }

  @keyframes card-enter {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hero-card,
    .panel-card {
      animation: none;
      opacity: 1;
      transform: none;
    }

    .hero-stats .stat-card {
      transition: none;
    }
  }
}
</style>
