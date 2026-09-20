<template>
  <div class="tags-view-container">
    <el-scrollbar class="tags-view-wrapper">
      <div class="tags-view-content">
        <router-link
          v-for="tag in tags"
          :key="tag.path"
          :to="tag.path"
          :class="['tags-view-item', isActive(tag) ? 'active' : '']"
        >
          <span class="tag-title">{{ t(tag.meta?.title || '') }}</span>
          <el-icon
            v-if="!isAffix(tag)"
            class="tag-close-icon"
            :size="12"
            @click.prevent.stop="closeTag(tag)"
          >
            <Close />
          </el-icon>
        </router-link>
      </div>
    </el-scrollbar>

    <!-- 操作菜单按钮 -->
    <el-dropdown trigger="click" @command="handleCommand" class="tags-dropdown">
      <div class="dropdown-trigger">
        <el-icon :size="16">
          <ArrowDown />
        </el-icon>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="refresh">
            <el-icon><RefreshRight /></el-icon>
            <span>{{ t('buttons.pureReload') }}</span>
          </el-dropdown-item>
          <el-dropdown-item command="closeCurrent" :disabled="isAffix(currentTag)" divided>
            <el-icon><Close /></el-icon>
            <span>{{ t('buttons.pureCloseCurrentTab') }}</span>
          </el-dropdown-item>
          <el-dropdown-item command="closeLeft">
            <el-icon><Back /></el-icon>
            <span>{{ t('buttons.pureCloseLeftTabs') }}</span>
          </el-dropdown-item>
          <el-dropdown-item command="closeRight">
            <el-icon><Right /></el-icon>
            <span>{{ t('buttons.pureCloseRightTabs') }}</span>
          </el-dropdown-item>
          <el-dropdown-item command="closeOther">
            <el-icon><CircleClose /></el-icon>
            <span>{{ t('buttons.pureCloseOtherTabs') }}</span>
          </el-dropdown-item>
          <el-dropdown-item command="closeAll">
            <el-icon><FolderDelete /></el-icon>
            <span>{{ t('buttons.pureCloseAllTabs') }}</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { i18n } from '@/plugins/i18n'
import { useMultiTagsStoreHook } from '@/store/modules/multiTags'
import type { RouteConfigs } from '@/layout/types'
import {
  Close,
  RefreshRight,
  Back,
  Right,
  CircleClose,
  FolderDelete,
  ArrowDown,
} from '@element-plus/icons-vue'

defineOptions({
  name: 'Tags',
})

const route = useRoute()
const router = useRouter()
const multiTagsStore = useMultiTagsStoreHook()

const t = (key: string) => (i18n.global.t as any)(key)

// 标签列表
const tags = computed(() => multiTagsStore.multiTags)

// 当前标签
const currentTag = computed(() => {
  return tags.value.find((tag) => tag.path === route.path) || ({} as RouteConfigs)
})

// 判断标签是否为固定标签（首页）
const isAffix = (tag: RouteConfigs) => {
  return tag.path === '/welcome' || tag.meta?.affix
}

// 判断标签是否激活
const isActive = (tag: RouteConfigs) => {
  return tag.path === route.path
}

// 添加标签
const addTag = () => {
  const { name, path, meta } = route
  if (name && path) {
    multiTagsStore.handleTags('push', {
      path,
      name: name as string,
      meta,
    } as RouteConfigs)
  }
}

// 关闭标签
const closeTag = (tag: RouteConfigs) => {
  if (isAffix(tag)) return

  multiTagsStore.handleTags('splice', undefined, tag)

  // 如果关闭的是当前标签，跳转到最后一个标签
  if (isActive(tag)) {
    const latestView = tags.value[tags.value.length - 1]
    if (latestView) {
      router.push(latestView.path)
    } else {
      router.push('/welcome')
    }
  }
}

// 处理菜单命令
const handleCommand = (command: string) => {
  const current = currentTag.value

  switch (command) {
    case 'refresh':
      router.replace({
        path: '/redirect' + current.path,
      })
      break
    case 'closeCurrent':
      if (!isAffix(current)) {
        closeTag(current)
      }
      break
    case 'closeLeft':
      multiTagsStore.closeLeftTags(current.path)
      break
    case 'closeRight':
      multiTagsStore.closeRightTags(current.path)
      break
    case 'closeOther':
      multiTagsStore.closeOtherTags(current.path)
      break
    case 'closeAll':
      multiTagsStore.closeAllTags()
      router.push('/welcome')
      break
  }
}

// 监听路由变化，添加标签
watch(
  () => route.path,
  () => {
    addTag()
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
.tags-view-container {
  position: relative;
  height: 40px;
  width: 100%;
  background-color: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
  display: flex;
  align-items: center;

  .tags-view-wrapper {
    flex: 1;
    height: 100%;

    :deep(.el-scrollbar__wrap) {
      height: 100%;
      overflow-x: auto;
      overflow-y: hidden;
    }

    :deep(.el-scrollbar__view) {
      height: 100%;
    }
  }

  .tags-view-content {
    display: flex;
    height: 100%;
    padding: 0 10px;
    align-items: center;
    gap: 4px;
  }

  .tags-view-item {
    display: inline-flex;
    align-items: center;
    height: 28px;
    padding: 0 12px;
    font-size: 12px;
    color: var(--el-text-color-regular);
    background-color: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.3s;
    white-space: nowrap;
    flex-shrink: 0;

    &:hover {
      background-color: var(--el-fill-color);
      color: var(--el-color-primary);
    }

    &.active {
      background-color: var(--el-color-primary);
      color: #fff;
      border-color: var(--el-color-primary);

      .tag-close-icon {
        &:hover {
          background-color: rgba(255, 255, 255, 0.2);
          color: #fff;
        }
      }
    }

    .tag-title {
      margin-right: 6px;
    }

    .tag-close-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      transition: all 0.3s;

      &:hover {
        background-color: var(--el-fill-color-dark);
        color: var(--el-color-danger);
      }
    }
  }

  .tags-dropdown {
    padding: 0 12px;
    height: 100%;
    display: flex;
    align-items: center;
    border-left: 1px solid var(--el-border-color-light);
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      background-color: var(--el-fill-color-light);
    }

    .dropdown-trigger {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--el-text-color-regular);
      transition: all 0.3s;

      &:hover {
        color: var(--el-color-primary);
      }
    }
  }
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;

  .el-icon {
    font-size: 14px;
  }
}
</style>
