<template>
  <div v-if="timeEntriesStore.isFormModalOpen" class="modal-overlay" @click.self="close">
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="form-modal-title">
      <div class="modal-header">
        <div class="modal-title-group">
          <Clock class="modal-icon" :size="20" />
          <h2 id="form-modal-title">
            {{ isEditing ? `Edit Time Entry #${timeEntriesStore.activeEntryForEdit?.id}` : 'Create New Time Entry' }}
          </h2>
        </div>
        <button type="button" class="btn-icon" @click="close" aria-label="Close modal">
          <X :size="18" />
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="modal-form">
        <div class="modal-content">
          <div v-if="apiErrorMessage" class="form-error-banner">
            <AlertCircle :size="16" />
            <span>{{ apiErrorMessage }}</span>
          </div>

          <div class="form-group">
            <label for="entry-task-select">
              Task <span class="required">*</span>
            </label>
            <div class="task-input-wrapper">
              <select
                id="entry-task-select"
                v-model="selectedTaskOption"
                class="form-select"
                :class="{ 'has-error': errors.taskId }"
              >
                <option :value="''">-- Select a Task from hierarchy --</option>
                <option
                  v-for="task in loadedTasks"
                  :key="task.id"
                  :value="task.id"
                >
                  #{{ task.id }} - {{ task.name }}
                </option>
                <option :value="'custom'">Manual Task ID entry...</option>
              </select>

              <div v-if="selectedTaskOption === 'custom'" class="manual-task-row">
                <input
                  v-model.number="customTaskId"
                  type="number"
                  min="1"
                  class="form-input"
                  placeholder="Enter numeric Task ID (e.g. 398)"
                  :class="{ 'has-error': errors.taskId }"
                />
              </div>
            </div>
            <span v-if="errors.taskId" class="field-error">{{ errors.taskId }}</span>
          </div>

          <div class="form-group">
            <label for="entry-comment">
              Comment / Activity Description <span class="required">*</span>
            </label>
            <textarea
              id="entry-comment"
              v-model="comment"
              rows="3"
              class="form-textarea"
              placeholder="Describe what you worked on..."
              :class="{ 'has-error': errors.comment }"
            ></textarea>
            <div class="field-caption-row">
              <span v-if="errors.comment" class="field-error">{{ errors.comment }}</span>
              <span class="char-count">{{ comment.length }} characters</span>
            </div>
          </div>

          <div class="time-range-grid">
            <div class="form-group">
              <label for="entry-start-time">
                Start Time <span class="required">*</span>
              </label>
              <input
                id="entry-start-time"
                v-model="startLocal"
                type="datetime-local"
                class="form-input"
                :class="{ 'has-error': errors.start }"
              />
              <span v-if="errors.start" class="field-error">{{ errors.start }}</span>
            </div>

            <div class="form-group">
              <label for="entry-end-time">
                End Time <span class="required">*</span>
              </label>
              <input
                id="entry-end-time"
                v-model="endLocal"
                type="datetime-local"
                class="form-input"
                :class="{ 'has-error': errors.end }"
              />
              <span v-if="errors.end" class="field-error">{{ errors.end }}</span>
            </div>
          </div>

          <div class="duration-preview-card">
            <div class="preview-metric">
              <span class="preview-label">Calculated Duration:</span>
              <span class="preview-val" :class="{ invalid: calculatedDurationSecs <= 0 }">
                {{ formatDuration(calculatedDurationSecs) }}
              </span>
            </div>

            <div class="quick-preset-chips">
              <button
                type="button"
                class="chip-btn"
                @click="applyPreset(15)"
              >
                +15m
              </button>
              <button
                type="button"
                class="chip-btn"
                @click="applyPreset(30)"
              >
                +30m
              </button>
              <button
                type="button"
                class="chip-btn"
                @click="applyPreset(60)"
              >
                +1h
              </button>
              <button
                type="button"
                class="chip-btn"
                @click="applyPreset(120)"
              >
                +2h
              </button>
              <button
                type="button"
                class="chip-btn"
                @click="setEndToNow"
              >
                End Now
              </button>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-ghost"
            :disabled="isSubmitting"
            @click="close"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="isSubmitting"
          >
            <Check :size="16" />
            <span>{{ isSubmitting ? 'Saving...' : isEditing ? 'Update Entry' : 'Create Entry' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTimeEntriesStore } from '../../stores/timeEntries'
import { useHierarchyStore } from '../../stores/hierarchy'
import {
  toDateTimeLocalString,
  fromDateTimeLocalToIso,
  calculateDurationBetween,
  formatDuration
} from '../../utils/date'
import type { Task } from '../../types'
import { Clock, X, AlertCircle, Check } from 'lucide-vue-next'

const timeEntriesStore = useTimeEntriesStore()
const hierarchyStore = useHierarchyStore()

const isEditing = computed(() => !!timeEntriesStore.activeEntryForEdit)

const selectedTaskOption = ref<number | string>('')
const customTaskId = ref<number | null>(null)
const comment = ref('')
const startLocal = ref('')
const endLocal = ref('')
const isSubmitting = ref(false)
const apiErrorMessage = ref<string | null>(null)

const errors = ref({
  taskId: '',
  comment: '',
  start: '',
  end: ''
})

const loadedTasks = computed<Task[]>(() => {
  const result: Task[] = []
  for (const list of hierarchyStore.tasksByProjectId.values()) {
    result.push(...list)
  }
  return result
})

const effectiveTaskId = computed<number | null>(() => {
  if (selectedTaskOption.value === 'custom') {
    return customTaskId.value
  }
  if (typeof selectedTaskOption.value === 'number') {
    return selectedTaskOption.value
  }
  return null
})

const calculatedDurationSecs = computed(() => {
  if (!startLocal.value || !endLocal.value) return 0
  const sIso = fromDateTimeLocalToIso(startLocal.value)
  const eIso = fromDateTimeLocalToIso(endLocal.value)
  return calculateDurationBetween(sIso, eIso)
})

watch(
  () => timeEntriesStore.isFormModalOpen,
  (open) => {
    if (open) {
      apiErrorMessage.value = null
      errors.value = { taskId: '', comment: '', start: '', end: '' }

      const editing = timeEntriesStore.activeEntryForEdit
      if (editing) {
        const found = loadedTasks.value.find((t) => t.id === editing.taskId)
        if (found) {
          selectedTaskOption.value = editing.taskId
        } else {
          selectedTaskOption.value = 'custom'
          customTaskId.value = editing.taskId
        }
        comment.value = editing.comment
        startLocal.value = toDateTimeLocalString(new Date(editing.start))
        endLocal.value = toDateTimeLocalString(new Date(editing.end))
      } else {
        const prefillTaskId = timeEntriesStore.modalPrefillTaskId ?? timeEntriesStore.filterTaskId
        if (prefillTaskId) {
          const found = loadedTasks.value.find((t) => t.id === prefillTaskId)
          if (found) {
            selectedTaskOption.value = prefillTaskId
          } else {
            selectedTaskOption.value = 'custom'
            customTaskId.value = prefillTaskId
          }
        } else if (loadedTasks.value.length > 0) {
          selectedTaskOption.value = loadedTasks.value[0].id
        } else {
          selectedTaskOption.value = 'custom'
          customTaskId.value = 398
        }

        comment.value = ''
        const now = new Date()
        const oneHourAgo = new Date(now.getTime() - 3600 * 1000)
        startLocal.value = toDateTimeLocalString(oneHourAgo)
        endLocal.value = toDateTimeLocalString(now)
      }
    }
  },
  { immediate: true }
)

function applyPreset(minutesToAdd: number): void {
  if (!startLocal.value) {
    const now = new Date()
    startLocal.value = toDateTimeLocalString(now)
  }
  const sDate = new Date(startLocal.value)
  const eDate = new Date(sDate.getTime() + minutesToAdd * 60 * 1000)
  endLocal.value = toDateTimeLocalString(eDate)
}

function setEndToNow(): void {
  endLocal.value = toDateTimeLocalString(new Date())
}

function validate(): boolean {
  let valid = true
  errors.value = { taskId: '', comment: '', start: '', end: '' }

  if (!effectiveTaskId.value || isNaN(effectiveTaskId.value) || effectiveTaskId.value <= 0) {
    errors.value.taskId = 'A valid positive Task ID is required.'
    valid = false
  }

  if (!comment.value.trim()) {
    errors.value.comment = 'Comment / activity description is required.'
    valid = false
  }

  if (!startLocal.value) {
    errors.value.start = 'Start time is required.'
    valid = false
  }

  if (!endLocal.value) {
    errors.value.end = 'End time is required.'
    valid = false
  }

  if (startLocal.value && endLocal.value) {
    const s = new Date(startLocal.value).getTime()
    const e = new Date(endLocal.value).getTime()
    if (e <= s) {
      errors.value.end = 'End time must be after Start time.'
      valid = false
    }
  }

  return valid
}

async function handleSubmit(): Promise<void> {
  if (!validate()) return

  isSubmitting.value = true
  apiErrorMessage.value = null

  const startIso = fromDateTimeLocalToIso(startLocal.value)
  const endIso = fromDateTimeLocalToIso(endLocal.value)
  const taskIdNum = effectiveTaskId.value as number

  try {
    if (isEditing.value && timeEntriesStore.activeEntryForEdit) {
      await timeEntriesStore.updateEntry(timeEntriesStore.activeEntryForEdit.id, {
        taskId: taskIdNum,
        comment: comment.value.trim(),
        start: startIso,
        end: endIso
      })
    } else {
      await timeEntriesStore.createEntry({
        taskId: taskIdNum,
        comment: comment.value.trim(),
        start: startIso,
        end: endIso
      })
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      apiErrorMessage.value = err.message
    } else {
      apiErrorMessage.value = 'An unexpected API error occurred.'
    }
  } finally {
    isSubmitting.value = false
  }
}

function close(): void {
  timeEntriesStore.isFormModalOpen = false
  timeEntriesStore.activeEntryForEdit = null
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.modal-card {
  width: 100%;
  max-width: 580px;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalPop {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.modal-icon {
  color: var(--color-primary);
}

.modal-header h2 {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.modal-form {
  display: flex;
  flex-direction: column;
}

.modal-content {
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-height: calc(85vh - 140px);
  overflow-y: auto;
}

.form-error-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  font-size: 0.85rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 0.825rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.required {
  color: #ef4444;
}

.task-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-select,
.form-input,
.form-textarea {
  width: 100%;
  padding: 8px 12px;
  background: var(--surface-subtle);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.85rem;
  transition: all 0.2s ease;
  font-family: inherit;
}

.form-select:focus,
.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15);
}

.has-error {
  border-color: #ef4444 !important;
}

.field-error {
  font-size: 0.75rem;
  color: #ef4444;
}

.field-caption-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.char-count {
  font-size: 0.725rem;
  color: var(--text-muted);
  margin-left: auto;
}

.time-range-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.duration-preview-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--surface-subtle);
  border: 1px solid var(--border-color);
  flex-wrap: wrap;
}

.preview-metric {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-label {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.preview-val {
  font-size: 0.95rem;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  color: #10b981;
}

.preview-val.invalid {
  color: #ef4444;
}

.quick-preset-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.chip-btn {
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 0.725rem;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.chip-btn:hover {
  background: var(--surface-card-hover);
  color: var(--text-primary);
  border-color: var(--color-primary);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  background: var(--surface-subtle);
}

@media (max-width: 520px) {
  .time-range-grid {
    grid-template-columns: 1fr;
  }
}
</style>
