import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ThemePreference } from '../api/client'

const STORAGE_KEY = 'lighttable-theme'

export const useThemeStore = defineStore('theme', () => {
  const preference = ref<ThemePreference>('system')
  const systemDark = ref(false)
  let initialized = false
  let mediaQuery: MediaQueryList | null = null

  const resolved = computed<'light' | 'dark'>(() => {
    if (preference.value === 'system') {
      return systemDark.value ? 'dark' : 'light'
    }
    return preference.value
  })

  function initialize() {
    if (initialized) {
      applyDocumentTheme()
      return
    }
    initialized = true
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      preference.value = saved
    }
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    systemDark.value = mediaQuery.matches
    mediaQuery.addEventListener('change', handleSystemTheme)
    applyDocumentTheme()
  }

  function setPreference(value: ThemePreference) {
    preference.value = value
    localStorage.setItem(STORAGE_KEY, value)
    applyDocumentTheme()
  }

  function applyDocumentTheme() {
    document.documentElement.dataset.theme = resolved.value
    document.documentElement.style.colorScheme = resolved.value
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', resolved.value === 'dark' ? '#0f1211' : '#f1f3ee')
  }

  function handleSystemTheme(event: MediaQueryListEvent) {
    systemDark.value = event.matches
    if (preference.value === 'system') {
      applyDocumentTheme()
    }
  }

  return {
    preference,
    resolved,
    initialize,
    setPreference,
  }
})
