import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { applyStreakBonus, computeSessionBaseXp, levelFromXp } from '../services/xp.js'

const router = Router()

const startSchema = z.object({
  blockId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  mode: z.string().default('focus'),
})

const finishSchema = z.object({
  sessionId: z.string().uuid(),
  focusedMinutes: z.number().nonnegative(),
  completed: z.boolean().default(true),
  strictMode: z.boolean().optional().default(false),
})

router.post('/start', requireAuth, async (req, res) => {
  const parsed = startSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.flatten() })
  }

  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  const session = await prisma.studySession.create({
    data: {
      userId,
      taskId: parsed.data.taskId,
      blockId: parsed.data.blockId,
      status: 'in-progress',
    },
  })

  if (parsed.data.blockId) {
    await prisma.studyBlock.updateMany({
      where: { id: parsed.data.blockId, userId },
      data: { status: 'in-progress' },
    })
  }

  return res.status(201).json({ session })
})

router.post('/finish', requireAuth, async (req, res) => {
  const parsed = finishSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.flatten() })
  }

  const { sessionId, focusedMinutes, completed, strictMode } = parsed.data
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId },
    include: { user: true, task: true },
  })

  if (!session) {
    return res.status(404).json({ error: 'Session not found' })
  }

  const existingStats = await prisma.userStats.findUnique({ where: { userId } })
  const now = new Date()
  const isValidSession = completed && focusedMinutes >= 10
  const baseSessionXp = isValidSession
    ? computeSessionBaseXp({
        minutes: focusedMinutes,
        difficulty: session.task?.difficulty,
        deadline: session.task?.deadline,
        strictMode,
      })
    : 0

  const dailyDate = existingStats?.dailyDate ? new Date(existingStats.dailyDate) : null
  const todayKey = now.toISOString().split('T')[0]
  const statsDayKey = dailyDate ? dailyDate.toISOString().split('T')[0] : null
  const isNewDay = statsDayKey !== todayKey
  const dailyBaseBefore = isNewDay ? 0 : existingStats?.dailyBaseXp ?? 0
  const dailyXpBefore = isNewDay ? 0 : existingStats?.dailyXp ?? 0

  let newStreak = existingStats?.streak ?? 0
  if (isValidSession) {
    if (!existingStats?.lastSessionAt) {
      newStreak = 1
    } else {
      const lastKey = new Date(existingStats.lastSessionAt).toISOString().split('T')[0]
      if (lastKey === todayKey) {
        newStreak = existingStats?.streak ?? 0
      } else {
        const yesterday = new Date(now)
        yesterday.setDate(now.getDate() - 1)
        const yesterdayKey = yesterday.toISOString().split('T')[0]
        newStreak = lastKey === yesterdayKey ? (existingStats?.streak ?? 0) + 1 : 1
      }
    }
  }

  const dailyBaseXp = dailyBaseBefore + baseSessionXp
  const dailyXp = isValidSession ? applyStreakBonus(dailyBaseXp, newStreak) : dailyXpBefore
  const xpEarned = Math.max(0, dailyXp - dailyXpBefore)
  const totalXp = (existingStats?.totalXp ?? 0) + xpEarned
  const weeklyXp = (existingStats?.weeklyXp ?? 0) + xpEarned
  const { level } = levelFromXp(totalXp)

  const [updatedSession] = await prisma.$transaction([
    prisma.studySession.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        focusedMinutes,
        status: completed ? 'completed' : 'missed',
        xpEarned,
      },
    }),
    prisma.userStats.upsert({
      where: { userId },
      update: {
        totalXp,
        weeklyXp,
        streak: newStreak,
        dailyBaseXp: isValidSession ? dailyBaseXp : existingStats?.dailyBaseXp ?? 0,
        dailyXp: isValidSession ? dailyXp : existingStats?.dailyXp ?? 0,
        dailyDate: isValidSession ? now : existingStats?.dailyDate ?? null,
        lastSessionAt: isValidSession ? now : existingStats?.lastSessionAt ?? null,
        level,
      },
      create: {
        userId,
        totalXp,
        weeklyXp,
        streak: newStreak,
        dailyBaseXp: dailyBaseXp,
        dailyXp: dailyXp,
        dailyDate: isValidSession ? now : null,
        lastSessionAt: isValidSession ? now : null,
        level,
      },
    }),
  ])

  if (session.blockId) {
    await prisma.studyBlock.updateMany({
      where: { id: session.blockId, userId },
      data: { status: completed ? 'completed' : 'missed' },
    })
  }

  return res.json({ session: updatedSession, xpEarned })
})

export default router
