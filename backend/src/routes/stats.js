import { Router } from 'express'
import { prisma } from '../config/prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { computeWeeklyStats, levelFromXp } from '../services/xp.js'

const router = Router()

router.get('/weekly', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  const now = new Date()
  const start = new Date()
  start.setDate(now.getDate() - 7)

  const sessions = await prisma.studySession.findMany({
    where: { userId, startedAt: { gte: start } },
    orderBy: { startedAt: 'asc' },
  })

  const summary = computeWeeklyStats(
    sessions.map((session) => ({
      xpEarned: session.xpEarned,
      focusedMinutes: session.focusedMinutes,
      startedAt: session.startedAt,
    })),
  )

  return res.json({
    range: { start, end: now },
    summary,
    sessions,
  })
})

router.get('/overview', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  const stats = await prisma.userStats.findUnique({ where: { userId } })
  const levelInfo = stats ? levelFromXp(stats.totalXp) : { level: 1, nextThreshold: 500, progressToNext: 0 }

  await prisma.task.deleteMany({
    where: {
      userId,
      OR: [
        { deadline: { lt: new Date() } },
        { status: 'completed', source: { not: 'canvas' } },
      ],
    },
  })

  const tasks = await prisma.task.findMany({
    where: {
      userId,
      status: { not: 'completed' },
      OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
    },
    orderBy: { deadline: 'asc' },
    select: { id: true, title: true, deadline: true, status: true, priority: true },
    take: 5,
  })

  return res.json({
    stats: stats ?? null,
    level: levelInfo,
    spotlightTasks: tasks,
  })
})

router.get('/leaderboard', requireAuth, async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const rawLimit = Number.parseInt(req.query.limit?.toString() ?? '10', 10)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 10

  const entries = await prisma.userStats.findMany({
    orderBy: [{ totalXp: 'desc' }, { weeklyXp: 'desc' }, { id: 'asc' }],
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  const leaderboard = entries.map((entry, index) => ({
    rank: index + 1,
    userId: entry.userId,
    name: entry.user?.name ?? 'Pilot',
    totalXp: entry.totalXp,
    weeklyXp: entry.weeklyXp,
    streak: entry.streak,
  }))

  return res.json({ leaderboard })
})

export default router
