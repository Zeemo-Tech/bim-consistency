import { http } from '@/utils/http'

/** 登录接口参数类型 */
export interface LoginParams {
  email: string
  password: string
}

/** 登录接口响应数据类型 */
export interface LoginResponse {
  token: string
}

/** 创建用户 */
export interface CreateUserParams {
  email: string
  password: string
  username: string
}

/** 通用响应结果类型 */
export interface Result<T = any> {
  code: number
  data: T
  msg: string
}

/** 用户登录校验接口 */
export const postContextWithApi = (params: LoginParams) => {
  return http.request<Result<LoginResponse>>('post', '/api/context', {
    data: params,
  })
}

/**
 * 创建用户接口
 */
export const postUserWithApi = (params: CreateUserParams) => {
  return http.request<Result>('post', '/api/user', { data: params })
}
