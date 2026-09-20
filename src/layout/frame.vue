<template>
  <iframe :src="src" class="iframe-container" />
</template>

<script setup lang="ts">
defineProps<{
  src: string
}>()
</script>

<style scoped lang="scss">
.iframe-container {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
