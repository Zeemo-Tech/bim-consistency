import { http } from '@/utils/http'

/** 通用响应结果类型 */
export interface Result<T = any> {
  code: number
  data: T
  msg: string
}

/** 通用分页列表结构 */
export interface ListData<T> {
  list: T[]
  page: number
  pageSize: number
  total: number
}

/** 扫描历史条目 */
export interface ScanListItem {
  scanFileId: number
  buildingName?: string | null
  floorName?: string | null
  producedAt: string
  hasCadAlignment: boolean
  hasBimAlignment: boolean
  calibrated: boolean
}

/** 单个扫描校准信息 */
export interface ScanCalibration {
  scanFileId: number
  calibrated: boolean
  hasCadAlignment: boolean
  hasBimAlignment: boolean
  hasGaussBinding: boolean
  cadBuildingName?: string | null
  cadFileId: number | null
  cadFloorName?: string | null
  bimFileId: number | null
  bimBuildingName?: string | null
  gaussFileId: number | null
  gaussBuildingName?: string | null
  gaussFloorName?: string | null
}

/** 获取扫描历史列表参数 */
export interface GetProjectScansParams {
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

/**
 * 扫描历史（日历）列表
 */
export const getProjectScans = (
  projectId: number,
  params?: GetProjectScansParams,
) => {
  return http.request<Result<ListData<ScanListItem>>>(
    'get',
    `/api/projects/${projectId}/scans`,
    {
      params,
    },
  )
}

/**
 * 获取单个 scan 的校准信息
 */
export const getScanCalibration = (projectId: number, scanFileId: number) => {
  return http.request<Result<ScanCalibration>>(
    'get',
    `/api/projects/${projectId}/scans/${scanFileId}/calibration`,
  )
}
