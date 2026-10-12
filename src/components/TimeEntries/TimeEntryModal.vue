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
        <button type="button" class="btn-icon" :disabled="isSubmitting" @click="close" aria-label="Close modal">
          <X :size="18" />
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="modal-form" novalidate>
        <div class="modal-content">
          <div v-if="apiErrorMessage" class="form-error-banner" role="alert">
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
                <option value="">-- Select a task --</option>
                <optgroup v-for="group in hierarchyStore.taskOptionGroups" :key="group.label" :label="group.label">
                  <option v-for="task in group.tasks" :key="task.id" :value="task.id">
                    #{{ task.id }} - {{ task.name }}
                  </option>
                </optgroup>
                <option value="custom">Enter a task ID manually...</option>
              </select>

              <div v-if="selectedTaskOption === 'custom'" class="manual-task-row">
                <input
                  id="entry-task-id"
                  v-model.number="customTaskId"
                  type="number"
                  min="1"
                  step="1"
                  inputmode="numeric"
                  class="form-input"
                  placeholder="Numeric task ID"
                  aria-label="Task ID"
                  :class="{ 'has-error': errors.taskId }"
                />
              </div>
            </div>
            <span v-if="errors.taskId" class="field-error">{{ errors.taskId }}</span>
            <span v-else-if="hierarchyStore.loadedTaskCount === 0" class="char-count">
              Tip: expand a project in the hierarchy to pick its tasks by name.
            </span>
          </div>

          <div class="form-group">
            <label for="entry-comment">
              Comment / Activity Description <span class="required">*</span>
            </label>
            <textarea
              id="entry-comment"
              ref="commentInput"
              v-model="comment"
              rows="3"
              maxlength="1000"
              class="form-textarea"
              placeholder="Describe what you worked on... (Ctrl+Enter to save)"
              :class="{ 'has-error': errors.comment }"
              @keydown.enter.ctrl.prevent="handleSubmit"
              @keydown.enter.meta.prevent="handleSubmit"
            ></textarea>
            <div class="field-caption-row">
              <span v-if="errors.comment" class="field-error">{{ errors.comment }}</span>
              <span class="char-count">{{ comment.length }} / 1000</span>
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
              <span class="preview-label">Duration:</span>
              <span class="preview-val" :class="{ invalid: calculatedDurationSecs <= 0 }">
                {{ formatDuration(calculatedDurationSecs) }}
              </span>
              <span v-if="durationWarning" class="char-count">{{ durationWarning }}</span>
            </div>

            <div class="quick-preset-chips" aria-label="Set duration from start time">
              <button
                v-for="minutes in DURATION_PRESETS"
                :key="minutes"
                type="button"
                class="chip-btn"
                :title="`Set end time to start + ${formatDuration(minutes * 60)}`"
                @click="applyPreset(minutes)"
              >
                {{ formatDuration(minutes * 60) }}
              </button>
              <button type="button" class="chip-btn" title="Set end time to now" @click="setEndToNow">
                End now
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
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useTimeEntriesStore } from '../../stores/timeEntries'
import { useHierarchyStore } from '../../stores/hierarchy'
import { useTimerStore } from '../../stores/timer'
import { useToastStore } from '../../stores/toast'
import { isApiError } from '../../services/api'
import {
  toDateTimeLocalString,
  fromDateTimeLocalToIso,
  calculateDurationBetween,
  formatDuration
} from '../../utils/date'
import { Clock, X, AlertCircle, Check } from 'lucide-vue-next'

const DURATION_PRESETS = [15, 30, 60, 120]

const timeEntriesStore = useTimeEntriesStore()
const hierarchyStore = useHierarchyStore()
const timerStore = useTimerStore()
const toast = useToastStore()

const isEditing = computed(() => !!timeEntriesStore.activeEntryForEdit)

const selectedTaskOption = ref<number | 'custom' | ''>('')
const customTaskId = ref<number | null>(null)
const comment = ref('')
const startLocal = ref('')
const endLocal = ref('')
// datetime-local only has minute precision. Keep the exact ISO values the form
// was opened with and send them unchanged unless the user edits the field, so
// editing only the comment does not silently truncate seconds.
const originalStartIso = ref('')
const originalEndIso = ref('')
const isSubmitting = ref(false)
const apiErrorMessage = ref<string | null>(null)
const commentInput = ref<HTMLTextAreaElement | null>(null)

const errors = ref({ taskId: '', comment: '', start: '', end: '' })

const effectiveTaskId = computed<number | null>(() => {
  if (selectedTaskOption.value === 'custom') return customTaskId.value
  return typeof selectedTaskOption.value === 'number' ? selectedTaskOption.value : null
})

function resolveIso(local: string, original: string): string {
  if (original && local === toDateTimeLocalString(new Date(original))) return original
  return fromDateTimeLocalToIso(local)
}

const startIso = computed(() => resolveIso(startLocal.value, originalStartIso.value))
const endIso = computed(() => resolveIso(endLocal.value, originalEndIso.value))
const calculatedDurationSecs = computed(() => calculateDurationBetween(startIso.value, endIso.value))

const durationWarning = computed(() => {
  if (calculatedDurationSecs.value > 12 * 3600) return 'Longer than 12 hours. Please double-check.'
  if (endIso.value && new Date(endIso.value).getTime() > Date.now() + 5 * 60_000) return 'Ends in the future.'
  return ''
})

function selectTask(taskId: number | null | undefined): void {
  customTaskId.value = null
  if (taskId === null || taskId === undefined) {
    selectedTaskOption.value = ''
  } else if (hierarchyStore.findTask(taskId)) {
    selectedTaskOption.value = taskId
  } else {
    selectedTaskOption.value = 'custom'
    customTaskId.value = taskId
  }
}

function setTimes(start: string, end: string): void {
  originalStartIso.value = start
  originalEndIso.value = end
  startLocal.value = toDateTimeLocalString(new Date(start))
  endLocal.value = toDateTimeLocalString(new Date(end))
}

watch(
  () => timeEntriesStore.isFormModalOpen,
  (open) => {
    if (!open) return
    apiErrorMessage.value = null
    errors.value = { taskId: '', comment: '', start: '', end: '' }

    const editing = timeEntriesStore.activeEntryForEdit
    if (editing) {
      selectTask(editing.taskId)
      comment.value = editing.comment
      setTimes(editing.start, editing.end)
    } else {
      const prefill = timeEntriesStore.formPrefill ?? {}
      selectTask(prefill.taskId ?? timeEntriesStore.filterTaskId ?? hierarchyStore.selectedTaskId)
      comment.value = prefill.comment ?? ''
      if (prefill.start && prefill.end) {
        setTimes(prefill.start, prefill.end)
      } else {
        originalStartIso.value = ''
        originalEndIso.value = ''
        const now = new Date()
        startLocal.value = toDateTimeLocalString(new Date(now.getTime() - 3600 * 1000))
        endLocal.value = toDateTimeLocalString(now)
      }
    }

    nextTick(() => {
      if (effectiveTaskId.value !== null) commentInput.value?.focus()
      else document.getElementById('entry-task-select')?.focus()
    })
  },
  { immediate: true }
)

function applyPreset(minutes: number): void {
  if (!startLocal.value) startLocal.value = toDateTimeLocalString(new Date())
  const start = new Date(startIso.value)
  endLocal.value = toDateTimeLocalString(new Date(start.getTime() + minutes * 60 * 1000))
}

function setEndToNow(): void {
  endLocal.value = toDateTimeLocalString(new Date())
}

function validate(): boolean {
  let valid = true
  errors.value = { taskId: '', comment: '', start: '', end: '' }

  const taskId = effectiveTaskId.value
  if (taskId === null || !Number.isInteger(taskId) || taskId <= 0) {
    errors.value.taskId =
      selectedTaskOption.value === 'custom' ? 'Enter a valid, positive whole-number task ID.' : 'Please select a task.'
    valid = false
  }

  if (!comment.value.trim()) {
    errors.value.comment = 'Please describe what you worked on.'
    valid = false
  }

  if (!startIso.value) {
    errors.value.start = 'Start time is required.'
    valid = false
  }

  if (!endIso.value) {
    errors.value.end = 'End time is required.'
    valid = false
  }

  if (startIso.value && endIso.value && new Date(endIso.value) <= new Date(startIso.value)) {
    errors.value.end = 'End time must be after start time.'
    valid = false
  }

  return valid
}

function showApiError(err: unknown): void {
  if (!isApiError(err)) {
    apiErrorMessage.value = err instanceof Error ? err.message : 'An unexpected error occurred.'
    return
  }
  // POST/PUT return 404 both for an unknown task and for an unknown entry.
  if (err.status === 404 && /task/i.test(err.message) && !/time entry/i.test(err.message)) {
    errors.value.taskId = `${err.message}. Check the task ID or pick a task from the list.`
    return
  }
  if (err.status === 404) {
    apiErrorMessage.value = `${err.message}. It may have been deleted in the meantime; the list has been refreshed.`
    return
  }
  if (err.status === 400) {
    apiErrorMessage.value = `The server rejected this entry: ${err.message}`
    return
  }
  apiErrorMessage.value = err.message
}

async function handleSubmit(): Promise<void> {
  if (isSubmitting.value || !validate()) return

  const payload = {
    taskId: effectiveTaskId.value as number,
    comment: comment.value.trim(),
    start: startIso.value,
    end: endIso.value
  }

  const editing = timeEntriesStore.activeEntryForEdit
  if (
    editing &&
    editing.taskId === payload.taskId &&
    editing.comment === payload.comment &&
    editing.start === payload.start &&
    editing.end === payload.end
  ) {
    toast.info('No changes to save.')
    close()
    return
  }

  isSubmitting.value = true
  apiErrorMessage.value = null
  const fromTimer = timeEntriesStore.formSource === 'timer'
  try {
    if (editing) {
      await timeEntriesStore.updateEntry(editing.id, payload)
    } else {
      await timeEntriesStore.createEntry(payload)
      if (fromTimer) timerStore.reset()
    }
  } catch (err: unknown) {
    showApiError(err)
  } finally {
    isSubmitting.value = false
  }
}

function close(): void {
  if (isSubmitting.value) return
  if (timeEntriesStore.formSource === 'timer' && timerStore.isRunning) {
    toast.info('Timer is paused. Resume it or log the time later.')
  }
  timeEntriesStore.closeFormModal()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && timeEntriesStore.isFormModalOpen) close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
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
