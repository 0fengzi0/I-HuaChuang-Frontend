<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ChevronRight,
  CircleUserRound,
  Coins,
  History,
  Menu,
  Moon,
  Settings2,
  Sun,
  WalletCards,
  X,
} from 'lucide-vue-next'
import BrandLockup from './BrandLockup.vue'
import { isDemoMode } from '../api/client'
import { useAuthStore } from '../stores/auth'
import { useThemeStore } from '../stores/theme'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const theme = useThemeStore()
const menuOpen = ref(false)

const navigation = computed(() => {
  const items = [
    { to: '/history', label: '历史', icon: History },
    { to: '/wallet', label: '积分', icon: WalletCards },
    { to: '/account', label: '账户', icon: CircleUserRound },
  ]
  if (auth.isAdmin) {
    items.push({ to: '/admin', label: '管理', icon: Settings2 })
  }
  return items
})

function toggleTheme() {
  theme.setPreference(theme.resolved === 'dark' ? 'light' : 'dark')
}

function goToLogin() {
  void router.push('/login')
}

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  },
)
</script>

<template>
  <div class="topbar-stage">
    <header class="topbar">
      <RouterLink to="/studio" class="topbar__brand" aria-label="I画创工作台">
        <BrandLockup />
      </RouterLink>

      <nav class="topbar__nav" aria-label="主要导航">
        <RouterLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          :class="{ 'is-active': route.path.startsWith(item.to) }"
        >
          <component :is="item.icon" :size="16" :stroke-width="1.8" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="topbar__actions">
        <span v-if="isDemoMode" class="demo-pill" title="当前使用内置演示数据">演示</span>
        <RouterLink v-if="auth.user" class="credit-pill" to="/wallet">
          <Coins :size="15" :stroke-width="1.8" aria-hidden="true" />
          <strong>{{ auth.user.creditBalance }}</strong>
          <span>积分</span>
        </RouterLink>

        <button
          type="button"
          class="icon-button theme-toggle"
          :aria-label="theme.resolved === 'dark' ? '切换到浅色主题' : '切换到深色主题'"
          :title="theme.resolved === 'dark' ? '切换到浅色主题' : '切换到深色主题'"
          @click="toggleTheme"
        >
          <Sun v-if="theme.resolved === 'dark'" :size="18" aria-hidden="true" />
          <Moon v-else :size="18" aria-hidden="true" />
        </button>

        <RouterLink
          v-if="auth.user"
          to="/account"
          class="avatar-button"
          :aria-label="`${auth.user.username} 的账户`"
        >
          {{ auth.user.username.slice(0, 1) }}
        </RouterLink>
        <button
          v-else
          type="button"
          class="button button--small"
          @click="goToLogin"
        >
          登录
        </button>

        <button
          type="button"
          class="icon-button mobile-menu-button"
          :aria-expanded="menuOpen"
          aria-controls="mobile-navigation"
          aria-label="打开导航"
          @click="menuOpen = !menuOpen"
        >
          <X v-if="menuOpen" :size="19" aria-hidden="true" />
          <Menu v-else :size="19" aria-hidden="true" />
        </button>
      </div>
    </header>

    <Transition name="mobile-nav">
      <nav v-if="menuOpen" id="mobile-navigation" class="mobile-nav" aria-label="移动端导航">
        <RouterLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          :class="{ 'is-active': route.path.startsWith(item.to) }"
        >
          <component :is="item.icon" :size="18" :stroke-width="1.8" aria-hidden="true" />
          <span>{{ item.label }}</span>
          <ChevronRight :size="16" aria-hidden="true" />
        </RouterLink>
      </nav>
    </Transition>
  </div>
</template>

<style scoped>
.topbar-stage {
  position: sticky;
  z-index: 50;
  top: 0;
  padding: 10px 20px 0;
  background: color-mix(in srgb, var(--bg) 84%, transparent);
  backdrop-filter: blur(18px);
}

.topbar {
  display: grid;
  width: min(1540px, 100%);
  min-height: 58px;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  margin: 0 auto;
  padding: 0 12px 0 16px;
  border: 1px solid var(--line);
  border-radius: 22px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
}

.topbar__brand {
  width: max-content;
  text-decoration: none;
}

.topbar__nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.topbar__nav a {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  gap: 7px;
  padding: 0 13px;
  border-radius: var(--radius-control);
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition:
    color 180ms var(--ease-out),
    background 180ms var(--ease-out),
    transform 90ms ease-out;
}

.topbar__nav a:hover,
.topbar__nav a.is-active {
  background: var(--surface-hover);
  color: var(--ink);
}

.topbar__nav a:active {
  transform: scale(0.97);
}

.topbar__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
}

.credit-pill {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-size: 12px;
  text-decoration: none;
}

.demo-pill {
  padding: 5px 8px;
  border: 1px solid color-mix(in srgb, var(--candy-blue) 52%, var(--line));
  border-radius: var(--radius-pill);
  background: var(--candy-blue-soft);
  color: color-mix(in srgb, var(--candy-blue) 64%, var(--ink));
  font-size: 10px;
  font-weight: 700;
}

.credit-pill strong {
  color: var(--ink);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 13px;
  font-weight: 500;
}

.avatar-button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  background: var(--surface-muted);
  color: var(--ink);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}

.avatar-button:hover {
  border-color: var(--action);
}

.mobile-menu-button,
.mobile-nav {
  display: none;
}

@media (max-width: 920px) {
  .topbar-stage {
    padding: 8px 10px 0;
  }

  .topbar {
    min-height: 54px;
    grid-template-columns: minmax(0, 1fr) auto;
    padding: 0 8px 0 12px;
  }

  .topbar__nav {
    display: none;
  }

  .topbar__actions {
    grid-column: 2;
  }

  .mobile-menu-button {
    display: grid;
  }

  .mobile-nav {
    display: grid;
    width: min(1540px, 100%);
    gap: 3px;
    margin: 6px auto 0;
    padding: 6px;
    border: 1px solid var(--line);
    border-radius: 22px;
    background: var(--surface);
    box-shadow: var(--shadow-card);
  }

  .mobile-nav a {
    display: grid;
    min-height: 44px;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 0 10px;
    border-radius: var(--radius-control);
    color: var(--muted);
    font-size: 13px;
    text-decoration: none;
  }

  .mobile-nav a.is-active {
    background: var(--surface-hover);
    color: var(--ink);
  }
}

@media (max-width: 560px) {
  .topbar :deep(.brand-copy small) {
    display: none;
  }

  .theme-toggle {
    display: none;
  }

  .credit-pill {
    min-height: 34px;
    padding: 0 10px;
  }

  .credit-pill span {
    display: none;
  }
}
</style>
