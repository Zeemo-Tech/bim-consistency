<template>
  <div ref="containerEl" class="BimPointcloudAlign-container">
    <!-- 顶部工具栏 -->
    <div class="topbar">
      <div class="topbar-left">
        <h1 class="brand-title">
          BIM 与点云校准 - {{ projectNameForDisplay }}
        </h1>
        <div class="topbar-center">
          <el-tag round effect="light">步骤 1/2</el-tag>
        </div>
      </div>

      <div class="topbar-right">
        <el-button @click="handleBackToCalibration">返回</el-button>
        <el-button
          :disabled="!projectId || !scanFileId || !bimFileId"
          :loading="loadingAlignmentMatrixDialog"
          @click="handleShowAlignmentMatrix"
        >
          校准矩阵
        </el-button>
        <el-tooltip
          :content="saveCalibrationTooltip"
          :disabled="!saveCalibrationTooltip"
          placement="bottom"
        >
          <el-button
            type="primary"
            :disabled="!canSaveCalibration"
            :loading="savingCalibration"
            @click="handleCalibrationComplete"
          >
            校准完成
          </el-button>
        </el-tooltip>
        <el-button @click="showPanel = !showPanel">
          {{ showPanel ? '收起' : '展开' }}
        </el-button>
      </div>
    </div>

    <div class="main-content">
      <!-- 左侧垂直工具栏 -->
      <div class="left-toolbar">
        <el-tooltip content="重置视角" placement="right">
          <div class="tool-item">
            <el-button
              class="tool-btn"
              circle
              type="text"
              :icon="RefreshLeft"
              :disabled="!hasModel"
              @click="resetView"
            />
          </div>
        </el-tooltip>
        <el-tooltip
          :content="
            projectionMode === 'perspective'
              ? '透视（点击切换正交）'
              : '正交（点击切换透视）'
          "
          placement="right"
        >
          <div class="tool-item">
            <el-button
              class="tool-btn tool-btn--img"
              :class="{ 'is-on': projectionMode === 'orthographic' }"
              circle
              type="text"
              @click="
                setProjectionMode(
                  projectionMode === 'perspective'
                    ? 'orthographic'
                    : 'perspective',
                )
              "
            >
              <img
                class="tool-btn__img1"
                :src="
                  projectionMode === 'perspective' ? toushiIcon : zhengjiaoIcon
                "
                alt="投影模式"
              />
            </el-button>
          </div>
        </el-tooltip>
        <el-tooltip content="网格" placement="right">
          <div class="tool-item">
            <el-button
              class="tool-btn tool-btn--img"
              :class="{ 'is-on': showGrid }"
              circle
              type="text"
              @click="toggleGrid"
            >
              <img class="tool-btn__img" :src="wanggeIcon" alt="网格" />
            </el-button>
          </div>
        </el-tooltip>
        <el-tooltip
          :content="showMeshWireframe ? '关闭线框' : '显示线框'"
          placement="right"
        >
          <div class="tool-item">
            <el-button
              class="tool-btn tool-btn--svg"
              :class="{ 'is-on': showMeshWireframe }"
              circle
              type="text"
              :disabled="!hasGltf"
              @click="toggleMeshWireframe"
            >
              <!-- 线框：2.5D 错位立方体，全边可见 -->
              <svg
                class="tool-btn__svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="3" y="9" width="12" height="12" />
                <rect x="9" y="3" width="12" height="12" />
                <line x1="3" y1="9" x2="9" y2="3" />
                <line x1="15" y1="9" x2="21" y2="3" />
                <line x1="15" y1="21" x2="21" y2="15" />
                <line x1="3" y1="21" x2="9" y2="15" />
              </svg>
            </el-button>
          </div>
        </el-tooltip>
        <el-tooltip :content="clipBoundsTooltip" placement="right">
          <div class="tool-item">
            <el-button
              class="tool-btn tool-btn--svg"
              :class="{
                'is-on': showBounds,
                'is-disabled': !showBounds && !!clipBoundsDisabledReason,
              }"
              circle
              type="text"
              @click="onBoundsButtonClick"
            >
              <svg
                class="tool-btn__svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M3 7 L12 3 L21 7 L21 17 L12 21 L3 17 Z" />
                <line x1="3" y1="7" x2="21" y2="7" />
                <line x1="3" y1="12" x2="21" y2="12" stroke-dasharray="3 2" />
                <line x1="12" y1="3" x2="12" y2="7" />
              </svg>
            </el-button>
          </div>
        </el-tooltip>
        <el-divider />
        <el-tooltip content="前视图" placement="right">
          <div class="tool-item">
            <el-button
              class="tool-btn tool-btn--text"
              :class="{ 'is-on': hasModel && activeView === 'front' }"
              circle
              type="text"
              :disabled="!hasModel"
              @click="setFrontView"
            >
              前
            </el-button>
          </div>
        </el-tooltip>
        <el-tooltip content="俯视图" placement="right">
          <div class="tool-item">
            <el-button
              class="tool-btn tool-btn--text"
              :class="{ 'is-on': hasModel && activeView === 'top' }"
              circle
              type="text"
              :disabled="!hasModel"
              @click="setTopView"
            >
              俯
            </el-button>
          </div>
        </el-tooltip>
        <el-tooltip content="侧视图" placement="right">
          <div class="tool-item">
            <el-button
              class="tool-btn tool-btn--text"
              :class="{ 'is-on': hasModel && activeView === 'side' }"
              circle
              type="text"
              :disabled="!hasModel"
              @click="setSideView"
            >
              侧
            </el-button>
          </div>
        </el-tooltip>
        <el-divider />
        <el-tooltip
          :content="modelHidden ? '显示模型' : '隐藏模型'"
          placement="right"
        >
          <div class="tool-item">
            <el-button
              class="tool-btn"
              :class="{ 'is-on': modelHidden }"
              circle
              type="text"
              :icon="modelHidden ? View : Hide"
              :disabled="!hasGltf"
              @click="toggleModelVisibility"
            />
          </div>
        </el-tooltip>
        <el-tooltip
          :content="pointCloudHidden ? '显示点云' : '隐藏点云'"
          placement="right"
        >
          <div class="tool-item">
            <el-button
              class="tool-btn tool-btn--svg"
              :class="{ 'is-on': pointCloudHidden }"
              circle
              type="text"
              :disabled="!hasTileset"
              @click="togglePointCloudVisibility"
            >
              <!-- 点云：随机散点，直观表达三维点云数据 -->
              <svg
                class="tool-btn__svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="5" cy="17" r="1.3" />
                <circle cx="9" cy="8" r="1.5" />
                <circle cx="14" cy="14" r="1.1" />
                <circle cx="18" cy="6" r="1.4" />
                <circle cx="7" cy="13" r="0.9" />
                <circle cx="16" cy="10" r="1.1" />
                <circle cx="12" cy="19" r="1.2" />
                <circle cx="20" cy="15" r="1.0" />
                <circle cx="4" cy="10" r="0.8" />
                <circle cx="11" cy="5" r="0.9" />
                <circle cx="19" cy="19" r="0.8" />
                <circle cx="3" cy="5" r="1.0" />
              </svg>
            </el-button>
          </div>
        </el-tooltip>
      </div>

      <!-- 中间3D视图区域 -->
      <div ref="viewportEl" class="viewport" />

      <!-- 右侧控制面板 -->
      <div v-if="showPanel" class="right-panel">
        <div class="panel-section">
          <div class="section-title">配准</div>
          <div class="control-row">
            <el-switch v-model="editMode" @change="onEditModeChange" />
            <span class="label">粗配准（手动）</span>
          </div>
          <div class="edit-target-row">
            <button
              class="edit-target-btn"
              :class="{ 'is-active': registrationStage === 'coarse' }"
              :disabled="!hasGltf && !hasTileset"
              @click="activateCoarseRegistration"
            >
              粗配准
            </button>
            <button
              class="edit-target-btn"
              :class="{ 'is-active': registrationStage === 'fine' }"
              :disabled="!hasGltf || !hasTileset || fineAlignLoading"
              @click="activateFineRegistration"
            >
              {{ fineAlignLoading ? '精调中...' : '精细化配准' }}
            </button>
          </div>
          <template v-if="registrationStage === 'coarse'">
            <div class="coarse-actions">
              <el-button
                type="primary"
                size="small"
                :loading="savingCalibration"
                :disabled="!canSaveCoarseAlignment"
                @click="saveCoarseAlignmentMatrix"
              >
                保存粗配准矩阵
              </el-button>
              <div class="coarse-actions__hint">{{ coarseSaveHint }}</div>
            </div>
          </template>
          <template v-else>
            <div class="fine-params">
              <div class="fine-param-row">
                <span class="fine-param-label">负优化策略</span>
                <el-switch
                  v-model="fineApplyWhenRegressed"
                  :disabled="fineAlignLoading"
                  active-text="告警但应用精调"
                  inactive-text="仅告警不应用"
                  inline-prompt
                  @change="markFineAlignmentDirty"
                />
              </div>
              <div class="fine-threshold-grid">
                <div class="fine-threshold-item">
                  <span class="fine-threshold-label">RMSE 阈值</span>
                  <el-input-number
                    v-model="fineRmseRegressRatio"
                    :disabled="fineAlignLoading"
                    :min="1"
                    :max="2"
                    :step="0.01"
                    :precision="2"
                    controls-position="right"
                    @change="onFineRmseRegressRatioChange"
                  />
                </div>
                <div class="fine-threshold-item">
                  <span class="fine-threshold-label">Fitness 阈值</span>
                  <el-input-number
                    v-model="fineFitnessRegressRatio"
                    :disabled="fineAlignLoading"
                    :min="0.5"
                    :max="1"
                    :step="0.01"
                    :precision="2"
                    controls-position="right"
                    @change="onFineFitnessRegressRatioChange"
                  />
                </div>
              </div>
              <button
                class="fine-reset-link"
                :disabled="fineAlignLoading"
                @click="resetFineThresholdDefaults"
              >
                恢复默认阈值
              </button>
            </div>
            <div class="fine-actions">
              <el-button
                type="primary"
                :loading="fineAlignLoading"
                :disabled="!canRunFineAlignment"
                style="width: 100%"
                @click="runFineAlignment"
              >
                开始计算
              </el-button>
              <el-button
                :loading="savingCalibration"
                :disabled="!canSaveFineAlignment"
                style="width: 100%; margin-left: 0"
                @click="saveFineAlignmentMatrix"
              >
                保存配准结果
              </el-button>
            </div>
            <div v-if="fineRunBlockedReason" class="fine-actions__hint">
              {{ fineRunBlockedReason }}
            </div>
          </template>
          <!-- 调整对象：模型 / 点云 并列切换按钮 -->
          <div class="edit-target-row" :class="{ disabled: !editMode }">
            <button
              class="edit-target-btn"
              :class="{ 'is-active': selectedItemIsGltf }"
              :disabled="!editMode || !hasGltf"
              @click="selectGltfTarget"
            >
              模型调整
            </button>
            <button
              class="edit-target-btn"
              :class="{ 'is-active': selectedItemIsTileset }"
              :disabled="!editMode || !hasTileset"
              @click="selectTilesetTarget"
            >
              点云调整
            </button>
            <el-button
              size="small"
              :disabled="!editMode || !selectedItemId"
              @click="focusSelected"
            >
              定位
            </el-button>
          </div>
          <div class="control-row" :class="{ disabled: !editMode }">
            <span class="label">变换</span>
            <el-radio-group
              v-model="transformMode"
              :disabled="!editMode"
              @change="setTransformMode"
            >
              <el-radio-button
                label="translate"
                :disabled="!editMode || selectedItemIsTileset"
              >
                移动
              </el-radio-button>
              <el-radio-button
                label="rotate"
                :disabled="!editMode || selectedItemIsTileset"
              >
                旋转
              </el-radio-button>
            </el-radio-group>
          </div>
          <div
            class="control-row control-row--orientation"
            :class="{ disabled: !editMode || !selectedItemId }"
          >
            <span class="label">
              {{ transformMode === 'rotate' ? '方向修正 (deg)' : '位置修正' }}
            </span>
            <div v-if="transformMode === 'rotate'" class="orientation-sliders">
              <div
                class="control-row control-row--compact"
                :class="{ disabled: !editMode || !selectedItemId }"
              >
                <div class="step-control-group">
                  <el-select
                    v-model="rotationStepPreset"
                    class="step-select"
                    popper-class="bpa-right-popper"
                    :disabled="!editMode || !selectedItemId"
                    @change="onRotationStepPresetChange"
                  >
                    <el-option
                      v-for="stepOption in rotationStepOptions"
                      :key="`rotate-${stepOption}`"
                      :label="formatRotationStepLabel(stepOption)"
                      :value="String(stepOption)"
                    />
                    <el-option label="自定义" value="custom" />
                  </el-select>
                  <el-input-number
                    v-model="rotationAdjustStep"
                    class="step-input"
                    size="small"
                    :min="0.01"
                    :max="45"
                    :step="0.01"
                    :precision="2"
                    :controls="false"
                    :disabled="!editMode || !selectedItemId"
                    @change="onRotationAdjustStepChange"
                  />
                </div>
              </div>
              <template v-if="showOnlyVerticalAxis">
                <label
                  class="slider"
                  :class="{ disabled: !editMode || !selectedItemId }"
                >
                  <span class="axis">y</span>
                  <input
                    v-model.number="orientationDegY"
                    type="range"
                    :min="getRotationSliderRange('y').min"
                    :max="getRotationSliderRange('y').max"
                    :step="rotationAdjustStep"
                    :disabled="!editMode || !selectedItemId"
                    @pointerdown="beginRotationSliderDrag('y')"
                    @pointerup="endRotationSliderDrag('y')"
                    @pointercancel="endRotationSliderDrag('y')"
                    @blur="endRotationSliderDrag('y')"
                    @input="scheduleOrientationFixRealtime"
                    @change="flushOrientationFixRealtime"
                  />
                  <div class="slider__controls">
                    <input
                      class="axis-number-input"
                      :value="orientationDegY"
                      type="number"
                      inputmode="decimal"
                      :step="rotationAdjustStep"
                      :disabled="!editMode || !selectedItemId"
                      @input="onRotationNumberInput('y', $event)"
                      @blur="onRotationNumberBlur('y', $event)"
                      @keydown="onRotationNumberKeydown($event, 'y')"
                    />
                    <span class="slider__hint">deg</span>
                  </div>
                </label>
              </template>
              <template v-else>
                <label
                  class="slider"
                  :class="{ disabled: !editMode || !selectedItemId }"
                >
                  <span class="axis">X</span>
                  <input
                    v-model.number="orientationDegX"
                    type="range"
                    :min="getRotationSliderRange('x').min"
                    :max="getRotationSliderRange('x').max"
                    :step="rotationAdjustStep"
                    :disabled="!editMode || !selectedItemId"
                    @pointerdown="beginRotationSliderDrag('x')"
                    @pointerup="endRotationSliderDrag('x')"
                    @pointercancel="endRotationSliderDrag('x')"
                    @blur="endRotationSliderDrag('x')"
                    @input="scheduleOrientationFixRealtime"
                    @change="flushOrientationFixRealtime"
                  />
                  <div class="slider__controls">
                    <input
                      class="axis-number-input"
                      :value="orientationDegX"
                      type="number"
                      inputmode="decimal"
                      :step="rotationAdjustStep"
                      :disabled="!editMode || !selectedItemId"
                      @input="onRotationNumberInput('x', $event)"
                      @blur="onRotationNumberBlur('x', $event)"
                      @keydown="onRotationNumberKeydown($event, 'x')"
                    />
                    <span class="slider__hint">deg</span>
                  </div>
                </label>
                <label
                  class="slider"
                  :class="{ disabled: !editMode || !selectedItemId }"
                >
                  <span class="axis">Y</span>
                  <input
                    v-model.number="orientationDegY"
                    type="range"
                    :min="getRotationSliderRange('y').min"
                    :max="getRotationSliderRange('y').max"
                    :step="rotationAdjustStep"
                    :disabled="!editMode || !selectedItemId"
                    @pointerdown="beginRotationSliderDrag('y')"
                    @pointerup="endRotationSliderDrag('y')"
                    @pointercancel="endRotationSliderDrag('y')"
                    @blur="endRotationSliderDrag('y')"
                    @input="scheduleOrientationFixRealtime"
                    @change="flushOrientationFixRealtime"
                  />
                  <div class="slider__controls">
                    <input
                      class="axis-number-input"
                      :value="orientationDegY"
                      type="number"
                      inputmode="decimal"
                      :step="rotationAdjustStep"
                      :disabled="!editMode || !selectedItemId"
                      @input="onRotationNumberInput('y', $event)"
                      @blur="onRotationNumberBlur('y', $event)"
                      @keydown="onRotationNumberKeydown($event, 'y')"
                    />
                    <span class="slider__hint">deg</span>
                  </div>
                </label>
                <label
                  class="slider"
                  :class="{ disabled: !editMode || !selectedItemId }"
                >
                  <span class="axis">Z</span>
                  <input
                    v-model.number="orientationDegZ"
                    type="range"
                    :min="getRotationSliderRange('z').min"
                    :max="getRotationSliderRange('z').max"
                    :step="rotationAdjustStep"
                    :disabled="!editMode || !selectedItemId"
                    @pointerdown="beginRotationSliderDrag('z')"
                    @pointerup="endRotationSliderDrag('z')"
                    @pointercancel="endRotationSliderDrag('z')"
                    @blur="endRotationSliderDrag('z')"
                    @input="scheduleOrientationFixRealtime"
                    @change="flushOrientationFixRealtime"
                  />
                  <div class="slider__controls">
                    <input
                      class="axis-number-input"
                      :value="orientationDegZ"
                      type="number"
                      inputmode="decimal"
                      :step="rotationAdjustStep"
                      :disabled="!editMode || !selectedItemId"
                      @input="onRotationNumberInput('z', $event)"
                      @blur="onRotationNumberBlur('z', $event)"
                      @keydown="onRotationNumberKeydown($event, 'z')"
                    />
                    <span class="slider__hint">deg</span>
                  </div>
                </label>
              </template>
            </div>
            <div v-else class="orientation-sliders">
              <div
                class="control-row control-row--compact"
                :class="{
                  disabled:
                    !editMode || !selectedItemId || selectedItemIsTileset,
                }"
              >
                <div class="step-control-group">
                  <span class="label">步长</span>
                  <el-select
                    v-model="positionStepPreset"
                    class="step-select"
                    popper-class="bpa-right-popper"
                    :disabled="
                      !editMode || !selectedItemId || selectedItemIsTileset
                    "
                    @change="onPositionStepPresetChange"
                  >
                    <el-option
                      v-for="stepOption in positionStepOptions"
                      :key="`position-${stepOption}`"
                      :label="formatPositionStepLabel(stepOption)"
                      :value="String(stepOption)"
                    />
                    <el-option label="自定义" value="custom" />
                  </el-select>
                  <el-input-number
                    v-model="positionAdjustStep"
                    class="step-input"
                    size="small"
                    :min="0.001"
                    :max="10"
                    :step="0.001"
                    :precision="3"
                    :controls="false"
                    :disabled="
                      !editMode || !selectedItemId || selectedItemIsTileset
                    "
                    @change="onPositionAdjustStepChange"
                  />
                </div>
              </div>
              <label
                class="slider"
                :class="{
                  disabled:
                    !editMode || !selectedItemId || selectedItemIsTileset,
                }"
              >
                <span class="axis">X</span>
                <input
                  v-model.number="positionOffsetX"
                  type="range"
                  :min="getPositionSliderRange('x').min"
                  :max="getPositionSliderRange('x').max"
                  :step="positionAdjustStep"
                  :disabled="
                    !editMode || !selectedItemId || selectedItemIsTileset
                  "
                  @pointerdown="beginPositionSliderDrag('x')"
                  @pointerup="endPositionSliderDrag('x')"
                  @pointercancel="endPositionSliderDrag('x')"
                  @blur="endPositionSliderDrag('x')"
                  @input="schedulePositionFixRealtime"
                  @change="flushPositionFixRealtime"
                />
                <div class="slider__controls">
                  <input
                    class="axis-number-input"
                    :value="positionOffsetX"
                    type="number"
                    inputmode="decimal"
                    :step="positionAdjustStep"
                    :disabled="
                      !editMode || !selectedItemId || selectedItemIsTileset
                    "
                    @input="onPositionNumberInput('x', $event)"
                    @blur="onPositionNumberBlur('x', $event)"
                    @keydown="onPositionNumberKeydown($event, 'x')"
                  />
                  <span class="slider__hint">m</span>
                </div>
              </label>
              <label
                class="slider"
                :class="{
                  disabled:
                    !editMode || !selectedItemId || selectedItemIsTileset,
                }"
              >
                <span class="axis">Y</span>
                <input
                  v-model.number="positionOffsetY"
                  type="range"
                  :min="getPositionSliderRange('y').min"
                  :max="getPositionSliderRange('y').max"
                  :step="positionAdjustStep"
                  :disabled="
                    !editMode || !selectedItemId || selectedItemIsTileset
                  "
                  @pointerdown="beginPositionSliderDrag('y')"
                  @pointerup="endPositionSliderDrag('y')"
                  @pointercancel="endPositionSliderDrag('y')"
                  @blur="endPositionSliderDrag('y')"
                  @input="schedulePositionFixRealtime"
                  @change="flushPositionFixRealtime"
                />
                <div class="slider__controls">
                  <input
                    class="axis-number-input"
                    :value="positionOffsetY"
                    type="number"
                    inputmode="decimal"
                    :step="positionAdjustStep"
                    :disabled="
                      !editMode || !selectedItemId || selectedItemIsTileset
                    "
                    @input="onPositionNumberInput('y', $event)"
                    @blur="onPositionNumberBlur('y', $event)"
                    @keydown="onPositionNumberKeydown($event, 'y')"
                  />
                  <span class="slider__hint">m</span>
                </div>
              </label>
              <label
                class="slider"
                :class="{
                  disabled:
                    !editMode || !selectedItemId || selectedItemIsTileset,
                }"
              >
                <span class="axis">Z</span>
                <input
                  v-model.number="positionOffsetZ"
                  type="range"
                  :min="getPositionSliderRange('z').min"
                  :max="getPositionSliderRange('z').max"
                  :step="positionAdjustStep"
                  :disabled="
                    !editMode || !selectedItemId || selectedItemIsTileset
                  "
                  @pointerdown="beginPositionSliderDrag('z')"
                  @pointerup="endPositionSliderDrag('z')"
                  @pointercancel="endPositionSliderDrag('z')"
                  @blur="endPositionSliderDrag('z')"
                  @input="schedulePositionFixRealtime"
                  @change="flushPositionFixRealtime"
                />
                <div class="slider__controls">
                  <input
                    class="axis-number-input"
                    :value="positionOffsetZ"
                    type="number"
                    inputmode="decimal"
                    :step="positionAdjustStep"
                    :disabled="
                      !editMode || !selectedItemId || selectedItemIsTileset
                    "
                    @input="onPositionNumberInput('z', $event)"
                    @blur="onPositionNumberBlur('z', $event)"
                    @keydown="onPositionNumberKeydown($event, 'z')"
                  />
                  <span class="slider__hint">m</span>
                </div>
              </label>
            </div>
            <div class="orientation-actions">
              <el-button
                size="small"
                :disabled="
                  !editMode ||
                  !selectedItemId ||
                  (transformMode === 'translate' && selectedItemIsTileset)
                "
                @click="resetTransformFixRealtime"
              >
                重置当前对象到初始
              </el-button>
            </div>
          </div>
        </div>

        <div class="panel-section">
          <ScanBimComputePanel
            :project-id="projectId"
            :bim-file-id="bimFileId"
            :scan-id="scanFileId"
            :has-alignment="!!latestAlignmentResult"
            :mesh-loaded="hasRemeshMesh"
            :solid-hidden="remeshSolidHidden"
            :wire-hidden="remeshWireHidden"
            :wire-available="remeshWireAvailable"
            :c2m-distances="c2mDistanceArray"
            @load-remesh="handleLoadRemesh"
            @toggle-solid="toggleRemeshSolid"
            @toggle-wire="toggleRemeshWire"
            @load-c2m-ply="handleLoadC2MPly"
            @clear-c2m-scene="clearC2MScene"
            @c2m-viz-change="onC2mVizChange"
            @c2m-distances-buffer="onC2mDistancesBuffer"
          />
        </div>

        <!-- 高级设置（可折叠） -->
        <div class="panel-section panel-section--advanced">
          <button
            class="advanced-toggle"
            @click="showAdvancedSettings = !showAdvancedSettings"
          >
            <span>高级设置</span>
            <svg
              class="advanced-toggle__chevron"
              :class="{ 'is-open': showAdvancedSettings }"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="4,6 8,10 12,6" />
            </svg>
          </button>
          <div v-show="showAdvancedSettings" class="advanced-content">
            <!-- 渲染 -->
            <div class="adv-group">
              <div class="adv-group__title">渲染</div>
              <div class="control-row">
                <el-select
                  v-model="materialMode"
                  popper-class="bpa-right-popper"
                  :disabled="!hasModel"
                  @change="onMaterialModeChange"
                >
                  <el-option label="原始材质" value="original" />
                  <el-option label="无光照（TSL Unlit）" value="unlit" />
                  <el-option label="漫反射光照（Lambert）" value="lambert" />
                </el-select>
              </div>
              <div class="control-row">
                <span class="label">背景</span>
                <div class="color-row">
                  <input
                    v-model="backgroundColor"
                    class="color-picker"
                    type="color"
                    @input="onBackgroundColorChange"
                  />
                  <input
                    v-model="backgroundColor"
                    class="color-hex"
                    type="text"
                    inputmode="text"
                    spellcheck="false"
                    placeholder="#0b1020"
                    @change="onBackgroundColorChange"
                  />
                  <el-button size="small" @click="resetBackgroundColor">
                    重置
                  </el-button>
                </div>
              </div>
              <div class="hint2">
                点云太黑看不清时，调亮背景（例如 #222 或 #555）
              </div>
            </div>
            <!-- 构件 -->
            <div class="adv-group">
              <div class="adv-group__title">构件</div>
              <div class="control-row">
                <el-switch v-model="enableElementPicking" />
                <span class="label">点击高亮</span>
              </div>
              <div
                class="control-row"
                :class="{ disabled: !enableElementPicking || !hasModel }"
              >
                <span class="label">已选</span>
                <el-input
                  :model-value="pickedElementText"
                  readonly
                  placeholder="未选择"
                />
                <el-button
                  size="small"
                  :disabled="!enableElementPicking || !pickedElement"
                  @click="clearPickedElement"
                >
                  清除
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="status-bar">
      <el-tag v-if="!webgpuSupported" type="warning" size="small">
        WebGPU 不支持
      </el-tag>
      <span class="status-text">{{ statusText }}</span>
    </div>

    <el-dialog
      v-model="showAlignmentMatrixDialog"
      title="校准矩阵"
      width="720px"
      append-to-body
    >
      <div class="matrix-dialog">
        <div class="matrix-dialog__meta">
          <span>projectId: {{ projectId }}</span>
          <span>scanFileId: {{ scanFileId }}</span>
          <span>bimFileId: {{ bimFileId }}</span>
        </div>
        <div
          v-if="alignmentMatrixRows.length === 4"
          class="matrix-dialog__matrix"
        >
          <div class="matrix-dialog__label">T = [ R | t ]</div>
          <div class="matrix-dialog__lines">
            <p
              v-for="(row, rowIndex) in alignmentRtRows"
              :key="`rt-line-${rowIndex}`"
              class="matrix-dialog__line"
            >
              [ {{ row.r.join('    ') }} | {{ row.t }} ]
            </p>
            <p class="matrix-dialog__line matrix-dialog__line--bottom">
              [ {{ alignmentMatrixRows[3].join('    ') }} ]
            </p>
          </div>
        </div>
        <el-empty v-else description="暂无有效矩阵数据" :image-size="64" />
        <details class="matrix-dialog__raw">
          <summary>查看原始矩阵数据</summary>
          <pre class="matrix-dialog__content">{{
            alignmentMatrixDialogText
          }}</pre>
        </details>
      </div>
    </el-dialog>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({
  name: 'BimPointcloudAlign',
})
</script>
<script setup lang="ts">
import {
  computed,
  h,
  nextTick,
  onActivated,
  onDeactivated,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Hide, RefreshLeft, View } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import wanggeIcon from '@/assets/images/wangge.png'
import toushiIcon from '@/assets/images/toushi.png'
import zhengjiaoIcon from '@/assets/images/zhengjiao.png'

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import Stats from 'three/addons/libs/stats.module.js'
import {
  ClippingGroup,
  MeshBasicNodeMaterial,
  MeshLambertNodeMaterial,
  NodeMaterial,
  PointsNodeMaterial,
  WebGPURenderer,
} from 'three/webgpu'
import { color as tslColor, vertexColor as tslVertexColor } from 'three/tsl'
import { TilesRenderer } from '3d-tiles-renderer'
import { GLTFExtensionsPlugin } from '3d-tiles-renderer/three/plugins'
import {
  computeBimAlignment,
  computeFineAlignment,
  getBimAlignment,
  saveGaussAlignment,
  type FineAlignmentResult,
  type ModelAlignment,
} from '@/api/calibration'
import ScanBimComputePanel, {
  type C2MLoadPayload,
} from './components/ScanBimComputePanel.vue'
import { applyC2mVertexColors } from '@/utils/c2mColormap'
import { sampleC2MDeviationAtPick } from '@/utils/c2mPick'
import { getToken, getOrganizationId, formatToken } from '@/utils/auth'
import {
  getIfcGlbFile,
  getScanTilesAsset,
  getScanTilesetUrl,
} from '@/api/fileManage'

const CALIBRATION_RETURN_KEY = 'calibration:return'

const router = useRouter()
const route = useRoute()

const getQueryString = (key: string): string => {
  const value = route.query[key]
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

const projectId = computed(() => {
  const raw = getQueryString('projectId')
  const num = Number(raw)
  return Number.isFinite(num) ? num : 0
})

const projectNameForDisplay = computed(
  () => getQueryString('projectName') || '—',
)

const bimFileId = computed(() => {
  const raw = getQueryString('bimId')
  const num = Number(raw)
  return Number.isFinite(num) ? num : 0
})

const scanFileId = computed(() => {
  const raw = getQueryString('scanId')
  const num = Number(raw)
  return Number.isFinite(num) ? num : 0
})

const bimNameForDisplay = computed(() => getQueryString('bimName') || '—')
const pointCloudNameForDisplay = computed(
  () => getQueryString('pointCloudName') || '—',
)

const pointCloudTilesetUrl = computed(() => {
  if (!projectId.value || !scanFileId.value) return ''
  return getScanTilesetUrl(projectId.value, scanFileId.value, 'tileset.json')
})

const canLoadBim = computed(() => Boolean(projectId.value && bimFileId.value))
const canLoadPointCloud = computed(() =>
  Boolean(projectId.value && scanFileId.value),
)

const loadingBim = ref(false)
const loadingPointCloud = ref(false)
const pointCloudClippingReady = ref(false)
const loadingAlignmentMatrixDialog = ref(false)
const savingCalibration = ref(false)
const showAlignmentMatrixDialog = ref(false)
const alignmentMatrixDialogText = ref('[]')
const latestAlignmentResult = ref<ModelAlignment | null>(null)
const viewerReady = ref(false)
const autoLoadedResourceKey = ref('')
const pendingAlignmentRestore = ref<ModelAlignment | null>(null)
const restoredAlignmentKey = ref('')
/** 是否存在已持久化到后端的配准矩阵。 */
const hasSavedAlignmentMatrix = ref(false)
/** 粗配准阶段是否有未保存的位姿改动。 */
const coarseAlignmentDirty = ref(false)
const resetSessionState = () => {
  loadingBim.value = false
  loadingPointCloud.value = false
  pointCloudClippingReady.value = false
  loadingAlignmentMatrixDialog.value = false
  savingCalibration.value = false
  showAlignmentMatrixDialog.value = false
  alignmentMatrixDialogText.value = '[]'
  latestAlignmentResult.value = null
  autoLoadedResourceKey.value = ''
  pendingAlignmentRestore.value = null
  restoredAlignmentKey.value = ''
  hasSavedAlignmentMatrix.value = false
  coarseAlignmentDirty.value = false
  tilesetUrl.value = ''
  hasModel.value = false
  hasTileset.value = false
  hasGltf.value = false
  selectedItemId.value = ''
  activeClipTargetId = ''
  clipStateByItemId.clear()
  clipDragState = null
  editMode.value = false
  registrationStage.value = 'coarse'
  showBounds.value = false
  enableClipping.value = false
  enableElementPicking.value = false
  clipAxis.value = 'z'
  clipInvert.value = false
  clipPosition.value = 0
  clipRange.value = { min: 0, max: 1 }
  backgroundColor.value = '#0b1020'
  activeView.value = ''
  clearPickedElement()
  restoreHighlightedElement()
  contentGroup?.position?.set?.(0, 0, 0)
  contentGroup?.updateMatrixWorld?.(true)
  statusText.value = 'Ready.'
  onBackgroundColorChange()
  applyClippingState()
}

const saveCalibrationResult = async () => {
  const snapshot = collectCalibrationSnapshot({ warnOnMissing: true })
  if (!snapshot) {
    ElMessage.warning('缺少 BIM 或点云，无法保存校准结果')
    return false
  }

  if (!projectId.value) {
    ElMessage.warning('缺少项目 ID，无法保存校准结果')
    return false
  }

  if (!scanFileId.value || !bimFileId.value) {
    ElMessage.warning('缺少扫描文件或 BIM 文件 ID，无法保存校准结果')
    return false
  }

  const gaussId = getQueryString('gaussId')
  const gaussFileId = Number(gaussId)
  const requestPayload = {
    modelScanFileId: scanFileId.value,
    modelBimFileId: bimFileId.value,
    modelPairs: snapshot.modelPairs,
  }

  try {
    const res = await computeBimAlignment(projectId.value, requestPayload)
    latestAlignmentResult.value = res?.data ?? null
    hasSavedAlignmentMatrix.value = !!latestAlignmentResult.value
    if (latestAlignmentResult.value) coarseAlignmentDirty.value = false
    if (latestAlignmentResult.value) {
      alignmentMatrixDialogText.value = formatAlignmentMatrix(
        latestAlignmentResult.value,
      )
    }
  } catch (error: any) {
    console.error('保存 BIM 校准失败:', error)
    ElMessage.error(error?.message || '保存 BIM 校准失败')
    return false
  }

  if (
    gaussId &&
    Number.isFinite(gaussFileId) &&
    gaussFileId > 0 &&
    scanFileId.value > 0
  ) {
    try {
      await saveGaussAlignment(projectId.value, {
        scanFileId: scanFileId.value,
        gaussFileId,
      })
    } catch (error: any) {
      console.error('保存高斯绑定失败:', error)
      ElMessage.error(error?.message || '保存高斯绑定失败')
      return false
    }
  }

  return true
}

const formatAlignmentMatrix = (
  alignment: ModelAlignment | null | undefined,
) => {
  const matrix = Array.isArray(alignment?.modelMatrix)
    ? alignment.modelMatrix
    : []
  return JSON.stringify(matrix, null, 2)
}

const formatMatrixCell = (value: number) => {
  if (!Number.isFinite(value)) return '0.000000'
  const abs = Math.abs(value)
  if (abs >= 1000 || (abs > 0 && abs < 0.0001)) {
    return value.toExponential(6)
  }
  return value.toFixed(6)
}

const alignmentMatrixRows = computed(() => {
  const fromLatest = latestAlignmentResult.value?.modelMatrix
  const matrixValues = Array.isArray(fromLatest) ? fromLatest : []

  if (matrixValues.length !== 16) {
    return [] as string[][]
  }

  // three.js Matrix4 为列主序数组，这里转换为常见的行主序展示。
  const pickRow = (row: number) => [
    matrixValues[row],
    matrixValues[row + 4],
    matrixValues[row + 8],
    matrixValues[row + 12],
  ]

  return [0, 1, 2, 3].map((row) =>
    pickRow(row).map((v) => formatMatrixCell(Number(v))),
  )
})

const alignmentRtRows = computed(() => {
  if (alignmentMatrixRows.value.length !== 4) {
    return [] as Array<{ r: string[]; t: string }>
  }
  return alignmentMatrixRows.value.slice(0, 3).map((row) => ({
    r: row.slice(0, 3),
    t: row[3],
  }))
})

const handleShowAlignmentMatrix = async () => {
  if (!projectId.value || !scanFileId.value || !bimFileId.value) {
    ElMessage.warning('缺少项目、扫描或 BIM 文件 ID，无法获取校准矩阵')
    return
  }

  loadingAlignmentMatrixDialog.value = true
  try {
    if (latestAlignmentResult.value) {
      alignmentMatrixDialogText.value = formatAlignmentMatrix(
        latestAlignmentResult.value,
      )
      showAlignmentMatrixDialog.value = true
      return
    }

    const res = await getBimAlignment(
      projectId.value,
      scanFileId.value,
      bimFileId.value,
    )
    if (!res?.data) {
      ElMessage.warning('未获取到校准矩阵')
      return
    }

    latestAlignmentResult.value = res.data
    alignmentMatrixDialogText.value = formatAlignmentMatrix(
      latestAlignmentResult.value,
    )
    showAlignmentMatrixDialog.value = true
  } catch (error: any) {
    console.error('[BimPointcloudAlign] 获取校准矩阵失败:', error)
    ElMessage.error(error?.message || '获取校准矩阵失败')
  } finally {
    loadingAlignmentMatrixDialog.value = false
  }
}

const handleBackToCalibration = async () => {
  const returnTo = getQueryString('returnTo')
  const scanId = getQueryString('scanId')
  const title = getQueryString('title')
  const date = getQueryString('date')
  const uploader = getQueryString('uploader')
  const bimId = getQueryString('bimId')
  const bimName = getQueryString('bimName')
  const cadId = getQueryString('cadId')
  const cadName = getQueryString('cadName')
  const pointCloudName = getQueryString('pointCloudName')
  const gaussId = getQueryString('gaussId')
  const gaussName = getQueryString('gaussName')
  const gaussAssetPath = getQueryString('gaussAssetPath')
  const projectIdParam = getQueryString('projectId')
  const projectNameParam = getQueryString('projectName')

  if (scanId) {
    sessionStorage.setItem(
      CALIBRATION_RETURN_KEY,
      JSON.stringify({
        step: 'bim',
        scanId,
        title,
        date,
        uploader,
        projectId: projectIdParam,
        projectName: projectNameParam,
        bimId,
        bimName,
        cadId,
        cadName,
        gaussId,
        gaussName,
        gaussAssetPath,
        pointCloudName,
      }),
    )
  }

  if (returnTo) {
    await router.push(returnTo)
    return
  }
  router.back()
}

function clearLoadedGltf() {
  if (!scene || !contentGroup) return
  clearPickedElement()
  restoreHighlightedElement()
  clearElementIndex()
  clearWireframeOverlays()
  invalidateClipBounds()

  for (const root of loadedRoots) {
    const host = removeClipHostForObject(root)
    removeClipStateForObject(root)
    contentGroup.remove(host ?? root)
    disposeObject(root)
  }
  loadedRoots.length = 0
  if (!getLoadedItemById(activeClipTargetId)) activeClipTargetId = ''

  for (const url of loadedObjectUrls) URL.revokeObjectURL(url)
  loadedObjectUrls.length = 0

  updateLoadedFlags()
  rebuildLoadedItems()
  updateBoundsHelpers()
  applyClippingState()
  contentGroup.position.set(0, 0, 0)
  contentGroup.updateMatrixWorld?.(true)
  requestRender()
}

function clearLoadedTilesets() {
  if (!scene || !contentGroup) return
  clearPickedElement()
  restoreHighlightedElement()
  pointCloudClippingReady.value = false
  invalidateClipBounds()

  for (const entry of loadedTilesets) {
    const host = removeClipHostForObject(entry.wrapper)
    removeClipStateForObject(entry.wrapper)
    contentGroup.remove(host ?? entry.wrapper)
    entry.tr.dispose?.()
  }
  loadedTilesets.length = 0
  if (!getLoadedItemById(activeClipTargetId)) activeClipTargetId = ''

  updateLoadedFlags()
  rebuildLoadedItems()
  updateBoundsHelpers()
  applyClippingState()
  contentGroup.position.set(0, 0, 0)
  contentGroup.updateMatrixWorld?.(true)
  requestRender()
}

function collectCalibrationSnapshot(options?: { warnOnMissing?: boolean }) {
  const warnOnMissing = options?.warnOnMissing ?? false
  const selected = getSelectedItem()
  const bimItem =
    selected?.kind === 'gltf'
      ? selected
      : loadedItems.value.find((i) => i.kind === 'gltf')
  const pointcloudItem =
    selected?.kind === 'tileset'
      ? selected
      : loadedItems.value.find((i) => i.kind === 'tileset')

  const bimObj = bimItem?.obj
  const pointcloudWrapper = pointcloudItem?.obj
  const pointcloudGroup =
    loadedTilesets.find((t) => t.wrapper === pointcloudWrapper)?.tr?.group ??
    pointcloudWrapper

  if (!bimObj || !pointcloudGroup) {
    void warnOnMissing
    return null
  }

  contentGroup?.updateMatrixWorld?.(true)
  bimObj.updateMatrixWorld?.(true)
  pointcloudWrapper?.updateMatrixWorld?.(true)
  pointcloudGroup.updateMatrixWorld?.(true)

  const bimRawMatrixWorld = getRawMatrixWorldForCalibration(bimObj)
  const pointcloudRawMatrixWorld =
    getRawMatrixWorldForCalibration(pointcloudGroup)

  const invBim = new THREE.Matrix4().copy(bimRawMatrixWorld).invert()
  const relativeRaw = new THREE.Matrix4().multiplyMatrices(
    invBim,
    pointcloudRawMatrixWorld,
  )
  const relative = (() => {
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    relativeRaw.decompose(pos, quat, new THREE.Vector3())
    return new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 1, 1))
  })()

  const sampleScanPoints = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
  ]
  const modelPairs = sampleScanPoints.map((scanPoint) => {
    const bimPoint = scanPoint.clone().applyMatrix4(relative)
    return {
      modelScanX: scanPoint.x,
      modelScanY: scanPoint.y,
      modelScanZ: scanPoint.z,
      modelBimX: bimPoint.x,
      modelBimY: bimPoint.y,
      modelBimZ: bimPoint.z,
    }
  })

  return {
    projectId: projectId.value,
    scanFileId: scanFileId.value,
    bimFileId: bimFileId.value,
    modelPairs,
  }
}

const handleCalibrationComplete = async () => {
  if (savingCalibration.value) return
  savingCalibration.value = true
  try {
    const saved = await saveCalibrationResult()
    if (!saved) return
    const stageLabel = registrationStage.value === 'fine' ? '精细化' : '粗配准'
    ElMessage.success(`${stageLabel}矩阵已保存并覆盖校准矩阵`)
    await handleShowAlignmentMatrix()
  } finally {
    savingCalibration.value = false
  }
}

async function saveCoarseAlignmentMatrix() {
  if (registrationStage.value !== 'coarse') {
    registrationStage.value = 'coarse'
  }
  await handleCalibrationComplete()
}

async function saveFineAlignmentMatrix() {
  await handleCalibrationComplete()
}

/**
 * gltf-web-demo (WebGPU) 说明
 * ==========================
 *
 * 这是一个基于 three.js WebGPU 渲染管线的轻量 Viewer，核心目标：
 * 1) 加载并显示 glTF/GLB（主要来源：IFC → GLB）
 * 2) 以“构件”为粒度进行点选高亮（支持 BatchedMesh 合批后的 instance）
 * 3) 导入 metadata.json（ifc_bundle 格式），展示构件树与属性，并与 3D 点选/显隐联动
 * 4) 支持 3D Tiles（点云/倾斜摄影），用于大场景可视化（本项目不对 tiles 做构件级选择）
 *
 * 整体架构（数据流）
 * -----------------
 * - GLB 加载：
 *   - GLTFLoader 加载 root → applyMaterialMode → optimizeRoot（将可合批 Mesh 合成 BatchedMesh）
 *   - fitCameraToObject 做重心归零（便于 orbit/scale）
 *   - rebuildElementIndex：构建 elementId → (Mesh 或 BatchedMesh instance) 的索引，用于“树 → 3D”
 *
 * - Metadata 导入：
 *   - 读取 metadata.json，构建 stepId → GlobalId 映射（兼容 tree.id 为 "#<STEP_ID>"）
 *   - 基于 tree 生成“节点实例”的唯一 key（__viewerNodeKey），避免重复 id（如 __unassigned__ 分支）覆盖
 *   - 为每个 tree 节点缓存其子树下所有 element GlobalId（用于父节点批量显隐）
 *   - 为每个 elementId 选一个“优先树节点”（用于 3D 点选后定位到树中正确分支）
 *
 * - 交互联动：
 *   - 3D → Tree：点击构件 → 推断 elementId → 选中 metadata.elements[elementId] → 定位/展开树节点
 *   - Tree → 3D：点击树节点（若该节点对应 elementId）→ 高亮 3D 构件（不自动相机聚焦）
 *   - Tree 显隐：勾选/取消勾选任意节点 → 取其子树 elementId 列表 → best effort 隐藏/显示
 *
 * 性能要点（最关键）
 * -----------------
 * 本项目能流畅显示大型 IFC→GLB 的核心在于“合批（batch）”：
 * - `optimizeRoot()` 会将大量可合并的 Mesh 转为 `THREE.BatchedMesh`（按材质 + 属性布局分组）
 * - 这会显著降低 drawcall/CPU 开销，是性能影响最大的优化点
 * - 因此“构件级点选/显隐/高亮”必须同时支持普通 Mesh 与 BatchedMesh instance（依赖 batchId）
 *
 * 注意：为了在 WebGPU + NodeMaterial 模式下稳定高亮，本项目采用“覆盖层 overlay mesh”高亮策略，
 * 避免对材质 clone/copy 引起的循环引用序列化问题（Material.copy 会 JSON stringify userData）。
 */

const containerEl = ref<HTMLDivElement | null>(null)
const fileInputEl = ref<HTMLInputElement | null>(null)
const viewportEl = ref<HTMLDivElement | null>(null)

// 基础 UI 状态（面板、调试、模式切换）
const webgpuSupported = computed(
  () => typeof navigator !== 'undefined' && 'gpu' in navigator,
)
const statusText = ref<string>('')
const isDragging = ref(false)
const hasModel = ref(false)
const materialMode = ref<'original' | 'unlit' | 'lambert'>('original')
const tilesetUrl = ref<string>('')
const hasTileset = ref(false)
const hasGltf = ref(false)
const modelHidden = ref(false)
const pointCloudHidden = ref(false)
// 0 means the traversal continues to visible leaf tiles instead of stopping
// at an intermediate, lower-density LOD tile.
const tilesErrorTarget = ref(0)
const tilesetZUpRotationX = -Math.PI / 2
const showPanel = ref(true)
const showAdvancedSettings = ref(false)
const showBounds = ref(false)
const showGrid = ref(true)
const showMeshWireframe = ref(false)
const backgroundColor = ref('#0b1020')
const enableClipping = ref(false)
const clipAxis = ref<'x' | 'y' | 'z'>('z')
const clipInvert = ref(false)
const clipPosition = ref(0)
const clipRange = ref({ min: 0, max: 1 })
const canEnableClipping = computed(() => {
  return hasGltf.value && hasTileset.value && pointCloudClippingReady.value
})
const clipBoundsDisabledReason = computed(() => {
  if (showBounds.value) return ''
  if (loadingBim.value) return 'BIM 加载中，请稍候再开启裁切框'
  if (!hasGltf.value) return '请先加载 BIM 模型'
  if (loadingPointCloud.value || !pointCloudClippingReady.value) {
    if (hasTileset.value || loadingPointCloud.value) {
      return '点云加载中，请等待加载完成后再开启裁切框'
    }
  }
  if (!hasTileset.value) return '请先加载点云'
  if (!canEnableClipping.value) return '请等待 BIM 和点云都准备完成'
  return ''
})
const clipBoundsTooltip = computed(() => {
  return clipBoundsDisabledReason.value || '裁切框'
})
const editMode = ref(false)
type RegistrationStage = 'coarse' | 'fine'
const registrationStage = ref<RegistrationStage>('coarse')
const transformMode = ref<'translate' | 'rotate'>('translate')
const transformSpace = ref<'world' | 'local'>('local')
const activeView = ref<'front' | 'top' | 'side' | ''>('')
const projectionMode = ref<'perspective' | 'orthographic'>('perspective')

// 变换模式选项配置
const transformModes = [
  { value: 'translate' as const, label: '平移' },
  { value: 'rotate' as const, label: '旋转' },
] as const

// 变换空间选项配置
const transformSpaces = [
  { value: 'world' as const, label: '世界' },
  { value: 'local' as const, label: '本地' },
] as const

// 设置变换模式并触发变更
function setTransformMode(mode: 'translate' | 'rotate') {
  if (mode === 'rotate' && selectedItemIsTileset.value) {
    transformMode.value = 'translate'
    syncTransformFixFromSelected()
    return
  }
  transformMode.value = mode
  applyTransformSelection()
  syncTransformFixFromSelected()
}

// 设置变换空间并触发变更
function setTransformSpace(space: 'world' | 'local') {
  transformSpace.value = space
  applyTransformSelection()
}

const enableElementPicking = ref(false)

const selectedItemId = ref<string>('')
const orientationDegX = ref(0)
const orientationDegY = ref(0)
const orientationDegZ = ref(0)
const positionOffsetX = ref(0)
const positionOffsetY = ref(0)
const positionOffsetZ = ref(0)
const positionStepOptions = [0.001, 0.01, 0.1, 1] as const
const rotationStepOptions = [0.01, 0.1, 1, 5] as const
const positionAdjustStep = ref(0.01)
const rotationAdjustStep = ref(1)
const positionStepPreset = ref('0.01')
const rotationStepPreset = ref('1')
type PositionAxisKey = 'x' | 'y' | 'z'
type RotationAxisKey = 'x' | 'y' | 'z'
const positionSliderFrozenRanges: Record<
  PositionAxisKey,
  { min: number; max: number }
> = {
  x: { min: -0.5, max: 0.5 },
  y: { min: -0.5, max: 0.5 },
  z: { min: -0.5, max: 0.5 },
}
let activePositionSliderAxis: PositionAxisKey | null = null
let positionFixFrameHandle = 0
const rotationSliderFrozenRanges: Record<
  RotationAxisKey,
  { min: number; max: number }
> = {
  x: { min: -10, max: 10 },
  y: { min: -180, max: 180 },
  z: { min: -10, max: 10 },
}
let activeRotationSliderAxis: RotationAxisKey | null = null
let orientationFixFrameHandle = 0

function getStepPrecision(step: number) {
  const normalized = Number(step)
  if (!Number.isFinite(normalized) || normalized <= 0) return 2
  const text = normalized.toString()
  if (text.includes('e-')) {
    const exponent = Number(text.split('e-')[1] || 0)
    return Math.min(3, Math.max(0, exponent))
  }
  const decimals = text.split('.')[1]?.length ?? 0
  return Math.min(3, Math.max(0, decimals))
}

function normalizeAdjustStep(
  value: unknown,
  { min, max, fallback }: { min: number; max: number; fallback: number },
) {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return fallback
  return Math.min(max, Math.max(min, roundToStep(num, min)))
}

function getStepPresetValue(
  value: number,
  options: readonly number[],
  precision = 6,
) {
  const normalized = Number(value.toFixed(precision))
  const matched = options.find(
    (item) => Number(item.toFixed(precision)) === normalized,
  )
  return matched !== undefined ? String(matched) : 'custom'
}

function formatPositionStep(value: number) {
  const normalized = normalizeAdjustStep(value, {
    min: 0.001,
    max: 10,
    fallback: 0.01,
  })
  return normalized.toFixed(getStepPrecision(normalized))
}

function formatPositionStepLabel(value: number) {
  return `${formatPositionStep(value)} m`
}

function formatRotationStep(value: number) {
  const normalized = normalizeAdjustStep(value, {
    min: 0.01,
    max: 45,
    fallback: 1,
  })
  return normalized.toFixed(getStepPrecision(normalized))
}

function formatRotationStepLabel(value: number) {
  return `${formatRotationStep(value)} deg`
}

function formatPositionOffset(value: number) {
  const precision = Math.max(2, getStepPrecision(positionAdjustStep.value))
  return Number(value || 0).toFixed(precision)
}

function clampToMaxDecimals(value: number, maxDecimals = 3) {
  if (!Number.isFinite(value)) return 0
  return Number(value.toFixed(maxDecimals))
}

function formatRotationOffset(value: number) {
  const precision = Math.max(2, getStepPrecision(rotationAdjustStep.value))
  return Number(value || 0).toFixed(precision)
}

function getPositionOffsetByAxis(axis: PositionAxisKey) {
  if (axis === 'x') return positionOffsetX.value
  if (axis === 'y') return positionOffsetY.value
  return positionOffsetZ.value
}

function setPositionOffsetByAxis(axis: PositionAxisKey, value: number) {
  if (axis === 'x') positionOffsetX.value = value
  else if (axis === 'y') positionOffsetY.value = value
  else positionOffsetZ.value = value
}

function getRotationOffsetByAxis(axis: RotationAxisKey) {
  if (axis === 'x') return orientationDegX.value
  if (axis === 'y') return orientationDegY.value
  return orientationDegZ.value
}

function setRotationOffsetByAxis(axis: RotationAxisKey, value: number) {
  if (axis === 'x') orientationDegX.value = value
  else if (axis === 'y') orientationDegY.value = value
  else orientationDegZ.value = value
}

function calculatePositionSliderRange(axis: PositionAxisKey) {
  const value = getPositionOffsetByAxis(axis)
  const step = normalizeAdjustStep(positionAdjustStep.value, {
    min: 0.001,
    max: 10,
    fallback: 0.01,
  })
  const halfRange = Math.max(
    0.5,
    Math.min(10, step * 100),
    Math.min(20, Math.abs(value) * 0.3 + step * 20),
  )

  return {
    min: value - halfRange,
    max: value + halfRange,
  }
}

function getPositionSliderRange(axis: PositionAxisKey) {
  return activePositionSliderAxis === axis
    ? positionSliderFrozenRanges[axis]
    : calculatePositionSliderRange(axis)
}

function beginPositionSliderDrag(axis: PositionAxisKey) {
  activePositionSliderAxis = axis
  positionSliderFrozenRanges[axis] = calculatePositionSliderRange(axis)
}

function endPositionSliderDrag(axis: PositionAxisKey) {
  if (activePositionSliderAxis === axis) activePositionSliderAxis = null
  flushPositionFixRealtime()
}

function applyPositionOffsetByAxis(axis: PositionAxisKey, value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return

  const step = normalizeAdjustStep(positionAdjustStep.value, {
    min: 0.001,
    max: 10,
    fallback: 0.01,
  })
  setPositionOffsetByAxis(axis, clampToMaxDecimals(roundToStep(numeric, step)))
  flushPositionFixRealtime()
}

function onPositionNumberInput(axis: PositionAxisKey, event: Event) {
  const value = (event.target as HTMLInputElement)?.value
  if (value === '') return
  applyPositionOffsetByAxis(axis, value)
}

function onPositionNumberBlur(axis: PositionAxisKey, event: FocusEvent) {
  const input = event.target as HTMLInputElement | null
  if (!input) return
  if (input.value === '') {
    input.value = String(getPositionOffsetByAxis(axis))
    return
  }
  applyPositionOffsetByAxis(axis, input.value)
}

function onPositionNumberKeydown(event: KeyboardEvent, axis: PositionAxisKey) {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return

  event.preventDefault()
  let multiplier = 1
  if (event.shiftKey) multiplier *= 10
  if (event.altKey) multiplier *= 0.1

  const direction = event.key === 'ArrowUp' ? 1 : -1
  const step = positionAdjustStep.value * multiplier
  applyPositionOffsetByAxis(
    axis,
    getPositionOffsetByAxis(axis) + direction * step,
  )
}

function getRotationClampRange(axis: RotationAxisKey) {
  if (showOnlyVerticalAxis.value) {
    return axis === 'y' ? { min: -180, max: 180 } : { min: -10, max: 10 }
  }
  return { min: -10, max: 10 }
}

function getRotationSliderRange(axis: RotationAxisKey) {
  return activeRotationSliderAxis === axis
    ? rotationSliderFrozenRanges[axis]
    : getRotationClampRange(axis)
}

function beginRotationSliderDrag(axis: RotationAxisKey) {
  activeRotationSliderAxis = axis
  rotationSliderFrozenRanges[axis] = getRotationClampRange(axis)
}

function endRotationSliderDrag(axis: RotationAxisKey) {
  if (activeRotationSliderAxis === axis) activeRotationSliderAxis = null
  flushOrientationFixRealtime()
}

function applyRotationOffsetByAxis(axis: RotationAxisKey, value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return

  const step = normalizeAdjustStep(rotationAdjustStep.value, {
    min: 0.01,
    max: 45,
    fallback: 1,
  })
  const range = getRotationClampRange(axis)
  const next = THREE.MathUtils.clamp(
    clampToMaxDecimals(roundToStep(numeric, step)),
    range.min,
    range.max,
  )
  setRotationOffsetByAxis(axis, next)
  flushOrientationFixRealtime()
}

function onRotationNumberInput(axis: RotationAxisKey, event: Event) {
  const value = (event.target as HTMLInputElement)?.value
  if (value === '') return
  applyRotationOffsetByAxis(axis, value)
}

function onRotationNumberBlur(axis: RotationAxisKey, event: FocusEvent) {
  const input = event.target as HTMLInputElement | null
  if (!input) return
  if (input.value === '') {
    input.value = String(getRotationOffsetByAxis(axis))
    return
  }
  applyRotationOffsetByAxis(axis, input.value)
}

function onRotationNumberKeydown(event: KeyboardEvent, axis: RotationAxisKey) {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return

  event.preventDefault()
  let multiplier = 1
  if (event.shiftKey) multiplier *= 10
  if (event.altKey) multiplier *= 0.1

  const direction = event.key === 'ArrowUp' ? 1 : -1
  const step = rotationAdjustStep.value * multiplier
  applyRotationOffsetByAxis(
    axis,
    getRotationOffsetByAxis(axis) + direction * step,
  )
}

function syncPositionStepPreset() {
  positionStepPreset.value = getStepPresetValue(
    positionAdjustStep.value,
    positionStepOptions,
  )
}

function syncRotationStepPreset() {
  rotationStepPreset.value = getStepPresetValue(
    rotationAdjustStep.value,
    rotationStepOptions,
  )
}

function onPositionStepPresetChange(value: string) {
  if (value === 'custom') return
  positionAdjustStep.value = normalizeAdjustStep(Number(value), {
    min: 0.001,
    max: 10,
    fallback: 0.01,
  })
  syncPositionStepPreset()
}

function onPositionAdjustStepChange(value: number | undefined) {
  positionAdjustStep.value = normalizeAdjustStep(value, {
    min: 0.001,
    max: 10,
    fallback: 0.01,
  })
  syncPositionStepPreset()
}

function onRotationStepPresetChange(value: string) {
  if (value === 'custom') return
  rotationAdjustStep.value = normalizeAdjustStep(Number(value), {
    min: 0.01,
    max: 45,
    fallback: 1,
  })
  syncRotationStepPreset()
}

function onRotationAdjustStepChange(value: number | undefined) {
  rotationAdjustStep.value = normalizeAdjustStep(value, {
    min: 0.01,
    max: 45,
    fallback: 1,
  })
  syncRotationStepPreset()
}

/** 作用：判断当前选中项是否为点云。 */
const selectedItemIsTileset = computed(() => {
  const item = getSelectedItem()
  return item?.kind === 'tileset'
})

/** 当前选中对象是否为 glTF 模型。 */
const selectedItemIsGltf = computed(() => {
  const item = getSelectedItem()
  return item?.kind === 'gltf'
})

/** 选择 glTF 模型为当前编辑对象。 */
function selectGltfTarget() {
  const item = loadedItems.value.find((i) => i.kind === 'gltf')
  if (!item) return
  selectedItemId.value = item.id
  onSelectedItemChange()
}

/** 选择点云（tileset）为当前编辑对象。 */
function selectTilesetTarget() {
  const item = loadedItems.value.find((i) => i.kind === 'tileset')
  if (!item) return
  selectedItemId.value = item.id
  onSelectedItemChange()
}

/** 切换到粗配准（手动配准）阶段。 */
function activateCoarseRegistration() {
  registrationStage.value = 'coarse'
  if (editMode.value) return
  editMode.value = true
  onEditModeChange()
}

/** 精细化配准结果（ICP 精调），用于在 UI 中展示 Metrics。 */
const fineAlignResult = ref<FineAlignmentResult | null>(null)
/** 精细化配准执行中的 loading 状态。 */
const fineAlignLoading = ref(false)
/** 负优化触发时是否仍应用精调结果（默认关闭：仅告警不应用）。 */
const fineApplyWhenRegressed = ref(false)
/** RMSE 退化告警阈值（fineRmse > initRmse * 阈值触发）。 */
const fineRmseRegressRatio = ref(1.05)
/** Fitness 退化告警阈值（fineFitness < initFitness * 阈值触发）。 */
const fineFitnessRegressRatio = ref(0.95)
const canSaveCoarseAlignment = computed(() => {
  return (
    registrationStage.value === 'coarse' &&
    hasModel.value &&
    hasTileset.value &&
    !savingCalibration.value
  )
})
const coarseSaveHint = computed(() => {
  if (!hasModel.value || !hasTileset.value) return '请先加载 BIM 与点云'
  if (coarseAlignmentDirty.value) {
    return '当前粗配准有未保存修改，请先保存再进入精配'
  }
  if (hasSavedAlignmentMatrix.value) return '粗配准矩阵已保存，可进入精细化配准'
  return '请先保存粗配准矩阵，再进行精细化配准'
})
const canRunFineAlignment = computed(() => {
  return (
    registrationStage.value === 'fine' &&
    !!projectId.value &&
    !!scanFileId.value &&
    !!bimFileId.value &&
    hasSavedAlignmentMatrix.value &&
    !coarseAlignmentDirty.value &&
    !fineAlignLoading.value
  )
})
const canSaveFineAlignment = computed(() => {
  return (
    registrationStage.value === 'fine' &&
    !!projectId.value &&
    !!scanFileId.value &&
    !!bimFileId.value &&
    !!fineAlignResult.value &&
    !fineAlignLoading.value &&
    !savingCalibration.value
  )
})
const fineRunBlockedReason = computed(() => {
  if (registrationStage.value !== 'fine') return ''
  if (!projectId.value || !scanFileId.value || !bimFileId.value) {
    return '缺少项目或文件 ID，无法执行精细化配准'
  }
  if (!hasSavedAlignmentMatrix.value) {
    return '请先在粗配准阶段保存矩阵，精配将以该矩阵作为初始状态'
  }
  if (coarseAlignmentDirty.value) {
    return '检测到粗配准有未保存修改，请先保存粗配准矩阵再开始计算'
  }
  return ''
})

/** 顶部"校准完成"按钮的可用性判断。 */
const canSaveCalibration = computed(() => {
  if (!hasModel.value || !hasTileset.value) return false
  if (registrationStage.value === 'fine') return canSaveFineAlignment.value
  return true
})

/** 顶部"校准完成"按钮被禁用时显示的 tooltip 提示。 */
const saveCalibrationTooltip = computed(() => {
  if (!hasModel.value || !hasTileset.value) return ''
  if (registrationStage.value === 'fine' && !fineAlignResult.value) {
    return fineRunBlockedReason.value || '请先点击「开始计算」完成精细化配准'
  }
  return ''
})

function markFineAlignmentDirty() {
  fineAlignResult.value = null
}

function markCoarseAlignmentDirty() {
  if (registrationStage.value !== 'coarse' || !editMode.value) return
  coarseAlignmentDirty.value = true
  markFineAlignmentDirty()
}

function normalizeFineThreshold(
  value: unknown,
  options: { min: number; max: number; fallback: number; precision: number },
) {
  const num = Number(value)
  if (!Number.isFinite(num)) return options.fallback
  const clamped = Math.min(options.max, Math.max(options.min, num))
  return Number(clamped.toFixed(options.precision))
}

function onFineRmseRegressRatioChange(value: number | undefined) {
  fineRmseRegressRatio.value = normalizeFineThreshold(value, {
    min: 1,
    max: 2,
    fallback: 1.05,
    precision: 2,
  })
  markFineAlignmentDirty()
}

function onFineFitnessRegressRatioChange(value: number | undefined) {
  fineFitnessRegressRatio.value = normalizeFineThreshold(value, {
    min: 0.5,
    max: 1,
    fallback: 0.95,
    precision: 2,
  })
  markFineAlignmentDirty()
}

function resetFineThresholdDefaults() {
  fineRmseRegressRatio.value = 1.05
  fineFitnessRegressRatio.value = 0.95
  markFineAlignmentDirty()
}

/** 格式化精细化配准指标，用于弹窗展示。 */
function formatFineAlignMetrics(result: FineAlignmentResult): string {
  const m = result.metrics
  const regressed =
    typeof result.regressed === 'boolean' ? result.regressed : !!result.fallback
  const appliedFineResult =
    typeof result.appliedFineResult === 'boolean'
      ? result.appliedFineResult
      : !result.fallback
  const rmseRatio = Number.isFinite(result.rmseRegressRatio)
    ? result.rmseRegressRatio
    : fineRmseRegressRatio.value
  const fitnessRatio = Number.isFinite(result.fitnessRegressRatio)
    ? result.fitnessRegressRatio
    : fineFitnessRegressRatio.value
  const formatNum = (value: unknown, digits: number) => {
    const num = Number(value)
    if (!Number.isFinite(num)) return (0).toFixed(digits)
    return num.toFixed(digits)
  }
  const formatCount = (value: unknown) => {
    const num = Number(value)
    if (!Number.isFinite(num)) return '0'
    return Math.round(num).toLocaleString()
  }

  const decisionTip = regressed
    ? appliedFineResult
      ? '\n⚠️ 检测到负优化告警，已按开关应用精调结果（未自动保存）'
      : '\n⚠️ 检测到负优化告警，已按开关保留初始矩阵（未自动保存）'
    : '\n✅ 未触发负优化告警，已应用精调结果（未自动保存）'
  const thresholdTip = `告警阈值：RMSE>${formatNum(rmseRatio, 2)}x 或 Fitness<${formatNum(fitnessRatio, 2)}x`
  return [
    `${decisionTip}`,
    `${thresholdTip}`,
    ``,
    `── 配准质量对比 ──`,
    `初始状态：fitness=${formatNum(m?.initFitness, 4)}  RMSE=${formatNum(m?.initRmse, 4)}m`,
    `精调结果：fitness=${formatNum(m?.fineFitness, 4)}  RMSE=${formatNum(m?.fineRmse, 4)}m`,
    ``,
    `── 矩阵变化量 ──`,
    `平移变化：${formatNum(m?.deltaTranslationM, 4)}m`,
    `旋转变化：${formatNum(m?.deltaRotationDeg, 4)}°`,
    ``,
    `── 数据规模 ──`,
    `点云点数：${formatCount(m?.sourceTotalPoints)}`,
    `Mesh顶点：${formatCount(m?.targetPoints)}`,
    `计算耗时：${formatNum(m?.elapsedS, 1)}s`,
  ].join('\n')
}

/** 执行精细化配准（ICP 精调）。 */
function activateFineRegistration() {
  registrationStage.value = 'fine'
  markFineAlignmentDirty()
  if (coarseAlignmentDirty.value) {
    ElMessage.warning('粗配准有未保存修改，请先保存粗配准矩阵')
  } else if (!hasSavedAlignmentMatrix.value) {
    ElMessage.info('请先保存粗配准矩阵，精配将以该矩阵为初始状态')
  }
  if (editMode.value) {
    editMode.value = false
    onEditModeChange()
  }
}

/** 执行精细化配准（ICP 精调）。 */
async function runFineAlignment() {
  if (!projectId.value || !scanFileId.value || !bimFileId.value) {
    ElMessage.warning('缺少项目 ID 或文件 ID，无法执行精细化配准')
    return
  }
  if (!hasSavedAlignmentMatrix.value) {
    ElMessage.warning('请先在粗配准阶段保存矩阵，再执行精细化配准')
    return
  }
  if (coarseAlignmentDirty.value) {
    ElMessage.warning('检测到粗配准有未保存修改，请先保存粗配准矩阵')
    return
  }

  fineAlignLoading.value = true
  try {
    const res = await computeFineAlignment(projectId.value, {
      modelScanFileId: scanFileId.value,
      modelBimFileId: bimFileId.value,
      rmseRegressRatio: fineRmseRegressRatio.value,
      fitnessRegressRatio: fineFitnessRegressRatio.value,
      applyWhenRegressed: fineApplyWhenRegressed.value,
    })

    const result = res?.data
    if (!result) {
      ElMessage.error('精细化配准返回数据为空')
      return
    }

    fineAlignResult.value = result

    // 将精调后的矩阵作为“未保存预览”应用到场景中
    latestAlignmentResult.value = {
      modelId: latestAlignmentResult.value?.modelId ?? 0,
      modelScanFileId: result.modelScanFileId,
      modelBimFileId: result.modelBimFileId,
      modelRotationQx: result.modelRotationQx,
      modelRotationQy: result.modelRotationQy,
      modelRotationQz: result.modelRotationQz,
      modelRotationQw: result.modelRotationQw,
      modelTranslationX: result.modelTranslationX,
      modelTranslationY: result.modelTranslationY,
      modelTranslationZ: result.modelTranslationZ,
      modelMatrix: result.modelMatrix,
      modelRmse: result.appliedFineResult
        ? result.metrics.fineRmse
        : result.metrics.initRmse,
      modelMaxError: latestAlignmentResult.value?.modelMaxError ?? 0,
      modelPairCount: latestAlignmentResult.value?.modelPairCount ?? 0,
      modelInlierCount: latestAlignmentResult.value?.modelInlierCount ?? 0,
    }
    pendingAlignmentRestore.value = latestAlignmentResult.value
    tryRestoreSavedBimAlignment(true, false)

    ElMessageBox.alert(formatFineAlignMetrics(result), '精细化配准结果', {
      confirmButtonText: '确定',
      customStyle: { 'white-space': 'pre-wrap', 'font-family': 'monospace' },
    })
  } catch (error: any) {
    console.error('精细化配准失败:', error)
    ElMessage.error(error?.message || '精细化配准失败，请稍后重试')
  } finally {
    fineAlignLoading.value = false
  }
}

function getDefaultEditTargetId() {
  return (
    loadedItems.value.find((i) => i.kind === 'gltf')?.id ??
    loadedItems.value[0]?.id ??
    ''
  )
}

/** 作用：编辑模式下的旋转统一只允许绕场景竖直轴（Y）旋转。 */
const showOnlyVerticalAxis = computed(() => {
  return Boolean(selectedItemId.value) && transformMode.value === 'rotate'
})

const pickedElement = ref<null | {
  label: string
  ifcId?: string
  sourceLabel?: string
}>(null)

// Three.js 渲染相关实例（WebGPU）
let renderer: any = null
let scene: any = null
let camera: any = null
let perspectiveCamera: any = null
let orthographicCamera: any = null
let orthoViewSize = 2
let gridHelper: any = null
let controls: any = null
let resizeObserver: ResizeObserver | null = null
let animationHandle = 0
let renderRequested = false
let dprCap = 1.25
let stats: any = null
let transformControls: any = null
let raycaster: any = null
let transformHelper: any = null
let clippingGroup: any = null
let clipUpdateScheduled = false
let wireframeOverlayGroup: THREE.Group | null = null
const WIREFRAME_COLOR = '#00cfff'
const WIREFRAME_OVERLAY_TAG = '__wireframeOverlay'

// 均匀化网格专属对象（实体模型 + 线框，可分别控制）
let remeshWireGroup: {
  solid: THREE.Mesh | null
  wire: THREE.LineSegments | null
} | null = null
const hasRemeshMesh = ref(false)
const remeshSolidHidden = ref(false) // 控制橙色实体模型
const remeshWireHidden = ref(false) // 控制绿色线框
// WireframeGeometry 内部哈希桶上限约 800 万边，对应约 270 万面；超过时跳过线框构建
const WIREFRAME_MAX_FACES = 2_700_000
const remeshWireAvailable = ref(true) // 面片过多时为 false，隐藏线框按钮

// 已加载资源：glb roots + tilesets wrapper（用于 UI 列表、清理、包围盒/变换控制）
const loadedObjectUrls: string[] = []
const loadedRoots: any[] = []
const loadedTilesets: Array<{ tr: any; wrapper: any; rootReady: boolean }> = []
let contentGroup: any = null
const boundHelpers: any[] = []
const boundHelperEntries: Array<{
  itemId: string
  target: any
  boxHelper: any
  box: THREE.Box3
}> = []
const clipHostByItemId = new Map<string, { host: any; target: any }>()
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
const JOINT_CLIP_TARGET_ID = '__joint_clip_target__'
const clipStateByItemId = new Map<string, ClipBoxState>()
let activeClipTargetId = ''
let clipHandlesGroup: any = null
const clipHandlePickers: any[] = []
let clipDragState: null | {
  pointerId: number
  itemId: string
  axis: ClipAxisKey
  invert: boolean
  dragPlane: any
  startPoint: any
  startPosition: number
  min: number
  max: number
} = null
let clipPointerCaptureId: number | null = null
let clipBoundsRevision = 0
let boundsHelpersUpdateScheduled = false
const objectWorldBoxCache = new WeakMap<
  any,
  { revision: number; box: THREE.Box3 }
>()
const loadedItems = ref<
  Array<{ id: string; label: string; obj: any; kind: 'gltf' | 'tileset' }>
>([])
let nextItemId = 1
let highlightedElement:
  | null
  | { kind: 'mesh'; mesh: any; originalMaterial: any; highlightMaterial: any }
  | { kind: 'meshOverlay'; mesh: any; overlay: any; material: any }
  | { kind: 'batched'; mesh: any; batchId: number; prevColor: any }
  | {
      kind: 'batchedOverlay'
      batched: any
      batchId: number
      overlay: any
      material: any
    } = null

// Avoid storing material object references in userData (Material.copy() JSON-stringifies userData).
const unlitMaterialCache = new WeakMap<any, { v0?: any; v1?: any }>()
const lambertMaterialCache = new WeakMap<any, { v0?: any; v1?: any }>()
const pointsMaterialCache = new WeakMap<any, { v0?: any; v1?: any }>()
const originalMaterialByTSL = new WeakMap<any, any>()

type ElementRef =
  | { kind: 'mesh'; mesh: any }
  | { kind: 'batched'; batched: any; batchId: number }
// elementId(GlobalId) → 场景里实际可操作的对象引用列表（mesh 或 batched instance）
const elementIndex = new Map<string, ElementRef[]>()

const pickedElementText = computed(() => {
  if (!pickedElement.value) return '未选择'
  const parts = [pickedElement.value.label]
  if (pickedElement.value.ifcId) parts.push(`ID: ${pickedElement.value.ifcId}`)
  if (pickedElement.value.sourceLabel)
    parts.push(`来源: ${pickedElement.value.sourceLabel}`)
  return parts.join(' | ')
})

/** 作用：根据 `selectedItemId` 返回当前加载列表中的选中项。 */
function getSelectedItem() {
  return loadedItems.value.find((i) => i.id === selectedItemId.value) ?? null
}

function getLoadedItemById(id: string) {
  return loadedItems.value.find((i) => i.id === id) ?? null
}

function isJointClipTargetId(id: string) {
  return id === JOINT_CLIP_TARGET_ID
}

function canUseJointClipping() {
  return hasGltf.value && hasTileset.value
}

function clearJointClipState() {
  clipStateByItemId.delete(JOINT_CLIP_TARGET_ID)
}

function getJointClipObjects() {
  return loadedItems.value
    .filter((item) => item.kind === 'gltf' || item.kind === 'tileset')
    .map((item) => item.obj)
    .filter(Boolean)
}

function getClipTargetObjects(itemId = activeClipTargetId) {
  if (isJointClipTargetId(itemId)) return getJointClipObjects()
  const target = getLoadedItemById(itemId)?.obj
  return target ? [target] : []
}

function getClipTargetObject(itemId = activeClipTargetId) {
  return getClipTargetObjects(itemId)[0] ?? null
}

function invalidateClipBounds() {
  clipBoundsRevision += 1
}

function scheduleBoundsHelpersUpdate() {
  if (boundsHelpersUpdateScheduled) return
  boundsHelpersUpdateScheduled = true
  requestAnimationFrame(() => {
    boundsHelpersUpdateScheduled = false
    updateBoundsHelpers()
  })
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

function cloneBox3(box: THREE.Box3) {
  return new THREE.Box3(box.min.clone(), box.max.clone())
}

function getObjectWorldBox(target: any) {
  if (!target) return null
  const cached = objectWorldBoxCache.get(target)
  if (cached && cached.revision === clipBoundsRevision) return cached.box
  target.updateMatrixWorld?.(true)
  const box = new THREE.Box3().setFromObject(target)
  if (box.isEmpty()) return null
  objectWorldBoxCache.set(target, {
    revision: clipBoundsRevision,
    box,
  })
  return box
}

function getObjectsWorldBox(targets: any[]) {
  const box = new THREE.Box3()
  let found = false
  for (const target of targets) {
    const targetBox = getObjectWorldBox(target)
    if (!targetBox) continue
    if (!found) {
      box.copy(targetBox)
      found = true
      continue
    }
    box.union(targetBox)
  }
  return found ? box : null
}

function getClipOffsetKey(axis: ClipAxisKey, invert: boolean) {
  return `${axis}${invert ? 'Max' : 'Min'}` as keyof ClipBoxOffsets
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

function getOrCreateClipState(itemId = activeClipTargetId) {
  const targets = getClipTargetObjects(itemId)
  const baseBox = getObjectsWorldBox(targets)
  if (!targets.length || !baseBox) return null

  const cached = clipStateByItemId.get(itemId)
  if (cached && cached.revision === clipBoundsRevision) {
    return cached
  }
  if (cached) {
    cached.baseBox.copy(baseBox)
    cached.revision = clipBoundsRevision
    clampClipOffsets(cached)
    return cached
  }

  const created: ClipBoxState = {
    baseBox: cloneBox3(baseBox),
    offsets: createDefaultClipOffsets(),
    revision: clipBoundsRevision,
  }
  clipStateByItemId.set(itemId, created)
  return created
}

function removeClipStateForObject(target: any) {
  const itemId = String(target?.userData?.__viewerItemId ?? '')
  if (itemId) clipStateByItemId.delete(itemId)
  clearJointClipState()
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

function getCurrentClipBox(itemId = activeClipTargetId) {
  const state = getOrCreateClipState(itemId)
  return state ? getClipBoxFromState(state) : null
}

function getClipFacePosition(
  itemId: string,
  axis: ClipAxisKey,
  invert: boolean,
) {
  const box = getCurrentClipBox(itemId)
  if (!box) return 0
  return invert ? box.max[axis] : box.min[axis]
}

function getClipFaceRange(itemId: string, axis: ClipAxisKey, invert: boolean) {
  const state = getOrCreateClipState(itemId)
  const box = state ? getClipBoxFromState(state) : null
  if (!state || !box) return { min: 0, max: 1 }

  return invert
    ? { min: box.min[axis], max: state.baseBox.max[axis] }
    : { min: state.baseBox.min[axis], max: box.max[axis] }
}

function setClipFacePosition(
  itemId: string,
  axis: ClipAxisKey,
  invert: boolean,
  value: number,
) {
  const state = getOrCreateClipState(itemId)
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

function syncClipUiFromFace(itemId = activeClipTargetId) {
  if (!itemId) {
    clipRange.value = { min: 0, max: 1 }
    clipPosition.value = 0
    return
  }

  const range = getClipFaceRange(itemId, clipAxis.value, clipInvert.value)
  clipRange.value = range
  clipPosition.value = getClipFacePosition(
    itemId,
    clipAxis.value,
    clipInvert.value,
  )
}

function resolveClipTargetId(preferredId = '') {
  if (canUseJointClipping()) return JOINT_CLIP_TARGET_ID
  if (preferredId === JOINT_CLIP_TARGET_ID) return ''
  return ''
}

function ensureClipHostForObject(target: any) {
  const itemId = String(target?.userData?.__viewerItemId ?? '')
  if (!target || !itemId) return null
  const cached = clipHostByItemId.get(itemId)
  if (cached?.host) return cached.host

  const host = new ClippingGroup()
  host.userData = host.userData ?? {}
  host.userData.__viewerItemId = itemId
  host.userData.__viewerLabel = target?.userData?.__viewerLabel
  host.userData.__viewerClipTarget = target
  host.add(target)
  clipHostByItemId.set(itemId, { host, target })
  return host
}

function removeClipHostForObject(target: any) {
  const itemId = String(target?.userData?.__viewerItemId ?? '')
  if (!itemId) return null
  const host = clipHostByItemId.get(itemId)?.host ?? null
  clipHostByItemId.delete(itemId)
  return host
}

function setActiveClipTarget(itemId = '') {
  const nextId = resolveClipTargetId(itemId)
  activeClipTargetId = nextId
  if (!activeClipTargetId) {
    clipRange.value = { min: 0, max: 1 }
    clipPosition.value = 0
    updateBoundsHelpers()
    applyClippingState()
    return
  }

  getOrCreateClipState(activeClipTargetId)
  syncClipUiFromFace(activeClipTargetId)
  updateBoundsHelpers()
  applyClippingState()
}

function syncTransformModeForSelection() {
  if (selectedItemIsTileset.value && transformMode.value === 'rotate') {
    transformMode.value = 'translate'
  }
}

/** 作用：重置实时朝向修正（X/Y/Z 欧拉角）为 0。 */
function resetOrientationFix() {
  orientationDegX.value = 0
  orientationDegY.value = 0
  orientationDegZ.value = 0
}

function resetPositionFix() {
  positionOffsetX.value = 0
  positionOffsetY.value = 0
  positionOffsetZ.value = 0
}

/** 作用：为对象建立并返回"朝向基准四元数"（用于实时旋转叠加）。 */
function ensureOrientationBase(obj: any) {
  if (!obj?.quaternion) return null
  if (!obj.userData) obj.userData = {}
  if (!obj.userData.__orientationBaseQuat)
    obj.userData.__orientationBaseQuat = obj.quaternion.clone()
  return obj.userData.__orientationBaseQuat as any
}

function ensurePositionBase(obj: any) {
  if (!obj?.position) return null
  if (!obj.userData) obj.userData = {}
  if (!obj.userData.__positionBaseVec3)
    obj.userData.__positionBaseVec3 = obj.position.clone()
  return obj.userData.__positionBaseVec3 as any
}

/** 作用：记录对象首次加载后的初始朝向，用于“重置”恢复到初始状态。 */
function ensureInitialOrientation(obj: any) {
  if (!obj?.quaternion) return null
  if (!obj.userData) obj.userData = {}
  if (!obj.userData.__initialOrientationQuat)
    obj.userData.__initialOrientationQuat = obj.quaternion.clone()
  return obj.userData.__initialOrientationQuat as any
}

/** 作用：记录对象首次加载后的初始位置，用于“重置”恢复到初始状态。 */
function ensureInitialPosition(obj: any) {
  if (!obj?.position) return null
  if (!obj.userData) obj.userData = {}
  if (!obj.userData.__initialPositionVec3)
    obj.userData.__initialPositionVec3 = obj.position.clone()
  return obj.userData.__initialPositionVec3 as any
}

function ensureInitialTransformState(obj: any) {
  ensureInitialOrientation(obj)
  ensureInitialPosition(obj)
}

function normalizeDegrees(value: number) {
  let next = value
  while (next <= -180) next += 360
  while (next > 180) next -= 360
  return next
}

function roundToStep(value: number, step = 0.01) {
  return Math.round(value / step) * step
}

function syncOrientationFixFromSelected() {
  const item = getSelectedItem()
  const obj = item?.obj
  if (!obj?.quaternion) return

  const base = ensureOrientationBase(obj)
  if (!base) return

  const offsetQuat = obj.quaternion.clone().multiply(base.clone().invert())
  if (transformMode.value === 'rotate') {
    const offsetEuler = new THREE.Euler().setFromQuaternion(offsetQuat, 'YXZ')
    orientationDegX.value = 0
    orientationDegY.value = roundToStep(
      normalizeDegrees(THREE.MathUtils.radToDeg(offsetEuler.y)),
    )
    orientationDegZ.value = 0
    return
  }

  const offsetEuler = new THREE.Euler().setFromQuaternion(offsetQuat, 'XYZ')
  orientationDegX.value = roundToStep(
    normalizeDegrees(THREE.MathUtils.radToDeg(offsetEuler.x)),
  )
  orientationDegY.value = roundToStep(
    normalizeDegrees(THREE.MathUtils.radToDeg(offsetEuler.y)),
  )
  orientationDegZ.value = roundToStep(
    normalizeDegrees(THREE.MathUtils.radToDeg(offsetEuler.z)),
  )
}

function syncPositionFixFromSelected() {
  const item = getSelectedItem()
  const obj = item?.obj
  if (!obj?.position) return

  const base = ensurePositionBase(obj)
  if (!base) return

  const offset = obj.position.clone().sub(base)
  positionOffsetX.value = roundToStep(offset.x)
  positionOffsetY.value = roundToStep(offset.z)
  positionOffsetZ.value = roundToStep(offset.y)
}

function syncTransformFixFromSelected() {
  if (transformMode.value === 'rotate') {
    syncOrientationFixFromSelected()
    return
  }
  syncPositionFixFromSelected()
}

function syncAllTransformFixValuesFromSelected() {
  syncOrientationFixFromSelected()
  syncPositionFixFromSelected()
}

function refreshSelectedTransformUi(rebaseBase = true) {
  syncTransformModeForSelection()
  applyTransformSelection()
  scheduleBoundsHelpersUpdate()
  resetOrientationFix()
  resetPositionFix()
  const item = getSelectedItem()
  ensureInitialTransformState(item?.obj)
  if (rebaseBase) {
    if (item?.obj?.quaternion) {
      if (!item.obj.userData) item.obj.userData = {}
      item.obj.userData.__orientationBaseQuat = item.obj.quaternion.clone()
    }
    if (item?.obj?.position) {
      if (!item.obj.userData) item.obj.userData = {}
      item.obj.userData.__positionBaseVec3 = item.obj.position.clone()
    }
    return
  }
  syncAllTransformFixValuesFromSelected()
}

/** 作用：把控制面板中的朝向修正实时应用到当前选中对象上。 */
function applyOrientationFixRealtime() {
  const item = getSelectedItem()
  const obj = item?.obj
  if (!obj?.quaternion) return

  const base = ensureOrientationBase(obj)
  if (!base) return

  const offsetQuat = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    THREE.MathUtils.degToRad(orientationDegY.value),
  )

  // q = offset * base  => base applied first, then offset.
  obj.quaternion.copy(offsetQuat).multiply(base)
  obj.updateMatrixWorld?.(true)
  transformHelper?.updateMatrixWorld?.(true)
  invalidateClipBounds()
  scheduleBoundsHelpersUpdate()
  markCoarseAlignmentDirty()
  requestRender()
}

function scheduleOrientationFixRealtime() {
  if (orientationFixFrameHandle) return
  orientationFixFrameHandle = requestAnimationFrame(() => {
    orientationFixFrameHandle = 0
    applyOrientationFixRealtime()
  })
}

function flushOrientationFixRealtime() {
  if (orientationFixFrameHandle) {
    cancelAnimationFrame(orientationFixFrameHandle)
    orientationFixFrameHandle = 0
  }
  applyOrientationFixRealtime()
}

function applyPositionFixRealtimeNow() {
  const item = getSelectedItem()
  const obj = item?.obj
  if (!obj?.position) return
  if (item?.kind === 'tileset') {
    resetPositionFix()
    return
  }

  const base = ensurePositionBase(obj)
  if (!base) return

  const offset =
    item?.kind === 'gltf'
      ? new THREE.Vector3(
          positionOffsetX.value,
          positionOffsetZ.value,
          positionOffsetY.value,
        )
      : new THREE.Vector3(
          positionOffsetX.value,
          positionOffsetZ.value,
          positionOffsetY.value,
        )
  obj.position.copy(base).add(offset)
  obj.updateMatrixWorld?.(true)
  transformHelper?.updateMatrixWorld?.(true)
  invalidateClipBounds()
  scheduleBoundsHelpersUpdate()
  markCoarseAlignmentDirty()
  requestRender()
}

function schedulePositionFixRealtime() {
  if (positionFixFrameHandle) return
  positionFixFrameHandle = requestAnimationFrame(() => {
    positionFixFrameHandle = 0
    applyPositionFixRealtimeNow()
  })
}

function flushPositionFixRealtime() {
  if (positionFixFrameHandle) {
    cancelAnimationFrame(positionFixFrameHandle)
    positionFixFrameHandle = 0
  }
  applyPositionFixRealtimeNow()
}

/** 作用：将当前选中对象完整恢复到首次加载时的初始姿态（位置 + 旋转）。 */
function restoreSelectedToInitialTransform() {
  const item = getSelectedItem()
  const obj = item?.obj
  if (!obj) return

  if (!obj.userData) obj.userData = {}

  if (obj.quaternion) {
    const initialQuat = ensureInitialOrientation(obj)
    if (initialQuat) {
      obj.quaternion.copy(initialQuat)
      obj.userData.__orientationBaseQuat = initialQuat.clone()
    }
  }

  if (obj.position) {
    const initialPos = ensureInitialPosition(obj)
    if (initialPos) {
      obj.position.copy(initialPos)
      obj.userData.__positionBaseVec3 = initialPos.clone()
    }
  }

  resetOrientationFix()
  resetPositionFix()
  obj.updateMatrixWorld?.(true)
  transformHelper?.updateMatrixWorld?.(true)
  invalidateClipBounds()
  scheduleBoundsHelpersUpdate()
  markCoarseAlignmentDirty()
  requestRender()
}

function recenterLoadedContentAsWhole() {
  if (!contentGroup) return
  if (!contentGroup.children?.length) {
    contentGroup.position.set(0, 0, 0)
    contentGroup.updateMatrixWorld?.(true)
    return
  }

  const prev = contentGroup.position.clone()
  contentGroup.position.set(0, 0, 0)
  contentGroup.updateMatrixWorld?.(true)

  const box = new THREE.Box3().setFromObject(contentGroup)
  if (box.isEmpty()) {
    contentGroup.position.copy(prev)
    contentGroup.updateMatrixWorld?.(true)
    return
  }

  const center = box.getCenter(new THREE.Vector3())
  contentGroup.position.copy(prev).sub(center)
  contentGroup.updateMatrixWorld?.(true)
  invalidateClipBounds()
}

function resetTransformFixRealtime() {
  restoreSelectedToInitialTransform()
}

/** 作用：递归释放对象树中的几何体/材质/贴图，避免内存泄漏。 */
function disposeObject(root: any) {
  ;(root as any).traverse((obj: any) => {
    const mesh = obj as any
    if (mesh?.isMesh) {
      mesh.geometry?.dispose?.()
      const material = mesh.material as any
      if (Array.isArray(material)) material.forEach((m) => disposeMaterial(m))
      else if (material) disposeMaterial(material)
    }
  })
}

/** 作用：释放材质中引用的贴图资源，并 dispose 材质本身。 */
function disposeMaterial(material: any) {
  const maybeAny = material as Record<string, unknown>
  for (const value of Object.values(maybeAny)) {
    const texture = value as any
    if (texture?.isTexture) texture.dispose?.()
  }
  material.dispose?.()
}

/** 作用：从 mesh.userData 中尽力推断 ifcId/GlobalId 等标识字段。 */
function guessIfcId(userData: any): string | undefined {
  if (!userData || typeof userData !== 'object') return undefined

  const directKeys = [
    'expressID',
    'ExpressID',
    'expressId',
    'ifcId',
    'ifcID',
    'IfcId',
    'globalId',
    'GlobalId',
    'guid',
    'GUID',
    'IfcGUID',
    'ifcGuid',
  ]

  for (const k of directKeys) {
    const v = (userData as any)[k]
    if (v === null || v === undefined) continue
    const s = String(v).trim()
    if (s) return s
  }

  // common nesting patterns
  const nested =
    (userData as any).properties ??
    (userData as any).PropertySets ??
    (userData as any).ifc ??
    null
  if (nested && typeof nested === 'object') {
    for (const k of directKeys) {
      const v = (nested as any)[k]
      if (v === null || v === undefined) continue
      const s = String(v).trim()
      if (s) return s
    }
  }

  return undefined
}

/** 作用：判断字符串是否符合 IFC GlobalId 的 22 位压缩格式。 */
function looksLikeIfcGuid(s: unknown) {
  const str = String(s ?? '').trim()
  return /^[0-9A-Za-z_$]{22}$/.test(str)
}

/** 作用：从导出器名称中抽取可能的构件 id（含“_1”这类子件后缀）。 */
function candidateIdsFromName(name: unknown) {
  const s = String(name ?? '').trim()
  if (!s) return []
  const out = [s]
  // Some exporters append suffixes for sub-parts, e.g. "1501_1".
  if (s.includes('_')) {
    const base = (s.split('_')[0] ?? '').trim()
    if (base && base !== s) out.push(base)
  }
  return out
}

/** 作用：从命中的 3D 对象（含祖先）推断出 elementId(GlobalId)，用于点选/显隐联动。 */
function getElementIdFromObject(obj: any): string | undefined {
  // Prefer IFC GUIDs on nodes (IfcConvert --use-element-guids typically writes them to node.name).
  let cur: any = obj
  while (cur) {
    const name = String(cur?.name ?? '').trim()
    for (const candidate of candidateIdsFromName(name)) {
      if (looksLikeIfcGuid(candidate)) return candidate
    }
    const byUserData = guessIfcId(cur?.userData)
    if (byUserData) return byUserData
    cur = cur.parent
  }
  return undefined
}

/** 作用：清空 elementId → 场景对象引用 的索引。 */
function clearElementIndex() {
  elementIndex.clear()
}

// /** 作用：向 elementIndex 追加一个 elementId 对应的场景引用（mesh 或 batched instance）。 */
// function indexElement(id: string, ref: ElementRef) {
//   const key = normalizeMetaKey(id)
//   if (!key) return
//   const existing = elementIndex.get(key)
//   if (existing) existing.push(ref)
//   else elementIndex.set(key, [ref])
// }

/** 作用：扫描已加载的 GLB/Tiles 场景，重建 elementId(GlobalId) → 场景对象引用 的索引。 */
function rebuildElementIndex() {
  // 构建 elementId(GlobalId) → 场景对象引用 的索引。
  // 这是高亮功能能工作的关键。
  clearElementIndex()
  for (const root of loadedRoots) {
    root?.traverse?.((obj: any) => {
      if (!obj || obj?.userData?.__viewerPickIgnore) return
      if (obj?.isBatchedMesh) {
        // BatchedMesh：raycast 返回 batchId（instanceId），可对单个 instance 做显隐/高亮。
        const arr: any[] = obj?.userData?.__viewerBatchMeta
        // if (!Array.isArray(arr)) return
        // for (let i = 0; i < arr.length; i++) {
        //   const meta = arr[i]
        //   const elementId = normalizeMetaKey(
        //     meta?.elementId ?? meta?.ifcId ?? meta?.label,
        //   )
        //   if (!elementId) continue
        //   indexElement(elementId, { kind: 'batched', batched: obj, batchId: i })
        // }
        return
      }
      if (obj?.isMesh) {
        // 普通 Mesh：尽量从 name / userData / 父节点推断 elementId
        const elementId = getElementIdFromObject(obj)
        if (!elementId) return
        // indexElement(elementId, { kind: 'mesh', mesh: obj })
      }
    })
  }
}

/** 作用：从 elementIndex 获取某个 elementId 对应的所有场景引用（mesh/batched）。 */
// function getElementRefsById(id: unknown) {
//   const key = normalizeMetaKey(id)
//   if (!key) return []
//   return elementIndex.get(key) ?? []
// }

/** 作用：将相机与轨道控制器聚焦到给定包围盒（用于“定位/聚焦选中”）。 */
function focusBox(box: any) {
  if (!camera || !controls) return
  if (!box || !box.getSize || !box.getCenter) return

  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  const maxDim = Math.max(size.x, size.y, size.z) || 1

  const dir = new THREE.Vector3()
    .subVectors(camera.position, controls.target)
    .normalize()
  if (!Number.isFinite(dir.lengthSq()) || dir.lengthSq() === 0)
    dir.set(0, 0.2, 1).normalize()

  controls.target.copy(center)
  if (camera?.isOrthographicCamera) {
    orthoViewSize = maxDim * 0.5 * 1.2
    camera.zoom = 1
    updateOrthographicFrustum()
    camera.position.copy(center).addScaledVector(dir, maxDim * 2.2)
    camera.near = Math.max(0.01, maxDim / 100)
    camera.far = maxDim * 400
    camera.updateProjectionMatrix()
  } else {
    const fov = THREE.MathUtils.degToRad(camera.fov)
    const distance = maxDim / 2 / Math.tan(fov / 2)
    camera.position.copy(center).addScaledVector(dir, distance * 2.2)
    camera.near = distance / 100
    camera.far = distance * 200
    camera.updateProjectionMatrix()
  }
  controls.update()
  requestRender()
}

/** 作用：计算一个 element 引用（mesh 或 batched instance）的世界空间包围盒。 */
function computeBoxForElementRef(ref: ElementRef) {
  if (ref.kind === 'mesh') {
    const box = new THREE.Box3().setFromObject(ref.mesh)
    if (!box.isEmpty()) return box
    return null
  }

  const batched = ref.batched
  const batchId = ref.batchId
  try {
    const instanceInfo = batched?._instanceInfo?.[batchId]
    const geometryId = instanceInfo?.geometryIndex
    if (geometryId === undefined) return null
    const localBox = new THREE.Box3()
    batched.getBoundingBoxAt?.(geometryId, localBox)
    if (localBox.isEmpty()) return null
    const world = new THREE.Matrix4()
    batched.getMatrixAt?.(batchId, world)
    world.premultiply(batched.matrixWorld)
    localBox.applyMatrix4(world)
    return localBox
  } catch {
    return null
  }
}

/** 作用：将某个 elementId 对应的所有场景引用整体设为可见/不可见。 */
// function setElementVisibleIn3D(elementId: string, visible: boolean) {
//   const refs = getElementRefsById(elementId)
//   for (const r of refs) {
//     if (r.kind === 'mesh') r.mesh.visible = visible
//     else r.batched.setVisibleAt?.(r.batchId, visible)
//   }
//   requestRender()
// }

/** 作用：更新 hiddenElementIds 集合，并同步该 elementId 在 3D 中的显隐。 */
// function setElementHidden(elementId: string, hidden: boolean) {
//   const id = normalizeMetaKey(elementId)
//   if (!id) return
//   const refs = getElementRefsById(id)
//   for (const r of refs) {
//     if (r.kind === 'mesh') r.mesh.visible = !hidden
//     else r.batched.setVisibleAt?.(r.batchId, !hidden)
//   }
//   requestRender()
// }

/** 作用：恢复上一次高亮（撤销 overlay 或还原材质/颜色）。 */
function restoreHighlightedElement() {
  if (!highlightedElement) return

  if (highlightedElement.kind === 'batched') {
    highlightedElement.mesh.setColorAt?.(
      highlightedElement.batchId,
      highlightedElement.prevColor,
    )
  } else if (highlightedElement.kind === 'batchedOverlay') {
    scene?.remove?.(highlightedElement.overlay)
    disposeMaterial(highlightedElement.material)
  } else if (highlightedElement.kind === 'meshOverlay') {
    highlightedElement.mesh.remove?.(highlightedElement.overlay)
    disposeMaterial(highlightedElement.material)
  } else {
    highlightedElement.mesh.material = highlightedElement.originalMaterial
    const hm = highlightedElement.highlightMaterial
    if (Array.isArray(hm)) hm.forEach((m) => disposeMaterial(m))
    else if (hm) disposeMaterial(hm)
  }

  highlightedElement = null
}

/** 作用：清空当前点选（同时撤销高亮）。 */
function clearPickedElement() {
  restoreHighlightedElement()
  pickedElement.value = null
  requestRender()
}

/** 作用：对普通 Mesh 以 overlay 方式做高亮（避免材质 clone/循环引用问题）。 */
function highlightMesh(mesh: any, color: any) {
  if (!mesh?.isMesh) return

  const mat = createHighlightOverlayMaterial(color)
  const overlay = new THREE.Mesh(mesh.geometry, mat)
  overlay.name = 'Pick Highlight Overlay'
  overlay.userData = overlay.userData ?? {}
  overlay.userData.__viewerPickIgnore = true
  overlay.frustumCulled = false
  overlay.matrixAutoUpdate = false
  overlay.renderOrder = 9998
  overlay.matrix.identity()
  overlay.matrixWorldNeedsUpdate = true
  mesh.add(overlay)
  highlightedElement = { kind: 'meshOverlay', mesh, overlay, material: mat }
}

/** 作用：创建用于高亮 overlay 的材质（TSL 模式下确保可见）。 */
function createHighlightOverlayMaterial(color: any) {
  const mat: any =
    materialMode.value === 'lambert'
      ? new MeshLambertNodeMaterial()
      : new MeshBasicNodeMaterial()
  mat.name = 'Pick Highlight'
  mat.transparent = true
  mat.opacity = 0.65
  mat.depthTest = false
  mat.depthWrite = false
  mat.polygonOffset = true
  mat.polygonOffsetFactor = -1
  mat.polygonOffsetUnits = -1
  mat.toneMapped = false

  if ('colorNode' in mat) {
    mat.colorNode = tslColor(color)
    mat.vertexColors = false
    mat.needsUpdate = true
  } else if (mat.color) {
    mat.color.copy?.(color)
  }

  return mat
}

/** 作用：同步 batched overlay 的矩阵到对应 instance 的世界变换。 */
function updateHighlightedOverlayTransform() {
  if (!highlightedElement || highlightedElement.kind !== 'batchedOverlay')
    return
  const batched = highlightedElement.batched
  const batchId = highlightedElement.batchId
  const overlay = highlightedElement.overlay

  const world = new THREE.Matrix4()
  batched.getMatrixAt?.(batchId, world)
  world.premultiply(batched.matrixWorld)
  overlay.matrix.copy(world)
  overlay.matrixWorld.copy(world)
  overlay.matrixWorldNeedsUpdate = false
}

/** 作用：对 BatchedMesh 的单个 instance 做高亮（TSL 用 overlay，original 用 per-instance tint）。 */
function highlightBatched(mesh: any, batchId: number, color: any) {
  if (!mesh?.isBatchedMesh) return

  // WebGPU + NodeMaterial does not reliably show BatchedMesh per-instance colors across all modes.
  // Use an overlay mesh in TSL modes, keep the lightweight per-instance tint for "original".
  if (materialMode.value !== 'original') {
    const instanceInfo = mesh?._instanceInfo?.[batchId]
    const geometryId = instanceInfo?.geometryIndex
    const geometryInfo =
      geometryId !== undefined ? mesh?._geometryInfo?.[geometryId] : null
    if (!geometryInfo) return

    const overlayGeom = new THREE.BufferGeometry()
    overlayGeom.index = mesh.geometry.index
    overlayGeom.attributes = mesh.geometry.attributes
    overlayGeom.setDrawRange(
      geometryInfo.start ?? 0,
      geometryInfo.count ?? Infinity,
    )

    const mat = createHighlightOverlayMaterial(color)
    const overlay = new THREE.Mesh(overlayGeom, mat)
    overlay.userData = overlay.userData ?? {}
    overlay.userData.__viewerPickIgnore = true
    overlay.frustumCulled = false
    overlay.matrixAutoUpdate = false
    overlay.renderOrder = 9998

    highlightedElement = {
      kind: 'batchedOverlay',
      batched: mesh,
      batchId,
      overlay,
      material: mat,
    }
    updateHighlightedOverlayTransform()
    scene?.add?.(overlay)
    return
  }

  const prev = new THREE.Color(1, 1, 1)
  // BatchedMesh lazily creates _colorsTexture on first setColorAt. If it doesn't exist yet,
  // the "previous" color is effectively white.
  if (mesh._colorsTexture !== null && typeof mesh.getColorAt === 'function') {
    mesh.getColorAt(batchId, prev)
  }
  mesh.setColorAt?.(batchId, color)
  highlightedElement = { kind: 'batched', mesh, batchId, prevColor: prev }
}

/** 作用：粗略估算几何体占用的字节数（用于日志/性能判断）。 */
function estimateGeometryBytes(geometry: any) {
  let bytes = 0
  const index = geometry?.index
  if (index?.array?.byteLength) bytes += index.array.byteLength
  const attrs = geometry?.attributes ?? {}
  for (const a of Object.values(attrs) as any[]) {
    const array = a?.isInterleavedBufferAttribute ? a.data?.array : a?.array
    if (array?.byteLength) bytes += array.byteLength
  }
  return bytes
}

/** 作用：修复 BufferGeometry 的顶点属性对齐，避免 WebGPU 对某些 stride 的报错/渲染异常。 */
function ensureWebGPUVertexAlignment(geometry: any) {
  if (!geometry?.attributes) return 0

  let fixed = 0
  for (const [name, attr] of Object.entries(geometry.attributes)) {
    const a = attr as any
    if (!a) continue
    if (a.isInterleavedBufferAttribute) continue

    const array = a.array
    const bytesPerElement = array?.BYTES_PER_ELEMENT ?? 0
    const itemSize = a.itemSize ?? 0
    const stride = bytesPerElement * itemSize

    if (!bytesPerElement || !itemSize || stride % 4 === 0) continue
    if (itemSize > 4) continue

    const count = a.count ?? 0
    const paddedSize = 4
    const paddedArray = new array.constructor(count * paddedSize)

    for (let i = 0; i < count; i++) {
      const srcIndex = i * itemSize
      const dstIndex = i * paddedSize
      for (let c = 0; c < itemSize; c++)
        paddedArray[dstIndex + c] = array[srcIndex + c]
      if (name === 'color' && bytesPerElement === 1 && a.normalized)
        paddedArray[dstIndex + 3] = 255
      else paddedArray[dstIndex + 3] = 1
    }

    const interleaved = new THREE.InterleavedBuffer(paddedArray, paddedSize)
    interleaved.usage = a.usage ?? THREE.StaticDrawUsage

    const newAttr = new THREE.InterleavedBufferAttribute(
      interleaved,
      itemSize,
      0,
      a.normalized,
    )
    ;(newAttr as any).gpuType = a.gpuType
    geometry.setAttribute(name, newAttr)
    fixed++
  }

  return fixed
}

/** 作用：遍历对象树并做 WebGPU 兼容性清理（属性对齐、超大几何体保护性隐藏）。 */
function sanitizeObjectForWebGPU(root: any) {
  let fixedAttributes = 0
  let oversizedGeometries = 0

  const maxBufferBytes = 256 * 1024 * 1024
  const softLimit = maxBufferBytes - 8 * 1024 * 1024

  root.traverse((obj: any) => {
    const geom = obj?.geometry
    if (!geom?.isBufferGeometry) return

    fixedAttributes += ensureWebGPUVertexAlignment(geom)

    const bytes = estimateGeometryBytes(geom)
    if (bytes > softLimit) {
      oversizedGeometries++
      obj.visible = false
    }
  })

  return { fixedAttributes, oversizedGeometries }
}

/** 作用：更新“是否已加载模型/tileset”的派生标记。 */
function updateLoadedFlags() {
  hasTileset.value = loadedTilesets.length > 0
  hasGltf.value = loadedRoots.length > 0
  hasModel.value = (contentGroup?.children?.length ?? 0) > 0
  if (
    (!hasModel.value || !canUseJointClipping() || !canEnableClipping.value) &&
    enableClipping.value
  ) {
    enableClipping.value = false
    applyClippingState()
  }
}

/** 作用：根据当前 loadedRoots/loadedTilesets 重新生成左侧“已加载列表”。 */
function rebuildLoadedItems() {
  const items: Array<{
    id: string
    label: string
    obj: any
    kind: 'gltf' | 'tileset'
  }> = []

  for (const root of loadedRoots) {
    const id = root?.userData?.__viewerItemId
    const label = root?.userData?.__viewerLabel ?? `glTF ${id ?? ''}`.trim()
    if (id) items.push({ id: String(id), label, obj: root, kind: 'gltf' })
  }

  for (const entry of loadedTilesets) {
    const wrapper = entry?.wrapper
    const id = wrapper?.userData?.__viewerItemId
    const label =
      wrapper?.userData?.__viewerLabel ?? `Tileset ${id ?? ''}`.trim()
    if (id) items.push({ id: String(id), label, obj: wrapper, kind: 'tileset' })
  }

  for (const item of items) {
    ensureInitialTransformState(item.obj)
  }

  loadedItems.value = items

  if (!items.some((i) => i.id === selectedItemId.value)) {
    selectedItemId.value = items[0]?.id ?? ''
  }
  if (!canUseJointClipping()) {
    clearJointClipState()
  }
  if (
    activeClipTargetId &&
    !isJointClipTargetId(activeClipTargetId) &&
    !items.some((i) => i.id === activeClipTargetId)
  ) {
    activeClipTargetId = ''
  }
  if (isJointClipTargetId(activeClipTargetId) && !canUseJointClipping()) {
    activeClipTargetId = ''
  }
  if (!activeClipTargetId) {
    activeClipTargetId = resolveClipTargetId()
  }
  resetOrientationFix()
  resetPositionFix()
  const item = items.find((i) => i.id === selectedItemId.value)
  if (item?.obj?.quaternion) {
    if (!item.obj.userData) item.obj.userData = {}
    item.obj.userData.__orientationBaseQuat = item.obj.quaternion.clone()
  }
  if (item?.obj?.position) {
    if (!item.obj.userData) item.obj.userData = {}
    item.obj.userData.__positionBaseVec3 = item.obj.position.clone()
  }
}

/** 作用：根据 editMode/selectedItemId 将 TransformControls 绑定或解绑到当前对象。 */
function applyTransformSelection() {
  if (!transformControls) return

  if (!editMode.value || !selectedItemId.value) {
    transformControls.detach()
    if (transformHelper) transformHelper.visible = false
    requestRender()
    return
  }

  const item = loadedItems.value.find((i) => i.id === selectedItemId.value)
  if (!item) {
    transformControls.detach()
    if (transformHelper) transformHelper.visible = false
    requestRender()
    return
  }

  // 若对应场景对象已被隐藏，则不显示操作手柄
  if (!item.obj.visible) {
    transformControls.detach()
    if (transformHelper) transformHelper.visible = false
    requestRender()
    return
  }

  // Some dynamically-managed groups (e.g. 3D Tiles) may toggle matrix updates internally.
  // Ensure we can render and manipulate the transform gizmo reliably.
  item.obj.matrixAutoUpdate = true
  item.obj.updateMatrixWorld?.(true)
  ensureInitialTransformState(item.obj)

  syncTransformModeForSelection()

  transformControls.setSpace?.(transformSpace.value)
  transformControls.setMode(transformMode.value)

  if (item.kind === 'tileset') {
    transformControls.showX = false
    transformControls.showY = false
    transformControls.showZ = false
    transformControls.detach()
    if (transformHelper) transformHelper.visible = false
    resetOrientationFix()
    ensureOrientationBase(item.obj)
    resetPositionFix()
    ensurePositionBase(item.obj)
    requestRender()
    return
  }

  if (transformMode.value === 'rotate') {
    transformControls.showX = false
    transformControls.showY = true
    transformControls.showZ = false
  } else {
    transformControls.showX = true
    transformControls.showY = true
    transformControls.showZ = true
  }

  transformControls.attach(item.obj)
  if (transformHelper) transformHelper.visible = true
  transformHelper?.updateMatrixWorld?.(true)
  resetOrientationFix()
  ensureOrientationBase(item.obj)
  resetPositionFix()
  ensurePositionBase(item.obj)
  requestRender()
}

/** 作用：移除并释放所有包围盒辅助线。 */
function clearBoundsHelpers() {
  if (!scene) return
  for (const h of boundHelpers) {
    scene.remove(h)
    h.traverse?.((child: any) => {
      child.geometry?.dispose?.()
      if (Array.isArray(child.material))
        child.material.forEach((m: any) => m?.dispose?.())
      else child.material?.dispose?.()
    })
    h.geometry?.dispose?.()
    if (Array.isArray(h.material))
      h.material.forEach((m: any) => m?.dispose?.())
    else h.material?.dispose?.()
  }
  boundHelpers.length = 0
  boundHelperEntries.length = 0
  clipHandlePickers.length = 0
  clipHandlesGroup = null
}

function updateGridPlacement() {
  if (!gridHelper || !contentGroup) return

  const pointcloudTarget = loadedTilesets[0]?.wrapper
  const placementTarget =
    pointcloudTarget ?? (contentGroup.children?.length ? contentGroup : null)

  if (!placementTarget) {
    gridHelper.position.set(0, -10.01, 0)
    return
  }

  placementTarget.updateMatrixWorld?.(true)
  const box = new THREE.Box3().setFromObject(placementTarget)
  if (box.isEmpty()) {
    gridHelper.position.set(0, -10.01, 0)
    return
  }

  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const offset = Math.max(10.5, size.y * 0.01)
  gridHelper.position.set(center.x, box.min.y - offset, center.z)
}

function buildClipHandles(box: THREE.Box3, itemId: string) {
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
    axis: 'x' | 'y' | 'z'
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
      face.axis === clipAxis.value && face.invert === clipInvert.value
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
      itemId,
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

/** 作用：根据裁切框开关更新全局包围盒辅助线及拖拽手柄。 */
function updateBoundsHelpers() {
  if (!scene || !contentGroup) return
  updateGridPlacement()
  clearBoundsHelpers()
  if (!showBounds.value) return

  const activeId = resolveClipTargetId(activeClipTargetId)
  if (enableClipping.value && isJointClipTargetId(activeId)) {
    const helperBox = getCurrentClipBox(activeId)
    if (helperBox && !helperBox.isEmpty()) {
      const helper = new THREE.Box3Helper(
        helperBox.clone(),
        new THREE.Color('#ffcf4a'),
      )
      helper.renderOrder = 9999
      ;(helper.material as any).depthTest = false
      helper.userData = helper.userData ?? {}
      helper.userData.__viewerBoundsHelper = true
      helper.userData.__viewerItemId = activeId
      boundHelpers.push(helper)
      boundHelperEntries.push({
        itemId: activeId,
        target: contentGroup,
        boxHelper: helper,
        box: helperBox.clone(),
      })
      scene.add(helper)

      clipHandlesGroup = buildClipHandles(helperBox, activeId)
      boundHelpers.push(clipHandlesGroup)
      scene.add(clipHandlesGroup)
    }
    requestRender()
    return
  }

  const addHelperFor = (obj: any) => {
    const itemId = String(obj?.userData?.__viewerItemId ?? '')
    const helperBox =
      enableClipping.value && itemId === activeId
        ? getCurrentClipBox(itemId)
        : getObjectWorldBox(obj)
    if (!helperBox || helperBox.isEmpty()) return
    const helperColor =
      itemId && itemId === activeId
        ? new THREE.Color('#ffcf4a')
        : new THREE.Color('#7ed2ff')
    const helper = new THREE.Box3Helper(helperBox.clone(), helperColor)
    helper.renderOrder = 9999
    ;(helper.material as any).depthTest = false
    helper.userData = helper.userData ?? {}
    helper.userData.__viewerBoundsHelper = true
    helper.userData.__viewerItemId = itemId
    boundHelpers.push(helper)
    if (itemId) {
      boundHelperEntries.push({
        itemId,
        target: obj,
        boxHelper: helper,
        box: helperBox.clone(),
      })
    }
    scene.add(helper)
  }

  for (const root of loadedRoots) addHelperFor(root)
  for (const entry of loadedTilesets) addHelperFor(entry.wrapper)

  if (enableClipping.value && activeId) {
    const activeEntry = boundHelperEntries.find(
      (entry) => entry.itemId === activeId,
    )
    if (activeEntry) {
      clipHandlesGroup = buildClipHandles(activeEntry.box, activeId)
      boundHelpers.push(clipHandlesGroup)
      scene.add(clipHandlesGroup)
    }
  }
  requestRender()
}

/** 作用：清空当前场景中的所有加载内容、索引与交互状态（不销毁 renderer/camera）。 */
function clearScene() {
  if (!scene || !contentGroup) return

  clearPickedElement()
  restoreHighlightedElement()
  clearElementIndex()
  clearBoundsHelpers()
  updateGridPlacement()
  invalidateClipBounds()
  transformControls?.detach?.()
  if (transformHelper) transformHelper.visible = false

  for (const entry of loadedTilesets) {
    const host = removeClipHostForObject(entry.wrapper)
    removeClipStateForObject(entry.wrapper)
    contentGroup.remove(host ?? entry.wrapper)
    entry.tr.dispose?.()
  }
  loadedTilesets.length = 0

  clearWireframeOverlays()
  for (const root of loadedRoots) {
    const host = removeClipHostForObject(root)
    removeClipStateForObject(root)
    contentGroup.remove(host ?? root)
    disposeObject(root)
  }
  loadedRoots.length = 0
  activeClipTargetId = ''

  for (const url of loadedObjectUrls) URL.revokeObjectURL(url)
  loadedObjectUrls.length = 0

  updateLoadedFlags()
  rebuildLoadedItems()
  enableClipping.value = false
  updateClipRangeFromContent({ resetPosition: true })
  applyClippingState()

  // 清理均匀化网格（实体 + 线框）
  if (remeshWireGroup) {
    ;[remeshWireGroup.solid, remeshWireGroup.wire].forEach((obj) => {
      if (!obj) return
      obj.parent?.remove(obj)
      obj.geometry?.dispose?.()
      ;(Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(
        (m: THREE.Material) => m?.dispose?.(),
      )
    })
    remeshWireGroup = null
    hasRemeshMesh.value = false
    remeshSolidHidden.value = false
    remeshWireHidden.value = false
    remeshWireAvailable.value = true
  }

  requestRender()
}

const refreshAfterPartialClear = () => {
  updateClipRangeFromContent({ preserveT: true })
  applyClippingState()
  requestRender()
}

const handleClearModel = () => {
  if (!hasGltf.value) return
  clearLoadedGltf()
  modelHidden.value = false
  refreshAfterPartialClear()
}

const handleClearPointCloud = () => {
  if (!hasTileset.value) return
  clearLoadedTilesets()
  pointCloudHidden.value = false
  refreshAfterPartialClear()
}

const toggleModelVisibility = () => {
  if (!hasGltf.value) return
  modelHidden.value = !modelHidden.value
  for (const root of loadedRoots) {
    root.visible = !modelHidden.value
  }
  invalidateClipBounds()
  // 隐藏/显示模型时同步更新操作手柄状态
  applyTransformSelection()
  requestRender()
}

const togglePointCloudVisibility = () => {
  if (!hasTileset.value) return
  pointCloudHidden.value = !pointCloudHidden.value
  for (const entry of loadedTilesets) {
    entry.wrapper.visible = !pointCloudHidden.value
  }
  invalidateClipBounds()
  // 隐藏/显示点云时同步更新操作手柄状态
  applyTransformSelection()
  requestRender()
}

let remeshLoading = false

function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const tokenData = getToken()
  if (tokenData?.accessToken) {
    headers['Authorization'] = formatToken(tokenData.accessToken)
  }
  const orgId = getOrganizationId()
  if (orgId) {
    headers['X-Organization-Id'] = String(orgId)
  }
  return headers
}

/** 作用：带认证头获取 PLY 二进制并返回 BlobURL。 */
async function fetchPlyWithAuth(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: buildAuthHeaders(),
    cache: 'no-store',
  })
  if (!resp.ok) throw new Error(`PLY 下载失败 HTTP ${resp.status}`)
  const blob = await resp.blob()
  return URL.createObjectURL(blob)
}

/** 作用：带认证头下载二进制（如 C2M distances.bin）。 */
async function fetchBinaryWithAuth(url: string): Promise<ArrayBuffer> {
  const resp = await fetch(url, {
    headers: buildAuthHeaders(),
    cache: 'no-store',
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.arrayBuffer()
}

/**
 * 作用：加载均匀化网格 PLY，以独立线框组显示，与原始 BIM 线框完全分离。
 * 使用 LineBasicMaterial + WireframeGeometry 方式，与现有线框技术一致，
 * 通过右侧面板专属按钮控制显隐，不影响"线"按钮的原有功能。
 */
async function handleLoadRemesh(url: string) {
  if (!scene) {
    ElMessage.warning('三维场景尚未初始化，请稍后再试')
    return
  }
  if (remeshLoading) return
  remeshLoading = true

  // 清除已有的均匀化网格
  if (remeshWireGroup) {
    ;[remeshWireGroup.solid, remeshWireGroup.wire].forEach((obj) => {
      if (!obj) return
      obj.parent?.remove(obj)
      obj.geometry?.dispose?.()
      ;(Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(
        (m: THREE.Material) => m?.dispose?.(),
      )
    })
    remeshWireGroup = null
  }

  ElMessage({
    message: '正在下载均匀化网格（文件较大，请稍候…）',
    type: 'info',
    duration: 0,
    grouping: true,
  })

  let blobUrl: string | null = null
  try {
    blobUrl = await fetchPlyWithAuth(url)
    ElMessage.closeAll()
    ElMessage({
      message: '解析网格中…',
      type: 'info',
      duration: 0,
      grouping: true,
    })

    const loader = new PLYLoader()
    const geometry = await loader.loadAsync(blobUrl)

    // 补全法线（PLY 不保证有法线，缺少时渲染异常）
    if (!geometry.attributes.normal) {
      geometry.computeVertexNormals()
    }

    // 计算 PLY 顶点包围盒
    geometry.computeBoundingBox()
    const plyBox = geometry.boundingBox!
    const plyCenter = plyBox.getCenter(new THREE.Vector3())

    // ── 坐标归一化，与 GLB 的 createCenteredPivot 策略一致 ──────────────────
    // GLB 加载时将 root.position -= center（重心移到原点），pivot 挂在 scene 根
    // PLY 同理：先将几何体中心移到原点，再通过 mesh.position 对齐到 BIM 所在位置
    //
    // 步骤 1：将 PLY 几何体顶点平移，使其重心在本地原点（与 createCenteredPivot 等效）
    geometry.translate(-plyCenter.x, -plyCenter.y, -plyCenter.z)

    // 步骤 2：从 BIM pivot 提取世界空间的位置 + 旋转，完整应用到 remesh 网格。
    //
    // createCenteredPivot 的结构：
    //   pivot（position=对齐平移 P, rotation=对齐旋转 R）
    //     └─ root（position=-originalCenter，将包围盒中心放到 pivot 本地原点）
    //
    // PLY 经过 geometry.translate(-plyCenter) 后已处于 pivot 本地空间，
    // 必须同时应用 P 和 R 才能与已对齐的 BIM 完全重合；仅设 position 会丢失旋转。
    const targetPos = new THREE.Vector3()
    const targetQuat = new THREE.Quaternion()
    if (loadedRoots.length > 0) {
      const bimPivot = loadedRoots[0]
      bimPivot.getWorldPosition(targetPos)
      bimPivot.getWorldQuaternion(targetQuat)
    }

    // === 实体模型：橙色不透明，开启深度测试避免穿透感 ===
    const solidMat = new THREE.MeshLambertMaterial({
      color: 0xff6600,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: true,
      transparent: false,
    })
    const solidMesh = new THREE.Mesh(geometry, solidMat)
    solidMesh.position.copy(targetPos)
    solidMesh.quaternion.copy(targetQuat)
    scene.add(solidMesh)

    // === 线框：绿色 LineSegments（面片过多时跳过，WireframeGeometry 有内部桶上限） ===
    const faceCount = geometry.index
      ? geometry.index.count / 3
      : geometry.attributes.position.count / 3
    let wireMesh: THREE.LineSegments | null = null
    if (faceCount <= WIREFRAME_MAX_FACES) {
      const wireMat = new THREE.LineBasicMaterial({
        color: '#00ff88',
        depthTest: true,
        transparent: true,
        opacity: 0.9,
      })
      const wireGeom = new THREE.WireframeGeometry(geometry)
      wireMesh = new THREE.LineSegments(wireGeom, wireMat)
      wireMesh.position.copy(targetPos)
      wireMesh.quaternion.copy(targetQuat)
      scene.add(wireMesh)
      remeshWireAvailable.value = true
    } else {
      remeshWireAvailable.value = false
      ElMessage.info(
        `面片数 ${Math.round(faceCount / 10000)}万，已跳过线框（仅显示实体）`,
      )
    }

    remeshWireGroup = { solid: solidMesh, wire: wireMesh }
    remeshSolidHidden.value = false
    remeshWireHidden.value = false
    hasRemeshMesh.value = true
    requestRender()

    ElMessage.closeAll()
    ElMessage.success(
      `均匀化网格已加载（${geometry.attributes.position.count.toLocaleString()} 顶点）`,
    )
  } catch (e: any) {
    console.error('[Remesh] 加载 PLY 失败:', e)
    ElMessage.closeAll()
    ElMessage.error(`加载均匀化网格失败: ${e?.message ?? e}`)
  } finally {
    if (blobUrl) URL.revokeObjectURL(blobUrl)
    remeshLoading = false
  }
}

/** 作用：切换均匀化实体模型的可见性。 */
const toggleRemeshSolid = () => {
  if (!remeshWireGroup?.solid) return
  remeshSolidHidden.value = !remeshSolidHidden.value
  remeshWireGroup.solid.visible = !remeshSolidHidden.value
  requestRender()
}

/** 作用：切换均匀化线框的可见性。 */
const toggleRemeshWire = () => {
  if (!remeshWireGroup?.wire) return
  remeshWireHidden.value = !remeshWireHidden.value
  remeshWireGroup.wire.visible = !remeshWireHidden.value
  requestRender()
}

// ── C2M 赋色网格加载 ──────────────────────────────────────────────────
let c2mMeshObj: THREE.Mesh | null = null
/** 与 mesh 顶点顺序一致的 float32 距离，供面板直方图与动态色温 */
const c2mDistanceArray = shallowRef<Float32Array | null>(null)
const c2mVizMaxColormap = ref(0.1)
const c2mVizToleranceLimit = ref(0.05)

/** 格式化有符号偏差，正值表示 scan 在法线外侧（外凸），负值表示内侧（内缩）。 */
function formatC2mDeviationM(d: number): string {
  const sign = d >= 0 ? '+' : ''
  const a = Math.abs(d)
  if (a < 0.001) return `${sign}${(d * 1000).toFixed(2)} mm`
  if (a < 1) return `${sign}${(d * 100).toFixed(1)} cm`
  return `${sign}${d.toFixed(3)} m`
}

function onC2mVizChange(p: {
  maxDist: number
  histBins: number
  toleranceLimit: number
}) {
  c2mVizMaxColormap.value = p.maxDist
  c2mVizToleranceLimit.value = p.toleranceLimit ?? 0.05
  if (!c2mMeshObj || !c2mDistanceArray.value) return
  const geom = c2mMeshObj.geometry as THREE.BufferGeometry
  applyC2mVertexColors(
    geom,
    c2mDistanceArray.value,
    p.maxDist,
    p.toleranceLimit ?? 0.05,
  )
  requestRender()
}

/** 面板在计算完成或恢复 latest 后拉取 distances.bin，供直方图调试；与是否加载三维解耦 */
function onC2mDistancesBuffer(buf: Float32Array | null) {
  c2mDistanceArray.value = buf
}

function clearC2MScene() {
  if (!scene) return
  if (!c2mMeshObj) {
    ElMessage.info('当前场景中没有已加载的偏差可视化')
    return
  }
  scene.remove(c2mMeshObj)
  c2mMeshObj.geometry?.dispose?.()
  ;(c2mMeshObj.material as THREE.Material)?.dispose?.()
  c2mMeshObj = null
  requestRender()
  ElMessage.success('已清空偏差可视化场景')
}

async function handleLoadC2MPly(payload: C2MLoadPayload) {
  if (!scene) {
    ElMessage.warning('三维场景尚未初始化')
    return
  }

  const cachedDist = c2mDistanceArray.value

  if (c2mMeshObj) {
    scene.remove(c2mMeshObj)
    c2mMeshObj.geometry?.dispose?.()
    ;(c2mMeshObj.material as THREE.Material)?.dispose?.()
    c2mMeshObj = null
  }

  ElMessage({
    message: '正在下载 C2M 赋色网格…',
    type: 'info',
    duration: 0,
    grouping: true,
  })

  let blobUrl: string | null = null
  try {
    blobUrl = await fetchPlyWithAuth(payload.plyUrl)
    ElMessage.closeAll()

    const loader = new PLYLoader()
    const geometry = await loader.loadAsync(blobUrl)

    if (!geometry.attributes.normal) {
      geometry.computeVertexNormals()
    }

    geometry.computeBoundingBox()
    const plyCenter = geometry.boundingBox!.getCenter(new THREE.Vector3())
    geometry.translate(-plyCenter.x, -plyCenter.y, -plyCenter.z)

    const targetPos = new THREE.Vector3()
    const targetQuat = new THREE.Quaternion()
    if (loadedRoots.length > 0) {
      loadedRoots[0].getWorldPosition(targetPos)
      loadedRoots[0].getWorldQuaternion(targetQuat)
    }

    const nVert = geometry.attributes.position.count
    let distArr: Float32Array | null = null
    if (cachedDist && cachedDist.length === nVert) {
      distArr = cachedDist
    } else {
      try {
        const buf = await fetchBinaryWithAuth(payload.distancesUrl)
        if (buf.byteLength === nVert * 4) {
          distArr = new Float32Array(buf.slice(0))
        }
      } catch {
        /* 旧数据无 distances 文件 */
      }
    }

    if (distArr) {
      geometry.setAttribute('distance', new THREE.BufferAttribute(distArr, 1))
      c2mVizMaxColormap.value = payload.maxColormap
      applyC2mVertexColors(
        geometry,
        distArr,
        payload.maxColormap,
        c2mVizToleranceLimit.value,
      )
      c2mDistanceArray.value = distArr
    } else {
      c2mDistanceArray.value = null
    }

    const mat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
    })
    c2mMeshObj = new THREE.Mesh(geometry, mat)
    c2mMeshObj.position.copy(targetPos)
    c2mMeshObj.quaternion.copy(targetQuat)
    scene.add(c2mMeshObj)
    requestRender()

    const distHint = distArr
      ? '（已加载距离数据，可本地调色温）'
      : '（无距离文件时仅使用 PLY 烘焙色）'
    ElMessage.success(
      `C2M 赋色网格已加载（${nVert.toLocaleString()} 顶点）${distHint}`,
    )
  } catch (e: any) {
    ElMessage.closeAll()
    c2mDistanceArray.value = null
    ElMessage.error(`加载 C2M 网格失败: ${e?.message ?? e}`)
  } finally {
    if (blobUrl) URL.revokeObjectURL(blobUrl)
  }
}

/** 作用：清除场景中所有线框叠加层（从 loadedRoots 层级中移除）。 */
const clearWireframeOverlays = () => {
  for (const root of loadedRoots) {
    const toRemove: any[] = []
    root.traverse((obj: any) => {
      if (obj?.userData?.[WIREFRAME_OVERLAY_TAG]) toRemove.push(obj)
    })
    for (const obj of toRemove) {
      obj.parent?.remove(obj)
      obj.geometry?.dispose?.()
      obj.material?.dispose?.()
    }
  }
}

/**
 * 作用：在合批优化前，遍历 root 下所有普通 Mesh，为每个构件预构建 LineSegments 线框叠加层，
 * 并以兄弟节点形式挂到同一父节点。合批移走原始 Mesh 后叠加层仍保留在层级中，
 * 从而避免切换线框时触发重新加载。
 */
function buildWireframeForRoot(root: any) {
  const lineMat = new THREE.LineBasicMaterial({
    color: WIREFRAME_COLOR,
    depthTest: true,
    transparent: true,
    opacity: 0.7,
  })
  root.traverse((obj: any) => {
    if (!obj?.isMesh || obj?.isBatchedMesh) return
    if (obj?.userData?.__viewerPickIgnore) return
    if (!obj.parent) return
    const wireGeom = new THREE.WireframeGeometry(obj.geometry)
    const lines = new THREE.LineSegments(wireGeom, lineMat.clone())
    lines.userData[WIREFRAME_OVERLAY_TAG] = true
    lines.matrixAutoUpdate = false
    lines.matrix.copy(obj.matrix)
    lines.visible = showMeshWireframe.value
    obj.parent.add(lines)
  })
}

/** 作用：线框开关变化时，遍历 loadedRoots 直接切换叠加层可见性，无需重建。 */
const onMeshWireframeChange = () => {
  for (const root of loadedRoots) {
    root.traverse((obj: any) => {
      if (obj?.userData?.[WIREFRAME_OVERLAY_TAG]) {
        obj.visible = showMeshWireframe.value
      }
    })
  }
  requestRender()
}

/** 作用：检测已加载 BIM 中是否存在合批网格。 */
const hasBatchedMeshInRoots = () => {
  for (const root of loadedRoots) {
    let found = false
    root.traverse((obj: any) => {
      if (obj?.isBatchedMesh) found = true
    })
    if (found) return true
  }
  return false
}

/** 作用：切换线框模式。叠加层在加载时已预构建，此处仅切换可见性，无需重新加载。 */
const toggleMeshWireframe = () => {
  if (!hasGltf.value) return
  showMeshWireframe.value = !showMeshWireframe.value
  onMeshWireframeChange()
}

const handleClearAll = () => {
  if (!hasModel.value) return
  clearScene()
}

function vectorToPlainObject(vec: any) {
  return {
    x: Number((vec?.x ?? 0).toFixed(6)),
    y: Number((vec?.y ?? 0).toFixed(6)),
    z: Number((vec?.z ?? 0).toFixed(6)),
  }
}

function quaternionToPlainObject(quat: any) {
  return {
    x: Number((quat?.x ?? 0).toFixed(6)),
    y: Number((quat?.y ?? 0).toFixed(6)),
    z: Number((quat?.z ?? 0).toFixed(6)),
    w: Number((quat?.w ?? 1).toFixed(6)),
  }
}

function logBimRelativeTransform(
  page: string,
  bimMatrixWorld: THREE.Matrix4 | null,
  pointcloudMatrixWorld: THREE.Matrix4 | null,
) {
  if (!bimMatrixWorld || !pointcloudMatrixWorld) return

  const relativeMatrix = new THREE.Matrix4()
    .copy(pointcloudMatrixWorld)
    .invert()
    .multiply(bimMatrixWorld)
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  relativeMatrix.decompose(position, quaternion, new THREE.Vector3())
}

function recordNormalizationOffset(
  target: any,
  center: any,
  kind: 'gltf' | 'tileset',
  label: string,
  mode: 'self' | 'child',
) {
  if (!target || !center) return
  const centerVec = center.clone()
  const appliedTranslation = centerVec.clone().multiplyScalar(-1)

  target.userData = target.userData ?? {}
  target.userData.__viewerNormalizationCenter = centerVec
  target.userData.__viewerNormalizationTranslation = appliedTranslation
  target.userData.__viewerNormalizationKind = kind
  target.userData.__viewerNormalizationLabel = label
  target.userData.__viewerNormalizationMode = mode
}

function getRawMatrixWorldForCalibration(obj: any) {
  const matrix = new THREE.Matrix4().copy(
    obj?.matrixWorld ?? new THREE.Matrix4(),
  )
  const center = obj?.userData?.__viewerNormalizationCenter
  const mode = obj?.userData?.__viewerNormalizationMode
  if (!center) return matrix

  if (mode === 'child') {
    matrix.multiply(
      new THREE.Matrix4().makeTranslation(
        -(center.x ?? 0),
        -(center.y ?? 0),
        -(center.z ?? 0),
      ),
    )
  }

  return matrix
}

function toRigidMatrix(matrix: any) {
  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  matrix.decompose(pos, quat, new THREE.Vector3())
  return new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 1, 1))
}

function getAlignmentRestoreKey() {
  if (!projectId.value || !scanFileId.value || !bimFileId.value) return ''
  return `${projectId.value}:${scanFileId.value}:${bimFileId.value}`
}

function buildAlignmentMatrix(alignment: ModelAlignment) {
  const rawMatrix = new THREE.Matrix4()
  if (
    Array.isArray(alignment.modelMatrix) &&
    alignment.modelMatrix.length === 16
  ) {
    rawMatrix.fromArray(alignment.modelMatrix)
    return toRigidMatrix(rawMatrix)
  }
  rawMatrix.compose(
    new THREE.Vector3(
      alignment.modelTranslationX,
      alignment.modelTranslationY,
      alignment.modelTranslationZ,
    ),
    new THREE.Quaternion(
      alignment.modelRotationQx,
      alignment.modelRotationQy,
      alignment.modelRotationQz,
      alignment.modelRotationQw,
    ),
    new THREE.Vector3(1, 1, 1),
  )
  return toRigidMatrix(rawMatrix)
}

function syncObjectTransformState(obj: any) {
  if (!obj?.userData) obj.userData = {}
  if (obj?.quaternion) {
    obj.userData.__orientationBaseQuat = obj.quaternion.clone()
    obj.userData.__initialOrientationQuat = obj.quaternion.clone()
  }
  if (obj?.position) {
    obj.userData.__positionBaseVec3 = obj.position.clone()
    obj.userData.__initialPositionVec3 = obj.position.clone()
  }
}

function syncRestoredEditState(selectedId: string) {
  const item = loadedItems.value.find((entry) => entry.id === selectedId)
  if (item?.obj?.userData) {
    const initialQuat = ensureInitialOrientation(item.obj)
    const initialPos = ensureInitialPosition(item.obj)
    if (initialQuat)
      item.obj.userData.__orientationBaseQuat = initialQuat.clone()
    if (initialPos) item.obj.userData.__positionBaseVec3 = initialPos.clone()
  }
  registrationStage.value = 'coarse'
  editMode.value = true
  transformMode.value = 'translate'
  selectedItemId.value = selectedId
  refreshSelectedTransformUi(false)
  void nextTick(() => {
    applyTransformSelection()
    syncAllTransformFixValuesFromSelected()
    requestRender()
  })
}

function tryRestoreSavedBimAlignment(force = false, syncEditState = true) {
  const alignment = pendingAlignmentRestore.value
  const restoreKey = getAlignmentRestoreKey()
  if (!alignment || !restoreKey) {
    return false
  }
  if (!force && restoredAlignmentKey.value === restoreKey) {
    return false
  }

  const tilesetEntry = loadedTilesets[0]
  const pointcloudWrapper = tilesetEntry?.wrapper
  const pointcloudGroup = tilesetEntry?.tr?.group
  const bimItem = loadedItems.value.find((i) => i.kind === 'gltf')
  const bimPivot = bimItem?.obj
  if (!pointcloudWrapper || !pointcloudGroup || !bimPivot) return false
  if (!tilesetEntry?.rootReady) return false

  const alignmentMatrix = buildAlignmentMatrix(alignment)
  const bimCenter = bimPivot?.userData?.__viewerNormalizationCenter
  if (!bimCenter) return false

  contentGroup?.updateMatrixWorld?.(true)
  pointcloudWrapper.updateMatrixWorld?.(true)
  pointcloudGroup.updateMatrixWorld?.(true)
  bimPivot.updateMatrixWorld?.(true)
  const pointcloudRawMatrixWorld =
    getRawMatrixWorldForCalibration(pointcloudGroup)
  const desiredBimWorld = new THREE.Matrix4()
    .copy(pointcloudRawMatrixWorld)
    .multiply(alignmentMatrix.clone().invert())
    .multiply(
      new THREE.Matrix4().makeTranslation(
        bimCenter.x ?? 0,
        bimCenter.y ?? 0,
        bimCenter.z ?? 0,
      ),
    )

  bimPivot.parent?.updateMatrixWorld?.(true)
  const parentInverse = new THREE.Matrix4()
    .copy(bimPivot.parent?.matrixWorld ?? new THREE.Matrix4())
    .invert()
  const localMatrix = new THREE.Matrix4().multiplyMatrices(
    parentInverse,
    desiredBimWorld,
  )

  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  localMatrix.decompose(pos, quat, scale)
  bimPivot.position.copy(pos)
  bimPivot.quaternion.copy(quat)
  bimPivot.scale.set(1, 1, 1)
  bimPivot.updateMatrixWorld?.(true)
  recenterLoadedContentAsWhole()

  restoredAlignmentKey.value = restoreKey
  pendingAlignmentRestore.value = null

  if (syncEditState && bimItem?.id) {
    syncRestoredEditState(bimItem.id)
  }

  logBimRelativeTransform(
    'BimPointcloudAlign',
    getRawMatrixWorldForCalibration(bimPivot),
    getRawMatrixWorldForCalibration(pointcloudGroup),
  )

  updateBoundsHelpers()
  updateClipRangeFromContent({ preserveT: true })
  applyClippingState()
  requestRender()
  return true
}

async function fetchAndRestoreBimAlignment() {
  const restoreKey = getAlignmentRestoreKey()
  if (!restoreKey || restoredAlignmentKey.value === restoreKey) return

  try {
    const res = await getBimAlignment(
      projectId.value,
      scanFileId.value,
      bimFileId.value,
    )
    if (!res?.data) return
    latestAlignmentResult.value = res.data
    hasSavedAlignmentMatrix.value = true
    coarseAlignmentDirty.value = false
    pendingAlignmentRestore.value = res.data
    tryRestoreSavedBimAlignment()
  } catch (error: any) {
    const status = error?.response?.status
    if (status === 400 || status === 404) {
      pendingAlignmentRestore.value = null
      hasSavedAlignmentMatrix.value = false
      coarseAlignmentDirty.value = false
      return
    }
    console.error('[BimPointcloudAlign] 获取后端校准参数失败:', error)
  }
}

function createCenteredPivot(root: any, label: string) {
  const box = new THREE.Box3().setFromObject(root)
  const center = box.getCenter(new THREE.Vector3())

  const pivot = new THREE.Group()
  pivot.userData = pivot.userData ?? {}
  pivot.userData.__viewerItemId = String(nextItemId++)
  pivot.userData.__viewerLabel = label

  root.position.sub(center)
  recordNormalizationOffset(pivot, center, 'gltf', label, 'child')
  pivot.add(root)
  pivot.updateMatrixWorld?.(true)

  return pivot
}

/** 作用：根据对象包围盒设置相机/控制器视角。 */
function fitCameraToObject(object: any) {
  if (!camera || !controls) return

  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())

  const maxDim = Math.max(size.x, size.y, size.z) || 1
  controls.target.set(0, 0, 0)
  if (camera?.isOrthographicCamera) {
    orthoViewSize = maxDim * 0.5 * 1.2
    camera.zoom = 1
    updateOrthographicFrustum()
    camera.position.set(0, maxDim * 0.15, maxDim * 2.2)
    camera.near = Math.max(0.01, maxDim / 100)
    camera.far = maxDim * 200
    camera.updateProjectionMatrix()
  } else {
    const fov = THREE.MathUtils.degToRad(camera.fov)
    const distance = maxDim / 2 / Math.tan(fov / 2)
    camera.position.set(0, maxDim * 0.15, distance * 2.2)
    camera.near = distance / 100
    camera.far = distance * 100
    camera.updateProjectionMatrix()
  }
  controls.update()
}

/** 作用：判断一个 Mesh 是否适合参与 BatchedMesh 合批（排除蒙皮/实例化/形变等）。 */
function isOptimizableMesh(mesh: any) {
  if (!mesh?.isMesh) return false
  if (mesh?.isSkinnedMesh) return false
  if (mesh?.isInstancedMesh) return false
  if (!mesh?.geometry?.isBufferGeometry) return false
  if (!mesh?.geometry?.attributes?.position) return false
  if (Array.isArray(mesh.material)) return false
  if (
    mesh.geometry?.morphAttributes &&
    Object.keys(mesh.geometry.morphAttributes).length > 0
  )
    return false
  if (mesh.morphTargetInfluences && mesh.morphTargetInfluences.length > 0)
    return false
  if (mesh.skeleton) return false
  return true
}

/** 作用：生成几何体“属性布局签名”，用于合批时分组（避免不兼容布局混合）。 */
function geometrySignature(geometry: any) {
  const index = geometry.index
    ? `i:${geometry.index.array?.constructor?.name ?? 'idx'}`
    : 'i:none'
  const attrs = Object.keys(geometry.attributes ?? {})
    .sort()
    .map((name) => {
      const a = geometry.attributes[name]
      return `${name}:${a?.itemSize ?? 0}:${a?.normalized ? 1 : 0}:${a?.array?.constructor?.name ?? 'arr'}:${a?.gpuType ?? ''}`
    })
    .join('|')
  return `${index}|${attrs}`
}

/** 作用：翻转几何体绕序并反转法线（用于修复镜像缩放导致的背面/光照问题）。 */
function flipWindingAndNormals(geometry: any) {
  const index = geometry.getIndex?.()
  if (index?.array) {
    const arr = index.array
    for (let i = 0; i < arr.length; i += 3) {
      const tmp = arr[i + 1]
      arr[i + 1] = arr[i + 2]
      arr[i + 2] = tmp
    }
    index.needsUpdate = true
  }

  const normal = geometry.attributes?.normal
  if (normal?.array) {
    const na = normal.array
    for (let i = 0; i < na.length; i++) na[i] = -na[i]
    normal.needsUpdate = true
  }
}

/** 作用：返回数值的符号（仅 -1 或 1）。 */
function sign(v: number) {
  return v < 0 ? -1 : 1
}

/** 作用：把原材质上影响透明/双面的通用标志同步到替换材质上。 */
function applySharedMaterialFlags(mat: any, src: any) {
  const alphaTest = src?.alphaTest ?? 0
  const opacity = src?.opacity ?? 1
  mat.alphaTest = alphaTest
  mat.opacity = opacity
  mat.transparent = alphaTest > 0 ? false : !!src?.transparent || opacity < 1
  mat.side = src?.side ?? THREE.FrontSide
}

function getOrCreatePointsTSLMaterial(
  src: any,
  opts: { vertexColors: boolean },
) {
  const entry = pointsMaterialCache.get(src) ?? {}
  const cached = opts.vertexColors ? entry.v1 : entry.v0
  if (cached) return cached

  const mat = new PointsNodeMaterial()
  mat.name = src?.name ? `${src.name} (TSL Points)` : 'TSL Points'
  mat.fog = false
  mat.lights = false
  mat.toneMapped = false

  applySharedMaterialFlags(mat, src)
  mat.vertexColors = opts.vertexColors
  mat.color = src?.color?.clone?.() ?? new THREE.Color(0xffffff)
  mat.colorNode = opts.vertexColors
    ? tslVertexColor()
    : tslColor(src?.color ?? 0xffffff)
  const pointMat = mat as any
  pointMat.size = src?.size ?? 1
  pointMat.sizeAttenuation = src?.sizeAttenuation ?? true
  pointMat.map = src?.map ?? null
  pointMat.alphaMap = src?.alphaMap ?? null
  pointMat.depthTest = src?.depthTest ?? true
  pointMat.depthWrite = src?.depthWrite ?? false

  originalMaterialByTSL.set(mat, src)
  ;(mat as any).__viewerOriginalMaterial = src
  if (opts.vertexColors) entry.v1 = mat
  else entry.v0 = mat
  pointsMaterialCache.set(src, entry)

  return mat
}

/** 作用：获取或创建与源材质对应的 TSL Unlit 材质（按 vertexColors 分缓存）。 */
function getOrCreateUnlitTSLMaterial(
  src: any,
  opts: { vertexColors: boolean },
) {
  const entry = unlitMaterialCache.get(src) ?? {}
  const cached = opts.vertexColors ? entry.v1 : entry.v0
  if (cached) return cached

  const mat = new NodeMaterial()
  mat.name = src?.name ? `${src.name} (TSL Unlit)` : 'TSL Unlit'
  mat.fog = false
  mat.lights = false

  applySharedMaterialFlags(mat, src)
  mat.toneMapped = false

  mat.colorNode = opts.vertexColors
    ? tslVertexColor()
    : tslColor(src?.color ?? 0xffffff)
  mat.vertexColors = opts.vertexColors

  originalMaterialByTSL.set(mat, src)
  ;(mat as any).__viewerOriginalMaterial = src
  if (opts.vertexColors) entry.v1 = mat
  else entry.v0 = mat
  unlitMaterialCache.set(src, entry)

  return mat
}

/** 作用：获取或创建与源材质对应的 TSL Lambert 材质（按 vertexColors 分缓存）。 */
function getOrCreateLambertTSLMaterial(
  src: any,
  opts: { vertexColors: boolean },
) {
  const entry = lambertMaterialCache.get(src) ?? {}
  const cached = opts.vertexColors ? entry.v1 : entry.v0
  if (cached) return cached

  const mat = new MeshLambertNodeMaterial()
  mat.name = src?.name ? `${src.name} (TSL Lambert)` : 'TSL Lambert'
  mat.fog = false

  applySharedMaterialFlags(mat, src)
  mat.toneMapped = true

  mat.color = src?.color ? src.color.clone() : new THREE.Color(0xffffff)
  mat.vertexColors = opts.vertexColors

  originalMaterialByTSL.set(mat, src)
  ;(mat as any).__viewerOriginalMaterial = src
  if (opts.vertexColors) entry.v1 = mat
  else entry.v0 = mat
  lambertMaterialCache.set(src, entry)

  return mat
}

/** 作用：在整个 root 上切换材质模式（original / unlit / lambert），并返回替换数量。 */
function applyMaterialMode(root: any, mode: 'original' | 'unlit' | 'lambert') {
  let changed = 0

  root.traverse((obj: any) => {
    if (!obj?.material) return
    if (Array.isArray(obj.material)) return

    if (obj?.isPoints) {
      const src =
        (obj.material as any)?.__viewerOriginalMaterial ??
        originalMaterialByTSL.get(obj.material) ??
        obj.material.userData?.__originalMaterial
      const next = getOrCreatePointsTSLMaterial(src ?? obj.material, {
        vertexColors: !!obj.geometry?.attributes?.color,
      })
      if (obj.material !== next) {
        obj.material = next
        changed++
      }
      return
    }

    if (mode === 'original') {
      const original =
        (obj.material as any)?.__viewerOriginalMaterial ??
        originalMaterialByTSL.get(obj.material) ??
        obj.material.userData?.__originalMaterial
      if (original && obj.material !== original) {
        obj.material = original
        changed++
      }
      return
    }

    const src =
      (obj.material as any)?.__viewerOriginalMaterial ??
      originalMaterialByTSL.get(obj.material) ??
      obj.material.userData?.__originalMaterial ??
      obj.material
    const opts = { vertexColors: !!obj.geometry?.attributes?.color }
    const next =
      mode === 'lambert'
        ? getOrCreateLambertTSLMaterial(src, opts)
        : getOrCreateUnlitTSLMaterial(src, opts)

    if (obj.material !== next) {
      obj.material = next
      changed++
    }
  })

  return changed
}

/** 作用：对 glTF root 做合批优化，并在 BatchedMesh 上保留 elementId 元数据用于点选/显隐。 */
function optimizeRoot(root: any) {
  /**
   * 作用：对 GLB 做一次“同材质 + 同属性布局”的 Mesh 合批（降低 drawcall，提高交互性能）。
   *
   * 为什么：
   * - IFC → GLB 通常会产生大量构件 mesh，drawcall 很多
   * - WebGPU 在大量 drawcall 下也会吃紧
   *
   * 怎么做：
   * - 遍历 root 下的 Mesh，按 `material.uuid + geometrySignature` 分组
   * - 对每组构建 `THREE.BatchedMesh`，把每个原始 mesh 作为一个 instance
   * - 在 `batched.userData.__viewerBatchMeta[instanceId]` 里保存 elementId/label/ifcId
   *
   * 注意：
   * - 合批后“构件级”操作（显隐/高亮）必须走 batchId(instanceId)
   * - 多材质 mesh、蒙皮、morph 等复杂网格会跳过
   */
  root.updateMatrixWorld(true)
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert()

  const candidates: any[] = []
  let skippedMultiMaterial = 0
  let preBatchTransparentMeshCount = 0
  let skippedOther = 0
  root.traverse((obj: any) => {
    if (!obj?.isMesh) return
    if (Array.isArray(obj.material)) {
      skippedMultiMaterial++
      return
    }
    if (obj.material?.transparent) preBatchTransparentMeshCount++
    if (isOptimizableMesh(obj)) candidates.push(obj)
    else skippedOther++
  })

  const removed = new Set<any>()

  // BatchedMesh: same material reference + compatible attributes
  const batchGroups = new Map<string, any[]>()
  for (const mesh of candidates) {
    if (removed.has(mesh)) continue
    const material = mesh.material
    const geometry = mesh.geometry
    const key = `${material.uuid}|${geometrySignature(geometry)}`
    const list = batchGroups.get(key)
    if (list) list.push(mesh)
    else batchGroups.set(key, [mesh])
  }

  let batchedCount = 0
  let totalBatchedInstances = 0
  for (const meshes of batchGroups.values()) {
    if (meshes.length < 2) continue

    const material = meshes[0].material
    const geometriesByKey = new Map<
      string,
      { geometry: any; meshes: any[]; signKey: string }
    >()
    const tmpMat = new THREE.Matrix4()
    const tmpPos = new THREE.Vector3()
    const tmpQuat = new THREE.Quaternion()
    const tmpScale = new THREE.Vector3()
    for (const mesh of meshes) {
      tmpMat.multiplyMatrices(rootInverse, mesh.matrixWorld)
      tmpMat.decompose(tmpPos, tmpQuat, tmpScale)
      const sx = sign(tmpScale.x)
      const sy = sign(tmpScale.y)
      const sz = sign(tmpScale.z)
      const signKey = `${sx},${sy},${sz}`
      const key = `${mesh.geometry.uuid}|${signKey}`
      const existing = geometriesByKey.get(key)
      if (existing) existing.meshes.push(mesh)
      else
        geometriesByKey.set(key, {
          geometry: mesh.geometry,
          meshes: [mesh],
          signKey,
        })
    }

    let maxVertexCount = 0
    let maxIndexCount = 0
    const hasIndex = meshes[0].geometry.getIndex?.() !== null
    for (const { geometry } of geometriesByKey.values()) {
      maxVertexCount += geometry.getAttribute('position').count
      if (hasIndex) maxIndexCount += geometry.getIndex().count
    }

    const batched = new THREE.BatchedMesh(
      meshes.length,
      maxVertexCount,
      maxIndexCount,
      material,
    )
    batched.frustumCulled = true
    batched.perObjectFrustumCulled = true
    const alphaTest = material.alphaTest ?? 0
    const opacity = material.opacity ?? 1
    batched.sortObjects =
      !!material.transparent && alphaTest === 0 && opacity < 1
    batched.castShadow = meshes.some((m) => !!m.castShadow)
    batched.receiveShadow = meshes.some((m) => !!m.receiveShadow)
    batched.matrixAutoUpdate = false
    batched.userData = batched.userData ?? {}
    batched.userData.__viewerBatchMeta = []

    const geomIdByKey = new Map<string, number>()
    const local = new THREE.Matrix4()
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const absScale = new THREE.Vector3()
    for (const [key, group] of geometriesByKey.entries()) {
      const [sxStr, syStr, szStr] = group.signKey.split(',')
      const sx = Number(sxStr)
      const sy = Number(syStr)
      const sz = Number(szStr)

      let geometryForBatch = group.geometry
      let shouldDispose = false
      if (!(sx === 1 && sy === 1 && sz === 1)) {
        const baked = group.geometry.clone()
        baked.scale(sx, sy, sz)
        if (sx * sy * sz < 0) flipWindingAndNormals(baked)
        geometryForBatch = baked
        shouldDispose = true
      }

      const geometryId = batched.addGeometry(geometryForBatch)
      geomIdByKey.set(key, geometryId)
      if (shouldDispose) geometryForBatch.dispose?.()
    }

    for (const [key, group] of geometriesByKey.entries()) {
      const geometryId = geomIdByKey.get(key)!
      for (const mesh of group.meshes) {
        local.multiplyMatrices(rootInverse, mesh.matrixWorld)
        local.decompose(pos, quat, scale)
        absScale.set(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z))
        local.compose(pos, quat, absScale)
        const instanceId = batched.addInstance(geometryId)
        batched.setMatrixAt(instanceId, local)
        const elementId = getElementIdFromObject(mesh)
        ;(batched.userData.__viewerBatchMeta as any[])[instanceId] = {
          elementId,
          label:
            mesh?.userData?.name ||
            mesh?.userData?.label ||
            mesh?.name ||
            '构件',
          ifcId:
            guessIfcId(mesh?.userData) ||
            (looksLikeIfcGuid(mesh?.name) ? String(mesh.name) : undefined),
        }
        removed.add(mesh)
        totalBatchedInstances++
      }
    }

    batched.computeBoundingBox?.()
    batched.computeBoundingSphere?.()

    root.add(batched)

    for (const m of meshes) m.parent?.remove(m)
    batchedCount++
  }

  // Ensure frustum culling is enabled for remaining meshes
  root.traverse((obj: any) => {
    if (obj?.isMesh || obj?.isBatchedMesh) obj.frustumCulled = true
  })

  return {
    batchedCount,
    totalBatchedInstances,
    skippedMultiMaterial,
    preBatchTransparentMeshCount,
    skippedOther,
  }
}

/** 作用：加载本地文件（GLB/GLTF），接入场景并完成合批、索引与 UI 状态更新。 */
async function loadFile(file: File) {
  if (!scene) return

  const url = URL.createObjectURL(file)
  loadedObjectUrls.push(url)

  const loader = new GLTFLoader()
  statusText.value = `Loading: ${file.name}`

  loader.load(
    url,
    (gltf: any) => {
      const root = gltf?.scene ?? gltf?.scenes?.[0]
      if (!root) {
        statusText.value = 'Load failed: empty glTF scene.'
        return
      }

      applyRendererToneMapping()
      const materialChanged = applyMaterialMode(root, materialMode.value)

      statusText.value = `Optimizing: ${file.name}`
      clearPickedElement()
      buildWireframeForRoot(root)
      const {
        batchedCount,
        totalBatchedInstances,
        skippedMultiMaterial,
        preBatchTransparentMeshCount,
        skippedOther,
      } = optimizeRoot(root)
      const pivot = createCenteredPivot(root, file.name)
      loadedRoots.push(pivot)
      const host = ensureClipHostForObject(pivot)
      contentGroup?.add(host ?? pivot)
      invalidateClipBounds()
      fitCameraToObject(pivot)
      // Ensure world matrices are fully up-to-date after batching + recentering before the first render.
      pivot.updateMatrixWorld?.(true)
      statusText.value = `Loaded: ${file.name} (mode ${materialMode.value}, changed ${materialChanged}, batched ${batchedCount})`
      updateLoadedFlags()
      rebuildLoadedItems()
      rebuildElementIndex()
      onMeshWireframeChange()
      applyTransformSelection()
      updateBoundsHelpers()
      updateClipRangeFromContent({ preserveT: true })
      applyClippingState()
      // Some WebGPU paths will only stabilize after a second frame; schedule an extra render.
      requestRender()
      requestAnimationFrame(() => requestRender())
    },
    (e: any) => {
      if (!e?.total) return
      const pct = Math.round((e.loaded / e.total) * 100)
      statusText.value = `Loading: ${file.name} (${pct}%)`
    },
    (err: unknown) => {
      console.error(err)
      statusText.value = `Load failed: ${file.name}`
    },
  )
}

async function loadGlbBlob(blob: Blob, label: string) {
  if (!scene) return

  const url = URL.createObjectURL(blob)
  loadedObjectUrls.push(url)

  const loader = new GLTFLoader()
  statusText.value = `Loading: ${label}`

  loader.load(
    url,
    (gltf: any) => {
      const root = gltf?.scene ?? gltf?.scenes?.[0]
      if (!root) {
        statusText.value = 'Load failed: empty glTF scene.'
        return
      }

      applyRendererToneMapping()
      const materialChanged = applyMaterialMode(root, materialMode.value)

      statusText.value = `Optimizing: ${label}`
      clearPickedElement()
      buildWireframeForRoot(root)
      const { batchedCount } = optimizeRoot(root)
      const pivot = createCenteredPivot(root, label)
      loadedRoots.push(pivot)
      const host = ensureClipHostForObject(pivot)
      contentGroup?.add(host ?? pivot)
      recenterLoadedContentAsWhole()
      invalidateClipBounds()
      fitCameraToObject(pivot)
      pivot.updateMatrixWorld?.(true)
      statusText.value = `Loaded: ${label} (mode ${materialMode.value}, changed ${materialChanged}, batched ${batchedCount})`
      updateLoadedFlags()
      rebuildLoadedItems()
      rebuildElementIndex()
      onMeshWireframeChange()
      applyTransformSelection()
      updateBoundsHelpers()
      updateClipRangeFromContent({ preserveT: true })
      applyClippingState()
      tryRestoreSavedBimAlignment()
      requestRender()
      requestAnimationFrame(() => requestRender())
    },
    (e: any) => {
      if (!e?.total) return
      const pct = Math.round((e.loaded / e.total) * 100)
      statusText.value = `Loading: ${label} (${pct}%)`
    },
    (err: unknown) => {
      console.error(err)
      statusText.value = `Load failed: ${label}`
    },
  )
}

/** 作用：加载 3D Tiles tileset，并把 TilesRenderer 接入当前 WebGPU 场景循环。 */
async function loadTileset(url: string) {
  if (!scene || !camera) return

  clearPickedElement()
  statusText.value = `Loading tileset: ${url}`
  const pid = projectId.value
  const sid = scanFileId.value
  const tr = new TilesRenderer(url)
  tr.errorTarget = tilesErrorTarget.value
  // Keep all loaded leaf tiles resident. The default 0.4 GB LRU limit can
  // otherwise evict dense tiles while the camera is moved or zoomed.
  tr.lruCache.minSize = Infinity
  tr.lruCache.maxSize = Infinity
  tr.lruCache.minBytesSize = Infinity
  tr.lruCache.maxBytesSize = Infinity

  if (pid && sid) {
    const prefix = `/api/projects/${pid}/files/${sid}/scan/tiles/`
    tr.registerPlugin({
      fetchData: async (uri: any, _options: any) => {
        const raw = typeof uri === 'string' ? uri : uri?.toString?.() || ''
        if (!raw) return null

        let pathname = ''
        try {
          pathname = new URL(raw, window.location.href).pathname
        } catch {
          pathname = raw
        }

        if (!pathname.startsWith(prefix)) {
          return fetch(raw, _options)
        }

        const assetPath = pathname.slice(prefix.length)
        const ext = assetPath.split('.').pop()?.toLowerCase()
        if (ext === 'json') {
          return getScanTilesAsset(pid, sid, assetPath, 'json')
        }
        return getScanTilesAsset(pid, sid, assetPath, 'arraybuffer')
      },
    } as any)
  }

  // Enable Draco decoding for tiles that contain Draco-compressed glTF (common in b3dm).
  // If you want to avoid external network at runtime, host the decoders locally and set to e.g. "/draco/".
  const dracoLoader = new DRACOLoader(tr.manager)
  dracoLoader.setDecoderPath('/draco/')
  dracoLoader.preload()
  tr.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader }))

  const wrapper = new THREE.Group()
  // 3D Tiles source data is Z-up; rotate to Three.js Y-up.
  wrapper.rotation.x = tilesetZUpRotationX
  wrapper.userData = wrapper.userData ?? {}
  wrapper.userData.__viewerItemId = String(nextItemId++)
  wrapper.userData.__viewerLabel = `Tileset: ${url}`
  wrapper.add(tr.group)

  loadedTilesets.push({ tr, wrapper, rootReady: false })

  tr.setCamera(camera)
  resizeRenderer()

  tr.addEventListener('needs-update', () => requestRender())
  tr.addEventListener('tiles-load-start', () => {
    statusText.value = `Loading tiles...`
    requestRender()
  })
  tr.addEventListener('tiles-load-end', () => {
    statusText.value = `Tiles loaded.`
    pointCloudClippingReady.value = true
    invalidateClipBounds()
    if (showBounds.value && !enableClipping.value && canEnableClipping.value) {
      activeClipTargetId = resolveClipTargetId(activeClipTargetId)
      if (activeClipTargetId) {
        enableClipping.value = true
        getOrCreateClipState(activeClipTargetId)
        syncClipUiFromFace(activeClipTargetId)
        applyClippingState()
      }
    }
    scheduleClipRangeUpdate()
    requestRender()
  })
  tr.addEventListener('load-error', (e: any) => {
    console.error(e)
    statusText.value = `Tiles load error: ${String(e?.error?.message ?? e?.error ?? 'unknown')}`
    requestRender()
  })

  tr.addEventListener('load-root-tileset', () => {
    const entry = loadedTilesets.find((item) => item.tr === tr)
    if (entry) entry.rootReady = true
    tryRestoreSavedBimAlignment()
    recenterLoadedContentAsWhole()
    wrapper.updateMatrixWorld?.(true)
    tr.group.updateMatrixWorld?.(true)
    invalidateClipBounds()
    scheduleClipRangeUpdate()
    requestRender()
  })

  tr.addEventListener('load-model', ({ scene: tileScene }: any) => {
    let computedPointBounds = 0
    tileScene?.traverse?.((obj: any) => {
      if (!obj?.isPoints) return
      const geometry = obj.geometry
      if (geometry?.isBufferGeometry) {
        if (!geometry.boundingBox && geometry.attributes?.position) {
          geometry.computeBoundingBox?.()
          computedPointBounds += 1
        }
        if (!geometry.boundingSphere && geometry.attributes?.position) {
          geometry.computeBoundingSphere?.()
          computedPointBounds += 1
        }
      }
      // TilesRenderer already performs tile-level visibility selection.
      // Disable per-object frustum culling on point chunks to avoid partial
      // disappearance when orbiting the camera.
      obj.frustumCulled = false
    })

    const { fixedAttributes, oversizedGeometries } =
      sanitizeObjectForWebGPU(tileScene)
    applyMaterialMode(tileScene, materialMode.value)
    void computedPointBounds
    if (oversizedGeometries > 0) {
      statusText.value = `Tile too large for WebGPU (>${256}MB). Consider increasing SSE or re-tiling.`
    }
    invalidateClipBounds()
    scheduleClipRangeUpdate()
    requestRender()
  })

  const host = ensureClipHostForObject(wrapper)
  contentGroup?.add(host ?? wrapper)
  recenterLoadedContentAsWhole()
  invalidateClipBounds()
  updateLoadedFlags()
  rebuildLoadedItems()
  applyTransformSelection()
  updateBoundsHelpers()
  updateClipRangeFromContent({ preserveT: true })
  applyClippingState()
  requestRender()
}

/** 作用：打开模型文件选择框（glb/gltf）。 */
function openFilePicker() {
  fileInputEl.value?.click()
}

/** 作用：处理模型文件选择事件并触发加载。 */
function onFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  void loadFile(file)
  input.value = ''
}

/** 作用：点击按钮从输入框读取 tileset URL 并触发加载。 */
function onLoadTilesClick() {
  const url = tilesetUrl.value.trim()
  if (!url) return
  void loadTileset(url)
}

/** 作用：将 UI 中的 tilesErrorTarget 更新同步到已加载的 TilesRenderer 实例。 */
function onTilesErrorTargetInput() {
  if (!loadedTilesets.length) return
  // Calibration always renders visible leaf tiles for stable alignment.
  tilesErrorTarget.value = 0
  for (const entry of loadedTilesets) entry.tr.errorTarget = 0
  requestRender()
}

/** 作用：拖拽进入画布区域时启用拖拽态并阻止浏览器默认行为。 */
function onDragOver(ev: DragEvent) {
  ev.preventDefault()
  isDragging.value = true
}

/** 作用：拖拽离开时退出拖拽态。 */
function onDragLeave() {
  isDragging.value = false
}

/** 作用：处理拖拽释放文件并触发模型加载。 */
function onDrop(ev: DragEvent) {
  ev.preventDefault()
  isDragging.value = false
  const file = ev.dataTransfer?.files?.[0]
  if (!file) return
  void loadFile(file)
}

async function handleLoadBimFromApi() {
  if (!projectId.value || !bimFileId.value) return
  if (!scene) {
    statusText.value = 'Viewer not ready.'
    return
  }

  loadingBim.value = true
  try {
    modelHidden.value = false
    clearLoadedGltf()
    const blob = await getIfcGlbFile(projectId.value, bimFileId.value)
    const label =
      bimNameForDisplay.value !== '—'
        ? bimNameForDisplay.value
        : `BIM ${bimFileId.value}`
    await loadGlbBlob(blob, label)
  } catch (error: any) {
    console.error(error)
    statusText.value = error?.message
      ? `Load failed: ${error.message}`
      : 'Load failed.'
  } finally {
    loadingBim.value = false
  }
}

async function handleLoadPointCloudFromApi() {
  const url = pointCloudTilesetUrl.value
  if (!url) return
  if (!scene || !camera) {
    statusText.value = 'Viewer not ready.'
    return
  }

  loadingPointCloud.value = true
  pointCloudClippingReady.value = false
  try {
    pointCloudHidden.value = false
    clearLoadedTilesets()
    tilesetUrl.value = url
    await loadTileset(url)
  } catch (error: any) {
    console.error(error)
    statusText.value = error?.message
      ? `Tiles load failed: ${error.message}`
      : 'Tiles load failed.'
  } finally {
    loadingPointCloud.value = false
  }
}

const getAutoLoadResourceKey = () => {
  if (!projectId.value) return ''
  const hasAnyResource = canLoadBim.value || canLoadPointCloud.value
  if (!hasAnyResource) return ''
  const bimKey = canLoadBim.value ? `bim:${bimFileId.value}` : 'bim:none'
  const pointcloudKey = canLoadPointCloud.value
    ? `scan:${scanFileId.value}`
    : 'scan:none'
  return `${route.fullPath}|${bimKey}|${pointcloudKey}`
}

async function autoLoadSceneResources(force = false) {
  if (!viewerReady.value || !scene || !contentGroup) return

  const nextKey = getAutoLoadResourceKey()
  if (!nextKey) return
  if (!force && autoLoadedResourceKey.value === nextKey) return

  autoLoadedResourceKey.value = nextKey

  const tasks: Promise<unknown>[] = []
  if (canLoadBim.value && !loadingBim.value) {
    tasks.push(handleLoadBimFromApi())
  }
  if (canLoadPointCloud.value && !loadingPointCloud.value) {
    tasks.push(handleLoadPointCloudFromApi())
  }
  if (!tasks.length) return

  await Promise.allSettled(tasks)
  await fetchAndRestoreBimAlignment()
}

/** 作用：根据材质模式设置 renderer 的色调映射（unlit 关闭 toneMapping）。 */
function applyRendererToneMapping() {
  if (!renderer) return
  renderer.toneMapping =
    materialMode.value === 'unlit'
      ? THREE.NoToneMapping
      : THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
}

/** 作用：应用背景色到 scene.background 与 renderer clearColor。 */
function onBackgroundColorChange() {
  if (!scene || !renderer) return
  const c = new THREE.Color(backgroundColor.value || '#0b1020')
  scene.background = c
  renderer.setClearColor(c, 1)
  requestRender()
}

function resetBackgroundColor() {
  backgroundColor.value = '#0b1020'
  onBackgroundColorChange()
}

/** 作用：根据当前激活模型的包围盒刷新剖切 slider 的 min/max，并做位置 clamp。 */
function updateClipRangeFromContent(
  opts: { resetPosition?: boolean; preserveT?: boolean } = {},
) {
  void opts
  if (!activeClipTargetId) {
    clipRange.value = { min: 0, max: 1 }
    clipPosition.value = 0
    return
  }
  if (!getOrCreateClipState(activeClipTargetId)) {
    clipRange.value = { min: 0, max: 1 }
    clipPosition.value = 0
    return
  }
  syncClipUiFromFace(activeClipTargetId)
}

/** 作用：把 UI 中的剖切配置同步到 WebGPU ClippingGroup。 */
function applyClippingState() {
  if (!contentGroup) return

  clippingGroup.enabled = false
  const rootPlanes = clippingGroup.clippingPlanes as any
  if (Array.isArray(rootPlanes)) rootPlanes.length = 0
  else clippingGroup.clippingPlanes = []

  const enabled =
    !!enableClipping.value &&
    !!hasModel.value &&
    !!showBounds.value &&
    !!resolveClipTargetId(activeClipTargetId)

  if (!enabled) {
    for (const { host } of clipHostByItemId.values()) {
      host.enabled = false
      const planes = host.clippingPlanes as any
      if (Array.isArray(planes)) planes.length = 0
      else host.clippingPlanes = []
    }
    requestRender()
    return
  }

  const activeId = resolveClipTargetId(activeClipTargetId)
  activeClipTargetId = activeId
  const activeBox = getCurrentClipBox(activeId)

  for (const [itemId, entry] of clipHostByItemId.entries()) {
    const host = entry.host
    const planes = host.clippingPlanes as any
    if (Array.isArray(planes)) planes.length = 0
    else host.clippingPlanes = []

    if (!isJointClipTargetId(activeId) && itemId !== activeId) {
      host.enabled = false
      continue
    }

    if (!activeBox) {
      host.enabled = false
      continue
    }

    host.enabled = true
    host.clippingPlanes.push(
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -activeBox.min.x),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), activeBox.max.x),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -activeBox.min.y),
      new THREE.Plane(new THREE.Vector3(0, -1, 0), activeBox.max.y),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -activeBox.min.z),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), activeBox.max.z),
    )
  }
  requestRender()
}

/** 作用：合并频繁事件导致的剖切范围/平面更新，避免反复扫 Box3。 */
function scheduleClipRangeUpdate() {
  if (clipUpdateScheduled) return
  clipUpdateScheduled = true
  requestAnimationFrame(() => {
    clipUpdateScheduled = false
    if (activeClipTargetId) updateClipRangeFromContent({ preserveT: true })
    applyClippingState()
    scheduleBoundsHelpersUpdate()
  })
}

/** 作用：材质模式切换时对已加载内容批量替换材质，并触发重渲染。 */
function onMaterialModeChange() {
  if (!contentGroup) return
  clearPickedElement()
  applyMaterialMode(contentGroup, materialMode.value)
  onMeshWireframeChange()
  applyRendererToneMapping()
  requestRender()
}

function toggleBounds() {
  showBounds.value = !showBounds.value
  onShowBoundsChange()
}

function onBoundsButtonClick() {
  if (showBounds.value) {
    toggleBounds()
    return
  }
  if (clipBoundsDisabledReason.value) {
    ElMessage.warning(clipBoundsDisabledReason.value)
    return
  }
  toggleBounds()
}

function toggleGrid() {
  showGrid.value = !showGrid.value
  onShowGridChange()
}

/** 作用：裁切框开关变化时刷新辅助线，并在满足条件时自动启用联合剖切。 */
function onShowBoundsChange() {
  if (showBounds.value) {
    if (canEnableClipping.value) {
      if (editMode.value) {
        editMode.value = false
        onEditModeChange()
      }
      enableClipping.value = true
      activeClipTargetId = resolveClipTargetId(activeClipTargetId)
      if (activeClipTargetId) {
        getOrCreateClipState(activeClipTargetId)
        syncClipUiFromFace(activeClipTargetId)
      }
    }
  } else if (enableClipping.value) {
    enableClipping.value = false
    applyClippingState()
  }
  updateBoundsHelpers()
  applyClippingState()
}

/** 作用：网格显示开关变化时控制网格可见性。 */
function onShowGridChange() {
  if (gridHelper) {
    gridHelper.visible = showGrid.value
    requestRender()
  }
}

function getPointerNdc(ev: PointerEvent) {
  const rect = renderer?.domElement?.getBoundingClientRect?.()
  if (!rect) return null
  return {
    x: ((ev.clientX - rect.left) / rect.width) * 2 - 1,
    y: -(((ev.clientY - rect.top) / rect.height) * 2 - 1),
  }
}

function consumePointerEvent(ev: PointerEvent) {
  ev.preventDefault()
  ev.stopPropagation()
  ;(ev as any).stopImmediatePropagation?.()
}

function pickClipOverlay(ev: PointerEvent):
  | null
  | {
      kind: 'handle'
      hit: any
      itemId: string
      axis: 'x' | 'y' | 'z'
      invert: boolean
    }
  | { kind: 'bounds'; hit: any; itemId: string } {
  if (!raycaster || !camera) return null
  const ndc = getPointerNdc(ev)
  if (!ndc) return null

  raycaster.params.Line = raycaster.params.Line ?? {}
  raycaster.params.Line.threshold = 0.2
  raycaster.setFromCamera(ndc, camera)

  if (clipHandlePickers.length) {
    const handleHits = raycaster.intersectObjects(clipHandlePickers, true)
    const handleHit = handleHits[0] as any
    if (handleHit?.object?.userData?.__viewerClipHandle) {
      return {
        kind: 'handle',
        hit: handleHit,
        itemId: String(handleHit.object.userData.itemId),
        axis: handleHit.object.userData.axis,
        invert: !!handleHit.object.userData.invert,
      }
    }
  }

  const lineHits = raycaster.intersectObjects(
    boundHelperEntries.map((entry) => entry.boxHelper),
    true,
  )
  const lineHit = lineHits[0] as any
  const hitItemId = lineHit?.object?.userData?.__viewerItemId
  if (!hitItemId) return null

  return {
    kind: 'bounds',
    hit: lineHit,
    itemId: String(hitItemId),
  }
}

function buildClipDragPlane(axisKey: 'x' | 'y' | 'z', anchor: THREE.Vector3) {
  const axis =
    axisKey === 'x'
      ? new THREE.Vector3(1, 0, 0)
      : axisKey === 'y'
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1)
  const cameraDir = new THREE.Vector3()
  camera?.getWorldDirection?.(cameraDir)
  let normal = cameraDir.sub(axis.clone().multiplyScalar(cameraDir.dot(axis)))
  if (normal.lengthSq() < 1e-6) {
    normal = new THREE.Vector3(0, 1, 0).cross(axis)
  }
  if (normal.lengthSq() < 1e-6) {
    normal = new THREE.Vector3(0, 0, 1).cross(axis)
  }
  normal.normalize()
  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, anchor)
}

function activateClipTarget(itemId: string) {
  const nextId = resolveClipTargetId(itemId)
  if (!nextId) return
  activeClipTargetId = nextId
  if (!isJointClipTargetId(nextId)) {
    selectedItemId.value = nextId
    applyTransformSelection()
  }
  if (!showBounds.value) showBounds.value = true
  if (!enableClipping.value) {
    enableClipping.value = true
  }
  if (editMode.value) {
    editMode.value = false
    onEditModeChange()
  }
  updateLoadedFlags()
  getOrCreateClipState(activeClipTargetId)
  syncClipUiFromFace(activeClipTargetId)
  updateBoundsHelpers()
  applyClippingState()
}

function beginClipDrag(
  ev: PointerEvent,
  options: { itemId: string; axis: 'x' | 'y' | 'z'; invert: boolean },
) {
  const targets = getClipTargetObjects(options.itemId)
  if (!targets.length || !raycaster || !camera || !renderer) {
    clipPointerCaptureId = null
    if (controls) controls.enabled = true
    return
  }

  activeClipTargetId = options.itemId
  clipAxis.value = options.axis
  clipInvert.value = options.invert
  getOrCreateClipState(activeClipTargetId)
  syncClipUiFromFace(activeClipTargetId)
  applyClippingState()
  updateBoundsHelpers()

  const ndc = getPointerNdc(ev)
  if (!ndc) {
    clipPointerCaptureId = null
    if (controls) controls.enabled = true
    return
  }
  raycaster.setFromCamera(ndc, camera)

  const anchor = new THREE.Vector3()
  anchor[options.axis] = getClipFacePosition(
    options.itemId,
    options.axis,
    options.invert,
  )
  const box = getCurrentClipBox(options.itemId)
  if (!box) {
    clipPointerCaptureId = null
    if (controls) controls.enabled = true
    return
  }
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
  if (!raycaster.ray.intersectPlane(dragPlane, startPoint)) {
    clipPointerCaptureId = null
    if (controls) controls.enabled = true
    return
  }

  clipDragState = {
    pointerId: ev.pointerId,
    itemId: options.itemId,
    axis: options.axis,
    invert: options.invert,
    dragPlane,
    startPoint,
    startPosition: getClipFacePosition(
      options.itemId,
      options.axis,
      options.invert,
    ),
    min: getClipFaceRange(options.itemId, options.axis, options.invert).min,
    max: getClipFaceRange(options.itemId, options.axis, options.invert).max,
  }
  renderer.domElement.setPointerCapture?.(ev.pointerId)
  clipPointerCaptureId = ev.pointerId
  if (controls) controls.enabled = false
  setInteractionMode(true)
}

function onClipDragMove(ev: PointerEvent) {
  if (!clipDragState || !raycaster || !camera) return
  const ndc = getPointerNdc(ev)
  if (!ndc) return
  raycaster.setFromCamera(ndc, camera)
  const point = new THREE.Vector3()
  if (!raycaster.ray.intersectPlane(clipDragState.dragPlane, point)) return

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
  setClipFacePosition(
    clipDragState.itemId,
    clipDragState.axis,
    clipDragState.invert,
    nextPosition,
  )
  syncClipUiFromFace(clipDragState.itemId)
  applyClippingState()
  scheduleBoundsHelpersUpdate()
  requestRender()
}

function endClipDrag(ev?: PointerEvent) {
  if (
    (clipDragState || clipPointerCaptureId !== null) &&
    renderer?.domElement &&
    ev
  ) {
    try {
      renderer.domElement.releasePointerCapture?.(
        clipPointerCaptureId ?? clipDragState?.pointerId,
      )
    } catch {
      // ignore pointer capture release errors
    }
  }
  clipDragState = null
  clipPointerCaptureId = null
  if (controls) controls.enabled = true
  setInteractionMode(false)
  updateBoundsHelpers()
  requestRender()
}

/** 作用：编辑模式开关变化时（解绑/绑定）更新 TransformControls 状态。 */
function onEditModeChange() {
  if (editMode.value) {
    registrationStage.value = 'coarse'
    const nextSelectedId = getDefaultEditTargetId()
    if (nextSelectedId && nextSelectedId !== selectedItemId.value) {
      selectedItemId.value = nextSelectedId
      onSelectedItemChange()
    } else if (!selectedItemId.value) {
      selectedItemId.value = nextSelectedId
    }
  }
  syncTransformModeForSelection()
  if (!editMode.value) {
    transformControls?.detach?.()
    if (transformHelper) transformHelper.visible = false
  }
  applyTransformSelection()
  if (editMode.value) {
    syncAllTransformFixValuesFromSelected()
    return
  }
  resetOrientationFix()
  resetPositionFix()
}

/** 作用：切换当前选中加载项时，更新 gizmo/包围盒/朝向基准。 */
function onSelectedItemChange() {
  refreshSelectedTransformUi(false)
  if (enableClipping.value && selectedItemId.value) {
    setActiveClipTarget(selectedItemId.value)
  } else {
    updateBoundsHelpers()
  }
}

/** 作用：将相机聚焦到当前选中加载项。 */
function focusSelected() {
  const item = loadedItems.value.find((i) => i.id === selectedItemId.value)
  if (!item) return
  fitCameraToObject(item.obj)
  requestRender()
}

/** 作用：重置相机到默认视角。 */
function resetView() {
  setTopView()
}

/** 作用：切换到前视图。 */
function setFrontView() {
  if (!camera || !controls) return
  controls.target.set(0, 0, 0)
  camera.position.set(0, 1.5, 50)
  camera.near = 0.01
  camera.far = 5000
  camera.updateProjectionMatrix()
  controls.update()
  activeView.value = 'front'
  requestRender()
}

/** 作用：切换到俯视图。 */
function setTopView() {
  if (!camera || !controls) return
  controls.target.set(0, 0, 0)
  camera.position.set(0, 100, 0.1)
  camera.lookAt(0, 0, 0)
  camera.near = 0.01
  camera.far = 5000
  camera.updateProjectionMatrix()
  controls.update()
  activeView.value = 'top'
  requestRender()
}

/** 作用：切换到侧视图。 */
function setSideView() {
  if (!camera || !controls) return
  controls.target.set(0, 0, 0)
  camera.position.set(50, 1.5, 0)
  camera.near = 0.01
  camera.far = 5000
  camera.updateProjectionMatrix()
  controls.update()
  activeView.value = 'side'
  requestRender()
}

/** 作用：执行一帧渲染（含控制器更新、tiles 更新与高亮 overlay 同步）。 */
function renderFrame() {
  renderRequested = false
  if (!renderer || !scene || !camera) return
  stats?.begin?.()
  controls?.update?.()
  camera.updateMatrixWorld?.()
  transformHelper?.updateMatrixWorld?.(true)
  updateHighlightedOverlayTransform()
  if (loadedTilesets.length) {
    camera.updateMatrixWorld()
    for (const entry of loadedTilesets) {
      try {
        entry.tr.update()
      } catch {
        // 忽略 tileset 更新过程中的 assertion 错误
      }
    }
  }
  renderer.render(scene, camera)
  stats?.end?.()
}

/** 作用：请求一次渲染帧（合并多次请求，避免重复 RAF）。 */
function requestRender() {
  if (renderRequested) return
  renderRequested = true
  animationHandle = requestAnimationFrame(renderFrame)
}

/** 作用：在交互（拖拽/旋转）时降低合批剔除/排序开销，提升帧率。 */
function setInteractionMode(isInteracting: boolean) {
  if (!contentGroup) return
  contentGroup.traverse((obj: any) => {
    if (!obj?.isBatchedMesh) return
    obj.perObjectFrustumCulled = !isInteracting
    obj.sortObjects = false
  })
}

function updateOrthographicFrustum() {
  if (!viewportEl.value || !orthographicCamera) return
  const { width, height } = viewportEl.value.getBoundingClientRect()
  const w = Math.max(1, Math.floor(width))
  const h = Math.max(1, Math.floor(height))
  const aspect = w / h
  orthographicCamera.left = -orthoViewSize * aspect
  orthographicCamera.right = orthoViewSize * aspect
  orthographicCamera.top = orthoViewSize
  orthographicCamera.bottom = -orthoViewSize
  orthographicCamera.updateProjectionMatrix()
}

function applyOrbitControlsForProjection() {
  if (!controls) return
  if (projectionMode.value === 'orthographic') {
    controls.minZoom = 0.05
    controls.maxZoom = 20
    controls.minDistance = 0.0
    controls.maxDistance = 1e9
    controls.screenSpacePanning = true
    ;(controls as any).zoomToCursor = true
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    }
  } else {
    controls.minDistance = 0.1
    controls.maxDistance = 1000
    // Keep right-button panning aligned with the screen in perspective mode.
    // With ground-plane panning, vertical drags are converted to depth motion
    // and appear to have no effect when the camera is nearly level.
    controls.screenSpacePanning = true
    ;(controls as any).zoomToCursor = false
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    }
  }
}

function rebuildOrbitControls() {
  if (!renderer || !camera) return
  const prevTarget = controls?.target?.clone?.()
  controls?.dispose?.()

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = false
  controls.addEventListener?.('change', requestRender)
  controls.addEventListener?.('start', () => {
    setInteractionMode(true)
    dprCap = 0.75
    resizeRenderer()
    requestRender()
  })
  controls.addEventListener?.('end', () => {
    setInteractionMode(false)
    dprCap = 1.25
    resizeRenderer()
    requestRender()
  })
  if (prevTarget) controls.target.copy(prevTarget)
  applyOrbitControlsForProjection()
  controls.update()
}

function setProjectionMode(mode: 'perspective' | 'orthographic') {
  if (projectionMode.value === mode) return
  if (!perspectiveCamera || !orthographicCamera) {
    projectionMode.value = mode
    return
  }

  const prevPos = camera?.position?.clone?.()
  const prevQuat = camera?.quaternion?.clone?.()
  const prevUp = camera?.up?.clone?.()
  const prevTarget = controls?.target?.clone?.()

  projectionMode.value = mode

  if (mode === 'orthographic') {
    if (prevTarget && perspectiveCamera?.isPerspectiveCamera) {
      const distance = prevPos
        ? prevPos.distanceTo(prevTarget)
        : perspectiveCamera.position.distanceTo(prevTarget)
      const halfH =
        Math.tan(THREE.MathUtils.degToRad(perspectiveCamera.fov * 0.5)) *
        Math.max(0.01, distance)
      orthoViewSize = Math.max(0.01, halfH)
    }
    camera = orthographicCamera
    camera.near = 0.01
    camera.far = 5000
    camera.zoom = 1
    if (prevPos) camera.position.copy(prevPos)
    if (prevQuat) camera.quaternion.copy(prevQuat)
    if (prevUp) camera.up.copy(prevUp)
    updateOrthographicFrustum()
  } else {
    camera = perspectiveCamera
    camera.near = 0.01
    camera.far = 5000
    if (prevPos) camera.position.copy(prevPos)
    if (prevQuat) camera.quaternion.copy(prevQuat)
    if (prevUp) camera.up.copy(prevUp)
    camera.updateProjectionMatrix()
  }

  if (transformControls) (transformControls as any).camera = camera
  rebuildOrbitControls()
  if (prevTarget) controls?.target?.copy(prevTarget)
  controls?.update?.()
  resizeRenderer()
  requestRender()
}

/** 作用：根据容器尺寸与 DPR 重新设置 renderer/camera，并同步 tileset 分辨率。 */
function resizeRenderer() {
  if (!viewportEl.value || !renderer || !camera) return
  const { width, height } = viewportEl.value.getBoundingClientRect()
  const w = Math.max(1, Math.floor(width))
  const h = Math.max(1, Math.floor(height))
  const dpr = Math.min(window.devicePixelRatio ?? 1, dprCap)
  renderer.setPixelRatio(dpr)
  renderer.setSize(w, h)
  if (camera?.isOrthographicCamera) {
    updateOrthographicFrustum()
  } else {
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  for (const entry of loadedTilesets) entry.tr.setResolution?.(camera, w, h)
}

/** 作用：初始化 three.js 场景（WebGPURenderer、相机、控制器、拾取/交互等）。 */
async function initThree() {
  const el = viewportEl.value
  if (!el) return

  scene = new THREE.Scene()
  scene.background = new THREE.Color(backgroundColor.value || '#0b1020')

  // 添加网格辅助线
  gridHelper = new THREE.GridHelper(10000, 2000, 0x444466, 0x222244)
  gridHelper.position.y = -10.01
  scene.add(gridHelper)

  // WebGPU clipping is encoded in scene graph via ClippingGroup.
  clippingGroup = new ClippingGroup()
  scene.add(clippingGroup)

  contentGroup = new THREE.Group()
  clippingGroup.add(contentGroup)

  wireframeOverlayGroup = new THREE.Group()
  wireframeOverlayGroup.name = 'wireframeOverlayGroup'
  scene.add(wireframeOverlayGroup)

  perspectiveCamera = new THREE.PerspectiveCamera(50, 1, 0.01, 5000)
  perspectiveCamera.position.set(0, 1.5, 4)
  orthographicCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 5000)
  orthographicCamera.position.copy(perspectiveCamera.position)
  orthographicCamera.quaternion.copy(perspectiveCamera.quaternion)
  camera =
    projectionMode.value === 'orthographic'
      ? orthographicCamera
      : perspectiveCamera

  renderer = new WebGPURenderer({ antialias: true })
  dprCap = 1.25
  renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, dprCap))
  renderer.setClearColor(new THREE.Color(backgroundColor.value || '#0b1020'), 1)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0

  el.appendChild(renderer.domElement)

  raycaster = new THREE.Raycaster()
  transformControls = new TransformControls(camera, renderer.domElement)
  transformControls.enabled = true
  transformHelper = transformControls.getHelper()
  transformHelper.visible = false
  transformControls.setSize?.(1.5)
  transformControls.setSpace?.('local')
  transformHelper.frustumCulled = false
  transformHelper.traverse?.((o: any) => {
    o.frustumCulled = false
    if (o.material) {
      if (Array.isArray(o.material))
        o.material.forEach((m: any) => (m.depthTest = false))
      else o.material.depthTest = false
    }
  })
  transformControls.addEventListener?.('change', () => {
    syncTransformFixFromSelected()
    invalidateClipBounds()
    scheduleBoundsHelpersUpdate()
    if (transformControls?.dragging) {
      markCoarseAlignmentDirty()
    }
    requestRender()
  })
  transformControls.addEventListener?.('dragging-changed', (e: any) => {
    const dragging = !!e?.value
    if (controls && !clipDragState) controls.enabled = !dragging
    setInteractionMode(dragging)
    if (!dragging) {
      syncTransformFixFromSelected()
    }
    if (!dragging && enableClipping.value) {
      updateClipRangeFromContent({ preserveT: true })
      applyClippingState()
    }
  })
  scene.add(transformHelper)

  stats = new Stats()
  stats.dom.style.position = 'absolute'
  stats.dom.style.right = '16px'
  stats.dom.style.bottom = '16px'
  stats.dom.style.left = 'auto'
  stats.dom.style.top = 'auto'
  stats.dom.style.zIndex = '20'
  stats.dom.style.opacity = '0.9'
  el.appendChild(stats.dom)

  const ambient = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambient)

  const key = new THREE.DirectionalLight(0xffffff, 1.3)
  key.position.set(3, 6, 4)
  scene.add(key)

  const fill = new THREE.DirectionalLight(0x99bbff, 0.5)
  fill.position.set(-4, 2, -3)
  scene.add(fill)

  rebuildOrbitControls()

  resizeObserver = new ResizeObserver(() => {
    resizeRenderer()
    requestRender()
  })
  resizeObserver.observe(el)

  renderer.domElement.addEventListener(
    'pointermove',
    (ev: PointerEvent) => {
      if (!clipDragState) return
      consumePointerEvent(ev)
      onClipDragMove(ev)
    },
    true,
  )

  renderer.domElement.addEventListener(
    'pointerup',
    (ev: PointerEvent) => {
      if (!clipDragState && clipPointerCaptureId === null) return
      consumePointerEvent(ev)
      endClipDrag(ev)
    },
    true,
  )

  renderer.domElement.addEventListener(
    'pointercancel',
    (ev: PointerEvent) => {
      if (!clipDragState && clipPointerCaptureId === null) return
      consumePointerEvent(ev)
      endClipDrag(ev)
    },
    true,
  )

  renderer.domElement.addEventListener(
    'pointerdown',
    (ev: PointerEvent) => {
      if (!raycaster || !camera || !contentGroup) return

      if (ev.shiftKey && c2mMeshObj) {
        const ndc = getPointerNdc(ev)
        if (ndc) {
          raycaster.setFromCamera(ndc, camera)
          const c2mHits = raycaster.intersectObject(c2mMeshObj, false)
          if (c2mHits.length) {
            const d = sampleC2MDeviationAtPick(c2mHits[0], c2mMeshObj)
            if (d != null) {
              ElMessage.info({
                message: `Scan–BIM 有符号偏差（正=外凸，负=内缩）: ${formatC2mDeviationM(d)}`,
                duration: 4000,
              })
              return
            }
          }
        }
      }

      if (!loadedItems.value.length) return
      const overlayHit = pickClipOverlay(ev)
      if (overlayHit?.kind === 'handle') {
        consumePointerEvent(ev)
        activateClipTarget(overlayHit.itemId)
        beginClipDrag(ev, overlayHit)
        return
      }
      if (overlayHit?.kind === 'bounds') {
        consumePointerEvent(ev)
        activateClipTarget(overlayHit.itemId)
        return
      }

      const ndc = getPointerNdc(ev)
      if (!ndc) return
      raycaster.setFromCamera(ndc, camera)
      const hits = raycaster.intersectObjects(contentGroup.children, true)
      if (!hits.length) return

      const pickedHit =
        (hits as any[]).find((h) => !h?.object?.userData?.__viewerPickIgnore) ??
        (hits[0] as any)

      let top: any = pickedHit.object
      while (top && top.parent && top.parent !== contentGroup) top = top.parent
      if (top?.userData?.__viewerClipTarget) {
        top = top.userData.__viewerClipTarget
      }

      const hit = pickedHit as any
      const topIsGltf = loadedRoots.includes(top)
      const topIsTileset = loadedTilesets.some((e) => e.wrapper === top)
      const wantElementPick =
        enableElementPicking.value &&
        topIsGltf &&
        (!editMode.value || ev.altKey)
      if (wantElementPick) {
        const highlightColor = new THREE.Color('#ffcf4a')

        restoreHighlightedElement()
        if (hit?.object?.isBatchedMesh && typeof hit.batchId === 'number') {
          const meta = hit.object?.userData?.__viewerBatchMeta?.[hit.batchId]
          pickedElement.value = {
            label: meta?.label ?? '构件',
            sourceLabel: top?.userData?.__viewerLabel,
          }
          highlightBatched(hit.object, hit.batchId, highlightColor)
        } else {
          const mesh = hit.object
          const elementId = getElementIdFromObject(mesh)
          pickedElement.value = {
            label:
              mesh?.name ||
              mesh?.userData?.name ||
              mesh?.userData?.label ||
              '构件',
            ifcId: elementId || guessIfcId(mesh?.userData),
            sourceLabel: top?.userData?.__viewerLabel,
          }
          highlightMesh(mesh, highlightColor)
        }
        requestRender()
        return
      }

      if (!editMode.value) return
      if (topIsTileset) return

      const id = top?.userData?.__viewerItemId
      if (!id) return
      selectedItemId.value = String(id)
      applyTransformSelection()
      if (enableClipping.value) {
        setActiveClipTarget(String(id))
      } else {
        updateBoundsHelpers()
      }
      resetOrientationFix()
      resetPositionFix()
      const item = getSelectedItem()
      ensureInitialTransformState(item?.obj)
      if (item?.obj?.quaternion) {
        if (!item.obj.userData) item.obj.userData = {}
        item.obj.userData.__orientationBaseQuat = item.obj.quaternion.clone()
      }
      if (item?.obj?.position) {
        if (!item.obj.userData) item.obj.userData = {}
        item.obj.userData.__positionBaseVec3 = item.obj.position.clone()
      }
    },
    true,
  )

  resizeRenderer()

  statusText.value = 'WebGPU initializing...'
  await renderer.init()
  applyRendererToneMapping()
  applyClippingState()
  statusText.value = 'Ready.'
  requestRender()
}

onMounted(() => {
  if (!webgpuSupported.value) {
    statusText.value =
      'WebGPU not supported. Please use Chrome/Edge with WebGPU enabled.'
    return
  }
  void initThree().then(() => {
    viewerReady.value = true
    void autoLoadSceneResources(true)
  })
})

watch(
  () => route.fullPath,
  () => {
    // 进入同一路由但 query 变化时，也要清空上一次的加载内容
    if (!renderer || !scene || !contentGroup) return
    clearScene()
    resetSessionState()
    void nextTick(() => autoLoadSceneResources(true))
  },
)

onActivated(() => {
  resetSessionState()
  if (scene && contentGroup) {
    clearScene()
    resetSessionState()
  }
  if (viewerReady.value) {
    void nextTick(() => autoLoadSceneResources(true))
  }
})

onDeactivated(() => {
  if (scene && contentGroup) clearScene()
  resetSessionState()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationHandle)
  cancelAnimationFrame(positionFixFrameHandle)
  cancelAnimationFrame(orientationFixFrameHandle)
  resizeObserver?.disconnect()
  controls?.dispose()
  clearScene()
  transformControls?.dispose?.()
  transformHelper?.removeFromParent?.()
  renderer?.dispose()
  renderer?.domElement?.remove()
  stats?.dom?.remove?.()

  resizeObserver = null
  controls = null
  viewerReady.value = false
  activePositionSliderAxis = null
  positionFixFrameHandle = 0
  activeRotationSliderAxis = null
  orientationFixFrameHandle = 0
  camera = null
  scene = null
  renderer = null
  stats = null
  contentGroup = null
  transformControls = null
  raycaster = null
  transformHelper = null
  clippingGroup = null
})
</script>

<style lang="scss" scoped>
@use './index.scss';

.matrix-dialog {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.matrix-dialog__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  color: #7fb3ff;
  font-size: 12px;
}

.matrix-dialog__meta span {
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(46, 108, 202, 0.12);
  border: 1px solid rgba(127, 179, 255, 0.2);
}

.matrix-dialog__matrix {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(127, 179, 255, 0.2);
  background: rgba(11, 16, 32, 0.9);
}

.matrix-dialog__label {
  margin-bottom: 8px;
  color: #8dbdff;
  font-size: 12px;
}

.matrix-dialog__lines {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.matrix-dialog__line {
  margin: 0;
  color: #dbe8ff;
  font-size: 13px;
  line-height: 1.6;
  font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace;
  letter-spacing: 0.2px;
}

.matrix-dialog__line--bottom {
  padding-top: 6px;
  border-top: 1px dashed rgba(127, 179, 255, 0.25);
}

.matrix-dialog__raw {
  border-radius: 8px;
  border: 1px solid rgba(127, 179, 255, 0.2);
  background: rgba(11, 16, 32, 0.6);
  overflow: hidden;
}

.matrix-dialog__raw summary {
  cursor: pointer;
  padding: 10px 12px;
  font-size: 13px;
  color: #a5c8ff;
  user-select: none;
}

.matrix-dialog__raw[open] summary {
  border-bottom: 1px solid rgba(127, 179, 255, 0.2);
}

.matrix-dialog__content {
  margin: 0;
  max-height: 260px;
  overflow: auto;
  padding: 12px;
  background: transparent;
  color: #dbe8ff;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
<style>
.el-popper.bpa-right-popper {
  background: rgba(6, 12, 28, 0.55) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);

  border: 1px solid rgba(64, 158, 255, 0.35);

  box-shadow:
    0 0 0 1px rgba(64, 158, 255, 0.15),
    0 12px 32px rgba(0, 0, 0, 0.6),
    0 0 24px rgba(64, 158, 255, 0.25);
}

.el-popper.bpa-right-popper .el-select-dropdown {
  background: transparent;
}

.el-popper.bpa-right-popper .el-select-dropdown__item {
  color: rgba(120, 190, 255, 0.85);
}

.el-popper.bpa-right-popper .el-select-dropdown__item:hover {
  background: linear-gradient(
    90deg,
    rgba(64, 158, 255, 0.05),
    rgba(64, 158, 255, 0.18),
    rgba(64, 158, 255, 0.05)
  );
}

.el-popper.bpa-right-popper .el-select-dropdown__item.selected {
  background: rgba(64, 158, 255, 0.28);
  color: #fff;
}
</style>
