<template>
  <CloudBimShell variant="workspace" :sidebar="true" active="projects">
    <ProjectFileList
      title="CAD图纸"
      description="管理设计图纸与归档信息。"
      upload-label="上传图纸"
      :kinds="['cad']"
    />
  </CloudBimShell>
</template>

<script setup lang="ts">
import CloudBimShell from '@/layout/cloudbim/CloudBimShell.vue'
import ProjectFileList from '../components/ProjectFileList.vue'

defineOptions({ name: 'CloudBimCad' })
</script>
