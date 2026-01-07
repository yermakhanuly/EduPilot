import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { levelFromXp, xpForFocusedMinutes } from '../services/xp.js'

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

  const { sessionId, focusedMinutes, completed } = parsed.data
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId },
    include: { user: true },
  })

  if (!session) {
    return res.status(404).json({ error: 'Session not found' })
  }

  const existingStats = await prisma.userStats.findUnique({ where: { userId } })
  const xpEarned = xpForFocusedMinutes(focusedMinutes, existingStats?.streak ?? 0, completed)
  const newStreak = completed ? (existingStats?.streak ?? 0) + 1 : 0
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
        lastSessionAt: new Date(),
        level,
      },
      create: {
        userId,
        totalXp,
        weeklyXp,
        streak: newStreak,
        lastSessionAt: new Date(),
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
