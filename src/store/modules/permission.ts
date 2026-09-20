import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import pinia from '@/store'
import { ascending, fetchUserMenuRoutes } from '@/router/utils'
import { cloneDeep } from '@pureadmin/utils'
import { constantMenus, router } from '@/router'

export interface cacheType {
  mode: string
  name?: string
}

export const usePermissionStore = defineStore('pure-permission', () => {
  // State
  const wholeMenus = ref<RouteRecordRaw[]>([])
  const menusTree = ref<RouteRecordRaw[]>([])
  const cachePageList = ref<string[]>([])
  const flatteningRoutes = ref<RouteRecordRaw[]>([])

  // Helper function
  function flattenRoutes(routes: RouteRecordRaw[]): RouteRecordRaw[] {
    const result: RouteRecordRaw[] = []
    routes.forEach((route) => {
      result.push(route)
      if (route.children && route.children.length > 0) {
        result.push(...flattenRoutes(route.children))
      }
    })
    return result
  }

  // Actions
  function getWholeMenus() {
    return wholeMenus.value
  }

  function setWholeMenus(routes: RouteRecordRaw[]) {
    wholeMenus.value = routes
    menusTree.value = cloneDeep(routes)
    flatteningRoutes.value = flattenRoutes(routes)
  }

  function clearAllCachePage() {
    cachePageList.value = []
  }

  function cacheOperate({ mode, name }: cacheType) {
    const delIndex = cachePageList.value.findIndex((v) => v === name)
    switch (mode) {
      case 'refresh':
        cachePageList.value = cachePageList.value.filter((v) => v !== name)
        break
      case 'add':
        if (name) cachePageList.value.push(name)
        break
      case 'delete':
        delIndex !== -1 && cachePageList.value.splice(delIndex, 1)
        break
    }
  }

  function clearPermission() {
    wholeMenus.value = []
    menusTree.value = []
    flatteningRoutes.value = []
    clearAllCachePage()
  }

  function initMenus(routes: RouteRecordRaw[]) {
    // 先合并动态路由和静态路由，再一起排序
    const allRoutes = ascending(cloneDeep(routes).concat(constantMenus))
    wholeMenus.value = allRoutes
    menusTree.value = cloneDeep(allRoutes)
  }

  function handleWholeMenus(routes: RouteRecordRaw[]) {
    // 先合并动态路由和静态路由，再一起排序
    const allRoutes = ascending(cloneDeep(routes).concat(constantMenus))
    wholeMenus.value = allRoutes
    menusTree.value = cloneDeep(allRoutes)
    flatteningRoutes.value = flattenRoutes(allRoutes)
  }

  /**
   * 从后端刷新菜单
   * 用于组织切换后重新获取菜单权限
   */
  async function refreshMenusFromBackend() {
    try {
      const dynamicRoutes = await fetchUserMenuRoutes()
      console.log(dynamicRoutes,'dynamicRoutes111');

      if (dynamicRoutes && dynamicRoutes.length > 0) {
        handleWholeMenus(dynamicRoutes)

        // 检查当前路由是否在新菜单中，不在则跳转首页
        const currentPath = router.currentRoute.value.path
        const allPaths = getAllMenuPaths(dynamicRoutes)
        if (!allPaths.includes(currentPath) && currentPath !== '/') {
          router.push('/')
        }

        return dynamicRoutes
      }
      return []
    } catch (error) {
      console.error('[Permission] 刷新菜单失败:', error)
      return []
    }
  }

  /**
   * 递归获取所有菜单路径
   */
  function getAllMenuPaths(menus: any[]): string[] {
    const paths: string[] = []
    menus.forEach(menu => {
      if (menu.path) paths.push(menu.path)
      if (menu.children && menu.children.length > 0) {
        paths.push(...getAllMenuPaths(menu.children))
      }
    })
    return paths
  }

  return {
    wholeMenus,
    menusTree,
    cachePageList,
    flatteningRoutes,
    getWholeMenus,
    setWholeMenus,
    clearAllCachePage,
    cacheOperate,
    clearPermission,
    initMenus,
    handleWholeMenus,
    refreshMenusFromBackend
  }
})

export function usePermissionStoreHook() {
  return usePermissionStore(pinia)
}
