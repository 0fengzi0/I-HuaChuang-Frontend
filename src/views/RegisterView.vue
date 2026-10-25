<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { Eye, EyeOff, RefreshCw, UserPlus } from 'lucide-vue-next'
import AuthLayout from '../components/AuthLayout.vue'
import { APIError, apiRequest } from '../api/client'
import { useAuthStore } from '../stores/auth'

interface CaptchaResponse {
  id: string
  image: string
  expiresAt: string
}

const auth = useAuthStore()
const router = useRouter()
const showPassword = ref(false)
const submitError = ref('')
const captcha = ref<CaptchaResponse | null>(null)
const captchaLoading = ref(false)

const schema = z
  .object({
    username: z
      .string()
      .trim()
      .regex(/^[\p{L}\p{N}_-]{3,24}$/u, '用户名需为 3 到 24 个字符，可使用文字、数字、下划线或短横线。'),
    email: z.string().trim().email('请输入有效的邮箱地址。'),
    password: z.string().min(8, '密码至少需要 8 个字符。').max(72, '密码不能超过 72 个字符。'),
    confirmPassword: z.string(),
    captchaAnswer: z.string().length(4, '请输入 4 位图形验证码。'),
    termsAccepted: z.boolean().refine(Boolean, '请先同意用户协议与隐私政策。'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: '两次输入的密码不一致。',
  })

const { handleSubmit, errors, defineField, setErrors } = useForm({
  validationSchema: toTypedSchema(schema),
  initialValues: {
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    captchaAnswer: '',
    termsAccepted: false,
  },
})

const [username, usernameAttrs] = defineField('username')
const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')
const [confirmPassword, confirmPasswordAttrs] = defineField('confirmPassword')
const [captchaAnswer, captchaAnswerAttrs] = defineField('captchaAnswer')
const [termsAccepted, termsAttrs] = defineField('termsAccepted')

async function loadCaptcha() {
  captchaLoading.value = true
  try {
    captcha.value = await apiRequest<CaptchaResponse>('/api/auth/captcha')
    captchaAnswer.value = ''
  } catch {
    submitError.value = '验证码暂时无法加载，请稍后重试。'
  } finally {
    captchaLoading.value = false
  }
}

const submit = handleSubmit(async (values) => {
  submitError.value = ''
  if (!captcha.value) {
    submitError.value = '请先加载图形验证码。'
    return
  }
  try {
    await auth.register({
      username: values.username,
      email: values.email,
      password: values.password,
      captchaId: captcha.value.id,
      captchaAnswer: values.captchaAnswer,
      termsAccepted: values.termsAccepted,
    })
    await router.replace('/studio')
  } catch (error) {
    if (error instanceof APIError) {
      submitError.value = error.message
      const fields = { ...error.fields }
      if (fields.captcha) {
        fields.captchaAnswer = fields.captcha
        delete fields.captcha
        await loadCaptcha()
      }
      setErrors(fields)
      return
    }
    submitError.value = '注册暂时失败，请稍后重试。'
  }
})

onMounted(() => {
  void loadCaptcha()
})
</script>

<template>
  <AuthLayout
    kicker="建立光桌"
    title="开始你的第一张作品"
    description="账户用于保存任务、积分与最近七天的作品记录。邮箱验证在首期默认关闭。"
  >
    <form class="form-stack" novalidate @submit="submit">
      <div class="field-grid">
        <label class="field">
          <span>用户名</span>
          <input
            v-model="username"
            v-bind="usernameAttrs"
            type="text"
            autocomplete="username"
            placeholder="3 到 24 个字符"
            :aria-invalid="Boolean(errors.username)"
          />
          <small v-if="errors.username" class="field-error">{{ errors.username }}</small>
        </label>
        <label class="field">
          <span>邮箱</span>
          <input
            v-model="email"
            v-bind="emailAttrs"
            type="email"
            autocomplete="email"
            placeholder="name@example.com"
            :aria-invalid="Boolean(errors.email)"
          />
          <small v-if="errors.email" class="field-error">{{ errors.email }}</small>
        </label>
      </div>

      <div class="field-grid">
        <label class="field">
          <span>密码</span>
          <span class="password-input">
            <input
              v-model="password"
              v-bind="passwordAttrs"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="至少 8 个字符"
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
        <label class="field">
          <span>确认密码</span>
          <input
            v-model="confirmPassword"
            v-bind="confirmPasswordAttrs"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            placeholder="再次输入密码"
            :aria-invalid="Boolean(errors.confirmPassword)"
          />
          <small v-if="errors.confirmPassword" class="field-error">
            {{ errors.confirmPassword }}
          </small>
        </label>
      </div>

      <div class="field">
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

      <label class="checkbox-field">
        <input v-model="termsAccepted" v-bind="termsAttrs" type="checkbox" />
        <span>
          我已阅读并同意
          <RouterLink to="/terms" target="_blank">用户协议</RouterLink>
          与
          <RouterLink to="/privacy" target="_blank">隐私政策</RouterLink>
        </span>
      </label>
      <small v-if="errors.termsAccepted" class="field-error">{{ errors.termsAccepted }}</small>

      <div v-if="submitError" class="inline-alert inline-alert--error" role="alert">
        {{ submitError }}
      </div>

      <button class="button button--primary button--wide" type="submit" :disabled="auth.loading">
        <UserPlus :size="17" aria-hidden="true" />
        <span>{{ auth.loading ? '正在创建' : '创建账户' }}</span>
      </button>
    </form>

    <p class="auth-switch">
      已经有账户？
      <RouterLink to="/login">登录</RouterLink>
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

@media (max-width: 620px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
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
