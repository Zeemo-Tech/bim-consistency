<template>
  <header class="app-header">
    <div class="header-left">
      <button
        class="header-brand"
        type="button"
        title="CloudBIM"
        aria-label="CloudBIM"
        @click="goProjects"
      >
        <span class="brand-mark">
          <el-icon :size="21"><Share /></el-icon>
        </span>
        <span class="brand-name">实模一致</span>
      </button>

      <nav class="top-tabs" aria-label="主导航">
        <button
          class="top-tab"
          :class="{ 'is-active': props.active === 'projects' }"
          type="button"
          :aria-current="props.active === 'projects' ? 'page' : undefined"
          @click="goProjects"
        >
          <el-icon><Folder /></el-icon>
          <span>项目</span>
        </button>
        <button
          class="top-tab"
          :class="{ 'is-active': props.active === 'devices' }"
          type="button"
          :aria-current="props.active === 'devices' ? 'page' : undefined"
          @click="goDevices"
        >
          <el-icon><Monitor /></el-icon>
          <span>设备中心</span>
        </button>
      </nav>
    </div>

    <HeaderActions />
  </header>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Folder, Monitor, Share } from '@element-plus/icons-vue'
import HeaderActions from './HeaderActions.vue'

const props = defineProps<{ active?: 'projects' | 'devices' }>()

const router = useRouter()

function goProjects() {
  void router.push('/projects')
}

function goDevices() {
  void router.push('/devices')
}
</script>

<style lang="scss" scoped>
.app-header {
  display: flex;
  flex: 0 0 var(--header-height);
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  padding: 0 var(--spacing-lg);
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-color-light);
}

.header-left,
.header-brand,
.top-tabs {
  display: flex;
  align-items: center;
}

.header-left {
  min-width: 0;
  height: 100%;
}

.header-brand {
  flex: 0 0 auto;
  gap: var(--spacing-sm);
  height: 100%;
  padding: 0 64px 0 0;
  color: var(--brand-sapphire);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-right: 1px solid var(--border-color-light);
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  color: #fff;
  background: var(--brand-sapphire);
  border-radius: var(--radius-sm);
}

.brand-name {
  font-size: var(--font-size-lg);
  font-weight: 700;
  letter-spacing: 0.04em;
}

.top-tabs {
  align-self: stretch;
  gap: var(--spacing-xs);
  margin-left: var(--spacing-lg);
}

.top-tab {
  position: relative;
  display: inline-flex;
  gap: var(--spacing-sm);
  align-items: center;
  height: 100%;
  padding: 0 var(--spacing-md);
  color: var(--text-secondary);
  cursor: pointer;
  background: transparent;
  border: 0;
  transition: color var(--transition-fast);
}

.top-tab::after {
  position: absolute;
  right: var(--spacing-md);
  bottom: 0;
  left: var(--spacing-md);
  height: 3px;
  content: '';
  background: transparent;
  border-radius: var(--radius-pill) var(--radius-pill) 0 0;
  transition: background-color var(--transition-fast);
}

.top-tab:hover,
.top-tab.is-active {
  color: var(--color-primary);
}

.top-tab.is-active {
  font-weight: 600;
}

.top-tab.is-active::after {
  background: var(--color-primary);
}

@media (width <= 800px) {
  .app-header {
    padding-inline: var(--spacing-md);
  }

  .brand-name {
    display: none;
  }

  .header-brand {
    padding-right: var(--spacing-md);
  }

  .top-tabs {
    margin-left: var(--spacing-sm);
  }

  .top-tab {
    gap: var(--spacing-xs);
    padding-inline: var(--spacing-sm);
  }

  .top-tab::after {
    right: var(--spacing-sm);
    left: var(--spacing-sm);
  }
}

@media (width <= 520px) {
  .app-header {
    padding-inline: var(--spacing-sm);
  }

  .top-tabs {
    margin-left: var(--spacing-xs);
  }

  .top-tab {
    font-size: var(--font-size-xs);
  }

  .top-tab .el-icon {
    display: none;
  }
}
</style>
