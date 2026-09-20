<template>
  <div class="login-wrapper">
    <!-- 主题切换和国际化 -->
    <div class="header-tools">
      <!-- 主题切换 -->
      <el-switch
        :model-value="darkMode"
        inline-prompt
        active-text="🌙"
        inactive-text="☀️"
        @change="handleThemeChange"
      />
    </div>

    <!-- 左侧背景图 -->
    <div class="login-bg">
      <img :src="bg" :alt="t('login.purePageTitle')" />
    </div>

    <!-- 右侧登录/注册/忘记密码区域 -->
    <div class="login-container">
      <div class="login-box">
        <!-- 标题 - 始终显示 -->
        <img class="login-logo" :src="brandLogoUrl" alt="中建八局" />
        <h1 class="login-title">{{ t('login.purePageTitle') }}</h1>

        <!-- 登录表单 -->
        <div v-show="currentPage === 0" class="form-container">
          <el-form
            ref="loginFormRef"
            :model="loginForm"
            :rules="loginRules"
            class="login-form"
          >
            <!-- 邮箱输入框 -->
            <el-form-item prop="email">
              <el-input
                v-model="loginForm.email"
                clearable
                placeholder="请输入邮箱"
                :prefix-icon="useRenderIcon(User)"
              />
            </el-form-item>

            <!-- 密码输入框 -->
            <el-form-item prop="password">
              <el-input
                v-model="loginForm.password"
                type="password"
                show-password
                clearable
                :placeholder="t('login.purePassWordReg')"
                :prefix-icon="useRenderIcon(Lock)"
                @keyup.enter="onLogin(loginFormRef)"
              />
            </el-form-item>

            <!-- 记住密码 -->
            <el-form-item>
              <el-checkbox v-model="checked">
                {{ t('login.pureRememberPassword') }}
              </el-checkbox>
            </el-form-item>

            <!-- 登录按钮 -->
            <el-form-item>
              <el-button
                type="primary"
                class="login-btn"
                :loading="loading"
                :disabled="disabled"
                @click="onLogin(loginFormRef)"
              >
                {{ t('login.pureLogin') }}
              </el-button>
            </el-form-item>

            <!-- 底部链接 -->
            <el-form-item class="login-footer">
              <div class="footer-links">
                <a href="javascript:void(0)" class="link" @click="switchToRegister">
                  {{ t('login.pureRegisterAccount') }}
                </a>
                <!-- <a href="javascript:void(0)" class="link" @click="switchToForgetPassword">
                  {{ t('login.pureForgetPassword') }}
                </a> -->
              </div>
            </el-form-item>
          </el-form>
        </div>

        <!-- 注册表单 -->
        <div v-show="currentPage === 1" class="form-container">
          <LoginRegist @back="switchToLogin" />
        </div>

        <!-- 忘记密码表单 -->
        <div v-show="currentPage === 2" class="form-container">
          <LoginUpdate @back="switchToLogin" />
        </div>
      </div>
    </div>

    <!-- 创建组织弹窗 -->
    <el-dialog
      v-model="orgDialogVisible"
      title="创建您的组织"
      width="450px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      class="org-dialog"
    >
      <div class="org-dialog-tips">
        <p>检测到您是新用户还没有加入任何组织，请先创建一个组织以继续使用系统。</p>
      </div>
      <el-form
        ref="orgFormRef"
        :model="orgFormData"
        :rules="orgFormRules"
        label-position="top"
        size="large"
      >
        <el-form-item label="组织名称" prop="name">
          <el-input
            v-model="orgFormData.name"
            placeholder="请输入组织名称，如：XX公司"
            clearable
          />
        </el-form-item>

        <el-form-item label="联系邮箱" prop="email">
          <el-input
            v-model="orgFormData.email"
            placeholder="请输入联系邮箱"
            clearable
          />
        </el-form-item>

        <el-form-item label="联系人" prop="contactPerson">
          <el-input
            v-model="orgFormData.contactPerson"
            placeholder="请输入联系人姓名（选填）"
            clearable
          />
        </el-form-item>

        <el-form-item label="联系电话" prop="contactPhone">
          <el-input
            v-model="orgFormData.contactPhone"
            placeholder="请输入联系电话（选填）"
            clearable
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button
          type="primary"
          :loading="orgSubmitting"
          @click="handleCreateOrganization"
          style="width: 100%"
        >
          创建组织
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { i18n } from '@/plugins/i18n'
import { message } from '@/utils/message'
import { storageLocal } from '@pureadmin/utils'
import { responsiveStorageNameSpace } from '@/config'
import type { FormInstance, FormRules } from 'element-plus'
import { useUserStoreHook } from '@/store/modules/user'
import { useBrandStoreHook } from '@/store/modules/brand'
import { initRouter } from '@/router/utils'
import { bg } from './utils/static'
import { useRenderIcon } from '@/components/ReIcon/src/hooks'
import Lock from '~icons/ri/lock-fill'
import User from '~icons/ri/user-3-fill'
import LoginRegist from './components/LoginRegist.vue'
import LoginUpdate from './components/LoginUpdate.vue'
import { postContextWithApi } from '@/api/context'
import { setToken, initOrganizationId, setOrganizationId } from '@/utils/auth'
import type { DataInfo } from '@/utils/auth'
import { createOrganization, type CreateOrganizationParams } from '@/api/organization'
import { ElMessage } from 'element-plus'

defineOptions({
  name: 'Login',
})

const router = useRouter()
const t = (key: string) => (i18n.global.t as any)(key)
const nameSpace = responsiveStorageNameSpace()
const userStore = useUserStoreHook()
const brandStore = useBrandStoreHook()
const brandLogoUrl = computed(() => brandStore.logoUrl)

// 表单状态
const loading = ref(false)
const checked = ref(false)
const disabled = ref(false)
const loginFormRef = ref<FormInstance>()

// 当前页面: 0=登录, 1=注册, 2=忘记密码
const currentPage = ref(0)

// 创建组织弹窗
const orgDialogVisible = ref(false)
const orgFormRef = ref<FormInstance>()
const orgSubmitting = ref(false)
const orgFormData = reactive<CreateOrganizationParams>({
  name: '',
  contactPerson: '',
  contactPhone: '',
  email: '',
})

// 创建组织表单验证规则
const orgFormRules = computed<FormRules>(() => ({
  name: [
    { required: true, message: '请输入组织名称', trigger: 'blur' },
    { min: 2, max: 50, message: '组织名称长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: ['blur', 'change'] }
  ]
}))

const loginForm = reactive({
  email: '',
  password: '',
})

// 表单验证规则
const loginRules = computed<FormRules>(() => ({
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: ['blur', 'change'] }
  ],
  password: [
    { required: true, message: t('login.purePassWordReg'), trigger: 'blur' }
  ]
}))
// 应用主题
const applyTheme = (dark: boolean) => {
  if (dark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}
const darkMode = ref(
  (storageLocal().getItem(`${nameSpace}layout`) as any)?.darkMode ?? false
)


watch(darkMode, (val) => {
  const key = `${nameSpace}layout`
  const layoutData = (storageLocal().getItem(key) as any) || {}
  layoutData.darkMode = val
  layoutData.theme = val ? 'dark' : 'light'
  storageLocal().setItem(key, layoutData)
  applyTheme(val)
})





// 切换主题
const handleThemeChange = (value: boolean) => {
  darkMode.value = value
}

// 切换到注册页面
const switchToRegister = () => {
  currentPage.value = 1
  userStore.SET_CURRENTPAGE(1)
}

// 切换到忘记密码页面
const switchToForgetPassword = () => {
  currentPage.value = 2
  userStore.SET_CURRENTPAGE(2)
}

// 切换到登录页面
const switchToLogin = () => {
  currentPage.value = 0
  userStore.SET_CURRENTPAGE(0)
}

// 监听 store 中的 currentPage
watch(() => userStore.currentPage, (newVal) => {
  currentPage.value = newVal
})

// 完成登录并跳转到主页
const completeLoginAndRedirect = async () => {
  try {
    await brandStore.fetchBrand()
    // 获取后端路由并跳转到主页
    await initRouter()
    disabled.value = true

    router
      .push('/')
      .then(() => {
        console.log('跳转到主页成功')
      })
      .catch((err) => {
        console.error('跳转失败:', err)
      })
      .finally(() => (disabled.value = false))
  } catch (error) {
    disabled.value = false
  }
}

// 创建组织
const handleCreateOrganization = async () => {
  if (!orgFormRef.value) return

  try {
    await orgFormRef.value.validate()
    orgSubmitting.value = true

    const response = await createOrganization(orgFormData)

    if ((response.code === 201 || response.code === 200 || response.code === 0) && response.data?.id) {
      ElMessage.success('组织创建成功')

      // 设置组织ID
      setOrganizationId(response.data.id)

      // 关闭弹窗
      orgDialogVisible.value = false

      // 继续初始化路由并跳转
      await completeLoginAndRedirect()
    } else {
      ElMessage.error(response.msg || '创建组织失败')
    }
  } catch (error: any) {
    console.error('创建组织失败:', error)
    ElMessage.error(error.response?.data?.msg || '创建组织失败')
  } finally {
    orgSubmitting.value = false
  }
}

// 重置组织表单
const resetOrgForm = () => {
  orgFormData.name = ''
  orgFormData.contactPerson = ''
  orgFormData.contactPhone = ''
  orgFormData.email = ''
  if (orgFormRef.value) {
    orgFormRef.value.resetFields()
  }
}

// 登录
const onLogin = async (formEl: FormInstance | undefined) => {
  if (!formEl) {
    console.log('formEl 为空，返回')
    return
  }
  await formEl.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {

        // 调用真实的登录 API
        const result = await postContextWithApi({
          email: loginForm.email,
          password: loginForm.password
        })


        // 登录成功，保存 token
        if (result.data?.token) {
          // 构造完整的用户信息，使用 setToken 保存
          const tokenData: DataInfo<Date> = {
            accessToken: result.data.token,
            refreshToken: result.data.token, // 如果后端没有返回 refreshToken，暂时使用 token
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 默认7天后过期
            username: loginForm.email,
            nickname: loginForm.email.split('@')[0], // 使用邮箱前缀作为昵称
            avatar: '',
            roles: ['user'], // 默认角色
            permissions: ['*:*:*'] // 默认权限
          }

          // 使用 setToken 保存用户信息和 token
          setToken(tokenData)

          // 处理记住密码
          if (checked.value) {
            storageLocal().setItem('login-info', {
              email: loginForm.email,
              password: loginForm.password
            })
          } else {
            storageLocal().removeItem('login-info')
          }

          message(t('login.pureLoginSuccess'), { type: 'success' })

          // 初始化组织ID
          const orgId = await initOrganizationId()

          // 检查用户是否有组织
          if (!orgId) {
            // 用户没有组织，显示创建组织弹窗
            orgDialogVisible.value = true
            return
          }

          // 有组织，继续初始化路由并跳转
          await completeLoginAndRedirect()
        } else {
          message(result.msg || t('login.pureLoginFail'), { type: 'error' })
        }
      } catch (error: any) {
        console.error('登录接口调用失败:', error)
        const errorMsg = error.response?.data?.msg || error.message || '登录失败：网络错误或服务器异常'
        message(errorMsg, { type: 'error' })
      } finally {
        loading.value = false
      }
    }
  })
}

// 初始化主题
onMounted(() => {
  // 应用当前主题
  applyTheme(darkMode.value)

  // 读取记住的登录信息
  const savedLoginInfo = storageLocal().getItem<{email: string; password: string}>('login-info')
  if (savedLoginInfo) {
    loginForm.email = savedLoginInfo.email
    loginForm.password = savedLoginInfo.password
    checked.value = true
  }
})
</script>

<style scoped>
@import url('@/style/login.css');

.form-container {
  width: 100%;
}

/* 创建组织弹窗样式 */
:deep(.org-dialog) {
  border-radius: 16px;
  overflow: hidden;

  .el-dialog__header {
    padding: 24px 24px 16px;
    margin-right: 0;

    .el-dialog__title {
      font-size: 20px;
      font-weight: 600;
      color: #1a1a1a;
    }
  }

  .el-dialog__body {
    padding: 0 24px 16px;
  }

  .el-dialog__footer {
    padding: 16px 24px 24px;
  }
}

.org-dialog-tips {
  margin-bottom: 20px;
  padding: 12px 16px;
  background-color: #f0f9ff;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;

  p {
    margin: 0;
    font-size: 14px;
    color: #1e40af;
    line-height: 1.5;
  }
}

/* 暗黑模式适配 */
html.dark {
  :deep(.org-dialog) {
    background-color: #2a2a2a;
    border: 1px solid #3a3a3a;

    .el-dialog__header {
      .el-dialog__title {
        color: #ffffff;
      }
    }

    .el-form-item__label {
      color: #ffffff;
    }

    .el-input__wrapper {
      background-color: #1a1a1a;
      border-color: #3a3a3a;

      .el-input__inner {
        color: #ffffff;
      }
    }
  }

  .org-dialog-tips {
    background-color: #1e3a5f;
    border-left-color: #60a5fa;

    p {
      color: #bfdbfe;
    }
  }
}
</style>
