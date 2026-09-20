<template>
  <div class="statistics-container">
    <!-- BIM模型统计卡片 -->
    <el-card class="stat-card bim-card" shadow="never">
      <div class="stat-icon">
        <el-icon :size="24"><Box /></el-icon>
      </div>
      <div class="stat-content">
        <div class="stat-number">{{ statistics.bimCount }}</div>
        <div class="stat-label">BIM 模型</div>
        <div class="stat-desc">三维建筑文件</div>
      </div>
    </el-card>

    <!-- CAD图纸统计卡片 -->
    <el-card class="stat-card cad-card" shadow="never">
      <div class="stat-icon">
        <el-icon :size="24"><Document /></el-icon>
      </div>
      <div class="stat-content">
        <div class="stat-number">{{ statistics.cadCount }}</div>
        <div class="stat-label">CAD 图纸</div>
        <div class="stat-desc">二维施工图纸</div>
      </div>
    </el-card>

    <!-- 点云文件统计卡片 -->
    <el-card class="stat-card pointcloud-card" shadow="never">
      <div class="stat-icon">
        <el-icon :size="24"><Histogram /></el-icon>
      </div>
      <div class="stat-content">
        <div class="stat-number">{{ statistics.pointCloudCount }}</div>
        <div class="stat-label">点云文件</div>
        <div class="stat-desc">激光扫描数据</div>
      </div>
    </el-card>

    <!-- 高斯模型统计卡片 -->
    <el-card class="stat-card gauss-card" shadow="never">
      <div class="stat-icon">
        <el-icon :size="24"><Share /></el-icon>
      </div>
      <div class="stat-content">
        <div class="stat-number">{{ statistics.gaussCount }}</div>
        <div class="stat-label">高斯模型</div>
        <div class="stat-desc">LCC 高斯数据</div>
      </div>
    </el-card>

    <!-- 存储空间统计卡片 -->
    <el-card class="stat-card storage-card" shadow="never">
      <div class="stat-icon">
        <el-icon :size="24"><Coin /></el-icon>
      </div>
      <div class="stat-content">
        <div class="stat-number">{{ statistics.usedStorage }} MB</div>
        <div class="stat-label">已使用空间</div>
        <div class="stat-desc">存储使用量</div>
      </div>
    </el-card>

    <!-- 项目总数统计卡片 -->
    <el-card class="stat-card project-card" shadow="never">
      <div class="stat-icon">
        <el-icon :size="24"><Folder /></el-icon>
      </div>
      <div class="stat-content">
        <div class="stat-number">{{ statistics.projectCount }}</div>
        <div class="stat-label">项目总数</div>
        <div class="stat-desc">关联项目</div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { Box, Document, Histogram, Coin, Folder, Share } from '@element-plus/icons-vue'

/**
 * 统计数据类型定义
 */
export interface StatisticsData {
  bimCount: number
  cadCount: number
  pointCloudCount: number
  gaussCount: number
  usedStorage: number
  projectCount: number
}

/**
 * 组件属性定义
 */
interface Props {
  statistics: StatisticsData
}

defineProps<Props>()
</script>

<style lang="scss" scoped>
.statistics-container {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
  margin-bottom: 20px;

  .stat-card {
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    background: #fff;
    border: 1px solid #e4e7ed;

    &:hover {
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    }

    :deep(.el-card__body) {
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: #f5f7fa;
    }

    .stat-content {
      flex: 1;

      .stat-number {
        font-size: 24px;
        font-weight: 600;
        line-height: 1.2;
        margin-bottom: 4px;
        color: #303133;
      }

      .stat-label {
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 2px;
        color: #606266;
      }

      .stat-desc {
        font-size: 12px;
        color: #909399;
      }
    }

    // BIM卡片主题色
    &.bim-card {
      .stat-icon {
        color: #409eff;
      }
    }

    // CAD卡片主题色
    &.cad-card {
      .stat-icon {
        color: #67c23a;
      }
    }

    // 点云卡片主题色
    &.pointcloud-card {
      .stat-icon {
        color: #e6a23c;
      }
    }

    // 高斯卡片主题色
    &.gauss-card {
      .stat-icon {
        color: #909399;
      }
    }

    // 存储卡片主题色
    &.storage-card {
      .stat-icon {
        color: #909399;
      }
    }

    // 项目卡片主题色
    &.project-card {
      .stat-icon {
        color: #606266;
      }
    }
  }
}

// 响应式布局适配
@media screen and (max-width: 1600px) {
  .statistics-container {
    grid-template-columns: repeat(6, 1fr);
  }
}

@media screen and (max-width: 1200px) {
  .statistics-container {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media screen and (max-width: 768px) {
  .statistics-container {
    grid-template-columns: 1fr;
  }
}
</style>
