<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  BadgeCheck,
  CalendarDays,
  KeyRound,
  LogOut,
  Mail,
  Palette,
  Shield,
  Save,
  UserRound,
} from 'lucide-vue-next'
import ThemeSegmented from '../components/ThemeSegmented.vue'
import { APIError, apiRequest, type ThemePreference, type User } from '../api/client'
import { useAuthStore } from '../stores/auth'
import { useNotificationsStore } from '../stores/notifications'
import { useThemeStore } from '../stores/theme'

const auth = useAuthStore()
const router = useRouter()
const theme = useThemeStore()
const notifications = useNotificationsStore()
const savingTheme = ref(false)
const loggingOut = ref(false)
const profileForm = reactive({ username: '', email: '' })
const profileSaving = ref(false)
const profileError = ref('')
const profileFields = ref<Record<string, string>>({})
const passwordForm = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const passwordSaving = ref(false)
const passwordError = ref('')
const passwordFields = ref<Record<string, string>>({})

watch(
  [() => auth.user?.id, () => auth.user?.username, () => auth.user?.email],
  () => {
    if (auth.user) {
      profileForm.username = auth.user.username
      profileForm.email = auth.user.email
    }
  },
  { immediate: true },
)

async function changeTheme(value: ThemePreference) {
  const previous = theme.preference
  theme.setPreference(value)
  savingTheme.value = true
  try {
    await auth.updateTheme(value)
    notifications.push('主题设置已保存。', 'success')
  } catch {
    theme.setPreference(previous)
    notifications.push('主题设置暂时无法保存。', 'warning')
  } finally {
    savingTheme.value = false
  }
}

async function logout() {
  loggingOut.value = true
  try {
    await auth.logout()
    await router.replace('/login')
  } finally {
    loggingOut.value = false
  }
}

async function saveProfile() {
  profileError.value = ''
  profileFields.value = {}
  profileSaving.value = true
  try {
    const response = await apiRequest<{ user: User }>('/api/me', {
      method: 'PATCH',
      body: JSON.stringify({
        username: profileForm.username,
        email: profileForm.email,
      }),
    })
    auth.applyUpdatedUser(response.user)
    notifications.push('个人资料已保存。', 'success')
  } catch (error) {
    if (error instanceof APIError) {
      profileError.value = error.message
      profileFields.value = error.fields
    } else {
      profileError.value = '个人资料暂时无法保存。'
    }
  } finally {
    profileSaving.value = false
  }
}

async function changePassword() {
  passwordError.value = ''
  passwordFields.value = {}
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordFields.value = { confirmPassword: '两次输入的新密码不一致。' }
    return
  }
  passwordSaving.value = true
  try {
    await apiRequest('/api/me/password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      }),
    })
    await auth.logout()
    await router.replace({ name: 'login', query: { passwordChanged: '1' } })
    notifications.push('密码已修改，请重新登录。', 'success')
  } catch (error) {
    if (error instanceof APIError) {
      passwordError.value = error.message
      passwordFields.value = error.fields
    } else {
      passwordError.value = '密码暂时无法修改。'
    }
  } finally {
    passwordSaving.value = false
  }
}

function formatDate(value: string | undefined) {
  if (!value) {
    return '—'
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value))
}
</script>

<template>
  <div class="page-frame account-page">
    <header class="page-heading">
      <div>
        <span class="page-kicker">账户与访问</span>
        <h1>账户设置</h1>
        <p>查看账户身份、验证状态和界面偏好。工作台主题只保存在当前浏览器，同时同步到账户。</p>
      </div>
      <span class="role-chip">
        <Shield :size="14" aria-hidden="true" />
        {{ auth.user?.role === 'admin' ? '管理员' : '普通用户' }}
      </span>
    </header>

    <div class="account-grid">
      <section class="profile-card">
        <div class="profile-avatar">{{ auth.user?.username.slice(0, 1) }}</div>
        <div class="profile-copy">
          <span class="card-index">个人资料</span>
          <h2>{{ auth.user?.username }}</h2>
          <p>{{ auth.user?.email }}</p>
        </div>
        <div class="profile-facts">
          <div>
            <UserRound :size="16" aria-hidden="true" />
            <span>用户名</span>
            <strong>{{ auth.user?.username }}</strong>
          </div>
          <div>
            <Mail :size="16" aria-hidden="true" />
            <span>邮箱</span>
            <strong>{{ auth.user?.email }}</strong>
          </div>
          <div>
            <BadgeCheck :size="16" aria-hidden="true" />
            <span>邮箱验证</span>
            <strong>{{ auth.user?.emailVerifiedAt ? '已验证' : '首期未启用' }}</strong>
          </div>
          <div>
            <CalendarDays :size="16" aria-hidden="true" />
            <span>加入时间</span>
            <strong>{{ formatDate(auth.user?.createdAt) }}</strong>
          </div>
        </div>
      </section>

      <section class="settings-stack">
        <div class="settings-card">
          <div class="section-heading">
            <div>
              <UserRound :size="18" aria-hidden="true" />
              <h2>个人资料</h2>
            </div>
            <span>用户名与邮箱</span>
          </div>
          <form class="account-form" @submit.prevent="saveProfile">
            <div class="field-grid">
              <label class="field">
                <span>用户名</span>
                <input v-model="profileForm.username" autocomplete="username" />
                <small v-if="profileFields.username" class="field-error">{{ profileFields.username }}</small>
              </label>
              <label class="field">
                <span>邮箱</span>
                <input v-model="profileForm.email" type="email" autocomplete="email" />
                <small v-if="profileFields.email" class="field-error">{{ profileFields.email }}</small>
              </label>
            </div>
            <div v-if="profileError" class="inline-alert inline-alert--error" role="alert">
              {{ profileError }}
            </div>
            <button class="button button--primary" type="submit" :disabled="profileSaving">
              <Save :size="16" aria-hidden="true" />
              {{ profileSaving ? '正在保存' : '保存个人资料' }}
            </button>
          </form>
        </div>

        <div class="settings-card">
          <div class="section-heading">
            <div>
              <KeyRound :size="18" aria-hidden="true" />
              <h2>修改密码</h2>
            </div>
            <span>修改后重新登录</span>
          </div>
          <form class="account-form" @submit.prevent="changePassword">
            <label class="field">
              <span>当前密码</span>
              <input v-model="passwordForm.currentPassword" type="password" autocomplete="current-password" />
              <small v-if="passwordFields.currentPassword" class="field-error">{{ passwordFields.currentPassword }}</small>
            </label>
            <div class="field-grid">
              <label class="field">
                <span>新密码</span>
                <input v-model="passwordForm.newPassword" type="password" autocomplete="new-password" />
                <small v-if="passwordFields.newPassword" class="field-error">{{ passwordFields.newPassword }}</small>
              </label>
              <label class="field">
                <span>确认新密码</span>
                <input v-model="passwordForm.confirmPassword" type="password" autocomplete="new-password" />
                <small v-if="passwordFields.confirmPassword" class="field-error">{{ passwordFields.confirmPassword }}</small>
              </label>
            </div>
            <div v-if="passwordError" class="inline-alert inline-alert--error" role="alert">
              {{ passwordError }}
            </div>
            <button class="button button--secondary" type="submit" :disabled="passwordSaving">
              <KeyRound :size="16" aria-hidden="true" />
              {{ passwordSaving ? '正在修改' : '修改密码' }}
            </button>
          </form>
        </div>

        <div class="settings-card">
          <div class="section-heading">
            <div>
              <Palette :size="18" aria-hidden="true" />
              <h2>界面主题</h2>
            </div>
            <span>{{ savingTheme ? '正在保存' : '自动适配' }}</span>
          </div>
          <ThemeSegmented :model-value="theme.preference" @update:model-value="changeTheme" />
          <p class="settings-note">
            默认跟随系统。切换时只改变颜色，不重新加载图片和工作台布局。
          </p>
        </div>

        <div class="settings-card danger-card">
          <div class="section-heading">
            <div>
              <Shield :size="18" aria-hidden="true" />
              <h2>登录会话</h2>
            </div>
            <span>30 天刷新周期</span>
          </div>
          <p class="settings-note">
            退出会撤销当前设备的 Refresh 会话，并清除浏览器中的登录凭据。
          </p>
          <button class="button button--secondary" type="button" :disabled="loggingOut" @click="logout">
            <LogOut :size="16" aria-hidden="true" />
            {{ loggingOut ? '正在退出' : '退出登录' }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.account-page {
  display: grid;
  gap: 10px;
}

.role-chip {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 6px;
  padding: 0 11px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-size: 10px;
}

.account-grid {
  display: grid;
  grid-template-columns: minmax(320px, 0.92fr) minmax(0, 1.08fr);
  align-items: start;
  gap: 10px;
}

.profile-card,
.settings-card {
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
}

.profile-card {
  display: grid;
  gap: 24px;
  padding: 24px;
  background: var(--surface-muted);
}

.profile-avatar {
  display: grid;
  width: 76px;
  height: 76px;
  place-items: center;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  background: var(--action-soft);
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 600;
}

.profile-copy h2 {
  margin: 7px 0 2px;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 560;
}

.profile-copy p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.profile-facts {
  display: grid;
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-thumb);
  background: var(--line);
}

.profile-facts > div {
  display: grid;
  min-height: 46px;
  grid-template-columns: auto 108px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  padding: 0 12px;
  background: var(--surface-muted);
}

.profile-facts svg {
  color: var(--muted);
}

.profile-facts span {
  color: var(--muted);
  font-size: 10px;
}

.profile-facts strong {
  overflow: hidden;
  color: var(--ink);
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-stack {
  display: grid;
  gap: 10px;
}

.settings-card {
  padding: 20px;
}

.account-form {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.account-form > .button {
  width: max-content;
}

.settings-note {
  margin: 12px 0 0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.7;
}

.danger-card .button {
  margin-top: 16px;
}

@media (max-width: 800px) {
  .account-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .profile-card,
  .settings-card {
    padding: 16px;
  }

  .account-form > .button {
    width: 100%;
  }

  .profile-facts > div {
    grid-template-columns: auto minmax(0, 1fr);
    padding: 9px 10px;
  }

  .profile-facts strong {
    grid-column: 2;
  }
}
</style>
