<template>
  <div class="entries-panel">
    <div class="panel-header">
      <div class="header-top-row">
        <div class="title-with-icon">
          <ListFilter :size="18" class="title-icon" />
          <h2 class="panel-title">Time Entries</h2>
          <span class="count-badge">{{ timeEntriesStore.totalFilteredCount }}</span>
        </div>

        <div class="header-actions">
          <button
            type="button"
            class="btn btn-outline btn-sm"
            :disabled="timeEntriesStore.loading"
            @click="timeEntriesStore.fetchEntries(true)"
            title="Refresh time entries"
          >
            <RefreshCw :size="14" :class="{ spinning: timeEntriesStore.loading }" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            @click="timeEntriesStore.openCreateModal()"
          >
            <Plus :size="14" />
            <span>New Entry</span>
          </button>
        </div>
      </div>

      <div class="metrics-row">
        <div class="metric-card">
          <Clock :size="16" class="metric-icon primary" />
          <div class="metric-info">
            <span class="metric-label">Total Recorded Time</span>
            <span class="metric-val">{{ formatDuration(timeEntriesStore.totalDurationSeconds) }}</span>
          </div>
        </div>

        <div class="metric-card">
          <CheckSquare :size="16" class="metric-icon success" />
          <div class="metric-info">
            <span class="metric-label">Logged Entries</span>
            <span class="metric-val">{{ timeEntriesStore.allMergedEntries.length }}</span>
          </div>
        </div>

        <div class="metric-card">
          <Filter :size="16" class="metric-icon info" />
          <div class="metric-info">
            <span class="metric-label">Active Task Scope</span>
            <span class="metric-val">
              {{ timeEntriesStore.filterTaskId !== null ? `Task #${timeEntriesStore.filterTaskId}` : 'All Tasks' }}
            </span>
          </div>
        </div>
      </div>

      <div class="filter-controls-row">
        <div class="search-bar">
          <Search :size="15" class="search-icon" />
          <input
            v-model="timeEntriesStore.searchFilter"
            type="text"
            class="search-input"
            placeholder="Search entries by comment, task ID, or entry ID..."
          />
          <button
            v-if="timeEntriesStore.searchFilter"
            type="button"
            class="clear-btn"
            @click="timeEntriesStore.searchFilter = ''"
            aria-label="Clear filter"
          >
            <X :size="13" />
          </button>
        </div>

        <div v-if="timeEntriesStore.filterTaskId !== null" class="filter-chip">
          <span>Task Filter: <strong>#{{ timeEntriesStore.filterTaskId }}</strong></span>
          <button
            type="button"
            class="chip-remove-btn"
            @click="timeEntriesStore.clearTaskFilter()"
            title="Clear task filter"
          >
            <X :size="12" />
          </button>
        </div>
      </div>
    </div>

    <div class="panel-body">
      <div v-if="timeEntriesStore.loading && timeEntriesStore.paginatedEntries.length === 0" class="entries-loading-state">
        <RefreshCw :size="24" class="spinning" />
        <span>Loading time entries...</span>
      </div>

      <div v-else-if="timeEntriesStore.paginatedEntries.length === 0" class="entries-empty-state">
        <Clock :size="36" class="empty-icon" />
        <p class="empty-title">No time entries found</p>
        <p class="empty-desc">
          {{
            timeEntriesStore.filterTaskId !== null
              ? `No entries recorded for Task #${timeEntriesStore.filterTaskId}.`
              : 'Create your first time entry or select a task from the hierarchy.'
          }}
        </p>
        <button
          type="button"
          class="btn btn-primary btn-sm mt-3"
          @click="timeEntriesStore.openCreateModal(timeEntriesStore.filterTaskId ?? undefined)"
        >
          <Plus :size="14" />
          <span>Log Time Now</span>
        </button>
      </div>

      <div v-else class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th @click="timeEntriesStore.toggleSort('id')" class="sortable-th">
                <div class="th-content">
                  <span>ID</span>
                  <ArrowUpDown :size="12" />
                </div>
              </th>
              <th @click="timeEntriesStore.toggleSort('taskId')" class="sortable-th">
                <div class="th-content">
                  <span>Task ID</span>
                  <ArrowUpDown :size="12" />
                </div>
              </th>
              <th>Breadcrumb / Context</th>
              <th>Comment</th>
              <th @click="timeEntriesStore.toggleSort('start')" class="sortable-th">
                <div class="th-content">
                  <span>Start Time</span>
                  <ArrowUpDown :size="12" />
                </div>
              </th>
              <th @click="timeEntriesStore.toggleSort('end')" class="sortable-th">
                <div class="th-content">
                  <span>End Time</span>
                  <ArrowUpDown :size="12" />
                </div>
              </th>
              <th>Duration</th>
              <th @click="timeEntriesStore.toggleSort('createdAt')" class="sortable-th">
                <div class="th-content">
                  <span>Created At</span>
                  <ArrowUpDown :size="12" />
                </div>
              </th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in timeEntriesStore.paginatedEntries"
              :key="entry.id"
              class="data-row"
            >
              <td class="font-mono">
                <span class="id-badge">#{{ entry.id }}</span>
              </td>
              <td>
                <button
                  type="button"
                  class="task-badge-btn"
                  @click="onTaskBadgeClick(entry.taskId)"
                  :title="`Filter by task #${entry.taskId}`"
                >
                  <span>Task #{{ entry.taskId }}</span>
                </button>
              </td>
              <td>
                <div v-if="hierarchyStore.getBreadcrumb(entry.taskId)" class="breadcrumb-trail">
                  <span class="crumb-client">{{ hierarchyStore.getBreadcrumb(entry.taskId)?.clientName }}</span>
                  <ChevronRight :size="11" class="crumb-arrow" />
                  <span class="crumb-project">{{ hierarchyStore.getBreadcrumb(entry.taskId)?.projectName }}</span>
                  <ChevronRight :size="11" class="crumb-arrow" />
                  <span class="crumb-task">{{ hierarchyStore.getBreadcrumb(entry.taskId)?.taskName }}</span>
                </div>
                <span v-else class="text-muted text-xs">Direct Task Link</span>
              </td>
              <td class="comment-cell">
                <span class="comment-text" :title="entry.comment">{{ entry.comment }}</span>
              </td>
              <td class="whitespace-nowrap font-mono text-xs">
                {{ formatDateTime(entry.start) }}
              </td>
              <td class="whitespace-nowrap font-mono text-xs">
                {{ formatDateTime(entry.end) }}
              </td>
              <td class="whitespace-nowrap">
                <span class="duration-badge font-mono">
                  {{ formatDuration(calculateDurationBetween(entry.start, entry.end)) }}
                </span>
              </td>
              <td class="whitespace-nowrap font-mono text-xs text-muted">
                {{ formatDateTime(entry.createdAt) }}
              </td>
              <td class="text-right whitespace-nowrap">
                <div class="row-actions">
                  <button
                    type="button"
                    class="btn-icon btn-xs"
                    @click="timeEntriesStore.openEditModal(entry)"
                    title="Edit entry"
                  >
                    <Edit3 :size="13" />
                  </button>
                  <button
                    type="button"
                    class="btn-icon btn-xs"
                    @click="duplicateEntry(entry)"
                    title="Duplicate entry"
                  >
                    <Copy :size="13" />
                  </button>
                  <button
                    type="button"
                    class="btn-icon btn-xs text-danger"
                    @click="timeEntriesStore.openDeleteModal(entry)"
                    title="Delete entry"
                  >
                    <Trash2 :size="13" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel-footer">
      <div class="pagination-footer-container">
        <div class="rows-per-page-selector">
          <label for="limit-selector" class="selector-label">Rows per page:</label>
          <select
            id="limit-selector"
            :value="timeEntriesStore.limit"
            @change="onLimitChange"
            class="selector-dropdown"
          >
            <option :value="5">5</option>
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
        </div>

        <div class="page-navigation-group">
          <span class="pagination-stats">
            Page {{ timeEntriesStore.currentPage }} of {{ timeEntriesStore.totalPages }}
            ({{ timeEntriesStore.totalFilteredCount }} total)
          </span>

          <div class="pagination-buttons">
            <button
              type="button"
              class="btn-icon btn-sm"
              :disabled="timeEntriesStore.currentPage <= 1"
              @click="timeEntriesStore.setPage(timeEntriesStore.currentPage - 1)"
              aria-label="Previous page"
            >
              <ChevronLeft :size="15" />
            </button>
            <button
              type="button"
              class="btn-icon btn-sm"
              :disabled="timeEntriesStore.currentPage >= timeEntriesStore.totalPages"
              @click="timeEntriesStore.setPage(timeEntriesStore.currentPage + 1)"
              aria-label="Next page"
            >
              <ChevronRight :size="15" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useTimeEntriesStore } from '../../stores/timeEntries'
import { useHierarchyStore } from '../../stores/hierarchy'
import {
  formatDateTime,
  formatDuration,
  calculateDurationBetween
} from '../../utils/date'
import type { TimeEntry } from '../../types'
import {
  ListFilter,
  RefreshCw,
  Plus,
  Clock,
  CheckSquare,
  Filter,
  Search,
  X,
  ArrowUpDown,
  ChevronRight,
  ChevronLeft,
  Edit3,
  Copy,
  Trash2
} from 'lucide-vue-next'

const timeEntriesStore = useTimeEntriesStore()
const hierarchyStore = useHierarchyStore()

function onTaskBadgeClick(taskId: number): void {
  if (timeEntriesStore.filterTaskId === taskId) {
    timeEntriesStore.clearTaskFilter()
  } else {
    timeEntriesStore.setFilterTaskId(taskId)
  }
}

function duplicateEntry(entry: TimeEntry): void {
  timeEntriesStore.openCreateModal(entry.taskId)
}

function onLimitChange(event: Event): void {
  const target = event.target as HTMLSelectElement
  timeEntriesStore.setLimit(parseInt(target.value, 10))
}

onMounted(() => {
  if (timeEntriesStore.entries.length === 0) {
    timeEntriesStore.fetchEntries()
  }
})
</script>

<style scoped>
.entries-panel {
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
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.header-top-row {
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
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.count-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
  background: rgba(14, 165, 233, 0.12);
  color: #38bdf8;
  border: 1px solid rgba(14, 165, 233, 0.3);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.metrics-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.metric-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--surface-subtle);
  border: 1px solid var(--border-color);
  border-radius: 10px;
}

.metric-icon {
  padding: 6px;
  border-radius: 8px;
  box-sizing: content-box;
}

.metric-icon.primary {
  background: rgba(14, 165, 233, 0.12);
  color: #38bdf8;
}

.metric-icon.success {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}

.metric-icon.info {
  background: rgba(99, 102, 241, 0.12);
  color: #818cf8;
}

.metric-info {
  display: flex;
  flex-direction: column;
}

.metric-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: 500;
}

.metric-val {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
}

.filter-controls-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.search-bar {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 240px;
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
}

.filter-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 8px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
  font-size: 0.775rem;
}

.chip-remove-btn {
  background: transparent;
  border: none;
  color: #10b981;
  cursor: pointer;
  padding: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
}

.table-responsive {
  width: 100%;
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.825rem;
  text-align: left;
}

.data-table th {
  padding: 10px 14px;
  background: var(--surface-subtle);
  color: var(--text-secondary);
  font-weight: 600;
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

.sortable-th {
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;
}

.sortable-th:hover {
  background: var(--surface-card-hover);
  color: var(--text-primary);
}

.th-content {
  display: flex;
  align-items: center;
  gap: 6px;
}

.data-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
  vertical-align: middle;
}

.data-row {
  transition: background 0.15s ease;
}

.data-row:hover {
  background: var(--surface-card-hover);
}

.id-badge {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
}

.task-badge-btn {
  background: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.25);
  color: #38bdf8;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.task-badge-btn:hover {
  background: rgba(56, 189, 248, 0.18);
  border-color: #38bdf8;
}

.breadcrumb-trail {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.725rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.crumb-client {
  color: var(--text-secondary);
}

.crumb-project {
  color: var(--text-secondary);
}

.crumb-task {
  color: #38bdf8;
  font-weight: 500;
}

.crumb-arrow {
  color: var(--border-color);
}

.comment-cell {
  max-width: 240px;
}

.comment-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
  word-break: break-word;
}

.duration-badge {
  font-size: 0.775rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.text-danger {
  color: #ef4444;
}

.text-danger:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.entries-loading-state,
.entries-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: var(--text-muted);
}

.empty-icon {
  margin-bottom: 12px;
  opacity: 0.4;
}

.empty-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px;
}

.empty-desc {
  font-size: 0.825rem;
  color: var(--text-muted);
  max-width: 380px;
  margin: 0;
}

.mt-3 {
  margin-top: 14px;
}

.panel-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border-color);
  background: var(--surface-subtle);
}

.pagination-footer-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.rows-per-page-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selector-label {
  font-size: 0.775rem;
  color: var(--text-muted);
}

.selector-dropdown {
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 0.775rem;
}

.page-navigation-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pagination-stats {
  font-size: 0.775rem;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
}

.pagination-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
