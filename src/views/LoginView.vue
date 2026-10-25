<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { Eye, EyeOff, KeyRound, RefreshCw } from 'lucide-vue-next'
import AuthLayout from '../components/AuthLayout.vue'
import { APIError, apiRequest } from '../api/client'
import { useAuthStore } from '../stores/auth'

interface CaptchaResponse {
  id: string
  image: string
  expiresAt: string
}

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const showPassword = ref(false)
const submitError = ref('')
const captchaVisible = ref(false)
const captchaLoading = ref(false)
const captcha = ref<CaptchaResponse | null>(null)

const { handleSubmit, errors, defineField, setErrors } = useForm({
  validationSchema: toTypedSchema(
    z.object({
      identifier: z.string().trim().min(1, '请输入用户名或邮箱。'),
      password: z.string().min(1, '请输入密码。'),
      captchaAnswer: z.string().optional(),
    }),
  ),
  initialValues: {
    identifier: '',
    password: '',
    captchaAnswer: '',
  },
})

const [identifier, identifierAttrs] = defineField('identifier')
const [password, passwordAttrs] = defineField('password')
const [captchaAnswer, captchaAnswerAttrs] = defineField('captchaAnswer')

async function loadCaptcha() {
  captchaLoading.value = true
  try {
    captcha.value = await apiRequest<CaptchaResponse>('/api/auth/captcha')
    captchaVisible.value = true
    captchaAnswer.value = ''
  } catch {
    submitError.value = '验证码暂时无法加载，请稍后重试。'
  } finally {
    captchaLoading.value = false
  }
}

const submit = handleSubmit(async (values) => {
  submitError.value = ''
  if (captchaVisible.value && !values.captchaAnswer) {
    setErrors({ captchaAnswer: '请输入图形验证码。' })
    return
  }
  try {
    await auth.login(
      values.identifier,
      values.password,
      captchaVisible.value ? captcha.value?.id : '',
      values.captchaAnswer,
    )
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/studio'
    await router.replace(redirect)
  } catch (error) {
    if (error instanceof APIError) {
      submitError.value = error.message
      if (error.fields) {
        setErrors(error.fields)
      }
      if (error.requiresCaptcha || error.code === 'captcha_required') {
        captchaVisible.value = true
        await loadCaptcha()
      }
      return
    }
    submitError.value = '登录暂时失败，请稍后重试。'
  }
})

onMounted(() => {
  if (new URLSearchParams(window.location.search).has('captcha')) {
    void loadCaptcha()
  }
})
</script>

<template>
  <AuthLayout
    kicker="欢迎回来"
    title="回到你的光桌"
    description="登录后继续创作、查看最近的接触印样，或兑换新的积分。"
  >
    <form class="form-stack" novalidate @submit="submit">
      <label class="field">
        <span>用户名或邮箱</span>
        <input
          v-model="identifier"
          v-bind="identifierAttrs"
          type="text"
          autocomplete="username"
          placeholder="输入用户名或邮箱"
          :aria-invalid="Boolean(errors.identifier)"
        />
        <small v-if="errors.identifier" class="field-error">{{ errors.identifier }}</small>
      </label>

      <label class="field">
        <span>密码</span>
        <span class="password-input">
          <input
            v-model="password"
            v-bind="passwordAttrs"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            placeholder="输入密码"
            :aria-invalid="Boolean(errors.password)"
          />
          <button
            type="button"
            class="input-icon-button"
            :aria-label="showPassword ? '隐藏密码' : '显示密码'"
            :title="showPassword ? '隐藏密码' : '显示密码'"
            @click="showPassword = !showPassword"
          >
            <EyeOff v-if="showPassword" :size="18" aria-hidden="true" />
            <Eye v-else :size="18" aria-hidden="true" />
          </button>
        </span>
        <small v-if="errors.password" class="field-error">{{ errors.password }}</small>
      </label>

      <div v-if="captchaVisible" class="field">
        <span>图形验证码</span>
        <div class="captcha-row">
          <input
            v-model="captchaAnswer"
            v-bind="captchaAnswerAttrs"
            type="text"
            inputmode="text"
            maxlength="4"
            autocomplete="off"
            placeholder="输入图中字符"
            :aria-invalid="Boolean(errors.captchaAnswer)"
          />
          <button
            v-if="captcha"
            type="button"
            class="captcha-image"
            aria-label="刷新图形验证码"
            title="点击刷新验证码"
            @click="loadCaptcha"
          >
            <img :src="captcha.image" alt="四位字母数字验证码" />
          </button>
          <button
            v-else
            type="button"
            class="captcha-placeholder"
            :disabled="captchaLoading"
            @click="loadCaptcha"
          >
            <RefreshCw :size="17" aria-hidden="true" />
            加载验证码
          </button>
        </div>
        <small v-if="errors.captchaAnswer" class="field-error">{{ errors.captchaAnswer }}</small>
      </div>

      <div v-if="submitError" class="inline-alert inline-alert--error" role="alert">
        {{ submitError }}
      </div>

      <button class="button button--primary button--wide" type="submit" :disabled="auth.loading">
        <KeyRound :size="17" aria-hidden="true" />
        <span>{{ auth.loading ? '正在登录' : '登录' }}</span>
      </button>
    </form>

    <p class="auth-switch">
      还没有账户？
      <RouterLink to="/register">创建账户</RouterLink>
    </p>
    <p class="auth-switch">
      收到管理员重置口令？
      <RouterLink to="/reset-password">重置密码</RouterLink>
    </p>
  </AuthLayout>
</template>

<style scoped>
.captcha-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 168px;
  gap: 8px;
}

.captcha-row input {
  width: 100%;
}

.captcha-image,
.captcha-placeholder {
  height: 48px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #f1f3ee;
  cursor: pointer;
}

.captcha-image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.captcha-placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #2447d8;
  font-size: 12px;
}

@media (max-width: 520px) {
  .captcha-row {
    grid-template-columns: 1fr;
  }

  .captcha-image,
  .captcha-placeholder {
    width: 168px;
  }
}
</style>
