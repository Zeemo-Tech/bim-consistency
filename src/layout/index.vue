<template>
  <div class="layout-container" :class="{ 'is-mobile': isMobile }">
    <!-- 移动端遮罩 -->
    <div
      v-if="isMobile && !isCollapse"
      class="mobile-mask"
      @click="isCollapse = true"
    />

    <!-- 侧边栏（非全屏页面显示） -->
    <Sidebar v-if="!isFullPage" :is-collapse="isCollapse" class="layout-sidebar" />

    <!-- 主体区域 -->
    <div class="layout-main" :class="{ 'full-page': isFullPage }">
      <!-- 顶部栏（非全屏页面显示） -->
      <Header v-if="!isFullPage" v-model:is-collapse="isCollapse" class="layout-header" />

      <!-- 标签页导航（非全屏页面显示） -->
      <Tags v-if="!isFullPage" class="layout-tags" />

      <!-- 主内容区域 -->
      <AppMain class="layout-content" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from './components/Sidebar.vue'
import Header from './components/Header.vue'
import Tags from './components/Tags.vue'
import AppMain from './components/AppMain.vue'

defineOptions({
  name: 'Layout',
})

const route = useRoute()

// 是否为全屏页面
const isFullPage = computed(() => {
  return route.meta?.fullPage === true
})

// 侧边栏折叠状态
const isCollapse = ref(false)

// 是否移动端
const isMobile = ref(false)

// 检测设备类型
const checkDevice = () => {
  const rect = document.body.getBoundingClientRect()
  isMobile.value = rect.width < 768

  // 移动端默认折叠
  if (isMobile.value) {
    isCollapse.value = true
  }
}

// 监听窗口大小变化
const handleResize = () => {
  checkDevice()
}

onMounted(() => {
  checkDevice()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style lang="scss" scoped>
.layout-container {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;

  /* 移动端遮罩 */
  .mobile-mask {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.3);
    z-index: 998;
  }

  /* 侧边栏 */
  .layout-sidebar {
    position: relative;
    z-index: 999;
    transition: all 0.3s;
  }

  /* 主体区域 */
  .layout-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    width: 0;
    overflow: hidden;

    /* 顶部栏 */
    .layout-header {
      flex-shrink: 0;
    }

    /* 标签页 */
    .layout-tags {
      flex-shrink: 0;
      height: 40px;
      background-color: var(--el-bg-color);
      border-bottom: 1px solid var(--el-border-color-light);
    }

    /* 主内容区域 */
    .layout-content {
      flex: 1;
      overflow: hidden;
    }

    /* 全屏页面样式 */
    &.full-page {
      .layout-main {
        width: 100%;
        margin-left: 0 !important;
      }
    }
  }

  /* 移动端样式 */
  &.is-mobile {
    .layout-sidebar {
      position: fixed;
      top: 0;
      left: 0;
      height: 100vh;
      z-index: 999;
      box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
    }

    .layout-main {
      width: 100%;
    }
  }
}

/* 响应式断点 */
@media screen and (max-width: 768px) {
  .layout-container {
    .layout-sidebar {
      position: fixed;
      top: 0;
      left: 0;
      height: 100vh;
      z-index: 999;
    }

    .layout-main {
      margin-left: 0 !important;
    }
  }
}

@media screen and (min-width: 769px) and (max-width: 1024px) {
  .layout-container {
    .layout-sidebar {
      width: 180px;

      &.is-collapse {
        width: 64px;
      }
    }
  }
}
</style>
