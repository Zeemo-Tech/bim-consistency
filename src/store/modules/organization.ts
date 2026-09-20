import { defineStore } from 'pinia'
import pinia from '@/store'
import { getMyOrganizations, getOrganizations, type MyOrganizationMember } from '@/api/organization'
import { getOrganizationId, setOrganizationId } from '@/utils/auth'

export const useOrganizationStore = defineStore('organization', {
  state: () => ({
    // 组织列表
    organizations: [] as MyOrganizationMember[],
    // 当前组织ID
    currentOrgId: null as number | null,
    // 加载状态
    loading: false,
    // 错误信息
    error: null as string | null,
    // 权限错误标识
    hasPermissionError: false,
    // 是否有管理当前组织的权限（基于 /api/organizations 接口）
    canManageOrganization: true
  }),

  getters: {
    // 当前组织信息
    currentOrganization(): MyOrganizationMember | null {
      if (!this.currentOrgId) return null
      return this.organizations.find(item => item.organization.id === this.currentOrgId) || null
    },

    // 所有总公司（parentOrganizationId 为 null 或 0）
    headquartersList(): MyOrganizationMember[] {
      return this.organizations.filter(item => {
        const parentId = item.organization.parentOrganizationId
        return !parentId || parentId === 0
      })
    },

    // 总公司（如果有多个总公司，默认返回第一个）
    headquarters(): MyOrganizationMember | null {
      return this.headquartersList[0] || null
    },

    // 分公司列表（parentOrganizationId 不为 null 且不为 0）
    branches(): MyOrganizationMember[] {
      return this.organizations.filter(item => {
        const parentId = item.organization.parentOrganizationId
        return parentId && parentId !== 0
      })
    },

    // 按总公司分组的分公司
    branchesByHeadquarters(): { [key: number]: MyOrganizationMember[] } {
      const grouped: { [key: number]: MyOrganizationMember[] } = {}

      this.branches.forEach(branch => {
        const parentId = branch.organization.parentOrganizationId
        if (parentId && parentId !== 0) {
          if (!grouped[parentId]) {
            grouped[parentId] = []
          }
          grouped[parentId].push(branch)
        }
      })

      return grouped
    }
  },

  actions: {
    // 获取组织列表
    async fetchOrganizations() {
      try {
        this.loading = true
        this.error = null
        this.hasPermissionError = false

        // 先获取用户加入的组织
        const data  = await getMyOrganizations()

        // 处理不同的响应格式
        if (data && data.code === 200 && data.data) {
          this.organizations = data.data.list || []
        } else if (data && data.code === 403) {
          // 权限不足错误
          this.error = data.msg || '权限不足'
          this.hasPermissionError = true
          this.organizations = []
        } else if (data && Array.isArray(data.data.list)) {
          this.organizations = data.data.list || []
        } else if (data && Array.isArray(data)) {
          this.organizations = data || []
        }

        // 获取或设置当前组织ID
        const orgId = getOrganizationId()
        if (orgId) {
          this.currentOrgId = orgId
        } else if (this.organizations.length > 0) {
          // 如果没有组织ID，默认使用总公司
          const defaultOrg = this.headquarters || this.organizations[0]
          this.currentOrgId = defaultOrg.organization.id
          setOrganizationId(defaultOrg.organization.id)
        }

        // 检查管理权限
        await this.checkManagePermission()
      } catch (error: any) {
        console.error('获取组织列表失败:', error)
        this.error = error?.response?.data?.msg || '获取组织列表失败'
        this.hasPermissionError = error?.response?.status === 403
        throw error
      } finally {
        this.loading = false
      }
    },

    // 切换组织
    async switchOrganization(orgId: number) {
      if (orgId === this.currentOrgId) return

      this.currentOrgId = orgId
      setOrganizationId(orgId)

      // 切换组织后重新检查管理权限
      await this.checkManagePermission()
    },

    // 检查是否有管理当前组织的权限
    async checkManagePermission() {
      try {
        // 调用 /api/organizations 接口检查权限
        const  data  = await getOrganizations(1, 1)

        // 如果返回 403，说明没有权限
        if (data && data.code === 403) {
          this.canManageOrganization = false
        } else {
          this.canManageOrganization = true
        }
      } catch (error: any) {
        console.error('检查管理权限失败:', error)
        // 如果返回 403 状态码，说明没有权限
        if (error?.response?.status === 403 || error?.response?.data?.code === 403) {
          this.canManageOrganization = false
        } else {
          // 其他错误情况，默认允许（避免误判）
          this.canManageOrganization = true
        }
      }
    },

    // 刷新组织列表（创建或编辑组织后调用）
    async refreshOrganizations() {
      await this.fetchOrganizations()
    },

    // 清空组织数据
    clearOrganizations() {
      this.organizations = []
      this.currentOrgId = null
      this.error = null
      this.hasPermissionError = false
      this.canManageOrganization = true
    }
  }
})

export function useOrganizationStoreHook() {
  return useOrganizationStore(pinia)
}
