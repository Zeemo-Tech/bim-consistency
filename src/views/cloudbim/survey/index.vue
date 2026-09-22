<template>
  <CloudBimShell variant="workspace" :sidebar="true" active="projects">
    <ProjectFileList
      title="扫描点云"
      description="管理扫描归档，关联设计模型并进入分析。"
      upload-label="上传点云"
      :kinds="['scan']"
    />
  </CloudBimShell>
</template>

<script setup lang="ts">
import CloudBimShell from '@/layout/cloudbim/CloudBimShell.vue'
import ProjectFileList from '../components/ProjectFileList.vue'

defineOptions({ name: 'CloudBimSurvey' })
</script>
