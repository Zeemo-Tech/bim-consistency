<template>
  <div class="report-preview-page" :class="{ 'is-embedded': props.embedded }">
    <!-- 报告预览工具栏（对齐 cloudBIM-viewer 的 report-reader-toolbar） -->
    <div
      v-if="!reportToolbarCollapsed"
      class="report-reader-toolbar"
      aria-label="报告预览工具栏"
    >
      <button
        type="button"
        title="缩小"
        aria-label="缩小"
        :disabled="previewScale <= minPreviewScale"
        @click="adjustPreviewScale(-10)"
      >
        <el-icon><Minus /></el-icon>
      </button>
      <strong>{{ previewScaleDisplay }}</strong>
      <button
        type="button"
        title="放大"
        aria-label="放大"
        :disabled="previewScale >= maxPreviewScale"
        @click="adjustPreviewScale(10)"
      >
        <el-icon><Plus /></el-icon>
      </button>
      <span class="report-reader-format" title="当前导出格式">PDF</span>
      <button
        type="button"
        title="适应页面"
        aria-label="适应页面"
        @click="fitReportPage"
      >
        <el-icon><View /></el-icon>
      </button>
      <span class="report-reader-divider" />
      <button
        type="button"
        title="保存预览内容"
        aria-label="保存预览内容"
        :disabled="saving"
        @click="handleSaveReview"
      >
        <el-icon><Check /></el-icon>
      </button>
      <button
        type="button"
        :title="reportFullscreen ? '退出全屏预览' : '全屏预览'"
        :aria-label="reportFullscreen ? '退出全屏预览' : '全屏预览'"
        :aria-pressed="reportFullscreen"
        :class="{ active: reportFullscreen }"
        @click="toggleReportFullscreen"
      >
        <el-icon><FullScreen /></el-icon>
      </button>
      <ReportExportButton
        class="report-reader-export"
        :disabled="!canExport || !report"
        :filename="exportFilename"
        page-selector=".report-print-root .a4-page"
        :report-generated-date="reviewForm.reportGeneratedDate"
        :watermark-text="exportWatermarkText"
      />
      <button
        type="button"
        title="收起工具栏"
        aria-label="收起工具栏"
        @click="reportToolbarCollapsed = true"
      >
        <el-icon><ArrowUp /></el-icon>
      </button>
    </div>
    <button
      v-else
      type="button"
      class="report-reader-toolbar-reopen"
      title="展开报告工具栏"
      aria-label="展开报告工具栏"
      @click="reportToolbarCollapsed = false"
    >
      <el-icon><ArrowDown /></el-icon>
    </button>

    <div
      ref="previewCanvasRef"
      v-loading="loading"
      class="preview-canvas"
      :style="previewCanvasStyle"
    >
      <div v-if="report" class="a4-stack">
        <div class="a4-page-shell">
          <article class="a4-page">
            <section class="a4-page-content cover-page">
              <div class="cover-brand">
                <img class="cover-logo" :src="brandLogoUrl" alt="中建八局" />
              </div>
              <div class="cover-main">
                <h1
                  class="cover-title cover-editable-text"
                  contenteditable="true"
                  spellcheck="false"
                  @blur="handleCoverTextBlur('reportTitle', $event)"
                  @keydown.enter.prevent="blurEditableText"
                >
                  {{ reviewForm.reportTitle }}
                </h1>
                <div class="cover-subtitle">
                  <span
                    class="cover-editable-text"
                    contenteditable="true"
                    spellcheck="false"
                    @blur="handleCoverTextBlur('reportSubtitle', $event)"
                    @keydown.enter.prevent="blurEditableText"
                  >
                    {{ reviewForm.reportSubtitle }}
                  </span>
                </div>
              </div>
              <section class="cover-summary">
                <div class="cover-summary-line">
                  <span class="cover-summary-label">项目名称：</span>
                  <el-input
                    v-model="reviewForm.projectName"
                    class="cover-line-input"
                    maxlength="120"
                  />
                </div>
                <div class="cover-summary-line">
                  <span class="cover-summary-label">报告编号：</span>
                  <el-input
                    v-model="reviewForm.reportNo"
                    class="cover-line-input"
                    maxlength="60"
                  />
                </div>
                <div class="cover-summary-line">
                  <span class="cover-summary-label">版本号：</span>
                  <el-input
                    v-model="reviewForm.version"
                    class="cover-line-input"
                    maxlength="20"
                  />
                </div>
                <div class="cover-summary-line">
                  <span class="cover-summary-label">创建人：</span>
                  <el-input
                    v-model="reviewForm.reportCreator"
                    class="cover-line-input"
                    maxlength="40"
                  />
                </div>
                <div class="cover-summary-line">
                  <span class="cover-summary-label">生成日期：</span>
                  <el-input
                    v-model="reviewForm.reportGeneratedDate"
                    class="cover-line-input"
                    maxlength="20"
                  />
                </div>
                <div class="cover-summary-line">
                  <span class="cover-summary-label">扫描文件：</span>
                  <el-input
                    v-model="reviewForm.scanFileName"
                    class="cover-line-input"
                    maxlength="120"
                  />
                </div>
              </section>
            </section>
          </article>
        </div>

        <div class="a4-page-shell">
          <article class="a4-page">
            <section class="a4-page-content">
              <header class="page-header">
                <h2>执行摘要与数据说明</h2>
              </header>
              <section class="section-block">
                <h3>执行摘要（可填写）</h3>
                <el-input
                  v-model="reviewForm.executiveSummary"
                  type="textarea"
                  :rows="10"
                  resize="none"
                  maxlength="1400"
                  show-word-limit
                  placeholder="请输入执行摘要"
                />
              </section>
              <section class="section-block">
                <h3>数据来源与校准说明（可填写）</h3>
                <el-input
                  v-model="reviewForm.calibrationStatement"
                  type="textarea"
                  :rows="8"
                  resize="none"
                  maxlength="1200"
                  show-word-limit
                  placeholder="描述数据来源、坐标系、校准时间与对齐状态"
                />
              </section>
              <section class="section-block">
                <h3>模型与幢层信息</h3>
                <div class="report-context-table-card">
                  <table class="report-context-table">
                    <thead>
                      <tr>
                        <th>数据类型</th>
                        <th>文件名称</th>
                        <th>幢层信息</th>
                        <th>补充说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in reportContextTableRows" :key="row.key">
                        <td class="is-type">{{ row.label }}</td>
                        <td>{{ row.fileName }}</td>
                        <td>{{ row.location }}</td>
                        <td>{{ row.extra }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
              <footer class="page-footer">
                <span>项目：{{ report.projectName }}</span>
                <span>第 2 页</span>
              </footer>
            </section>
          </article>
        </div>

        <div
          v-for="(page, pageIndex) in narrativeOverflowPages"
          :key="`narrative-overflow-${pageIndex}`"
          class="a4-page-shell"
        >
          <article class="a4-page">
            <section class="a4-page-content">
              <header class="page-header">
                <h2>{{ page.title }}（续）</h2>
              </header>
              <div class="text-page-content">{{ page.text }}</div>
              <footer class="page-footer">
                <span>报告编号：{{ report.reportNo }}</span>
                <span>内容续页 {{ pageIndex + 1 }}</span>
              </footer>
            </section>
          </article>
        </div>

        <div class="a4-page-shell">
          <article class="a4-page">
            <section class="a4-page-content c2m-report-page">
              <header class="page-header">
                <h2>偏差分析与质量评估</h2>
              </header>

              <div class="c2m-report-body">
                <template v-if="c2mReportData">
                  <section class="c2m-report-hero">
                    <div class="c2m-report-hero-main">
                      <div class="c2m-report-kicker">Cloud-to-Mesh Latest</div>
                      <div class="c2m-report-title">
                        扫描点云与 BIM 模型偏差统计
                      </div>
                      <div class="c2m-report-subtitle">
                        数据直接来自后端最新一次 C2M
                        计算结果，用于质量评估与整改优先级判断
                      </div>
                    </div>
                    <div class="c2m-report-hero-side">
                      <span
                        class="c2m-report-trust-badge"
                        :class="c2mTrustBadgeClass"
                      >
                        {{ c2mTrustBadgeLabel }}
                      </span>
                      <span class="c2m-report-hero-caption">
                        重叠度
                        {{
                          formatPercent(
                            c2mReportData.diagnostics.bboxOverlapIoU,
                          )
                        }}
                      </span>
                    </div>
                  </section>

                  <section class="c2m-report-section">
                    <div class="c2m-report-section-title">计算概览</div>
                    <div class="c2m-report-overview-grid">
                      <div class="c2m-report-overview-item">
                        <span>扫描文件</span>
                        <strong>{{ resolvedScanFileName }}</strong>
                      </div>
                      <div class="c2m-report-overview-item">
                        <span>BIM 文件 ID</span>
                        <strong>{{ c2mBimFileId || '-' }}</strong>
                      </div>
                      <div class="c2m-report-overview-item">
                        <span>降采样参数</span>
                        <strong>
                          {{ formatDistance(c2mReportData.voxelSize || 0) }}
                        </strong>
                      </div>
                      <div class="c2m-report-overview-item">
                        <span>参与网格顶点</span>
                        <strong>
                          {{ formatInteger(c2mReportData.meshVertexCount) }}
                        </strong>
                      </div>
                      <div class="c2m-report-overview-item">
                        <span>点云样本</span>
                        <strong>
                          {{ formatInteger(c2mReportData.pointsBefore) }}
                          → {{ formatInteger(c2mReportData.pointsAfter) }}
                        </strong>
                      </div>
                      <div class="c2m-report-overview-item">
                        <span>样本保留率</span>
                        <strong>{{ c2mRetentionText }}</strong>
                      </div>
                    </div>
                  </section>

                  <section class="c2m-report-section">
                    <div class="c2m-report-section-title">核心偏差指标</div>
                    <div class="c2m-report-card-grid">
                      <div
                        v-for="card in c2mMetricCards"
                        :key="card.label"
                        class="c2m-report-card"
                      >
                        <span class="c2m-report-card-label">
                          {{ card.label }}
                        </span>
                        <strong class="c2m-report-card-value">
                          {{ card.value }}
                        </strong>
                        <span class="c2m-report-card-help">
                          {{ card.help }}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section class="c2m-report-analysis-grid">
                    <div class="c2m-report-section c2m-report-section--chart">
                      <div class="c2m-report-section-title">偏差分布图</div>
                      <div
                        v-if="c2mHistogramBars.length"
                        class="c2m-report-chart-shell"
                      >
                        <svg
                          class="c2m-report-chart"
                          viewBox="0 0 560 160"
                          preserveAspectRatio="none"
                        >
                          <line
                            x1="280"
                            y1="0"
                            x2="280"
                            y2="160"
                            stroke="rgba(148, 163, 184, 0.55)"
                            stroke-width="2"
                            stroke-dasharray="5 5"
                          />
                          <rect
                            v-for="bar in c2mHistogramBars"
                            :key="bar.key"
                            :x="bar.x"
                            :y="bar.y * 0.8"
                            :width="bar.width"
                            :height="bar.height * 0.8"
                            :fill="bar.color"
                            rx="2"
                          />
                        </svg>
                        <div class="c2m-report-chart-axis">
                          <span>负向偏差</span>
                          <span>合格区</span>
                          <span>正向偏差</span>
                        </div>
                      </div>
                      <div v-else class="c2m-report-empty">
                        当前后端结果未返回可用直方图数据
                      </div>
                    </div>

                    <div
                      class="c2m-report-section c2m-report-section--insights"
                    >
                      <div class="c2m-report-section-title">结果解读</div>
                      <div class="c2m-report-insight-list">
                        <div
                          v-for="insight in c2mInsights"
                          :key="insight.title"
                          class="c2m-report-insight"
                        >
                          <span class="c2m-report-insight-title">
                            {{ insight.title }}
                          </span>
                          <p class="c2m-report-insight-text">
                            {{ insight.text }}
                          </p>
                        </div>
                      </div>
                      <div class="c2m-report-legend">
                        <span class="c2m-report-legend-item is-good">
                          绿色为合格区
                        </span>
                        <span class="c2m-report-legend-item is-warning">
                          黄色为接近异常
                        </span>
                        <span class="c2m-report-legend-item is-positive">
                          红色为异常爆点
                        </span>
                      </div>
                    </div>
                  </section>
                </template>

                <section v-else class="c2m-report-empty-state">
                  <div class="c2m-report-empty-state__title">
                    暂无后端偏差分析结果
                  </div>
                  <div class="c2m-report-empty-state__text">
                    {{ c2mStatusText }}
                  </div>
                </section>
              </div>

              <footer class="page-footer">
                <span>报告编号：{{ report.reportNo }}</span>
                <span>偏差分析页</span>
              </footer>
            </section>
          </article>
        </div>

        <div class="a4-page-shell">
          <article class="a4-page">
            <section class="a4-page-content report-overview-page">
              <header class="page-header">
                <h2>批注界面四分屏总览</h2>
              </header>

              <section class="report-overview-section">
                <div
                  v-if="reportOverviewScreenshotUrl"
                  class="report-overview-frame"
                >
                  <img
                    :src="reportOverviewScreenshotUrl"
                    alt="批注界面四分屏总览"
                    class="report-overview-image"
                    loading="eager"
                  />
                </div>
                <div v-else class="issue-empty report-overview-empty">
                  生成报告时未采集到四分屏总览截图
                </div>
              </section>

              <footer class="page-footer">
                <span>报告编号：{{ report.reportNo }}</span>
                <span>四分屏总览页</span>
              </footer>
            </section>
          </article>
        </div>

        <div
          v-for="(page, pageIndex) in issueDocumentPages"
          :key="`issue-page-${page.pageKey}`"
          class="a4-page-shell"
        >
          <article class="a4-page">
            <section class="a4-page-content issue-report-page">
              <header class="page-header">
                <h2>
                  问题清单（第 {{ pageIndex + 1 }} /
                  {{ issueDocumentPages.length }} 页）
                </h2>
                <div class="issue-summary">
                  共 {{ reviewForm.issues.length }} 项 ｜ 高
                  {{ countBySeverity('high') }} / 中
                  {{ countBySeverity('medium') }} / 低
                  {{ countBySeverity('low') }}
                </div>
              </header>
              <template v-if="page.issue">
                <div class="issue-page-body">
                  <section class="issue-report-hero">
                    <div class="issue-report-hero-main">
                      <div class="issue-report-kicker">
                        问题 {{ page.issueIndex + 1 }}
                      </div>
                      <div class="issue-report-title">
                        {{ page.issue.title || '-' }}
                      </div>
                      <div class="issue-report-subtitle">
                        {{
                          page.issue.componentName ||
                          page.issue.componentId ||
                          '未填写构件信息'
                        }}
                      </div>
                    </div>
                    <div class="issue-report-hero-side">
                      <el-tag
                        :type="issueTagType(page.issue.severity)"
                        size="large"
                        effect="dark"
                        class="issue-report-severity"
                      >
                        {{ issueLabel(page.issue.severity) }}
                      </el-tag>
                      <div class="issue-report-side-text">
                        <strong>
                          {{ issueStatusLabel(page.issue.status) }}
                        </strong>
                      </div>
                    </div>
                  </section>

                  <section class="issue-report-section">
                    <div class="issue-report-section-title">问题信息</div>
                    <div class="issue-report-grid">
                      <div class="issue-report-field">
                        <span>构件名称</span>
                        <strong>
                          {{
                            page.issue.componentName ||
                            page.issue.componentId ||
                            '-'
                          }}
                        </strong>
                      </div>
                      <div class="issue-report-field">
                        <span>构件类型</span>
                        <strong>{{ page.issue.componentType || '-' }}</strong>
                      </div>
                      <div class="issue-report-field">
                        <span>坐标位置</span>
                        <strong>{{ page.issue.coordinate || '-' }}</strong>
                      </div>
                      <div class="issue-report-field">
                        <span>整改周期</span>
                        <strong>{{ page.issue.period || '-' }}</strong>
                      </div>
                    </div>
                  </section>

                  <section class="issue-report-evidence">
                    <div class="issue-report-section-title">
                      现场截图与问题说明
                    </div>
                    <div class="issue-report-evidence-layout">
                      <div class="issue-report-figure">
                        <div
                          v-if="page.screenshot"
                          class="issue-report-figure-frame"
                        >
                          <img
                            :src="
                              page.screenshot.resolvedUrl || page.screenshot.url
                            "
                            :alt="page.screenshot.originalName || '批注截图'"
                            class="issue-report-figure-image"
                            loading="lazy"
                          />
                        </div>
                        <div
                          v-else
                          class="issue-empty issue-report-figure-empty"
                        >
                          暂无截图
                        </div>
                      </div>
                      <div class="issue-report-conclusion">
                        <span class="issue-report-conclusion-label">
                          风险结论:
                        </span>
                        <span class="issue-report-conclusion-text">
                          {{ page.issue.riskConclusion || '-' }}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section class="issue-report-section issue-suggestion-editor">
                    <div class="issue-report-section-title">整改建议</div>
                    <el-input
                      v-model="page.issue.suggestion"
                      type="textarea"
                      :rows="4"
                      resize="none"
                      maxlength="1200"
                      show-word-limit
                      placeholder="整改建议默认回填批注表单中的备注，可继续编辑"
                    />
                  </section>
                </div>
              </template>
              <div v-else class="issue-empty">暂无问题数据</div>

              <footer class="page-footer">
                <span>报告编号：{{ report.reportNo }}</span>
                <span>问题清单页 {{ pageIndex + 1 }}</span>
              </footer>
            </section>
          </article>
        </div>

        <div class="a4-page-shell">
          <article class="a4-page">
            <section class="a4-page-content">
              <header class="page-header">
                <h2>整改计划</h2>
              </header>

              <section class="section-block">
                <h3>整改计划建议</h3>
                <el-input
                  v-model="reviewForm.rectificationPlan"
                  type="textarea"
                  :rows="8"
                  resize="none"
                  maxlength="1200"
                  show-word-limit
                  placeholder="按立即/短期/中期制定整改计划"
                />
              </section>
            </section>
          </article>
        </div>
      </div>
      <el-empty v-else description="暂无报告数据" />
    </div>
    <div
      ref="measureHostRef"
      class="pagination-measure-host"
      aria-hidden="true"
    />
    <ReportPrintDocument
      v-if="report"
      :report="report"
      :review-form="reviewForm"
      :issue-document-pages="issueDocumentPages"
      :narrative-overflow-pages="narrativeOverflowPages"
      :resolved-scan-file-name="resolvedScanFileName"
      :report-overview-screenshot-url="reportOverviewScreenshotUrl"
      :c2m-report-data="c2mReportData"
      :c2m-bim-file-id="c2mBimFileId"
      :c2m-status-text="c2mStatusText"
    />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue'
import {
  ArrowDown,
  ArrowLeftBold,
  ArrowUp,
  CaretBottom,
  Check,
  FullScreen,
  Minus,
  Plus,
  View,
} from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  getReportDetail,
  getReportOverviewScreenshotBlob,
  updateReportReview,
  type ReportIssue,
  type ReportRecord,
  type ReportStatus,
} from '@/api/report'
import {
  getAnnotationScreenshotBlob,
  getAnnotationScreenshots,
  type AnnotationScreenshot,
} from '@/api/annotation'
import {
  getProjectFilesByProjectId,
  type FileTypeGroup,
} from '@/api/fileManage'
import { getC2MLatest, type C2MComputeResult } from '@/api/c2m'
import { getScanCalibration } from '@/api/scan'
import { getCurrentUser } from '@/api/user'
import { useBrandStoreHook } from '@/store/modules/brand'
import ReportExportButton from './components/ReportExportButton.vue'
import ReportPrintDocument from './components/ReportPrintDocument.vue'

interface ReportIssueEvidence extends AnnotationScreenshot {
  resolvedUrl: string
}

const brandStore = useBrandStoreHook()
const brandLogoUrl = computed(() => brandStore.logoUrl)

interface IssueDocumentPage {
  pageKey: string
  issue: ReportIssue | null
  issueIndex: number
  screenshot: ReportIssueEvidence | null
  screenshotIndex: number
  screenshotTotal: number
}

defineOptions({
  name: 'ReportDetail',
})

/**
 * 可复用：既可作路由页（读 route.params.reportId），
 * 也可作内嵌组件（由父级传 reportId，embedded 隐藏「返回报告中心」）。
 */
const props = withDefaults(
  defineProps<{
    reportId?: number | string
    embedded?: boolean
  }>(),
  { reportId: undefined, embedded: false },
)

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const saving = ref(false)
const report = ref<ReportRecord | null>(null)
const currentUsername = ref('')
let pollTimer: number | null = null

const previewCanvasRef = ref<HTMLElement | null>(null)
const measureHostRef = ref<HTMLElement | null>(null)
const narrativeTextMaxHeight = ref(0)
const issueScreenshotMap = ref<Record<number, ReportIssueEvidence[]>>({})
const issueScreenshotObjectUrls = ref<string[]>([])
const c2mLoading = ref(false)
const c2mStatusText = ref('正在读取后端偏差分析结果')
const c2mReportData = ref<C2MComputeResult | null>(null)
const c2mBimFileId = ref<number | null>(null)
const minPreviewScale = 10
const maxPreviewScale = 200
const previewScale = ref(70)
const previewScaleOptions = [200, 150, 100, 75, 50, 25, 10]

const reviewForm = reactive<{
  reportTitle: string
  reportSubtitle: string
  reportNo: string
  version: string
  projectName: string
  scanFileName: string
  reportGeneratedDate: string
  reportCreator: string
  executiveSummary: string
  calibrationStatement: string
  rectificationPlan: string
  keyFindings: string[]
  issues: ReportIssue[]
}>({
  reportTitle: '中建八局三维扫描和模型的对比报告',
  reportSubtitle: '3D Scan & BIM Comparison Report',
  reportNo: '',
  version: '',
  projectName: '',
  scanFileName: '',
  reportGeneratedDate: '',
  reportCreator: '',
  executiveSummary: '',
  calibrationStatement: '',
  rectificationPlan: '',
  keyFindings: [],
  issues: [],
})

// 供内嵌到分析流程时，右侧「出报告」面板读取/编辑报告字段
defineExpose({ reviewForm })

const reportId = computed(() => {
  const raw = props.reportId ?? route.params.reportId
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return null
  return value
})
const reportOverviewScreenshotObjectUrl = ref('')

const canExport = computed(
  () =>
    report.value?.status === 'done' ||
    report.value?.status === 'review_pending',
)
const toolbarReportTitle = computed(() => {
  const title = reviewForm.reportTitle?.trim()
  if (title) return title
  if (report.value?.projectName?.trim()) return report.value.projectName.trim()
  return '报告预览'
})
const previewScaleOptionList = computed(() =>
  Array.from(new Set([...previewScaleOptions, previewScale.value])).sort(
    (left, right) => right - left,
  ),
)
const previewScaleDisplay = computed(() => `${previewScale.value}%`)
/** 报告工具栏是否收起（对齐参考项目 report-reader-toolbar） */
const reportToolbarCollapsed = ref(false)
/** 报告预览是否全屏 */
const reportFullscreen = ref(false)

/** 作用：按当前画布高度自适应页面缩放。 */
const fitReportPage = () => {
  const canvas = previewCanvasRef.value
  if (!canvas) return
  const available = canvas.clientHeight - 56
  const pageHeight = 1123
  if (available <= 0) return
  const next = Math.floor((available / pageHeight) * 100)
  previewScale.value = Math.min(
    maxPreviewScale,
    Math.max(minPreviewScale, next),
  )
}

/** 作用：切换报告预览全屏。 */
const toggleReportFullscreen = async () => {
  const root = document.documentElement
  try {
    if (!document.fullscreenElement) {
      await root.requestFullscreen?.()
      reportFullscreen.value = true
    } else {
      await document.exitFullscreen?.()
      reportFullscreen.value = false
    }
  } catch {
    reportFullscreen.value = !reportFullscreen.value
  }
}
const exportWatermarkText = computed(() => '中建八局')
const exportFilename = computed(() => {
  const projectName =
    reviewForm.projectName?.trim() || report.value?.projectName || '项目'
  const reportNo = reviewForm.reportNo?.trim()
  const version = reviewForm.version?.trim() || report.value?.version || 'v1.0'
  const generatedDate = (
    reviewForm.reportGeneratedDate ||
    report.value?.reportGeneratedDate ||
    formatDate(new Date().toISOString())
  ).replace(/-/g, '')
  if (reportNo) {
    return `${projectName}_${reportNo}_${version}_${generatedDate}.pdf`
  }
  return `${projectName}_巡检报告_${version}_${generatedDate}.pdf`
})
const previewCanvasStyle = computed(() => ({
  '--page-scale': String(previewScale.value / 100),
}))
const formatContextLocation = (buildingName?: string, floorName?: string) => {
  const parts = [
    String(buildingName || '').trim(),
    String(floorName || '').trim(),
  ].filter(Boolean)
  return parts.length ? parts.join(' / ') : '-'
}
const resolvedScanFileName = computed(() => {
  const text = reviewForm.scanFileName?.trim()
  if (text) return text
  if (!report.value) return '-'
  return (
    report.value.scanFileName?.trim() ||
    report.value.reportContext?.pointcloud?.scanFileName?.trim() ||
    `扫描文件 ${report.value.scanFileId}`
  )
})
const cadContextText = computed(() =>
  formatContextLocation(
    report.value?.reportContext?.cad?.buildingName,
    report.value?.reportContext?.cad?.floorName,
  ),
)
const bimContextText = computed(() =>
  formatContextLocation(
    report.value?.reportContext?.bim?.buildingName,
    report.value?.reportContext?.bim?.floorName,
  ),
)
const gaussianContextText = computed(() =>
  formatContextLocation(
    report.value?.reportContext?.gaussian?.buildingName,
    report.value?.reportContext?.gaussian?.floorName,
  ),
)
const reportContextTableRows = computed(() => {
  const pointcloud = report.value?.reportContext?.pointcloud
  const cad = report.value?.reportContext?.cad
  const bim = report.value?.reportContext?.bim
  const gaussian = report.value?.reportContext?.gaussian
  return [
    {
      key: 'pointcloud',
      label: '点云扫描',
      fileName: resolvedScanFileName.value || '-',
      location: formatContextLocation(
        pointcloud?.buildingName,
        pointcloud?.floorName,
      ),
      extra: pointcloud?.producedAt
        ? `扫描日期：${formatDate(pointcloud.producedAt)}`
        : '-',
    },
    {
      key: 'cad',
      label: 'CAD 模型',
      fileName: String(cad?.fileName || '').trim() || '-',
      location: cadContextText.value,
      extra:
        cad?.fileId != null && Number.isFinite(Number(cad.fileId))
          ? `文件 ID：${cad.fileId}`
          : '-',
    },
    {
      key: 'bim',
      label: 'BIM 模型',
      fileName: String(bim?.fileName || '').trim() || '-',
      location: bimContextText.value,
      extra:
        bim?.fileId != null && Number.isFinite(Number(bim.fileId))
          ? `文件 ID：${bim.fileId}`
          : '-',
    },
    {
      key: 'gaussian',
      label: '高斯模型',
      fileName: String(gaussian?.fileName || '').trim() || '-',
      location: gaussianContextText.value,
      extra:
        gaussian?.fileId != null && Number.isFinite(Number(gaussian.fileId))
          ? `文件 ID：${gaussian.fileId}`
          : '-',
    },
  ]
})
const reportOverviewScreenshotUrl = computed(() => {
  const objectUrl = reportOverviewScreenshotObjectUrl.value.trim()
  if (objectUrl) return objectUrl
  return String(report.value?.overviewScreenshot?.url || '').trim()
})
const c2mHistogramBars = computed(() => {
  const counts = c2mReportData.value?.histogram?.counts ?? []
  if (!counts.length) return []
  const total = counts.length
  const chartWidth = 560
  const chartHeight = 200
  const barWidth = Math.max(chartWidth / total - 2, 2)
  const maxCount = Math.max(...counts, 1)
  return counts.map((count, index) => {
    const normalized = count / maxCount
    const height = Math.max(6, normalized * chartHeight)
    const x = (chartWidth / total) * index + 1
    const y = chartHeight - height
    const t = total > 1 ? index / (total - 1) : 0.5
    return {
      key: `${index}-${count}`,
      x,
      y,
      width: barWidth,
      height,
      color: histogramBarColor(t),
    }
  })
})
const c2mMetricCards = computed(() => {
  const stats = c2mReportData.value?.stats
  if (!stats) return []
  return [
    {
      label: '平均偏差',
      value: formatSignedDistance(stats.mean),
      help: '反映整体偏向内缩或外凸的平均水平',
    },
    {
      label: '标准差',
      value: formatDistance(stats.std),
      help: '反映偏差波动与离散程度',
    },
    {
      label: 'P95 偏差',
      value: formatSignedDistance(stats.p95),
      help: '主要质量评估指标，弱化极端离群点影响',
    },
    {
      label: 'P99 偏差',
      value: formatSignedDistance(stats.p99),
      help: '用于识别尾部极端偏差风险',
    },
    {
      label: '最大外凸',
      value: formatSignedDistance(stats.max),
      help: '扫描结果超出 BIM 表面的最大偏差',
    },
    {
      label: '最大内缩',
      value: formatSignedDistance(stats.min),
      help: '扫描结果向 BIM 内部回缩的最大偏差',
    },
  ]
})
const c2mRetentionText = computed(() => {
  const data = c2mReportData.value
  if (!data) return '-'
  const ratio = data.pointsBefore > 0 ? data.pointsAfter / data.pointsBefore : 0
  return formatPercent(ratio)
})
const c2mTrustBadgeLabel = computed(() => {
  const iou = c2mReportData.value?.diagnostics?.bboxOverlapIoU ?? null
  if (!Number.isFinite(iou as number)) return '待评估'
  if ((iou as number) < 0.3) return '需复核'
  if ((iou as number) < 0.6) return '可参考'
  return '可信'
})
const c2mTrustBadgeClass = computed(() => {
  const iou = c2mReportData.value?.diagnostics?.bboxOverlapIoU ?? null
  if (!Number.isFinite(iou as number)) return 'is-pending'
  if ((iou as number) < 0.3) return 'is-risk'
  if ((iou as number) < 0.6) return 'is-warning'
  return 'is-good'
})
const c2mInsights = computed(() => {
  const data = c2mReportData.value
  if (!data) return []
  const { stats, diagnostics } = data
  const retention =
    data.pointsBefore > 0 ? data.pointsAfter / data.pointsBefore : 0
  return [
    {
      title: '整体质量判断',
      text: `当前平均偏差为 ${formatSignedDistance(stats.mean)}，P95 为 ${formatSignedDistance(stats.p95)}，P99 为 ${formatSignedDistance(stats.p99)}，可用于判断主体质量水平及异常尾部风险。`,
    },
    {
      title: '样本与参数说明',
      text: `本次分析使用 ${formatInteger(data.pointsAfter)} 个降采样点参与计算，保留率 ${formatPercent(retention)}，体素尺寸 ${formatDistance(data.voxelSize || 0)}。`,
    },
    {
      title: '坐标重叠度评估',
      text: `扫描与网格包围盒重叠度为 ${formatPercent(diagnostics.bboxOverlapIoU)}。${buildOverlapConclusion(diagnostics.bboxOverlapIoU)}`,
    },
  ]
})

const buildGeneratedExecutiveSummary = (value: ReportRecord) =>
  `本次报告共整理 ${value.issueTotal} 项问题，其中高风险 ${value.highIssueCount} 项、中风险 ${value.mediumIssueCount} 项、低风险 ${value.lowIssueCount} 项。建议优先处理高风险问题，并按整改计划持续跟进闭环。`

const buildGeneratedCalibrationStatement = (value: ReportRecord) => {
  const scanFileName =
    value.scanFileName?.trim() ||
    value.reportContext?.pointcloud?.scanFileName?.trim() ||
    ''
  const location = formatContextLocation(
    value.reportContext?.pointcloud?.buildingName,
    value.reportContext?.pointcloud?.floorName,
  )
  if (scanFileName && location !== '-') {
    return `本报告基于扫描文件“${scanFileName}”（${location}）的已校准数据，BIM/CAD 对齐状态一致。`
  }
  if (scanFileName) {
    return `本报告基于扫描文件“${scanFileName}”的已校准数据，BIM/CAD 对齐状态一致。`
  }
  return '本报告基于已校准数据，BIM/CAD 对齐状态一致。'
}

const issueDocumentPages = computed<IssueDocumentPage[]>(() => {
  const pages = reviewForm.issues.flatMap((issue, issueIndex) => {
    const screenshots = resolveIssueScreenshots(issue)
    if (!screenshots.length) {
      return [
        {
          pageKey: `${issue.id}-empty`,
          issue,
          issueIndex,
          screenshot: null,
          screenshotIndex: 0,
          screenshotTotal: 0,
        },
      ]
    }

    return screenshots.map((screenshot, screenshotIndex) => ({
      pageKey: `${issue.id}-${screenshot.id ?? screenshot.fileId}-${screenshotIndex}`,
      issue,
      issueIndex,
      screenshot,
      screenshotIndex,
      screenshotTotal: screenshots.length,
    }))
  })

  return pages.length
    ? pages
    : [
        {
          pageKey: 'issue-empty',
          issue: null,
          issueIndex: 0,
          screenshot: null,
          screenshotIndex: 0,
          screenshotTotal: 0,
        },
      ]
})

const formatInteger = (value?: number | null) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '-'
  return parsed.toLocaleString()
}

const formatPercent = (value?: number | null) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '-'
  return `${(parsed * 100).toFixed(1)}%`
}

const formatDistance = (value?: number | null) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '-'
  const abs = Math.abs(parsed)
  if (abs === 0) return '0 mm'
  if (abs < 0.001) return `${(parsed * 1000).toFixed(2)} mm`
  if (abs < 1) return `${(parsed * 100).toFixed(1)} cm`
  return `${parsed.toFixed(3)} m`
}

const formatSignedDistance = (value?: number | null) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '-'
  const sign = parsed > 0 ? '+' : ''
  return `${sign}${formatDistance(parsed)}`
}

const histogramBarColor = (t: number) => {
  const distanceFromCenter = Math.abs(t - 0.5) * 2
  const qualityT =
    distanceFromCenter <= 0.5
      ? 0
      : Math.min(1, (distanceFromCenter - 0.5) / 0.5)
  const stops = [0, 0.55, 1]
  const rgbs = [
    [63, 211, 107],
    [246, 211, 101],
    [240, 90, 79],
  ]
  let i = 0
  while (i < stops.length - 1 && qualityT > stops[i + 1]) i++
  const t0 = stops[i]
  const t1 = stops[i + 1]
  const u = t1 > t0 ? (qualityT - t0) / (t1 - t0) : 0
  const c0 = rgbs[i]
  const c1 = rgbs[i + 1]
  const r = Math.round(c0[0] + u * (c1[0] - c0[0]))
  const g = Math.round(c0[1] + u * (c1[1] - c0[1]))
  const b = Math.round(c0[2] + u * (c1[2] - c0[2]))
  return `rgb(${r}, ${g}, ${b})`
}

const buildOverlapConclusion = (iou?: number | null) => {
  const parsed = Number(iou)
  if (!Number.isFinite(parsed)) return '重叠度信息缺失，建议复核基础对齐状态。'
  if (parsed < 0.3) {
    return '重叠度偏低，说明坐标系或配准状态可能存在问题，建议优先复核后再据此做整改判断。'
  }
  if (parsed < 0.6) {
    return '重叠度处于可参考区间，建议结合现场截图与问题清单综合判断。'
  }
  return '重叠度较高，说明当前偏差统计具备较好的参考价值。'
}

const resolveMeasurePageWidth = () => {
  const previewPage = document.querySelector('.a4-page') as HTMLElement | null
  if (previewPage?.clientWidth) return previewPage.clientWidth
  const fallback = Math.min(920, Math.max(640, window.innerWidth - 72))
  return fallback
}

const createNarrativeMeasurer = () => {
  const host = measureHostRef.value
  if (!host) return null
  const pageWidth = resolveMeasurePageWidth()
  const pageHeight = (pageWidth * 297) / 210

  const pageEl = document.createElement('article')
  pageEl.className = 'a4-page pagination-measure-page'
  pageEl.style.width = `${pageWidth}px`
  pageEl.style.height = `${pageHeight}px`

  const contentEl = document.createElement('section')
  contentEl.className = 'a4-page-content'

  const headerEl = document.createElement('header')
  headerEl.className = 'page-header'
  headerEl.innerHTML = '<h2>执行摘要（续）</h2>'

  const textEl = document.createElement('div')
  textEl.className = 'text-page-content'

  const footerEl = document.createElement('footer')
  footerEl.className = 'page-footer'
  footerEl.innerHTML = '<span>报告编号</span><span>内容续页</span>'

  contentEl.appendChild(headerEl)
  contentEl.appendChild(textEl)
  contentEl.appendChild(footerEl)
  pageEl.appendChild(contentEl)
  host.appendChild(pageEl)

  const availableHeight =
    contentEl.clientHeight - headerEl.offsetHeight - footerEl.offsetHeight

  const measureHeight = (value: string) => {
    textEl.textContent = value || ' '
    return textEl.scrollHeight
  }

  const dispose = () => {
    host.removeChild(pageEl)
  }

  return {
    availableHeight,
    measureHeight,
    dispose,
  }
}

const splitTextByMeasuredHeight = (
  value: string,
  maxHeight: number,
  measureHeight: (input: string) => number,
) => {
  const source = (value || '').trim()
  if (!source) return []
  const chunks: string[] = []
  let remaining = source

  const tryNaturalBreak = (text: string, roughIndex: number) => {
    const start = Math.max(0, roughIndex - 64)
    const segment = text.slice(start, roughIndex)
    const markers = ['\n\n', '\n', '。', '！', '？', '；', '，', ' ']
    let matched = -1
    let markerLength = 0

    markers.forEach((marker) => {
      const pos = segment.lastIndexOf(marker)
      if (pos > matched) {
        matched = pos
        markerLength = marker.length
      }
    })

    if (matched < 0) return roughIndex
    const absolute = start + matched + markerLength
    if (absolute <= 0 || absolute < Math.floor(roughIndex * 0.6)) {
      return roughIndex
    }
    return absolute
  }

  while (remaining) {
    if (measureHeight(remaining) <= maxHeight) {
      chunks.push(remaining)
      break
    }

    let low = 1
    let high = remaining.length
    let best = 1

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const candidate = remaining.slice(0, mid).trimEnd()
      if (!candidate) {
        low = mid + 1
        continue
      }
      if (measureHeight(candidate) <= maxHeight) {
        best = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }

    let cutIndex = tryNaturalBreak(remaining, best)
    if (cutIndex <= 0) cutIndex = best
    const chunk = remaining.slice(0, cutIndex).trimEnd()
    if (!chunk) {
      chunks.push(remaining.slice(0, best))
      remaining = remaining.slice(best).trimStart()
      continue
    }

    chunks.push(chunk)
    remaining = remaining.slice(cutIndex).trimStart()
  }

  return chunks
}

const narrativeOverflowPages = computed(() => {
  const maxHeight = narrativeTextMaxHeight.value
  if (!maxHeight) return []
  const measurer = createNarrativeMeasurer()
  if (!measurer) return []
  const pages: Array<{ title: string; text: string }> = []
  const pushOverflow = (title: string, content: string) => {
    splitTextByMeasuredHeight(content, maxHeight, measurer.measureHeight)
      .slice(1)
      .forEach((text) => {
        pages.push({ title, text })
      })
  }

  pushOverflow('执行摘要', reviewForm.executiveSummary)
  pushOverflow('数据来源与校准说明', reviewForm.calibrationStatement)
  pushOverflow('整改计划建议', reviewForm.rectificationPlan)
  measurer.dispose()
  return pages
})

const recomputeNarrativePagination = () => {
  nextTick(() => {
    const measurer = createNarrativeMeasurer()
    if (!measurer) return
    narrativeTextMaxHeight.value = Math.max(0, measurer.availableHeight)
    measurer.dispose()
  })
}

const handleWindowResize = () => {
  recomputeNarrativePagination()
}

const statusLabel = (status: ReportStatus) => {
  const map: Record<ReportStatus, string> = {
    queued: '排队中',
    running: '分析中',
    review_pending: '待复核',
    done: '已完成',
    failed: '失败',
  }
  return map[status]
}

const statusTagType = (
  status: ReportStatus,
): 'info' | 'warning' | 'success' | 'danger' => {
  if (status === 'queued') return 'info'
  if (status === 'running') return 'warning'
  if (status === 'review_pending') return 'warning'
  if (status === 'done') return 'success'
  return 'danger'
}

const issueLabel = (severity: ReportIssue['severity']) => {
  if (severity === 'high') return '高'
  if (severity === 'medium') return '中'
  return '低'
}

const issueTagType = (
  severity: ReportIssue['severity'],
): 'danger' | 'warning' | 'info' => {
  if (severity === 'high') return 'danger'
  if (severity === 'medium') return 'warning'
  return 'info'
}

const issueStatusLabel = (status: ReportIssue['status']) => {
  if (status === 'closed') return '已关闭'
  if (status === 'in_progress') return '整改中'
  return '待整改'
}

const resolveIssueScreenshots = (issue: ReportIssue) => {
  const annotationId = issue.annotationId
  if (!annotationId || annotationId <= 0) return []
  return issueScreenshotMap.value[annotationId] || []
}

const normalizeScreenshotUrl = (rawUrl?: string) => {
  const url = String(rawUrl || '').trim()
  if (!url) return ''
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:')) return url
  if (url.startsWith('/api/')) return url
  if (url.startsWith('/projects/')) return `/api${url}`
  if (url.startsWith('/')) return `/api${url}`
  return `/api/${url}`
}

const parseScreenshotIdFromUrl = (value?: string) => {
  const text = String(value || '').trim()
  const match = text.match(/\/screenshots\/(\d+)(?:[/?#]|$)/i)
  if (!match) return null
  const id = Number(match[1])
  return Number.isFinite(id) && id > 0 ? id : null
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
    const id = Number(candidate)
    if (Number.isFinite(id) && id > 0) return id
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
    const id = parseScreenshotIdFromUrl(String(candidate ?? ''))
    if (id) return id
  }
  const fileId = Number(data.fileId)
  return Number.isFinite(fileId) && fileId > 0 ? fileId : null
}

const revokeIssueScreenshotObjectUrls = () => {
  issueScreenshotObjectUrls.value.forEach((url) => URL.revokeObjectURL(url))
  issueScreenshotObjectUrls.value = []
}

const revokeReportOverviewScreenshotObjectUrl = () => {
  if (!reportOverviewScreenshotObjectUrl.value) return
  URL.revokeObjectURL(reportOverviewScreenshotObjectUrl.value)
  reportOverviewScreenshotObjectUrl.value = ''
}

const loadReportOverviewScreenshot = async (value: ReportRecord | null) => {
  revokeReportOverviewScreenshotObjectUrl()
  const url = String(value?.overviewScreenshot?.url || '').trim()
  if (!url) return
  try {
    const blob = await getReportOverviewScreenshotBlob(url)
    reportOverviewScreenshotObjectUrl.value = URL.createObjectURL(blob)
  } catch (error) {
    console.warn(
      '[ReportPreview] 报告总览图 blob 加载失败，回退直连地址:',
      error,
    )
  }
}

const loadIssueScreenshots = async () => {
  revokeIssueScreenshotObjectUrls()
  if (!report.value) {
    issueScreenshotMap.value = {}
    return
  }
  const annotationIds = Array.from(
    new Set(
      reviewForm.issues
        .map((item) => item.annotationId)
        .filter((id): id is number => Number.isFinite(id) && Number(id) > 0),
    ),
  )
  if (!annotationIds.length) {
    issueScreenshotMap.value = {}
    return
  }
  const nextMap: Record<number, ReportIssueEvidence[]> = {}
  await Promise.all(
    annotationIds.map(async (annotationId) => {
      try {
        const res = await getAnnotationScreenshots(
          report.value!.projectId,
          report.value!.scanFileId,
          annotationId,
        )
        if (res.code === 200 && Array.isArray(res.data)) {
          const sorted = [...res.data].sort((a, b) => a.sortOrder - b.sortOrder)
          const resolvedList = await Promise.all(
            sorted.map(async (item) => {
              const fallbackUrl = normalizeScreenshotUrl(item.url)
              const screenshotId = resolveScreenshotResourceId(item)
              if (!screenshotId) {
                return {
                  ...item,
                  resolvedUrl: fallbackUrl,
                } as ReportIssueEvidence
              }
              try {
                const blob = await getAnnotationScreenshotBlob(
                  report.value!.projectId,
                  report.value!.scanFileId,
                  annotationId,
                  screenshotId,
                )
                const objectUrl = URL.createObjectURL(blob)
                issueScreenshotObjectUrls.value.push(objectUrl)
                return {
                  ...item,
                  resolvedUrl: objectUrl,
                } as ReportIssueEvidence
              } catch (blobError) {
                console.warn(
                  '[ReportPreview] 批注截图 blob 加载失败，回退普通链接:',
                  annotationId,
                  screenshotId,
                  blobError,
                )
                return {
                  ...item,
                  resolvedUrl: fallbackUrl,
                } as ReportIssueEvidence
              }
            }),
          )
          nextMap[annotationId] = resolvedList
          return
        }
      } catch (error) {
        console.warn('[ReportPreview] 加载批注截图失败:', annotationId, error)
      }
      nextMap[annotationId] = []
    }),
  )
  issueScreenshotMap.value = nextMap
}

const loadC2MReportData = async (value: ReportRecord | null) => {
  c2mReportData.value = null
  c2mBimFileId.value = null

  if (!value?.projectId || !value.scanFileId) {
    c2mStatusText.value = '缺少项目或扫描信息，无法读取偏差分析结果'
    return
  }

  c2mLoading.value = true
  c2mStatusText.value = '正在读取后端偏差分析结果'
  try {
    const calibrationRes = await getScanCalibration(
      value.projectId,
      value.scanFileId,
    )
    if (calibrationRes.code !== 200 || !calibrationRes.data) {
      throw new Error(calibrationRes.msg || '获取扫描校准信息失败')
    }

    const bimFileId = calibrationRes.data.bimFileId
    c2mBimFileId.value = Number.isFinite(Number(bimFileId))
      ? Number(bimFileId)
      : null
    if (!c2mBimFileId.value) {
      c2mStatusText.value = '当前扫描未绑定 BIM，暂无偏差分析结果'
      return
    }

    const latestRes = await getC2MLatest(
      value.projectId,
      value.scanFileId,
      c2mBimFileId.value,
    )
    if (latestRes.code !== 200 || !latestRes.data) {
      throw new Error(latestRes.msg || '获取偏差分析结果失败')
    }

    c2mReportData.value = latestRes.data
    c2mStatusText.value = '偏差分析结果已同步至报告'
  } catch (error: any) {
    c2mReportData.value = null
    c2mStatusText.value = error?.message || '后端暂未生成可用的偏差分析结果'
  } finally {
    c2mLoading.value = false
  }
}

const formatDate = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDateTime = (value?: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

const resolveReportCreatorText = (value?: string) => {
  const text = String(value || '').trim()
  if (text && text !== '当前用户') return text
  return currentUsername.value || text
}

const isPlaceholderCreator = (value?: string) => {
  const text = String(value || '').trim()
  return !text || text === '当前用户'
}

const resolveScanFileNameById = (
  groups: FileTypeGroup[] | undefined,
  scanFileId: number,
) => {
  if (!Array.isArray(groups) || !scanFileId) return ''
  const scanGroup = groups.find((item) => item.type === 'scan')
  const matched = scanGroup?.files.find((item) => item.id === scanFileId)
  return String(matched?.originalName || '').trim()
}

const hydrateReportContext = async (value: ReportRecord) => {
  const shouldLoadUser = isPlaceholderCreator(value.reportCreator)
  const shouldLoadScanFile =
    !String(value.scanFileName || '').trim() &&
    !String(value.reportContext?.pointcloud?.scanFileName || '').trim() &&
    value.projectId > 0
  if (!shouldLoadUser && !shouldLoadScanFile) return value

  const [userResult, filesResult] = await Promise.allSettled([
    shouldLoadUser ? getCurrentUser() : Promise.resolve(null),
    shouldLoadScanFile
      ? getProjectFilesByProjectId(value.projectId)
      : Promise.resolve(null),
  ])

  if (
    userResult.status === 'fulfilled' &&
    userResult.value &&
    userResult.value.code === 200
  ) {
    currentUsername.value = String(userResult.value.data?.username || '').trim()
    if (isPlaceholderCreator(value.reportCreator) && currentUsername.value) {
      value.reportCreator = currentUsername.value
    }
  }

  if (
    filesResult.status === 'fulfilled' &&
    filesResult.value &&
    filesResult.value.code === 200
  ) {
    const scanFileName = resolveScanFileNameById(
      filesResult.value.data,
      value.scanFileId,
    )
    if (scanFileName) {
      value.scanFileName = scanFileName
    }
  }

  if (!currentUsername.value && !shouldLoadUser) {
    const creator = resolveReportCreatorText(value.reportCreator)
    if (creator && creator !== '当前用户') {
      currentUsername.value = creator
    }
  }

  if (!currentUsername.value && value.reviewer) {
    const reviewer = String(value.reviewer || '').trim()
    if (reviewer) {
      currentUsername.value = reviewer
    }
  }

  return value
}

const normalizeExecutiveSummary = (value: ReportRecord) => {
  const summary = String(value.executiveSummary || '').trim()
  if (!summary) return ''
  if (summary.includes('AI 分析完成')) {
    return buildGeneratedExecutiveSummary(value)
  }
  return summary
}

const normalizeCalibrationStatement = (value: ReportRecord) => {
  const statement = String(value.calibrationStatement || '').trim()
  if (!statement) return ''
  if (statement.includes('scanFileId=')) {
    return buildGeneratedCalibrationStatement(value)
  }
  return statement
}

const syncReviewForm = (value: ReportRecord) => {
  reviewForm.reportTitle =
    value.reportTitle || '中建八局三维扫描和模型的对比报告'
  reviewForm.reportSubtitle =
    value.reportSubtitle || '3D Scan & BIM Comparison Report'
  reviewForm.reportNo = value.reportNo || ''
  reviewForm.version = value.version || ''
  reviewForm.projectName = value.projectName || ''
  reviewForm.scanFileName =
    value.scanFileName || value.reportContext?.pointcloud?.scanFileName || ''
  reviewForm.reportGeneratedDate =
    value.reportGeneratedDate ||
    formatDate(value.createdAt) ||
    formatDate(value.scanDate)
  reviewForm.reportCreator =
    resolveReportCreatorText(value.reportCreator) ||
    value.reviewer ||
    '当前用户'
  reviewForm.executiveSummary = normalizeExecutiveSummary(value)
  reviewForm.calibrationStatement = normalizeCalibrationStatement(value)
  reviewForm.rectificationPlan = value.rectificationPlan || ''
  reviewForm.keyFindings = [...(value.keyFindings || [])]
  reviewForm.issues = (value.issues || []).map((item) => ({ ...item }))
}

const applyLocalReportContext = (value: ReportRecord) => {
  if (!String(value.scanFileName || '').trim() && report.value?.scanFileName) {
    value.scanFileName = report.value.scanFileName
  }
  if (
    !String(value.scanFileName || '').trim() &&
    report.value?.reportContext?.pointcloud?.scanFileName
  ) {
    value.scanFileName = report.value.reportContext.pointcloud.scanFileName
  }
  if (!String(value.projectName || '').trim() && reviewForm.projectName) {
    value.projectName = reviewForm.projectName
  }
  if (!String(value.reportNo || '').trim() && reviewForm.reportNo) {
    value.reportNo = reviewForm.reportNo
  }
  if (!String(value.version || '').trim() && reviewForm.version) {
    value.version = reviewForm.version
  }
  if (isPlaceholderCreator(value.reportCreator) && currentUsername.value) {
    value.reportCreator = currentUsername.value
  }
  return value
}

const applyPreviewScale = (value: number) => {
  const normalized = Math.min(
    maxPreviewScale,
    Math.max(minPreviewScale, Math.round(value)),
  )
  previewScale.value = normalized
}

const adjustPreviewScale = (delta: number) => {
  applyPreviewScale(previewScale.value + delta)
}

const handlePreviewScaleChange = (value: number | string) => {
  applyPreviewScale(Number(value))
}

const handlePreviewScaleSliderInput = (value: number | number[]) => {
  if (Array.isArray(value)) return
  applyPreviewScale(value)
}

const handlePreviewScaleSliderChange = (value: number | number[]) => {
  if (Array.isArray(value)) return
  applyPreviewScale(value)
}

const handlePreviewWheel = (event: WheelEvent) => {
  if (!event.ctrlKey) return
  event.preventDefault()
  adjustPreviewScale(event.deltaY > 0 ? -10 : 10)
}

const blurEditableText = (event: Event) => {
  ;(event.target as HTMLElement | null)?.blur()
}

const handleCoverTextBlur = (
  field: 'reportTitle' | 'reportSubtitle',
  event: FocusEvent,
) => {
  const element = event.target as HTMLElement | null
  const fallback =
    field === 'reportTitle'
      ? '中建八局三维扫描和模型的对比报告'
      : '3D Scan & BIM Comparison Report'
  const text = String(element?.innerText || '')
    .replace(/\n+/g, ' ')
    .trim()
  reviewForm[field] = text || fallback
  if (element && element.innerText !== reviewForm[field]) {
    element.innerText = reviewForm[field]
  }
}

const countBySeverity = (severity: ReportIssue['severity']) =>
  reviewForm.issues.filter((item) => item.severity === severity).length

const startPolling = () => {
  if (pollTimer) return
  pollTimer = window.setInterval(() => {
    void loadDetail(false)
  }, 4000)
}

const stopPolling = () => {
  if (!pollTimer) return
  window.clearInterval(pollTimer)
  pollTimer = null
}

const loadDetail = async (withLoading = true) => {
  const currentReportId = reportId.value
  if (!currentReportId) {
    ElMessage.warning('缺少报告ID')
    return
  }

  if (withLoading) loading.value = true
  try {
    const detail = await hydrateReportContext(
      await getReportDetail(currentReportId),
    )
    report.value = detail
    syncReviewForm(detail)
    await Promise.all([
      loadIssueScreenshots(),
      loadReportOverviewScreenshot(detail),
      loadC2MReportData(detail),
    ])
    recomputeNarrativePagination()

    if (detail.status === 'queued' || detail.status === 'running') {
      startPolling()
    } else {
      stopPolling()
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '加载报告预览失败')
  } finally {
    if (withLoading) loading.value = false
  }
}

const handleSaveReview = async () => {
  if (!report.value) return
  saving.value = true
  try {
    const updated = await updateReportReview(report.value.id, {
      reportTitle: reviewForm.reportTitle,
      reportSubtitle: reviewForm.reportSubtitle,
      reportNo: reviewForm.reportNo,
      version: reviewForm.version,
      projectName: reviewForm.projectName,
      reportGeneratedDate: reviewForm.reportGeneratedDate,
      reportCreator: reviewForm.reportCreator,
      scanFileName: reviewForm.scanFileName,
      executiveSummary: reviewForm.executiveSummary,
      calibrationStatement: reviewForm.calibrationStatement,
      rectificationPlan: reviewForm.rectificationPlan,
      keyFindings: reviewForm.keyFindings,
      issues: reviewForm.issues,
    })
    report.value = applyLocalReportContext(updated)
    syncReviewForm(updated)
    ElMessage.success('预览内容已保存')
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const goCenter = () => {
  if (!report.value) {
    router.push({ name: 'ReportCenter' })
    return
  }
  router.push({
    name: 'ReportCenter',
    query: {
      projectId: String(report.value.projectId),
      scanFileId: String(report.value.scanFileId),
      projectName: report.value.projectName,
    },
  })
}

watch(
  reportId,
  () => {
    void loadDetail()
  },
  { immediate: true },
)

watch(
  () => reviewForm.issues.map((item) => item.annotationId || '').join(','),
  () => {
    void loadIssueScreenshots()
  },
)

onMounted(() => {
  recomputeNarrativePagination()
  window.addEventListener('resize', handleWindowResize)
  previewCanvasRef.value?.addEventListener('wheel', handlePreviewWheel, {
    passive: false,
  })
})

onBeforeUnmount(() => {
  stopPolling()
  revokeIssueScreenshotObjectUrls()
  revokeReportOverviewScreenshotObjectUrl()
  window.removeEventListener('resize', handleWindowResize)
  previewCanvasRef.value?.removeEventListener('wheel', handlePreviewWheel)
})
</script>

<style scoped>
.report-preview-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: calc(100vh - 84px);
  background: #eceff3;
}

/* 内嵌到分析流程时：填满容器，不按视口高度撑开 */
.report-preview-page.is-embedded {
  position: relative;
  height: 100%;
  min-height: 0;
}

/* 报告预览工具栏：顶部居中悬浮胶囊（对齐 cloudBIM-viewer report-reader-toolbar） */
.report-reader-toolbar {
  position: absolute;
  top: 16px;
  left: 50%;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: calc(100% - 32px);
  padding: 6px 10px;
  border-radius: 999px;
  background: rgb(255 255 255 / 94%);
  box-shadow: 0 12px 30px rgb(15 23 42 / 12%);
  backdrop-filter: blur(14px);
  transform: translateX(-50%);
}

.report-reader-toolbar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: #415572;
  background: transparent;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background 0.15s ease;
}

.report-reader-toolbar button:hover:not(:disabled) {
  color: #4e66cc;
  background: #eef1fb;
}

.report-reader-toolbar button.active {
  color: #4e66cc;
  background: #eef1fb;
}

.report-reader-toolbar button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.report-reader-toolbar strong {
  min-width: 44px;
  color: #1b2f4a;
  font-family: var(--font-family-number, monospace);
  font-size: 13px;
  font-weight: 700;
  text-align: center;
}

.report-reader-format {
  padding: 3px 9px;
  border-radius: 6px;
  color: #3e52ad;
  background: #eef1fb;
  font-family: var(--font-family-number, monospace);
  font-size: 12px;
  font-weight: 700;
}

.report-reader-divider {
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: #e3ebf6;
}

.report-reader-toolbar :deep(.report-reader-export.el-button) {
  height: 32px;
  min-height: 32px;
  margin: 0;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
}

.report-reader-toolbar-reopen {
  position: absolute;
  top: 16px;
  left: 50%;
  z-index: 30;
  display: grid;
  width: 36px;
  height: 36px;
  padding: 0;
  place-items: center;
  color: #415572;
  background: rgb(255 255 255 / 94%);
  border: 0;
  border-radius: 50%;
  box-shadow: 0 12px 30px rgb(15 23 42 / 12%);
  cursor: pointer;
  transform: translateX(-50%);
}

.report-reader-toolbar-reopen:hover {
  color: #4e66cc;
}

.preview-toolbar {
  position: sticky;
  top: 0;
  z-index: 18;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(360px, 0.95fr) auto;
  gap: 20px;
  align-items: center;
  padding: 14px 24px;
  background: rgba(255, 255, 255, 0.92);
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(14px);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.toolbar-center {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-end;
  white-space: nowrap;
}

.preview-canvas {
  --page-scale: 1;
  /* A4 @96dpi，与 cloudBIM-viewer 出报告保持一致（因此同样 70% 视觉大小相同） */
  --page-base-width: min(794px, calc(100vw - 72px));
  flex: 1;
  overflow-y: auto;
  padding: 22px 0 34px;
}

.toolbar-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 16px;
  border: 1px solid rgba(201, 208, 218, 0.92);
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff 0%, #f5f7fa 100%);
  color: #1f2937;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.toolbar-back-btn:hover {
  border-color: rgba(148, 163, 184, 0.95);
  background: linear-gradient(180deg, #ffffff 0%, #eef2f7 100%);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.toolbar-title-block {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
}

.toolbar-title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.toolbar-title {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: #0f172a;
  font-size: 20px;
  line-height: 1.2;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-status-tag {
  border-radius: 999px;
  padding-inline: 12px;
  font-weight: 600;
}

.toolbar-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  color: #64748b;
  font-size: 13px;
}

.toolbar-zoom-shell {
  display: flex;
  width: min(70%, 560px);
  min-width: 0;
  align-items: center;
  gap: 10px;
  padding: 4px 8px;
  border-radius: 12px;
  background: rgba(241, 241, 248, 0.92);
}

.toolbar-center-label {
  flex: 0 0 auto;
  color: #3e4047;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.zoom-controls {
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: 34px 70px minmax(104px, 180px) 34px;
  gap: 6px;
  align-items: center;
}

.zoom-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #475569;
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.zoom-icon-btn:hover:not(:disabled) {
  background: rgba(226, 232, 240, 0.78);
  color: #0f172a;
}

.zoom-icon-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.zoom-current {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
  box-shadow: inset 0 0 0 1px rgba(226, 232, 240, 0.95);
}

.zoom-current--trigger {
  border: 0;
  cursor: pointer;
}

.zoom-current--trigger:hover {
  background: #f8fafc;
}

.zoom-current-arrow {
  color: #64748b;
  font-size: 12px;
}

.zoom-dropdown {
  width: 70px;
}

:deep(.zoom-dropdown-menu) {
  min-width: 92px;
}

.zoom-slider {
  width: min(100%, 180px);
  min-width: 104px;
  justify-self: center;
  padding-inline: 2px;
}

:deep(.zoom-slider .el-slider__runway) {
  height: 4px;
  margin: 0;
  border-radius: 999px;
  background: #d9e2ec;
}

:deep(.zoom-slider .el-slider__bar) {
  height: 4px;
  border-radius: 999px;
  background: #475569;
}

:deep(.zoom-slider .el-slider__button-wrapper) {
  width: 22px;
  height: 22px;
  top: -9px;
}

:deep(.zoom-slider .el-slider__button) {
  width: 10px;
  height: 10px;
  border: 2px solid #fff;
  background: #334155;
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.14);
}

.toolbar-actions :deep(.toolbar-action-btn) {
  min-width: 92px;
  height: 42px;
  border-radius: 12px;
  font-weight: 600;
  padding-inline: 18px;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease;
}

.toolbar-actions :deep(.toolbar-action-btn:hover:not(:disabled)) {
  transform: translateY(-1px);
}

.toolbar-actions :deep(.toolbar-action-btn--secondary) {
  border-color: rgba(201, 208, 218, 0.92);
  color: #1f2937;
  background: linear-gradient(180deg, #ffffff 0%, #f5f7fa 100%);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.04);
}

.toolbar-actions :deep(.toolbar-action-btn--secondary:hover:not(:disabled)) {
  border-color: rgba(148, 163, 184, 0.92);
  background: linear-gradient(180deg, #ffffff 0%, #eef2f7 100%);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
}

.toolbar-actions :deep(.toolbar-action-btn--primary) {
  border-color: rgba(37, 99, 235, 0.92);
  background: linear-gradient(135deg, #52a2e3 0%, #1f8fde 100%);
  color: #fff;
  box-shadow:
    0 12px 28px rgba(37, 99, 235, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.toolbar-actions :deep(.toolbar-action-btn--primary:hover:not(:disabled)) {
  border-color: rgba(29, 78, 216, 0.98);
  background: linear-gradient(135deg, #519fe3 0%, #2177c8 100%);
  box-shadow:
    0 16px 32px rgba(29, 78, 216, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

.toolbar-actions :deep(.toolbar-action-btn--primary.is-disabled),
.toolbar-actions :deep(.toolbar-action-btn--primary:disabled) {
  border-color: rgba(148, 163, 184, 0.7);
  background: linear-gradient(135deg, #94a3b8 0%, #a8b4c5 100%);
  color: rgba(255, 255, 255, 0.92);
  box-shadow: none;
}

.a4-stack {
  display: flex;
  flex-direction: column;
  gap: 26px;
  align-items: center;
}

.a4-page-shell {
  position: relative;
  width: calc(var(--page-base-width) * var(--page-scale));
  height: calc(var(--page-base-width) * 297 / 210 * var(--page-scale));
}

.a4-page {
  position: absolute;
  top: 0;
  left: 50%;
  width: var(--page-base-width);
  height: calc(var(--page-base-width) * 297 / 210);
  background: #fff;
  box-shadow:
    0 10px 26px rgba(15, 23, 42, 0.12),
    0 1px 3px rgba(15, 23, 42, 0.08);
  border-radius: 2px;
  overflow: hidden;
  transform: translateX(-50%) scale(var(--page-scale));
  transform-origin: top center;
}

.a4-page-content {
  height: 100%;
  padding: 52px 58px;
  display: flex;
  flex-direction: column;
  color: #111827;
}

.cover-page {
  background:
    radial-gradient(circle at 85% 12%, #eff6ff 0%, #ffffff 43%),
    linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.cover-brand {
  display: flex;
  align-items: center;
  gap: 18px;
}

.cover-brand-name {
  font-size: 30px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 1px;
}

.cover-main {
  margin-top: 86px;
}

.cover-title {
  margin: 0;
  font-size: 42px;
  line-height: 1.35;
  font-weight: 700;
  letter-spacing: 1px;
  color: #111827;
}

.cover-subtitle {
  margin-top: 14px;
  font-size: 22px;
  color: #64748b;
}

.cover-editable-text {
  display: inline-block;
  min-width: 1ch;
  outline: none;
  border-radius: 4px;
}

.cover-editable-text:focus {
  background: rgba(29, 78, 216, 0.06);
}

.cover-summary {
  margin: 400px auto 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: min(100%, 700px);
  padding: 22px 0 6px;
}

.cover-summary-line {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  justify-content: flex-start;
}

.cover-summary-label {
  flex: 0 0 124px;
  color: #1f2937;
  font-size: 24px;
  line-height: 1.4;
  font-weight: 700;
}

.cover-line-input {
  flex: 0 2px 360px;
  text-align: center;
}

.cover-line-input--long {
  flex-basis: 520px;
}

:deep(.cover-line-input .el-input__wrapper) {
  padding: 0 0 4px;
  border-radius: 0;
  background: transparent;
  box-shadow: inset 0 -1.5px 0 #232931 !important;
}

:deep(.cover-line-input .el-input__inner) {
  height: 44px;
  padding: 0;
  color: #0f172a;
  font-size: 22px;
  line-height: 1.5;
  text-align: center;
}

.cover-footer {
  margin-top: 14px;
  text-align: right;
  color: #6b7280;
  font-size: 14px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 2px solid #1f2937;
}

.page-header h2 {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  color: #0f172a;
}

.issue-summary {
  font-size: 14px;
  color: #6b7280;
}

.section-block {
  margin-bottom: 14px;
}

.section-block h3 {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 600;
  color: #1f2937;
}

.report-context-table-card {
  overflow: hidden;
  border: 1px solid #dbe3ee;
  border-radius: 16px;
  background: linear-gradient(
    180deg,
    rgba(248, 250, 252, 0.96),
    rgba(255, 255, 255, 1)
  );
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.report-context-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.report-context-table th,
.report-context-table td {
  padding: 14px 16px;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
  vertical-align: middle;
  word-break: break-word;
}

.report-context-table thead th {
  background: linear-gradient(180deg, #eff6ff, #f8fbff);
  color: #1e3a8a;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.report-context-table tbody tr:nth-child(even) {
  background: rgba(248, 250, 252, 0.72);
}

.report-context-table tbody tr:last-child td {
  border-bottom: none;
}

.report-context-table td {
  color: #1f2937;
  font-size: 14px;
  line-height: 1.6;
}

.report-context-table td.is-type {
  color: #0f172a;
  font-weight: 700;
  white-space: nowrap;
}

.text-page-content {
  white-space: pre-wrap;
  line-height: 1.86;
  font-size: 22px;
  color: #334155;
}

.pagination-measure-host {
  position: fixed;
  left: -99999px;
  top: -99999px;
  visibility: hidden;
  pointer-events: none;
  z-index: -1;
}

:deep(.pagination-measure-page) {
  margin: 0 !important;
  box-shadow: none !important;
  border-radius: 0 !important;
}

.page-footer {
  margin-top: auto;
  border-top: 1px solid #dce3ea;
  padding-top: 8px;
  display: flex;
  justify-content: space-between;
  color: #6b7280;
  font-size: 16px;
}

.report-overview-page {
  gap: 18px;
}

.report-overview-section {
  display: flex;
  min-height: 0;
  flex: 1;
  padding: 0;
}

.report-overview-frame {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.report-overview-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: transparent;
}

.report-overview-empty {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.82);
}

.issue-report-page {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 12px;
}

.issue-report-page .page-header {
  margin-bottom: 0;
}

.issue-page-body {
  display: grid;
  min-height: 0;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 10px;
  overflow: hidden;
}

.issue-report-hero {
  display: grid;
  grid-template-columns: 1fr 144px;
  gap: 16px;
  align-items: stretch;
  padding: 18px 20px;
  border: 1px solid #d9e1eb;
  border-radius: 14px;
  background:
    linear-gradient(
      135deg,
      rgba(239, 246, 255, 0.95),
      rgba(255, 255, 255, 0.98)
    ),
    #fff;
}

.issue-report-hero-main {
  min-width: 0;
}

.issue-report-kicker {
  color: #1d4ed8;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.issue-report-title {
  margin-top: 8px;
  color: #0f172a;
  font-size: 26px;
  line-height: 1.35;
  font-weight: 700;
}

.issue-report-subtitle {
  margin-top: 8px;
  color: #64748b;
  font-size: 20px;
}

.issue-report-hero-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  padding-left: 12px;
  border-left: 1px solid #d7dde5;
}

.issue-report-severity {
  align-self: flex-end;
  font-size: 18px;
}

.issue-report-side-text {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  color: #64748b;
  font-size: 20px;
}

.issue-report-side-text strong {
  color: #0f172a;
  font-size: 22px;
}

.issue-report-section {
  border: 1px solid #d9e1eb;
  border-radius: 14px;
  padding: 14px 16px;
  background: #fff;
}

.issue-report-section-title {
  margin-bottom: 10px;
  padding-left: 10px;
  border-left: 4px solid #1d4ed8;
  color: #0f172a;
  font-size: 20px;
  font-weight: 700;
}

.issue-report-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 14px;
}

.issue-report-field {
  display: flex;
  min-height: 48px;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #dce3ea;
}

.issue-report-field span {
  color: #64748b;
  font-size: 18px;
}

.issue-report-field strong {
  color: #1f2937;
  font-size: 18px;
  line-height: 1.6;
  font-weight: 500;
}

.issue-report-evidence {
  display: flex;
  min-height: 0;
  flex-direction: column;
  border: 1px solid #d9e1eb;
  border-radius: 14px;
  padding: 16px 18px;
  background: #f8fafc;
}

.issue-report-evidence-layout {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
  align-items: stretch;
}

.issue-report-figure {
  display: flex;
  min-height: 0;
}

.issue-report-figure-frame {
  display: flex;
  width: 100%;
  height: 360px;
  min-height: 360px;
  align-items: center;
  justify-content: center;
  border: 1px solid #d9e1eb;
  border-radius: 12px;
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.98),
      rgba(248, 250, 252, 0.98)
    ),
    #fff;
  overflow: hidden;
}

.issue-report-figure-image {
  width: auto;
  max-width: 100%;
  height: auto;
  max-height: 100%;
  object-fit: contain;
  background: #fff;
}

.issue-report-figure-empty {
  width: 100%;
  min-height: 360px;
  border: 1px dashed #d9e1eb;
  border-radius: 12px;
  background: #fff;
}

.issue-report-conclusion {
  flex: 0 0 auto;
}

.issue-report-conclusion-label {
  color: #64748b;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.issue-report-conclusion-text {
  margin: 8px 0 0;
  color: #0f172a;
  font-size: 18px;
  /* line-height: 1.8; */
}

.issue-suggestion-editor {
  margin-bottom: 0;
}

.issue-empty {
  padding: 18px;
  text-align: center;
  color: #9ca3af;
  font-size: 16px;
}

.issue-empty-panel {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
}

.findings-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 6px;
}

.finding-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}

.export-history {
  border: 1px solid #d4dbe4;
  border-radius: 6px;
  overflow: hidden;
}

.export-item {
  display: grid;
  grid-template-columns: 1fr 180px;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid #e4e9ef;
  font-size: 16px;
}

.export-item:last-child {
  border-bottom: none;
}

.c2m-report-page {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 10px;
}

.c2m-report-page .page-header {
  margin-bottom: 0;
}

.c2m-report-body {
  display: grid;
  min-height: 0;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 10px;
  overflow: hidden;
}

.c2m-report-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid #d9e1eb;
  border-radius: 16px;
  background:
    radial-gradient(
      circle at top right,
      rgba(15, 118, 110, 0.12),
      transparent 34%
    ),
    linear-gradient(135deg, #f8fafc, #ffffff);
}

.c2m-report-hero-main {
  min-width: 0;
}

.c2m-report-kicker {
  color: #0f766e;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.c2m-report-title {
  margin-top: 6px;
  color: #0f172a;
  font-size: 24px;
  line-height: 1.3;
  font-weight: 700;
}

.c2m-report-subtitle {
  margin-top: 8px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.6;
}

.c2m-report-hero-side {
  display: flex;
  min-width: 112px;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.c2m-report-trust-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 84px;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}

.c2m-report-trust-badge.is-good {
  background: #dcfce7;
  color: #166534;
}

.c2m-report-trust-badge.is-warning {
  background: #fef3c7;
  color: #92400e;
}

.c2m-report-trust-badge.is-risk {
  background: #fee2e2;
  color: #b91c1c;
}

.c2m-report-trust-badge.is-pending {
  background: #e2e8f0;
  color: #334155;
}

.c2m-report-hero-caption {
  color: #64748b;
  font-size: 13px;
}

.c2m-report-section {
  min-height: 0;
  padding: 14px 16px;
  border: 1px solid #d9e1eb;
  border-radius: 14px;
  background: #fff;
}

.c2m-report-section-title {
  margin-bottom: 10px;
  padding-left: 8px;
  border-left: 4px solid #0f766e;
  color: #0f172a;
  font-size: 16px;
  font-weight: 700;
}

.c2m-report-overview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.c2m-report-overview-item {
  display: flex;
  min-height: 68px;
  padding: 11px 12px;
  flex-direction: column;
  gap: 6px;
  border-radius: 12px;
  background: #f8fafc;
}

.c2m-report-overview-item span {
  color: #64748b;
  font-size: 12px;
}

.c2m-report-overview-item strong {
  color: #0f172a;
  font-size: 16px;
  line-height: 1.35;
  word-break: break-word;
}

.c2m-report-card-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.c2m-report-card {
  display: flex;
  min-height: 92px;
  padding: 12px 14px;
  flex-direction: column;
  gap: 8px;
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(248, 250, 252, 0.9), rgba(255, 255, 255, 1)),
    #fff;
  box-shadow: inset 0 0 0 1px rgba(226, 232, 240, 0.95);
}

.c2m-report-card-label {
  color: #64748b;
  font-size: 13px;
}

.c2m-report-card-value {
  color: #0f172a;
  font-size: 22px;
  line-height: 1.2;
  font-weight: 700;
}

.c2m-report-card-help {
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.45;
}

.c2m-report-analysis-grid {
  display: grid;
  grid-template-columns: 1.08fr 0.92fr;
  gap: 10px;
}

.c2m-report-chart-shell {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.c2m-report-chart {
  display: block;
  width: 100%;
  height: 150px;
  border-radius: 12px;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
}

.c2m-report-chart-axis {
  display: flex;
  justify-content: space-between;
  color: #64748b;
  font-size: 12px;
}

.c2m-report-insight-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.c2m-report-insight {
  padding: 12px 14px;
  border-radius: 12px;
  background: #f8fafc;
}

.c2m-report-insight-title {
  display: block;
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
}

.c2m-report-insight-text {
  margin: 6px 0 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.55;
}

.c2m-report-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.c2m-report-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.c2m-report-legend-item.is-good {
  background: rgba(63, 211, 107, 0.14);
  color: #15803d;
}

.c2m-report-legend-item.is-warning {
  background: rgba(246, 211, 101, 0.18);
  color: #a16207;
}

.c2m-report-legend-item.is-positive {
  background: rgba(240, 90, 79, 0.14);
  color: #b91c1c;
}

.c2m-report-empty,
.c2m-report-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: #f8fafc;
  color: #64748b;
}

.c2m-report-empty {
  min-height: 170px;
  font-size: 14px;
}

.c2m-report-empty-state {
  min-height: 0;
  height: 100%;
  flex-direction: column;
  gap: 10px;
  text-align: center;
}

.c2m-report-empty-state__title {
  color: #0f172a;
  font-size: 20px;
  font-weight: 700;
}

.c2m-report-empty-state__text {
  max-width: 520px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.8;
}

:deep(.el-textarea__inner) {
  font-size: 20px;
  line-height: 1.75;
}

:deep(.el-input__count) {
  font-size: 14px;
}

@media (max-width: 1100px) {
  .preview-toolbar {
    grid-template-columns: 1fr;
    align-items: stretch;
    padding: 14px 16px;
  }

  .toolbar-center {
    justify-content: stretch;
  }

  .toolbar-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .toolbar-zoom-shell {
    width: 100%;
  }

  .zoom-controls {
    grid-template-columns: 34px 70px minmax(96px, 150px) 34px;
  }

  .toolbar-title-row {
    flex-wrap: wrap;
  }

  .preview-canvas {
    --page-base-width: calc(100vw - 24px);
  }

  .a4-page {
    width: var(--page-base-width);
    height: calc(var(--page-base-width) * 297 / 210);
  }

  .a4-page-content {
    padding: 26px 18px;
  }

  .cover-main {
    margin-top: 36px;
  }

  .cover-title {
    font-size: 27px;
  }

  .cover-logo {
    width: 92px;
    height: 92px;
  }

  .cover-brand-name {
    font-size: 24px;
  }

  .cover-summary {
    gap: 14px;
    width: 100%;
    margin-top: auto;
    padding-top: 18px;
  }

  .cover-summary-line {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .cover-summary-label {
    font-size: 18px;
    text-align: left;
  }

  .cover-line-input,
  .cover-line-input--long {
    width: 100%;
    flex-basis: auto;
  }

  :deep(.cover-line-input .el-input__inner) {
    font-size: 18px;
  }

  .report-context-table {
    table-layout: auto;
  }

  .report-context-table th,
  .report-context-table td {
    padding: 12px 10px;
    font-size: 13px;
  }

  .issue-report-hero {
    grid-template-columns: 1fr;
  }

  .issue-report-hero-side {
    align-items: flex-start;
    padding-left: 0;
    border-left: 0;
    border-top: 1px solid #d7dde5;
    padding-top: 12px;
  }

  .issue-report-side-text {
    align-items: flex-start;
  }

  .issue-report-grid {
    grid-template-columns: 1fr;
  }

  .c2m-report-overview-grid,
  .c2m-report-card-grid,
  .c2m-report-analysis-grid {
    grid-template-columns: 1fr;
  }

  .c2m-report-hero {
    grid-template-columns: 1fr;
  }

  .c2m-report-hero-side {
    align-items: flex-start;
  }

  .issue-report-evidence-layout {
    display: flex;
    flex-direction: column;
  }

  .issue-report-figure-frame,
  .issue-report-figure-empty {
    height: 280px;
    min-height: 280px;
  }
}

@media (max-width: 760px) {
  .toolbar-left {
    align-items: flex-start;
    flex-direction: column;
  }

  .toolbar-back-btn {
    width: fit-content;
  }

  .toolbar-title {
    white-space: normal;
  }

  .toolbar-zoom-shell {
    align-items: stretch;
    gap: 12px;
    flex-direction: column;
  }

  .zoom-controls {
    grid-template-columns: 40px 1fr 40px;
    grid-template-areas:
      'minus current plus'
      'slider slider slider';
  }

  .zoom-icon-btn:first-child {
    grid-area: minus;
  }

  .zoom-current {
    grid-area: current;
  }

  .zoom-slider {
    grid-area: slider;
  }

  .zoom-icon-btn:last-child {
    grid-area: plus;
  }

  .toolbar-actions :deep(.toolbar-action-btn) {
    flex: 1 1 0;
  }

  .preview-canvas {
    padding: 14px 0 24px;
  }
}

@media print {
  .preview-toolbar {
    display: none;
  }

  .report-preview-page {
    background: #fff;
    min-height: auto;
  }

  .preview-canvas {
    padding: 0;
    overflow: visible;
  }

  .a4-stack {
    gap: 0;
  }

  .a4-page-shell {
    width: auto;
    height: auto;
  }

  .a4-page {
    position: static;
    left: auto;
    width: 210mm;
    min-height: 297mm;
    height: auto;
    box-shadow: none;
    margin: 0;
    border-radius: 0;
    page-break-after: always;
    transform: none;
  }

  .a4-page:last-child {
    page-break-after: auto;
  }
}
</style>
