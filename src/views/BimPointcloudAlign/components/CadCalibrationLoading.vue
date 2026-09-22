<template>
  <div class="cad-calibration-loading" role="status" aria-live="polite">
    <el-icon class="is-loading" :size="22"><Loading /></el-icon>
    <span>正在加载 CAD 校准工作区…</span>
  </div>
</template>

<script setup lang="ts">
import { Loading } from '@element-plus/icons-vue'
</script>

<style lang="scss" scoped>
.cad-calibration-loading {
  grid-column: 1 / -1;
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  background: var(--bg-page);
}
</style>
