import canvasFluid from '../assets/canvas-fluid.jpg'
import paintStudio from '../assets/paint-studio.jpg'
import type {
  Generation,
  GenerationAsset,
  GenerationList,
  GenerationSettings,
  LedgerEntry,
  ReuseResponse,
  Session,
  User,
} from './client'

const demoImages: Record<string, string> = {
  'demo-asset-fluid': canvasFluid,
  'demo-asset-studio': paintStudio,
}

const demoPricing = {
  '1K': 1,
  '2K': 2,
} as const

let demoCredits = 32
let demoUser: User = {
  id: 'demo-user',
  username: 'I画创体验用户',
  email: 'demo@ihuachuang.local',
  role: 'admin',
  status: 'active',
  emailVerifiedAt: new Date().toISOString(),
  creditBalance: demoCredits,
  reservedCredits: 0,
  availableCredits: demoCredits,
  themePreference: 'system',
  createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
}

export const demoSession: Session = {
  accessToken: 'demo-session',
  expiresIn: 3600,
  csrfToken: 'demo-csrf',
  user: demoUser,
}

const now = Date.now()
const expiry = new Date(now + 7 * 86400000).toISOString()

function makeAsset(id: string, width: number, height: number): GenerationAsset {
  return {
    id,
    width,
    height,
    byteSize: 824000,
    mimeType: 'image/jpeg',
    isFavorite: id === 'demo-asset-fluid',
    expiresAt: expiry,
    expired: false,
    hasThumbnail: false,
  }
}

function makeGeneration(
  id: string,
  prompt: string,
  assetId: string,
  imageWidth: number,
  imageHeight: number,
  resolution: '1K' | '2K',
  createdAt: string,
): Generation {
  const size = resolution === '2K' ? '3072x2048' : '1536x1024'
  return {
    id,
    mode: 'generate',
    prompt,
    settings: {
      size,
      aspectRatio: '3:2',
      resolution,
      quality: 'high',
      background: 'opaque',
      outputFormat: 'png',
      referenceCount: 0,
    },
    status: 'succeeded',
    estimatedCredits: demoPricing[resolution],
    chargedCredits: demoPricing[resolution],
    unitCredits: demoPricing[resolution],
    retentionDays: 7,
    createdAt,
    startedAt: createdAt,
    completedAt: createdAt,
    expiresAt: expiry,
    availableCredits: demoCredits,
    reservedCredits: 0,
    outputs: [
      {
        id: `output-${id}`,
        position: 1,
        status: 'succeeded',
        providerRequestId: `demo-request-${id}`,
        creditsCharged: demoPricing[resolution],
        completedAt: createdAt,
        asset: makeAsset(assetId, imageWidth, imageHeight),
      },
    ],
  }
}

let demoGenerations: Generation[] = [
  makeGeneration(
    'demo-generation-fluid',
    '蓝橙色油墨在暖白色光桌上缓慢扩散，保留真实颗粒与纸张纹理',
    'demo-asset-fluid',
    3072,
    2048,
    '2K',
    new Date(now - 18 * 60000).toISOString(),
  ),
  makeGeneration(
    'demo-generation-studio',
    '一把旧画刷停在晚霞照亮的宣纸上，保留颜料厚度',
    'demo-asset-studio',
    1536,
    1024,
    '1K',
    new Date(now - 3 * 3600000).toISOString(),
  ),
]

const sizeByAspect: Record<string, Record<'1K' | '2K', string>> = {
  '1:1': { '1K': '1024x1024', '2K': '2048x2048' },
  '3:2': { '1K': '1536x1024', '2K': '3072x2048' },
  '2:3': { '1K': '1024x1536', '2K': '2048x3072' },
  '16:9': { '1K': '1536x864', '2K': '3072x1728' },
  '9:16': { '1K': '864x1536', '2K': '1728x3072' },
  '4:3': { '1K': '1365x1024', '2K': '2731x2048' },
  '3:4': { '1K': '1024x1365', '2K': '2048x2731' },
  '21:9': { '1K': '1536x658', '2K': '3072x1317' },
  '9:21': { '1K': '658x1536', '2K': '1317x3072' },
  original: { '1K': '1536x1024', '2K': '3072x2048' },
}

function generationWithCredits(generation: Generation): Generation {
  return {
    ...generation,
    availableCredits: demoCredits,
    reservedCredits: 0,
  }
}

function findGeneration(id: string) {
  return demoGenerations.find((generation) => generation.id === id)
}

function parseRequestBody(init: RequestInit): Record<string, unknown> {
  if (typeof init.body === 'string' && init.body) {
    return JSON.parse(init.body) as Record<string, unknown>
  }
  if (typeof FormData !== 'undefined' && init.body instanceof FormData) {
    return Object.fromEntries(init.body.entries())
  }
  return {}
}

function createGeneration(init: RequestInit) {
  const form = parseRequestBody(init)
  const resolution = form.resolution === '2K' ? '2K' : '1K'
  const aspectRatio = String(form.aspectRatio || '1:1')
  const count = Math.max(1, Math.min(4, Number(form.count) || 1))
  const estimatedCredits = demoPricing[resolution] * count
  const id = `demo-generation-${crypto.randomUUID()}`
  const createdAt = new Date().toISOString()
  const size = sizeByAspect[aspectRatio]?.[resolution] ?? sizeByAspect['1:1'][resolution]
  const settings: GenerationSettings = {
    size,
    aspectRatio: aspectRatio as GenerationSettings['aspectRatio'],
    resolution,
    quality: String(form.quality || 'auto') as GenerationSettings['quality'],
    background: String(form.background || 'auto') as GenerationSettings['background'],
    outputFormat: 'png',
    referenceCount: Number(form.referenceCount) || 0,
  }
  const outputs = Array.from({ length: count }, (_, index) => ({
    id: `${id}-output-${index + 1}`,
    position: index + 1,
    status: 'queued' as const,
    creditsCharged: 0,
    completedAt: null,
    asset: undefined,
  }))
  const generation: Generation = {
    id,
    mode: form.mode === 'edit' ? 'edit' : 'generate',
    prompt: String(form.prompt || 'I画创演示任务'),
    settings,
    status: 'queued',
    estimatedCredits,
    chargedCredits: 0,
    unitCredits: demoPricing[resolution],
    retentionDays: 7,
    createdAt,
    startedAt: null,
    completedAt: null,
    expiresAt: expiry,
    availableCredits: demoCredits - estimatedCredits,
    reservedCredits: estimatedCredits,
    outputs,
  }
  demoCredits -= estimatedCredits
  demoGenerations = [generation, ...demoGenerations]

  window.setTimeout(() => {
    const current = findGeneration(id)
    if (!current) return
    const [width, height] = size.split('x').map(Number)
    current.status = 'succeeded'
    current.chargedCredits = estimatedCredits
    current.startedAt = new Date().toISOString()
    current.completedAt = current.startedAt
    current.reservedCredits = 0
    current.availableCredits = demoCredits
    current.outputs = current.outputs.map((output, index) => {
      const assetId = `demo-asset-${id}-${index + 1}`
      demoImages[assetId] = index % 2 === 0 ? canvasFluid : paintStudio
      return {
        ...output,
        status: 'succeeded',
        creditsCharged: demoPricing[resolution],
        providerRequestId: `demo-request-${id}-${index + 1}`,
        completedAt: current.completedAt,
        asset: makeAsset(assetId, width, height),
      }
    })
  }, 1800)

  return {
    id,
    status: 'queued' as const,
    estimatedCredits,
    outputCount: count,
    createdAt,
  }
}

export async function demoRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = new URL(path, 'https://demo.ihuachuang.local')
  const method = (init.method || 'GET').toUpperCase()
  const segments = url.pathname.split('/').filter(Boolean)

  if (url.pathname === '/api/settings/public') {
    return {
      purchaseLink: 'https://www.ldxp.cn',
      retentionDays: 7,
      pricing: demoPricing,
      generationReady: true,
      emailVerification: false,
      generatedAt: new Date().toISOString(),
    } as T
  }

  if (url.pathname === '/api/generations' && method === 'GET') {
    const favorite = url.searchParams.get('favorite') === 'true'
    const mode = url.searchParams.get('mode')
    const items = demoGenerations
      .filter((generation) => !mode || generation.mode === mode)
      .filter(
        (generation) =>
          !favorite || generation.outputs.some((output) => output.asset?.isFavorite),
      )
      .slice(0, Number(url.searchParams.get('limit')) || 20)
      .map(generationWithCredits)
    return { items, nextCursor: null } as GenerationList as T
  }

  if (url.pathname === '/api/generations' && method === 'POST') {
    return createGeneration(init) as T
  }

  if (segments[1] === 'generations' && segments[2]) {
    const generation = findGeneration(segments[2])
    if (!generation) {
      return { items: [], nextCursor: null } as T
    }
    if (segments[3] === 'reuse') {
      return {
        prompt: generation.prompt,
        mode: generation.mode,
        settings: generation.settings,
      } as ReuseResponse as T
    }
    if (segments[3] === 'favorite') {
      const body = parseRequestBody(init)
      const asset = generation.outputs.find((output) => output.asset)?.asset
      if (asset) asset.isFavorite = Boolean(body.favorite)
      return {} as T
    }
    if (method === 'DELETE') {
      demoGenerations = demoGenerations.filter((item) => item.id !== generation.id)
      return undefined as T
    }
    return generationWithCredits(generation) as T
  }

  if (url.pathname === '/api/wallet') {
    const ledger: LedgerEntry[] = [
      {
        id: 2,
        delta: -2,
        reason: 'generation_charge',
        balanceAfter: demoCredits,
        generationId: demoGenerations[0]?.id,
        createdAt: new Date(now - 18 * 60000).toISOString(),
      },
      {
        id: 1,
        delta: 32,
        reason: 'card_redeem',
        balanceAfter: 34,
        createdAt: new Date(now - 10 * 86400000).toISOString(),
      },
    ]
    return {
      balance: demoCredits,
      reservedCredits: 0,
      availableCredits: demoCredits,
      ledger,
    } as T
  }

  if (url.pathname === '/api/wallet/redeem' && method === 'POST') {
    demoCredits += 10
    return { balance: demoCredits, message: '演示积分已到账。' } as T
  }

  if (url.pathname === '/api/me') {
    if (method === 'PATCH') {
      const body = parseRequestBody(init)
      demoUser = {
        ...demoUser,
        username: String(body.username || demoUser.username),
        email: String(body.email || demoUser.email),
        themePreference: (body.themePreference || demoUser.themePreference) as User['themePreference'],
      }
      return { user: demoUser } as T
    }
    return demoUser as T
  }

  if (url.pathname === '/api/me/password' && method === 'POST') {
    return {} as T
  }

  if (url.pathname === '/api/admin/stats/overview') {
    return {
      totalUsers: 1,
      activeUsers: 1,
      generationCount: demoGenerations.length,
      redeemedCards: 1,
      outstandingCredits: demoCredits,
      providerReady: true,
      successfulGenerations: demoGenerations.length,
      failedGenerations: 0,
      successRate: 100,
      averageDurationMs: 1800,
      failureDistribution: [],
      mediaUsedBytes: 12_400_000,
      mediaMaxBytes: 2_147_483_648,
      mediaUsedPercent: 0.6,
      mediaAccepting: true,
    } as T
  }

  if (url.pathname === '/api/admin/users') {
    return { users: [demoUser] } as T
  }

  if (url.pathname === '/api/admin/card-key-batches') {
    return {
      batches: [
        {
          id: 'demo-batch',
          name: 'I画创体验卡',
          creditsPerKey: 10,
          quantity: 20,
          expiresAt: null,
          createdAt: new Date(now - 8 * 86400000).toISOString(),
          redeemed: 1,
        },
      ],
    } as T
  }

  if (url.pathname === '/api/admin/settings') {
    return {
      pricing: demoPricing,
      retentionDays: 7,
      purchaseLink: 'https://www.ldxp.cn',
    } as T
  }

  if (url.pathname === '/api/admin/settings/provider') {
    return {
      baseURL: 'https://provider.example/v1',
      apiKeyMasked: '••••••••',
      model: 'gpt-image-2',
      timeoutMs: 300000,
      supportsEdit: true,
      enabled: true,
      configured: true,
      updatedAt: new Date().toISOString(),
    } as T
  }

  if (url.pathname === '/api/admin/audit-logs') {
    return {
      logs: [
        {
          id: 1,
          adminUsername: 'I画创演示',
          action: 'provider_tested',
          targetType: 'provider_setting',
          targetId: 'demo',
          detailJson: '{"demo":true}',
          ip: '127.0.0.1',
          createdAt: new Date().toISOString(),
        },
      ],
    } as T
  }

  if (url.pathname === '/api/admin/settings/provider/test') {
    return { reachable: true, modelAvailable: true, requestId: 'demo-request' } as T
  }

  if (url.pathname.startsWith('/api/admin/')) {
    return {} as T
  }

  return {} as T
}

export async function demoBlob(path: string): Promise<Blob> {
  const segments = path.split('/')
  const assetID = decodeURIComponent(segments[3] || '')
  const source = demoImages[assetID] || canvasFluid
  const response = await fetch(source)
  if (!response.ok) {
    throw new Error('Demo image could not be loaded')
  }
  return response.blob()
}
