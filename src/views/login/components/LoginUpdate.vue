<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { i18n } from '@/plugins/i18n'
import Motion from '../utils/motion'
import { message } from '@/utils/message'
import { updateRules } from '../utils/rule'
import type { FormInstance } from 'element-plus'
import { useVerifyCode } from '../utils/verifyCode'
import { useUserStoreHook } from '@/store/modules/user'
import { useRenderIcon } from '@/components/ReIcon/src/hooks'
import Lock from '~icons/ri/lock-fill'
import Iphone from '~icons/ep/iphone'
import Keyhole from '~icons/ri/shield-keyhole-line'
import Email from '~icons/ri/mail-line'

const t = (key: string) => (i18n.global.t as any)(key)
const loading = ref(false)
const ruleForm = reactive({
  phone: '',
  verifyCode: '',
  password: '',
  repeatPassword: '',
})
const ruleFormRef = ref<FormInstance>()
const { isDisabled, text } = useVerifyCode()
const repeatPasswordRule = computed(() => [
  {
    validator: (rule, value, callback) => {
      if (value === '') {
        callback(new Error(t('login.purePassWordSureReg')))
      } else if (ruleForm.password !== value) {
        callback(new Error(t('login.purePassWordDifferentReg')))
      } else {
        callback()
      }
    },
    trigger: 'blur',
  },
])

const emit = defineEmits<{
  back: []
}>()

const onUpdate = async (formEl: FormInstance | undefined) => {
  loading.value = true
  if (!formEl) return
  await formEl.validate((valid) => {
    if (valid) {
      // 模拟请求，需根据实际开发进行修改
      setTimeout(() => {
        message(t('login.purePassWordUpdateReg'), { type: 'success' })
        loading.value = false
        // 重置密码成功后返回登录页
        useUserStoreHook().SET_CURRENTPAGE(0)
        emit('back')
      }, 2000)
    } else {
      loading.value = false
    }
  })
}

function onBack() {
  useVerifyCode().end()
  useUserStoreHook().SET_CURRENTPAGE(0)
  emit('back')
}
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="ruleForm"
    :rules="updateRules"
    class="login-form"
  >
    <Motion>
      <el-form-item prop="phone">
        <el-input
          v-model="ruleForm.phone"
          clearable
          :placeholder="t('login.emailAddress')"
          :prefix-icon="useRenderIcon(Email)"
        />
      </el-form-item>
    </Motion>

    <Motion :delay="100">
      <el-form-item prop="verifyCode">
        <div class="verify-code-container">
          <el-input
            v-model="ruleForm.verifyCode"
            clearable
            :placeholder="t('login.pureSmsVerifyCode')"
            :prefix-icon="useRenderIcon(Keyhole)"
            class="verify-code-input"
          />
          <el-button
            :disabled="isDisabled"
            class="verify-code-btn"
            @click="useVerifyCode().start(ruleFormRef, 'phone')"
          >
            {{
              text.length > 0
                ? text + t('login.pureInfo')
                : t('login.pureGetVerifyCode')
            }}
          </el-button>
        </div>
      </el-form-item>
    </Motion>

    <Motion :delay="150">
      <el-form-item prop="password">
        <el-input
          v-model="ruleForm.password"
          clearable
          show-password
          :placeholder="t('login.purePassword')"
          :prefix-icon="useRenderIcon(Lock)"
        />
      </el-form-item>
    </Motion>

    <Motion :delay="200">
      <el-form-item :rules="repeatPasswordRule" prop="repeatPassword">
        <el-input
          v-model="ruleForm.repeatPassword"
          clearable
          show-password
          :placeholder="t('login.pureSure')"
          :prefix-icon="useRenderIcon(Lock)"
        />
      </el-form-item>
    </Motion>

    <el-form>
      <div class="login-btn-group">
        <el-button
          class="login-btn"
          type="primary"
          :loading="loading"
          @click="onUpdate(ruleFormRef)"
        >
          {{ t('login.pureDefinite') }}
        </el-button>

        <el-button class="login-btn" @click="onBack">
          {{ t('login.pureBack') }}
        </el-button>
      </div>
    </el-form>
  </el-form>
</template>
<style scoped>
@import url('@/style/login.css');
</style>
