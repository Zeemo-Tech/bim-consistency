import { http } from '@/utils/http'

/** 通用响应结果类型 */
export interface Result<T = any> {
  code: number
  data: T
  msg: string
}

export type MeshRemeshStatus = 'queued' | 'processing' | 'succeeded' | 'failed'

export interface MeshRemeshSummary {
  supported: boolean
  status?: MeshRemeshStatus
  canManualRetry: boolean
}

export interface MeshRemeshStatusDetail extends MeshRemeshSummary {
  lastError?: string
  startedAt?: string
  finishedAt?: string
  resultFileId?: number
}

// 文件类型定义
export type FileType =
  | 'scan'
  | 'bim'
  | 'cad'
  | 'gauss'
  | 'annotation_image'
  | 'report_image'

export type FileStatus =
  | 'stored'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'pending_chunks'

// 文件上传状态
export interface UploadStatus {
  buildingName?: string | null
  chunkSize: number
  fileName: string
  fileSize: number
  floorName?: string | null
  projectId: number
  status: FileStatus
  totalChunks: number
  type: FileType
  uploadId: number
  uploadedChunks: number[]
}

// 项目文件信息
export interface ProjectFile {
  buildingName?: string | null
  id: number
  fileName: string
  floorName?: string | null
  originalName: string
  fileSize: number
  type: FileType
  status: FileStatus
  storagePath: string
  externalKey: string
  createdAt: string
  meshRemesh?: MeshRemeshSummary
}

// 项目文件信息（用于列表接口）
export interface ProjectFileInfo {
  buildingName?: string | null
  createdAt: string
  fileSize: number
  floorName?: string | null
  id: number
  meshRemesh?: MeshRemeshSummary
  originalName: string
  status: FileStatus
  type: FileType
}

// 文件类型分组
export interface FileTypeGroup {
  files: ProjectFileInfo[]
  type: FileType
}

export interface ProjectBuildingFloorInfo {
  cadFile: ProjectFileInfo | null
  floorName: string
}

export interface ProjectBuildingInfo {
  bimFile: ProjectFileInfo | null
  buildingName: string
  floors: ProjectBuildingFloorInfo[]
}

// 项目信息（包含文件分组）
export interface ProjectInfo {
  projectId: number
  projectName: string
  types: FileTypeGroup[]
}

// 项目文件列表响应
export interface ProjectFilesResponse {
  list: ProjectInfo[]
  page: number
  pageSize: number
  total: number
}

// 初始化上传请求参数
export interface InitUploadParams {
  buildingName?: string
  chunkSize: number
  fileHash: string
  fileName: string
  fileSize: number
  floorName?: string
  type: FileType
  producedAt?: string
}

// 文件上传参数
export interface UploadFileParams {
  buildingName?: string
  projectId: number
  type: FileType
  file: File
  floorName?: string
  producedAt?: string
  onProgress?: (progress: number) => void
  onChunkProgress?: (chunkIndex: number, totalChunks: number) => void
}

/**
 * 初始化文件上传
 */
export const initFileUpload = (projectId: number, params: InitUploadParams) => {
  return http.request<Result<UploadStatus>>(
    'post',
    `/api/projects/${projectId}/files`,
    {
      data: params,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}

/**
 * 获取上传会话状态
 */
export const getUploadStatus = (uploadId: number) => {
  return http.request<Result<UploadStatus>>('get', `/api/files/${uploadId}`)
}

/**
 * 上传文件分片
 */
export const uploadFileChunk = (
  uploadId: number,
  chunkIndex: number,
  chunkData: Blob,
) => {
  // 直接发送分片数据，不使用 FormData
  return http.request<Result<number>>(
    'put',
    `/api/files/${uploadId}/chunks/${chunkIndex}`,
    {
      data: chunkData,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      timeout: 0, // 上传大文件时禁用超时
    },
  )
}

/**
 * 取消文件上传
 */
export const cancelUpload = (uploadId: number) => {
  return http.request('delete', `/api/files/${uploadId}`)
}

/**
 * 完成文件上传（触发合并）
 */
export const completeUpload = (uploadId: number, fileHash?: string) => {
  const payload = fileHash ? { fileHash } : {}

  return http.request<Result<ProjectFile>>(
    'post',
    `/api/files/${uploadId}/complete`,
    {
      data: payload,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 600000,
    },
  )
}

/**
 * 获取项目文件列表
 * 按项目分页，项目内继续按文件类型聚合
 */
export interface GetProjectFilesParams {
  buildingName?: string
  fileName?: string
  floorName?: string
  page?: number
  pageSize?: number
  projectId?: number
  projectName?: string
  type?: FileType
  uploadedAtFrom?: string
  uploadedAtTo?: string
}

export const getProjectFiles = (params?: GetProjectFilesParams) => {
  const nextParams = {
    page: params?.page || 1,
    pageSize: params?.pageSize || 10,
    projectId: params?.projectId,
    projectName: params?.projectName,
    fileName: params?.fileName,
    type: params?.type,
    buildingName: params?.buildingName,
    floorName: params?.floorName,
    uploadedAtFrom: params?.uploadedAtFrom,
    uploadedAtTo: params?.uploadedAtTo,
  }

  return http.request<Result<ProjectFilesResponse>>(
    'get',
    '/api/projects/files',
    {
      params: nextParams,
    },
  )
}

/**
 * 删除项目文件
 * 删除文件项目同步删除本地文件
 */
export const deleteProjectFile = (projectId: number, fileId: number) => {
  return http.request<Result<void>>(
    'delete',
    `/api/projects/${projectId}/files/${fileId}`,
  )
}

/**
 * 获取指定项目的文件列表
 * 项目成员可查看当前项目的所有文件
 */
export const getProjectFilesByProjectId = (projectId: number) => {
  return http.request<Result<FileTypeGroup[]>>(
    'get',
    `/api/projects/${projectId}/files`,
  )
}

/**
 * 获取项目幢层树
 */
export const getProjectBuildings = (projectId: number) => {
  return http.request<Result<ProjectBuildingInfo[]>>(
    'get',
    `/api/projects/${projectId}/buildings`,
  )
}

/**
 * 获取IFC文件转换后的GLB文件
 * 通过此接口将IFC文件转换为GLB格式并返回文件Blob
 * @param projectId 项目ID
 * @param fileId 文件ID
 * @returns GLB文件的Blob数据
 */
export const getIfcGlbFile = (
  projectId: number,
  fileId: number,
): Promise<Blob> => {
  return http.request<Blob>(
    'get',
    `/api/projects/${projectId}/files/${fileId}/bim/glb`,
    {
      responseType: 'blob',
    },
  )
}

/** IFC元数据结构 */
export interface IfcMetadata {
  tree: IfcTreeNode
  elements: Record<string, IfcElement>
}

export interface IfcTreeNode {
  id: string
  name?: string
  type?: string
  children?: IfcTreeNode[]
}

export interface IfcElement {
  id: string
  name?: string
  type?: string
  [key: string]: any
}

/**
 * 获取IFC文件的元数据（构件树和属性）
 * @param projectId 项目ID
 * @param fileId 文件ID
 * @returns IFC元数据
 */
export const getIfcMetadata = (projectId: number, fileId: number) => {
  return http.request<IfcMetadata>(
    'get',
    `/api/projects/${projectId}/files/${fileId}/bim/meta`,
  )
}

/**
 * 获取扫描数据 3D Tiles tileset 的访问地址
 * @param projectId 项目ID
 * @param fileId 扫描数据文件ID
 * @param assetPath tileset 相对路径（默认：tiles/index.json）
 */
export const getScanTilesetUrl = (
  projectId: number,
  fileId: number,
  assetPath = 'tiles/index.json',
) => {
  return `/api/projects/${projectId}/files/${fileId}/scan/tiles/${assetPath}`
}

/**
 * 获取扫描数据 3D Tiles 资源内容
 * - json: 返回对象
 * - b3dm/pnts/cmpt/glb 等二进制: 返回 ArrayBuffer
 */
export const getScanTilesAsset = (
  projectId: number,
  fileId: number,
  assetPath: string,
  responseType: 'json' | 'arraybuffer' = 'arraybuffer',
) => {
  return http.request<any>(
    'get',
    `/api/projects/${projectId}/files/${fileId}/scan/tiles/${assetPath}`,
    {
      responseType,
    },
  )
}

/**
 * 规范化高斯资源相对路径
 */
const normalizeGaussAssetPath = (assetPath = 'meta.lcc') => {
  const normalized = assetPath.replace(/\\/g, '/').replace(/^\/+/, '').trim()
  return normalized || 'meta.lcc'
}

/**
 * 对高斯资源路径做分段编码（保留层级分隔符）
 */
const encodeGaussAssetPath = (assetPath: string) => {
  return assetPath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

/**
 * 获取高斯资源文件访问地址
 * @param projectId 项目 ID
 * @param fileId 文件 ID
 * @param assetPath 高斯资源相对路径（默认：meta.lcc）
 */
export const getGaussAssetUrl = (
  projectId: number,
  fileId: number,
  assetPath = 'meta.lcc',
) => {
  const normalizedPath = normalizeGaussAssetPath(assetPath)
  return `/api/projects/${projectId}/files/${fileId}/gauss/${encodeGaussAssetPath(normalizedPath)}`
}

/**
 * 拉取高斯资源内容
 * - json 资源：返回对象
 * - 其他资源：返回 ArrayBuffer
 */
export const getGaussAsset = (
  projectId: number,
  fileId: number,
  assetPath = 'meta.lcc',
  responseType?: 'json' | 'arraybuffer',
) => {
  const normalizedPath = normalizeGaussAssetPath(assetPath)
  const resolvedResponseType =
    responseType ||
    (normalizedPath.toLowerCase().endsWith('.json') ? 'json' : 'arraybuffer')

  return http.request<any>(
    'get',
    getGaussAssetUrl(projectId, fileId, normalizedPath),
    {
      responseType: resolvedResponseType,
    },
  )
}
