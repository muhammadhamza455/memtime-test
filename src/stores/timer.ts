import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useTimerStore = defineStore('timer', () => {
  const isRunning = ref(false)
  const isPaused = ref(false)
  const startTimestamp = ref<number | null>(null)
  const accumulatedSeconds = ref(0)
  const elapsedSeconds = ref(0)
  const taskId = ref<number | null>(null)
  const taskName = ref<string>('')
  const comment = ref<string>('')

  let intervalId: number | null = null

  const formattedTime = computed(() => {
    const total = elapsedSeconds.value
    const hrs = Math.floor(total / 3600)
    const mins = Math.floor((total % 3600) / 60)
    const secs = total % 60
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  })

  function start(selectedTaskId?: number, selectedTaskName?: string): void {
    if (isRunning.value) return
    isRunning.value = true
    isPaused.value = false
    startTimestamp.value = Date.now()
    if (selectedTaskId !== undefined) taskId.value = selectedTaskId
    if (selectedTaskName) taskName.value = selectedTaskName

    intervalId = window.setInterval(() => {
      if (isRunning.value && !isPaused.value && startTimestamp.value) {
        const currentSegment = Math.floor((Date.now() - startTimestamp.value) / 1000)
        elapsedSeconds.value = accumulatedSeconds.value + currentSegment
      }
    }, 1000)
  }

  function pause(): void {
    if (!isRunning.value || isPaused.value) return
    isPaused.value = true
    if (startTimestamp.value) {
      accumulatedSeconds.value += Math.floor((Date.now() - startTimestamp.value) / 1000)
      elapsedSeconds.value = accumulatedSeconds.value
      startTimestamp.value = null
    }
  }

  function resume(): void {
    if (!isRunning.value || !isPaused.value) return
    isPaused.value = false
    startTimestamp.value = Date.now()
  }

  function stop(): {
    taskId: number | null
    taskName: string
    comment: string
    startISO: string
    endISO: string
    durationSeconds: number
  } {
    const end = new Date()
    const duration = elapsedSeconds.value
    const start = new Date(end.getTime() - duration * 1000)

    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }

    const result = {
      taskId: taskId.value,
      taskName: taskName.value,
      comment: comment.value,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      durationSeconds: duration
    }

    isRunning.value = false
    isPaused.value = false
    startTimestamp.value = null
    accumulatedSeconds.value = 0
    elapsedSeconds.value = 0
    taskId.value = null
    taskName.value = ''
    comment.value = ''

    return result
  }

  function cancel(): void {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    isRunning.value = false
    isPaused.value = false
    startTimestamp.value = null
    accumulatedSeconds.value = 0
    elapsedSeconds.value = 0
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
    stop,
    cancel
  }
})
