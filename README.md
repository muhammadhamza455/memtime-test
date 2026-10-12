# Memtime - Senior Full-Stack JavaScript Engineer Solution

A production-grade, responsive time-tracking and project hierarchy application built for Memtime using **Vue 3**, **Vite**, **TypeScript**, and **Pinia**. Designed to deliver an intuitive experience for paying customers while handling strict API rate limits (15 requests/minute), tree hierarchies, and complete CRUD time-entry workflows.

---

## 🚀 Key Features & Implementation Highlights

### Task 1: Hierarchical Clients, Projects & Tasks Tree
- **Tree Visualization**: Displays clients, projects, and tasks in a nested, expandable hierarchy with custom tree-guide indentation lines and status pills.
- **Rate-Limit-Safe On-Demand Fetching**: Instead of eager-loading hundreds of nodes (which would immediately exceed the 15 req/min rate limit), child nodes load lazily when their parent is expanded.
- **Smart SWR Caching**: Once loaded, nodes are cached in memory. Collapsing and expanding nodes does not consume API quota.
- **Search & Filter**: Real-time filtering across client names, project names, and task names.
- **Pagination**: Dedicated pagination toolbar for clients (`limit`, `offset`) with smooth previous/next navigation.
- **Quick Task Actions**: Click any task to filter time entries, launch a live timer, or directly open the time-logging modal.

### Task 2: Time Entries Management & Analytics
- **Data Table**: Columns for Entry ID, Task ID, Breadcrumb context (`Client > Project > Task`), Comment, Start Time, End Time, Duration, Created At, and Actions.
- **Task Filtering**: Filter entries by any specific task (with a one-click chip remover).
- **Sorting**: Multi-column sorting (`id`, `taskId`, `start`, `end`, `createdAt`) in ascending/descending order.
- **Metrics Dashboard**: Displays real-time calculations for Total Recorded Time, Active Scope, and Logged Entries count.
- **Search**: Search entries by comment, task ID, or entry ID.
- **Pagination Toolbar**: Configurable rows per page (5, 10, 20, 50) and page navigation.

### Task 3: Create & Update Time Entry Form
- **Unified Modal**: Create new entries (`POST /time-entries`) and update existing entries (`PUT /time-entries/:id`).
- **Full CRUD Support**: Complete delete functionality (`DELETE /time-entries/:id`) with safety confirmation modal.
- **Input Validation**: Validates positive task IDs, non-empty comments, and ensures end time occurs after start time.
- **Live Duration Calculator**: Real-time duration calculation as timestamps are picked.
- **Quick Preset Chips**: Buttons for `+15m`, `+30m`, `+1h`, `+2h`, and `End Now`.
- **Robust Error Handling**: Explicitly handles HTTP 400 (bad input/JSON), HTTP 404 (not found), and HTTP 429 (rate limits) with clear user feedback.

### Senior Engineer UX & Architectural Additions
- **Live Stopwatch / Activity Tracker**: A running timer allowing users to start, pause, resume, and convert tracked time directly into a logged entry.
- **Live Rate-Limit Meter**: Reads `ratelimit-remaining`, `ratelimit-reset`, and `ratelimit-limit` response headers, displaying a real-time countdown and status gauge.
- **Automatic 429 Exponential Backoff**: Automatically pauses and retries requests when rate limits are approached or encountered.
- **API & Health Configuration**: Interactive modal to test connectivity (`/health`), view latency, and configure API keys.
- **Theme Switcher**: Dark and Light themes with persistent state.

---

## 🛠️ Technology Stack

- **Framework**: Vue 3 (Composition API with `<script setup>`)
- **Build Tool**: Vite 8+
- **Language**: TypeScript 6+
- **State Management**: Pinia 4+
- **Icons**: Lucide Vue (`@lucide/vue`)
- **Styling**: Vanilla CSS Design System with CSS Custom Properties and Glassmorphism

---

## 📦 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/) in your browser.

### 3. Run Automated Test Suites
* **End-to-End Core Verification**:
  ```bash
  npm test
  ```
  Executes automated tests validating all endpoints (`/health`, `/clients`, `/clients/:id/projects`, `/projects/:id/tasks`, `/time-entries`, `POST`, `PUT`, `DELETE`).

* **Postman Collection & Newman Runner**:
  ```bash
  npm run test:postman
  ```
  Executes the official `memtime_api.postman_collection.json` via Newman, running 19 automated assertions across status codes, schema validity, rate limit headers, and authentication boundaries.

* **Security & Boundary Audit**:
  ```bash
  npm run test:security
  ```
  Runs 13 dedicated security tests verifying token boundaries (missing/invalid/malformed tokens), input injection protection, strict type safety, rate-limit policies, and 404 boundaries.

### 4. Build for Production
```bash
npm run build
```

---

## 🔒 Security Architecture & Hardening

1. **Bearer Token Authentication Boundary**: All `/api/v1` endpoints enforce `Authorization: Bearer <API_KEY>`. Missing or invalid tokens immediately reject with HTTP 401.
2. **Credential Masking**: The API settings modal masks tokens with password-style bulleting and toggleable visibility to protect against shoulder-surfing during screen-shares or meetings.
3. **Input Sanitization & Injection Prevention**: Text comments, task IDs, and date fields are strictly parsed, trimmed, and validated before submission. Vue 3's templating engines inherently escape HTML, preventing stored/DOM-based XSS attacks.
4. **Rate Limit DDoS & Resource Protection**: The client-side scheduler observes server rate-limit headers (`ratelimit-remaining`, `ratelimit-reset`, `ratelimit-policy`) and throttles requests to guarantee compliance with the 15 req/60s quota.
5. **Transport Security**: All API traffic runs exclusively over HTTPS with strict CORS policies.

---

## 💡 Production Scaling & Future Improvements

1. **Virtual Scrolling**: For enterprise clients with 10,000+ tasks, implement virtual list rendering (`vue-virtual-scroller`).
2. **WebSocket / Real-Time Sync**: Add WebSocket listeners to sync time entries across multiple devices in real-time.
3. **Offline Sync & IndexedDB**: Queue time entries locally in IndexedDB when network connection drops, syncing upon reconnection.
