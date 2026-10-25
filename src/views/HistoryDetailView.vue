<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  ArrowLeft,
  CircleAlert,
  Download,
  Heart,
  LoaderCircle,
  RefreshCcw,
  Trash2,
  X,
} from 'lucide-vue-next'
import ProtectedImage from '../components/ProtectedImage.vue'
import {
  APIError,
  apiBlob,
  apiRequest,
  type Generation,
  type GenerationOutput,
} from '../api/client'
import { useNotificationsStore } from '../stores/notifications'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const notifications = useNotificationsStore()
const generationID = computed(() => String(route.params.id))
const selectedAssetID = ref('')
const downloading = ref(false)
const favoriteSaving = ref(false)
const deleteOpen = ref(false)
const deleting = ref(false)

const detailQuery = useQuery({
  queryKey: computed(() => ['generation', generationID.value]),
  queryFn: () => apiRequest<Generation>(`/api/generations/${encodeURIComponent(generationID.value)}`),
  refetchInterval: (query) => {
    const status = query.state.data?.status
    return status && ['preparing', 'queued', 'running'].includes(status) ? 1500 : false
  },
})

const generation = computed(() => detailQuery.data.value ?? null)
const isPending = computed(() => detailQuery.isPending.value)
const isError = computed(() => detailQuery.isError.value)
const selectedOutput = computed<GenerationOutput | null>(() => {
  const current = generation.value
  if (!current) return null
  return current.outputs.find((output) => output.asset?.id === selectedAssetID.value)
    ?? current.outputs.find((output) => output.asset)
    ?? null
})
const statusText = computed(() => {
  const labels: Record<Generation['status'], string> = {
    preparing: '准备中',
    queued: '排队中',
    running: '生成中',
    succeeded: '已完成',
    partially_succeeded: '部分成功',
    failed: '失败',
    canceled: '已取消',
  }
  return generation.value ? labels[generation.value.status] : ''
})
const canDelete = computed(
  () =>
    generation.value
    && ['succeeded', 'partially_succeeded', 'failed', 'canceled'].includes(generation.value.status),
)

async function download() {
  const asset = selectedOutput.value?.asset
  if (!asset || !generation.value) return
  downloading.value = true
  try {
    const blob = await apiBlob(`/api/assets/${encodeURIComponent(asset.id)}/download`)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `ihuachuang-${generation.value.id.slice(0, 8)}-${asset.id.slice(-6)}.png`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    notifications.push('图片暂时无法下载。', 'warning')
  } finally {
    downloading.value = false
  }
}

async function toggleFavorite() {
  const asset = selectedOutput.value?.asset
  if (!asset || !generation.value) return
  favoriteSaving.value = true
  try {
    await apiRequest(`/api/generations/${generation.value.id}/favorite`, {
      method: 'POST',
      body: JSON.stringify({ assetId: asset.id, favorite: !asset.isFavorite }),
    })
    await Promise.all([
      detailQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ['generations'] }),
    ])
  } catch {
    notifications.push('收藏状态暂时无法保存。', 'warning')
  } finally {
    favoriteSaving.value = false
  }
}

async function reuse() {
  if (!generation.value) return
  await router.push({ name: 'studio', query: { reuse: generation.value.id } })
}

async function removeGeneration() {
  if (!generation.value) return
  deleting.value = true
  try {
    await apiRequest(`/api/generations/${generation.value.id}`, { method: 'DELETE' })
    await queryClient.invalidateQueries({ queryKey: ['generations'] })
    await router.replace('/history')
    notifications.push('任务记录已删除。', 'success')
  } catch (error) {
    notifications.push(
      error instanceof APIError ? error.message : '任务记录暂时无法删除。',
      'warning',
    )
  } finally {
    deleting.value = false
  }
}

function selectOutput(output: GenerationOutput) {
  if (output.asset) selectedAssetID.value = output.asset.id
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
</script>

<template>
  <div class="page-frame detail-page">
    <header class="detail-top">
      <RouterLink to="/history" class="back-link">
        <ArrowLeft :size="16" aria-hidden="true" />
        返回历史作品
      </RouterLink>
      <span v-if="generation" class="detail-status" :class="`status-${generation.status}`">
        <i />
        {{ statusText }}
      </span>
    </header>

    <div v-if="isPending" class="detail-state">
      <LoaderCircle class="spin" :size="24" aria-hidden="true" />
      正在读取任务
    </div>
    <div v-else-if="isError || !generation" class="detail-state detail-state--error">
      <CircleAlert :size="28" :stroke-width="1.5" aria-hidden="true" />
      <strong>没有找到这项任务</strong>
      <span>记录可能已过期、被删除，或者不属于当前账户。</span>
      <RouterLink class="button button--secondary" to="/history">返回历史</RouterLink>
    </div>
    <template v-else>
      <div class="detail-heading">
        <div>
          <span class="page-kicker">TASK / {{ generation.id.slice(0, 8) }}</span>
          <h1>{{ generation.prompt }}</h1>
          <p>
            {{ generation.mode === 'edit' ? '图生图' : '文生图' }}
            · {{ generation.settings.resolution || '1K' }}
            · {{ generation.settings.size }}
            · {{ generation.settings.quality }}
            · {{ formatDate(generation.createdAt) }}
          </p>
        </div>
        <div class="detail-score">
          <strong>{{ generation.chargedCredits }}</strong>
          <span>实扣积分</span>
        </div>
      </div>

      <div class="detail-layout">
        <section class="detail-canvas">
          <div class="detail-canvas__head">
            <span>{{ selectedOutput?.asset ? `${selectedOutput.asset.width} × ${selectedOutput.asset.height}` : '图片输出' }}</span>
            <span>{{ generation.outputs.length }} 张 · PNG</span>
          </div>
          <div class="detail-canvas__frame">
            <ProtectedImage
              v-if="selectedOutput?.asset"
              :key="selectedOutput.asset.id"
              :asset-id="selectedOutput.asset.id"
              :alt="generation.prompt"
            />
            <div v-else class="detail-placeholder">
              <LoaderCircle
                v-if="['preparing', 'queued', 'running'].includes(generation.status)"
                class="spin"
                :size="27"
                aria-hidden="true"
              />
              <CircleAlert v-else :size="27" aria-hidden="true" />
              <strong>{{ statusText }}</strong>
              <span>{{ generation.errorMessage || '当前任务没有可预览的结果。' }}</span>
            </div>
          </div>
          <div v-if="generation.outputs.length" class="detail-outputs">
            <button
              v-for="output in generation.outputs"
              :key="output.id"
              type="button"
              :class="{ 'is-selected': selectedOutput?.id === output.id }"
              :disabled="!output.asset"
              @click="selectOutput(output)"
            >
              <ProtectedImage
                v-if="output.asset"
                :asset-id="output.asset.id"
                :alt="`第 ${output.position} 张结果`"
                thumbnail
              />
              <span v-else class="detail-output-state">
                <LoaderCircle v-if="output.status === 'queued' || output.status === 'running'" class="spin" :size="15" aria-hidden="true" />
                <CircleAlert v-else :size="15" aria-hidden="true" />
              </span>
              <small>{{ String(output.position).padStart(2, '0') }}</small>
            </button>
          </div>
        </section>

        <aside class="detail-sidebar">
          <section class="detail-panel">
            <h2>任务状态</h2>
            <dl class="fact-list">
              <div><dt>预计积分</dt><dd>{{ generation.estimatedCredits }}</dd></div>
              <div><dt>实际扣除</dt><dd>{{ generation.chargedCredits }}</dd></div>
              <div><dt>开始时间</dt><dd>{{ formatDate(generation.startedAt) }}</dd></div>
              <div><dt>完成时间</dt><dd>{{ formatDate(generation.completedAt) }}</dd></div>
              <div><dt>保留至</dt><dd>{{ formatDate(generation.expiresAt) }}</dd></div>
            </dl>
          </section>

          <section class="detail-panel">
            <h2>输出明细</h2>
            <div class="output-facts">
              <div v-for="output in generation.outputs" :key="output.id">
                <span>{{ String(output.position).padStart(2, '0') }}</span>
                <strong>{{ output.status === 'succeeded' ? '成功' : output.status === 'failed' ? '失败' : output.status === 'running' ? '生成中' : '等待中' }}</strong>
                <small>{{ output.creditsCharged }} 积分</small>
                <em v-if="output.errorMessage">{{ output.errorMessage }}</em>
              </div>
            </div>
          </section>

          <section class="detail-actions">
            <button class="button button--primary" type="button" :disabled="!selectedOutput?.asset || downloading" @click="download">
              <LoaderCircle v-if="downloading" class="spin" :size="16" aria-hidden="true" />
              <Download v-else :size="16" aria-hidden="true" />
              下载原图
            </button>
            <button class="button button--secondary" type="button" :disabled="!selectedOutput?.asset || favoriteSaving" @click="toggleFavorite">
              <Heart :size="16" :fill="selectedOutput?.asset?.isFavorite ? 'currentColor' : 'none'" aria-hidden="true" />
              {{ selectedOutput?.asset?.isFavorite ? '取消收藏' : '收藏作品' }}
            </button>
            <button class="button button--secondary" type="button" @click="reuse">
              <RefreshCcw :size="16" aria-hidden="true" />
              复用参数
            </button>
            <button v-if="canDelete" class="button button--danger" type="button" @click="deleteOpen = true">
              <Trash2 :size="16" aria-hidden="true" />
              删除记录
            </button>
          </section>
        </aside>
      </div>
    </template>

    <div v-if="deleteOpen" class="confirm-backdrop" @click.self="deleteOpen = false">
      <section class="confirm-panel" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <button type="button" class="icon-button confirm-close" aria-label="关闭" @click="deleteOpen = false">
          <X :size="18" aria-hidden="true" />
        </button>
        <Trash2 :size="24" aria-hidden="true" />
        <h2 id="delete-title">删除这条任务记录？</h2>
        <p>图片文件和历史记录会被移除，已产生的积分流水仍会保留。</p>
        <div>
          <button type="button" class="button button--secondary" @click="deleteOpen = false">取消</button>
          <button type="button" class="button button--danger" :disabled="deleting" @click="removeGeneration">
            {{ deleting ? '正在删除' : '确认删除' }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.detail-page {
  display: grid;
  gap: 12px;
}

.detail-top {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 11px;
  text-decoration: none;
}

.back-link:hover {
  color: var(--ink);
}

.detail-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: 10px;
}

.detail-status i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--warning);
}

.detail-status.status-succeeded i {
  background: var(--success);
}

.detail-status.status-running i,
.detail-status.status-queued i,
.detail-status.status-preparing i {
  background: var(--action);
  animation: detail-pulse 1.4s var(--ease-out) infinite;
}

.detail-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
  padding: 16px 2px 14px;
}

.detail-heading > div:first-child {
  min-width: 0;
}

.detail-heading h1 {
  max-width: 28ch;
  margin: 8px 0 7px;
  color: var(--ink);
  font-family: 'Fredoka', 'Noto Sans SC', sans-serif;
  font-size: clamp(26px, 3.5vw, 44px);
  font-weight: 570;
  line-height: 1.18;
}

.detail-heading p {
  margin: 0;
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
}

.detail-score {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.detail-score strong {
  color: var(--ink);
  font-family: 'Fredoka', 'IBM Plex Mono', sans-serif;
  font-size: 44px;
  font-weight: 540;
  line-height: 0.9;
}

.detail-score span {
  margin-top: 5px;
  color: var(--muted);
  font-size: 9px;
}

.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.65fr);
  align-items: start;
  gap: 10px;
}

.detail-canvas,
.detail-panel,
.detail-actions {
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
}

.detail-canvas {
  overflow: hidden;
}

.detail-panel {
  background: color-mix(in srgb, var(--surface) 91%, var(--candy-mint-soft));
}

.detail-canvas__head {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 14px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
}

.detail-canvas__frame {
  display: grid;
  min-height: 540px;
  place-items: center;
  padding: 24px;
  background-color: var(--canvas-bg);
  background-image:
    linear-gradient(var(--canvas-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--canvas-grid) 1px, transparent 1px);
  background-size: 22px 22px;
}

.detail-canvas__frame :deep(.protected-image) {
  width: min(100%, 760px);
  height: auto;
  max-height: 620px;
  object-fit: contain;
  border-radius: var(--radius-control);
  box-shadow: 0 18px 46px rgb(0 0 0 / 20%);
}

.detail-placeholder,
.detail-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: var(--muted);
  text-align: center;
}

.detail-placeholder strong,
.detail-state strong {
  color: var(--ink);
  font-weight: 550;
}

.detail-placeholder span,
.detail-state span {
  max-width: 44ch;
  font-size: 10px;
  line-height: 1.7;
}

.detail-state {
  min-height: 560px;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
}

.detail-outputs {
  display: flex;
  gap: 6px;
  padding: 9px;
  overflow-x: auto;
  border-top: 1px solid var(--line);
  background: var(--surface-muted);
}

.detail-outputs button {
  position: relative;
  width: 68px;
  height: 54px;
  flex: 0 0 68px;
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-control-sm);
  background: var(--surface);
}

.detail-outputs button.is-selected {
  border-color: var(--action);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.detail-outputs small {
  position: absolute;
  right: 3px;
  bottom: 2px;
  padding: 1px 3px;
  border-radius: 3px;
  background: rgb(10 13 12 / 64%);
  color: #fff;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 7px;
}

.detail-output-state {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  color: var(--muted);
}

.detail-sidebar {
  display: grid;
  gap: 10px;
}

.detail-panel,
.detail-actions {
  padding: 16px;
}

.detail-panel h2 {
  margin: 0 0 12px;
  color: var(--ink);
  font-size: 13px;
  font-weight: 600;
}

.fact-list {
  display: grid;
  gap: 1px;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--line);
}

.fact-list div {
  display: flex;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 10px;
  background: var(--surface-muted);
}

.fact-list dt {
  color: var(--muted);
  font-size: 9px;
}

.fact-list dd {
  margin: 0;
  color: var(--ink);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
}

.output-facts {
  display: grid;
  gap: 5px;
}

.output-facts > div {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control-sm);
  color: var(--muted);
  font-size: 9px;
}

.output-facts strong {
  color: var(--ink);
  font-weight: 500;
}

.output-facts em {
  grid-column: 1 / -1;
  padding-bottom: 7px;
  color: var(--warning);
  font-size: 8px;
  font-style: normal;
  line-height: 1.5;
}

.detail-actions {
  display: grid;
  gap: 7px;
}

.button--danger {
  border-color: color-mix(in srgb, var(--warning) 42%, var(--line));
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 5%, var(--surface));
}

.confirm-backdrop {
  position: fixed;
  z-index: 90;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgb(4 7 6 / 64%);
  backdrop-filter: blur(4px);
}

.confirm-panel {
  position: relative;
  width: min(420px, 100%);
  padding: 22px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: 0 28px 80px rgb(0 0 0 / 32%);
}

.confirm-close {
  position: absolute;
  top: 10px;
  right: 10px;
}

.confirm-panel > svg {
  color: var(--warning);
}

.confirm-panel h2 {
  margin: 12px 0 7px;
  color: var(--ink);
  font-size: 18px;
}

.confirm-panel p {
  margin: 0 0 18px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.7;
}

.confirm-panel > div {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
}

.spin {
  animation: detail-spin 800ms linear infinite;
}

@keyframes detail-spin {
  to { transform: rotate(360deg); }
}

@keyframes detail-pulse {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}

@media (max-width: 900px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }

  .detail-canvas__frame {
    min-height: 420px;
  }
}

@media (max-width: 560px) {
  .detail-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .detail-score {
    align-items: flex-start;
  }

  .detail-canvas__frame {
    min-height: 330px;
    padding: 16px;
  }

  .detail-state {
    min-height: 440px;
  }
}
</style>
