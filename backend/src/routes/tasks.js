import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { levelFromXp, taskCompletionXp } from '../services/xp.js'

const router = Router()

const optionalDateSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .string()
    .optional()
    .nullable()
    .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), {
      message: 'Invalid date',
    }),
)

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  deadline: optionalDateSchema,
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
  priority: z.coerce.number().int().min(1).max(5).default(1),
  remainingHours: z.coerce.number().int().min(0).default(0),
  status: z.string().optional().default('pending'),
})

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  deadline: optionalDateSchema,
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  priority: z.coerce.number().int().min(1).max(5).optional(),
  remainingHours: z.coerce.number().int().min(0).optional(),
  status: z.string().optional(),
})

router.get('/', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

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
    where: { userId, status: { not: 'completed' } },
    orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
  })

  return res.json({ tasks })
})

router.post('/', requireAuth, async (req, res) => {
  const parsed = createTaskSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', issues: parsed.error.flatten() })
  }

  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const deadline = parsed.data.deadline ? new Date(parsed.data.deadline) : null

  const task = await prisma.task.create({
    data: {
      userId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      deadline,
      difficulty: parsed.data.difficulty,
      priority: parsed.data.priority,
      remainingHours: parsed.data.remainingHours,
      status: parsed.data.status,
    },
  })

  return res.status(201).json({ task })
})

router.patch('/:id', requireAuth, async (req, res) => {
  const parsed = updateTaskSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', issues: parsed.error.flatten() })
  }

  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const existing = await prisma.task.findFirst({ where: { id: req.params.id, userId } })
  if (!existing) {
    return res.status(404).json({ error: 'Task not found' })
  }

  const updates = { ...parsed.data }
  if (parsed.data.deadline !== undefined) {
    updates.deadline = parsed.data.deadline ? new Date(parsed.data.deadline) : null
  }

  let completionXp = 0
  const isCompleting = updates.status === 'completed' && existing.status !== 'completed'
  if (isCompleting) {
    updates.completedAt = new Date()
    const minutesSinceCreated = (Date.now() - existing.createdAt.getTime()) / (1000 * 60)
    if (!existing.completionXpAwarded && minutesSinceCreated >= 5) {
      completionXp = taskCompletionXp()
      updates.completionXpAwarded = true
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({
      where: { id: req.params.id, userId },
      data: updates,
    })

    if (completionXp > 0) {
      const stats = await tx.userStats.findUnique({ where: { userId } })
      const totalXp = (stats?.totalXp ?? 0) + completionXp
      const weeklyXp = (stats?.weeklyXp ?? 0) + completionXp
      const { level } = levelFromXp(totalXp)
      await tx.userStats.upsert({
        where: { userId },
        update: {
          totalXp,
          weeklyXp,
          level,
        },
        create: {
          userId,
          totalXp,
          weeklyXp,
          level,
        },
      })
    }
  })

  const updated = await prisma.task.findFirst({ where: { id: req.params.id, userId } })
  return res.json({ task: updated, completionXpAwarded: completionXp > 0 })
})

router.delete('/:id', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const result = await prisma.task.deleteMany({
    where: { id: req.params.id, userId },
  })

  if (result.count === 0) {
    return res.status(404).json({ error: 'Task not found' })
  }

  return res.json({ success: true })
})

export default router
