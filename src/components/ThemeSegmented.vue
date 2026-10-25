<script setup lang="ts">
import { MonitorCog, Moon, Sun } from 'lucide-vue-next'
import type { ThemePreference } from '../api/client'

defineProps<{
  modelValue: ThemePreference
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ThemePreference]
}>()

const options = [
  { value: 'system' as const, label: '跟随系统', icon: MonitorCog },
  { value: 'light' as const, label: '浅色', icon: Sun },
  { value: 'dark' as const, label: '深色', icon: Moon },
]
</script>

<template>
  <div class="segmented" role="radiogroup" aria-label="界面主题">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="modelValue === option.value"
      :class="{ 'is-selected': modelValue === option.value }"
      @click="emit('update:modelValue', option.value)"
    >
      <component :is="option.icon" :size="16" :stroke-width="1.8" aria-hidden="true" />
      <span>{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-muted);
}

button {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 13px;
  transition:
    color 180ms var(--ease-out),
    background 180ms var(--ease-out),
    border-color 180ms var(--ease-out),
    transform 90ms ease-out;
}

button:hover {
  color: var(--ink);
  background: var(--surface-hover);
}

button:active {
  transform: scale(0.97);
}

button.is-selected {
  border-color: var(--line);
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 1px 2px var(--shadow-color);
}

@media (max-width: 520px) {
  button {
    min-height: 42px;
  }

  button span {
    font-size: 12px;
  }
}
</style>
