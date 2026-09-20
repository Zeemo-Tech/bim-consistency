<template>
  <div ref="tableWrapRef" class="notification-list-table">
    <div class="table-shell">
      <el-table
        v-loading="loading"
        :data="items"
        row-key="id"
        height="100%"
        :row-class-name="rowClassName"
        :header-cell-style="headerCellStyle"
        @row-click="(row) => emit('row-click', row)"
      >
        <el-table-column
          prop="title"
          label="标题"
          min-width="180"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <div class="title-cell">
              <span class="title-text">{{ row.title }}</span>
              <el-tag
                v-if="row.status === 'unread'"
                size="small"
                type="primary"
                effect="plain"
                round
              >
                未读
              </el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="类型" width="170">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="resolveTypeTone(row.type)"
              effect="light"
              round
            >
              {{ getNotificationTypeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column
          prop="content"
          label="内容摘要"
          min-width="300"
          show-overflow-tooltip
        />

        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag
              v-if="row.status"
              size="small"
              :type="getNotificationStatusTagType(row.status)"
              effect="plain"
              round
            >
              {{ getNotificationStatusLabel(row.status) }}
            </el-tag>
            <span v-else class="sent-state">已发送</span>
          </template>
        </el-table-column>

        <el-table-column label="发送人" width="130" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.sender.name }}
          </template>
        </el-table-column>

        <el-table-column label="时间" width="170">
          <template #default="{ row }">
            {{ formatNotificationTime(row.createdAt) }}
          </template>
        </el-table-column>

        <template #empty>
          <div class="table-empty">
            <p class="empty-title">暂无消息</p>
            <p class="empty-hint">当前消息中心还没有可展示的记录。</p>
          </div>
        </template>
      </el-table>
    </div>

    <div class="notification-pagination">
      <el-pagination
        background
        layout="total, prev, pager, next"
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        @current-change="(value) => emit('page-change', value)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import {
  formatNotificationTime,
  getNotificationStatusLabel,
  getNotificationStatusTagType,
  getNotificationTypeLabel,
  type NotificationListItem,
  type NotificationType,
} from '@/api/notification'

interface Props {
  items: NotificationListItem[]
  loading?: boolean
  page: number
  pageSize: number
  total: number
  focusId?: number | null
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  focusId: null,
})

const emit = defineEmits<{
  'row-click': [NotificationListItem]
  'page-change': [number]
}>()

const tableWrapRef = ref<HTMLDivElement | null>(null)

const headerCellStyle = {
  backgroundColor: '#f7f7f8',
  color: '#6e6e73',
  fontWeight: 600,
}

const sanitizeClassName = (value: string) =>
  value.replace(/[^a-zA-Z0-9_-]/g, '_')

const rowClassName = ({ row }: { row: NotificationListItem }) => {
  const rowClass = `notification-row-${sanitizeClassName(String(row.id))}`
  return props.focusId && row.id === props.focusId
    ? `${rowClass} is-focused`
    : rowClass
}

const resolveTypeTone = (type: NotificationType) => {
  if (type === 'system_announcement') return 'warning'
  return 'primary'
}

const scrollToNotification = async (id: number) => {
  if (!id) return
  await nextTick()
  const root = tableWrapRef.value
  if (!root) return
  const selector = `.notification-row-${sanitizeClassName(String(id))}`
  const row = root.querySelector<HTMLElement>(selector)
  row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

defineExpose({
  scrollToNotification,
})
</script>

<style scoped lang="scss">
.notification-list-table {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;

  .table-shell {
    flex: 1;
    min-height: 0;
    border-radius: 14px;
    border: 1px solid rgba(15, 23, 42, 0.08);
    overflow: hidden;
    background: #fff;
  }

  .title-cell {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;

    .title-text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 500;
      color: #1d1d1f;
    }
  }

  .sent-state {
    color: #8a8a91;
    font-size: 12px;
  }

  :deep(.el-table) {
    --el-table-border-color: #eceef2;

    .el-table__row {
      cursor: pointer;
      transition: background-color 180ms ease;

      td {
        padding-top: 12px;
        padding-bottom: 12px;
      }

      &:hover > td {
        background-color: #f7f9fc;
      }
    }

    .is-focused > td {
      background-color: #f2f8ff !important;
    }
  }

  .table-empty {
    padding: 28px 0;

    .empty-title {
      margin: 0;
      color: #1d1d1f;
      font-weight: 500;
    }

    .empty-hint {
      margin: 8px 0 0;
      color: #8a8a91;
      font-size: 13px;
    }
  }

  .notification-pagination {
    flex-shrink: 0;
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }
}
</style>
