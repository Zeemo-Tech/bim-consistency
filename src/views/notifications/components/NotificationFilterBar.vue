<template>
  <div class="notification-filter-bar">
    <div class="filter-grid">
      <div class="filter-field field-box">
        <span class="field-label">消息视角</span>
        <el-radio-group
          :model-value="filters.box"
          class="box-selector"
          @update:model-value="handleBoxChange"
        >
          <el-radio-button label="inbox">收件箱</el-radio-button>
          <el-radio-button label="sent">已发送</el-radio-button>
        </el-radio-group>
      </div>

      <div class="filter-field">
        <span class="field-label">消息类型</span>
        <el-select
          :model-value="filters.type"
          class="field-control"
          placeholder="全部类型"
          @update:model-value="handleTypeChange"
        >
          <el-option label="全部类型" value="all" />
          <el-option label="系统公告" value="system_announcement" />
          <el-option label="批注邀请" value="annotation_invite" />
        </el-select>
      </div>

      <div class="filter-field">
        <span class="field-label">消息状态</span>
        <el-select
          :model-value="filters.status"
          class="field-control"
          :disabled="filters.box === 'sent'"
          @update:model-value="handleStatusChange"
        >
          <el-option label="全部" value="all" />
          <el-option label="未读" value="unread" />
          <el-option label="已读" value="read" />
          <el-option label="已完成" value="done" />
        </el-select>
        <span v-if="filters.box === 'sent'" class="field-tip">
          已发送视角不区分处理状态
        </span>
      </div>

      <div class="filter-field field-keyword">
        <span class="field-label">关键词</span>
        <el-input
          :model-value="filters.keyword"
          clearable
          placeholder="搜索标题/内容/发送人"
          @update:model-value="handleKeywordChange"
          @keyup.enter="emit('search')"
        />
      </div>
    </div>

    <div class="filter-actions">
      <el-button type="primary" :loading="loading" @click="emit('search')">
        查询
      </el-button>
      <el-button @click="emit('reset')">重置</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  NotificationBox,
  NotificationStatus,
  NotificationType,
} from '@/api/notification'

export type NotificationStatusFilter = 'all' | NotificationStatus

export interface NotificationFilterModel {
  box: NotificationBox
  type: NotificationType | 'all'
  status: NotificationStatusFilter
  keyword: string
}

interface Props {
  filters: NotificationFilterModel
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false,
})

const emit = defineEmits<{
  change: [Partial<NotificationFilterModel>]
  search: []
  reset: []
}>()

const emitChange = (patch: Partial<NotificationFilterModel>) => {
  emit('change', patch)
}

const handleBoxChange = (value: string | number | boolean) => {
  emitChange({ box: value as NotificationBox })
}

const handleTypeChange = (value: string | number | boolean) => {
  emitChange({ type: value as NotificationType | 'all' })
}

const handleStatusChange = (value: string | number | boolean) => {
  emitChange({ status: value as NotificationStatusFilter })
}

const handleKeywordChange = (value: string | number | boolean) => {
  emitChange({ keyword: String(value ?? '') })
}
</script>

<style scoped lang="scss">
.notification-filter-bar {
  border-radius: 16px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: #f9fafb;
  padding: 16px;

  .filter-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }

  .filter-field {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .field-label {
      font-size: 12px;
      color: #6e6e73;
      font-weight: 500;
      letter-spacing: 0.1px;
    }

    .field-control {
      width: 100%;
    }

    .field-tip {
      font-size: 12px;
      color: #8a8a91;
    }
  }

  .field-box {
    grid-column: span 2;

    .box-selector {
      width: fit-content;
    }
  }

  .field-keyword {
    grid-column: span 2;
  }

  .filter-actions {
    margin-top: 14px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
  }

  :deep(.el-radio-group) {
    gap: 8px;
  }

  :deep(.el-radio-button__inner) {
    border: 1px solid #d7dbe3;
    background: #fff;
    color: #1d1d1f;
    border-radius: 10px !important;
    box-shadow: none;
    transition:
      border-color 180ms ease,
      background-color 180ms ease,
      color 180ms ease;
  }

  :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
    border-color: rgba(0, 113, 227, 0.36);
    background: rgba(0, 113, 227, 0.08);
    color: #005bb7;
  }

  :deep(.el-select__wrapper),
  :deep(.el-input__wrapper) {
    border-radius: 10px;
    box-shadow: inset 0 0 0 1px #d7dbe3;
    background: #fff;
    transition: box-shadow 160ms ease;
  }

  :deep(.el-select__wrapper:hover),
  :deep(.el-input__wrapper:hover) {
    box-shadow: inset 0 0 0 1px #b7bdc8;
  }

  :deep(.el-select__wrapper.is-focused),
  :deep(.el-input__wrapper.is-focus) {
    box-shadow: inset 0 0 0 1px #7db5eb;
  }

  :deep(.el-button--primary) {
    --el-button-bg-color: #0071e3;
    --el-button-border-color: #0071e3;
    --el-button-hover-bg-color: #0077ed;
    --el-button-hover-border-color: #0077ed;
    border-radius: 10px;
    font-weight: 500;
  }

  :deep(.el-button:not(.el-button--primary)) {
    border-radius: 10px;
  }

  @media (max-width: 1280px) {
    .filter-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .field-box,
    .field-keyword {
      grid-column: span 2;
    }
  }

  @media (max-width: 820px) {
    padding: 12px;

    .filter-grid {
      grid-template-columns: 1fr;
    }

    .field-box,
    .field-keyword {
      grid-column: span 1;
    }

    .filter-actions {
      justify-content: flex-start;
    }
  }
}
</style>
