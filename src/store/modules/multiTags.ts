import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import pinia from '@/store'
import { type RouteConfigs, routerArrays } from '@/layout/types'
import { storageLocal } from '@pureadmin/utils'
import { responsiveStorageNameSpace } from '@/config'

const TAGS_KEY = 'multiTags'

export const useMultiTagsStore = defineStore('pure-multiTags', () => {
  const nameSpace = responsiveStorageNameSpace()

  // 从 localStorage 加载缓存的标签页
  const loadTagsFromStorage = (): RouteConfigs[] => {
    const cached = storageLocal().getItem<RouteConfigs[]>(`${nameSpace}${TAGS_KEY}`)
    return cached && cached.length > 0 ? cached : [...routerArrays]
  }

  // State
  const multiTags = ref<RouteConfigs[]>(loadTagsFromStorage())
  const multiTagsCache = ref<boolean>(false)

  // Getters
  const getMultiTagsCache = computed(() => multiTagsCache.value)

  // 保存标签页到 localStorage
  const saveTagsToStorage = () => {
    storageLocal().setItem(`${nameSpace}${TAGS_KEY}`, multiTags.value)
  }

  // Actions
  function handleTags(
    mode: string,
    value?: RouteConfigs | RouteConfigs[],
    position?: RouteConfigs,
  ): void {
    switch (mode) {
      case 'push':
        {
          const tagVal = value as RouteConfigs
          // 不添加到标签页
          if (tagVal?.meta?.hiddenTag) return
          // 如果已存在不重复添加
          const tagHasExits = multiTags.value.some(
            (tag) => tag.path === tagVal.path,
          )
          if (!tagHasExits) {
            multiTags.value.push(tagVal)
            saveTagsToStorage()
          }
        }
        break
      case 'equal':
        // 等于操作，直接设置标签页
        if (Array.isArray(value)) {
          multiTags.value = value
          saveTagsToStorage()
        }
        break
      case 'splice':
        if (!position) return
        multiTags.value.forEach((v, i) => {
          if (v.path === position.path) {
            multiTags.value.splice(i, 1)
          }
        })
        saveTagsToStorage()
        break
      case 'slice':
        multiTags.value = [...routerArrays]
        saveTagsToStorage()
        break
    }
  }

  // 关闭左侧标签
  function closeLeftTags(currentPath: string): void {
    const currentIndex = multiTags.value.findIndex((tag) => tag.path === currentPath)
    if (currentIndex > 0) {
      // 保留固定标签和当前标签左侧的标签
      multiTags.value = [
        ...multiTags.value.slice(0, 1), // 保留首页
        ...multiTags.value.slice(currentIndex),
      ]
      saveTagsToStorage()
    }
  }

  // 关闭右侧标签
  function closeRightTags(currentPath: string): void {
    const currentIndex = multiTags.value.findIndex((tag) => tag.path === currentPath)
    if (currentIndex !== -1 && currentIndex < multiTags.value.length - 1) {
      multiTags.value = multiTags.value.slice(0, currentIndex + 1)
      saveTagsToStorage()
    }
  }

  // 关闭其他标签
  function closeOtherTags(currentPath: string): void {
    const currentTag = multiTags.value.find((tag) => tag.path === currentPath)
    if (currentTag) {
      // 只保留首页和当前标签
      multiTags.value = [
        multiTags.value[0], // 首页
        ...(currentTag.path === multiTags.value[0].path ? [] : [currentTag]),
      ]
      saveTagsToStorage()
    }
  }

  // 关闭所有标签
  function closeAllTags(): void {
    multiTags.value = [...routerArrays]
    saveTagsToStorage()
  }

  function multiTagsCacheChange(value: boolean): void {
    multiTagsCache.value = value
  }

  return {
    multiTags,
    multiTagsCache,
    getMultiTagsCache,
    handleTags,
    closeLeftTags,
    closeRightTags,
    closeOtherTags,
    closeAllTags,
    multiTagsCacheChange,
  }
})

export function useMultiTagsStoreHook() {
  return useMultiTagsStore(pinia)
}
