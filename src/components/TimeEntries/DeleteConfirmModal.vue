<template>
  <div v-if="timeEntriesStore.isDeleteModalOpen" class="modal-overlay" @click.self="close">
    <div class="modal-card modal-sm" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
      <div class="modal-header modal-header-danger">
        <div class="modal-title-group">
          <AlertTriangle class="modal-icon text-danger" :size="20" />
          <h2 id="delete-modal-title">Delete Time Entry</h2>
        </div>
        <button type="button" class="btn-icon" @click="close" aria-label="Close modal">
          <X :size="18" />
        </button>
      </div>

      <div class="modal-content">
        <p class="delete-warning-text">
          Are you sure you want to delete time entry
          <strong>#{{ timeEntriesStore.deleteTargetEntry?.id }}</strong>?
        </p>

        <div v-if="timeEntriesStore.deleteTargetEntry" class="entry-delete-preview">
          <div class="preview-row">
            <span class="preview-label">Task ID:</span>
            <span class="preview-val">#{{ timeEntriesStore.deleteTargetEntry.taskId }}</span>
          </div>
          <div class="preview-row">
            <span class="preview-label">Comment:</span>
            <span class="preview-val">{{ timeEntriesStore.deleteTargetEntry.comment }}</span>
          </div>
          <div class="preview-row">
            <span class="preview-label">Duration:</span>
            <span class="preview-val">
              {{
                formatDuration(
                  calculateDurationBetween(
                    timeEntriesStore.deleteTargetEntry.start,
                    timeEntriesStore.deleteTargetEntry.end
                  )
                )
              }}
            </span>
          </div>
        </div>

        <p class="delete-subtext">This action cannot be undone.</p>
      </div>

      <div class="modal-footer">
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="timeEntriesStore.mutating"
          @click="close"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-danger"
          :disabled="timeEntriesStore.mutating"
          @click="confirmDelete"
        >
          <Trash2 :size="15" />
          <span>{{ timeEntriesStore.mutating ? 'Deleting...' : 'Delete Entry' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useTimeEntriesStore } from '../../stores/timeEntries'
import { formatDuration, calculateDurationBetween } from '../../utils/date'
import { AlertTriangle, X, Trash2 } from 'lucide-vue-next'

const timeEntriesStore = useTimeEntriesStore()

function close(): void {
  if (timeEntriesStore.mutating) return
  timeEntriesStore.closeDeleteModal()
}

async function confirmDelete(): Promise<void> {
  if (timeEntriesStore.deleteTargetEntry && !timeEntriesStore.mutating) {
    await timeEntriesStore.deleteEntry(timeEntriesStore.deleteTargetEntry.id)
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && timeEntriesStore.isDeleteModalOpen) close()
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
  max-width: 440px;
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
  padding: 18px 22px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header-danger {
  background: rgba(239, 68, 68, 0.08);
}

.modal-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.text-danger {
  color: #ef4444;
}

.modal-header h2 {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.modal-content {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.delete-warning-text {
  font-size: 0.9rem;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.5;
}

.entry-delete-preview {
  background: var(--surface-subtle);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.825rem;
}

.preview-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.preview-label {
  color: var(--text-muted);
}

.preview-val {
  font-weight: 600;
  color: var(--text-primary);
  text-align: right;
  word-break: break-word;
}

.delete-subtext {
  font-size: 0.775rem;
  color: #ef4444;
  margin: 0;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 22px;
  border-top: 1px solid var(--border-color);
  background: var(--surface-subtle);
}
</style>
