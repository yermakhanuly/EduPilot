import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

const askSchema = z.object({
  question: z.string().min(1),
})

function formatAvailability(rules) {
  if (!rules.length) return 'No availability rules set.'
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return rules
    .map((rule) => `${dayNames[rule.day]} ${rule.start}-${rule.end}`)
    .join(', ')
}

router.post('/ask', requireAuth, async (req, res) => {
  if (!env.OPENAI_API_KEY) {
    return res.status(400).json({ error: 'OpenAI API key not configured' })
  }

  const parsed = askSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', issues: parsed.error.flatten() })
  }

  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const [tasks, rules, events, stats, blocks] = await Promise.all([
    prisma.task.findMany({ where: { userId }, orderBy: { deadline: 'asc' } }),
    prisma.availabilityRule.findMany({ where: { userId }, orderBy: [{ day: 'asc' }, { start: 'asc' }] }),
    prisma.fixedEvent.findMany({ where: { userId }, orderBy: { start: 'asc' } }),
    prisma.userStats.findUnique({ where: { userId } }),
    prisma.studyBlock.findMany({
      where: { userId, start: { gte: new Date() } },
      orderBy: { start: 'asc' },
      take: 12,
      include: { task: { select: { title: true } } },
    }),
  ])

  const context = {
    tasks: tasks.map((task) => ({
      title: task.title,
      deadline: task.deadline?.toISOString() ?? null,
      remainingHours: task.remainingHours,
      priority: task.priority,
      status: task.status,
    })),
    availability: formatAvailability(rules),
    fixedEvents: events.map((event) => ({
      title: event.title,
      type: event.type,
      start: event.start.toISOString(),
      end: event.end.toISOString(),
    })),
    stats: stats
      ? {
          totalXp: stats.totalXp,
          weeklyXp: stats.weeklyXp,
          streak: stats.streak,
          level: stats.level,
        }
      : null,
    upcomingBlocks: blocks.map((block) => ({
      title: block.task?.title ?? 'Focus block',
      start: block.start.toISOString(),
      end: block.end.toISOString(),
      status: block.status,
    })),
  }

  const hasData = tasks.length > 0 || rules.length > 0 || events.length > 0 || blocks.length > 0
  if (!hasData) {
    return res.json({
      answer:
        'No study data is available yet. Add tasks, availability rules, or exams and try again so I can give personalized guidance.',
    })
  }

  let response
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 400,
        messages: [
          {
            role: 'system',
            content:
              'You are EduPilot, a concise study coach. Use the provided user data to answer. If data is missing, say so and suggest what to add.',
          },
          {
            role: 'user',
            content: `Question: ${parsed.data.question}\n\nUser data:\n${JSON.stringify(context, null, 2)}`,
          },
        ],
      }),
    })
  } catch (error) {
    return res.status(500).json({ error: 'OpenAI request failed', detail: error.message })
  }

  if (!response.ok) {
    const errorText = await response.text()
    return res.status(500).json({ error: 'OpenAI request failed', detail: errorText })
  }

  const data = await response.json()
  const answer = data.choices?.[0]?.message?.content?.trim()

  return res.json({ answer: answer || 'No response generated.' })
})

export default router
