/**
 * 示例 Store 模块 (Setup 语法)
 *
 * 这是一个 Pinia store 的示例，使用现代化的 Setup 语法，展示如何：
 * 1. 定义 state（状态） - 使用 ref/reactive
 * 2. 定义 getters（计算属性） - 使用 computed
 * 3. 定义 actions（方法） - 使用普通函数
 * 4. 使用 TypeScript 类型
 *
 * Setup 语法的优势：
 * - 更好的 TypeScript 类型推导
 * - 更灵活的组合式 API
 * - 与 Vue 3 Composition API 风格一致
 *
 * 你可以参考这个文件创建更多的 store 模块
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import pinia from '@/store'

// 定义用户信息的类型
interface UserInfo {
  name: string
  email: string
}

export const useExampleStore = defineStore('example', () => {
  // ==================== State ====================
  // 使用 ref 定义基本类型的状态
  const count = ref<number>(0)
  const loading = ref<boolean>(false)

  // 使用 ref 定义对象类型的状态
  const userInfo = ref<UserInfo>({
    name: '',
    email: '',
  })

  // ==================== Getters ====================
  // 使用 computed 定义计算属性

  // 计算 count 的两倍
  const doubleCount = computed(() => count.value * 2)

  // 判断是否有用户信息
  const hasUserInfo = computed(() => !!userInfo.value.name)

  // 获取用户的显示名称
  const displayName = computed(() => {
    return userInfo.value.name || '未设置用户名'
  })

  // ==================== Actions ====================
  // 定义普通函数作为 actions

  /**
   * 增加计数
   */
  function increment() {
    count.value++
  }

  /**
   * 减少计数
   */
  function decrement() {
    count.value--
  }

  /**
   * 重置计数
   */
  function resetCount() {
    count.value = 0
  }

  /**
   * 设置用户信息
   * @param info 用户信息对象（可以是部分字段）
   */
  function setUserInfo(info: Partial<UserInfo>) {
    userInfo.value = {
      ...userInfo.value,
      ...info,
    }
  }

  /**
   * 清空用户信息
   */
  function clearUserInfo() {
    userInfo.value = {
      name: '',
      email: '',
    }
  }

  /**
   * 异步操作示例：模拟从 API 获取用户信息
   */
  async function fetchUserInfo() {
    loading.value = true
    try {
      // 模拟 API 请求
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // 设置用户信息
      userInfo.value = {
        name: '示例用户',
        email: 'example@example.com',
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
    } finally {
      loading.value = false
    }
  }

  // ==================== Return ====================
  // 返回需要暴露的 state、getters 和 actions
  return {
    // State
    count,
    loading,
    userInfo,

    // Getters
    doubleCount,
    hasUserInfo,
    displayName,

    // Actions
    increment,
    decrement,
    resetCount,
    setUserInfo,
    clearUserInfo,
    fetchUserInfo,
  }
})

/**
 * 在组件外部使用 Store 的 Hook
 * 例如在 router guard 或其他非组件文件中使用
 */
export function useExampleStoreHook() {
  return useExampleStore(pinia)
}

/**
 * 使用示例：
 *
 * 1. 在组件中使用：
 *    import { useExampleStore } from '@/store/modules/example'
 *    import { storeToRefs } from 'pinia'
 *
 *    const exampleStore = useExampleStore()
 *    const { count, userInfo } = storeToRefs(exampleStore)  // 转为响应式引用
 *
 *    exampleStore.increment()  // 调用方法
 *
 * 2. 在非组件中使用：
 *    import { useExampleStoreHook } from '@/store/modules/example'
 *
 *    const exampleStore = useExampleStoreHook()
 *    exampleStore.increment()
 */
