<template>
  <div class="app-layout" :data-theme="isDark ? 'dark' : 'light'">
    <Navbar
      :is-dark="isDark"
      @toggle-theme="toggleTheme"
      @open-api-key-modal="isApiKeyModalOpen = true"
      @toggle-timer="isTimerVisible = !isTimerVisible"
    />

    <TimerWidget
      :is-visible="isTimerVisible"
      @close="isTimerVisible = false"
    />

    <main class="main-content">
      <div class="content-container">
        <div class="mobile-tab-bar">
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeMobileTab === 'hierarchy' }"
            @click="activeMobileTab = 'hierarchy'"
          >
            <Layers :size="16" />
            <span>Hierarchy Tree</span>
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeMobileTab === 'entries' }"
            @click="activeMobileTab = 'entries'"
          >
            <ListFilter :size="16" />
            <span>Time Entries ({{ timeEntriesStore.totalFilteredCount }})</span>
          </button>
        </div>

        <div class="app-split-layout">
          <section
            class="split-col col-hierarchy"
            :class="{ 'mobile-hidden': activeMobileTab !== 'hierarchy' }"
          >
            <HierarchyTree />
          </section>

          <section
            class="split-col col-entries"
            :class="{ 'mobile-hidden': activeMobileTab !== 'entries' }"
          >
            <TimeEntriesList />
          </section>
        </div>
      </div>
    </main>

    <TimeEntryModal />
    <DeleteConfirmModal />
    <ApiKeyModal
      :is-open="isApiKeyModalOpen"
      @close="isApiKeyModalOpen = false"
      @saved="onSettingsSaved"
    />
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Navbar from './components/Navbar.vue'
import TimerWidget from './components/TimerWidget.vue'
import HierarchyTree from './components/HierarchyTree/HierarchyTree.vue'
import TimeEntriesList from './components/TimeEntries/TimeEntriesList.vue'
import TimeEntryModal from './components/TimeEntries/TimeEntryModal.vue'
import DeleteConfirmModal from './components/TimeEntries/DeleteConfirmModal.vue'
import ApiKeyModal from './components/ApiKeyModal.vue'
import ToastContainer from './components/ToastContainer.vue'
import { useTimeEntriesStore } from './stores/timeEntries'
import { useHierarchyStore } from './stores/hierarchy'
import { Layers, ListFilter } from 'lucide-vue-next'

const isDark = ref(true)
const isTimerVisible = ref(false)
const isApiKeyModalOpen = ref(false)
const activeMobileTab = ref<'hierarchy' | 'entries'>('hierarchy')

const timeEntriesStore = useTimeEntriesStore()
const hierarchyStore = useHierarchyStore()

function toggleTheme(): void {
  isDark.value = !isDark.value
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
  localStorage.setItem('memtime_theme', isDark.value ? 'dark' : 'light')
}

function onSettingsSaved(): void {
  hierarchyStore.refreshHierarchy()
  timeEntriesStore.fetchEntries(true)
}

onMounted(() => {
  const savedTheme = localStorage.getItem('memtime_theme')
  if (savedTheme) {
    isDark.value = savedTheme === 'dark'
  } else {
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
})
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-app);
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
}

.content-container {
  max-width: 1600px;
  width: 100%;
  margin: 0 auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mobile-tab-bar {
  display: none;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 4px;
  gap: 4px;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn.active {
  background: var(--surface-card-hover);
  color: var(--text-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.app-split-layout {
  display: grid;
  grid-template-columns: 460px 1fr;
  gap: 20px;
  flex: 1;
  min-height: calc(100vh - 120px);
}

.split-col {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  min-height: 580px;
}

.col-hierarchy {
  position: sticky;
  top: 88px;
}

.col-entries {
  overflow: hidden;
}

@media (max-width: 1080px) {
  .app-split-layout {
    grid-template-columns: 380px 1fr;
    gap: 16px;
  }
}

@media (max-width: 860px) {
  .mobile-tab-bar {
    display: flex;
  }

  .app-split-layout {
    display: flex;
    flex-direction: column;
    min-height: auto;
  }

  .split-col {
    height: auto;
    min-height: 550px;
  }

  .mobile-hidden {
    display: none !important;
  }

  .col-hierarchy {
    position: static;
  }
}
</style>
