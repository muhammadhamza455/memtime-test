export function formatDateTime(isoString: string): string {
  if (!isoString) return '-'
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return isoString
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d)
}

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return '0m'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hrs > 0) {
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
  }
  if (mins > 0) {
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
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
  return isNaN(d.getTime()) ? '' : d.toISOString()
}

export function formatDateOnly(isoString: string): string {
  const d = new Date(isoString)
  if (!isoString || isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
}

export function formatTimeOnly(isoString: string): string {
  const d = new Date(isoString)
  if (!isoString || isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(d)
}
