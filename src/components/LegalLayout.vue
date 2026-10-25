<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import BrandLockup from './BrandLockup.vue'

defineProps<{
  eyebrow: string
  title: string
  updated: string
}>()
</script>

<template>
  <div class="legal-page">
    <header class="legal-topbar">
      <RouterLink to="/studio" aria-label="返回I画创">
        <BrandLockup />
      </RouterLink>
      <RouterLink class="legal-back" to="/studio">
        <ArrowLeft :size="15" aria-hidden="true" />
        返回工作台
      </RouterLink>
    </header>

    <div class="legal-layout">
      <aside class="legal-aside">
        <span>{{ eyebrow }}</span>
        <h1>{{ title }}</h1>
        <p>更新日期：{{ updated }}</p>
        <div class="legal-placeholder">
          本页为上线前基础占位版本。正式发布前需补充运营主体、联系地址、客服邮箱与争议解决信息。
        </div>
      </aside>
      <article class="legal-content">
        <slot />
      </article>
    </div>
  </div>
</template>

<style scoped>
.legal-page {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  padding: 24px 0 72px;
}

.legal-topbar {
  display: flex;
  min-height: 54px;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}

.legal-topbar > a {
  text-decoration: none;
}

.legal-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 11px;
}

.legal-layout {
  display: grid;
  grid-template-columns: minmax(260px, 0.72fr) minmax(0, 1.28fr);
  gap: clamp(40px, 8vw, 110px);
  padding-top: 58px;
}

.legal-aside {
  position: sticky;
  top: 28px;
  align-self: start;
}

.legal-aside > span {
  color: var(--action);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
}

.legal-aside h1 {
  margin: 12px 0 8px;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: clamp(42px, 6vw, 72px);
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.02;
}

.legal-aside > p {
  margin: 0;
  color: var(--muted);
  font-size: 10px;
}

.legal-placeholder {
  margin-top: 32px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-thumb);
  background: var(--surface-muted);
  color: var(--muted);
  font-size: 10px;
  line-height: 1.7;
}

.legal-content {
  padding: clamp(24px, 4vw, 40px);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}

.legal-content :deep(h2) {
  margin: 34px 0 10px;
  color: var(--ink);
  font-size: 17px;
  font-weight: 600;
}

.legal-content :deep(h2:first-child) {
  margin-top: 0;
}

.legal-content :deep(p),
.legal-content :deep(li) {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.9;
}

.legal-content :deep(p) {
  margin: 0 0 12px;
}

.legal-content :deep(ul) {
  margin: 10px 0;
  padding-left: 20px;
}

@media (max-width: 760px) {
  .legal-layout {
    grid-template-columns: 1fr;
    gap: 34px;
    padding-top: 34px;
  }

  .legal-aside {
    position: static;
  }

  .legal-placeholder {
    margin-top: 18px;
  }
}
</style>
