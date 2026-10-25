<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import AppTopbar from './components/AppTopbar.vue'
import ToastViewport from './components/ToastViewport.vue'
import { useAuthStore } from './stores/auth'
import { useThemeStore } from './stores/theme'

const route = useRoute()
const auth = useAuthStore()
const theme = useThemeStore()
const queryClient = useQueryClient()
const isPublicPage = computed(() => Boolean(route.meta.public))

onMounted(() => {
  theme.initialize()
})

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
  <div class="app-root">
    <AppTopbar v-if="!isPublicPage" />
    <RouterView v-slot="{ Component, route: currentRoute }">
      <Transition name="route-fade" mode="out-in">
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
