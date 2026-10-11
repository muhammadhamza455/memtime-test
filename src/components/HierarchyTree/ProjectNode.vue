<template>
  <div class="project-branch">
    <div
      class="tree-node project-node"
      :class="{ expanded: isExpanded }"
      @click="toggle"
    >
      <div class="node-line-guide"></div>
      <div class="node-main">
        <button
          type="button"
          class="chevron-btn"
          :class="{ rotated: isExpanded }"
          aria-label="Toggle project tasks"
          @click.stop="toggle"
        >
          <ChevronRight :size="15" />
        </button>

        <div class="node-icon-box">
          <Folder :size="15" class="project-icon" />
        </div>

        <div class="node-info">
          <span class="node-title">{{ project.name }}</span>
          <div class="node-meta">
            <span class="meta-tag id-tag">#{{ project.id }}</span>
            <span class="status-pill" :class="`status-${project.status}`">
              {{ project.status }}
            </span>
          </div>
        </div>

        <div class="node-badge-count">
          <span v-if="tasks.length > 0" class="count-pill">
            {{ tasks.length }} {{ tasks.length === 1 ? 'task' : 'tasks' }}
          </span>
          <RefreshCw v-if="isLoading" class="spinning-icon" :size="13" />
        </div>
      </div>
    </div>

    <div v-if="isExpanded" class="project-children">
      <div v-if="isLoading && tasks.length === 0" class="node-state-message">
        <RefreshCw class="spinning-icon" :size="14" />
        <span>Loading project tasks...</span>
      </div>

      <div v-else-if="errorMessage" class="node-error-message">
        <AlertCircle :size="14" />
        <span>{{ errorMessage }}</span>
        <button
          type="button"
          class="btn-retry"
          @click.stop="retry"
        >
          Retry
        </button>
      </div>

      <div v-else-if="tasks.length === 0" class="node-state-message empty">
        <span>No tasks found in this project</span>
      </div>

      <template v-else>
        <TaskNode
          v-for="task in tasks"
          :key="task.id"
          :task="task"
          :project-id="project.id"
          :client-id="clientId"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useHierarchyStore } from '../../stores/hierarchy'
import type { Project } from '../../types'
import TaskNode from './TaskNode.vue'
import {
  ChevronRight,
  Folder,
  RefreshCw,
  AlertCircle
} from 'lucide-vue-next'

const props = defineProps<{
  project: Project
  clientId: number
}>()

const hierarchyStore = useHierarchyStore()

const isExpanded = computed(() => hierarchyStore.isProjectExpanded(props.project.id))
const isLoading = computed(() => hierarchyStore.isProjectLoading(props.project.id))
const tasks = computed(() => hierarchyStore.getProjectTasks(props.project.id))
const errorMessage = computed(() => hierarchyStore.tasksError.get(props.project.id))

function toggle(): void {
  hierarchyStore.toggleProject(props.project.id)
}

function retry(): void {
  hierarchyStore.fetchProjectTasks(props.project.id, true)
}
</script>

<style scoped>
.project-branch {
  position: relative;
}

.project-node {
  padding-left: 24px;
  position: relative;
}

.node-line-guide {
  position: absolute;
  left: 12px;
  top: -10px;
  bottom: 50%;
  width: 12px;
  border-left: 1px dashed var(--border-color);
  border-bottom: 1px dashed var(--border-color);
  pointer-events: none;
}

.node-main {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.15s ease;
}

.node-main:hover {
  background: var(--surface-card-hover);
  border-color: rgba(56, 189, 248, 0.3);
}

.chevron-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), color 0.15s ease;
}

.chevron-btn.rotated {
  transform: rotate(90deg);
  color: var(--text-primary);
}

.node-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #38bdf8;
}

.node-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.node-title {
  font-size: 0.875rem;
  font-weight: 600;
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
  background: var(--surface-subtle);
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

.count-pill {
  font-size: 0.7rem;
  padding: 2px 7px;
  border-radius: 10px;
  background: var(--surface-subtle);
  color: var(--text-muted);
  border: 1px solid var(--border-color);
}

.project-children {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}

.node-state-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 8px 48px;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.node-error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 8px 48px;
  font-size: 0.8rem;
  color: #ef4444;
}

.btn-retry {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
}

.spinning-icon {
  animation: spin 1s linear infinite;
  color: var(--color-primary);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
