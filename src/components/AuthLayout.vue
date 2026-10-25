<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import BrandLockup from './BrandLockup.vue'
import paintStudio from '../assets/paint-studio.jpg'

defineProps<{
  kicker: string
  title: string
  description: string
}>()
</script>

<template>
  <div class="auth-page">
    <RouterLink class="auth-back" to="/studio" aria-label="返回创作工作台">
      <ArrowLeft :size="17" aria-hidden="true" />
      <span>返回工作台</span>
    </RouterLink>

    <section class="auth-visual" aria-label="创作图像预览">
      <img :src="paintStudio" alt="画刷与鲜艳颜料覆盖在白色画布上" />
      <div class="auth-visual__top">
        <BrandLockup />
      </div>
      <div class="auth-visual__caption">
        <span>画布预览 · 1024 × 1024</span>
        <p>把脑海里的颜色，留在可以继续工作的桌面上。</p>
      </div>
    </section>

    <main class="auth-panel">
      <div class="auth-panel__inner">
        <div class="auth-panel__heading">
          <span class="auth-kicker">{{ kicker }}</span>
          <h1>{{ title }}</h1>
          <p>{{ description }}</p>
        </div>
        <slot />
      </div>
      <footer class="auth-footer">
        <span>I画创</span>
        <span>
          <RouterLink to="/terms">用户协议</RouterLink>
          <RouterLink to="/privacy">隐私政策</RouterLink>
        </span>
      </footer>
    </main>
  </div>
</template>

<style scoped>
.auth-page {
  display: grid;
  min-height: 100svh;
  grid-template-columns: minmax(0, 1.04fr) minmax(440px, 0.96fr);
  background: var(--bg);
}

.auth-back {
  position: fixed;
  z-index: 10;
  top: 22px;
  right: 24px;
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  gap: 7px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  color: var(--muted);
  font-size: 12px;
  text-decoration: none;
  backdrop-filter: blur(14px);
}

.auth-back:hover {
  color: var(--ink);
}

.auth-visual {
  position: relative;
  min-height: calc(100svh - 24px);
  margin: 12px 0 12px 12px;
  overflow: hidden;
  border-radius: 14px;
  background: #d8ddd6;
}

.auth-visual::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgb(12 17 15 / 28%), transparent 30%, rgb(12 17 15 / 58%));
  content: '';
  pointer-events: none;
}

.auth-visual img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.auth-visual__top,
.auth-visual__caption {
  position: absolute;
  z-index: 1;
  left: 30px;
}

.auth-visual__top {
  top: 30px;
}

.auth-visual__top :deep(.brand-lockup) {
  color: #fff;
}

.auth-visual__top :deep(.brand-mark) {
  border-color: rgb(255 255 255 / 46%);
  background: rgb(255 255 255 / 10%);
  backdrop-filter: blur(12px);
}

.auth-visual__top :deep(.brand-copy small) {
  color: rgb(255 255 255 / 68%);
}

.auth-visual__caption {
  right: 30px;
  bottom: 28px;
  max-width: 500px;
  color: #fff;
}

.auth-visual__caption span {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  opacity: 0.72;
}

.auth-visual__caption p {
  margin: 8px 0 0;
  font-family: 'Bricolage Grotesque', 'Noto Sans SC', sans-serif;
  font-size: clamp(24px, 2.5vw, 38px);
  font-weight: 520;
  line-height: 1.25;
}

.auth-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: space-between;
  padding: 84px clamp(34px, 6vw, 92px) 26px;
}

.auth-panel__inner {
  width: min(430px, 100%);
  margin: auto;
  padding: 28px 0 38px;
}

.auth-panel__heading {
  margin-bottom: 30px;
}

.auth-kicker {
  color: var(--action);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
}

.auth-panel__heading h1 {
  margin: 10px 0 10px;
  color: var(--ink);
  font-family: 'Bricolage Grotesque', 'Noto Sans SC', sans-serif;
  font-size: clamp(34px, 4vw, 48px);
  font-weight: 600;
  line-height: 1.04;
}

.auth-panel__heading p {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.75;
}

.auth-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  color: var(--muted);
  font-size: 11px;
}

.auth-footer span:last-child {
  display: flex;
  gap: 16px;
}

.auth-footer a {
  color: inherit;
  text-decoration: none;
}

.auth-footer a:hover {
  color: var(--ink);
}

@media (max-width: 980px) {
  .auth-page {
    grid-template-columns: 1fr;
  }

  .auth-visual {
    min-height: 290px;
    height: 290px;
    margin: 10px 10px 0;
  }

  .auth-visual__caption {
    display: none;
  }

  .auth-panel {
    padding: 30px 24px 24px;
  }

  .auth-panel__inner {
    padding: 20px 0 48px;
  }

  .auth-back {
    top: 20px;
    right: 20px;
  }
}

@media (max-width: 560px) {
  .auth-visual {
    min-height: 210px;
    height: 210px;
  }

  .auth-visual__top {
    top: 22px;
    left: 22px;
  }

  .auth-visual__top :deep(.brand-copy small) {
    display: none;
  }

  .auth-back {
    top: 18px;
    right: 18px;
  }

  .auth-back span {
    display: none;
  }

  .auth-panel {
    padding: 28px 20px 22px;
  }

  .auth-panel__heading h1 {
    font-size: 34px;
  }

  .auth-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
