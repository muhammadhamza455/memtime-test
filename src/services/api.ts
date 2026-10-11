import type {
  Client,
  Project,
  Task,
  TimeEntry,
  CreateTimeEntryPayload,
  UpdateTimeEntryPayload,
  PaginationParams,
  RateLimitState
} from '../types'

const DEFAULT_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'https://interview-api.memtime-demo.deno.net/api/v1'
const DEFAULT_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_KEY) ||
  't2On0w9hkjQNrfnKEaO7FhsVrfPLXZS2'

type RateLimitListener = (state: RateLimitState) => void

interface CacheEntry<T> {
  data: T
  timestamp: number
}

export class ApiService {
  private baseUrl: string
  private apiKey: string
  private cache = new Map<string, CacheEntry<unknown>>()
  private cacheTtlMs = 180000
  private rateLimitListeners: RateLimitListener[] = []
  private currentRateLimit: RateLimitState = {
    limit: 15,
    remaining: 15,
    resetSeconds: 60,
    updatedAt: Date.now()
  }

  constructor() {
    const hasStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
    this.baseUrl = (hasStorage ? window.localStorage.getItem('memtime_base_url') : null) || DEFAULT_BASE_URL
    this.apiKey = (hasStorage ? window.localStorage.getItem('memtime_api_key') : null) || DEFAULT_API_KEY
  }

  public getBaseUrl(): string {
    return this.baseUrl
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '')
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      window.localStorage.setItem('memtime_base_url', this.baseUrl)
    }
    this.clearCache()
  }

  public getApiKey(): string {
    return this.apiKey
  }

  public setApiKey(key: string): void {
    this.apiKey = key.trim()
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      window.localStorage.setItem('memtime_api_key', this.apiKey)
    }
    this.clearCache()
  }

  public onRateLimitChange(listener: RateLimitListener): () => void {
    this.rateLimitListeners.push(listener)
    listener(this.currentRateLimit)
    return () => {
      this.rateLimitListeners = this.rateLimitListeners.filter((l) => l !== listener)
    }
  }

  public getRateLimit(): RateLimitState {
    return { ...this.currentRateLimit }
  }

  public clearCache(): void {
    this.cache.clear()
  }

  public invalidateCachePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
      }
    }
  }

  private updateRateLimitFromHeaders(headers: Headers): void {
    const limit = headers.get('ratelimit-limit')
    const remaining = headers.get('ratelimit-remaining')
    const reset = headers.get('ratelimit-reset')

    if (remaining !== null) {
      this.currentRateLimit = {
        limit: limit ? parseInt(limit, 10) : 15,
        remaining: parseInt(remaining, 10),
        resetSeconds: reset ? parseInt(reset, 10) : 60,
        updatedAt: Date.now()
      }

      for (const listener of this.rateLimitListeners) {
        listener(this.currentRateLimit)
      }
    }
  }

  private buildQueryString(params?: Record<string, string | number | undefined>): string {
    if (!params) return ''
    const entries = Object.entries(params).filter(
      ([, val]) => val !== undefined && val !== null && val !== ''
    )
    if (entries.length === 0) return ''
    const searchParams = new URLSearchParams()
    for (const [key, value] of entries) {
      searchParams.append(key, String(value))
    }
    return `?${searchParams.toString()}`
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    bypassCache = false,
    retryCount = 0
  ): Promise<T> {
    const isGet = !options.method || options.method.toUpperCase() === 'GET'
    const cacheKey = `${endpoint}`

    if (isGet && !bypassCache) {
      const cached = this.cache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
        return cached.data as T
      }
    }

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
    const headers = new Headers(options.headers || {})
    headers.set('Authorization', `Bearer ${this.apiKey}`)

    if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      })

      this.updateRateLimitFromHeaders(response.headers)

      if (response.status === 429) {
        if (retryCount < 2) {
          const resetHeader = response.headers.get('ratelimit-reset')
          const waitSeconds = resetHeader ? Math.max(1, parseInt(resetHeader, 10)) : 5
          const waitTime = Math.min(waitSeconds, 10) * 1000
          await new Promise((resolve) => setTimeout(resolve, waitTime))
          return this.request<T>(endpoint, options, bypassCache, retryCount + 1)
        }
        throw new Error('Rate limit exceeded (15 requests per minute). Please wait a moment.')
      }

      const contentType = response.headers.get('content-type') || ''
      let data: unknown = null

      if (contentType.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text()
      }

      if (!response.ok) {
        const errorMsg =
          typeof data === 'object' && data !== null && 'error' in data
            ? String((data as { error: unknown }).error)
            : typeof data === 'string' && data.length > 0
              ? data
              : `Request failed with status ${response.status}`

        const error = new Error(errorMsg)
        ;(error as unknown as { status: number }).status = response.status
        throw error
      }

      if (isGet) {
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now()
        })
      }

      return data as T
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw err
      }
      throw new Error(String(err) || 'Network error occurred')
    }
  }

  public async getClients(params?: PaginationParams, bypassCache = false): Promise<Client[]> {
    const qs = this.buildQueryString(params as Record<string, string | number | undefined>)
    return this.request<Client[]>(`/clients${qs}`, { method: 'GET' }, bypassCache)
  }

  public async getClient(id: number, bypassCache = false): Promise<Client> {
    return this.request<Client>(`/clients/${id}`, { method: 'GET' }, bypassCache)
  }

  public async getClientProjects(
    clientId: number,
    params?: PaginationParams,
    bypassCache = false
  ): Promise<Project[]> {
    const qs = this.buildQueryString(params as Record<string, string | number | undefined>)
    return this.request<Project[]>(`/clients/${clientId}/projects${qs}`, { method: 'GET' }, bypassCache)
  }

  public async getProject(id: number, bypassCache = false): Promise<Project> {
    return this.request<Project>(`/projects/${id}`, { method: 'GET' }, bypassCache)
  }

  public async getProjectTasks(
    projectId: number,
    params?: PaginationParams,
    bypassCache = false
  ): Promise<Task[]> {
    const qs = this.buildQueryString(params as Record<string, string | number | undefined>)
    return this.request<Task[]>(`/projects/${projectId}/tasks${qs}`, { method: 'GET' }, bypassCache)
  }

  public async getTask(id: number, bypassCache = false): Promise<Task> {
    return this.request<Task>(`/tasks/${id}`, { method: 'GET' }, bypassCache)
  }

  public async getTimeEntries(
    params?: PaginationParams,
    bypassCache = false
  ): Promise<TimeEntry[]> {
    const qs = this.buildQueryString(params as Record<string, string | number | undefined>)
    return this.request<TimeEntry[]>(`/time-entries${qs}`, { method: 'GET' }, bypassCache)
  }

  public async getTimeEntry(id: number, bypassCache = false): Promise<TimeEntry> {
    return this.request<TimeEntry>(`/time-entries/${id}`, { method: 'GET' }, bypassCache)
  }

  public async createTimeEntry(payload: CreateTimeEntryPayload): Promise<TimeEntry> {
    const result = await this.request<TimeEntry>('/time-entries', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    this.invalidateCachePrefix('/time-entries')
    return result
  }

  public async updateTimeEntry(id: number, payload: UpdateTimeEntryPayload): Promise<TimeEntry> {
    const result = await this.request<TimeEntry>(`/time-entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
    this.invalidateCachePrefix('/time-entries')
    return result
  }

  public async deleteTimeEntry(id: number): Promise<{ message: string }> {
    const result = await this.request<{ message: string }>(`/time-entries/${id}`, {
      method: 'DELETE'
    })
    this.invalidateCachePrefix('/time-entries')
    return result
  }

  public async checkHealth(): Promise<{ status: string; latencyMs: number }> {
    const start = Date.now()
    const response = await fetch(`${this.baseUrl.replace(/\/api\/v1$/, '')}/health`)
    const latencyMs = Date.now() - start
    const text = await response.text()
    return {
      status: response.ok ? text.trim() : 'error',
      latencyMs
    }
  }
}

export const api = new ApiService()
