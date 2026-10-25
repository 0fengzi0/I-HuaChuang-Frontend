<script setup lang="ts">
import { computed, ref } from 'vue'
import { useInfiniteQuery } from '@tanstack/vue-query'
import {
  Archive,
  CalendarDays,
  Heart,
  ImageIcon,
  ListFilter,
  LoaderCircle,
  Sparkles,
} from 'lucide-vue-next'
import ProtectedImage from '../components/ProtectedImage.vue'
import { apiRequest, type Generation, type GenerationList } from '../api/client'
import { usePublicSettings } from '../composables/usePublicSettings'

type Filter = 'all' | 'generate' | 'edit' | 'favorite'

const { data: settings } = usePublicSettings()
const filter = ref<Filter>('all')
const filters = [
  { value: 'all' as const, label: '全部', icon: Archive },
  { value: 'generate' as const, label: '文生图', icon: Sparkles },
  { value: 'edit' as const, label: '图生图', icon: ImageIcon },
  { value: 'favorite' as const, label: '收藏', icon: Heart },
]

const historyQuery = useInfiniteQuery({
  queryKey: computed(() => ['generations', 'history', filter.value]),
  queryFn: ({ pageParam }) => {
    const params = new URLSearchParams({ limit: '18' })
    if (pageParam) params.set('cursor', pageParam)
    if (filter.value === 'favorite') params.set('favorite', 'true')
    else if (filter.value !== 'all') params.set('mode', filter.value)
    return apiRequest<GenerationList>(`/api/generations?${params.toString()}`)
  },
  initialPageParam: null as string | null,
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
})

const generations = computed(
  () => historyQuery.data.value?.pages.flatMap((page) => page.items) ?? [],
)
const isPending = computed(() => historyQuery.isPending.value)
const hasNextPage = computed(() => historyQuery.hasNextPage.value)
const isFetchingNextPage = computed(() => historyQuery.isFetchingNextPage.value)
const emptyTitle = computed(() =>
  filter.value === 'favorite' ? '还没有收藏作品' : '历史档案还是空的',
)

function generationTitle(generation: Generation) {
  return generation.prompt.length > 34 ? generation.prompt.slice(0, 34) + '…' : generation.prompt
}

function statusLabel(generation: Generation) {
  const labels: Record<Generation['status'], string> = {
    preparing: '准备中',
    queued: '排队中',
    running: '生成中',
    succeeded: '已完成',
    partially_succeeded: '部分成功',
    failed: '失败',
    canceled: '已取消',
  }
  return labels[generation.status]
}

function primaryAsset(generation: Generation) {
  return generation.outputs.find((output) => output.asset)?.asset ?? null
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
</script>

<template>
  <div class="page-frame history-page">
    <header class="page-heading">
      <div>
        <span class="page-kicker">ARCHIVE / {{ settings?.retentionDays ?? 7 }} DAYS</span>
        <h1>历史作品</h1>
        <p>按时间查看保留期内的任务、结果和失败原因。过期图片会自动清理，积分流水仍会保留。</p>
      </div>
      <div class="retention-chip">
        <CalendarDays :size="16" aria-hidden="true" />
        <span>保留 {{ settings?.retentionDays ?? 7 }} 天</span>
      </div>
    </header>

    <section class="history-panel">
      <div class="history-toolbar">
        <div class="filter-group" role="tablist" aria-label="作品筛选">
          <button
            v-for="item in filters"
            :key="item.value"
            type="button"
            role="tab"
            :aria-selected="filter === item.value"
            :class="{ 'is-active': filter === item.value }"
            @click="filter = item.value"
          >
            <component :is="item.icon" :size="15" aria-hidden="true" />
            {{ item.label }}
          </button>
        </div>
        <span class="archive-count">{{ generations.length }} 项记录</span>
      </div>

      <div v-if="isPending" class="history-state">
        <LoaderCircle class="spin" :size="22" aria-hidden="true" />
        <span>正在读取历史档案</span>
      </div>
      <div v-else-if="generations.length" class="history-content">
        <div class="history-grid">
          <RouterLink
            v-for="generation in generations"
            :key="generation.id"
            :to="`/history/${generation.id}`"
            class="history-card"
          >
            <span class="history-card__image">
              <ProtectedImage
                v-if="primaryAsset(generation)"
                :asset-id="primaryAsset(generation)!.id"
                :alt="generation.prompt"
                thumbnail
              />
              <span v-else class="history-card__missing">
                <ImageIcon v-if="generation.status === 'failed'" :size="24" aria-hidden="true" />
                <LoaderCircle v-else :size="22" aria-hidden="true" />
                <small>{{ statusLabel(generation) }}</small>
              </span>
              <span v-if="primaryAsset(generation)?.isFavorite" class="history-card__favorite">
                <Heart :size="13" fill="currentColor" aria-label="已收藏" />
              </span>
            </span>
            <span class="history-card__copy">
              <span class="history-card__line">
                <strong>{{ generationTitle(generation) }}</strong>
                <small :class="`status-${generation.status}`">{{ statusLabel(generation) }}</small>
              </span>
              <span class="history-card__meta">
                <span>{{ generation.settings.resolution || '1K' }} · {{ generation.settings.size }}</span>
                <span>{{ generation.outputs.length }} 张</span>
                <span>{{ generation.chargedCredits }} 积分</span>
                <span>{{ formatDate(generation.createdAt) }}</span>
              </span>
            </span>
          </RouterLink>
        </div>
        <button
          v-if="hasNextPage"
          type="button"
          class="button button--secondary load-more"
          :disabled="isFetchingNextPage"
          @click="historyQuery.fetchNextPage()"
        >
          {{ isFetchingNextPage ? '正在读取' : '加载更多' }}
        </button>
      </div>
      <div v-else class="archive-empty">
        <div class="archive-empty__visual" aria-hidden="true">
          <span class="archive-frame">01</span>
          <span class="archive-frame archive-frame--offset">02</span>
          <span class="archive-frame archive-frame--far">03</span>
        </div>
        <div class="archive-empty__copy">
          <span class="card-index">NO EXPOSURES</span>
          <h2>{{ emptyTitle }}</h2>
          <p>完成的图片会按接触印样顺序排列。你可以预览、下载、收藏或复用参数。</p>
          <RouterLink class="button button--primary" to="/studio">
            <ListFilter :size="16" aria-hidden="true" />
            返回工作台
          </RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.history-page {
  display: grid;
  gap: 10px;
}

.retention-chip {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  gap: 7px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-size: 11px;
}

.history-panel {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--surface) 91%, var(--candy-blue-soft));
}

.history-toolbar {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 14px;
  border-bottom: 1px solid var(--line);
}

.filter-group {
  display: flex;
  gap: 4px;
  overflow-x: auto;
}

.filter-group button {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-control-sm);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 11px;
  white-space: nowrap;
}

.filter-group button:hover,
.filter-group button.is-active {
  border-color: var(--line);
  background: var(--surface-muted);
  color: var(--ink);
}

.archive-count {
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  white-space: nowrap;
}

.history-state {
  display: flex;
  min-height: 420px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: var(--muted);
  font-size: 11px;
}

.history-content {
  padding: 12px;
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
}

.history-card {
  display: grid;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-thumb);
  background: var(--surface);
  color: var(--muted);
  text-decoration: none;
  transition:
    border-color 120ms var(--ease-out),
    transform 120ms var(--ease-out);
}

.history-card:hover {
  border-color: var(--line-strong);
  transform: translateY(-1px);
}

.history-card__image {
  position: relative;
  display: block;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--canvas-bg);
}

.history-card__image :deep(.protected-image) {
  transition: transform 180ms var(--ease-out);
}

.history-card:hover .history-card__image :deep(.protected-image) {
  transform: scale(1.015);
}

.history-card__favorite {
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 50%;
  background: rgb(14 17 16 / 68%);
  color: #fff;
  backdrop-filter: blur(8px);
}

.history-card__missing {
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: var(--muted);
}

.history-card__missing small {
  font-size: 9px;
}

.history-card__copy {
  display: grid;
  gap: 8px;
  padding: 10px;
}

.history-card__line {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.history-card__line strong {
  overflow: hidden;
  color: var(--ink);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.55;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-card__line small {
  flex: 0 0 auto;
  padding: 3px 6px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-size: 8px;
}

.history-card__line small.status-succeeded {
  color: var(--success);
}

.history-card__line small.status-failed {
  color: var(--warning);
}

.history-card__line small.status-partially_succeeded {
  color: var(--warning);
}

.history-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 8px;
}

.load-more {
  display: flex;
  margin: 16px auto 4px;
}

.spin {
  animation: history-spin 800ms linear infinite;
}

@keyframes history-spin {
  to {
    transform: rotate(360deg);
  }
}

.archive-empty {
  display: grid;
  min-height: 520px;
  grid-template-columns: minmax(260px, 0.9fr) minmax(300px, 1.1fr);
  align-items: center;
  gap: clamp(30px, 7vw, 90px);
  padding: clamp(30px, 6vw, 82px);
  background-image:
    linear-gradient(var(--canvas-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--canvas-grid) 1px, transparent 1px);
  background-size: 24px 24px;
}

.archive-empty__visual {
  position: relative;
  height: 250px;
}

.archive-frame {
  position: absolute;
  top: 35px;
  left: 8%;
  display: grid;
  width: 64%;
  aspect-ratio: 4 / 3;
  place-items: center;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-thumb);
  background: var(--surface);
  color: var(--muted-soft);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px;
  box-shadow: 0 12px 30px var(--shadow-color);
  transform: rotate(-4deg);
}

.archive-frame--offset {
  top: 62px;
  left: 25%;
  transform: rotate(4deg);
}

.archive-frame--far {
  top: 92px;
  left: 40%;
  transform: rotate(-1deg);
}

.archive-empty__copy {
  max-width: 480px;
}

.archive-empty__copy h2 {
  margin: 10px 0 9px;
  color: var(--ink);
  font-family: 'Fredoka', 'Noto Sans SC', sans-serif;
  font-size: clamp(28px, 4vw, 42px);
  font-weight: 560;
  line-height: 1.15;
}

.archive-empty__copy p {
  margin: 0 0 24px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.8;
}

@media (max-width: 780px) {
  .history-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .archive-empty {
    min-height: 470px;
    grid-template-columns: 1fr;
    gap: 20px;
    padding: 32px 24px;
  }

  .archive-empty__visual {
    height: 190px;
  }

  .archive-frame {
    left: 4%;
    width: 55%;
  }

  .archive-frame--offset {
    left: 25%;
  }

  .archive-frame--far {
    left: 46%;
  }
}

@media (max-width: 560px) {
  .history-toolbar {
    align-items: flex-start;
    flex-direction: column;
    padding: 10px;
  }

  .filter-group {
    width: 100%;
  }

  .archive-count {
    padding-left: 3px;
  }

  .archive-empty {
    padding: 24px 18px 30px;
  }

  .history-grid {
    grid-template-columns: 1fr;
  }
}
</style>
