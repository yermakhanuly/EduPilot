export function xpForFocusedMinutes(focusedMinutes, streak, includeCompletionBonus = false) {
  const baseRate = 5 // XP per focused minute
  const streakBonusMultiplier = 1 + Math.min(streak, 10) * 0.02
  const completionBonus = includeCompletionBonus ? 50 : 0

  return Math.round(focusedMinutes * baseRate * streakBonusMultiplier + completionBonus)
}

const LEVEL_THRESHOLDS = [0, 500, 1200, 2200, 3600, 5200, 7000, 9000, 11200]

export function levelFromXp(totalXp) {
  let level = 1
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i += 1) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1
    }
  }
  const nextThreshold = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + 2000
  const progressToNext = nextThreshold > 0 ? Math.min(1, totalXp / nextThreshold) : 0

  return { level, nextThreshold, progressToNext }
}

export function computeWeeklyStats(sessions) {
  const totalXp = sessions.reduce((sum, session) => sum + session.xpEarned, 0)
  const totalMinutes = sessions.reduce((sum, session) => sum + session.focusedMinutes, 0)
  return { totalXp, totalMinutes }
}
