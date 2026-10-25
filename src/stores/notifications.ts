import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface Notification {
  id: number
  message: string
  tone: 'default' | 'success' | 'warning' | 'error'
}

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<Notification[]>([])
  let nextID = 1

  function push(message: string, tone: Notification['tone'] = 'default') {
    const id = nextID++
    items.value.push({ id, message, tone })
    window.setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 3800)
  }

  function dismiss(id: number) {
    items.value = items.value.filter((item) => item.id !== id)
  }

  return { items, push, dismiss }
})
