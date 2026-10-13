import { http } from '@/utils/http'

export interface Result<T = any> {
  code: number
  data: T
  msg: string
}

export interface C2MStats {
  /** 有符号最小距离（负值表示内缩，正值表示外凸） */
  min: number
  /** 有符号最大距离 */
  max: number
  mean: number
  std: number
  p50: number
  p90: number
  p95: number
  p99: number
}

export interface C2MHistogram {
  binEdges: number[]
  counts: number[]
  /** 服务端可选：高于显示上限的样本数 */
  overflowCount?: number
}

export interface C2MBbox {
  min: number[]
  max: number[]
}

export interface C2MDiagnostics {
  scanBboxRaw: C2MBbox
  scanBboxAfterTransform: C2MBbox
  meshBbox: C2MBbox
  bboxOverlapIoU: number
}

/** 与 GET latest / POST compute 响应一致 */
export interface C2MComputeResult {
  bimFileId?: number
  voxelSize?: number
  pointsBefore: number
  pointsAfter: number
  meshVertexCount?: number
  stats: C2MStats
  histogram: C2MHistogram
  diagnostics: C2MDiagnostics
  coloredPlyFileId?: number
  distancesFileId?: number
}

export interface C2MComputeParams {
  bimFileId: number
  params?: {
    voxelSize?: number
    maxColormapDistance?: number
    maxHistogramDistance?: number
    histogramBins?: number
    /** 合格界限（米），±toleranceLimit 以内为绿色合格区 */
    toleranceLimit?: number
    /** kNN 候选邻居数，启用法向约束时生效，建议 8~16 */
    knnK?: number
    /** 是否启用法向量约束筛选 */
    normalConstraintEnabled?: boolean
    /** 仅保留前半空间候选点（dot(N,vec)>=0） */
    normalHalfSpaceOnly?: boolean
    /** 法向夹角阈值（度），候选点与法向夹角超过此值时被过滤 */
    normalMaxAngleDeg?: number
    /** 全候选被筛掉时的回退策略：nearest */
    normalFallbackMode?: string
  }
}

/**
 * 执行 Cloud-to-Mesh Distance 计算
 */
export const computeC2M = (
  projectId: number,
  scanId: number,
  data: C2MComputeParams,
  signal?: AbortSignal,
) => {
  return http.request<Result<C2MComputeResult>>(
    'post',
    `/api/projects/${projectId}/scans/${scanId}/c2m/compute`,
    {
      data,
      headers: { 'Content-Type': 'application/json' },
      timeout: 1800000,
      signal,
    },
  )
}

/**
 * 获取指定 scan + bim 的 C2M 计算结果（bimFileId 必填）
 */
export const getC2MLatest = (
  projectId: number,
  scanId: number,
  bimFileId: number,
) => {
  return http.request<Result<C2MComputeResult>>(
    'get',
    `/api/projects/${projectId}/scans/${scanId}/c2m/latest`,
    { params: { bimFileId } },
  )
}

function c2mBimQuery(bimFileId: number): string {
  const q = new URLSearchParams({ bimFileId: String(bimFileId) })
  return `?${q.toString()}`
}

export interface C2MRecolorParams {
  bimFileId: number
  maxColormapDistance: number
  toleranceLimit: number
  smoothingIterations?: number
  smoothingStrength?: number
}

export interface C2MRecolorResult {
  coloredPlyFileId: number
  coloredPlySize: number
}

/**
 * 用新色彩参数重新生成 colored PLY（不重新计算距离）
 * 用于「确认应用」——将当前可视化配色固化为服务端 PLY，确保四分屏/批注视图颜色一致
 */
export const recolorC2M = (
  projectId: number,
  scanId: number,
  data: C2MRecolorParams,
  signal?: AbortSignal,
) => {
  return http.request<Result<C2MRecolorResult>>(
    'post',
    `/api/projects/${projectId}/scans/${scanId}/c2m/recolor`,
    {
      data,
      headers: { 'Content-Type': 'application/json' },
      timeout: 300000,
      signal,
    },
  )
}

/**
 * C2M 着色 PLY 下载 URL（需鉴权头，与 fetch 同域）
 */
export const getC2MColoredPlyUrl = (
  projectId: number,
  scanId: number,
  bimFileId: number,
): string => {
  return `/api/projects/${projectId}/scans/${scanId}/c2m/colored-ply${c2mBimQuery(bimFileId)}`
}

/**
 * C2M 每顶点距离 float32 小端二进制（4 * meshVertexCount 字节）
 */
export const getC2MDistancesUrl = (
  projectId: number,
  scanId: number,
  bimFileId: number,
): string => {
  return `/api/projects/${projectId}/scans/${scanId}/c2m/distances${c2mBimQuery(bimFileId)}`
}

/** 单个建议批注点（坐标为 remesh PLY 顶点坐标系，前端需按 BIM 世界矩阵映射到场景） */
export interface C2MSuggestedAnnotationPoint {
  id: number
  x: number
  y: number
  z: number
  /** 有符号偏差（正=外凸/空隙，负=内凹/混凝土不足） */
  distance: number
  absDistance: number
  sign: 'positive' | 'negative'
  severity: 'low' | 'medium' | 'high'
  /** 该簇内超限顶点数 */
  vertexCount: number
  /** 簇内平均超限幅度（米） */
  meanAbsDistance: number
  /** 代表点幅度 / 容差 的倍数 */
  ratio: number
}

export interface C2MSuggestAnnotationsParams {
  bimFileId: number
  /** 合格界限（米），±toleranceLimit 以内视为合格 */
  toleranceLimit?: number
  /** 聚类半径 / 体素边长（米） */
  clusterRadius?: number
  /** 最多返回建议点数 */
  maxPoints?: number
  /** 簇内超限顶点数下限，抑制单点噪声 */
  minClusterVertices?: number
}

export interface C2MSuggestAnnotationsResult {
  bimFileId: number
  toleranceLimit: number
  exceedanceVertexCount: number
  clusterCount: number
  returnedCount: number
  suggestedPoints: C2MSuggestedAnnotationPoint[]
}

/**
 * 按偏差超限位置生成「建议批注点」。
 *
 * 说明：后端 `POST /api/projects/:projectId/scans/:scanId/c2m/suggest-annotations`
 * 依据 C2M 每顶点有符号距离，对 ±toleranceLimit 以外的位置做空间聚类，
 * 返回每个超限簇的代表落点，供前端确认/补充为正式批注。
 */
export const suggestC2MAnnotations = (
  projectId: number,
  scanId: number,
  data: C2MSuggestAnnotationsParams,
  signal?: AbortSignal,
) => {
  return http.request<Result<C2MSuggestAnnotationsResult>>(
    'post',
    `/api/projects/${projectId}/scans/${scanId}/c2m/suggest-annotations`,
    {
      data,
      headers: { 'Content-Type': 'application/json' },
      timeout: 300000,
      signal,
    },
  )
}
