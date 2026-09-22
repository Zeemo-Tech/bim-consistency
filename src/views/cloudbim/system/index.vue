<template>
  <CloudBimShell variant="page">
    <div class="cb-system">
      <nav class="cb-system__rail" aria-label="系统管理模块">
        <div class="cb-system__rail-title">系统管理</div>
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="cb-system__tab"
          :class="{ 'is-active': activeTab === tab.id }"
          type="button"
          @click="activeTab = tab.id"
        >
          <span class="cb-system__tab-icon">
            <el-icon><component :is="tab.icon" /></el-icon>
          </span>
          <span class="cb-system__tab-text">
            <span class="cb-system__tab-title">{{ tab.label }}</span>
            <span class="cb-system__tab-desc">{{ tab.description }}</span>
          </span>
        </button>
      </nav>

      <section class="cb-system__content">
        <KeepAlive>
          <component :is="currentTab.component" />
        </KeepAlive>
      </section>
    </div>
  </CloudBimShell>
</template>

<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import { Lock, OfficeBuilding, UserFilled } from '@element-plus/icons-vue'
import CloudBimShell from '@/layout/cloudbim/CloudBimShell.vue'
import OrganizationManagement from '@/views/system/organization/index.vue'
import PersonnelManagement from '@/views/system/personnel/index.vue'
import PermissionManagement from '@/views/system/permissions/index.vue'

defineOptions({ name: 'CloudBimSystem' })

interface SystemTab {
  id: string
  label: string
  description: string
  icon: Component
  component: Component
}

const tabs: SystemTab[] = [
  {
    id: 'organization',
    label: '组织管理',
    description: '维护组织架构与品牌信息',
    icon: OfficeBuilding,
    component: OrganizationManagement,
  },
  {
    id: 'personnel',
    label: '人员管理',
    description: '管理成员与角色分配',
    icon: UserFilled,
    component: PersonnelManagement,
  },
  {
    id: 'permissions',
    label: '权限管理',
    description: '配置角色与权限项',
    icon: Lock,
    component: PermissionManagement,
  },
]

const activeTab = ref('organization')
const currentTab = computed(
  () => tabs.find((tab) => tab.id === activeTab.value) || tabs[0],
)
</script>

<style lang="scss" scoped>
.cb-system {
  display: flex;
  height: 100%;
  min-height: 0;
  background: var(--bg-card);
}

.cb-system__rail {
  display: flex;
  flex: 0 0 240px;
  flex-direction: column;
  gap: var(--spacing-xs);
  width: 240px;
  min-height: 0;
  padding: var(--spacing-md) var(--spacing-sm);
  overflow-y: auto;
  background: var(--bg-card);
  border-right: 1px solid var(--border-color-light);
}

.cb-system__rail-title {
  padding: 0 var(--spacing-compact) var(--spacing-sm);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.cb-system__tab {
  display: flex;
  gap: var(--spacing-compact);
  align-items: center;
  padding: var(--spacing-compact);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-fast);
}

.cb-system__tab:hover {
  background: var(--bg-control-hover);
}

.cb-system__tab.is-active {
  background: var(--color-primary-soft);
  border-color: var(--border-color-focus);
}

.cb-system__tab-icon {
  display: grid;
  flex: 0 0 32px;
  place-items: center;
  height: 32px;
  color: var(--text-secondary);
  background: var(--bg-control);
  border-radius: var(--radius-xs);
}

.cb-system__tab.is-active .cb-system__tab-icon {
  color: var(--color-primary);
}

.cb-system__tab-text {
  min-width: 0;
}

.cb-system__tab-title {
  display: block;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.cb-system__tab-desc {
  display: block;
  margin-top: 2px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.cb-system__tab.is-active .cb-system__tab-title {
  font-weight: 600;
  color: var(--color-primary);
}

.cb-system__content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

@media (width <= 800px) {
  .cb-system {
    flex-direction: column;
  }

  .cb-system__rail {
    flex: 0 0 auto;
    flex-direction: row;
    width: 100%;
    min-height: auto;
    padding: var(--spacing-sm);
    border-right: 0;
    border-bottom: 1px solid var(--border-color-light);
  }

  .cb-system__rail-title,
  .cb-system__tab-desc {
    display: none;
  }
}
</style>
