const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS
const MONTH_MS = 30 * DAY_MS

function pluralize(value, unit) {
  return value === 1 ? `${value} ${unit}` : `${value} ${unit}s`
}

export function formatTimeUntil(deadline) {
  if (!deadline) return 'No deadline'
  const due = new Date(deadline)
  if (Number.isNaN(due.getTime())) return 'No deadline'

  const diffMs = due.getTime() - Date.now()
  if (diffMs <= 0) return 'Past due'

  if (diffMs >= MONTH_MS) {
    const months = Math.ceil(diffMs / MONTH_MS)
    return `Due in ${pluralize(months, 'month')}`
  }
  if (diffMs >= WEEK_MS) {
    const weeks = Math.ceil(diffMs / WEEK_MS)
    return `Due in ${pluralize(weeks, 'week')}`
  }
  if (diffMs >= DAY_MS) {
    const days = Math.ceil(diffMs / DAY_MS)
    return `Due in ${pluralize(days, 'day')}`
  }
  if (diffMs >= HOUR_MS) {
    const hours = Math.ceil(diffMs / HOUR_MS)
    return `Due in ${pluralize(hours, 'hour')}`
  }
  const minutes = Math.max(1, Math.ceil(diffMs / MINUTE_MS))
  return `Due in ${pluralize(minutes, 'minute')}`
}
