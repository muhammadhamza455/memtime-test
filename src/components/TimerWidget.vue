<template>
  <div v-if="isVisible" class="timer-widget-bar">
    <div class="timer-widget-container">
      <div class="timer-display-group">
        <div class="timer-digits-box" :class="{ running: timerStore.isRunning && !timerStore.isPaused }">
          <Clock :size="18" class="clock-icon" />
          <span class="timer-digits">{{ timerStore.formattedTime }}</span>
        </div>
      </div>

      <div class="timer-inputs-group">
        <div class="timer-task-select">
          <FolderKanban :size="15" class="select-icon" />
          <select
            v-model="selectedTaskIdModel"
            class="timer-select"
            :disabled="timerStore.isRunning"
          >
            <option :value="null">-- Select Task to track --</option>
            <option
              v-for="task in availableTasks"
              :key="task.id"
              :value="task.id"
            >
              #{{ task.id }} - {{ task.name }}
            </option>
          </select>
        </div>

        <div class="timer-comment-input">
          <MessageSquare :size="15" class="select-icon" />
          <input
            v-model="timerStore.comment"
            type="text"
            class="timer-text-input"
            placeholder="What are you working on right now?"
          />
        </div>
      </div>

      <div class="timer-controls-group">
        <button
          v-if="!timerStore.isRunning"
          type="button"
          class="btn btn-success btn-sm"
          @click="startTracking"
        >
          <Play :size="15" />
          <span>Start</span>
        </button>

        <template v-else>
          <button
            v-if="!timerStore.isPaused"
            type="button"
            class="btn btn-warning btn-sm"
            @click="timerStore.pause()"
          >
            <Pause :size="15" />
            <span>Pause</span>
          </button>

          <button
            v-else
            type="button"
            class="btn btn-success btn-sm"
            @click="timerStore.resume()"
          >
            <Play :size="15" />
            <span>Resume</span>
          </button>

          <button
            type="button"
            class="btn btn-primary btn-sm"
            @click="stopAndLog"
          >
            <Check :size="15" />
            <span>Finish & Log</span>
          </button>

          <button
            type="button"
            class="btn btn-ghost btn-sm"
            @click="timerStore.cancel()"
            title="Discard current timer"
          >
            <Trash2 :size="15" />
          </button>
        </template>

        <button
          type="button"
          class="btn-icon btn-sm"
          @click="emit('close')"
          title="Minimize timer"
        >
          <X :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTimerStore } from '../stores/timer'
import { useHierarchyStore } from '../stores/hierarchy'
import { useTimeEntriesStore } from '../stores/timeEntries'
import { useToastStore } from '../stores/toast'
import type { Task } from '../types'
import {
  Clock,
  Play,
  Pause,
  Check,
  Trash2,
  FolderKanban,
  MessageSquare,
  X
} from 'lucide-vue-next'

const props = defineProps<{
  isVisible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const timerStore = useTimerStore()
const hierarchyStore = useHierarchyStore()
const timeEntriesStore = useTimeEntriesStore()
const toast = useToastStore()

const availableTasks = computed<Task[]>(() => {
  const result: Task[] = []
  for (const list of hierarchyStore.tasksByProjectId.values()) {
    result.push(...list)
  }
  return result
})

const selectedTaskIdModel = computed({
  get: () => timerStore.taskId,
  set: (val: number | null) => {
    timerStore.taskId = val
    if (val) {
      const task = availableTasks.value.find((t) => t.id === val)
      if (task) timerStore.taskName = task.name
    } else {
      timerStore.taskName = ''
    }
  }
})

function startTracking(): void {
  if (timerStore.taskId === null && availableTasks.value.length > 0) {
    selectedTaskIdModel.value = availableTasks.value[0].id
  }
  timerStore.start(timerStore.taskId ?? undefined, timerStore.taskName)
  toast.info('Time tracking started')
}

function stopAndLog(): void {
  const result = timerStore.stop()
  if (!result.taskId) {
    toast.warning('Please select a task before logging time')
    timeEntriesStore.openCreateModal()
    return
  }

  timeEntriesStore.openCreateModal(result.taskId)
}
</script>

<style scoped>
.timer-widget-bar {
  background: var(--surface-card);
  border-bottom: 1px solid var(--border-color);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 10px 0;
  animation: slideDown 0.25s ease;
}

@keyframes slideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.timer-widget-container {
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.timer-display-group {
  display: flex;
  align-items: center;
}

.timer-digits-box {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface-subtle);
  border: 1px solid var(--border-color);
  padding: 8px 16px;
  border-radius: 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  transition: all 0.2s ease;
}

.timer-digits-box.running {
  border-color: rgba(16, 185, 129, 0.5);
  background: rgba(16, 185, 129, 0.08);
  color: #10b981;
}

.timer-inputs-group {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 280px;
}

.timer-task-select,
.timer-comment-input {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
}

.select-icon {
  position: absolute;
  left: 12px;
  color: var(--text-muted);
  pointer-events: none;
}

.timer-select,
.timer-text-input {
  width: 100%;
  padding: 8px 12px 8px 36px;
  background: var(--surface-subtle);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 0.85rem;
  transition: all 0.2s ease;
}

.timer-select:focus,
.timer-text-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15);
}

.timer-controls-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
