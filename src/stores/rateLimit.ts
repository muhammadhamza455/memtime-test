import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../services/api'
import type { RateLimitState } from '../types'

export const useRateLimitStore = defineStore('rateLimit', () => {
  const limit = ref(15)
  const remaining = ref(15)
  const resetSeconds = ref(0)
  const blocked = ref(false)

  function sync(state: RateLimitState): void {
    limit.value = state.limit
    remaining.value = state.remaining
    resetSeconds.value = state.resetSeconds
    blocked.value = state.blocked
  }

  api.onRateLimitChange(sync)
  // The sliding window drains over time without any request happening,
  // so re-read it every second to keep the gauge and countdown honest.
  window.setInterval(() => sync(api.getRateLimit()), 1000)

  return {
    limit,
    remaining,
    resetSeconds,
    blocked
  }
})
