<template>
  <aside
    class="measurement-toolbar"
    :class="[`orientation-${orientation}`, { 'is-collapsed': collapsed }]"
    aria-label="测量工具"
  >
    <button
      class="measurement-toggle"
      :class="{ 'is-active': !collapsed || mode !== 'none' }"
      type="button"
      :aria-expanded="!collapsed"
      :aria-label="collapsed ? '展开测量工具' : '收起测量工具'"
      :title="collapsed ? '展开测量工具' : '收起测量工具'"
      @click="toggleToolbar"
    >
      <el-icon><Aim /></el-icon>
    </button>

    <div v-show="!collapsed" class="measurement-actions">
      <button
        v-for="action in actions"
        :key="action.mode"
        class="measurement-action"
        :class="{ 'is-active': mode === action.mode }"
        type="button"
        :disabled="disabled"
        :aria-label="action.title"
        :aria-pressed="mode === action.mode"
        :title="action.title"
        @click="select(action.mode)"
      >
        <el-icon><component :is="action.icon" /></el-icon>
        <span>{{ action.label }}</span>
      </button>

      <button
        class="measurement-action measurement-action--clear"
        type="button"
        :disabled="disabled"
        title="清除全部测量结果"
        aria-label="清除全部测量结果"
        @click="emit('clear')"
      >
        <el-icon><Delete /></el-icon>
        <span>清除</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import {
  Aim,
  Delete,
  FullScreen,
  LocationInformation,
} from '@element-plus/icons-vue'
import type { Component } from 'vue'

type AnalysisMode = 'none' | 'distance' | 'locate' | 'area'

interface MeasurementAction {
  mode: Exclude<AnalysisMode, 'none'>
  label: string
  title: string
  icon: Component
}

withDefaults(
  defineProps<{
    mode: AnalysisMode
    disabled?: boolean
    orientation?: 'horizontal' | 'vertical'
  }>(),
  { disabled: false, orientation: 'horizontal' },
)

const emit = defineEmits<{
  (event: 'update:mode', mode: AnalysisMode): void
  (event: 'clear'): void
}>()

const collapsed = defineModel<boolean>('collapsed', { default: true })

const actions: MeasurementAction[] = [
  { mode: 'distance', label: '测距', title: '全局测距', icon: Aim },
  {
    mode: 'locate',
    label: '定位',
    title: '全局定位',
    icon: LocationInformation,
  },
  { mode: 'area', label: '面积', title: '面积测量', icon: FullScreen },
]

function select(mode: Exclude<AnalysisMode, 'none'>) {
  emit('update:mode', mode)
}

function toggleToolbar() {
  collapsed.value = !collapsed.value
}
</script>

<style lang="scss" scoped>
.measurement-toolbar {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

.measurement-toggle,
.measurement-action {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  min-height: var(--control-height, 32px);
  color: var(--text-secondary);
  cursor: pointer;
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-xs);
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast);
}

.measurement-toggle {
  flex: 0 0 var(--control-height, 32px);
  width: var(--control-height, 32px);
  padding: 0;
  font-size: 16px;
}

.measurement-toggle:hover,
.measurement-action:hover:not(:disabled) {
  color: var(--color-primary-active);
  background: var(--bg-control-hover);
  border-color: var(--border-color-hover);
}

.measurement-toggle.is-active {
  color: var(--color-primary-active);
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}

.measurement-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}

.orientation-vertical {
  flex-direction: column;
  align-items: flex-end;
}

.orientation-vertical .measurement-actions {
  flex-direction: column;
  align-items: stretch;
  padding: 4px;
  background: rgb(26 29 36 / 90%);
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: var(--radius-sm);
}

.orientation-vertical .measurement-action {
  justify-content: flex-start;
  color: var(--viewer-ink, #e8ecf8);
  background: transparent;
  border-color: transparent;
}

.orientation-vertical .measurement-action:hover:not(:disabled) {
  color: #fff;
  background: rgb(34 211 238 / 14%);
  border-color: transparent;
}

.orientation-vertical .measurement-action.is-active {
  color: #fff;
  background: var(--color-primary);
}

.orientation-vertical .measurement-action--clear {
  color: #f0a6ac;
}

.orientation-vertical .measurement-toggle {
  color: var(--viewer-ink, #e8ecf8);
  background: rgb(26 29 36 / 90%);
  border-color: rgb(255 255 255 / 14%);
}

.measurement-action {
  padding: 0 10px;
  font-size: var(--font-size-sm);
}

.measurement-action.is-active {
  font-weight: 600;
  color: #fff;
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.measurement-action--clear {
  color: var(--text-danger);
}

.measurement-action:disabled {
  color: var(--text-disabled);
  cursor: not-allowed;
  background: var(--bg-muted);
  border-color: var(--border-color-light);
}
</style>
