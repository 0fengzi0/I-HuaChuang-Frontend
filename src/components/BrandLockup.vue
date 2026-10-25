<script setup lang="ts">
withDefaults(
  defineProps<{
    compact?: boolean
  }>(),
  {
    compact: false,
  },
)
</script>

<template>
  <span class="brand-lockup" :class="{ 'brand-lockup--compact': compact }">
    <span class="brand-mark" aria-hidden="true">
      <span class="brand-mark__corner brand-mark__corner--tl" />
      <span class="brand-mark__corner brand-mark__corner--br" />
      <span class="brand-mark__dot" />
    </span>
    <span class="brand-copy">
      <strong>I画创</strong>
      <small v-if="!compact">AI 图片创作</small>
    </span>
  </span>
</template>

<style scoped>
.brand-lockup {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
  color: var(--ink);
}

.brand-mark {
  position: relative;
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  place-items: center;
  border: 1px solid var(--line-strong);
  border-radius: 9px;
  background: var(--surface);
}

.brand-mark__corner {
  position: absolute;
  width: 8px;
  height: 8px;
  border-color: var(--action);
  border-style: solid;
}

.brand-mark__corner--tl {
  top: 7px;
  left: 7px;
  border-width: 1px 0 0 1px;
}

.brand-mark__corner--br {
  right: 7px;
  bottom: 7px;
  border-width: 0 1px 1px 0;
}

.brand-mark__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--warning);
}

.brand-copy {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 8px;
}

.brand-copy strong {
  overflow: hidden;
  font-family: 'Bricolage Grotesque', 'Noto Sans SC', sans-serif;
  font-size: 20px;
  font-weight: 650;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-copy small {
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.brand-lockup--compact .brand-copy strong {
  font-size: 18px;
}
</style>
