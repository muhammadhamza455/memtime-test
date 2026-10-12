import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { api, isApiError } from '../services/api'
import type {
  TimeEntry,
  CreateTimeEntryPayload,
  UpdateTimeEntryPayload,
  SortField,
  TimeEntryPrefill
} from '../types'
import { useToastStore } from './toast'
import { calculateDurationBetween, formatDuration } from '../utils/date'

export type FormSource = 'manual' | 'timer'

function compareEntries(a: TimeEntry, b: TimeEntry, field: SortField): number {
  if (field === 'id' || field === 'taskId') return a[field] - b[field]
  return new Date(a[field]).getTime() - new Date(b[field]).getTime()
}

export const useTimeEntriesStore = defineStore('timeEntries', () => {
  const toast = useToastStore()

  // Server mode: one page fetched with limit/offset/sortBy/order.
  const pageEntries = ref<TimeEntry[]>([])
  const hasNextServerPage = ref(false)
  // Scan mode: the API has no taskId/search filter, so filtering walks every
  // page once and filters locally.
  const allEntries = ref<TimeEntry[]>([])
  const allEntriesLoaded = ref(false)

  const loading = ref(false)
  const mutating = ref(false)
  const error = ref<string | null>(null)
  let fetchRequestId = 0

  const page = ref(1)
  const pageSize = ref(10)
  const sortBy = ref<SortField>('start')
  const order = ref<'asc' | 'desc'>('desc')
  const filterTaskId = ref<number | null>(null)
  const searchFilter = ref('')

  const activeEntryForEdit = ref<TimeEntry | null>(null)
  const formPrefill = ref<TimeEntryPrefill | null>(null)
  const formSource = ref<FormSource>('manual')
  const isFormModalOpen = ref(false)
  const deleteTargetEntry = ref<TimeEntry | null>(null)
  const isDeleteModalOpen = ref(false)

  const isScanMode = computed(() => filterTaskId.value !== null || searchFilter.value.trim() !== '')

  const scanResults = computed(() => {
    // Until the scan has (re)loaded, show the loading state rather than a misleading empty result.
    if (!allEntriesLoaded.value) return []
    const q = searchFilter.value.trim().toLowerCase()
    const list = allEntries.value.filter((e) => {
      if (filterTaskId.value !== null && e.taskId !== filterTaskId.value) return false
      if (!q) return true
      return e.comment.toLowerCase().includes(q) || String(e.id) === q || String(e.taskId).includes(q)
    })
    const direction = order.value === 'asc' ? 1 : -1
    return list.sort((a, b) => direction * compareEntries(a, b, sortBy.value))
  })

  const visibleEntries = computed(() => {
    if (!isScanMode.value) return pageEntries.value
    const start = (page.value - 1) * pageSize.value
    return scanResults.value.slice(start, start + pageSize.value)
  })

  const hasNextPage = computed(() =>
    isScanMode.value ? page.value * pageSize.value < scanResults.value.length : hasNextServerPage.value
  )

  /** Known only in scan mode; the API does not return a total count. */
  const totalCount = computed<number | null>(() =>
    isScanMode.value && allEntriesLoaded.value ? scanResults.value.length : null
  )

  const rangeStart = computed(() => (visibleEntries.value.length ? (page.value - 1) * pageSize.value + 1 : 0))
  const rangeEnd = computed(() => (page.value - 1) * pageSize.value + visibleEntries.value.length)

  /** Total time of the filtered set in scan mode, otherwise of the visible page. */
  const summedDurationSeconds = computed(() => {
    const list = isScanMode.value ? scanResults.value : visibleEntries.value
    return list.reduce((acc, entry) => acc + calculateDurationBetween(entry.start, entry.end), 0)
  })

  async function fetchEntries(bypassCache = false): Promise<void> {
    const requestId = ++fetchRequestId
    loading.value = true
    error.value = null
    try {
      if (isScanMode.value) {
        const data = await api.getAllTimeEntries(bypassCache)
        if (requestId !== fetchRequestId) return
        allEntries.value = data
        allEntriesLoaded.value = true
        const lastPage = Math.max(1, Math.ceil(scanResults.value.length / pageSize.value))
        if (page.value > lastPage) page.value = lastPage
      } else {
        const data = await api.getTimeEntries(
          {
            limit: pageSize.value + 1,
            offset: (page.value - 1) * pageSize.value,
            sortBy: sortBy.value,
            order: order.value
          },
          bypassCache
        )
        if (requestId !== fetchRequestId) return
        if (data.length === 0 && page.value > 1) {
          // The page we were on no longer exists (e.g. its last entry was deleted).
          page.value -= 1
          return fetchEntries(bypassCache)
        }
        hasNextServerPage.value = data.length > pageSize.value
        pageEntries.value = data.slice(0, pageSize.value)
      }
    } catch (err: unknown) {
      if (requestId !== fetchRequestId) return
      error.value = err instanceof Error ? err.message : 'Failed to fetch time entries'
    } finally {
      if (requestId === fetchRequestId) loading.value = false
    }
  }

  function ensureScanData(): void {
    if (!allEntriesLoaded.value) fetchEntries()
  }

  // Switching between server and scan mode needs a different data source.
  watch(isScanMode, (scan) => {
    if (scan) ensureScanData()
    else fetchEntries()
  })
  watch(searchFilter, () => {
    page.value = 1
  })

  function applyLocally(entry: TimeEntry): void {
    const replace = (list: TimeEntry[]) => list.map((e) => (e.id === entry.id ? entry : e))
    pageEntries.value = replace(pageEntries.value)
    allEntries.value = replace(allEntries.value)
  }

  function removeLocally(id: number): void {
    pageEntries.value = pageEntries.value.filter((e) => e.id !== id)
    allEntries.value = allEntries.value.filter((e) => e.id !== id)
  }

  /** Re-reads the current view from the server after a mutation. */
  function reconcile(): void {
    if (!isScanMode.value) allEntriesLoaded.value = false
    fetchEntries(true)
  }

  function describe(entry: TimeEntry): string {
    return `Task #${entry.taskId} · ${formatDuration(calculateDurationBetween(entry.start, entry.end))}`
  }

  async function createEntry(payload: CreateTimeEntryPayload): Promise<TimeEntry> {
    mutating.value = true
    try {
      const created = await api.createTimeEntry(payload)
      toast.success(`Time entry #${created.id} created (${describe(created)}).`, 'Entry created')
      isFormModalOpen.value = false
      reconcile()
      return created
    } finally {
      mutating.value = false
    }
  }

  async function updateEntry(id: number, payload: UpdateTimeEntryPayload): Promise<TimeEntry> {
    mutating.value = true
    try {
      const updated = await api.updateTimeEntry(id, payload)
      applyLocally(updated)
      toast.success(`Time entry #${updated.id} updated: ${describe(updated)} — "${updated.comment}"`, 'Entry updated')
      isFormModalOpen.value = false
      activeEntryForEdit.value = null
      reconcile()
      return updated
    } catch (err: unknown) {
      if (isApiError(err, 404) && /time entry/i.test(err.message)) {
        // Deleted elsewhere: drop the stale row so the list matches the server.
        removeLocally(id)
        reconcile()
      }
      throw err
    } finally {
      mutating.value = false
    }
  }

  async function deleteEntry(id: number): Promise<void> {
    mutating.value = true
    try {
      await api.deleteTimeEntry(id)
      toast.success(`Time entry #${id} deleted.`, 'Entry deleted')
    } catch (err: unknown) {
      if (!isApiError(err, 404)) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete time entry')
        return
      }
      toast.info(`Time entry #${id} was already deleted.`)
    } finally {
      mutating.value = false
    }
    removeLocally(id)
    isDeleteModalOpen.value = false
    deleteTargetEntry.value = null
    reconcile()
  }

  function openCreateModal(prefill?: TimeEntryPrefill, source: FormSource = 'manual'): void {
    activeEntryForEdit.value = null
    formPrefill.value = prefill ?? null
    formSource.value = source
    isFormModalOpen.value = true
  }

  function openEditModal(entry: TimeEntry): void {
    activeEntryForEdit.value = { ...entry }
    formPrefill.value = null
    formSource.value = 'manual'
    isFormModalOpen.value = true
  }

  function closeFormModal(): void {
    isFormModalOpen.value = false
    activeEntryForEdit.value = null
    formPrefill.value = null
  }

  function openDeleteModal(entry: TimeEntry): void {
    deleteTargetEntry.value = entry
    isDeleteModalOpen.value = true
  }

  function closeDeleteModal(): void {
    isDeleteModalOpen.value = false
    deleteTargetEntry.value = null
  }

  function setPage(newPage: number): void {
    page.value = Math.max(1, newPage)
    if (!isScanMode.value) fetchEntries()
  }

  function setPageSize(size: number): void {
    pageSize.value = size
    page.value = 1
    if (!isScanMode.value) fetchEntries()
  }

  function toggleSort(field: SortField): void {
    if (sortBy.value === field) {
      order.value = order.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortBy.value = field
      order.value = 'desc'
    }
    page.value = 1
    if (!isScanMode.value) fetchEntries()
  }

  function setFilterTaskId(taskId: number): void {
    filterTaskId.value = taskId
    page.value = 1
  }

  function clearTaskFilter(): void {
    filterTaskId.value = null
    page.value = 1
  }

  return {
    pageEntries,
    allEntries,
    loading,
    mutating,
    error,
    page,
    pageSize,
    sortBy,
    order,
    filterTaskId,
    searchFilter,
    activeEntryForEdit,
    formPrefill,
    formSource,
    isFormModalOpen,
    deleteTargetEntry,
    isDeleteModalOpen,
    isScanMode,
    visibleEntries,
    hasNextPage,
    totalCount,
    rangeStart,
    rangeEnd,
    summedDurationSeconds,
    fetchEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    openCreateModal,
    openEditModal,
    closeFormModal,
    openDeleteModal,
    closeDeleteModal,
    setPage,
    setPageSize,
    toggleSort,
    setFilterTaskId,
    clearTaskFilter
  }
})
