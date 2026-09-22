<template>
  <aside class="app-sidebar">
    <div class="sidebar-project" :title="props.projectName">
      <span class="project-icon">
        <el-icon><DataBoard /></el-icon>
      </span>
      <div>
        <span class="project-label">当前项目</span>
        <strong>{{ props.projectName }}</strong>
      </div>
    </div>

    <nav class="menu-content" aria-label="项目功能导航">
      <div class="menu-section">
        <div class="section-title">设计信息</div>
        <div class="menu-items">
          <button
            class="menu-item"
            :class="{ 'is-active': activePath === '/design/overview' }"
            :aria-current="
              activePath === '/design/overview' ? 'page' : undefined
            "
            title="项目概述"
            type="button"
            @click="go('/design/overview')"
          >
            <span class="menu-icon">
              <el-icon><DataBoard /></el-icon>
            </span>
            <span class="menu-text">
              <span class="menu-title">项目概述</span>
              <span class="menu-status">项目总览</span>
            </span>
          </button>
          <button
            class="menu-item"
            :class="{ 'is-active': activePath === '/design/cad' }"
            :aria-current="activePath === '/design/cad' ? 'page' : undefined"
            title="CAD图纸"
            type="button"
            @click="go('/design/cad')"
          >
            <span class="menu-icon">
              <el-icon><Document /></el-icon>
            </span>
            <span class="menu-text">
              <span class="menu-title">CAD图纸</span>
              <span class="menu-status">图纸管理</span>
            </span>
          </button>
          <button
            class="menu-item"
            :class="{ 'is-active': activePath === '/design/bim' }"
            :aria-current="activePath === '/design/bim' ? 'page' : undefined"
            title="设计模型"
            type="button"
            @click="go('/design/bim')"
          >
            <span class="menu-icon">
              <el-icon><Box /></el-icon>
            </span>
            <span class="menu-text">
              <span class="menu-title">设计模型</span>
              <span class="menu-status">模型浏览</span>
            </span>
          </button>
        </div>
      </div>

      <div class="menu-section">
        <div class="section-title">实测数据</div>
        <div class="menu-items">
          <button
            class="menu-item"
            :class="{ 'is-active': activePath === '/survey' }"
            :aria-current="activePath === '/survey' ? 'page' : undefined"
            title="扫描点云"
            type="button"
            @click="go('/survey')"
          >
            <span class="menu-icon">
              <el-icon><MagicStick /></el-icon>
            </span>
            <span class="menu-text">
              <span class="menu-title">扫描点云</span>
              <span class="menu-status">扫描归档与分析</span>
            </span>
          </button>
        </div>
      </div>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Box, DataBoard, Document, MagicStick } from '@element-plus/icons-vue'

const props = defineProps<{
  projectId: number
  projectName: string
}>()

const route = useRoute()
const router = useRouter()

const activePath = computed(() => {
  if (route.path.startsWith('/survey')) return '/survey'
  if (route.path.startsWith('/design/bim')) return '/design/bim'
  if (route.path.startsWith('/design/cad')) return '/design/cad'
  if (route.path.startsWith('/design/overview')) return '/design/overview'
  return route.path
})

function go(path: string) {
  void router.push({
    path,
    query: { projectId: props.projectId, projectName: props.projectName },
  })
}
</script>

<style lang="scss" scoped>
.app-sidebar {
  display: flex;
  flex: 0 0 var(--sidebar-width);
  flex-direction: column;
  width: var(--sidebar-width);
  min-height: 0;
  padding-top: var(--spacing-md);
  background: var(--bg-card);
  border-right: 1px solid var(--border-color-light);
}

.sidebar-project {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
  min-width: 0;
  padding: var(--spacing-sm) var(--spacing-compact);
  margin: 0 var(--spacing-sm) var(--spacing-md);
}

.project-icon {
  display: grid;
  flex: 0 0 28px;
  place-items: center;
  height: 28px;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  border-radius: var(--radius-xs);
}

.sidebar-project > div {
  min-width: 0;
}

.project-label,
.sidebar-project strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-label {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.sidebar-project strong {
  margin-top: 2px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.menu-content {
  flex: 1;
  min-height: 0;
  padding: 0 var(--spacing-sm);
  overflow-y: auto;
}

.section-title {
  padding: 0 var(--spacing-compact);
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-tertiary);
}

.menu-section + .menu-section {
  margin-top: var(--spacing-lg);
}

.menu-items {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.menu-item {
  display: flex;
  gap: var(--spacing-compact);
  align-items: center;
  width: 100%;
  min-height: 60px;
  padding: var(--spacing-sm) var(--spacing-compact);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-fast);
}

.menu-item:hover {
  background: var(--bg-control-hover);
}

.menu-item.is-active {
  background: var(--color-primary-soft);
  border-color: var(--border-color-focus);
}

.menu-icon {
  display: grid;
  flex: 0 0 20px;
  place-items: center;
  color: var(--text-secondary);
}

.menu-text {
  min-width: 0;
}

.menu-title,
.menu-status {
  display: block;
}

.menu-title {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.menu-status {
  margin-top: var(--spacing-xs);
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.menu-item.is-active .menu-title,
.menu-item.is-active .menu-icon {
  font-weight: 600;
  color: var(--color-primary);
}

@media (width <= 800px) {
  .app-sidebar {
    flex-basis: 64px;
    width: 64px;
    padding-top: var(--spacing-sm);
  }

  .sidebar-project {
    justify-content: center;
    padding: var(--spacing-sm);
    margin: 0 0 var(--spacing-sm);
  }

  .sidebar-project > div,
  .menu-text,
  .section-title {
    display: none;
  }

  .menu-item {
    justify-content: center;
    min-height: 44px;
    padding: var(--spacing-sm);
  }
}
</style>
