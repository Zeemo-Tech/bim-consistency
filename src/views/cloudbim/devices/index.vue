<template>
  <CloudBimShell variant="workspace" :sidebar="false" active="devices">
    <div class="cb-heading">
      <h1>设备中心</h1>
      <p>集中查看设备状态、连接信息与运行记录。</p>
    </div>
    <CloudBimPlaceholder
      :icon="Monitor"
      title="暂无设备数据"
      description="设备接入后，将在此查看在线状态、告警和最近活动。"
    />
  </CloudBimShell>
</template>

<script setup lang="ts">
import { Monitor } from '@element-plus/icons-vue'
import CloudBimShell from '@/layout/cloudbim/CloudBimShell.vue'
import CloudBimPlaceholder from '../components/CloudBimPlaceholder.vue'

defineOptions({ name: 'CloudBimDevices' })
</script>
