import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

const STORAGE_KEY = 'memtime_timer'

interface PersistedTimer {
  isRunning: boolean
  isPaused: boolean
  startTimestamp: number | null
  accumulatedSeconds: number
  taskId: number | null
  taskName: string
  comment: string
}

export interface TimerSnapshot {
  taskId: number | null
  comment: string
  startISO: string
  endISO: string
  durationSeconds: number
}

function loadPersisted(): PersistedTimer | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PersistedTimer) : null
  } catch {
    return null
  }
}

export const useTimerStore = defineStore('timer', () => {
  const saved = loadPersisted()

  const isRunning = ref(saved?.isRunning ?? false)
  const isPaused = ref(saved?.isPaused ?? false)
  const startTimestamp = ref<number | null>(saved?.startTimestamp ?? null)
  const accumulatedSeconds = ref(saved?.accumulatedSeconds ?? 0)
  const taskId = ref<number | null>(saved?.taskId ?? null)
  const taskName = ref(saved?.taskName ?? '')
  const comment = ref(saved?.comment ?? '')
  const now = ref(Date.now())

  window.setInterval(() => {
    if (isRunning.value && !isPaused.value) now.value = Date.now()
  }, 1000)

  const elapsedSeconds = computed(() => {
    const segment =
      isRunning.value && !isPaused.value && startTimestamp.value
        ? Math.max(0, Math.floor((now.value - startTimestamp.value) / 1000))
        : 0
    return accumulatedSeconds.value + segment
  })

  const formattedTime = computed(() => {
    const total = elapsedSeconds.value
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
  })

  watch(
    [isRunning, isPaused, startTimestamp, accumulatedSeconds, taskId, taskName, comment],
    () => {
      try {
        if (!isRunning.value) {
          window.localStorage.removeItem(STORAGE_KEY)
          return
        }
        const state: PersistedTimer = {
          isRunning: isRunning.value,
          isPaused: isPaused.value,
          startTimestamp: startTimestamp.value,
          accumulatedSeconds: accumulatedSeconds.value,
          taskId: taskId.value,
          taskName: taskName.value,
          comment: comment.value
        }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch {
      }
    }
  )

  function start(): void {
    if (isRunning.value) return
    isRunning.value = true
    isPaused.value = false
    accumulatedSeconds.value = 0
    startTimestamp.value = Date.now()
    now.value = Date.now()
  }

  function pause(): void {
    if (!isRunning.value || isPaused.value) return
    if (startTimestamp.value) {
      accumulatedSeconds.value += Math.floor((Date.now() - startTimestamp.value) / 1000)
    }
    startTimestamp.value = null
    isPaused.value = true
  }

  function resume(): void {
    if (!isRunning.value || !isPaused.value) return
    isPaused.value = false
    startTimestamp.value = Date.now()
    now.value = Date.now()
  }

  function snapshot(): TimerSnapshot {
    pause()
    const end = new Date()
    const duration = accumulatedSeconds.value
    return {
      taskId: taskId.value,
      comment: comment.value,
      startISO: new Date(end.getTime() - duration * 1000).toISOString(),
      endISO: end.toISOString(),
      durationSeconds: duration
    }
  }

  function reset(): void {
    isRunning.value = false
    isPaused.value = false
    startTimestamp.value = null
    accumulatedSeconds.value = 0
    taskId.value = null
    taskName.value = ''
    comment.value = ''
  }

  return {
    isRunning,
    isPaused,
    elapsedSeconds,
    formattedTime,
    taskId,
    taskName,
    comment,
    start,
    pause,
    resume,
    snapshot,
    reset
  }
})
