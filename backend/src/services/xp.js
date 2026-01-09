const BASE_RATE = 1
const TASK_COMPLETION_XP = 20

export function taskCompletionXp() {
  return TASK_COMPLETION_XP
}

export function difficultyMultiplier(difficulty) {
  if (!difficulty) return 1
  switch (difficulty.toLowerCase()) {
    case 'easy':
      return 1
    case 'hard':
      return 1.5
    case 'medium':
    default:
      return 1.25
  }
}

export function urgencyMultiplier(deadline) {
  if (!deadline) return 1
  const due = new Date(deadline)
  if (Number.isNaN(due.getTime())) return 1
  const diffMs = due.getTime() - Date.now()
  const diffHours = diffMs / (1000 * 60 * 60)
  if (diffHours <= 24) return 1.2
  if (diffHours <= 72) return 1.1
  return 1
}

export function strictModeMultiplier(strictMode) {
  return strictMode ? 1.15 : 1
}

export function streakBonusMultiplier(streak) {
  if (streak >= 15) return 1.2
  if (streak >= 8) return 1.1
  if (streak >= 4) return 1.05
  return 1
}

export function computeSessionBaseXp({ minutes, difficulty, deadline, strictMode }) {
  const baseXp = minutes * BASE_RATE
  const multiplier =
    difficultyMultiplier(difficulty) *
    urgencyMultiplier(deadline) *
    strictModeMultiplier(strictMode)
  return Math.round(baseXp * multiplier)
}

export function applyStreakBonus(dailyBaseXp, streak) {
  return Math.round(dailyBaseXp * streakBonusMultiplier(streak))
}

export function levelFromXp(totalXp) {
  const safeXp = Math.max(0, totalXp)
  const rawLevel = Math.floor(Math.sqrt(safeXp / 100))
  const level = Math.max(1, rawLevel)
  const currentThreshold = level === 1 ? 0 : 100 * level ** 2
  const nextThreshold = 100 * (level + 1) ** 2
  const progressToNext =
    nextThreshold > currentThreshold
      ? Math.min(1, (safeXp - currentThreshold) / (nextThreshold - currentThreshold))
      : 0

  return { level, nextThreshold, progressToNext }
}

export function computeWeeklyStats(sessions) {
  const totalXp = sessions.reduce((sum, session) => sum + session.xpEarned, 0)
  const totalMinutes = sessions.reduce((sum, session) => sum + session.focusedMinutes, 0)
  return { totalXp, totalMinutes }
}
