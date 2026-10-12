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

export const DEFAULT_BASE_URL: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'https://interview-api.memtime-demo.deno.net/api/v1'
export const DEFAULT_API_KEY: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_KEY) ||
  't2On0w9hkjQNrfnKEaO7FhsVrfPLXZS2'

// Documented server policy: 15 requests per 60s window, keyed by API key.
const RATE_LIMIT = 15
const RATE_WINDOW_MS = 60_000
// Backoff schedule for 429s. In the browser the ratelimit-* headers are not
// exposed via CORS, so we cannot read the real reset time and back off instead.
const RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 30_000]
// Page size used when we need to walk an entire collection.
const FULL_PAGE_SIZE = 100

type RateLimitListener = (state: RateLimitState) => void

interface CacheEntry<T> {
  data: T
  timestamp: number
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function isApiError(err: unknown, status?: number): err is ApiError {
  return err instanceof ApiError && (status === undefined || err.status === status)
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export class ApiService {
  private baseUrl: string
  private apiKey: string
  private cache = new Map<string, CacheEntry<unknown>>()
  private inflight = new Map<string, Promise<unknown>>()
  private cacheTtlMs = 180_000
  private rateLimitListeners: RateLimitListener[] = []

  // Client-side sliding window of our own request timestamps. This is the
  // source of truth for throttling because the browser cannot read the
  // server's ratelimit headers.
  private requestLog: number[] = []
  private blockedUntil = 0
  private serverRemaining: number | null = null
  private serverRemainingAt = 0
  private slotQueue: Promise<void> = Promise.resolve()

  constructor() {
    const hasStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
    this.baseUrl = (hasStorage ? window.localStorage.getItem('memtime_base_url') : null) || DEFAULT_BASE_URL
    this.apiKey = (hasStorage ? window.localStorage.getItem('memtime_api_key') : null) || DEFAULT_API_KEY
  }

  public getBaseUrl(): string {
    return this.baseUrl
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.trim().replace(/\/+$/, '')
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
    listener(this.getRateLimit())
    return () => {
      this.rateLimitListeners = this.rateLimitListeners.filter((l) => l !== listener)
    }
  }

  public getRateLimit(): RateLimitState {
    const now = Date.now()
    this.pruneLog(now)
    let remaining = Math.max(0, RATE_LIMIT - this.requestLog.length)
    // Headers are only visible outside the browser (e.g. Node test runs).
    // When they are fresh and stricter than our own estimate, trust them.
    if (this.serverRemaining !== null && now - this.serverRemainingAt < RATE_WINDOW_MS) {
      remaining = Math.min(remaining, this.serverRemaining)
    }
    if (this.blockedUntil > now) remaining = 0

    const oldest = this.requestLog[0]
    const windowResetMs = oldest ? oldest + RATE_WINDOW_MS - now : 0
    const resetMs = Math.max(windowResetMs, this.blockedUntil - now, 0)

    return {
      limit: RATE_LIMIT,
      remaining,
      resetSeconds: Math.ceil(resetMs / 1000),
      blocked: this.blockedUntil > now,
      updatedAt: now
    }
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

  private notifyRateLimit(): void {
    const state = this.getRateLimit()
    for (const listener of this.rateLimitListeners) {
      listener(state)
    }
  }

  private pruneLog(now: number): void {
    while (this.requestLog.length > 0 && now - this.requestLog[0] >= RATE_WINDOW_MS) {
      this.requestLog.shift()
    }
  }

  /**
   * Waits until a request can be sent without exceeding the rate limit, then
   * records it. Calls are serialised so concurrent callers cannot all observe
   * the same free slot.
   */
  private acquireSlot(): Promise<void> {
    const next = this.slotQueue.then(async () => {
      for (;;) {
        const now = Date.now()
        this.pruneLog(now)
        if (this.blockedUntil > now) {
          await sleep(this.blockedUntil - now)
          continue
        }
        if (this.requestLog.length < RATE_LIMIT) {
          this.requestLog.push(now)
          this.notifyRateLimit()
          return
        }
        await sleep(this.requestLog[0] + RATE_WINDOW_MS - now + 50)
      }
    })
    this.slotQueue = next.catch(() => undefined)
    return next
  }

  private updateRateLimitFromHeaders(headers: Headers): void {
    const remaining = headers.get('ratelimit-remaining')
    const reset = headers.get('ratelimit-reset')
    if (remaining === null) return

    const now = Date.now()
    this.serverRemaining = parseInt(remaining, 10)
    this.serverRemainingAt = now
    if (this.serverRemaining <= 0 && reset !== null) {
      this.blockedUntil = Math.max(this.blockedUntil, now + parseInt(reset, 10) * 1000)
    }
    this.notifyRateLimit()
  }

  private buildQueryString(params?: PaginationParams): string {
    if (!params) return ''
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value))
      }
    }
    const qs = searchParams.toString()
    return qs ? `?${qs}` : ''
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, bypassCache = false): Promise<T> {
    const isGet = !options.method || options.method.toUpperCase() === 'GET'

    if (isGet && !bypassCache) {
      const cached = this.cache.get(endpoint)
      if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
        return cached.data as T
      }
      // Share a single in-flight request between concurrent identical GETs.
      const pending = this.inflight.get(endpoint)
      if (pending) return pending as Promise<T>
    }

    const promise = this.send<T>(endpoint, options, isGet)
    if (isGet) {
      this.inflight.set(endpoint, promise)
      promise.then(
        () => this.inflight.delete(endpoint),
        () => this.inflight.delete(endpoint)
      )
    }
    return promise
  }

  private async send<T>(endpoint: string, options: RequestInit, isGet: boolean): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
    const headers = new Headers(options.headers || {})
    headers.set('Authorization', `Bearer ${this.apiKey}`)
    if (typeof options.body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    for (let attempt = 0; ; attempt++) {
      await this.acquireSlot()

      let response: Response
      try {
        response = await fetch(url, { ...options, headers })
      } catch {
        throw new ApiError('Network error: could not reach the Memtime API. Check your connection.', 0)
      }

      this.updateRateLimitFromHeaders(response.headers)

      if (response.status === 429) {
        // A 429 is rejected before the handler runs, so retrying is safe for
        // mutations too. The key may be shared, so our own log can be wrong.
        const resetHeader = response.headers.get('ratelimit-reset')
        const delay = resetHeader
          ? Math.max(1, parseInt(resetHeader, 10)) * 1000
          : RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]
        this.blockedUntil = Math.max(this.blockedUntil, Date.now() + delay)
        this.notifyRateLimit()
        if (attempt < RETRY_DELAYS_MS.length) continue
        throw new ApiError('Rate limit exceeded (15 requests per minute). Please wait a moment and try again.', 429)
      }

      const contentType = response.headers.get('content-type') || ''
      const data: unknown = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : await response.text()

      if (!response.ok) {
        const message =
          typeof data === 'object' && data !== null && 'error' in data
            ? String((data as { error: unknown }).error)
            : typeof data === 'string' && data.trim().length > 0
              ? data.trim()
              : `Request failed with status ${response.status}`
        throw new ApiError(message, response.status)
      }

      if (isGet) {
        this.cache.set(endpoint, { data, timestamp: Date.now() })
      }
      return data as T
    }
  }

  /** Walks every page of a list endpoint. */
  private async fetchAllPages<T>(path: string, bypassCache: boolean): Promise<T[]> {
    const all: T[] = []
    for (let offset = 0; ; offset += FULL_PAGE_SIZE) {
      const qs = this.buildQueryString({ limit: FULL_PAGE_SIZE, offset })
      const page = await this.request<T[]>(`${path}${qs}`, { method: 'GET' }, bypassCache)
      all.push(...page)
      if (page.length < FULL_PAGE_SIZE) return all
    }
  }

  public async getClients(params?: PaginationParams, bypassCache = false): Promise<Client[]> {
    return this.request<Client[]>(`/clients${this.buildQueryString(params)}`, { method: 'GET' }, bypassCache)
  }

  public async getClient(id: number, bypassCache = false): Promise<Client> {
    return this.request<Client>(`/clients/${id}`, { method: 'GET' }, bypassCache)
  }

  public async getClientProjects(
    clientId: number,
    params?: PaginationParams,
    bypassCache = false
  ): Promise<Project[]> {
    const qs = this.buildQueryString(params)
    return this.request<Project[]>(`/clients/${clientId}/projects${qs}`, { method: 'GET' }, bypassCache)
  }

  public async getAllClientProjects(clientId: number, bypassCache = false): Promise<Project[]> {
    return this.fetchAllPages<Project>(`/clients/${clientId}/projects`, bypassCache)
  }

  public async getProject(id: number, bypassCache = false): Promise<Project> {
    return this.request<Project>(`/projects/${id}`, { method: 'GET' }, bypassCache)
  }

  public async getProjectTasks(
    projectId: number,
    params?: PaginationParams,
    bypassCache = false
  ): Promise<Task[]> {
    const qs = this.buildQueryString(params)
    return this.request<Task[]>(`/projects/${projectId}/tasks${qs}`, { method: 'GET' }, bypassCache)
  }

  public async getAllProjectTasks(projectId: number, bypassCache = false): Promise<Task[]> {
    return this.fetchAllPages<Task>(`/projects/${projectId}/tasks`, bypassCache)
  }

  public async getTask(id: number, bypassCache = false): Promise<Task> {
    return this.request<Task>(`/tasks/${id}`, { method: 'GET' }, bypassCache)
  }

  public async getTimeEntries(params?: PaginationParams, bypassCache = false): Promise<TimeEntry[]> {
    const qs = this.buildQueryString(params)
    return this.request<TimeEntry[]>(`/time-entries${qs}`, { method: 'GET' }, bypassCache)
  }

  public async getAllTimeEntries(bypassCache = false): Promise<TimeEntry[]> {
    return this.fetchAllPages<TimeEntry>('/time-entries', bypassCache)
  }

  public async getTimeEntry(id: number, bypassCache = false): Promise<TimeEntry> {
    return this.request<TimeEntry>(`/time-entries/${id}`, { method: 'GET' }, bypassCache)
  }

  public async createTimeEntry(payload: CreateTimeEntryPayload): Promise<TimeEntry> {
    try {
      return await this.request<TimeEntry>('/time-entries', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    } finally {
      this.invalidateCachePrefix('/time-entries')
    }
  }

  public async updateTimeEntry(id: number, payload: UpdateTimeEntryPayload): Promise<TimeEntry> {
    try {
      return await this.request<TimeEntry>(`/time-entries/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
    } finally {
      this.invalidateCachePrefix('/time-entries')
    }
  }

  public async deleteTimeEntry(id: number): Promise<{ message: string }> {
    try {
      return await this.request<{ message: string }>(`/time-entries/${id}`, {
        method: 'DELETE'
      })
    } finally {
      this.invalidateCachePrefix('/time-entries')
    }
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
