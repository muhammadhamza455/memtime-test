export function formatDateTime(isoString: string): string {
  if (!isoString) return '-'
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d)
  } catch {
    return isoString
  }
}

export function formatTimeOnly(isoString: string): string {
  if (!isoString) return '-'
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(d)
  } catch {
    return isoString
  }
}

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return '0m'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hrs > 0) {
    return `${hrs}h ${mins}m`
  }
  if (mins > 0) {
    return `${mins}m ${secs > 0 ? `${secs}s` : ''}`
  }
  return `${secs}s`
}

export function calculateDurationBetween(startIso: string, endIso: string): number {
  if (!startIso || !endIso) return 0
  const s = new Date(startIso).getTime()
  const e = new Date(endIso).getTime()
  if (isNaN(s) || isNaN(e)) return 0
  return Math.max(0, Math.floor((e - s) / 1000))
}

export function toDateTimeLocalString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const hh = pad(date.getHours())
  const mm = pad(date.getMinutes())
  return `${y}-${m}-${d}T${hh}:${mm}`
}

export function fromDateTimeLocalToIso(localStr: string): string {
  if (!localStr) return ''
  const d = new Date(localStr)
  return d.toISOString()
}
