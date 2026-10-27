import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  APIError,
  apiRequest,
  clearAccessToken,
  clearCSRFToken,
  hasCSRFToken,
  logoutSession,
  onSessionRefreshed,
  refreshSession,
  startSession,
  type Session,
  type ThemePreference,
  type User,
} from '../api/client'

let listenerInstalled = false

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const initialized = ref(false)
  const loading = ref(false)

  const isAuthenticated = computed(() => user.value !== null)
  const isAdmin = computed(() => user.value?.role === 'admin')

  function applySession(session: Session) {
    user.value = session.user
  }

  if (!listenerInstalled) {
    onSessionRefreshed(applySession)
    listenerInstalled = true
  }

  async function initialize() {
    if (initialized.value) {
      return
    }
    try {
      if (hasCSRFToken()) {
        applySession(await refreshSession())
      }
    } catch (error) {
      clearAccessToken()
      if (error instanceof APIError && (error.status === 401 || error.status === 403)) {
        clearCSRFToken()
      }
      user.value = null
    } finally {
      initialized.value = true
    }
  }

  async function login(identifier: string, password: string, captchaId = '', captchaAnswer = '') {
    loading.value = true
    try {
      const session = await startSession('/api/auth/login', {
        identifier,
        password,
        captchaId,
        captchaAnswer,
      })
      applySession(session)
      return session
    } finally {
      loading.value = false
    }
  }

  async function register(payload: Record<string, unknown>) {
    loading.value = true
    try {
      const session = await startSession('/api/auth/register', payload)
      applySession(session)
      return session
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await logoutSession()
    user.value = null
  }

  async function updateTheme(themePreference: ThemePreference) {
    try {
      const response = await apiRequest<{ user: User }>('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({ themePreference }),
      })
      user.value = response.user
    } catch (error) {
      if (error instanceof APIError) {
        throw error
      }
      throw new APIError(500, 'theme_update_failed', '暂时无法保存主题设置。')
    }
  }

  function updateBalance(balance: number) {
    if (user.value) {
      user.value = {
        ...user.value,
        creditBalance: balance,
        availableCredits: balance,
      }
    }
  }

  function updateCredits(availableCredits: number, reservedCredits: number) {
    if (user.value) {
      user.value = {
        ...user.value,
        reservedCredits,
        availableCredits,
        creditBalance: availableCredits + reservedCredits,
      }
    }
  }

  function applyUpdatedUser(updatedUser: User) {
    user.value = updatedUser
  }

  return {
    user,
    initialized,
    loading,
    isAuthenticated,
    isAdmin,
    initialize,
    login,
    register,
    logout,
    updateTheme,
    updateBalance,
    updateCredits,
    applyUpdatedUser,
  }
})
