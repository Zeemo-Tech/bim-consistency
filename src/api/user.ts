import { http } from '@/utils/http'

/** 通用响应结果类型 */
export interface Result<T = any> {
  code: number
  data: T
  msg: string
}

/** 用户基本信息类型 */
export interface UserInfo {
  id: number
  username: string
  email: string
  createdAt: string
}

/** 更新用户信息参数类型 */
export interface UpdateUserParams {
  username?: string
  email?: string
}

/** 组织信息类型 */
export interface Organization {
  id: number
  name: string
  address?: string
  contactPerson?: string
  contactPhone?: string
  description?: string
  email?: string
  logoUrl?: string
  parentOrganizationId?: number
}

/** 组织成员信息类型 */
export interface OrganizationMember {
  id: number
  displayName: string
  phone: string
  status: string
  organization: Organization
}

/** 组织列表响应类型 */
export interface OrganizationsListResponse {
  list: OrganizationMember[]
  page: number
  pageSize: number
  total: number
}

/** 权限信息类型 */
export interface Permission {
  id: number
  name: string
  displayName: string
  category: string
}

/**
 * 获取当前登录用户的基本信息
 */
export const getCurrentUser = () => {
  return http.request<Result<UserInfo>>('get', '/api/me')
}

/**
 * 更新当前用户信息
 * @param params 更新内容
 */
export const updateCurrentUser = (params: UpdateUserParams) => {
  return http.request<Result<UserInfo>>('patch', '/api/me', {
    data: params
  })
}

/**
 * 获取当前组织信息
 * 根据 X-Organization-Id 返回当前组织的基本信息
 */
export const getCurrentOrganization = () => {
  return http.request<Result<Organization>>('get', '/api/me/organization')
}

/**
 * 获取当前登录用户所属组织列表
 * @param page 页码（从1开始）
 * @param pageSize 每页数量，默认20
 */
export const getUserOrganizations = (page: number = 1, pageSize: number = 20) => {
  return http.request<Result<OrganizationsListResponse>>('get', '/api/me/organizations', {
    params: { page, pageSize }
  })
}

/**
 * 获取当前组织中的权限列表
 * 返回当前登录用户在 X-Organization-Id 组织范围内可用的权限
 */
export const getUserPermissions = () => {
  return http.request<Result<Permission[]>>('get', '/api/me/permissions')
}
