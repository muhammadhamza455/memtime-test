<template>
  <div
    class="tree-node task-node"
    :class="{
      selected: hierarchyStore.selectedTaskId === task.id,
      filtered: timeEntriesStore.filterTaskId === task.id
    }"
    @click="onSelectTask"
  >
    <div class="node-line-guide"></div>
    <div class="node-main">
      <div class="node-indicator">
        <CheckSquare :size="14" class="task-icon" />
      </div>

      <div class="node-info">
        <span class="node-title">{{ task.name }}</span>
        <div class="node-meta">
          <span class="meta-tag id-tag">#{{ task.id }}</span>
          <span class="status-pill" :class="`status-${task.status}`">
            {{ task.status }}
          </span>
        </div>
      </div>

      <div class="node-actions" @click.stop>
        <button
          type="button"
          class="btn-action-pill"
          :class="{ active: timeEntriesStore.filterTaskId === task.id }"
          @click="toggleTaskFilter"
          :title="timeEntriesStore.filterTaskId === task.id ? 'Clear task filter' : 'Filter time entries by this task'"
        >
          <Filter :size="12" />
          <span>{{ timeEntriesStore.filterTaskId === task.id ? 'Filtered' : 'Filter' }}</span>
        </button>

        <button
          type="button"
          class="btn-action-pill btn-primary-pill"
          @click="logTimeForTask"
          title="Create time entry for this task"
        >
          <Plus :size="12" />
          <span>Log Time</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHierarchyStore } from '../../stores/hierarchy'
import { useTimeEntriesStore } from '../../stores/timeEntries'
import type { Task } from '../../types'
import { CheckSquare, Filter, Plus } from 'lucide-vue-next'

const props = defineProps<{
  task: Task
  projectId: number
  clientId: number
}>()

const hierarchyStore = useHierarchyStore()
const timeEntriesStore = useTimeEntriesStore()

function onSelectTask(): void {
  hierarchyStore.selectTask(props.task)
}

function toggleTaskFilter(): void {
  if (timeEntriesStore.filterTaskId === props.task.id) {
    timeEntriesStore.clearTaskFilter()
  } else {
    timeEntriesStore.setFilterTaskId(props.task.id)
  }
}

function logTimeForTask(): void {
  timeEntriesStore.openCreateModal(props.task.id)
}
</script>

<style scoped>
.task-node {
  padding-left: 48px;
  position: relative;
}

.node-line-guide {
  position: absolute;
  left: 32px;
  top: -12px;
  bottom: 50%;
  width: 12px;
  border-left: 1px dashed var(--border-color);
  border-bottom: 1px dashed var(--border-color);
  pointer-events: none;
}

.node-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--surface-subtle);
  border: 1px solid transparent;
  transition: all 0.15s ease;
  cursor: pointer;
}

.node-main:hover {
  background: var(--surface-card-hover);
  border-color: var(--border-color);
}

.task-node.selected .node-main {
  border-color: var(--color-primary);
  background: rgba(14, 165, 233, 0.08);
}

.task-node.filtered .node-main {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.08);
}

.node-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #38bdf8;
}

.node-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.node-title {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.meta-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--surface-card);
  color: var(--text-muted);
  border: 1px solid var(--border-color);
}

.status-pill {
  font-size: 0.7rem;
  padding: 1px 8px;
  border-radius: 10px;
  font-weight: 600;
  text-transform: capitalize;
}

.status-in-progress,
.status-active {
  background: rgba(56, 189, 248, 0.12);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.status-completed {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.status-pending {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.node-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.85;
  transition: opacity 0.15s ease;
}

.node-main:hover .node-actions {
  opacity: 1;
}

.btn-action-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 0.725rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-action-pill:hover {
  background: var(--surface-subtle);
  color: var(--text-primary);
  border-color: var(--text-muted);
}

.btn-action-pill.active {
  background: rgba(16, 185, 129, 0.15);
  border-color: #10b981;
  color: #10b981;
}

.btn-primary-pill {
  background: rgba(14, 165, 233, 0.12);
  border-color: rgba(14, 165, 233, 0.35);
  color: #38bdf8;
}

.btn-primary-pill:hover {
  background: rgba(14, 165, 233, 0.25);
  border-color: #38bdf8;
  color: #ffffff;
}
</style>
