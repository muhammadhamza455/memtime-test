# Memtime – Time Entries & Project Hierarchy

A Vue 3 + TypeScript + Pinia client for the Memtime interview API. It shows clients, projects and tasks as a tree (Task 1), lists the user's time entries with pagination (Task 2), and creates, updates and deletes time entries (Task 3). It is built around the API's hard limit of **15 requests per minute**.

---

## Getting started

```bash
npm install
cp .env.example .env   # optional: the demo base URL and API key are also the built-in defaults
npm run dev            # http://127.0.0.1:5173/
```

| Command | What it does |
| --- | --- |
| `npm run build` | Type-checks (`vue-tsc`) and builds for production |
| `npm test` | Runs the live API verification script (`test-runner.js`): utilities, every endpoint, and create/update/delete round trip |
| `npm run test:security` | Auth boundaries (401s), input validation (400s), 404s, rate-limit headers |
| `npm run test:postman` | Runs the Postman collection with Newman |

The test scripts hit the shared demo API and use your rate-limit budget.

---

## How each task is solved

### Task 1: Hierarchy (clients → projects → tasks)

- **Lazy loading.** There are 100 clients with about 2 projects each. Loading the whole tree up front would take 300+ requests, about 20 minutes at 15 requests per minute. Instead, projects load when you expand a client and tasks load when you expand a project. Loaded results are cached, so collapsing and re-expanding costs nothing.
- **Pagination.** The client list uses `limit`/`offset` and requests one extra row to tell whether a next page exists, because the API returns no total count. Projects and tasks are read page by page (`limit=100`) until a short page arrives, so nothing is cut off.
- **Expand All** loads the current page in the background through the request queue, and you can cancel it with Collapse or by changing page.
- Each task has **Filter** (show only this task's entries) and **Log Time** (open the form with the task already filled in).

### Task 2: Time entries list

- **Server-side pagination with query parameters.** Each page is a single request, `GET /time-entries?limit=N+1&offset=…&sortBy=…&order=…`. The extra row tells whether a next page exists.
- **Per-task view and search.** The API has no `taskId` or text filter (unknown query parameters are ignored), so filtering reads every page once (normally one request), then filters and paginates locally. Total time and entry counts are exact in this mode.
- Columns: ID, Task ID, context (Client › Project › Task, once the tree has loaded that task), Comment, Start, End, Created At, Duration. ID, Task ID, Start, End and Created At are sortable and show the sort direction.

### Task 3: Create and update form

- One modal handles both `POST /time-entries` and `PUT /time-entries/:id`. Success messages show the new entry's ID, or the updated entry's details.
- **Validation before sending:** a task is required; the comment cannot be blank (the API itself accepts empty comments); the end time must come after the start time; durations over 12 hours and end times in the future get a warning.
- **Error handling.** The API's own error text is shown. A **404 for an unknown task** is shown on the Task field. A **404 for an entry** (deleted elsewhere) removes the row and refreshes the list. **400** responses (invalid JSON, start after end) appear in a banner. **429** is retried automatically.
- **Fewer mistakes when entering time:** you pick tasks by name, grouped by client and project; the task you are filtering or have selected is filled in for you; duration presets set the end time from the start time; editing keeps the original seconds unless you change a time field; saving an unchanged edit sends no request; Escape closes the form and Ctrl+Enter saves it.
- Delete asks for confirmation. **Duplicate** opens a new entry with the same task, comment and duration, ending now.

### Timer

Start/Pause/Resume a stopwatch, then **Finish & Log**. The form opens with the tracked time range and the comment already filled in. The timer is cleared only after the entry is saved: if you cancel the form, the timer stays paused and nothing is lost. Timer state is stored in `localStorage`, so it survives a page reload. Elapsed time is calculated from timestamps, so it stays accurate in background tabs.

---

## Rate limiting

The API allows 15 requests per 60 seconds per API key. In the browser, the server's `ratelimit-*` headers **cannot be read**, because the API does not send `Access-Control-Expose-Headers`. The client therefore enforces the limit itself:

- `ApiService` keeps a **sliding window** of its own requests. When the window is full, the next request **waits in a queue** instead of failing. Identical GET requests in flight at the same time share one network call. GET responses are cached for 3 minutes, and any write clears the time-entry cache.
- The API key is shared, so other clients can use up the quota. A **429** is therefore retried with backoff (5s, 10s, 20s, 30s). This is safe for writes too, because the server rejects a request with 429 before processing it. Where the headers are readable (for example in Node test runs), they are used as well.
- The navbar gauge shows how many requests are left and when the next slot frees up.

Checked against the live API: 18 requests started at once completed with **zero** 429 errors. The first batch went out immediately and the rest went out about 60 seconds later.

---

## Observed API behaviour (verified against the live API)

| Observation | How the client handles it |
| --- | --- |
| No `Access-Control-Expose-Headers`, so the browser cannot read rate-limit headers | Client-side request queue (above) |
| No total count; `limit`/`offset` only | Lookahead row for "has next page" |
| No `taskId` filter; unknown or invalid `sortBy` values are silently ignored | Full read plus local filtering for the per-task view; only valid sort fields are sent |
| Tasks have `projectId`; the documented `parent` field is missing | The type accepts both |
| `POST` with an unknown task returns `404 "Task #N not found"` | Error is shown on the Task field |
| An empty `comment` is accepted | Validated in the client |
| 429 responses have a plain-text body | Text is used as the error message |
| **Data is stored in memory per server instance.** Newly created entries can disappear without being deleted, and IDs get reused | The server is treated as the source of truth: the list re-reads after every change, and a 404 on edit or delete is handled cleanly instead of showing entries that no longer exist |

---

## Trade-offs and next steps

- **API key in the bundle.** Any `VITE_*` value is visible in the browser, and the demo key is the default. A real product would route API calls through a backend that authenticates the user and keeps the key on the server.
- **API changes that would help most:** a `taskId` filter and a total count (`X-Total-Count`) on `/time-entries`, so the per-task view would not need a full read; exposing the `ratelimit-*` headers via CORS.
- **Task picker.** The form lists tasks the tree has already loaded, with manual ID entry as a fallback. A searchable Client → Project → Task picker that loads on demand would remove the need to expand the tree first.
- **Tests.** Add Vitest unit tests for the stores (pagination modes, timer, form validation) and Playwright end-to-end tests against a mocked API, so CI does not depend on the shared rate limit.
- **Offline.** Queue new entries in IndexedDB while offline and sync them when the connection returns.
