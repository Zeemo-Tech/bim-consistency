import { http } from '@/utils/http'

/** 通用响应结果类型 */
export interface Result<T = any> {
  code: number
  data: T
  msg: string
}

// 预览图信息
export interface PreviewInfo {
  width: number
  height: number
  step: number
  bounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
  groundZ: number
  zMin: number
  zMax: number
  z0: number
  dz: number
  buckets: number
  pngBase64: string
  /** 仅当请求携带 splitLayers=true 时返回：透明背景的内容层 PNG */
  contentPngBase64?: string
}

// 轨迹点信息
export interface TrajectoryPoint {
  x: number
  y: number
  /** 实际扫描高度（由预览接口返回） */
  z: number
  timestamp: number
  imageName: string
  yaw?: number
  qx?: number
  qy?: number
  qz?: number
  qw?: number
}

// 轨迹信息
export interface TrajectoryInfo {
  pointCount: number
  generatedAt: string
  points: TrajectoryPoint[]
}

// 扫描预览响应
export interface ScanPreviewResponse {
  preview: PreviewInfo
  trajectory: TrajectoryInfo
}

// DXF文件响应
export interface DxfFileResponse {
  fileId: number
  fileName: string
  content: string
}

// CAD 对齐点对
export interface AlignmentPair {
  lasX: number
  lasY: number
  cadX: number
  cadY: number
}

// CAD 对齐结果
export interface AlignmentResult {
  id?: number
  projectId: number
  scanFileId: number
  cadFileId: number
  thetaDegrees: number
  scale: number
  tx: number
  ty: number
  rmse?: number
  pairs: AlignmentPair[]
  createdAt?: string
}

// CAD 计算对齐请求参数
export interface ComputeAlignmentParams {
  scanFileId: number
  cadFileId: number
  allowScale: boolean
  refineIcp: boolean
  pairs: AlignmentPair[]
}

// BIM 对齐点对
export interface ModelAlignmentPair {
  modelScanX: number
  modelScanY: number
  modelScanZ: number
  modelBimX: number
  modelBimY: number
  modelBimZ: number
}

// BIM 对齐结果
export interface ModelAlignment {
  modelId: number
  modelScanFileId: number
  modelBimFileId: number
  modelRotationQx: number
  modelRotationQy: number
  modelRotationQz: number
  modelRotationQw: number
  modelTranslationX: number
  modelTranslationY: number
  modelTranslationZ: number
  modelMatrix: number[]
  modelRmse: number
  modelMaxError: number
  modelPairCount: number
  modelInlierCount: number
}

// BIM 计算对齐请求参数
export interface ComputeModelAlignmentParams {
  modelScanFileId: number
  modelBimFileId: number
  modelPairs: ModelAlignmentPair[]
}

// 精细化配准请求参数
export interface FineAlignmentParams {
  modelScanFileId: number;
  modelBimFileId: number;
  maxCorrespondenceDistance?: number;
  rmseRegressRatio?: number;
  fitnessRegressRatio?: number;
  applyWhenRegressed?: boolean;
}

// 精细化配准评估指标
export interface FineAlignmentMetrics {
  initFitness: number;
  initRmse: number;
  fineFitness: number;
  fineRmse: number;
  deltaTranslationM: number;
  deltaRotationDeg: number;
  elapsedS: number;
  sourceTotalPoints: number;
  targetPoints: number;
}

// 精细化配准结果
export interface FineAlignmentResult {
  modelScanFileId: number;
  modelBimFileId: number;
  modelMatrix: number[];
  regressed: boolean;
  appliedFineResult: boolean;
  fallback: boolean;
  rmseRegressRatio: number;
  fitnessRegressRatio: number;
  applyWhenRegressed: boolean;
  metrics: FineAlignmentMetrics;
  modelRotationQx: number;
  modelRotationQy: number;
  modelRotationQz: number;
  modelRotationQw: number;
  modelTranslationX: number;
  modelTranslationY: number;
  modelTranslationZ: number;
}

// Scan 与 Gauss 绑定请求参数
export interface SaveGaussAlignmentParams {
  scanFileId: number
  gaussFileId: number
}

// Scan 与 Gauss 绑定结果
export interface GaussAlignmentResult {
  id: number
  scanFileId: number
  gaussFileId: number
}

// 轨迹图片响应
export interface TrajectoryImageResponse {
  dataUrl: string
}

/**
 * 获取扫描预览和轨迹
 */
export const getScanPreview = async (
  projectId: number,
  fileId: number,
  params: {
    size?: number
    heightMin?: number
    heightMax?: number
    bgAlpha?: number
    contentColor?: string
    bgColor?: string
    /** 为 true 时后端额外返回透明背景的内容层 PNG（contentPngBase64） */
    splitLayers?: boolean
  } = {},
) => {
  const response = await http.request<Result<ScanPreviewResponse>>(
    'get',
    `/api/projects/${projectId}/files/${fileId}/scan/preview`,
    {
      params: {
        size: params.size || 1024,
        heightMin: params.heightMin,
        heightMax: params.heightMax,
        bgAlpha: params.bgAlpha,
        contentColor: params.contentColor,
        bgColor: params.bgColor,
        splitLayers: params.splitLayers,
      },
    },
  )

  const points = response.data?.trajectory?.points ?? []
  const invalidIndex = points.findIndex(
    (point) => !Number.isFinite(point.z),
  )
  if (invalidIndex >= 0) {
    throw new Error(
      `预览接口返回的轨迹点缺少真实高度(z)，索引 ${invalidIndex}`,
    )
  }

  return response
}

/**
 * 获取DXF文件内容
 */
export const getDxfFile = (projectId: number, fileId: number) => {
  return http.request<Result<DxfFileResponse>>(
    'get',
    `/api/projects/${projectId}/files/${fileId}/dxf`,
  )
}

/**
 * 获取最新 CAD 对齐记录
 */
export const getLatestAlignment = (
  projectId: number,
  scanFileId: number,
  cadFileId: number,
) => {
  return http.request<Result<AlignmentResult>>(
    'get',
    `/api/projects/${projectId}/alignments/cad`,
    {
      params: {
        scanFileId,
        cadFileId,
      },
    },
  )
}

/**
 * 计算 CAD 对齐
 */
export const computeAlignment = (
  projectId: number,
  params: ComputeAlignmentParams,
) => {
  return http.request<Result<AlignmentResult>>(
    'post',
    `/api/projects/${projectId}/alignments/cad`,
    {
      data: params,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}

/**
 * 获取 BIM 对齐结果
 */
export const getBimAlignment = (
  projectId: number,
  modelScanFileId: number,
  modelBimFileId: number,
) => {
  return http.request<Result<ModelAlignment>>(
    'get',
    `/api/projects/${projectId}/alignments/bim`,
    {
      params: {
        modelScanFileId,
        modelBimFileId,
      },
    },
  )
}

/**
 * 创建/覆盖 BIM 对齐
 */
export const computeBimAlignment = (
  projectId: number,
  params: ComputeModelAlignmentParams,
) => {
  return http.request<Result<ModelAlignment>>(
    'post',
    `/api/projects/${projectId}/alignments/bim`,
    {
      data: params,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}

/**
 * 执行精细化配准（ICP 精调）
 */
export const computeFineAlignment = (projectId: number, params: FineAlignmentParams) => {
  return http.request<Result<FineAlignmentResult>>(
    "post",
    `/api/projects/${projectId}/alignments/bim/fine`,
    {
      data: params,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
};

/**
 * 保存/覆盖 scan 与 gauss 的绑定关系
 */
export const saveGaussAlignment = (
  projectId: number,
  params: SaveGaussAlignmentParams,
) => {
  return http.request<Result<GaussAlignmentResult>>(
    'post',
    `/api/projects/${projectId}/alignments/gauss`,
    {
      data: params,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}

/**
 * 获取轨迹点关联图片
 */
export const getTrajectoryImage = (
  projectId: number,
  fileId: number,
  imageName: string,
) => {
  return http.request<Result<TrajectoryImageResponse>>(
    'get',
    `/api/projects/${projectId}/files/${fileId}/scan/images/${encodeURIComponent(imageName)}`,
  )
}
