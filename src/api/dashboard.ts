import { http } from '@/utils/http'

export interface Result<T = any> {
  code: number
  data: T
  msg: string
}

export type DashboardAssetType = 'scan' | 'bim' | 'cad' | 'gauss'

export interface DashboardSummary {
  projectCount: number
  totalFileCount: number
  scanFileCount: number
  pendingCalibrationCount: number
  highRiskReportCount: number
}

export interface DashboardAssetBreakdownItem {
  type: DashboardAssetType
  count: number
}

export interface DashboardTopPendingProject {
  projectId: number
  projectName: string
  totalCount: number
  calibratedCount: number
  pendingCount: number
}

export interface DashboardScans {
  totalCount: number
  calibratedCount: number
  pendingCount: number
  topPendingProject: DashboardTopPendingProject | null
}

export type DashboardRiskSeriesName = 'high' | 'medium' | 'low'

export interface DashboardReportSeriesItem {
  name: DashboardRiskSeriesName
  data: number[]
}

export interface HomeDashboardResponse {
  generatedAt: string
  summary: DashboardSummary
  assets: {
    breakdown: DashboardAssetBreakdownItem[]
  }
  scans: DashboardScans
  reports: {
    categories: string[]
    series: DashboardReportSeriesItem[]
  }
}

export const getHomeDashboard = () => {
  return http.request<Result<HomeDashboardResponse>>(
    'get',
    '/api/dashboards/home',
  )
}
