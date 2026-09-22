<template>
  <div class="cb-placeholder">
    <div>
      <div class="cb-placeholder__icon">
        <el-icon><component :is="props.icon" /></el-icon>
      </div>
      <strong>{{ props.title }}</strong>
      <span>{{ props.description }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    icon: Component
  }>(),
  { description: '该模块内容待接入。' },
)
</script>
