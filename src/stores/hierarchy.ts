import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../services/api'
import type { Client, Project, Task, TaskBreadcrumb } from '../types'

export interface TaskOptionGroup {
  label: string
  tasks: Task[]
}

export const useHierarchyStore = defineStore('hierarchy', () => {
  const clients = ref<Client[]>([])
  const clientsLoading = ref(false)
  const clientsError = ref<string | null>(null)

  const clientLimit = ref(10)
  const clientOffset = ref(0)
  const hasMoreClients = ref(false)
  let clientsRequestId = 0

  const expandedClientIds = ref<Set<number>>(new Set())
  const projectsByClientId = ref<Map<number, Project[]>>(new Map())
  const projectsLoading = ref<Map<number, boolean>>(new Map())
  const projectsError = ref<Map<number, string>>(new Map())

  const expandedProjectIds = ref<Set<number>>(new Set())
  const tasksByProjectId = ref<Map<number, Task[]>>(new Map())
  const tasksLoading = ref<Map<number, boolean>>(new Map())
  const tasksError = ref<Map<number, string>>(new Map())

  const selectedTaskId = ref<number | null>(null)
  const searchQuery = ref('')
  const isExpandingAll = ref(false)
  let expandAllCancelled = false

  const taskBreadcrumbs = ref<Map<number, TaskBreadcrumb>>(new Map())

  const isClientExpanded = (clientId: number) => expandedClientIds.value.has(clientId)
  const isProjectExpanded = (projectId: number) => expandedProjectIds.value.has(projectId)

  const isClientLoading = (clientId: number) => !!projectsLoading.value.get(clientId)
  const isProjectLoading = (projectId: number) => !!tasksLoading.value.get(projectId)

  const getClientProjects = (clientId: number) => projectsByClientId.value.get(clientId) || []
  const getProjectTasks = (projectId: number) => tasksByProjectId.value.get(projectId) || []

  const filteredClients = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return clients.value
    return clients.value.filter((client) => {
      const matchClient =
        client.name.toLowerCase().includes(q) ||
        (client.description && client.description.toLowerCase().includes(q)) ||
        client.status.toLowerCase().includes(q)

      const projects = projectsByClientId.value.get(client.id) || []
      const matchProjects = projects.some((p) => {
        const pMatch = p.name.toLowerCase().includes(q) || p.status.toLowerCase().includes(q)
        const tasks = tasksByProjectId.value.get(p.id) || []
        const tMatch = tasks.some((t) => t.name.toLowerCase().includes(q))
        return pMatch || tMatch
      })

      return matchClient || matchProjects
    })
  })

  const taskOptionGroups = computed<TaskOptionGroup[]>(() => {
    const groups: TaskOptionGroup[] = []
    for (const [projectId, tasks] of tasksByProjectId.value.entries()) {
      if (tasks.length === 0) continue
      const crumb = taskBreadcrumbs.value.get(tasks[0].id)
      groups.push({
        label: crumb ? `${crumb.clientName} › ${crumb.projectName}` : `Project #${projectId}`,
        tasks
      })
    }
    return groups
  })

  const loadedTaskCount = computed(() =>
    taskOptionGroups.value.reduce((sum, group) => sum + group.tasks.length, 0)
  )

  async function fetchClients(offset = 0, bypassCache = false): Promise<void> {
    const requestId = ++clientsRequestId
    clientsLoading.value = true
    clientsError.value = null
    try {
      const data = await api.getClients({ limit: clientLimit.value + 1, offset }, bypassCache)
      if (requestId !== clientsRequestId) return
      clientOffset.value = offset
      hasMoreClients.value = data.length > clientLimit.value
      clients.value = data.slice(0, clientLimit.value)
    } catch (err: unknown) {
      if (requestId !== clientsRequestId) return
      clientsError.value = err instanceof Error ? err.message : 'Failed to fetch clients'
    } finally {
      if (requestId === clientsRequestId) clientsLoading.value = false
    }
  }

  function rememberBreadcrumbs(client: Client | undefined, clientId: number, project: Project, tasks: Task[]): void {
    for (const t of tasks) {
      taskBreadcrumbs.value.set(t.id, {
        clientId,
        clientName: client?.name || `Client #${clientId}`,
        projectId: project.id,
        projectName: project.name,
        taskId: t.id,
        taskName: t.name
      })
    }
  }

  async function fetchClientProjects(clientId: number, bypassCache = false): Promise<void> {
    projectsLoading.value.set(clientId, true)
    projectsError.value.delete(clientId)
    try {
      const projects = await api.getAllClientProjects(clientId, bypassCache)
      projectsByClientId.value.set(clientId, projects)

      const client = clients.value.find((c) => c.id === clientId)
      for (const p of projects) {
        rememberBreadcrumbs(client, clientId, p, tasksByProjectId.value.get(p.id) || [])
      }
    } catch (err: unknown) {
      projectsError.value.set(clientId, err instanceof Error ? err.message : 'Failed to fetch projects')
    } finally {
      projectsLoading.value.set(clientId, false)
    }
  }

  async function toggleClient(clientId: number): Promise<void> {
    if (expandedClientIds.value.has(clientId)) {
      expandedClientIds.value.delete(clientId)
    } else {
      expandedClientIds.value.add(clientId)
      if (!projectsByClientId.value.has(clientId)) {
        await fetchClientProjects(clientId)
      }
    }
  }

  async function fetchProjectTasks(projectId: number, bypassCache = false): Promise<void> {
    tasksLoading.value.set(projectId, true)
    tasksError.value.delete(projectId)
    try {
      const tasks = await api.getAllProjectTasks(projectId, bypassCache)
      tasksByProjectId.value.set(projectId, tasks)

      for (const [cId, projs] of projectsByClientId.value.entries()) {
        const project = projs.find((p) => p.id === projectId)
        if (project) {
          rememberBreadcrumbs(clients.value.find((c) => c.id === cId), cId, project, tasks)
          break
        }
      }
    } catch (err: unknown) {
      tasksError.value.set(projectId, err instanceof Error ? err.message : 'Failed to fetch tasks')
    } finally {
      tasksLoading.value.set(projectId, false)
    }
  }

  async function toggleProject(projectId: number): Promise<void> {
    if (expandedProjectIds.value.has(projectId)) {
      expandedProjectIds.value.delete(projectId)
    } else {
      expandedProjectIds.value.add(projectId)
      if (!tasksByProjectId.value.has(projectId)) {
        await fetchProjectTasks(projectId)
      }
    }
  }

  function selectTask(task: Task | null): void {
    selectedTaskId.value = task ? task.id : null
  }

  function getBreadcrumb(taskId: number): TaskBreadcrumb | undefined {
    return taskBreadcrumbs.value.get(taskId)
  }

  function findTask(taskId: number): Task | undefined {
    for (const tasks of tasksByProjectId.value.values()) {
      const found = tasks.find((t) => t.id === taskId)
      if (found) return found
    }
    return undefined
  }

  async function refreshHierarchy(): Promise<void> {
    api.invalidateCachePrefix('/clients')
    api.invalidateCachePrefix('/projects')
    await fetchClients(clientOffset.value, true)
    const visibleClientIds = new Set(clients.value.map((c) => c.id))
    for (const cId of expandedClientIds.value) {
      if (visibleClientIds.has(cId)) await fetchClientProjects(cId, true)
    }
    for (const pId of expandedProjectIds.value) {
      await fetchProjectTasks(pId, true)
    }
  }

  async function expandAllCurrent(): Promise<void> {
    if (isExpandingAll.value) return
    isExpandingAll.value = true
    expandAllCancelled = false
    try {
      for (const client of clients.value) {
        if (expandAllCancelled) return
        expandedClientIds.value.add(client.id)
        if (!projectsByClientId.value.has(client.id)) {
          await fetchClientProjects(client.id)
        }
      }
      for (const client of clients.value) {
        for (const project of projectsByClientId.value.get(client.id) || []) {
          if (expandAllCancelled) return
          expandedProjectIds.value.add(project.id)
          if (!tasksByProjectId.value.has(project.id)) {
            await fetchProjectTasks(project.id)
          }
        }
      }
    } finally {
      isExpandingAll.value = false
    }
  }

  function cancelExpandAll(): void {
    expandAllCancelled = true
  }

  function collapseAll(): void {
    cancelExpandAll()
    expandedClientIds.value.clear()
    expandedProjectIds.value.clear()
  }

  function goToClientsPage(offset: number): void {
    cancelExpandAll()
    fetchClients(Math.max(0, offset))
  }

  function setClientLimit(limit: number): void {
    clientLimit.value = limit
    goToClientsPage(0)
  }

  return {
    clients,
    clientsLoading,
    clientsError,
    clientLimit,
    clientOffset,
    hasMoreClients,
    expandedClientIds,
    projectsByClientId,
    projectsLoading,
    projectsError,
    expandedProjectIds,
    tasksByProjectId,
    tasksLoading,
    tasksError,
    selectedTaskId,
    searchQuery,
    isExpandingAll,
    filteredClients,
    taskOptionGroups,
    loadedTaskCount,
    taskBreadcrumbs,
    isClientExpanded,
    isProjectExpanded,
    isClientLoading,
    isProjectLoading,
    getClientProjects,
    getProjectTasks,
    fetchClients,
    fetchClientProjects,
    toggleClient,
    fetchProjectTasks,
    toggleProject,
    selectTask,
    getBreadcrumb,
    findTask,
    refreshHierarchy,
    expandAllCurrent,
    cancelExpandAll,
    collapseAll,
    goToClientsPage,
    setClientLimit
  }
})
