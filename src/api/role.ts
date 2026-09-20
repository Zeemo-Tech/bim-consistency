import { http } from '@/utils/http'

/** 通用响应结果类型 */
export interface Result<T = any> {
  code: number
  data: T
  msg: string
}

/** 权限信息类型 */
export interface Permission {
  id: number
  name: string
  displayName: string
  category: string
}

/** 角色信息类型 */
export interface Role {
  id: number
  name: string
  description?: string | null
  color?: string | null
  organizationId: number
  bypassPermission: boolean
  isSystem: boolean
  permissions: Permission[]
}

/** 分页信息类型 */
export interface PageInfo<T> {
  list: T[]
  page: number
  pageSize: number
  total: number
}

/** 创建角色参数类型 */
export interface CreateRoleParams {
  name: string
  description?: string
  color?: string | null
  permissionIds: number[]
}

/** 更新角色参数类型 */
export interface UpdateRoleParams {
  name?: string
  description?: string
  color?: string | null
  permissionIds?: number[]
}

/** 分配角色成员参数类型 */
export interface AssignRoleMembersParams {
  userIds: number[]
}

/** 角色成员类型 */
export interface RoleMember {
  id: number
  displayName: string
  email: string
  phone: string
  status: string
  userId: number
  username: string
}

/**
 * 查询角色列表
 * @param page 页码（从1开始）
 * @param pageSize 每页数量，默认20
 * @param keyword 模糊筛选角色名称或描述
 */
export const getRoles = (
  page: number = 1,
  pageSize: number = 20,
  keyword?: string,
) => {
  return http.request<Result<PageInfo<Role>>>('get', '/api/roles', {
    params: { page, pageSize, keyword },
  })
}

/**
 * 创建角色
 * @param params 角色信息
 */
export const createRole = (params: CreateRoleParams) => {
  return http.request<Result<Role>>('post', '/api/roles', {
    data: params,
  })
}

/**
 * 修改角色
 * @param id 角色 ID
 * @param params 角色信息
 */
export const updateRole = (id: number, params: UpdateRoleParams) => {
  return http.request<Result<Role>>('patch', `/api/roles/${id}`, {
    data: params,
  })
}

/**
 * 删除角色
 * @param id 角色 ID
 */
export const deleteRole = (id: number) => {
  return http.request<Result<string>>('delete', `/api/roles/${id}`)
}

/**
 * 批量分配角色成员
 * @param roleId 角色 ID
 * @param params 用户列表
 */
export const assignRoleMembers = (
  roleId: number,
  params: AssignRoleMembersParams,
) => {
  return http.request<Result<Record<string, number>>>(
    'post',
    `/api/roles/${roleId}/assignments`,
    {
      data: params,
    },
  )
}

/**
 * 查询角色成员列表
 * @param roleId 角色 ID
 * @param page 页码（从1开始）
 * @param pageSize 每页数量，默认20
 */
export const getRoleMembers = (
  roleId: number,
  page: number = 1,
  pageSize: number = 20,
) => {
  return http.request<Result<PageInfo<RoleMember>>>(
    'get',
    `/api/roles/${roleId}/members`,
    {
      params: { page, pageSize },
    },
  )
}

/**
 * 查询权限列表
 * @param page 页码（从1开始）
 * @param pageSize 每页数量，默认20
 * @param category 权限分类精确匹配
 * @param keyword 模糊匹配权限名称或展示名
 */
export const getPermissions = (
  page: number = 1,
  pageSize: number = 20,
  category?: string,
  keyword?: string,
) => {
  return http.request<Result<PageInfo<Permission>>>('get', '/api/permissions', {
    params: { page, pageSize, category, keyword },
  })
}
