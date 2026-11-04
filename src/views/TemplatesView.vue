<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  Bookmark,
  Heart,
  Image as ImageIcon,
  LoaderCircle,
  Search,
  Sparkles,
  Wand2,
  X,
} from 'lucide-vue-next'
import ProtectedImage from '../components/ProtectedImage.vue'
import {
  APIError,
  apiRequest,
  type TemplateCategory,
  type TemplateDetail,
  type TemplateList,
  type TemplateSummary,
  type UseTemplateResponse,
} from '../api/client'
import { useNotificationsStore } from '../stores/notifications'

type Tab = 'official' | 'favorites'
type Sort = 'latest' | 'popular'

const router = useRouter()
const notifications = useNotificationsStore()
const queryClient = useQueryClient()

const activeTab = ref<Tab>('official')
const sort = ref<Sort>('latest')
const category = ref('')
const searchInput = ref('')
const search = ref('')

const categoryQuery = useQuery({
  queryKey: ['template-categories'],
  queryFn: () =>
    apiRequest<{ categories: TemplateCategory[] }>('/api/template-categories'),
})

const templatesQuery = useInfiniteQuery({
  queryKey: computed(() => ['templates', activeTab.value, sort.value, category.value, search.value]),
  queryFn: ({ pageParam }) => {
    const params = new URLSearchParams({ limit: '18', tab: activeTab.value, sort: sort.value })
    if (pageParam) params.set('cursor', pageParam)
    if (category.value) params.set('category', category.value)
    if (search.value) params.set('search', search.value)
    return apiRequest<TemplateList>(`/api/templates?${params.toString()}`)
  },
  initialPageParam: null as string | null,
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
})

const templates = computed(
  () => templatesQuery.data.value?.pages.flatMap((page) => page.items) ?? [],
)
const isPending = computed(() => templatesQuery.isPending.value)
const hasNextPage = computed(() => templatesQuery.hasNextPage.value)
const isFetchingNextPage = computed(() => templatesQuery.isFetchingNextPage.value)

const detailId = ref<string | null>(null)
const detailQuery = useQuery({
  queryKey: computed(() => ['template-detail', detailId.value]),
  queryFn: () => apiRequest<TemplateDetail>(`/api/templates/${detailId.value}`),
  enabled: computed(() => detailId.value !== null),
})
const detail = computed(() => (detailId.value ? detailQuery.data.value ?? null : null))

const variableTarget = ref<TemplateSummary | null>(null)
const variableValues = reactive<Record<string, string>>({})
const variableError = ref('')
const usingTemplate = ref(false)

// 列表接口不返回个人收藏态,用本地集合跟踪;收藏页签与详情数据加载时同步。
const favoritedIds = ref<Set<string>>(new Set())

watch(
  templates,
  (items) => {
    if (activeTab.value !== 'favorites') {
      return
    }
    const next = new Set(favoritedIds.value)
    for (const item of items) {
      next.add(item.id)
    }
    favoritedIds.value = next
  },
  { immediate: true },
)

watch(detail, (value) => {
  if (!value) {
    return
  }
  const next = new Set(favoritedIds.value)
  if (value.isFavorite) {
    next.add(value.id)
  } else {
    next.delete(value.id)
  }
  favoritedIds.value = next
})

function openDetail(summary: TemplateSummary) {
  detailId.value = summary.id
}

function closeDetail() {
  detailId.value = null
}

function isFavoriteById(templateId: string) {
  return favoritedIds.value.has(templateId)
}

function toggleFavorite(summary: TemplateSummary) {
  void favorite(summary, !isFavoriteById(summary.id))
}

async function favorite(summary: TemplateSummary, favorite: boolean) {
  try {
    await apiRequest(`/api/templates/${summary.id}/favorite`, {
      method: 'POST',
      body: JSON.stringify({ favorite }),
    })
    const next = new Set(favoritedIds.value)
    if (favorite) {
      next.add(summary.id)
    } else {
      next.delete(summary.id)
    }
    favoritedIds.value = next
    // 取消在途列表请求再失效,避免 in-flight 空结果被去重复用。
    await queryClient.cancelQueries({ queryKey: ['templates'] })
    await queryClient.invalidateQueries({ queryKey: ['templates'] })
    if (detailId.value === summary.id) {
      await queryClient.invalidateQueries({ queryKey: ['template-detail', summary.id] })
    }
  } catch (error) {
    notifications.push(
      error instanceof APIError ? error.message : '暂时无法更新收藏。',
      'error',
    )
  }
}

async function startUse(summary: TemplateSummary) {
  if (summary.variables.length > 0) {
    variableError.value = ''
    for (const name of summary.variables) {
      variableValues[name] = ''
    }
    variableTarget.value = summary
    return
  }
  await submitUse(summary, {})
}

function submitVariableForm() {
  const target = variableTarget.value
  if (!target) {
    return
  }
  const missing = target.variables.filter((name) => !variableValues[name]?.trim())
  if (missing.length > 0) {
    variableError.value = `请填写：${missing.join('、')}`
    return
  }
  const values: Record<string, string> = {}
  for (const name of target.variables) {
    values[name] = variableValues[name]
  }
  variableError.value = ''
  void submitUse(target, values)
}

async function submitUse(summary: TemplateSummary, values: Record<string, string>) {
  usingTemplate.value = true
  try {
    const result = await apiRequest<UseTemplateResponse>(`/api/templates/${summary.id}/use`, {
      method: 'POST',
      body: JSON.stringify({ variables: values }),
    })
    variableTarget.value = null
    closeDetail()
    try {
      sessionStorage.setItem(
        `template-payload-${result.id}`,
        JSON.stringify({
          prompt: result.prompt,
          referenceIds: result.references.map((item) => item.id),
        }),
      )
    } catch {
      // sessionStorage 不可用时创作台会回退读取模板原文。
    }
    await router.push(`/studio?template=${result.id}`)
  } catch (error) {
    if (error instanceof APIError && error.fields) {
      const first = Object.values(error.fields)[0]
      variableError.value = first ?? error.message
    } else {
      notifications.push(
        error instanceof APIError ? error.message : '暂时无法使用这个模板。',
        'error',
      )
    }
  } finally {
    usingTemplate.value = false
  }
}

function submitSearch() {
  search.value = searchInput.value.trim()
}

watch([activeTab, sort, category], () => {
  window.scrollTo({ top: 0 })
})
</script>

<template>
  <div class="page-frame templates-page">
    <header class="page-heading">
      <div>
        <span class="page-kicker">官方模板库</span>
        <h1>创作模板</h1>
        <p>把常用的提示词与参考图沉淀成模板。点击“使用”带入创作台，参数由你自由调整。</p>
      </div>
    </header>

    <section class="templates-panel">
      <div class="templates-toolbar">
        <div class="filter-group" role="tablist" aria-label="模板页签">
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'official'"
            :class="{ 'is-active': activeTab === 'official' }"
            @click="activeTab = 'official'"
          >
            <Sparkles :size="15" aria-hidden="true" />
            模板库
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'favorites'"
            :class="{ 'is-active': activeTab === 'favorites' }"
            @click="activeTab = 'favorites'"
          >
            <Heart :size="15" aria-hidden="true" />
            我的收藏
          </button>
        </div>
        <form class="search-box" role="search" @submit.prevent="submitSearch">
          <Search :size="14" aria-hidden="true" />
          <input
            v-model="searchInput"
            type="search"
            placeholder="搜索标题、描述或提示词"
            aria-label="搜索模板"
          />
        </form>
      </div>

      <div class="templates-subtoolbar">
        <div class="filter-group" role="tablist" aria-label="分类筛选">
          <button
            type="button"
            role="tab"
            :aria-selected="category === ''"
            :class="{ 'is-active': category === '' }"
            @click="category = ''"
          >
            全部
          </button>
          <button
            v-for="item in categoryQuery.data.value?.categories ?? []"
            :key="item.id"
            type="button"
            role="tab"
            :aria-selected="category === item.id"
            :class="{ 'is-active': category === item.id }"
            @click="category = item.id"
          >
            {{ item.name }}
          </button>
        </div>
        <div class="filter-group sort-group" role="tablist" aria-label="排序">
          <button
            type="button"
            role="tab"
            :aria-selected="sort === 'latest'"
            :class="{ 'is-active': sort === 'latest' }"
            @click="sort = 'latest'"
          >
            最新
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="sort === 'popular'"
            :class="{ 'is-active': sort === 'popular' }"
            @click="sort = 'popular'"
          >
            最热
          </button>
        </div>
      </div>

      <div v-if="isPending" class="templates-state">
        <LoaderCircle class="spin" :size="22" aria-hidden="true" />
        <span>正在读取模板</span>
      </div>
      <div v-else-if="templates.length" class="templates-content">
        <div class="templates-grid">
          <article v-for="item in templates" :key="item.id" class="template-card">
            <button type="button" class="template-card__media" @click="openDetail(item)">
              <ProtectedImage
                v-if="item.hasCover"
                :asset-id="item.id"
                kind="template-cover"
                :alt="item.title"
                thumbnail
              />
              <span v-else class="template-card__placeholder" aria-hidden="true">
                {{ item.title.slice(0, 1) }}
              </span>
              <span v-if="item.referenceCount > 0" class="template-card__refs">
                <ImageIcon :size="11" aria-hidden="true" />
                {{ item.referenceCount }} 张参考图
              </span>
            </button>
            <div class="template-card__copy">
              <div class="template-card__line">
                <strong>{{ item.title }}</strong>
                <span v-if="item.categoryName" class="template-card__tag">
                  {{ item.categoryName }}
                </span>
              </div>
              <p v-if="item.description" class="template-card__desc">{{ item.description }}</p>
              <div class="template-card__meta">
                <span v-if="item.variables.length" class="template-card__variables">
                  {{ item.variables.length }} 个变量
                </span>
                <span>{{ item.usageCount }} 次使用</span>
              </div>
            </div>
            <div class="template-card__actions">
              <button
                type="button"
                class="button button--primary template-card__use"
                @click="startUse(item)"
              >
                <Wand2 :size="14" aria-hidden="true" />
                使用
              </button>
              <button
                type="button"
                class="template-card__favorite"
                :class="{ 'is-active': isFavoriteById(item.id) }"
                :aria-label="isFavoriteById(item.id) ? '取消收藏' : '收藏'"
                @click="toggleFavorite(item)"
              >
                <Heart
                  :size="15"
                  :fill="isFavoriteById(item.id) ? 'currentColor' : 'none'"
                  aria-hidden="true"
                />
              </button>
            </div>
          </article>
        </div>
        <button
          v-if="hasNextPage"
          type="button"
          class="button button--secondary load-more"
          :disabled="isFetchingNextPage"
          @click="templatesQuery.fetchNextPage()"
        >
          {{ isFetchingNextPage ? '正在读取' : '加载更多' }}
        </button>
      </div>
      <div v-else class="templates-state templates-state--empty">
        <Bookmark :size="26" aria-hidden="true" />
        <p>
          {{ activeTab === 'favorites' ? '还没有收藏模板。在模板库点击 ♥ 收藏喜欢的模板。' : '模板库暂时为空，等管理员上架第一批模板。' }}
        </p>
      </div>
    </section>

    <!-- 模板详情弹层 -->
    <div
      v-if="detail"
      class="modal-backdrop"
      @click.self="closeDetail"
    >
      <section class="detail-modal" role="dialog" aria-modal="true" aria-label="模板详情">
        <button type="button" class="detail-modal__close" aria-label="关闭" @click="closeDetail">
          <X :size="16" aria-hidden="true" />
        </button>
        <div class="detail-modal__media">
          <ProtectedImage
            v-if="detail.hasCover"
            :asset-id="detail.id"
            kind="template-cover"
            :alt="detail.title"
          />
          <span v-else class="template-card__placeholder" aria-hidden="true">
            {{ detail.title.slice(0, 1) }}
          </span>
        </div>
        <div class="detail-modal__body">
          <h2>{{ detail.title }}</h2>
          <p class="detail-modal__meta">
            <span v-if="detail.categoryName">{{ detail.categoryName }}</span>
            <span>{{ detail.usageCount }} 次使用</span>
            <span v-if="detail.variables.length">{{ detail.variables.length }} 个变量</span>
          </p>
          <p v-if="detail.description" class="detail-modal__desc">{{ detail.description }}</p>
          <div v-if="detail.variables.length" class="detail-modal__block">
            <h3>变量</h3>
            <div class="detail-modal__chips">
              <span v-for="name in detail.variables" :key="name" class="detail-chip">
                {{ '{' + name + '}' }}
              </span>
            </div>
          </div>
          <div v-if="detail.references.length" class="detail-modal__block">
            <h3>参考图</h3>
            <div class="detail-modal__refs">
              <span v-for="reference in detail.references" :key="reference.id" class="detail-modal__ref">
                <ProtectedImage
                  :asset-id="reference.id"
                  kind="template-reference"
                  :alt="`参考图 ${reference.position + 1}`"
                  thumbnail
                />
              </span>
            </div>
          </div>
          <div class="detail-modal__block">
            <h3>提示词</h3>
            <p class="detail-modal__prompt">{{ detail.prompt }}</p>
          </div>
          <div class="detail-modal__actions">
            <button
              type="button"
              class="button button--primary"
              :disabled="usingTemplate"
              @click="startUse(detail)"
            >
              <LoaderCircle v-if="usingTemplate" class="spin" :size="14" aria-hidden="true" />
              <Wand2 v-else :size="14" aria-hidden="true" />
              使用模板
            </button>
            <button
              type="button"
              class="button button--secondary"
              @click="toggleFavorite(detail)"
            >
              <Heart
                :size="14"
                :fill="detail.isFavorite ? 'currentColor' : 'none'"
                aria-hidden="true"
              />
              {{ detail.isFavorite ? '取消收藏' : '收藏' }}
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- 变量填空弹层 -->
    <div
      v-if="variableTarget"
      class="modal-backdrop"
      @click.self="variableTarget = null"
    >
      <section class="variable-modal" role="dialog" aria-modal="true" aria-label="填写模板变量">
        <h2>{{ variableTarget.title }}</h2>
        <p class="variable-modal__hint">填写变量后合成最终提示词，带入创作台。</p>
        <form @submit.prevent="submitVariableForm">
          <label v-for="name in variableTarget.variables" :key="name" class="field">
            <span>{{ name }}</span>
            <input v-model="variableValues[name]" type="text" :placeholder="`请输入${name}`" />
          </label>
          <div v-if="variableError" class="inline-alert inline-alert--error" role="alert">
            {{ variableError }}
          </div>
          <div class="variable-modal__actions">
            <button type="button" class="button button--secondary" @click="variableTarget = null">
              取消
            </button>
            <button type="submit" class="button button--primary" :disabled="usingTemplate">
              <LoaderCircle v-if="usingTemplate" class="spin" :size="14" aria-hidden="true" />
              带入创作台
            </button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>

<style scoped>
.templates-page {
  display: grid;
  gap: 10px;
}

.templates-panel {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
}

.templates-toolbar {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 14px;
  border-bottom: 1px solid var(--line);
}

.templates-subtoolbar {
  display: flex;
  min-height: 46px;
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

.sort-group {
  flex: 0 0 auto;
}

.search-box {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control-sm);
  background: var(--surface-muted);
  color: var(--muted);
}

.search-box input {
  width: 170px;
  border: none;
  background: transparent;
  color: var(--ink);
  font-size: 11px;
  outline: none;
}

.templates-state {
  display: flex;
  min-height: 420px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted);
  font-size: 11px;
}

.templates-state--empty {
  min-height: 320px;
}

.templates-state--empty p {
  max-width: 320px;
  margin: 0;
  text-align: center;
  line-height: 1.8;
}

.templates-content {
  padding: 12px;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.template-card {
  display: grid;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-thumb);
  background: var(--surface);
  transition:
    border-color 120ms var(--ease-out),
    transform 120ms var(--ease-out);
}

.template-card:hover {
  border-color: var(--line-strong);
  transform: translateY(-1px);
}

.template-card__media {
  position: relative;
  display: block;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  padding: 0;
  border: none;
  background: var(--canvas-bg);
  cursor: pointer;
}

.template-card__media :deep(.protected-image) {
  transition: transform 180ms var(--ease-out);
}

.template-card:hover .template-card__media :deep(.protected-image) {
  transform: scale(1.015);
}

.template-card__placeholder {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  background: linear-gradient(135deg, var(--surface-muted), var(--canvas-bg));
  color: var(--muted-soft);
  font-family: 'Fredoka', 'Noto Sans SC', sans-serif;
  font-size: 42px;
  font-weight: 560;
}

.template-card__refs {
  position: absolute;
  left: 8px;
  top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgb(14 17 16 / 68%);
  color: #fff;
  font-size: 9px;
  backdrop-filter: blur(8px);
}

.template-card__copy {
  display: grid;
  gap: 6px;
  padding: 10px 10px 0;
}

.template-card__line {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.template-card__line strong {
  overflow: hidden;
  color: var(--ink);
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-card__tag {
  flex: 0 0 auto;
  padding: 3px 6px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--muted);
  font-size: 8px;
}

.template-card__desc {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.template-card__meta {
  display: flex;
  gap: 10px;
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
}

.template-card__variables {
  color: var(--action);
}

.template-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px;
}

.template-card__use {
  flex: 1;
}

.template-card__favorite {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: var(--radius-control-sm);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.template-card__favorite:hover,
.template-card__favorite.is-active {
  border-color: var(--action);
  color: var(--action);
}

.load-more {
  display: flex;
  margin: 16px auto 4px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(10 12 11 / 46%);
  backdrop-filter: blur(4px);
}

.detail-modal {
  position: relative;
  display: grid;
  width: min(720px, 100%);
  max-height: min(86vh, 780px);
  grid-template-columns: minmax(220px, 0.9fr) 1.1fr;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
}

.detail-modal__media {
  min-height: 260px;
  background: var(--canvas-bg);
}

.detail-modal__media :deep(.protected-image) {
  height: 100%;
  object-fit: cover;
}

.detail-modal__body {
  display: grid;
  align-content: start;
  gap: 10px;
  max-height: inherit;
  overflow-y: auto;
  padding: 18px;
}

.detail-modal__close {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
}

.detail-modal__body h2 {
  margin: 0;
  color: var(--ink);
  font-size: 16px;
  font-weight: 560;
}

.detail-modal__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 0;
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
}

.detail-modal__desc {
  margin: 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.7;
}

.detail-modal__block h3 {
  margin: 0 0 6px;
  color: var(--ink);
  font-size: 10px;
  font-weight: 560;
  letter-spacing: 0.04em;
}

.detail-modal__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.detail-chip {
  padding: 3px 8px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
}

.detail-modal__refs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-modal__ref {
  display: block;
  width: 86px;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-control-sm);
}

.detail-modal__prompt {
  margin: 0;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control-sm);
  background: var(--surface-muted);
  color: var(--ink);
  font-size: 11px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.detail-modal__actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.variable-modal {
  width: min(420px, 100%);
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
}

.variable-modal h2 {
  margin: 0 0 6px;
  color: var(--ink);
  font-size: 15px;
  font-weight: 560;
}

.variable-modal__hint {
  margin: 0 0 14px;
  color: var(--muted);
  font-size: 11px;
}

.variable-modal form {
  display: grid;
  gap: 10px;
}

.variable-modal .field span {
  display: block;
  margin-bottom: 5px;
  color: var(--muted);
  font-size: 10px;
}

.variable-modal .field input {
  width: 100%;
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control-sm);
  background: var(--surface-muted);
  color: var(--ink);
  font-size: 12px;
}

.variable-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}

.inline-alert {
  padding: 8px 10px;
  border-radius: var(--radius-control-sm);
  font-size: 11px;
}

.inline-alert--error {
  border: 1px solid var(--warning);
  background: var(--surface-muted);
  color: var(--warning);
}

.spin {
  animation: templates-spin 800ms linear infinite;
}

@keyframes templates-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1020px) {
  .templates-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .detail-modal {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .detail-modal__media {
    min-height: 200px;
  }
}

@media (max-width: 560px) {
  .templates-toolbar,
  .templates-subtoolbar {
    align-items: flex-start;
    flex-direction: column;
    padding: 10px;
  }

  .search-box {
    width: 100%;
  }

  .search-box input {
    width: 100%;
  }

  .templates-grid {
    grid-template-columns: 1fr;
  }

  .modal-backdrop {
    padding: 0;
    align-items: end;
  }

  .detail-modal,
  .variable-modal {
    max-height: 92vh;
    border-radius: var(--radius-card) var(--radius-card) 0 0;
  }
}
</style>
