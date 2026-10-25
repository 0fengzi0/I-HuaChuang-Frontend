<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import AppTopbar from './components/AppTopbar.vue'
import BrandLockup from './components/BrandLockup.vue'
import ToastViewport from './components/ToastViewport.vue'
import { useAuthStore } from './stores/auth'
import { useThemeStore } from './stores/theme'

const route = useRoute()
const auth = useAuthStore()
const theme = useThemeStore()
const queryClient = useQueryClient()
const isPublicPage = computed(() => Boolean(route.meta.public))
const booting = ref(true)
let bootTimer = 0

onMounted(() => {
  theme.initialize()
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  bootTimer = window.setTimeout(() => {
    booting.value = false
  }, reducedMotion ? 40 : 620)
})

onBeforeUnmount(() => window.clearTimeout(bootTimer))

watch(
  () => auth.user?.themePreference,
  (preference) => {
    if (preference && !localStorage.getItem('lighttable-theme')) {
      theme.setPreference(preference)
    }
  },
  { immediate: true },
)

watch(
  () => auth.user?.id ?? '',
  async (currentID, previousID) => {
    if (currentID !== previousID) {
      await queryClient.cancelQueries()
      queryClient.clear()
    }
  },
)
</script>

<template>
  <div class="app-root" :class="{ 'app-root--booting': booting }">
    <Transition name="app-boot">
      <div v-if="booting" class="app-boot" role="status" aria-label="正在打开 I画创">
        <div class="app-boot__brand">
          <BrandLockup />
          <span />
        </div>
      </div>
    </Transition>
    <AppTopbar v-if="!isPublicPage" />
    <RouterView v-slot="{ Component, route: currentRoute }">
      <Transition name="page-switch" mode="out-in">
        <main
          :key="currentRoute.path"
          class="app-main"
          :class="{ 'app-main--public': isPublicPage }"
        >
          <component :is="Component" />
        </main>
      </Transition>
    </RouterView>
    <ToastViewport />
  </div>
</template>

<style scoped>
.app-root--booting :deep(.topbar-stage),
.app-root--booting :deep(.app-main) {
  opacity: 0;
}

.app-root :deep(.topbar-stage),
.app-root :deep(.app-main) {
  transition: opacity 320ms var(--ease-out);
}

.app-boot {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  background: var(--surface);
}

.app-boot__brand {
  display: grid;
  justify-items: center;
  gap: 18px;
  animation: boot-brand 520ms var(--ease-out) both;
}

.app-boot__brand :deep(.brand-mark) {
  width: 42px;
  height: 42px;
  flex-basis: 42px;
  border-radius: 14px;
  box-shadow: none;
}

.app-boot__brand :deep(.brand-copy strong) {
  font-size: 24px;
}

.app-boot__brand > span {
  width: 42px;
  height: 2px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--line);
}

.app-boot__brand > span::after {
  display: block;
  width: 45%;
  height: 100%;
  border-radius: inherit;
  background: var(--action);
  content: '';
  animation: boot-line 620ms var(--ease-out) both;
}

.app-boot-leave-active {
  transition: opacity 260ms var(--ease-out);
}

.app-boot-leave-to {
  opacity: 0;
}

@keyframes boot-brand {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes boot-line {
  from {
    transform: translateX(-110%);
  }
  to {
    transform: translateX(220%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-boot__brand {
    animation: none;
  }

  .app-boot__brand > span::after {
    width: 100%;
    animation: none;
  }
}
</style>
