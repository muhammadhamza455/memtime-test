<template>
  <div class="client-branch">
    <div
      class="tree-node client-node"
      :class="{ expanded: isExpanded }"
      @click="toggle"
    >
      <div class="node-main">
        <button
          type="button"
          class="chevron-btn"
          :class="{ rotated: isExpanded }"
          aria-label="Toggle client projects"
          @click.stop="toggle"
        >
          <ChevronRight :size="16" />
        </button>

        <div class="node-icon-box">
          <Building2 :size="16" class="client-icon" />
        </div>

        <div class="node-info">
          <div class="title-row">
            <span class="node-title">{{ client.name }}</span>
            <span class="meta-tag id-tag">#{{ client.id }}</span>
            <span class="status-pill" :class="`status-${client.status}`">
              {{ client.status }}
            </span>
          </div>
          <div v-if="client.description" class="node-desc">
            {{ client.description }}
          </div>
        </div>

        <div class="node-badge-count">
          <span v-if="projects.length > 0" class="count-pill">
            {{ projects.length }} {{ projects.length === 1 ? 'project' : 'projects' }}
          </span>
          <RefreshCw v-if="isLoading" class="spinning-icon" :size="14" />
        </div>
      </div>
    </div>

    <div v-if="isExpanded" class="client-children">
      <div v-if="isLoading && projects.length === 0" class="node-state-message">
        <RefreshCw class="spinning-icon" :size="14" />
        <span>Loading client projects...</span>
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

      <div v-else-if="projects.length === 0" class="node-state-message empty">
        <span>No projects found for this client</span>
      </div>

      <template v-else>
        <ProjectNode
          v-for="project in projects"
          :key="project.id"
          :project="project"
          :client-id="client.id"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useHierarchyStore } from '../../stores/hierarchy'
import type { Client } from '../../types'
import ProjectNode from './ProjectNode.vue'
import {
  ChevronRight,
  Building2,
  RefreshCw,
  AlertCircle
} from 'lucide-vue-next'

const props = defineProps<{
  client: Client
}>()

const hierarchyStore = useHierarchyStore()

const isExpanded = computed(() => hierarchyStore.isClientExpanded(props.client.id))
const isLoading = computed(() => hierarchyStore.isClientLoading(props.client.id))
const projects = computed(() => hierarchyStore.getClientProjects(props.client.id))
const errorMessage = computed(() => hierarchyStore.projectsError.get(props.client.id))

function toggle(): void {
  hierarchyStore.toggleClient(props.client.id)
}

function retry(): void {
  hierarchyStore.fetchClientProjects(props.client.id, true)
}
</script>

<style scoped>
.client-branch {
  display: flex;
  flex-direction: column;
}

.client-node {
  position: relative;
}

.node-main {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s ease;
}

.node-main:hover {
  background: var(--surface-card-hover);
  border-color: rgba(14, 165, 233, 0.4);
  transform: translateX(2px);
}

.client-node.expanded .node-main {
  border-color: rgba(14, 165, 233, 0.5);
  background: var(--surface-card-hover);
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
  color: var(--color-primary);
}

.node-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(14, 165, 233, 0.12);
  color: #38bdf8;
}

.node-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.node-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
}

.node-desc {
  font-size: 0.775rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 480px;
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
  font-size: 0.75rem;
  padding: 3px 8px;
  border-radius: 12px;
  background: var(--surface-subtle);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  font-weight: 500;
}

.client-children {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
  margin-bottom: 4px;
}

.node-state-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px 8px 36px;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.node-error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px 8px 36px;
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
