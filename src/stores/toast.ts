import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ToastItem {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title?: string
  message: string
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<ToastItem[]>([])

  function removeToast(id: string): void {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function addToast(toast: Omit<ToastItem, 'id'>, duration = 4000): void {
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const newToast: ToastItem = { ...toast, id }
    toasts.value.push(newToast)

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }

  function success(message: string, title = 'Success'): void {
    addToast({ type: 'success', title, message })
  }

  function error(message: string, title = 'Error'): void {
    addToast({ type: 'error', title, message }, 6000)
  }

  function info(message: string, title = 'Info'): void {
    addToast({ type: 'info', title, message })
  }

  function warning(message: string, title = 'Warning'): void {
    addToast({ type: 'warning', title, message })
  }

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    info,
    warning
  }
})
