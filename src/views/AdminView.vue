<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  BarChart3,
  Check,
  Clipboard,
  Coins,
  CreditCard,
  Download,
  KeyRound,
  LoaderCircle,
  Save,
  ScrollText,
  ServerCog,
  Settings2,
  ShieldCheck,
  Ticket,
  Users,
  X,
} from 'lucide-vue-next'
import { APIError, apiRequest, type User } from '../api/client'
import { useAuthStore } from '../stores/auth'
import { useNotificationsStore } from '../stores/notifications'

interface Overview {
  totalUsers: number
  activeUsers: number
  generationCount: number
  redeemedCards: number
  outstandingCredits: number
  providerReady: boolean
  successfulGenerations: number
  failedGenerations: number
  successRate: number
  averageDurationMs: number
  failureDistribution: Array<{ code: string; count: number }>
  mediaUsedBytes: number
  mediaMaxBytes: number
  mediaUsedPercent: number
  mediaAccepting: boolean
}

interface Batch {
  id: string
  name: string
  creditsPerKey: number
  quantity: number
  expiresAt: string | null
  createdAt: string
  redeemed: number
}

interface AdminSettings {
  pricing: Record<'1K' | '2K', number>
  retentionDays: number
  purchaseLink: string
}

interface ProviderSetting {
  baseURL: string
  apiKeyMasked: string
  model: string
  timeoutMs: number
  supportsEdit: boolean
  enabled: boolean
  configured: boolean
  updatedAt: string
}

type Tab = 'overview' | 'users' | 'cards' | 'settings' | 'audit'

const auth = useAuthStore()
const notifications = useNotificationsStore()
const queryClient = useQueryClient()
const activeTab = ref<Tab>('overview')
const tabs = [
  { value: 'overview' as const, label: '概览', icon: BarChart3 },
  { value: 'users' as const, label: '用户', icon: Users },
  { value: 'cards' as const, label: '卡密', icon: Ticket },
  { value: 'settings' as const, label: '系统设置', icon: Settings2 },
  { value: 'audit' as const, label: '审计', icon: ScrollText },
]

const { data: overview, isLoading: overviewLoading } = useQuery({
  queryKey: ['admin-overview'],
  queryFn: () => apiRequest<Overview>('/api/admin/stats/overview'),
})
const { data: usersData, isLoading: usersLoading } = useQuery({
  queryKey: ['admin-users'],
  queryFn: () => apiRequest<{ users: User[] }>('/api/admin/users?limit=50'),
})
const { data: batchesData } = useQuery({
  queryKey: ['admin-card-batches'],
  queryFn: () => apiRequest<{ batches: Batch[] }>('/api/admin/card-key-batches'),
})
const { data: settingsData } = useQuery({
  queryKey: ['admin-settings'],
  queryFn: () => apiRequest<AdminSettings>('/api/admin/settings'),
})
const { data: provider } = useQuery({
  queryKey: ['admin-provider'],
  queryFn: () => apiRequest<ProviderSetting>('/api/admin/settings/provider'),
})
const { data: auditData, isLoading: auditLoading } = useQuery({
  queryKey: ['admin-audit-logs'],
  queryFn: () => apiRequest<{ logs: AuditLog[] }>('/api/admin/audit-logs?limit=80'),
  enabled: computed(() => activeTab.value === 'audit'),
})

const batchForm = reactive({
  name: '',
  creditsPerKey: 10,
  quantity: 10,
  expiresAt: '',
})
const batchCreating = ref(false)
const batchError = ref('')
const generatedCodes = ref<string[]>([])
const copied = ref(false)

const settingsForm = reactive({
  pricing: {
    '1K': 1,
    '2K': 2,
  },
  retentionDays: 7,
  purchaseLink: 'https://www.ldxp.cn',
})
const settingsSaving = ref(false)
const settingsError = ref('')

const adjustUser = ref<User | null>(null)
const adjustment = reactive({ delta: 0, reason: '' })
const adjusting = ref(false)
const adjustmentError = ref('')
const resetToken = ref('')
const resetTokenUser = ref<User | null>(null)
const resetTokenCreating = ref(false)
const providerForm = reactive({
  baseURL: '',
  apiKey: '',
  model: 'gpt-image-2',
  timeoutMs: 300000,
  supportsEdit: false,
  enabled: false,
  confirmApiKeyChange: false,
  clearApiKey: false,
})
const providerSaving = ref(false)
const providerTesting = ref(false)
const providerError = ref('')
const providerTestMessage = ref('')

interface AuditLog {
  id: number
  adminUsername: string
  action: string
  targetType: string
  targetId: string
  detailJson: string
  ip: string
  createdAt: string
}

const statCards = computed(() => [
  {
    label: '注册用户',
    value: overview.value?.totalUsers ?? 0,
    note: `${overview.value?.activeUsers ?? 0} 个活跃账户`,
    icon: Users,
  },
  {
    label: '生成任务',
    value: overview.value?.generationCount ?? 0,
    note: `${overview.value?.successfulGenerations ?? 0} 个任务至少有一张成功`,
    icon: KeyRound,
  },
  {
    label: '已兑换卡密',
    value: overview.value?.redeemedCards ?? 0,
    note: '一次性核销',
    icon: CreditCard,
  },
  {
    label: '用户积分总额',
    value: overview.value?.outstandingCredits ?? 0,
    note: '未来未消费额度',
    icon: Coins,
  },
])

watch(
  settingsData,
  (value) => {
    if (!value) {
      return
    }
    settingsForm.pricing['1K'] = value.pricing['1K'] ?? 1
    settingsForm.pricing['2K'] = value.pricing['2K'] ?? 2
    settingsForm.retentionDays = value.retentionDays
    settingsForm.purchaseLink = value.purchaseLink
  },
  { immediate: true },
)

watch(
  provider,
  (value) => {
    if (!value) return
    providerForm.baseURL = value.baseURL
    providerForm.model = value.model || 'gpt-image-2'
    providerForm.timeoutMs = value.timeoutMs || 300000
    providerForm.supportsEdit = value.supportsEdit
    providerForm.enabled = value.enabled
  },
  { immediate: true },
)

async function createBatch() {
  batchError.value = ''
  generatedCodes.value = []
  if (!batchForm.name.trim()) {
    batchError.value = '请输入批次名称。'
    return
  }
  batchCreating.value = true
  try {
    const response = await apiRequest<{ batchId: string; codes: string[]; notice: string }>(
      '/api/admin/card-key-batches',
      {
        method: 'POST',
        body: JSON.stringify({
          name: batchForm.name,
          creditsPerKey: Number(batchForm.creditsPerKey),
          quantity: Number(batchForm.quantity),
          expiresAt: batchForm.expiresAt ? new Date(batchForm.expiresAt).toISOString() : null,
        }),
      },
    )
    generatedCodes.value = response.codes
    batchForm.name = ''
    await queryClient.invalidateQueries({ queryKey: ['admin-card-batches'] })
    notifications.push('卡密批次已生成，请立即保存完整卡密。', 'success')
  } catch (error) {
    batchError.value = error instanceof APIError ? error.message : '暂时无法生成卡密批次。'
  } finally {
    batchCreating.value = false
  }
}

async function copyCodes() {
  await navigator.clipboard.writeText(generatedCodes.value.join('\n'))
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1600)
}

function downloadCodes() {
  const csv = ['card_code', ...generatedCodes.value].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `ihuachuang-card-keys-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function saveSettings() {
  settingsError.value = ''
  settingsSaving.value = true
  try {
    await apiRequest('/api/admin/settings/pricing', {
      method: 'PUT',
      body: JSON.stringify(settingsForm.pricing),
    })
    await apiRequest('/api/admin/settings/retention', {
      method: 'PUT',
      body: JSON.stringify({ days: Number(settingsForm.retentionDays) }),
    })
    await apiRequest('/api/admin/settings/purchase-link', {
      method: 'PUT',
      body: JSON.stringify({ url: settingsForm.purchaseLink }),
    })
    await queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
    notifications.push('系统设置已保存。', 'success')
  } catch (error) {
    settingsError.value = error instanceof APIError ? error.message : '暂时无法保存系统设置。'
  } finally {
    settingsSaving.value = false
  }
}

async function saveProvider() {
  providerError.value = ''
  providerTestMessage.value = ''
  if ((providerForm.apiKey || providerForm.clearApiKey) && !providerForm.confirmApiKeyChange) {
    providerError.value = '修改 API Key 前请勾选二次确认。'
    return
  }
  providerSaving.value = true
  try {
    await apiRequest('/api/admin/settings/provider', {
      method: 'PUT',
      body: JSON.stringify({
        baseURL: providerForm.baseURL,
        apiKey: providerForm.apiKey,
        clearApiKey: providerForm.clearApiKey,
        model: providerForm.model,
        timeoutMs: Number(providerForm.timeoutMs),
        supportsEdit: providerForm.supportsEdit,
        enabled: providerForm.enabled,
        confirmApiKeyChange: providerForm.confirmApiKeyChange,
      }),
    })
    providerForm.apiKey = ''
    providerForm.clearApiKey = false
    providerForm.confirmApiKeyChange = false
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-provider'] }),
      queryClient.invalidateQueries({ queryKey: ['public-settings'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] }),
    ])
    notifications.push('中转站设置已保存。', 'success')
  } catch (error) {
    providerError.value = error instanceof APIError ? error.message : '中转站设置暂时无法保存。'
  } finally {
    providerSaving.value = false
  }
}

async function testProvider() {
  providerError.value = ''
  providerTestMessage.value = ''
  providerTesting.value = true
  try {
    const result = await apiRequest<{ reachable: boolean; modelAvailable: boolean }>(
      '/api/admin/settings/provider/test',
      {
        method: 'POST',
        body: JSON.stringify({
          baseURL: providerForm.baseURL,
          apiKey: providerForm.apiKey,
        }),
      },
    )
    providerTestMessage.value = result.modelAvailable
      ? '连接正常，已检测到 gpt-image-2。'
      : '连接正常，但模型列表中没有检测到 gpt-image-2。'
  } catch (error) {
    providerError.value = error instanceof APIError ? error.message : '中转站连接测试失败。'
  } finally {
    providerTesting.value = false
  }
}

function openAdjustment(user: User) {
  adjustUser.value = user
  adjustment.delta = 0
  adjustment.reason = ''
  adjustmentError.value = ''
}

async function submitAdjustment() {
  if (!adjustUser.value) {
    return
  }
  adjustmentError.value = ''
  if (!adjustment.delta || !adjustment.reason.trim()) {
    adjustmentError.value = '请输入非零积分变化和调整原因。'
    return
  }
  adjusting.value = true
  try {
    await apiRequest(`/api/admin/users/${adjustUser.value.id}/credit-adjustments`, {
      method: 'POST',
      body: JSON.stringify({
        delta: Number(adjustment.delta),
        reason: adjustment.reason,
      }),
    })
    adjustUser.value = null
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] }),
    ])
    notifications.push('积分调整已记录。', 'success')
  } catch (error) {
    adjustmentError.value = error instanceof APIError ? error.message : '暂时无法调整积分。'
  } finally {
    adjusting.value = false
  }
}

async function toggleUserStatus(user: User) {
  const nextStatus = user.status === 'active' ? 'disabled' : 'active'
  try {
    await apiRequest(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    })
    await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    notifications.push(nextStatus === 'active' ? '账户已启用。' : '账户已停用。', 'success')
  } catch (error) {
    notifications.push(
      error instanceof APIError ? error.message : '账户状态暂时无法更新。',
      'warning',
    )
  }
}

async function createResetPasswordToken(user: User) {
  resetTokenUser.value = user
  resetToken.value = ''
  resetTokenCreating.value = true
  try {
    const response = await apiRequest<{ token: string; expiresAt: string }>(
      `/api/admin/users/${user.id}/password-reset-tokens`,
      { method: 'POST' },
    )
    resetToken.value = response.token
  } catch (error) {
    notifications.push(
      error instanceof APIError ? error.message : '重置口令暂时无法生成。',
      'warning',
    )
    resetTokenUser.value = null
  } finally {
    resetTokenCreating.value = false
  }
}

async function copyResetToken() {
  if (!resetToken.value) return
  await navigator.clipboard.writeText(resetToken.value)
  notifications.push('重置口令已复制。', 'success')
}

function formatDate(value: string | null) {
  if (!value) {
    return '永久有效'
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function auditLabel(action: string) {
  const labels: Record<string, string> = {
    provider_updated: '更新中转站',
    provider_tested: '测试中转站',
    card_batch_created: '创建卡密批次',
    card_revoked: '作废卡密',
    pricing_updated: '更新价格',
    retention_updated: '更新保留期',
    purchase_link_updated: '更新购买链接',
    credit_adjustment: '调整积分',
    user_status_updated: '更新账户状态',
    password_reset_token_created: '生成重置口令',
  }
  return labels[action] || action
}
</script>

<template>
  <div class="page-frame admin-page">
    <header class="page-heading">
      <div>
        <span class="page-kicker">ADMIN / CONTROL ROOM</span>
        <h1>管理后台</h1>
        <p>管理用户额度、卡密批次、积分价格与系统保留期。所有管理员动作都会写入审计日志。</p>
      </div>
      <span class="admin-identity">
        <ShieldCheck :size="15" aria-hidden="true" />
        {{ auth.user?.username }}
      </span>
    </header>

    <div class="admin-shell">
      <nav class="admin-tabs" aria-label="管理后台分区">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          type="button"
          :class="{ 'is-active': activeTab === tab.value }"
          @click="activeTab = tab.value"
        >
          <component :is="tab.icon" :size="16" aria-hidden="true" />
          {{ tab.label }}
        </button>
      </nav>

      <section v-if="activeTab === 'overview'" class="admin-content">
        <div v-if="overviewLoading" class="state-block">
          <LoaderCircle class="spin" :size="21" aria-hidden="true" />
          正在读取站点概览
        </div>
        <template v-else>
          <div class="stats-grid">
            <article v-for="stat in statCards" :key="stat.label" class="stat-card">
              <div>
                <span>{{ stat.label }}</span>
                <component :is="stat.icon" :size="18" aria-hidden="true" />
              </div>
              <strong>{{ stat.value }}</strong>
              <small>{{ stat.note }}</small>
            </article>
          </div>

          <div class="overview-grid">
            <article class="admin-panel provider-summary">
              <div class="section-heading">
                <div>
                  <ServerCog :size="18" aria-hidden="true" />
                  <h2>生成服务</h2>
                </div>
                <span :class="{ 'is-ready': provider?.configured && provider?.enabled }">
                  {{ provider?.configured && provider?.enabled ? '已配置' : '未接通' }}
                </span>
              </div>
              <dl>
                <div>
                  <dt>模型</dt>
                  <dd>{{ provider?.model || 'gpt-image-2' }}</dd>
                </div>
                <div>
                  <dt>Base URL</dt>
                  <dd>{{ provider?.baseURL || '等待阶段 B 配置' }}</dd>
                </div>
                <div>
                  <dt>编辑能力</dt>
                  <dd>{{ provider?.supportsEdit ? '支持' : '未探测' }}</dd>
                </div>
              </dl>
            </article>

            <article class="admin-panel next-phase">
              <span class="card-index">OPERATIONS</span>
              <h2>运行质量</h2>
              <div class="ops-metrics">
                <div>
                  <span>成功率</span>
                  <strong>{{ (overview?.successRate ?? 0).toFixed(1) }}%</strong>
                </div>
                <div>
                  <span>平均耗时</span>
                  <strong>{{ Math.round((overview?.averageDurationMs ?? 0) / 1000) }}s</strong>
                </div>
                <div>
                  <span>失败任务</span>
                  <strong>{{ overview?.failedGenerations ?? 0 }}</strong>
                </div>
              </div>
              <div class="media-usage">
                <span>
                  <span>媒体空间</span>
                  <strong>{{ formatBytes(overview?.mediaUsedBytes ?? 0) }} / {{ formatBytes(overview?.mediaMaxBytes ?? 0) }}</strong>
                </span>
                <span class="media-meter"><i :style="{ width: `${Math.min(100, overview?.mediaUsedPercent ?? 0)}%` }" /></span>
                <small>{{ overview?.mediaAccepting ? '接受新任务' : '容量告警，暂停新任务' }}</small>
              </div>
              <div v-if="overview?.failureDistribution?.length" class="failure-list">
                <span v-for="item in overview.failureDistribution.slice(0, 3)" :key="item.code">
                  {{ item.code }} · {{ item.count }}
                </span>
              </div>
            </article>
          </div>
        </template>
      </section>

      <section v-else-if="activeTab === 'users'" class="admin-content">
        <article class="admin-panel">
          <div class="panel-heading">
            <div>
              <Users :size="19" aria-hidden="true" />
              <h2>用户与额度</h2>
            </div>
            <span>{{ usersData?.users.length ?? 0 }} 个账户</span>
          </div>
          <div v-if="usersLoading" class="state-block">
            <LoaderCircle class="spin" :size="20" aria-hidden="true" />
            正在读取用户
          </div>
          <div v-else class="admin-table">
            <div class="admin-table__head">
              <span>用户</span>
              <span>角色</span>
              <span>状态</span>
              <span>积分</span>
              <span>注册时间</span>
              <span />
            </div>
            <div v-for="user in usersData?.users" :key="user.id" class="admin-table__row">
              <span class="user-cell">
                <i>{{ user.username.slice(0, 1) }}</i>
                <span>
                  <strong>{{ user.username }}</strong>
                  <small>{{ user.email }}</small>
                </span>
              </span>
              <span>{{ user.role === 'admin' ? '管理员' : '用户' }}</span>
              <span class="status-text" :class="{ 'is-disabled': user.status === 'disabled' }">
                <i />
                {{ user.status === 'active' ? '正常' : '已停用' }}
              </span>
              <strong class="credit-number">{{ user.creditBalance }}</strong>
              <span>{{ formatDate(user.createdAt) }}</span>
              <span class="user-actions">
                <button type="button" class="text-button" @click="openAdjustment(user)">积分</button>
                <button type="button" class="text-button" @click="toggleUserStatus(user)">
                  {{ user.status === 'active' ? '停用' : '启用' }}
                </button>
                <button type="button" class="text-button" @click="createResetPasswordToken(user)">
                  重置口令
                </button>
              </span>
            </div>
          </div>
        </article>
      </section>

      <section v-else-if="activeTab === 'cards'" class="admin-content cards-layout">
        <article class="admin-panel">
          <div class="panel-heading">
            <div>
              <Ticket :size="19" aria-hidden="true" />
              <h2>创建卡密批次</h2>
            </div>
            <span>完整卡密只显示一次</span>
          </div>
          <form class="batch-form" @submit.prevent="createBatch">
            <label class="field field--full">
              <span>批次名称</span>
              <input v-model="batchForm.name" maxlength="80" placeholder="例如：十月体验批次" />
            </label>
            <label class="field">
              <span>每张积分</span>
              <input v-model.number="batchForm.creditsPerKey" type="number" min="1" max="100000" />
            </label>
            <label class="field">
              <span>生成数量</span>
              <input v-model.number="batchForm.quantity" type="number" min="1" max="5000" />
            </label>
            <label class="field field--full">
              <span>有效期（可选）</span>
              <input v-model="batchForm.expiresAt" type="datetime-local" />
            </label>
            <div v-if="batchError" class="inline-alert inline-alert--error" role="alert">
              {{ batchError }}
            </div>
            <button class="button button--primary" type="submit" :disabled="batchCreating">
              <LoaderCircle v-if="batchCreating" class="spin" :size="16" aria-hidden="true" />
              <Ticket v-else :size="16" aria-hidden="true" />
              {{ batchCreating ? '正在生成' : '生成卡密批次' }}
            </button>
          </form>
        </article>

        <article class="admin-panel">
          <div class="panel-heading">
            <div>
              <Clipboard :size="19" aria-hidden="true" />
              <h2>本次生成结果</h2>
            </div>
            <span v-if="generatedCodes.length" class="code-actions">
              <button
                type="button"
                class="button button--secondary button--small"
                @click="copyCodes"
              >
                <Check v-if="copied" :size="15" aria-hidden="true" />
                <Clipboard v-else :size="15" aria-hidden="true" />
                {{ copied ? '已复制' : '复制全部' }}
              </button>
              <button
                type="button"
                class="button button--secondary button--small"
                @click="downloadCodes"
              >
                <Download :size="15" aria-hidden="true" />
                导出 CSV
              </button>
            </span>
          </div>
          <pre v-if="generatedCodes.length" class="code-output">{{ generatedCodes.join('\n') }}</pre>
          <div v-else class="mini-empty">
            <KeyRound :size="24" :stroke-width="1.4" aria-hidden="true" />
            <span>创建批次后，卡密会显示在这里。</span>
          </div>
        </article>

        <article class="admin-panel batches-panel">
          <div class="panel-heading">
            <div>
              <CreditCard :size="19" aria-hidden="true" />
              <h2>最近批次</h2>
            </div>
            <span>{{ batchesData?.batches.length ?? 0 }} 个批次</span>
          </div>
          <div class="batch-list">
            <div v-for="batch in batchesData?.batches" :key="batch.id" class="batch-row">
              <div>
                <strong>{{ batch.name }}</strong>
                <span>创建于 {{ formatDate(batch.createdAt) }}</span>
              </div>
              <span>{{ batch.creditsPerKey }} 积分 × {{ batch.quantity }}</span>
              <span>{{ batch.redeemed }} / {{ batch.quantity }} 已兑换</span>
              <span>{{ formatDate(batch.expiresAt) }}</span>
            </div>
            <div v-if="!batchesData?.batches.length" class="mini-empty">
              <span>还没有卡密批次。</span>
            </div>
          </div>
        </article>
      </section>

      <section v-else-if="activeTab === 'settings'" class="admin-content settings-layout">
        <article class="admin-panel">
          <div class="panel-heading">
            <div>
              <Settings2 :size="19" aria-hidden="true" />
              <h2>价格与站点设置</h2>
            </div>
            <span>新任务采用新价格</span>
          </div>
          <form class="settings-form" @submit.prevent="saveSettings">
            <div class="price-grid">
              <label class="field">
                <span>1K 档</span>
                <input v-model.number="settingsForm.pricing['1K']" type="number" min="1" />
              </label>
              <label class="field">
                <span>2K 档</span>
                <input v-model.number="settingsForm.pricing['2K']" type="number" min="1" />
              </label>
            </div>
            <div class="field-grid">
              <label class="field">
                <span>媒体保留期</span>
                <select v-model.number="settingsForm.retentionDays">
                  <option v-for="day in 7" :key="day" :value="day">{{ day }} 天</option>
                </select>
              </label>
              <label class="field">
                <span>卡密购买链接</span>
                <input v-model="settingsForm.purchaseLink" type="url" />
              </label>
            </div>
            <div v-if="settingsError" class="inline-alert inline-alert--error" role="alert">
              {{ settingsError }}
            </div>
            <button class="button button--primary" type="submit" :disabled="settingsSaving">
              <LoaderCircle v-if="settingsSaving" class="spin" :size="16" aria-hidden="true" />
              <Save v-else :size="16" aria-hidden="true" />
              {{ settingsSaving ? '正在保存' : '保存系统设置' }}
            </button>
          </form>
        </article>

        <article class="admin-panel provider-card">
          <div class="panel-heading">
            <div>
              <ServerCog :size="19" aria-hidden="true" />
              <h2>第三方图像服务</h2>
            </div>
            <span :class="{ 'provider-ready': provider?.configured && provider?.enabled }">
              {{ provider?.configured && provider?.enabled ? '已启用' : provider?.configured ? '已保存，未启用' : '等待配置' }}
            </span>
          </div>
          <form class="provider-fields" @submit.prevent="saveProvider">
            <label class="field">
              <span>Base URL</span>
              <input v-model="providerForm.baseURL" type="url" placeholder="https://relay.example.com/v1" />
            </label>
            <label class="field">
              <span>API Key</span>
              <input
                v-model="providerForm.apiKey"
                type="password"
                autocomplete="new-password"
                :placeholder="provider?.configured ? '已保存密钥，输入新值即可替换' : '输入 API Key'"
              />
            </label>
            <div class="provider-grid">
              <label class="field">
                <span>模型</span>
                <input v-model="providerForm.model" value="gpt-image-2" readonly />
              </label>
              <label class="field">
                <span>超时（毫秒，建议 300000）</span>
                <input v-model.number="providerForm.timeoutMs" type="number" min="120000" max="900000" />
              </label>
            </div>
            <div class="provider-toggles">
              <label>
                <input v-model="providerForm.supportsEdit" type="checkbox" />
                <span>支持图生图编辑端点</span>
              </label>
              <label>
                <input v-model="providerForm.enabled" type="checkbox" />
                <span>启用生图服务</span>
              </label>
              <label v-if="providerForm.apiKey || providerForm.clearApiKey">
                <input v-model="providerForm.confirmApiKeyChange" type="checkbox" />
                <span>确认修改服务端加密密钥</span>
              </label>
              <label v-if="provider?.configured">
                <input v-model="providerForm.clearApiKey" type="checkbox" />
                <span>清除已保存的 API Key</span>
              </label>
            </div>
            <div v-if="providerError" class="inline-alert inline-alert--error" role="alert">
              {{ providerError }}
            </div>
            <div v-if="providerTestMessage" class="inline-alert inline-alert--success" role="status">
              {{ providerTestMessage }}
            </div>
            <div class="provider-actions">
              <button class="button button--secondary" type="button" :disabled="providerTesting" @click="testProvider">
                <LoaderCircle v-if="providerTesting" class="spin" :size="16" aria-hidden="true" />
                <ServerCog v-else :size="16" aria-hidden="true" />
                {{ providerTesting ? '正在测试' : '测试连接' }}
              </button>
              <button class="button button--primary" type="submit" :disabled="providerSaving">
                <LoaderCircle v-if="providerSaving" class="spin" :size="16" aria-hidden="true" />
                <Save v-else :size="16" aria-hidden="true" />
                {{ providerSaving ? '正在保存' : '保存中转站' }}
              </button>
            </div>
          </form>
          <p class="settings-note">
            API Key 只在服务端以 AES-GCM 加密保存。连接测试仅读取模型列表，不产生计费图片。
          </p>
        </article>
      </section>

      <section v-else class="admin-content">
        <article class="admin-panel">
          <div class="panel-heading">
            <div>
              <ScrollText :size="19" aria-hidden="true" />
              <h2>管理员审计日志</h2>
            </div>
            <span>最近 80 条</span>
          </div>
          <div v-if="auditLoading" class="state-block">
            <LoaderCircle class="spin" :size="20" aria-hidden="true" />
            正在读取审计日志
          </div>
          <div v-else-if="auditData?.logs.length" class="audit-list">
            <div v-for="entry in auditData.logs" :key="entry.id" class="audit-row">
              <span class="audit-icon">
                <ShieldCheck :size="15" aria-hidden="true" />
              </span>
              <div>
                <strong>{{ auditLabel(entry.action) }}</strong>
                <span>{{ entry.adminUsername || '管理员' }} · {{ entry.targetType }} {{ entry.targetId }}</span>
              </div>
              <code>{{ entry.detailJson || '—' }}</code>
              <span>{{ formatDate(entry.createdAt) }}</span>
            </div>
          </div>
          <div v-else class="mini-empty">
            <span>还没有管理员动作记录。</span>
          </div>
        </article>
      </section>
    </div>

    <div v-if="adjustUser" class="modal-backdrop" @click.self="adjustUser = null">
      <section class="adjust-modal" role="dialog" aria-modal="true" aria-labelledby="adjust-title">
        <div class="panel-heading">
          <div>
            <Coins :size="19" aria-hidden="true" />
            <h2 id="adjust-title">调整 {{ adjustUser.username }} 的积分</h2>
          </div>
          <button type="button" class="icon-button" aria-label="关闭" @click="adjustUser = null">
            <X :size="18" aria-hidden="true" />
          </button>
        </div>
        <form class="adjust-form" @submit.prevent="submitAdjustment">
          <label class="field">
            <span>积分变化</span>
            <input v-model.number="adjustment.delta" type="number" placeholder="增加填正数，扣减填负数" />
          </label>
          <label class="field">
            <span>调整原因</span>
            <input v-model="adjustment.reason" maxlength="200" placeholder="用于审计记录" />
          </label>
          <p>当前余额 {{ adjustUser.creditBalance }}，调整后不可低于 0。</p>
          <div v-if="adjustmentError" class="inline-alert inline-alert--error" role="alert">
            {{ adjustmentError }}
          </div>
          <button class="button button--primary" type="submit" :disabled="adjusting">
            {{ adjusting ? '正在保存' : '确认调整' }}
          </button>
        </form>
      </section>
    </div>

    <div v-if="resetTokenUser" class="modal-backdrop" @click.self="resetTokenUser = null">
      <section class="adjust-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title">
        <div class="panel-heading">
          <div>
            <KeyRound :size="19" aria-hidden="true" />
            <h2 id="reset-title">{{ resetTokenCreating ? '正在生成重置口令' : '一次性密码重置口令' }}</h2>
          </div>
          <button type="button" class="icon-button" aria-label="关闭" @click="resetTokenUser = null">
            <X :size="18" aria-hidden="true" />
          </button>
        </div>
        <p class="reset-token-copy">
          将下面的口令交给 {{ resetTokenUser.username }}。口令仅显示一次，有效期 30 分钟。
        </p>
        <code v-if="resetToken" class="reset-token-value">{{ resetToken }}</code>
        <div class="reset-token-actions">
          <button type="button" class="button button--secondary" @click="copyResetToken" :disabled="!resetToken">
            <Clipboard :size="16" aria-hidden="true" />
            复制口令
          </button>
          <a class="button button--primary" :href="`/reset-password?token=${encodeURIComponent(resetToken)}`">
            打开重置页
          </a>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  display: grid;
  gap: 10px;
}

.admin-identity {
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

.admin-shell {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  align-items: start;
  gap: 10px;
}

.admin-tabs {
  position: sticky;
  top: 78px;
  display: grid;
  gap: 3px;
  padding: 5px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
}

.admin-tabs button {
  display: flex;
  min-height: 42px;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 11px;
  text-align: left;
}

.admin-tabs button:hover,
.admin-tabs button.is-active {
  border-color: var(--line);
  background: var(--surface-muted);
  color: var(--ink);
}

.admin-content {
  display: grid;
  min-width: 0;
  gap: 10px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.stat-card,
.admin-panel {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
}

.stat-card {
  display: grid;
  min-height: 144px;
  gap: 7px;
  padding: 16px;
}

.stat-card > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--muted);
  font-size: 10px;
}

.stat-card strong {
  align-self: end;
  color: var(--ink);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 30px;
  font-weight: 500;
}

.stat-card small {
  color: var(--muted);
  font-size: 9px;
}

.overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
  gap: 10px;
}

.admin-panel {
  min-width: 0;
  padding: 18px;
}

.provider-summary .section-heading > span {
  color: var(--warning);
  font-size: 10px;
}

.provider-summary .section-heading > span.is-ready {
  color: var(--success);
}

.provider-summary dl {
  display: grid;
  gap: 1px;
  margin: 18px 0 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--line);
}

.provider-summary dl div {
  display: grid;
  min-height: 42px;
  grid-template-columns: 100px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 0 11px;
  background: var(--surface-muted);
}

.provider-summary dt {
  color: var(--muted);
  font-size: 9px;
}

.provider-summary dd {
  overflow: hidden;
  margin: 0;
  color: var(--ink);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.next-phase {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.next-phase h2 {
  margin: 10px 0 8px;
  color: var(--ink);
  font-family: 'Bricolage Grotesque', 'Noto Sans SC', sans-serif;
  font-size: 25px;
  font-weight: 560;
}

.ops-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 16px;
}

.ops-metrics > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-muted);
}

.ops-metrics span,
.media-usage span,
.media-usage small {
  color: var(--muted);
  font-size: 8px;
}

.ops-metrics strong {
  color: var(--ink);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 16px;
  font-weight: 500;
}

.media-usage {
  display: grid;
  gap: 7px;
  margin-top: 10px;
}

.media-usage > span:first-child {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.media-usage strong {
  color: var(--ink);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  font-weight: 500;
}

.media-meter {
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--line);
}

.media-meter i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--action);
}

.failure-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 10px;
}

.failure-list span {
  padding: 4px 6px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 7px;
}

.panel-heading,
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-heading > div,
.section-heading > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-heading h2,
.section-heading h2 {
  margin: 0;
  color: var(--ink);
  font-size: 14px;
  font-weight: 600;
}

.panel-heading > span,
.section-heading > span {
  color: var(--muted);
  font-size: 9px;
}

.admin-table {
  margin-top: 16px;
  overflow-x: auto;
}

.admin-table__head,
.admin-table__row {
  display: grid;
  min-width: 780px;
  grid-template-columns: minmax(210px, 1.4fr) 72px 76px 72px 100px 156px;
  align-items: center;
  gap: 12px;
}

.admin-table__head {
  min-height: 34px;
  padding: 0 10px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  font-size: 9px;
}

.admin-table__row {
  min-height: 62px;
  padding: 0 10px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  font-size: 10px;
}

.user-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
}

.user-cell > i {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--surface-muted);
  color: var(--ink);
  font-style: normal;
}

.user-cell > span {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.user-cell strong {
  overflow: hidden;
  color: var(--ink);
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-cell small {
  overflow: hidden;
  color: var(--muted);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-text {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.status-text i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
}

.status-text.is-disabled {
  color: var(--warning);
}

.status-text.is-disabled i {
  background: var(--warning);
}

.user-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 9px;
}

.credit-number {
  color: var(--ink);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px;
  font-weight: 500;
}

.cards-layout {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.batches-panel {
  grid-column: 1 / -1;
}

.batch-form,
.settings-form,
.adjust-form {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.batch-form {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field--full,
.batch-form .inline-alert,
.batch-form .button,
.settings-form .inline-alert,
.settings-form > .button {
  grid-column: 1 / -1;
}

.code-output {
  max-height: 360px;
  margin: 16px 0 0;
  overflow: auto;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-muted);
  color: var(--ink);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  line-height: 1.9;
  white-space: pre;
}

.code-actions {
  display: flex;
  gap: 5px;
}

.mini-empty {
  display: flex;
  min-height: 150px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: var(--muted);
  font-size: 10px;
}

.batch-list {
  margin-top: 16px;
}

.batch-row {
  display: grid;
  min-height: 60px;
  grid-template-columns: minmax(180px, 1.4fr) minmax(120px, 0.8fr) minmax(110px, 0.7fr) minmax(110px, 0.7fr);
  align-items: center;
  gap: 14px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 10px;
}

.batch-row > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.batch-row strong {
  color: var(--ink);
  font-size: 11px;
  font-weight: 500;
}

.batch-row div span {
  font-size: 9px;
}

.settings-layout {
  grid-template-columns: minmax(0, 1.1fr) minmax(300px, 0.9fr);
}

.price-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.provider-fields {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.provider-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.provider-card .panel-heading > span.provider-ready {
  color: var(--success);
}

.provider-toggles {
  display: grid;
  gap: 7px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-muted);
}

.provider-toggles label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 9px;
  line-height: 1.5;
}

.provider-toggles input {
  width: 15px;
  height: 15px;
  accent-color: var(--action);
}

.provider-actions {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
}

.inline-alert--success {
  border-color: color-mix(in srgb, var(--success) 36%, var(--line));
  background: color-mix(in srgb, var(--success) 7%, var(--surface));
  color: var(--success);
}

.settings-note {
  margin: 14px 0 0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.7;
}

.state-block {
  display: flex;
  min-height: 180px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: var(--muted);
  font-size: 11px;
}

.spin {
  animation: spin 800ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.modal-backdrop {
  position: fixed;
  z-index: 90;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgb(4 7 6 / 64%);
  backdrop-filter: blur(4px);
}

.adjust-modal {
  width: min(440px, 100%);
  padding: 18px;
  border: 1px solid var(--line-strong);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 28px 80px rgb(0 0 0 / 32%);
}

.adjust-form p {
  margin: 0;
  color: var(--muted);
  font-size: 10px;
}

.reset-token-copy {
  margin: 16px 0 10px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.7;
}

.reset-token-value {
  display: block;
  padding: 12px;
  overflow-wrap: anywhere;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-muted);
  color: var(--ink);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  line-height: 1.7;
}

.reset-token-actions {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
  margin-top: 14px;
}

.audit-list {
  display: grid;
  margin-top: 16px;
}

.audit-row {
  display: grid;
  min-height: 62px;
  grid-template-columns: auto minmax(170px, 0.9fr) minmax(220px, 1.3fr) 110px;
  align-items: center;
  gap: 12px;
  padding: 8px 4px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 9px;
}

.audit-icon {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-muted);
  color: var(--action);
}

.audit-row > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.audit-row strong {
  color: var(--ink);
  font-size: 11px;
  font-weight: 500;
}

.audit-row code {
  overflow: hidden;
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1080px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .cards-layout,
  .settings-layout {
    grid-template-columns: 1fr;
  }

  .batches-panel {
    grid-column: auto;
  }
}

@media (max-width: 820px) {
  .admin-shell {
    grid-template-columns: 1fr;
  }

  .admin-tabs {
    position: static;
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .admin-tabs button {
    justify-content: center;
    padding: 0 6px;
  }

  .overview-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stat-card {
    min-height: 122px;
  }

  .admin-panel {
    padding: 14px;
  }

  .admin-tabs button {
    min-height: 48px;
    flex-direction: column;
    gap: 4px;
    font-size: 9px;
  }

  .batch-form,
  .price-grid,
  .provider-grid {
    grid-template-columns: 1fr;
  }

  .provider-actions {
    flex-direction: column;
  }

  .reset-token-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .audit-row {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .audit-row code {
    display: none;
  }

  .provider-actions .button {
    width: 100%;
  }

  .batch-row {
    grid-template-columns: 1fr;
    gap: 5px;
    padding: 12px 0;
  }
}
</style>
