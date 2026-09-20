import { defineStore } from 'pinia'
import { ref } from 'vue'
import pinia from '@/store'
import { setToken, removeToken, getToken, userKey } from '@/utils/auth'
import { storageLocal } from '@pureadmin/utils'
import type { DataInfo } from '@/utils/auth'

export const useUserStore = defineStore('pure-user', () => {
  // State
  const username = ref<string>('')
  const roles = ref<Array<string>>([])
  const avatar = ref<string>('')
  const nickname = ref<string>('')
  const email = ref<string>('')
  const permissions = ref<Array<string>>([])
  const isRemembered = ref<boolean>(false)
  const loginDay = ref<number>(0)
  const currentPage = ref<number>(0) // 登录页面状态: 0=登录, 1=手机登录, 2=二维码, 3=注册, 4=忘记密码
  const verifyCode = ref<string>('') // 图形验证码
  const organizationId = ref<number | null>(null) // 当前组织ID

  // Actions
  function SET_USERNAME(value: string) {
    username.value = value
  }

  function SET_ROLES(value: Array<string>) {
    roles.value = value
  }

  function SET_AVATAR(value: string) {
    avatar.value = value
  }

  function SET_NICKNAME(value: string) {
    nickname.value = value
  }

  function SET_EMAIL(value: string) {
    email.value = value
  }

  function SET_PERMS(value: Array<string>) {
    permissions.value = value
  }

  function logOut() {
    return new Promise<void>((resolve) => {
      username.value = ''
      roles.value = []
      avatar.value = ''
      nickname.value = ''
      email.value = ''
      permissions.value = []
      organizationId.value = null
      removeToken()
      resolve()
    })
  }

  function handRefreshToken(data: any) {
    // Handle refresh token logic
    return Promise.resolve(data)
  }

  function SET_CURRENTPAGE(value: number) {
    currentPage.value = value
  }

  function SET_VERIFYCODE(value: string) {
    verifyCode.value = value
  }

  function SET_ORGANIZATIONID(value: number | null) {
    organizationId.value = value
  }

  // 从 localStorage 初始化用户信息
  function initUserInfo() {
    const userInfo = storageLocal().getItem<DataInfo<number>>(userKey);
    if (userInfo) {
      username.value = userInfo.username || '';
      nickname.value = userInfo.nickname || '';
      email.value = userInfo.email || '';
      avatar.value = userInfo.avatar || '';
      roles.value = userInfo.roles || [];
      permissions.value = userInfo.permissions || [];
    }
  }

  // 登录接口
  function loginByUsername(data: { username: string; password: string }) {
    return new Promise<{ success: boolean; data?: any }>((resolve) => {
      setTimeout(() => {
        // 验证账号密码
        if (data.username === 'admin' && data.password === '123456') {
          // 登录成功
          const tokenData: DataInfo<Date> = {
            accessToken: 'mock-admin-token-' + Date.now(),
            refreshToken: 'mock-refresh-token-' + Date.now(),
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后过期
            username: 'admin',
            nickname: '管理员',
            avatar: '',
            roles: ['admin'],
            permissions: ['*:*:*']
          }

          // 设置 token 和用户信息
          setToken(tokenData)

          // 更新 store
          SET_USERNAME('admin')
          SET_NICKNAME('管理员')
          SET_ROLES(['admin'])
          SET_PERMS(['*:*:*'])

          resolve({ success: true, data: tokenData })
        } else {
          // 登录失败
          resolve({ success: false })
        }
      }, 800)
    })
  }

  return {
    username,
    roles,
    avatar,
    nickname,
    email,
    permissions,
    isRemembered,
    loginDay,
    currentPage,
    verifyCode,
    organizationId,
    SET_USERNAME,
    SET_ROLES,
    SET_AVATAR,
    SET_NICKNAME,
    SET_EMAIL,
    SET_PERMS,
    SET_CURRENTPAGE,
    SET_VERIFYCODE,
    SET_ORGANIZATIONID,
    initUserInfo,
    logOut,
    handRefreshToken,
    loginByUsername,
  }
})

export function useUserStoreHook() {
  return useUserStore(pinia)
}
