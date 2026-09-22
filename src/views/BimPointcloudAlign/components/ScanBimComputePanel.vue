<template>
  <div class="scan-bim-compute">
    <template v-if="showRemeshSection">
      <div class="section-title">网格均匀化</div>

      <div
        class="mesh-remesh-summary"
        :class="`mesh-remesh-summary--${remeshSummaryTone}`"
      >
        <span class="mesh-remesh-summary__icon" aria-hidden="true">
          {{ remeshSummaryIcon }}
        </span>
        <div>
          <strong>{{ remeshSummaryTitle }}</strong>
          <span>{{ remeshSummaryDesc }}</span>
        </div>
      </div>

      <details class="mesh-remesh-advanced">
        <summary>
          <span class="mesh-remesh-advanced__title">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <circle cx="9" cy="6" r="2" fill="white" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <circle cx="15" cy="12" r="2" fill="white" />
              <line x1="4" y1="18" x2="20" y2="18" />
              <circle cx="7" cy="18" r="2" fill="white" />
            </svg>
            高级操作
          </span>
        </summary>
        <div class="mesh-remesh-advanced__body">
          <!-- 算法选择 -->
          <div class="compute-row algo-row">
            <span class="compute-label">算法</span>
            <el-select
              v-model="selectedAlgorithm"
              size="small"
              :disabled="!canConfigureRemesh"
              style="flex: 1"
              @change="handleAlgorithmChange"
            >
              <el-option
                v-for="algo in algorithms"
                :key="algo.name"
                :label="algo.label"
                :value="algo.name"
              />
            </el-select>
          </div>

          <!-- 目标边长（主参数） -->
          <div class="compute-row">
            <el-tooltip
              content="Isotropic 目标边长（米）。边长收敛至 [0.8t, 1.33t]，均值 ~t。建议 ≥ 0.05m"
              placement="top"
              :show-after="300"
            >
              <span class="compute-label compute-label--hint">
                目标边长 (m)
              </span>
            </el-tooltip>
            <el-input-number
              v-model="targetEdgeLength"
              :min="0.05"
              :max="5"
              :step="0.05"
              :precision="3"
              :controls="true"
              size="small"
              :disabled="!canConfigureRemesh"
            />
          </div>
          <div class="edge-length-hint">
            最小 5cm（0.05m）。细分+Isotropic 算法默认阈值系数
            2.0，边长均匀收敛至 [0.8t, 1.33t]。
          </div>

          <!-- 高级选项（折叠） -->
          <div class="advanced-block">
            <button
              class="advanced-toggle"
              @click="showAdvanced = !showAdvanced"
            >
              <span>高级选项</span>
              <svg
                class="advanced-toggle__chevron"
                :class="{ 'is-open': showAdvanced }"
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
            <div v-show="showAdvanced" class="advanced-content">
              <template v-for="param in advancedParams" :key="param.key">
                <div v-show="isParamVisible(param)" class="compute-row">
                  <el-tooltip
                    :content="(param as any).tooltip"
                    :disabled="!(param as any).tooltip"
                    placement="top"
                    :show-after="300"
                  >
                    <span
                      class="compute-label"
                      :class="{ 'compute-label--hint': (param as any).tooltip }"
                    >
                      {{ param.label }}
                    </span>
                  </el-tooltip>
                  <el-switch
                    v-if="param.type === 'bool'"
                    v-model="boolValues[param.key]"
                    :disabled="!canConfigureRemesh"
                  />
                  <el-input-number
                    v-else
                    v-model="
                      (paramValues as Record<string, number | undefined>)[
                        param.key
                      ]
                    "
                    :min="param.min"
                    :max="param.max"
                    :step="param.type === 'int' ? 1 : 0.1"
                    :precision="param.type === 'int' ? 0 : 3"
                    :controls="true"
                    size="small"
                    :disabled="!canConfigureRemesh"
                  />
                </div>
              </template>
              <div class="compute-row compute-actions--reset">
                <el-button
                  size="small"
                  :disabled="running"
                  @click="handleResetParams"
                >
                  重置参数
                </el-button>
              </div>
            </div>
          </div>

          <!-- 操作按钮（重新布局：主操作 + 加载结果 + 重置） -->
          <div class="remesh-actions">
            <el-button
              v-if="!running"
              class="remesh-actions__primary"
              type="primary"
              :disabled="!canRunRemesh"
              @click="handleRun"
            >
              {{ remeshActionText }}
            </el-button>
            <el-button
              v-else
              class="remesh-actions__primary"
              type="danger"
              @click="handleStop"
            >
              停止计算
            </el-button>

            <el-button
              class="remesh-actions__load"
              :loading="loadingToScene"
              :disabled="!remeshReadyToUse || running"
              @click="handleLoadHistory"
            >
              {{ meshLoaded ? '重新加载结果' : '加载结果' }}
            </el-button>

            <el-button
              v-if="
                !running &&
                (remeshStatus?.status === 'processing' ||
                  remeshStatus?.status === 'queued')
              "
              class="remesh-actions__reset"
              type="warning"
              :loading="resettingRemesh"
              @click="handleResetRemesh"
            >
              重置任务
            </el-button>
          </div>

          <!-- 结果操作与可视化（统一成一行，分组更清晰） -->
          <div v-if="meshLoaded || result" class="remesh-result-bar">
            <div class="remesh-result-bar__group">
              <el-button
                size="small"
                :loading="downloadingPly"
                :disabled="!remeshReadyToUse"
                @click="handleDownloadPly"
              >
                下载 PLY
              </el-button>
              <el-button
                size="small"
                type="success"
                :loading="loadingToScene"
                :disabled="!remeshReadyToUse"
                @click="handleLoadToScene"
              >
                加载到场景
              </el-button>
            </div>
            <div v-if="meshLoaded" class="remesh-result-bar__group">
              <el-button
                size="small"
                :type="solidHidden ? 'default' : 'warning'"
                @click="emit('toggle-solid')"
              >
                {{ solidHidden ? '显示模型' : '隐藏模型' }}
              </el-button>
              <el-tooltip
                :disabled="wireAvailable !== false"
                content="面片数超过阈值，线框已跳过（面数过多时线框无实际意义）"
                placement="top"
                :show-after="100"
              >
                <el-button
                  v-if="wireAvailable !== false"
                  size="small"
                  :type="wireHidden ? 'default' : 'success'"
                  @click="emit('toggle-wire')"
                >
                  {{ wireHidden ? '显示线框' : '隐藏线框' }}
                </el-button>
                <el-button v-else size="small" disabled>线框不可用</el-button>
              </el-tooltip>
              <el-button
                size="small"
                type="danger"
                plain
                @click="emit('clear-remesh')"
              >
                清空结果
              </el-button>
            </div>
          </div>

          <div v-if="result" class="compute-result">
            <div class="result-header">
              <span class="result-title">处理结果</span>
            </div>
            <div class="result-grid">
              <span class="result-cell head" />
              <span class="result-cell head">处理前</span>
              <span class="result-cell head">处理后</span>
              <span class="result-cell label">顶点数</span>
              <span class="result-cell">
                {{ result.stats.vertexBefore.toLocaleString() }}
              </span>
              <span class="result-cell">
                {{ result.stats.vertexAfter.toLocaleString() }}
              </span>
              <span class="result-cell label">面数</span>
              <span class="result-cell">
                {{ result.stats.faceBefore.toLocaleString() }}
              </span>
              <span class="result-cell">
                {{ result.stats.faceAfter.toLocaleString() }}
              </span>
            </div>
          </div>
        </div>
      </details>

      <div v-if="errorMsg" class="compute-error">
        {{ errorMsg }}
      </div>
    </template>

    <template v-if="showC2mSection">
      <!-- ───────── Scan vs BIM 快速预估（对齐参考项目第二步 偏差对比） ───────── -->
      <div v-if="showRemeshSection" class="section-divider" />
      <div class="section-title c2m-panel__title">Scan vs BIM 快速预估</div>

      <div v-if="c2mServerHydratedHint" class="history-bar c2m-history-hint">
        <span class="history-text">
          已从服务端恢复上次统计（重新计算将覆盖）
        </span>
      </div>

      <section class="c2m-primary-card" aria-label="快速预估主要操作">
        <div class="c2m-primary-toggle">
          <span>
            <i aria-hidden="true" />
            启用降采样
          </span>
          <el-switch
            v-model="c2mDownsampleEnabled"
            size="small"
            :disabled="!c2mCanRun"
            aria-label="启用 C2M 点云降采样"
          />
        </div>
        <label class="c2m-primary-field">
          <span>
            降采样距离
            <small>单位 m</small>
          </span>
          <el-input-number
            v-model="c2mVoxelSize"
            :min="0.001"
            :max="1"
            :step="0.001"
            :precision="3"
            size="small"
            :disabled="!c2mCanRun || !c2mDownsampleEnabled || c2mRunning"
          />
        </label>
        <el-button
          class="c2m-run-button"
          type="primary"
          :loading="c2mRunning"
          :disabled="!c2mCanRun"
          @click="handleC2MRun"
        >
          <el-icon><Promotion /></el-icon>
          开始快速预估
        </el-button>
        <p v-if="!hasRemeshResult" class="c2m-search-hint">
          需先完成 BIM 网格均匀化（本页下方「网格均匀化」）。
        </p>
      </section>

      <details class="c2m-advanced-card" open>
        <summary>
          <span>
            <el-icon><Setting /></el-icon>
            高级操作
          </span>
          <el-icon class="c2m-advanced-card__arrow"><ArrowDown /></el-icon>
        </summary>
        <div class="c2m-advanced-card__body">
          <div class="c2m-preset-block">
            <span class="c2m-preset-block__label">
              预估范围
              <small>单位 mm</small>
            </span>
            <div
              class="c2m-range-presets"
              role="group"
              aria-label="配色色域预设，单位毫米"
            >
              <el-button size="small" @click="selectC2MRangePreset('auto')">
                自动
              </el-button>
              <el-button size="small" @click="selectC2MRangePreset('50')">
                ±50
              </el-button>
              <el-button size="small" @click="selectC2MRangePreset('100')">
                ±100
              </el-button>
              <el-button size="small" @click="selectC2MRangePreset('200')">
                ±200
              </el-button>
              <el-button size="small" @click="selectC2MRangePreset('full')">
                全范围
              </el-button>
            </div>
          </div>

          <div class="c2m-secondary-settings" aria-label="偏差显示参数">
            <div class="c2m-setting-row">
              <span class="c2m-setting-row__icon">
                <el-icon><Brush /></el-icon>
              </span>
              <span class="c2m-setting-row__label">
                配色范围 ±C
                <small>mm</small>
              </span>
              <el-input-number
                v-model="c2mColorRangeMm"
                :min="10"
                :max="10000"
                :step="10"
                :precision="0"
                size="small"
                aria-label="配色色域半宽，单位毫米"
                @change="onC2MColorRangeChange"
              />
            </div>
            <div class="c2m-setting-row c2m-follow-row">
              <span class="c2m-setting-row__icon">
                <el-icon><Grid /></el-icon>
              </span>
              <span class="c2m-setting-row__label">直方图跟随配色</span>
              <el-switch
                v-model="c2mHistogramFollowsColor"
                size="small"
                aria-label="直方图范围跟随配色色域"
              />
            </div>
            <div class="c2m-setting-row">
              <span class="c2m-setting-row__icon">
                <el-icon><FullScreen /></el-icon>
              </span>
              <span class="c2m-setting-row__label">
                直方图范围 ±H
                <small>mm</small>
              </span>
              <el-input-number
                v-model="c2mHistogramRangeMm"
                :min="10"
                :max="10000"
                :step="10"
                :precision="0"
                size="small"
                :disabled="c2mHistogramFollowsColor"
                aria-label="直方图视窗半宽，单位毫米"
              />
            </div>
            <div class="c2m-setting-row">
              <span class="c2m-setting-row__icon">
                <el-icon><Aim /></el-icon>
              </span>
              <span class="c2m-setting-row__label">
                工程容差 ±T
                <small>mm</small>
              </span>
              <el-input-number
                v-model="c2mToleranceMm"
                :min="1"
                :max="c2mColorRangeMm"
                :step="1"
                :precision="0"
                size="small"
                aria-label="工程容差半宽，单位毫米"
              />
            </div>
          </div>

          <div class="c2m-setting-row">
            <span class="c2m-setting-row__icon">
              <el-icon><Histogram /></el-icon>
            </span>
            <span class="c2m-setting-row__label">直方图桶数</span>
            <el-input-number
              v-model="c2mHistBins"
              :min="10"
              :max="200"
              :step="10"
              :precision="0"
              size="small"
              aria-label="直方图桶数"
            />
          </div>

          <!-- 法向约束高级参数（折叠） -->
          <div class="advanced-block">
            <button
              class="advanced-toggle"
              @click="c2mShowNormalAdvanced = !c2mShowNormalAdvanced"
            >
              <span>法向量约束（高级）</span>
              <svg
                class="advanced-toggle__chevron"
                :class="{ 'is-open': c2mShowNormalAdvanced }"
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
            <div v-show="c2mShowNormalAdvanced" class="advanced-content">
              <div class="compute-row">
                <el-tooltip
                  content="启用后使用 kNN 候选点 + 法向方向筛选，抑制背侧噪声点干扰。关闭时退化为原始 1-NN。"
                  placement="top"
                  :show-after="300"
                >
                  <span class="compute-label compute-label--hint">
                    法向约束
                  </span>
                </el-tooltip>
                <el-switch
                  v-model="c2mNormalConstraintEnabled"
                  :disabled="!c2mCanRun || c2mRunning"
                />
              </div>
              <template v-if="c2mNormalConstraintEnabled">
                <div class="compute-row">
                  <el-tooltip
                    content="每个顶点取 k 个候选最近邻，从符合法向约束的候选中选最近者。建议 8~16。"
                    placement="top"
                    :show-after="300"
                  >
                    <span class="compute-label compute-label--hint">
                      候选邻居 k
                    </span>
                  </el-tooltip>
                  <el-input-number
                    v-model="c2mKnnK"
                    :min="2"
                    :max="32"
                    :step="1"
                    :precision="0"
                    size="small"
                    :disabled="!c2mCanRun || c2mRunning"
                  />
                </div>
                <div class="compute-row">
                  <el-tooltip
                    content="仅保留位于顶点外法线前半空间的候选点（dot(N, vec) ≥ 0）。关闭后仅用夹角阈值过滤。"
                    placement="top"
                    :show-after="300"
                  >
                    <span class="compute-label compute-label--hint">
                      前半空间
                    </span>
                  </el-tooltip>
                  <el-switch
                    v-model="c2mNormalHalfSpaceOnly"
                    :disabled="!c2mCanRun || c2mRunning"
                  />
                </div>
                <div class="compute-row">
                  <el-tooltip
                    content="法向量与候选点方向的夹角上限（度）。超过此角度的候选点被过滤。建议 60~80°。"
                    placement="top"
                    :show-after="300"
                  >
                    <span class="compute-label compute-label--hint">
                      夹角上限 (°)
                    </span>
                  </el-tooltip>
                  <el-input-number
                    v-model="c2mNormalMaxAngleDeg"
                    :min="10"
                    :max="90"
                    :step="5"
                    :precision="0"
                    size="small"
                    :disabled="!c2mCanRun || c2mRunning"
                  />
                </div>
              </template>
            </div>
          </div>

          <el-button
            class="c2m-apply-button"
            size="small"
            :loading="c2mRecoloring"
            :disabled="!canRecolorC2M"
            @click="handleC2MRecolor"
          >
            <el-icon><CircleCheck /></el-icon>
            {{ c2mSettingsDirty ? '应用配色与分布' : '当前设置已应用' }}
          </el-button>
          <div class="c2m-actions">
            <el-button
              size="small"
              :disabled="!c2mResult || c2mRunning"
              @click="handleLoadC2MPly"
            >
              <el-icon><Download /></el-icon>
              加载到场景
            </el-button>
            <el-button
              size="small"
              :disabled="!props.meshLoaded"
              @click="handleClearC2MScene"
            >
              <el-icon><Delete /></el-icon>
              清空场景
            </el-button>
          </div>
        </div>
      </details>

      <div v-if="c2mError" class="mesh-remesh-error">{{ c2mError }}</div>

      <details v-if="c2mResult" class="c2m-result-card" open>
        <summary>
          <span>
            <el-icon><Histogram /></el-icon>
            结果
          </span>
          <el-icon class="c2m-result-card__arrow"><ArrowDown /></el-icon>
        </summary>
        <div class="c2m-result-card__body">
          <div
            v-if="c2mResult.diagnostics?.bboxOverlapIoU < 0.3"
            class="c2m-result-warning"
            role="status"
          >
            BBox 重叠度低于
            30%，当前配准可能偏离，请先检查模型位置再判断偏差结果。
          </div>
          <div class="c2m-result-summary">
            <div>
              点云降采样：{{ c2mResult.pointsBefore.toLocaleString() }} →
              {{ c2mResult.pointsAfter.toLocaleString() }}
            </div>
            <div>
              Min / Max：{{ c2mResult.stats.min.toFixed(4) }} m /
              {{ c2mResult.stats.max.toFixed(4) }} m
            </div>
            <div>
              Mean / P95：{{ c2mResult.stats.mean.toFixed(4) }} m /
              {{ c2mResult.stats.p95.toFixed(4) }} m
            </div>
            <div>
              Std：{{ c2mResult.stats.std.toFixed(4) }} m · 合格界限 ±{{
                Math.round(c2mToleranceLimit * 1000)
              }}
              mm
            </div>
          </div>

          <!-- 迷你直方图（有本地距离数组时用当前范围/分段重算） -->
          <div v-if="displayHistogram" class="c2m-histogram">
            <svg
              :viewBox="`0 0 ${histWidth} ${histHeight}`"
              class="c2m-histogram-svg"
            >
              <line
                :x1="histWidth / 2"
                y1="0"
                :x2="histWidth / 2"
                :y2="histHeight"
                stroke="var(--border-color)"
                stroke-width="1"
              />
              <rect
                v-for="(count, i) in displayHistogram.counts"
                :key="'b' + i"
                :x="i * barW"
                :y="histHeight - (count / histMaxCount) * histHeight"
                :width="Math.max(barW - 1, 1)"
                :height="(count / histMaxCount) * histHeight"
                :fill="histBarColor(i)"
              />
            </svg>
            <div class="c2m-histogram-labels">
              <span class="c2m-hist-neg">-{{ c2mVizMaxDistance }}m</span>
              <span>0</span>
              <span class="c2m-hist-pos">+{{ c2mVizMaxDistance }}m</span>
            </div>
          </div>

          <div class="c2m-panel-tip">
            <strong>提示：</strong>
            调整参数后点击「应用配色与分布」即可查看更新效果，建议从默认值开始微调。
          </div>
        </div>
      </details>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Aim,
  ArrowDown,
  Brush,
  CircleCheck,
  Delete,
  Download,
  FullScreen,
  Grid,
  Histogram,
  Promotion,
  Setting,
} from '@element-plus/icons-vue'
import {
  getRemeshAlgorithms,
  getRemeshStatus,
  getRemeshResultUrl,
  remeshBimFile,
  resetRemeshTask,
  type AlgorithmDesc,
  type AlgorithmParamDesc,
  type ParamVisibleWhen,
  type RemeshResult,
  type RemeshStatusResponse,
  type RemeshStats,
} from '@/api/mesh'
import { getToken, formatToken, getOrganizationId } from '@/utils/auth'
import {
  computeC2M,
  recolorC2M,
  getC2MColoredPlyUrl,
  getC2MDistancesUrl,
  getC2MLatest,
  type C2MComputeResult,
} from '@/api/c2m'
import { histogramFromDistances } from '@/utils/c2mColormap'

export type C2MLoadPayload = {
  plyUrl: string
  distancesUrl: string
  bimFileId: number
  maxColormap: number
}

const props = defineProps<{
  projectId: number
  bimFileId: number
  scanId: number
  hasAlignment?: boolean
  meshLoaded?: boolean
  solidHidden?: boolean
  wireHidden?: boolean
  /** 面片过多时 WireframeGeometry 会 Set overflow，由父组件置 false，此时隐藏线框按钮 */
  wireAvailable?: boolean
  /** 父组件加载 C2M 后的 per-vertex 距离（与 PLY 顶点顺序一致），用于本地直方图 */
  c2mDistances?: Float32Array | null
  /** 只渲染指定分区：工作流分步时用于把「网格均匀化」与「偏差对比」拆到不同步骤 */
  section?: 'all' | 'remesh' | 'c2m'
}>()

const showRemeshSection = computed(
  () => !props.section || props.section === 'all' || props.section === 'remesh',
)
const showC2mSection = computed(
  () => !props.section || props.section === 'all' || props.section === 'c2m',
)

const emit = defineEmits<{
  (e: 'load-remesh', url: string): void
  (e: 'clear-remesh'): void
  (e: 'toggle-solid'): void
  (e: 'toggle-wire'): void
  (e: 'load-c2m-ply', payload: C2MLoadPayload): void
  (e: 'clear-c2m-scene'): void
  (
    e: 'c2m-viz-change',
    p: { maxDist: number; histBins: number; toleranceLimit: number },
  ): void
  /** 计算完成或恢复结果后同步 distances.bin，供直方图/色温调试（无需加载三维） */
  (e: 'c2m-distances-buffer', buf: Float32Array | null): void
}>()

// ---------- 持久化 ----------
interface StoredRemesh {
  projectId: number
  bimFileId: number
  stats: RemeshStats
  algorithm: string
  timestamp: number
}

function storageKey() {
  return `remesh_result_${props.projectId}_${props.bimFileId}`
}

function saveToStorage(stats: RemeshStats, algorithm: string) {
  const data: StoredRemesh = {
    projectId: props.projectId,
    bimFileId: props.bimFileId,
    stats,
    algorithm,
    timestamp: Date.now(),
  }
  try {
    localStorage.setItem(storageKey(), JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

function loadFromStorage(): StoredRemesh | null {
  try {
    const raw = localStorage.getItem(storageKey())
    return raw ? (JSON.parse(raw) as StoredRemesh) : null
  } catch {
    return null
  }
}

// ---------- 算法定义（离线 fallback，与后端 describe_params 保持同步） ----------
const fallbackAlgorithms: AlgorithmDesc[] = [
  {
    name: 'bim_preprocessor',
    label: '细分 + Isotropic（均匀收敛）',
    params: [
      {
        key: 'target_edge_length',
        label: '目标边长 (m)',
        type: 'float',
        default: 0.1,
        min: 0.05,
        tooltip:
          'Isotropic 目标边长（米）。边长收敛至 [0.8t, 1.33t]，均值 ~t。',
      },
      {
        key: 'clean_tolerance',
        label: '清理容差 (m)',
        type: 'float',
        default: 0.005,
        min: 0.0001,
        tooltip: '合并近顶点的距离阈值（米）。默认 5mm。',
      },
      {
        key: 'use_decimation',
        label: '智能瘦身',
        type: 'bool',
        default: true,
        visible_when: null,
        tooltip: '启用 QEM 简化，预先降低面片密度。',
      },
      {
        key: 'decimation_ratio',
        label: '瘦身保留比例',
        type: 'float',
        default: 0.5,
        min: 0.05,
        max: 0.95,
        visible_when: { key: 'use_decimation', value: true },
        tooltip: '目标面数 = 原始面数 × 比例。',
      },
      {
        key: 'subdivision_iterations',
        label: '细分迭代次数',
        type: 'int',
        default: 3,
        min: 0,
        max: 10,
        tooltip: '中点细分轮次，打碎极长边。',
      },
      {
        key: 'subdivision_threshold_ratio',
        label: '细分阈值系数',
        type: 'float',
        default: 2.0,
        min: 1.0,
        max: 4.0,
        tooltip:
          '仅切割 > 目标边长×系数 的边。默认 2.0 是关键约束：细分后最短边 ≥ t > 0.8t，使 collapse 可安全开启。',
      },
      {
        key: 'use_isotropic',
        label: 'Isotropic 重网格化',
        type: 'bool',
        default: true,
        visible_when: null,
        tooltip: '开启后做 split/collapse/swap/smooth/reproject 全套均匀化。',
      },
      {
        key: 'isotropic_collapse',
        label: 'Isotropic 边合并',
        type: 'bool',
        default: true,
        visible_when: { key: 'use_isotropic', value: true },
        tooltip:
          '合并 < 0.8t 的短边，消除碎片感。细分阈值系数 < 2.0 时运行期会自动禁用。',
      },
      {
        key: 'isotropic_iterations',
        label: 'Isotropic 迭代次数',
        type: 'int',
        default: 10,
        min: 1,
        max: 20,
        visible_when: { key: 'use_isotropic', value: true },
        tooltip:
          '等边化迭代次数。基准：5次(区间66.6%/276s)→10次(71.0%/437s)→15次(72.3%/604s)。推荐10-15次。',
      },
      {
        key: 'surface_dist_ratio',
        label: '表面偏差系数',
        type: 'float',
        default: 0.5,
        min: 0.01,
        max: 2.0,
        visible_when: { key: 'use_isotropic', value: true },
        tooltip: 'maxsurfdist = 目标边长 × 系数。',
      },
      {
        key: 'sliver_merge_ratio',
        label: '薄片合并系数',
        type: 'float',
        default: 0.03,
        min: 0.0,
        max: 0.1,
        visible_when: { key: 'use_isotropic', value: true },
        tooltip:
          '后处理短边合并阈值系数，实际阈值 = min(目标边长×系数, clean_tolerance)。默认 0.03 更保守。',
      },
      {
        key: 'sliver_relax_checksurfdist',
        label: '薄片后处理放宽保形',
        type: 'bool',
        default: true,
        visible_when: { key: 'use_isotropic', value: true },
        tooltip:
          '控制薄片后处理阶段 checksurfdist。默认 true（保形优先）；设为 false 时去薄片更激进但偏移风险更高。',
      },
      {
        key: 'adaptive',
        label: '自适应采样',
        type: 'bool',
        default: true,
        visible_when: { key: 'use_isotropic', value: true },
        tooltip:
          '曲率高处（MEP 管道/圆柱）边更短。对纯平面模型开/关无区别且耗时相同，含圆柱构件时建议开启。',
      },
      {
        key: 'crease_angle',
        label: '折角保护阈值 (°)',
        type: 'float',
        default: 60.0,
        min: 0.0,
        max: 90.0,
        visible_when: { key: 'use_isotropic', value: true },
        tooltip: '超过此角度的边视为硬边并保留。',
      },
    ],
  },
  {
    name: 'bim_isotropic_only',
    label: '纯 Isotropic（无细分，慢但更均匀）',
    params: [
      {
        key: 'target_edge_length',
        label: '目标边长 (m)',
        type: 'float',
        default: 0.1,
        min: 0.05,
        tooltip:
          'Isotropic 目标边长（米）。无细分预处理时对极端长边需更多迭代。',
      },
      {
        key: 'clean_tolerance',
        label: '清理容差 (m)',
        type: 'float',
        default: 0.005,
        min: 0.0001,
        tooltip: '合并近顶点的距离阈值（米）。',
      },
      {
        key: 'use_decimation',
        label: '智能瘦身',
        type: 'bool',
        default: true,
        visible_when: null,
        tooltip:
          '强烈建议开启：预降面密度，减少 Isotropic 需处理的极长边数量。',
      },
      {
        key: 'decimation_ratio',
        label: '瘦身保留比例',
        type: 'float',
        default: 0.5,
        min: 0.05,
        max: 0.95,
        visible_when: { key: 'use_decimation', value: true },
        tooltip: '目标面数 = 原始面数 × 比例。',
      },
      {
        key: 'isotropic_iterations',
        label: 'Isotropic 迭代次数',
        type: 'int',
        default: 15,
        min: 1,
        max: 20,
        tooltip:
          '等边化迭代次数。★最优：15次(区间74.6%/450s)。10次(72.8%/269s)性价比也高。注意：超过15次反而退化！',
      },
      {
        key: 'surface_dist_ratio',
        label: '表面偏差系数',
        type: 'float',
        default: 0.5,
        min: 0.01,
        max: 2.0,
        tooltip: 'maxsurfdist = 目标边长 × 系数。',
      },
      {
        key: 'sliver_merge_ratio',
        label: '薄片合并系数',
        type: 'float',
        default: 0.03,
        min: 0.0,
        max: 0.1,
        tooltip:
          '后处理短边合并阈值系数，实际阈值 = min(目标边长×系数, clean_tolerance)。默认 0.03 更保守。',
      },
      {
        key: 'sliver_relax_checksurfdist',
        label: '薄片后处理放宽保形',
        type: 'bool',
        default: true,
        tooltip:
          '控制薄片后处理阶段 checksurfdist。默认 true（保形优先）；设为 false 时去薄片更激进但偏移风险更高。',
      },
      {
        key: 'adaptive',
        label: '自适应采样',
        type: 'bool',
        default: true,
        tooltip:
          '曲率高处（MEP 管道/圆柱）边更短。对纯平面模型开/关无区别且耗时相同，含圆柱构件时建议开启。',
      },
      {
        key: 'crease_angle',
        label: '折角保护阈值 (°)',
        type: 'float',
        default: 60.0,
        min: 0.0,
        max: 90.0,
        tooltip: '超过此角度的边视为硬边并保留。',
      },
    ],
  },
]

// ---------- state ----------
const algorithms = ref<AlgorithmDesc[]>([])
const showAdvanced = ref(false)

/** 当前选中的算法名 */
const selectedAlgorithm = ref('bim_preprocessor')

/** 目标边长（主参数，与后端默认 0.1m 对齐；UI 最小 0.05m） */
const targetEdgeLength = ref(0.1)

const paramValues = ref<Record<string, number | undefined>>({})
const boolValues = ref<Record<string, boolean>>({})
const running = ref(false)
const abortController = ref<AbortController | null>(null)
const loadingToScene = ref(false)
const result = ref<RemeshResult | null>(null)
const errorMsg = ref('')
const storedResult = ref<StoredRemesh | null>(null)
const remeshStatus = ref<RemeshStatusResponse | null>(null)
const remeshStatusLoading = ref(false)
let remeshStatusPollingTimer: number | null = null

const remeshSupported = computed(() => remeshStatus.value?.supported !== false)
const remeshReadyToUse = computed(
  () =>
    remeshStatus.value?.status === 'succeeded' ||
    !!result.value ||
    !!storedResult.value,
)
const remeshStatusLabel = computed(() => {
  const textMap: Record<string, string> = {
    queued: '排队中',
    processing: '处理中',
    succeeded: '已完成',
    failed: '已失败',
  }
  return textMap[remeshStatus.value?.status || ''] || '状态未知'
})
const remeshStatusTagType = computed(() => {
  const typeMap: Record<
    string,
    'warning' | 'primary' | 'success' | 'danger' | 'info'
  > = {
    queued: 'warning',
    processing: 'primary',
    succeeded: 'success',
    failed: 'danger',
  }
  return typeMap[remeshStatus.value?.status || ''] || 'info'
})
const remeshStatusTone = computed(() => {
  if (remeshStatus.value?.supported === false) return 'neutral'
  const toneMap: Record<string, string> = {
    queued: 'warning',
    processing: 'primary',
    succeeded: 'success',
    failed: 'danger',
  }
  return toneMap[remeshStatus.value?.status || ''] || 'neutral'
})
const remeshStatusSummary = computed(() => {
  if (remeshStatusLoading.value) return '正在读取均匀化状态...'
  if (remeshStatus.value?.supported === false)
    return '当前 BIM 文件不支持网格均匀化'
  if (remeshStatus.value?.status === 'queued')
    return '均匀化任务已排队，等待处理'
  if (remeshStatus.value?.status === 'processing') return '均匀化任务正在处理中'
  if (remeshStatus.value?.status === 'succeeded') return '均匀化结果已可用'
  if (remeshStatus.value?.status === 'failed') return '均匀化处理失败'
  return ''
})
const remeshStatusDescription = computed(() => {
  if (remeshStatus.value?.supported === false) {
    return '仅 BIM + IFC 源文件支持该能力。'
  }
  if (remeshStatus.value?.status === 'failed') {
    return remeshStatus.value.lastError || '可根据当前参数手动重试。'
  }
  if (remeshStatus.value?.status === 'processing') {
    return '处理中时不可重复触发，可稍后刷新或等待自动轮询完成。'
  }
  if (remeshStatus.value?.status === 'queued') {
    return '文件上传后会先完成 BIM 转换，再自动进入均匀化处理。'
  }
  return ''
})
/** 作用：网格均匀化摘要卡片的状态色调（对齐参考项目 mesh-remesh-summary）。 */
const remeshSummaryTone = computed(() => {
  if (remeshReadyToUse.value) return 'succeeded'
  const status = remeshStatus.value?.status
  if (status === 'succeeded') return 'succeeded'
  if (status === 'queued') return 'queued'
  if (status === 'processing') return 'processing'
  if (status === 'failed') return 'failed'
  return 'idle'
})
const remeshSummaryIcon = computed(() => {
  if (remeshReadyToUse.value) return '✓'
  const status = remeshStatus.value?.status
  if (running.value || status === 'processing' || status === 'queued')
    return '…'
  if (status === 'failed') return '!'
  return '○'
})
const remeshSummaryTitle = computed(() =>
  remeshReadyToUse.value
    ? 'BIM 网格已自动均匀化'
    : remeshStatusSummary.value || '等待网格均匀化',
)
const remeshSummaryDesc = computed(() =>
  remeshReadyToUse.value
    ? '上传 BIM 时已由系统处理，可直接用于后续分析。'
    : remeshStatusDescription.value || '等待系统生成均匀化网格。',
)

const canConfigureRemesh = computed(() => {
  return (
    !!props.projectId &&
    !!props.bimFileId &&
    !running.value &&
    remeshSupported.value &&
    remeshStatus.value?.status !== 'processing' &&
    remeshStatus.value?.status !== 'queued'
  )
})
const canRunRemesh = computed(() => {
  if (!props.projectId || !props.bimFileId || running.value) return false
  if (remeshStatusLoading.value) return false
  if (remeshStatus.value?.supported === false) return false
  if (
    remeshStatus.value?.status === 'queued' ||
    remeshStatus.value?.status === 'processing'
  )
    return false
  if (remeshStatus.value?.status === 'succeeded') return false
  if (remeshStatus.value?.status === 'failed') {
    return !!remeshStatus.value.canManualRetry
  }
  return true
})
const remeshActionText = computed(() => {
  if (running.value) return '处理中...'
  if (remeshStatusLoading.value) return '读取状态中...'
  if (remeshStatus.value?.supported === false) return '当前文件不支持'
  if (remeshStatus.value?.status === 'queued') return '已排队'
  if (remeshStatus.value?.status === 'processing') return '处理中'
  if (remeshStatus.value?.status === 'failed')
    return remeshStatus.value.canManualRetry ? '重新均匀化' : '不可重试'
  if (remeshStatus.value?.status === 'succeeded') return '均匀化已完成'
  return '开始均匀化'
})

/** 当前算法所有参数（排除 target_edge_length，它独立管理） */
const advancedParams = computed<AlgorithmParamDesc[]>(() => {
  const algo = algorithms.value.find((a) => a.name === selectedAlgorithm.value)
  return (algo?.params ?? []).filter((p) => p.key !== 'target_edge_length')
})

function isParamVisible(param: AlgorithmParamDesc): boolean {
  const rule = (param as any).visible_when as
    | ParamVisibleWhen
    | null
    | undefined
  if (!rule) return true
  if (rule.key in boolValues.value)
    return boolValues.value[rule.key] === rule.value
  if (rule.key in paramValues.value)
    return paramValues.value[rule.key] === rule.value
  return true
}

function initParamDefaults() {
  const algo = algorithms.value.find((a) => a.name === selectedAlgorithm.value)
  const params = algo?.params ?? []
  const newVals: Record<string, number | undefined> = {}
  const newBools: Record<string, boolean> = {}
  for (const p of params) {
    if (p.key === 'target_edge_length') {
      targetEdgeLength.value = (p.default as number) ?? 0.1
    } else if (p.type === 'bool') {
      newBools[p.key] = (p.default as boolean) ?? false
    } else {
      newVals[p.key] = (p.default as number) ?? undefined
    }
  }
  paramValues.value = newVals
  boolValues.value = newBools
}

function handleAlgorithmChange() {
  initParamDefaults()
  result.value = null
  errorMsg.value = ''
}

function clearRemeshStatusPolling() {
  if (remeshStatusPollingTimer) {
    window.clearTimeout(remeshStatusPollingTimer)
    remeshStatusPollingTimer = null
  }
}

function scheduleRemeshStatusPolling() {
  clearRemeshStatusPolling()
  if (
    remeshStatus.value?.status === 'queued' ||
    remeshStatus.value?.status === 'processing'
  ) {
    remeshStatusPollingTimer = window.setTimeout(() => {
      void fetchRemeshStatus(false)
    }, 4000)
  }
}

async function fetchRemeshStatus(showError = false) {
  if (!props.projectId || !props.bimFileId) {
    remeshStatus.value = null
    clearRemeshStatusPolling()
    return
  }

  remeshStatusLoading.value = true
  try {
    const prevStatus = remeshStatus.value?.status
    const res = await getRemeshStatus(props.projectId, props.bimFileId)
    remeshStatus.value = res.data
    errorMsg.value =
      res.data?.status === 'failed' ? res.data.lastError || '' : ''
    scheduleRemeshStatusPolling()
    if (
      (prevStatus === 'queued' || prevStatus === 'processing') &&
      res.data?.status === 'succeeded'
    ) {
      ElMessage.success('网格均匀化计算完成！')
      storedResult.value = loadFromStorage()
    }
  } catch (e: any) {
    clearRemeshStatusPolling()
    if (showError) {
      ElMessage.error(
        e?.response?.data?.msg || e?.message || '获取均匀化状态失败',
      )
    }
  } finally {
    remeshStatusLoading.value = false
  }
}

async function ensureRemeshResultAvailable() {
  await fetchRemeshStatus()

  if (remeshStatus.value?.supported === false) {
    ElMessage.warning('当前文件不支持网格均匀化结果')
    return false
  }
  if (remeshStatus.value?.status === 'queued') {
    ElMessage.info('均匀化任务已排队，请稍后再试')
    return false
  }
  if (remeshStatus.value?.status === 'processing') {
    ElMessage.info('均匀化任务正在处理中，请稍后再试')
    return false
  }
  if (remeshStatus.value?.status === 'failed') {
    ElMessage.warning(
      remeshStatus.value.lastError || '均匀化任务失败，请先重试',
    )
    return false
  }

  return remeshReadyToUse.value
}

async function fetchAlgorithms() {
  if (!props.projectId) return
  try {
    const res = await getRemeshAlgorithms(props.projectId)
    if (res.data?.length) {
      algorithms.value = res.data
    } else {
      algorithms.value = fallbackAlgorithms
    }
  } catch {
    algorithms.value = fallbackAlgorithms
  }
  // 确保 selectedAlgorithm 在列表内；若不在则选第一个
  if (!algorithms.value.find((a) => a.name === selectedAlgorithm.value)) {
    selectedAlgorithm.value = algorithms.value[0]?.name ?? 'bim_preprocessor'
  }
  initParamDefaults()
}

async function handleRun() {
  if (!props.projectId || !props.bimFileId) return
  await fetchRemeshStatus()

  if (!canRunRemesh.value) {
    if (remeshStatus.value?.status === 'succeeded') {
      ElMessage.info('当前文件已有可用的均匀化结果，无需重复执行')
    } else if (
      remeshStatus.value?.status === 'queued' ||
      remeshStatus.value?.status === 'processing'
    ) {
      ElMessage.info('当前均匀化任务正在排队或处理中，请稍后再试')
    } else if (
      remeshStatus.value?.status === 'failed' &&
      !remeshStatus.value?.canManualRetry
    ) {
      ElMessage.warning('当前失败状态不允许手动重试')
    } else if (remeshStatus.value?.supported === false) {
      ElMessage.warning('当前文件不支持网格均匀化')
    }
    return
  }

  const edgeLen = targetEdgeLength.value ?? 0.1
  if (edgeLen < 0.05) {
    ElMessage.warning('目标边长不能小于 5cm（0.05m），请重新设置')
    return
  }

  running.value = true
  result.value = null
  errorMsg.value = ''
  const controller = new AbortController()
  abortController.value = controller
  try {
    const cleaned: Record<string, any> = { target_edge_length: edgeLen }
    for (const [k, v] of Object.entries(paramValues.value)) {
      if (v !== undefined && v !== null) cleaned[k] = v
    }
    for (const [k, v] of Object.entries(boolValues.value)) {
      cleaned[k] = v
    }
    await remeshBimFile(
      props.projectId,
      props.bimFileId,
      { algorithm: selectedAlgorithm.value, params: cleaned, force: true },
      controller.signal,
    )
    ElMessage.success('网格均匀化任务已进入后台队列，正在处理')
    await fetchRemeshStatus()
  } catch (e: any) {
    if (
      e?.name === 'CanceledError' ||
      e?.name === 'AbortError' ||
      e?.code === 'ERR_CANCELED'
    ) {
      ElMessage.info('计算已停止')
    } else {
      const message = e?.response?.data?.msg || e?.message || '处理失败'
      errorMsg.value = message
      if (e?.response?.status === 409) {
        ElMessage.warning(message)
        await fetchRemeshStatus()
      } else {
        ElMessage.error(message)
      }
    }
  } finally {
    running.value = false
    abortController.value = null
  }
}

const resettingRemesh = ref(false)

async function handleResetRemesh() {
  if (!props.projectId || !props.bimFileId) return
  try {
    await ElMessageBox.confirm(
      '确定要重置当前正在处理或排队的网格均匀化任务吗？重置后可重新发起均匀化。',
      '重置任务',
      {
        confirmButtonText: '确定重置',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    resettingRemesh.value = true
    await resetRemeshTask(props.projectId, props.bimFileId)
    await fetchRemeshStatus()
    ElMessage.success('均匀化任务已重置')
  } catch (e: any) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(e?.response?.data?.msg || e?.message || '重置任务失败')
  } finally {
    resettingRemesh.value = false
  }
}

function handleStop() {
  abortController.value?.abort()
}

function handleResetParams() {
  initParamDefaults()
  ElMessage.success('参数已重置为默认值')
}

function getResultUrl() {
  return getRemeshResultUrl(props.projectId, props.bimFileId)
}

async function handleLoadToScene() {
  if (!props.projectId || !props.bimFileId) return
  loadingToScene.value = true
  try {
    const ok = await ensureRemeshResultAvailable()
    if (!ok) return
    emit('load-remesh', getResultUrl())
  } finally {
    loadingToScene.value = false
  }
}

const downloadingPly = ref(false)
async function handleDownloadPly() {
  if (!props.projectId || !props.bimFileId) return
  downloadingPly.value = true
  try {
    const ok = await ensureRemeshResultAvailable()
    if (!ok) return
    const tokenData = getToken()
    const headers: Record<string, string> = {}
    if (tokenData?.accessToken) {
      headers['Authorization'] = formatToken(tokenData.accessToken)
    }
    const orgId = getOrganizationId()
    if (orgId) {
      headers['X-Organization-Id'] = String(orgId)
    }
    const resp = await fetch(getResultUrl(), { headers, cache: 'no-store' })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const blob = await resp.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `remesh_${props.bimFileId}.ply`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch (e: any) {
    ElMessage.error(`下载失败: ${e?.message ?? e}`)
  } finally {
    downloadingPly.value = false
  }
}

function handleLoadHistory() {
  void handleLoadToScene()
}

watch(
  () => [props.projectId, props.bimFileId],
  () => {
    storedResult.value = loadFromStorage()
    fetchAlgorithms()
    void fetchRemeshStatus()
  },
)

onMounted(() => {
  storedResult.value = loadFromStorage()
  if (props.projectId) fetchAlgorithms()
  void fetchRemeshStatus()
})

onBeforeUnmount(() => {
  clearRemeshStatusPolling()
})

// ── C2M (Cloud-to-Mesh Distance) ──────────────────────────────────────

const c2mVoxelSize = ref(0.05)
/** 快速预估：是否启用降采样（对齐参考项目第二步） */
const c2mDownsampleEnabled = ref(true)
/** 直方图范围是否跟随配色色域 */
const c2mHistogramFollowsColor = ref(true)
/** 直方图视窗半宽（mm） */
const c2mHistogramRangeMm = ref(100)
/** 配色设置是否已修改（用于「应用配色与分布」按钮文案） */
const c2mSettingsDirty = ref(false)
/** 配色范围半宽（mm）↔ 内部显示上限（m） */
const c2mColorRangeMm = computed<number>({
  get: () => Math.round(c2mVizMaxDistance.value * 1000),
  set: (value: number) => {
    const next = Number(value)
    if (!Number.isFinite(next)) return
    c2mVizMaxDistance.value = Math.max(0.001, next / 1000)
    c2mSettingsDirty.value = true
  },
})
/** 工程容差（mm）↔ 内部合格界限（m） */
const c2mToleranceMm = computed<number>({
  get: () => Math.round(c2mToleranceLimit.value * 1000),
  set: (value: number) => {
    const next = Number(value)
    if (!Number.isFinite(next)) return
    c2mToleranceLimit.value = Math.max(0.001, next / 1000)
    c2mSettingsDirty.value = true
  },
})
/** 显示上限（米），默认 10cm */
const c2mVizMaxDistance = ref(0.1)
const c2mHistBins = ref(50)

// 法向约束参数
const c2mShowNormalAdvanced = ref(false)
const c2mNormalConstraintEnabled = ref(false)
const c2mKnnK = ref(8)
const c2mNormalHalfSpaceOnly = ref(true)
const c2mNormalMaxAngleDeg = ref(75)

// 合格界限（默认 5cm）
const c2mToleranceLimit = ref(0.05)
/** 结果区内「可视化调试」折叠 */
const c2mShowVizDebug = ref(true)
const c2mDistancesFetching = ref(false)
/** 最近一次拉取 distances.bin 失败原因（有 distancesFileId 时展示） */
const c2mDistancesFetchError = ref('')

const c2mRunning = ref(false)
const c2mAbort = ref<AbortController | null>(null)
const c2mResult = ref<C2MComputeResult | null>(null)
const c2mError = ref('')
/** 本次会话内是否由 GET latest 填充过结果（非刚点「开始计算」） */
const c2mHydratedFromApi = ref(false)

const hasRemeshResult = computed(() => remeshReadyToUse.value)
const c2mCanRun = computed(
  () =>
    !!props.projectId &&
    !!props.scanId &&
    !!props.bimFileId &&
    !!props.hasAlignment &&
    hasRemeshResult.value,
)

const c2mServerHydratedHint = computed(
  () => c2mHydratedFromApi.value && !!c2mResult.value,
)

/** 是否可应用配色（已有结果且未在计算/重着色）。 */
const canRecolorC2M = computed(
  () => !!c2mResult.value && !c2mRunning.value && !c2mRecoloring.value,
)

/** 作用：按预设设置配色色域（对齐参考项目「预估范围」）。 */
function selectC2MRangePreset(preset: 'auto' | '50' | '100' | '200' | 'full') {
  if (preset === 'full') {
    const stats = c2mResult.value?.stats
    const maxAbs = stats
      ? Math.max(Math.abs(stats.min), Math.abs(stats.max))
      : 0
    if (maxAbs > 0) {
      c2mVizMaxDistance.value = Math.max(0.001, maxAbs)
      c2mSettingsDirty.value = true
    }
    return
  }
  const mm = preset === 'auto' ? null : Number(preset)
  if (mm == null) {
    c2mVizMaxDistance.value = 0.1
    c2mToleranceLimit.value = 0.05
  } else {
    c2mVizMaxDistance.value = mm / 1000
    c2mToleranceLimit.value = Math.min(c2mToleranceLimit.value, mm / 1000)
  }
  c2mSettingsDirty.value = true
}

/** 作用：配色范围变化时保持直方图范围跟随。 */
function onC2MColorRangeChange() {
  c2mSettingsDirty.value = true
}

const c2mDistancesReady = computed(
  () => !!(props.c2mDistances && props.c2mDistances.length > 0),
)

const displayHistogram = computed(() => {
  const dist = props.c2mDistances
  if (dist && dist.length > 0) {
    return histogramFromDistances(
      dist,
      c2mVizMaxDistance.value,
      c2mHistBins.value,
    )
  }
  const h = c2mResult.value?.histogram
  if (h?.counts?.length) {
    return {
      binEdges: h.binEdges,
      counts: h.counts,
      overflowCount: h.overflowCount ?? 0,
    }
  }
  return null
})

function buildC2mFetchHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const tokenData = getToken()
  if (tokenData?.accessToken) {
    headers.Authorization = formatToken(tokenData.accessToken)
  }
  const orgId = getOrganizationId()
  if (orgId) {
    headers['X-Organization-Id'] = String(orgId)
  }
  return headers
}

/** 拉取 distances.bin 并交给父组件，用于直方图与加载场景时复用 */
async function syncDistancesToParent(): Promise<void> {
  if (!props.projectId || !props.scanId || !props.bimFileId) return
  const r = c2mResult.value
  if (!r) return
  c2mDistancesFetchError.value = ''
  c2mDistancesFetching.value = true
  try {
    const url = getC2MDistancesUrl(
      props.projectId,
      props.scanId,
      props.bimFileId,
    )
    const resp = await fetch(url, {
      headers: buildC2mFetchHeaders(),
      cache: 'no-store',
    })
    if (!resp.ok) {
      if (resp.status === 404 && !r.distancesFileId) {
        c2mDistancesFetchError.value =
          '当前结果无 distances 文件，请重新执行 C2M 计算后再调试。'
      } else {
        c2mDistancesFetchError.value = `拉取失败（HTTP ${resp.status}）`
      }
      emit('c2m-distances-buffer', null)
      return
    }
    const buf = await resp.arrayBuffer()
    if (buf.byteLength < 4) {
      c2mDistancesFetchError.value = '距离文件无效或为空'
      emit('c2m-distances-buffer', null)
      return
    }
    c2mDistancesFetchError.value = ''
    emit('c2m-distances-buffer', new Float32Array(buf.slice(0)))
  } catch {
    c2mDistancesFetchError.value = '网络错误，无法拉取 distances'
    emit('c2m-distances-buffer', null)
  } finally {
    c2mDistancesFetching.value = false
  }
}

async function hydrateC2MFromServer() {
  if (!props.projectId || !props.scanId || !props.bimFileId) return
  if (!props.hasAlignment || !hasRemeshResult.value) return
  try {
    const res = await getC2MLatest(
      props.projectId,
      props.scanId,
      props.bimFileId,
    )
    if (res.code === 200 && res.data) {
      c2mResult.value = res.data
      c2mHydratedFromApi.value = true
      if (res.data.voxelSize > 0) {
        c2mVoxelSize.value = res.data.voxelSize
      }
      await syncDistancesToParent()
    }
  } catch {
    /* 无服务端缓存 */
  }
}

watch(
  () =>
    [
      props.projectId,
      props.scanId,
      props.bimFileId,
      props.hasAlignment,
      hasRemeshResult.value,
    ] as const,
  () => {
    void hydrateC2MFromServer()
  },
  { immediate: true },
)

watch(
  () =>
    [
      c2mVizMaxDistance.value,
      c2mHistBins.value,
      c2mToleranceLimit.value,
    ] as const,
  () => {
    emit('c2m-viz-change', {
      maxDist: c2mVizMaxDistance.value,
      histBins: c2mHistBins.value,
      toleranceLimit: c2mToleranceLimit.value,
    })
  },
)

async function handleC2MRun() {
  if (!c2mCanRun.value) return
  c2mRunning.value = true
  c2mResult.value = null
  c2mError.value = ''
  c2mHydratedFromApi.value = false
  c2mDistancesFetchError.value = ''
  emit('c2m-distances-buffer', null)
  const controller = new AbortController()
  c2mAbort.value = controller
  try {
    const res = await computeC2M(
      props.projectId,
      props.scanId,
      {
        bimFileId: props.bimFileId,
        params: {
          voxelSize: c2mDownsampleEnabled.value ? c2mVoxelSize.value : 0.001,
          maxColormapDistance: c2mVizMaxDistance.value,
          maxHistogramDistance: c2mVizMaxDistance.value,
          histogramBins: c2mHistBins.value,
          toleranceLimit: c2mToleranceLimit.value,
          knnK: c2mKnnK.value,
          normalConstraintEnabled: c2mNormalConstraintEnabled.value,
          normalHalfSpaceOnly: c2mNormalHalfSpaceOnly.value,
          normalMaxAngleDeg: c2mNormalMaxAngleDeg.value,
          normalFallbackMode: 'nearest',
        },
      },
      controller.signal,
    )
    c2mResult.value = res.data
    c2mSettingsDirty.value = false
    ElMessage.success('C2M 计算完成')
    await syncDistancesToParent()
  } catch (e: any) {
    if (
      e?.name === 'CanceledError' ||
      e?.name === 'AbortError' ||
      e?.code === 'ERR_CANCELED'
    ) {
      ElMessage.info('C2M 计算已停止')
    } else {
      c2mError.value = e?.response?.data?.msg || e?.message || 'C2M 计算失败'
      ElMessage.error(c2mError.value)
    }
  } finally {
    c2mRunning.value = false
    c2mAbort.value = null
  }
}

function handleC2MStop() {
  c2mAbort.value?.abort()
}

// 确认应用：将当前色彩参数固化为服务端 PLY，确保批注/四分屏颜色一致
const c2mRecoloring = ref(false)

async function handleC2MRecolor() {
  if (!props.projectId || !props.scanId || !props.bimFileId) return
  if (!c2mResult.value) return
  c2mRecoloring.value = true
  try {
    const res = await recolorC2M(props.projectId, props.scanId, {
      bimFileId: props.bimFileId,
      maxColormapDistance: c2mVizMaxDistance.value,
      toleranceLimit: c2mToleranceLimit.value,
    })
    if (res.code === 200) {
      c2mSettingsDirty.value = false
      ElMessage.success('色彩方案已固化至服务端，批注/四分屏视图将使用新配色')
      // 更新结果中的 coloredPlyFileId，使后续「加载到场景」也能拿到新文件
      if (c2mResult.value && res.data?.coloredPlyFileId) {
        c2mResult.value = {
          ...c2mResult.value,
          coloredPlyFileId: res.data.coloredPlyFileId,
        }
      }
    } else {
      ElMessage.error('确认应用失败，请稍后重试')
    }
  } catch (e: any) {
    ElMessage.error(
      `确认应用失败: ${e?.response?.data?.msg || e?.message || '未知错误'}`,
    )
  } finally {
    c2mRecoloring.value = false
  }
}

function handleLoadC2MPly() {
  if (!props.projectId || !props.scanId || !props.bimFileId) return
  emit('load-c2m-ply', {
    plyUrl: getC2MColoredPlyUrl(props.projectId, props.scanId, props.bimFileId),
    distancesUrl: getC2MDistancesUrl(
      props.projectId,
      props.scanId,
      props.bimFileId,
    ),
    bimFileId: props.bimFileId,
    maxColormap: c2mVizMaxDistance.value,
  })
}

function handleClearC2MScene() {
  emit('clear-c2m-scene')
}

/** 格式化无方向的距离（Std 等始终 ≥ 0 的场景）。 */
function fmtDist(v: number): string {
  const a = Math.abs(v)
  if (a < 0.001) return `${(v * 1000).toFixed(2)} mm`
  if (a < 1) return `${(v * 100).toFixed(1)} cm`
  return `${v.toFixed(3)} m`
}

/** 格式化有符号距离，输出带正负号的结果（±xx cm 等）。 */
function fmtSignedDist(v: number): string {
  const sign = v >= 0 ? '+' : ''
  const a = Math.abs(v)
  if (a < 0.001) return `${sign}${(v * 1000).toFixed(2)} mm`
  if (a < 1) return `${sign}${(v * 100).toFixed(1)} cm`
  return `${sign}${v.toFixed(3)} m`
}

// 直方图渲染辅助（发散色图：蓝-白-红，与 Python RdBu_r 对齐）
const histWidth = 220
const histHeight = 60

const barW = computed(() => {
  const n = displayHistogram.value?.counts?.length || 1
  return histWidth / n
})
const histMaxCount = computed(() => {
  const counts = displayHistogram.value?.counts ?? []
  return Math.max(...counts, 1)
})

/**
 * 合格界限标记线在色带中的位置（百分比）
 * 色带 [0%,100%] 对应 [-显示上限, +显示上限]
 * -toleranceLimit 对应 (colormapLimit - toleranceLimit) / (2 * colormapLimit) * 100
 * +toleranceLimit 对应 (colormapLimit + toleranceLimit) / (2 * colormapLimit) * 100
 */
const tolLineLeftPct = computed(() => {
  const cap = Math.max(c2mVizMaxDistance.value, 1e-6)
  const tol = Math.min(c2mToleranceLimit.value, cap - 1e-6)
  return ((cap - tol) / (2 * cap)) * 100
})
const tolLineRightPct = computed(() => {
  const cap = Math.max(c2mVizMaxDistance.value, 1e-6)
  const tol = Math.min(c2mToleranceLimit.value, cap - 1e-6)
  return ((cap + tol) / (2 * cap)) * 100
})

/**
 * 根据桶索引输出颜色，使用与 c2mColormap.ts 一致的质量映射：
 * 合格范围为绿色，超过合格界限后逐步过渡为黄红异常。
 */
function histBarColor(index: number): string {
  const total = displayHistogram.value?.counts?.length || 1
  const cap = Math.max(c2mVizMaxDistance.value, 1e-6)
  const tol = Math.max(c2mToleranceLimit.value, 1e-6)
  const d = -cap + (index / (total - 1)) * 2 * cap
  const abs = Math.abs(d)
  if (abs >= cap) return 'rgb(215,219,226)'
  const t = abs <= tol ? 0 : Math.max(0, Math.min(1, (abs - tol) / (cap - tol)))
  const stops = [0, 0.55, 1]
  const rgbs = [
    [63, 211, 107], // #3fd36b 合格绿
    [246, 211, 101], // #f6d365 提醒黄
    [240, 90, 79], // #f05a4f 异常红
  ]
  let i = 0
  while (i < stops.length - 1 && t > stops[i + 1]) i++
  const t0 = stops[i],
    t1 = stops[i + 1]
  const u = t1 > t0 ? (t - t0) / (t1 - t0) : 0
  const c0 = rgbs[i],
    c1 = rgbs[i + 1]
  const r = Math.round(c0[0] + u * (c1[0] - c0[0]))
  const g = Math.round(c0[1] + u * (c1[1] - c0[1]))
  const b = Math.round(c0[2] + u * (c1[2] - c0[2]))
  return `rgb(${r},${g},${b})`
}
</script>

<style scoped lang="scss">
.scan-bim-compute {
  padding: 0;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}
.section-divider {
  height: 1px;
  background: var(--bg-control);
  margin: 16px 0 14px;
}
.history-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(0, 229, 255, 0.07);
  border: 1px solid rgba(0, 229, 255, 0.2);
  border-radius: 6px;
  padding: 6px 8px;
  margin-bottom: 10px;

  .history-text {
    font-size: 11px;
    color: var(--color-primary);
  }

  .history-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
}
.remesh-status-bar {
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--bg-control);
  border: 1px solid var(--border-color);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  &__title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  &__desc {
    margin-top: 6px;
    font-size: 11px;
    line-height: 1.5;
    color: var(--text-secondary);
  }
}

.remesh-status-bar--primary {
  background: rgba(64, 158, 255, 0.08);
  border-color: rgba(64, 158, 255, 0.24);
}

.remesh-status-bar--warning {
  background: rgba(230, 162, 60, 0.08);
  border-color: rgba(230, 162, 60, 0.24);
}

.remesh-status-bar--success {
  background: rgba(103, 194, 58, 0.08);
  border-color: rgba(103, 194, 58, 0.24);
}

.remesh-status-bar--danger {
  background: rgba(245, 108, 108, 0.08);
  border-color: rgba(245, 108, 108, 0.24);
}
.compute-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;

  .compute-label {
    flex-shrink: 0;
    min-width: 64px;
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;

    &--hint {
      cursor: help;
      border-bottom: 1px dashed var(--border-color-hover);
    }
  }

  :deep(.el-select),
  :deep(.el-input-number) {
    flex: 1;
    min-width: 0;
  }
}
.edge-length-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.5;
  margin-bottom: 10px;
  padding: 4px 6px;
  background: rgba(255, 200, 80, 0.06);
  border-left: 2px solid rgba(255, 200, 80, 0.35);
  border-radius: 0 4px 4px 0;
}

/* 高级选项折叠块 */
.advanced-block {
  margin-bottom: 8px;
}
.advanced-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  padding: 4px 0;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 12px;
  width: 100%;

  &:hover {
    color: var(--text-secondary);
  }

  span {
    flex: 1;
    text-align: left;
  }

  &__chevron {
    width: 14px;
    height: 14px;
    transition: transform 0.2s ease;
    flex-shrink: 0;

    &.is-open {
      transform: rotate(180deg);
    }
  }
}
.advanced-content {
  padding-top: 6px;
}
.compute-actions--reset {
  justify-content: flex-end;
  margin-top: 4px;
}
.compute-actions {
  margin-top: 10px;
  justify-content: flex-end;
}
.compute-result {
  margin-top: 10px;
  background: var(--bg-control);
  border-radius: 6px;
  padding: 8px;

  .result-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .result-title {
    font-size: 12px;
    color: var(--text-secondary);
  }
  .result-actions {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .result-grid {
    display: grid;
    grid-template-columns: auto 1fr 1fr;
    gap: 2px 10px;
    font-size: 12px;

    .result-cell {
      color: var(--text-primary);
      &.head {
        color: var(--text-secondary);
        font-weight: 600;
      }
      &.label {
        color: var(--text-secondary);
      }
    }
  }
}
.remesh-control-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: rgba(0, 255, 170, 0.07);
  border: 1px solid rgba(0, 255, 170, 0.2);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 10px;

  .remesh-label {
    font-size: 11px;
    color: var(--color-success);
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .remesh-btns {
    display: flex;
    gap: 6px;

    :deep(.el-button) {
      flex: 1;
    }
  }
}
.compute-error {
  margin-top: 8px;
  font-size: 12px;
  color: #f56c6c;
  word-break: break-all;
}

/* ── C2M 区域 ── */
.c2m-subtitle {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-bottom: 6px;
}
.c2m-history-hint {
  margin-bottom: 8px;
}
.c2m-pick-hint {
  margin-top: 6px;
  font-size: 10px;
  color: var(--text-tertiary);
  line-height: 1.4;
}
.c2m-prereqs {
  display: flex;
  gap: 12px;
  margin-bottom: 10px;

  .prereq-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--text-tertiary);

    &.prereq-ok {
      color: #67c23a;
    }
  }
  .prereq-icon {
    font-size: 12px;
    font-weight: 700;
  }
}
.c2m-result-block {
  margin-top: 10px;
  background: var(--bg-control);
  border-radius: 6px;
  padding: 8px;
}
.c2m-downsample-info {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 6px;

  .c2m-ratio {
    color: var(--text-tertiary);
  }
}
.c2m-warning {
  font-size: 11px;
  color: #e6a23c;
  background: rgba(230, 162, 60, 0.08);
  border-left: 2px solid rgba(230, 162, 60, 0.5);
  border-radius: 0 4px 4px 0;
  padding: 4px 6px;
  margin-bottom: 8px;
}
.c2m-stats-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1px 10px;
  font-size: 12px;
  margin-bottom: 4px;

  .c2m-stat-label {
    color: var(--text-secondary);
    font-weight: 500;
  }
  .c2m-stat-val {
    color: var(--text-primary);
    text-align: right;
    font-variant-numeric: tabular-nums;

    &.positive {
      color: #f05a4f;
    }
  }
}
.c2m-signed-legend {
  display: flex;
  gap: 10px;
  font-size: 10px;
  margin-bottom: 8px;

  .c2m-signed-ok {
    color: #3fd36b;
  }
  .c2m-signed-warn {
    color: #f6d365;
  }
  .c2m-signed-pos {
    color: #f05a4f;
  }
}
.c2m-viz-debug-block {
  margin: 8px 0;
  border: 1px solid var(--bg-control);
  border-radius: 6px;
  overflow: hidden;
}
.c2m-viz-debug-toggle {
  width: 100%;
  text-align: left;
}
.c2m-viz-debug-hint {
  font-size: 11px;
  line-height: 1.45;
  margin-bottom: 8px;
  padding: 6px 8px;
  border-radius: 4px;

  &.ok {
    color: #95d475;
    background: rgba(103, 194, 58, 0.1);
  }
  &.wait {
    color: #b8c4d6;
    background: var(--bg-control);
  }
}
.compute-actions--retry {
  margin-top: 4px;
}
.c2m-histogram {
  margin-bottom: 8px;
}
.c2m-histogram-svg {
  width: 100%;
  height: 60px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 4px;
}
.c2m-histogram-labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  color: var(--text-tertiary);
  margin-top: 2px;
}
.c2m-hist-neg {
  color: #3fd36b;
}
.c2m-hist-pos {
  color: #f05a4f;
}
.c2m-vis-block {
  background: rgba(100, 180, 255, 0.06);
  border: 1px solid rgba(100, 180, 255, 0.15);
  border-radius: 6px;
  padding: 8px;
}
.c2m-vis-title {
  font-size: 11px;
  color: #7ab0e0;
  font-weight: 600;
  display: block;
  margin-bottom: 6px;
}
.c2m-vis-btns {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}
.c2m-colorbar {
  display: flex;
  align-items: center;
  gap: 6px;
}
.c2m-colorbar-label {
  font-size: 10px;
  color: var(--text-tertiary);
  flex-shrink: 0;
  &.c2m-colorbar-neg {
    color: #3fd36b;
  }
  &.c2m-colorbar-pos {
    color: #f05a4f;
  }
}
.c2m-colorbar-wrap {
  flex: 1;
  position: relative;
}
.c2m-colorbar-gradient {
  width: 100%;
  height: 8px;
  border-radius: 3px;
  /* 工程云图色带：绿色为主，少量黄红表现异常爆点 */
  background: linear-gradient(
    to right,
    #f05a4f 0%,
    #f6d365 16%,
    #3fd36b 28%,
    #3fd36b 72%,
    #f6d365 84%,
    #f05a4f 100%
  );
}
.c2m-colorbar-tol-line {
  position: absolute;
  top: -2px;
  width: 2px;
  height: 12px;
  background: var(--bg-card);
  border-radius: 1px;
  transform: translateX(-50%);
  pointer-events: none;
}
.c2m-colorbar-hint {
  font-size: 10px;
  color: #5a6a7a;
  margin-top: 3px;
  line-height: 1.4;
}

/* ===== cloudBIM-viewer 参考样式（第二步 偏差对比 / C2M 面板） ===== */
.c2m-result-summary {
  margin-top: 10px;
  padding: 8px 10px;
  border: 1px solid rgba(64, 158, 255, 0.28);
  background: rgba(10, 20, 45, 0.45);
  color: rgba(231, 240, 255, 0.88);
  font-size: 12px;
  line-height: 1.7;
}

.c2m-pick-hint {
  margin-top: 8px;
  color: rgba(214, 228, 248, 0.68);
  font-size: 11px;
  line-height: 1.5;
}

.c2m-result-histogram {
  margin-top: 8px;
}

.c2m-range-presets {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
  margin: 8px 0px;

  .el-button {
    min-width: 0;
    margin-left: 0;
    padding-inline: 4px;
  }
}

.c2m-visualization-controls {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);

  .control-row {
    min-width: 0;
  }

  .label {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .el-input-number {
    width: 112px;
    min-width: 96px;
  }
}

.c2m-follow-row {
  min-height: 28px;
}

.c2m-result-warning {
  margin-top: 8px;
  padding: 7px 9px;
  border: 1px solid var(--color-warning);
  color: var(--color-warning);
  background: var(--color-warning-soft);
  font-size: 11px;
  line-height: 1.5;
}

.c2m-result-warning--stale {
  border-color: var(--color-warning);
  color: var(--color-warning);
  background: var(--color-warning-soft);
}

@media (max-width: 720px) {
  .c2m-range-presets {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .c2m-visualization-controls .el-input-number {
    width: 104px;
    min-width: 88px;
  }
}

.c2m-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;

  .el-button {
    flex: 1 1 0;
    min-width: 0;
    margin-left: 0;
  }
}

.control-panel .c2m-panel {
  padding: 18px 16px 20px;
  background: #fff;
}

.control-panel .c2m-panel__title {
  margin-bottom: 16px;
  color: #172e50;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.35;
}

.c2m-primary-card,
.c2m-secondary-settings,
.c2m-advanced-card {
  border: 1px solid #dce5f1;
  background: #fff;
}

.c2m-primary-card {
  padding: 16px;
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
}

.c2m-primary-toggle {
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #1e3759;
  font-size: 13px;
  font-weight: 650;
}

.c2m-primary-toggle > span {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 9px;
}

.c2m-primary-toggle i {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
  background: var(--color-primary);
}

.c2m-panel :deep(.el-switch) {
  --el-switch-on-color: var(--color-primary);
  --el-switch-off-color: #b7c2d1;
}

.c2m-primary-field {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.c2m-primary-field > span,
.c2m-preset-block__label {
  color: #516b8f;
  font-size: 12px;
  font-weight: 550;
}

.c2m-primary-field small,
.c2m-preset-block__label small,
.c2m-setting-row__label small {
  color: #8493a8;
  font-size: 10px;
  font-weight: 500;
}

.c2m-primary-field :deep(.el-input-number) {
  width: 100%;
}

.c2m-primary-field :deep(.el-input__wrapper) {
  height: 38px;
  padding-inline: 36px !important;
  border-color: #ced9e8 !important;
  border-radius: 6px;
  background: #fff !important;
}

.c2m-primary-field :deep(.el-input-number__input) {
  color: #1b3355;
  font-family: var(--font-family-number);
  font-size: 14px;
  font-weight: 600;
}

.c2m-primary-field :deep(.el-input-number__increase),
.c2m-primary-field :deep(.el-input-number__decrease) {
  width: 34px;
  color: #31567f;
  background: #f8fafe;
}

.c2m-run-button.el-button {
  width: 100%;
  height: 42px;
  margin-top: 14px;
  border-color: #326fe0;
  border-radius: 6px;
  color: #fff;
  background: #326fe0;
  box-shadow: 0 6px 14px rgb(50 111 224 / 17%);
  font-size: 13px;
  font-weight: 650;

  --el-button-text-color: #fff;
  --el-button-hover-text-color: #fff;
  --el-button-active-text-color: #fff;
}

.c2m-run-button .el-icon {
  margin-right: 7px;
  font-size: 16px;
  color: #f4f8ff;
}

.c2m-run-button.el-button.is-disabled .el-icon {
  color: #f4f8ff;
}

.c2m-preset-block {
  margin-top: 15px;
}

.c2m-range-presets {
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 5px;
  margin-top: 8px;
}

.c2m-range-presets .el-button {
  height: 34px;
  padding: 0 3px;
  border-color: #d7e0ed;
  border-radius: 6px;
  color: #4e6687;
  background: #fff;
  font-family: var(--font-family-number);
  font-size: 10px;
  font-weight: 600;
}

.c2m-range-presets .el-button:hover,
.c2m-range-presets .el-button:focus-visible {
  border-color: #82aef1;
  color: #2867c7;
  background: #f7faff;
}

.c2m-secondary-settings {
  padding: 8px 16px;
  border-top-color: #e7edf5;
  border-radius: 0 0 8px 8px;
}

.c2m-secondary-settings .c2m-setting-row {
  grid-template-columns: 28px minmax(0, 1fr) 88px;
}

.c2m-setting-row {
  min-width: 0;
  min-height: 46px;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 104px;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid #edf1f6;
}

.c2m-setting-row:last-child {
  border-bottom: 0;
}

.c2m-setting-row__icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: #356db8;
  background: #f0f5fd;
}

.c2m-setting-row__icon .el-icon {
  font-size: 15px;
}

.c2m-setting-row__label {
  min-width: 0;
  display: flex;
  align-items: center;
  color: #263f61;
  font-size: 11px;
  font-weight: 550;
  line-height: 1.35;
}

.c2m-secondary-settings .c2m-setting-row > :deep(.el-input-number) {
  width: 88px;
  align-self: center;
}

.c2m-setting-row > :deep(.el-input-number),
.c2m-setting-row > :deep(.el-select) {
  width: 104px;
}

.c2m-setting-row > :deep(.el-switch) {
  justify-self: end;
}

.c2m-setting-row :deep(.el-input__wrapper),
.c2m-setting-row :deep(.el-select__wrapper) {
  min-height: 30px;
  border-color: #d6e0ed !important;
  border-radius: 5px;
  background: #fff !important;
}

.c2m-setting-row :deep(.el-input-number__input),
.c2m-setting-row :deep(.el-select__selected-item),
.c2m-setting-row :deep(.el-select__caret) {
  color: #223b5d !important;
  font-family: var(--font-family-number);
  font-size: 11px;
}

.c2m-setting-row :deep(.el-input-number__increase),
.c2m-setting-row :deep(.el-input-number__decrease) {
  width: 24px;
  color: #31567f;
  background: #f8fafe;
}

.c2m-advanced-card {
  margin-top: 12px;
  overflow: hidden;
  border-radius: 8px;
}

.c2m-result-card {
  margin-top: 12px;
  overflow: hidden;
  border: 1px solid #dce5f1;
  border-radius: 8px;
  background: #fff;
}

.c2m-advanced-card summary {
  min-height: 46px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  color: #245da8;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
  list-style: none;
  user-select: none;
}

.c2m-advanced-card summary::-webkit-details-marker {
  display: none;
}

.c2m-advanced-card summary > span {
  display: inline-flex;
  align-items: center;
  gap: 9px;
}

.c2m-advanced-card summary > span .el-icon {
  font-size: 17px;
}

.c2m-advanced-card__arrow {
  flex: 0 0 auto;
  transition: transform var(--transition-fast);
}

.c2m-advanced-card[open] .c2m-advanced-card__arrow {
  transform: rotate(180deg);
}

.c2m-advanced-card__body {
  padding: 2px 16px 14px;
  border-top: 1px solid #e8eef6;
}

.c2m-result-card summary {
  min-height: 46px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  color: #245da8;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
  list-style: none;
  user-select: none;
}

.c2m-result-card summary::-webkit-details-marker {
  display: none;
}

.c2m-result-card summary > span {
  display: inline-flex;
  align-items: center;
  gap: 9px;
}

.c2m-result-card summary > span .el-icon {
  font-size: 17px;
}

.c2m-result-card__arrow {
  flex: 0 0 auto;
  transition: transform var(--transition-fast);
}

.c2m-result-card[open] .c2m-result-card__arrow {
  transform: rotate(180deg);
}

.c2m-result-card__body {
  padding: 2px 16px 14px;
  border-top: 1px solid #e8eef6;
}

.c2m-apply-button.el-button {
  width: 100%;
  height: 36px;
  margin-top: 12px;
  border-color: #bcd2f2;
  border-radius: 6px;
  color: #2c6bca;
  background: #f6f9ff;
  font-size: 11px;
  font-weight: 600;
}

.c2m-apply-button .el-icon {
  margin-right: 6px;
}

.c2m-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.c2m-actions .el-button {
  width: 100%;
  height: 36px;
  margin: 0;
  padding: 0 7px;
  border-color: #d7e0ed;
  border-radius: 6px;
  color: #34577f;
  background: #fff;
  font-size: 10px;
}

.c2m-actions .el-icon {
  margin-right: 5px;
}

.c2m-panel-tip {
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid #e2eaf5;
  border-radius: 7px;
  color: #617694;
  background: #f5f8fd;
  font-size: 10px;
  line-height: 1.55;
}

.c2m-panel-tip strong {
  color: #2f69bd;
  font-weight: 650;
}

.c2m-panel .mesh-remesh-error,
.c2m-panel .c2m-result-warning,
.c2m-panel .c2m-result-summary,
.c2m-panel .c2m-pick-hint,
.c2m-panel .c2m-result-histogram {
  margin-top: 12px;
}

/* ===== cloudBIM-viewer 参考样式（网格均匀化 / 高级操作） ===== */
.mesh-remesh-summary {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px;
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-sm);
  background: var(--bg-muted);
}

.mesh-remesh-summary__icon {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  place-items: center;
  border-radius: 50%;
  color: var(--text-tertiary);
  background: var(--bg-card);
  font-size: 13px;
  font-weight: 700;
}

.mesh-remesh-summary > div {
  min-width: 0;
}

.mesh-remesh-summary strong,
.mesh-remesh-summary span:not(.mesh-remesh-summary__icon) {
  display: block;
}

.mesh-remesh-summary strong {
  color: var(--text-primary);
  font-size: var(--font-size-xs);
  line-height: 1.4;
}

.mesh-remesh-summary span:not(.mesh-remesh-summary__icon) {
  margin-top: 3px;
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1.5;
}

.mesh-remesh-summary--succeeded {
  border-color: var(--color-success);
  background: var(--color-success-soft);
}

.mesh-remesh-summary--succeeded .mesh-remesh-summary__icon {
  color: #fff;
  background: var(--color-success);
}

.mesh-remesh-summary--queued,
.mesh-remesh-summary--processing {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.mesh-remesh-summary--queued .mesh-remesh-summary__icon,
.mesh-remesh-summary--processing .mesh-remesh-summary__icon {
  color: #fff;
  background: var(--color-primary);
}

.mesh-remesh-summary--failed {
  border-color: var(--color-danger);
  background: var(--color-danger-soft);
}

.mesh-remesh-summary--failed .mesh-remesh-summary__icon {
  color: #fff;
  background: var(--color-danger);
}

.mesh-remesh-advanced {
  margin-top: 12px;
  overflow: hidden;
  border: 1px solid #dce5f1;
  border-radius: 10px;
  background: var(--bg-card);
  box-shadow: 0 2px 8px rgb(38 75 127 / 5%);
}

.mesh-remesh-advanced summary {
  position: relative;
  min-height: 52px;
  display: flex;
  align-items: center;
  padding: 0 44px 0 20px;
  color: #23446f;
  background: #fff;
  font-size: 15px;
  font-weight: 650;
  cursor: pointer;
  list-style: none;
  user-select: none;
}

.mesh-remesh-advanced summary::-webkit-details-marker {
  display: none;
}

.mesh-remesh-advanced summary::after {
  position: absolute;
  top: 50%;
  right: 20px;
  color: #4c7cc8;
  content: '⌃';
  font-size: 20px;
  font-weight: 500;
  line-height: 1;
  transform: translateY(-38%) rotate(180deg);
  transition: transform var(--transition-fast);
}

.mesh-remesh-advanced[open] summary::after {
  transform: translateY(-62%);
}

.mesh-remesh-advanced summary:hover {
  color: var(--color-primary);
}

.mesh-remesh-advanced__body {
  padding: 4px 20px 20px;
}

.mesh-remesh-advanced__title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.mesh-remesh-advanced__title svg {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  color: #3974d3;
}

.mesh-algorithm-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 18px;
  padding: 16px;
  border: 1px solid #dfe7f2;
  border-radius: 9px;
  background: #fff;
  box-shadow: 0 1px 5px rgb(45 78 123 / 3%);
}

.mesh-algorithm-card__icon {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  color: #3877dd;
  background: linear-gradient(145deg, #d8e5ff, #edf2ff);
}

.mesh-algorithm-card__icon svg {
  width: 27px;
  height: 27px;
}

.mesh-algorithm-card__content {
  min-width: 0;
}

.mesh-algorithm-card__content strong {
  display: block;
  overflow: hidden;
  color: #1b3355;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mesh-algorithm-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}

.mesh-algorithm-card__tags span {
  padding: 3px 9px;
  border-radius: 4px;
  color: #4d75b5;
  background: #edf3ff;
  font-family: var(--font-family-number);
  font-size: 10px;
  line-height: 1.3;
}

.mesh-algorithm-card__content p {
  margin: 10px 0 0;
  color: #6b7f9a;
  font-size: 11px;
  line-height: 1.6;
}

.mesh-remesh-param-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 13px;
}

.mesh-remesh-param {
  min-width: 0;
  display: grid;
  gap: 7px;
}

.mesh-remesh-param > span {
  color: #294363;
  font-size: 12px;
  font-weight: 650;
}

.mesh-remesh-param :deep(.el-select),
.mesh-remesh-param :deep(.el-input-number) {
  width: 100%;
}

.mesh-remesh-param :deep(.el-select__wrapper),
.mesh-remesh-param :deep(.el-input__wrapper) {
  min-height: 34px;
  border-color: #d7e0ed !important;
  background: #fff !important;
}

.mesh-remesh-param :deep(.el-select__selected-item),
.mesh-remesh-param :deep(.el-input-number__input),
.mesh-remesh-param :deep(.el-select__caret) {
  color: var(--text-primary) !important;
}

.mesh-remesh-primary-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 16px;
}

.mesh-remesh-primary-actions > .el-button {
  width: 100%;
  min-width: 0;
  margin: 0;
  height: 36px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.mesh-remesh-primary-actions > .el-button--primary {
  border-color: #326fe0;
  background: #326fe0;
  box-shadow: 0 5px 12px rgb(50 111 224 / 18%);
}

.mesh-remesh-primary-actions > .el-button:not(.el-button--primary) {
  border-color: #d6e0ed;
  color: #315b93;
  background: #fff;
}

.mesh-action-icon {
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
  margin-right: 6px;
}

.mesh-remesh-provenance {
  margin: -2px 0 10px;
  color: rgba(255, 255, 255, 0.58);
  font-size: 11px;
  line-height: 1.4;
}

.mesh-remesh-stats {
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.62);
  font-size: 11px;
  line-height: 1.6;
}

.mesh-remesh-advanced .mesh-remesh-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid #e5ebf3;
  color: #203650;
  font-size: 11px;
  line-height: 1.4;
}

.mesh-stat-item {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding-right: 10px;
}

.mesh-stat-item + .mesh-stat-item {
  padding-right: 0;
  padding-left: 13px;
  border-left: 1px solid #edf1f6;
}

.mesh-stat-item > svg {
  width: 15px;
  height: 15px;
  flex: 0 0 20px;
  margin-top: 1px;
  color: #73a4ed;
}

.mesh-stat-item > div {
  min-width: 0;
}

.mesh-stat-item span,
.mesh-stat-item strong {
  display: block;
}

.mesh-stat-item span {
  margin-bottom: 5px;
  color: #708199;
  font-size: 10px;
}

.mesh-stat-item strong {
  color: #1f334e;
  font-family: var(--font-family-number);
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
}

.mesh-stat-item em {
  color: var(--color-success);
  font-style: normal;
}

.mesh-remesh-error {
  margin-top: 8px;
  color: var(--color-danger);
  font-size: 11px;
  line-height: 1.4;
}

.mesh-remesh-visual-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;

  .el-button {
    flex: 1 1 auto;
    min-width: 0;
    margin-left: 0;
  }
}

/* ===== 网格均匀化：底部操作按钮重新布局 ===== */
.remesh-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;
}

.remesh-actions :deep(.el-button) {
  width: 100%;
  height: 34px;
  min-height: 34px;
  margin: 0;
  border-radius: var(--radius-sm);
}

.remesh-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.remesh-actions__reset {
  grid-column: 1 / -1;
}

.remesh-result-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  margin-top: 12px;
  background: var(--bg-control);
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-sm);
}

.remesh-result-bar__group {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
}

.remesh-result-bar__group :deep(.el-button) {
  margin: 0;
}

.remesh-result-bar__group :deep(.el-button + .el-button) {
  margin-left: 0;
}
</style>
