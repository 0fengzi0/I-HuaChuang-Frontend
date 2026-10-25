<script setup lang="ts">
import { CircleAlert, CircleCheck, Info, X } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useNotificationsStore } from '../stores/notifications'

const notifications = useNotificationsStore()
const { items } = storeToRefs(notifications)
</script>

<template>
  <div class="toast-viewport" aria-live="polite" aria-atomic="false">
    <TransitionGroup name="toast">
      <div
        v-for="item in items"
        :key="item.id"
        class="toast"
        :class="`toast--${item.tone}`"
        role="status"
      >
        <CircleCheck v-if="item.tone === 'success'" :size="18" aria-hidden="true" />
        <CircleAlert v-else-if="item.tone === 'warning' || item.tone === 'error'" :size="18" aria-hidden="true" />
        <Info v-else :size="18" aria-hidden="true" />
        <span>{{ item.message }}</span>
        <button type="button" aria-label="关闭提示" @click="notifications.dismiss(item.id)">
          <X :size="16" aria-hidden="true" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-viewport {
  position: fixed;
  z-index: 100;
  right: 22px;
  bottom: 22px;
  display: flex;
  width: min(360px, calc(100vw - 32px));
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 12px 12px 12px 14px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-thumb);
  background: var(--surface);
  box-shadow: 0 14px 34px var(--shadow-color);
  color: var(--ink);
  font-size: 13px;
  line-height: 1.55;
  pointer-events: auto;
}

.toast--success {
  border-color: color-mix(in srgb, var(--success) 42%, var(--line));
}

.toast--warning {
  border-color: color-mix(in srgb, var(--warning) 42%, var(--line));
}

.toast--error {
  border-color: color-mix(in srgb, var(--warning) 58%, var(--line));
}

button {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

button:hover {
  background: var(--surface-hover);
  color: var(--ink);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 180ms var(--ease-out),
    transform 180ms var(--ease-out);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@media (max-width: 560px) {
  .toast-viewport {
    right: 16px;
    bottom: 92px;
  }
}
</style>
