import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

const dateTimeSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: 'Invalid date',
  })

const baseEventSchema = z.object({
  title: z.string().min(1),
  type: z.string().min(1).default('exam'),
  start: dateTimeSchema,
  end: dateTimeSchema,
  notes: z.string().optional().nullable(),
})

router.get('/', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  await prisma.fixedEvent.deleteMany({
    where: { userId, end: { lt: new Date() } },
  })

  const events = await prisma.fixedEvent.findMany({
    where: { userId },
    orderBy: { start: 'asc' },
  })

  return res.json({ events })
})

router.post('/', requireAuth, async (req, res) => {
  const parsed = baseEventSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', issues: parsed.error.flatten() })
  }

  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const start = new Date(parsed.data.start)
  const end = new Date(parsed.data.end)
  if (end <= start) {
    return res.status(400).json({ error: 'End time must be after start time' })
  }

  const event = await prisma.fixedEvent.create({
    data: {
      userId,
      title: parsed.data.title,
      type: parsed.data.type,
      start,
      end,
      notes: parsed.data.notes ?? null,
    },
  })

  return res.status(201).json({ event })
})

router.delete('/:id', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const result = await prisma.fixedEvent.deleteMany({
    where: { id: req.params.id, userId },
  })

  if (result.count === 0) {
    return res.status(404).json({ error: 'Event not found' })
  }

  return res.json({ success: true })
})

export default router
