import { http } from '@/utils/http'

/** 通用响应结果类型 */
export interface Result<T = any> {
  code: number
  data: T
  msg: string
}

/** 分页信息类型 */
export interface PageInfo<T> {
  list: T[]
  page: number
  pageSize: number
  total: number
}

/** 角色信息类型 */
export interface Role {
  id: number
  name: string
  description?: string
  color?: string
  bypassPermission: boolean
  isSystem: boolean
  organizationId: number
  permissions: Array<{
    id: number
    name: string
    displayName: string
    category: string
  }>
}

/** 成员信息类型 */
export interface Member {
  id: number
  displayName: string
  email: string
  phone: string
  status: string
  userId: number
  username: string
  role: Role
}

/** 邀请成员参数类型 */
export interface InviteMemberParams {
  displayName: string
  email: string
  phone: string
  roleId: number
}

/** 更新成员参数类型 */
export interface UpdateMemberParams {
  displayName?: string
  phone?: string
}

/** 邀请成员响应类型 */
export interface InviteMemberResponse {
  id: number
  displayName: string
  phone: string
  status: string
  organization: {
    id: number
    name: string
    address?: string
    contactPerson?: string
    contactPhone?: string
    description?: string
    email?: string
    parentOrganizationId?: number
  }
}

/**
 * 查询角色列表
 * @param page 页码（从1开始）
 * @param pageSize 每页数量，默认20
 * @param keyword 模糊筛选角色名称或描述
 */
export const getRoles = (page: number = 1, pageSize: number = 20, keyword?: string) => {
  return http.request<Result<PageInfo<Role>>>('get', '/api/roles', {
    params: { page, pageSize, keyword }
  })
}

/**
 * 发送邀请成员
 * @param params 邀请信息
 */
export const inviteMember = (params: InviteMemberParams) => {
  return http.request<Result<InviteMemberResponse>>('post', '/api/organizations/invitations', {
    data: params
  })
}

/**
 * 查询成员列表
 * @param page 页码（从1开始）
 * @param pageSize 每页数量，默认20
 */
export const getMembers = (page: number = 1, pageSize: number = 20) => {
  return http.request<Result<PageInfo<Member>>>('get', '/api/organizations/members', {
    params: { page, pageSize }
  })
}

/**
 * 更新成员信息
 * @param userId 成员用户ID
 * @param params 更新信息
 */
export const updateMember = (userId: number, params: UpdateMemberParams) => {
  return http.request<Result<InviteMemberResponse>>('patch', `/api/organizations/members/${userId}`, {
    data: params
  })
}

/**
 * 删除成员
 * @param userId 成员用户ID
 */
export const deleteMember = (userId: number) => {
  return http.request<Result<string>>('delete', `/api/organizations/members/${userId}`)
}
