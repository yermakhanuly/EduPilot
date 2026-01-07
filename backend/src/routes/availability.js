import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time')
const availabilitySchema = z.object({
  day: z.coerce.number().int().min(0).max(6),
  start: timeSchema,
  end: timeSchema,
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

  const rules = await prisma.availabilityRule.findMany({
    where: { userId },
    orderBy: [{ day: 'asc' }, { start: 'asc' }],
  })

  return res.json({ rules })
})

router.post('/', requireAuth, async (req, res) => {
  const parsed = availabilitySchema.safeParse(req.body)
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

  const rule = await prisma.availabilityRule.create({
    data: {
      userId,
      day: parsed.data.day,
      start: parsed.data.start,
      end: parsed.data.end,
    },
  })

  return res.status(201).json({ rule })
})

router.delete('/:id', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const result = await prisma.availabilityRule.deleteMany({
    where: { id: req.params.id, userId },
  })

  if (result.count === 0) {
    return res.status(404).json({ error: 'Availability rule not found' })
  }

  return res.json({ success: true })
})

export default router
