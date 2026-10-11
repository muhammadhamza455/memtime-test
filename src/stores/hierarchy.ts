import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../services/api'
import type { Client, Project, Task, TaskBreadcrumb } from '../types'

export const useHierarchyStore = defineStore('hierarchy', () => {
  const clients = ref<Client[]>([])
  const clientsLoading = ref(false)
  const clientsError = ref<string | null>(null)

  const clientLimit = ref(10)
  const clientOffset = ref(0)
  const hasMoreClients = ref(true)

  const expandedClientIds = ref<Set<number>>(new Set())
  const projectsByClientId = ref<Map<number, Project[]>>(new Map())
  const projectsLoading = ref<Map<number, boolean>>(new Map())
  const projectsError = ref<Map<number, string>>(new Map())

  const expandedProjectIds = ref<Set<number>>(new Set())
  const tasksByProjectId = ref<Map<number, Task[]>>(new Map())
  const tasksLoading = ref<Map<number, boolean>>(new Map())
  const tasksError = ref<Map<number, string>>(new Map())

  const selectedTaskId = ref<number | null>(null)
  const selectedTask = ref<Task | null>(null)
  const searchQuery = ref('')

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

  async function fetchClients(offset = 0, bypassCache = false): Promise<void> {
    clientsLoading.value = true
    clientsError.value = null
    try {
      const data = await api.getClients(
        { limit: clientLimit.value, offset },
        bypassCache
      )
      clientOffset.value = offset
      clients.value = data
      hasMoreClients.value = data.length === clientLimit.value
    } catch (err: unknown) {
      clientsError.value = err instanceof Error ? err.message : 'Failed to fetch clients'
    } finally {
      clientsLoading.value = false
    }
  }

  async function fetchClientProjects(clientId: number, bypassCache = false): Promise<void> {
    projectsLoading.value.set(clientId, true)
    projectsError.value.delete(clientId)
    try {
      const projects = await api.getClientProjects(clientId, { limit: 50 }, bypassCache)
      projectsByClientId.value.set(clientId, projects)

      const client = clients.value.find((c) => c.id === clientId)
      for (const p of projects) {
        const tasks = tasksByProjectId.value.get(p.id) || []
        for (const t of tasks) {
          taskBreadcrumbs.value.set(t.id, {
            clientId,
            clientName: client?.name || `Client #${clientId}`,
            projectId: p.id,
            projectName: p.name,
            taskId: t.id,
            taskName: t.name
          })
        }
      }
    } catch (err: unknown) {
      projectsError.value.set(
        clientId,
        err instanceof Error ? err.message : 'Failed to fetch projects'
      )
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
      const tasks = await api.getProjectTasks(projectId, { limit: 50 }, bypassCache)
      tasksByProjectId.value.set(projectId, tasks)

      let client: Client | undefined
      let project: Project | undefined

      for (const [cId, projs] of projectsByClientId.value.entries()) {
        const found = projs.find((p) => p.id === projectId)
        if (found) {
          project = found
          client = clients.value.find((c) => c.id === cId)
          break
        }
      }

      for (const t of tasks) {
        taskBreadcrumbs.value.set(t.id, {
          clientId: client?.id || 0,
          clientName: client?.name || 'Unknown Client',
          projectId,
          projectName: project?.name || `Project #${projectId}`,
          taskId: t.id,
          taskName: t.name
        })
      }
    } catch (err: unknown) {
      tasksError.value.set(
        projectId,
        err instanceof Error ? err.message : 'Failed to fetch tasks'
      )
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
    selectedTask.value = task
  }

  function getBreadcrumb(taskId: number): TaskBreadcrumb | undefined {
    return taskBreadcrumbs.value.get(taskId)
  }

  async function refreshHierarchy(): Promise<void> {
    api.clearCache()
    await fetchClients(clientOffset.value, true)
    for (const cId of expandedClientIds.value) {
      await fetchClientProjects(cId, true)
    }
    for (const pId of expandedProjectIds.value) {
      await fetchProjectTasks(pId, true)
    }
  }

  async function expandAllCurrent(): Promise<void> {
    for (const client of clients.value) {
      expandedClientIds.value.add(client.id)
      if (!projectsByClientId.value.has(client.id)) {
        await fetchClientProjects(client.id)
        await new Promise((r) => setTimeout(r, 120))
      }
      const projects = projectsByClientId.value.get(client.id) || []
      for (const project of projects) {
        expandedProjectIds.value.add(project.id)
        if (!tasksByProjectId.value.has(project.id)) {
          await fetchProjectTasks(project.id)
          await new Promise((r) => setTimeout(r, 120))
        }
      }
    }
  }

  function collapseAll(): void {
    expandedClientIds.value.clear()
    expandedProjectIds.value.clear()
  }

  function setClientLimit(limit: number): void {
    clientLimit.value = limit
    fetchClients(0)
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
    selectedTask,
    searchQuery,
    filteredClients,
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
    refreshHierarchy,
    expandAllCurrent,
    collapseAll,
    setClientLimit
  }
})
