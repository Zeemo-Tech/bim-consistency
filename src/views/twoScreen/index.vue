<template>
  <div ref="twoScreenContainerEl" class="quad-view" :data-layout="layoutMode">
    <TwoScreenHeader
      ref="headerRef"
      :project-name="projectName"
      :range-value="headerRangeValue"
      :annotation-items="annotationSavedList"
      :show-annotation-list="isAnnotationMode"
      :selected-annotation-key="annotationSelectedKey"
      :show-building-floor="!isAnnotationMode"
      :building-value="selectedBuildingName"
      :floor-value="selectedFloorName"
      :building-options="headerBuildingOptions"
      :floor-options="headerFloorOptions"
      :can-generate-report="canGenerateReport"
      @building-change="handleHeaderBuildingChange"
      @floor-change="handleHeaderFloorChange"
      @annotation-select="handleAnnotationSelect"
      @annotation-detail="handleAnnotationDetail"
      @annotation-invite="handleAnnotationInvite"
      @annotation-generate="handleAnnotationGenerate"
      @range-change="handleRangeChange"
      @reset-latest="handleResetLatest"
    />
    <!-- 动态面板容器 -->
    <div class="dynamic-container">
      <DynamicPanel
        v-if="modeState !== 'mix'"
        :key="dynamicPanelKey"
        ref="dynamicPanelRef"
        :layout-mode="layoutMode"
        :panel-contents="panelContents"
        :time-range="timeRange"
        :project-id="projectId"
        :scan-file-id="activeScanId"
        :bim-file-id="boundBimFileId"
        :gauss-file-id="boundGaussFileId"
        :gauss-asset-path="resolvedGaussAssetPath"
        :segments="scanSegments"
        :now="nowValue"
        :is-preset-mode="true"
        :bim-pointcloud-calibration="bimPointcloudCalibration"
        :pointcloud-world-matrix="pointcloudWorldMatrix"
        :current-image-info="currentImageInfo"
        :current-trajectory-point="lastTrajectoryPoint"
        :panorama-camera-rot="panoramaCameraRot"
        :panorama-fov="panoramaFov"
        :rotation-lock="quadRotationSyncActive"
        :annotation-enabled="isAnnotationMode"
        :annotation-point="annotationPoint"
        :annotation-point-bim="annotationPointForBim"
        :annotation-point-pointcloud="annotationPointForPointcloud"
        :annotation-point-gaussian="annotationPointForGaussian"
        :annotation-point-consistency="annotationPointForConsistency"
        :annotation-status="annotationStatus"
        :annotation-persist="annotationPersist"
        :annotation-stash-markers="annotationStashMarkers"
        :annotation-highlight-current="annotationHighlightCurrent"
        :annotation-markers-visible="annotationMarkersVisible"
        @gaussian-error="handleGaussianError"
        @gaussian-loaded-change="onGaussianLoadedChange"
        @bim-loaded-change="onBimLoadedChange"
        @pointcloud-loaded-change="onPointcloudLoadedChange"
        @consistency-result-loaded-change="onConsistencyResultLoadedChange"
        @consistency-result-ready-state-change="
          onConsistencyResultReadyStateChange
        "
        @pointcloud-world-ready="onPointcloudWorldReady"
        @bim-rot-change="onBimRotChange"
        @pointcloud-rot-change="onPointcloudRotChange"
        @image-info-change="onImageInfoChange"
        @gaussian-rot-change="onGaussianRotChange"
        @panorama-rot-change="onPanoramaRotChange"
        @panorama-fov-change="onPanoramaFovChange"
        @segment-click="handleSegmentClick"
        @annotation-pick="handleAnnotationPick"
      />
      <BimPointcloudMixViewer
        v-else
        ref="mixViewerRef"
        class="mix-panel-slot"
        :project-id="projectId"
        :scan-file-id="activeScanId"
        :bim-file-id="boundBimFileId"
        :gauss-file-id="boundGaussFileId"
        :gauss-asset-path="resolvedGaussAssetPath"
        :show-bim="viewVisibility.rvt"
        :show-pointcloud="viewVisibility.pointcloud"
        :show-gaussian="viewVisibility.gaussian"
        :show-consistency-result="viewVisibility.consistencyResult"
        :consistency-result-available="!isConsistencyResultOptional"
        :consistency-calibration="bimPointcloudCalibration"
        :consistency-pointcloud-world-matrix="
          mixConsistencyPointcloudWorldMatrix
        "
        :bim-opacity="mixBimOpacity"
        :annotation-enabled="isAnnotationMode"
        :annotation-point="annotationPoint"
        :annotation-source="annotationSource"
        :annotation-status="annotationStatus"
        :annotation-persist="annotationPersist"
        :annotation-stash-markers="annotationStashMarkersMix"
        :annotation-highlight-current="annotationHighlightCurrent"
        :annotation-markers-visible="annotationMarkersVisible"
        @camera-pose-change="handleMixCameraPoseChange"
        @annotation-pick="handleAnnotationPick"
        @bim-loaded-change="onBimLoadedChange"
        @pointcloud-loaded-change="onPointcloudLoadedChange"
        @gaussian-loaded-change="onGaussianLoadedChange"
        @consistency-result-loaded-change="onConsistencyResultLoadedChange"
        @consistency-result-ready-state-change="
          onConsistencyResultReadyStateChange
        "
        @toggle-layer-visibility="handleMixLayerVisibilityToggle"
      />
      <div v-if="modeState === 'mix'" class="mix-capture-layer">
        <BimViewer
          ref="mixBimCaptureRef"
          :is-preset-mode="true"
          :calibration="bimPointcloudCalibration"
          :pointcloud-world-matrix="mixConsistencyPointcloudWorldMatrix"
          :annotation-enabled="isAnnotationMode"
          :annotation-point="annotationPoint"
          :annotation-status="annotationStatus"
          :annotation-persist="annotationPersist"
          :annotation-stash-markers="annotationStashMarkersMix"
          :annotation-highlight-current="annotationHighlightCurrent"
          :annotation-markers-visible="annotationMarkersVisible"
        />
        <ConsistencyResultViewer
          ref="mixConsistencyResultRef"
          :project-id="projectId"
          :scan-file-id="activeScanId"
          :bim-file-id="boundBimFileId"
          :transparent-background="true"
          :calibration="bimPointcloudCalibration"
          :pointcloud-world-matrix="mixConsistencyPointcloudWorldMatrix"
          :camera-pose="mixConsistencyCameraPose"
          :annotation-enabled="isAnnotationMode"
          :annotation-point="annotationPoint"
          :annotation-status="annotationStatus"
          :annotation-persist="annotationPersist"
          :annotation-stash-markers="annotationStashMarkersMix"
          :annotation-highlight-current="annotationHighlightCurrent"
          :annotation-markers-visible="annotationMarkersVisible"
          @loaded-change="onConsistencyResultLoadedChange"
          @ready-state-change="onConsistencyResultReadyStateChange"
        />
      </div>
      <button
        v-if="layoutMode === 'quad' && modeState !== 'mix'"
        :class="['quad-link-btn', `is-${linkSyncMode}`]"
        type="button"
        aria-label="联动"
        @click="handleQuadLinkClick"
      >
        <img class="quad-link-icon" src="/images/Link.svg" alt="" />
      </button>
      <button
        v-if="modeState === 'annotation'"
        :class="['quad-link-btn', { 'is-synced': bimPointcloudSync }]"
        type="button"
        aria-label="BIM点云高斯联动"
        @click="handleBimPointcloudSyncClick"
      >
        <img class="quad-link-icon" src="/images/Link.svg" alt="" />
      </button>
      <div v-if="showAnnotationLabels" class="annotation-label-layer">
        <div v-if="viewVisibility.rvt" class="annotation-label is-left">
          <img class="annotation-label-icon" src="/images/PushPin.svg" alt="" />
          <span class="annotation-label-text">批注模式</span>
        </div>
        <div v-if="viewVisibility.pointcloud" class="annotation-label is-right">
          <img class="annotation-label-icon" src="/images/PushPin.svg" alt="" />
          <span class="annotation-label-text">批注模式</span>
        </div>
      </div>
    </div>
    <div
      v-if="annotationMaskVisible"
      class="annotation-guide-mask"
      role="button"
      tabindex="0"
      aria-label="关闭批注提示"
      @click="dismissAnnotationGuide"
      @keydown.enter.prevent="dismissAnnotationGuide"
      @keydown.space.prevent="dismissAnnotationGuide"
    >
      <div class="annotation-guide-card">
        <span class="annotation-guide-text">请在视图中选择问题点</span>
      </div>
    </div>
    <div
      v-if="annotationFormVisible"
      ref="annotationFormEl"
      class="annotation-form-panel"
      :class="{ 'is-saved': annotationSaved }"
      :style="annotationFormStyle"
    >
      <div
        class="annotation-form-header"
        role="button"
        tabindex="0"
        @pointerdown="onAnnotationFormDragStart"
        @keydown.enter.prevent
        @keydown.space.prevent
      >
        <span class="annotation-form-title">批注表单</span>
      </div>
      <button
        class="annotation-form-close"
        type="button"
        aria-label="关闭批注表单"
        @click="handleAnnotationCancel"
      >
        <el-icon><Close /></el-icon>
      </button>
      <div class="annotation-form-scroll">
        <el-form
          ref="annotationFormRef"
          :model="annotationForm"
          :rules="annotationFormRules"
          label-position="top"
        >
          <el-form-item class="annotation-form-field" prop="title">
            <template #label>
              <span class="annotation-form-label">工单名称</span>
            </template>
            <el-input
              v-model="annotationForm.title"
              placeholder="请输入工单名称"
            />
          </el-form-item>
          <el-form-item class="annotation-form-field" prop="period">
            <template #label>
              <span class="annotation-form-label">整改周期</span>
            </template>
            <el-date-picker
              v-model="annotationForm.period"
              type="daterange"
              range-separator="-"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              placeholder="请选择时间"
              :disabled-date="annotationPeriodDisabledDate"
            />
          </el-form-item>
          <el-form-item class="annotation-form-field" prop="severity">
            <template #label>
              <span class="annotation-form-label">严重等级</span>
            </template>
            <el-select
              v-model="annotationForm.severity"
              placeholder="请选择等级"
            >
              <el-option label="高" value="high" />
              <el-option label="中" value="medium" />
              <el-option label="低" value="low" />
            </el-select>
          </el-form-item>
          <el-form-item class="annotation-form-field" prop="componentName">
            <template #label>
              <span class="annotation-form-label">构件</span>
            </template>
            <el-input
              v-model="annotationForm.componentName"
              placeholder="当前选中的构件"
              disabled
            />
          </el-form-item>
          <el-form-item class="annotation-form-field" prop="componentId">
            <template #label>
              <span class="annotation-form-label">构件ID</span>
            </template>
            <el-input
              v-model="annotationForm.componentId"
              placeholder="当前选中的构件ID"
              disabled
            />
          </el-form-item>
          <el-form-item class="annotation-form-field" prop="remark">
            <template #label>
              <span class="annotation-form-label">备注</span>
            </template>
            <el-input
              v-model="annotationForm.remark"
              type="textarea"
              :rows="3"
              maxlength="200"
              show-word-limit
              placeholder="请输入备注"
            />
          </el-form-item>
        </el-form>
        <div
          v-if="annotationForm.screenshots.length"
          class="annotation-form-field"
        >
          <label class="annotation-form-label">截图/证据</label>
          <div class="annotation-screenshot-preview">
            <div class="annotation-screenshot-grid">
              <div
                v-for="(shot, index) in annotationForm.screenshots"
                :key="shot.fileId ?? `${shot.url}-${index}`"
                class="annotation-screenshot-item"
              >
                <el-image
                  :src="shot.url"
                  :preview-src-list="annotationScreenshotUrls"
                  :preview-teleported="true"
                  :initial-index="index"
                  fit="cover"
                  alt="截图预览"
                  @load="updateAnnotationFormSize"
                />
                <button
                  class="annotation-screenshot-remove"
                  type="button"
                  aria-label="删除截图"
                  @click.stop="handleAnnotationScreenshotRemove(index)"
                >
                  <el-icon><Close /></el-icon>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div
          v-if="annotationCapturePendingText"
          class="annotation-form-status is-pending"
        >
          {{ annotationCapturePendingText }}
        </div>
      </div>
      <div class="annotation-form-actions">
        <el-tooltip content="截图" placement="top">
          <button
            class="annotation-action-button is-camera"
            type="button"
            :disabled="
              screenshotLoading ||
              annotationSubmitting ||
              annotationScreenshotSupplementPending
            "
            @click="handleScreenshotClick"
          >
            <el-icon><Camera /></el-icon>
          </button>
        </el-tooltip>
        <span class="annotation-action-divider" />
        <el-tooltip content="暂存" placement="top">
          <button
            class="annotation-action-button is-stash"
            type="button"
            :disabled="
              annotationSubmitting || annotationScreenshotSupplementPending
            "
            @click="handleAnnotationStash"
          >
            <el-icon><Document /></el-icon>
          </button>
        </el-tooltip>
        <span class="annotation-action-divider" />
        <el-tooltip content="提交" placement="top">
          <button
            class="annotation-action-button is-submit"
            type="button"
            :disabled="
              annotationSubmitting || annotationScreenshotSupplementPending
            "
            @click="handleAnnotationSubmit"
          >
            <el-icon><CircleCheck /></el-icon>
          </button>
        </el-tooltip>
        <span v-if="annotationEditingId" class="annotation-action-divider" />
        <el-tooltip v-if="annotationEditingId" content="删除" placement="top">
          <button
            class="annotation-action-button is-delete"
            type="button"
            :disabled="annotationSubmitting"
            @click="handleAnnotationDelete"
          >
            <el-icon><Delete /></el-icon>
          </button>
        </el-tooltip>
      </div>
    </div>

    <AnnotationScreenshot
      ref="screenshotToolRef"
      :get-target-element="getScreenshotTargetElement"
      :get-capture-data-url="getCaptureDataUrl"
      :allow-dom-fallback="modeState !== 'mix'"
      @confirm="handleScreenshotConfirm"
      @overlay-change="(value) => (screenshotOverlayVisible = value)"
      @loading-change="(value) => (screenshotLoading = value)"
    />

    <!-- 图纸轨迹小窗口（可拖动） -->
    <div
      v-show="true"
      ref="miniMapEl"
      class="mini-map-float"
      :class="{ 'is-dragging': isMiniMapDragging }"
      :style="miniMapStyle"
      @pointerdown="onMiniMapPointerDown"
    >
      <SmallWindow
        ref="smallWindowRef"
        title="图纸轨迹"
        empty-text="加载后显示"
        :dxf-blob-url="dxfBlobUrl"
        :trajectory-data="trajectoryData"
        :alignment="alignment"
        @point-click="onTrajectoryPointClick"
      />
    </div>

    <!-- 普通模式视图选择 -->
    <div v-if="modeState === 'free'" class="view-toggle-panel">
      <el-tooltip
        v-for="item in viewToggleItems"
        :key="item.key"
        :content="item.label"
        placement="left"
      >
        <button
          class="view-toggle-btn"
          :class="{ active: viewVisibility[item.key] }"
          @click="toggleView(item.key)"
        >
          <el-icon>
            <component :is="item.icon" />
          </el-icon>
        </button>
      </el-tooltip>
    </div>

    <!-- 批注模式视图选择 -->
    <div
      v-else-if="showAnnotationSidebar && modeState === 'annotation'"
      class="annotation-view-sidebar"
      :class="{ 'is-collapsed': annotationSidebarCollapsed }"
    >
      <div class="annotation-view-sidebar__header">
        <div
          v-if="!annotationSidebarCollapsed"
          class="annotation-view-sidebar__title"
        >
          {{ annotationSidebarTitle }}
        </div>
        <button
          class="annotation-view-sidebar__collapse"
          type="button"
          :aria-label="
            annotationSidebarCollapsed ? '展开批注视图' : '收起批注视图'
          "
          @click="annotationSidebarCollapsed = !annotationSidebarCollapsed"
        >
          <el-icon>
            <ArrowRightBold v-if="annotationSidebarCollapsed" />
            <ArrowLeftBold v-else />
          </el-icon>
        </button>
        <button
          v-if="!annotationSidebarCollapsed"
          class="annotation-view-sidebar__visibility"
          type="button"
          :aria-label="annotationMarkersVisible ? '隐藏批注点' : '显示批注点'"
          :title="annotationMarkersVisible ? '隐藏批注点' : '显示批注点'"
          @click="annotationMarkersVisible = !annotationMarkersVisible"
        >
          <el-icon>
            <View v-if="annotationMarkersVisible" />
            <Hide v-else />
          </el-icon>
        </button>
      </div>
      <button
        v-for="item in annotationSidebarItems"
        v-show="!annotationSidebarCollapsed"
        :key="item.key"
        class="annotation-view-sidebar__item"
        :class="{ active: viewVisibility[item.key] }"
        type="button"
        @click="toggleView(item.key)"
      >
        <span class="annotation-view-sidebar__dot" />
        <span class="annotation-view-sidebar__label">{{ item.label }}</span>
      </button>
    </div>

    <!-- 底部模式切换 -->
    <div class="mode-switcher">
      <div class="mode-toggle-wrapper">
        <div
          v-if="modeState !== 'mix'"
          class="mode-toggle"
          :data-mode="modeVisualState"
        >
          <span class="mode-toggle-highlight" />
          <el-tooltip content="批注模式" placement="top">
            <button
              class="mode-toggle-btn"
              :class="{ active: modeState === 'annotation' }"
              type="button"
              @click="setAnnotationMode"
            >
              <img
                class="mode-toggle-icon"
                src="/images/cloudeBim.svg"
                alt="批注"
              />
              <span>批注</span>
            </button>
          </el-tooltip>
          <el-tooltip content="混合模式" placement="top">
            <button
              class="mode-toggle-btn"
              :class="{ active: isMixMode, disabled: !canEnterMixMode }"
              type="button"
              @click="setMixMode"
            >
              <img
                class="mode-toggle-icon"
                src="/images/mixCloudeBIm.svg"
                alt="混合"
              />
              <span>混合</span>
            </button>
          </el-tooltip>
        </div>
        <div
          v-else
          ref="blendTrackRef"
          class="blend-toggle"
          :style="blendStyle"
          role="presentation"
          @pointerdown="onBlendPointerDown"
        >
          <span class="blend-track" />
          <button class="blend-knob" type="button">
            <img class="blend-icon" src="/images/mixCloudeBIm.svg" alt="混合" />
          </button>
        </div>
      </div>
      <button
        v-if="modeState === 'mix'"
        class="mode-close-btn"
        type="button"
        @click="restoreFromMix"
      >
        <el-icon>
          <Close />
        </el-icon>
      </button>
      <button
        v-else-if="modeState === 'annotation'"
        class="mode-close-btn"
        type="button"
        @click="exitAnnotationMode"
      >
        <el-icon>
          <Close />
        </el-icon>
      </button>
    </div>

    <MemberPickerDialog
      v-model="memberPickerVisible"
      :project-id="projectId"
      :annotation-options="annotationSavedList"
      :selected-annotation-keys="inviteAnnotationKeys"
      :selected-annotation-key="inviteAnnotationKeys[0] || ''"
      :annotation-title="inviteAnnotationTitle"
      :submitting="inviteSubmitting"
      @update:selected-annotation-keys="handleInviteAnnotationKeysChange"
      @submit="handleMemberInviteSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
  onMounted,
  reactive,
  nextTick,
  onBeforeUnmount,
  watch,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useUserStoreHook } from '@/store/modules/user'
import { useReportAccessStoreHook } from '@/store/modules/report-access'
import {
  getScanPreview,
  getDxfFile,
  getLatestAlignment,
  getBimAlignment,
  type ModelAlignment,
  type TrajectoryInfo,
  type AlignmentResult,
  type TrajectoryPoint,
} from '@/api/calibration'
import {
  getProjectScans,
  getScanCalibration,
  type ScanListItem,
  type ScanCalibration,
} from '@/api/scan'
import {
  getIfcMetadata,
  getProjectFilesByProjectId,
  type FileTypeGroup,
  type IfcMetadata,
} from '@/api/fileManage'
import {
  bindAnnotationScreenshots,
  createAnnotation,
  deleteAnnotation,
  deleteAnnotationScreenshot,
  getAnnotationDetail,
  getAnnotationList,
  getAnnotationScreenshotBlob,
  getAnnotationScreenshots,
  updateAnnotation,
  updateAnnotationScreenshotOrder,
  type Annotation,
  type CreateAnnotationInput,
  type AnnotationScreenshot as AnnotationScreenshotRecord,
} from '@/api/annotation'
import { createNotification, type ProjectMemberItem } from '@/api/notification'
import {
  checkReportReady,
  createReportTask,
  listReportTemplates,
  type CreateReportOverviewScreenshotInput,
  type ReportExportFormat,
  type ReportLanguage,
  type ReportTemplate,
} from '@/api/report'
import { getCurrentUser } from '@/api/user'
import { uploadFile } from '@/utils/upload'
import * as THREE from 'three'
import {
  ArrowLeftBold,
  ArrowRightBold,
  Camera,
  CircleCheck,
  Close,
  Coordinate,
  Delete,
  Document,
  Hide,
  Picture,
  PictureRounded,
  View,
} from '@element-plus/icons-vue'
import DynamicPanel from './components/DynamicPanel.vue'
import BimViewer from './components/BimViewer.vue'
import BimPointcloudMixViewer from './components/BimPointcloudMixViewer.vue'
import ConsistencyResultViewer from './components/ConsistencyResultViewer.vue'
import TwoScreenHeader from './components/TwoScreenHeader.vue'
import MemberPickerDialog from './components/MemberPickerDialog.vue'
import SmallWindow from '@/components/SmallWindow/index.vue'
import AnnotationScreenshot from './components/AnnotationScreenshot.vue'
import {
  buildGaussianTrajectoryYUpPose,
  buildTrajectoryYUpPose,
} from './utils/fusionTransforms'
type PanelType =
  | 'rvt'
  | 'panorama'
  | 'gaussian'
  | 'pointcloud'
  | 'consistencyResult'
type LayoutMode =
  | 'single'
  | 'double-horizontal'
  | 'double-vertical'
  | 'triple-left'
  | 'triple-right'
  | 'quad'
type ModeState = 'free' | 'annotation' | 'mix'
type SegmentStatus = 'calibrated' | 'uncalibrated'
type AnnotationSource = 'bim' | 'pointcloud' | 'gaussian' | 'consistencyResult'
type AnnotationMarker = {
  key: string
  point: { x: number; y: number; z: number }
  status: 'default' | 'editing' | 'saved'
  highlighted: boolean
  synced: boolean
  source: AnnotationSource
}
type AnnotationPickPayload = {
  point: { x: number; y: number; z: number } | null
  screen?: { x: number; y: number } | null
  source?: AnnotationSource
  key?: string
  synced?: boolean
  componentId?: string
  componentInfo?: {
    id?: string | number
    name?: string
    type?: string
  } | null
}
type NormalizedRect = { x: number; y: number; width: number; height: number }
type ScreenshotConfirmPayload = {
  dataUrl: string
  selection: NormalizedRect
  overlayDataUrl?: string
}
type OverviewCapturePanel = {
  key: AnnotationSource
  title: string
  dataUrl: string | null
}
type ReportOverviewCaptureResult = {
  dataUrl: string
  capturedAt: string
  layout?: string
  width?: number
  height?: number
}
type AnnotationCameraPose = {
  camera: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
}
type AnnotationViewState = {
  bimPose: AnnotationCameraPose | null
  pointcloudPose: AnnotationCameraPose | null
  gaussianPose: AnnotationCameraPose | null
  mixPose: AnnotationCameraPose | null
  meta?: {
    remark?: string
  }
}
type AnnotationScreenshotItem = {
  id?: number
  fileId?: number
  url: string
  originalName?: string
  fileSize?: number
  sortOrder?: number
  pending?: boolean
}
type AnnotationStashPayload = {
  id?: number
  point: { x: number; y: number; z: number }
  source: AnnotationSource
  title: string
  period: string[]
  severity: string
  componentId: string
  componentName: string
  componentType: string
  remark: string
  screenshots: AnnotationScreenshotItem[]
  saved: boolean
  viewState?: AnnotationViewState | null
}

type HeaderSelectOption = {
  label: string
  value: string
  disabled?: boolean
}

type ScanFloorSlot = {
  floorName: string
  latestReadyScan: ScanListItem | null
  latestScan: ScanListItem | null
  scans: ScanListItem[]
  disabled: boolean
}

type ScanBuildingSlot = {
  buildingName: string
  floors: ScanFloorSlot[]
}

type ReplayAnnotationSnapshot = {
  id?: number | null
  key?: string
  point: { x: number; y: number; z: number } | null
  source: AnnotationSource
  title: string
  period: string[]
  severity: string
  componentId: string
  componentName: string
  componentType: string
  remark: string
  screenshots: AnnotationScreenshotItem[]
  viewState?: AnnotationViewState | null
}

type StoredAnnotationReplayPayload = {
  projectId: number
  scanFileId: number
  annotationId: number
  annotationKey?: string
  annotation: ReplayAnnotationSnapshot | null
}

interface LayoutSnapshot {
  layoutMode: LayoutMode
  panelContents: Record<string, PanelType | ''>
  viewVisibility: Record<PanelType, boolean>
}

interface ScanSegment {
  start: number
  end: number
  status: SegmentStatus
  scanFileId: number
}

interface BimPointcloudCalibration {
  projectId: number
  scanFileId: number
  bimFileId?: number
  modelMatrix: number[]
  timestamp?: number
}

const toBimPointcloudCalibration = (
  projectId: number,
  alignment: ModelAlignment,
): BimPointcloudCalibration => {
  const rawMatrix = new THREE.Matrix4()
  if (
    Array.isArray(alignment.modelMatrix) &&
    alignment.modelMatrix.length === 16
  ) {
    rawMatrix.fromArray(alignment.modelMatrix)
  } else {
    const pos = new THREE.Vector3(
      alignment.modelTranslationX,
      alignment.modelTranslationY,
      alignment.modelTranslationZ,
    )
    const quat = new THREE.Quaternion(
      alignment.modelRotationQx,
      alignment.modelRotationQy,
      alignment.modelRotationQz,
      alignment.modelRotationQw,
    )
    rawMatrix.compose(pos, quat, new THREE.Vector3(1, 1, 1))
  }

  return {
    projectId,
    scanFileId: alignment.modelScanFileId,
    bimFileId: alignment.modelBimFileId,
    modelMatrix: rawMatrix.toArray(),
  }
}

defineOptions({
  name: 'TwoScreen',
})

const route = useRoute()
const router = useRouter()
const userStore = useUserStoreHook()
const reportAccessStore = useReportAccessStoreHook()
const annotationReplayStorageKeyPrefix = 'two-screen:annotation-replay:'
const scanGaussSelectionStorageKey = 'history-model:scan-gauss-selection'
const projectName = computed(() => {
  const raw = route.query.projectName
  if (Array.isArray(raw)) return raw[0] ?? ''
  return raw || ''
})

const normalizeGaussAssetPathValue = (value: unknown) =>
  String(value ?? '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim()

const loadScanGaussSelectionMap = (): Record<
  string,
  { gaussId?: string; gaussName?: string; gaussAssetPath?: string }
> => {
  try {
    const raw = window.sessionStorage.getItem(scanGaussSelectionStorageKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<
        string,
        { gaussId?: string; gaussName?: string; gaussAssetPath?: string }
      >
    }
  } catch (error) {}
  return {}
}

const resolvePreferredGaussAssetPath = (
  scanId: string | number | null | undefined,
  routeGaussAssetPath?: unknown,
) => {
  const normalizedScanId = String(scanId ?? '').trim()
  const routePath = normalizeGaussAssetPathValue(routeGaussAssetPath)
  const savedPath = normalizedScanId
    ? normalizeGaussAssetPathValue(
        loadScanGaussSelectionMap()[normalizedScanId]?.gaussAssetPath,
      )
    : ''
  if (routePath && routePath !== 'meta.lcc') return routePath
  return savedPath || routePath || 'meta.lcc'
}

const resolvedGaussAssetPath = computed(() => {
  const raw = route.query.gaussAssetPath
  const routePath = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
  const scanId = activeScanId.value ?? parseQueryNumber(route.query.scanFileId)
  return resolvePreferredGaussAssetPath(scanId, routePath)
})

const resolveInviteGaussAssetPath = () => {
  const scanId = activeScanId.value
  const raw = route.query.gaussAssetPath
  const routePath = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
  return resolvePreferredGaussAssetPath(scanId, routePath)
}

const parseQueryNumber = (value: unknown): number | null => {
  if (Array.isArray(value)) return parseQueryNumber(value[0])
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return null
  return num
}

const isProjectFileReady = (
  groups: FileTypeGroup[] | undefined,
  type: 'scan' | 'cad' | 'bim' | 'gauss',
  fileId: number | null | undefined,
) => {
  if (!Array.isArray(groups) || !fileId || !Number.isFinite(fileId))
    return false
  const group = groups.find((item) => item.type === type)
  const file = group?.files.find((item) => Number(item.id) === Number(fileId))
  return Boolean(file && ['stored', 'completed'].includes(file.status))
}

const normalizeSlotName = (value: string | null | undefined) =>
  String(value || '').trim()

const compareSlotLabel = (left: string, right: string) =>
  left.localeCompare(right, 'zh-CN')

const buildScanBuildingSlots = (
  items: ScanListItem[],
  switchableMap: Record<number, boolean | undefined>,
) => {
  const buildingMap = new Map<string, Map<string, ScanListItem[]>>()

  items.forEach((item) => {
    const buildingName = normalizeSlotName(item.buildingName)
    const floorName = normalizeSlotName(item.floorName)
    if (!buildingName || !floorName) return
    if (!buildingMap.has(buildingName)) {
      buildingMap.set(buildingName, new Map())
    }
    const floorMap = buildingMap.get(buildingName)!
    if (!floorMap.has(floorName)) {
      floorMap.set(floorName, [])
    }
    floorMap.get(floorName)!.push(item)
  })

  return Array.from(buildingMap.entries())
    .map(([buildingName, floorMap]) => ({
      buildingName,
      floors: Array.from(floorMap.entries())
        .map(([floorName, floorItems]) => {
          const switchableScans = floorItems.filter(
            (item) => switchableMap[item.scanFileId] === true,
          )
          const hasUncheckedScan = floorItems.some(
            (item) => switchableMap[item.scanFileId] === undefined,
          )
          return {
            floorName,
            latestReadyScan: pickLatestScan(switchableScans),
            latestScan: pickLatestScan(floorItems),
            scans: [...floorItems],
            disabled: switchableScans.length === 0 && !hasUncheckedScan,
          }
        })
        .sort((left, right) =>
          compareSlotLabel(left.floorName, right.floorName),
        ),
    }))
    .sort((left, right) =>
      compareSlotLabel(left.buildingName, right.buildingName),
    )
}

const parseQueryText = (value: unknown) => {
  if (Array.isArray(value)) return parseQueryText(value[0])
  const text = String(value ?? '').trim()
  return text || ''
}

const normalizeAnnotationSource = (value: unknown): AnnotationSource => {
  if (value === 'pointcloud') return 'pointcloud'
  if (value === 'gaussian') return 'gaussian'
  if (value === 'consistencyResult') return 'consistencyResult'
  return 'bim'
}

const normalizeAnnotationPoint = (value: unknown) => {
  if (!value || typeof value !== 'object') return null
  const point = value as Record<string, unknown>
  const x = Number(point.x)
  const y = Number(point.y)
  const z = Number(point.z)
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z))
    return null
  return { x, y, z }
}

const normalizeAnnotationPose = (
  value: unknown,
): AnnotationCameraPose | null => {
  if (!value || typeof value !== 'object') return null
  const pose = value as Record<string, unknown>
  const camera = normalizeAnnotationPoint(pose.camera)
  const target = normalizeAnnotationPoint(pose.target)
  if (!camera || !target) return null
  return { camera, target }
}

const normalizeAnnotationViewState = (
  value: unknown,
): AnnotationViewState | null => {
  if (!value || typeof value !== 'object') return null
  const state = value as Record<string, unknown>
  const meta =
    state.meta && typeof state.meta === 'object'
      ? { ...(state.meta as Record<string, unknown>) }
      : undefined
  return {
    bimPose: normalizeAnnotationPose(state.bimPose),
    pointcloudPose: normalizeAnnotationPose(state.pointcloudPose),
    gaussianPose: normalizeAnnotationPose(state.gaussianPose),
    mixPose: normalizeAnnotationPose(state.mixPose),
    meta: meta as AnnotationViewState['meta'],
  }
}

const normalizeAnnotationPeriod = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .slice(0, 2)
}

const parseScreenshotIdFromUrl = (value: unknown) => {
  const text = String(value ?? '').trim()
  const match = text.match(/\/screenshots\/(\d+)(?:[/?#]|$)/i)
  if (!match) return null
  return parseQueryNumber(match[1])
}

const resolveScreenshotResourceId = (value: unknown) => {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  const fieldCandidates = [
    data.id,
    data.screenshotId,
    data.screenshotID,
    data.screenshot_id,
    data.recordId,
    data.recordID,
    data.record_id,
    data.imageId,
    data.imageID,
    data.image_id,
  ]
  for (const candidate of fieldCandidates) {
    const resolved = parseQueryNumber(candidate)
    if (resolved) return resolved
  }
  const urlCandidates = [
    data.url,
    data.previewUrl,
    data.previewURL,
    data.downloadUrl,
    data.downloadURL,
    data.path,
  ]
  for (const candidate of urlCandidates) {
    const resolved = parseScreenshotIdFromUrl(candidate)
    if (resolved) return resolved
  }
  return parseQueryNumber(data.fileId)
}

const normalizeAnnotationScreenshots = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const data = (item || {}) as Record<string, unknown>
      const url = String(data.url ?? '').trim()
      if (!url) return null
      return {
        id: resolveScreenshotResourceId(data) ?? undefined,
        fileId: parseQueryNumber(data.fileId) ?? undefined,
        url,
        originalName: String(data.originalName ?? '').trim() || undefined,
        fileSize: parseQueryNumber(data.fileSize) ?? undefined,
        sortOrder: Number(data.sortOrder) || 0,
      } as AnnotationScreenshotItem
    })
    .filter((item): item is AnnotationScreenshotItem => Boolean(item))
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
}

const normalizeScreenshotUrl = (rawUrl?: string) => {
  const url = String(rawUrl || '').trim()
  if (!url) return ''
  if (
    /^https?:\/\//i.test(url) ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return url
  }
  if (url.startsWith('/api/')) return url
  if (url.startsWith('/projects/')) return `/api${url}`
  if (url.startsWith('/')) return `/api${url}`
  return `/api/${url}`
}

const normalizeReplayAnnotationSnapshot = (
  value: unknown,
): ReplayAnnotationSnapshot | null => {
  if (!value || typeof value !== 'object') return null
  const annotation = value as Record<string, unknown>
  return {
    id: parseQueryNumber(annotation.id),
    key: String(annotation.key ?? '').trim() || undefined,
    point: normalizeAnnotationPoint(annotation.point),
    source: normalizeAnnotationSource(annotation.source),
    title: String(annotation.title ?? '').trim(),
    period: normalizeAnnotationPeriod(annotation.period),
    severity: String(annotation.severity ?? '').trim(),
    componentId: String(annotation.componentId ?? '').trim(),
    componentName: String(annotation.componentName ?? '').trim(),
    componentType: String(annotation.componentType ?? '').trim(),
    remark: String(annotation.remark ?? '').trim(),
    screenshots: normalizeAnnotationScreenshots(annotation.screenshots),
    viewState: normalizeAnnotationViewState(annotation.viewState),
  }
}

const consumeStoredAnnotationReplayPayload = (
  token: string,
): StoredAnnotationReplayPayload | null => {
  if (!token) return null
  try {
    const raw = window.sessionStorage.getItem(
      `${annotationReplayStorageKeyPrefix}${token}`,
    )
    if (!raw) return null
    window.sessionStorage.removeItem(
      `${annotationReplayStorageKeyPrefix}${token}`,
    )
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const projectId = parseQueryNumber(parsed.projectId)
    const scanFileId = parseQueryNumber(parsed.scanFileId)
    const annotationId = parseQueryNumber(parsed.annotationId)
    if (!projectId || !scanFileId || !annotationId) return null
    return {
      projectId,
      scanFileId,
      annotationId,
      annotationKey: parseQueryText(parsed.annotationKey) || undefined,
      annotation: normalizeReplayAnnotationSnapshot(parsed.annotation),
    }
  } catch (error) {
    return null
  }
}

const memberPickerVisible = ref(false)
const inviteSubmitting = ref(false)
const inviteAnnotationKeys = ref<string[]>([])
const reportSubmitting = ref(false)
const reportTemplates = ref<ReportTemplate[]>([])
const reportSelectedAnnotationKeys = ref<string[]>([])
const reportForm = reactive<{
  templateId: string
  includeScreenshots: boolean
  language: ReportLanguage
  exportFormat: ReportExportFormat
}>({
  templateId: 'standard_v1',
  includeScreenshots: true,
  language: 'zh-CN',
  exportFormat: 'pdf',
})

const projectId = ref<number | null>(null)
const activeScanId = ref<number | null>(null)
const routeFocusScanId = ref<number | null>(null)
const routeFocusAnnotationId = ref<number | null>(null)
const routeFocusAnnotationKey = ref('')
const routeReplayToken = ref('')
const projectFileGroups = ref<FileTypeGroup[]>([])
const selectedBuildingName = ref('')
const selectedFloorName = ref('')
const boundCadFileId = ref<number | null>(null)
const boundBimFileId = ref<number | null>(null)
const boundGaussFileId = ref<number | null>(null)
const scanCalibration = ref<ScanCalibration | null>(null)
const bimMetadata = ref<IfcMetadata | null>(null)
const componentMetaByElementId = ref<
  Map<string, { label: string; type: string; stepId?: number }>
>(new Map())
const elementIdByStepId = ref<Map<string, string>>(new Map())
const scanList = ref<ScanListItem[]>([])
const scanLoading = ref(false)
const scanRequestId = ref(0)
const scanSwitchableMap = ref<Record<number, boolean | undefined>>({})
const scanLatestReadyMap = ref<Record<number, boolean | undefined>>({})
const userSelectedRange = ref(false)
const scanSwitchableRequestMap = new Map<number, Promise<boolean>>()
const scanLatestReadyRequestMap = new Map<number, Promise<boolean>>()

// 布局和内容状态管理
const layoutMode = ref<LayoutMode>('quad')
const panelContents = reactive<Record<string, PanelType | ''>>({
  panel1: 'panorama',
  panel2: 'gaussian',
  panel3: 'rvt',
  panel4: 'pointcloud',
})

const freeViewOrder: PanelType[] = ['panorama', 'gaussian', 'rvt', 'pointcloud']
const annotationViewOrder: PanelType[] = [
  'rvt',
  'pointcloud',
  'gaussian',
  'consistencyResult',
]
const viewVisibility = reactive<Record<PanelType, boolean>>({
  panorama: true,
  pointcloud: true,
  rvt: true,
  gaussian: true,
  consistencyResult: false,
})

const viewToggleItems = [
  { key: 'pointcloud' as PanelType, label: '点云', icon: Coordinate },
  { key: 'rvt' as PanelType, label: 'BIM', icon: PictureRounded },
  { key: 'panorama' as PanelType, label: '全景图', icon: Picture },
  { key: 'gaussian' as PanelType, label: '高斯模型', icon: View },
]
const annotationViewToggleItems = [
  { key: 'pointcloud' as PanelType, label: '点云' },
  { key: 'rvt' as PanelType, label: 'BIM' },
  { key: 'gaussian' as PanelType, label: '高斯' },
  { key: 'consistencyResult' as PanelType, label: '实模一致结果' },
]
const mixViewToggleItems = [
  { key: 'pointcloud' as PanelType, label: '点云' },
  { key: 'rvt' as PanelType, label: 'BIM' },
  { key: 'gaussian' as PanelType, label: '高斯' },
  { key: 'consistencyResult' as PanelType, label: '实模一致结果' },
]

const dynamicPanelRef = ref<InstanceType<typeof DynamicPanel> | null>(null)
const dynamicPanelKey = ref(0)
const headerRef = ref<InstanceType<typeof TwoScreenHeader> | null>(null)
const mixViewerRef = ref<InstanceType<typeof BimPointcloudMixViewer> | null>(
  null,
)
const mixBimCaptureRef = ref<InstanceType<typeof BimViewer> | null>(null)
const mixConsistencyResultRef = ref<InstanceType<
  typeof ConsistencyResultViewer
> | null>(null)
let mixBimCaptureLoadPromise: Promise<boolean> | null = null
let mixBimCaptureLoadKey = ''
let mixBimCaptureLoadedKey = ''

const modeState = ref<ModeState>('free')
const isAnnotationMode = computed(
  () => modeState.value === 'annotation' || modeState.value === 'mix',
)
const isAnnotationState = (state: ModeState) =>
  state === 'annotation' || state === 'mix'
const isMixMode = computed(() => modeState.value === 'mix')
const showAnnotationSidebar = computed(() => modeState.value === 'annotation')
const consistencyResultUnavailableText = '当前扫描暂无实模一致结果'
const isConsistencyResultOptional = computed(
  () => consistencyResultReadyState.value === 'optional',
)
const annotationSidebarTitle = computed(() => '批注视图')
const annotationSidebarItems = computed(() => annotationViewToggleItems)
const previousMode = ref<ModeState>('free')
const previousSnapshot = ref<LayoutSnapshot | null>(null)
const annotationSnapshot = ref<LayoutSnapshot | null>(null)
const annotationMaskVisible = ref(false)
const annotationSidebarCollapsed = ref(false)
const annotationMarkersVisible = ref(true)
const annotationPoint = ref<{ x: number; y: number; z: number } | null>(null)
const annotationSource = ref<AnnotationSource | null>(null)
const annotationForm = reactive({
  title: '',
  period: [] as string[],
  severity: '',
  componentId: '',
  componentName: '',
  componentType: '',
  remark: '',
  screenshots: [] as AnnotationScreenshotItem[],
})
const annotationFormRef = ref<FormInstance | null>(null)
const annotationSaved = ref(false)
const annotationFormHidden = ref(false)
const annotationFormApplying = ref(false)
const annotationSubmitting = ref(false)
const annotationViewState = ref<AnnotationViewState | null>(null)
const annotationModeEntryViewState = ref<AnnotationViewState | null>(null)
const mixModeEntryViewState = ref<AnnotationViewState | null>(null)
const annotationSelectedKey = ref('')
const annotationStashKeyOverride = ref('')
const annotationEditingId = ref<number | null>(null)
const annotationLoading = ref(false)
const annotationRequestId = ref(0)
const annotationScreenshotUrlMap = new Map<number, string>()
const annotationStash = ref(new Map<string, AnnotationStashPayload>())
const annotationScreenshotUrls = computed(() =>
  annotationForm.screenshots.map((item) => item.url),
)
const annotationHasContent = computed(() => {
  return (
    Boolean(annotationForm.title.trim()) ||
    annotationForm.period.length > 0 ||
    Boolean(annotationForm.severity) ||
    Boolean(annotationForm.componentId.trim()) ||
    Boolean(annotationForm.componentName.trim()) ||
    Boolean(annotationForm.componentType.trim()) ||
    Boolean(annotationForm.remark.trim()) ||
    annotationForm.screenshots.length > 0
  )
})
const annotationStatus = computed<'default' | 'editing' | 'saved'>(() => {
  if (!annotationPoint.value) return 'default'
  if (annotationSaved.value) return 'saved'
  if (annotationHasContent.value) return 'editing'
  return 'default'
})
const annotationPersist = computed(() => {
  if (annotationSaved.value || annotationHasContent.value) return true
  const key = getAnnotationKey(annotationPoint.value, annotationSource.value)
  return Boolean(key && annotationStash.value.has(key))
})
const getAnnotationPayloadStatus = (
  payload: AnnotationStashPayload,
): 'default' | 'editing' | 'saved' => {
  if (payload.saved) return 'saved'
  if (
    Boolean(payload.title.trim()) ||
    payload.period.length > 0 ||
    Boolean(payload.severity) ||
    Boolean(payload.componentId.trim()) ||
    Boolean(payload.componentName.trim()) ||
    Boolean(payload.componentType.trim()) ||
    Boolean(payload.remark.trim()) ||
    payload.screenshots.length > 0
  ) {
    return 'editing'
  }
  return 'default'
}
const annotationKeyPrefix = 'annotation:'
const buildAnnotationKey = (annotationId: number) =>
  `${annotationKeyPrefix}${annotationId}`
const parseAnnotationIdFromKey = (key: string) => {
  if (!key || !key.startsWith(annotationKeyPrefix)) return null
  const raw = key.slice(annotationKeyPrefix.length)
  const id = Number(raw)
  return Number.isFinite(id) ? id : null
}

const resolveRouteAnnotationId = () => {
  if (routeFocusAnnotationId.value) return routeFocusAnnotationId.value
  return parseAnnotationIdFromKey(routeFocusAnnotationKey.value)
}

const clearRouteAnnotationFocus = () => {
  routeFocusAnnotationId.value = null
  routeFocusAnnotationKey.value = ''
  routeReplayToken.value = ''
}

const getFirstSavedAnnotationKey = () => {
  for (const [key, payload] of annotationStash.value) {
    if (key.startsWith(annotationKeyPrefix) && payload.saved) {
      return key
    }
  }
  return ''
}

const focusAnnotationKeyInList = (key: string) => {
  if (!annotationStash.value.has(key)) return
  handleAnnotationSelect(key)
  nextTick(() => {
    if (annotationSelectedKey.value !== key && annotationStash.value.has(key)) {
      handleAnnotationSelect(key)
    }
  })
}

const canApplyAnnotationViewStateNow = () => {
  if (modeState.value !== 'annotation') return false
  if (viewVisibility.rvt && !bimModelLoaded.value) return false
  if (viewVisibility.pointcloud && !pointcloudLoaded.value) return false
  return true
}

const hasDeferredAnnotationViewStatePending = (
  state?: AnnotationViewState | null,
) => {
  if (!state || modeState.value !== 'annotation') return false
  if (
    viewVisibility.gaussian &&
    boundGaussFileId.value &&
    !gaussianModelLoaded.value
  ) {
    return true
  }
  if (
    viewVisibility.consistencyResult &&
    !['loaded', 'optional'].includes(consistencyResultReadyState.value)
  ) {
    return true
  }
  return false
}

const replayAnnotationViewStateWhenReady = (key: string) => {
  pendingViewStateReplayKey.value = key
  if (annotationSelectedKey.value !== key) return
  if (!canApplyAnnotationViewStateNow()) return
  const stashed = annotationStash.value.get(key)
  if (!stashed?.viewState) {
    pendingViewStateReplayKey.value = ''
    return
  }
  applyAnnotationViewState(stashed.viewState)
  if (!hasDeferredAnnotationViewStatePending(stashed.viewState)) {
    pendingViewStateReplayKey.value = ''
  }
}

const annotationActiveKey = computed(
  () =>
    annotationSelectedKey.value ||
    annotationStashKeyOverride.value ||
    getAnnotationKey(annotationPoint.value, annotationSource.value),
)
const annotationActiveId = computed(() => {
  if (annotationEditingId.value) return annotationEditingId.value
  return parseAnnotationIdFromKey(annotationActiveKey.value)
})
const annotationStashMarkers = computed(() => {
  const markers = {
    bim: [] as AnnotationMarker[],
    pointcloud: [] as AnnotationMarker[],
    gaussian: [] as AnnotationMarker[],
    consistencyResult: [] as AnnotationMarker[],
  }
  if (!isAnnotationMode.value) return markers
  const currentKey = annotationActiveKey.value
  const shouldSyncMarkers =
    bimPointcloudSync.value || modeState.value === 'annotation'
  annotationStash.value.forEach((payload, key) => {
    if (key === currentKey) return
    const highlighted = key === annotationSelectedKey.value
    const status = getAnnotationPayloadStatus(payload)
    if (payload.source === 'bim') {
      markers.bim.push({
        key,
        point: payload.point,
        status,
        highlighted,
        synced: false,
        source: 'bim',
      })
      if (shouldSyncMarkers) {
        markers.pointcloud.push({
          key,
          point: payload.point,
          status,
          highlighted,
          synced: true,
          source: 'pointcloud',
        })
        markers.gaussian.push({
          key,
          point: payload.point,
          status,
          highlighted,
          synced: true,
          source: 'gaussian',
        })
        markers.consistencyResult.push({
          key,
          point: payload.point,
          status,
          highlighted,
          synced: true,
          source: 'consistencyResult',
        })
      }
    } else if (payload.source === 'pointcloud') {
      markers.pointcloud.push({
        key,
        point: payload.point,
        status,
        highlighted,
        synced: false,
        source: 'pointcloud',
      })
      if (shouldSyncMarkers) {
        markers.bim.push({
          key,
          point: payload.point,
          status,
          highlighted,
          synced: true,
          source: 'bim',
        })
        markers.gaussian.push({
          key,
          point: payload.point,
          status,
          highlighted,
          synced: true,
          source: 'gaussian',
        })
        markers.consistencyResult.push({
          key,
          point: payload.point,
          status,
          highlighted,
          synced: true,
          source: 'consistencyResult',
        })
      }
    } else if (payload.source === 'gaussian') {
      markers.gaussian.push({
        key,
        point: payload.point,
        status,
        highlighted,
        synced: false,
        source: 'gaussian',
      })
      if (shouldSyncMarkers) {
        markers.bim.push({
          key,
          point: payload.point,
          status,
          highlighted,
          synced: true,
          source: 'bim',
        })
        markers.pointcloud.push({
          key,
          point: payload.point,
          status,
          highlighted,
          synced: true,
          source: 'pointcloud',
        })
        markers.consistencyResult.push({
          key,
          point: payload.point,
          status,
          highlighted,
          synced: true,
          source: 'consistencyResult',
        })
      }
    } else {
      markers.consistencyResult.push({
        key,
        point: payload.point,
        status,
        highlighted,
        synced: false,
        source: 'consistencyResult',
      })
      if (shouldSyncMarkers) {
        markers.bim.push({
          key,
          point: payload.point,
          status,
          highlighted,
          synced: true,
          source: 'bim',
        })
        markers.pointcloud.push({
          key,
          point: payload.point,
          status,
          highlighted,
          synced: true,
          source: 'pointcloud',
        })
        markers.gaussian.push({
          key,
          point: payload.point,
          status,
          highlighted,
          synced: true,
          source: 'gaussian',
        })
      }
    }
  })
  return markers
})
const annotationStashMarkersMix = computed(() => [
  ...annotationStashMarkers.value.bim,
  ...annotationStashMarkers.value.pointcloud,
  ...annotationStashMarkers.value.gaussian,
])
const annotationPointForBim = computed(() => {
  if (!isAnnotationMode.value) return null
  if (!annotationPoint.value) return null
  if (!bimPointcloudSync.value) {
    return annotationSource.value === 'bim' ? annotationPoint.value : null
  }
  return annotationPoint.value
})
const annotationPointForPointcloud = computed(() => {
  if (!isAnnotationMode.value) return null
  if (!annotationPoint.value) return null
  if (!bimPointcloudSync.value) {
    return annotationSource.value === 'pointcloud'
      ? annotationPoint.value
      : null
  }
  return annotationPoint.value
})
const annotationPointForGaussian = computed(() => {
  if (!isAnnotationMode.value) return null
  if (!annotationPoint.value) return null
  if (!bimPointcloudSync.value) {
    return annotationSource.value === 'gaussian' ? annotationPoint.value : null
  }
  return annotationPoint.value
})
const annotationPointForConsistency = computed(() => {
  if (!isAnnotationMode.value) return null
  if (!annotationPoint.value) return null
  if (!bimPointcloudSync.value) {
    return annotationSource.value === 'consistencyResult'
      ? annotationPoint.value
      : null
  }
  return annotationPoint.value
})
const annotationHighlightCurrent = computed(
  () =>
    Boolean(annotationSelectedKey.value) &&
    annotationSelectedKey.value === annotationActiveKey.value,
)
const annotationSavedList = computed(() => {
  const list: {
    key: string
    title: string
    period: string[]
    severity: string
    source: AnnotationSource
    componentId: string
    componentName: string
    componentType: string
    remark: string
    screenshotUrls: string[]
  }[] = []
  annotationStash.value.forEach((payload, key) => {
    if (!payload.saved) return
    list.push({
      key,
      title: payload.title.trim() || '未命名工单',
      period: [...payload.period],
      severity: payload.severity,
      source: payload.source,
      componentId: payload.componentId || '',
      componentName: payload.componentName || '',
      componentType: payload.componentType || '',
      remark: payload.remark || '',
      screenshotUrls: payload.screenshots.map((item) => item.url),
    })
  })
  return list
})
const inviteAnnotationTitle = computed(() => {
  const target = annotationSavedList.value.find(
    (item) => item.key === inviteAnnotationKeys.value[0],
  )
  return target?.title || ''
})
const canGenerateReport = computed(
  () =>
    Boolean(projectId.value) &&
    Boolean(activeScanId.value) &&
    Boolean(scanCalibration.value?.calibrated) &&
    annotationSavedList.value.length > 0,
)
const annotationFormRules: FormRules = {
  title: [{ required: true, message: '请输入工单名称', trigger: 'blur' }],
  period: [
    {
      required: true,
      type: 'array',
      message: '请选择整改周期',
      trigger: 'change',
    },
  ],
  severity: [{ required: true, message: '请选择严重等级', trigger: 'change' }],
}
const annotationPeriodDisabledDate = (date: Date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date.getTime() < today.getTime()
}
const annotationFormLocked = ref(false)
const annotationFormEl = ref<HTMLDivElement | null>(null)
const annotationAnchor = ref<{ x: number; y: number } | null>(null)
const annotationFormManualPos = ref<{ x: number; y: number } | null>(null)
const annotationFormDragging = ref(false)
const annotationFormDragOffset = ref({ x: 0, y: 0 })
const annotationFormSize = ref({ width: 260, height: 180 })
const screenshotOverlayVisible = ref(false)
const screenshotLoading = ref(false)
const annotationScreenshotSupplementPendingCount = ref(0)
const annotationScreenshotSupplementPending = computed(
  () => annotationScreenshotSupplementPendingCount.value > 0,
)
const screenshotToolRef = ref<InstanceType<typeof AnnotationScreenshot> | null>(
  null,
)
let annotationScreenshotSupplementQueue: Promise<void> = Promise.resolve()
const showAnnotationLabels = computed(
  () =>
    modeState.value === 'annotation' &&
    !annotationMaskVisible.value &&
    layoutMode.value === 'double-horizontal' &&
    viewVisibility.rvt &&
    viewVisibility.pointcloud &&
    !viewVisibility.gaussian &&
    !viewVisibility.consistencyResult,
)
const annotationFormVisible = computed(
  () =>
    !annotationFormLocked.value &&
    !annotationFormHidden.value &&
    !screenshotOverlayVisible.value &&
    !screenshotLoading.value &&
    isAnnotationMode.value &&
    Boolean(annotationPoint.value),
)
const annotationFormStyle = computed(() => {
  const container = twoScreenContainerEl.value
  if (!container) {
    return {
      left: '16px',
      top: '16px',
      maxHeight: 'calc(100vh - 32px)',
    }
  }
  const anchor = annotationAnchor.value

  const rect = container.getBoundingClientRect()
  const offset = 12
  const maxHeight = Math.max(240, rect.height - 16)
  const { width, height } = annotationFormSize.value
  if (annotationFormManualPos.value) {
    const clamped = clampAnnotationFormPosition(
      annotationFormManualPos.value.x,
      annotationFormManualPos.value.y,
    )
    return {
      left: `${clamped.left}px`,
      top: `${clamped.top}px`,
      maxHeight: `${maxHeight}px`,
    }
  }

  if (!anchor) {
    return {
      left: '16px',
      top: '16px',
      maxHeight: `${maxHeight}px`,
    }
  }

  let left = anchor.x + offset
  const top = anchor.y - Math.min(height, maxHeight) / 2

  if (left + width + offset > rect.width) {
    left = anchor.x - width - offset
  }

  const clamped = clampAnnotationFormPosition(left, top)

  return {
    left: `${clamped.left}px`,
    top: `${clamped.top}px`,
    maxHeight: `${maxHeight}px`,
  }
})
const canEnterMixMode = computed(() => {
  if (modeState.value !== 'annotation') return false
  if (viewVisibility.rvt && !bimModelLoaded.value) return false
  if (viewVisibility.pointcloud && !pointcloudLoaded.value) return false
  if (viewVisibility.gaussian && !gaussianModelLoaded.value) return false
  if (
    viewVisibility.consistencyResult &&
    !['loaded', 'optional'].includes(consistencyResultReadyState.value)
  ) {
    return false
  }
  return true
})
const annotationCapturePendingText = computed(() => {
  if (!annotationScreenshotSupplementPending.value) return ''
  if (modeState.value !== 'mix') return '截图仍在处理中，请稍后再暂存或提交。'
  if (consistencyResultReadyState.value === 'pending') {
    return '截图补齐中，正在加载并生成实模一致结果截图，请稍后再暂存或提交。'
  }
  return '截图补齐中，正在生成附加视图截图，请稍后再暂存或提交。'
})
const modeVisualState = computed(() =>
  modeState.value === 'annotation' ? 'free' : modeState.value,
)
const linkSyncMode = ref<'off' | 'synced'>('off')
const quadRotationSyncActive = computed(
  () =>
    linkSyncMode.value === 'synced' &&
    layoutMode.value === 'quad' &&
    modeState.value === 'free',
)
const bimPointcloudSync = ref(false)
const currentImageInfo = ref<any | null>(null)
const panoramaCameraRot = ref({ lon: 0, lat: 0 })
const panoramaFov = ref<number | null>(null)
const timeRange = ref<{ start: number; end: number } | null>(null)
const headerRangeValue = ref<[string, string] | ''>('')
const trajectoryData = ref<TrajectoryInfo | null>(null)
const alignment = ref<AlignmentResult | null>(null)
const dxfBlobUrl = ref<string | null>(null)
const bimPointcloudCalibration = ref<BimPointcloudCalibration | null>(null)
const pointcloudWorldMatrix = ref<number[] | null>(null)
const mixConsistencyCameraPose = ref<AnnotationCameraPose | null>(null)
const mixConsistencyPointcloudWorldMatrix = ref<number[] | null>(null)
const lastTrajectoryPoint = ref<TrajectoryPoint | null>(null)
const mixCaptureSyncIntervalMs = 80
const mixCapturePoseEpsilon = 1e-4
const mixCaptureMatrixEpsilon = 1e-5
let mixCaptureSyncRafId = 0
let mixCaptureSyncTimerId: number | null = null
let lastMixCaptureSyncAt = 0
let pendingMixCapturePose: AnnotationCameraPose | null | undefined
let pendingMixCapturePointcloudWorldMatrix: number[] | null | undefined
// 模型加载完成后，继续用高斯当前相机统一 BIM / 点云视角。
const gaussianSharedPoseSyncEnabled = true
// 点击图纸轨迹点时，联动全景图 / 高斯 / 点云 / BIM 一起跳转。
const trajectoryPointSyncEnabled = true
const shouldAutoApplyTrajectoryPose = () =>
  trajectoryPointSyncEnabled && modeState.value !== 'annotation'
const gaussianTrajectorySyncDurationMs = 1800
const warnedMissingCalibration = ref(false)
let lastRelativeTransformLogKey = ''
let gaussianTrajectorySyncAnimationId = 0
const bimModelLoaded = ref(false)
const gaussianModelLoaded = ref(false)
const pointcloudLoaded = ref(false)
const consistencyResultLoaded = ref(false)
const consistencyResultReadyState = ref<
  'pending' | 'loaded' | 'optional' | 'error'
>('pending')
const pendingViewStateReplayKey = ref('')
const lastBimRot = ref<{ lon: number; lat: number } | null>(null)
let applyingQuadRotationSync = false
let suppressQuadRotationBroadcastUntil = 0
type QuadSyncSource = 'panorama' | 'bim' | 'pointcloud' | 'gaussian'
const quadSyncBaseRotations: Record<
  QuadSyncSource,
  { lon: number; lat: number } | null
> = {
  panorama: null,
  bim: null,
  pointcloud: null,
  gaussian: null,
}
const lastQuadBroadcastRotations: Record<
  QuadSyncSource,
  { lon: number; lat: number } | null
> = {
  panorama: null,
  bim: null,
  pointcloud: null,
  gaussian: null,
}
const blendValue = ref(1)
const blendTrackRef = ref<HTMLElement | null>(null)
const blendStyle = computed(() => ({
  '--blend-pos': `${Math.round(blendValue.value * 100)}%`,
}))
const mixBimOpacity = computed(() =>
  Number(Math.min(1, Math.max(0, blendValue.value)).toFixed(3)),
)
const twoScreenContainerEl = ref<HTMLDivElement | null>(null)
const miniMapEl = ref<HTMLDivElement | null>(null)
const smallWindowRef = ref()
const miniMapPos = ref({ x: 0, y: 0 })
const isMiniMapDragging = ref(false)
const miniMapDragOffset = ref({ x: 0, y: 0 })
const miniMapStyle = computed(() => ({
  left: `${miniMapPos.value.x}px`,
  top: `${miniMapPos.value.y}px`,
}))
const nowValue = ref(Date.now())
let nowTimer: number | null = null

watch(
  quadRotationSyncActive,
  (active) => {
    if (!active && linkSyncMode.value !== 'off') {
      linkSyncMode.value = 'off'
    }
  },
  { immediate: true },
)

const syncRouteFocusTarget = () => {
  routeFocusScanId.value = parseQueryNumber(route.query.scanFileId)
  routeFocusAnnotationId.value = parseQueryNumber(route.query.annotationId)
  routeFocusAnnotationKey.value = parseQueryText(route.query.annotationKey)
  routeReplayToken.value = parseQueryText(route.query.replayToken)
}

const hasRouteAnnotationReplayTarget = () =>
  Boolean(
    routeFocusAnnotationId.value ||
      routeFocusAnnotationKey.value ||
      routeReplayToken.value,
  )

const dayMs = 24 * 60 * 60 * 1000

const formatDateOnly = (timestamp: number) => {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const startOfDayTimestamp = (timestamp: number) => {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const buildScanQueryDateRange = (range: { start: number; end: number }) => {
  const fromTs = startOfDayTimestamp(range.start)
  const endDayStart = startOfDayTimestamp(range.end)
  const isEndAtDayStart = range.end === endDayStart
  const toTs = isEndAtDayStart ? endDayStart : endDayStart + dayMs
  const safeToTs = toTs <= fromTs ? fromTs + dayMs : toTs
  return {
    from: formatDateOnly(fromTs),
    to: formatDateOnly(safeToTs),
  }
}

const formatDateTime = (timestamp: number) => {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  const seconds = `${date.getSeconds()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

const parseDateOnly = (value: string) => {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  const time = date.getTime()
  return Number.isNaN(time) ? null : time
}

watch(
  timeRange,
  (range) => {
    if (!range) {
      headerRangeValue.value = ''
      return
    }
    headerRangeValue.value = [
      formatDateTime(range.start),
      formatDateTime(range.end),
    ]
  },
  { immediate: true },
)

const isCalibrated = (item: ScanListItem) => Boolean(item.calibrated)

const getScanTimestamp = (item: ScanListItem) =>
  parseDateOnly(item.producedAt || '') ?? -1

const pickLatestScan = (items: ScanListItem[]) => {
  if (items.length === 0) return null
  return items.reduce((best, item) => {
    const bestTime = getScanTimestamp(best)
    const itemTime = getScanTimestamp(item)
    if (itemTime !== bestTime) return itemTime > bestTime ? item : best
    return item.scanFileId > best.scanFileId ? item : best
  })
}

const scanBuildingSlots = computed<ScanBuildingSlot[]>(() =>
  buildScanBuildingSlots(scanList.value, scanSwitchableMap.value),
)

const selectedScanBuildingEntry = computed(
  () =>
    scanBuildingSlots.value.find(
      (item) => item.buildingName === selectedBuildingName.value,
    ) ?? null,
)

const headerBuildingOptions = computed<HeaderSelectOption[]>(() =>
  scanBuildingSlots.value.map((item) => ({
    label: item.buildingName,
    value: item.buildingName,
    disabled: item.floors.every((floor) => floor.disabled),
  })),
)

const headerFloorOptions = computed<HeaderSelectOption[]>(() =>
  (selectedScanBuildingEntry.value?.floors ?? []).map((item) => ({
    label: item.floorName,
    value: item.floorName,
    disabled: item.disabled,
  })),
)

const getActiveScanRecord = () =>
  scanList.value.find((item) => item.scanFileId === activeScanId.value) ?? null

const sortScansByLatest = (items: ScanListItem[]) =>
  [...items].sort((left, right) => {
    const diff = getScanTimestamp(right) - getScanTimestamp(left)
    if (diff !== 0) return diff
    return right.scanFileId - left.scanFileId
  })

const getLatestSlotScans = (items: ScanListItem[]) =>
  buildScanBuildingSlots(items, {})
    .flatMap((building) =>
      building.floors
        .map((floor) => floor.latestScan)
        .filter((scan): scan is ScanListItem => Boolean(scan)),
    )
    .sort((left, right) => {
      const diff = getScanTimestamp(right) - getScanTimestamp(left)
      if (diff !== 0) return diff
      return right.scanFileId - left.scanFileId
    })

const loadProjectFileGroups = async (project: number) => {
  const response = await getProjectFilesByProjectId(project)
  if (response.code !== 200 || !Array.isArray(response.data)) {
    throw new Error(response.msg || '项目文件列表查询失败')
  }
  projectFileGroups.value = response.data
  return response.data
}

const ensureProjectFileGroups = async () => {
  if (!projectId.value) return [] as FileTypeGroup[]
  if (projectFileGroups.value.length) return projectFileGroups.value
  return loadProjectFileGroups(projectId.value)
}

const evaluateScanReadiness = async (
  scan: ScanListItem,
  options?: { requireGauss?: boolean },
) => {
  if (!projectId.value) return false
  const groups = await ensureProjectFileGroups()
  if (!isProjectFileReady(groups, 'scan', scan.scanFileId)) {
    return false
  }

  const response = await getScanCalibration(projectId.value, scan.scanFileId)
  const data = response.code === 200 ? response.data : null
  const scanBuildingName = normalizeSlotName(scan.buildingName)
  const scanFloorName = normalizeSlotName(scan.floorName)
  const matchedCad =
    Boolean(data?.hasCadAlignment) &&
    Boolean(data?.cadFileId) &&
    normalizeSlotName(data?.cadBuildingName) === scanBuildingName &&
    isProjectFileReady(groups, 'cad', data?.cadFileId)
  const matchedBim =
    Boolean(data?.hasBimAlignment) &&
    Boolean(data?.bimFileId) &&
    normalizeSlotName(data?.bimBuildingName) === scanBuildingName &&
    isProjectFileReady(groups, 'bim', data?.bimFileId)
  const matchedGauss =
    Boolean(data?.hasGaussBinding) &&
    Boolean(data?.gaussFileId) &&
    normalizeSlotName(data?.gaussBuildingName) === scanBuildingName &&
    normalizeSlotName(data?.gaussFloorName) === scanFloorName &&
    isProjectFileReady(groups, 'gauss', data?.gaussFileId)

  if (options?.requireGauss) {
    return matchedCad && matchedBim && matchedGauss
  }

  return matchedCad && matchedBim && (!data?.hasGaussBinding || matchedGauss)
}

const createCachedScanReadinessChecker = (
  cacheRef: typeof scanSwitchableMap,
  requestMap: Map<number, Promise<boolean>>,
  options?: { requireGauss?: boolean; logLabel?: string },
) => {
  return async (scan: ScanListItem) => {
    if (!projectId.value) return false
    const cached = cacheRef.value[scan.scanFileId]
    if (typeof cached === 'boolean') return cached
    const existingRequest = requestMap.get(scan.scanFileId)
    if (existingRequest) return existingRequest

    const request = (async () => {
      try {
        const ready = await evaluateScanReadiness(scan, {
          requireGauss: options?.requireGauss,
        })
        cacheRef.value = {
          ...cacheRef.value,
          [scan.scanFileId]: ready,
        }
        return ready
      } catch (error) {
        cacheRef.value = {
          ...cacheRef.value,
          [scan.scanFileId]: false,
        }
        return false
      } finally {
        requestMap.delete(scan.scanFileId)
      }
    })()

    requestMap.set(scan.scanFileId, request)
    return request
  }
}

const isScanSwitchableForFourScreen = createCachedScanReadinessChecker(
  scanSwitchableMap,
  scanSwitchableRequestMap,
  { logLabel: '校验扫描切换状态' },
)

const isScanReadyForLatest = createCachedScanReadinessChecker(
  scanLatestReadyMap,
  scanLatestReadyRequestMap,
  {
    requireGauss: true,
    logLabel: '校验最近一次扫描状态',
  },
)

const warmupScanSwitchableState = async (items: ScanListItem[]) => {
  const latestSlotScans = getLatestSlotScans(items)
  await Promise.all(
    latestSlotScans.map((item) => isScanSwitchableForFourScreen(item)),
  )
}

const warmupLatestReadyState = async (items: ScanListItem[]) => {
  const latestSlotScans = getLatestSlotScans(items)
  await Promise.all(latestSlotScans.map((item) => isScanReadyForLatest(item)))
}

const findScanBuildingSlot = (buildingName: string) =>
  scanBuildingSlots.value.find(
    (item) => item.buildingName === normalizeSlotName(buildingName),
  ) ?? null

const findScanFloorSlot = (buildingName: string, floorName: string) => {
  const building = findScanBuildingSlot(buildingName)
  if (!building) return null
  return (
    building.floors.find(
      (item) => item.floorName === normalizeSlotName(floorName),
    ) ?? null
  )
}

const getPreferredHeaderSelection = () => {
  const activeScan = getActiveScanRecord()
  return {
    building: normalizeSlotName(
      activeScan?.buildingName || scanCalibration.value?.bimBuildingName,
    ),
    floor: normalizeSlotName(
      activeScan?.floorName || scanCalibration.value?.cadFloorName,
    ),
  }
}

const syncHeaderSelectionFromActiveScan = () => {
  const selection = getPreferredHeaderSelection()
  selectedBuildingName.value = selection.building
  selectedFloorName.value = selection.floor
}

const resolveSwitchableFloorName = (
  buildingName: string,
  preferredFloorName?: string,
) => {
  const building = findScanBuildingSlot(buildingName)
  if (!building) return ''
  const normalizedFloorName = normalizeSlotName(preferredFloorName)
  const preferred = building.floors.find(
    (item) => item.floorName === normalizedFloorName && !item.disabled,
  )
  if (preferred) return preferred.floorName
  return building.floors.find((item) => !item.disabled)?.floorName ?? ''
}

const findSwitchableScanForSlot = async (
  buildingName: string,
  floorName: string,
) => {
  const slot = findScanFloorSlot(buildingName, floorName)
  if (!slot) return null
  if (slot.latestReadyScan) return slot.latestReadyScan
  for (const scan of sortScansByLatest(slot.scans)) {
    const canSwitch = await isScanSwitchableForFourScreen(scan)
    if (canSwitch) return scan
  }
  return null
}

const scanSegments = computed<ScanSegment[]>(() => {
  const grouped = new Map<string, ScanListItem[]>()
  scanList.value.forEach((item) => {
    if (!item.producedAt) return
    if (!grouped.has(item.producedAt)) grouped.set(item.producedAt, [])
    grouped.get(item.producedAt)!.push(item)
  })

  const segments = Array.from(grouped.entries())
    .map(([date, items]) => {
      const start = parseDateOnly(date)
      if (!start) return null
      const switchableItems = items.filter(
        (item) => scanSwitchableMap.value[item.scanFileId] === true,
      )
      const calibratedItems =
        switchableItems.length > 0
          ? switchableItems
          : items.filter(isCalibrated)
      const pickFrom = calibratedItems.length > 0 ? calibratedItems : items
      const selected = pickLatestScan(pickFrom)
      if (!selected) return null
      return {
        start,
        end: start + dayMs - 1,
        status: calibratedItems.length > 0 ? 'calibrated' : 'uncalibrated',
        scanFileId: selected.scanFileId,
      }
    })
    .filter(Boolean) as ScanSegment[]

  if (!timeRange.value) return segments
  return segments.filter(
    (segment) =>
      segment.end >= timeRange.value!.start &&
      segment.start <= timeRange.value!.end,
  )
})

const buildRangeFromScans = (items: ScanListItem[]) => {
  const dates = items
    .map((item) => parseDateOnly(item.producedAt || ''))
    .filter((value): value is number => typeof value === 'number' && value > 0)
  if (dates.length === 0) return null
  const min = Math.min(...dates)
  const max = Math.max(...dates)
  return { start: min, end: max + dayMs - 1 }
}

const buildDayRangeFromScan = (item: ScanListItem | null) => {
  if (!item?.producedAt) return null
  const start = parseDateOnly(item.producedAt)
  if (!start) return null
  return { start, end: start + dayMs - 1 }
}

const filterScansByRange = (
  items: ScanListItem[],
  range?: { start: number; end: number } | null,
) => {
  return range
    ? items.filter((item) => {
        const ts = getScanTimestamp(item)
        return ts >= range.start && ts <= range.end
      })
    : items
}

const findFirstSwitchableScan = async (
  items: ScanListItem[],
  range?: { start: number; end: number } | null,
) => {
  const candidates = sortScansByLatest(filterScansByRange(items, range))
  for (const item of candidates) {
    const canSwitch = await isScanSwitchableForFourScreen(item)
    if (canSwitch) return item.scanFileId
  }
  return null
}

const findLatestFullReadyScan = async (
  items: ScanListItem[],
  range?: { start: number; end: number } | null,
) => {
  const candidates = sortScansByLatest(filterScansByRange(items, range))
  for (const item of candidates) {
    const ready = await isScanReadyForLatest(item)
    if (ready) return item.scanFileId
  }
  return null
}

const fetchProjectScanList = async (
  project: number,
  from?: string,
  to?: string,
) => {
  const all: ScanListItem[] = []
  let page = 1
  const pageSize = 200

  while (true) {
    const response = await getProjectScans(project, {
      from,
      to,
      page,
      pageSize,
    })
    if (response.code !== 200) {
      throw new Error(response.msg || '加载扫描记录失败')
    }
    const list = response.data?.list || []
    const total = response.data?.total ?? list.length
    all.push(...list)
    if (all.length >= total || list.length === 0) break
    page += 1
  }

  return all
}

const loadScanList = async (
  range?: { start: number; end: number } | null,
  options?: { preferLatestFullReady?: boolean },
) => {
  if (!projectId.value) return
  const requestId = ++scanRequestId.value
  scanLoading.value = true
  const queryDateRange = range ? buildScanQueryDateRange(range) : null
  const from = queryDateRange?.from
  const to = queryDateRange?.to

  try {
    const list = await fetchProjectScanList(projectId.value, from, to)
    if (scanRequestId.value !== requestId) return
    scanList.value = list
    void warmupScanSwitchableState(list)
    void warmupLatestReadyState(list)

    const latestReadyScan = pickLatestScan(list.filter(isCalibrated))
    const latestScan = latestReadyScan ?? pickLatestScan(list)
    const routeScan = routeFocusScanId.value
      ? list.find((item) => item.scanFileId === routeFocusScanId.value)
      : null
    const fallbackRange =
      buildDayRangeFromScan(routeScan) ??
      buildDayRangeFromScan(latestScan) ??
      buildRangeFromScans(list)
    const nextRange = range ?? fallbackRange

    const isUserRange = Boolean(range && userSelectedRange.value)
    if (isUserRange) {
      const hasCalibrated = list.some((item) => isCalibrated(item))
      if (!hasCalibrated) {
        ElMessage.warning('该时间范围内暂无已校准扫描')
      }
    }

    let nextScanId = options?.preferLatestFullReady
      ? await findLatestFullReadyScan(list, nextRange ?? undefined)
      : await findFirstSwitchableScan(list, nextRange ?? undefined)
    if (routeFocusScanId.value) {
      if (routeScan && hasRouteAnnotationReplayTarget()) {
        nextScanId = routeFocusScanId.value
        routeFocusScanId.value = null
      } else if (
        routeScan &&
        (await isScanSwitchableForFourScreen(routeScan))
      ) {
        nextScanId = routeFocusScanId.value
        routeFocusScanId.value = null
      }
    }
    const targetScan =
      list.find((item) => item.scanFileId === nextScanId) ?? latestScan
    timeRange.value =
      range ?? buildDayRangeFromScan(targetScan) ?? fallbackRange
    if (nextScanId) {
      activeScanId.value = nextScanId
    } else {
      activeScanId.value = null
      const message = options?.preferLatestFullReady
        ? '当前项目暂无同时具备 BIM、CAD、gauss 的扫描'
        : isUserRange
          ? '该时间范围内暂无已校准扫描'
          : '当前项目暂无可用于四分屏的已校准扫描'
      ElMessage.warning(message)
    }
  } catch (error: any) {
    if (scanRequestId.value !== requestId) return
    ElMessage.error(error?.message || '加载扫描记录失败')
    scanList.value = []
    activeScanId.value = null
    timeRange.value = range ?? null
  } finally {
    if (scanRequestId.value === requestId) {
      scanLoading.value = false
    }
  }
}

const resetAnnotationData = () => {
  clearAnnotationScreenshotUrls()
  annotationStash.value = new Map()
  annotationSelectedKey.value = ''
  annotationStashKeyOverride.value = ''
  annotationEditingId.value = null
  pendingViewStateReplayKey.value = ''
}

const loadAnnotationList = async () => {
  if (!projectId.value || !activeScanId.value) return
  const requestId = ++annotationRequestId.value
  annotationLoading.value = true
  try {
    const res = await getAnnotationList(projectId.value, activeScanId.value, {
      page: 1,
      pageSize: 200,
    })
    if (res.code !== 200) {
      throw new Error(res.msg || '加载批注列表失败')
    }
    if (annotationRequestId.value !== requestId) return
    const list = res.data?.list || []
    const prev = annotationStash.value
    const next = new Map<string, AnnotationStashPayload>()
    prev.forEach((payload, key) => {
      if (!payload.saved || !key.startsWith(annotationKeyPrefix)) {
        next.set(key, payload)
      }
    })
    list.forEach((item) => {
      const key = buildAnnotationKey(item.id)
      const existing = prev.get(key)
      next.set(key, buildAnnotationStashFromApi(item, existing))
    })
    prev.forEach((payload, key) => {
      if (
        payload.saved &&
        key.startsWith(annotationKeyPrefix) &&
        !next.has(key)
      ) {
        payload.screenshots.forEach((item) => {
          revokeAnnotationScreenshotUrl(item.id ?? item.fileId)
        })
      }
    })
    annotationStash.value = next
    if (annotationSelectedKey.value && !next.has(annotationSelectedKey.value)) {
      annotationSelectedKey.value = ''
    }
    if (
      annotationStashKeyOverride.value &&
      annotationStashKeyOverride.value.startsWith(annotationKeyPrefix) &&
      !next.has(annotationStashKeyOverride.value)
    ) {
      annotationStashKeyOverride.value = ''
    }
    if (annotationEditingId.value) {
      const activeKey = buildAnnotationKey(annotationEditingId.value)
      if (!next.has(activeKey)) {
        annotationEditingId.value = null
      }
    }
    await focusAnnotationFromRoute()
  } catch (error: any) {
    if (annotationRequestId.value !== requestId) return
    ElMessage.error(error?.message || '加载批注列表失败')
  } finally {
    if (annotationRequestId.value === requestId) {
      annotationLoading.value = false
    }
  }
}

const refreshAnnotationDetail = async (
  annotationId: number,
  options?: { applyToForm?: boolean },
) => {
  if (!projectId.value || !activeScanId.value) return null
  const res = await getAnnotationDetail(
    projectId.value,
    activeScanId.value,
    annotationId,
  )
  if (res.code !== 200) {
    throw new Error(res.msg || '加载批注详情失败')
  }
  const detail = res.data
  const key = buildAnnotationKey(detail.id)
  const existing = annotationStash.value.get(key)
  const payload = buildAnnotationStashFromApi(detail, existing)
  annotationStash.value.set(key, payload)
  if (options?.applyToForm && annotationActiveKey.value === key) {
    // 详情返回后同步点位与来源，纠正列表数据可能不完整导致的坐标偏差
    annotationPoint.value = { ...payload.point }
    annotationSource.value = payload.source
    annotationMaskVisible.value = false
    annotationFormHidden.value = false
    applyAnnotationStash(payload)
    updateAnnotationFormSize()
    annotationEditingId.value = payload.id ?? annotationEditingId.value
    nextTick(() => {
      applyAnnotationViewState(payload.viewState)
    })
    replayAnnotationViewStateWhenReady(key)
  }
  return payload
}

const fetchAnnotationScreenshotUrl = async (
  annotationId: number,
  screenshotId: number,
) => {
  const cached = annotationScreenshotUrlMap.get(screenshotId)
  if (cached) return cached
  if (!projectId.value || !activeScanId.value) return ''
  const blob = await getAnnotationScreenshotBlob(
    projectId.value,
    activeScanId.value,
    annotationId,
    screenshotId,
  )
  const url = URL.createObjectURL(blob)
  annotationScreenshotUrlMap.set(screenshotId, url)
  return url
}

const refreshAnnotationScreenshots = async (annotationId: number) => {
  if (!projectId.value || !activeScanId.value) return []
  const res = await getAnnotationScreenshots(
    projectId.value,
    activeScanId.value,
    annotationId,
  )
  if (res.code !== 200) {
    throw new Error(res.msg || '加载批注截图失败')
  }
  const screenshots: AnnotationScreenshotRecord[] = [...(res.data ?? [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  )
  const nextScreenshots: AnnotationScreenshotItem[] = []
  for (const shot of screenshots) {
    const screenshotId = resolveScreenshotResourceId(shot)
    const fallbackUrl = normalizeScreenshotUrl(shot.url)
    let resolvedUrl = fallbackUrl
    if (screenshotId) {
      try {
        resolvedUrl = await fetchAnnotationScreenshotUrl(
          annotationId,
          screenshotId,
        )
      } catch (error) {}
    }
    if (!resolvedUrl) continue
    nextScreenshots.push({
      id: shot.id,
      fileId: shot.fileId,
      url: resolvedUrl,
      originalName: shot.originalName,
      fileSize: shot.fileSize,
      sortOrder: shot.sortOrder,
    })
  }
  const key = buildAnnotationKey(annotationId)
  const existing = annotationStash.value.get(key)
  if (existing) {
    const shouldPreserveExisting =
      nextScreenshots.length === 0 && existing.screenshots.length > 0
    const finalScreenshots = shouldPreserveExisting
      ? existing.screenshots.map((item) => ({ ...item }))
      : nextScreenshots
    const nextIds = new Set(
      finalScreenshots
        .map((item) => item.id ?? item.fileId)
        .filter((id): id is number => !!id),
    )
    existing.screenshots.forEach((item) => {
      const screenshotId = item.id ?? item.fileId
      if (screenshotId && !nextIds.has(screenshotId)) {
        revokeAnnotationScreenshotUrl(screenshotId)
      }
    })
    const updated = { ...existing, screenshots: finalScreenshots }
    annotationStash.value.set(key, updated)
    if (annotationActiveKey.value === key) {
      annotationFormApplying.value = true
      annotationForm.screenshots = finalScreenshots.map((item) => ({ ...item }))
      nextTick(() => {
        annotationFormApplying.value = false
        updateAnnotationFormSize()
      })
    }
  }
  return nextScreenshots
}

const syncAnnotationScreenshotOrder = async (
  annotationId: number,
  screenshots?: AnnotationScreenshotItem[],
) => {
  if (!projectId.value || !activeScanId.value) return
  const items =
    screenshots ??
    annotationStash.value.get(buildAnnotationKey(annotationId))?.screenshots ??
    []
  const fileIds = items
    .map((item) => item.fileId)
    .filter((id): id is number => typeof id === 'number')
  if (!fileIds.length) return
  const res = await updateAnnotationScreenshotOrder(
    projectId.value,
    activeScanId.value,
    annotationId,
    fileIds,
  )
  if (res.code !== 200) {
    throw new Error(res.msg || '更新截图顺序失败')
  }
}

const applyLayoutByOrder = (viewOrder: PanelType[]) => {
  const activeViews = viewOrder.filter((view) => viewVisibility[view])
  if (activeViews.length === 0) {
    viewVisibility[viewOrder[0]] = true
    activeViews.push(viewOrder[0])
  }

  if (activeViews.length === 1) {
    layoutMode.value = 'single'
  } else if (activeViews.length === 2) {
    layoutMode.value = 'double-horizontal'
  } else if (activeViews.length === 3) {
    layoutMode.value = 'triple-left'
  } else {
    layoutMode.value = 'quad'
  }

  const nextContents: Record<string, PanelType | ''> = {
    panel1: '',
    panel2: '',
    panel3: '',
    panel4: '',
  }

  activeViews.forEach((view, index) => {
    const key = `panel${index + 1}`
    nextContents[key] = view
  })

  Object.assign(panelContents, nextContents)
}

const applyViewLayout = () => {
  applyLayoutByOrder(freeViewOrder)
}

const applyAnnotationViewLayout = () => {
  applyLayoutByOrder(annotationViewOrder)
}

const bumpDynamicPanelKey = () => {
  dynamicPanelKey.value += 1
}

const reloadVisiblePanels = () => {
  if (viewVisibility.rvt) {
    bimModelLoaded.value = false
  }
  if (viewVisibility.pointcloud) {
    pointcloudLoaded.value = false
  }
  if (viewVisibility.gaussian) {
    gaussianModelLoaded.value = false
  }
  if (viewVisibility.consistencyResult) {
    consistencyResultLoaded.value = false
    consistencyResultReadyState.value = 'pending'
  }

  nextTick(() => {
    window.setTimeout(() => {
      if (viewVisibility.rvt) {
        void loadBimModel(0, true)
      }
      if (viewVisibility.pointcloud) {
        void loadPointcloudModel(0, true)
      }
      if (viewVisibility.panorama) {
        void loadPanoramaImage(0, true)
      }
      if (viewVisibility.gaussian) {
        void loadGaussianModel(0, true)
      }
    }, 160)
  })
}

const getBimRef = () => dynamicPanelRef.value?.getBimRef?.() ?? null
const getPointcloudRef = () =>
  dynamicPanelRef.value?.getPointcloudRef?.() ?? null
const getPanoramaRef = () => dynamicPanelRef.value?.getPanoramaRef?.() ?? null
const getGaussianRef = () => dynamicPanelRef.value?.getGaussianRef?.() ?? null
const getConsistencyResultRef = () =>
  dynamicPanelRef.value?.getConsistencyResultRef?.() ??
  mixConsistencyResultRef.value ??
  mixViewerRef.value?.getConsistencyResultRef?.() ??
  null

const syncSharedPoseFromGaussian = () => {
  if (!gaussianSharedPoseSyncEnabled) return
  const pose = getGaussianRef()?.getCameraPose?.()
  if (!pose) return
  if (pointcloudLoaded.value) {
    getPointcloudRef()?.syncFromExternalPose?.(pose)
  }
  if (bimModelLoaded.value) {
    getBimRef()?.setCameraPose?.(pose)
  }
}

const syncSharedPoseFromTrajectoryPoint = (
  point: TrajectoryPoint | null | undefined,
) => {
  if (!point) return

  const gaussianPose = getGaussianRef()?.getCameraPose?.() ?? null
  const pose =
    gaussianPose ??
    (modeState.value === 'mix'
      ? buildGaussianTrajectoryYUpPose(point)
      : buildTrajectoryYUpPose(point))

  if (modeState.value === 'mix') {
    mixViewerRef.value?.setTrajectorySpawnPose?.(pose)
    mixViewerRef.value?.setCameraPose?.(pose)
    mixConsistencyCameraPose.value = toPlainPose(pose)
    return
  }

  if (pointcloudLoaded.value) {
    getPointcloudRef()?.syncFromExternalPose?.(pose)
  }
  if (bimModelLoaded.value) {
    getBimRef()?.setCameraPose?.(pose)
  }
}

const stopGaussianTrajectoryPoseSync = () => {
  if (!gaussianTrajectorySyncAnimationId) return
  cancelAnimationFrame(gaussianTrajectorySyncAnimationId)
  gaussianTrajectorySyncAnimationId = 0
}

const startGaussianTrajectoryPoseSync = (
  durationMs = gaussianTrajectorySyncDurationMs,
) => {
  stopGaussianTrajectoryPoseSync()
  const startAt = performance.now()

  const tick = () => {
    syncSharedPoseFromGaussian()
    if (performance.now() - startAt >= durationMs) {
      gaussianTrajectorySyncAnimationId = 0
      syncSharedPoseFromGaussian()
      return
    }
    gaussianTrajectorySyncAnimationId = requestAnimationFrame(tick)
  }

  tick()
}

const resetScanState = () => {
  const shouldRetryConsistencyResult =
    consistencyResultReadyState.value === 'optional' &&
    (modeState.value === 'annotation' || modeState.value === 'mix')
  trajectoryData.value = null
  alignment.value = null
  currentImageInfo.value = null
  lastTrajectoryPoint.value = null
  lastRelativeTransformLogKey = ''
  bimPointcloudCalibration.value = null
  pointcloudWorldMatrix.value = null
  scanCalibration.value = null
  selectedBuildingName.value = ''
  selectedFloorName.value = ''
  boundCadFileId.value = null
  boundBimFileId.value = null
  boundGaussFileId.value = null
  warnedMissingCalibration.value = false
  bimMetadata.value = null
  componentMetaByElementId.value = new Map()
  elementIdByStepId.value = new Map()
  consistencyResultLoaded.value = false
  consistencyResultReadyState.value = 'pending'
  if (shouldRetryConsistencyResult) {
    viewVisibility.consistencyResult = true
    if (modeState.value === 'annotation') {
      applyAnnotationViewLayout()
    }
  }
  if (dxfBlobUrl.value) {
    URL.revokeObjectURL(dxfBlobUrl.value)
    dxfBlobUrl.value = null
  }
}

const loadScanCalibration = async () => {
  if (!projectId.value || !activeScanId.value) {
    scanCalibration.value = null
    projectFileGroups.value = []
    boundCadFileId.value = null
    boundBimFileId.value = null
    boundGaussFileId.value = null
    return null
  }

  try {
    const [res, filesRes] = await Promise.all([
      getScanCalibration(projectId.value, activeScanId.value),
      getProjectFilesByProjectId(projectId.value),
    ])
    if (res.code !== 200) {
      throw new Error(res.msg || '获取扫描校准绑定失败')
    }
    scanCalibration.value = res.data
    const activeScan = getActiveScanRecord()
    const scanBuildingName = normalizeSlotName(activeScan?.buildingName)
    const scanFloorName = normalizeSlotName(activeScan?.floorName)
    const matchesScanBuilding = (value: string | null | undefined) =>
      Boolean(scanBuildingName && normalizeSlotName(value) === scanBuildingName)
    const matchesScanFloor = (value: string | null | undefined) =>
      Boolean(scanFloorName && normalizeSlotName(value) === scanFloorName)

    boundCadFileId.value = matchesScanBuilding(res.data?.cadBuildingName)
      ? (res.data?.cadFileId ?? null)
      : null
    boundBimFileId.value = matchesScanBuilding(res.data?.bimBuildingName)
      ? (res.data?.bimFileId ?? null)
      : null
    const groups =
      filesRes.code === 200 && Array.isArray(filesRes.data) ? filesRes.data : []
    projectFileGroups.value = groups
    syncHeaderSelectionFromActiveScan()
    const nextGaussFileId = res.data?.hasGaussBinding
      ? (res.data?.gaussFileId ?? null)
      : null
    const gaussMatchesScan =
      matchesScanBuilding(res.data?.gaussBuildingName) &&
      matchesScanFloor(res.data?.gaussFloorName)
    boundGaussFileId.value =
      gaussMatchesScan && isProjectFileReady(groups, 'gauss', nextGaussFileId)
        ? nextGaussFileId
        : null
    await loadBimMetadata()
    return res.data
  } catch (error) {
    scanCalibration.value = null
    projectFileGroups.value = []
    boundCadFileId.value = null
    boundBimFileId.value = null
    boundGaussFileId.value = null
    syncHeaderSelectionFromActiveScan()
    await loadBimMetadata()
    return null
  }
}

const loadBimPointcloudCalibration = async () => {
  if (!projectId.value || !activeScanId.value || !boundBimFileId.value) {
    bimPointcloudCalibration.value = null
    return
  }

  try {
    const res = await getBimAlignment(
      projectId.value,
      activeScanId.value,
      boundBimFileId.value,
    )
    if (res.code !== 200) {
      throw new Error(res.msg || '获取BIM对齐结果失败')
    }
    bimPointcloudCalibration.value = toBimPointcloudCalibration(
      projectId.value,
      res.data,
    )
  } catch (error) {
    bimPointcloudCalibration.value = null
  }
}

const snapshotLayout = (): LayoutSnapshot => ({
  layoutMode: layoutMode.value,
  panelContents: { ...panelContents },
  viewVisibility: { ...viewVisibility },
})

const buildComponentMetaIndex = (data: IfcMetadata | null) => {
  const nextById = new Map<
    string,
    { label: string; type: string; stepId?: number }
  >()
  const nextByStep = new Map<string, string>()
  if (!data) {
    componentMetaByElementId.value = nextById
    elementIdByStepId.value = nextByStep
    return
  }

  const elements = (data as any).elements ?? {}
  for (const [eid, meta] of Object.entries(elements)) {
    const stepId = (meta as any)?.stepId
    if (stepId !== undefined && stepId !== null && stepId !== '') {
      const num = Number(stepId)
      const key = Number.isFinite(num) ? String(num) : String(stepId)
      nextByStep.set(key, String(eid))
    }
  }

  const traverse = (node: any) => {
    if (!node || !Array.isArray(node.children)) return
    node.children.forEach((child: any) => {
      const elementId = String(child.id ?? '')
      if (elementId) {
        const element = (elements as any)[elementId]
        const label = child.name || element?.name || child.type || elementId
        const type = child.type || element?.type || ''
        const stepId = element?.stepId
        nextById.set(elementId, {
          label: String(label ?? ''),
          type: String(type ?? ''),
          stepId: stepId as number | undefined,
        })
      }
      traverse(child)
    })
  }
  traverse((data as any).tree)

  if (nextById.size === 0) {
    for (const [eid, meta] of Object.entries(elements)) {
      const label = (meta as any)?.name || (meta as any)?.type || eid
      const type = (meta as any)?.type || ''
      const stepId = (meta as any)?.stepId
      nextById.set(String(eid), {
        label: String(label ?? ''),
        type: String(type ?? ''),
        stepId: stepId as number | undefined,
      })
    }
  }

  componentMetaByElementId.value = nextById
  elementIdByStepId.value = nextByStep
}

const resolveComponentMetaFromId = (rawId: string) => {
  if (!rawId) return null
  const direct = componentMetaByElementId.value.get(rawId)
  if (direct) {
    return { elementId: rawId, ...direct }
  }
  const elementId = elementIdByStepId.value.get(rawId)
  if (elementId) {
    const meta = componentMetaByElementId.value.get(elementId)
    if (meta) {
      return { elementId, ...meta }
    }
  }
  return null
}

const loadBimMetadata = async () => {
  if (!projectId.value || !boundBimFileId.value) {
    bimMetadata.value = null
    buildComponentMetaIndex(null)
    return
  }
  try {
    const data = await getIfcMetadata(projectId.value, boundBimFileId.value)
    bimMetadata.value = data
    buildComponentMetaIndex(data)
  } catch (error) {
    bimMetadata.value = null
    buildComponentMetaIndex(null)
  }
  if (annotationForm.componentId) {
    const meta = resolveComponentMetaFromId(annotationForm.componentId)
    if (meta) {
      if (
        !annotationForm.componentName ||
        annotationForm.componentName === annotationForm.componentId
      ) {
        annotationForm.componentName =
          meta.label || annotationForm.componentName
      }
      if (!annotationForm.componentType) {
        annotationForm.componentType = meta.type || annotationForm.componentType
      }
      if (!annotationForm.componentId && meta.stepId !== undefined) {
        annotationForm.componentId = String(meta.stepId)
      }
    }
  }
}

const restoreLayout = (snapshot: LayoutSnapshot) => {
  layoutMode.value = snapshot.layoutMode
  Object.assign(panelContents, snapshot.panelContents)
  Object.assign(viewVisibility, snapshot.viewVisibility)
}

const applyAnnotationLayout = () => {
  viewVisibility.panorama = false
  viewVisibility.gaussian = true
  viewVisibility.rvt = true
  viewVisibility.pointcloud = true
  viewVisibility.consistencyResult = true
  applyAnnotationViewLayout()
}

const setAnnotationMode = () => {
  if (modeState.value !== 'annotation') {
    annotationSnapshot.value = snapshotLayout()
    annotationModeEntryViewState.value = captureCurrentViewerViewState()
  }
  modeState.value = 'annotation'
  previousMode.value = 'annotation'
  previousSnapshot.value = null
  bimPointcloudSync.value = true
  annotationMaskVisible.value = true
  annotationPoint.value = null
  annotationSource.value = null
  annotationAnchor.value = null
  screenshotOverlayVisible.value = false
  annotationFormLocked.value = false
  annotationFormHidden.value = false
  annotationSelectedKey.value = ''
  annotationStashKeyOverride.value = ''
  resetAnnotationForm()
  applyAnnotationLayout()
  bumpDynamicPanelKey()
  reloadVisiblePanels()
}

const exitAnnotationMode = () => {
  if (modeState.value !== 'annotation') return
  modeState.value = 'free'
  annotationModeEntryViewState.value = null
  annotationSelectedKey.value = ''
  annotationStashKeyOverride.value = ''
  if (annotationSnapshot.value) {
    restoreLayout(annotationSnapshot.value)
  } else {
    applyViewLayout()
  }
  annotationSnapshot.value = null
  bumpDynamicPanelKey()
  reloadVisiblePanels()
}

const setMixMode = () => {
  if (!canEnterMixMode.value) {
    ElMessage.warning('请等待批注模式全部视图加载完成后再开启混合模式')
    return
  }
  const currentViewState = captureCurrentViewerViewState()
  mixModeEntryViewState.value = cloneAnnotationViewState(currentViewState)
  const wasAnnotation = isAnnotationState(modeState.value)
  if (modeState.value !== 'mix') {
    previousMode.value = modeState.value
    previousSnapshot.value = snapshotLayout()
  }
  viewVisibility.rvt = true
  viewVisibility.pointcloud = true
  if (boundGaussFileId.value) {
    viewVisibility.gaussian = true
  }
  modeState.value = 'mix'
  if (!wasAnnotation) {
    annotationMaskVisible.value = true
    annotationPoint.value = null
    annotationSource.value = null
    annotationAnchor.value = null
    screenshotOverlayVisible.value = false
    annotationFormLocked.value = false
    annotationFormHidden.value = false
    annotationSelectedKey.value = ''
    annotationStashKeyOverride.value = ''
    resetAnnotationForm()
  }
}

const restoreFromMix = () => {
  if (previousSnapshot.value) {
    restoreLayout(previousSnapshot.value)
  }
  modeState.value = previousMode.value
  previousSnapshot.value = null
  annotationModeEntryViewState.value = null
  mixModeEntryViewState.value = null
  bumpDynamicPanelKey()
  reloadVisiblePanels()
}

const updateBlendValue = (clientX: number) => {
  const track = blendTrackRef.value
  if (!track) return
  const rect = track.getBoundingClientRect()
  if (rect.width === 0) return
  const nextValue = (clientX - rect.left) / rect.width
  blendValue.value = Math.min(1, Math.max(0, nextValue))
}

const onBlendPointerDown = (event: PointerEvent) => {
  event.preventDefault()
  updateBlendValue(event.clientX)

  const handleMove = (moveEvent: PointerEvent) => {
    updateBlendValue(moveEvent.clientX)
  }
  const handleUp = () => {
    window.removeEventListener('pointermove', handleMove)
    window.removeEventListener('pointerup', handleUp)
  }

  window.addEventListener('pointermove', handleMove)
  window.addEventListener('pointerup', handleUp)
}

const clampMiniMapPosition = () => {
  if (!twoScreenContainerEl.value || !miniMapEl.value) return
  const containerW = twoScreenContainerEl.value.clientWidth || 1
  const containerH = twoScreenContainerEl.value.clientHeight || 1
  const mapW = miniMapEl.value.offsetWidth || 1
  const mapH = miniMapEl.value.offsetHeight || 1

  miniMapPos.value.x = Math.min(
    Math.max(0, miniMapPos.value.x),
    Math.max(0, containerW - mapW),
  )
  miniMapPos.value.y = Math.min(
    Math.max(0, miniMapPos.value.y),
    Math.max(0, containerH - mapH),
  )
}

const setMiniMapDefaultPosition = () => {
  if (!twoScreenContainerEl.value || !miniMapEl.value) return
  const margin = 12
  const containerRect = twoScreenContainerEl.value.getBoundingClientRect()
  const containerW = twoScreenContainerEl.value.clientWidth || 1
  const mapW = miniMapEl.value.offsetWidth || 1
  const topOffset = 56
  const headerEl = resolveHeaderRoot()
  const projectNameEl = headerEl?.querySelector?.(
    '.project-name',
  ) as HTMLElement | null

  if (projectNameEl) {
    const projectRect = projectNameEl.getBoundingClientRect()
    miniMapPos.value = {
      x: Math.max(margin, projectRect.right - containerRect.left + 16),
      y: Math.max(margin, projectRect.top - containerRect.top),
    }
    clampMiniMapPosition()
    return
  }

  miniMapPos.value = {
    x: Math.max(margin, containerW - mapW - margin),
    y: topOffset,
  }
  clampMiniMapPosition()
}

const resolveHeaderRoot = () => {
  const raw = headerRef.value as any
  const el = raw?.$el ?? raw
  if (el && typeof el.querySelector === 'function') {
    return el as HTMLElement
  }
  const parent = el?.parentElement
  if (parent && typeof parent.querySelector === 'function') {
    return parent as HTMLElement
  }
  return null
}

const setMiniMapAnnotationPosition = () => {
  if (!twoScreenContainerEl.value || !miniMapEl.value) return
  const headerEl = resolveHeaderRoot()
  const pickerEl = headerEl?.querySelector?.(
    '.demo-date-picker',
  ) as HTMLElement | null
  if (!pickerEl) {
    setMiniMapDefaultPosition()
    return
  }

  const margin = 0
  const containerRect = twoScreenContainerEl.value.getBoundingClientRect()
  const pickerRect = pickerEl.getBoundingClientRect()
  const mapW = miniMapEl.value.offsetWidth || 1
  const mapH = miniMapEl.value.offsetHeight || 1

  const centerY = pickerRect.top - containerRect.top + pickerRect.height / 2
  const left = pickerRect.left - containerRect.left - mapW - margin - 20
  const top = centerY - mapH / 2

  miniMapPos.value = {
    x: Math.max(margin, left),
    y: Math.max(margin, top),
  }
  clampMiniMapPosition()
}

const handleMiniMapResize = () => {
  if (modeState.value === 'annotation') {
    setMiniMapAnnotationPosition()
  } else {
    setMiniMapDefaultPosition()
  }
}

const onMiniMapPointerDown = (event: PointerEvent) => {
  if (!twoScreenContainerEl.value || !miniMapEl.value) return
  if (event.button !== 0) return

  const target = event.target as HTMLElement | null
  if (!target?.closest('.small-window-header')) return
  if (target.closest('button, .el-button, .header-actions')) return

  const containerRect = twoScreenContainerEl.value.getBoundingClientRect()
  isMiniMapDragging.value = true
  miniMapDragOffset.value = {
    x: event.clientX - containerRect.left - miniMapPos.value.x,
    y: event.clientY - containerRect.top - miniMapPos.value.y,
  }
  ;(event.currentTarget as HTMLElement)?.setPointerCapture?.(event.pointerId)

  const onMove = (e: PointerEvent) => {
    if (!isMiniMapDragging.value || !twoScreenContainerEl.value) return
    e.preventDefault()
    const rect = twoScreenContainerEl.value.getBoundingClientRect()
    miniMapPos.value = {
      x: e.clientX - rect.left - miniMapDragOffset.value.x,
      y: e.clientY - rect.top - miniMapDragOffset.value.y,
    }
    clampMiniMapPosition()
  }

  const onUp = () => {
    isMiniMapDragging.value = false
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }

  window.addEventListener('pointermove', onMove, { passive: false })
  window.addEventListener('pointerup', onUp)
}

const loadDxf = async () => {
  if (!projectId.value || !boundCadFileId.value) {
    dxfBlobUrl.value = null
    return
  }

  try {
    const res = await getDxfFile(projectId.value, boundCadFileId.value)
    if (res.code !== 200 || !res.data?.content) {
      throw new Error(res.msg || '加载DXF失败')
    }

    if (dxfBlobUrl.value) {
      URL.revokeObjectURL(dxfBlobUrl.value)
    }

    dxfBlobUrl.value = URL.createObjectURL(
      new Blob([res.data.content], { type: 'application/dxf' }),
    )
  } catch (error: any) {
    ElMessage.error(error?.message || 'DXF加载失败')
  }
}

const loadPreview = async () => {
  if (!projectId.value || !activeScanId.value) {
    trajectoryData.value = null
    return
  }

  try {
    const res = await getScanPreview(projectId.value, activeScanId.value, {
      size: 1024,
    })
    if (res.code !== 200 || !res.data?.preview?.pngBase64) {
      throw new Error(res.msg || '加载预览失败')
    }
    trajectoryData.value = res.data.trajectory
  } catch (error: any) {
    ElMessage.error(error?.message || '加载预览失败')
  }
}

const getDefaultTrajectoryPoint = () => {
  const points = trajectoryData.value?.points ?? []
  return points.find((point) => Boolean(point?.imageName)) ?? null
}

const ensureInitialTrajectoryView = async () => {
  if (!shouldAutoApplyTrajectoryPose()) return
  if (lastTrajectoryPoint.value?.imageName) return
  const point = getDefaultTrajectoryPoint()
  if (!point) return

  lastTrajectoryPoint.value = point
  await loadPanoramaImage(0, true)
  await loadGaussianModel(0, true)
  requestAnimationFrame(() => {
    const hasGaussianRef = Boolean(getGaussianRef())
    if (hasGaussianRef) {
      startGaussianTrajectoryPoseSync()
      return
    }
    syncSharedPoseFromTrajectoryPoint(point)
  })
}

const loadLatestAlignmentData = async () => {
  if (!projectId.value || !activeScanId.value || !boundCadFileId.value) {
    alignment.value = null
    return
  }

  try {
    const res = await getLatestAlignment(
      projectId.value,
      activeScanId.value,
      boundCadFileId.value,
    )
    if (res.code === 200) {
      alignment.value = res.data
      return
    }
    throw new Error(res.msg || '获取对齐数据失败')
  } catch (error: any) {
    alignment.value = null
    if (Number(error?.response?.status) === 404) {
      return
    }
    ElMessage.error('加载对齐数据失败')
  }
}

const isComponentConnected = (comp: any) =>
  Boolean(comp?.$el && comp.$el.isConnected)

const loadBimModel = async (retry = 0, requireConnected = false) => {
  const bimRef = getBimRef()
  const readyRef = bimRef && (!requireConnected || isComponentConnected(bimRef))
  if (!readyRef) {
    if (retry < 20) {
      await nextTick()
      window.setTimeout(() => {
        void loadBimModel(retry + 1, requireConnected)
      }, 80)
    }
    return
  }
  if (!projectId.value || !boundBimFileId.value) {
    bimRef.setStatusText?.('未绑定BIM文件')
    return
  }
  bimRef.setStatusText?.('自动加载BIM中...')
  await bimRef.loadBimByFileId?.(projectId.value, boundBimFileId.value)
}

const loadPointcloudModel = async (retry = 0, requireConnected = false) => {
  const pointcloudRef = getPointcloudRef()
  const readyRef =
    pointcloudRef && (!requireConnected || isComponentConnected(pointcloudRef))
  if (!readyRef) {
    if (retry < 20) {
      await nextTick()
      window.setTimeout(() => {
        void loadPointcloudModel(retry + 1, requireConnected)
      }, 80)
    }
    return
  }
  if (!projectId.value || !activeScanId.value) {
    pointcloudRef.setStatusText?.('未选择点云文件')
    return
  }
  pointcloudRef.setStatusText?.('自动加载点云中...')
  await pointcloudRef.loadPointcloudByScanId?.(
    projectId.value,
    activeScanId.value,
  )
}

const loadPanoramaImage = async (retry = 0, requireConnected = false) => {
  const panoramaRef = getPanoramaRef()
  const readyRef =
    panoramaRef && (!requireConnected || isComponentConnected(panoramaRef))
  if (!readyRef) {
    if (retry < 20) {
      await nextTick()
      window.setTimeout(() => {
        void loadPanoramaImage(retry + 1, requireConnected)
      }, 80)
    }
    return
  }

  const targetPoint = lastTrajectoryPoint.value
  if (targetPoint) {
    await panoramaRef.showTrajectoryImage?.(targetPoint)
  } else {
    panoramaRef.clearImage?.()
  }
}

const restoreQuadViewsFromTrajectory = async (
  point: TrajectoryPoint | null | undefined,
) => {
  if (!point) return

  await loadPanoramaImage()
  const gaussianRef = getGaussianRef()
  if (gaussianRef) {
    gaussianRef.syncFromTrajectory?.(point)
    startGaussianTrajectoryPoseSync()
    return
  }
  syncSharedPoseFromTrajectoryPoint(point)
}

const loadGaussianModel = async (retry = 0, requireConnected = false) => {
  if (!boundGaussFileId.value) return
  const gaussianRef = getGaussianRef()
  const readyRef =
    gaussianRef && (!requireConnected || isComponentConnected(gaussianRef))
  if (!readyRef) {
    if (retry < 20) {
      await nextTick()
      window.setTimeout(() => {
        void loadGaussianModel(retry + 1, requireConnected)
      }, 80)
    }
    return
  }

  gaussianRef.init?.()
  const targetPoint = lastTrajectoryPoint.value
  if (shouldAutoApplyTrajectoryPose() && targetPoint) {
    gaussianRef.syncFromTrajectory?.(targetPoint)
  }
}

const scheduleHeavyModelLoadAfterGaussian = () => {
  window.setTimeout(() => {
    if (viewVisibility.pointcloud) {
      void loadPointcloudModel()
    }
    if (viewVisibility.rvt) {
      void loadBimModel()
    }
  }, 600)
}

const loadActiveScanData = async () => {
  if (!projectId.value || !activeScanId.value) return
  resetScanState()
  await loadScanCalibration()
  await loadBimPointcloudCalibration()
  await loadDxf()
  await loadLatestAlignmentData()
  await loadPreview()
  await nextTick()
  await loadGaussianModel()
  scheduleHeavyModelLoadAfterGaussian()
  await ensureInitialTrajectoryView()
}

const getPointcloudWorldMatrix = () => {
  const dynamicMatrix = getPointcloudRef()?.getPointcloudGroupWorldMatrix?.()
  if (dynamicMatrix) return dynamicMatrix
  const mixMatrix = mixViewerRef.value?.getPointcloudWorldMatrixArray?.()
  if (!Array.isArray(mixMatrix) || mixMatrix.length !== 16) return null
  return new THREE.Matrix4().fromArray(mixMatrix)
}

const refreshPointcloudWorldMatrix = () => {
  const matrix = getPointcloudWorldMatrix()
  pointcloudWorldMatrix.value = matrix ? matrix.toArray() : null
}

const getBimWorldMatrix = () => {
  return getBimRef()?.getModelWorldMatrix?.() ?? null
}

const vectorToPlainObject = (vec: THREE.Vector3) => ({
  x: Number((vec.x || 0).toFixed(6)),
  y: Number((vec.y || 0).toFixed(6)),
  z: Number((vec.z || 0).toFixed(6)),
})

const quaternionToPlainObject = (quat: THREE.Quaternion) => ({
  x: Number((quat.x || 0).toFixed(6)),
  y: Number((quat.y || 0).toFixed(6)),
  z: Number((quat.z || 0).toFixed(6)),
  w: Number((quat.w || 1).toFixed(6)),
})

const matrixToPlainArray = (matrix?: THREE.Matrix4 | null) => {
  if (!matrix) return null
  return matrix.toArray().map((value) => Number(value.toFixed(6)))
}

const poseToPlainObject = (
  pose:
    | {
        camera: THREE.Vector3
        target: THREE.Vector3
      }
    | null
    | undefined,
) => {
  if (!pose) return null
  return {
    camera: vectorToPlainObject(pose.camera),
    target: vectorToPlainObject(pose.target),
  }
}

const logTwoScreenWorldState = (_reason: string) => {}

const logBimRelativeTransform = () => {
  lastRelativeTransformLogKey = ''
}

const applyFixedViewScale = () => {
  if (!bimModelLoaded.value || !pointcloudLoaded.value) return
  const bimRef = getBimRef()
  const pointcloudRef = getPointcloudRef()
  const bimSize = bimRef?.getModelMaxDim?.()
  const pointcloudSize = pointcloudRef?.getPointcloudMaxDim?.()
  const targetSize = Math.max(bimSize ?? 0, pointcloudSize ?? 0)
  if (!Number.isFinite(targetSize) || targetSize <= 0) return
  bimRef?.setFixedViewBySize?.(targetSize)
  pointcloudRef?.setFixedViewBySize?.(targetSize)
}

const onTrajectoryPointClick = async (point: TrajectoryPoint) => {
  if (quadRotationSyncActive.value) {
    suppressQuadRotationBroadcastUntil =
      performance.now() + gaussianTrajectorySyncDurationMs + 600
  }
  lastTrajectoryPoint.value = point
  await loadPanoramaImage()

  if (!trajectoryPointSyncEnabled) return

  const gaussianRef = getGaussianRef()

  gaussianRef?.syncFromTrajectory?.(point)

  if (!bimPointcloudCalibration.value) {
    await loadBimPointcloudCalibration()
  }

  if (gaussianRef) {
    startGaussianTrajectoryPoseSync()
  } else {
    syncSharedPoseFromTrajectoryPoint(point)
  }
  if (quadRotationSyncActive.value) {
    window.setTimeout(() => {
      if (!quadRotationSyncActive.value) return
      captureQuadRotationBases()
    }, gaussianTrajectorySyncDurationMs + 80)
  }
  if (!bimPointcloudCalibration.value && !warnedMissingCalibration.value) {
    warnedMissingCalibration.value = true
    ElMessage.warning(
      '未找到 BIM-点云 校准参数，请先在 BIM-点云校准页点击“保存并继续”',
    )
  }
}

const onBimLoadedChange = (loaded: boolean) => {
  bimModelLoaded.value = loaded
  if (loaded) {
    logTwoScreenWorldState('bim-loaded')
    if (quadRotationSyncActive.value) {
      return
    }
  }
  if (loaded && gaussianModelLoaded.value) {
    if (modeState.value === 'annotation' && bimPointcloudSync.value) {
      requestAnimationFrame(() => {
        syncAnnotationLinkedViewsFromBim()
      })
      return
    }
    syncSharedPoseFromGaussian()
    if (
      shouldAutoApplyTrajectoryPose() &&
      lastTrajectoryPoint.value?.imageName
    ) {
      requestAnimationFrame(() => {
        syncSharedPoseFromGaussian()
      })
    }
  }
}

const onGaussianLoadedChange = (loaded: boolean) => {
  gaussianModelLoaded.value = loaded
  if (loaded) {
    logTwoScreenWorldState('gaussian-loaded')
    if (quadRotationSyncActive.value) {
      return
    }
    if (modeState.value === 'annotation' && bimPointcloudSync.value) {
      requestAnimationFrame(() => {
        syncAnnotationLinkedViewsFromBim()
      })
      return
    }
    if (
      shouldAutoApplyTrajectoryPose() &&
      lastTrajectoryPoint.value?.imageName
    ) {
      startGaussianTrajectoryPoseSync()
    } else {
      syncSharedPoseFromGaussian()
    }
  }
}

const onPointcloudLoadedChange = (loaded: boolean) => {
  pointcloudLoaded.value = loaded
  if (!loaded) {
    pointcloudWorldMatrix.value = null
    return
  }
  if (quadRotationSyncActive.value) {
    return
  }
  if (modeState.value === 'annotation' && bimPointcloudSync.value) {
    requestAnimationFrame(() => {
      syncAnnotationLinkedViewsFromBim()
    })
    return
  }
  if (gaussianModelLoaded.value) {
    requestAnimationFrame(() => {
      syncSharedPoseFromGaussian()
    })
  }
}

const onConsistencyResultLoadedChange = (loaded: boolean) => {
  consistencyResultLoaded.value = loaded
  if (!loaded) return
  if (modeState.value === 'annotation' && bimPointcloudSync.value) {
    requestAnimationFrame(() => {
      syncAnnotationLinkedViewsFromBim()
    })
  }
}

const onConsistencyResultReadyStateChange = (
  state: 'pending' | 'loaded' | 'optional' | 'error',
) => {
  const previousState = consistencyResultReadyState.value
  consistencyResultReadyState.value = state
  if (state !== 'optional' || modeState.value !== 'mix') {
    return
  }
  const shouldNotify =
    previousState !== 'optional' || viewVisibility.consistencyResult
  viewVisibility.consistencyResult = false
  if (shouldNotify) {
    ElMessage.info(consistencyResultUnavailableText)
  }
}

const onPointcloudWorldReady = () => {
  refreshPointcloudWorldMatrix()
  logTwoScreenWorldState('pointcloud-world-ready')
  if (quadRotationSyncActive.value) {
    return
  }
  if (modeState.value === 'annotation' && bimPointcloudSync.value) {
    requestAnimationFrame(() => {
      syncAnnotationLinkedViewsFromBim()
    })
    return
  }
  requestAnimationFrame(() => {
    syncSharedPoseFromGaussian()
  })
}

const clampLat = (lat: number) => Math.max(-85, Math.min(85, lat))

const normalizeQuadLon = (lon: number) => {
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180
  return Object.is(wrapped, -0) ? 0 : wrapped
}

const normalizeQuadRotation = (rot: { lon: number; lat: number }) => ({
  lon: Number(normalizeQuadLon(rot.lon).toFixed(6)),
  lat: Number(clampLat(rot.lat).toFixed(6)),
})

const isSameQuadRotation = (
  a: { lon: number; lat: number } | null | undefined,
  b: { lon: number; lat: number } | null | undefined,
  epsilon = 1e-6,
) => {
  if (!a || !b) return false
  return (
    Math.abs(a.lon - b.lon) <= epsilon && Math.abs(a.lat - b.lat) <= epsilon
  )
}

const shouldIgnoreDuplicateQuadRotation = (
  source: QuadSyncSource,
  rot: { lon: number; lat: number },
) => {
  const normalizedRot = normalizeQuadRotation(rot)
  if (!isSameQuadRotation(lastQuadBroadcastRotations[source], normalizedRot))
    return false
  return true
}

const getCurrentQuadRotation = (source: QuadSyncSource) => {
  if (source === 'panorama') {
    return normalizeQuadRotation(panoramaCameraRot.value)
  }
  if (source === 'bim') {
    const rot = getBimRef()?.getCameraOrientation?.()
    return rot ? normalizeQuadRotation(rot) : null
  }
  if (source === 'pointcloud') {
    const rot = getPointcloudRef()?.getCameraOrientation?.()
    return rot ? normalizeQuadRotation(rot) : null
  }
  const rot = getGaussianRef()?.getCameraOrientation?.()
  return rot ? normalizeQuadRotation(rot) : null
}

const clearQuadRotationSyncState = () => {
  ;(['panorama', 'bim', 'pointcloud', 'gaussian'] as QuadSyncSource[]).forEach(
    (source) => {
      quadSyncBaseRotations[source] = null
      lastQuadBroadcastRotations[source] = null
    },
  )
}

const captureQuadRotationBases = () => {
  ;(['panorama', 'bim', 'pointcloud', 'gaussian'] as QuadSyncSource[]).forEach(
    (source) => {
      quadSyncBaseRotations[source] = getCurrentQuadRotation(source)
      lastQuadBroadcastRotations[source] = null
    },
  )
}

const buildQuadTargetRotation = (
  source: QuadSyncSource,
  target: QuadSyncSource,
  sourceRot: { lon: number; lat: number },
) => {
  const normalizedSourceRot = normalizeQuadRotation(sourceRot)
  const sourceBase = quadSyncBaseRotations[source]
  const targetBase = quadSyncBaseRotations[target]
  if (!sourceBase || !targetBase) return normalizedSourceRot

  const deltaLon = normalizeQuadLon(normalizedSourceRot.lon - sourceBase.lon)
  const deltaLat = normalizedSourceRot.lat - sourceBase.lat

  return normalizeQuadRotation({
    lon: targetBase.lon + deltaLon,
    lat: targetBase.lat + deltaLat,
  })
}

const syncQuadRotationAcrossViews = (
  rot: { lon: number; lat: number } | null | undefined,
  source: QuadSyncSource | null = null,
) => {
  if (!quadRotationSyncActive.value || !rot) return
  const targetRot = {
    lon: rot.lon,
    lat: clampLat(rot.lat),
  }
  const normalizedSourceRot = normalizeQuadRotation(targetRot)
  if (
    source &&
    isSameQuadRotation(lastQuadBroadcastRotations[source], normalizedSourceRot)
  ) {
    return
  }
  if (source) {
    if (!quadSyncBaseRotations[source]) {
      captureQuadRotationBases()
    }
    lastQuadBroadcastRotations[source] = normalizedSourceRot
  }
  const panoramaTargetRot = source
    ? buildQuadTargetRotation(source, 'panorama', normalizedSourceRot)
    : normalizedSourceRot
  const bimTargetRot = source
    ? buildQuadTargetRotation(source, 'bim', normalizedSourceRot)
    : normalizedSourceRot
  const pointcloudTargetRot = source
    ? buildQuadTargetRotation(source, 'pointcloud', normalizedSourceRot)
    : normalizedSourceRot
  const gaussianTargetRot = source
    ? buildQuadTargetRotation(source, 'gaussian', normalizedSourceRot)
    : normalizedSourceRot

  panoramaCameraRot.value =
    source === 'panorama'
      ? { ...normalizedSourceRot }
      : { ...panoramaTargetRot }
  applyingQuadRotationSync = true
  try {
    if (source !== 'panorama') {
      getPanoramaRef()?.syncFromRotation?.(panoramaTargetRot)
    }
    if (source !== 'bim') {
      getBimRef()?.syncFromPanoramaRotation?.(bimTargetRot)
    }
    if (source !== 'pointcloud') {
      getPointcloudRef()?.syncFromPanoramaRotation?.(pointcloudTargetRot)
    }
    if (source !== 'gaussian') {
      getGaussianRef()?.syncFromPanoramaRotation?.(gaussianTargetRot)
    }
  } finally {
    applyingQuadRotationSync = false
  }
}

const handleQuadLinkClick = () => {
  if (linkSyncMode.value === 'off') {
    linkSyncMode.value = 'synced'
    captureQuadRotationBases()
    return
  }
  linkSyncMode.value = 'off'
  clearQuadRotationSyncState()
  const point = lastTrajectoryPoint.value
  if (point) {
    requestAnimationFrame(() => {
      void restoreQuadViewsFromTrajectory(point)
    })
  }
}

const syncAnnotationLinkedViewsFromBim = () => {
  if (!bimPointcloudSync.value || modeState.value !== 'annotation') return
  if (annotationModeEntryViewState.value) return
  const pose = getBimRef()?.getCameraPose?.()
  if (pose) {
    getPointcloudRef()?.syncFromExternalPose?.(pose)
    getGaussianRef()?.setCameraPose?.(pose)
    getConsistencyResultRef()?.setCameraPose?.(pose)
    return
  }
  const rot = getBimRef()?.getCameraOrientation?.() ?? lastBimRot.value
  if (!rot) return
  const targetRot = {
    lon: rot.lon,
    lat: clampLat(rot.lat),
  }
  getPointcloudRef()?.syncFromPanoramaRotation?.(targetRot)
  getGaussianRef()?.syncFromPanoramaRotation?.(targetRot)
}

const handleBimPointcloudSyncClick = () => {
  bimPointcloudSync.value = !bimPointcloudSync.value
  if (!bimPointcloudSync.value) return
  syncAnnotationLinkedViewsFromBim()
}

const onBimRotChange = (rot: { lon: number; lat: number }) => {
  lastBimRot.value = rot
  if (quadRotationSyncActive.value) {
    if (applyingQuadRotationSync) return
    if (performance.now() < suppressQuadRotationBroadcastUntil) return
    if (shouldIgnoreDuplicateQuadRotation('bim', rot)) return
    syncQuadRotationAcrossViews(rot, 'bim')
    return
  }
  syncAnnotationLinkedViewsFromBim()
}

const onPanoramaRotChange = (rot: { lon: number; lat: number }) => {
  panoramaCameraRot.value = { ...rot }
  if (quadRotationSyncActive.value) {
    if (applyingQuadRotationSync) return
    if (performance.now() < suppressQuadRotationBroadcastUntil) return
    if (shouldIgnoreDuplicateQuadRotation('panorama', rot)) return
    syncQuadRotationAcrossViews(rot, 'panorama')
  }
}

const onPanoramaFovChange = (fov: number) => {
  panoramaFov.value = fov
}

const onPointcloudRotChange = (rot: { lon: number; lat: number }) => {
  if (!quadRotationSyncActive.value) return
  if (applyingQuadRotationSync) return
  if (performance.now() < suppressQuadRotationBroadcastUntil) return
  if (shouldIgnoreDuplicateQuadRotation('pointcloud', rot)) return
  syncQuadRotationAcrossViews(rot, 'pointcloud')
}

const onGaussianRotChange = (rot: { lon: number; lat: number }) => {
  if (!quadRotationSyncActive.value) return
  if (applyingQuadRotationSync) return
  if (performance.now() < suppressQuadRotationBroadcastUntil) return
  if (shouldIgnoreDuplicateQuadRotation('gaussian', rot)) return
  syncQuadRotationAcrossViews(rot, 'gaussian')
}

const onImageInfoChange = (info: any | null) => {
  currentImageInfo.value = info
}

const toggleView = (view: PanelType) => {
  if (
    modeState.value === 'mix' &&
    view === 'consistencyResult' &&
    isConsistencyResultOptional.value
  ) {
    viewVisibility.consistencyResult = false
    ElMessage.info(consistencyResultUnavailableText)
    return
  }
  if (modeState.value === 'mix') {
    if (!mixViewToggleItems.some((item) => item.key === view)) {
      return
    }
    const activeMixViewCount = mixViewToggleItems.filter(
      (item) => viewVisibility[item.key],
    ).length
    if (viewVisibility[view] && activeMixViewCount === 1) {
      ElMessage.warning('混合模式下至少保留一个图层')
      return
    }
    viewVisibility[view] = !viewVisibility[view]
    return
  }
  const currentViewOrder =
    modeState.value === 'annotation' ? annotationViewOrder : freeViewOrder
  if (modeState.value === 'annotation' && !annotationViewOrder.includes(view)) {
    return
  }
  if (modeState.value === 'annotation') {
    const pickViewKeys: PanelType[] = [
      'rvt',
      'pointcloud',
      'gaussian',
      'consistencyResult',
    ]
    const activePickViewCount = pickViewKeys.filter(
      (key) => viewVisibility[key],
    ).length
    const activeSourceView =
      annotationSource.value === 'bim'
        ? 'rvt'
        : annotationSource.value === 'pointcloud'
          ? 'pointcloud'
          : annotationSource.value === 'gaussian'
            ? 'gaussian'
            : annotationSource.value === 'consistencyResult'
              ? 'consistencyResult'
              : null
    if (
      viewVisibility[view] &&
      pickViewKeys.includes(view) &&
      activePickViewCount === 1
    ) {
      ElMessage.warning('批注模式下至少保留一个可批注视图')
      return
    }
    if (
      viewVisibility[view] &&
      activeSourceView === view &&
      annotationPoint.value
    ) {
      ElMessage.warning('当前批注正在使用该视图，请先取消或完成批注')
      return
    }
  }
  const activeCount = currentViewOrder.filter(
    (key) => viewVisibility[key],
  ).length
  if (viewVisibility[view] && activeCount === 1) {
    ElMessage.warning('至少保留一个视图')
    return
  }
  viewVisibility[view] = !viewVisibility[view]
  if (modeState.value === 'annotation') {
    applyAnnotationViewLayout()
  } else {
    applyViewLayout()
  }
  reloadVisiblePanels()
}

const handleMixLayerVisibilityToggle = (
  layer: 'bim' | 'pointcloud' | 'gaussian' | 'consistencyResult',
) => {
  const layerViewMap = {
    bim: 'rvt',
    pointcloud: 'pointcloud',
    gaussian: 'gaussian',
    consistencyResult: 'consistencyResult',
  } as const
  const view = layerViewMap[layer]
  toggleView(view)
}

const dismissAnnotationGuide = () => {
  annotationMaskVisible.value = false
}

const resetAnnotationForm = () => {
  annotationFormApplying.value = true
  annotationForm.title = ''
  annotationForm.period = []
  annotationForm.severity = ''
  annotationForm.componentId = ''
  annotationForm.componentName = ''
  annotationForm.componentType = ''
  annotationForm.remark = ''
  annotationForm.screenshots = []
  annotationSaved.value = false
  annotationFormHidden.value = false
  annotationViewState.value = null
  annotationEditingId.value = null
  annotationFormManualPos.value = null
  annotationFormRef.value?.clearValidate?.()
  nextTick(() => {
    annotationFormApplying.value = false
  })
}

const updateAnnotationFormSize = () => {
  nextTick(() => {
    if (!annotationFormEl.value) return
    const rect = annotationFormEl.value.getBoundingClientRect()
    if (rect.width && rect.height) {
      annotationFormSize.value = { width: rect.width, height: rect.height }
    }
  })
}

const updateAnnotationAnchor = (screen?: { x: number; y: number }) => {
  if (!screen || !twoScreenContainerEl.value) return
  const rect = twoScreenContainerEl.value.getBoundingClientRect()
  annotationAnchor.value = {
    x: screen.x - rect.left,
    y: screen.y - rect.top,
  }
}

function clampAnnotationFormPosition(left: number, top: number) {
  const container = twoScreenContainerEl.value
  if (!container) return { left, top }
  const rect = container.getBoundingClientRect()
  const { width, height } = annotationFormSize.value
  const effectiveHeight = Math.min(height, Math.max(240, rect.height - 16))
  const maxLeft = Math.max(8, rect.width - width - 8)
  const maxTop = Math.max(8, rect.height - effectiveHeight - 8)
  return {
    left: Math.min(maxLeft, Math.max(8, left)),
    top: Math.min(maxTop, Math.max(8, top)),
  }
}

const onAnnotationFormDragStart = (event: PointerEvent) => {
  if (!annotationFormEl.value || !twoScreenContainerEl.value) return
  if (event.button !== 0) return
  event.preventDefault()

  const containerRect = twoScreenContainerEl.value.getBoundingClientRect()
  const formRect = annotationFormEl.value.getBoundingClientRect()
  const startLeft = formRect.left - containerRect.left
  const startTop = formRect.top - containerRect.top
  const clamped = clampAnnotationFormPosition(startLeft, startTop)

  annotationFormManualPos.value = { x: clamped.left, y: clamped.top }
  annotationFormDragging.value = true
  annotationFormDragOffset.value = {
    x: event.clientX - formRect.left,
    y: event.clientY - formRect.top,
  }

  const handleMove = (moveEvent: PointerEvent) => {
    if (!annotationFormDragging.value || !twoScreenContainerEl.value) return
    moveEvent.preventDefault()
    const rect = twoScreenContainerEl.value.getBoundingClientRect()
    const nextLeft =
      moveEvent.clientX - rect.left - annotationFormDragOffset.value.x
    const nextTop =
      moveEvent.clientY - rect.top - annotationFormDragOffset.value.y
    const next = clampAnnotationFormPosition(nextLeft, nextTop)
    annotationFormManualPos.value = { x: next.left, y: next.top }
  }

  const handleUp = () => {
    annotationFormDragging.value = false
    window.removeEventListener('pointermove', handleMove)
    window.removeEventListener('pointerup', handleUp)
  }

  window.addEventListener('pointermove', handleMove, { passive: false })
  window.addEventListener('pointerup', handleUp)
}

const getAnnotationKey = (
  point: { x: number; y: number; z: number } | null,
  source: string | null,
) => {
  if (!point || !source) return ''
  const fmt = (value: number) => Number(value).toFixed(3)
  return `${source}:${fmt(point.x)},${fmt(point.y)},${fmt(point.z)}`
}

const isDataUrl = (value: string) => value.startsWith('data:')

const extractRemarkFromViewState = (viewState: any) => {
  if (!viewState) return ''
  const metaRemark = viewState?.meta?.remark
  if (typeof metaRemark === 'string') return metaRemark
  const directRemark = viewState?.remark
  return typeof directRemark === 'string' ? directRemark : ''
}

const buildAnnotationPeriodFromApi = (
  annotation: Annotation,
  existing?: AnnotationStashPayload,
) => {
  const period: string[] = []
  if (annotation.startDate) period.push(annotation.startDate)
  if (annotation.endDate) period.push(annotation.endDate)
  if (period.length) return period
  return existing?.period ? [...existing.period] : []
}

const buildAnnotationViewStatePayload = () => {
  const base = cloneAnnotationViewState(annotationViewState.value)
  const remark = annotationForm.remark ?? ''
  const payload: AnnotationViewState = base ?? {
    bimPose: null,
    pointcloudPose: null,
    gaussianPose: null,
    mixPose: null,
  }
  payload.meta = { ...(payload.meta ?? {}), remark }
  return payload
}

const buildAnnotationStashFromForm = (
  overrides?: Partial<AnnotationStashPayload>,
) => {
  const point = annotationPoint.value
  const source = annotationSource.value
  if (!point || !source) return null
  const viewState =
    buildAnnotationViewStatePayload() ??
    cloneAnnotationViewState(annotationViewState.value)
  const payload: AnnotationStashPayload = {
    id: overrides?.id,
    point: { ...point },
    source,
    title: annotationForm.title,
    period: [...annotationForm.period],
    severity: annotationForm.severity,
    componentId: annotationForm.componentId,
    componentName: annotationForm.componentName,
    componentType: annotationForm.componentType,
    remark: annotationForm.remark,
    screenshots: annotationForm.screenshots.map((item) => ({ ...item })),
    saved: Boolean(overrides?.saved),
    viewState,
  }
  return { ...payload, ...overrides }
}

const buildAnnotationStashFromApi = (
  annotation: Annotation,
  existing?: AnnotationStashPayload,
) => {
  const point = {
    x: annotation.pointX ?? existing?.point.x ?? 0,
    y: annotation.pointY ?? existing?.point.y ?? 0,
    z: annotation.pointZ ?? existing?.point.z ?? 0,
  }
  const viewState = mergeAnnotationViewState(
    normalizeAnnotationViewState(annotation.viewState),
    existing?.viewState ?? null,
  )
  const remark =
    extractRemarkFromViewState(annotation.viewState) || existing?.remark || ''
  return {
    id: annotation.id,
    point,
    source: annotation.source ?? existing?.source ?? 'bim',
    title: annotation.name ? String(annotation.name) : (existing?.title ?? ''),
    period: buildAnnotationPeriodFromApi(annotation, existing),
    severity: annotation.severity ?? existing?.severity ?? '',
    componentId: annotation.componentId
      ? String(annotation.componentId)
      : (existing?.componentId ?? ''),
    componentName: annotation.componentName
      ? String(annotation.componentName)
      : (existing?.componentName ?? ''),
    componentType: annotation.componentType
      ? String(annotation.componentType)
      : (existing?.componentType ?? ''),
    remark,
    screenshots: existing?.screenshots
      ? existing.screenshots.map((item) => ({ ...item }))
      : [],
    saved: true,
    viewState,
  } as AnnotationStashPayload
}

const hydrateAnnotationFromReplaySnapshot = (annotationId: number) => {
  const replay = consumeStoredAnnotationReplayPayload(routeReplayToken.value)
  routeReplayToken.value = ''
  if (!replay) return null
  if (
    replay.projectId !== projectId.value ||
    replay.scanFileId !== activeScanId.value ||
    replay.annotationId !== annotationId
  ) {
    return null
  }
  const snapshot = replay.annotation
  if (!snapshot?.point) return null
  const key = buildAnnotationKey(annotationId)
  const existing = annotationStash.value.get(key)
  const payload: AnnotationStashPayload = {
    id: annotationId,
    point: { ...snapshot.point },
    source: snapshot.source ?? existing?.source ?? 'bim',
    title: snapshot.title || existing?.title || '',
    period: snapshot.period.length
      ? [...snapshot.period]
      : [...(existing?.period ?? [])],
    severity: snapshot.severity || existing?.severity || '',
    componentId: snapshot.componentId || existing?.componentId || '',
    componentName: snapshot.componentName || existing?.componentName || '',
    componentType: snapshot.componentType || existing?.componentType || '',
    remark: snapshot.remark || existing?.remark || '',
    screenshots: snapshot.screenshots.length
      ? snapshot.screenshots.map((item) => ({ ...item }))
      : (existing?.screenshots ?? []).map((item) => ({ ...item })),
    saved: true,
    viewState: mergeAnnotationViewState(
      normalizeAnnotationViewState(snapshot.viewState),
      existing?.viewState ?? null,
    ),
  }
  annotationStash.value.set(key, payload)
  return payload
}

const revokeAnnotationScreenshotUrl = (fileId?: number) => {
  if (!fileId) return
  const url = annotationScreenshotUrlMap.get(fileId)
  if (!url) return
  URL.revokeObjectURL(url)
  annotationScreenshotUrlMap.delete(fileId)
}

const clearAnnotationScreenshotUrls = () => {
  annotationScreenshotUrlMap.forEach((url) => URL.revokeObjectURL(url))
  annotationScreenshotUrlMap.clear()
}

const toPlainPose = (
  pose: { camera: THREE.Vector3; target: THREE.Vector3 } | null,
): AnnotationCameraPose | null => {
  if (!pose) return null
  return {
    camera: { x: pose.camera.x, y: pose.camera.y, z: pose.camera.z },
    target: { x: pose.target.x, y: pose.target.y, z: pose.target.z },
  }
}

const toThreePose = (pose: AnnotationCameraPose | null | undefined) => {
  if (!pose) return null
  return {
    camera: new THREE.Vector3(pose.camera.x, pose.camera.y, pose.camera.z),
    target: new THREE.Vector3(pose.target.x, pose.target.y, pose.target.z),
  }
}

const cloneAnnotationPose = (pose: AnnotationCameraPose | null | undefined) => {
  if (!pose) return null
  return {
    camera: { ...pose.camera },
    target: { ...pose.target },
  }
}

const mergeAnnotationViewState = (
  preferred?: AnnotationViewState | null,
  fallback?: AnnotationViewState | null,
): AnnotationViewState | null => {
  const next = normalizeAnnotationViewState(preferred)
  const base = normalizeAnnotationViewState(fallback)
  if (!next && !base) return null
  return {
    bimPose: cloneAnnotationPose(next?.bimPose ?? base?.bimPose),
    pointcloudPose: cloneAnnotationPose(
      next?.pointcloudPose ?? base?.pointcloudPose,
    ),
    gaussianPose: cloneAnnotationPose(next?.gaussianPose ?? base?.gaussianPose),
    mixPose: cloneAnnotationPose(next?.mixPose ?? base?.mixPose),
    meta:
      next?.meta || base?.meta
        ? {
            ...(base?.meta ?? {}),
            ...(next?.meta ?? {}),
          }
        : undefined,
  }
}

const clonePointcloudWorldMatrix = (matrix?: number[] | null) =>
  Array.isArray(matrix) && matrix.length === 16 ? [...matrix] : null

const areNumbersNearlyEqual = (a: number, b: number, epsilon: number) =>
  Math.abs(a - b) <= epsilon

const areAnnotationPosesNearlyEqual = (
  left: AnnotationCameraPose | null | undefined,
  right: AnnotationCameraPose | null | undefined,
  epsilon = mixCapturePoseEpsilon,
) => {
  if (!left || !right) return left === right
  return (
    areNumbersNearlyEqual(left.camera.x, right.camera.x, epsilon) &&
    areNumbersNearlyEqual(left.camera.y, right.camera.y, epsilon) &&
    areNumbersNearlyEqual(left.camera.z, right.camera.z, epsilon) &&
    areNumbersNearlyEqual(left.target.x, right.target.x, epsilon) &&
    areNumbersNearlyEqual(left.target.y, right.target.y, epsilon) &&
    areNumbersNearlyEqual(left.target.z, right.target.z, epsilon)
  )
}

const areNumberArraysNearlyEqual = (
  left: number[] | null | undefined,
  right: number[] | null | undefined,
  epsilon = mixCaptureMatrixEpsilon,
) => {
  if (!left || !right) return left === right
  if (left.length !== right.length) return false
  return left.every((value, index) =>
    areNumbersNearlyEqual(value, right[index], epsilon),
  )
}

const getMixPointcloudWorldMatrixSnapshot = () => {
  const mixMatrix =
    mixViewerRef.value?.getPointcloudWorldMatrixArray?.() ?? null
  return clonePointcloudWorldMatrix(mixMatrix ?? pointcloudWorldMatrix.value)
}

const resetMixCaptureSyncScheduler = () => {
  if (mixCaptureSyncRafId) {
    cancelAnimationFrame(mixCaptureSyncRafId)
    mixCaptureSyncRafId = 0
  }
  if (mixCaptureSyncTimerId !== null) {
    window.clearTimeout(mixCaptureSyncTimerId)
    mixCaptureSyncTimerId = null
  }
  pendingMixCapturePose = undefined
  pendingMixCapturePointcloudWorldMatrix = undefined
}

const applyMixCaptureSync = ({
  pose,
  pointcloudMatrix,
  force = false,
}: {
  pose?: AnnotationCameraPose | null
  pointcloudMatrix?: number[] | null
  force?: boolean
} = {}) => {
  const nextPose =
    pose === undefined
      ? toPlainPose(mixViewerRef.value?.getCameraPose?.() ?? null)
      : cloneAnnotationPose(pose)
  const nextPointcloudWorldMatrix =
    pointcloudMatrix === undefined
      ? getMixPointcloudWorldMatrixSnapshot()
      : clonePointcloudWorldMatrix(pointcloudMatrix)

  const poseChanged =
    force ||
    !areAnnotationPosesNearlyEqual(mixConsistencyCameraPose.value, nextPose)
  const matrixChanged =
    force ||
    !areNumberArraysNearlyEqual(
      mixConsistencyPointcloudWorldMatrix.value,
      nextPointcloudWorldMatrix,
    )

  if (!poseChanged && !matrixChanged) return

  if (poseChanged) {
    mixConsistencyCameraPose.value = nextPose
      ? cloneAnnotationPose(nextPose)
      : null
  }
  if (matrixChanged) {
    mixConsistencyPointcloudWorldMatrix.value = nextPointcloudWorldMatrix
      ? [...nextPointcloudWorldMatrix]
      : null
  }

  if (poseChanged && nextPose) {
    const bimPose = toThreePose(nextPose)
    if (bimPose) {
      mixBimCaptureRef.value?.setCameraPose?.(bimPose)
    }
  }

  lastMixCaptureSyncAt = performance.now()
}

const queueMixCaptureSync = () => {
  if (mixCaptureSyncRafId) return
  mixCaptureSyncRafId = requestAnimationFrame(() => {
    mixCaptureSyncRafId = 0
    mixCaptureSyncTimerId = null
    const nextPose = pendingMixCapturePose
    const nextPointcloudWorldMatrix = pendingMixCapturePointcloudWorldMatrix
    pendingMixCapturePose = undefined
    pendingMixCapturePointcloudWorldMatrix = undefined
    applyMixCaptureSync({
      pose: nextPose,
      pointcloudMatrix: nextPointcloudWorldMatrix,
    })
  })
}

const scheduleMixCaptureSync = (pose: AnnotationCameraPose | null) => {
  pendingMixCapturePose = cloneAnnotationPose(pose)
  pendingMixCapturePointcloudWorldMatrix = getMixPointcloudWorldMatrixSnapshot()

  const elapsed = performance.now() - lastMixCaptureSyncAt
  const delay = Math.max(0, mixCaptureSyncIntervalMs - elapsed)

  if (delay === 0) {
    if (mixCaptureSyncTimerId !== null) {
      window.clearTimeout(mixCaptureSyncTimerId)
      mixCaptureSyncTimerId = null
    }
    queueMixCaptureSync()
    return
  }

  if (mixCaptureSyncTimerId !== null || mixCaptureSyncRafId) return

  mixCaptureSyncTimerId = window.setTimeout(() => {
    mixCaptureSyncTimerId = null
    queueMixCaptureSync()
  }, delay)
}

const syncMixConsistencyCaptureState = () => {
  resetMixCaptureSyncScheduler()
  applyMixCaptureSync({ force: true })
}

const handleMixCameraPoseChange = (pose: AnnotationCameraPose | null) => {
  scheduleMixCaptureSync(pose)
}

const ensureMixBimCaptureLoaded = async () => {
  if (modeState.value !== 'mix') return false

  const viewer = mixBimCaptureRef.value
  const currentProjectId = projectId.value
  const currentBimFileId = boundBimFileId.value
  if (!viewer || !currentProjectId || !currentBimFileId) {
    mixBimCaptureLoadPromise = null
    mixBimCaptureLoadKey = ''
    mixBimCaptureLoadedKey = ''
    return false
  }

  const nextKey = `${currentProjectId}:${currentBimFileId}`
  if (mixBimCaptureLoadedKey === nextKey && viewer.getModelWorldMatrix?.()) {
    return true
  }

  if (mixBimCaptureLoadPromise && mixBimCaptureLoadKey === nextKey) {
    return mixBimCaptureLoadPromise
  }

  mixBimCaptureLoadKey = nextKey
  mixBimCaptureLoadPromise = (async () => {
    try {
      viewer.setStatusText?.('加载 BIM 模型中...')
      await viewer.loadBimByFileId?.(
        currentProjectId,
        currentBimFileId,
        `BIM-${currentBimFileId}`,
      )

      const loaded = Boolean(viewer.getModelWorldMatrix?.())
      mixBimCaptureLoadedKey = loaded ? nextKey : ''

      const currentMixPose =
        toThreePose(
          mixConsistencyCameraPose.value ??
            toPlainPose(mixViewerRef.value?.getCameraPose?.() ?? null),
        ) ?? null
      if (loaded && currentMixPose) {
        viewer.setCameraPose?.(currentMixPose)
      }
      return loaded
    } catch (error) {
      mixBimCaptureLoadedKey = ''
      return false
    } finally {
      if (mixBimCaptureLoadKey === nextKey) {
        mixBimCaptureLoadPromise = null
      }
    }
  })()

  return mixBimCaptureLoadPromise
}

watch(
  () => modeState.value,
  (value) => {
    if (value !== 'mix') {
      resetMixCaptureSyncScheduler()
      mixConsistencyCameraPose.value = null
      mixConsistencyPointcloudWorldMatrix.value = null
      return
    }
    lastMixCaptureSyncAt = 0
    nextTick(() => {
      requestAnimationFrame(() => {
        syncMixConsistencyCaptureState()
      })
    })
  },
)

watch(
  [
    () => modeState.value,
    () => projectId.value,
    () => boundBimFileId.value,
    () => mixBimCaptureRef.value,
  ],
  ([mode]) => {
    if (mode !== 'mix') {
      mixBimCaptureLoadPromise = null
      mixBimCaptureLoadKey = ''
      mixBimCaptureLoadedKey = ''
      return
    }
    nextTick(() => {
      void ensureMixBimCaptureLoaded()
    })
  },
  { immediate: true },
)

watch(
  () => pointcloudWorldMatrix.value,
  (value) => {
    if (modeState.value !== 'mix') return
    if (!Array.isArray(value) || value.length !== 16) return
    if (
      !Array.isArray(mixConsistencyPointcloudWorldMatrix.value) ||
      mixConsistencyPointcloudWorldMatrix.value.length !== 16
    ) {
      mixConsistencyPointcloudWorldMatrix.value = [...value]
    }
  },
  { deep: true },
)

const cloneAnnotationViewState = (state?: AnnotationViewState | null) => {
  if (!state) return null
  return {
    bimPose: cloneAnnotationPose(state.bimPose),
    pointcloudPose: cloneAnnotationPose(state.pointcloudPose),
    gaussianPose: cloneAnnotationPose(state.gaussianPose),
    mixPose: cloneAnnotationPose(state.mixPose),
    meta: state.meta ? { ...state.meta } : undefined,
  }
}

const captureCurrentViewerViewState = () => {
  if (modeState.value === 'mix') {
    const mixPose = toPlainPose(mixViewerRef.value?.getCameraPose?.() ?? null)
    if (!mixPose) return null
    return { bimPose: null, pointcloudPose: null, gaussianPose: null, mixPose }
  }

  const bimPose = toPlainPose(getBimRef()?.getCameraPose?.() ?? null)
  const pointcloudPose = toPlainPose(
    getPointcloudRef()?.getCameraPose?.() ?? null,
  )
  const gaussianPose = toPlainPose(getGaussianRef()?.getCameraPose?.() ?? null)
  if (!bimPose && !pointcloudPose && !gaussianPose) return null
  return { bimPose, pointcloudPose, gaussianPose, mixPose: null }
}

const captureAnnotationViewState = () => {
  if (!isAnnotationMode.value) return
  annotationViewState.value = captureCurrentViewerViewState()
}

const applyAnnotationViewState = (state?: AnnotationViewState | null) => {
  if (!state || !isAnnotationMode.value) return
  if (modeState.value === 'mix') {
    const mixPose = toThreePose(
      state.mixPose ?? state.bimPose ?? state.pointcloudPose,
    )
    if (mixPose) {
      mixViewerRef.value?.setTrajectorySpawnPose?.(mixPose)
      mixViewerRef.value?.setCameraPose?.(mixPose)
    }
    return
  }
  const pointcloudPose = toThreePose(state.pointcloudPose ?? state.mixPose)
  const bimPose = toThreePose(state.bimPose)
  const gaussianPose = toThreePose(
    state.gaussianPose ??
      state.pointcloudPose ??
      state.bimPose ??
      state.mixPose,
  )
  const consistencyPose = toThreePose(
    state.bimPose ??
      state.pointcloudPose ??
      state.gaussianPose ??
      state.mixPose,
  )
  if (pointcloudPose) {
    getPointcloudRef()?.syncFromExternalPose?.(pointcloudPose)
  }
  if (bimPose) {
    getBimRef()?.setCameraPose?.(bimPose)
  } else if (pointcloudPose && bimPointcloudCalibration.value) {
    getBimRef()?.syncFromPointcloudPose?.(
      pointcloudPose,
      bimPointcloudCalibration.value,
    )
  }
  if (gaussianPose) {
    getGaussianRef()?.setCameraPose?.(gaussianPose)
  }
  if (consistencyPose) {
    getConsistencyResultRef()?.setCameraPose?.(consistencyPose)
  }
}

const replayMixModeEntryViewStateWhenReady = () => {
  if (modeState.value !== 'mix') return
  const state = mixModeEntryViewState.value
  if (!state || !mixViewerRef.value) return
  applyAnnotationViewState(state)
  syncMixConsistencyCaptureState()
  const bimPose = toThreePose(
    state.mixPose ?? state.bimPose ?? state.pointcloudPose,
  )
  if (bimPose) {
    mixBimCaptureRef.value?.setCameraPose?.(bimPose)
  }
  mixModeEntryViewState.value = null
}

const replayAnnotationModeEntryViewStateWhenReady = () => {
  if (modeState.value !== 'annotation') return
  if (annotationSelectedKey.value) return
  if (!canApplyAnnotationViewStateNow()) return
  const state = annotationModeEntryViewState.value
  if (!state) return
  applyAnnotationViewState(state)
  annotationModeEntryViewState.value = null
}

const applyAnnotationStash = (payload: AnnotationStashPayload) => {
  annotationFormApplying.value = true
  annotationForm.title = payload.title
  annotationForm.period = [...payload.period]
  annotationForm.severity = payload.severity
  annotationForm.componentId = payload.componentId || ''
  annotationForm.componentName = payload.componentName || ''
  annotationForm.componentType = payload.componentType || ''
  annotationForm.remark = payload.remark || ''
  annotationForm.screenshots = payload.screenshots.map((item) => ({ ...item }))
  annotationSaved.value = payload.saved
  annotationFormHidden.value = false
  annotationViewState.value = cloneAnnotationViewState(payload.viewState)
  nextTick(() => {
    annotationFormApplying.value = false
  })
  if (
    (annotationForm.componentId && !annotationForm.componentName) ||
    annotationForm.componentName === annotationForm.componentId
  ) {
    const meta = resolveComponentMetaFromId(annotationForm.componentId)
    if (meta) {
      annotationForm.componentName = meta.label || annotationForm.componentName
      if (!annotationForm.componentType) {
        annotationForm.componentType = meta.type || annotationForm.componentType
      }
      if (!annotationForm.componentId && meta.stepId !== undefined) {
        annotationForm.componentId = String(meta.stepId)
      }
    }
  }
  annotationFormRef.value?.clearValidate?.()
}

const logAnnotationMarkerPositions = () => {}

const getScreenshotTargetElement = () => {
  const container = twoScreenContainerEl.value
  if (!container) return null
  if (modeState.value === 'mix') {
    return (
      container.querySelector<HTMLElement>('.mix-stack') ??
      container.querySelector<HTMLElement>('.mix-view-panel') ??
      container
    )
  }
  if (annotationSource.value === 'bim') {
    return (
      container.querySelector<HTMLElement>('.bim-viewport') ??
      container.querySelector<HTMLElement>('.bim-view-panel') ??
      container
    )
  }
  if (annotationSource.value === 'pointcloud') {
    return (
      container.querySelector<HTMLElement>('.pointcloud-viewport') ??
      container.querySelector<HTMLElement>('.pointcloud-view-panel') ??
      container
    )
  }
  if (annotationSource.value === 'gaussian') {
    return (
      container.querySelector<HTMLElement>('.gaussian-container') ??
      container.querySelector<HTMLElement>('.gaussian-view-panel') ??
      container
    )
  }
  if (annotationSource.value === 'consistencyResult') {
    return (
      container.querySelector<HTMLElement>('.consistency-viewer__viewport') ??
      container.querySelector<HTMLElement>('.consistency-viewer') ??
      container
    )
  }
  return container
}

const getCaptureDataUrl = async () => {
  if (modeState.value === 'mix') {
    return getMixCaptureDataUrl()
  }
  if (annotationSource.value === 'bim') {
    return getBimRef()?.forceCaptureDataUrl?.() ?? null
  }
  if (annotationSource.value === 'pointcloud') {
    return getPointcloudRef()?.forceCaptureDataUrl?.() ?? null
  }
  if (annotationSource.value === 'gaussian') {
    return getGaussianRef()?.forceCaptureDataUrl?.() ?? null
  }
  if (
    annotationSource.value === 'consistencyResult' &&
    canCaptureConsistencyResult()
  ) {
    return getConsistencyResultRef()?.forceCaptureDataUrl?.() ?? null
  }
  return null
}

const canCaptureConsistencyResult = () =>
  consistencyResultReadyState.value === 'loaded'

const handleScreenshotClick = async () => {
  if (!twoScreenContainerEl.value || screenshotLoading.value) return
  screenshotToolRef.value?.startCapture()
}

const getOtherCaptureDataUrls = async () => {
  if (!bimPointcloudSync.value || modeState.value !== 'annotation') return []
  const captures = []
  if (annotationSource.value !== 'bim') {
    captures.push(await getBimRef()?.forceCaptureDataUrl?.())
  }
  if (annotationSource.value !== 'pointcloud') {
    captures.push(await getPointcloudRef()?.forceCaptureDataUrl?.())
  }
  if (annotationSource.value !== 'gaussian') {
    captures.push(await getGaussianRef()?.forceCaptureDataUrl?.())
  }
  if (
    annotationSource.value !== 'consistencyResult' &&
    canCaptureConsistencyResult()
  ) {
    captures.push(await getConsistencyResultRef()?.forceCaptureDataUrl?.())
  }
  return captures
    .map((item) => (typeof item === 'string' ? item : item?.dataUrl))
    .filter(
      (value): value is string => typeof value === 'string' && Boolean(value),
    )
}

const loadImageFromDataUrl = (dataUrl: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })

const resolveApiErrorMessage = (error: any, fallback: string) => {
  const responseData = error?.response?.data ?? error?.data
  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData
  }
  if (responseData && typeof responseData === 'object') {
    if (typeof responseData.msg === 'string' && responseData.msg.trim()) {
      return responseData.msg
    }
    if (
      typeof responseData.message === 'string' &&
      responseData.message.trim()
    ) {
      return responseData.message
    }
  }
  if (typeof error?.msg === 'string' && error.msg.trim()) {
    return error.msg
  }
  if (
    typeof error?.message === 'string' &&
    error.message.trim() &&
    !/^Request failed with status code \d+$/i.test(error.message.trim())
  ) {
    return error.message
  }
  return fallback
}

const waitRenderFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })

const safeResolveCaptureDataUrl = async (
  getter:
    | (() =>
        | Promise<{ dataUrl: string } | string | null>
        | { dataUrl: string }
        | string
        | null)
    | undefined,
) => {
  if (!getter) return null
  try {
    const result = await getter()
    return typeof result === 'string' ? result : (result?.dataUrl ?? null)
  } catch (error) {
    return null
  }
}

const getOverviewCapturePanels = async (): Promise<OverviewCapturePanel[]> => {
  const panelDefs: Array<
    OverviewCapturePanel & {
      getter?: () =>
        | Promise<{ dataUrl: string } | string | null>
        | { dataUrl: string }
        | string
        | null
    }
  > = [
    {
      key: 'bim',
      title: 'BIM 视图',
      dataUrl: null,
      getter: getBimRef()?.forceCaptureDataUrl,
    },
    {
      key: 'pointcloud',
      title: '点云视图',
      dataUrl: null,
      getter: getPointcloudRef()?.forceCaptureDataUrl,
    },
    {
      key: 'gaussian',
      title: '高斯视图',
      dataUrl: null,
      getter: getGaussianRef()?.forceCaptureDataUrl,
    },
  ]
  if (canCaptureConsistencyResult()) {
    panelDefs.push({
      key: 'consistencyResult',
      title: '实模一致视图',
      dataUrl: null,
      getter: getConsistencyResultRef()?.forceCaptureDataUrl,
    })
  }
  const captures = await Promise.all(
    panelDefs.map((item) => safeResolveCaptureDataUrl(item.getter)),
  )
  return panelDefs.map((item, index) => ({
    key: item.key,
    title: item.title,
    dataUrl: captures[index],
  }))
}

const drawOverviewPlaceholder = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
) => {
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(x, y, width, height)
  ctx.strokeStyle = '#dbe4ee'
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1)
  ctx.fillStyle = '#64748b'
  ctx.font = '600 28px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(title, x + width / 2, y + height / 2 - 18)
  ctx.fillStyle = '#94a3b8'
  ctx.font = '400 22px sans-serif'
  ctx.fillText('当前视图暂不可截图', x + width / 2, y + height / 2 + 24)
}

const drawOverviewPanelTitle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  title: string,
) => {
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)'
  ctx.fillRect(x + 20, y + 18, 210, 42)
  ctx.fillStyle = '#fff'
  ctx.font = '600 24px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(title, x + 38, y + 39)
}

const captureReportOverviewScreenshot =
  async (): Promise<ReportOverviewCaptureResult | null> => {
    if (!twoScreenContainerEl.value) return null
    await nextTick()
    await waitRenderFrame()
    await waitRenderFrame()

    const panels = await getOverviewCapturePanels()
    const hasCapture = panels.some((item) => Boolean(item.dataUrl))
    if (!hasCapture) return null

    const cellWidth = 720
    const cellHeight = 405
    const gap = 22
    const padding = 28
    const headerHeight = 94
    const footerHeight = 38
    const canvas = document.createElement('canvas')
    canvas.width = padding * 2 + cellWidth * 2 + gap
    canvas.height =
      headerHeight + padding + cellHeight * 2 + gap + padding + footerHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.fillStyle = '#eef3f8'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const headerGradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
    headerGradient.addColorStop(0, '#0f172a')
    headerGradient.addColorStop(1, '#1e3a5f')
    ctx.fillStyle = headerGradient
    ctx.fillRect(0, 0, canvas.width, headerHeight)

    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.font = '700 34px sans-serif'
    ctx.fillText('批注界面四分屏总览', padding, 24)

    const metaParts = [
      projectName.value?.trim() || '',
      resolveActiveScanDate() ? `扫描日期 ${resolveActiveScanDate()}` : '',
      `${new Date().toLocaleString('zh-CN')}`,
    ].filter(Boolean)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)'
    ctx.font = '400 20px sans-serif'
    ctx.fillText(metaParts.join('  |  '), padding, 64)

    const startY = headerHeight + padding
    for (let index = 0; index < panels.length; index += 1) {
      const panel = panels[index]
      const row = Math.floor(index / 2)
      const col = index % 2
      const x = padding + col * (cellWidth + gap)
      const y = startY + row * (cellHeight + gap)

      ctx.save()
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = 'rgba(15, 23, 42, 0.12)'
      ctx.shadowBlur = 24
      ctx.shadowOffsetY = 8
      ctx.fillRect(x, y, cellWidth, cellHeight)
      ctx.restore()

      if (panel.dataUrl) {
        const image = await loadImageFromDataUrl(panel.dataUrl)
        if (image) {
          const imageWidth = image.naturalWidth || image.width || 1
          const imageHeight = image.naturalHeight || image.height || 1
          const scale = Math.min(
            cellWidth / imageWidth,
            cellHeight / imageHeight,
          )
          const drawWidth = imageWidth * scale
          const drawHeight = imageHeight * scale
          const offsetX = x + (cellWidth - drawWidth) / 2
          const offsetY = y + (cellHeight - drawHeight) / 2
          const panelGradient = ctx.createLinearGradient(
            x,
            y,
            x,
            y + cellHeight,
          )
          panelGradient.addColorStop(0, '#f8fbff')
          panelGradient.addColorStop(1, '#eaf1f8')
          ctx.fillStyle = panelGradient
          ctx.fillRect(x, y, cellWidth, cellHeight)
          ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)
        } else {
          drawOverviewPlaceholder(ctx, x, y, cellWidth, cellHeight, panel.title)
        }
      } else {
        drawOverviewPlaceholder(ctx, x, y, cellWidth, cellHeight, panel.title)
      }

      drawOverviewPanelTitle(ctx, x, y, panel.title)
    }

    ctx.fillStyle = '#64748b'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.font = '400 18px sans-serif'
    ctx.fillText(
      '生成时自动采集',
      canvas.width - padding,
      canvas.height - footerHeight / 2,
    )

    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.86),
      capturedAt: new Date().toISOString(),
      layout: layoutMode.value,
      width: canvas.width,
      height: canvas.height,
    }
  }

const cropDataUrlByNormalizedRect = async (
  dataUrl: string,
  selection: NormalizedRect,
) => {
  const img = await loadImageFromDataUrl(dataUrl)
  if (!img) return null
  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height
  if (!width || !height) return null
  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value))
  const nx = clamp(selection.x, 0, 1)
  const ny = clamp(selection.y, 0, 1)
  const nwidth = clamp(selection.width, 0, 1 - nx)
  const nheight = clamp(selection.height, 0, 1 - ny)
  const sx = Math.floor(nx * width)
  const sy = Math.floor(ny * height)
  const sw = Math.max(1, Math.floor(nwidth * width))
  const sh = Math.max(1, Math.floor(nheight * height))
  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
  return canvas.toDataURL('image/png')
}

const mergeOverlayDataUrl = async (baseUrl: string, overlayUrl?: string) => {
  if (!overlayUrl) return baseUrl
  const base = await loadImageFromDataUrl(baseUrl)
  const overlay = await loadImageFromDataUrl(overlayUrl)
  if (!base || !overlay) return baseUrl
  const width = base.naturalWidth || base.width
  const height = base.naturalHeight || base.height
  if (!width || !height) return baseUrl
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return baseUrl
  ctx.drawImage(base, 0, 0, width, height)
  ctx.drawImage(overlay, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}

const mergeCaptureLayerUrls = async (
  ...urls: Array<string | null | undefined>
) => {
  let merged: string | null = null
  for (const url of urls) {
    if (!url) continue
    merged = merged ? await mergeOverlayDataUrl(merged, url) : url
  }
  return merged
}

const isMixNormalViewMode = () =>
  mixViewerRef.value?.getViewMode?.() === 'normal'

const enqueueAnnotationScreenshotSupplement = (
  task: () => Promise<void> | void,
) => {
  annotationScreenshotSupplementPendingCount.value += 1
  annotationScreenshotSupplementQueue = annotationScreenshotSupplementQueue
    .catch(() => undefined)
    .then(async () => {
      try {
        await task()
      } finally {
        annotationScreenshotSupplementPendingCount.value = Math.max(
          0,
          annotationScreenshotSupplementPendingCount.value - 1,
        )
      }
    })
  return annotationScreenshotSupplementQueue
}

const waitForAnnotationScreenshotSupplement = async () => {
  await annotationScreenshotSupplementQueue.catch(() => undefined)
}

const appendMixScreenshotExtras = async (
  payload: ScreenshotConfirmPayload,
  baseScreenshotUrl: string,
) => {
  syncMixConsistencyCaptureState()
  await ensureMixBimCaptureLoaded()
  const bimPose = toThreePose(mixConsistencyCameraPose.value)
  if (bimPose) {
    mixBimCaptureRef.value?.setCameraPose?.(bimPose)
  }
  await nextTick()

  const [extra, bimCapture, consistencyCapture] = await Promise.all([
    mixViewerRef.value?.captureAnnotationViews?.(),
    mixBimCaptureRef.value?.forceCaptureDataUrl?.(),
    getConsistencyResultRef()?.forceCaptureDataUrl?.(),
  ])

  const extraUrls = [
    typeof bimCapture === 'string' ? bimCapture : bimCapture?.dataUrl,
    extra?.pointcloud,
    extra?.gaussian,
    extra?.consistencyResult ??
      (typeof consistencyCapture === 'string'
        ? consistencyCapture
        : consistencyCapture?.dataUrl),
  ].filter(
    (value): value is string => typeof value === 'string' && Boolean(value),
  )

  if (!extraUrls.length) return

  const processedUrls = (
    await Promise.all(
      extraUrls.map(async (url) => {
        const cropped =
          (await cropDataUrlByNormalizedRect(url, payload.selection)) ?? url
        return mergeOverlayDataUrl(cropped, payload.overlayDataUrl)
      }),
    )
  ).filter(
    (value): value is string => typeof value === 'string' && Boolean(value),
  )

  if (!processedUrls.length) return
  if (
    !annotationForm.screenshots.some((item) => item.url === baseScreenshotUrl)
  ) {
    return
  }

  const nextScreenshots = [...annotationForm.screenshots]
  processedUrls.forEach((url) => {
    if (nextScreenshots.some((item) => item.url === url)) return
    nextScreenshots.push({ url, pending: true })
  })
  annotationForm.screenshots = nextScreenshots
  updateAnnotationFormSize()
}

const getMixCaptureDataUrl = async () => {
  const mixViewer = mixViewerRef.value
  if (!mixViewer) return null

  if (isMixNormalViewMode()) {
    return mixViewer.forceCaptureDataUrl?.() ?? null
  }

  syncMixConsistencyCaptureState()
  const mixPose = toThreePose(mixConsistencyCameraPose.value)
  if (mixPose) {
    mixBimCaptureRef.value?.setCameraPose?.(mixPose)
  }

  await ensureMixBimCaptureLoaded()

  const layerCaptures = await mixViewer.captureAnnotationViews?.()
  const pointcloudUrl = layerCaptures?.pointcloud ?? null
  const gaussianUrl = layerCaptures?.gaussian ?? null

  const bimTransparentCapture =
    await mixBimCaptureRef.value?.forceCaptureDataUrl?.({
      transparentBackground: true,
    })
  const bimTransparentUrl =
    typeof bimTransparentCapture === 'string'
      ? bimTransparentCapture
      : bimTransparentCapture?.dataUrl

  if (!pointcloudUrl && !gaussianUrl && bimTransparentUrl) {
    return (
      mixBimCaptureRef.value?.forceCaptureDataUrl?.() ?? bimTransparentCapture
    )
  }
  if (!pointcloudUrl && gaussianUrl && !bimTransparentUrl) {
    return gaussianUrl
  }
  if (pointcloudUrl && !gaussianUrl && !bimTransparentUrl) {
    return pointcloudUrl
  }

  const composed = await mergeCaptureLayerUrls(
    pointcloudUrl,
    bimTransparentUrl,
    gaussianUrl,
  )
  if (composed) {
    return composed
  }

  return mixViewer.forceCaptureDataUrl?.() ?? null
}

const handleScreenshotConfirm = async (payload: ScreenshotConfirmPayload) => {
  captureAnnotationViewState()
  const nextScreenshots = [...annotationForm.screenshots]
  const pushScreenshot = (url: string) => {
    if (nextScreenshots.some((item) => item.url === url)) return
    nextScreenshots.push({ url, pending: true })
  }
  pushScreenshot(payload.dataUrl)
  annotationForm.screenshots = nextScreenshots
  screenshotOverlayVisible.value = false
  updateAnnotationFormSize()
  if (modeState.value === 'mix') {
    void enqueueAnnotationScreenshotSupplement(async () => {
      try {
        await appendMixScreenshotExtras(payload, payload.dataUrl)
      } catch {}
    })
  } else {
    const otherUrls = await getOtherCaptureDataUrls()
    for (const otherUrl of otherUrls) {
      const croppedOther =
        (await cropDataUrlByNormalizedRect(otherUrl, payload.selection)) ??
        otherUrl
      const merged = await mergeOverlayDataUrl(
        croppedOther,
        payload.overlayDataUrl,
      )
      if (merged) pushScreenshot(merged)
    }
    annotationForm.screenshots = nextScreenshots
    updateAnnotationFormSize()
  }
}

const getImageExtension = (mime: string) => {
  if (mime.includes('jpeg')) return 'jpg'
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  return 'png'
}

const dataUrlToFile = (dataUrl: string, name: string) => {
  const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.*)$/)
  if (!match) return null
  const [, mime, base64] = match
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new File([bytes], name, { type: mime })
}

const uploadAnnotationScreenshotDataUrl = async (
  dataUrl: string,
  index: number,
) => {
  if (!projectId.value) return null
  if (!isDataUrl(dataUrl)) return null
  const mimeMatch = dataUrl.match(/^data:(image\/[^;]+);/)
  const mime = mimeMatch?.[1] ?? 'image/png'
  const ext = getImageExtension(mime)
  const filename = `annotation_${Date.now()}_${index + 1}.${ext}`
  const file = dataUrlToFile(dataUrl, filename)
  if (!file) return null
  try {
    const uploaded = await uploadFile({
      projectId: projectId.value,
      type: 'annotation_image',
      file,
      resumeFromState: true,
    })
    return uploaded.id
  } catch (error: any) {
    const status = error?.status ?? error?.response?.status
    const data = error?.data ?? error?.response?.data
    if (status === 409) {
      const fileId = data?.data?.fileId
      if (fileId) {
        return Number(fileId)
      }
      const uploadId = data?.data?.uploadId
      if (uploadId) {
        const retry = await uploadFile({
          projectId: projectId.value,
          type: 'annotation_image',
          file,
          existingUploadId: Number(uploadId),
          resumeFromState: true,
        })
        return retry.id
      }
      throw new Error(data?.msg || '该文件已存在或正在上传')
    }
    throw error
  }
}

const uploadReportOverviewScreenshot = async (
  capture: ReportOverviewCaptureResult,
): Promise<CreateReportOverviewScreenshotInput> => {
  if (!projectId.value) {
    throw new Error('缺少项目ID，无法上传报告总览图')
  }
  if (!isDataUrl(capture.dataUrl)) {
    throw new Error('报告总览图数据无效')
  }
  const mimeMatch = capture.dataUrl.match(/^data:(image\/[^;]+);/)
  const mime = mimeMatch?.[1] ?? 'image/jpeg'
  const ext = getImageExtension(mime)
  const filename = `report_overview_${projectId.value}_${activeScanId.value || 'scan'}_${Date.now()}.${ext}`
  const file = dataUrlToFile(capture.dataUrl, filename)
  if (!file) {
    throw new Error('报告总览图生成失败')
  }

  try {
    const uploaded = await uploadFile({
      projectId: projectId.value,
      type: 'report_image',
      file,
      resumeFromState: true,
    })
    return {
      fileId: uploaded.id,
      capturedAt: capture.capturedAt,
      layout: capture.layout,
      width: capture.width,
      height: capture.height,
    }
  } catch (error: any) {
    const status = error?.status ?? error?.response?.status
    const data = error?.data ?? error?.response?.data
    if (status === 409) {
      const fileId = Number(data?.data?.fileId)
      if (Number.isFinite(fileId) && fileId > 0) {
        return {
          fileId,
          capturedAt: capture.capturedAt,
          layout: capture.layout,
          width: capture.width,
          height: capture.height,
        }
      }
      const uploadId = Number(data?.data?.uploadId)
      if (Number.isFinite(uploadId) && uploadId > 0) {
        const retry = await uploadFile({
          projectId: projectId.value,
          type: 'report_image',
          file,
          existingUploadId: uploadId,
          resumeFromState: true,
        })
        return {
          fileId: retry.id,
          capturedAt: capture.capturedAt,
          layout: capture.layout,
          width: capture.width,
          height: capture.height,
        }
      }
    }
    throw error
  }
}

const syncAnnotationScreenshots = async (annotationId: number) => {
  if (!projectId.value || !activeScanId.value) return
  const uniqueScreenshots: AnnotationScreenshotItem[] = []
  const seenUrls = new Set<string>()
  for (const item of annotationForm.screenshots) {
    if (item.fileId || !isDataUrl(item.url)) {
      uniqueScreenshots.push(item)
      continue
    }
    if (seenUrls.has(item.url)) continue
    seenUrls.add(item.url)
    uniqueScreenshots.push(item)
  }
  if (uniqueScreenshots.length !== annotationForm.screenshots.length) {
    annotationForm.screenshots = uniqueScreenshots.map((item) => ({ ...item }))
  }
  const pending = uniqueScreenshots.filter(
    (item) => !item.fileId && isDataUrl(item.url),
  )
  if (!pending.length) return
  const fileIds: number[] = []
  for (let i = 0; i < pending.length; i += 1) {
    const shot = pending[i]
    if (!isDataUrl(shot.url)) continue
    const fileId = await uploadAnnotationScreenshotDataUrl(shot.url, i)
    if (typeof fileId === 'number') {
      fileIds.push(fileId)
    }
  }
  if (!fileIds.length) {
    ElMessage.warning('截图上传失败或重复，未新增截图')
    return
  }
  if (!fileIds.length) return
  const bindRes = await bindAnnotationScreenshots(
    projectId.value,
    activeScanId.value,
    annotationId,
    fileIds,
  )
  if (bindRes.code !== 200 && bindRes.code !== 201) {
    throw new Error(bindRes.msg || '绑定截图失败')
  }
  const screenshots = await refreshAnnotationScreenshots(annotationId)
  await syncAnnotationScreenshotOrder(annotationId, screenshots)
  annotationSaved.value = true
}

const handleAnnotationScreenshotRemove = async (index: number) => {
  const target = annotationForm.screenshots[index]
  if (!target) return
  const nextScreenshots = annotationForm.screenshots.filter(
    (_, idx) => idx !== index,
  )
  const screenshotId = target.id ?? target.fileId
  if (!screenshotId || !annotationEditingId.value) {
    annotationForm.screenshots = nextScreenshots.map((item) => ({ ...item }))
    updateAnnotationFormSize()
    return
  }
  if (!projectId.value || !activeScanId.value) return
  try {
    const res = await deleteAnnotationScreenshot(
      projectId.value,
      activeScanId.value,
      annotationEditingId.value,
      screenshotId,
    )
    if (res.code !== 200) {
      throw new Error(res.msg || '删除截图失败')
    }
    revokeAnnotationScreenshotUrl(screenshotId)
    annotationForm.screenshots = nextScreenshots.map((item) => ({ ...item }))
    const stashKey = buildAnnotationKey(annotationEditingId.value)
    const stash = annotationStash.value.get(stashKey)
    if (stash) {
      annotationStash.value.set(stashKey, {
        ...stash,
        screenshots: nextScreenshots.map((item) => ({ ...item })),
      })
    }
    await syncAnnotationScreenshotOrder(
      annotationEditingId.value,
      nextScreenshots,
    )
    updateAnnotationFormSize()
    ElMessage.success('截图已删除')
  } catch (error: any) {
    ElMessage.error(error?.message || '删除截图失败')
  }
}

const handleAnnotationStash = async () => {
  if (!annotationPoint.value || !annotationSource.value) return
  await waitForAnnotationScreenshotSupplement()
  captureAnnotationViewState()
  const key =
    annotationStashKeyOverride.value ||
    getAnnotationKey(annotationPoint.value, annotationSource.value)
  if (!key) return
  const payload = buildAnnotationStashFromForm({ saved: annotationSaved.value })
  if (payload) {
    annotationStash.value.set(key, payload)
  }
  annotationFormHidden.value = true
}

const handleAnnotationCancel = () => {
  annotationFormHidden.value = true
}

const handleAnnotationSubmit = async () => {
  if (annotationSubmitting.value) return
  if (!annotationPoint.value || !annotationSource.value) {
    ElMessage.warning('请先在模型中选择问题点')
    return
  }
  if (!annotationFormRef.value) return
  const valid = await annotationFormRef.value.validate().catch(() => false)
  if (!valid) return
  const currentProjectId = projectId.value
  const currentScanId = activeScanId.value
  if (!currentProjectId || !currentScanId) {
    ElMessage.warning('缺少项目信息，无法提交批注')
    return
  }
  annotationSubmitting.value = true
  try {
    await waitForAnnotationScreenshotSupplement()
    captureAnnotationViewState()
    const viewStatePayload = buildAnnotationViewStatePayload()
    const [startDate, endDate] = annotationForm.period
    const severityValue =
      annotationForm.severity === 'high' ||
      annotationForm.severity === 'medium' ||
      annotationForm.severity === 'low'
        ? (annotationForm.severity as 'high' | 'medium' | 'low')
        : undefined
    const requestPayload: CreateAnnotationInput = {
      name: annotationForm.title.trim(),
      source: annotationSource.value,
      componentName: annotationForm.componentName || '',
      componentId: annotationForm.componentId || '',
      componentType: annotationForm.componentType || '',
      viewState: viewStatePayload,
      pointX: annotationPoint.value.x,
      pointY: annotationPoint.value.y,
      pointZ: annotationPoint.value.z,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      severity: severityValue,
    }
    const currentId =
      annotationEditingId.value ??
      parseAnnotationIdFromKey(annotationActiveKey.value)
    let savedId = currentId
    if (currentId) {
      const res = await updateAnnotation(
        currentProjectId,
        currentScanId,
        currentId,
        requestPayload,
      )
      if (res.code !== 200) {
        throw new Error(res.msg || '批注更新失败')
      }
    } else {
      const res = await createAnnotation(
        currentProjectId,
        currentScanId,
        requestPayload,
      )
      if (res.code !== 200 && res.code !== 201) {
        throw new Error(res.msg || '批注创建失败')
      }
      savedId = res.data?.id
      if (!savedId) {
        throw new Error('批注创建失败，缺少ID')
      }
    }
    if (!savedId) return
    const draftKey =
      annotationStashKeyOverride.value ||
      getAnnotationKey(annotationPoint.value, annotationSource.value)
    const savedKey = buildAnnotationKey(savedId)
    const payload = buildAnnotationStashFromForm({ id: savedId, saved: true })
    if (payload) {
      annotationStash.value.set(savedKey, {
        ...payload,
        viewState: viewStatePayload ?? payload.viewState,
      })
    }
    if (!currentId && draftKey && draftKey !== savedKey) {
      annotationStash.value.delete(draftKey)
    }
    annotationSelectedKey.value = savedKey
    annotationStashKeyOverride.value = savedKey
    annotationSaved.value = true
    annotationEditingId.value = savedId
    await syncAnnotationScreenshots(savedId)
    headerRef.value?.closeAnnotationList?.()
    annotationFormHidden.value = true
    ElMessage.success(currentId ? '批注已更新' : '批注已创建')
  } catch (error: any) {
    ElMessage.error(resolveApiErrorMessage(error, '保存批注失败'))
  } finally {
    annotationSubmitting.value = false
  }
}

const handleAnnotationDelete = async () => {
  if (annotationSubmitting.value) return
  const annotationId = annotationEditingId.value
  if (!annotationId || !projectId.value || !activeScanId.value) {
    ElMessage.warning('当前没有可删除的批注')
    return
  }
  try {
    await ElMessageBox.confirm('确定删除当前批注吗？', '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    annotationSubmitting.value = true
    const res = await deleteAnnotation(
      projectId.value,
      activeScanId.value,
      annotationId,
    )
    if (res.code !== 200) {
      throw new Error(res.msg || '删除批注失败')
    }
    const key = buildAnnotationKey(annotationId)
    const existing = annotationStash.value.get(key)
    if (existing) {
      existing.screenshots.forEach((item) => {
        revokeAnnotationScreenshotUrl(item.id ?? item.fileId)
      })
    }
    annotationStash.value.delete(key)
    if (annotationSelectedKey.value === key) annotationSelectedKey.value = ''
    if (annotationStashKeyOverride.value === key)
      annotationStashKeyOverride.value = ''
    annotationEditingId.value = null
    annotationPoint.value = null
    annotationSource.value = null
    annotationMaskVisible.value = false
    annotationFormHidden.value = true
    resetAnnotationForm()
    headerRef.value?.closeAnnotationList?.()
    ElMessage.success('批注已删除')
  } catch (error: any) {
    if (error === 'cancel' || error === 'close' || error?.message === 'cancel')
      return
    ElMessage.error(error?.message || '删除批注失败')
  } finally {
    annotationSubmitting.value = false
  }
}

const resolveInviteAnnotationKey = (preferredKey?: string) => {
  const candidates = [
    preferredKey,
    annotationSelectedKey.value,
    annotationStashKeyOverride.value,
    annotationActiveKey.value,
    annotationSavedList.value[0]?.key,
  ]
  for (const key of candidates) {
    if (!key) continue
    const payload = annotationStash.value.get(key)
    if (payload?.saved) return key
  }
  return ''
}

const normalizeInviteAnnotationKeys = (keys: string[]) => {
  const availableSet = new Set(
    annotationSavedList.value.map((item) => item.key),
  )
  const deduped = Array.from(new Set(keys.filter((item) => Boolean(item))))
  return deduped.filter((item) => {
    if (!availableSet.has(item)) return false
    return Boolean(annotationStash.value.get(item)?.saved)
  })
}

const handleAnnotationInvite = (preferredKey?: string) => {
  const resolvedKey = resolveInviteAnnotationKey(preferredKey)
  if (!resolvedKey) {
    ElMessage.warning('暂无可邀请查看的已保存批注')
    return
  }
  inviteAnnotationKeys.value = [resolvedKey]
  memberPickerVisible.value = true
}

const handleInviteAnnotationKeysChange = (keys: string[]) => {
  inviteAnnotationKeys.value = normalizeInviteAnnotationKeys(keys)
}

const handleMemberInviteSubmit = async (payload: {
  annotationKeys: string[]
  memberIds: number[]
  members: ProjectMemberItem[]
  message: string
}) => {
  if (inviteSubmitting.value) return
  const selectedKeys = normalizeInviteAnnotationKeys(
    payload.annotationKeys?.length
      ? payload.annotationKeys
      : inviteAnnotationKeys.value,
  )
  if (!selectedKeys.length) {
    ElMessage.warning('请至少选择一条已保存批注')
    return
  }
  inviteAnnotationKeys.value = [...selectedKeys]
  if (!projectId.value) {
    ElMessage.warning('缺少项目ID，无法发送邀请')
    return
  }
  if (!activeScanId.value) {
    ElMessage.warning('缺少扫描文件ID，无法发送邀请')
    return
  }
  if (!payload.memberIds.length) {
    ElMessage.warning('请至少选择一个成员')
    return
  }
  const annotationSnapshots = selectedKeys
    .map((key) => {
      const annotation = annotationStash.value.get(key)
      if (!annotation || !annotation.saved) return null
      const annotationId = annotation.id ?? parseAnnotationIdFromKey(key)
      return {
        id: annotationId ?? null,
        key,
        title: annotation.title,
        period: [...annotation.period],
        severity: annotation.severity,
        componentId: annotation.componentId,
        componentName: annotation.componentName,
        componentType: annotation.componentType,
        remark: annotation.remark,
        source: annotation.source,
        point: { ...annotation.point },
        screenshots: annotation.screenshots.map((item) => ({
          id: item.id,
          fileId: item.fileId,
          url: item.url,
          originalName: item.originalName,
          fileSize: item.fileSize,
          sortOrder: item.sortOrder,
        })),
        viewState: cloneAnnotationViewState(annotation.viewState),
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  if (!annotationSnapshots.length) {
    ElMessage.warning('未找到可邀请的批注')
    return
  }
  const primaryAnnotation = annotationSnapshots[0]

  inviteSubmitting.value = true
  try {
    const notificationRes = await createNotification({
      type: 'annotation_invite',
      title: '你被邀请查看批注',
      content: payload.message,
      recipientUserIds: [...payload.memberIds],
      payload: {
        schemaVersion: 1,
        data: {
          subject: {
            type: 'annotation',
            id: primaryAnnotation.id
              ? `annotation:${primaryAnnotation.id}`
              : primaryAnnotation.key.startsWith('annotation:')
                ? primaryAnnotation.key
                : `annotation:${primaryAnnotation.key}`,
            ids: annotationSnapshots.map((item) =>
              item.id ? `annotation:${item.id}` : item.key,
            ),
            projectId: projectId.value,
            scanFileId: activeScanId.value,
          },
          snapshot: {
            annotation: primaryAnnotation,
            annotations: annotationSnapshots,
            annotationKeys: annotationSnapshots.map((item) => item.key),
            projectName: projectName.value || '',
            invitedMembers: payload.members.map((item) => ({
              userId: item.userId,
              displayName: item.displayName,
              email: item.email,
              phone: item.phone,
              roleName: item.roleName,
            })),
          },
          action: {
            type: 'open_annotation',
            message: payload.message,
            source: primaryAnnotation.source,
            modeState: modeState.value,
            gaussAssetPath: resolveInviteGaussAssetPath(),
            invitedAt: new Date().toISOString(),
            operator:
              userStore.nickname ||
              userStore.username ||
              userStore.email ||
              '当前用户',
          },
        },
      },
    })

    if (notificationRes.code !== 200 && notificationRes.code !== 201) {
      throw new Error(notificationRes.msg || '发送邀请失败')
    }

    memberPickerVisible.value = false
    ElMessage.success(
      `已向 ${payload.memberIds.length} 位成员发送邀请（含 ${annotationSnapshots.length} 条批注）`,
    )
  } catch (error: any) {
    ElMessage.error(error?.message || '发送邀请失败')
  } finally {
    inviteSubmitting.value = false
  }
}

const ensureReportTemplates = async () => {
  const templates = await listReportTemplates()
  reportTemplates.value = templates
  if (!reportTemplates.value.length) return
  const exists = reportTemplates.value.some(
    (item) => item.id === reportForm.templateId,
  )
  if (!exists) {
    reportForm.templateId = reportTemplates.value[0].id
  }
}

const resolveActiveScanDate = () => {
  if (!activeScanId.value) return ''
  const target = scanList.value.find(
    (item) => item.scanFileId === activeScanId.value,
  )
  return target?.producedAt || ''
}

const normalizeReportSelectionKeys = (keys?: string[]) => {
  const availableKeys = annotationSavedList.value.map((item) => item.key)
  if (!availableKeys.length) return []
  if (!keys || keys.length === 0) return [...availableKeys]
  const availableSet = new Set(availableKeys)
  const valid = keys.filter((key) => availableSet.has(key))
  return valid.length > 0 ? valid : [...availableKeys]
}

const collectSavedAnnotationIds = (keys: string[]) => {
  const keySet = new Set(keys)
  const ids: number[] = []
  annotationSavedList.value.forEach((item) => {
    if (!keySet.has(item.key)) return
    const id = parseAnnotationIdFromKey(item.key)
    if (id) ids.push(id)
  })
  return ids
}

const resolveScanFileName = (
  groups: FileTypeGroup[] | undefined,
  scanFileId: number,
) => {
  if (!Array.isArray(groups) || !scanFileId) return ''
  const scanGroup = groups.find((item) => item.type === 'scan')
  return String(
    scanGroup?.files.find((item) => item.id === scanFileId)?.originalName || '',
  ).trim()
}

const loadReportCreationContext = async (
  projectId: number,
  scanFileId: number,
) => {
  const [userResult, filesResult] = await Promise.allSettled([
    getCurrentUser(),
    getProjectFilesByProjectId(projectId),
  ])

  const reportCreator =
    userResult.status === 'fulfilled' && userResult.value.code === 200
      ? String(userResult.value.data?.username || '').trim()
      : ''

  const scanFileName =
    filesResult.status === 'fulfilled' && filesResult.value.code === 200
      ? resolveScanFileName(filesResult.value.data, scanFileId)
      : ''

  return {
    reportCreator,
    scanFileName,
  }
}

const handleAnnotationGenerate = (selectedKeys: string[]) => {
  void handleGenerateReport(selectedKeys)
}

const handleGenerateReport = async (selectedKeys?: string[]) => {
  if (reportSubmitting.value) return
  if (!projectId.value || !activeScanId.value) {
    ElMessage.warning('缺少项目或扫描信息，无法生成报告')
    return
  }
  reportSubmitting.value = true
  try {
    const ready = await checkReportReady(projectId.value, activeScanId.value)
    if (!ready.ready) {
      ElMessage.warning(ready.reason || '当前扫描不满足报告生成条件')
      return
    }
    if (annotationSavedList.value.length === 0) {
      ElMessage.warning('请先提交至少一条批注后再生成报告')
      return
    }
    const normalizedKeys = normalizeReportSelectionKeys(
      selectedKeys ?? reportSelectedAnnotationKeys.value,
    )
    if (normalizedKeys.length === 0) {
      ElMessage.warning('请先选择至少一条批注再生成报告')
      return
    }
    reportSelectedAnnotationKeys.value = normalizedKeys
    await ensureReportTemplates()
    if (!reportTemplates.value.length) {
      ElMessage.warning('暂无可用报告模板，请稍后重试')
      return
    }

    const annotationIds = collectSavedAnnotationIds(normalizedKeys)
    try {
      const selectedCount = normalizedKeys.length
      await ElMessageBox.confirm(
        `<div class="report-generate-confirm-content">
          <div class="report-generate-confirm-hero">
            <div class="report-generate-confirm-hero-text">
              <p class="report-generate-confirm-desc">将根据当前选中的批注生成检测报告</p>
            </div>
          </div>
          <div class="report-generate-confirm-count">
            <span class="report-generate-confirm-count-mark">✓</span>
            <span>已选择 <strong>${selectedCount}</strong> 条批注</span>
          </div>
          <p class="report-generate-confirm-tip">生成完成后将自动进入报告预览页</p>
        </div>`,
        '📄 生成报告',
        {
          confirmButtonText: '开始生成',
          cancelButtonText: '取消',
          dangerouslyUseHTMLString: true,
          customClass: 'report-generate-confirm-dialog',
          closeOnClickModal: false,
        },
      )
    } catch {
      return
    }
    const { reportCreator, scanFileName } = await loadReportCreationContext(
      projectId.value,
      activeScanId.value,
    )
    const overviewCapture = await captureReportOverviewScreenshot()
    if (!overviewCapture) {
      throw new Error('报告总览图生成失败，请稍后重试')
    }
    const overviewScreenshot =
      await uploadReportOverviewScreenshot(overviewCapture)
    const created = await createReportTask({
      projectId: projectId.value,
      scanFileId: activeScanId.value,
      projectName: projectName.value || `项目-${projectId.value}`,
      scanDate: resolveActiveScanDate(),
      reportCreator,
      scanFileName,
      overviewScreenshot,
      config: {
        templateId: reportForm.templateId,
        includeScreenshots: reportForm.includeScreenshots,
        language: reportForm.language,
        exportFormat: reportForm.exportFormat,
      },
      annotationSnapshot: {
        annotationIds,
        annotationCount: normalizedKeys.length,
      },
    })
    reportAccessStore.activateForProject(projectId.value, activeScanId.value)
    ElMessage.success('报告任务已创建，正在进入预览页')
    router.push({
      name: 'ReportDetail',
      params: { reportId: created.id },
    })
  } catch (error: any) {
    ElMessage.error(resolveApiErrorMessage(error, '报告生成失败'))
  } finally {
    reportSubmitting.value = false
  }
}

const handleAnnotationDetail = (key: string) => {
  const annotationId = parseAnnotationIdFromKey(key)
  if (!annotationId) return
  if (!projectId.value || !activeScanId.value) return
  refreshAnnotationDetail(annotationId).catch((error) => {
    ElMessage.error(error?.message || '加载批注详情失败')
  })
  refreshAnnotationScreenshots(annotationId).catch((error) => {
    ElMessage.error(error?.message || '加载批注截图失败')
  })
}

const handleAnnotationSelect = (key: string) => {
  const stashed = annotationStash.value.get(key)
  if (!stashed) return
  annotationModeEntryViewState.value = null
  annotationFormManualPos.value = null
  annotationSelectedKey.value = key
  annotationStashKeyOverride.value = key
  annotationEditingId.value = stashed.id ?? parseAnnotationIdFromKey(key)
  annotationPoint.value = { ...stashed.point }
  annotationSource.value = stashed.source
  annotationMaskVisible.value = false
  annotationFormHidden.value = false
  applyAnnotationStash(stashed)
  if (twoScreenContainerEl.value) {
    const rect = twoScreenContainerEl.value.getBoundingClientRect()
    updateAnnotationAnchor({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })
  }
  updateAnnotationFormSize()
  nextTick(() => {
    applyAnnotationViewState(stashed.viewState)
  })
  replayAnnotationViewStateWhenReady(key)
  const annotationId = parseAnnotationIdFromKey(key)
  if (annotationId) {
    refreshAnnotationDetail(annotationId, { applyToForm: true }).catch(() => {})
    refreshAnnotationScreenshots(annotationId).catch(() => {})
  }
}

const focusAnnotationFromRoute = async () => {
  if (!projectId.value || !activeScanId.value) return
  const annotationId = resolveRouteAnnotationId()
  if (!annotationId) return
  if (modeState.value !== 'annotation') {
    setAnnotationMode()
    await nextTick()
  }
  const key = buildAnnotationKey(annotationId)
  let target =
    hydrateAnnotationFromReplaySnapshot(annotationId) ??
    annotationStash.value.get(key)
  try {
    // 复现优先拉详情，确保点位与视角使用最新数据
    await refreshAnnotationDetail(annotationId)
    target = annotationStash.value.get(key) ?? target
  } catch {}
  if (!target?.saved) {
    const fallbackKey = getFirstSavedAnnotationKey()
    if (fallbackKey) {
      ElMessage.warning('目标批注已被删除，已自动定位到当前扫描中的其他批注')
      focusAnnotationKeyInList(fallbackKey)
    } else {
      ElMessage.warning(
        '目标批注已被删除，当前扫描无可复现批注，已进入批注模式',
      )
      annotationPoint.value = null
      annotationSource.value = null
      annotationAnchor.value = null
      annotationMaskVisible.value = true
      annotationSelectedKey.value = ''
      annotationStashKeyOverride.value = ''
      resetAnnotationForm()
    }
    clearRouteAnnotationFocus()
    return
  }
  focusAnnotationKeyInList(key)
  clearRouteAnnotationFocus()
}

const handleAnnotationPick = (payload: AnnotationPickPayload) => {
  if (!isAnnotationMode.value || annotationFormLocked.value) return
  if (!payload.point) {
    annotationPoint.value = null
    annotationSource.value = null
    annotationAnchor.value = null
    annotationMaskVisible.value = false
    annotationSaved.value = false
    annotationFormHidden.value = false
    annotationSelectedKey.value = ''
    annotationStashKeyOverride.value = ''
    annotationEditingId.value = null
    annotationFormManualPos.value = null
    return
  }
  const prevPoint = annotationPoint.value
  const wasHidden = annotationFormHidden.value
  const nextSource = payload.source ?? null
  const pickKey = payload.key || getAnnotationKey(payload.point, nextSource)
  const nextComponentId = payload.componentInfo?.id ?? payload.componentId ?? ''
  let nextComponentName = payload.componentInfo?.name?.trim() ?? ''
  const nextComponentType = payload.componentInfo?.type ?? ''
  let normalizedComponentId =
    nextComponentId !== null && nextComponentId !== undefined
      ? String(nextComponentId)
      : ''
  if (!normalizedComponentId && nextComponentName) {
    normalizedComponentId = nextComponentName
  }
  if (
    nextComponentName &&
    normalizedComponentId &&
    nextComponentName === normalizedComponentId
  ) {
    nextComponentName = ''
  }
  let normalizedComponentName = nextComponentName
  let normalizedComponentType = nextComponentType
    ? String(nextComponentType)
    : ''
  let normalizedComponentIdFinal = normalizedComponentId
  const meta = resolveComponentMetaFromId(normalizedComponentId)
  if (meta) {
    if (!normalizedComponentName) normalizedComponentName = meta.label || ''
    if (!normalizedComponentType) normalizedComponentType = meta.type || ''
    if (meta.stepId !== undefined && meta.stepId !== null) {
      normalizedComponentIdFinal = String(meta.stepId)
    }
  }
  const isSamePoint =
    prevPoint &&
    payload.point &&
    annotationSource.value === nextSource &&
    Math.abs(prevPoint.x - payload.point.x) < 1e-3 &&
    Math.abs(prevPoint.y - payload.point.y) < 1e-3 &&
    Math.abs(prevPoint.z - payload.point.z) < 1e-3
  if (!isSamePoint) {
    annotationFormManualPos.value = null
  }
  annotationPoint.value = payload.point
  annotationSource.value = nextSource
  annotationMaskVisible.value = false
  annotationFormHidden.value = false
  annotationStashKeyOverride.value = pickKey || ''
  const stashed = pickKey ? annotationStash.value.get(pickKey) : undefined
  if (pickKey && stashed?.saved) {
    annotationSelectedKey.value = pickKey
    annotationEditingId.value = stashed.id ?? parseAnnotationIdFromKey(pickKey)
  } else if (pickKey && annotationSelectedKey.value) {
    annotationSelectedKey.value = ''
    annotationEditingId.value = null
  }
  if (!isSamePoint) {
    if (stashed) {
      applyAnnotationStash(stashed)
      if (normalizedComponentIdFinal && !stashed.componentId) {
        annotationForm.componentId = normalizedComponentIdFinal
      }
      if (normalizedComponentName && !stashed.componentName) {
        annotationForm.componentName = normalizedComponentName
      }
      if (normalizedComponentType && !stashed.componentType) {
        annotationForm.componentType = normalizedComponentType
      }
      annotationEditingId.value = stashed.id ?? annotationEditingId.value
    } else {
      resetAnnotationForm()
      annotationForm.componentId = normalizedComponentIdFinal
      annotationForm.componentName = normalizedComponentName
      annotationForm.componentType = normalizedComponentType
      annotationEditingId.value = null
    }
  } else if (wasHidden && stashed) {
    applyAnnotationStash(stashed)
    annotationEditingId.value = stashed.id ?? annotationEditingId.value
  } else if (
    !stashed &&
    (normalizedComponentIdFinal ||
      normalizedComponentName ||
      normalizedComponentType)
  ) {
    if (normalizedComponentIdFinal)
      annotationForm.componentId = normalizedComponentIdFinal
    if (normalizedComponentName)
      annotationForm.componentName = normalizedComponentName
    if (normalizedComponentType)
      annotationForm.componentType = normalizedComponentType
    if (!pickKey || !pickKey.startsWith(annotationKeyPrefix)) {
      annotationEditingId.value = null
    }
  }
  updateAnnotationAnchor(payload.screen)
  updateAnnotationFormSize()
  nextTick(() => {
    logAnnotationMarkerPositions()
  })
}

watch(memberPickerVisible, (visible) => {
  if (visible) return
  inviteSubmitting.value = false
  inviteAnnotationKeys.value = []
})

watch(annotationFormVisible, (visible) => {
  if (visible) {
    updateAnnotationFormSize()
  }
})

watch(
  () => [
    annotationForm.title,
    annotationForm.severity,
    annotationForm.componentId,
    annotationForm.componentName,
    annotationForm.componentType,
    annotationForm.remark,
    annotationForm.period.join('|'),
    annotationForm.screenshots.length,
  ],
  () => {
    if (annotationFormApplying.value) return
    if (annotationSaved.value) {
      annotationSaved.value = false
    }
  },
)

watch(
  () => viewVisibility.rvt,
  (visible) => {
    if (!visible) {
      bimModelLoaded.value = false
      return
    }
    if (!bimModelLoaded.value) {
      void loadBimModel()
    }
  },
)

watch(
  () => viewVisibility.pointcloud,
  (visible) => {
    if (!visible) {
      pointcloudLoaded.value = false
      return
    }
    if (!pointcloudLoaded.value) {
      void loadPointcloudModel()
    }
  },
)

watch(
  () => viewVisibility.gaussian,
  (visible) => {
    if (!visible) return
    void loadGaussianModel()
  },
)

watch(
  () => boundGaussFileId.value,
  (next, prev) => {
    if (!next || next === prev) return
    if (!viewVisibility.gaussian) return
    gaussianModelLoaded.value = false
    void loadGaussianModel(0, true)
  },
)

watch(
  () => viewVisibility.panorama,
  (visible) => {
    if (!visible) return
    void loadPanoramaImage()
  },
)

watch(
  () => modeState.value,
  (state, prev) => {
    const wasAnnotation = isAnnotationState(prev)
    const isAnnotation = isAnnotationState(state)
    if (wasAnnotation && !isAnnotation) {
      annotationFormLocked.value = true
    }
    if (isAnnotation) {
      annotationFormLocked.value = false
    }
    if (!isAnnotation) {
      bimPointcloudSync.value = false
      annotationModeEntryViewState.value = null
      annotationMaskVisible.value = false
      annotationPoint.value = null
      annotationSource.value = null
      pendingViewStateReplayKey.value = ''
      annotationAnchor.value = null
      screenshotOverlayVisible.value = false
      resetAnnotationForm()
    }
    if (state === 'mix') {
      bimPointcloudSync.value = false
    }
    if (state === 'annotation' && prev !== 'annotation') {
      nextTick(() => {
        smallWindowRef.value?.setCollapsed?.(true)
        setMiniMapAnnotationPosition()
      })
    }
  },
)

watch([bimModelLoaded, pointcloudLoaded], () => {
  applyFixedViewScale()
  if (!shouldAutoApplyTrajectoryPose()) return
  if (!lastTrajectoryPoint.value || !bimPointcloudCalibration.value) return
  if (!bimModelLoaded.value || !pointcloudLoaded.value) return
  syncSharedPoseFromTrajectoryPoint(lastTrajectoryPoint.value)
  logBimRelativeTransform()
})

watch(
  [
    () => annotationModeEntryViewState.value,
    () => annotationSelectedKey.value,
    () => modeState.value,
    bimModelLoaded,
    pointcloudLoaded,
    gaussianModelLoaded,
    consistencyResultReadyState,
  ],
  () => {
    replayAnnotationModeEntryViewStateWhenReady()
  },
)

watch(
  [
    () => mixModeEntryViewState.value,
    () => modeState.value,
    () => mixViewerRef.value,
  ],
  () => {
    replayMixModeEntryViewStateWhenReady()
  },
)

watch(
  [
    () => pendingViewStateReplayKey.value,
    () => annotationSelectedKey.value,
    () => modeState.value,
    bimModelLoaded,
    pointcloudLoaded,
    gaussianModelLoaded,
    consistencyResultReadyState,
  ],
  ([pendingKey, selectedKey]) => {
    if (!pendingKey) return
    if (selectedKey !== pendingKey) return
    replayAnnotationViewStateWhenReady(pendingKey)
  },
)

watch([bimModelLoaded, () => bimPointcloudCalibration.value], () => {
  if (!shouldAutoApplyTrajectoryPose()) return
  if (!lastTrajectoryPoint.value || !bimPointcloudCalibration.value) return
  if (!bimModelLoaded.value) return
  syncSharedPoseFromTrajectoryPoint(lastTrajectoryPoint.value)
  logBimRelativeTransform()
})

watch([pointcloudLoaded], () => {
  if (!shouldAutoApplyTrajectoryPose()) return
  if (!lastTrajectoryPoint.value) return
  if (!pointcloudLoaded.value) return
  syncSharedPoseFromTrajectoryPoint(lastTrajectoryPoint.value)
  logBimRelativeTransform()
})

watch(
  () => activeScanId.value,
  (next) => {
    reportSelectedAnnotationKeys.value = []
    resetAnnotationData()
    if (next && projectId.value) {
      void loadActiveScanData()
      void loadAnnotationList()
      return
    }
    resetScanState()
    annotationPoint.value = null
    annotationSource.value = null
    annotationMaskVisible.value = false
    resetAnnotationForm()
  },
)

watch(
  () => route.query.projectId,
  (value) => {
    syncRouteFocusTarget()
    const nextProjectId = parseQueryNumber(value)
    if (nextProjectId === projectId.value) return
    projectId.value = nextProjectId
    if (!projectId.value) {
      ElMessage.warning('缺少项目ID，无法加载四分屏')
      return
    }
    projectFileGroups.value = []
    scanSwitchableMap.value = {}
    scanLatestReadyMap.value = {}
    scanSwitchableRequestMap.clear()
    scanLatestReadyRequestMap.clear()
    void loadScanList(userSelectedRange.value ? timeRange.value : null, {
      preferLatestFullReady: !userSelectedRange.value,
    })
  },
)

watch(
  () => [
    route.query.scanFileId,
    route.query.annotationId,
    route.query.annotationKey,
    route.query.replayToken,
  ],
  () => {
    syncRouteFocusTarget()
    if (!projectId.value) return

    const nextScanId = routeFocusScanId.value
    if (nextScanId && nextScanId !== activeScanId.value) {
      const routeScan = scanList.value.find(
        (item) => item.scanFileId === nextScanId,
      )
      if (routeScan) {
        void (async () => {
          if (hasRouteAnnotationReplayTarget()) {
            activeScanId.value = nextScanId
            routeFocusScanId.value = null
            return
          }
          const canSwitch = await isScanSwitchableForFourScreen(routeScan)
          if (canSwitch) {
            activeScanId.value = nextScanId
            routeFocusScanId.value = null
            return
          }
          void loadScanList(userSelectedRange.value ? timeRange.value : null, {
            preferLatestFullReady: !userSelectedRange.value,
          })
        })()
      } else {
        void loadScanList(userSelectedRange.value ? timeRange.value : null, {
          preferLatestFullReady: !userSelectedRange.value,
        })
      }
      return
    }

    void focusAnnotationFromRoute()
  },
)

onMounted(() => {
  applyViewLayout()
  syncRouteFocusTarget()
  projectId.value = parseQueryNumber(route.query.projectId)
  if (!projectId.value) {
    ElMessage.warning('缺少项目ID，无法加载四分屏')
    return
  }
  void loadScanList(null, { preferLatestFullReady: true })
  nowValue.value = Date.now()
  nowTimer = window.setInterval(() => {
    nowValue.value = Date.now()
  }, 60_000)
  nextTick(() => {
    handleMiniMapResize()
  })
  window.addEventListener('resize', handleMiniMapResize)
})
const handleGaussianError = () => {
  ElMessage.error('高斯模型加载失败')
}

const handleRangeChange = (range: { start: number; end: number } | null) => {
  userSelectedRange.value = Boolean(range)
  timeRange.value = range
  void loadScanList(range)
}

const switchToScanSlot = async (buildingName: string, floorName: string) => {
  const normalizedBuilding = normalizeSlotName(buildingName)
  const normalizedFloor = normalizeSlotName(floorName)
  const targetScan = await findSwitchableScanForSlot(
    normalizedBuilding,
    normalizedFloor,
  )

  if (!targetScan) {
    syncHeaderSelectionFromActiveScan()
    ElMessage.warning('当前幢层下暂无完成校准的点云，无法切换')
    return
  }

  selectedBuildingName.value = normalizedBuilding
  selectedFloorName.value = normalizedFloor

  if (targetScan.scanFileId === activeScanId.value) return
  activeScanId.value = targetScan.scanFileId
}

const handleHeaderBuildingChange = (buildingName: string) => {
  const normalizedBuilding = normalizeSlotName(buildingName)
  if (!normalizedBuilding) {
    syncHeaderSelectionFromActiveScan()
    return
  }

  const nextFloorName = resolveSwitchableFloorName(
    normalizedBuilding,
    selectedFloorName.value,
  )
  if (!nextFloorName) {
    syncHeaderSelectionFromActiveScan()
    ElMessage.warning('当前幢下暂无完成校准的点云，无法切换')
    return
  }

  void switchToScanSlot(normalizedBuilding, nextFloorName)
}

const handleHeaderFloorChange = (floorName: string) => {
  const normalizedFloor = normalizeSlotName(floorName)
  if (!selectedBuildingName.value || !normalizedFloor) {
    syncHeaderSelectionFromActiveScan()
    return
  }
  void switchToScanSlot(selectedBuildingName.value, normalizedFloor)
}

const handleResetLatest = () => {
  if (!projectId.value) {
    ElMessage.warning('缺少项目ID，无法加载四分屏')
    return
  }
  userSelectedRange.value = false
  void loadScanList(null, { preferLatestFullReady: true })
}

const handleSegmentClick = (segment: ScanSegment) => {
  const clickedRange = {
    start: segment.start,
    end: segment.end,
  }
  userSelectedRange.value = true
  timeRange.value = clickedRange
  void loadScanList(clickedRange)
}

onBeforeUnmount(() => {
  stopGaussianTrajectoryPoseSync()
  resetMixCaptureSyncScheduler()
  if (dxfBlobUrl.value) {
    URL.revokeObjectURL(dxfBlobUrl.value)
    dxfBlobUrl.value = null
  }
  clearAnnotationScreenshotUrls()
  if (nowTimer) {
    window.clearInterval(nowTimer)
    nowTimer = null
  }
  window.removeEventListener('resize', handleMiniMapResize)
})
</script>

<style scoped>
.quad-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

/* 动态容器 */
.dynamic-container {
  flex: 1;
  display: grid;
  gap: 2px;
  background: #374151;
  overflow: hidden;
  position: relative;
  /* 默认四分屏布局 */
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.annotation-label-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 20;
}

.annotation-label {
  position: absolute;
  top: 0px;

  display: inline-flex;
  gap: 10px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(6px);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.35);
}

.annotation-label.is-left {
  left: 25%;
}

.annotation-label.is-right {
  right: 25%;
}

.annotation-label-icon {
  width: 20px;
  height: 20px;
  margin-top: 3px;
}

.annotation-label-text {
  color: #fff;
  font-family: 'PingFang SC', sans-serif;
  font-style: normal;
  font-weight: 500;
  line-height: 160%;
  letter-spacing: -0.4px;
}

.annotation-guide-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.55);
  z-index: 80;
  cursor: pointer;
}

.annotation-guide-card {
  padding: 18px 32px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(15, 23, 42, 0.82);
  box-shadow: 0 20px 32px rgba(15, 23, 42, 0.45);
}

.annotation-guide-text {
  color: #fff;
  font-family: 'PingFang SC', sans-serif;
  font-size: 20px;
  font-style: normal;
  font-weight: 500;
  line-height: 160%;
  letter-spacing: -0.4px;
}

/* 面板容器 */
.annotation-form-panel {
  position: absolute;
  z-index: 120;
  width: min(300px, 92vw);
  min-height: 0;
  padding: 20px 12px 12px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 10px 20px rgba(253, 251, 251, 0.22);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}

.annotation-form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  margin: -6px -4px 2px -4px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.06);
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.annotation-form-header:active {
  cursor: grabbing;
}

.annotation-form-title {
  font-size: 12px;
  color: rgba(15, 23, 42, 0.7);
  letter-spacing: 0.2px;
}

.annotation-form-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.05);
  color: #3b3b3b;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.annotation-form-close:hover {
  background: rgba(0, 0, 0, 0.12);
}

.annotation-form-panel.is-saved {
  border-color: rgba(34, 197, 94, 0.8);
  box-shadow:
    0 10px 20px rgba(253, 251, 251, 0.22),
    0 0 0 2px rgba(34, 197, 94, 0.18);
}

.annotation-form-scroll {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  margin-right: -4px;
}

.annotation-form-scroll::-webkit-scrollbar {
  width: 6px;
}

.annotation-form-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(100, 116, 139, 0.32);
}

/* 每个字段块 */
.annotation-form-field {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
/* label 不要撑宽 */
.annotation-form-label {
  font-size: 12px;
  line-height: 1.2;
  color: rgba(0, 0, 0, 0.65);
  letter-spacing: 0.2px;
  user-select: none;
}
:deep(.el-form-item--label-top .el-form-item__label) {
  display: block;
  height: auto;
  line-height: 22px;
  margin-bottom: 0px;
  text-align: left;
  width: -moz-fit-content;
  width: fit-content;
}
:deep(.el-form-item) {
  display: flex;
  --font-size: 14px;
  margin-bottom: 10px;
}
:deep(.el-range-editor.el-input__wrapper) {
  width: 100%;
}

/* 底部操作区 */
.annotation-form-actions {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
}

.annotation-form-status {
  margin-top: 10px;
  margin-bottom: 6px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.5;
}

.annotation-form-status.is-pending {
  color: #92400e;
  background: rgba(251, 191, 36, 0.14);
  border: 1px solid rgba(245, 158, 11, 0.28);
}

.annotation-screenshot-preview {
  width: 100%;
  padding: 6px;
  border-radius: 8px;
  border: 1px dashed rgba(15, 23, 42, 0.18);
  background: #f8fafc;
  --annotation-thumb-width: 88px;
  --annotation-thumb-height: 66px;
  max-height: calc(var(--annotation-thumb-height) * 2 + 8px + 12px);
  overflow-y: auto;
  overflow-x: hidden;
}

.annotation-screenshot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, var(--annotation-thumb-width));
  grid-auto-rows: var(--annotation-thumb-height);
  gap: 8px;
  align-content: start;
}

.annotation-screenshot-item {
  position: relative;
}

.annotation-screenshot-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  border: none;
  background: rgba(15, 23, 42, 0.75);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 2;
  opacity: 0;
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.annotation-screenshot-item:hover .annotation-screenshot-remove {
  opacity: 1;
  transform: scale(1.02);
}

.annotation-screenshot-preview :deep(.el-image) {
  width: 100%;
  height: 100%;
  aspect-ratio: auto;
  display: block;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.annotation-screenshot-preview :deep(.el-image__inner) {
  width: 100%;
  height: 100%;
  display: block;
  border-radius: 6px;
  object-fit: cover;
}

/* 分隔线（更像“胶囊”里的分割） */
.annotation-action-divider {
  width: 1px;
  height: 22px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 99px;
}

/* 圆形按钮：统一尺寸、hover、active */
.annotation-action-button {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);

  display: inline-flex;
  align-items: center;
  justify-content: center;

  cursor: pointer;
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease,
    border-color 0.16s ease;
}

.annotation-action-button:hover {
  transform: translateY(-1px);
  border-color: rgba(64, 158, 255, 0.35);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.14);
}

.annotation-action-button:active {
  transform: translateY(0px) scale(0.98);
}

.annotation-action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 让图标更协调 */
.annotation-action-button .el-icon {
  font-size: 18px;
}

/* 两种按钮的“语义色”点缀：不指定主题色也能有层次 */
.annotation-action-button.is-camera {
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.98),
    rgba(245, 247, 250, 0.98)
  );
}

.annotation-action-button.is-submit {
  border-color: rgba(64, 158, 255, 0.25);
  background: linear-gradient(
    180deg,
    rgba(236, 248, 255, 1),
    rgba(255, 255, 255, 0.98)
  );
}

.annotation-action-button.is-delete {
  border-color: rgba(185, 28, 28, 0.25);
  color: #b91c1c;
}

/* 窄屏再更紧凑一点 */
@media (max-width: 360px) {
  .annotation-form-field {
    grid-template-columns: 64px 1fr;
  }
}

/* 布局模式样式 */
.quad-view[data-layout='single'] .dynamic-container {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
}

.quad-view[data-layout='double-horizontal'] .dynamic-container {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr;
}

.quad-view[data-layout='double-vertical'] .dynamic-container {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr 1fr;
}

.quad-view[data-layout='triple-left'] .dynamic-container {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.quad-view[data-layout='triple-right'] .dynamic-container {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.quad-view[data-layout='quad'] .dynamic-container {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

/* 右侧视图选择 */
.view-toggle-panel {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 30;
}

.view-toggle-lock {
  position: absolute;
  inset: -8px;
  border-radius: 24px;
  cursor: not-allowed;
  z-index: 1;
}

.view-toggle-btn {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 1px solid #1f2937;
  background: rgba(15, 23, 42, 0.92);
  color: #94a3b8;
  display: flex;
  margin-bottom: 10px;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.view-toggle-btn:hover {
  color: #e2e8f0;
  border-color: #334155;
}

.view-toggle-btn.locked {
  cursor: not-allowed;
  opacity: 0.45;
  border-color: rgba(71, 85, 105, 0.45);
  box-shadow: none;
}

.view-toggle-btn.active {
  background: rgba(20, 85, 124, 0.65);
  border-color: rgba(20, 85, 124, 0.65);
  color: #f7f8f9;
  box-shadow: 0 6px 14px rgba(20, 184, 166, 0.35);
}

.annotation-view-sidebar {
  position: absolute;
  left: 16px;
  top: 50%;
  z-index: 30;
  display: flex;
  min-width: 148px;
  flex-direction: column;
  gap: 10px;
  padding: 14px 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.82);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.34);
  transform: translateY(-50%);
  backdrop-filter: blur(14px);
}

.annotation-view-sidebar.is-collapsed {
  min-width: 0;
  padding: 10px;
}

.annotation-view-sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.annotation-view-sidebar__title {
  padding: 0 4px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.08em;
  color: rgba(148, 163, 184, 0.88);
}

.annotation-view-sidebar__collapse {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(51, 65, 85, 0.9);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.84);
  color: #cbd5e1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease;
}

.annotation-view-sidebar__visibility {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(51, 65, 85, 0.9);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.84);
  color: #cbd5e1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease;
}

.annotation-view-sidebar__visibility:hover {
  border-color: rgba(56, 189, 248, 0.48);
  color: #f8fafc;
}

.annotation-view-sidebar__collapse:hover {
  border-color: rgba(56, 189, 248, 0.48);
  color: #f8fafc;
}

.annotation-view-sidebar__item {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid rgba(51, 65, 85, 0.9);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.72);
  color: #cbd5e1;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.annotation-view-sidebar__item:hover {
  border-color: rgba(56, 189, 248, 0.48);
  color: #f8fafc;
}

.annotation-view-sidebar__item.active {
  border-color: rgba(14, 165, 233, 0.58);
  background: linear-gradient(
    135deg,
    rgba(8, 47, 73, 0.96),
    rgba(21, 94, 117, 0.9)
  );
  color: #f8fafc;
  box-shadow: 0 10px 24px rgba(14, 165, 233, 0.22);
}

.annotation-view-sidebar__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(100, 116, 139, 0.9);
  flex-shrink: 0;
  transition:
    transform 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.annotation-view-sidebar__item.active .annotation-view-sidebar__dot {
  background: #38bdf8;
  box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.18);
  transform: scale(1.1);
}

.annotation-view-sidebar__label {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
}

/* 底部模式切换 */
.mode-switcher {
  position: absolute;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 50;
}

.mode-toggle-wrapper {
  position: relative;
}

.mode-toggle {
  position: relative;
  width: min(360px, 82vw);
  height: 60px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  padding: 7px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: linear-gradient(90deg, #2f6f96 0%, #2b5d7b 38%, #4b4b4b 100%);
  box-shadow: 0 16px 26px rgba(15, 23, 42, 0.45);
  overflow: hidden;
}

.mode-toggle[data-mode='free'] {
  width: 80px;
  height: 44px;
  padding: 12px;
  display: inline-flex;
  justify-content: center;
  align-items: flex-start;
  gap: 16px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.36);
  backdrop-filter: blur(16px);
  box-shadow: none;
}

.mode-toggle[data-mode='free'] .mode-toggle-highlight {
  display: none;
}

.mode-toggle-highlight {
  position: absolute;
  top: 7px;
  bottom: 7px;
  left: 7px;
  width: calc(50% - 7px);
  border-radius: 999px;
  opacity: 0;
  background: #1d4ed8;
  transform: translateX(0);
  transition:
    transform 0.25s ease,
    background-color 0.25s ease,
    opacity 0.2s ease;
  pointer-events: none;
}

.mode-toggle[data-mode='annotation'] .mode-toggle-highlight {
  opacity: 1;
  background: linear-gradient(135deg, #1d4ed8, #0ea5e9);
  transform: translateX(0);
}

.mode-toggle[data-mode='mix'] .mode-toggle-highlight {
  opacity: 1;
  background: linear-gradient(135deg, #4b5563, #9ca3af);
  transform: translateX(100%);
}

.blend-toggle {
  position: relative;
  width: min(360px, 82vw);
  height: 44px;
  display: flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  overflow: hidden;
  box-shadow: 0 16px 26px rgba(15, 23, 42, 0.45);
  touch-action: none;
  user-select: none;
}

.blend-track {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    #2f6f96 0%,
    #2b5d7b var(--blend-pos, 58%),
    #3c3c3c var(--blend-pos, 58%),
    #5c5c5c 100%
  );
  pointer-events: none;
}

.blend-knob {
  position: absolute;
  left: var(--blend-pos, 58%);
  top: 50%;
  transform: translate(-50%, -50%);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.15);
  background: radial-gradient(circle at 30% 30%, #2da3ff, #1e5ea8);
  color: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  box-shadow: 0 16px 28px rgba(15, 23, 42, 0.5);
  touch-action: none;
  user-select: none;
}

.blend-knob:active {
  cursor: grabbing;
}

.mode-toggle-btn {
  position: relative;
  z-index: 1;
  height: 100%;
  border: none;
  background: transparent;
  color: #d8e3f2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.2s ease;
}

.mode-toggle[data-mode='free'] .mode-toggle-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  color: #ffffff;
}

.mode-toggle-icon {
  width: 20px;
  height: 20px;
  display: block;
}

.blend-icon {
  width: 20px;
  height: 20px;
  display: block;
}

.mode-toggle[data-mode='free'] .mode-toggle-btn::after {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(45, 163, 255, 0.55),
    rgba(45, 163, 255, 0)
  );
  opacity: 0;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  transform: scale(0.9);
  pointer-events: none;
}

.mode-toggle[data-mode='free'] .mode-toggle-btn:hover {
  color: #e6f6ff;
  filter: drop-shadow(0 0 6px rgba(45, 163, 255, 0.65));
}

.mode-toggle[data-mode='free'] .mode-toggle-btn:hover::after {
  opacity: 1;
  transform: scale(1);
}

.mode-toggle-btn span {
  display: none;
}

.mode-toggle-btn:hover {
  color: #f8fafc;
}

.mode-toggle-btn.active {
  color: #f8fafc;
}

.mode-toggle-btn.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.mode-close-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: radial-gradient(circle at 30% 30%, #4b4b4b, #2f2f2f);
  color: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 14px 24px rgba(15, 23, 42, 0.45);
  transition: all 0.2s ease;
}

.mode-close-btn:hover {
  color: #ffffff;
  border-color: #475569;
  background: rgba(15, 23, 42, 1);
}

.quad-link-btn {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 44px;
  height: 44px;
  border: 1px solid rgba(31, 41, 55, 0.35);
  border-radius: 100px;
  background: rgba(255, 255, 255, 0.36);
  backdrop-filter: blur(16px);
  display: inline-flex;
  padding: 12px;
  justify-content: center;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  z-index: 35;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease;
}

.quad-link-btn:hover {
  transform: translate(-50%, -50%) scale(1.05);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.25);
}

.quad-link-btn.is-aligning {
  background: rgba(20, 85, 124, 0.65);
  border-color: rgba(20, 85, 124, 0.65);
  box-shadow: 0 6px 14px rgba(20, 184, 166, 0.35);
}

.quad-link-btn.is-synced {
  background: rgba(20, 85, 124, 0.65);
  border-color: rgba(20, 85, 124, 0.65);
  color: #f7f8f9;
  box-shadow: 0 6px 14px rgba(20, 184, 166, 0.35);
}

.quad-link-icon {
  width: 20px;
  height: 20px;
  display: block;
}

/* 图纸轨迹小窗口 */
.mini-map-float {
  position: absolute;
  z-index: 40;
  width: 360px;
  touch-action: none;
}

.mini-map-float.is-dragging {
  cursor: grabbing;
}

.mini-map-float :deep(.small-window-header) {
  cursor: grab;
  user-select: none;
}

/* 面板通用样式 */
:deep(.bim-view-panel),
:deep(.pointcloud-view-panel),
:deep(.panorama-view-panel),
:deep(.mix-view-panel) {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
}

:deep(.panel-refresh-btn) {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(248, 250, 252, 0.9);
  cursor: pointer;
  z-index: 12;
  transition:
    transform 0.2s ease,
    color 0.2s ease,
    filter 0.2s ease;
}

:deep(.panel-actions) {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 12;
}

:deep(.panel-actions .panel-refresh-btn) {
  position: static;
}

:deep(.panel-refresh-btn:hover) {
  color: #ffffff;
  transform: translateY(-1px) scale(1.05);
  filter: drop-shadow(0 0 6px rgba(45, 163, 255, 0.55));
}

:deep(.panel-refresh-btn.is-first-person-active),
:deep(.panel-refresh-btn.is-first-person-active:hover),
:deep(.panel-refresh-btn.is-first-person-active:focus),
:deep(.panel-refresh-btn.is-first-person-active:active) {
  color: #8fe46d;
  background: transparent;
  transform: translateY(-1px) scale(1.04);
  filter: drop-shadow(0 0 8px rgba(114, 223, 99, 0.55))
    drop-shadow(0 0 14px rgba(31, 140, 255, 0.28));
}

:deep(.panel-refresh-btn.is-first-person-active .el-icon) {
  color: #8fe46d;
  filter: drop-shadow(0 0 8px rgba(114, 223, 99, 0.55))
    drop-shadow(0 0 14px rgba(31, 140, 255, 0.28));
}

:deep(.panel-refresh-btn .el-icon) {
  font-size: 16px;
}

:deep(.empty-placeholder) {
  position: absolute;
  inset: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2c2c2c;
  z-index: 1;
}

:deep(.placeholder-content) {
  text-align: center;
  padding: 40px;
}

:deep(.placeholder-icon) {
  font-size: 64px;
  color: #666;
  margin-bottom: 16px;
}

:deep(.placeholder-text) {
  font-size: 14px;
  color: #fbf6f6;
  margin: 0;
}

:deep(.panorama-debug) {
  position: absolute;
  top: 12px;
  right: 10px;
  z-index: 100;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  padding: 0 16px;
  color: #fff;
  font-size: 12px;
  min-width: 240px;
  max-height: 0;
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
  overflow: hidden;
  pointer-events: none;
  transition:
    max-height 0.22s ease,
    opacity 0.22s ease,
    transform 0.22s ease,
    padding 0.22s ease;
}

:deep(.panorama-debug.is-open) {
  max-height: 260px;
  opacity: 1;
  transform: translateY(0) scale(1);
  padding: 12px 16px;
  pointer-events: auto;
}

:deep(.panorama-debug .debug-title) {
  font-weight: bold;
  margin-bottom: 10px;
  color: #409eff;
  font-size: 14px;
}

:deep(.panorama-debug .debug-row) {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

:deep(.panorama-debug .debug-actions) {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

:deep(.panorama-container) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #1a1a1a;
  cursor: grab;
}

:deep(.panorama-container:active) {
  cursor: grabbing;
}

:deep(.panorama-container canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

:deep(.bim-viewport),
:deep(.pointcloud-viewport),
:deep(.mix-viewport),
:deep(.mix-view-panel),
:deep(.mix-stack) {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.mix-panel-slot {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
  display: flex;
  min-height: 0;
}

.mix-capture-layer {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  opacity: 0;
}

:deep(.panorama-view-panel .timeline-overlay) {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  z-index: 20;
}

:deep(.report-generate-confirm-dialog) {
  width: 460px;
  border-radius: 14px;
  overflow: hidden;
}

:deep(.report-generate-confirm-dialog .el-message-box__header) {
  padding: 16px 20px 12px;
  border-bottom: 1px solid #eef2f6;
}

:deep(.report-generate-confirm-dialog .el-message-box__title) {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

:deep(.report-generate-confirm-dialog .el-message-box__message) {
  padding: 0;
}

:deep(.report-generate-confirm-content) {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px 4px;
  line-height: 1.6;
  color: #1f2937;
}

:deep(.report-generate-confirm-hero) {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

:deep(.report-generate-confirm-hero-icon) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: linear-gradient(135deg, #e8f2ff 0%, #f5f9ff 100%);
  font-size: 20px;
}

:deep(.report-generate-confirm-hero-text) {
  min-width: 0;
}

:deep(.report-generate-confirm-hero-title) {
  margin: 0;
  font-size: 16px;
  line-height: 1.25;
  font-weight: 700;
  color: #0f172a;
}

:deep(.report-generate-confirm-desc) {
  margin: 0;
  margin-top: 4px;
  color: #4b5563;
  font-size: 14px;
}

:deep(.report-generate-confirm-count) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #dcfce7;
  background: #f0fdf4;
  color: #15803d;
  font-weight: 600;
  font-size: 14px;
}

:deep(.report-generate-confirm-count strong) {
  color: #166534;
  font-size: 16px;
}

:deep(.report-generate-confirm-count-mark) {
  display: inline-flex;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #22c55e;
  color: #fff;
  font-size: 12px;
}

:deep(.report-generate-confirm-tip) {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
  padding-left: 50px;
}

:deep(.report-generate-confirm-dialog .el-message-box__btns) {
  padding: 14px 20px 18px;
  border-top: 1px solid #eef2f6;
  justify-content: flex-end;
  gap: 10px;
}

:deep(.report-generate-confirm-dialog .el-message-box__btns .el-button) {
  min-width: 92px;
  border-radius: 8px;
  font-weight: 600;
}
</style>
