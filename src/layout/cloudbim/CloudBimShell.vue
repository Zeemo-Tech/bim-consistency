<template>
  <div
    class="cb-shell cb-layout"
    :class="{ 'is-page': props.variant === 'page' }"
  >
    <CloudBimTopbar :active="props.active" />

    <div v-if="props.variant === 'page'" class="cb-page-body">
      <slot />
    </div>

    <div v-else class="cb-body">
      <CloudBimSidebar
        v-if="props.sidebar"
        :project-id="projectId"
        :project-name="projectName"
      />
      <main class="cb-panel" :class="{ 'is-sidebarless': !props.sidebar }">
        <div class="cb-panel-content">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CloudBimTopbar from './CloudBimTopbar.vue'
import CloudBimSidebar from './CloudBimSidebar.vue'

const props = withDefaults(
  defineProps<{
    /** page：整页（无侧边栏、无卡片容器）；workspace：工作区（可带侧边栏的卡片容器） */
    variant?: 'page' | 'workspace'
    /** 顶部导航高亮项 */
    active?: 'projects' | 'devices'
    /** 是否显示项目侧边栏 */
    sidebar?: boolean
  }>(),
  { variant: 'workspace', active: undefined, sidebar: false },
)

const route = useRoute()
const router = useRouter()

const projectId = computed(() => {
  const value = Number(route.query.projectId)
  return Number.isFinite(value) && value > 0 ? value : 0
})

const projectName = computed(() => {
  const value = route.query.projectName
  return typeof value === 'string' && value ? value : '当前项目'
})

onMounted(() => {
  if (props.sidebar && !projectId.value) {
    void router.replace('/projects')
  }
})
</script>

<style lang="scss" scoped>
.cb-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  color: var(--text-primary);
  background: var(--bg-page);
}

.cb-page-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.cb-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.cb-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  margin: var(--spacing-md) var(--spacing-md) var(--spacing-md) 0;
  overflow: hidden;
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-md);
}

.cb-panel.is-sidebarless {
  margin-left: var(--spacing-md);
}

.cb-panel-content {
  height: 100%;
  min-height: 0;
  padding: var(--workspace-gutter);
  overflow: auto;
}

@media (width <= 800px) {
  .cb-panel {
    margin: var(--spacing-sm) var(--spacing-sm) var(--spacing-sm) 0;
  }

  .cb-panel.is-sidebarless {
    margin-left: var(--spacing-sm);
  }
}
</style>
