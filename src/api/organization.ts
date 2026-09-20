import { http } from '@/utils/http'

/** 通用响应结果类型 */
export interface Result<T = any> {
  code: number
  data: T
  msg: string
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
  memberCount?: number
  parentOrganizationId?: number
}

/** 分页信息类型 */
export interface PageInfo<T> {
  list: T[]
  page: number
  pageSize: number
  total: number
}

/** 查询组织响应数据类型 */
export interface OrganizationsResponse {
  current: Organization
  children: PageInfo<Organization>
}

export interface CreateOrganizationParams {
  name: string
  address?: string
  contactPerson?: string
  contactPhone?: string
  description?: string
  email?: string
  parentOrganizationId?: number
}

/** 更新组织参数类型 */
export interface UpdateOrganizationParams {
  name?: string
  address?: string
  contactPerson?: string
  contactPhone?: string
  description?: string
  email?: string
  parentOrganizationId?: number
}

/** 分配成员参数类型 */
export interface AssignMemberParams {
  userId: number
  roleId: number
  targetOrganizationId: number
}

/** 邀请成员参数类型 */
export interface InviteMemberParams {
  displayName: string
  email: string
  phone: string
  roleId: number
}

/** 成员信息类型 */
export interface Member {
  id: number
  displayName: string
  phone: string
  status: string
  organization: Organization
}

/** 我的组织成员信息类型 */
export interface MyOrganizationMember {
  id: number
  displayName: string
  phone: string
  status: string
  organization: Organization
}

/** 我的组织列表响应类型 */
export interface MyOrganizationsResponse {
  list: MyOrganizationMember[]
  page: number
  pageSize: number
  total: number
}

/**
 * 获取我的组织列表
 * 用于判断当前用户是否有组织，以决定是创建总公司还是分公司
 */
export const getMyOrganizations = () => {
  return http.request<Result<MyOrganizationsResponse>>('get', '/api/me/organizations')
}

/**
 * 查询当前组织及子组织
 * @param page 页码（从1开始）
 * @param pageSize 每页数量，默认20
 */
export const getOrganizations = (page: number = 1, pageSize: number = 20) => {
  return http.request<Result<OrganizationsResponse>>('get', '/api/organizations', {
    params: { page, pageSize }
  })
}

/**
 * 创建组织
 * @param params 组织信息
 */
export const createOrganization = (params: CreateOrganizationParams) => {
  return http.request<Result<Organization>>('post', '/api/organizations', {
    data: params
  })
}

/**
 * 修改组织
 * @param id 组织ID
 * @param params 组织信息
 */
export const updateOrganization = (id: number, params: UpdateOrganizationParams) => {
  return http.request<Result<Organization>>('patch', `/api/organizations/${id}`, {
    data: params
  })
}

export const uploadOrganizationLogo = (id: number, file: File) => {
  const formData = new FormData()
  formData.append('logo', file)

  return http.request<Result<Organization>>('patch', `/api/organizations/${id}/logo`, {
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

export const resetOrganizationLogo = (id: number) => {
  return http.request<Result<Organization>>('delete', `/api/organizations/${id}/logo`)
}

/**
 * 删除组织
 * @param id 组织ID
 */
export const deleteOrganization = (id: number) => {
  return http.request<Result<string>>('delete', `/api/organizations/${id}`)
}

/**
 * 分配根组织成员到子组织
 * @param params 分配信息
 */
export const assignMember = (params: AssignMemberParams) => {
  return http.request<Result<Member>>('post', '/api/organizations/assignments', {
    data: params
  })
}

/**
 * 邀请成员加入根组织
 * @param params 邀请信息
 */
export const inviteMember = (params: InviteMemberParams) => {
  return http.request<Result<Member>>('post', '/api/organizations/invitations', {
    data: params
  })
}
