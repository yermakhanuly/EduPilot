import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { generatePlan, reoptimizePlan } from '../services/planner.js'

const router = Router()

const taskSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  deadline: z.string().optional().nullable(),
  remainingHours: z.coerce.number().nonnegative(),
  priority: z.coerce.number().int().min(1).max(5),
})

const fixedEventSchema = z.object({
  title: z.string().optional(),
  start: z.string(),
  end: z.string(),
})

const planBodySchema = z.object({
  tasks: z.array(taskSchema).optional(),
  fixedEvents: z.array(fixedEventSchema).optional(),
  availabilityRules: z
    .array(
      z.object({
        day: z.number().int().min(0).max(6),
        start: z.string(),
        end: z.string(),
      }),
    )
    .optional(),
})

function normalizeDeadline(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function normalizeTasks(tasks) {
  return tasks
    .map((task) => ({
      id: task.id,
      title: task.title,
      deadline: normalizeDeadline(task.deadline),
      remainingHours: task.remainingHours,
      priority: task.priority,
    }))
    .filter((task) => task.remainingHours > 0)
}

async function resolvePlanInputs(userId, body, weekStart) {
  const defaultAvailabilityRules = Array.from({ length: 7 }, (_value, day) => ({
    day,
    start: '08:00',
    end: '23:59',
  }))

  const tasks = body.tasks === undefined
    ? await prisma.task.findMany({
        where: {
          userId,
          status: { not: 'completed' },
          OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
        },
      })
    : body.tasks

  if (body.tasks === undefined) {
    await prisma.task.deleteMany({
      where: {
        userId,
        OR: [
          { deadline: { lt: new Date() } },
          { status: 'completed', source: { not: 'canvas' } },
        ],
      },
    })
  }

  const classes = await prisma.weeklyClass.findMany({
    where: { userId },
    orderBy: [{ day: 'asc' }, { start: 'asc' }],
  })

  const fixedEvents = body.fixedEvents === undefined
    ? await prisma.fixedEvent.findMany({
        where: { userId, end: { gte: new Date() } },
        orderBy: { start: 'asc' },
      })
    : body.fixedEvents

  if (body.fixedEvents === undefined) {
    await prisma.fixedEvent.deleteMany({
      where: { userId, end: { lt: new Date() } },
    })
  }

  const weekStartDate = new Date(weekStart ?? new Date().toISOString())
  const weekBase = Number.isNaN(weekStartDate.getTime()) ? new Date() : weekStartDate
  weekBase.setHours(0, 0, 0, 0)

  const classEvents = classes.map((classItem) => {
    const [startHour, startMinute] = classItem.start.split(':').map((value) => Number(value))
    const [endHour, endMinute] = classItem.end.split(':').map((value) => Number(value))
    const dayDate = new Date(weekBase)
    dayDate.setDate(dayDate.getDate() + classItem.day)
    const start = new Date(dayDate)
    start.setHours(startHour, startMinute, 0, 0)
    const end = new Date(dayDate)
    end.setHours(endHour, endMinute, 0, 0)
    return {
      title: classItem.title,
      start: start.toISOString(),
      end: end.toISOString(),
    }
  })

  const availabilityRules = body.availabilityRules ?? defaultAvailabilityRules

  return {
    tasks: normalizeTasks(tasks),
    availabilityRules: availabilityRules.map((rule) => ({
      day: rule.day,
      start: rule.start,
      end: rule.end,
    })),
    fixedEvents: [
      ...fixedEvents.map((event) => ({
        title: event.title ?? undefined,
        start: event.start instanceof Date ? event.start.toISOString() : event.start,
        end: event.end instanceof Date ? event.end.toISOString() : event.end,
      })),
      ...classEvents,
    ],
  }
}

router.post('/generate', requireAuth, async (req, res) => {
  const weekStart = req.query.weekStart?.toString()
  if (!weekStart) {
    return res.status(400).json({ error: 'weekStart query param is required' })
  }

  const parsed = planBodySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.flatten() })
  }

  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const inputs = await resolvePlanInputs(userId, parsed.data, weekStart)
  const plan = generatePlan({
    weekStart,
    tasks: inputs.tasks,
    fixedEvents: inputs.fixedEvents,
    availabilityRules: inputs.availabilityRules,
  })

  const startDate = new Date(weekStart)
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 7)

  await prisma.studyBlock.deleteMany({
    where: {
      userId,
      start: { gte: startDate },
      end: { lte: endDate },
    },
  })

  if (plan.blocks.length > 0) {
    await prisma.studyBlock.createMany({
      data: plan.blocks.map((block) => ({
        userId,
        taskId: block.taskId ?? null,
        start: block.start,
        end: block.end,
        source: block.source,
      })),
    })
  }

  return res.json(plan)
})

router.post('/reoptimize', requireAuth, async (req, res) => {
  const weekStart = req.query.weekStart?.toString()
  if (!weekStart) {
    return res.status(400).json({ error: 'weekStart query param is required' })
  }

  const reoptSchema = planBodySchema.extend({
    missedTaskIds: z.array(z.string().uuid()).optional(),
  })

  const parsed = reoptSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.flatten() })
  }

  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const inputs = await resolvePlanInputs(userId, parsed.data, weekStart)
  const plan = reoptimizePlan({
    weekStart,
    tasks: inputs.tasks,
    missedTaskIds: parsed.data.missedTaskIds,
    fixedEvents: inputs.fixedEvents,
    availabilityRules: inputs.availabilityRules,
  })

  return res.json(plan)
})

router.get('/blocks', requireAuth, async (req, res) => {
  const weekStart = req.query.weekStart?.toString()
  if (!weekStart) {
    return res.status(400).json({ error: 'weekStart query param is required' })
  }

  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const startDate = new Date(weekStart)
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 7)

  const blocks = await prisma.studyBlock.findMany({
    where: {
      userId,
      start: { gte: startDate },
      end: { lte: endDate },
    },
    orderBy: { start: 'asc' },
    include: { task: { select: { title: true } } },
  })

  return res.json({
    blocks: blocks.map((block) => ({
      id: block.id,
      taskId: block.taskId,
      title: block.task?.title ?? 'Focus block',
      start: block.start,
      end: block.end,
      status: block.status,
      source: block.source,
    })),
  })
})

export default router
