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

export type AnnotationSeverity = 'low' | 'medium' | 'high'
export type AnnotationSource =
  | 'bim'
  | 'pointcloud'
  | 'gaussian'
  | 'consistencyResult'

export interface Annotation {
  id: number
  name: string
  source: AnnotationSource
  componentName?: string
  componentId?: string
  componentType?: string
  viewState?: any
  pointX?: number
  pointY?: number
  pointZ?: number
  startDate?: string
  endDate?: string
  severity?: AnnotationSeverity
}

export interface AnnotationQuery {
  page?: number
  pageSize?: number
  keyword?: string
  severity?: AnnotationSeverity
  source?: AnnotationSource
  componentName?: string
  componentId?: string
  componentType?: string
  dateFrom?: string
  dateTo?: string
}

export interface CreateAnnotationInput {
  name: string
  source: AnnotationSource
  componentName?: string
  componentId?: string
  componentType?: string
  viewState?: any
  pointX?: number
  pointY?: number
  pointZ?: number
  startDate?: string
  endDate?: string
  severity?: AnnotationSeverity
}

export interface UpdateAnnotationInput {
  name?: string
  source?: AnnotationSource
  componentName?: string
  componentId?: string
  componentType?: string
  viewState?: any | null
  pointX?: number
  pointY?: number
  pointZ?: number
  startDate?: string
  endDate?: string
  severity?: AnnotationSeverity
}

export interface AnnotationScreenshot {
  id?: number
  fileId: number
  originalName: string
  fileSize: number
  sortOrder: number
  url: string
}

const logAnnotationApi = (action: string, detail: Record<string, any>) => {
  console.info(`[Annotation API] ${action}`, detail)
}

/** 批注列表（分页） */
export const getAnnotationList = (
  projectId: number,
  scanFileId: number,
  params?: AnnotationQuery,
) => {
  logAnnotationApi('list', { projectId, scanFileId, params })
  return http.request<Result<ListData<Annotation>>>(
    'get',
    `/api/projects/${projectId}/scans/${scanFileId}/annotations`,
    { params },
  )
}

/** 创建批注 */
export const createAnnotation = (
  projectId: number,
  scanFileId: number,
  data: CreateAnnotationInput,
) => {
  logAnnotationApi('create', { projectId, scanFileId, data })
  return http.request<Result<Annotation>>(
    'post',
    `/api/projects/${projectId}/scans/${scanFileId}/annotations`,
    { data },
  )
}

/** 批注详情 */
export const getAnnotationDetail = (
  projectId: number,
  scanFileId: number,
  annotationId: number,
) => {
  logAnnotationApi('detail', { projectId, scanFileId, annotationId })
  return http.request<Result<Annotation>>(
    'get',
    `/api/projects/${projectId}/scans/${scanFileId}/annotations/${annotationId}`,
  )
}

/** 更新批注（部分更新） */
export const updateAnnotation = (
  projectId: number,
  scanFileId: number,
  annotationId: number,
  data: UpdateAnnotationInput,
) => {
  logAnnotationApi('update', { projectId, scanFileId, annotationId, data })
  return http.request<Result<boolean>>(
    'patch',
    `/api/projects/${projectId}/scans/${scanFileId}/annotations/${annotationId}`,
    { data },
  )
}

/** 删除批注 */
export const deleteAnnotation = (
  projectId: number,
  scanFileId: number,
  annotationId: number,
) => {
  logAnnotationApi('delete', { projectId, scanFileId, annotationId })
  return http.request<Result<boolean>>(
    'delete',
    `/api/projects/${projectId}/scans/${scanFileId}/annotations/${annotationId}`,
  )
}

/** 绑定截图到批注 */
export const bindAnnotationScreenshots = (
  projectId: number,
  scanFileId: number,
  annotationId: number,
  fileIds: number[],
) => {
  logAnnotationApi('bind-screenshots', {
    projectId,
    scanFileId,
    annotationId,
    fileIds,
  })
  return http.request<Result<AnnotationScreenshot[]>>(
    'post',
    `/api/projects/${projectId}/scans/${scanFileId}/annotations/${annotationId}/screenshots`,
    { data: { fileIds } },
  )
}

/** 截图列表 */
export const getAnnotationScreenshots = (
  projectId: number,
  scanFileId: number,
  annotationId: number,
) => {
  logAnnotationApi('screenshots', { projectId, scanFileId, annotationId })
  return http.request<Result<AnnotationScreenshot[]>>(
    'get',
    `/api/projects/${projectId}/scans/${scanFileId}/annotations/${annotationId}/screenshots`,
  )
}

/** 预览/下载单张截图（二进制） */
export const getAnnotationScreenshotBlob = (
  projectId: number,
  scanFileId: number,
  annotationId: number,
  screenshotId: number,
) => {
  logAnnotationApi('screenshot-download', {
    projectId,
    scanFileId,
    annotationId,
    screenshotId,
  })
  return http.request<Blob>(
    'get',
    `/api/projects/${projectId}/scans/${scanFileId}/annotations/${annotationId}/screenshots/${screenshotId}`,
    { responseType: 'blob' },
  )
}

/** 删除截图 */
export const deleteAnnotationScreenshot = (
  projectId: number,
  scanFileId: number,
  annotationId: number,
  screenshotId: number,
) => {
  logAnnotationApi('screenshot-delete', {
    projectId,
    scanFileId,
    annotationId,
    screenshotId,
  })
  return http.request<Result<boolean>>(
    'delete',
    `/api/projects/${projectId}/scans/${scanFileId}/annotations/${annotationId}/screenshots/${screenshotId}`,
  )
}

/** 调整截图顺序 */
export const updateAnnotationScreenshotOrder = (
  projectId: number,
  scanFileId: number,
  annotationId: number,
  fileIds: number[],
) => {
  logAnnotationApi('screenshots-order', {
    projectId,
    scanFileId,
    annotationId,
    fileIds,
  })
  return http.request<Result<boolean>>(
    'put',
    `/api/projects/${projectId}/scans/${scanFileId}/annotations/${annotationId}/screenshots/order`,
    { data: { fileIds } },
  )
}
