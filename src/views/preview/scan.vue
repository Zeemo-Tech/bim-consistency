<template>
  <div class="pointcloud-preview-page" :class="`theme-${backgroundTheme}`">
    <header class="pc-header">
      <span class="pc-heading">
        <strong :title="fileName">{{ fileName || '点云预览' }}</strong>
        <small :title="projectName">
          {{ projectName || '实测扫描' }} · 点云预览
        </small>
      </span>

      <div class="pc-header-tools" role="toolbar" aria-label="预览工具">
        <el-tooltip content="背景" placement="bottom" :show-after="150">
          <el-popover
            placement="bottom-end"
            :width="164"
            trigger="click"
            popper-class="pc-popover"
          >
            <template #reference>
              <button class="pc-icon-btn" type="button" aria-label="背景">
                <span class="pc-icon-glyph" :style="glyph(ICON_URL.bg)" />
              </button>
            </template>
            <div class="pc-bg-grid">
              <button
                v-for="option in backgroundOptions"
                :key="option.value"
                class="pc-bg-cell"
                :class="[
                  `is-${option.value}`,
                  { on: backgroundTheme === option.value },
                ]"
                type="button"
                :title="option.label"
                :aria-label="option.label"
                :aria-pressed="backgroundTheme === option.value"
                @click="backgroundTheme = option.value"
              />
            </div>
          </el-popover>
        </el-tooltip>

        <span class="pc-tool-divider" />

        <el-tooltip content="点云着色" placement="bottom" :show-after="150">
          <el-popover
            placement="bottom-end"
            :width="250"
            trigger="click"
            popper-class="pc-popover"
          >
            <template #reference>
              <button class="pc-icon-btn" type="button" aria-label="点云着色">
                <span class="pc-icon-glyph" :style="glyph(ICON_URL.color)" />
              </button>
            </template>
            <div class="pc-pop">
              <div class="pc-pop-title">点云着色</div>
              <div class="pc-pop-seg">
                <button
                  v-for="opt in colorModeControls"
                  :key="opt.value"
                  type="button"
                  :class="{ on: colorMode === opt.value }"
                  :aria-pressed="colorMode === opt.value"
                  :disabled="opt.disabled"
                  :title="opt.title"
                  @click="colorMode = opt.value"
                >
                  {{ opt.label }}
                </button>
              </div>
              <div v-if="colorMode === 'intensity'" class="pc-pop-block">
                <div class="pc-pop-sub">色带</div>
                <div class="pc-pop-seg">
                  <button
                    v-for="item in RAMP_LABELS"
                    :key="item.key"
                    type="button"
                    :class="{ on: colorRamp === item.key }"
                    :aria-pressed="colorRamp === item.key"
                    @click="colorRamp = item.key"
                  >
                    {{ item.label }}
                  </button>
                </div>
              </div>
              <div
                v-if="colorMode === 'table-class'"
                class="pc-category-legend"
              >
                <span class="pc-legend-item">
                  <i class="pc-legend-dot is-table" />
                  台面
                </span>
                <span class="pc-legend-item">
                  <i class="pc-legend-dot is-body" />
                  主体
                </span>
              </div>
            </div>
          </el-popover>
        </el-tooltip>

        <el-tooltip content="点大小与数量" placement="bottom" :show-after="150">
          <el-popover
            placement="bottom-end"
            :width="250"
            trigger="click"
            popper-class="pc-popover"
          >
            <template #reference>
              <button
                class="pc-icon-btn"
                type="button"
                aria-label="点大小与数量"
              >
                <span class="pc-icon-glyph" :style="glyph(ICON_URL.size)" />
              </button>
            </template>
            <div class="pc-pop">
              <div class="pc-pop-slider">
                <div class="pc-pop-slider-head">
                  <span>点大小</span>
                  <em>{{ pointSize.toFixed(1) }}</em>
                </div>
                <el-slider
                  v-model="pointSize"
                  :min="1"
                  :max="5"
                  :step="0.1"
                  size="small"
                  aria-label="点大小"
                />
              </div>
              <div class="pc-pop-slider">
                <div class="pc-pop-slider-head">
                  <span>点数量</span>
                  <em>{{ pointRatio }}%</em>
                </div>
                <el-slider
                  v-model="pointRatio"
                  :min="1"
                  :max="100"
                  :step="1"
                  size="small"
                  aria-label="点数量"
                />
              </div>
            </div>
          </el-popover>
        </el-tooltip>

        <span class="pc-tool-divider" />

        <el-tooltip content="显示增强" placement="bottom" :show-after="150">
          <button
            class="pc-icon-btn"
            :class="{ 'is-active': edlEnabled }"
            :aria-pressed="edlEnabled"
            type="button"
            aria-label="显示增强"
            @click="edlEnabled = !edlEnabled"
          >
            <span class="pc-icon-glyph" :style="glyph(ICON_URL.edl)" />
          </button>
        </el-tooltip>
        <el-tooltip content="坐标轴" placement="bottom" :show-after="150">
          <button
            class="pc-icon-btn"
            :class="{ 'is-active': showAxes }"
            :aria-pressed="showAxes"
            type="button"
            aria-label="坐标轴"
            @click="showAxes = !showAxes"
          >
            <span class="pc-icon-glyph" :style="glyph(ICON_URL.axes)" />
          </button>
        </el-tooltip>
        <el-tooltip content="网格" placement="bottom" :show-after="150">
          <button
            class="pc-icon-btn"
            :class="{ 'is-active': showGrid }"
            :aria-pressed="showGrid"
            type="button"
            aria-label="网格"
            @click="showGrid = !showGrid"
          >
            <span class="pc-icon-glyph" :style="glyph(ICON_URL.grid)" />
          </button>
        </el-tooltip>
        <el-tooltip content="剖切" placement="bottom" :show-after="150">
          <button
            class="pc-icon-btn"
            :class="{ 'is-active': showBounds }"
            :aria-pressed="showBounds"
            type="button"
            aria-label="剖切"
            @click="onBoundsButtonClick"
          >
            <span class="pc-icon-glyph" :style="glyph(ICON_URL.clip)" />
          </button>
        </el-tooltip>

        <span class="pc-tool-divider" />

        <el-tooltip content="第一人称漫游" placement="bottom" :show-after="150">
          <button
            class="pc-icon-btn"
            :class="{ 'is-active': firstPersonActive }"
            :aria-pressed="firstPersonActive"
            :disabled="!pointcloudLoadedState"
            type="button"
            aria-label="第一人称漫游"
            @click="toggleFirstPerson"
          >
            <el-icon><View /></el-icon>
          </button>
        </el-tooltip>

        <span class="pc-tool-divider" />

        <el-tooltip content="测量" placement="bottom" :show-after="150">
          <el-popover
            placement="bottom-end"
            :width="212"
            trigger="click"
            popper-class="pc-popover"
          >
            <template #reference>
              <button
                class="pc-icon-btn"
                :class="{ 'is-active': analysisMode !== 'none' }"
                :aria-pressed="analysisMode !== 'none'"
                type="button"
                aria-label="测量"
              >
                <el-icon><ScaleToOriginal /></el-icon>
              </button>
            </template>
            <div class="pc-pop">
              <div class="pc-pop-title">测量</div>
              <div class="pc-pop-seg">
                <button
                  v-for="item in measureActions"
                  :key="item.mode"
                  type="button"
                  :class="{ on: analysisMode === item.mode }"
                  :aria-pressed="analysisMode === item.mode"
                  :disabled="!pointcloudLoadedState"
                  :title="item.title"
                  @click="selectAnalysisMode(item.mode)"
                >
                  {{ item.label }}
                </button>
              </div>
              <button
                class="pc-pop-clear"
                type="button"
                :disabled="!pointcloudLoadedState || !canUndoMeasurement"
                @click="undoMeasurement"
              >
                <el-icon><RefreshLeft /></el-icon>
                撤销上一步
              </button>
              <button
                class="pc-pop-clear"
                type="button"
                :disabled="!pointcloudLoadedState"
                @click="clearAnalysis"
              >
                <el-icon><Delete /></el-icon>
                清除测量
              </button>
            </div>
          </el-popover>
        </el-tooltip>
        <el-tooltip
          v-if="trajectoryPoints.length"
          :content="
            trajectoryClickMode === 'panorama'
              ? '点击轨迹点：打开全景图'
              : '点击轨迹点：切换视角'
          "
          placement="bottom"
          :show-after="150"
        >
          <el-popover
            placement="bottom-end"
            :width="220"
            trigger="click"
            popper-class="pc-popover"
          >
            <template #reference>
              <button
                class="pc-icon-btn"
                :class="{ 'is-active': trajectoryClickMode === 'view' }"
                :aria-pressed="trajectoryClickMode === 'view'"
                type="button"
                aria-label="轨迹点点击行为"
              >
                <el-icon><Compass /></el-icon>
              </button>
            </template>
            <div class="pc-pop">
              <div class="pc-pop-title">点击轨迹点</div>
              <div class="pc-pop-seg">
                <button
                  type="button"
                  :class="{ on: trajectoryClickMode === 'panorama' }"
                  :aria-pressed="trajectoryClickMode === 'panorama'"
                  :disabled="!attachIncludePanorama"
                  :title="
                    attachIncludePanorama ? '打开全景图' : '该点云未包含全景图'
                  "
                  @click="trajectoryClickMode = 'panorama'"
                >
                  打开全景图
                </button>
                <button
                  type="button"
                  :class="{ on: trajectoryClickMode === 'view' }"
                  :aria-pressed="trajectoryClickMode === 'view'"
                  @click="trajectoryClickMode = 'view'"
                >
                  切换视角
                </button>
              </div>
              <p class="pc-pop-hint">
                {{
                  attachIncludePanorama
                    ? '选择点击圆形轨迹点时的默认动作'
                    : '该点云未包含全景图，点击轨迹点仅切换视角'
                }}
              </p>
            </div>
          </el-popover>
        </el-tooltip>
        <el-tooltip content="重置视角" placement="bottom" :show-after="150">
          <button
            class="pc-icon-btn"
            type="button"
            aria-label="重置视角"
            @click="resetToTrajectoryView"
          >
            <el-icon><Aim /></el-icon>
          </button>
        </el-tooltip>
        <el-tooltip
          :content="isFullscreen ? '退出全屏' : '全屏'"
          placement="bottom"
          :show-after="150"
        >
          <button
            class="pc-icon-btn"
            :class="{ 'is-active': isFullscreen }"
            type="button"
            :aria-label="isFullscreen ? '退出全屏' : '进入全屏'"
            @click="toggleFullscreen"
          >
            <el-icon><FullScreen /></el-icon>
          </button>
        </el-tooltip>

        <span class="pc-tool-divider" />

        <el-tooltip content="点云" placement="bottom" :show-after="150">
          <button
            class="pc-icon-btn"
            :class="{ 'is-active': pointcloudVisible }"
            :aria-pressed="pointcloudVisible"
            type="button"
            aria-label="点云"
            @click="pointcloudVisible = !pointcloudVisible"
          >
            <span class="pc-icon-glyph" :style="glyph(ICON_URL.pointcloud)" />
          </button>
        </el-tooltip>
        <el-tooltip
          v-if="attachIncludeGaussian"
          content="高斯"
          placement="bottom"
          :show-after="150"
        >
          <button
            class="pc-icon-btn"
            :class="{ 'is-active': gaussianVisible }"
            :aria-pressed="gaussianVisible"
            type="button"
            aria-label="高斯"
            @click="gaussianVisible = !gaussianVisible"
          >
            <span class="pc-icon-glyph" :style="glyph(ICON_URL.gauss)" />
          </button>
        </el-tooltip>
        <el-tooltip
          v-if="trajectoryPoints.length"
          content="轨迹"
          placement="bottom"
          :show-after="150"
        >
          <button
            class="pc-icon-btn"
            :class="{ 'is-active': trajectoryVisible }"
            :aria-pressed="trajectoryVisible"
            type="button"
            aria-label="轨迹"
            @click="trajectoryVisible = !trajectoryVisible"
          >
            <span class="pc-icon-glyph" :style="glyph(ICON_URL.trajectory)" />
          </button>
        </el-tooltip>
      </div>

      <button
        class="pc-close"
        type="button"
        aria-label="关闭预览"
        title="关闭预览"
        @click="handleClose"
      >
        <span class="pc-icon-glyph" :style="glyph(ICON_URL.exit)" />
      </button>
    </header>

    <main
      ref="stageRef"
      class="pc-stage"
      :class="`theme-${backgroundTheme}`"
      @click="onStageClick"
    >
      <PointCloudViewer
        v-show="pointcloudVisible"
        ref="pointcloudViewerRef"
        class="pc-viewer"
        :is-preset-mode="true"
        :apply-tileset-transform="true"
        :auto-fit-on-load="false"
        :click-to-enter-first-person="false"
        :show-internal-controls="false"
        :prefer-webgl="true"
        :pixel-ratio-cap="1.25"
        :tiles-resolution-scale="0.72"
        @loaded-change="handlePointcloudLoadedChange"
        @world-ready="handlePointcloudWorldReady"
        @first-person-change="handleFirstPersonChange"
      />

      <!-- 叠加层：高斯 + 轨迹，按点云坐标系叠加（跟随点云相机） -->
      <ScanGaussTrajectoryOverlay
        ref="overlayRef"
        class="pc-gauss-overlay"
        :get-camera-pose="getOverlayCameraPose"
        :show-gaussian="attachIncludeGaussian && gaussianVisible"
        :show-trajectory="trajectoryVisible && trajectoryPoints.length > 0"
        :gauss-data-path="gaussDataPath"
        :trajectory-points="trajectoryPoints"
        :selected-index="selectedTrajectoryIndex"
        :clip-box="overlayClipBox"
        :clip-axis="activeClipAxis"
        :clip-invert="activeClipInvert"
      />

      <!-- 全景图叠加层：点击轨迹控制点后铺在页面上，可上一个/下一个/关闭 -->
      <div v-if="panoramaOverlayVisible" class="pc-panorama-overlay">
        <button
          class="pc-panorama-close"
          type="button"
          aria-label="关闭全景图"
          title="关闭"
          @click="panoramaOverlayVisible = false"
        >
          <el-icon><Close /></el-icon>
        </button>
        <button
          class="pc-panorama-nav is-prev"
          type="button"
          aria-label="上一个轨迹点"
          title="上一个轨迹点"
          @click="stepTrajectory(-1)"
        >
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <button
          class="pc-panorama-nav is-next"
          type="button"
          aria-label="下一个轨迹点"
          title="下一个轨迹点"
          @click="stepTrajectory(1)"
        >
          <el-icon><ArrowRight /></el-icon>
        </button>
        <PanoramaViewPanel
          ref="panoramaRef"
          class="pc-panorama-panel"
          :project-id="projectId"
          :scan-file-id="fileId"
          @image-info-change="onPanoramaImageInfo"
        />
        <div class="pc-panorama-label">
          {{
            currentTrajectoryPoint
              ? trajectoryPointLabel(
                  currentTrajectoryPoint,
                  selectedTrajectoryIndex ?? 0,
                )
              : ''
          }}
        </div>
      </div>

      <PointcloudAxesTriad
        v-show="showAxes"
        class="pc-axes-triad"
        :camera="viewerCamera"
      />

      <PointcloudViewCube
        class="pc-view-cube"
        :camera="viewerCamera"
        @select-direction="setViewDirection"
        @orbit="orbitView"
        @roll="rollView"
        @home="resetView"
      />

      <!-- 强度颜色轴：直方图 + 色带（对齐 cloudBIM-viewer）-->
      <div
        v-if="colorMode === 'intensity'"
        class="pc-int-axis"
        role="group"
        aria-label="强度颜色轴"
      >
        <button
          type="button"
          class="pc-int-axis__reset"
          title="重置强度范围"
          aria-label="重置强度范围"
          @click="refreshColorAvailability"
        >
          <el-icon><RefreshLeft /></el-icon>
        </button>
        <div class="pc-int-axis__body">
          <div class="pc-int-axis__hist">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                v-if="histogramPath"
                :d="histogramPath"
                class="pc-int-axis__area"
              />
            </svg>
            <span class="pc-int-axis__pct">%</span>
          </div>
          <div class="pc-int-axis__barrow">
            <span class="pc-int-axis__label">
              {{ colorRangeLabel(colorRange[0]) }}
            </span>
            <div
              class="pc-int-axis__bar"
              :style="{ background: colorRampGradient }"
            />
            <span class="pc-int-axis__label">
              {{ colorRangeLabel(colorRange[1]) }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="analysisMode !== 'none'" class="pc-analysis-toolbar">
        <strong>{{ analysisTitle }}</strong>
        <span v-if="analysisSummary" class="pc-analysis-value">
          {{ analysisSummary }}
        </span>
        <span v-else class="pc-analysis-hint">{{ analysisHint }}</span>
        <span class="pc-analysis-exit">Esc 退出 · Ctrl+Z 撤销</span>
        <button
          type="button"
          :disabled="!canUndoMeasurement"
          @click="undoMeasurement"
        >
          撤销
        </button>
        <button type="button" @click="clearAnalysis">清除</button>
      </div>

      <!-- 剖切面板：轴 / 反向 / 位置滑杆（在视图里拖动箭头手柄同样生效） -->
      <div v-if="showBounds" class="pc-clip-bar" role="group" aria-label="剖切">
        <span class="pc-clip-bar__title">剖切</span>
        <div class="pc-clip-bar__axes">
          <button
            v-for="axis in CLIP_AXES"
            :key="axis"
            type="button"
            :class="{ on: activeClipAxis === axis }"
            @click="onClipAxisChange(axis)"
          >
            {{ axis.toUpperCase() }}
          </button>
        </div>
        <button
          type="button"
          class="pc-clip-bar__flip"
          :class="{ on: activeClipInvert }"
          @click="toggleClipInvert"
        >
          反向
        </button>
        <input
          v-model.number="clipUiPosition"
          class="pc-clip-bar__slider"
          type="range"
          :min="clipUiRange.min"
          :max="clipUiRange.max"
          :step="clipUiStep"
          aria-label="剖切位置"
          @input="onClipSliderInput"
        />
        <span class="pc-clip-bar__value">{{ clipUiPercent }}%</span>
        <button
          type="button"
          class="pc-clip-bar__close"
          @click="onBoundsButtonClick"
        >
          关闭
        </button>
      </div>

      <div class="pc-measure-badges">
        <div
          v-for="badge in measureBadges"
          v-show="badge.visible"
          :key="badge.id"
          class="pc-measure-badge"
          :style="{ transform: `translate(${badge.x}px, ${badge.y}px)` }"
        >
          <header @pointerdown="startBadgeDrag(badge, $event)">
            <span class="pc-measure-badge__dots" aria-hidden="true" />
            <span class="pc-measure-badge__title">{{ badge.title }}</span>
          </header>
          <div v-if="badge.mainValue" class="pc-measure-badge__main">
            <span>{{ badge.mainLabel }}</span>
            <strong>{{ badge.mainValue }}</strong>
          </div>
          <div v-if="badge.rows.length" class="pc-measure-badge__rows">
            <div v-for="row in badge.rows" :key="row.label">
              <span>{{ row.label }}</span>
              <span>{{ row.value }}</span>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="firstPersonActive"
        class="pc-fp-controls"
        role="group"
        aria-label="第一人称移动控制"
      >
        <p class="pc-fp-hint">拖拽看向 · WASD 移动 · Esc 退出</p>
        <div class="pc-fp-pad">
          <button
            class="pc-fp-key is-up"
            type="button"
            aria-label="前进"
            title="前进 (W)"
            @pointerdown.prevent="fpMove('up', true)"
            @pointerup="fpMove('up', false)"
            @pointerleave="fpMove('up', false)"
            @pointercancel="fpMove('up', false)"
          >
            <el-icon><ArrowUp /></el-icon>
          </button>
          <button
            class="pc-fp-key is-left"
            type="button"
            aria-label="左移"
            title="左移 (A)"
            @pointerdown.prevent="fpMove('left', true)"
            @pointerup="fpMove('left', false)"
            @pointerleave="fpMove('left', false)"
            @pointercancel="fpMove('left', false)"
          >
            <el-icon><ArrowLeft /></el-icon>
          </button>
          <button
            class="pc-fp-key is-right"
            type="button"
            aria-label="右移"
            title="右移 (D)"
            @pointerdown.prevent="fpMove('right', true)"
            @pointerup="fpMove('right', false)"
            @pointerleave="fpMove('right', false)"
            @pointercancel="fpMove('right', false)"
          >
            <el-icon><ArrowRight /></el-icon>
          </button>
          <button
            class="pc-fp-key is-down"
            type="button"
            aria-label="后退"
            title="后退 (S)"
            @pointerdown.prevent="fpMove('down', true)"
            @pointerup="fpMove('down', false)"
            @pointerleave="fpMove('down', false)"
            @pointercancel="fpMove('down', false)"
          >
            <el-icon><ArrowDown /></el-icon>
          </button>
        </div>
        <button
          class="pc-fp-collision"
          type="button"
          :class="{ on: collisionEnabled }"
          :aria-pressed="collisionEnabled"
          title="开启后相机不会穿入点云内部"
          @click="collisionEnabled = !collisionEnabled"
        >
          碰撞保护
        </button>
      </div>

      <div class="pc-status" role="status">
        <i :class="{ loading: !pointcloudLoadedState }" aria-hidden="true" />
        <span>
          {{
            pointcloudLoadedState
              ? '点云已加载'
              : showLoadingHint
                ? '正在加载点云，文件较大时可能需要一些时间…'
                : '正在加载点云'
          }}
        </span>
      </div>

      <div v-if="errorMessage" class="pc-error-overlay" role="alert">
        <div class="pc-error-card">
          <div class="pc-error-title">预览失败</div>
          <div class="pc-error-message">{{ errorMessage }}</div>
          <div class="pc-error-actions">
            <el-button type="primary" @click="loadPreview">重试</el-button>
            <el-button @click="handleClose">返回</el-button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Aim,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Close,
  Compass,
  Delete,
  FullScreen,
  RefreshLeft,
  ScaleToOriginal,
  View,
} from '@element-plus/icons-vue'
import PanoramaViewPanel from '@/views/result/components/PanoramaViewPanel.vue'
import ScanGaussTrajectoryOverlay from './components/ScanGaussTrajectoryOverlay.vue'
import { getProjectFilesByProjectId, getGaussAssetUrl } from '@/api/fileManage'
import { getScanPreview, type TrajectoryPoint } from '@/api/calibration'
import { getScanCalibration } from '@/api/scan'
import { formatToken, getOrganizationId, getToken } from '@/utils/auth'
import * as THREE from 'three'
import PointCloudViewer from '@/views/twoScreen/components/PointCloudViewer.vue'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import PointcloudAxesTriad from './PointcloudAxesTriad.vue'
import PointcloudViewCube from './PointcloudViewCube.vue'

defineOptions({
  name: 'PreviewScan',
})

const route = useRoute()
const router = useRouter()

/** 工具栏图标（来自 public/dianyun，统一用 mask + currentColor 着色）。 */
const ICON_URL = {
  bg: 'url(/dianyun/beijingyanse.svg)',
  color: 'url(/dianyun/zhuose.svg)',
  gauss: 'url(/dianyun/gaosihunhe.svg)',
  size: 'url(/dianyun/dianliang.svg)',
  edl: 'url(/dianyun/zengqiang.svg)',
  axes: 'url(/dianyun/zuobiaozhou.svg)',
  grid: 'url(/dianyun/wanggeguan.svg)',
  clip: 'url(/dianyun/shitupouqiehe.svg)',
  pointcloud: 'url(/dianyun/dianyun.svg)',
  trajectory: 'url(/dianyun/a-30Hguiji.svg)',
  exit: 'url(/dianyun/tuichu.svg)',
} as const

function glyph(url: string): Record<string, string> {
  return { '--glyph': url }
}

type ClipAxisKey = 'x' | 'y' | 'z'
type ClipBoxOffsets = {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  zMin: number
  zMax: number
}
type ClipBoxState = {
  baseBox: THREE.Box3
  offsets: ClipBoxOffsets
  revision: number
}
type ViewerThreeContext = {
  scene: THREE.Scene | null
  camera: THREE.Camera | null
  renderer:
    | THREE.WebGLRenderer
    | {
        domElement?: HTMLCanvasElement
      }
    | null
  controls: {
    enabled: boolean
  } | null
}
type PointCloudViewerExpose = InstanceType<typeof PointCloudViewer> & {
  setStatusText?: (text: string) => void
  loadPointcloudByScanId: (
    projectId: number,
    scanFileId: number,
  ) => Promise<void>
  resetView?: () => void
  cleanup?: () => void
  getThreeContext?: () => ViewerThreeContext
  getPointcloudWorldBox?: () => THREE.Box3 | null
  setClipBox?: (box: THREE.Box3 | null) => void
  setControlsEnabled?: (enabled: boolean) => void
  setPointSize?: (size: number) => void
  setShowGrid?: (show: boolean) => void
  setEdlEnabled?: (enabled: boolean) => void
  setColorMode?: (
    mode: ScanColorMode,
    ramp?: ScanColorRamp,
    range?: [number, number] | null,
  ) => void
  getColorRange?: () => [number, number]
  isColorAttributeAvailable?: () => boolean
  getColorAvailability?: () => { intensity: boolean; tableClass: boolean }
  getIntensityHistogram?: (bins?: number) => number[]
  setTilesErrorTargetOverride?: (value: number | null) => void
  requestRender?: () => void
  syncFromTrajectory?: (point: TrajectoryPoint) => void
  setPointRatio?: (ratio: number) => void
  enterFirstPersonMode?: () => void
  exitFirstPersonMode?: () => void
  toggleFirstPersonMode?: () => void
  isFirstPersonActive?: () => boolean
  setFirstPersonMoveDirection?: (
    direction: FpMoveDirection,
    active: boolean,
  ) => void
  setCollisionEnabled?: (enabled: boolean) => void
}

const pointcloudViewerRef = ref<PointCloudViewerExpose | null>(null)
const errorMessage = ref('')
const showLoadingHint = ref(false)
let loadingHintTimer: ReturnType<typeof setTimeout> | null = null
const loadToken = ref(0)
const showBounds = ref(false)
const activeClipAxis = ref<ClipAxisKey>('z')
const activeClipInvert = ref(false)
const clipBoxTick = ref(0)
const clipUiRange = ref({ min: 0, max: 1 })
const clipUiPosition = ref(0)
const CLIP_AXES: ClipAxisKey[] = ['x', 'y', 'z']
const clipUiStep = computed(() => {
  const span = clipUiRange.value.max - clipUiRange.value.min
  return span > 0 ? span / 400 : 0.001
})
const clipUiPercent = computed(() => {
  const { min, max } = clipUiRange.value
  if (!(max > min)) return 0
  const t = (clipUiPosition.value - min) / (max - min)
  return Math.round(Math.min(1, Math.max(0, t)) * 100)
})
const pointcloudLoadedState = ref(false)
const pointcloudWorldReady = ref(false)

// ==================== 预览页 UI 状态（对齐 cloudBIM-viewer 点云预览） ====================
type PreviewBackgroundTheme = 'deep' | 'light' | 'black' | 'gradient'
const backgroundTheme = ref<PreviewBackgroundTheme>('deep')
const backgroundOptions: Array<{
  label: string
  value: PreviewBackgroundTheme
}> = [
  { label: '蓝色', value: 'gradient' },
  { label: '深色', value: 'deep' },
  { label: '浅色', value: 'light' },
  { label: '纯黑', value: 'black' },
]
const projectName = computed(() => String(route.query.projectName || ''))
const stageRef = ref<HTMLElement | null>(null)
const viewerCamera = ref<THREE.Camera | null>(null)
const isFullscreen = ref(false)
const showAxes = ref(true)
const showGrid = ref(false)
const edlEnabled = ref(true)
const pointSize = ref(2.5)
let scanMaxDim = 10

// 第一人称漫游：进入后显示方向控制器，可开启碰撞保护
type FpMoveDirection = 'up' | 'down' | 'left' | 'right'
const firstPersonActive = ref(false)
const collisionEnabled = ref(true)
function toggleFirstPerson() {
  pointcloudViewerRef.value?.toggleFirstPersonMode?.()
}
function handleFirstPersonChange(value: boolean) {
  firstPersonActive.value = value
}
function fpMove(direction: FpMoveDirection, active: boolean) {
  pointcloudViewerRef.value?.setFirstPersonMoveDirection?.(direction, active)
}
watch(collisionEnabled, (value) => {
  pointcloudViewerRef.value?.setCollisionEnabled?.(value)
})

// 点云着色：真彩 / 台面分色 / 强度 + 色带 + 颜色轴
type ScanColorMode = 'rgb' | 'table-class' | 'intensity'
type ScanColorRamp = 'grayscale' | 'spectrum' | 'viridis'
const colorMode = ref<ScanColorMode>('rgb')
const colorRamp = ref<ScanColorRamp>('spectrum')
const colorRange = ref<[number, number]>([0, 1])
const colorHasIntensity = ref(false)
const colorHasClass = ref(false)
const intensityHistogram = ref<number[]>([])
const histogramPath = computed(() => {
  const bins = intensityHistogram.value
  if (bins.length < 2) return ''
  const n = bins.length
  const points = bins.map(
    (value, index) =>
      `${((index / (n - 1)) * 100).toFixed(2)},${(100 - value * 100).toFixed(2)}`,
  )
  return `M0,100 L${points.join(' L')} L100,100 Z`
})
const RAMP_LABELS: Array<{ key: ScanColorRamp; label: string }> = [
  { key: 'grayscale', label: '灰度' },
  { key: 'spectrum', label: '彩虹' },
  { key: 'viridis', label: '紫黄' },
]

const colorModeControls = computed<
  Array<{
    value: ScanColorMode
    label: string
    disabled: boolean
    title: string
  }>
>(() => [
  { value: 'rgb', label: '真彩', disabled: false, title: '真彩' },
  {
    value: 'intensity',
    label: '强度',
    disabled: !colorHasIntensity.value,
    title: colorHasIntensity.value ? '强度' : '该点云不含强度属性',
  },
  {
    value: 'table-class',
    label: '点云分类',
    disabled: !colorHasClass.value,
    title: colorHasClass.value ? '点云分类' : '该点云不含分类属性',
  },
])

// 与 PointCloudViewer 里点云实际使用的色带保持完全一致的取色
const RAMP_VIRIDIS_STOPS: Array<[number, number, number]> = [
  [68, 1, 84],
  [49, 104, 142],
  [53, 183, 121],
  [253, 231, 37],
]
const rampColorCss = (
  ramp: ScanColorRamp,
  t: number,
): [number, number, number] => {
  const x = Math.min(1, Math.max(0, t))
  if (ramp === 'grayscale') {
    const v = Math.round(x * 255)
    return [v, v, v]
  }
  if (ramp === 'viridis') {
    const segment = Math.min(2, Math.floor(x * 3))
    const local = x * 3 - segment
    const a = RAMP_VIRIDIS_STOPS[segment]
    const b = RAMP_VIRIDIS_STOPS[segment + 1]
    return [
      Math.round(a[0] + (b[0] - a[0]) * local),
      Math.round(a[1] + (b[1] - a[1]) * local),
      Math.round(a[2] + (b[2] - a[2]) * local),
    ]
  }
  // spectrum / 彩虹：蓝(低) → 青 → 绿 → 黄 → 红(高)
  const hue = (1 - x) * 240
  const hh = hue / 60
  const xx = 1 - Math.abs((hh % 2) - 1)
  let r = 0
  let g = 0
  let b = 0
  if (hh < 1) {
    r = 1
    g = xx
  } else if (hh < 2) {
    r = xx
    g = 1
  } else if (hh < 3) {
    g = 1
    b = xx
  } else if (hh < 4) {
    g = xx
    b = 1
  } else {
    r = xx
    b = 1
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}
const colorRampGradient = computed(() => {
  const steps = 16
  const stops: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const [r, g, b] = rampColorCss(colorRamp.value, t)
    stops.push(`rgb(${r}, ${g}, ${b}) ${(t * 100).toFixed(1)}%`)
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`
})
const colorRangeLabel = (value: number) =>
  Number.isFinite(value) ? value.toFixed(Math.abs(value) >= 100 ? 0 : 1) : '—'

// 测量工具
type AnalysisMode = 'none' | 'distance' | 'locate' | 'area'
const analysisMode = ref<AnalysisMode>('none')
/** 顶部工具栏「测量」下拉里的模式项。 */
const measureActions: Array<{
  mode: Exclude<AnalysisMode, 'none'>
  label: string
  title: string
}> = [
  { mode: 'distance', label: '测距', title: '全局测距' },
  { mode: 'locate', label: '定位', title: '全局定位' },
  { mode: 'area', label: '面积', title: '面积测量' },
]
type MeasureBadge = {
  id: string
  title: string
  mainLabel: string
  mainValue: string
  rows: Array<{ label: string; value: string }>
  anchor: THREE.Vector3
  offset: { x: number; y: number }
  x: number
  y: number
  visible: boolean
}
const measureBadges = ref<MeasureBadge[]>([])
type MeasurementType = 'point' | 'distance' | 'area'
type MeasurementRecord = {
  id: string
  badgeId: string
  type: MeasurementType
  group: THREE.Group
}
const measurements = shallowRef<MeasurementRecord[]>([])
const measureRevision = ref(0)
const canUndoMeasurement = computed(
  () =>
    measureRevision.value >= 0 &&
    (measurements.value.length > 0 ||
      distanceStart !== null ||
      areaPoints.length > 0),
)
function touchMeasureRevision() {
  measureRevision.value += 1
}
let measureGroup: THREE.Group | null = null
let areaPreviewGroup: THREE.Group | null = null
let measureIdSeq = 0
const measureCounts = { point: 0, distance: 0, area: 0 }
let distanceStart: THREE.Vector3 | null = null
let distanceStartGroup: THREE.Group | null = null
let areaPoints: THREE.Vector3[] = []
let measurePointerDown: { x: number; y: number } | null = null
let badgeDrag: {
  id: string
  startX: number
  startY: number
  originX: number
  originY: number
  moved: boolean
} | null = null
let labelRaf = 0

function ensureMeasureGroup(): THREE.Group | null {
  const scene = getViewerScene()
  if (!scene) return null
  if (!measureGroup) {
    measureGroup = new THREE.Group()
    measureGroup.name = '__scan_measure_group__'
    measureGroup.renderOrder = 10000
    scene.add(measureGroup)
  }
  return measureGroup
}

/** 作用：为一次测量创建独立分组，便于整条撤销/删除 */
function createMeasurementGroup(): THREE.Group {
  const group = new THREE.Group()
  group.name = '__scan_measure_entry__'
  group.renderOrder = 10000
  ensureMeasureGroup()?.add(group)
  return group
}

/** 作用：释放一个测量分组下的几何/贴图资源 */
function disposeMeasurementGroup(obj: THREE.Object3D) {
  obj.traverse((child: THREE.Object3D & { geometry?: any; material?: any }) => {
    child.geometry?.dispose?.()
    const mat = child.material
    if (Array.isArray(mat)) mat.forEach((m: any) => m?.dispose?.())
    else {
      mat?.map?.dispose?.()
      mat?.dispose?.()
    }
  })
}

function registerMeasurement(record: MeasurementRecord) {
  measurements.value = [...measurements.value, record]
  touchMeasureRevision()
}

function requestScanRender() {
  pointcloudViewerRef.value?.requestRender?.()
}

/** 作用：创建测量标记（水滴形图钉），与参考页一致 */
function createMeasurementPinSprite(color = '#ff4040', opacity = 1) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建测量标记画布')
  context.shadowColor = 'rgba(255, 86, 86, .38)'
  context.shadowBlur = 18
  context.fillStyle = color
  context.beginPath()
  context.moveTo(64, 10)
  context.bezierCurveTo(33, 10, 18, 32, 18, 55)
  context.bezierCurveTo(18, 82, 39, 96, 64, 118)
  context.bezierCurveTo(89, 96, 110, 82, 110, 55)
  context.bezierCurveTo(110, 32, 95, 10, 64, 10)
  context.closePath()
  context.fill()
  context.shadowBlur = 0
  context.fillStyle = '#fff1f1'
  context.beginPath()
  context.arc(64, 52, 18, 0, Math.PI * 2)
  context.fill()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const marker = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  )
  marker.center.set(0.5, 0.1)
  marker.renderOrder = 10002
  return marker
}

/** 作用：把图钉保持为屏幕空间固定像素大小 */
function scaleMeasurementPin(marker: THREE.Sprite, targetPixels = 16) {
  const camera = getViewerCamera() as THREE.PerspectiveCamera | null
  const dom = getViewerRendererDom()
  if (!camera || !dom || !marker.visible) return
  const rect = dom.getBoundingClientRect()
  const viewportHeight = Math.max(rect.height, 1)
  const distance = camera.position.distanceTo(marker.position)
  const fov = THREE.MathUtils.degToRad(camera.fov || 50)
  const worldUnitsPerPixel =
    (2 * distance * Math.tan(fov * 0.5)) / viewportHeight
  const size = Math.max(worldUnitsPerPixel * targetPixels, 1e-6)
  marker.scale.set(size, size, 1)
}

function addMeasurementPin(
  point: THREE.Vector3,
  color = '#ff4040',
  opacity = 1,
  group?: THREE.Group | null,
) {
  const target = group ?? ensureMeasureGroup()
  if (!target) return
  const pin = createMeasurementPinSprite(color, opacity)
  pin.position.copy(point)
  target.add(pin)
  scaleMeasurementPin(pin)
}

/** 作用：创建测距/轮廓线（粗虚线，与参考页一致） */
function createMeasureLine(
  points: THREE.Vector3[],
  color = '#d63d3d',
  dashed = true,
) {
  const geometry = new LineGeometry()
  geometry.setPositions(points.flatMap((p) => [p.x, p.y, p.z]))
  const material = new LineMaterial({
    color,
    linewidth: 2.8,
    dashed,
    dashSize: 0.9,
    gapSize: 0.48,
    worldUnits: false,
    transparent: true,
    opacity: 0.96,
    depthTest: false,
    depthWrite: false,
  })
  const line = new Line2(geometry, material)
  line.computeLineDistances()
  line.renderOrder = 10001
  return line
}

function removeAreaPreview() {
  if (!areaPreviewGroup) return
  areaPreviewGroup.parent?.remove(areaPreviewGroup)
  areaPreviewGroup.traverse((obj: any) => {
    obj.geometry?.dispose?.()
    const mat = obj.material
    if (Array.isArray(mat)) mat.forEach((m: any) => m?.dispose?.())
    else mat?.dispose?.()
  })
  areaPreviewGroup = null
}

function addMeasureBadge(
  badge: Omit<MeasureBadge, 'x' | 'y' | 'visible' | 'offset'>,
) {
  measureBadges.value = [
    ...measureBadges.value,
    { ...badge, offset: { x: 0, y: 0 }, x: 0, y: 0, visible: false },
  ]
}

function updateMeasureBadges() {
  const camera = getViewerCamera()
  const dom = getViewerRendererDom()
  if (!camera || !dom || !measureBadges.value.length) return
  const rect = dom.getBoundingClientRect()
  const projected = new THREE.Vector3()
  measureBadges.value = measureBadges.value.map((badge) => {
    projected.copy(badge.anchor).project(camera as THREE.PerspectiveCamera)
    return {
      ...badge,
      x: (projected.x * 0.5 + 0.5) * rect.width + 14 + badge.offset.x,
      y: (-projected.y * 0.5 + 0.5) * rect.height - 18 + badge.offset.y,
      visible: projected.z < 1,
    }
  })
}

/** 作用：拖动测量徽章（与参考页一致）；未拖动的点击仍按测量处理 */
function startBadgeDrag(badge: MeasureBadge, event: PointerEvent) {
  event.stopPropagation()
  event.preventDefault()
  badgeDrag = {
    id: badge.id,
    startX: event.clientX,
    startY: event.clientY,
    originX: badge.offset.x,
    originY: badge.offset.y,
    moved: false,
  }
  window.addEventListener('pointermove', onBadgeDragMove)
  window.addEventListener('pointerup', endBadgeDrag)
}

function onBadgeDragMove(event: PointerEvent) {
  if (!badgeDrag) return
  const drag = badgeDrag
  const dx = event.clientX - drag.startX
  const dy = event.clientY - drag.startY
  if (!drag.moved && Math.hypot(dx, dy) <= 4) return
  drag.moved = true
  measureBadges.value = measureBadges.value.map((badge) =>
    badge.id === drag.id
      ? { ...badge, offset: { x: drag.originX + dx, y: drag.originY + dy } }
      : badge,
  )
}

function endBadgeDrag(event: PointerEvent) {
  const drag = badgeDrag
  badgeDrag = null
  window.removeEventListener('pointermove', onBadgeDragMove)
  window.removeEventListener('pointerup', endBadgeDrag)
  // 点在徽章手柄上但没有拖动：仍视为一次测量点击
  if (drag && !drag.moved && analysisMode.value !== 'none') {
    const point = pickScanPoint(event.clientX, event.clientY)
    if (point) handleMeasurePoint(point)
  }
}

/** 作用：同步图钉大小与粗线分辨率（跟随相机/视口） */
function syncMeasureVisuals() {
  const dom = getViewerRendererDom()
  const width = dom?.clientWidth || 1
  const height = dom?.clientHeight || 1
  measureGroup?.traverse((child: any) => {
    if (child instanceof THREE.Sprite) scaleMeasurementPin(child)
    if (child instanceof Line2) {
      child.material.resolution?.set?.(width, height)
    }
  })
}

function formatLength(value: number) {
  return `${value.toFixed(3)} m`
}

/** 作用：计算多边形在最佳拟合平面上的面积/周长/质心/投影点 */
function createPolygonMetrics(points: THREE.Vector3[]) {
  if (points.length < 3) return null
  const normal = new THREE.Vector3()
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length]
    normal.x += (point.y - next.y) * (point.z + next.z)
    normal.y += (point.z - next.z) * (point.x + next.x)
    normal.z += (point.x - next.x) * (point.y + next.y)
  })
  if (normal.lengthSq() < 1e-10) return null
  normal.normalize()
  const origin = points[0].clone()
  const axisU = points[1].clone().sub(origin)
  if (axisU.lengthSq() < 1e-10) return null
  axisU.normalize()
  const axisV = normal.clone().cross(axisU).normalize()
  const projected = points.map((point) => {
    const relative = point.clone().sub(origin)
    return new THREE.Vector2(relative.dot(axisU), relative.dot(axisV))
  })
  let twiceArea = 0
  let centroidX = 0
  let centroidY = 0
  projected.forEach((point, index) => {
    const next = projected[(index + 1) % projected.length]
    const cross = point.x * next.y - next.x * point.y
    twiceArea += cross
    centroidX += (point.x + next.x) * cross
    centroidY += (point.y + next.y) * cross
  })
  const area = Math.abs(twiceArea) * 0.5
  if (area <= 1e-8) return null
  let perimeter = 0
  points.forEach((point, index) => {
    perimeter += point.distanceTo(points[(index + 1) % points.length])
  })
  const centroid = origin
    .clone()
    .addScaledVector(axisU, centroidX / (3 * twiceArea))
    .addScaledVector(axisV, centroidY / (3 * twiceArea))
  return { projected, area, perimeter, centroid }
}

function polygonArea(points: THREE.Vector3[]) {
  return createPolygonMetrics(points)?.area ?? 0
}

function pickScanPoint(clientX: number, clientY: number): THREE.Vector3 | null {
  const camera = getViewerCamera() as THREE.PerspectiveCamera | null
  const scene = getViewerScene()
  const dom = getViewerRendererDom()
  if (!camera || !scene || !dom) return null
  const rect = dom.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1) return null

  // 只对点云本身做拾取，避免命中网格/测量图钉
  const targets: THREE.Object3D[] = []
  scene.traverse((obj) => {
    if ((obj as any).isPoints) targets.push(obj)
  })
  if (!targets.length) return null

  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -(((clientY - rect.top) / rect.height) * 2 - 1),
  )
  const controls = getViewerThreeContext()?.controls as any
  const target = controls?.target as THREE.Vector3 | undefined
  const distance = target
    ? camera.position.distanceTo(target)
    : Math.max(scanMaxDim, 1)
  const fov = THREE.MathUtils.degToRad(camera.fov || 50)
  const worldPerPixel =
    (2 * Math.max(distance, 0.001) * Math.tan(fov * 0.5)) /
    Math.max(rect.height, 1)

  const ray = new THREE.Raycaster()
  ray.setFromCamera(ndc, camera)
  // 屏幕空间容差：约 18px，先近后远；再放大到 48px 兜底
  for (const pixels of [18, 48]) {
    ray.params.Points = {
      threshold: Math.max(worldPerPixel * pixels, scanMaxDim * 0.01, 0.02),
    }
    const hit = ray.intersectObjects(targets, false)[0]
    if (hit) return snapMeasurePoint(hit.point.clone(), clientX, clientY)
  }
  return null
}

/** 作用：吸附到已有测量点（18px 内），用于闭合区域/接续测量 */
function snapMeasurePoint(
  point: THREE.Vector3,
  clientX: number,
  clientY: number,
): THREE.Vector3 {
  const camera = getViewerCamera()
  const dom = getViewerRendererDom()
  if (!camera || !dom) return point
  const candidates: THREE.Vector3[] = [...areaPoints]
  if (distanceStart) candidates.push(distanceStart)
  measureBadges.value.forEach((badge) => candidates.push(badge.anchor))
  if (!candidates.length) return point

  const rect = dom.getBoundingClientRect()
  const screenX = clientX - rect.left
  const screenY = clientY - rect.top
  const projected = new THREE.Vector3()
  let best: THREE.Vector3 | null = null
  let bestDistance = 18
  for (const candidate of candidates) {
    projected.copy(candidate).project(camera as THREE.PerspectiveCamera)
    if (projected.z < -1 || projected.z > 1) continue
    const x = (projected.x * 0.5 + 0.5) * rect.width
    const y = (-projected.y * 0.5 + 0.5) * rect.height
    const distance = Math.hypot(x - screenX, y - screenY)
    if (distance <= bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }
  return best ? best.clone() : point
}

function handleMeasurePoint(point: THREE.Vector3) {
  if (analysisMode.value === 'locate') {
    const group = createMeasurementGroup()
    const pin = createMeasurementPinSprite('#22d3ee')
    pin.position.copy(point)
    group.add(pin)
    scaleMeasurementPin(pin)
    const id = `measure-${++measureIdSeq}`
    registerMeasurement({ id, badgeId: id, type: 'point', group })
    addMeasureBadge({
      id,
      title: `定位 #${++measureCounts.point}`,
      mainLabel: '坐标',
      mainValue: '',
      rows: [
        { label: 'X', value: formatLength(point.x) },
        { label: 'Y', value: formatLength(point.z) },
        { label: 'Z', value: formatLength(point.y) },
      ],
      anchor: point,
    })
  } else if (analysisMode.value === 'distance') {
    if (!distanceStart) {
      distanceStart = point
      const group = createMeasurementGroup()
      const pin = createMeasurementPinSprite('#ff4040')
      pin.position.copy(point)
      group.add(pin)
      scaleMeasurementPin(pin)
      distanceStartGroup = group
    } else {
      const start = distanceStart
      const group = distanceStartGroup ?? createMeasurementGroup()
      group.add(createMeasureLine([start, point]))
      const endPin = createMeasurementPinSprite('#ff5a5a', 0.96)
      endPin.position.copy(point)
      group.add(endPin)
      scaleMeasurementPin(endPin)
      const dx = point.x - start.x
      const dy = point.y - start.y
      const dz = point.z - start.z
      const horizontal = Math.hypot(dx, dz)
      const vertical = Math.abs(dy)
      const slope =
        horizontal <= 1e-8
          ? vertical <= 1e-8
            ? 0
            : 90
          : (Math.atan2(vertical, horizontal) * 180) / Math.PI
      const id = `measure-${++measureIdSeq}`
      registerMeasurement({ id, badgeId: id, type: 'distance', group })
      addMeasureBadge({
        id,
        title: `测距 #${++measureCounts.distance}`,
        mainLabel: '直线距离',
        mainValue: formatLength(start.distanceTo(point)),
        rows: [
          { label: '水平距离', value: formatLength(horizontal) },
          { label: '垂直距离', value: formatLength(vertical) },
          { label: '坡度', value: `${slope.toFixed(2)}°` },
        ],
        anchor: start.clone().add(point).multiplyScalar(0.5),
      })
      distanceStart = null
      distanceStartGroup = null
    }
  } else if (analysisMode.value === 'area') {
    const camera = getViewerCamera() as THREE.PerspectiveCamera | null
    const closeThreshold = Math.max(
      0.15,
      (camera?.position.distanceTo(point) ?? 1) * 0.025,
    )
    // 与参考页一致：点击首个点附近即闭合区域
    if (
      areaPoints.length >= 3 &&
      point.distanceTo(areaPoints[0]) < closeThreshold
    ) {
      closeAreaMeasurement()
      requestScanRender()
      return
    }
    areaPoints.push(point)
    if (!areaPreviewGroup) {
      areaPreviewGroup = new THREE.Group()
      areaPreviewGroup.renderOrder = 10000
      ensureMeasureGroup()?.add(areaPreviewGroup)
    }
    addMeasurementPin(point, '#ff4040', 1, areaPreviewGroup)
    updateAreaPreview()
  }
  touchMeasureRevision()
  requestScanRender()
}

function removeAreaPreviewLines() {
  if (!areaPreviewGroup) return
  for (const child of [...areaPreviewGroup.children]) {
    if ((child as any).isSprite) continue
    areaPreviewGroup.remove(child)
    ;(child as any).geometry?.dispose?.()
    ;(child as any).material?.dispose?.()
  }
}

/** 作用：刷新面积预览（≥3 点时自动闭合并填充，与参考页一致） */
function updateAreaPreview() {
  removeAreaPreviewLines()
  if (!areaPreviewGroup || areaPoints.length < 2) return
  const closed = areaPoints.length >= 3
  const outline = closed ? [...areaPoints, areaPoints[0]] : [...areaPoints]
  areaPreviewGroup.add(createMeasureLine(outline, '#ff5a5a'))
  if (!closed) return
  const metrics = createPolygonMetrics(areaPoints)
  if (!metrics) return
  const triangles = THREE.ShapeUtils.triangulateShape(metrics.projected, [])
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      areaPoints.flatMap((p) => [p.x, p.y, p.z]),
      3,
    ),
  )
  geometry.setIndex(triangles.flat())
  geometry.computeVertexNormals()
  const fill = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0xff5a5a,
      transparent: true,
      opacity: 0.16,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  fill.renderOrder = 10000
  areaPreviewGroup.add(fill)
}

function closeAreaMeasurement() {
  if (analysisMode.value !== 'area' || areaPoints.length < 3) return
  const points = [...areaPoints]
  const metrics = createPolygonMetrics(points)
  removeAreaPreviewLines()
  const group = createMeasurementGroup()
  if (areaPreviewGroup) {
    for (const child of [...areaPreviewGroup.children]) {
      if ((child as any).isSprite) {
        areaPreviewGroup.remove(child)
        group.add(child)
      }
    }
    areaPreviewGroup.parent?.remove(areaPreviewGroup)
  }
  {
    group.add(createMeasureLine([...points, points[0]], '#ff5a5a'))
    if (metrics) {
      const triangles = THREE.ShapeUtils.triangulateShape(metrics.projected, [])
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          points.flatMap((point) => [point.x, point.y, point.z]),
          3,
        ),
      )
      geometry.setIndex(triangles.flat())
      geometry.computeVertexNormals()
      const fill = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: 0xff5a5a,
          transparent: true,
          opacity: 0.16,
          depthTest: false,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      )
      fill.renderOrder = 10000
      group.add(fill)
    }
  }
  const centroid =
    metrics?.centroid ??
    points
      .reduce((sum, p) => sum.add(p), new THREE.Vector3())
      .multiplyScalar(1 / points.length)
  const id = `measure-${++measureIdSeq}`
  registerMeasurement({ id, badgeId: id, type: 'area', group })
  addMeasureBadge({
    id,
    title: `面积 #${++measureCounts.area}`,
    mainLabel: '面积',
    mainValue: `${polygonArea(points).toFixed(2)} m²`,
    rows: metrics
      ? [{ label: '周长', value: `${metrics.perimeter.toFixed(2)} m` }]
      : [],
    anchor: centroid,
  })
  areaPoints = []
  areaPreviewGroup = null
  touchMeasureRevision()
  requestScanRender()
}

function selectAnalysisMode(mode: AnalysisMode) {
  if (distanceStartGroup) {
    distanceStartGroup.parent?.remove(distanceStartGroup)
    disposeMeasurementGroup(distanceStartGroup)
    distanceStartGroup = null
  }
  analysisMode.value = analysisMode.value === mode ? 'none' : mode
  distanceStart = null
  areaPoints = []
  removeAreaPreview()
  touchMeasureRevision()
}

function clearAnalysis() {
  analysisMode.value = 'none'
  distanceStart = null
  distanceStartGroup = null
  areaPoints = []
  areaPreviewGroup = null
  measureBadges.value = []
  measurements.value = []
  measureCounts.point = 0
  measureCounts.distance = 0
  measureCounts.area = 0
  touchMeasureRevision()
  if (measureGroup) {
    measureGroup.parent?.remove(measureGroup)
    measureGroup.traverse((obj: any) => {
      obj.geometry?.dispose?.()
      const mat = obj.material
      if (Array.isArray(mat)) mat.forEach((m: any) => m?.dispose?.())
      else {
        mat?.map?.dispose?.()
        mat?.dispose?.()
      }
    })
    measureGroup = null
  }
  requestScanRender()
}

/** 作用：删除已完成的一条测量（几何 + 徽章） */
function removeMeasurementRecord(record: MeasurementRecord) {
  record.group.parent?.remove(record.group)
  disposeMeasurementGroup(record.group)
  measureBadges.value = measureBadges.value.filter(
    (badge) => badge.id !== record.badgeId,
  )
  measurements.value = measurements.value.filter(
    (item) => item.id !== record.id,
  )
}

/** 作用：取消进行中的测距首点 */
function cancelDistanceDraft() {
  if (distanceStartGroup) {
    distanceStartGroup.parent?.remove(distanceStartGroup)
    disposeMeasurementGroup(distanceStartGroup)
    distanceStartGroup = null
  }
  distanceStart = null
  touchMeasureRevision()
  requestScanRender()
}

/** 作用：回退进行中的面积点（删除最后放置的一个点） */
function popAreaPoint() {
  if (!areaPoints.length) return
  areaPoints.pop()
  if (areaPreviewGroup) {
    const sprites = areaPreviewGroup.children.filter(
      (child) => (child as any).isSprite,
    )
    const lastSprite = sprites[sprites.length - 1]
    if (lastSprite) {
      areaPreviewGroup.remove(lastSprite)
      disposeMeasurementGroup(lastSprite)
    }
  }
  if (!areaPoints.length) {
    removeAreaPreview()
  } else {
    updateAreaPreview()
  }
  touchMeasureRevision()
  requestScanRender()
}

/** 作用：撤销上一步：优先取消进行中的点，否则删除最后一条已完成测量 */
function undoMeasurement() {
  if (analysisMode.value === 'distance' && distanceStart) {
    cancelDistanceDraft()
    return
  }
  if (analysisMode.value === 'area' && areaPoints.length) {
    popAreaPoint()
    return
  }
  const last = measurements.value[measurements.value.length - 1]
  if (!last) {
    ElMessage.info('没有可撤销的测量')
    return
  }
  removeMeasurementRecord(last)
  touchMeasureRevision()
  requestScanRender()
}

function onStagePointerDown(event: PointerEvent) {
  if (firstPersonActive.value) return
  if (analysisMode.value === 'none') return
  measurePointerDown = { x: event.clientX, y: event.clientY }
}

function onStagePointerUp(event: PointerEvent) {
  if (firstPersonActive.value) return
  if (analysisMode.value === 'none' || !measurePointerDown) return
  const dx = event.clientX - measurePointerDown.x
  const dy = event.clientY - measurePointerDown.y
  measurePointerDown = null
  if (dx * dx + dy * dy > 25) return
  const point = pickScanPoint(event.clientX, event.clientY)
  if (point) handleMeasurePoint(point)
}

function onStageDblClick() {
  closeAreaMeasurement()
}

function onMeasureKeyDown(event: KeyboardEvent) {
  const target = event.target
  const inEditable =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  if (
    event.key.toLowerCase() === 'v' &&
    !inEditable &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    event.preventDefault()
    toggleFirstPerson()
    return
  }
  if (event.key === 'Escape' && analysisMode.value !== 'none') {
    clearAnalysis()
    return
  }
  if (event.key === 'Enter' && analysisMode.value === 'area') {
    closeAreaMeasurement()
    return
  }
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === 'z' &&
    analysisMode.value !== 'none'
  ) {
    event.preventDefault()
    undoMeasurement()
  }
}

const analysisTitle = computed(() =>
  analysisMode.value === 'distance'
    ? '全局测距'
    : analysisMode.value === 'area'
      ? '面积测量'
      : '全局定位',
)
const analysisHint = computed(() => {
  if (analysisMode.value === 'distance') return '依次点击两点完成一段测距'
  if (analysisMode.value === 'area') return '连续点击至少三个点，双击闭合区域'
  return '点击任意位置拾取坐标'
})
const analysisSummary = computed(() => {
  const latest = measureBadges.value.at(-1)
  return latest ? `${latest.mainLabel} ${latest.mainValue}` : ''
})

function applyBackgroundTheme() {
  const ctx = getViewerThreeContext()
  const scene = ctx?.scene
  const renderer = ctx?.renderer as any
  const colorMap: Record<PreviewBackgroundTheme, string> = {
    deep: '#0c1224',
    light: '#e8eef6',
    black: '#000000',
    gradient: '#10213b',
  }
  const color = new THREE.Color(colorMap[backgroundTheme.value])
  if (scene) scene.background = color
  if (renderer?.setClearColor) renderer.setClearColor(color, 1)
  requestScanRender()
}

function setViewDirection(direction: [number, number, number]) {
  const camera = getViewerCamera()
  const controls = getViewerThreeContext()?.controls as any
  if (!camera || !controls?.target) return
  const target = (controls.target as THREE.Vector3).clone()
  const dir = new THREE.Vector3(...direction).normalize()
  const distance = Math.max(camera.position.distanceTo(target), scanMaxDim, 1)
  camera.up.set(0, 1, 0)
  if (Math.abs(dir.y) > 0.99) {
    camera.up.set(0, 0, dir.y > 0 ? -1 : 1)
  }
  camera.position.copy(target.clone().add(dir.multiplyScalar(distance)))
  camera.lookAt(target)
  controls.update?.()
  requestScanRender()
}

function orbitView(delta: { lon: number; lat: number }) {
  const camera = getViewerCamera()
  const controls = getViewerThreeContext()?.controls as any
  if (!camera || !controls?.target) return
  const target = (controls.target as THREE.Vector3).clone()
  const offset = camera.position.clone().sub(target)
  const spherical = new THREE.Spherical().setFromVector3(offset)
  spherical.theta -= THREE.MathUtils.degToRad(delta.lon)
  spherical.phi -= THREE.MathUtils.degToRad(delta.lat)
  spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.001, Math.PI - 0.001)
  offset.setFromSpherical(spherical)
  camera.position.copy(target.clone().add(offset))
  camera.up.set(0, 1, 0)
  camera.lookAt(target)
  controls.update?.()
  requestScanRender()
}

function rollView(direction: -1 | 1) {
  const camera = getViewerCamera()
  const controls = getViewerThreeContext()?.controls as any
  if (!camera) return
  const forward = new THREE.Vector3()
  camera.getWorldDirection(forward)
  camera.up.applyAxisAngle(forward, direction * (Math.PI / 2))
  if (controls?.target) camera.lookAt(controls.target as THREE.Vector3)
  controls?.update?.()
  requestScanRender()
}

let clipBoxState: ClipBoxState | null = null
let clipBoxHelper: THREE.Box3Helper | null = null
let clipHandlesGroup: THREE.Group | null = null
const clipHandlePickers: THREE.Object3D[] = []
const clipRaycaster = new THREE.Raycaster()
let clipBoundsRevision = 0
let boundsHelpersUpdateScheduled = false
let clipDragState: null | {
  pointerId: number
  axis: ClipAxisKey
  invert: boolean
  dragPlane: THREE.Plane
  startPoint: THREE.Vector3
  startPosition: number
  min: number
  max: number
} = null
let clipBoundDom: HTMLCanvasElement | null = null
/** 抓住剖切箭头后，屏蔽随之而来的 stage click（避免误开全景图）。 */
let ignoreNextStageClick = false

const projectId = computed(() => {
  const value = Number(route.query.projectId)
  return Number.isFinite(value) && value > 0 ? value : null
})

const fileId = computed(() => {
  const value = Number(route.params.id)
  return Number.isFinite(value) && value > 0 ? value : null
})

const fileName = computed(() => String(route.query.fileName || ''))

// ==================== 附加视图：全景图（随轨迹）/ 高斯（按上传勾选） ====================
const attachIncludePanorama = ref(false)
const attachIncludeGaussian = ref(false)
const gaussFileId = ref<number | null>(null)
const gaussAssetPath = ref('meta.lcc')
const trajectoryPoints = ref<TrajectoryPoint[]>([])
const selectedTrajectoryIndex = ref<number | null>(null)
const currentTrajectoryPoint = ref<TrajectoryPoint | null>(null)
const currentImageInfo = ref<any | null>(null)
const attachViewsLoaded = ref(false)
const panoramaOverlayVisible = ref(false)
const panoramaRef = ref<InstanceType<typeof PanoramaViewPanel> | null>(null)
const overlayRef = ref<InstanceType<typeof ScanGaussTrajectoryOverlay> | null>(
  null,
)
const trajectoryVisible = ref(true)
const gaussianVisible = ref(true)
const pointcloudVisible = ref(true)
/** 点击圆形轨迹点的默认行为：panorama=打开全景图，view=仅切换视角。 */
const trajectoryClickMode = ref<'panorama' | 'view'>('panorama')
// 未包含全景图的点云，点击轨迹点只能切换视角，自动回退到 view。
watch(attachIncludePanorama, (has) => {
  trajectoryClickMode.value = has ? 'panorama' : 'view'
})
const pointRatio = ref(100)

/** 叠加层相机位姿：完全跟随点云相机（与混合模式一致）。 */
const getOverlayCameraPose = () =>
  pointcloudViewerRef.value?.getCameraPose?.() ?? null

/**
 * 传给高斯叠加层的裁切盒（世界坐标）。高斯（LCC）支持 setClipBox，
 * 剖切时用它把高斯一起裁掉，效果与「分析」页的裁切框一致。
 */
const overlayClipBox = computed(() => {
  void clipBoxTick.value
  void clipUiPosition.value
  void activeClipAxis.value
  void activeClipInvert.value
  if (!showBounds.value) return null
  const box = getCurrentClipBox()
  if (!box || box.isEmpty()) return null
  return {
    min: box.min.toArray() as [number, number, number],
    max: box.max.toArray() as [number, number, number],
  }
})

/** 兜底：进入页面时点云/布局就绪后，再让叠加层重试加载高斯。 */
function retryOverlayGaussian() {
  void nextTick(() => {
    ;(overlayRef.value as any)?.reloadGaussian?.()
  })
}

/** 高斯资源 URL（附鉴权参数），供 LCCRender 叠加加载。 */
const gaussDataPath = computed(() => {
  if (!projectId.value || !gaussFileId.value) return ''
  const base = `${window.location.origin}${getGaussAssetUrl(
    projectId.value,
    gaussFileId.value,
    gaussAssetPath.value,
  )}`
  const token = getToken()
  const orgId = getOrganizationId()
  if (!token?.accessToken && !orgId) return base
  const url = new URL(base)
  if (token?.accessToken) {
    url.searchParams.set('token', formatToken(token.accessToken))
  }
  if (orgId) url.searchParams.set('orgId', String(orgId))
  return url.toString()
})

function trajectoryPointLabel(point: TrajectoryPoint, index: number) {
  const time = Number.isFinite(point.timestamp)
    ? new Date(point.timestamp).toLocaleTimeString('zh-CN', { hour12: false })
    : ''
  return `#${index + 1}${time ? ` · ${time}` : ''}`
}

/**
 * 选中某个轨迹控制点：切点云相机到该点位姿、加载对应全景图。
 * openPanorama=true 时把全景图叠加层铺到页面上（点击控制点时）。
 */
function onTrajectorySelect(index: number, openPanorama = false) {
  const point = trajectoryPoints.value[Number(index)]
  if (!point) return
  selectedTrajectoryIndex.value = Number(index)
  currentTrajectoryPoint.value = point
  pointcloudViewerRef.value?.syncFromTrajectory?.(point)
  if (openPanorama) panoramaOverlayVisible.value = true
  if (panoramaOverlayVisible.value) {
    // 等叠加层里的全景图组件挂载后再加载影像。
    void nextTick(() => {
      if (panoramaOverlayVisible.value && currentTrajectoryPoint.value) {
        void panoramaRef.value?.showTrajectoryImage?.(
          currentTrajectoryPoint.value,
        )
      }
    })
  }
}

/** 上一个 / 下一个轨迹点（全景图叠加层打开时可用）。 */
function stepTrajectory(delta: number) {
  const total = trajectoryPoints.value.length
  if (!total) return
  const current = selectedTrajectoryIndex.value ?? 0
  const next = (current + delta + total) % total
  onTrajectorySelect(next, true)
}

/** 在视图里点击圆形轨迹点：命中则切到该点位姿，并按当前设置决定是否打开全景图叠加层。 */
function onStageClick(event: MouseEvent) {
  if (ignoreNextStageClick) {
    ignoreNextStageClick = false
    return
  }
  if (!trajectoryVisible.value || !trajectoryPoints.value.length) return
  if (!(event.target instanceof HTMLCanvasElement)) return
  const index = overlayRef.value?.pickTrajectoryIndex?.(
    event.clientX,
    event.clientY,
  )
  if (index === null || index === undefined) return
  const openPanorama =
    trajectoryClickMode.value === 'panorama' && attachIncludePanorama.value
  onTrajectorySelect(index, openPanorama)
}

/**
 * 初始视角：等点云真正加载完成（loaded-change=true）且「附加视图」信息就绪后，
 * 固定取第一个轨迹控制点作为默认视角，保证每次打开一致、可复现；没有控制点则回退适配视图。
 * 注意：必须等 loaded，否则 syncFromTrajectory 会因点云未加载而直接返回。
 */
let initialViewApplied = false
function applyInitialView() {
  if (initialViewApplied) return
  if (!pointcloudLoadedState.value || !attachViewsLoaded.value) return
  const points = trajectoryPoints.value
  initialViewApplied = true
  if (points.length) {
    onTrajectorySelect(0)
    return
  }
  pointcloudViewerRef.value?.resetView?.()
}

function onPanoramaImageInfo(info: any) {
  currentImageInfo.value = info
}

/** 作用：读取当前点云的「全景图 / 高斯」勾选，并按需加载轨迹与解析高斯文件。 */
async function loadScanAttachViews() {
  if (!projectId.value || !fileId.value) return
  attachViewsLoaded.value = false
  initialViewApplied = false
  try {
    const [filesRes, calibrationRes] = await Promise.all([
      getProjectFilesByProjectId(projectId.value),
      getScanCalibration(projectId.value, fileId.value).catch(() => null),
    ])
    const groups = filesRes.data || []
    const allFiles = groups.flatMap((group) => group.files)
    const scan = allFiles.find((file) => file.id === fileId.value)
    attachIncludePanorama.value = Boolean(scan?.includePanorama)
    attachIncludeGaussian.value = Boolean(scan?.includeGaussian)
    if (attachIncludeGaussian.value) {
      // 优先使用「扫描↔高斯」绑定（与混合模式同一来源），否则回退到同幢同层匹配。
      const boundGaussId = calibrationRes?.data?.hasGaussBinding
        ? (calibrationRes.data.gaussFileId ?? null)
        : null
      if (boundGaussId) {
        gaussFileId.value = boundGaussId
      } else {
        const building = String(scan?.buildingName ?? '')
          .trim()
          .toLowerCase()
        const floor = String(scan?.floorName ?? '')
          .trim()
          .toLowerCase()
        const gaussFiles =
          groups.find((group) => group.type === 'gauss')?.files ?? []
        const matched =
          gaussFiles.find(
            (file) =>
              String(file.buildingName ?? '')
                .trim()
                .toLowerCase() === building &&
              String(file.floorName ?? '')
                .trim()
                .toLowerCase() === floor,
          ) ?? gaussFiles[0]
        gaussFileId.value = matched?.id ?? null
      }
      if (!gaussFileId.value) {
        console.warn('[scan-preview] 已勾选高斯但未找到绑定/匹配的高斯文件', {
          projectId: projectId.value,
          fileId: fileId.value,
        })
      }
    }
    // 轨迹/控制点与「是否勾选全景图」解耦：只要接口返回轨迹就加载，
    // 用于点云里显示圆形控制点、点击切视角、以及作为默认视角。
    const preview = await getScanPreview(projectId.value, fileId.value).catch(
      () => null,
    )
    trajectoryPoints.value = preview?.data?.trajectory?.points ?? []
    attachViewsLoaded.value = true
    retryOverlayGaussian()
    applyInitialView()
  } catch {
    attachIncludePanorama.value = false
    attachIncludeGaussian.value = false
    attachViewsLoaded.value = true
    applyInitialView()
  }
}
const clipBoundsDisabledReason = computed(() => {
  if (showBounds.value) return ''
  if (errorMessage.value) return '点云加载失败，无法启用裁切框'
  if (!pointcloudLoadedState.value || !pointcloudWorldReady.value) {
    return '请先加载点云'
  }
  if (!getContentWorldBox()) return '点云包围盒尚未准备完成'
  return ''
})
const clipBoundsTooltip = computed(() => {
  return clipBoundsDisabledReason.value || '裁切框'
})

function getViewerThreeContext() {
  return pointcloudViewerRef.value?.getThreeContext?.() ?? null
}

function getViewerScene() {
  return getViewerThreeContext()?.scene ?? null
}

function getViewerCamera() {
  const camera = getViewerThreeContext()?.camera
  return camera instanceof THREE.Camera ? camera : null
}

function getViewerRendererDom() {
  const dom = getViewerThreeContext()?.renderer?.domElement
  return dom instanceof HTMLCanvasElement ? dom : null
}

function cloneBox3(box: THREE.Box3) {
  return new THREE.Box3(box.min.clone(), box.max.clone())
}

function createDefaultClipOffsets(): ClipBoxOffsets {
  return {
    xMin: 0,
    xMax: 0,
    yMin: 0,
    yMax: 0,
    zMin: 0,
    zMax: 0,
  }
}

function getContentWorldBox() {
  return pointcloudViewerRef.value?.getPointcloudWorldBox?.() ?? null
}

function getClipOffsetKey(axis: ClipAxisKey, invert: boolean) {
  return `${axis}${invert ? 'Max' : 'Min'}` as keyof ClipBoxOffsets
}

function invalidateClipBounds() {
  clipBoundsRevision += 1
  clipBoxTick.value += 1
}

function clampClipOffsets(state: ClipBoxState) {
  ;(['x', 'y', 'z'] as ClipAxisKey[]).forEach((axis) => {
    const minKey = `${axis}Min` as keyof ClipBoxOffsets
    const maxKey = `${axis}Max` as keyof ClipBoxOffsets
    const span = Math.max(0, state.baseBox.max[axis] - state.baseBox.min[axis])
    state.offsets[minKey] = THREE.MathUtils.clamp(
      state.offsets[minKey],
      0,
      span,
    )
    state.offsets[maxKey] = THREE.MathUtils.clamp(
      state.offsets[maxKey],
      0,
      span,
    )
    if (state.offsets[minKey] + state.offsets[maxKey] > span) {
      state.offsets[maxKey] = Math.max(0, span - state.offsets[minKey])
    }
  })
}

function ensureClipState() {
  const baseBox = getContentWorldBox()
  if (!baseBox) {
    clipBoxState = null
    return null
  }
  if (clipBoxState && clipBoxState.revision === clipBoundsRevision) {
    return clipBoxState
  }
  if (clipBoxState) {
    clipBoxState.baseBox.copy(baseBox)
    clipBoxState.revision = clipBoundsRevision
    clampClipOffsets(clipBoxState)
    return clipBoxState
  }
  clipBoxState = {
    baseBox: cloneBox3(baseBox),
    offsets: createDefaultClipOffsets(),
    revision: clipBoundsRevision,
  }
  return clipBoxState
}

function getClipBoxFromState(state: ClipBoxState) {
  const box = cloneBox3(state.baseBox)
  box.min.x += state.offsets.xMin
  box.max.x -= state.offsets.xMax
  box.min.y += state.offsets.yMin
  box.max.y -= state.offsets.yMax
  box.min.z += state.offsets.zMin
  box.max.z -= state.offsets.zMax
  return box
}

function getCurrentClipBox() {
  const state = ensureClipState()
  return state ? getClipBoxFromState(state) : null
}

function getClipFacePosition(axis: ClipAxisKey, invert: boolean) {
  const box = getCurrentClipBox()
  if (!box) return 0
  return invert ? box.max[axis] : box.min[axis]
}

function getClipFaceRange(axis: ClipAxisKey, invert: boolean) {
  const state = ensureClipState()
  const box = state ? getClipBoxFromState(state) : null
  if (!state || !box) return { min: 0, max: 1 }
  return invert
    ? { min: box.min[axis], max: state.baseBox.max[axis] }
    : { min: state.baseBox.min[axis], max: box.max[axis] }
}

function setClipFacePosition(
  axis: ClipAxisKey,
  invert: boolean,
  value: number,
) {
  const state = ensureClipState()
  if (!state) return
  const currentBox = getClipBoxFromState(state)
  const baseMin = state.baseBox.min[axis]
  const baseMax = state.baseBox.max[axis]
  const minLimit = invert ? currentBox.min[axis] : baseMin
  const maxLimit = invert ? baseMax : currentBox.max[axis]
  const clamped = THREE.MathUtils.clamp(value, minLimit, maxLimit)
  const key = getClipOffsetKey(axis, invert)
  if (invert) state.offsets[key] = baseMax - clamped
  else state.offsets[key] = clamped - baseMin
  clampClipOffsets(state)
}

/** 把当前剖切面的范围/位置同步到面板控件。 */
function syncClipUi() {
  if (!showBounds.value) return
  clipUiRange.value = getClipFaceRange(
    activeClipAxis.value,
    activeClipInvert.value,
  )
  clipUiPosition.value = getClipFacePosition(
    activeClipAxis.value,
    activeClipInvert.value,
  )
}

function onClipAxisChange(axis: ClipAxisKey) {
  if (activeClipAxis.value === axis) return
  activeClipAxis.value = axis
  syncClipUi()
  updateBoundsHelpers()
  applyClippingState()
}

function toggleClipInvert() {
  activeClipInvert.value = !activeClipInvert.value
  syncClipUi()
  updateBoundsHelpers()
  applyClippingState()
}

function onClipSliderInput() {
  setClipFacePosition(
    activeClipAxis.value,
    activeClipInvert.value,
    clipUiPosition.value,
  )
  applyClippingState()
  scheduleBoundsHelpersUpdate()
}

function requestPointcloudRender() {
  const activeBox = showBounds.value ? getCurrentClipBox() : null
  pointcloudViewerRef.value?.setClipBox?.(activeBox)
}

function clearBoundsHelpers() {
  const scene = getViewerScene()
  if (clipBoxHelper) {
    scene?.remove(clipBoxHelper)
    clipBoxHelper.geometry?.dispose?.()
    ;(clipBoxHelper.material as any)?.dispose?.()
    clipBoxHelper = null
  }
  if (clipHandlesGroup) {
    scene?.remove(clipHandlesGroup)
    clipHandlesGroup.traverse?.((obj: any) => {
      obj.geometry?.dispose?.()
      obj.material?.dispose?.()
    })
    clipHandlesGroup = null
  }
  clipHandlePickers.length = 0
}

function buildClipHandles(box: THREE.Box3) {
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z, 1)
  const offset = Math.max(maxDim * 0.06, 0.12)
  const handleLength = Math.max(maxDim * 0.12, 0.22)
  const shaftLength = handleLength * 0.62
  const coneHeight = handleLength - shaftLength
  const shaftRadius = Math.max(maxDim * 0.006, 0.012)
  const coneRadius = shaftRadius * 2.2
  const hitRadius = Math.max(shaftRadius * 5, 0.06)
  const activeColor = new THREE.Color('#ffd04b')
  const idleColor = new THREE.Color('#409eff')
  const baseAxis = new THREE.Vector3(0, 1, 0)
  const group = new THREE.Group()
  const faces: Array<{
    axis: ClipAxisKey
    invert: boolean
    normal: THREE.Vector3
    arrowDir: THREE.Vector3
    anchor: THREE.Vector3
  }> = [
    {
      axis: 'x',
      invert: false,
      normal: new THREE.Vector3(-1, 0, 0),
      arrowDir: new THREE.Vector3(-1, 0, 0),
      anchor: new THREE.Vector3(box.min.x, center.y, center.z),
    },
    {
      axis: 'x',
      invert: true,
      normal: new THREE.Vector3(1, 0, 0),
      arrowDir: new THREE.Vector3(1, 0, 0),
      anchor: new THREE.Vector3(box.max.x, center.y, center.z),
    },
    {
      axis: 'y',
      invert: false,
      normal: new THREE.Vector3(0, -1, 0),
      arrowDir: new THREE.Vector3(0, -1, 0),
      anchor: new THREE.Vector3(center.x, box.min.y, center.z),
    },
    {
      axis: 'y',
      invert: true,
      normal: new THREE.Vector3(0, 1, 0),
      arrowDir: new THREE.Vector3(0, 1, 0),
      anchor: new THREE.Vector3(center.x, box.max.y, center.z),
    },
    {
      axis: 'z',
      invert: false,
      normal: new THREE.Vector3(0, 0, -1),
      arrowDir: new THREE.Vector3(0, 0, -1),
      anchor: new THREE.Vector3(center.x, center.y, box.min.z),
    },
    {
      axis: 'z',
      invert: true,
      normal: new THREE.Vector3(0, 0, 1),
      arrowDir: new THREE.Vector3(0, 0, 1),
      anchor: new THREE.Vector3(center.x, center.y, box.max.z),
    },
  ]

  for (const face of faces) {
    const handle = new THREE.Group()
    const isActiveFace =
      face.axis === activeClipAxis.value &&
      face.invert === activeClipInvert.value
    const color = isActiveFace ? activeColor : idleColor

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 12),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: isActiveFace ? 0.95 : 0.82,
        depthTest: false,
        depthWrite: false,
      }),
    )
    shaft.position.y = shaftLength * 0.5

    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(coneRadius, coneHeight, 16),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: isActiveFace ? 1 : 0.9,
        depthTest: false,
        depthWrite: false,
      }),
    )
    cone.position.y = shaftLength + coneHeight * 0.5

    const hitArea = new THREE.Mesh(
      new THREE.CylinderGeometry(hitRadius, hitRadius, handleLength, 10),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      }),
    )
    hitArea.position.y = handleLength * 0.5
    hitArea.userData = {
      __viewerClipHandle: true,
      axis: face.axis,
      invert: face.invert,
    }

    handle.add(shaft)
    handle.add(cone)
    handle.add(hitArea)
    handle.position
      .copy(face.anchor)
      .add(face.normal.clone().multiplyScalar(offset))
    handle.quaternion.setFromUnitVectors(baseAxis, face.arrowDir)
    handle.renderOrder = 10000
    handle.traverse?.((obj: any) => {
      obj.renderOrder = 10000
    })
    group.add(handle)
    clipHandlePickers.push(hitArea)
  }

  return group
}

function updateBoundsHelpers() {
  const scene = getViewerScene()
  if (!scene) return
  clearBoundsHelpers()
  if (!showBounds.value) {
    requestPointcloudRender()
    return
  }

  const helperBox = getCurrentClipBox()
  if (!helperBox || helperBox.isEmpty()) {
    requestPointcloudRender()
    return
  }

  clipBoxHelper = new THREE.Box3Helper(
    helperBox.clone(),
    new THREE.Color('#ffcf4a'),
  )
  clipBoxHelper.renderOrder = 9999
  ;(clipBoxHelper.material as any).depthTest = false
  clipBoxHelper.userData = {
    __viewerBoundsHelper: true,
  }
  scene.add(clipBoxHelper)

  clipHandlesGroup = buildClipHandles(helperBox)
  scene.add(clipHandlesGroup)
  requestPointcloudRender()
}

function scheduleBoundsHelpersUpdate() {
  if (boundsHelpersUpdateScheduled) return
  boundsHelpersUpdateScheduled = true
  requestAnimationFrame(() => {
    boundsHelpersUpdateScheduled = false
    updateBoundsHelpers()
    syncClipUi()
  })
}

function applyClippingState() {
  requestPointcloudRender()
}

function onShowBoundsChange() {
  if (showBounds.value) {
    if (!getContentWorldBox()) {
      showBounds.value = false
      return
    }
    invalidateClipBounds()
    ensureClipState()
  } else {
    clipBoxState = null
  }
  updateBoundsHelpers()
  syncClipUi()
  applyClippingState()
}

function onBoundsButtonClick() {
  if (showBounds.value) {
    showBounds.value = false
    onShowBoundsChange()
    return
  }
  if (clipBoundsDisabledReason.value) {
    ElMessage.warning(clipBoundsDisabledReason.value)
    return
  }
  showBounds.value = true
  onShowBoundsChange()
}

function getPointerNdc(ev: PointerEvent) {
  const rect = getViewerRendererDom()?.getBoundingClientRect?.()
  if (!rect) return null
  return new THREE.Vector2(
    ((ev.clientX - rect.left) / rect.width) * 2 - 1,
    -(((ev.clientY - rect.top) / rect.height) * 2 - 1),
  )
}

function consumePointerEvent(ev: PointerEvent) {
  ev.preventDefault()
  ev.stopPropagation()
  ;(ev as any).stopImmediatePropagation?.()
}

function pickClipOverlay(
  ev: PointerEvent,
):
  | null
  | { kind: 'handle'; axis: ClipAxisKey; invert: boolean }
  | { kind: 'bounds' } {
  if (!showBounds.value) return null
  // 裁切箭头画在高斯叠加层（独立渲染器，不被全局裁切面裁掉），由其负责拾取。
  const hit = (overlayRef.value as any)?.pickClipHandle?.(
    ev.clientX,
    ev.clientY,
  ) as { axis: ClipAxisKey; invert: boolean } | null
  if (hit) return { kind: 'handle', axis: hit.axis, invert: !!hit.invert }
  return null
}

function buildClipDragPlane(axisKey: ClipAxisKey, anchor: THREE.Vector3) {
  const axis =
    axisKey === 'x'
      ? new THREE.Vector3(1, 0, 0)
      : axisKey === 'y'
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1)
  const camera = getViewerCamera()
  const cameraDir = new THREE.Vector3()
  camera?.getWorldDirection?.(cameraDir)
  let normal = cameraDir.sub(axis.clone().multiplyScalar(cameraDir.dot(axis)))
  if (normal.lengthSq() < 1e-6) normal = new THREE.Vector3(0, 1, 0).cross(axis)
  if (normal.lengthSq() < 1e-6) normal = new THREE.Vector3(0, 0, 1).cross(axis)
  normal.normalize()
  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, anchor)
}

function beginClipDrag(
  ev: PointerEvent,
  options: { axis: ClipAxisKey; invert: boolean },
) {
  const camera = getViewerCamera()
  const dom = getViewerRendererDom()
  if (!camera || !dom) return

  activeClipAxis.value = options.axis
  activeClipInvert.value = options.invert
  updateBoundsHelpers()

  const ndc = getPointerNdc(ev)
  const box = getCurrentClipBox()
  if (!ndc || !box) return
  clipRaycaster.setFromCamera(ndc, camera)

  const anchor = new THREE.Vector3()
  anchor[options.axis] = getClipFacePosition(options.axis, options.invert)
  const center = box.getCenter(new THREE.Vector3())
  if (options.axis === 'x') {
    anchor.y = center.y
    anchor.z = center.z
  } else if (options.axis === 'y') {
    anchor.x = center.x
    anchor.z = center.z
  } else {
    anchor.x = center.x
    anchor.y = center.y
  }

  const dragPlane = buildClipDragPlane(options.axis, anchor)
  const startPoint = new THREE.Vector3()
  if (!clipRaycaster.ray.intersectPlane(dragPlane, startPoint)) return

  const range = getClipFaceRange(options.axis, options.invert)
  clipDragState = {
    pointerId: ev.pointerId,
    axis: options.axis,
    invert: options.invert,
    dragPlane,
    startPoint,
    startPosition: getClipFacePosition(options.axis, options.invert),
    min: range.min,
    max: range.max,
  }
  dom.setPointerCapture?.(ev.pointerId)
  pointcloudViewerRef.value?.setControlsEnabled?.(false)
}

function onClipDragMove(ev: PointerEvent) {
  const camera = getViewerCamera()
  if (!clipDragState || !camera) return
  const ndc = getPointerNdc(ev)
  if (!ndc) return
  clipRaycaster.setFromCamera(ndc, camera)
  const point = new THREE.Vector3()
  if (!clipRaycaster.ray.intersectPlane(clipDragState.dragPlane, point)) return

  const axisVec =
    clipDragState.axis === 'x'
      ? new THREE.Vector3(1, 0, 0)
      : clipDragState.axis === 'y'
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1)
  const delta = point.clone().sub(clipDragState.startPoint).dot(axisVec)
  const nextPosition = THREE.MathUtils.clamp(
    clipDragState.startPosition + delta,
    clipDragState.min,
    clipDragState.max,
  )
  setClipFacePosition(clipDragState.axis, clipDragState.invert, nextPosition)
  activeClipAxis.value = clipDragState.axis
  activeClipInvert.value = clipDragState.invert
  applyClippingState()
  scheduleBoundsHelpersUpdate()
}

function endClipDrag(ev?: PointerEvent) {
  const dom = getViewerRendererDom()
  if (clipDragState && dom && ev) {
    try {
      dom.releasePointerCapture?.(clipDragState.pointerId)
    } catch {
      // ignore pointer capture release errors
    }
  }
  clipDragState = null
  pointcloudViewerRef.value?.setControlsEnabled?.(true)
}

function onViewerPointerDown(event: PointerEvent) {
  const overlayHit = pickClipOverlay(event)
  if (overlayHit?.kind === 'handle') {
    consumePointerEvent(event)
    ignoreNextStageClick = true
    beginClipDrag(event, overlayHit)
    return
  }
  if (overlayHit?.kind === 'bounds') {
    consumePointerEvent(event)
  }
}

function onViewerPointerMove(event: PointerEvent) {
  if (!clipDragState) return
  consumePointerEvent(event)
  onClipDragMove(event)
}

function onViewerPointerUp(event: PointerEvent) {
  if (!clipDragState) return
  consumePointerEvent(event)
  endClipDrag(event)
}

function bindClipInteractions() {
  const dom = getViewerRendererDom()
  if (!dom || clipBoundDom === dom) return
  unbindClipInteractions()
  dom.addEventListener('pointerdown', onViewerPointerDown, true)
  dom.addEventListener('pointermove', onViewerPointerMove, true)
  dom.addEventListener('pointerup', onViewerPointerUp, true)
  dom.addEventListener('pointercancel', onViewerPointerUp, true)
  clipBoundDom = dom
}

function unbindClipInteractions() {
  if (!clipBoundDom) return
  clipBoundDom.removeEventListener('pointerdown', onViewerPointerDown, true)
  clipBoundDom.removeEventListener('pointermove', onViewerPointerMove, true)
  clipBoundDom.removeEventListener('pointerup', onViewerPointerUp, true)
  clipBoundDom.removeEventListener('pointercancel', onViewerPointerUp, true)
  clipBoundDom = null
}

function syncScanThreeControls() {
  bindClipInteractions()
  if (showBounds.value) {
    invalidateClipBounds()
    onShowBoundsChange()
    return
  }
  clearBoundsHelpers()
  pointcloudViewerRef.value?.setClipBox?.(null)
}

function handlePointcloudLoadedChange(loaded: boolean) {
  stopLoadingWatch()
  pointcloudLoadedState.value = loaded
  if (!loaded) {
    pointcloudWorldReady.value = false
    invalidateClipBounds()
    if (showBounds.value) {
      showBounds.value = false
    }
    clipBoxState = null
    clearBoundsHelpers()
    pointcloudViewerRef.value?.setClipBox?.(null)
    return
  }
  syncScanThreeControls()
}

function handlePointcloudWorldReady() {
  pointcloudWorldReady.value = true
  invalidateClipBounds()
  syncScanThreeControls()
  viewerCamera.value = getViewerCamera()
  const box = getContentWorldBox()
  if (box) {
    const size = box.getSize(new THREE.Vector3())
    scanMaxDim = Math.max(size.x, size.y, size.z) || 10
  }
  applyBackgroundTheme()
  pointcloudViewerRef.value?.setPointSize?.(pointSize.value)
  pointcloudViewerRef.value?.setShowGrid?.(showGrid.value)
  pointcloudViewerRef.value?.setEdlEnabled?.(edlEnabled.value)
  applyColorMode()
  scheduleColorAvailabilityRefresh()
  // 与参考页一致：点云 LOD errorTarget = 32
  pointcloudViewerRef.value?.setTilesErrorTargetOverride?.(32)
  pointcloudViewerRef.value?.setPointRatio?.(
    Math.max(1, Math.min(100, Number(pointRatio.value) || 100)) / 100,
  )
  retryOverlayGaussian()
  applyInitialView()
}

/** 把当前着色模式/色带/范围下发给渲染器 */
const applyColorMode = () => {
  pointcloudViewerRef.value?.setColorMode?.(
    colorMode.value,
    colorRamp.value,
    colorRange.value,
  )
}

/** 刷新“强度/台面分色”是否可用（依赖 tiles 的 INTENSITY/CLASSIFICATION 属性） */
const refreshColorAvailability = () => {
  const viewer = pointcloudViewerRef.value
  const availability = viewer?.getColorAvailability?.()
  colorHasIntensity.value = availability?.intensity ?? false
  colorHasClass.value = availability?.tableClass ?? false
  const range = viewer?.getColorRange?.()
  if (range && Number.isFinite(range[0]) && Number.isFinite(range[1])) {
    colorRange.value = range
  }
  intensityHistogram.value = viewer?.getIntensityHistogram?.(96) ?? []
}

let colorAvailabilityTimers: number[] = []
const clearColorAvailabilityTimers = () => {
  colorAvailabilityTimers.forEach((timer) => clearTimeout(timer))
  colorAvailabilityTimers = []
}
const scheduleColorAvailabilityRefresh = () => {
  clearColorAvailabilityTimers()
  ;[600, 1600, 3200].forEach((delay) => {
    colorAvailabilityTimers.push(
      window.setTimeout(refreshColorAvailability, delay),
    )
  })
}

const waitForViewerReady = async () => {
  for (let i = 0; i < 30; i += 1) {
    const viewer = pointcloudViewerRef.value
    if (viewer?.$el?.isConnected) {
      return viewer
    }
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
  return pointcloudViewerRef.value
}

function stopLoadingWatch() {
  if (loadingHintTimer) {
    clearTimeout(loadingHintTimer)
    loadingHintTimer = null
  }
  showLoadingHint.value = false
}

function startLoadingWatch() {
  stopLoadingWatch()
  loadingHintTimer = setTimeout(() => {
    showLoadingHint.value = true
  }, 6000)
}

/** 作用：把底层错误转换为可诊断、可操作的用户提示，同时保留原始细节。 */
function formatPreviewError(error: unknown): string {
  const raw = String(
    (error as { message?: unknown })?.message ?? error ?? '',
  ).trim()
  const lower = raw.toLowerCase()
  const detail = raw ? `（${raw}）` : ''
  if (/failed to fetch|networkerror|load failed|net::err/.test(lower)) {
    return `网络异常，点云数据加载失败。请检查网络或服务是否可用后重试。${detail}`
  }
  if (/\b404\b|not found|tileset\.json/.test(lower)) {
    return `未找到该点云数据（tileset.json）。文件可能已被删除或尚未处理完成。${detail}`
  }
  if (/webgl|gpu|context lost|out of memory/.test(lower)) {
    return `显卡或 WebGL 初始化失败，建议关闭其他占用显存的页面后重试。${detail}`
  }
  return raw || '点云加载失败，请稍后重试。'
}

const loadPreview = async () => {
  const token = ++loadToken.value
  errorMessage.value = ''
  pointcloudLoadedState.value = false
  pointcloudWorldReady.value = false
  invalidateClipBounds()
  clipBoxState = null

  if (!projectId.value) {
    errorMessage.value = '缺少项目ID，无法预览点云'
    return
  }

  if (!fileId.value) {
    errorMessage.value = '缺少文件ID，无法预览点云'
    return
  }

  const viewer = await waitForViewerReady()
  if (token !== loadToken.value) return

  if (!viewer) {
    errorMessage.value = '点云预览组件初始化失败'
    return
  }

  viewer.setStatusText?.('自动加载点云中...')
  startLoadingWatch()

  try {
    await viewer.loadPointcloudByScanId(projectId.value, fileId.value)
  } catch (error: unknown) {
    if (token !== loadToken.value) return
    stopLoadingWatch()
    errorMessage.value = formatPreviewError(error)
    pointcloudLoadedState.value = false
    pointcloudWorldReady.value = false
    invalidateClipBounds()
    clearBoundsHelpers()
    pointcloudViewerRef.value?.setClipBox?.(null)
  }
}

const resetView = () => {
  pointcloudViewerRef.value?.resetView?.()
}

/** 重置视角：聚焦当前（或第一个）轨迹点视角；无轨迹时回退到整体适配视图。 */
const resetToTrajectoryView = () => {
  if (firstPersonActive.value) {
    pointcloudViewerRef.value?.exitFirstPersonMode?.()
  }
  const points = trajectoryPoints.value
  if (points.length) {
    const current = selectedTrajectoryIndex.value
    const index =
      typeof current === 'number' && current >= 0 && current < points.length
        ? current
        : 0
    onTrajectorySelect(index)
    return
  }
  pointcloudViewerRef.value?.resetView?.()
}

const toggleFullscreen = async () => {
  const root = document.documentElement
  if (!document.fullscreenElement) {
    await root.requestFullscreen?.()
    return
  }
  await document.exitFullscreen?.()
}

const handleClose = () => {
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.push('/data/history-model')
}

watch(
  () => [route.params.id, route.query.projectId],
  () => {
    if (route.name !== 'PreviewScan') return
    void loadPreview()
    void loadScanAttachViews()
  },
)

watch(backgroundTheme, () => applyBackgroundTheme())

// 点云加载完成后套用初始视角（也可能在 loadScanAttachViews 里提前触发）。
watch(pointcloudLoadedState, (loaded) => {
  if (loaded) applyInitialView()
})

watch(showGrid, (value) => pointcloudViewerRef.value?.setShowGrid?.(value))
watch(pointSize, (value) => pointcloudViewerRef.value?.setPointSize?.(value))
watch(pointRatio, (value) => {
  const ratio = Math.max(1, Math.min(100, Number(value) || 100)) / 100
  pointcloudViewerRef.value?.setPointRatio?.(ratio)
})
watch(edlEnabled, (value) => pointcloudViewerRef.value?.setEdlEnabled?.(value))
watch([colorMode, colorRamp], () => {
  applyColorMode()
  if (colorMode.value === 'intensity') refreshColorAvailability()
})
watch(analysisMode, (mode) => {
  const dom = getViewerRendererDom()
  if (dom) dom.style.cursor = mode === 'none' ? '' : 'crosshair'
})

function syncFullscreenState() {
  isFullscreen.value = !!document.fullscreenElement
}

onMounted(() => {
  void loadPreview()
  void loadScanAttachViews()
  const stage = stageRef.value
  stage?.addEventListener('pointerdown', onStagePointerDown)
  stage?.addEventListener('pointerup', onStagePointerUp)
  stage?.addEventListener('dblclick', onStageDblClick)
  document.addEventListener('fullscreenchange', syncFullscreenState)
  document.addEventListener('keydown', onMeasureKeyDown)

  const loop = () => {
    labelRaf = requestAnimationFrame(loop)
    if (measureBadges.value.length) updateMeasureBadges()
    if (measureGroup) syncMeasureVisuals()
  }
  loop()
})

onBeforeUnmount(() => {
  loadToken.value += 1
  cancelAnimationFrame(labelRaf)
  stopLoadingWatch()
  const stage = stageRef.value
  stage?.removeEventListener('pointerdown', onStagePointerDown)
  stage?.removeEventListener('pointerup', onStagePointerUp)
  stage?.removeEventListener('dblclick', onStageDblClick)
  document.removeEventListener('fullscreenchange', syncFullscreenState)
  document.removeEventListener('keydown', onMeasureKeyDown)
  clearAnalysis()
  unbindClipInteractions()
  clearBoundsHelpers()
  clearColorAvailabilityTimers()
  pointcloudViewerRef.value?.setClipBox?.(null)
  pointcloudViewerRef.value?.cleanup?.()
})
</script>

<style lang="scss" scoped>
@media (width <= 900px) {
  .pc-header {
    padding-left: 14px;
  }

  .pc-header-tools {
    gap: 0;
  }

  .pc-icon-btn {
    width: 30px;
    height: 30px;
  }

  .pc-tool-divider {
    margin: 0 3px;
  }
}

.pointcloud-preview-page {
  --viewer-stage: #0c1224;
  --viewer-chrome: rgb(12 18 36 / 88%);
  --viewer-ink: #e8ecf8;
  --viewer-muted: #9aa8c7;
  --viewer-accent: #9ec1ff;

  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--viewer-stage);
}

.pc-header {
  position: relative;
  z-index: 100;
  display: flex;
  flex: 0 0 64px;
  gap: var(--spacing-md);
  align-items: center;
  padding: 8px 64px 8px 20px;
  background: #e6ebf5;
  border-bottom: 1px solid #cfd7e8;
}

.pc-heading {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.pc-heading strong,
.pc-heading small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pc-heading strong {
  font-size: var(--font-size-sm);
  color: #1a1d24;
}

.pc-heading small {
  margin-top: 2px;
  font-size: var(--font-size-xs);
  color: #6b7280;
}

.pc-header-tools {
  display: flex;
  flex: 0 0 auto;
  gap: 2px;
  align-items: center;
}

.pc-tool-divider {
  width: 1px;
  height: 20px;
  margin: 0 6px;
  background: #cfd7e8;
}

.pc-icon-btn:focus-visible,
.pc-close:focus-visible,
.pc-clip-bar button:focus-visible,
.pc-clip-bar input:focus-visible,
.pc-analysis-toolbar button:focus-visible,
.pc-panorama-close:focus-visible,
.pc-panorama-nav:focus-visible,
.pc-int-axis__reset:focus-visible {
  outline: 2px solid #6b83ff;
  outline-offset: 2px;
}

.pc-icon-btn {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  color: #4b5563;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  transition:
    color 0.15s ease,
    background 0.15s ease,
    border-color 0.15s ease;
}

.pc-icon-btn:hover {
  color: #4e66cc;
  background: rgb(255 255 255 / 80%);
  border-color: #cfd7e8;
}

.pc-icon-btn.is-active {
  color: #fff;
  background: #4e66cc;
  border-color: #4e66cc;
  box-shadow: 0 2px 6px rgb(78 102 204 / 35%);
}

.pc-icon-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.pc-icon-btn:disabled:hover {
  color: #4b5563;
  background: transparent;
  border-color: transparent;
}

.pc-icon-glyph {
  display: inline-block;
  width: 19px;
  height: 19px;
  background-color: currentcolor;
  mask-image: var(--glyph);
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
}

.pc-close {
  position: absolute;
  top: 16px;
  right: 18px;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  color: #6b7280;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--radius-xs);
}

.pc-close:hover {
  color: #4e66cc;
  background: rgb(255 255 255 / 60%);
}

.pc-stage {
  position: relative;
  flex: 1;
  min-height: 320px;
  overflow: hidden;
  background: var(--viewer-stage);
}

.pc-stage.theme-deep {
  background: #0c1224;
}

.pc-stage.theme-black {
  background: #000;
}

.pc-stage.theme-light {
  background: #e8eef6;
}

.pc-stage.theme-gradient {
  background: #10213b;
}

.pc-viewer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.pc-viewer :deep(.pointcloud-view-panel),
.pc-viewer :deep(.pointcloud-viewport) {
  width: 100%;
  height: 100%;
}

.pc-gauss-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
}

.pc-axes-triad {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 25;
  pointer-events: none;
}

.pc-view-cube {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 60;
}

/* 底部强度颜色轴：直方图 + 色带（对齐 cloudBIM-viewer） */
.pc-int-axis {
  position: absolute;
  right: 20px;
  bottom: 14px;
  left: 176px;
  z-index: 26;
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px 12px;
  background: rgb(22 25 32 / 82%);
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 12px;
  backdrop-filter: blur(8px);
}

.pc-int-axis__reset {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  color: rgb(255 255 255 / 72%);
  cursor: pointer;
  background: rgb(255 255 255 / 8%);
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 6px;
}

.pc-int-axis__reset:hover {
  color: #fff;
  background: rgb(255 255 255 / 16%);
}

.pc-int-axis__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.pc-int-axis__hist {
  position: relative;
  height: 22px;
}

.pc-int-axis__hist svg {
  display: block;
  width: 100%;
  height: 100%;
}

.pc-int-axis__area {
  fill: rgb(255 255 255 / 42%);
  stroke: rgb(255 255 255 / 75%);
  stroke-width: 0.6;
  vector-effect: non-scaling-stroke;
}

.pc-int-axis__pct {
  position: absolute;
  top: -3px;
  right: 0;
  font-size: var(--font-size-xs);
  color: rgb(255 255 255 / 55%);
}

.pc-int-axis__barrow {
  display: flex;
  gap: 8px;
  align-items: center;
}

.pc-int-axis__bar {
  flex: 1;
  height: 14px;
  border-radius: 3px;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 18%);
}

.pc-int-axis__label {
  min-width: 34px;
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
  color: rgb(255 255 255 / 82%);
  text-align: center;
}

.pc-analysis-toolbar {
  position: absolute;
  top: 18px;
  left: 50%;
  z-index: 82;
  display: flex;
  gap: 12px;
  align-items: center;
  max-width: calc(100% - 32px);
  min-height: 42px;
  padding: 8px 10px 8px 14px;
  color: #f8fafc;
  white-space: nowrap;
  background: rgb(8 17 29 / 86%);
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: var(--radius-sm);
  box-shadow: 0 12px 30px rgb(0 0 0 / 24%);
  backdrop-filter: blur(14px);
  transform: translateX(-50%);
}

.pc-analysis-toolbar strong {
  font-size: var(--font-size-sm);
}

.pc-analysis-hint,
.pc-analysis-exit {
  font-size: var(--font-size-xs);
  color: rgb(226 232 240 / 78%);
}

.pc-analysis-value {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: #fca5a5;
}

.pc-analysis-toolbar button {
  padding: 4px 9px;
  font-size: var(--font-size-xs);
  color: #fecaca;
  cursor: pointer;
  background: transparent;
  border: 1px solid rgb(248 113 113 / 40%);
  border-radius: var(--radius-xs);
}

.pc-analysis-toolbar button:hover {
  background: rgb(248 113 113 / 16%);
}

/* 剖切面板 */
.pc-clip-bar {
  position: absolute;
  bottom: 18px;
  left: 50%;
  z-index: 82;
  display: flex;
  gap: 10px;
  align-items: center;
  height: 42px;
  padding: 0 12px;
  color: #f8fafc;
  white-space: nowrap;
  background: rgb(8 17 29 / 88%);
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 999px;
  box-shadow: 0 12px 30px rgb(0 0 0 / 28%);
  backdrop-filter: blur(14px);
  transform: translateX(-50%);
}

.pc-clip-bar__title {
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.pc-clip-bar__axes {
  display: inline-flex;
  padding: 2px;
  background: rgb(255 255 255 / 10%);
  border-radius: 8px;
}

.pc-clip-bar__axes button {
  min-width: 28px;
  padding: 3px 6px;
  font-size: var(--font-size-xs);
  color: rgb(226 232 240 / 78%);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 6px;
}

.pc-clip-bar__axes button.on {
  font-weight: 700;
  color: #fff;
  background: #4e66cc;
}

.pc-clip-bar__flip {
  padding: 4px 9px;
  font-size: var(--font-size-xs);
  color: #cbd5e1;
  cursor: pointer;
  background: transparent;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 6px;
}

.pc-clip-bar__flip.on {
  color: #fff;
  background: rgb(78 102 204 / 70%);
  border-color: rgb(115 162 243 / 60%);
}

.pc-clip-bar__slider {
  width: 180px;
  height: 4px;
  accent-color: var(--viewer-accent);
  cursor: pointer;
}

.pc-clip-bar__value {
  min-width: 34px;
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
  color: #cbd5e1;
  text-align: right;
}

.pc-clip-bar__close {
  padding: 4px 9px;
  font-size: var(--font-size-xs);
  color: #f8fafc;
  cursor: pointer;
  background: rgb(255 255 255 / 12%);
  border: 0;
  border-radius: 6px;
}

.pc-clip-bar__close:hover {
  background: rgb(255 255 255 / 22%);
}

.pc-measure-badges {
  position: absolute;
  inset: 0;
  z-index: 40;
  pointer-events: none;
}

.pc-measure-badge {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 168px;
  max-width: 220px;
  padding: 10px 12px 8px;
  color: rgb(255 255 255 / 90%);
  pointer-events: none;
  user-select: none;
  background: rgb(8 18 42 / 78%);
  border: 1px solid rgb(115 162 243 / 22%);
  border-radius: var(--radius-sm);
  box-shadow:
    0 12px 28px rgb(4 10 34 / 30%),
    inset 0 1px 0 rgb(255 255 255 / 6%);
  backdrop-filter: blur(14px) saturate(120%);
}

.pc-measure-badge header {
  display: flex;
  gap: 8px;
  align-items: center;
  min-height: 18px;
  pointer-events: auto;
  cursor: grab;
}

.pc-measure-badge header:active {
  cursor: grabbing;
}

.pc-measure-badge__dots {
  width: 16px;
  height: 10px;
  background-image: radial-gradient(
    circle,
    rgb(151 186 255 / 78%) 1px,
    transparent 1.5px
  );
  background-size: 5px 5px;
  opacity: 0.62;
}

.pc-measure-badge__title {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: rgb(255 255 255 / 68%);
}

.pc-measure-badge__main {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.pc-measure-badge__main span {
  font-size: 10px;
  font-weight: 600;
  color: rgb(145 181 255 / 94%);
}

.pc-measure-badge__main strong {
  font-size: 18px;
  line-height: 1.15;
  color: #fff;
  text-shadow: 0 0 14px rgb(78 102 204 / 28%);
}

.pc-measure-badge__rows {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.pc-measure-badge__rows > div {
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.pc-measure-badge__rows span:first-child {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: rgb(161 191 250 / 88%);
}

.pc-measure-badge__rows span:last-child {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: rgb(255 255 255 / 94%);
  text-align: right;
}

.pc-fp-controls {
  position: absolute;
  right: 16px;
  bottom: 18px;
  z-index: 82;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-end;
  user-select: none;
}

.pc-fp-hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: rgb(226 232 240 / 72%);
  text-shadow: 0 1px 4px rgb(0 0 0 / 55%);
}

.pc-fp-pad {
  display: grid;
  grid-template-areas:
    '. up .'
    'left . right'
    '. down .';
  gap: 8px;
}

.pc-fp-key {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  color: rgb(255 255 255 / 86%);
  cursor: pointer;
  background: rgb(8 17 29 / 78%);
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: var(--radius-sm);
  backdrop-filter: blur(10px);
  transition:
    color 0.15s ease,
    background 0.15s ease,
    border-color 0.15s ease,
    transform 0.1s ease;
}

.pc-fp-key:hover {
  color: #fff;
  background: #4e66cc;
  border-color: #4e66cc;
}

.pc-fp-key:active {
  transform: scale(0.94);
}

.pc-fp-key:focus-visible,
.pc-fp-collision:focus-visible {
  outline: 2px solid #6b83ff;
  outline-offset: 2px;
}

.pc-fp-key.is-up {
  grid-area: up;
}

.pc-fp-key.is-down {
  grid-area: down;
}

.pc-fp-key.is-left {
  grid-area: left;
}

.pc-fp-key.is-right {
  grid-area: right;
}

.pc-fp-collision {
  padding: 6px 12px;
  font-size: var(--font-size-xs);
  color: rgb(226 232 240 / 82%);
  cursor: pointer;
  background: rgb(8 17 29 / 72%);
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 999px;
  backdrop-filter: blur(10px);
  transition:
    color 0.15s ease,
    background 0.15s ease,
    border-color 0.15s ease;
}

.pc-fp-collision.on {
  color: #fff;
  background: rgb(34 211 238 / 22%);
  border-color: #22d3ee;
}

.pc-status {
  position: absolute;
  bottom: 118px;
  left: 14px;
  z-index: 25;
  display: inline-flex;
  gap: 7px;
  align-items: center;
  font-size: var(--font-size-xs);
  color: var(--viewer-muted);
  pointer-events: none;
}

.pc-status > i {
  width: 7px;
  height: 7px;
  background: #22d3ee;
  border-radius: 50%;
}

.pc-status > i.loading {
  background: #f59e0b;
}

.pc-error-overlay {
  position: absolute;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  background: rgb(8 17 29 / 72%);
}

.pc-error-card {
  max-width: 400px;
  padding: 32px;
  text-align: center;
  background: var(--bg-card);
  border-radius: var(--radius-md);
}

.pc-error-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.pc-error-message {
  margin: 12px 0 20px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

/* ==================== 全景图叠加层 ==================== */
.pc-panorama-overlay {
  position: absolute;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  background: rgb(6 10 18 / 82%);
  backdrop-filter: blur(3px);
}

.pc-panorama-panel {
  width: min(74vw, 1120px);
  height: min(74vh, 740px);
  overflow: hidden;
  background: #0b1020;
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: var(--radius-sm);
  box-shadow: 0 18px 60px rgb(0 0 0 / 55%);
}

.pc-panorama-close {
  position: absolute;
  top: 18px;
  right: 20px;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  color: #fff;
  cursor: pointer;
  background: rgb(20 26 38 / 55%);
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 50%;
  transition: background 0.15s ease;
}

.pc-panorama-nav {
  position: absolute;
  top: 50%;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  color: #fff;
  cursor: pointer;
  background: rgb(20 26 38 / 40%);
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 50%;
  opacity: 0.65;
  transform: translateY(-50%);
  transition:
    opacity 0.15s ease,
    background 0.15s ease;
}

.pc-panorama-nav.is-prev {
  left: 24px;
}

.pc-panorama-nav.is-next {
  right: 24px;
}

.pc-panorama-close:hover,
.pc-panorama-nav:hover {
  background: rgb(30 40 58 / 80%);
  opacity: 1;
}

.pc-panorama-label {
  position: absolute;
  bottom: 20px;
  left: 50%;
  z-index: 2;
  padding: 4px 12px;
  font-size: var(--font-size-sm);
  color: #fff;
  background: rgb(20 26 38 / 65%);
  border-radius: 999px;
  transform: translateX(-50%);
}

/* ==================== CloudBIM 风格点云预览布局 ==================== */
</style>

<style lang="scss">
/* 头部图标下拉/弹出层（Teleport 到 body，需全局样式） */
.pc-popover.el-popover.el-popper {
  padding: 12px;
  border: 1px solid #e2e8f4;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgb(24 39 79 / 16%);
}

.pc-pop {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pc-pop-title {
  font-size: 12px;
  font-weight: 600;
  color: #1a1d24;
}

.pc-pop-sub {
  margin-bottom: 6px;
  font-size: 11px;
  color: #6b7280;
}

.pc-pop-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: #909399;
}

.pc-pop-block {
  display: flex;
  flex-direction: column;
}

.pc-pop-seg button:focus-visible,
.pc-pop-clear:focus-visible,
.pc-bg-cell:focus-visible {
  outline: 2px solid #6b83ff;
  outline-offset: 2px;
}

.pc-pop-seg {
  display: flex;
  gap: 3px;
  padding: 3px;
  background: #f1f4fa;
  border-radius: 8px;
}

.pc-pop-seg button {
  flex: 1 1 0;
  min-width: 0;
  padding: 5px 6px;
  font-size: 12px;
  line-height: 18px;
  color: #4b5563;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.pc-pop-seg button:hover:not(:disabled) {
  color: #4e66cc;
}

.pc-pop-seg button.on {
  font-weight: 600;
  color: #4e66cc;
  background: #fff;
  box-shadow: 0 1px 4px rgb(78 102 204 / 20%);
}

.pc-pop-seg button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.pc-pop-slider-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2px;
  font-size: 12px;
  color: #4b5563;
}

.pc-pop-slider-head em {
  font-style: normal;
  font-variant-numeric: tabular-nums;
  color: #6b7280;
}

.pc-pop-clear {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 7px 8px;
  font-size: 12px;
  color: #b4424a;
  cursor: pointer;
  background: #fdf2f3;
  border: 0;
  border-radius: 8px;
  transition: background 0.15s ease;
}

.pc-pop-clear:hover:not(:disabled) {
  background: #fbe4e6;
}

.pc-pop-clear:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.pc-category-legend {
  display: inline-flex;
  gap: 14px;
  align-items: center;
  padding: 8px 10px;
  background: #f1f4fa;
  border-radius: 8px;
}

.pc-legend-item {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  color: #4b5563;
}

.pc-legend-dot {
  display: inline-block;
  width: 11px;
  height: 11px;
  border-radius: 3px;
}

.pc-legend-dot.is-table {
  background: #db5c38;
}

.pc-legend-dot.is-body {
  background: #3d94e6;
}

/* 背景：极简色块选择 */
.pc-bg-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.pc-bg-cell {
  width: 20px;
  height: 20px;
  padding: 0;
  cursor: pointer;
  border: 1px solid rgb(0 0 0 / 14%);
  border-radius: 50%;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.pc-bg-cell:hover {
  transform: translateY(-1px);
}

.pc-bg-cell.on {
  box-shadow:
    0 0 0 2px #fff,
    0 0 0 4px #4e66cc;
}

.pc-bg-cell.is-gradient {
  background: linear-gradient(160deg, #14315c, #0a1220);
}

.pc-bg-cell.is-deep {
  background: #0c1224;
}

.pc-bg-cell.is-light {
  background: #e8eef6;
}

.pc-bg-cell.is-black {
  background: #000;
}
</style>
