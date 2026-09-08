import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { runAssistant } from '../services/assistantAgent.js'

const router = Router()

const askSchema = z.object({
  question: z.string().min(1),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1) })).max(50).optional(),
})

function formatClasses(classes) {
  if (!classes.length) return 'No weekly classes set.'
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return classes.map((item) => `${dayNames[item.day]} ${item.start}-${item.end} ${item.title}`).join(', ')
}

router.post('/ask', requireAuth, async (req, res) => {
  const parsed = askSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', issues: parsed.error.flatten() })
  if (!env.GROQ_API_KEY) return res.status(400).json({ error: 'Groq API key not configured' })

  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Not authenticated' })

  try {
    const now = new Date()
    const [tasks, classes, events, stats, blocks] = await Promise.all([
      prisma.task.findMany({ where: { userId, status: { not: 'completed' }, OR: [{ deadline: null }, { deadline: { gte: now } }] }, orderBy: { deadline: 'asc' } }),
      prisma.weeklyClass.findMany({ where: { userId }, orderBy: [{ day: 'asc' }, { start: 'asc' }] }),
      prisma.fixedEvent.findMany({ where: { userId, end: { gte: now } }, orderBy: { start: 'asc' } }),
      prisma.userStats.findUnique({ where: { userId } }),
      prisma.studyBlock.findMany({ where: { userId, start: { gte: now } }, orderBy: { start: 'asc' }, take: 12, include: { task: { select: { title: true } } } }),
    ])

    const context = {
      tasks: tasks.map((item) => ({ id: item.id, title: item.title, deadline: item.deadline?.toISOString() ?? null, remainingHours: item.remainingHours, priority: item.priority, status: item.status })),
      weeklyClasses: classes.map((item) => ({ id: item.id, title: item.title, day: item.day, start: item.start, end: item.end, location: item.location ?? null })),
      weeklyClassSummary: formatClasses(classes),
      fixedEvents: events.map((item) => ({ id: item.id, title: item.title, type: item.type, start: item.start.toISOString(), end: item.end.toISOString() })),
      stats: stats ? { totalXp: stats.totalXp, weeklyXp: stats.weeklyXp, streak: stats.streak, level: stats.level } : null,
      upcomingBlocks: blocks.map((item) => ({ title: item.task?.title ?? 'Focus block', start: item.start.toISOString(), end: item.end.toISOString(), status: item.status })),
    }

    return res.json(await runAssistant({ userId, question: parsed.data.question, history: (parsed.data.history ?? []).slice(-20), context, apiKey: env.GROQ_API_KEY }))
  } catch (error) {
    return res.status(500).json({ error: 'Groq assistant request failed', detail: error.message })
  }
})

export default router
