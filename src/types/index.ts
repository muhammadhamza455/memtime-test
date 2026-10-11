export interface Client {
  id: number
  name: string
  description?: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: number
  clientId: number
  name: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: number
  projectId?: number
  parent?: number
  name: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface TimeEntry {
  id: number
  taskId: number
  userId: string
  comment: string
  start: string
  end: string
  createdAt: string
  updatedAt: string
}

export interface CreateTimeEntryPayload {
  taskId: number
  comment: string
  start: string
  end: string
}

export interface UpdateTimeEntryPayload {
  taskId: number
  comment: string
  start: string
  end: string
}

export interface PaginationParams {
  limit?: number
  offset?: number
  sortBy?: string
  order?: 'asc' | 'desc'
}

export interface RateLimitState {
  limit: number
  remaining: number
  resetSeconds: number
  updatedAt: number
}

export interface ApiError {
  error: string
  status?: number
}

export interface TaskBreadcrumb {
  clientName: string
  clientId: number
  projectName: string
  projectId: number
  taskName: string
  taskId: number
}
