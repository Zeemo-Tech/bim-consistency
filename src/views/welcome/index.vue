<template>
  <div class="welcome-dashboard">
    <section class="hero-panel">
      <div class="hero-copy">
        <h1 class="hero-title">{{ greetingText }}，{{ username || '用户' }}</h1>
        <p class="hero-subtitle">
          {{ currentOrganizationName }} · {{ currentRoleText }}
        </p>

        <div class="hero-badges">
          <span class="hero-badge">{{ dominantAssetBadge }}</span>
          <span class="hero-badge">{{ scanStatusBadge }}</span>
          <span class="hero-badge">{{ annotationRiskBadge }}</span>
        </div>
      </div>

      <aside class="hero-side">
        <div class="hero-side__top">
          <div class="hero-side__info">
            <div class="hero-side__time">{{ currentDateText }}</div>
          </div>
          <button
            class="dashboard-refresh"
            :disabled="loading"
            @click="refreshDashboard"
          >
            {{ loading ? '刷新中...' : '刷新工作台' }}
          </button>
        </div>
        <div class="hero-side__meta">
          最近更新时间：{{ lastUpdatedAt || '--' }}
        </div>
      </aside>
    </section>

    <section class="stats-strip">
      <article
        v-for="card in statsCards"
        :key="card.label"
        class="stat-card"
        :class="`stat-card--${card.tone}`"
      >
        <div class="stat-card__top">
          <div class="stat-card__icon">
            <el-icon>
              <component :is="card.icon" />
            </el-icon>
          </div>
          <span class="stat-card__trend">{{ card.trend }}</span>
        </div>
        <div class="stat-card__label">{{ card.label }}</div>
        <div class="stat-card__value">{{ card.value }}</div>
        <div class="stat-card__desc">{{ card.description }}</div>
      </article>
    </section>

    <section class="charts-grid">
      <el-card class="chart-panel asset-panel" shadow="never">
        <template #header>
          <div class="panel-head">
            <div>
              <div class="panel-title">数据资产构成</div>
              <div class="panel-subtitle">
                统计当前组织下各项目沉淀的 BIM、CAD、点云与高斯文件数量占比。
              </div>
            </div>
            <div class="panel-note">{{ dominantAssetBadge }}</div>
          </div>
        </template>
        <div ref="assetChartRef" v-loading="loading" class="chart-canvas" />
      </el-card>

      <el-card class="chart-panel report-panel" shadow="never">
        <template #header>
          <div class="panel-head">
            <div>
              <div class="panel-title">项目批注风险分布</div>
              <div class="panel-subtitle">
                按项目统计批注高、中、低风险数量分布。
              </div>
            </div>
            <div class="panel-note panel-note--alert">
              {{ annotationDistributionLabel }}
            </div>
          </div>
        </template>
        <div ref="reportChartRef" v-loading="loading" class="chart-canvas" />
      </el-card>
    </section>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  type Component,
} from 'vue'
import { ElMessage } from 'element-plus'
import {
  DataAnalysis,
  Files,
  FolderOpened,
  TrendCharts,
  WarningFilled,
} from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import {
  getHomeDashboard,
  type DashboardAssetType,
  type DashboardReportSeriesItem,
  type DashboardRiskSeriesName,
  type DashboardScans,
} from '@/api/dashboard'
import { useOrganizationStoreHook } from '@/store/modules/organization'
import { useUserStoreHook } from '@/store/modules/user'

defineOptions({
  name: 'Welcome',
})

type SummaryState = {
  projectCount: number
  totalFileCount: number
  scanFileCount: number
  pendingCalibrationCount: number
  highRiskReportCount: number
}

type FileTypeCountItem = {
  name: string
  value: number
  type: DashboardAssetType
}

type ScanSummaryState = {
  totalCount: number
  calibratedCount: number
  pendingCount: number
  topPendingProject: DashboardScans['topPendingProject']
}

type ReportDistributionState = {
  categories: string[]
  series: DashboardReportSeriesItem[]
}

type StatCard = {
  label: string
  value: string
  description: string
  trend: string
  tone: 'primary' | 'neutral' | 'warn' | 'danger'
  icon: Component
}

const userStore = useUserStoreHook()
const organizationStore = useOrganizationStoreHook()

const username = computed(() => userStore.nickname || userStore.username)
const currentOrganizationName = computed(() => {
  return organizationStore.currentOrganization?.organization?.name || '--'
})
const currentRoleText = computed(() => {
  if (!userStore.roles?.length) return '--'
  return userStore.roles.join(' / ')
})
const greetingText = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
})
const currentDateText = computed(() => {
  return new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
})

const loading = ref(false)
const lastUpdatedAt = ref('')
const summary = ref<SummaryState>({
  projectCount: 0,
  totalFileCount: 0,
  scanFileCount: 0,
  pendingCalibrationCount: 0,
  highRiskReportCount: 0,
})
const assetBreakdown = ref<FileTypeCountItem[]>([])
const scanSummary = ref<ScanSummaryState>({
  totalCount: 0,
  calibratedCount: 0,
  pendingCount: 0,
  topPendingProject: null,
})
const reportDistribution = ref<ReportDistributionState>({
  categories: [],
  series: [],
})
const assetChartRef = ref<HTMLDivElement | null>(null)
const reportChartRef = ref<HTMLDivElement | null>(null)

let assetChart: echarts.ECharts | null = null
let reportChart: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null

const fileTypeLabelMap: Record<DashboardAssetType, string> = {
  scan: '点云扫描',
  bim: 'BIM 模型',
  cad: 'CAD 图纸',
  gauss: '高斯模型',
}

const fileTypeColorMap: Record<DashboardAssetType, string> = {
  scan: '#1677ff',
  bim: '#409eff',
  cad: '#74b9ff',
  gauss: '#abd5ff',
}

const riskSeriesLabelMap: Record<DashboardRiskSeriesName, string> = {
  high: '高风险',
  medium: '中风险',
  low: '低风险',
}

const riskSeriesColorMap: Record<DashboardRiskSeriesName, string> = {
  high: '#409eff',
  medium: '#7ab8ff',
  low: '#b7dbff',
}

const riskSeriesOrder: DashboardRiskSeriesName[] = ['high', 'medium', 'low']
const reportChartVisibleProjectCount = 8

const formatNow = () => {
  return new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

const formatApiDateTime = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

const dominantAsset = computed(() => {
  const validItems = assetBreakdown.value.filter((item) => item.value > 0)
  if (!validItems.length) return null
  return validItems.reduce((max, item) => (item.value > max.value ? item : max))
})

const dominantAssetShare = computed(() => {
  if (!dominantAsset.value || !summary.value.totalFileCount) return 0
  return Math.round(
    (dominantAsset.value.value / summary.value.totalFileCount) * 100,
  )
})

const scanCompletionRate = computed(() => {
  if (!scanSummary.value.totalCount) return '--'
  return `${Math.round((scanSummary.value.calibratedCount / scanSummary.value.totalCount) * 100)}%`
})

const scanShare = computed(() => {
  if (!summary.value.totalFileCount) return 0
  return Math.round(
    (summary.value.scanFileCount / summary.value.totalFileCount) * 100,
  )
})

const maxPendingProject = computed(() => {
  return scanSummary.value.topPendingProject
})

const dominantAssetBadge = computed(() => {
  if (!dominantAsset.value) return '资产结构待形成'
  return `主导资产：${dominantAsset.value.name} ${dominantAssetShare.value}%`
})

const scanStatusBadge = computed(() => {
  if (!scanSummary.value.pendingCount) return '扫描链路稳定'
  return `待校准扫描 ${scanSummary.value.pendingCount} 项`
})

const normalizedReportSeries = computed<DashboardReportSeriesItem[]>(() => {
  const categoriesLength = reportDistribution.value.categories.length
  return riskSeriesOrder.map((name) => {
    const matchedSeries = reportDistribution.value.series.find(
      (item) => item.name === name,
    )
    return {
      name,
      data:
        matchedSeries?.data?.slice(0, categoriesLength) ||
        Array.from({ length: categoriesLength }, () => 0),
    }
  })
})

const totalAnnotationCount = computed(() => {
  return normalizedReportSeries.value.reduce((sum, seriesItem) => {
    return (
      sum +
      seriesItem.data.reduce((seriesSum, count) => seriesSum + (count || 0), 0)
    )
  }, 0)
})

const topHighRiskProject = computed(() => {
  const highSeries = normalizedReportSeries.value.find(
    (item) => item.name === 'high',
  )
  if (!highSeries) return null

  let maxCount = 0
  let maxIndex = -1
  highSeries.data.forEach((count, index) => {
    if ((count || 0) > maxCount) {
      maxCount = count || 0
      maxIndex = index
    }
  })

  if (maxIndex < 0 || !maxCount) return null

  return {
    name: reportDistribution.value.categories[maxIndex] || '--',
    count: maxCount,
  }
})

const annotationRiskBadge = computed(() => {
  if (!totalAnnotationCount.value) return '批注风险分布待形成'
  if (topHighRiskProject.value) {
    return `高风险聚焦：${topHighRiskProject.value.name} ${topHighRiskProject.value.count} 条`
  }
  return `批注总量 ${totalAnnotationCount.value} 条`
})

const annotationDistributionLabel = computed(() => {
  if (!totalAnnotationCount.value) return '暂无批注'
  return `批注总量 ${totalAnnotationCount.value} 条`
})

const statsCards = computed<StatCard[]>(() => {
  return [
    {
      label: '项目总数',
      value: `${summary.value.projectCount}`,
      description: '当前组织范围内已纳管项目数量。',
      trend: '组织视角',
      tone: 'primary',
      icon: FolderOpened,
    },
    {
      label: '文件总量',
      value: `${summary.value.totalFileCount}`,
      description: dominantAsset.value
        ? `${dominantAsset.value.name} 占比 ${dominantAssetShare.value}%，是当前主导资产。`
        : '当前尚未形成稳定的数据资产结构。',
      trend: '资产沉淀',
      tone: 'neutral',
      icon: Files,
    },
    {
      label: '点云扫描',
      value: `${summary.value.scanFileCount}`,
      description: summary.value.scanFileCount
        ? `占全部资产 ${scanShare.value}%，校准完成率 ${scanCompletionRate.value}。`
        : '当前没有点云扫描资产沉淀。',
      trend: '扫描资产',
      tone: 'neutral',
      icon: DataAnalysis,
    },
    {
      label: '待校准扫描',
      value: `${summary.value.pendingCalibrationCount}`,
      description: maxPendingProject.value
        ? `当前压力最高项目为 ${maxPendingProject.value.projectName}。`
        : '当前没有扫描积压，队列保持通畅。',
      trend:
        summary.value.pendingCalibrationCount >= 20
          ? '↑ 压力较高'
          : summary.value.pendingCalibrationCount > 0
            ? '→ 仍需处理'
            : '↓ 队列稳定',
      tone:
        summary.value.pendingCalibrationCount >= 20
          ? 'danger'
          : summary.value.pendingCalibrationCount > 0
            ? 'warn'
            : 'neutral',
      icon: TrendCharts,
    },
    {
      label: '高风险报告',
      value: `${summary.value.highRiskReportCount}`,
      description: summary.value.highRiskReportCount
        ? '当前统计周期内的高风险报告数量。'
        : '当前统计周期内暂无高风险报告。',
      trend: '报告口径',
      tone: summary.value.highRiskReportCount > 0 ? 'warn' : 'neutral',
      icon: WarningFilled,
    },
  ]
})

const initCharts = () => {
  if (assetChartRef.value && !assetChart) {
    assetChart = echarts.init(assetChartRef.value)
  }
  if (reportChartRef.value && !reportChart) {
    reportChart = echarts.init(reportChartRef.value)
  }
}

const disposeCharts = () => {
  assetChart?.dispose()
  reportChart?.dispose()
  assetChart = null
  reportChart = null
}

const getEmptyOption = (title: string): echarts.EChartsOption => ({
  title: {
    text: title,
    left: 'center',
    top: 'middle',
    textStyle: {
      color: '#8a94a6',
      fontSize: 14,
      fontWeight: 500,
    },
  },
})

const setAssetChartOption = (data: FileTypeCountItem[]) => {
  if (!assetChart) return
  const validData = data.filter((item) => item.value > 0)
  if (!validData.length) {
    assetChart.setOption(getEmptyOption('暂无文件数据'), true)
    return
  }

  assetChart.setOption(
    {
      tooltip: {
        trigger: 'item',
        formatter: '{b}<br/>数量：{c}<br/>占比：{d}%',
      },
      legend: {
        bottom: 8,
        icon: 'circle',
        textStyle: {
          color: '#5b6472',
        },
      },
      series: [
        {
          name: '数据资产构成',
          type: 'pie',
          radius: ['46%', '72%'],
          center: ['50%', '46%'],
          minAngle: 5,
          avoidLabelOverlap: true,
          label: {
            color: '#3f4652',
            formatter: '{b}\n{c}',
          },
          labelLine: {
            length: 14,
            length2: 10,
          },
          itemStyle: {
            borderColor: '#ffffff',
            borderWidth: 3,
          },
          emphasis: {
            scale: true,
            scaleSize: 6,
          },
          data: validData.map((item) => ({
            name: item.name,
            value: item.value,
            itemStyle: {
              color: fileTypeColorMap[item.type],
            },
          })),
        },
      ],
    },
    true,
  )
}

const setReportChartOption = (data: ReportDistributionState) => {
  if (!reportChart) return
  const categories = data.categories || []
  const enableProjectScroll = categories.length > reportChartVisibleProjectCount
  const visibleEndIndex = Math.min(
    categories.length - 1,
    reportChartVisibleProjectCount - 1,
  )
  const series = riskSeriesOrder.map((name) => {
    const matchedSeries = data.series.find((item) => item.name === name)
    return {
      name,
      data:
        matchedSeries?.data?.slice(0, categories.length) ||
        Array.from({ length: categories.length }, () => 0),
    }
  })

  const hasData = series.some((item) => item.data.some((count) => count > 0))
  if (!categories.length || !hasData) {
    reportChart.setOption(getEmptyOption('暂无批注风险数据'), true)
    return
  }

  reportChart.setOption(
    {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
        },
      },
      legend: {
        top: 0,
        right: 0,
        textStyle: {
          color: '#5b6472',
        },
      },
      grid: {
        top: 42,
        left: 16,
        right: 22,
        bottom: enableProjectScroll ? 64 : 14,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLine: {
          lineStyle: {
            color: '#dbe7f7',
          },
        },
        axisLabel: {
          color: '#738094',
          interval: 0,
          formatter: (value: string) =>
            value.length > 8 ? `${value.slice(0, 8)}...` : value,
        },
        axisTick: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        name: '批注数量',
        nameTextStyle: {
          color: '#738094',
          padding: [0, 0, 8, 0],
        },
        axisLabel: {
          color: '#738094',
        },
        splitLine: {
          lineStyle: {
            color: '#e8edf5',
          },
        },
      },
      dataZoom: enableProjectScroll
        ? [
            {
              type: 'inside',
              xAxisIndex: 0,
              startValue: 0,
              endValue: visibleEndIndex,
              zoomLock: true,
              moveOnMouseMove: true,
            },
            {
              type: 'slider',
              xAxisIndex: 0,
              height: 20,
              bottom: 6,
              startValue: 0,
              endValue: visibleEndIndex,
              zoomLock: true,
              brushSelect: false,
              borderColor: '#e4eefb',
              backgroundColor: '#edf5ff',
              fillerColor: 'rgba(64, 158, 255, 0.22)',
              handleStyle: {
                color: '#409eff',
              },
              moveHandleStyle: {
                color: '#409eff',
              },
              textStyle: {
                color: '#7b8aa0',
              },
            },
          ]
        : [],
      series: [
        {
          name: riskSeriesLabelMap.high,
          type: 'bar',
          barMaxWidth: 18,
          barCategoryGap: '32%',
          itemStyle: {
            color: riskSeriesColorMap.high,
            borderRadius: [6, 6, 0, 0],
          },
          data: series[0].data,
        },
        {
          name: riskSeriesLabelMap.medium,
          type: 'bar',
          barMaxWidth: 18,
          barCategoryGap: '32%',
          itemStyle: {
            color: riskSeriesColorMap.medium,
            borderRadius: [6, 6, 0, 0],
          },
          data: series[1].data,
        },
        {
          name: riskSeriesLabelMap.low,
          type: 'bar',
          barMaxWidth: 18,
          barCategoryGap: '32%',
          itemStyle: {
            color: riskSeriesColorMap.low,
            borderRadius: [6, 6, 0, 0],
          },
          data: series[2].data,
        },
      ],
    },
    true,
  )
}

const resizeCharts = () => {
  assetChart?.resize()
  reportChart?.resize()
}

const refreshDashboard = async () => {
  loading.value = true
  try {
    const response = await getHomeDashboard()
    if (response.code !== 200) {
      throw new Error(response.msg || '加载首页工作台失败')
    }

    const dashboard = response.data

    summary.value = {
      projectCount: dashboard.summary?.projectCount || 0,
      totalFileCount: dashboard.summary?.totalFileCount || 0,
      scanFileCount: dashboard.summary?.scanFileCount || 0,
      pendingCalibrationCount: dashboard.summary?.pendingCalibrationCount || 0,
      highRiskReportCount: dashboard.summary?.highRiskReportCount || 0,
    }
    assetBreakdown.value = (dashboard.assets?.breakdown || []).map((item) => ({
      name: fileTypeLabelMap[item.type],
      value: item.count,
      type: item.type,
    }))
    scanSummary.value = {
      totalCount: dashboard.scans?.totalCount || 0,
      calibratedCount: dashboard.scans?.calibratedCount || 0,
      pendingCount: dashboard.scans?.pendingCount || 0,
      topPendingProject: dashboard.scans?.topPendingProject || null,
    }
    reportDistribution.value = {
      categories: dashboard.reports?.categories || [],
      series: (dashboard.reports?.series || []).map((item) => ({
        name: item.name,
        data: item.data || [],
      })),
    }
    lastUpdatedAt.value =
      formatApiDateTime(dashboard.generatedAt) || formatNow()

    await nextTick()
    initCharts()
    setAssetChartOption(assetBreakdown.value)
    setReportChartOption(reportDistribution.value)
    resizeCharts()
  } catch (error: any) {
    console.error('加载首页工作台失败:', error)
    ElMessage.error(error?.message || '加载首页工作台失败')
    assetBreakdown.value = []
    scanSummary.value = {
      totalCount: 0,
      calibratedCount: 0,
      pendingCount: 0,
      topPendingProject: null,
    }
    reportDistribution.value = {
      categories: [],
      series: [],
    }
    lastUpdatedAt.value = ''
    await nextTick()
    initCharts()
    setAssetChartOption([])
    setReportChartOption(reportDistribution.value)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await nextTick()
  initCharts()
  resizeObserver = new ResizeObserver(() => {
    resizeCharts()
  })
  if (assetChartRef.value) resizeObserver.observe(assetChartRef.value)
  if (reportChartRef.value) resizeObserver.observe(reportChartRef.value)
  window.addEventListener('resize', resizeCharts)
  void refreshDashboard()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts)
  resizeObserver?.disconnect()
  resizeObserver = null
  disposeCharts()
})
</script>

<style scoped lang="scss">
.welcome-dashboard {
  --page-bg: #f3f7fc;
  --surface: #ffffff;
  --surface-soft: #f7faff;
  --text-strong: #142033;
  --text-body: #5e6b7d;
  --text-muted: #7a8798;
  --shadow-soft: 0 18px 44px rgba(15, 23, 42, 0.08);

  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: clamp(12px, 1vw, 18px);
  padding: clamp(6px, 0.7vw, 10px);
  color: var(--text-strong);
  overflow: hidden;
}

.hero-panel {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(260px, 21vw);
  gap: clamp(12px, 1vw, 18px);
  padding: clamp(16px, 1.2vw, 20px);
  border-radius: 28px;
  background:
    radial-gradient(
      circle at top left,
      rgba(18, 115, 234, 0.16),
      transparent 32%
    ),
    linear-gradient(135deg, #ffffff 0%, #f4f8fd 100%);
  // box-shadow: 0 22px 54px rgba(18, 39, 69, 0.08);
}

.hero-copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.hero-title {
  margin: 14px 0 0;
  color: #101a2d;
  font-size: clamp(28px, 2.1vw, 34px);
  line-height: 1.15;
  font-weight: 700;
}

.hero-subtitle {
  margin: 10px 0 0;
  color: #425167;
  font-size: clamp(14px, 1vw, 16px);
  font-weight: 600;
}

.hero-badges {
  display: flex;
  flex-wrap: wrap;
  gap: clamp(8px, 0.8vw, 10px);
  margin-top: clamp(12px, 1vw, 18px);
}

.hero-badge {
  padding: 9px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: inset 0 0 0 1px rgba(196, 208, 224, 0.8);
  color: #344255;
  font-size: 12px;
  font-weight: 600;
}

.hero-side {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  min-width: 0;
}

.hero-side__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.hero-side__info {
  min-width: 0;
  display: flex;
}

.hero-side__label {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-side__time {
  color: #0f1b30;
  margin-top: 4px;
  font-size: 18px;
  line-height: 1.25;
  font-weight: 700;
}

.hero-side__meta {
  color: var(--text-body);
  font-size: 12px;
  line-height: 1.5;
}

.dashboard-refresh {
  width: fit-content;
  margin-top: 0;
  padding: 9px 12px;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, #1273ea 0%, #0f5fd0 100%);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 12px 24px rgba(18, 115, 234, 0.22);
}

.dashboard-refresh:disabled {
  background: linear-gradient(135deg, #96bbea 0%, #80a9dd 100%);
  cursor: not-allowed;
  box-shadow: none;
}

.stats-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: clamp(10px, 0.9vw, 16px);
  flex-shrink: 0;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: clamp(132px, 15vh, 156px);
  padding: clamp(14px, 1vw, 18px) clamp(14px, 1vw, 18px)
    clamp(12px, 0.9vw, 16px);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: var(--shadow-soft);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 22px 48px rgba(15, 23, 42, 0.12);
}

.stat-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.stat-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  font-size: 18px;
  color: #1273ea;
  background: linear-gradient(
    135deg,
    rgba(18, 115, 234, 0.12),
    rgba(14, 165, 164, 0.12)
  );
}

.stat-card__trend {
  padding: 6px 10px;
  border-radius: 999px;
  background: #eef4ff;
  color: #215db5;
  font-size: 12px;
  font-weight: 700;
}

.stat-card__label {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
}

.stat-card__value {
  color: var(--text-strong);
  font-size: clamp(24px, 1.8vw, 28px);
  line-height: 1.05;
  font-weight: 700;
}

.stat-card__desc {
  color: var(--text-body);
  font-size: 12px;
  line-height: 1.6;
}

.stat-card--warn .stat-card__icon,
.stat-card--warn .stat-card__trend {
  color: #b86d05;
  background: rgba(245, 158, 11, 0.12);
}

.stat-card--danger .stat-card__icon,
.stat-card--danger .stat-card__trend {
  color: #c34040;
  background: rgba(239, 68, 68, 0.12);
}

.chart-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  border: 0;
  border-radius: 24px;
  background: var(--surface);
  // box-shadow: var(--shadow-soft);
}

.charts-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
  grid-template-rows: minmax(0, 1fr);
  gap: clamp(12px, 1vw, 18px);
  flex: 1 1 auto;
  min-height: 0;
  align-items: stretch;
}

:deep(.chart-panel .el-card__header) {
  padding: 22px 24px 8px;
  border-bottom: 0;
}

:deep(.chart-panel .el-card__body) {
  display: flex;
  flex: 1;
  min-height: 0;
  padding: 6px 20px 20px;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-title {
  color: #182234;
  font-size: 18px;
  font-weight: 700;
}

.panel-subtitle {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.panel-note {
  flex-shrink: 0;
  padding: 7px 11px;
  border-radius: 999px;
  background: #eef4ff;
  color: #1e60bc;
  font-size: 12px;
  font-weight: 700;
}

.panel-note--alert {
  background: rgba(239, 68, 68, 0.1);
  color: #c34040;
}

.chart-canvas {
  width: 100%;
  height: 100%;
  min-height: 0;
}

@media (max-width: 1440px) {
  .hero-panel {
    grid-template-columns: minmax(0, 1fr) minmax(240px, 26vw);
  }

  .stats-strip {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1200px) {
  .hero-panel,
  .charts-grid,
  .stats-strip {
    grid-template-columns: 1fr;
  }

  .charts-grid {
    grid-template-rows: none;
    min-height: auto;
  }
}

@media (max-width: 768px) {
  .welcome-dashboard {
    padding: 14px 12px;
    overflow: auto;
  }

  .hero-panel {
    padding: 22px;
  }

  .hero-side__top {
    flex-direction: column;
    align-items: flex-start;
  }

  .stats-strip {
    grid-template-columns: 1fr 1fr;
  }

  .stat-card {
    min-height: 144px;
  }

  .panel-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .chart-canvas {
    min-height: 280px;
  }
}

@media (max-height: 860px) {
  .welcome-dashboard {
    gap: 12px;
  }

  .hero-panel {
    padding: 16px;
  }

  .hero-title {
    font-size: 28px;
  }

  .hero-badges {
    margin-top: 12px;
  }

  .stat-card {
    min-height: 126px;
  }
}

html.dark .welcome-dashboard {
  background:
    radial-gradient(
      circle at top left,
      rgba(18, 115, 234, 0.14),
      transparent 30%
    ),
    linear-gradient(180deg, #0f1725 0%, #111c2a 100%);
}

html.dark .hero-panel {
  background:
    radial-gradient(
      circle at top left,
      rgba(59, 130, 246, 0.18),
      transparent 30%
    ),
    linear-gradient(
      135deg,
      rgba(20, 28, 40, 0.96) 0%,
      rgba(17, 24, 39, 0.98) 100%
    );
  box-shadow: 0 24px 56px rgba(0, 0, 0, 0.22);
}

html.dark .hero-title,
html.dark .hero-side__time,
html.dark .panel-title,
html.dark .stat-card__value {
  color: #edf2ff;
}

html.dark .hero-subtitle,
html.dark .hero-desc,
html.dark .hero-side__meta,
html.dark .panel-subtitle,
html.dark .stat-card__desc {
  color: #9aa7bb;
}

html.dark .hero-kicker,
html.dark .hero-badge,
html.dark .hero-side,
html.dark .panel-note,
html.dark .stat-card {
  background: linear-gradient(
    180deg,
    rgba(23, 34, 49, 0.96) 0%,
    rgba(18, 27, 40, 0.96) 100%
  );
  box-shadow: inset 0 0 0 1px rgba(71, 85, 105, 0.6);
}

html.dark .chart-panel {
  background: linear-gradient(
    135deg,
    rgba(20, 28, 40, 0.96) 0%,
    rgba(17, 24, 39, 0.96) 100%
  );
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.22);
}

html.dark .hero-kicker,
html.dark .hero-badge,
html.dark .panel-note,
html.dark .stat-card__trend,
html.dark .stat-card__icon,
html.dark .dashboard-refresh {
  color: #dbeafe;
}

html.dark .dashboard-refresh {
  background: linear-gradient(135deg, #2b7fff 0%, #155fd4 100%);
  box-shadow: 0 12px 24px rgba(18, 115, 234, 0.28);
}

html.dark .hero-side__label,
html.dark .stat-card__label {
  color: #a7b4c7;
}

html.dark .stat-card--warn .stat-card__icon,
html.dark .stat-card--warn .stat-card__trend {
  color: #f6c56c;
  background: rgba(245, 158, 11, 0.14);
  box-shadow: none;
}

html.dark .stat-card--danger .stat-card__icon,
html.dark .stat-card--danger .stat-card__trend,
html.dark .panel-note--alert {
  color: #f3a5a5;
  background: rgba(239, 68, 68, 0.14);
  box-shadow: none;
}
</style>
