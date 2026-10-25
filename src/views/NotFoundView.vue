<script setup lang="ts">
import { ArrowLeft, ScanSearch } from 'lucide-vue-next'
</script>

<template>
  <div class="not-found-page">
    <div class="not-found-panel">
      <ScanSearch :size="34" :stroke-width="1.35" aria-hidden="true" />
      <span class="page-kicker">404 · 画面未找到</span>
      <h1>这一格没有画面</h1>
      <p>地址可能已移动，或者这张画面从未存在。</p>
      <RouterLink class="button button--primary" to="/studio">
        <ArrowLeft :size="16" aria-hidden="true" />
        回到工作台
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.not-found-page {
  display: grid;
  width: min(700px, calc(100% - 32px));
  min-height: calc(100svh - 60px);
  place-items: center;
  margin: 0 auto;
}

.not-found-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: clamp(28px, 6vw, 56px);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  color: var(--muted);
  text-align: center;
}

.not-found-panel h1 {
  margin: 14px 0 8px;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: clamp(38px, 7vw, 64px);
  font-weight: 580;
}

.not-found-panel p {
  margin: 0 0 24px;
  font-size: 12px;
}
</style>
