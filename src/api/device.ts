import { http } from '@/utils/http'

/** 通用响应结果类型 */
export interface Result<T = any> {
  code: number
  data: T
  msg: string
}

/** 设备字典项 */
export interface Device {
  id: number
  organizationId: number
  name: string
  /** 是否具备高斯能力 */
  hasGaussian: boolean
  /** 是否具备全景图能力 */
  hasPanorama: boolean
  sort: number
}

export interface DeviceUpsertParams {
  name: string
  hasGaussian?: boolean
  hasPanorama?: boolean
  sort?: number
}

/** 获取设备字典列表 */
export const getDevices = () => {
  return http.request<Result<Device[]>>('get', '/api/devices')
}

/** 新建设备 */
export const createDevice = (data: DeviceUpsertParams) => {
  return http.request<Result<Device>>('post', '/api/devices', { data })
}

/** 更新设备 */
export const updateDevice = (id: number, data: DeviceUpsertParams) => {
  return http.request<Result<Device>>('patch', `/api/devices/${id}`, { data })
}

/** 删除设备 */
export const deleteDevice = (id: number) => {
  return http.request<Result<{ id: number }>>('delete', `/api/devices/${id}`)
}
