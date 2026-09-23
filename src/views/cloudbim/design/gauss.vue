<template>
  <CloudBimShell variant="workspace" :sidebar="true" active="projects">
    <ProjectFileList
      title="高斯模型"
      description="管理高斯模型与归档信息。"
      upload-label="上传高斯模型"
      :kinds="['gauss']"
    />
  </CloudBimShell>
</template>

<script setup lang="ts">
import CloudBimShell from '@/layout/cloudbim/CloudBimShell.vue'
import ProjectFileList from '../components/ProjectFileList.vue'

defineOptions({ name: 'CloudBimGauss' })
</script>
