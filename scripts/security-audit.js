const BASE_URL = 'https://interview-api.memtime-demo.deno.net/api/v1'
const API_KEY = 't2On0w9hkjQNrfnKEaO7FhsVrfPLXZS2'

async function runSecurityAudit() {
  console.log('====================================================')
  console.log('   MEMTIME SECURITY AUDIT & POSTMAN SUITE RUNNER    ')
  console.log('====================================================\n')

  let passed = 0
  let total = 0

  function assert(condition, testName) {
    total++
    if (condition) {
      passed++
      console.log(`[PASS] ${testName}`)
    } else {
      console.error(`[FAIL] ${testName}`)
    }
  }

  console.log('1. Authentication Boundary Testing:')
  const resNoAuth = await fetch(`${BASE_URL}/clients`)
  assert(resNoAuth.status === 401, 'Request without Authorization header is rejected with HTTP 401 Unauthorized')

  const resInvalidAuth = await fetch(`${BASE_URL}/clients`, {
    headers: { Authorization: 'Bearer fake_invalid_malicious_token' }
  })
  assert(resInvalidAuth.status === 401, 'Request with invalid Bearer token is rejected with HTTP 401 Unauthorized')

  const resBasicAuth = await fetch(`${BASE_URL}/clients`, {
    headers: { Authorization: 'Basic dXNlcjpwYXNz' }
  })
  assert(
    resBasicAuth.status === 400 || resBasicAuth.status === 401,
    `Request with non-Bearer scheme is rejected with HTTP ${resBasicAuth.status} (expected 400 or 401)`
  )

  console.log('\n2. Rate Limiting & Resource Attribution Inspection:')
  const resRateLimit = await fetch(`${BASE_URL}/clients`, {
    headers: { Authorization: `Bearer ${API_KEY}` }
  })
  const limit = resRateLimit.headers.get('ratelimit-limit')
  const remaining = resRateLimit.headers.get('ratelimit-remaining')
  const reset = resRateLimit.headers.get('ratelimit-reset')
  const policy = resRateLimit.headers.get('ratelimit-policy')

  assert(limit === '15', `Server enforces ratelimit-limit: ${limit} reqs`)
  assert(remaining !== null && parseInt(remaining, 10) <= 15, `Server transmits ratelimit-remaining: ${remaining}`)
  assert(reset !== null, `Server transmits ratelimit-reset: ${reset}s`)
  assert(policy === '15;w=60', `Server enforces policy: ${policy} (15 req per 60s window)`)

  console.log('\n3. Input Validation & Type Safety Boundaries:')
  const resBadType = await fetch(`${BASE_URL}/time-entries`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      taskId: 'string_injection_attack',
      comment: 'Valid comment',
      start: '2026-10-10T09:00:00.000Z',
      end: '2026-10-10T10:00:00.000Z'
    })
  })
  assert(resBadType.status === 400, 'Rejects string taskId with HTTP 400 Bad Request')

  const resMissingFields = await fetch(`${BASE_URL}/time-entries`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      taskId: 398
    })
  })
  assert(resMissingFields.status === 400, 'Rejects missing required fields with HTTP 400 Bad Request')

  const resInvalidDate = await fetch(`${BASE_URL}/time-entries`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      taskId: 398,
      comment: 'Test invalid dates',
      start: 'not-an-iso-date',
      end: '2026-10-10T10:00:00.000Z'
    })
  })
  assert(resInvalidDate.status === 400, 'Rejects non-ISO date with HTTP 400 Bad Request')

  console.log('\n4. Resource Boundary & 404 Handling:')
  const resNotFound = await fetch(`${BASE_URL}/time-entries/999999999`, {
    headers: { Authorization: `Bearer ${API_KEY}` }
  })
  assert(resNotFound.status === 404, 'Non-existent time entry returns HTTP 404 Not Found')

  console.log('\n5. XSS & Payload Sanitization:')
  const xssPayload = '<script>alert("xss")</script><img src=x onerror=alert(1)>'
  const resXss = await fetch(`${BASE_URL}/time-entries`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      taskId: 398,
      comment: xssPayload,
      start: '2026-10-10T10:00:00.000Z',
      end: '2026-10-10T11:00:00.000Z'
    })
  })
  assert(resXss.status === 201, 'API accepts payload as raw text without server-side execution')
  const createdXss = await resXss.json()
  assert(createdXss.comment === xssPayload, 'API preserves raw comment string intact')

  await fetch(`${BASE_URL}/time-entries/${createdXss.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${API_KEY}` }
  })
  console.log('   ✓ Cleaned up test record')

  console.log('\n====================================================')
  console.log(`SUMMARY: ${passed} / ${total} SECURITY CHECKS PASSED (${Math.round((passed / total) * 100)}%)`)
  console.log('====================================================\n')

  if (passed !== total) {
    process.exit(1)
  }
}

runSecurityAudit().catch((err) => {
  console.error('Security audit encountered unhandled exception:', err)
  process.exit(1)
})
