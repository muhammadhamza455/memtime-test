import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../services/api'
import type { TimeEntry, CreateTimeEntryPayload, UpdateTimeEntryPayload } from '../types'
import { useToastStore } from './toast'

export const useTimeEntriesStore = defineStore('timeEntries', () => {
  const toast = useToastStore()

  const entries = ref<TimeEntry[]>([])
  const locallyCreated = ref<TimeEntry[]>([])
  const locallyUpdated = ref<Map<number, TimeEntry>>(new Map())
  const locallyDeleted = ref<Set<number>>(new Set())

  const loading = ref(false)
  const error = ref<string | null>(null)

  const limit = ref(10)
  const offset = ref(0)
  const sortBy = ref<string>('createdAt')
  const order = ref<'asc' | 'desc'>('desc')
  const filterTaskId = ref<number | null>(null)
  const searchFilter = ref<string>('')

  const activeEntryForEdit = ref<TimeEntry | null>(null)
  const modalPrefillTaskId = ref<number | null>(null)
  const isFormModalOpen = ref(false)
  const deleteTargetEntry = ref<TimeEntry | null>(null)
  const isDeleteModalOpen = ref(false)

  const allMergedEntries = computed(() => {
    const map = new Map<number, TimeEntry>()

    for (const item of entries.value) {
      if (!locallyDeleted.value.has(item.id)) {
        map.set(item.id, item)
      }
    }

    for (const item of locallyCreated.value) {
      if (!locallyDeleted.value.has(item.id)) {
        map.set(item.id, item)
      }
    }

    for (const [id, updated] of locallyUpdated.value.entries()) {
      if (map.has(id) && !locallyDeleted.value.has(id)) {
        map.set(id, updated)
      }
    }

    const list = Array.from(map.values())

    list.sort((a, b) => {
      let aVal = a[sortBy.value as keyof TimeEntry]
      let bVal = b[sortBy.value as keyof TimeEntry]

      if (sortBy.value === 'start' || sortBy.value === 'end' || sortBy.value === 'createdAt') {
        const aTime = new Date(String(aVal || 0)).getTime()
        const bTime = new Date(String(bVal || 0)).getTime()
        return order.value === 'asc' ? aTime - bTime : bTime - aTime
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return order.value === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }

      aVal = Number(aVal || 0)
      bVal = Number(bVal || 0)
      return order.value === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })

    return list
  })

  const filteredEntries = computed(() => {
    let list = allMergedEntries.value

    if (filterTaskId.value !== null) {
      list = list.filter((e) => e.taskId === filterTaskId.value)
    }

    const q = searchFilter.value.trim().toLowerCase()
    if (q) {
      list = list.filter((e) => {
        return (
          e.comment.toLowerCase().includes(q) ||
          String(e.id).includes(q) ||
          String(e.taskId).includes(q)
        )
      })
    }

    return list
  })

  const paginatedEntries = computed(() => {
    const startIdx = offset.value
    return filteredEntries.value.slice(startIdx, startIdx + limit.value)
  })

  const totalFilteredCount = computed(() => filteredEntries.value.length)
  const totalPages = computed(() => Math.max(1, Math.ceil(totalFilteredCount.value / limit.value)))
  const currentPage = computed(() => Math.floor(offset.value / limit.value) + 1)

  const totalDurationSeconds = computed(() => {
    return filteredEntries.value.reduce((acc, entry) => {
      const s = new Date(entry.start).getTime()
      const e = new Date(entry.end).getTime()
      const diff = Math.max(0, Math.floor((e - s) / 1000))
      return acc + diff
    }, 0)
  })

  async function fetchEntries(bypassCache = false): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const data = await api.getTimeEntries(
        {
          limit: 100,
          offset: 0,
          sortBy: sortBy.value,
          order: order.value
        },
        bypassCache
      )
      entries.value = data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch time entries'
      toast.error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function createEntry(payload: CreateTimeEntryPayload): Promise<TimeEntry> {
    loading.value = true
    try {
      const created = await api.createTimeEntry(payload)
      locallyCreated.value.unshift(created)
      toast.success(`Time entry #${created.id} created successfully!`)
      isFormModalOpen.value = false
      return created
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create time entry'
      toast.error(msg)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateEntry(id: number, payload: UpdateTimeEntryPayload): Promise<TimeEntry> {
    loading.value = true
    try {
      const updated = await api.updateTimeEntry(id, payload)
      locallyUpdated.value.set(id, { ...updated, id })
      toast.success(`Time entry #${id} updated successfully!`)
      isFormModalOpen.value = false
      activeEntryForEdit.value = null
      return updated
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update time entry'
      toast.error(msg)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteEntry(id: number): Promise<void> {
    loading.value = true
    try {
      await api.deleteTimeEntry(id)
      locallyDeleted.value.add(id)
      locallyCreated.value = locallyCreated.value.filter((e) => e.id !== id)
      locallyUpdated.value.delete(id)
      toast.success(`Time entry #${id} deleted successfully.`)
      isDeleteModalOpen.value = false
      deleteTargetEntry.value = null
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete time entry'
      toast.error(msg)
      throw err
    } finally {
      loading.value = false
    }
  }

  function openCreateModal(defaultTaskId?: number): void {
    activeEntryForEdit.value = null
    modalPrefillTaskId.value = defaultTaskId ?? null
    isFormModalOpen.value = true
  }

  function openEditModal(entry: TimeEntry): void {
    activeEntryForEdit.value = { ...entry }
    isFormModalOpen.value = true
  }

  function openDeleteModal(entry: TimeEntry): void {
    deleteTargetEntry.value = entry
    isDeleteModalOpen.value = true
  }

  function setPage(page: number): void {
    offset.value = Math.max(0, (page - 1) * limit.value)
  }

  function setLimit(newLimit: number): void {
    limit.value = newLimit
    offset.value = 0
  }

  function toggleSort(field: string): void {
    if (sortBy.value === field) {
      order.value = order.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortBy.value = field
      order.value = 'desc'
    }
  }

  function setFilterTaskId(taskId: number): void {
    filterTaskId.value = taskId
    offset.value = 0
  }

  function clearTaskFilter(): void {
    filterTaskId.value = null
    offset.value = 0
  }

  return {
    entries,
    locallyCreated,
    locallyUpdated,
    locallyDeleted,
    loading,
    error,
    limit,
    offset,
    sortBy,
    order,
    filterTaskId,
    searchFilter,
    activeEntryForEdit,
    modalPrefillTaskId,
    isFormModalOpen,
    deleteTargetEntry,
    isDeleteModalOpen,
    allMergedEntries,
    filteredEntries,
    paginatedEntries,
    totalFilteredCount,
    totalPages,
    currentPage,
    totalDurationSeconds,
    fetchEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    openCreateModal,
    openEditModal,
    openDeleteModal,
    setPage,
    setLimit,
    toggleSort,
    setFilterTaskId,
    clearTaskFilter
  }
})
