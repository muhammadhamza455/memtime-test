<template>
  <header class="navbar">
    <div class="navbar-container">
      <div class="brand-group">
        <div class="brand-logo">
          <svg viewBox="0 0 32 32" fill="none" class="brand-svg">
            <rect width="32" height="32" rx="8" fill="url(#brandGrad)" />
            <circle cx="16" cy="16" r="10" stroke="#FFFFFF" stroke-width="2.5" stroke-dasharray="40 10" />
            <polyline points="16 10 16 16 20 18" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            <defs>
              <linearGradient id="brandGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stop-color="#0284c7" />
                <stop offset="1" stop-color="#2563eb" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="brand-text">
          <div class="brand-name">
            <span>MEMTIME</span>
            <span class="brand-badge">APP TEAM</span>
          </div>
          <div class="brand-sub">Enterprise Time Tracking & Hierarchy</div>
        </div>
      </div>

      <div class="navbar-center">
        <div
          class="rate-limit-card"
          :class="{
            'rate-good': rateLimitStore.remaining > 6,
            'rate-warn': rateLimitStore.remaining <= 6 && rateLimitStore.remaining > 2,
            'rate-danger': rateLimitStore.remaining <= 2
          }"
          title="API allows 15 requests per 60 seconds. Requests beyond that are queued automatically, never dropped."
        >
          <div class="rate-status-dot"></div>
          <div class="rate-content">
            <span class="rate-label">{{ rateLimitStore.blocked ? 'Rate limited, retrying:' : 'API requests left:' }}</span>
            <span class="rate-val">{{ rateLimitStore.remaining }} / {{ rateLimitStore.limit }}</span>
          </div>
          <div
            v-if="rateLimitStore.resetSeconds > 0"
            class="rate-timer"
            :title="`Next request slot frees up in ${rateLimitStore.resetSeconds} seconds`"
          >
            <Timer :size="13" />
            <span>{{ rateLimitStore.resetSeconds }}s</span>
          </div>
        </div>
      </div>

      <div class="navbar-actions">
        <button
          v-if="timerStore.isRunning"
          type="button"
          class="live-timer-chip"
          :title="timerStore.isPaused ? 'Timer paused' : 'Timer running'"
          @click="emit('toggleTimer')"
        >
          <span class="pulse-indicator"></span>
          <Clock :size="14" />
          <span class="timer-digits">{{ timerStore.formattedTime }}</span>
        </button>

        <button
          v-else
          type="button"
          class="btn btn-outline btn-sm timer-btn"
          aria-label="Open timer"
          @click="emit('toggleTimer')"
        >
          <Play :size="14" />
          <span class="btn-label">Timer</span>
        </button>

        <button
          type="button"
          class="btn btn-primary btn-sm"
          aria-label="Log time"
          @click="timeEntriesStore.openCreateModal()"
        >
          <Plus :size="16" />
          <span class="btn-label">Log Time</span>
        </button>

        <button
          type="button"
          class="btn-icon"
          @click="emit('openApiKeyModal')"
          title="API & Connection Settings"
          aria-label="API Settings"
        >
          <Settings :size="18" />
        </button>

        <button
          type="button"
          class="btn-icon"
          @click="emit('toggleTheme')"
          :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
          :aria-label="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
        >
          <Sun v-if="isDark" :size="18" />
          <Moon v-else :size="18" />
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useRateLimitStore } from '../stores/rateLimit'
import { useTimeEntriesStore } from '../stores/timeEntries'
import { useTimerStore } from '../stores/timer'
import {
  Timer,
  Clock,
  Play,
  Plus,
  Settings,
  Sun,
  Moon
} from 'lucide-vue-next'

defineProps<{
  isDark: boolean
}>()

const emit = defineEmits<{
  (e: 'openApiKeyModal'): void
  (e: 'toggleTheme'): void
  (e: 'toggleTimer'): void
}>()

const rateLimitStore = useRateLimitStore()
const timeEntriesStore = useTimeEntriesStore()
const timerStore = useTimerStore()
</script>

<style scoped>
.navbar {
  height: 68px;
  background: var(--surface-navbar);
  border-bottom: 1px solid var(--border-color);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 100;
}

.navbar-container {
  max-width: 1600px;
  margin: 0 auto;
  height: 100%;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.brand-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-svg {
  width: 36px;
  height: 36px;
  display: block;
}

.brand-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  letter-spacing: -0.02em;
  font-size: 1.15rem;
  color: var(--text-primary);
}

.brand-badge {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  letter-spacing: 0.05em;
}

.brand-sub {
  font-size: 0.725rem;
  color: var(--text-muted);
}

.navbar-center {
  display: flex;
  align-items: center;
}

.rate-limit-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px;
  border-radius: 20px;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  font-size: 0.8rem;
  transition: all 0.2s ease;
}

.rate-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
}

.rate-content {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rate-label {
  color: var(--text-muted);
}

.rate-val {
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-primary);
}

.rate-timer {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--surface-subtle);
  color: var(--text-secondary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
}

.rate-good .rate-status-dot {
  background: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
}

.rate-warn {
  border-color: rgba(245, 158, 11, 0.4);
}
.rate-warn .rate-status-dot {
  background: #f59e0b;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
}

.rate-danger {
  border-color: rgba(239, 68, 68, 0.5);
  animation: pulseRate 1.5s infinite;
}
.rate-danger .rate-status-dot {
  background: #ef4444;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
}

@keyframes pulseRate {
  0%, 100% {
    box-shadow: 0 0 0 rgba(239, 68, 68, 0);
  }
  50% {
    box-shadow: 0 0 12px rgba(239, 68, 68, 0.3);
  }
}

.navbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.live-timer-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 20px;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.35);
  color: #10b981;
  cursor: pointer;
  font-size: 0.85rem;
  line-height: inherit;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  transition: all 0.2s ease;
}

.live-timer-chip:hover {
  background: rgba(16, 185, 129, 0.25);
}

.pulse-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@media (max-width: 820px) {
  .brand-sub {
    display: none;
  }
  .navbar-center {
    display: none;
  }
}

@media (max-width: 560px) {
  .navbar-container {
    padding: 0 16px;
  }
  .brand-text,
  .btn-label {
    display: none;
  }
  .navbar-actions {
    gap: 6px;
  }
}
</style>
