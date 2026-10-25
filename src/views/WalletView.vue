<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  ArrowUpRight,
  BadgeCheck,
  CircleDollarSign,
  Clock3,
  Coins,
  CreditCard,
  LoaderCircle,
  ShieldCheck,
  TicketCheck,
} from 'lucide-vue-next'
import { APIError, apiRequest, type LedgerEntry } from '../api/client'
import { usePublicSettings } from '../composables/usePublicSettings'
import { useAuthStore } from '../stores/auth'
import { useNotificationsStore } from '../stores/notifications'

interface WalletResponse {
  balance: number
  reservedCredits: number
  availableCredits: number
  ledger: LedgerEntry[]
}

const auth = useAuthStore()
const notifications = useNotificationsStore()
const queryClient = useQueryClient()
const { data: settings } = usePublicSettings()
const { data: wallet, isLoading, isError, refetch } = useQuery({
  queryKey: ['wallet'],
  queryFn: () => apiRequest<WalletResponse>('/api/wallet'),
})
const code = ref('')
const redeemError = ref('')
const redeeming = ref(false)

const balance = computed(() => wallet.value?.availableCredits ?? auth.user?.availableCredits ?? 0)
const reserved = computed(() => wallet.value?.reservedCredits ?? auth.user?.reservedCredits ?? 0)

async function redeem() {
  redeemError.value = ''
  if (!code.value.trim()) {
    redeemError.value = '请输入卡密。'
    return
  }
  redeeming.value = true
  try {
    const response = await apiRequest<{ balance: number; message: string }>('/api/wallet/redeem', {
      method: 'POST',
      body: JSON.stringify({ code: code.value }),
    })
    code.value = ''
    auth.updateCredits(
      Math.max(0, response.balance - (auth.user?.reservedCredits ?? 0)),
      auth.user?.reservedCredits ?? 0,
    )
    await queryClient.invalidateQueries({ queryKey: ['wallet'] })
    notifications.push(response.message, 'success')
  } catch (error) {
    redeemError.value = error instanceof APIError ? error.message : '暂时无法完成兑换。'
  } finally {
    redeeming.value = false
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function ledgerLabel(reason: string) {
  const labels: Record<string, string> = {
    card_redeem: '卡密兑换',
    admin_adjustment: '管理员调整',
    generation_charge: '生成扣费',
    generation_refund: '生成退款',
  }
  return labels[reason] || reason
}
</script>

<template>
  <div class="page-frame wallet-page">
    <header class="page-heading">
      <div>
        <span class="page-kicker">积分与卡密</span>
        <h1>积分与卡密</h1>
        <p>卡密在站外购买，回到这里兑换。每次生成按成功图片逐张结算。</p>
      </div>
      <a v-if="settings" class="button button--secondary" :href="settings.purchaseLink" target="_blank" rel="noopener noreferrer">
        <CreditCard :size="17" aria-hidden="true" />
        前往购买
        <ArrowUpRight :size="15" aria-hidden="true" />
      </a>
    </header>

    <div class="wallet-grid">
      <section class="balance-card">
        <div class="balance-card__top">
          <span class="card-index">可用积分</span>
          <BadgeCheck :size="20" aria-hidden="true" />
        </div>
        <div class="balance-value">
          <strong>{{ balance }}</strong>
          <span>可用积分</span>
        </div>
        <div v-if="reserved" class="reserved-note">
          另有 {{ reserved }} 积分正在为运行中的任务冻结
        </div>
        <div class="balance-note">
          <ShieldCheck :size="16" aria-hidden="true" />
          <span>余额变更均记录在不可覆盖的积分流水中。</span>
        </div>
      </section>

      <section class="redeem-card">
        <div class="section-heading">
          <div>
            <TicketCheck :size="19" aria-hidden="true" />
            <h2>兑换卡密</h2>
          </div>
          <span>仅可使用一次</span>
        </div>
        <form class="redeem-form" @submit.prevent="redeem">
          <label class="field">
            <span>卡密</span>
            <input
              v-model="code"
              type="text"
              autocomplete="off"
              spellcheck="false"
              placeholder="LT-XXXX-XXXX-XXXX-XXXX"
              :aria-invalid="Boolean(redeemError)"
            />
            <small v-if="redeemError" class="field-error" role="alert">{{ redeemError }}</small>
          </label>
          <button class="button button--primary" type="submit" :disabled="redeeming">
            <LoaderCircle v-if="redeeming" class="spin" :size="17" aria-hidden="true" />
            <CircleDollarSign v-else :size="17" aria-hidden="true" />
            {{ redeeming ? '正在兑换' : '兑换到账户' }}
          </button>
        </form>
        <div class="purchase-note">
          <span>购买后将卡密带回本站兑换</span>
          <a
            v-if="settings"
            :href="settings.purchaseLink"
            target="_blank"
            rel="noopener noreferrer"
          >
            打开站外购买页
            <ArrowUpRight :size="14" aria-hidden="true" />
          </a>
        </div>
      </section>
    </div>

    <section class="ledger-card">
      <div class="section-heading ledger-heading">
        <div>
          <Coins :size="19" aria-hidden="true" />
          <h2>积分流水</h2>
        </div>
        <span>最近 30 条</span>
      </div>

      <div v-if="isLoading" class="state-block">
        <LoaderCircle class="spin" :size="22" aria-hidden="true" />
        <span>正在读取积分流水</span>
      </div>
      <div v-else-if="isError" class="state-block">
        <span>积分流水暂时无法读取。</span>
        <button type="button" class="text-button" @click="() => refetch()">重试</button>
      </div>
      <div v-else-if="!wallet?.ledger.length" class="state-block state-block--empty">
        <Clock3 :size="24" :stroke-width="1.5" aria-hidden="true" />
        <strong>还没有积分变化</strong>
        <span>兑换第一张卡密后，余额变化会显示在这里。</span>
      </div>
      <div v-else class="ledger-list">
        <div v-for="entry in wallet.ledger" :key="entry.id" class="ledger-row">
          <span class="ledger-icon" :class="{ 'is-negative': entry.delta < 0 }">
            <Coins :size="15" aria-hidden="true" />
          </span>
          <div>
            <strong>{{ ledgerLabel(entry.reason) }}</strong>
            <span>{{ formatDate(entry.createdAt) }}</span>
          </div>
          <span class="ledger-delta" :class="{ 'is-negative': entry.delta < 0 }">
            {{ entry.delta > 0 ? '+' : '' }}{{ entry.delta }}
          </span>
          <span class="ledger-balance">余额 {{ entry.balanceAfter }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.wallet-page {
  display: grid;
  gap: 10px;
}

.wallet-grid {
  display: grid;
  grid-template-columns: minmax(280px, 0.72fr) minmax(0, 1.28fr);
  gap: 10px;
}

.balance-card,
.redeem-card,
.ledger-card {
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
}

.balance-card {
  display: flex;
  min-height: 236px;
  flex-direction: column;
  justify-content: space-between;
  padding: 18px;
  background: var(--surface-muted);
}

.balance-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--action);
}

.balance-value {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.balance-value strong {
  color: var(--ink);
  font-family: var(--font-display);
  font-size: clamp(58px, 7vw, 92px);
  font-weight: 550;
  line-height: 0.9;
}

.balance-value span {
  color: var(--muted);
  font-size: 11px;
}

.reserved-note {
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--warning) 30%, var(--line));
  border-radius: var(--radius-control-sm);
  background: color-mix(in srgb, var(--warning) 5%, var(--surface-muted));
  color: var(--warning);
  font-size: 9px;
  line-height: 1.5;
}

.balance-note {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 13px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 10px;
  line-height: 1.5;
}

.redeem-card {
  padding: 18px;
  background: var(--surface);
}

.redeem-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 9px;
  margin-top: 20px;
}

.redeem-form .button {
  min-height: 46px;
  margin-top: 21px;
}

.purchase-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 13px;
  padding-top: 13px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 10px;
}

.purchase-note a {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--action);
  text-decoration: none;
}

.ledger-card {
  overflow: hidden;
}

.ledger-heading {
  min-height: 58px;
  padding: 0 18px;
  border-bottom: 1px solid var(--line);
}

.ledger-list {
  display: grid;
}

.ledger-row {
  display: grid;
  min-height: 64px;
  grid-template-columns: auto minmax(0, 1fr) auto minmax(90px, auto);
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  border-bottom: 1px solid var(--line);
}

.ledger-row:last-child {
  border-bottom: 0;
}

.ledger-icon {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: var(--radius-control);
  background: color-mix(in srgb, var(--success) 12%, var(--surface-muted));
  color: var(--success);
}

.ledger-icon.is-negative {
  background: var(--surface-muted);
  color: var(--muted);
}

.ledger-row > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ledger-row strong {
  font-size: 12px;
  font-weight: 500;
}

.ledger-row div span,
.ledger-balance {
  color: var(--muted);
  font-size: 9px;
}

.ledger-delta {
  color: var(--success);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 13px;
  font-weight: 500;
}

.ledger-delta.is-negative {
  color: var(--warning);
}

.state-block {
  display: flex;
  min-height: 150px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: var(--muted);
  font-size: 12px;
}

.state-block--empty {
  flex-direction: column;
}

.state-block--empty strong {
  color: var(--ink);
  font-weight: 500;
}

.state-block--empty span {
  font-size: 10px;
}

.spin {
  animation: spin 800ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 860px) {
  .wallet-grid {
    grid-template-columns: 1fr;
  }

  .balance-card {
    min-height: 210px;
  }
}

@media (max-width: 560px) {
  .redeem-form {
    grid-template-columns: 1fr;
  }

  .redeem-form .button {
    width: 100%;
    margin-top: 0;
  }

  .purchase-note {
    align-items: flex-start;
    flex-direction: column;
  }

  .ledger-row {
    grid-template-columns: auto minmax(0, 1fr) auto;
    padding: 0 12px;
  }

  .ledger-balance {
    display: none;
  }

  .ledger-heading {
    padding: 0 12px;
  }
}
</style>
