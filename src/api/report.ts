import { http } from '@/utils/http'

interface Result<T = any> {
  code: number
  data: T
  msg: string
}

export type ReportStatus =
  | 'queued'
  | 'running'
  | 'review_pending'
  | 'done'
  | 'failed'
export type ReportRiskLevel = 'low' | 'medium' | 'high'
export type ReportExportFormat = 'pdf' | 'docx'
export type ReportLanguage = 'zh-CN' | 'en-US'

export interface ReportTemplate {
  id: string
  name: string
  description: string
  scene: string
  isDefault?: boolean
}

export interface ReportIssue {
  id: string
  annotationId?: number
  title: string
  severity: 'high' | 'medium' | 'low'
  componentId: string
  componentName: string
  componentType: string
  coordinate: string
  period: string
  suggestion: string
  status: 'open' | 'in_progress' | 'closed'
  evidenceCount: number
  riskConclusion: string
}

export interface ReportExportRecord {
  id: string
  format: ReportExportFormat
  filename: string
  exportedAt: string
  modelVersion: string
  operator: string
}

export interface ReportOverviewScreenshot {
  fileId: number
  url: string
  capturedAt: string
  layout?: string
  width?: number
  height?: number
}

export interface ReportContextPointcloud {
  scanFileId: number | null
  scanFileName: string
  buildingName: string
  floorName: string
  producedAt: string
}

export interface ReportContextFileRef {
  fileId: number | null
  fileName: string
  buildingName: string
  floorName?: string
}

export interface ReportContext {
  pointcloud: ReportContextPointcloud
  cad: ReportContextFileRef
  bim: ReportContextFileRef
  gaussian: ReportContextFileRef
}

export interface CreateReportOverviewScreenshotInput {
  fileId: number
  capturedAt?: string
  layout?: string
  width?: number
  height?: number
}

export interface ReportRecord {
  id: number
  reportNo: string
  version: string
  reportTitle?: string
  reportSubtitle?: string
  projectId: number
  projectName: string
  scanFileId: number
  scanFileName?: string
  scanDate?: string
  status: ReportStatus
  statusReason?: string
  riskLevel: ReportRiskLevel
  templateId?: string
  templateName?: string
  includeScreenshots?: boolean
  language?: ReportLanguage
  exportFormat?: ReportExportFormat
  annotationSnapshotVersion?: number
  annotationCount?: number
  annotationIds?: number[]
  modelVersion?: string
  issueTotal: number
  highIssueCount: number
  mediumIssueCount: number
  lowIssueCount: number
  reportGeneratedDate?: string
  reportCreator?: string
  overviewScreenshot?: ReportOverviewScreenshot | null
  reportContext: ReportContext
  executiveSummary?: string
  calibrationStatement?: string
  rectificationPlan?: string
  keyFindings: string[]
  issues: ReportIssue[]
  exportHistory: ReportExportRecord[]
  archived?: boolean
  reviewer?: string
  reviewedAt?: string
  createdAt: string
  updatedAt: string
}

export interface ListReportQuery {
  page?: number
  pageSize?: number
  keyword?: string
  status?: ReportStatus | ''
  riskLevel?: ReportRiskLevel | ''
  projectId?: number
  scanFileId?: number
}

export interface ListReportResult {
  list: ReportRecord[]
  page: number
  pageSize: number
  total: number
}

export interface CheckReportReadyResult {
  ready: boolean
  calibrated: boolean
  annotationTotal: number
  reason?: string
}

export interface CreateReportTaskInput {
  projectId: number
  scanFileId: number
  projectName?: string
  scanDate?: string
  reportCreator?: string
  scanFileName?: string
  overviewScreenshot?: CreateReportOverviewScreenshotInput | null
  config: {
    templateId: string
    includeScreenshots: boolean
    language: ReportLanguage
    exportFormat: ReportExportFormat
  }
  annotationSnapshot?: {
    annotationCount?: number
    annotationIds?: number[]
  }
}

export interface UpdateReportReviewInput {
  reportNo?: string
  version?: string
  reportTitle?: string
  reportSubtitle?: string
  projectName?: string
  reportGeneratedDate?: string
  reportCreator?: string
  scanFileName?: string
  executiveSummary?: string
  calibrationStatement?: string
  rectificationPlan?: string
  keyFindings?: string[]
  issues?: ReportIssue[]
}

const normalizeStatus = (status?: string): ReportStatus => {
  if (status === 'queued' || status === 'running' || status === 'done') {
    return status
  }
  if (status === 'failed') return 'failed'
  return 'review_pending'
}

const normalizeRiskLevel = (riskLevel?: string): ReportRiskLevel => {
  if (riskLevel === 'high' || riskLevel === 'low') return riskLevel
  return 'medium'
}

const normalizeOverviewScreenshotUrl = (rawUrl?: string) => {
  const url = String(rawUrl || '').trim()
  if (!url) return ''
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:')) return url
  if (url.startsWith('/api/')) return url
  if (url.startsWith('/')) return `/api${url}`
  return `/api/${url}`
}

const normalizeOverviewScreenshot = (
  screenshot?: Partial<ReportOverviewScreenshot> | null,
): ReportOverviewScreenshot | null => {
  if (!screenshot || typeof screenshot !== 'object') return null
  const fileId = Number(screenshot.fileId)
  const url = normalizeOverviewScreenshotUrl(screenshot.url)
  if (!Number.isFinite(fileId) || fileId <= 0 || !url) return null
  return {
    fileId,
    url,
    capturedAt: String(screenshot.capturedAt || ''),
    layout: screenshot.layout,
    width: Number.isFinite(Number(screenshot.width))
      ? Number(screenshot.width)
      : undefined,
    height: Number.isFinite(Number(screenshot.height))
      ? Number(screenshot.height)
      : undefined,
  }
}

const normalizeReportContextFileRef = (
  value?: Partial<ReportContextFileRef> | null,
): ReportContextFileRef => {
  const fileId = Number(value?.fileId)
  return {
    fileId: Number.isFinite(fileId) && fileId > 0 ? fileId : null,
    fileName: String(value?.fileName || ''),
    buildingName: String(value?.buildingName || ''),
    floorName:
      value && 'floorName' in value
        ? String(value?.floorName || '')
        : undefined,
  }
}

const normalizeReportContextPointcloud = (
  value?: Partial<ReportContextPointcloud> | null,
): ReportContextPointcloud => {
  const scanFileId = Number(value?.scanFileId)
  return {
    scanFileId:
      Number.isFinite(scanFileId) && scanFileId > 0 ? scanFileId : null,
    scanFileName: String(value?.scanFileName || ''),
    buildingName: String(value?.buildingName || ''),
    floorName: String(value?.floorName || ''),
    producedAt: String(value?.producedAt || ''),
  }
}

const normalizeReportContext = (
  value?: Partial<ReportContext> | null,
): ReportContext => ({
  pointcloud: normalizeReportContextPointcloud(value?.pointcloud),
  cad: normalizeReportContextFileRef(value?.cad),
  bim: normalizeReportContextFileRef(value?.bim),
  gaussian: normalizeReportContextFileRef(value?.gaussian),
})

const normalizeIssue = (issue: Partial<ReportIssue>): ReportIssue => ({
  id: String(issue.id || ''),
  annotationId: Number.isFinite(Number(issue.annotationId))
    ? Number(issue.annotationId)
    : undefined,
  title: String(issue.title || ''),
  severity:
    issue.severity === 'high' ||
    issue.severity === 'medium' ||
    issue.severity === 'low'
      ? issue.severity
      : 'medium',
  componentId: String(issue.componentId || ''),
  componentName: String(issue.componentName || ''),
  componentType: String(issue.componentType || ''),
  coordinate: String(issue.coordinate || ''),
  period: String(issue.period || ''),
  suggestion: String(issue.suggestion || ''),
  status:
    issue.status === 'in_progress' || issue.status === 'closed'
      ? issue.status
      : 'open',
  evidenceCount: Number(issue.evidenceCount || 0),
  riskConclusion: String(issue.riskConclusion || ''),
})

const normalizeReportRecord = (record: Partial<ReportRecord>): ReportRecord => {
  const issues = Array.isArray(record.issues)
    ? record.issues.map((item) => normalizeIssue(item))
    : []
  const highIssueCountFromIssues = issues.filter(
    (item) => item.severity === 'high',
  ).length
  const mediumIssueCountFromIssues = issues.filter(
    (item) => item.severity === 'medium',
  ).length
  const lowIssueCountFromIssues = issues.filter(
    (item) => item.severity === 'low',
  ).length
  const riskLevelFromIssues: ReportRiskLevel =
    highIssueCountFromIssues > 0
      ? 'high'
      : mediumIssueCountFromIssues > 0
        ? 'medium'
        : 'low'

  return {
    id: Number(record.id || 0),
    reportNo: String(record.reportNo || ''),
    version: String(record.version || 'v1.0'),
    reportTitle: record.reportTitle ? String(record.reportTitle) : undefined,
    reportSubtitle: record.reportSubtitle
      ? String(record.reportSubtitle)
      : undefined,
    projectId: Number(record.projectId || 0),
    projectName: String(record.projectName || ''),
    scanFileId: Number(record.scanFileId || 0),
    scanFileName: record.scanFileName ? String(record.scanFileName) : undefined,
    scanDate: record.scanDate ? String(record.scanDate) : undefined,
    status: normalizeStatus(record.status),
    statusReason: record.statusReason ? String(record.statusReason) : undefined,
    riskLevel: record.riskLevel
      ? normalizeRiskLevel(record.riskLevel)
      : riskLevelFromIssues,
    templateId: record.templateId ? String(record.templateId) : undefined,
    templateName: record.templateName ? String(record.templateName) : undefined,
    includeScreenshots:
      typeof record.includeScreenshots === 'boolean'
        ? record.includeScreenshots
        : undefined,
    language:
      record.language === 'en-US' || record.language === 'zh-CN'
        ? record.language
        : undefined,
    exportFormat:
      record.exportFormat === 'docx' || record.exportFormat === 'pdf'
        ? record.exportFormat
        : undefined,
    annotationSnapshotVersion: Number.isFinite(
      Number(record.annotationSnapshotVersion),
    )
      ? Number(record.annotationSnapshotVersion)
      : undefined,
    annotationCount: Number.isFinite(Number(record.annotationCount))
      ? Number(record.annotationCount)
      : undefined,
    annotationIds: Array.isArray(record.annotationIds)
      ? record.annotationIds
          .map((item) => Number(item))
          .filter((item) => Number.isFinite(item) && item > 0)
      : [],
    modelVersion: record.modelVersion ? String(record.modelVersion) : undefined,
    issueTotal: Number(record.issueTotal ?? issues.length),
    highIssueCount: Number(record.highIssueCount ?? highIssueCountFromIssues),
    mediumIssueCount: Number(
      record.mediumIssueCount ?? mediumIssueCountFromIssues,
    ),
    lowIssueCount: Number(record.lowIssueCount ?? lowIssueCountFromIssues),
    reportGeneratedDate: record.reportGeneratedDate
      ? String(record.reportGeneratedDate)
      : undefined,
    reportCreator: record.reportCreator
      ? String(record.reportCreator)
      : undefined,
    overviewScreenshot: normalizeOverviewScreenshot(record.overviewScreenshot),
    reportContext: normalizeReportContext(record.reportContext),
    executiveSummary: record.executiveSummary
      ? String(record.executiveSummary)
      : undefined,
    calibrationStatement: record.calibrationStatement
      ? String(record.calibrationStatement)
      : undefined,
    rectificationPlan: record.rectificationPlan
      ? String(record.rectificationPlan)
      : undefined,
    keyFindings: Array.isArray(record.keyFindings)
      ? record.keyFindings.map((item) => String(item))
      : [],
    issues,
    exportHistory: Array.isArray(record.exportHistory)
      ? record.exportHistory.map((item) => ({
          id: String(item.id || ''),
          format: item.format === 'docx' ? 'docx' : 'pdf',
          filename: String(item.filename || ''),
          exportedAt: String(item.exportedAt || ''),
          modelVersion: String(item.modelVersion || ''),
          operator: String(item.operator || ''),
        }))
      : [],
    archived: Boolean(record.archived),
    reviewer: record.reviewer ? String(record.reviewer) : undefined,
    reviewedAt: record.reviewedAt ? String(record.reviewedAt) : undefined,
    createdAt: String(record.createdAt || record.updatedAt || ''),
    updatedAt: String(record.updatedAt || record.createdAt || ''),
  }
}

const unwrapResult = <T>(result: Result<T>) => result.data

export const listReportTemplates = async () => {
  const result = await http.request<Result<ReportTemplate[]>>(
    'get',
    '/api/reports/templates',
  )
  return Array.isArray(result.data)
    ? result.data.map((item) => ({
        id: String(item.id || ''),
        name: String(item.name || ''),
        description: String(item.description || ''),
        scene: String(item.scene || ''),
        isDefault: Boolean(item.isDefault),
      }))
    : []
}

export const checkReportReady = async (
  projectId: number,
  scanFileId: number,
) => {
  const result = await http.request<Result<CheckReportReadyResult>>(
    'get',
    `/api/projects/${projectId}/scans/${scanFileId}/reports/ready`,
  )
  return {
    ready: Boolean(result.data?.ready),
    calibrated: Boolean(result.data?.calibrated),
    annotationTotal: Number(result.data?.annotationTotal || 0),
    reason: result.data?.reason ? String(result.data.reason) : '',
  }
}

export const listReports = async (
  query: ListReportQuery = {},
): Promise<ListReportResult> => {
  const result = await http.request<Result<ListReportResult>>(
    'get',
    '/api/reports',
    {
      params: {
        page: query.page,
        pageSize: query.pageSize,
        keyword: query.keyword,
        status: query.status || undefined,
        riskLevel: query.riskLevel || undefined,
        projectId: query.projectId,
        scanFileId: query.scanFileId,
      },
    },
  )
  const data = unwrapResult(result)
  return {
    list: Array.isArray(data?.list)
      ? data.list.map((item) => normalizeReportRecord(item))
      : [],
    page: Number(data?.page || query.page || 1),
    pageSize: Number(data?.pageSize || query.pageSize || 10),
    total: Number(data?.total || 0),
  }
}

export const getReportDetail = async (reportId: number) => {
  const result = await http.request<Result<ReportRecord>>(
    'get',
    `/api/reports/${reportId}`,
  )
  return normalizeReportRecord(result.data || {})
}

export const createReportTask = async (payload: CreateReportTaskInput) => {
  const { projectId, scanFileId, ...data } = payload
  const result = await http.request<Result<ReportRecord>>(
    'post',
    `/api/projects/${projectId}/scans/${scanFileId}/reports`,
    { data },
  )
  return normalizeReportRecord(result.data || {})
}

export const updateReportReview = async (
  reportId: number,
  payload: UpdateReportReviewInput,
) => {
  const result = await http.request<Result<ReportRecord>>(
    'patch',
    `/api/reports/${reportId}`,
    { data: payload },
  )
  return normalizeReportRecord(result.data || {})
}

export const deleteReport = async (reportId: number): Promise<void> => {
  await http.request<any>('delete', `/api/reports/${reportId}`)
}

export const getReportOverviewScreenshotBlob = async (url: string) => {
  const normalizedUrl = normalizeOverviewScreenshotUrl(url)
  if (!normalizedUrl) {
    throw new Error('报告总览图地址无效')
  }
  return http.request<Blob>('get', normalizedUrl, { responseType: 'blob' })
}
