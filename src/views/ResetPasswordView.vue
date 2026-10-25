<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { KeyRound } from 'lucide-vue-next'
import AuthLayout from '../components/AuthLayout.vue'
import { APIError, apiRequest } from '../api/client'
import { useNotificationsStore } from '../stores/notifications'

const route = useRoute()
const router = useRouter()
const notifications = useNotificationsStore()
const form = reactive({ token: '', newPassword: '', confirmPassword: '' })
const saving = ref(false)
const error = ref('')
const fields = ref<Record<string, string>>({})

async function submit() {
  error.value = ''
  fields.value = {}
  if (form.newPassword !== form.confirmPassword) {
    fields.value = { confirmPassword: '两次输入的新密码不一致。' }
    return
  }
  saving.value = true
  try {
    await apiRequest('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token: form.token,
        newPassword: form.newPassword,
      }),
    })
    await router.replace({ name: 'login', query: { passwordReset: '1' } })
    notifications.push('密码已重置，请使用新密码登录。', 'success')
  } catch (submitError) {
    if (submitError instanceof APIError) {
      error.value = submitError.message
      fields.value = submitError.fields
    } else {
      error.value = '密码暂时无法重置。'
    }
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (typeof route.query.token === 'string') {
    form.token = route.query.token
  }
})
</script>

<template>
  <AuthLayout
    kicker="重置口令"
    title="设置新的登录密码"
    description="输入管理员提供的一次性重置口令。口令有效期为 30 分钟，使用后立即失效。"
  >
    <form class="form-stack" @submit.prevent="submit">
      <label class="field">
        <span>重置口令</span>
        <input v-model="form.token" autocomplete="off" placeholder="LTR-..." />
        <small v-if="fields.token" class="field-error">{{ fields.token }}</small>
      </label>
      <label class="field">
        <span>新密码</span>
        <input v-model="form.newPassword" type="password" autocomplete="new-password" placeholder="至少 8 个字符" />
        <small v-if="fields.newPassword" class="field-error">{{ fields.newPassword }}</small>
      </label>
      <label class="field">
        <span>确认新密码</span>
        <input v-model="form.confirmPassword" type="password" autocomplete="new-password" placeholder="再次输入新密码" />
        <small v-if="fields.confirmPassword" class="field-error">{{ fields.confirmPassword }}</small>
      </label>
      <div v-if="error" class="inline-alert inline-alert--error" role="alert">{{ error }}</div>
      <button class="button button--primary button--wide" type="submit" :disabled="saving">
        <KeyRound :size="17" aria-hidden="true" />
        {{ saving ? '正在重置' : '重置密码' }}
      </button>
    </form>
    <p class="auth-switch">
      返回
      <RouterLink to="/login">登录</RouterLink>
    </p>
  </AuthLayout>
</template>
