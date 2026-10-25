import { demoBlob, demoRequest, demoSession } from './demo'

export interface User {
  id: string
  username: string
  email: string
  role: 'user' | 'admin'
  status: 'active' | 'disabled'
  emailVerifiedAt: string | null
  creditBalance: number
  reservedCredits: number
  availableCredits: number
  themePreference: ThemePreference
  createdAt: string
}

export type ThemePreference = 'system' | 'light' | 'dark'

export interface Session {
  accessToken: string
  expiresIn: number
  csrfToken: string
  user: User
}

export interface PublicSettings {
  purchaseLink: string
  retentionDays: number
  pricing: Record<'1K' | '2K', number>
  generationReady: boolean
  emailVerification: boolean
  dailyGrantCredits: number
  signupGrantCredits: number
  generatedAt: string
}

export interface LedgerEntry {
  id: number
  delta: number
  reason: string
  balanceAfter: number
  generationId?: string
  cardKeyId?: string
  createdAt: string
}

export interface CheckinStatus {
  dailyCredits: number
  canClaim: boolean
  claimedToday: boolean
  period: string
  lastClaimedAt?: string
}

export interface CheckinResponse {
  credits: number
  balance: number
  period: string
  claimedAt: string
  message: string
}

export type GenerationStatus =
  | 'preparing'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'partially_succeeded'
  | 'failed'
  | 'canceled'

export type OutputStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled'

export interface GenerationSettings {
  size: string
  aspectRatio:
    | '1:1'
    | '3:2'
    | '2:3'
    | '16:9'
    | '9:16'
    | '4:3'
    | '3:4'
    | '21:9'
    | '9:21'
    | 'original'
  resolution: '1K' | '2K' | '4K'
  quality: 'auto' | 'low' | 'medium' | 'high'
  background: 'auto' | 'transparent' | 'opaque'
  outputFormat: 'png'
  referenceCount: number
}

export interface GenerationAsset {
  id: string
  width: number
  height: number
  byteSize: number
  mimeType: string
  isFavorite: boolean
  expiresAt: string
  expired: boolean
  hasThumbnail: boolean
}

export interface GenerationOutput {
  id: string
  position: number
  status: OutputStatus
  providerRequestId?: string
  creditsCharged: number
  errorCode?: string
  errorMessage?: string
  asset?: GenerationAsset
  completedAt: string | null
}

export interface Generation {
  id: string
  mode: 'generate' | 'edit'
  prompt: string
  settings: GenerationSettings
  status: GenerationStatus
  estimatedCredits: number
  chargedCredits: number
  unitCredits: number
  retentionDays: number
  errorCode?: string
  errorMessage?: string
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  expiresAt: string
  outputs: GenerationOutput[]
  availableCredits: number
  reservedCredits: number
}

export interface GenerationList {
  items: Generation[]
  nextCursor: string | null
}

export interface CreateGenerationResponse {
  id: string
  status: GenerationStatus
  estimatedCredits: number
  outputCount: number
  createdAt: string
}

export interface ReuseResponse {
  prompt: string
  mode: 'generate' | 'edit'
  settings: GenerationSettings
}

export class APIError extends Error {
  status: number
  code: string
  fields: Record<string, string>
  requiresCaptcha: boolean

  constructor(
    status: number,
    code = 'request_failed',
    message = '请求未完成。',
    fields: Record<string, string> = {},
    requiresCaptcha = false,
  ) {
    super(message)
    this.name = 'APIError'
    this.status = status
    this.code = code
    this.fields = fields
    this.requiresCaptcha = requiresCaptcha
  }
}

interface RuntimeConfig {
  apiBaseUrl?: string
  demoMode?: boolean
}

const runtimeConfig =
  (window as typeof window & { __IHUACHUANG_CONFIG__?: RuntimeConfig })
    .__IHUACHUANG_CONFIG__ || {}
const apiBaseUrl = (runtimeConfig.apiBaseUrl || import.meta.env.VITE_API_BASE_URL || '').replace(
  /\/$/,
  '',
)

export const isDemoMode =
  runtimeConfig.demoMode ?? import.meta.env.VITE_DEMO_MODE === 'true'

let accessToken = ''
let refreshPromise: Promise<Session> | null = null
let sessionListener: ((session: Session) => void) | null = null

export function setAccessToken(token: string) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

export function clearAccessToken() {
  accessToken = ''
}

export function onSessionRefreshed(listener: (session: Session) => void) {
  sessionListener = listener
}

export function hasCSRFToken() {
  return isDemoMode || Boolean(readCookie('lt_csrf'))
}

export async function startSession(
  path: '/api/auth/login' | '/api/auth/register',
  payload: Record<string, unknown>,
) {
  if (isDemoMode) {
    setAccessToken(demoSession.accessToken)
    return demoSession
  }
  const response = await fetch(resolveApiUrl(path), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const session = await parseResponse<Session>(response)
  setAccessToken(session.accessToken)
  return session
}

export async function refreshSession() {
  if (refreshPromise) {
    return refreshPromise
  }
  refreshPromise = (async () => {
    if (isDemoMode) {
      setAccessToken(demoSession.accessToken)
      sessionListener?.(demoSession)
      return demoSession
    }
    const response = await fetch(resolveApiUrl('/api/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'X-CSRF-Token': readCookie('lt_csrf'),
      },
    })
    const session = await parseResponse<Session>(response)
    setAccessToken(session.accessToken)
    sessionListener?.(session)
    return session
  })().finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

export async function logoutSession() {
  try {
    if (isDemoMode) {
      return
    }
    const response = await fetch(resolveApiUrl('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: accessToken ? `Bearer ${accessToken}` : '',
        'X-CSRF-Token': readCookie('lt_csrf'),
      },
    })
    if (!response.ok && response.status !== 401 && response.status !== 403) {
      await parseResponse(response)
    }
  } finally {
    clearAccessToken()
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  if (isDemoMode) {
    return demoRequest<T>(path, init)
  }
  const headers = new Headers(init.headers)
  if (init.body && !(typeof FormData !== 'undefined' && init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(resolveApiUrl(path), {
    ...init,
    headers,
    credentials: 'include',
  })

  if (response.status === 401 && retry && hasCSRFToken()) {
    try {
      await refreshSession()
      return apiRequest<T>(path, init, false)
    } catch {
      clearAccessToken()
    }
  }

  return parseResponse<T>(response)
}

export async function apiBlob(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<Blob> {
  if (isDemoMode) {
    return demoBlob(path)
  }
  const headers = new Headers(init.headers)
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }
  const response = await fetch(resolveApiUrl(path), {
    ...init,
    headers,
    credentials: 'include',
  })
  if (response.status === 401 && retry && hasCSRFToken()) {
    try {
      await refreshSession()
      return apiBlob(path, init, false)
    } catch {
      clearAccessToken()
    }
  }
  if (!response.ok) {
    const contentType = response.headers.get('content-type') || ''
    const body = contentType.includes('application/json') ? await response.json() : null
    throw new APIError(
      response.status,
      body?.error?.code || 'asset_unavailable',
      body?.error?.message || '图片暂时无法加载。',
      body?.error?.fields || {},
    )
  }
  return response.blob()
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T
  }
  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json') ? await response.json() : null
  if (!response.ok) {
    throw new APIError(
      response.status,
      body?.error?.code || 'request_failed',
      body?.error?.message || '请求未完成。',
      body?.error?.fields || {},
      Boolean(body?.requiresCaptcha),
    )
  }
  return body as T
}

function readCookie(name: string) {
  const prefix = `${name}=`
  const match = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
  return match ? decodeURIComponent(match.slice(prefix.length)) : ''
}

function resolveApiUrl(path: string) {
  if (/^https?:\/\//i.test(path) || !apiBaseUrl) {
    return path
  }
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
}
