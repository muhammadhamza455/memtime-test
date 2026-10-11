<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="close">
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="api-modal-title">
      <div class="modal-header">
        <div class="modal-title-group">
          <KeyRound class="modal-icon" :size="20" />
          <h2 id="api-modal-title">API & Authentication Settings</h2>
        </div>
        <button type="button" class="btn-icon" @click="close" aria-label="Close modal">
          <X :size="18" />
        </button>
      </div>

      <div class="modal-content">
        <div class="info-banner">
          <Info :size="16" />
          <span>
            Memtime REST API v1 uses Bearer token authentication with a rate limit of 15 requests per 60-second window.
          </span>
        </div>

        <div class="form-group">
          <label for="base-url-input">API Base URL</label>
          <input
            id="base-url-input"
            v-model="baseUrl"
            type="text"
            class="form-input"
            placeholder="https://interview-api.memtime-demo.deno.net/api/v1"
          />
        </div>

        <div class="form-group">
          <label for="api-key-input">Bearer Token / API Key</label>
          <div class="input-with-actions">
            <input
              id="api-key-input"
              v-model="apiKey"
              :type="showKey ? 'text' : 'password'"
              class="form-input"
              placeholder="Enter Bearer Token"
            />
            <button
              type="button"
              class="input-action-btn"
              @click="showKey = !showKey"
              :title="showKey ? 'Hide key' : 'Show key'"
            >
              <EyeOff v-if="showKey" :size="16" />
              <Eye v-else :size="16" />
            </button>
          </div>
        </div>

        <div class="health-test-box">
          <div class="health-header">
            <span class="health-label">API Health Check (/health)</span>
            <button
              type="button"
              class="btn btn-sm btn-outline"
              :disabled="isTesting"
              @click="runHealthCheck"
            >
              <RefreshCw :class="{ spinning: isTesting }" :size="14" />
              {{ isTesting ? 'Pinging...' : 'Test Connection' }}
            </button>
          </div>
          <div v-if="healthResult" class="health-status-result" :class="healthResult.status">
            <CheckCircle2 v-if="healthResult.status === 'ok'" :size="16" />
            <AlertCircle v-else :size="16" />
            <span>{{ healthResult.message }} ({{ healthResult.latency }}ms)</span>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" @click="resetToDefault">
          Reset Default
        </button>
        <div class="footer-actions">
          <button type="button" class="btn btn-ghost" @click="close">
            Cancel
          </button>
          <button type="button" class="btn btn-primary" @click="saveSettings">
            <Save :size="16" />
            Save & Reconnect
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { api } from '../services/api'
import { useToastStore } from '../stores/toast'
import {
  KeyRound,
  X,
  Info,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Save
} from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
}>()

const toast = useToastStore()
const baseUrl = ref('')
const apiKey = ref('')
const showKey = ref(false)
const isTesting = ref(false)
const healthResult = ref<{ status: 'ok' | 'error'; message: string; latency: number } | null>(null)

watch(
  () => props.isOpen,
  (val) => {
    if (val) {
      baseUrl.value = api.getBaseUrl()
      apiKey.value = api.getApiKey()
      healthResult.value = null
    }
  },
  { immediate: true }
)

async function runHealthCheck(): Promise<void> {
  isTesting.value = true
  try {
    const res = await api.checkHealth()
    if (res.status === "I'm alive!" || res.status.toLowerCase().includes('alive') || res.status === 'ok') {
      healthResult.value = {
        status: 'ok',
        message: `API is online: "${res.status}"`,
        latency: res.latencyMs
      }
      toast.success('API health verified successfully!')
    } else {
      healthResult.value = {
        status: 'error',
        message: `Unexpected health response: ${res.status}`,
        latency: res.latencyMs
      }
    }
  } catch (err: unknown) {
    healthResult.value = {
      status: 'error',
      message: err instanceof Error ? err.message : 'Connection failed',
      latency: 0
    }
    toast.error('Could not reach API server')
  } finally {
    isTesting.value = false
  }
}

function saveSettings(): void {
  if (!baseUrl.value.trim() || !apiKey.value.trim()) {
    toast.warning('Base URL and API Key cannot be empty')
    return
  }

  api.setBaseUrl(baseUrl.value)
  api.setApiKey(apiKey.value)
  toast.success('API settings updated successfully')
  emit('saved')
  close()
}

function resetToDefault(): void {
  baseUrl.value = 'https://interview-api.memtime-demo.deno.net/api/v1'
  apiKey.value = 't2On0w9hkjQNrfnKEaO7FhsVrfPLXZS2'
  toast.info('Reset to default Memtime test credentials')
}

function close(): void {
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.modal-card {
  width: 100%;
  max-width: 520px;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalPop {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.modal-icon {
  color: var(--color-primary);
}

.modal-header h2 {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.modal-content {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  font-size: 0.85rem;
  line-height: 1.4;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.input-with-actions {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-actions .form-input {
  padding-right: 40px;
  width: 100%;
}

.input-action-btn {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.input-action-btn:hover {
  color: var(--text-primary);
}

.health-test-box {
  background: var(--surface-subtle);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.health-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.health-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.health-status-result {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.825rem;
  padding: 8px 12px;
  border-radius: 8px;
}

.health-status-result.ok {
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
}

.health-status-result.error {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  background: var(--surface-subtle);
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
