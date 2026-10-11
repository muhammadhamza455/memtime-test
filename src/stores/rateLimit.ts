import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../services/api'
import type { RateLimitState } from '../types'

export const useRateLimitStore = defineStore('rateLimit', () => {
  const limit = ref(15)
  const remaining = ref(15)
  const resetSeconds = ref(60)
  const updatedAt = ref(Date.now())
  const countdown = ref(60)

  let timerInterval: number | null = null

  function startCountdown(): void {
    if (timerInterval) clearInterval(timerInterval)
    countdown.value = resetSeconds.value

    timerInterval = window.setInterval(() => {
      if (countdown.value > 0) {
        countdown.value--
      } else {
        countdown.value = 60
        remaining.value = limit.value
      }
    }, 1000)
  }

  function sync(state: RateLimitState): void {
    limit.value = state.limit
    remaining.value = state.remaining
    resetSeconds.value = state.resetSeconds
    updatedAt.value = state.updatedAt
    startCountdown()
  }

  api.onRateLimitChange(sync)

  return {
    limit,
    remaining,
    resetSeconds,
    countdown,
    updatedAt,
    sync
  }
})
