<template>
  <div
    class="drawing-calibration-container"
    :class="{ 'is-embedded': props.embedded }"
  >
    <div class="page-header-shell">
      <!-- 步骤2：CAD图纸与巡检轨迹校准（内嵌到分析流程时整块 topbar 不显示） -->
      <div v-if="isStep2Flow && !props.embedded" class="topbar">
        <div class="topbar-left">
          <div class="header-identity">
            <div class="header-title-row">
              <h1 class="brand-title">
                CAD 图纸与巡检轨迹校准 - {{ projectNamePreset || '未命名项目' }}
              </h1>
              <el-tag effect="plain" type="primary">步骤 2/2</el-tag>
            </div>
          </div>
        </div>
        <div ref="topbarActionsRef" class="topbar-right">
          <el-button plain @click="handleReturn">返回</el-button>
          <el-button
            type="success"
            :loading="completingCalibration"
            @click="handleCompleteCalibration"
          >
            完成校准
          </el-button>
          <el-button
            type="primary"
            :disabled="
              !formData.projectId || !formData.scanFileId || !formData.cadFileId
            "
            @click="loadData"
          >
            重新加载
          </el-button>
        </div>
      </div>

      <!-- 顶部数据选择区 -->
      <div v-if="!isStep2Flow" class="data-selector">
        <div class="selector-toolbar">
          <div class="selector-leading">
            <span class="selector-title">选择校准数据源</span>
          </div>

          <el-form :model="formData" label-width="72px" class="selector-form">
            <div class="selector-fields">
              <el-form-item label="项目">
                <el-select
                  v-model="formData.projectId"
                  placeholder="选择项目"
                  filterable
                  @change="onProjectChange"
                >
                  <el-option
                    v-for="project in projectList"
                    :key="project.projectId"
                    :label="project.projectName"
                    :value="project.projectId"
                  />
                </el-select>
              </el-form-item>

              <el-form-item label="扫描文件">
                <el-select
                  v-model="formData.scanFileId"
                  placeholder="选择扫描文件"
                  :disabled="!formData.projectId"
                  @change="onScanChange"
                >
                  <el-option
                    v-for="file in scanFiles"
                    :key="file.id"
                    :label="file.originalName"
                    :value="file.id"
                  />
                </el-select>
              </el-form-item>

              <el-form-item label="CAD文件">
                <el-select
                  v-model="formData.cadFileId"
                  placeholder="选择CAD文件"
                  :disabled="!formData.projectId"
                >
                  <el-option
                    v-for="file in cadFiles"
                    :key="file.id"
                    :label="file.originalName"
                    :value="file.id"
                  />
                </el-select>
              </el-form-item>
            </div>
          </el-form>

          <div ref="selectorActionsRef" class="selector-actions">
            <el-button
              type="primary"
              :disabled="
                !formData.projectId ||
                !formData.scanFileId ||
                !formData.cadFileId
              "
              @click="loadData"
            >
              加载数据
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 主区域：高度侧边栏 + CAD视图 + 对齐控件侧边栏 -->
    <div class="viewer-section">
      <!-- 高度范围竖向滑块（左侧） -->
      <div class="height-sidebar">
        <span class="height-label height-label-top">
          {{ heightSidebarTopLabel.toFixed(2) }}m
        </span>
        <div ref="heightRangeSelectorRef" class="height-slider-wrap">
          <el-slider
            v-model="heightRange"
            range
            vertical
            height="100%"
            :min="0"
            :max="5"
            :step="0.05"
            :format-tooltip="(val) => `${val.toFixed(2)}m`"
            @change="onHeightRangeChange"
          />
        </div>
        <span class="height-label height-label-bottom">
          {{ heightSidebarBottomLabel.toFixed(2) }}m
        </span>
        <span class="height-label-title">高度范围</span>
      </div>

      <!-- LAS预览（DOM保留但隐藏，供内部渲染逻辑使用） -->
      <div class="viewer-panel las-panel-hidden">
        <div ref="lasContainer" class="canvas-container las-preview-container">
          <img
            ref="previewImg"
            class="preview-img"
            :class="{ 'preview-loaded': previewData }"
            alt="preview"
          />
          <canvas
            ref="overlayCanvas"
            class="overlay-canvas"
            :class="{ 'preview-loaded': previewData }"
            @click="onLasClick"
          />
        </div>
      </div>

      <!-- CAD 图纸主视图 -->
      <div ref="cadPanelRef" class="viewer-panel cad-panel">
        <div class="panel-title">CAD 图纸 + 轨迹叠加</div>
        <div class="canvas-container cad-preview-container">
          <div v-if="!cadViewer" class="empty-placeholder">
            <div v-if="isStep2Flow" class="placeholder-content">
              <el-icon class="placeholder-loading is-loading" :size="36">
                <Loading />
              </el-icon>
              <p class="placeholder-text">
                {{ statusText || '正在加载 CAD 图纸…' }}
              </p>
            </div>
            <div v-else class="placeholder-content">
              <svg
                class="placeholder-icon"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <polyline
                  points="14,2 14,8 20,8"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <line
                  x1="9"
                  y1="15"
                  x2="15"
                  y2="15"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <line
                  x1="9"
                  y1="12"
                  x2="15"
                  y2="12"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
              <p class="placeholder-text">请先选择项目和文件</p>
              <p class="placeholder-hint">
                点击上方"加载数据"按钮加载 CAD 图纸
              </p>
            </div>
          </div>
          <div
            ref="cadRoot"
            class="cad-root"
            :class="{ 'cad-loaded': cadViewer }"
          />
        </div>
      </div>

      <!-- 右侧对齐控件侧边栏 -->
      <div
        v-if="isCalibrationMode && !sidebarCollapsed"
        ref="alignmentSidebarRef"
        class="alignment-sidebar"
      >
        <div class="sidebar-controls">
          <!-- 与前几个步骤一致的控制面板头部布局 -->
          <div class="control-panel-header">
            <div class="panel-heading">
              <el-icon class="title-icon"><Operation /></el-icon>
              <strong>CAD对齐</strong>
            </div>
            <div class="panel-step-actions">
              <el-button
                class="help-button"
                circle
                size="small"
                title="使用说明"
                @click="openCalibrationTour"
              >
                <el-icon><QuestionFilled /></el-icon>
              </el-button>
              <button
                class="panel-step-count panel-next-step panel-prev-step"
                type="button"
                @click="emit('prev-step')"
              >
                <el-icon aria-hidden="true"><DArrowLeft /></el-icon>
                上一步
              </button>
              <button
                class="panel-step-count panel-next-step"
                type="button"
                @click="emit('next-step')"
              >
                下一步
                <el-icon aria-hidden="true"><DArrowRight /></el-icon>
              </button>
            </div>
          </div>
          <div class="sidebar-body">
            <div class="tool-card">
              <div class="tool-card-header">
                <div class="tool-card-title">
                  <span class="tool-card-icon scale">
                    <el-icon><ZoomIn /></el-icon>
                  </span>
                  <div class="tool-card-copy">
                    <span class="tool-card-name">缩放</span>
                    <span class="tool-card-desc">调整轨迹图层比例</span>
                  </div>
                </div>
                <span class="tool-card-value">{{ scaleDisplayText }}</span>
              </div>
              <div class="tool-card-content">
                <div class="control-row">
                  <el-button
                    class="control-button"
                    size="small"
                    :disabled="overlayScale <= 0.1"
                    @click="decreaseScale"
                  >
                    -
                  </el-button>
                  <div class="control-slider-wrap">
                    <el-slider
                      v-model="overlayScale"
                      :min="0.1"
                      :max="5000"
                      :step="scaleSnapStep"
                      :format-tooltip="formatScaleTooltip"
                      @input="updatePointCloudScale"
                    />
                  </div>
                  <el-button
                    class="control-button"
                    size="small"
                    :disabled="overlayScale >= 5000"
                    @click="increaseScale"
                  >
                    +
                  </el-button>
                </div>
                <div class="control-meta">
                  <span class="steps-label">步长</span>
                  <el-radio-group
                    v-model="scaleSnapStep"
                    size="small"
                    class="step-segmented"
                  >
                    <el-radio-button
                      v-for="option in scaleStepOptions"
                      :key="`scale-${option}`"
                      :value="option"
                    >
                      {{ option }}
                    </el-radio-button>
                  </el-radio-group>
                </div>
              </div>
            </div>

            <div class="tool-card">
              <div class="tool-card-header">
                <div class="tool-card-title">
                  <span class="tool-card-icon rotation">
                    <el-icon><RefreshRight /></el-icon>
                  </span>
                  <div class="tool-card-copy">
                    <span class="tool-card-name">旋转</span>
                    <span class="tool-card-desc">调整轨迹角度与朝向</span>
                  </div>
                </div>
                <span class="tool-card-value">{{ rotationDisplayText }}</span>
              </div>
              <div class="tool-card-content">
                <div class="control-row">
                  <el-button
                    class="control-button"
                    size="small"
                    :disabled="overlayRotation <= -180"
                    @click="decreaseRotation"
                  >
                    -
                  </el-button>
                  <div class="control-slider-wrap">
                    <el-slider
                      v-model="overlayRotation"
                      :min="-180"
                      :max="180"
                      :step="rotationSnapStep"
                      :format-tooltip="formatRotationTooltip"
                      @input="updatePointCloudRotation"
                    />
                  </div>
                  <el-button
                    class="control-button"
                    size="small"
                    :disabled="overlayRotation >= 180"
                    @click="increaseRotation"
                  >
                    +
                  </el-button>
                </div>
                <div class="control-meta">
                  <span class="steps-label">步长</span>
                  <el-radio-group
                    v-model="rotationSnapStep"
                    size="small"
                    class="step-segmented"
                  >
                    <el-radio-button
                      v-for="option in rotationStepOptions"
                      :key="`rotation-${option.value}`"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </el-radio-button>
                  </el-radio-group>
                </div>
              </div>
            </div>

            <div class="tool-card">
              <div class="tool-card-header">
                <div class="tool-card-title">
                  <span class="tool-card-icon translation">
                    <el-icon><Position /></el-icon>
                  </span>
                  <div class="tool-card-copy">
                    <span class="tool-card-name">平移</span>
                    <span class="tool-card-desc">按 X / Y 方向微调位置</span>
                  </div>
                </div>
                <div class="coordinate-summary">
                  <span class="coordinate-summary-item">
                    X {{ overlayPosition.x.toFixed(1) }}
                  </span>
                  <span class="coordinate-summary-item">
                    Y {{ overlayPosition.y.toFixed(1) }}
                  </span>
                </div>
              </div>
              <div class="tool-card-content">
                <div class="control-row translate-row">
                  <span class="axis-tag">X</span>
                  <el-button
                    class="control-button"
                    size="small"
                    @click="stepMoveX(-1)"
                  >
                    -
                  </el-button>
                  <div class="control-slider-wrap">
                    <el-slider
                      :model-value="0"
                      :min="-translationSnapStep"
                      :max="translationSnapStep"
                      :step="translationSliderStep"
                      :show-tooltip="false"
                      @input="onTranslateXSliderInput"
                    />
                  </div>
                  <el-button
                    class="control-button"
                    size="small"
                    @click="stepMoveX(1)"
                  >
                    +
                  </el-button>
                </div>
                <div class="control-row translate-row">
                  <span class="axis-tag">Y</span>
                  <el-button
                    class="control-button"
                    size="small"
                    @click="stepMoveY(-1)"
                  >
                    -
                  </el-button>
                  <div class="control-slider-wrap">
                    <el-slider
                      :model-value="0"
                      :min="-translationSnapStep"
                      :max="translationSnapStep"
                      :step="translationSliderStep"
                      :show-tooltip="false"
                      @input="onTranslateYSliderInput"
                    />
                  </div>
                  <el-button
                    class="control-button"
                    size="small"
                    @click="stepMoveY(1)"
                  >
                    +
                  </el-button>
                </div>
                <div class="control-meta">
                  <span class="steps-label">步长</span>
                  <el-radio-group
                    v-model="translationSnapStep"
                    size="small"
                    class="step-segmented"
                  >
                    <el-radio-button
                      v-for="option in translationStepOptions"
                      :key="`translation-${option}`"
                      :value="option"
                    >
                      {{ option }}
                    </el-radio-button>
                  </el-radio-group>
                </div>
              </div>
            </div>

            <div class="tool-card">
              <div class="tool-card-header">
                <div class="tool-card-title">
                  <span class="tool-card-icon display">
                    <el-icon><View /></el-icon>
                  </span>
                  <div class="tool-card-copy">
                    <span class="tool-card-name">显示</span>
                    <span class="tool-card-desc">控制背景透明度与叠加表现</span>
                  </div>
                </div>
                <span class="tool-card-value">
                  {{ backgroundAlphaDisplayText }}
                </span>
              </div>
              <div class="tool-card-content">
                <div class="display-switch-row">
                  <div class="display-switch-copy">
                    <span class="switch-title">结果叠加</span>
                    <span class="switch-desc">查看已保存的校准结果</span>
                  </div>
                  <el-switch
                    :model-value="showPointCloudOverlay"
                    :disabled="!alignment"
                    inline-prompt
                    active-text="开"
                    inactive-text="关"
                    @change="handleOverlayVisibilityChange"
                  />
                </div>
                <div class="control-row">
                  <el-button
                    class="control-button"
                    size="small"
                    :disabled="pointCloudBgAlpha <= 0"
                    @click="decreaseBackgroundAlpha"
                  >
                    -
                  </el-button>
                  <div class="control-slider-wrap">
                    <el-slider
                      v-model="pointCloudBgAlpha"
                      :min="0"
                      :max="1"
                      :step="0.05"
                      :format-tooltip="formatAlphaTooltip"
                    />
                  </div>
                  <el-button
                    class="control-button"
                    size="small"
                    :disabled="pointCloudBgAlpha >= 1"
                    @click="increaseBackgroundAlpha"
                  >
                    +
                  </el-button>
                </div>
                <div class="color-controls">
                  <div class="color-control">
                    <span class="color-label">线条颜色</span>
                    <el-color-picker
                      v-model="pointCloudContentColor"
                      size="small"
                      @change="onContentColorChange"
                    />
                  </div>
                  <div class="color-control">
                    <span class="color-label">背景颜色</span>
                    <el-color-picker
                      v-model="pointCloudBgColor"
                      size="small"
                      @change="onBgColorChange"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="props.embedded" class="sidebar-actions">
          <el-button
            plain
            :disabled="
              !formData.projectId || !formData.scanFileId || !formData.cadFileId
            "
            @click="loadData"
          >
            重新加载
          </el-button>
          <el-button
            type="primary"
            :loading="completingCalibration"
            @click="handleCompleteCalibration"
          >
            完成校准
          </el-button>
        </div>
      </div>
    </div>

    <el-tour
      v-model="showCalibrationTour"
      :z-index="4000"
      :mask="{ color: 'rgba(15, 23, 42, 0.18)' }"
      :target-area-clickable="false"
      @close="handleCalibrationTourDismiss"
      @finish="handleCalibrationTourDismiss"
    >
      <el-tour-step
        :target="getCadPanelTourTarget"
        title="画布校准"
        description="在图纸区域直接拖拽坐标轴与旋转环完成轨迹对齐。按住 Shift 可平移视图，Shift + 滚轮可缩放点云。"
        placement="left-start"
      />
      <el-tour-step
        :target="getAlignmentSidebarTourTarget"
        title="参数微调"
        description="右侧工具用于精调缩放、旋转、平移和显示参数。"
        placement="left-start"
      />
      <el-tour-step
        :target="getActionAreaTourTarget"
        title="结果保存"
        description="点击“完成校准”后才会保存结果；“重新加载”仅刷新当前数据。"
        placement="bottom-end"
      />
    </el-tour>

    <!-- Gizmo 操作器：旋转环 + XY 轴 + 中心平移手柄 -->
    <svg
      v-if="isCalibrationMode && cadOverlayPointCloudPlane && gizmoCenterScreen"
      class="gizmo-overlay"
      :style="gizmoStyle"
      :width="GIZMO_SVG_SIZE"
      :height="GIZMO_SVG_SIZE"
      :viewBox="`0 0 ${GIZMO_SVG_SIZE} ${GIZMO_SVG_SIZE}`"
    >
      <!-- 旋转环：宽碰撞区（透明宽stroke，方便点击） -->
      <circle
        :cx="GIZMO_C"
        :cy="GIZMO_C"
        :r="GIZMO_RING_R"
        fill="none"
        stroke="transparent"
        stroke-width="28"
        class="gizmo-ring-hit"
        @mousedown="startGizmoRotateDrag"
      />
      <!-- 旋转环：视觉展示 -->
      <circle
        :cx="GIZMO_C"
        :cy="GIZMO_C"
        :r="GIZMO_RING_R"
        fill="none"
        stroke="#4da3ff"
        stroke-width="2"
        stroke-dasharray="7 4"
        pointer-events="none"
      />
      <!-- 旋转方向箭头（顺时针标识，顶部） -->
      <path
        :d="`M ${GIZMO_C - 10} ${GIZMO_C - GIZMO_RING_R - 10} A ${GIZMO_RING_R + 10} ${GIZMO_RING_R + 10} 0 0 1 ${GIZMO_C + 10} ${GIZMO_C - GIZMO_RING_R - 10}`"
        fill="none"
        stroke="#4da3ff"
        stroke-width="1.5"
        pointer-events="none"
      />
      <!-- X 轴线 (红) -->
      <line
        :x1="GIZMO_C"
        :y1="GIZMO_C"
        :x2="gizmoXEnd.x"
        :y2="gizmoXEnd.y"
        stroke="#f56c6c"
        stroke-width="2.5"
        pointer-events="none"
      />
      <!-- X 轴碰撞区 -->
      <line
        :x1="GIZMO_C + 8 * Math.cos(gizmoTheta)"
        :y1="GIZMO_C - 8 * Math.sin(gizmoTheta)"
        :x2="gizmoXEnd.x"
        :y2="gizmoXEnd.y"
        stroke="transparent"
        stroke-width="24"
        class="gizmo-axis-hit"
        @mousedown="startGizmoXDrag"
      />
      <!-- X 轴箭头 -->
      <polygon
        :points="gizmoXArrowPoints"
        fill="#f56c6c"
        pointer-events="none"
      />
      <!-- X 标签 -->
      <text
        :x="gizmoXEnd.x + 6 * Math.cos(gizmoTheta)"
        :y="gizmoXEnd.y - 6 * Math.sin(gizmoTheta) + 4"
        fill="#f56c6c"
        font-size="11"
        font-weight="bold"
        pointer-events="none"
      >
        X
      </text>
      <!-- Y 轴线 (绿) -->
      <line
        :x1="GIZMO_C"
        :y1="GIZMO_C"
        :x2="gizmoYEnd.x"
        :y2="gizmoYEnd.y"
        stroke="#67c23a"
        stroke-width="2.5"
        pointer-events="none"
      />
      <!-- Y 轴碰撞区 -->
      <line
        :x1="GIZMO_C - 8 * Math.sin(gizmoTheta)"
        :y1="GIZMO_C - 8 * Math.cos(gizmoTheta)"
        :x2="gizmoYEnd.x"
        :y2="gizmoYEnd.y"
        stroke="transparent"
        stroke-width="24"
        class="gizmo-axis-hit"
        @mousedown="startGizmoYDrag"
      />
      <!-- Y 轴箭头 -->
      <polygon
        :points="gizmoYArrowPoints"
        fill="#67c23a"
        pointer-events="none"
      />
      <!-- Y 标签 -->
      <text
        :x="gizmoYEnd.x - 6 * Math.sin(gizmoTheta) + 2"
        :y="gizmoYEnd.y - 6 * Math.cos(gizmoTheta) + 4"
        fill="#67c23a"
        font-size="11"
        font-weight="bold"
        pointer-events="none"
      >
        Y
      </text>
      <!-- 中心自由平移手柄 -->
      <circle
        :cx="GIZMO_C"
        :cy="GIZMO_C"
        r="14"
        fill="rgba(255,255,255,0.88)"
        stroke="#409eff"
        stroke-width="2"
        class="gizmo-center-handle"
        @mousedown="startGizmoCenterDrag"
      />
      <circle
        :cx="GIZMO_C"
        :cy="GIZMO_C"
        r="4"
        fill="#409eff"
        pointer-events="none"
      />
    </svg>

    <!-- 全景图弹出框 -->
    <el-dialog
      v-model="showPanoramaDialog"
      title="全景图展示"
      :width="'90%'"
      :top="'5vh'"
      @close="onPanoramaDialogClose"
    >
      <template #header>
        <div class="dialog-header">
          <span class="dialog-title">全景图展示</span>
          <span class="dialog-hint">拖拽鼠标旋转视角 | ESC 关闭</span>
        </div>
      </template>
      <div class="panorama-dialog-content">
        <div v-if="currentImageInfo" class="image-info">
          <span>
            坐标: ({{ currentImageInfo.x.toFixed(2) }},
            {{ currentImageInfo.y.toFixed(2) }})
          </span>
          <span>航向角: {{ currentImageInfo.yaw.toFixed(2) }}°</span>
          <span>图片: {{ currentImageInfo.imageName }}</span>
        </div>
        <div ref="panoramaContainer" class="panorama-container" />
      </div>
    </el-dialog>
    <!-- 侧边栏折叠/展开（同前两步：放在侧边栏右侧中间） -->
    <button
      v-if="isCalibrationMode"
      type="button"
      class="calibration-sidebar-toggle"
      :class="{ 'is-collapsed': sidebarCollapsed }"
      :title="sidebarCollapsed ? '展开对齐工具' : '收起对齐工具'"
      :aria-label="sidebarCollapsed ? '展开对齐工具' : '收起对齐工具'"
      @click="sidebarCollapsed = !sidebarCollapsed"
    >
      <el-icon :size="16">
        <component :is="sidebarCollapsed ? DArrowLeft : DArrowRight" />
      </el-icon>
    </button>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  onMounted,
  onActivated,
  onDeactivated,
  watch,
  onBeforeUnmount,
  computed,
  markRaw,
  shallowRef,
  nextTick,
} from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import {
  DArrowLeft,
  DArrowRight,
  Loading,
  Operation,
  ZoomIn,
  Refresh,
  RefreshRight,
  Position,
  QuestionFilled,
  View,
} from '@element-plus/icons-vue'
import { DxfViewer } from 'dxf-viewer'
import * as THREE from 'three'
import {
  getScanPreview,
  getDxfFile,
  getLatestAlignment,
  computeAlignment,
  getTrajectoryImage,
  type PreviewInfo,
  type TrajectoryInfo,
  type AlignmentPair,
  type AlignmentResult,
  type TrajectoryPoint,
} from '@/api/calibration'
import { getScanCalibration } from '@/api/scan'
import { getProjectFiles, type ProjectFileInfo } from '@/api/fileManage'
import {
  useCadRenderScheduler,
  waitForNextFrame,
} from './composables/useCadRenderScheduler'
import {
  applyAlignment,
  buildAlignmentPairsSignature,
  buildAlignmentSignature,
  colorToHex,
  getPointCloudBaseTransform,
  getSceneSyncSignature,
} from './utils/calibrationHelpers'
import {
  getCachedDxf,
  getCachedPreview,
  setCachedDxf,
  setCachedPreview,
} from './utils/cadPrefetch'

defineOptions({ name: 'DrawingCalibration' })

/**
 * 可内嵌到分析流程（第三步 CAD与轨迹校准）：
 * embedded 时强制走「步骤2」的校准视图，并隐藏返回/步骤标签。
 */
const props = withDefaults(
  defineProps<{
    embedded?: boolean
  }>(),
  { embedded: false },
)

const emit = defineEmits<{
  (e: 'prev-step'): void
  (e: 'next-step'): void
}>()

const route = useRoute()
const router = useRouter()
const CALIBRATION_RETURN_KEY = 'calibration:return'

const getQueryString = (key: string): string => {
  const value = route.query[key]
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

const isStep2Flow = computed(
  () => props.embedded || Boolean(getQueryString('returnTo')),
)
const projectNamePreset = computed(() => getQueryString('projectName') || '')

const persistStep2ReturnState = (cadCompleted: boolean) => {
  const scanId = getQueryString('scanId')
  if (!scanId) return

  sessionStorage.setItem(
    CALIBRATION_RETURN_KEY,
    JSON.stringify({
      step: 'cad',
      scanId,
      title: getQueryString('title'),
      date: getQueryString('date'),
      uploader: getQueryString('uploader'),
      projectId: getQueryString('projectId'),
      projectName: getQueryString('projectName'),
      cadId: getQueryString('cadId'),
      cadName: getQueryString('cadName'),
      bimId: getQueryString('bimId'),
      bimName: getQueryString('bimName'),
      gaussId: getQueryString('gaussId'),
      gaussName: getQueryString('gaussName'),
      gaussAssetPath: getQueryString('gaussAssetPath'),
      pointCloudName: getQueryString('pointCloudName'),
      bimCompleted: true,
      cadCompleted,
    }),
  )
}

const handleReturn = () => {
  if (isStep2Flow.value && alignment.value) {
    persistStep2ReturnState(true)
  }
  const returnTo = getQueryString('returnTo')
  if (returnTo) {
    router.push(decodeURIComponent(returnTo))
  } else {
    router.back()
  }
}

const completingCalibration = ref(false)
const hasUnsavedAlignmentChanges = ref(false)

const handleCompleteCalibration = async () => {
  if (completingCalibration.value) return

  const pairsData = buildAlignmentPairsFromPlane()
  if (!pairsData || pairsData.length < 3) {
    if (alignment.value) {
      ElMessage.success('当前没有新的未保存调整')
      return
    }

    ElMessage.warning('请先拖拽点云图与图纸对齐后再完成校准')
    return
  }

  const signature = buildAlignmentPairsSignature(pairsData)
  if (!signature) {
    ElMessage.warning('当前对齐结果无效，请调整后重试')
    return
  }

  if (signature === lastAutoSavedSignature && alignment.value) {
    hasUnsavedAlignmentChanges.value = false
    ElMessage.success('校准结果已保存')
    if (isStep2Flow.value) {
      persistStep2ReturnState(true)
      handleReturn()
    }
    return
  }

  completingCalibration.value = true
  statusText.value = '保存校准中...'

  try {
    const res = await computeAlignment(formData.value.projectId!, {
      scanFileId: formData.value.scanFileId!,
      cadFileId: formData.value.cadFileId!,
      allowScale: true,
      refineIcp: formData.value.refineIcp,
      pairs: pairsData,
    })

    if (destroyed) return

    if (res.code !== 201 || !res.data) {
      throw new Error(res.msg || '保存校准失败')
    }

    alignment.value = res.data
    lastAutoSavedSignature = signature
    hasUnsavedAlignmentChanges.value = false
    renderCadOverlayTrajectory()
    statusText.value = '校准已保存'
    ElMessage.success('校准已保存')
    if (isStep2Flow.value) {
      persistStep2ReturnState(true)
      handleReturn()
    }
  } catch (error: any) {
    if (destroyed) return
    statusText.value = error?.message || '保存校准失败'
    ElMessage.error(error?.message || '保存校准失败')
  } finally {
    completingCalibration.value = false
  }
}

// 组件销毁标志 - 防止异步操作在组件销毁后执行
let destroyed = false
// 单调递增的加载标记，用于忽略过期请求
let activeLoadId = 0
let sceneSyncSignature = ''
let step2PresetPromise: Promise<void> | null = null
let cleanupCadCanvasListeners: (() => void) | null = null
let keyboardListenersBound = false
type CadBounds = { minX: number; maxX: number; minY: number; maxY: number }
let latestCadBounds: CadBounds | null = null

const CAD_INITIAL_VIEW_PADDING = 0.12

const nextLoadId = () => {
  activeLoadId += 1
  return activeLoadId
}

const isLoadStale = (loadId?: number) => {
  if (destroyed) return true
  if (loadId == null) return false
  return loadId !== activeLoadId
}

// 表单数据
const formData = ref({
  projectId: null as number | null,
  scanFileId: null as number | null,
  cadFileId: null as number | null,
  size: 1024,
  heightMin: 1.35,
  heightMax: 2,
  refineIcp: true,
})

// 高度范围（双端滑块）
const heightRange = ref<[number, number]>([1.35, 2])
const heightRangeSelectorRef = ref<HTMLElement | null>(null)
let cleanupRangeDrag: (() => void) | null = null

// 项目列表
const projectList = ref<
  Array<{ projectId: number; projectName: string; types: any[] }>
>([])
const scanFiles = ref<ProjectFileInfo[]>([])
const cadFiles = ref<ProjectFileInfo[]>([])

// 预览和轨迹数据
const previewData = ref<PreviewInfo | null>(null)
const trajectoryData = ref<TrajectoryInfo | null>(null)

// DXF查看器
const cadViewer = ref<any>(null)
const cadOrigin = ref<{ x: number; y: number } | null>(null)
const cadOverlayLine = ref<THREE.Line | null>(null)
const cadOverlayPointCloud = ref<THREE.Mesh | null>(null) // 对齐后的点云叠加
const cadOverlayPointCloudPlane = ref<THREE.Mesh | null>(null) // 辅助模式的点云平面
const cadOverlayBackgroundPlane = ref<THREE.Mesh | null>(null) // 独立背景层：铺满视口，不影响点云内容
const showPointCloudOverlay = ref<boolean>(false) // 控制结果态点云叠加显示
const { requestCadRender, cancelCadRender } = useCadRenderScheduler(
  () => cadViewer.value,
  () => destroyed,
)

// 辅助选点模式
const isCalibrationMode = ref<boolean>(false)
/** 右侧「轨迹对齐工具」侧边栏是否折叠 */
const sidebarCollapsed = ref(false)
const overlayPosition = ref<{ x: number; y: number }>({ x: 0, y: 0 })
const overlayScale = ref<number>(1)
const overlayRotation = ref<number>(0) // 旋转角度（度）

// 拖动和键盘状态
const isDragging = ref<boolean>(false)
const isCtrlPressed = ref<boolean>(false)
const dragStartPos = ref<{ x: number; y: number }>({ x: 0, y: 0 })

// 旋转控制器状态
const rotationHandlePosition = ref<{ x: number; y: number }>({ x: 0, y: 0 })
const isRotating = ref<boolean>(false)
const rotationStartAngle = ref<number>(0)

// 浮动工具面板相关（保留旧变量避免破坏引用，但不再用于定位）
const floatingPanelPosition = ref<{ x: number; y: number }>({ x: 250, y: 100 })
const isPanelDragging = ref<boolean>(false)
const panelDragStart = ref<{ x: number; y: number }>({ x: 0, y: 0 })
const panelSnapThreshold = ref<number>(20)

// 面板折叠状态
const isToolPanelCollapsed = ref<boolean>(false)

// Gizmo 操作器
const gizmoCenterScreen = ref<{ x: number; y: number } | null>(null)
const isGizmoDragging = ref<'none' | 'rotate' | 'x' | 'y' | 'free'>('none')

// Gizmo SVG 尺寸常量（template 中直接使用）
const GIZMO_SVG_SIZE = 220
const GIZMO_C = GIZMO_SVG_SIZE / 2 // 110
const GIZMO_RING_R = 88
const GIZMO_AXIS_LEN = 72

// 缩放和旋转步长配置
const scaleStep = ref<number>(10) // 缩放步长
const rotationStep = ref<number>(5) // 旋转步长（度）
const positionStep = ref<number>(500) // 位置微调步长
const rotationSnapStep = ref<number>(1) // Gizmo 旋转吸附步长（度）
const scaleSnapStep = ref<number>(100) // 缩放步长
const translationSnapStep = ref<number>(500) // 平移步长（CAD 单位）

const scaleStepOptions = [500, 100, 50, 10] as const
const rotationStepOptions = [
  { label: '1°', value: 1 },
  { label: '0.5°', value: 0.5 },
  { label: '0.1°', value: 0.1 },
  { label: '0.01°', value: 0.01 },
] as const
const translationStepOptions = [500, 100, 10, 1] as const

// 点云样式参数
const pointCloudBgAlpha = ref<number>(0.62) // 背景透明度 0-1，默认 0.62，增强对比同时保留 CAD 可读性
const pointCloudContentColor = ref<string>('#F6FF7A') // 线条颜色：高对比亮黄绿
const pointCloudBgColor = ref<string>('#0B1220') // 背景颜色：更深的蓝黑色，衬托点云内容

// 点对数据
const pendingLas = ref<{ lasX: number; lasY: number } | null>(null)
const pendingCad = ref<{ cadX: number; cadY: number } | null>(null)
const pairs = ref<AlignmentPair[]>([])

// 左侧高度条标签固定显示点云整体高度范围的 2% / 98% 位置，而不是当前选中值
const overallPointCloudHeightRange = computed(() => {
  const preview = previewData.value as (PreviewInfo & { z0?: number }) | null
  if (!preview || typeof preview.z0 !== 'number') return null

  const rawMin = preview.z0 - preview.groundZ
  const rawMax = preview.z0 + preview.dz * preview.buckets - preview.groundZ

  const minHeight = Math.min(rawMin, rawMax)
  const maxHeight = Math.max(rawMin, rawMax)
  const span = maxHeight - minHeight

  if (!Number.isFinite(minHeight) || !Number.isFinite(maxHeight) || span <= 0) {
    return null
  }

  return {
    low: minHeight + span * 0.02,
    high: minHeight + span * 0.98,
  }
})

const heightSidebarTopLabel = computed(
  () => overallPointCloudHeightRange.value?.high ?? heightRange.value[1],
)

const heightSidebarBottomLabel = computed(
  () => overallPointCloudHeightRange.value?.low ?? heightRange.value[0],
)

// 对齐结果
const alignment = ref<AlignmentResult | null>(null)

// 图片缓存
const imageCache = new Map<string, string>()
const currentImageUrl = ref<string>('')
const currentImageInfo = ref<any>(null)
const showPanoramaDialog = ref<boolean>(false)
const showCalibrationTour = ref(false)

// 状态文本
const statusText = ref<string>('')

// DOM引用
const previewImg = ref<HTMLImageElement>()
const overlayCanvas = ref<HTMLCanvasElement>()
const cadRoot = ref<HTMLDivElement>()
const cadPanelRef = ref<HTMLDivElement | null>(null)
const alignmentSidebarRef = ref<HTMLDivElement | null>(null)
const topbarActionsRef = ref<HTMLDivElement | null>(null)
const selectorActionsRef = ref<HTMLDivElement | null>(null)
const lasContainer = ref<HTMLDivElement>()
const panoramaContainer = ref<HTMLDivElement>()

// 全景查看器相关
const panoramaViewer = shallowRef<{
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  sphere: THREE.Mesh
  texture: THREE.Texture | null
} | null>(null)
const panoramaMouseDown = ref(false)
const panoramaMousePos = ref({ x: 0, y: 0 })
const panoramaCameraRot = ref({ lon: 0, lat: 0 })

const pairsTableData = computed(() => {
  const list = [...pairs.value]
  // 如果有待处理的点，添加到表格中
  if (pendingLas.value || pendingCad.value) {
    list.push({
      lasX: pendingLas.value?.lasX ?? null,
      lasY: pendingLas.value?.lasY ?? null,
      cadX: pendingCad.value?.cadX ?? null,
      cadY: pendingCad.value?.cadY ?? null,
    })
  }
  return list
})

const alignmentQualityText = computed(() => {
  if (!alignment.value) return ''
  const rmse = alignment.value.rmse || 0
  if (rmse < 0.1) return '优秀'
  if (rmse < 0.5) return '良好'
  if (rmse < 1.0) return '一般'
  return '较差'
})

const scaleDisplayText = computed(() => `${overlayScale.value.toFixed(0)}x`)
const rotationDisplayText = computed(
  () => `${overlayRotation.value.toFixed(2)}°`,
)
const backgroundAlphaDisplayText = computed(
  () => `${Math.round(pointCloudBgAlpha.value * 100)}%`,
)
const translationSliderStep = computed(() =>
  Math.max(translationSnapStep.value / 10, 0.1),
)

const formatScaleTooltip = (value: number) => `${value.toFixed(0)}x`
const formatRotationTooltip = (value: number) => `${value}°`
const formatAlphaTooltip = (value: number) => `${Math.round(value * 100)}%`

const getCadPanelTourTarget = () => cadPanelRef.value
const getAlignmentSidebarTourTarget = () => alignmentSidebarRef.value
const getActionAreaTourTarget = () =>
  topbarActionsRef.value ?? selectorActionsRef.value

const handleCalibrationTourDismiss = () => {
  showCalibrationTour.value = false
}

const openCalibrationTour = async () => {
  if (destroyed || !isCalibrationMode.value) return
  await nextTick()
  await waitForNextFrame()
  if (!cadPanelRef.value || !alignmentSidebarRef.value) return
  showCalibrationTour.value = true
}

const decreaseScale = () => {
  overlayScale.value = Math.max(0.1, overlayScale.value - scaleSnapStep.value)
  updatePointCloudScale(overlayScale.value)
}

const increaseScale = () => {
  overlayScale.value = Math.min(5000, overlayScale.value + scaleSnapStep.value)
  updatePointCloudScale(overlayScale.value)
}

const decreaseRotation = () => {
  overlayRotation.value = parseFloat(
    Math.max(-180, overlayRotation.value - rotationSnapStep.value).toFixed(4),
  )
  updatePointCloudRotation(overlayRotation.value)
}

const increaseRotation = () => {
  overlayRotation.value = parseFloat(
    Math.min(180, overlayRotation.value + rotationSnapStep.value).toFixed(4),
  )
  updatePointCloudRotation(overlayRotation.value)
}

const decreaseBackgroundAlpha = () => {
  pointCloudBgAlpha.value = Math.max(0, pointCloudBgAlpha.value - 0.05)
}

const increaseBackgroundAlpha = () => {
  pointCloudBgAlpha.value = Math.min(1, pointCloudBgAlpha.value + 0.05)
}

const getSliderInputValue = (value: number | number[]) =>
  Array.isArray(value) ? value[0] : value

const onTranslateXSliderInput = (value: number | number[]) => {
  const nextValue = getSliderInputValue(value)
  if (nextValue === 0) return
  stepMoveX(nextValue > 0 ? 1 : -1)
}

const onTranslateYSliderInput = (value: number | number[]) => {
  const nextValue = getSliderInputValue(value)
  if (nextValue === 0) return
  stepMoveY(nextValue > 0 ? 1 : -1)
}

const handleOverlayVisibilityChange = async (
  value: boolean | string | number,
) => {
  const nextValue = Boolean(value)
  if (nextValue === showPointCloudOverlay.value) return
  await togglePointCloudOverlay()
}

// -------- Gizmo 计算属性 --------
const gizmoTheta = computed(() => (overlayRotation.value * Math.PI) / 180)

const gizmoStyle = computed(() => {
  if (
    !gizmoCenterScreen.value ||
    !isCalibrationMode.value ||
    !cadOverlayPointCloudPlane.value
  ) {
    return { display: 'none' }
  }
  return {
    left: gizmoCenterScreen.value.x - GIZMO_C + 'px',
    top: gizmoCenterScreen.value.y - GIZMO_C + 'px',
  }
})

const gizmoXEnd = computed(() => ({
  x: GIZMO_C + GIZMO_AXIS_LEN * Math.cos(gizmoTheta.value),
  y: GIZMO_C - GIZMO_AXIS_LEN * Math.sin(gizmoTheta.value),
}))

const gizmoYEnd = computed(() => ({
  x: GIZMO_C - GIZMO_AXIS_LEN * Math.sin(gizmoTheta.value),
  y: GIZMO_C - GIZMO_AXIS_LEN * Math.cos(gizmoTheta.value),
}))

// X 轴箭头三角形顶点
const gizmoXArrowPoints = computed(() => {
  const { x: ex, y: ey } = gizmoXEnd.value
  const t = gizmoTheta.value
  const cosT = Math.cos(t)
  const sinT = Math.sin(t)
  // 轴方向 & 垂直方向（屏幕空间）
  const ax = cosT
  const ay = -sinT // X 轴方向（屏幕）
  const px = sinT
  const py = cosT // 垂直
  return `${ex},${ey} ${ex - 10 * ax + 5 * px},${ey - 10 * ay + 5 * py} ${ex - 10 * ax - 5 * px},${ey - 10 * ay - 5 * py}`
})

// Y 轴箭头三角形顶点
const gizmoYArrowPoints = computed(() => {
  const { x: ex, y: ey } = gizmoYEnd.value
  const t = gizmoTheta.value
  // Y 轴屏幕方向: (-sinT, -cosT)
  const ax = -Math.sin(t)
  const ay = -Math.cos(t)
  const px = Math.cos(t)
  const py = -Math.sin(t)
  return `${ex},${ey} ${ex - 10 * ax + 5 * px},${ey - 10 * ay + 5 * py} ${ex - 10 * ax - 5 * px},${ey - 10 * ay - 5 * py}`
})

// 辅助函数：安全地 dispose material（处理单个或数组情况）
const disposeMaterial = (material: THREE.Material | THREE.Material[]) => {
  if (Array.isArray(material)) {
    material.forEach((m) => m.dispose())
  } else {
    material.dispose()
  }
}

// 键盘事件监听器 - 用于跟踪 Ctrl/Cmd 键状态
const handleKeyDown = (e: KeyboardEvent) => {
  if (!isCalibrationMode.value) return // 只在辅助模式下生效

  // 支持 Ctrl（Windows/Linux）和 Command（macOS）
  if (e.key === 'Control' || e.key === 'Meta' || e.ctrlKey || e.metaKey) {
    isCtrlPressed.value = true
  }
}

const handleKeyUp = (e: KeyboardEvent) => {
  if (!isCalibrationMode.value) return // 只在辅助模式下生效

  // 支持 Ctrl（Windows/Linux）和 Command（macOS）
  if (e.key === 'Control' || e.key === 'Meta' || (!e.ctrlKey && !e.metaKey)) {
    isCtrlPressed.value = false
  }
}

// 添加键盘事件监听器
const addKeyboardListeners = () => {
  if (keyboardListenersBound) return
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  keyboardListenersBound = true
}

// 移除键盘事件监听器
const removeKeyboardListeners = () => {
  if (!keyboardListenersBound) return
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  keyboardListenersBound = false
}

// 加载项目列表
const loadProjects = async () => {
  try {
    const res = await getProjectFiles({ page: 1, pageSize: 100 })
    if (res.code === 200) {
      projectList.value = res.data.list
    }
  } catch (error) {
    console.error('加载项目列表失败:', error)
    ElMessage.error('加载项目列表失败')
  }
}

// 根据 scan 当前绑定的 CAD 自动回填
const syncCadBindingFromCalibration = async (): Promise<boolean> => {
  if (!formData.value.projectId || !formData.value.scanFileId) return false
  try {
    const res = await getScanCalibration(
      formData.value.projectId,
      formData.value.scanFileId,
    )
    if (res.code === 200 && res.data?.cadFileId) {
      formData.value.cadFileId = res.data.cadFileId
      return true
    }
  } catch (error) {
    console.warn('获取扫描绑定 CAD 失败:', error)
  }
  return false
}

// 项目变更
const onProjectChange = (projectId: number) => {
  const project = projectList.value.find((p) => p.projectId === projectId)
  if (!project) return

  // 提取扫描文件和CAD文件
  scanFiles.value = project.types.find((t) => t.type === 'scan')?.files || []
  cadFiles.value = project.types.find((t) => t.type === 'cad')?.files || []

  // 如果新项目没有扫描文件或CAD文件，清空之前的选择
  if (scanFiles.value.length === 0) {
    formData.value.scanFileId = null
  } else {
    // 自动选择第一个文件
    formData.value.scanFileId = scanFiles.value[0].id
  }

  if (cadFiles.value.length === 0) {
    formData.value.cadFileId = null
  } else {
    void (async () => {
      const synced = await syncCadBindingFromCalibration()
      if (!synced) {
        formData.value.cadFileId = cadFiles.value[0].id
      }
    })()
  }
}

// 扫描文件变更
const onScanChange = async () => {
  if (!formData.value.scanFileId || cadFiles.value.length === 0) {
    formData.value.cadFileId = null
    return
  }

  const synced = await syncCadBindingFromCalibration()
  if (!synced) {
    formData.value.cadFileId = cadFiles.value[0]?.id ?? null
  }
}

let lastStep2Key = ''
const getStep2Key = () => {
  if (!isStep2Flow.value) return ''
  return [
    getQueryString('projectId'),
    getQueryString('scanId'),
    getQueryString('cadId'),
    getQueryString('returnTo'),
  ].join('|')
}

const applyStep2QueryPresetImpl = async () => {
  if (!isStep2Flow.value) return

  const step2Key = getStep2Key()
  if (
    step2Key &&
    step2Key === lastStep2Key &&
    cadViewer.value &&
    previewData.value
  )
    return
  lastStep2Key = step2Key

  const projectIdFromQuery = Number(getQueryString('projectId'))
  if (!Number.isFinite(projectIdFromQuery) || projectIdFromQuery <= 0) {
    formData.value.projectId = null
    formData.value.scanFileId = null
    formData.value.cadFileId = null
    return
  }

  formData.value.projectId = projectIdFromQuery

  const scanIdFromQuery = Number(getQueryString('scanId'))
  formData.value.scanFileId =
    Number.isFinite(scanIdFromQuery) && scanIdFromQuery > 0
      ? scanIdFromQuery
      : null

  const cadIdFromQuery = Number(getQueryString('cadId'))
  formData.value.cadFileId =
    Number.isFinite(cadIdFromQuery) && cadIdFromQuery > 0
      ? cadIdFromQuery
      : null

  if (
    formData.value.projectId &&
    formData.value.scanFileId &&
    !formData.value.cadFileId
  ) {
    await syncCadBindingFromCalibration()
  }

  if (
    formData.value.projectId &&
    formData.value.scanFileId &&
    formData.value.cadFileId
  ) {
    await nextTick()
    await waitForNextFrame()
    await loadData()
    // 首次从“重新校准”进入时，DxfViewer 偶尔还未稳定挂载；补一次兜底加载
    if (!cadViewer.value || !previewData.value) {
      await new Promise((resolve) => setTimeout(resolve, 120))
      await nextTick()
      await loadData()
    }
  }
}

const applyStep2QueryPreset = async () => {
  if (step2PresetPromise) {
    return step2PresetPromise
  }

  step2PresetPromise = applyStep2QueryPresetImpl().finally(() => {
    step2PresetPromise = null
  })

  return step2PresetPromise
}

const resetLoadedStateForNewLoad = () => {
  // 清理定时器（避免旧的异步刷新影响新加载）
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }

  // 清理全景
  cleanupPanoramaViewer()
  showPanoramaDialog.value = false
  currentImageUrl.value = ''
  currentImageInfo.value = null

  // 清空点对/对齐结果
  pendingLas.value = null
  pendingCad.value = null
  pairs.value = []
  alignment.value = null
  latestCadBounds = null
  lastAutoSavedSignature = ''
  hasUnsavedAlignmentChanges.value = false
  completingCalibration.value = false

  // 清空预览数据与画布
  previewData.value = null
  trajectoryData.value = null
  if (previewImg.value) {
    previewImg.value.src = ''
  }
  if (overlayCanvas.value) {
    const ctx = overlayCanvas.value.getContext('2d')
    ctx?.clearRect(0, 0, overlayCanvas.value.width, overlayCanvas.value.height)
    overlayCanvas.value.width = 0
    overlayCanvas.value.height = 0
  }

  // 清理 CAD 叠加物（轨迹线、点云叠加、辅助点云平面）
  if (cadViewer.value) {
    const scene = cadViewer.value.GetScene?.()
    if (scene) {
      disposeCadOverlayLine()

      if (cadOverlayPointCloud.value) {
        try {
          scene.remove(cadOverlayPointCloud.value)
          cadOverlayPointCloud.value.geometry.dispose()
          ;(cadOverlayPointCloud.value.material as THREE.Material).dispose()
        } catch (error) {
          console.warn('清理点云叠加失败:', error)
        }
        cadOverlayPointCloud.value = null
      }

      if (cadOverlayBackgroundPlane.value) {
        try {
          scene.remove(cadOverlayBackgroundPlane.value)
          cadOverlayBackgroundPlane.value.geometry.dispose()
          ;(
            cadOverlayBackgroundPlane.value.material as THREE.Material
          ).dispose()
        } catch (error) {
          console.warn('清理背景层失败:', error)
        }
        cadOverlayBackgroundPlane.value = null
      }
    }

    // 退出辅助选点模式（静默，不弹提示）
    try {
      stopGizmoLoop()
    } catch {}
    removeKeyboardListeners()

    if (cadOverlayPointCloudPlane.value) {
      try {
        scene?.remove?.(cadOverlayPointCloudPlane.value)
        cadOverlayPointCloudPlane.value.geometry.dispose()
        ;(cadOverlayPointCloudPlane.value.material as THREE.Material).dispose()
      } catch (error) {
        console.warn('清理点云平面失败:', error)
      }
      cadOverlayPointCloudPlane.value = null
    }
  }

  isCalibrationMode.value = false
  showPointCloudOverlay.value = false
  overlayPosition.value = { x: 0, y: 0 }
  overlayScale.value = 1
  overlayRotation.value = 0
  isRotating.value = false
  rotationHandlePosition.value = { x: 0, y: 0 }
}

// 加载数据
const loadData = async () => {
  if (
    !formData.value.projectId ||
    !formData.value.scanFileId ||
    !formData.value.cadFileId
  ) {
    ElMessage.warning('请选择项目、扫描文件和CAD文件')
    return
  }

  const loadId = nextLoadId()
  try {
    resetLoadedStateForNewLoad()
    statusText.value = '加载中...'
    await Promise.all([
      loadPreview(loadId),
      loadDxf(loadId),
      loadLatestAlignmentData(loadId),
    ])
    if (isLoadStale(loadId)) return
    if (alignment.value) {
      lastAutoSavedSignature = buildAlignmentSignature(
        alignment.value,
        previewData.value,
      )
      hasUnsavedAlignmentChanges.value = false
    }
    statusText.value = '加载完成'
    // 数据加载完成后自动进入轨迹对齐模式
    await autoEnterAlignmentMode()
    if (latestCadBounds) {
      await scheduleCadFit(latestCadBounds, 8)
    }
  } catch (error: any) {
    if (isLoadStale(loadId)) return
    console.error('加载失败:', error)
    statusText.value = error?.message || '加载失败'
    ElMessage.error(error?.message || '加载失败')
  }
}

// 加载预览
const loadPreview = async (loadId?: number) => {
  if (isLoadStale(loadId)) return
  // 添加样式参数
  const params: any = {
    size: formData.value.size,
    heightMin: formData.value.heightMin,
    heightMax: formData.value.heightMax,
  }

  // 请求分层模式：后端返回透明背景内容层，前端自己绘制灰底
  params.contentColor = colorToHex(pointCloudContentColor.value)
  params.splitLayers = true

  const previewProjectId = formData.value.projectId!
  const previewScanId = formData.value.scanFileId!
  const cachedPreview = getCachedPreview(
    previewProjectId,
    previewScanId,
    params,
  )
  const res = (
    cachedPreview
      ? { code: 200, msg: '', data: cachedPreview }
      : await getScanPreview(previewProjectId, previewScanId, params)
  ) as any

  if (!cachedPreview && res?.code === 200 && res.data) {
    setCachedPreview(previewProjectId, previewScanId, params, res.data)
  }

  if (isLoadStale(loadId)) return

  if (res.code !== 200 || !res.data?.preview?.pngBase64) {
    console.error('加载预览失败:', res)
    throw new Error(res.msg || '加载预览失败')
  }

  previewData.value = res.data.preview
  trajectoryData.value = res.data.trajectory

  // 轨迹数据与点云预览由同一个接口返回：一到就先把 CAD 上的轨迹画出来，
  // 不再等点云图像渲染 / 后续步骤（DXF 若已就绪则立即出现轨迹）。
  renderCadOverlayTrajectory()

  if (isLoadStale(loadId)) return
  await renderPreview(loadId)
}

// 渲染预览
const renderPreview = async (loadId?: number) => {
  if (isLoadStale(loadId)) return
  if (!previewData.value || !previewImg.value || !overlayCanvas.value) return

  const img = previewImg.value
  img.src = `data:image/png;base64,${previewData.value.pngBase64}`

  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      if (isLoadStale(loadId)) {
        resolve()
        return
      }
      resolve()
    }
    img.onerror = () => reject(new Error('预览图加载失败'))
  })

  if (isLoadStale(loadId)) return
  const w = img.naturalWidth || previewData.value.width
  const h = img.naturalHeight || previewData.value.height

  const canvas = overlayCanvas.value
  canvas.width = w
  canvas.height = h
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`

  // 设置图片样式以确保清晰显示
  img.style.width = `${w}px`
  img.style.height = `${h}px`
  img.style.imageRendering = 'auto' // 使用自动渲染，避免像素化

  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, w, h)

  if (!trajectoryData.value?.points?.length) return

  const { minX, minY } = previewData.value.bounds
  const step = previewData.value.step

  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(122,162,255,0.95)'
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 2

  ctx.beginPath()
  trajectoryData.value.points.forEach((p, i) => {
    const px = (p.x - minX) / step
    const py = h - 1 - (p.y - minY) / step
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.stroke()

  // 起点和终点
  const first = trajectoryData.value.points[0]
  const last =
    trajectoryData.value.points[trajectoryData.value.points.length - 1]
  drawDot(
    ctx,
    (first.x - minX) / step,
    h - 1 - (first.y - minY) / step,
    'rgba(0,255,160,0.9)',
  )
  drawDot(
    ctx,
    (last.x - minX) / step,
    h - 1 - (last.y - minY) / step,
    'rgba(255,96,96,0.9)',
  )
}

// 绘制圆点
const drawDot = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
) => {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// LAS点击事件（全景功能已禁用，此处保留占位）
const onLasClick = (_ev: MouseEvent) => {
  // 全景弹窗已在此版本禁用
}

// 查找最近的轨迹点（像素坐标）
const findNearestTrajectoryPointInLasPixel = (
  px: number,
  py: number,
): TrajectoryPoint | null => {
  if (
    !previewData.value ||
    !trajectoryData.value?.points?.length ||
    !overlayCanvas.value
  )
    return null

  const h = overlayCanvas.value.height
  const { minX, minY } = previewData.value.bounds
  const step = previewData.value.step
  const thresholdPx = 8
  let best: TrajectoryPoint | null = null
  let bestD2 = thresholdPx * thresholdPx

  for (const p of trajectoryData.value.points) {
    const x = (p.x - minX) / step
    const y = h - 1 - (p.y - minY) / step
    const dx = x - px
    const dy = y - py
    const d2 = dx * dx + dy * dy
    if (d2 < bestD2) {
      bestD2 = d2
      best = p
    }
  }

  return best
}

// 显示轨迹图片
const showTrajectoryImage = async (point: TrajectoryPoint) => {
  if (destroyed) return
  if (!point?.imageName) return

  const key = String(point.imageName)
  currentImageInfo.value = {
    timestamp: point.timestamp,
    imageName: point.imageName,
    yaw: point.yaw,
    x: point.x,
    y: point.y,
  }

  try {
    let imageUrl: string

    if (imageCache.has(key)) {
      imageUrl = imageCache.get(key)!
    } else {
      statusText.value = '加载图片...'
      const res = await getTrajectoryImage(
        formData.value.projectId!,
        formData.value.scanFileId!,
        point.imageName,
      )

      if (destroyed) return

      if (res.code === 200 && res.data?.dataUrl) {
        imageCache.set(key, res.data.dataUrl)
        imageUrl = res.data.dataUrl
        statusText.value = '完成'
      } else {
        throw new Error('加载图片失败')
      }
    }

    // 设置当前图片 URL
    currentImageUrl.value = imageUrl

    // 打开对话框
    showPanoramaDialog.value = true

    // 等待 DOM 更新后再初始化全景查看器
    await nextTick()
    await loadPanoramaImage(imageUrl)
  } catch (error: any) {
    console.error('加载图片失败:', error)
    statusText.value = error?.message || '加载图片失败'
    ElMessage.error(error?.message || '加载图片失败')
  }
}

// 初始化全景查看器
const initPanoramaViewer = () => {
  if (destroyed || !panoramaContainer.value) {
    return
  }
  if (panoramaViewer.value) {
    return
  }
  const container = panoramaContainer.value
  const width = container.clientWidth || 800
  const height = 600

  // 创建场景
  const scene = new THREE.Scene()

  // 创建相机 - 放在球心
  const camera = new THREE.PerspectiveCamera(75, width / height, 1, 1100)
  camera.position.set(0, 0, 0)

  // 创建渲染器
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  container.appendChild(renderer.domElement)

  // 创建球体（全景容器）- 半径500
  const geometry = new THREE.SphereGeometry(500, 60, 40)
  // 翻转几何体，让纹理显示在内侧
  geometry.scale(-1, 1, 1)

  const material = new THREE.MeshBasicMaterial({
    side: THREE.FrontSide,
  })
  const sphere = new THREE.Mesh(geometry, material)
  scene.add(sphere)

  // 使用 markRaw 防止 Vue 响应式代理
  panoramaViewer.value = markRaw({
    scene,
    camera,
    renderer,
    sphere,
    texture: null,
  })

  // 添加鼠标事件
  setupPanoramaControls()

  // 设置初始相机角度
  updatePanoramaCamera()

  // 开始渲染循环
  renderPanorama()
}

// 设置全景控制
const setupPanoramaControls = () => {
  if (!panoramaContainer.value) return

  const container = panoramaContainer.value

  const onMouseDown = (event: MouseEvent) => {
    panoramaMouseDown.value = true
    panoramaMousePos.value = { x: event.clientX, y: event.clientY }
  }

  const onMouseMove = (event: MouseEvent) => {
    if (!panoramaMouseDown.value) return

    const deltaX = event.clientX - panoramaMousePos.value.x
    const deltaY = event.clientY - panoramaMousePos.value.y

    panoramaMousePos.value = { x: event.clientX, y: event.clientY }

    panoramaCameraRot.value.lon += deltaX * 0.1
    panoramaCameraRot.value.lat -= deltaY * 0.1

    // 限制纬度范围
    panoramaCameraRot.value.lat = Math.max(
      -85,
      Math.min(85, panoramaCameraRot.value.lat),
    )

    updatePanoramaCamera()
  }

  const onMouseUp = () => {
    panoramaMouseDown.value = false
  }

  const onMouseLeave = () => {
    panoramaMouseDown.value = false
  }

  container.addEventListener('mousedown', onMouseDown)
  container.addEventListener('mousemove', onMouseMove)
  container.addEventListener('mouseup', onMouseUp)
  container.addEventListener('mouseleave', onMouseLeave)
}

// 更新全景相机角度
const updatePanoramaCamera = () => {
  if (!panoramaViewer.value) return

  const phi = THREE.MathUtils.degToRad(90 - panoramaCameraRot.value.lat)
  const theta = THREE.MathUtils.degToRad(panoramaCameraRot.value.lon)

  const camera = panoramaViewer.value.camera
  const target = new THREE.Vector3(
    500 * Math.sin(phi) * Math.cos(theta),
    500 * Math.cos(phi),
    500 * Math.sin(phi) * Math.sin(theta),
  )
  camera.lookAt(target)
}

// 加载全景图片
const loadPanoramaImage = async (imageUrl: string) => {
  if (destroyed) return

  // 确保查看器已初始化
  if (!panoramaViewer.value) {
    let attempts = 0
    while (!panoramaContainer.value && attempts < 20) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      attempts++
    }

    if (panoramaContainer.value) {
      initPanoramaViewer()
      // 等待初始化完成
      await new Promise((resolve) => setTimeout(resolve, 100))
    } else {
      console.error('容器未找到，无法初始化查看器')
      return
    }
  }

  if (!panoramaViewer.value || destroyed) {
    console.error('查看器初始化失败')
    return
  }

  // 先加载图片，检查尺寸并可能需要缩放
  const img = new Image()
  img.crossOrigin = 'anonymous'

  img.onload = () => {
    if (destroyed || !panoramaViewer.value) {
      return
    }

    const maxSize = panoramaViewer.value.renderer.capabilities.maxTextureSize

    let finalImage = img

    // 如果图片太大，需要缩放
    if (img.width > maxSize || img.height > maxSize) {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!

      // 计算缩放比例，保持宽高比
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
      canvas.width = Math.floor(img.width * scale)
      canvas.height = Math.floor(img.height * scale)

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      finalImage = canvas as any
    }

    // 使用Three.js加载器加载纹理
    const texture = new THREE.Texture(finalImage)
    texture.needsUpdate = true

    // 配置纹理 - 不设置format让Three.js自动检测
    texture.minFilter = THREE.LinearFilter // 禁用mipmap
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = false // 明确禁用mipmap生成
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping

    // 释放旧纹理
    if (panoramaViewer.value.texture) {
      panoramaViewer.value.texture.dispose()
    }

    // 应用新纹理（使用 markRaw 防止被代理）
    const rawTexture = markRaw(texture)
    panoramaViewer.value.texture = rawTexture
    const material = panoramaViewer.value.sphere
      .material as THREE.MeshBasicMaterial
    material.map = rawTexture
    material.needsUpdate = true

    // 重置相机角度
    panoramaCameraRot.value = { lon: 0, lat: 0 }
    updatePanoramaCamera()
  }

  img.onerror = (error) => {
    console.error('加载全景图片失败:', error)
  }

  img.src = imageUrl
}

// 渲染全景
const renderPanorama = () => {
  if (destroyed || !panoramaViewer.value) return

  requestAnimationFrame(renderPanorama)

  try {
    const viewer = panoramaViewer.value
    viewer.renderer.render(viewer.scene, viewer.camera)
  } catch (error) {
    console.error('渲染全景时出错:', error)
  }
}

// 关闭全景对话框
const onPanoramaDialogClose = () => {
  cleanupPanoramaViewer()
  currentImageUrl.value = ''
  currentImageInfo.value = null
}

// 清理全景查看器
const cleanupPanoramaViewer = () => {
  if (!panoramaViewer.value) return

  try {
    // 停止渲染循环（通过 destroyed 标志）

    // 释放纹理
    if (panoramaViewer.value.texture) {
      panoramaViewer.value.texture.dispose()
    }

    // 释放几何体和材质
    panoramaViewer.value.sphere.geometry.dispose()
    ;(panoramaViewer.value.sphere.material as THREE.Material).dispose()

    // 释放渲染器
    panoramaViewer.value.renderer.dispose()

    // 移除 DOM 元素
    if (panoramaContainer.value) {
      panoramaContainer.value.innerHTML = ''
    }

    panoramaViewer.value = null
  } catch (error) {
    console.error('清理全景查看器失败:', error)
  }
}

// 等待 CAD 边界稳定，避免刚加载完成时取不到 bounds 导致空白视图
const isValidCadBounds = (bounds: CadBounds | null | undefined) => {
  if (!bounds) return false
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  return (
    Number.isFinite(bounds.minX) &&
    Number.isFinite(bounds.maxX) &&
    Number.isFinite(bounds.minY) &&
    Number.isFinite(bounds.maxY) &&
    width >= 0 &&
    height >= 0 &&
    width + height > 0
  )
}

const getCadSceneBounds = (): CadBounds | null => {
  const bounds = cadViewer.value?.GetBounds?.() as CadBounds | null
  if (!isValidCadBounds(bounds)) return null

  const origin = cadViewer.value?.GetOrigin?.()
  const originX = Number.isFinite(origin?.x) ? origin.x : 0
  const originY = Number.isFinite(origin?.y) ? origin.y : 0

  return {
    minX: bounds.minX - originX,
    maxX: bounds.maxX - originX,
    minY: bounds.minY - originY,
    maxY: bounds.maxY - originY,
  }
}

const waitForCadBounds = async (maxFrames = 30) => {
  for (let i = 0; i < maxFrames; i += 1) {
    const bounds = getCadSceneBounds()
    if (bounds) return bounds
    await waitForNextFrame()
  }
  return null
}

const fitCadView = (bounds: CadBounds) => {
  if (!cadViewer.value) return

  try {
    if (cadViewer.value.SetView) {
      const width = bounds.maxX - bounds.minX
      const height = bounds.maxY - bounds.minY
      const centerX = (bounds.minX + bounds.maxX) / 2
      const centerY = (bounds.minY + bounds.maxY) / 2

      const root = cadRoot.value
      const aspect =
        root && root.clientWidth > 0 && root.clientHeight > 0
          ? root.clientWidth / root.clientHeight
          : 1
      const viewWidth = Math.max(width, height * aspect)

      if (Number.isFinite(viewWidth) && viewWidth > 0) {
        cadViewer.value.SetView(
          new THREE.Vector3(centerX, centerY, 0),
          viewWidth * (1 + CAD_INITIAL_VIEW_PADDING),
        )
      }
    } else if (cadViewer.value.FitView) {
      cadViewer.value.FitView(
        bounds.minX,
        bounds.maxX,
        bounds.minY,
        bounds.maxY,
        CAD_INITIAL_VIEW_PADDING,
      )
    }

    cadViewer.value.Render?.()
  } catch (error) {
    console.warn('CAD 视图拟合失败:', error)
  }
}

const scheduleCadFit = async (bounds: CadBounds, frames = 6) => {
  for (let i = 0; i < frames; i += 1) {
    await waitForNextFrame()
    if (destroyed || !cadViewer.value) return
    fitCadView(bounds)
  }
}

const disposeCadViewer = () => {
  if (cleanupCadCanvasListeners) {
    cleanupCadCanvasListeners()
    cleanupCadCanvasListeners = null
  }

  if (!cadViewer.value) return

  try {
    cadViewer.value.Unsubscribe?.('pointerdown')
    cadViewer.value.Unsubscribe?.('pointermove')
    cadViewer.value.Unsubscribe?.('pointerup')
  } catch (error) {
    console.warn('取消 CAD 查看器事件订阅失败:', error)
  }

  try {
    cadViewer.value.Destroy?.()
  } catch (error) {
    console.error('清理DXF查看器失败:', error)
  }

  cadViewer.value = null
}

const waitForCadRootReady = async (maxFrames = 20) => {
  for (let i = 0; i < maxFrames; i += 1) {
    const root = cadRoot.value
    if (
      root &&
      root.isConnected &&
      root.clientWidth > 0 &&
      root.clientHeight > 0
    ) {
      return root
    }
    await nextTick()
    await waitForNextFrame()
  }

  return cadRoot.value ?? null
}

// 加载DXF
const loadDxf = async (loadId?: number) => {
  if (isLoadStale(loadId)) return

  statusText.value = '加载DXF...'

  try {
    const dxfProjectId = formData.value.projectId!
    const dxfFileId = formData.value.cadFileId!
    const cachedDxf = getCachedDxf(dxfProjectId, dxfFileId)
    const res = (
      cachedDxf
        ? { code: 200, msg: '', data: cachedDxf }
        : await getDxfFile(dxfProjectId, dxfFileId)
    ) as any

    if (!cachedDxf && res?.code === 200 && res.data) {
      setCachedDxf(dxfProjectId, dxfFileId, res.data)
    }

    if (isLoadStale(loadId)) return

    if (res.code !== 200 || !res.data?.content) {
      throw new Error(res.msg || '加载DXF失败')
    }

    if (isLoadStale(loadId)) return
    const blobUrl = URL.createObjectURL(
      new Blob([res.data.content], { type: 'application/dxf' }),
    )

    try {
      await ensureCadViewer()

      if (isLoadStale(loadId) || !cadViewer.value) {
        console.warn('查看器未初始化或已销毁')
        return
      }

      // 清空之前的内容
      try {
        cadViewer.value.Clear()
      } catch (e) {
        console.warn('清空查看器失败（可能是首次加载）:', e)
      }

      // 加载DXF - 包装在try-catch中以捕获内部错误
      try {
        await cadViewer.value.Load({
          url: blobUrl,
          fonts: [],
          workerFactory: null, // 禁用worker以避免某些edge cases
          progressCbk: (
            phase: string,
            processedSize: number,
            totalSize: number,
          ) => {
            if (isLoadStale(loadId)) return
            const percent =
              totalSize > 0 ? Math.round((processedSize / totalSize) * 100) : 0
            statusText.value = `加载DXF... ${percent}%`
          },
        })
      } catch (loadError: any) {
        console.error('DXF Load方法出错:', loadError)
        console.error('错误详情:', {
          name: loadError.name,
          message: loadError.message,
          stack: loadError.stack,
        })
        throw new Error(`DXF文件解析失败: ${loadError.message || '未知错误'}`)
      }

      if (isLoadStale(loadId)) return

      const bounds = await waitForCadBounds()

      if (bounds) {
        latestCadBounds = bounds
        fitCadView(bounds)
        await scheduleCadFit(bounds, 6)
      } else {
        latestCadBounds = null
        console.warn('无法获取DXF边界，可能文件为空或解析失败')
      }

      cadOrigin.value = cadViewer.value.GetOrigin()

      // 强制渲染一次
      try {
        requestCadRender()
      } catch (renderError) {
        console.error('Render调用失败:', renderError)
      }

      if (isLoadStale(loadId)) return
      renderCadOverlayTrajectory()
      statusText.value = 'DXF已加载'
      ElMessage.success('DXF加载成功')
    } finally {
      URL.revokeObjectURL(blobUrl)
    }
  } catch (error: any) {
    if (isLoadStale(loadId)) return
    console.error('DXF加载失败:', error)
    console.error('错误堆栈:', error?.stack)
    statusText.value = error?.message || 'DXF加载失败'
    ElMessage.error(`DXF加载失败: ${error?.message || '未知错误'}`)
  }
}

// 初始化CAD查看器
const ensureCadViewer = async () => {
  if (destroyed) return
  const root = await waitForCadRootReady()
  if (!root) {
    console.error('cadRoot DOM元素不存在')
    throw new Error('cadRoot DOM元素不存在')
  }

  const existingCanvas = cadViewer.value?.canvas as
    | HTMLCanvasElement
    | undefined
  const viewerUsable = Boolean(
    cadViewer.value &&
      existingCanvas &&
      existingCanvas.isConnected &&
      root.contains(existingCanvas),
  )

  if (viewerUsable) {
    return
  }

  if (cadViewer.value && !viewerUsable) {
    disposeCadViewer()
  }

  // 清空容器
  root.innerHTML = ''

  // 等待下一帧，确保DOM完全准备好
  await waitForNextFrame()

  try {
    // 获取容器尺寸，让CAD图纸自适应
    let containerWidth = root.clientWidth
    let containerHeight = root.clientHeight

    for (let i = 0; i < 10 && (!containerWidth || !containerHeight); i += 1) {
      await waitForNextFrame()
      containerWidth = root.clientWidth
      containerHeight = root.clientHeight
    }

    const viewer = new DxfViewer(root, {
      canvasWidth: containerWidth || 1024,
      canvasHeight: containerHeight || 768,
      autoResize: true,
      antialias: true,
      colorCorrection: true,
      clearColor: new THREE.Color('#ffffff'),
      clearAlpha: 1,
    })

    // 使用markRaw防止Vue响应式代理，这可能是导致RBTree错误的原因
    cadViewer.value = markRaw(viewer)

    // Shift+左键 接管拖拽（capture 阶段比 DxfViewer 先执行），无 Shift 放行给 DxfViewer
    const canvasElement = cadViewer.value.canvas
    if (canvasElement) {
      const captureMouseDown = (event: MouseEvent) => {
        if (!isCalibrationMode.value || !cadOverlayPointCloudPlane.value) return
        if (!event.shiftKey || event.button !== 0) return // 只拦截 Shift+左键
        event.stopPropagation()
        event.stopImmediatePropagation()
      }
      canvasElement.addEventListener('mousedown', captureMouseDown, true)

      // Shift+滚轮：缩放点云；普通滚轮给 DxfViewer 缩放图纸
      // deltaY > 0 = 向前/向上滚 = 放大（与 DxfViewer 保持同向）
      const onWheel = (e: WheelEvent) => {
        if (
          !e.shiftKey ||
          !isCalibrationMode.value ||
          !cadOverlayPointCloudPlane.value
        )
          return
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        // Mac 上 Shift+滚轮 deltaY 会被转为 deltaX，需要同时检测
        const rawDelta = e.deltaY !== 0 ? e.deltaY : e.deltaX
        const factor = rawDelta < 0 ? 1.12 : 0.88
        const newScale = Math.max(
          0.1,
          Math.min(5000, overlayScale.value * factor),
        )
        overlayScale.value = newScale
        updatePointCloudScale(newScale)
      }
      canvasElement.addEventListener('wheel', onWheel, {
        passive: false,
        capture: true,
      })
      cleanupCadCanvasListeners = () => {
        canvasElement.removeEventListener('mousedown', captureMouseDown, true)
        canvasElement.removeEventListener('wheel', onWheel, true)
      }
    } else {
      console.error('❌ Canvas 元素不存在！')
    }

    // 订阅鼠标按下事件
    cadViewer.value.Subscribe('pointerdown', (event: any) => {
      if (destroyed) return

      const pos = event?.detail?.position
      const origin = cadOrigin.value || cadViewer.value?.GetOrigin?.()
      if (!pos || !origin) return

      const cadX = pos.x + origin.x
      const cadY = pos.y + origin.y

      const domEvent = event?.detail?.domEvent
      const isShiftPressed = domEvent?.shiftKey || false

      // 对齐模式下，Shift+左键拖动点云平面；无 Shift 放行给 DxfViewer（平移视图）
      if (
        isCalibrationMode.value &&
        cadOverlayPointCloudPlane.value &&
        isShiftPressed
      ) {
        isDragging.value = true
        dragStartPos.value = { x: cadX, y: cadY }

        const handleGlobalPointerMove = (e: PointerEvent) => {
          if (!isDragging.value || !cadViewer.value) return

          const canvas = cadViewer.value.canvas
          const currentCamera = cadViewer.value.GetCamera()
          const currentOrigin = cadOrigin.value || cadViewer.value.GetOrigin()
          if (!canvas || !currentCamera || !currentOrigin) return

          const rect = canvas.getBoundingClientRect()
          const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
          const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1

          const vector = new THREE.Vector3(nx, ny, 0)
          vector.unproject(currentCamera)

          const currentCadX = vector.x + currentOrigin.x
          const currentCadY = vector.y + currentOrigin.y

          const deltaX = currentCadX - dragStartPos.value.x
          const deltaY = currentCadY - dragStartPos.value.y

          updateOverlayPosition(deltaX, deltaY)
          dragStartPos.value = { x: currentCadX, y: currentCadY }
        }

        const handleGlobalPointerUp = () => {
          isDragging.value = false
          document.removeEventListener('pointermove', handleGlobalPointerMove)
          document.removeEventListener('pointerup', handleGlobalPointerUp)
          // 拖拽结束后刷新本地未保存状态
          scheduleAutoSave()
        }

        document.addEventListener('pointermove', handleGlobalPointerMove, {
          capture: true,
        })
        document.addEventListener('pointerup', handleGlobalPointerUp, {
          capture: true,
        })

        if (domEvent) {
          domEvent.preventDefault()
          domEvent.stopPropagation()
          domEvent.stopImmediatePropagation()
        }
        return
      }
      // Shift + 左键：让 DxfViewer 默认行为（平移视角），不做额外处理
    })

    // 订阅鼠标移动事件（拖拽由全局 document pointermove 处理，此处仅保留订阅）
    cadViewer.value.Subscribe('pointermove', (_event: any) => {
      // 拖拽逻辑已由 handleGlobalPointerMove 负责
    })

    // 订阅鼠标松开事件
    cadViewer.value.Subscribe('pointerup', () => {
      if (isDragging.value) {
        isDragging.value = false
      }
    })
  } catch (error) {
    console.error('DXF查看器初始化失败:', error)
    cadViewer.value = null
    throw error
  }
}

// 查找最近的轨迹点（CAD坐标）
const findNearestTrajectoryPointInCad = (
  cadX: number,
  cadY: number,
): TrajectoryPoint | null => {
  if (
    !trajectoryData.value?.points?.length ||
    !alignment.value ||
    !cadViewer.value
  )
    return null

  const cam = cadViewer.value.GetCamera()
  const canvas = cadViewer.value.GetCanvas()
  const viewWidth = (cam.right - cam.left) / (cam.zoom || 1)
  const unitsPerPixel = viewWidth / (canvas?.width || 1024)
  const threshold = unitsPerPixel * 10
  const thr2 = threshold * threshold

  let best: TrajectoryPoint | null = null
  let bestD2 = thr2

  for (const p of trajectoryData.value.points) {
    const tp = applyAlignment(alignment.value, p.x, p.y)
    const dx = tp.x - cadX
    const dy = tp.y - cadY
    const d2 = dx * dx + dy * dy
    if (d2 < bestD2) {
      bestD2 = d2
      best = p
    }
  }

  return best
}

// 统一清理轨迹叠加线：可能挂在 scene 上，也可能挂在点云 plane 下
const disposeCadOverlayLine = () => {
  if (!cadOverlayLine.value) return
  try {
    cadOverlayLine.value.parent?.remove(cadOverlayLine.value)
    cadOverlayLine.value.geometry.dispose()
    disposeMaterial(cadOverlayLine.value.material)
  } catch (error) {
    console.warn('清理轨迹叠加线失败:', error)
  }
  cadOverlayLine.value = null
}

// 渲染CAD叠加轨迹
const renderCadOverlayTrajectory = () => {
  if (destroyed || !cadViewer.value) return

  const scene = cadViewer.value.GetScene()
  const origin = cadOrigin.value || cadViewer.value.GetOrigin()

  disposeCadOverlayLine()

  if (!trajectoryData.value?.points?.length) {
    requestCadRender()
    return
  }

  // 校准模式：轨迹作为点云 plane 的子节点，和点云一起平移/旋转/缩放
  if (
    isCalibrationMode.value &&
    cadOverlayPointCloudPlane.value &&
    previewData.value
  ) {
    const { minX, minY, maxX, maxY } = previewData.value.bounds
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const pts = trajectoryData.value.points.map(
      (p) => new THREE.Vector3(p.x - centerX, p.y - centerY, 0.02),
    )
    const geometry = new THREE.BufferGeometry().setFromPoints(pts)
    const material = new THREE.LineBasicMaterial({
      color: 0x00ffa0,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
    const line = new THREE.Line(geometry, material)
    line.renderOrder = 10020
    cadOverlayPointCloudPlane.value.add(line)
    cadOverlayLine.value = markRaw(line)
    requestCadRender()
    return
  }

  if (!alignment.value) {
    requestCadRender()
    return
  }

  const pts = trajectoryData.value.points.map((p) => {
    const tp = applyAlignment(alignment.value!, p.x, p.y)
    return new THREE.Vector3(tp.x - origin.x, tp.y - origin.y, 0)
  })

  const geometry = new THREE.BufferGeometry().setFromPoints(pts)
  const material = new THREE.LineBasicMaterial({
    color: 0x00ffa0,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })
  const line = new THREE.Line(geometry, material)
  line.renderOrder = 10020

  scene.add(line)
  // 必须用 markRaw，否则 Vue 代理对象无法被 scene.remove() 识别
  cadOverlayLine.value = markRaw(line)
  requestCadRender()
}

// 渲染对齐后的点云叠加到CAD
const renderCadOverlayPointCloud = async () => {
  if (destroyed || !cadViewer.value || !previewData.value || !alignment.value) {
    return
  }

  const scene = cadViewer.value.GetScene()
  const origin = cadOrigin.value || cadViewer.value.GetOrigin()

  // 移除旧的点云叠加
  if (cadOverlayPointCloud.value) {
    scene.remove(cadOverlayPointCloud.value)
    cadOverlayPointCloud.value.geometry.dispose()
    ;(cadOverlayPointCloud.value.material as THREE.Material).dispose()
    cadOverlayPointCloud.value = null
  }

  if (!showPointCloudOverlay.value) {
    requestCadRender()
    return
  }

  try {
    // 加载点云图片：优先使用透明背景内容层（分层模式），否则回退到合并层
    const imgSrc = previewData.value.contentPngBase64
      ? `data:image/png;base64,${previewData.value.contentPngBase64}`
      : `data:image/png;base64,${previewData.value.pngBase64}`
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imgSrc

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = (error) => reject(new Error('加载点云图片失败'))
    })

    if (destroyed) return

    // 创建纹理
    const texture = new THREE.Texture(img)
    texture.needsUpdate = true
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter

    // 获取点云的原始边界
    const { minX, minY, maxX, maxY } = previewData.value.bounds
    const width = maxX - minX
    const height = maxY - minY

    // 计算点云的四个角点在原始坐标系中的位置
    const corners = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ]

    // 应用对齐变换到所有角点
    const transformedCorners = corners.map((corner) =>
      applyAlignment(alignment.value!, corner.x, corner.y),
    )

    // 计算变换后的中心点
    const centerX =
      transformedCorners.reduce((sum, p) => sum + p.x, 0) /
      transformedCorners.length
    const centerY =
      transformedCorners.reduce((sum, p) => sum + p.y, 0) /
      transformedCorners.length

    // 创建平面几何体
    const geometry = new THREE.PlaneGeometry(width, height)
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.renderOrder = 100 // 确保在轨迹上方渲染

    // 设置位置（减去CAD原点）
    mesh.position.set(centerX - origin.x, centerY - origin.y, 0.5)

    // 应用旋转（对齐矩阵中的旋转）
    const theta = ((alignment.value.thetaDegrees ?? 0) * Math.PI) / 180
    mesh.rotation.z = theta

    // 应用缩放（对齐矩阵中的缩放）
    const scale = alignment.value.scale ?? 1
    mesh.scale.set(scale, scale, 1)

    scene.add(mesh)
    cadOverlayPointCloud.value = markRaw(mesh)
    requestCadRender()
  } catch (error) {
    console.error('渲染点云叠加失败:', error)
    ElMessage.error('渲染点云叠加失败')
  }
}

// 切换点云叠加显示
const togglePointCloudOverlay = async () => {
  showPointCloudOverlay.value = !showPointCloudOverlay.value
  await renderCadOverlayPointCloud()
  ElMessage.success(
    showPointCloudOverlay.value ? '已显示点云叠加' : '已隐藏点云叠加',
  )
}

// 更新点云平面的缩放
const updatePointCloudScale = (scale: number) => {
  if (!cadOverlayPointCloudPlane.value) return

  cadOverlayPointCloudPlane.value.scale.set(scale, scale, 1)

  requestCadRender()
  updateGizmoPosition()
  scheduleAutoSave()
}

// 更新点云平面的旋转（角度制）
const updatePointCloudRotation = (angleDegrees: number) => {
  if (!cadOverlayPointCloudPlane.value) return

  // 转换为弧度（绕 Z 轴旋转）
  const angleRadians = (angleDegrees * Math.PI) / 180
  cadOverlayPointCloudPlane.value.rotation.z = angleRadians
  requestCadRender()
  updateGizmoPosition()
  scheduleAutoSave()
}

// 更新旋转手柄位置（跟随点云平面上侧，已由 updateGizmoPosition 替代）
const updateRotationHandlePosition = () => {
  if (!cadViewer.value || !cadOverlayPointCloudPlane.value) return

  const camera = cadViewer.value.GetCamera()
  const canvas = cadViewer.value.canvas
  if (!camera || !canvas) return

  const plane = cadOverlayPointCloudPlane.value
  const rect = canvas.getBoundingClientRect()

  // 获取平面的几何参数
  const geometry = plane.geometry as THREE.PlaneGeometry
  const width = geometry.parameters.width
  const height = geometry.parameters.height

  // 计算平面上侧中心点的世界坐标
  const topCenterLocal = new THREE.Vector3(0, height / 2, 0)
  const topCenterWorld = topCenterLocal.applyMatrix4(plane.matrixWorld)

  // 投影到屏幕坐标
  const projected = topCenterWorld.project(camera)
  const screenX = (projected.x * 0.5 + 0.5) * rect.width + rect.left
  const screenY = (-projected.y * 0.5 + 0.5) * rect.height + rect.top

  // 向上偏移一定距离
  rotationHandlePosition.value = {
    x: screenX,
    y: screenY + 20,
  }
}

// 开始旋转拖拽
const startRotationDrag = (event: MouseEvent | TouchEvent) => {
  event.preventDefault()
  event.stopPropagation()

  if (!cadViewer.value || !cadOverlayPointCloudPlane.value) return

  isRotating.value = true
  rotationStartAngle.value = overlayRotation.value

  // 获取平面中心的屏幕坐标
  const camera = cadViewer.value.GetCamera()
  const canvas = cadViewer.value.canvas
  const plane = cadOverlayPointCloudPlane.value
  const rect = canvas.getBoundingClientRect()

  const centerWorld = plane.position.clone()
  const centerProjected = centerWorld.project(camera)
  const centerScreenX = (centerProjected.x * 0.5 + 0.5) * rect.width + rect.left
  const centerScreenY =
    (-centerProjected.y * 0.5 + 0.5) * rect.height + rect.top

  // 获取初始鼠标位置
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY

  // 计算初始角度
  const startAngle =
    Math.atan2(clientY - centerScreenY, clientX - centerScreenX) *
    (180 / Math.PI)

  // 鼠标/触摸移动处理
  const handleMove = (e: MouseEvent | TouchEvent) => {
    const currentX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY

    // 计算当前角度
    const currentAngle =
      Math.atan2(currentY - centerScreenY, currentX - centerScreenX) *
      (180 / Math.PI)

    // 角度增量
    const angleDelta = currentAngle - startAngle

    // 应用旋转
    let newRotation = rotationStartAngle.value + angleDelta

    // 规范化到 -180 ~ 180
    newRotation = ((newRotation + 180) % 360) - 180
    if (newRotation < -180) newRotation += 360

    overlayRotation.value = newRotation
    updatePointCloudRotation(newRotation)
  }

  // 结束拖拽
  const handleEnd = () => {
    isRotating.value = false
    document.removeEventListener('mousemove', handleMove)
    document.removeEventListener('mouseup', handleEnd)
    document.removeEventListener('touchmove', handleMove)
    document.removeEventListener('touchend', handleEnd)
    // 旋转结束后刷新本地未保存状态
    scheduleAutoSave()
  }

  document.addEventListener('mousemove', handleMove)
  document.addEventListener('mouseup', handleEnd)
  document.addEventListener('touchmove', handleMove)
  document.addEventListener('touchend', handleEnd)
}

// -------- Gizmo 操作器 --------

// 计算点云平面中心的屏幕坐标，用于定位 Gizmo
const updateGizmoPosition = () => {
  if (!cadViewer.value || !cadOverlayPointCloudPlane.value) {
    gizmoCenterScreen.value = null
    return
  }
  const camera = cadViewer.value.GetCamera()
  const canvas = cadViewer.value.canvas
  if (!camera || !canvas) return
  const rect = canvas.getBoundingClientRect()
  // 画布尚未渲染、未连接到 DOM 或尺寸过小时跳过，防止 Gizmo 在初始化期间定位到左上角
  if (!canvas.isConnected || rect.width < 100 || rect.height < 100) {
    gizmoCenterScreen.value = null
    return
  }
  const pos = cadOverlayPointCloudPlane.value.position.clone()
  const projected = pos.project(camera)
  // NDC 超出 [-1.2, 1.2] 说明平面不在视野内，隐藏 Gizmo
  if (Math.abs(projected.x) > 1.2 || Math.abs(projected.y) > 1.2) {
    gizmoCenterScreen.value = null
    return
  }
  const gx = (projected.x * 0.5 + 0.5) * rect.width + rect.left
  const gy = (-projected.y * 0.5 + 0.5) * rect.height + rect.top
  // 中心超出画布可见区域时隐藏 Gizmo
  const margin = GIZMO_C + 10
  if (
    gx < rect.left - margin ||
    gx > rect.right + margin ||
    gy < rect.top - margin ||
    gy > rect.bottom + margin
  ) {
    gizmoCenterScreen.value = null
    return
  }
  gizmoCenterScreen.value = { x: gx, y: gy }
}

// 同步独立背景层：铺满当前 CAD 视口，只控制灰底，不影响点云内容纹理
const syncPointCloudBackgroundPlane = () => {
  if (!cadViewer.value || !cadOverlayBackgroundPlane.value) return
  const camera = cadViewer.value.GetCamera?.()
  if (!camera) return

  let viewWidth = 1000
  let viewHeight = 1000

  if ((camera as any).isOrthographicCamera) {
    const ortho = camera as THREE.OrthographicCamera
    viewWidth = Math.abs(ortho.right - ortho.left) / (ortho.zoom || 1)
    viewHeight = Math.abs(ortho.top - ortho.bottom) / (ortho.zoom || 1)
  } else if ((camera as any).isPerspectiveCamera) {
    const perspective = camera as THREE.PerspectiveCamera
    const targetZ = cadOverlayPointCloudPlane.value
      ? cadOverlayPointCloudPlane.value.position.z - 0.05
      : camera.position.z - 1
    const distance = Math.max(0.1, Math.abs(camera.position.z - targetZ))
    const fov = THREE.MathUtils.degToRad(perspective.fov)
    viewHeight = 2 * Math.tan(fov / 2) * distance
    viewWidth = viewHeight * perspective.aspect
  }

  const plane = cadOverlayBackgroundPlane.value
  plane.position.set(
    camera.position.x,
    camera.position.y,
    cadOverlayPointCloudPlane.value
      ? cadOverlayPointCloudPlane.value.position.z - 0.05
      : camera.position.z - 1,
  )
  plane.scale.set(viewWidth * 1.2, viewHeight * 1.2, 1)

  const material = plane.material as THREE.MeshBasicMaterial
  material.color.set(pointCloudBgColor.value)
  material.opacity = pointCloudBgAlpha.value
  material.transparent = true
  material.needsUpdate = true
}

// 启动 Gizmo 位置持续追踪（rAF 循环，跟随 DxfViewer 缩放/平移）
const startGizmoLoop = () => {
  if (gizmoRafId !== null) cancelAnimationFrame(gizmoRafId)
  const loop = () => {
    if (!isCalibrationMode.value || destroyed) {
      gizmoRafId = null
      return
    }
    const nextSceneSyncSignature = getSceneSyncSignature({
      camera: cadViewer.value?.GetCamera?.(),
      plane: cadOverlayPointCloudPlane.value,
      backgroundColor: pointCloudBgColor.value,
      backgroundAlpha: pointCloudBgAlpha.value,
    })
    if (
      nextSceneSyncSignature &&
      nextSceneSyncSignature !== sceneSyncSignature
    ) {
      sceneSyncSignature = nextSceneSyncSignature
      syncPointCloudBackgroundPlane()
      updateGizmoPosition()
    }
    gizmoRafId = requestAnimationFrame(loop)
  }
  gizmoRafId = requestAnimationFrame(loop)
}

const stopGizmoLoop = () => {
  if (gizmoRafId !== null) {
    cancelAnimationFrame(gizmoRafId)
    gizmoRafId = null
  }
  sceneSyncSignature = ''
}

// 屏幕像素/CAD单位比例（用于 Gizmo 拖拽坐标转换）
const getScreenPixelsPerCadUnit = (): number => {
  if (!cadViewer.value) return 1
  const cam = cadViewer.value.GetCamera()
  const canvas = cadViewer.value.canvas
  if (!cam || !canvas) return 1
  const cadWidth = (cam.right - cam.left) / (cam.zoom || 1)
  const screenWidth = canvas.getBoundingClientRect().width
  return cadWidth > 0 ? screenWidth / cadWidth : 1
}

// Gizmo 旋转环拖拽
const startGizmoRotateDrag = (event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()
  if (!gizmoCenterScreen.value) return

  isGizmoDragging.value = 'rotate'
  const cx = gizmoCenterScreen.value.x
  const cy = gizmoCenterScreen.value.y
  const startAngle =
    (Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI
  const startRotation = overlayRotation.value

  const onMove = (e: MouseEvent) => {
    const currAngle =
      (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI
    // 取反：屏幕顺时针拖拽 → 点云顺时针旋转（Three.js rotation.z 正方向为逆时针）
    let newRot = startRotation - (currAngle - startAngle)
    // 吸附到步长
    const snap = rotationSnapStep.value
    newRot = Math.round(newRot / snap) * snap
    newRot = ((newRot + 180) % 360) - 180
    if (newRot < -180) newRot += 360
    overlayRotation.value = newRot
    updatePointCloudRotation(newRot)
    updateGizmoPosition()
  }
  const onUp = () => {
    isGizmoDragging.value = 'none'
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    scheduleAutoSave()
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// Gizmo X 轴平移
const startGizmoXDrag = (event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()
  isGizmoDragging.value = 'x'
  const theta = gizmoTheta.value
  // X 轴在屏幕上的方向: (cosθ, -sinθ)
  const axisDirX = Math.cos(theta)
  const axisDirY = -Math.sin(theta)
  let lastX = event.clientX
  let lastY = event.clientY

  const onMove = (e: MouseEvent) => {
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    const pxPerCad = getScreenPixelsPerCadUnit()
    const proj = dx * axisDirX + dy * axisDirY
    const cadDist = proj / pxPerCad
    // 世界空间 X 轴方向: (cosθ, sinθ)
    updateOverlayPosition(cadDist * Math.cos(theta), cadDist * Math.sin(theta))
  }
  const onUp = () => {
    isGizmoDragging.value = 'none'
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    scheduleAutoSave()
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// Gizmo Y 轴平移
const startGizmoYDrag = (event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()
  isGizmoDragging.value = 'y'
  const theta = gizmoTheta.value
  // Y 轴在屏幕上的方向: (-sinθ, -cosθ)
  const axisDirX = -Math.sin(theta)
  const axisDirY = -Math.cos(theta)
  let lastX = event.clientX
  let lastY = event.clientY

  const onMove = (e: MouseEvent) => {
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    const pxPerCad = getScreenPixelsPerCadUnit()
    const proj = dx * axisDirX + dy * axisDirY
    const cadDist = proj / pxPerCad
    // 世界空间 Y 轴方向: (-sinθ, cosθ)
    updateOverlayPosition(-cadDist * Math.sin(theta), cadDist * Math.cos(theta))
  }
  const onUp = () => {
    isGizmoDragging.value = 'none'
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    scheduleAutoSave()
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// Gizmo 中心自由平移
const startGizmoCenterDrag = (event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()
  isGizmoDragging.value = 'free'
  let lastX = event.clientX
  let lastY = event.clientY

  const onMove = (e: MouseEvent) => {
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    const pxPerCad = getScreenPixelsPerCadUnit()
    // 屏幕 Y 轴与世界 Y 轴方向相反
    updateOverlayPosition(dx / pxPerCad, -dy / pxPerCad)
  }
  const onUp = () => {
    isGizmoDragging.value = 'none'
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    scheduleAutoSave()
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// 处理线条颜色改变：需要重新请求后端生成新的内容层
const onContentColorChange = (_color: string) => {
  reloadPointCloudWithNewStyle()
}

// 处理背景颜色改变：只更新前端 CSS 灰底层，无需请求后端
const onBgColorChange = (_color: string) => {
  syncPointCloudBackgroundPlane()
  cadViewer.value?.Render?.()
}

// 重新加载点云内容层（仅在内容颜色变更时调用，背景变更不触发）
const reloadPointCloudWithNewStyle = async () => {
  if (
    !isCalibrationMode.value ||
    !formData.value.projectId ||
    !formData.value.scanFileId
  ) {
    return
  }

  try {
    // 保存当前的变换状态
    const currentTransform = cadOverlayPointCloudPlane.value
      ? {
          position: cadOverlayPointCloudPlane.value.position.clone(),
          rotation: cadOverlayPointCloudPlane.value.rotation.clone(),
          scale: cadOverlayPointCloudPlane.value.scale.clone(),
        }
      : null

    // 重新加载预览数据（后端会生成新颜色的内容层）
    await loadPreview()

    // 如果在辅助模式中，重新创建点云平面
    if (isCalibrationMode.value && cadViewer.value) {
      await createPointCloudPlane()

      // 恢复之前的变换状态
      if (currentTransform && cadOverlayPointCloudPlane.value) {
        cadOverlayPointCloudPlane.value.position.copy(currentTransform.position)
        cadOverlayPointCloudPlane.value.rotation.copy(currentTransform.rotation)
        cadOverlayPointCloudPlane.value.scale.copy(currentTransform.scale)
        requestCadRender()
      }
    }

    ElMessage.success('点云样式已更新')
  } catch (error: any) {
    console.error('重新加载点云失败:', error)
    ElMessage.error(error?.message || '更新点云样式失败')
  }
}

watch(
  () => [pointCloudBgAlpha.value, pointCloudBgColor.value],
  () => {
    syncPointCloudBackgroundPlane()
    cadViewer.value?.Render?.()
  },
)

// 移动点云
const movePointCloud = (deltaX: number, deltaY: number) => {
  if (!cadOverlayPointCloudPlane.value) {
    ElMessage.warning('点云平面未创建')
    return
  }

  if (deltaX === 0 && deltaY === 0) {
    // 位置归零
    const { minX, minY, maxX, maxY } = previewData.value!.bounds
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const origin = cadOrigin.value!

    cadOverlayPointCloudPlane.value.position.set(
      centerX - origin.x,
      centerY - origin.y,
      0.1,
    )
    overlayPosition.value = { x: 0, y: 0 }
  } else {
    // 移动点云
    cadOverlayPointCloudPlane.value.position.x += deltaX
    cadOverlayPointCloudPlane.value.position.y += deltaY

    overlayPosition.value.x += deltaX
    overlayPosition.value.y += deltaY
  }

  requestCadRender()
  scheduleAutoSave()
}

// 重置点云变换
const resetPointCloudTransform = () => {
  if (
    !cadOverlayPointCloudPlane.value ||
    !previewData.value ||
    !cadOrigin.value
  )
    return

  // 重置位置到初始状态
  const { minX, minY, maxX, maxY } = previewData.value.bounds
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const origin = cadOrigin.value

  // 使用与创建时相同的Z坐标计算逻辑
  const camera = cadViewer.value.GetCamera()
  const initialZ = camera ? camera.position.z - 0.5 : 0.5

  cadOverlayPointCloudPlane.value.position.set(
    centerX - origin.x,
    centerY - origin.y,
    initialZ,
  )
  cadOverlayPointCloudPlane.value.scale.set(1, 1, 1)
  cadOverlayPointCloudPlane.value.rotation.set(0, 0, 0)

  overlayPosition.value = { x: 0, y: 0 }
  overlayScale.value = 1
  overlayRotation.value = 0

  requestCadRender()
  ElMessage.success('已重置点云变换')
  scheduleAutoSave()
}

// 更新点云叠加层的位置
const updateOverlayPosition = (deltaX: number, deltaY: number) => {
  if (!cadOrigin.value) return

  // 直接使用 CAD 坐标的位移，不缩放
  // 因为点云已经被放大很多倍了，需要相应的移动距离
  const scaledDeltaX = deltaX
  const scaledDeltaY = deltaY

  overlayPosition.value.x += scaledDeltaX
  overlayPosition.value.y += scaledDeltaY

  // 更新 Three.js 点云平面（如果存在）
  if (cadOverlayPointCloudPlane.value) {
    cadOverlayPointCloudPlane.value.position.x += scaledDeltaX
    cadOverlayPointCloudPlane.value.position.y += scaledDeltaY
  }

  requestCadRender()

  // 更新 Gizmo 位置
  updateGizmoPosition()
}

const syncOverlayTransformStateFromPlane = () => {
  if (!cadOverlayPointCloudPlane.value) return

  const base = getPointCloudBaseTransform(previewData.value, cadOrigin.value)
  overlayScale.value = cadOverlayPointCloudPlane.value.scale.x
  overlayRotation.value = Number(
    ((cadOverlayPointCloudPlane.value.rotation.z * 180) / Math.PI).toFixed(4),
  )

  if (!base) {
    overlayPosition.value = { x: 0, y: 0 }
    return
  }

  overlayPosition.value = {
    x: cadOverlayPointCloudPlane.value.position.x - base.baseX,
    y: cadOverlayPointCloudPlane.value.position.y - base.baseY,
  }
}

const applyStoredAlignmentToPointCloudPlane = () => {
  if (
    !cadOverlayPointCloudPlane.value ||
    !alignment.value ||
    !previewData.value ||
    !cadOrigin.value
  ) {
    return false
  }

  const { centerX, centerY } =
    getPointCloudBaseTransform(previewData.value, cadOrigin.value) || {}
  if (centerX == null || centerY == null) return false

  const alignedCenter = applyAlignment(alignment.value, centerX, centerY)
  const theta = ((alignment.value.thetaDegrees ?? 0) * Math.PI) / 180
  const scale = alignment.value.scale ?? 1

  cadOverlayPointCloudPlane.value.position.set(
    alignedCenter.x - cadOrigin.value.x,
    alignedCenter.y - cadOrigin.value.y,
    cadOverlayPointCloudPlane.value.position.z,
  )
  cadOverlayPointCloudPlane.value.rotation.set(0, 0, theta)
  cadOverlayPointCloudPlane.value.scale.set(scale, scale, 1)

  syncOverlayTransformStateFromPlane()
  return true
}

// 按步长平移 X 轴（正值向右，负值向左）
const stepMoveX = (sign: 1 | -1) => {
  updateOverlayPosition(sign * translationSnapStep.value, 0)
  scheduleAutoSave()
}

// 按步长平移 Y 轴（正值向上，负值向下）
const stepMoveY = (sign: 1 | -1) => {
  updateOverlayPosition(0, sign * translationSnapStep.value)
  scheduleAutoSave()
}

// 创建 Three.js 点云平面几何体
const createPointCloudPlane = async () => {
  if (!cadViewer.value || !previewData.value || !cadOrigin.value) {
    console.error('数据未准备好，无法创建点云平面')
    return
  }

  // 清理旧的点云平面
  disposeCadOverlayLine()
  if (cadOverlayPointCloudPlane.value) {
    const scene = cadViewer.value.GetScene()
    scene.remove(cadOverlayPointCloudPlane.value)
    cadOverlayPointCloudPlane.value.geometry.dispose()
    ;(cadOverlayPointCloudPlane.value.material as THREE.Material).dispose()
    cadOverlayPointCloudPlane.value = null
  }
  if (cadOverlayBackgroundPlane.value) {
    const scene = cadViewer.value.GetScene()
    scene.remove(cadOverlayBackgroundPlane.value)
    cadOverlayBackgroundPlane.value.geometry.dispose()
    ;(cadOverlayBackgroundPlane.value.material as THREE.Material).dispose()
    cadOverlayBackgroundPlane.value = null
  }

  // 加载点云图片：优先使用透明背景的内容层，否则回退到合并层
  const pngSrc = previewData.value.contentPngBase64
    ? `data:image/png;base64,${previewData.value.contentPngBase64}`
    : `data:image/png;base64,${previewData.value.pngBase64}`
  const img = new Image()
  img.src = pngSrc

  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      resolve()
    }
    img.onerror = () => {
      console.error('点云图片加载失败')
      reject(new Error('点云图片加载失败'))
    }
  })

  // 创建纹理
  const texture = new THREE.Texture(img)
  texture.needsUpdate = true
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping

  // 获取点云的原始边界
  const { minX, minY, maxX, maxY } = previewData.value.bounds
  const width = maxX - minX
  const height = maxY - minY
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  // 创建与点云实际尺寸匹配的平面几何体
  const geometry = new THREE.PlaneGeometry(width, height)

  // 创建材质
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true, // 开启透明度，让后端的bgAlpha参数生效
    opacity: 1.0, // 基础透明度，实际由PNG图片的alpha通道决定
    side: THREE.DoubleSide,
    depthTest: false, // 禁用深度测试，确保在最上层
    depthWrite: false,
  })

  // 创建网格
  const mesh = new THREE.Mesh(geometry, material)
  mesh.renderOrder = 10000 // 非常大的渲染顺序，确保在最上层
  mesh.name = 'pointCloudPlane'

  // 设置初始位置（居中显示）
  const origin = cadOrigin.value

  // 尝试获取当前相机视野中心
  const camera = cadViewer.value.GetCamera()
  let initialX = centerX - origin.x
  let initialY = centerY - origin.y

  // 如果相机存在，将点云放在视野中心
  if (camera) {
    // 获取相机当前看向的位置（视野中心）
    const viewCenter = new THREE.Vector3()
    camera.getWorldDirection(viewCenter)

    // 使用相机位置作为参考
    initialX = camera.position.x
    initialY = camera.position.y
  }

  const initialZ = camera ? camera.position.z - 0.5 : 0.5 // 在相机下方 0.5 单位

  mesh.position.set(initialX, initialY, initialZ)

  // 自动调整初始缩放，确保点云可见
  // 如果点云太小相对于 CAD 坐标系，自动放大
  const cadScale = Math.max(Math.abs(initialX), Math.abs(initialY), 1000)
  const pointCloudSize = Math.max(width, height)
  // 默认初始缩放倍率 1000，用户可通过 Shift+滚轮或面板调整
  const autoScale = 1000

  mesh.scale.set(autoScale, autoScale, 1)
  overlayScale.value = autoScale

  // 添加到场景
  const scene = cadViewer.value.GetScene()
  const bgGeometry = new THREE.PlaneGeometry(1, 1)
  const bgMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(pointCloudBgColor.value),
    transparent: true,
    opacity: pointCloudBgAlpha.value,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  })
  const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial)
  bgMesh.renderOrder = 9990
  bgMesh.name = 'pointCloudBackgroundPlane'
  scene.add(bgMesh)
  scene.add(mesh)

  // 使用 markRaw 防止 Vue 响应式代理
  cadOverlayBackgroundPlane.value = markRaw(bgMesh)
  cadOverlayPointCloudPlane.value = markRaw(mesh)
  applyStoredAlignmentToPointCloudPlane()
  syncPointCloudBackgroundPlane()
  renderCadOverlayTrajectory()

  // 渲染一次
  requestCadRender()
}

// 使用 Raycaster 检测点击点云平面，返回点云原始坐标
const detectPointCloudPlaneClick = (
  screenX: number,
  screenY: number,
): { lasX: number; lasY: number; cadX: number; cadY: number } | null => {
  if (
    !cadViewer.value ||
    !cadOverlayPointCloudPlane.value ||
    !previewData.value ||
    !cadOrigin.value
  ) {
    return null
  }

  // 获取 Three.js 场景和相机
  const scene = cadViewer.value.GetScene()
  const camera = cadViewer.value.GetCamera()
  if (!scene || !camera) {
    return null
  }

  // 获取 canvas 容器
  const canvas = cadViewer.value.canvas
  if (!canvas) {
    return null
  }

  const rect = canvas.getBoundingClientRect()

  // 将屏幕坐标转换为 Three.js 的归一化设备坐标 (NDC)
  const mouse = new THREE.Vector2()
  mouse.x = ((screenX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((screenY - rect.top) / rect.height) * 2 + 1

  // 创建 Raycaster
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(mouse, camera)

  // 检测与点云平面的交叉
  const intersects = raycaster.intersectObject(cadOverlayPointCloudPlane.value)

  if (intersects.length === 0) {
    return null
  }

  // 获取第一个交叉点的世界坐标
  const intersection = intersects[0]
  const worldPos = intersection.point

  // 从世界坐标转换为点云原始坐标
  // 点云平面的中心在 (centerX - origin.x, centerY - origin.y)
  // 我们需要反推回原始点云坐标
  const origin = cadOrigin.value
  const { minX, minY, maxX, maxY } = previewData.value.bounds
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  // 点云平面在 CAD 场景中的位置
  const planePos = cadOverlayPointCloudPlane.value.position

  // 计算点击位置相对于平面中心的偏移
  const offsetX = worldPos.x - planePos.x
  const offsetY = worldPos.y - planePos.y

  // 转换为点云原始坐标
  // 平面中心对应 (centerX, centerY)，所以原始坐标 = 中心 + 偏移
  const lasX = centerX + offsetX
  const lasY = centerY + offsetY

  // 同时计算 CAD 坐标系的坐标
  // worldPos 是相对于 CAD origin 的位置，加上 origin 得到绝对 CAD 坐标
  const cadX = worldPos.x + origin.x
  const cadY = worldPos.y + origin.y

  // 返回两个坐标系的坐标
  return { lasX, lasY, cadX, cadY }
}

// 开始辅助选点模式
const startCalibrationMode = async () => {
  if (!previewData.value) {
    ElMessage.error('请先加载数据')
    return
  }

  if (!cadViewer.value) {
    ElMessage.error('CAD查看器未初始化')
    return
  }

  isCalibrationMode.value = true
  overlayPosition.value = { x: 0, y: 0 }
  // overlayScale.value = 1  // 注释掉，不重置缩放，让自动缩放生效
  overlayRotation.value = 0

  // 设置HTML叠加的初始位置和大小
  // 重要：严格按照后端返回的原始尺寸比例设置，不能改变比例！
  const cadContainer = cadRoot.value
  if (cadContainer && previewData.value) {
    const rect = cadContainer.getBoundingClientRect()

    // 获取后端返回的原始尺寸
    const originalWidth = previewData.value.width
    const originalHeight = previewData.value.height
    const aspectRatio = originalWidth / originalHeight

    // 计算适合容器的最大尺寸，保持原始比例
    const maxWidth = rect.width * 0.8
    const maxHeight = rect.height * 0.8

    // 根据比例计算实际尺寸
    let displayWidth: number
    let displayHeight: number

    if (aspectRatio > 1) {
      // 宽度受限
      displayWidth = Math.min(maxWidth, originalWidth)
      displayHeight = displayWidth / aspectRatio
    } else {
      // 高度受限
      displayHeight = Math.min(maxHeight, originalHeight)
      displayWidth = displayHeight * aspectRatio
    }
  }

  try {
    // 创建 Three.js 点云平面
    await createPointCloudPlane()

    startGizmoLoop() // rAF 持续更新 Gizmo，跟随 DxfViewer 缩放/平移
    addKeyboardListeners()
  } catch (error: any) {
    console.error('创建点云平面失败:', error)
    ElMessage.error('点云平面创建失败，请重试')
    exitCalibrationMode()
  }
}

// 退出辅助选点模式（收起面板时也会调用）
const exitCalibrationMode = () => {
  showCalibrationTour.value = false
  stopGizmoLoop()
  removeKeyboardListeners()
  gizmoCenterScreen.value = null

  disposeCadOverlayLine()
  // 清理 Three.js 点云平面
  if (cadOverlayPointCloudPlane.value && cadViewer.value) {
    const scene = cadViewer.value.GetScene()
    scene.remove(cadOverlayPointCloudPlane.value)
    cadOverlayPointCloudPlane.value.geometry.dispose()
    ;(cadOverlayPointCloudPlane.value.material as THREE.Material).dispose()
    cadOverlayPointCloudPlane.value = null
    if (cadOverlayBackgroundPlane.value) {
      scene.remove(cadOverlayBackgroundPlane.value)
      cadOverlayBackgroundPlane.value.geometry.dispose()
      ;(cadOverlayBackgroundPlane.value.material as THREE.Material).dispose()
      cadOverlayBackgroundPlane.value = null
    }
  }

  isCalibrationMode.value = false
  overlayPosition.value = { x: 0, y: 0 }

  // 重置旋转控制器状态
  isRotating.value = false
  rotationHandlePosition.value = { x: 0, y: 0 }

  // 重新渲染
  if (cadViewer.value) {
    // 退出校准模式后恢复为静态对齐轨迹
    renderCadOverlayTrajectory()
    requestCadRender()
  }

  ElMessage.info('已收起对齐工具')
}

// 尝试添加点对
const tryAddPair = () => {
  if (!pendingLas.value || !pendingCad.value) return

  pairs.value.push({
    lasX: pendingLas.value.lasX,
    lasY: pendingLas.value.lasY,
    cadX: pendingCad.value.cadX,
    cadY: pendingCad.value.cadY,
  })

  pendingLas.value = null
  pendingCad.value = null
}

// 自动进入轨迹对齐模式（数据加载完成后调用）
const autoEnterAlignmentMode = async () => {
  if (destroyed || !previewData.value || !cadViewer.value) return
  if (isCalibrationMode.value) return

  isCalibrationMode.value = true
  gizmoCenterScreen.value = null
  overlayPosition.value = { x: 0, y: 0 }
  overlayRotation.value = 0

  try {
    await createPointCloudPlane()
    cadViewer.value?.Render?.()
    await nextTick()
    await waitForNextFrame()
    updateGizmoPosition()
    startGizmoLoop()
  } catch (error: any) {
    console.error('自动进入对齐模式失败:', error)
    isCalibrationMode.value = false
  }
}

// 从当前点云平面变换构建配准点对（供保存和本地状态判断使用）
const buildAlignmentPairsFromPlane = (): AlignmentPair[] | null => {
  if (
    !cadOverlayPointCloudPlane.value ||
    !previewData.value ||
    !cadOrigin.value
  )
    return null

  const { minX, minY, maxX, maxY } = previewData.value.bounds
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const marginX = (maxX - minX) * 0.2
  const marginY = (maxY - minY) * 0.2
  const origin = cadOrigin.value

  // 取 4 个不共线的固定 LAS 点：中心 + 三个带边距角点
  const lasPoints = [
    { lasX: centerX, lasY: centerY },
    { lasX: minX + marginX, lasY: minY + marginY },
    { lasX: maxX - marginX, lasY: minY + marginY },
    { lasX: minX + marginX, lasY: maxY - marginY },
  ]

  return lasPoints.map(({ lasX, lasY }) => {
    const localX = lasX - centerX
    const localY = lasY - centerY
    const localPoint = new THREE.Vector3(localX, localY, 0)
    const worldPoint = cadOverlayPointCloudPlane.value!.localToWorld(
      localPoint.clone(),
    )
    const cadX = worldPoint.x + origin.x
    const cadY = worldPoint.y + origin.y
    return { lasX, lasY, cadX, cadY }
  })
}

// 防抖定时器
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let gizmoRafId: number | null = null // Gizmo 位置持续更新 rAF
let lastAutoSavedSignature = ''

// 防抖触发本地未保存状态刷新（拖拽/缩放/旋转结束后调用）
const scheduleAutoSave = () => {
  if (destroyed || !isCalibrationMode.value) return
  if (
    !formData.value.projectId ||
    !formData.value.scanFileId ||
    !formData.value.cadFileId
  )
    return
  if (!cadOverlayPointCloudPlane.value) return

  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => {
    if (destroyed) return
    autoSaveTimer = null
    syncPendingAlignmentState()
  }, 500)
}

// 由平面变换推导当前未保存状态，仅做本地标记，不发起保存请求
const syncPendingAlignmentState = () => {
  if (destroyed) return
  const pairsData = buildAlignmentPairsFromPlane()
  if (!pairsData || pairsData.length < 3) return

  const signature = buildAlignmentPairsSignature(pairsData)
  if (!signature) return
  hasUnsavedAlignmentChanges.value = signature !== lastAutoSavedSignature
  statusText.value = hasUnsavedAlignmentChanges.value
    ? '当前调整尚未保存，点击「完成校准」后生效'
    : '当前校准结果已保存'
}

// 自动生成随机点对（保留供内部调试，不再对外暴露）
const generateRandomPairs = async () => {
  if (
    !cadOverlayPointCloudPlane.value ||
    !previewData.value ||
    !cadOrigin.value
  ) {
    ElMessage.error('请先启动辅助选点模式并叠加点云')
    return
  }

  // 询问用户确认点云和图纸对齐
  try {
    await ElMessageBox.confirm(
      '确认点云和图纸对齐了么？点击确认后将生成随机点对并进行计算。',
      '确认对齐',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    // 用户取消
    return
  }

  // 如果有现有的点对，先清空
  if (pairs.value.length > 0) {
    pairs.value = []
    pendingLas.value = null
    pendingCad.value = null
    alignment.value = null
    renderCadOverlayTrajectory()
  }

  try {
    // 显示loading效果
    statusText.value = '正在生成随机点...'

    const { minX, minY, maxX, maxY } = previewData.value.bounds
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const origin = cadOrigin.value

    // 在点云范围内生成3个随机点
    const newPairs: AlignmentPair[] = []

    for (let i = 0; i < 3; i++) {
      // 在点云边界内随机生成点（避免边缘，留20%边距）
      const marginX = (maxX - minX) * 0.2
      const marginY = (maxY - minY) * 0.2

      const lasX = minX + marginX + Math.random() * (maxX - minX - 2 * marginX)
      const lasY = minY + marginY + Math.random() * (maxY - minY - 2 * marginY)

      // 将点云坐标转换为 CAD 坐标
      // 1. 计算点云坐标相对于中心的偏移（局部坐标）
      const localX = lasX - centerX
      const localY = lasY - centerY

      // 2. 使用 Three.js 的 localToWorld 方法，自动应用旋转、缩放、平移
      const localPoint = new THREE.Vector3(localX, localY, 0)
      const worldPoint = cadOverlayPointCloudPlane.value.localToWorld(
        localPoint.clone(),
      )

      // 3. 世界坐标转换为 CAD 坐标
      const cadX = worldPoint.x + origin.x
      const cadY = worldPoint.y + origin.y

      newPairs.push({
        lasX,
        lasY,
        cadX,
        cadY,
      })

      console.log(`随机点 ${i + 1}:`, {
        点云坐标: { lasX: lasX.toFixed(2), lasY: lasY.toFixed(2) },
        局部坐标: { localX: localX.toFixed(2), localY: localY.toFixed(2) },
        世界坐标: { x: worldPoint.x.toFixed(2), y: worldPoint.y.toFixed(2) },
        CAD坐标: { cadX: cadX.toFixed(2), cadY: cadY.toFixed(2) },
      })
    }

    pairs.value.push(...newPairs)

    // 更新显示
    renderCadOverlayTrajectory()

    ElMessage.success(
      `已生成 ${newPairs.length} 个随机点对，开始本地计算对齐...`,
    )

    // 自动计算本地对齐
    statusText.value = '本地计算对齐中...'
    await computeAlignmentHandler()
  } catch (error: any) {
    if (destroyed) return
    console.error('生成随机点对失败:', error)
    statusText.value = error?.message || '生成随机点对失败'
    ElMessage.error(error?.message || '生成随机点对失败')
  }
}

// 清空点对
const clearPairs = () => {
  pairs.value = []
  pendingLas.value = null
  pendingCad.value = null
  alignment.value = null
  renderCadOverlayTrajectory()
  statusText.value = '已清空点对'
}

// 删除单个点对
const removePair = (index: number) => {
  // 如果删除的索引超出 pairs 数组范围，说明删除的是待处理的点
  if (index >= pairs.value.length) {
    pendingLas.value = null
    pendingCad.value = null
  } else {
    pairs.value.splice(index, 1)
  }
  alignment.value = null
  renderCadOverlayTrajectory()
}

// 高度范围改变
const onHeightRangeChange = (val: [number, number]) => {
  formData.value.heightMin = val[0]
  formData.value.heightMax = val[1]
  scheduleRefresh()
}

// 中间区域拖拽功能
const setupRangeDrag = () => {
  if (!heightRangeSelectorRef.value) return

  const sliderBar = heightRangeSelectorRef.value.querySelector(
    '.el-slider__bar',
  ) as HTMLElement
  if (!sliderBar) return

  let isDragging = false
  let startY = 0
  let startRange: [number, number] = [0, 0]

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return

    isDragging = true
    startY = e.clientY
    startRange = [heightRange.value[0], heightRange.value[1]]

    e.preventDefault()
    e.stopPropagation()

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    sliderBar.style.cursor = 'grabbing'
  }

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return

    const sliderElement = heightRangeSelectorRef.value?.querySelector(
      '.el-slider',
    ) as HTMLElement
    if (!sliderElement) return

    // 竖向滑块：高度方向；向上拖（clientY 减小）→ 范围数值增大，故取反
    const sliderHeight = sliderElement.clientHeight
    const deltaY = startY - e.clientY
    const min = 0
    const max = 5
    const delta = (deltaY / sliderHeight) * (max - min)

    let newMin = startRange[0] + delta
    let newMax = startRange[1] + delta

    const rangeSize = startRange[1] - startRange[0]
    if (newMin < min) {
      newMin = min
      newMax = min + rangeSize
    }
    if (newMax > max) {
      newMax = max
      newMin = max - rangeSize
    }

    heightRange.value = [
      Math.round(newMin / 0.05) * 0.05,
      Math.round(newMax / 0.05) * 0.05,
    ]
  }

  const onMouseUp = () => {
    if (!isDragging) return

    isDragging = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)

    sliderBar.style.cursor = 'grab'
    onHeightRangeChange(heightRange.value)
  }

  sliderBar.addEventListener('mousedown', onMouseDown)
  sliderBar.style.cursor = 'grab'

  return () => {
    sliderBar.removeEventListener('mousedown', onMouseDown)
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }
}

// 计算仿射变换参数（基于点对）
const computeTransformFromPairs = (
  pairs: AlignmentPair[],
): {
  translation: { x: number; y: number }
  rotation: number // 弧度
  scale: number
} | null => {
  if (pairs.length < 2) {
    console.error('至少需要 2 对点来计算变换')
    return null
  }

  // 提取源点（点云坐标）和目标点（CAD 坐标）
  const srcPoints = pairs.map((p) => ({ x: p.lasX, y: p.lasY }))
  const dstPoints = pairs.map((p) => ({ x: p.cadX, y: p.cadY }))

  // 计算质心
  const srcCentroid = {
    x: srcPoints.reduce((sum, p) => sum + p.x, 0) / srcPoints.length,
    y: srcPoints.reduce((sum, p) => sum + p.y, 0) / srcPoints.length,
  }
  const dstCentroid = {
    x: dstPoints.reduce((sum, p) => sum + p.x, 0) / dstPoints.length,
    y: dstPoints.reduce((sum, p) => sum + p.y, 0) / dstPoints.length,
  }

  // 去中心化
  const srcCentered = srcPoints.map((p) => ({
    x: p.x - srcCentroid.x,
    y: p.y - srcCentroid.y,
  }))
  const dstCentered = dstPoints.map((p) => ({
    x: p.x - dstCentroid.x,
    y: p.y - dstCentroid.y,
  }))

  // 使用 Kabsch 算法计算旋转和缩放
  // 计算协方差矩阵 H = src^T * dst
  let h11 = 0,
    h12 = 0,
    h21 = 0,
    h22 = 0
  let srcNormSq = 0,
    dstNormSq = 0

  for (let i = 0; i < srcCentered.length; i++) {
    const src = srcCentered[i]
    const dst = dstCentered[i]

    h11 += src.x * dst.x
    h12 += src.x * dst.y
    h21 += src.y * dst.x
    h22 += src.y * dst.y

    srcNormSq += src.x * src.x + src.y * src.y
    dstNormSq += dst.x * dst.x + dst.y * dst.y
  }

  // 计算旋转角度（使用 SVD 的简化版本）
  // 对于 2D，旋转矩阵可以通过 H 矩阵的特征向量计算
  const angle = Math.atan2(h21 - h12, h11 + h22)

  // 计算缩放
  // scale = sqrt(dstNormSq / srcNormSq)
  const scale = srcNormSq > 0 ? Math.sqrt(dstNormSq / srcNormSq) : 1

  // 计算平移（考虑旋转和缩放后）
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  const translation = {
    x: dstCentroid.x - scale * (cos * srcCentroid.x - sin * srcCentroid.y),
    y: dstCentroid.y - scale * (sin * srcCentroid.x + cos * srcCentroid.y),
  }

  return { translation, rotation: angle, scale }
}

const applyLocalTransformToPointCloudPlane = (transform: {
  translation: { x: number; y: number }
  rotation: number
  scale: number
}) => {
  if (!cadOverlayPointCloudPlane.value || !cadOrigin.value) {
    throw new Error('点云平面未创建')
  }

  const mesh = cadOverlayPointCloudPlane.value
  const origin = cadOrigin.value

  mesh.scale.set(transform.scale, transform.scale, 1)
  mesh.rotation.z = transform.rotation
  mesh.position.set(
    transform.translation.x - origin.x,
    transform.translation.y - origin.y,
    mesh.position.z,
  )

  syncOverlayTransformStateFromPlane()
  requestCadRender()
  syncPendingAlignmentState()
}

// 自动校准 - 计算并应用变换到 Three.js 点云平面
const autoCalibrate = () => {
  if (!cadOverlayPointCloudPlane.value) {
    ElMessage.error('点云平面未创建')
    return
  }

  if (pairs.value.length < 2) {
    ElMessage.warning('至少需要 2 对点来进行自动校准')
    return
  }

  if (pairs.value.length < 3) {
    ElMessage.warning('建议至少 3 对点以获得更好的校准效果')
  }

  try {
    // 计算变换参数
    const transform = computeTransformFromPairs(pairs.value)
    if (!transform) {
      ElMessage.error('变换计算失败')
      return
    }

    applyLocalTransformToPointCloudPlane(transform)
    ElMessage.success('自动校准完成，点击「完成校准」后保存')
  } catch (error) {
    console.error('自动校准失败:', error)
    ElMessage.error('自动校准失败，请重试')
  }
}

// 计算对齐（仅本地应用，不立即保存）
const computeAlignmentHandler = async () => {
  if (destroyed) return
  if (pairs.value.length < 2) {
    ElMessage.warning('至少需要2对点')
    return
  }

  try {
    statusText.value = '计算本地对齐中...'
    const transform = computeTransformFromPairs(pairs.value)
    if (!transform) {
      throw new Error('计算对齐失败')
    }

    applyLocalTransformToPointCloudPlane(transform)

    pairs.value = []
    pendingLas.value = null
    pendingCad.value = null
    statusText.value = '本地对齐完成，点击「完成校准」后保存'
    ElMessage.success('本地对齐完成，点击「完成校准」后保存')
  } catch (error: any) {
    if (destroyed) return
    console.error('计算对齐失败:', error)
    statusText.value = error?.message || '计算对齐失败'
    ElMessage.error(error?.message || '计算对齐失败')
  }
}

// 加载最新对齐数据
const loadLatestAlignmentData = async (loadId?: number) => {
  if (isLoadStale(loadId)) return

  try {
    const res = await getLatestAlignment(
      formData.value.projectId!,
      formData.value.scanFileId!,
      formData.value.cadFileId!,
    )

    if (isLoadStale(loadId)) return

    if (res.code === 200 && res.data) {
      alignment.value = res.data
      renderCadOverlayTrajectory()
    }
  } catch (error) {
    // 404是正常的，表示没有历史对齐记录
    console.log('没有历史对齐记录')
  }
}

// 防抖刷新
let refreshTimer: NodeJS.Timeout | null = null
const scheduleRefresh = () => {
  if (destroyed) return
  if (!formData.value.projectId || !formData.value.scanFileId) return

  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    if (destroyed) return
    refreshTimer = null
    loadPreview()
      .then(async () => {
        renderCadOverlayTrajectory()

        // 如果在辅助模式中，重新创建点云平面（保持变换状态）
        if (isCalibrationMode.value && cadViewer.value) {
          // 保存当前的变换状态
          const currentTransform = cadOverlayPointCloudPlane.value
            ? {
                position: cadOverlayPointCloudPlane.value.position.clone(),
                rotation: cadOverlayPointCloudPlane.value.rotation.clone(),
                scale: cadOverlayPointCloudPlane.value.scale.clone(),
              }
            : null

          await createPointCloudPlane()

          // 恢复之前的变换状态
          if (currentTransform && cadOverlayPointCloudPlane.value) {
            cadOverlayPointCloudPlane.value.position.copy(
              currentTransform.position,
            )
            cadOverlayPointCloudPlane.value.rotation.copy(
              currentTransform.rotation,
            )
            cadOverlayPointCloudPlane.value.scale.copy(currentTransform.scale)
            requestCadRender()
          }
        }

        // 如果显示了校准后的点云叠加，重新渲染
        if (showPointCloudOverlay.value && alignment.value) {
          await renderCadOverlayPointCloud()
        }
      })
      .catch((error) => {
        if (destroyed) return
        console.error('刷新失败:', error)
        ElMessage.error(error?.message || '刷新失败')
      })
  }, 500)
}

// 清理函数
const cleanup = () => {
  destroyed = true
  lastStep2Key = ''

  // 移除键盘事件监听器
  removeKeyboardListeners()

  // 清理竖向滑块中间条拖拽
  if (cleanupRangeDrag) {
    cleanupRangeDrag()
    cleanupRangeDrag = null
  }

  // 清理定时器
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
  cancelCadRender()
  step2PresetPromise = null

  // 清理 Gizmo rAF 循环
  stopGizmoLoop()

  // 清理本地状态刷新定时器
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }

  // 清理全景查看器
  cleanupPanoramaViewer()

  // 清理 Three.js 叠加线
  disposeCadOverlayLine()

  // 清理 Three.js 点云平面
  if (cadOverlayPointCloudPlane.value && cadViewer.value) {
    try {
      const scene = cadViewer.value.GetScene()
      if (scene) {
        scene.remove(cadOverlayPointCloudPlane.value)
        if (cadOverlayBackgroundPlane.value) {
          scene.remove(cadOverlayBackgroundPlane.value)
        }
      }
      cadOverlayPointCloudPlane.value.geometry.dispose()
      ;(cadOverlayPointCloudPlane.value.material as THREE.Material).dispose()
      if (cadOverlayBackgroundPlane.value) {
        cadOverlayBackgroundPlane.value.geometry.dispose()
        ;(cadOverlayBackgroundPlane.value.material as THREE.Material).dispose()
      }
    } catch (error) {
      console.error('清理点云平面失败:', error)
    }
    cadOverlayPointCloudPlane.value = null
    cadOverlayBackgroundPlane.value = null
  }

  // 清理 DXF Viewer（按demo的简单方式）
  disposeCadViewer()

  // 重置状态
  cadOrigin.value = null

  // 清理图片缓存
  imageCache.clear()
}

// 面板拖拽相关方法
const startPanelDrag = (e: MouseEvent | TouchEvent) => {
  // 检查是否点击在拖拽手柄上
  const target = e.target as HTMLElement
  if (!target.closest('.drag-handle')) {
    return
  }

  e.preventDefault()

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  isPanelDragging.value = true
  panelDragStart.value = {
    x: clientX - floatingPanelPosition.value.x,
    y: clientY - floatingPanelPosition.value.y,
  }

  // 添加全局监听
  document.addEventListener('mousemove', handlePanelDrag)
  document.addEventListener('mouseup', stopPanelDrag)
  document.addEventListener('touchmove', handlePanelDrag)
  document.addEventListener('touchend', stopPanelDrag)
}

const handlePanelDrag = (e: MouseEvent | TouchEvent) => {
  if (!isPanelDragging.value) return

  e.preventDefault()

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  let newX = clientX - panelDragStart.value.x
  let newY = clientY - panelDragStart.value.y

  // 边缘吸附
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const panelWidth = 320 // 面板宽度
  const panelHeight = 600 // 面板高度
  const snapThreshold = panelSnapThreshold.value

  // 吸附到边缘
  if (newX < snapThreshold) newX = 0
  if (newX > viewportWidth - panelWidth - snapThreshold)
    newX = viewportWidth - panelWidth
  if (newY < snapThreshold) newY = 0
  if (newY > viewportHeight - panelHeight - snapThreshold)
    newY = viewportHeight - panelHeight

  // 限制面板在视窗内
  newX = Math.max(0, Math.min(newX, viewportWidth - panelWidth))
  newY = Math.max(0, Math.min(newY, viewportHeight - panelHeight))

  floatingPanelPosition.value = { x: newX, y: newY }
}

const stopPanelDrag = () => {
  isPanelDragging.value = false

  // 移除全局监听
  document.removeEventListener('mousemove', handlePanelDrag)
  document.removeEventListener('mouseup', stopPanelDrag)
  document.removeEventListener('touchmove', handlePanelDrag)
  document.removeEventListener('touchend', stopPanelDrag)
}

// 启动辅助选点模式时初始化面板位置
watch(isCalibrationMode, (newValue) => {
  if (newValue) {
    // 首次启动时设置初始位置为右上角
    if (
      floatingPanelPosition.value.x === 0 &&
      floatingPanelPosition.value.y === 0
    ) {
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const panelWidth = 320
      const panelHeight = 600

      floatingPanelPosition.value = {
        x: viewportWidth - panelWidth - 32,
        y: 32,
      }
    }
  }
})

watch(
  () => route.fullPath,
  () => {
    if (!isStep2Flow.value) return
    void applyStep2QueryPreset()
  },
)

// 组件挂载
onMounted(async () => {
  destroyed = false
  if (isStep2Flow.value) {
    await nextTick()
    await waitForNextFrame()
    await applyStep2QueryPreset()
  } else {
    await loadProjects()
  }

  // 等待竖向滑块渲染完成后绑定中间条拖动
  nextTick(() => {
    cleanupRangeDrag = setupRangeDrag() ?? null
  })
})

onActivated(async () => {
  destroyed = false
  if (isStep2Flow.value) {
    await nextTick()
    await waitForNextFrame()
    await applyStep2QueryPreset()
  }
  nextTick(() => {
    if (!cleanupRangeDrag) {
      cleanupRangeDrag = setupRangeDrag() ?? null
    }
  })
})

onDeactivated(() => {
  cleanup()
})

// 组件卸载前清理
onBeforeUnmount(() => {
  cleanup()
  // 清理面板拖拽监听
  if (isPanelDragging.value) {
    stopPanelDrag()
  }
})
</script>

<style lang="scss" scoped>
@use './index.scss';
</style>
