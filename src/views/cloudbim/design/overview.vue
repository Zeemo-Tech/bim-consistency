<template>
  <CloudBimShell variant="workspace" :sidebar="true" active="projects">
    <div class="cb-heading">
      <h1>项目概述</h1>
      <p>查看项目基本信息、资产与配准状态。</p>
    </div>
    <CloudBimPlaceholder
      :icon="DataBoard"
      title="项目概述"
      description="项目总览内容待接入。"
    />
  </CloudBimShell>
</template>

<script setup lang="ts">
import { DataBoard } from '@element-plus/icons-vue'
import CloudBimShell from '@/layout/cloudbim/CloudBimShell.vue'
import CloudBimPlaceholder from '../components/CloudBimPlaceholder.vue'

defineOptions({ name: 'CloudBimOverview' })
</script>
