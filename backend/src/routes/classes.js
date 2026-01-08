import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time')
const classSchema = z.object({
  title: z.string().min(1),
  day: z.coerce.number().int().min(0).max(6),
  start: timeSchema,
  end: timeSchema,
  location: z.string().optional().nullable(),
})

function toMinutes(value) {
  const [hours, minutes] = value.split(':').map((part) => Number(part))
  return hours * 60 + minutes
}

router.get('/', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const classes = await prisma.weeklyClass.findMany({
    where: { userId },
    orderBy: [{ day: 'asc' }, { start: 'asc' }],
  })

  return res.json({ classes })
})

router.post('/', requireAuth, async (req, res) => {
  const parsed = classSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', issues: parsed.error.flatten() })
  }

  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const startMinutes = toMinutes(parsed.data.start)
  const endMinutes = toMinutes(parsed.data.end)
  if (endMinutes <= startMinutes) {
    return res.status(400).json({ error: 'End time must be after start time' })
  }

  const created = await prisma.weeklyClass.create({
    data: {
      userId,
      title: parsed.data.title,
      day: parsed.data.day,
      start: parsed.data.start,
      end: parsed.data.end,
      location: parsed.data.location ?? null,
    },
  })

  return res.status(201).json({ class: created })
})

router.delete('/:id', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const result = await prisma.weeklyClass.deleteMany({
    where: { id: req.params.id, userId },
  })

  if (result.count === 0) {
    return res.status(404).json({ error: 'Class not found' })
  }

  return res.json({ success: true })
})

export default router
