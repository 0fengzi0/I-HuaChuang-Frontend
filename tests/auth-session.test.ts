import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAccessToken,
  clearCSRFToken,
  getAccessToken,
  getCSRFToken,
  onSessionRefreshed,
  refreshSession,
  setCSRFToken,
} from '../src/api/client'

const refreshedSession = {
  accessToken: 'new-access-token',
  expiresIn: 900,
  csrfToken: 'new-csrf-token',
  user: {
    id: 'user-1',
    username: 'refresh-user',
    email: 'refresh@example.test',
    role: 'user' as const,
    status: 'active' as const,
    emailVerifiedAt: null,
    creditBalance: 0,
    reservedCredits: 0,
    availableCredits: 0,
    themePreference: 'system' as const,
    createdAt: '2026-10-27T00:00:00Z',
  },
}

describe('auth session refresh', () => {
  beforeEach(() => {
    localStorage.clear()
    document.cookie = 'lt_csrf=; Max-Age=0; path=/'
    clearAccessToken()
    clearCSRFToken()
    vi.restoreAllMocks()
  })

  it('uses the persisted CSRF token when the API cookie is on another origin', async () => {
    setCSRFToken('csrf-from-login-response')
    const listener = vi.fn()
    onSessionRefreshed(listener)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(refreshedSession), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await refreshSession()

    const requestHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers)
    expect(requestHeaders.get('X-CSRF-Token')).toBe('csrf-from-login-response')
    expect(getAccessToken()).toBe('new-access-token')
    expect(getCSRFToken()).toBe('new-csrf-token')
    expect(listener).toHaveBeenCalledWith(refreshedSession)
  })
})
