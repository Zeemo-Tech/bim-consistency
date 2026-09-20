import { http } from '@/utils/http'
import type { MeshRemeshStatusDetail } from '@/api/fileManage'

export interface Result<T = any> {
  code: number
  data: T
  msg: string
}

/** 参数条件显示规则：当 key 对应参数值 === value 时才显示 */
export interface ParamVisibleWhen {
  key: string
  value: boolean | number
}

/** 算法参数描述 */
export interface AlgorithmParamDesc {
  key: string
  label: string
  type: 'int' | 'float' | 'bool'
  default: number | boolean | null
  min?: number
  max?: number
  description?: string
  tooltip?: string
  visible_when?: ParamVisibleWhen | null
}

/** 算法描述 */
export interface AlgorithmDesc {
  name: string
  label: string
  params: AlgorithmParamDesc[]
}

/** 均匀化统计 */
export interface RemeshStats {
  vertexBefore: number
  faceBefore: number
  vertexAfter: number
  faceAfter: number
}

/** 均匀化响应 */
export interface RemeshResult {
  resultFileId: number
  stats: RemeshStats
}

export type RemeshStatusResponse = MeshRemeshStatusDetail

/**
 * 查询可用的网格均匀化算法列表
 */
export const getRemeshAlgorithms = (projectId: number) => {
  return http.request<Result<AlgorithmDesc[]>>(
    'get',
    `/api/projects/${projectId}/mesh/algorithms`,
  )
}

/**
 * 获取最新均匀化结果文件的访问 URL
 */
export const getRemeshResultUrl = (
  projectId: number,
  fileId: number,
): string => {
  return `/api/projects/${projectId}/files/${fileId}/mesh/remesh/latest`
}

/**
 * 查询 BIM 网格均匀化状态
 */
export const getRemeshStatus = (projectId: number, fileId: number) => {
  return http.request<Result<RemeshStatusResponse>>(
    'get',
    `/api/projects/${projectId}/files/${fileId}/mesh/remesh/status`,
  )
}

/**
 * 对指定 BIM 文件执行网格均匀化
 * @param signal 可选的 AbortSignal，用于主动取消正在进行的请求
 */
export const remeshBimFile = (
  projectId: number,
  fileId: number,
  params: {
    algorithm: string
    params?: Record<string, any>
    force?: boolean
  },
  signal?: AbortSignal,
) => {
  return http.request<Result<RemeshResult>>(
    'post',
    `/api/projects/${projectId}/files/${fileId}/mesh/remesh`,
    {
      data: {
        algorithm: params.algorithm,
        params: params.params ?? {},
        force: params.force ?? false,
      },
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 1800000,
      signal,
    },
  )
}

/**
 * 重置指定 BIM 文件的网格均匀化任务
 */
export const resetRemeshTask = (projectId: number, fileId: number) => {
  return http.request<Result<RemeshStatusResponse>>(
    'post',
    `/api/projects/${projectId}/files/${fileId}/mesh/remesh/reset`,
  )
}
