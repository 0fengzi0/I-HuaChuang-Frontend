<script setup lang="ts">
import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-vue-next'

defineProps<{
  page: number
  hasNext: boolean
  loading?: boolean
}>()

defineEmits<{
  previous: []
  next: []
}>()
</script>

<template>
  <nav class="pagination-controls" aria-label="分页">
    <button
      type="button"
      class="button button--secondary button--small"
      :disabled="page <= 1 || loading"
      @click="$emit('previous')"
    >
      <ChevronLeft :size="15" aria-hidden="true" />
      上一页
    </button>
    <span>第 {{ page }} 页</span>
    <button
      type="button"
      class="button button--secondary button--small"
      :disabled="!hasNext || loading"
      @click="$emit('next')"
    >
      <LoaderCircle v-if="loading" class="spin" :size="15" aria-hidden="true" />
      <span v-else>下一页</span>
      <ChevronRight v-if="!loading" :size="15" aria-hidden="true" />
    </button>
  </nav>
</template>

<style scoped>
.pagination-controls {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.pagination-controls > span {
  min-width: 58px;
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  text-align: center;
}

.spin {
  animation: pagination-spin 800ms linear infinite;
}

@keyframes pagination-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
