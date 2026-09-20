<template>
  <template v-if="item.meta?.showLink !== false">
    <!-- 只有一个子路由且应该折叠显示的情况 -->
    <el-menu-item v-if="shouldShowOnlyChild" :index="resolvePath(onlyOneChild.path)">
      <el-icon v-if="onlyOneChild.meta?.icon">
        <component :is="renderIcon(onlyOneChild.meta.icon)" />
      </el-icon>
      <template #title>
        <span>{{ t(onlyOneChild.meta?.title || '') }}</span>
      </template>
    </el-menu-item>

    <!-- 有多个子菜单的情况 -->
    <el-sub-menu
      v-else-if="hasChildren"
      :index="resolvePath(item.path)"
      :popper-append-to-body="true"
    >
      <template #title>
        <el-icon v-if="item.meta?.icon">
          <component :is="renderIcon(item.meta.icon)" />
        </el-icon>
        <span>{{ t(item.meta?.title || '') }}</span>
      </template>
      <sidebar-item
        v-for="child in visibleChildren"
        :key="child.path"
        :item="child"
        :base-path="resolvePath(item.path)"
      />
    </el-sub-menu>

    <!-- 没有子菜单的情况 -->
    <el-menu-item v-else :index="resolvePath(item.path)">
      <el-icon v-if="item.meta?.icon">
        <component :is="renderIcon(item.meta.icon)" />
      </el-icon>
      <template #title>
        <span>{{ t(item.meta?.title || '') }}</span>
      </template>
    </el-menu-item>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { i18n } from '@/plugins/i18n'
import type { RouteRecordRaw } from 'vue-router'
import * as ElementPlusIcons from '@element-plus/icons-vue'

const props = defineProps<{
  item: RouteRecordRaw
  basePath: string
}>()

const t = (key: string) => (i18n.global.t as any)(key)

// 获取可见的子路由（过滤掉 showLink 为 false 的）
const visibleChildren = computed(() => {
  if (!props.item.children) return []
  return props.item.children.filter((child) => child.meta?.showLink !== false)
})

// 是否有子路由
const hasChildren = computed(() => visibleChildren.value.length > 0)

// 唯一的子路由
const onlyOneChild = computed(() => {
  if (visibleChildren.value.length === 1) {
    return visibleChildren.value[0]
  }
  return null
})

// 是否应该只显示子路由（折叠父级）
const shouldShowOnlyChild = computed(() => {
  // 必须只有一个可见子路由
  if (!onlyOneChild.value) return false

  const parent = props.item
  const child = onlyOneChild.value

  // 如果父路由的 showLink 为 false，直接显示子路由
  if (parent.meta?.showLink === false) return true

  // 如果父子标题相同，折叠显示
  if (parent.meta?.title === child.meta?.title) return true

  // 如果父子图标相同，折叠显示
  if (parent.meta?.icon === child.meta?.icon) return true

  // 如果父路由没有 meta 或者没有 title，折叠显示
  if (!parent.meta || !parent.meta.title) return true

  return false
})

// 解析路径
const resolvePath = (routePath: string) => {
  if (routePath.startsWith('/')) {
    return routePath
  }
  return `${props.basePath}/${routePath}`.replace(/\/+/g, '/')
}

// 渲染图标
const renderIcon = (icon: string) => {
  if (!icon) return null

  // 如果是 element-plus 图标格式 (ep/xxx)
  if (icon.startsWith('ep/')) {
    const iconName = icon.replace('ep/', '')
    // 将连字符格式转为驼峰格式，例如：home-filled -> HomeFilled
    const camelCaseName = iconName
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')

    // 从 Element Plus Icons 中获取对应的图标组件
    const iconComponent = (ElementPlusIcons as any)[camelCaseName]
    if (iconComponent) {
      return iconComponent
    } else {
      console.warn(`Icon not found: ${camelCaseName}`)
      return null
    }
  }

  // 其他格式的图标可以在这里扩展
  return icon
}
</script>

<style lang="scss" scoped>
:deep(.el-sub-menu__title) {
  height: 56px;
  line-height: 56px;
}

:deep(.el-menu-item) {
  height: 56px;
  line-height: 56px;

  &.is-active {
    background-color: #4a9dfb !important;
    color: #fff !important;

    .el-icon {
      color: #fff !important;
    }
  }

  &:hover {
    background-color: rgba(74, 157, 251, 0.1);
  }
}

:deep(.el-sub-menu) {
  .el-menu-item.is-active {
    background-color: #4a9dfb !important;
    color: #fff !important;

    .el-icon {
      color: #fff !important;
    }
  }
}
</style>
