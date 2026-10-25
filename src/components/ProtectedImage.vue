<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { ImageOff, LoaderCircle } from 'lucide-vue-next'
import { apiBlob } from '../api/client'

const props = withDefaults(
  defineProps<{
    assetId: string
    alt: string
    thumbnail?: boolean
  }>(),
  {
    thumbnail: false,
  },
)

const emit = defineEmits<{
  loaded: []
}>()

const source = ref('')
const loading = ref(true)
const failed = ref(false)
let controller: AbortController | null = null

async function load() {
  controller?.abort()
  controller = new AbortController()
  if (source.value) {
    URL.revokeObjectURL(source.value)
    source.value = ''
  }
  loading.value = true
  failed.value = false
  try {
    const blob = await apiBlob(
      `/api/assets/${encodeURIComponent(props.assetId)}/download?inline=true${props.thumbnail ? '&thumbnail=true' : ''}`,
      { signal: controller.signal },
    )
    source.value = URL.createObjectURL(blob)
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      failed.value = true
    }
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.assetId, props.thumbnail],
  () => void load(),
  { immediate: true },
)

onBeforeUnmount(() => {
  controller?.abort()
  if (source.value) {
    URL.revokeObjectURL(source.value)
  }
})
</script>

<template>
  <span v-if="loading" class="protected-image-state" aria-label="图片加载中">
    <LoaderCircle :size="20" class="spin" aria-hidden="true" />
  </span>
  <span v-else-if="failed || !source" class="protected-image-state protected-image-state--error">
    <ImageOff :size="20" aria-hidden="true" />
  </span>
  <img
    v-else
    :src="source"
    :alt="alt"
    class="protected-image"
    @load="emit('loaded')"
  />
</template>

<style scoped>
.protected-image-state,
.protected-image {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
}

.protected-image-state {
  min-height: 80px;
  background: var(--surface-muted);
  color: var(--muted);
}

.protected-image-state--error {
  color: var(--warning);
}

.protected-image {
  object-fit: cover;
  animation: develop-image 600ms var(--ease-out) both;
}

.spin {
  animation: protected-image-spin 800ms linear infinite;
}

@keyframes develop-image {
  from {
    opacity: 0.2;
    filter: blur(8px) saturate(0.35);
  }
  to {
    opacity: 1;
    filter: blur(0) saturate(1);
  }
}

@keyframes protected-image-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .protected-image {
    animation: none;
  }
}
</style>
