import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useThemeStore } from '../src/stores/theme'

function mockSystemTheme(dark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: dark,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

describe('theme store', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.dataset.theme = ''
    setActivePinia(createPinia())
  })

  it('follows the system theme by default', () => {
    mockSystemTheme(true)
    const theme = useThemeStore()
    theme.initialize()

    expect(theme.preference).toBe('system')
    expect(theme.resolved).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('persists a manual theme and resolves it over the system preference', () => {
    mockSystemTheme(true)
    const theme = useThemeStore()
    theme.initialize()
    theme.setPreference('light')

    expect(theme.resolved).toBe('light')
    expect(localStorage.getItem('lighttable-theme')).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')

    setActivePinia(createPinia())
    const restored = useThemeStore()
    restored.initialize()
    expect(restored.preference).toBe('light')
    expect(restored.resolved).toBe('light')
  })
})
