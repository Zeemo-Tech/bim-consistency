<template>
  <div class="sidebar-container" :class="{ 'is-collapse': isCollapse }">
    <!-- Logo 区域 -->
    <div class="sidebar-logo">
      <router-link to="/" class="logo-link">
        <img
          :src="brandLogoUrl"
          alt="中国建筑第八工程局有限公司"
          :class="isCollapse ? 'logo-img-mini' : 'logo-img'"
        />
      </router-link>
    </div>

    <!-- 菜单区域 -->
    <el-scrollbar class="sidebar-scrollbar">
      <el-menu
        ref="menuRef"
        :default-active="activeMenu"
        :default-openeds="defaultOpeneds"
        :collapse="isCollapse"
        :unique-opened="false"
        :collapse-transition="false"
        mode="vertical"
        class="sidebar-menu"
        router
      >
        <sidebar-item
          v-for="route in menuRoutes"
          :key="route.path"
          :item="route"
          :base-path="route.path"
        />
      </el-menu>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, type RouteRecordRaw } from 'vue-router'
import { usePermissionStoreHook } from '@/store/modules/permission'
import { useReportAccessStoreHook } from '@/store/modules/report-access'
import { useBrandStoreHook } from '@/store/modules/brand'
import SidebarItem from './SidebarItem.vue'

const props = defineProps<{
  isCollapse: boolean
}>()

const route = useRoute()
const permissionStore = usePermissionStoreHook()
const reportAccessStore = useReportAccessStoreHook()
const brandStore = useBrandStoreHook()
const brandLogoUrl = computed(() => brandStore.logoUrl)
const menuRef = ref<any>(null)

// 当前激活的菜单
const activeMenu = computed(() => {
  const { path } = route
  return path
})

const getVisibleChildren = (item: RouteRecordRaw) => {
  if (!item.children) return []
  return item.children.filter((child) => child.meta?.showLink !== false)
}

const shouldShowOnlyChild = (item: RouteRecordRaw) => {
  const visibleChildren = getVisibleChildren(item)
  if (visibleChildren.length !== 1) return false

  const child = visibleChildren[0]

  if (item.meta?.showLink === false) return true
  if (item.meta?.title === child.meta?.title) return true
  if (item.meta?.icon === child.meta?.icon) return true
  if (!item.meta || !item.meta.title) return true

  return false
}

const resolvePath = (basePath: string, routePath: string) => {
  if (routePath.startsWith('/')) return routePath
  return `${basePath}/${routePath}`.replace(/\/+/g, '/')
}

const collectOpeneds = (items: RouteRecordRaw[], basePath = ''): string[] => {
  const openeds: string[] = []

  items.forEach((item) => {
    if (item.meta?.showLink === false) return

    const currentPath = resolvePath(basePath, item.path)
    const visibleChildren = getVisibleChildren(item)

    if (visibleChildren.length > 0 && !shouldShowOnlyChild(item)) {
      openeds.push(currentPath)
      openeds.push(...collectOpeneds(visibleChildren as RouteRecordRaw[], currentPath))
    }
  })

  return openeds
}

// 菜单路由列表
const menuRoutes = computed<RouteRecordRaw[]>(() => {
  return (permissionStore.wholeMenus as RouteRecordRaw[]).filter((item: any) => {
    if (item?.name === 'ReportModule') {
      return reportAccessStore.reportModuleVisible
    }
    return true
  })
})

const parseQueryProjectId = (value: unknown) => {
  const num = Number(Array.isArray(value) ? value[0] : value)
  if (!Number.isFinite(num) || num <= 0) return null
  return num
}

const defaultOpeneds = computed(() => {
  return Array.from(new Set(collectOpeneds(menuRoutes.value)))
})

const syncMenuExpandedState = async () => {
  if (props.isCollapse) return
  await nextTick()
  const menu = menuRef.value
  if (!menu?.open) return
  defaultOpeneds.value.forEach((index) => {
    menu.open(index)
  })
}

watch(
  () => [defaultOpeneds.value.join('|'), props.isCollapse],
  async () => {
    await syncMenuExpandedState()
  },
  { immediate: true },
)

watch(
  () => [route.path, route.query.projectId],
  ([path, projectIdQuery]) => {
    const inReportContext = String(path).startsWith('/data/report')
    if (!inReportContext) {
      reportAccessStore.clear()
      return
    }
    const projectId = parseQueryProjectId(projectIdQuery)
    if (projectId && !reportAccessStore.isActiveProject(projectId)) {
      reportAccessStore.clear()
    }
  },
  { immediate: true },
)
</script>

<style lang="scss" scoped>
.sidebar-container {
  position: relative;
  width: 220px;
  height: 100%;
  border-right: 1px solid var(--el-border-color-light);
  transition: width 0.3s;
  overflow: hidden;

  &.is-collapse {
    width: 64px;
  }

  /* Logo 区域 */
  .sidebar-logo {
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid var(--el-border-color-light);

    .logo-link {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      text-decoration: none;
      color: var(--el-text-color-primary);
      width: 100%;
      padding: 0 16px;

      .logo-img {
        max-width: 100%;
        height: 40px;
        object-fit: contain;
        transition: all 0.3s;
      }

      .logo-img-mini {
        width: 36px;
        height: 36px;
        object-fit: contain;
        transition: all 0.3s;
      }

      .logo-title {
        color: #1f41ae;
        font-size: 16px;
        font-weight: 600;
        white-space: nowrap;
      }
    }
  }

  /* 菜单滚动区域 */
  .sidebar-scrollbar {
    height: calc(100% - 60px);

    :deep(.el-scrollbar__wrap) {
      overflow-x: hidden;
    }
  }

  /* 菜单样式 */
  .sidebar-menu {
    border: none;
    height: 100%;

    &:not(.el-menu--collapse) {
      width: 100%;
    }

    // 菜单项激活状态
    :deep(.el-menu-item.is-active) {
      background-color: #4a9dfb !important;
      color: #fff !important;

      .el-icon {
        color: #fff !important;
      }
    }

    // 菜单项 hover 状态
    :deep(.el-menu-item:hover) {
      background-color: rgba(74, 157, 251, 0.1);
    }

    // 子菜单项激活状态
    :deep(.el-sub-menu .el-menu-item.is-active) {
      background-color: #4a9dfb !important;
      color: #fff !important;

      .el-icon {
        color: #fff !important;
      }
    }
  }
}
</style>
