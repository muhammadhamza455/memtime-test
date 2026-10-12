import { api } from './src/services/api.ts'
import {
  formatDateTime,
  formatDuration,
  calculateDurationBetween,
  toDateTimeLocalString,
  fromDateTimeLocalToIso
} from './src/utils/date.ts'

async function runTests() {
  console.log('--- Starting Memtime Core & API Verification Suite ---')

  console.log('1. Testing Date & Duration Utilities...')
  const durSecs = calculateDurationBetween('2026-10-10T10:00:00Z', '2026-10-10T12:30:00Z')
  if (durSecs !== 9000) throw new Error(`Duration calculation failed: expected 9000, got ${durSecs}`)
  const durFormatted = formatDuration(durSecs)
  if (durFormatted !== '2h 30m') throw new Error(`Duration format failed: expected "2h 30m", got "${durFormatted}"`)
  const localStr = toDateTimeLocalString(new Date('2026-10-10T10:00:00Z'))
  if (!localStr.includes('2026')) throw new Error(`Local date format failed: ${localStr}`)
  console.log('   ✓ Date utilities verified.')

  console.log('2. Testing Health Check Endpoint (/health)...')
  const health = await api.checkHealth()
  console.log(`   ✓ Health status: "${health.status}" (${health.latencyMs}ms)`)

  console.log('3. Testing Task 1: Fetch Clients (/clients)...')
  const clients = await api.getClients({ limit: 5, offset: 0 })
  if (!Array.isArray(clients) || clients.length === 0) throw new Error('Failed to fetch clients')
  const firstClient = clients[0]
  console.log(`   ✓ Fetched ${clients.length} clients. First: #${firstClient.id} "${firstClient.name}"`)

  console.log(`4. Testing Task 1: Fetch Projects for Client #${firstClient.id} (/clients/:id/projects)...`)
  const projects = await api.getClientProjects(firstClient.id)
  if (!Array.isArray(projects)) throw new Error('Failed to fetch projects')
  console.log(`   ✓ Fetched ${projects.length} projects for client #${firstClient.id}.`)

  let sampleTaskId = 398
  if (projects.length > 0) {
    const firstProject = projects[0]
    console.log(`5. Testing Task 1: Fetch Tasks for Project #${firstProject.id} (/projects/:id/tasks)...`)
    const tasks = await api.getProjectTasks(firstProject.id)
    if (!Array.isArray(tasks)) throw new Error('Failed to fetch tasks')
    console.log(`   ✓ Fetched ${tasks.length} tasks for project #${firstProject.id}.`)
    if (tasks.length > 0) sampleTaskId = tasks[0].id
  }

  console.log('6. Testing Task 2: Fetch Time Entries (/time-entries)...')
  const entries = await api.getTimeEntries({ limit: 10, offset: 0 })
  if (!Array.isArray(entries)) throw new Error('Failed to fetch time entries')
  console.log(`   ✓ Fetched ${entries.length} time entries.`)

  console.log('7. Testing Task 3: Create New Time Entry (POST /time-entries)...')
  const newEntry = await api.createTimeEntry({
    taskId: sampleTaskId,
    comment: 'Automated E2E Test Entry - Senior Full-Stack Application Team',
    start: '2026-10-10T09:00:00.000Z',
    end: '2026-10-10T11:00:00.000Z'
  })
  if (!newEntry || typeof newEntry.id !== 'number') throw new Error('Create time entry failed')
  console.log(`   ✓ Created time entry #${newEntry.id} for task #${newEntry.taskId}`)

  console.log(`8. Testing Task 3: Update Time Entry (PUT /time-entries/:id)...`)
  const updatedEntry = await api.updateTimeEntry(newEntry.id, {
    taskId: sampleTaskId,
    comment: 'Updated Automated E2E Test Entry',
    start: '2026-10-10T09:30:00.000Z',
    end: '2026-10-10T11:30:00.000Z'
  })
  console.log(`   ✓ Updated time entry successfully: comment is "${updatedEntry.comment}"`)

  console.log(`9. Testing Delete Time Entry (DELETE /time-entries/:id)...`)
  const deleteRes = await api.deleteTimeEntry(newEntry.id)
  console.log(`   ✓ Delete result: ${JSON.stringify(deleteRes)}`)

  console.log('10. Testing Rate Limit Tracking State...')
  const rateLimit = api.getRateLimit()
  console.log(`   ✓ Rate limit status: ${rateLimit.remaining} / ${rateLimit.limit} remaining (resets in ${rateLimit.resetSeconds}s)`)

  console.log('\n--- ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ---')
}

runTests().catch((err) => {
  console.error('Verification failed:', err)
  process.exit(1)
})
