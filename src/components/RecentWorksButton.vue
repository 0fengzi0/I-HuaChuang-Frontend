<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, ImageOff, Images, X } from 'lucide-vue-next'
import ProtectedImage from './ProtectedImage.vue'
import {
  apiRequest,
  type Generation,
  type GenerationAsset,
  type GenerationList,
} from '../api/client'

interface RecentWorkItem {
  generation: Generation
  asset: GenerationAsset
}

const route = useRoute()
const router = useRouter()
const open = ref(false)
const triggerButton = ref<HTMLButtonElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const panelElement = ref<HTMLElement | null>(null)
const loading = ref(true)
const loadFailed = ref(false)
const items = ref<RecentWorkItem[]>([])

async function loadRecentWorks() {
  loading.value = true
  loadFailed.value = false
  try {
    const data = await apiRequest<GenerationList>('/api/generations?limit=12')
    items.value = data.items
      .map((generation) => {
        const output = generation.outputs.find((candidate) => candidate.asset)
        return output?.asset ? { generation, asset: output.asset } : null
      })
      .filter((item): item is RecentWorkItem => Boolean(item))
  } catch {
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

const previewItems = computed(() => items.value.slice(0, 3))

function openDrawer() {
  open.value = true
  void loadRecentWorks()
}

function closeDrawer() {
  open.value = false
  void nextTick(() => triggerButton.value?.focus())
}

function openGeneration(generation: Generation) {
  closeDrawer()
  void router.push(`/history/${generation.id}`)
}

function viewAll() {
  closeDrawer()
  void router.push('/history')
}

function handleKeydown(event: KeyboardEvent) {
  if (!open.value) {
    return
  }
  if (event.key === 'Escape') {
    closeDrawer()
    return
  }
  if (event.key !== 'Tab') {
    return
  }
  const focusable = Array.from(
    panelElement.value?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ) ?? [],
  )
  if (!focusable.length) {
    return
  }
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(open, async (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : ''
  if (isOpen) {
    await nextTick()
    closeButton.value?.focus()
  }
})

watch(
  () => route.fullPath,
  () => closeDrawer(),
)

function handleRecentWorksChanged() {
  void loadRecentWorks()
}

onMounted(() => {
  void loadRecentWorks()
  window.addEventListener('recent-works-changed', handleRecentWorksChanged)
})

window.addEventListener('keydown', handleKeydown)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('recent-works-changed', handleRecentWorksChanged)
  document.body.style.overflow = ''
})
</script>

<template>
  <button
    ref="triggerButton"
    type="button"
    class="recent-trigger"
    :aria-expanded="open"
    aria-controls="recent-works-panel"
    :aria-busy="loading"
    aria-haspopup="dialog"
    aria-label="打开最近作品"
    @click="openDrawer"
  >
    <span v-if="loading" class="recent-trigger__stack recent-trigger__stack--loading" aria-hidden="true">
      <span v-for="index in 3" :key="index" class="recent-trigger__image recent-trigger__skeleton" />
    </span>
    <span v-else-if="previewItems.length" class="recent-trigger__stack" aria-hidden="true">
      <span v-for="item in previewItems" :key="item.asset.id" class="recent-trigger__image">
        <ProtectedImage :asset-id="item.asset.id" alt="" thumbnail />
      </span>
    </span>
    <Images v-else :size="16" aria-hidden="true" />
    <span class="recent-trigger__label">最近</span>
    <strong>{{ items.length }}</strong>
  </button>

  <Teleport to="body">
    <Transition name="recent-drawer">
      <div v-if="open" class="recent-drawer-root">
        <button
          type="button"
          class="recent-drawer__backdrop"
          aria-label="关闭最近作品"
          @click="closeDrawer"
        />
        <aside
          id="recent-works-panel"
          ref="panelElement"
          class="recent-drawer__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="recent-title"
        >
          <header class="recent-drawer__head">
            <div>
              <span>你的作品</span>
              <h2 id="recent-title">最近作品</h2>
            </div>
            <button
              ref="closeButton"
              type="button"
              class="recent-drawer__close"
              aria-label="关闭最近作品"
              @click="closeDrawer"
            >
              <X :size="18" aria-hidden="true" />
            </button>
          </header>

          <div v-if="loading" class="recent-drawer__grid" aria-label="正在加载作品">
            <span v-for="index in 6" :key="index" class="recent-work recent-work--skeleton">
              <span class="recent-work__image recent-skeleton-block" />
              <span class="recent-work__copy">
                <span class="recent-skeleton-copy" />
                <span class="recent-skeleton-copy recent-skeleton-copy--short" />
              </span>
            </span>
          </div>
          <div v-else-if="items.length" class="recent-drawer__grid">
            <button
              v-for="item in items"
              :key="item.asset.id"
              type="button"
              class="recent-work"
              @click="openGeneration(item.generation)"
            >
              <span class="recent-work__image">
                <ProtectedImage
                  :asset-id="item.asset.id"
                  :alt="item.generation.prompt || '最近生成作品'"
                  thumbnail
                />
              </span>
              <span class="recent-work__copy">
                <strong>{{ item.generation.prompt || '未命名作品' }}</strong>
                <small>{{ item.asset.width }} × {{ item.asset.height }}</small>
              </span>
            </button>
          </div>
          <div v-else class="recent-drawer__state recent-drawer__state--empty">
            <ImageOff :size="24" aria-hidden="true" />
            <strong>{{ loadFailed ? '作品暂时加载不了' : '还没有作品' }}</strong>
            <span>{{ loadFailed ? '稍后再打开看看。' : '生成完成的图片会出现在这里。' }}</span>
          </div>

          <footer class="recent-drawer__foot">
            <button type="button" class="recent-drawer__all" @click="viewAll">
              查看全部作品
              <ArrowRight :size="16" aria-hidden="true" />
            </button>
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.recent-trigger {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  font-size: 11px;
  transition:
    border-color 160ms var(--ease-out),
    background-color 160ms var(--ease-out),
    transform 90ms ease-out;
}

.recent-trigger:hover {
  border-color: var(--line-strong);
  background: var(--surface-hover);
}

.recent-trigger:active {
  transform: scale(0.97);
}

.recent-trigger__stack {
  display: flex;
  padding-left: 5px;
}

.recent-trigger__image {
  display: block;
  width: 22px;
  height: 22px;
  overflow: hidden;
  margin-left: -5px;
  border: 2px solid var(--surface);
  border-radius: 50%;
  background: var(--surface-muted);
}

.recent-trigger__skeleton,
.recent-skeleton-block,
.recent-skeleton-copy {
  position: relative;
  overflow: hidden;
  background: var(--surface-muted);
}

.recent-trigger__skeleton::after,
.recent-skeleton-block::after,
.recent-skeleton-copy::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--surface) 72%, transparent),
    transparent
  );
  content: '';
  animation: recent-shimmer 1.2s linear infinite;
  transform: translateX(-100%);
}

.recent-trigger strong {
  color: var(--ink);
  font-size: 11px;
  font-weight: 600;
}

.recent-drawer-root {
  position: fixed;
  z-index: 110;
  inset: 0;
}

.recent-drawer__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgb(31 33 37 / 18%);
  cursor: default;
  backdrop-filter: blur(2px);
}

.recent-drawer__panel {
  position: absolute;
  top: 82px;
  right: 18px;
  display: flex;
  width: min(400px, calc(100vw - 32px));
  max-height: calc(100svh - 100px);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: 0 24px 64px rgb(31 33 37 / 16%);
}

.recent-drawer__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 22px 16px;
  border-bottom: 1px solid var(--line);
}

.recent-drawer__head span {
  color: var(--muted);
  font-size: 10px;
}

.recent-drawer__head h2 {
  margin: 3px 0 0;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 600;
}

.recent-drawer__close {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
}

.recent-drawer__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  overflow: auto;
  padding: 14px;
}

.recent-work {
  display: grid;
  min-width: 0;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  text-align: left;
}

.recent-work--skeleton {
  cursor: default;
}

.recent-work__image {
  display: block;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-thumb);
  background: var(--surface-muted);
}

.recent-work__image :deep(.protected-image) {
  transition: transform 180ms var(--ease-out);
}

.recent-work:hover .recent-work__image :deep(.protected-image) {
  transform: scale(1.025);
}

.recent-work__copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.recent-work__copy strong {
  overflow: hidden;
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-work__copy small {
  color: var(--muted);
  font-size: 9px;
}

.recent-skeleton-copy {
  display: block;
  width: 88%;
  height: 10px;
  border-radius: 4px;
}

.recent-skeleton-copy--short {
  width: 48%;
  height: 8px;
}

.recent-drawer__state {
  display: grid;
  min-height: 220px;
  place-items: center;
  align-content: center;
  gap: 8px;
  color: var(--muted);
  font-size: 11px;
}

.recent-drawer__state--empty strong {
  color: var(--ink);
  font-size: 13px;
}

.recent-drawer__foot {
  padding: 14px;
  border-top: 1px solid var(--line);
}

.recent-drawer__all {
  display: inline-flex;
  width: 100%;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-muted);
  color: var(--ink);
  cursor: pointer;
  font-size: 11px;
}

.recent-drawer-enter-active,
.recent-drawer-leave-active {
  transition: opacity 180ms var(--ease-out);
}

.recent-drawer-enter-active .recent-drawer__panel,
.recent-drawer-leave-active .recent-drawer__panel {
  transition: transform 220ms var(--ease-out);
}

.recent-drawer-enter-from,
.recent-drawer-leave-to {
  opacity: 0;
}

.recent-drawer-enter-from .recent-drawer__panel,
.recent-drawer-leave-to .recent-drawer__panel {
  transform: translateX(18px) scale(0.985);
}

@keyframes recent-shimmer {
  to {
    transform: translateX(100%);
  }
}

@media (max-width: 640px) {
  .recent-trigger__label {
    display: none;
  }

  .recent-drawer__panel {
    top: auto;
    right: 0;
    bottom: 0;
    left: 0;
    width: 100%;
    max-height: 85svh;
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
    border-radius: var(--radius-card) var(--radius-card) 0 0;
  }

  .recent-drawer-enter-from .recent-drawer__panel,
  .recent-drawer-leave-to .recent-drawer__panel {
    transform: translateY(24px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .recent-trigger__skeleton::after,
  .recent-skeleton-block::after,
  .recent-skeleton-copy::after {
    animation: none;
  }
}
</style>
