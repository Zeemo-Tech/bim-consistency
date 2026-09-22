<template>
  <CloudBimShell variant="workspace" :sidebar="true" active="projects">
    <ProjectFileList
      title="设计模型"
      description="管理设计模型与归档信息，为扫描点云关联提供依据。"
      upload-label="上传模型"
      :kinds="['bim']"
    />
  </CloudBimShell>
</template>

<script setup lang="ts">
import CloudBimShell from '@/layout/cloudbim/CloudBimShell.vue'
import ProjectFileList from '../components/ProjectFileList.vue'

defineOptions({ name: 'CloudBimBim' })
</script>
