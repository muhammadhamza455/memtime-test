<template>
  <div class="hierarchy-panel">
    <div class="panel-header">
      <div class="header-title-row">
        <div class="title-with-icon">
          <Layers :size="18" class="title-icon" />
          <h2 class="panel-title">Client & Task Hierarchy</h2>
        </div>
        <div class="header-actions">
          <button
            type="button"
            class="btn-icon btn-sm"
            @click="hierarchyStore.refreshHierarchy()"
            title="Refresh tree data"
            aria-label="Refresh hierarchy"
          >
            <RefreshCw :size="14" :class="{ spinning: hierarchyStore.clientsLoading }" />
          </button>
        </div>
      </div>

      <div class="search-bar">
        <Search :size="15" class="search-icon" />
        <input
          v-model="hierarchyStore.searchQuery"
          type="text"
          class="search-input"
          placeholder="Filter clients, projects, or tasks..."
        />
        <button
          v-if="hierarchyStore.searchQuery"
          type="button"
          class="clear-btn"
          @click="hierarchyStore.searchQuery = ''"
          aria-label="Clear search"
        >
          <X :size="13" />
        </button>
      </div>

      <div class="tree-controls-bar">
        <div class="quick-toggles">
          <button
            type="button"
            class="btn-text-sm"
            @click="hierarchyStore.expandAllCurrent()"
          >
            <ChevronDown :size="13" />
            <span>Expand All</span>
          </button>
          <button
            type="button"
            class="btn-text-sm"
            @click="hierarchyStore.collapseAll()"
          >
            <ChevronUp :size="13" />
            <span>Collapse</span>
          </button>
        </div>

        <div class="pagination-mini">
          <select
            :value="hierarchyStore.clientLimit"
            @change="onClientLimitChange"
            class="tree-limit-select"
            title="Clients per page"
          >
            <option :value="5">5 / pg</option>
            <option :value="10">10 / pg</option>
            <option :value="20">20 / pg</option>
          </select>
          <span class="pagination-info">
            {{
              hierarchyStore.clients.length === 0
                ? '0'
                : `${hierarchyStore.clientOffset + 1}–${hierarchyStore.clientOffset + hierarchyStore.clients.length}`
            }}
          </span>
          <div class="btn-group-mini">
            <button
              type="button"
              class="btn-icon btn-xs"
              :disabled="hierarchyStore.clientOffset === 0 || hierarchyStore.clientsLoading"
              @click="prevPage"
              aria-label="Previous page"
            >
              <ChevronLeft :size="13" />
            </button>
            <button
              type="button"
              class="btn-icon btn-xs"
              :disabled="!hierarchyStore.hasMoreClients || hierarchyStore.clientsLoading"
              @click="nextPage"
              aria-label="Next page"
            >
              <ChevronRight :size="13" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="panel-body">
      <div v-if="hierarchyStore.clientsLoading && hierarchyStore.clients.length === 0" class="tree-skeleton-list">
        <div v-for="n in 5" :key="n" class="skeleton-client-row">
          <div class="skeleton-block skeleton-arrow"></div>
          <div class="skeleton-block skeleton-avatar"></div>
          <div class="skeleton-block skeleton-text"></div>
        </div>
      </div>

      <div v-else-if="hierarchyStore.clientsError" class="tree-error-banner">
        <AlertCircle :size="18" />
        <div class="error-content">
          <span class="error-title">Failed to load hierarchy</span>
          <span class="error-desc">{{ hierarchyStore.clientsError }}</span>
        </div>
        <button
          type="button"
          class="btn btn-sm btn-outline"
          @click="hierarchyStore.fetchClients(hierarchyStore.clientOffset, true)"
        >
          Retry
        </button>
      </div>

      <div v-else-if="hierarchyStore.filteredClients.length === 0" class="tree-empty-state">
        <FolderSearch :size="32" class="empty-icon" />
        <p class="empty-title">No matching hierarchy nodes</p>
        <p class="empty-desc">Try modifying your search filter</p>
      </div>

      <div v-else class="tree-nodes-container">
        <ClientNode
          v-for="client in hierarchyStore.filteredClients"
          :key="client.id"
          :client="client"
        />
      </div>
    </div>

    <div class="panel-footer">
      <div class="footer-tip">
        <Info :size="13" />
        <span>Nodes fetch on-demand to protect the 15 req/min rate limit.</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useHierarchyStore } from '../../stores/hierarchy'
import ClientNode from './ClientNode.vue'
import {
  Layers,
  RefreshCw,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  FolderSearch,
  Info
} from 'lucide-vue-next'

const hierarchyStore = useHierarchyStore()

function onClientLimitChange(event: Event): void {
  const target = event.target as HTMLSelectElement
  hierarchyStore.setClientLimit(parseInt(target.value, 10))
}

function prevPage(): void {
  const newOffset = Math.max(0, hierarchyStore.clientOffset - hierarchyStore.clientLimit)
  hierarchyStore.fetchClients(newOffset)
}

function nextPage(): void {
  const newOffset = hierarchyStore.clientOffset + hierarchyStore.clientLimit
  hierarchyStore.fetchClients(newOffset)
}

onMounted(() => {
  if (hierarchyStore.clients.length === 0) {
    hierarchyStore.fetchClients()
  }
})
</script>

<style scoped>
.hierarchy-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.panel-header {
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--surface-card);
}

.header-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title-with-icon {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-icon {
  color: var(--color-primary);
}

.panel-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.search-bar {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 7px 32px 7px 34px;
  background: var(--surface-subtle);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.825rem;
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15);
}

.clear-btn {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.tree-controls-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 2px;
}

.quick-toggles {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-text-sm {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.btn-text-sm:hover {
  color: var(--text-primary);
  background: var(--surface-subtle);
}

.pagination-mini {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tree-limit-select {
  background: var(--surface-subtle);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  border-radius: 4px;
  padding: 1px 4px;
  font-size: 0.7rem;
  font-family: 'JetBrains Mono', monospace;
}

.pagination-info {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.725rem;
  color: var(--text-muted);
}

.btn-group-mini {
  display: flex;
  align-items: center;
  gap: 2px;
}

.btn-xs {
  padding: 3px;
  border-radius: 4px;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px;
}

.tree-nodes-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tree-skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-client-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
}

.skeleton-block {
  background: var(--surface-subtle);
  border-radius: 6px;
  animation: pulse 1.5s infinite;
}

.skeleton-arrow {
  width: 14px;
  height: 14px;
}

.skeleton-avatar {
  width: 24px;
  height: 24px;
}

.skeleton-text {
  flex: 1;
  height: 16px;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

.tree-error-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 10px;
  color: #ef4444;
}

.error-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.error-title {
  font-weight: 600;
  font-size: 0.85rem;
}

.error-desc {
  font-size: 0.775rem;
  opacity: 0.9;
}

.tree-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  color: var(--text-muted);
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-primary);
  margin: 0 0 4px;
}

.empty-desc {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0;
}

.panel-footer {
  padding: 10px 16px;
  border-top: 1px solid var(--border-color);
  background: var(--surface-subtle);
}

.footer-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.725rem;
  color: var(--text-muted);
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
