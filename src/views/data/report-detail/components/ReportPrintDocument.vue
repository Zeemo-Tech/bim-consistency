<template>
  <div class="report-print-root" aria-hidden="true">
    <div class="report-preview-page report-preview-page--print">
      <div class="a4-stack">
        <div class="a4-page-shell">
          <article class="a4-page">
            <section class="a4-page-content cover-page">
              <div class="cover-brand">
                <img class="cover-logo" :src="brandLogoUrl" alt="中建八局" />
              </div>
              <div class="cover-main">
                <h1 class="cover-title">
                  {{ reviewForm.reportTitle }}
                </h1>
                <div class="cover-subtitle">
                  <span>{{ reviewForm.reportSubtitle }}</span>
                </div>
              </div>
              <section class="cover-summary">
                <div class="cover-summary-line">
                  <span class="cover-summary-label">项目名称：</span>
                  <el-input
                    :model-value="reviewForm.projectName"
                    class="cover-line-input"
                    readonly
                  />
                </div>
                <div class="cover-summary-line">
                  <span class="cover-summary-label">报告编号：</span>
                  <el-input
                    :model-value="reviewForm.reportNo"
                    class="cover-line-input"
                    readonly
                  />
                </div>
                <div class="cover-summary-line">
                  <span class="cover-summary-label">版本号：</span>
                  <el-input
                    :model-value="reviewForm.version"
                    class="cover-line-input"
                    readonly
                  />
                </div>
                <div class="cover-summary-line">
                  <span class="cover-summary-label">创建人：</span>
                  <el-input
                    :model-value="reviewForm.reportCreator"
                    class="cover-line-input"
                    readonly
                  />
                </div>
                <div class="cover-summary-line">
                  <span class="cover-summary-label">生成日期：</span>
                  <el-input
                    :model-value="reviewForm.reportGeneratedDate"
                    class="cover-line-input"
                    readonly
                  />
                </div>
                <div class="cover-summary-line">
                  <span class="cover-summary-label">扫描文件：</span>
                  <el-input
                    :model-value="resolvedScanFileName"
                    class="cover-line-input"
                    readonly
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
                <div class="report-textarea-static">
                  {{ reviewForm.executiveSummary || ' ' }}
                </div>
              </section>
              <section class="section-block">
                <h3>数据来源与校准说明（可填写）</h3>
                <div class="report-textarea-static">
                  {{ reviewForm.calibrationStatement || ' ' }}
                </div>
              </section>
              <section class="section-block section-block--context">
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
                      <tr
                        v-for="row in reportContextTableRows"
                        :key="row.key"
                      >
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
          :key="`print-narrative-overflow-${pageIndex}`"
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
                        数据直接来自后端最新一次 C2M 计算结果，用于质量评估与整改优先级判断
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
                        重叠度 {{ formatPercent(c2mReportData.diagnostics.bboxOverlapIoU) }}
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
                        <strong>{{ formatDistance(c2mReportData.voxelSize || 0) }}</strong>
                      </div>
                      <div class="c2m-report-overview-item">
                        <span>参与网格顶点</span>
                        <strong>{{ formatInteger(c2mReportData.meshVertexCount) }}</strong>
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
                        <span class="c2m-report-card-label">{{ card.label }}</span>
                        <strong class="c2m-report-card-value">{{ card.value }}</strong>
                        <span class="c2m-report-card-help">{{ card.help }}</span>
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

                    <div class="c2m-report-section c2m-report-section--insights">
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
          :key="`print-issue-page-${page.pageKey}`"
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
                      <span
                        class="issue-report-severity-badge"
                        :class="severityBadgeClass(page.issue.severity)"
                      >
                        {{ issueLabel(page.issue.severity) }}
                      </span>
                      <div class="issue-report-side-text">
                        <span>状态</span>
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
                            loading="eager"
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
                          风险结论
                        </span>
                        <span class="issue-report-conclusion-text">
                          {{ page.issue.riskConclusion || '-' }}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section class="issue-report-section issue-suggestion-static">
                    <div class="issue-report-section-title">整改建议</div>
                    <div
                      class="report-textarea-static report-textarea-static--compact"
                    >
                      {{ page.issue.suggestion || ' ' }}
                    </div>
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
                <div class="report-textarea-static">
                  {{ reviewForm.rectificationPlan || ' ' }}
                </div>
              </section>
            </section>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import type { AnnotationScreenshot } from '@/api/annotation'
import type { C2MComputeResult } from '@/api/c2m'
import type { ReportIssue, ReportRecord } from '@/api/report'
import { useBrandStoreHook } from '@/store/modules/brand'

interface ReviewFormState {
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
}

interface ReportIssueEvidence extends AnnotationScreenshot {
  resolvedUrl: string
}

interface IssueDocumentPage {
  pageKey: string
  issue: ReportIssue | null
  issueIndex: number
  screenshot: ReportIssueEvidence | null
  screenshotIndex: number
  screenshotTotal: number
}

const props = defineProps({
  report: {
    type: Object as PropType<ReportRecord>,
    required: true,
  },
  reviewForm: {
    type: Object as PropType<ReviewFormState>,
    required: true,
  },
  issueDocumentPages: {
    type: Array as PropType<IssueDocumentPage[]>,
    required: true,
  },
  narrativeOverflowPages: {
    type: Array as PropType<Array<{ title: string; text: string }>>,
    required: true,
  },
  resolvedScanFileName: {
    type: String,
    required: true,
  },
  reportOverviewScreenshotUrl: {
    type: String,
    default: '',
  },
  c2mReportData: {
    type: Object as PropType<C2MComputeResult | null>,
    default: null,
  },
  c2mBimFileId: {
    type: Number as PropType<number | null>,
    default: null,
  },
  c2mStatusText: {
    type: String,
    default: '',
  },
})

const formatDate = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatContextLocation = (buildingName?: string, floorName?: string) => {
  const parts = [String(buildingName || '').trim(), String(floorName || '').trim()].filter(
    Boolean,
  )
  return parts.length ? parts.join(' / ') : '-'
}

const cadContextText = computed(() =>
  formatContextLocation(
    props.report.reportContext?.cad?.buildingName,
    props.report.reportContext?.cad?.floorName,
  ),
)

const bimContextText = computed(() =>
  formatContextLocation(
    props.report.reportContext?.bim?.buildingName,
    props.report.reportContext?.bim?.floorName,
  ),
)

const gaussianContextText = computed(() =>
  formatContextLocation(
    props.report.reportContext?.gaussian?.buildingName,
    props.report.reportContext?.gaussian?.floorName,
  ),
)
const reportContextTableRows = computed(() => {
  const pointcloud = props.report.reportContext?.pointcloud
  const cad = props.report.reportContext?.cad
  const bim = props.report.reportContext?.bim
  const gaussian = props.report.reportContext?.gaussian
  return [
    {
      key: 'pointcloud',
      label: '点云扫描',
      fileName: props.resolvedScanFileName || '-',
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

const brandStore = useBrandStoreHook()
const brandLogoUrl = computed(() => brandStore.logoUrl)

const countBySeverity = (severity: ReportIssue['severity']) =>
  props.reviewForm.issues.filter((item) => item.severity === severity).length

const issueLabel = (severity: ReportIssue['severity']) => {
  if (severity === 'high') return '高'
  if (severity === 'medium') return '中'
  return '低'
}

const issueStatusLabel = (status: ReportIssue['status']) => {
  if (status === 'closed') return '已关闭'
  if (status === 'in_progress') return '整改中'
  return '待整改'
}

const severityBadgeClass = (severity: ReportIssue['severity']) => {
  if (severity === 'high') return 'issue-report-severity-badge--high'
  if (severity === 'medium') return 'issue-report-severity-badge--medium'
  return 'issue-report-severity-badge--low'
}

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
    distanceFromCenter <= 0.5 ? 0 : Math.min(1, (distanceFromCenter - 0.5) / 0.5)
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

const c2mHistogramBars = computed(() => {
  const counts = props.c2mReportData?.histogram?.counts ?? []
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

const c2mRetentionText = computed(() => {
  const data = props.c2mReportData
  if (!data) return '-'
  const ratio =
    data.pointsBefore > 0 ? data.pointsAfter / data.pointsBefore : 0
  return formatPercent(ratio)
})

const c2mMetricCards = computed(() => {
  const stats = props.c2mReportData?.stats
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

const c2mTrustBadgeLabel = computed(() => {
  const iou = props.c2mReportData?.diagnostics?.bboxOverlapIoU ?? null
  if (!Number.isFinite(iou as number)) return '待评估'
  if ((iou as number) < 0.3) return '需复核'
  if ((iou as number) < 0.6) return '可参考'
  return '可信'
})

const c2mTrustBadgeClass = computed(() => {
  const iou = props.c2mReportData?.diagnostics?.bboxOverlapIoU ?? null
  if (!Number.isFinite(iou as number)) return 'is-pending'
  if ((iou as number) < 0.3) return 'is-risk'
  if ((iou as number) < 0.6) return 'is-warning'
  return 'is-good'
})

const c2mInsights = computed(() => {
  const data = props.c2mReportData
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
</script>

<style scoped>
.report-print-root {
  position: fixed;
  top: -99999px;
  left: -99999px;
  width: 210mm;
  pointer-events: none;
}

.report-preview-page--print {
  --report-print-scale: 0.8628;
  background: #fff;
  min-height: auto;
  width: 920px;
  zoom: var(--report-print-scale);
  transform-origin: top left;
}

.a4-stack {
  display: flex;
  flex-direction: column;
  gap: 0;
  align-items: stretch;
}

.a4-page-shell {
  position: relative;
  width: 920px;
  height: calc(920px * 297 / 210);
}

.a4-page {
  width: 920px;
  min-height: calc(920px * 297 / 210);
  height: calc(920px * 297 / 210);
  margin: 0;
  overflow: hidden;
  background: #fff;
  box-shadow: none;
  border-radius: 0;
}

.a4-page-content {
  display: flex;
  height: 100%;
  flex-direction: column;
  padding: 52px 58px;
  color: #111827;
  box-sizing: border-box;
}

.cover-page {
  background:
    radial-gradient(circle at 85% 12%, #eff6ff 0%, #ffffff 43%),
    linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  overflow: hidden;
}

.cover-brand {
  display: flex;
  align-items: center;
  gap: 18px;
}

.cover-logo {
  display: block;
}

.cover-main {
  margin-top: 86px;
}

.cover-title {
  margin: 0;
  color: #111827;
  font-size: 42px;
  line-height: 1.35;
  font-weight: 700;
  letter-spacing: 1px;
}

.cover-subtitle {
  margin-top: 14px;
  color: #64748b;
  font-size: 22px;
}

.cover-summary {
  display: flex;
  width: min(100%, 700px);
  margin: 400px auto 0;
  padding: 22px 0 6px;
  flex-direction: column;
  gap: 18px;
}

.cover-summary-line {
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  gap: 8px;
}

.cover-summary-label {
  flex: 0 0 124px;
  color: #1f2937;
  font-size: 24px;
  line-height: 1.4;
  font-weight: 700;
}

.cover-line-input {
  /* flex: 0 2 360px; */
  width: 100%;
  text-align: center;
}

.cover-line-input--long {
  flex-basis: 520px;
}

:deep(.cover-line-input .el-input__wrapper) {
  padding: 0 0 4px;
  border: none !important;
  border-bottom: 1.5px solid #232931 !important;
  border-radius: 0;
  background: transparent !important;
  box-shadow: none !important;
}

:deep(.cover-line-input .el-input__inner) {
  height: 44px;
  padding: 0;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
  background: transparent !important;
  color: #0f172a;
  font-size: 22px;
  line-height: 1.5;
  text-align: center;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 10px;

  border-bottom: 2px solid #1f2937;
}

.page-header h2 {
  margin: 0;
  color: #0f172a;
  font-size: 26px;
  font-weight: 700;
}

.section-block {
  margin-bottom: 14px;
}

.section-block h3 {
  margin: 0 0 8px;
  color: #1f2937;
  font-size: 22px;
  font-weight: 600;
}

.section-block--context {
  margin-top: 28px;
}

.report-context-table-card {
  overflow: hidden;
  border: 1px solid #dbe3ee;
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(255, 255, 255, 1));
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

.report-textarea-static {
  min-height: 240px;
  padding: 11px 15px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  color: #111827;
  font-size: 20px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
  box-sizing: border-box;
}

.report-textarea-static--compact {
  min-height: 132px;
}

.text-page-content {
  color: #334155;
  font-size: 22px;
  line-height: 1.86;
  white-space: pre-wrap;
}

.page-footer {
  display: flex;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid #dce3ea;
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
    radial-gradient(circle at top right, rgba(15, 118, 110, 0.12), transparent 34%),
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

.issue-summary {
  color: #6b7280;
  font-size: 14px;
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
  padding-left: 12px;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  border-left: 1px solid #d7dde5;
}

.issue-report-severity-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  padding: 8px 16px;
  border-radius: 999px;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
}

.issue-report-severity-badge--high {
  background: #dc2626;
}

.issue-report-severity-badge--medium {
  background: #d97706;
}

.issue-report-severity-badge--low {
  background: #475569;
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
  padding: 14px 16px;
  border: 1px solid #d9e1eb;
  border-radius: 14px;
  background: #fff;
}

.issue-suggestion-static {
  margin-bottom: 0;
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
  padding-bottom: 8px;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
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
  padding: 16px 18px;
  flex-direction: column;
  border: 1px solid #d9e1eb;
  border-radius: 14px;
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
  height: auto;
  max-width: 100%;
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
  /* margin: 8px 0 0; */
  color: #0f172a;
  font-size: 18px;
}

.issue-empty {
  padding: 18px;
  color: #9ca3af;
  font-size: 16px;
  text-align: center;
}
</style>
