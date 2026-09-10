import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { createAssistantRateLimiter } from '../middleware/assistantRateLimit.js'
import { generateConversationTitle, runAssistant } from '../services/assistantAgent.js'

const router = Router()

const askSchema = z.object({
  question: z.string().min(1),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1) })).max(50).optional(),
})
const createConversationSchema = z.object({ courseId: z.string().uuid().optional() })
const updateConversationSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  courseId: z.string().uuid().nullable().optional(),
})
const messageSchema = z.object({ content: z.string().trim().min(1).max(12000) })
const assistantRateLimit = createAssistantRateLimiter({ limit: env.ASSISTANT_RATE_LIMIT, windowMs: env.ASSISTANT_RATE_WINDOW_MINUTES * 60_000 })

function formatClasses(classes) {
  if (!classes.length) return 'No weekly classes set.'
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return classes.map((item) => `${dayNames[item.day]} ${item.start}-${item.end} ${item.title}`).join(', ')
}

async function buildAssistantContext(userId) {
  const now = new Date()
  const [tasks, classes, events, stats, blocks] = await Promise.all([
    prisma.task.findMany({ where: { userId, status: { not: 'completed' }, OR: [{ deadline: null }, { deadline: { gte: now } }] }, orderBy: { deadline: 'asc' } }),
    prisma.weeklyClass.findMany({ where: { userId }, orderBy: [{ day: 'asc' }, { start: 'asc' }] }),
    prisma.fixedEvent.findMany({ where: { userId, end: { gte: now } }, orderBy: { start: 'asc' } }),
    prisma.userStats.findUnique({ where: { userId } }),
    prisma.studyBlock.findMany({ where: { userId, start: { gte: now } }, orderBy: { start: 'asc' }, take: 12, include: { task: { select: { title: true } } } }),
  ])

  return {
    tasks: tasks.map((item) => ({ id: item.id, title: item.title, deadline: item.deadline?.toISOString() ?? null, remainingHours: item.remainingHours, priority: item.priority, status: item.status })),
    weeklyClasses: classes.map((item) => ({ id: item.id, title: item.title, day: item.day, start: item.start, end: item.end, location: item.location ?? null })),
    weeklyClassSummary: formatClasses(classes),
    fixedEvents: events.map((item) => ({ id: item.id, title: item.title, type: item.type, start: item.start.toISOString(), end: item.end.toISOString() })),
    stats: stats ? { totalXp: stats.totalXp, weeklyXp: stats.weeklyXp, streak: stats.streak, level: stats.level } : null,
    upcomingBlocks: blocks.map((item) => ({ title: item.task?.title ?? 'Focus block', start: item.start.toISOString(), end: item.end.toISOString(), status: item.status })),
  }
}

async function findOwnedConversation(id, userId) {
  return prisma.conversation.findFirst({ where: { id, userId }, include: { course: { select: { id: true, name: true, courseCode: true } } } })
}

async function validateCourse(courseId, userId) {
  if (!courseId) return null
  return prisma.course.findFirst({ where: { id: courseId, userId } })
}

router.get('/conversations', requireAuth, async (req, res) => {
  const userId = req.user?.id
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
  const conversations = await prisma.conversation.findMany({
    where: { userId, ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}) },
    orderBy: { updatedAt: 'desc' },
    include: { course: { select: { id: true, name: true, courseCode: true } }, _count: { select: { messages: true } } },
  })
  return res.json({ conversations })
})

router.get('/courses', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Not authenticated' })
  const courses = await prisma.course.findMany({
    where: { userId },
    orderBy: [{ courseCode: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, courseCode: true, source: true },
  })
  return res.json({ courses })
})

router.post('/conversations', requireAuth, async (req, res) => {
  const parsed = createConversationSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', issues: parsed.error.flatten() })
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Not authenticated' })
  if (parsed.data.courseId && !await validateCourse(parsed.data.courseId, userId)) return res.status(404).json({ error: 'Course not found' })
  const conversation = await prisma.conversation.create({
    data: { userId, courseId: parsed.data.courseId ?? null },
    include: { course: { select: { id: true, name: true, courseCode: true } } },
  })
  return res.status(201).json({ conversation })
})

router.patch('/conversations/:id', requireAuth, async (req, res) => {
  const parsed = updateConversationSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', issues: parsed.error.flatten() })
  const userId = req.user?.id
  const conversation = await findOwnedConversation(req.params.id, userId)
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' })
  if (parsed.data.courseId && !await validateCourse(parsed.data.courseId, userId)) return res.status(404).json({ error: 'Course not found' })
  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: parsed.data,
    include: { course: { select: { id: true, name: true, courseCode: true } } },
  })
  return res.json({ conversation: updated })
})

router.delete('/conversations/:id', requireAuth, async (req, res) => {
  const userId = req.user?.id
  const deleted = await prisma.conversation.deleteMany({ where: { id: req.params.id, userId } })
  if (!deleted.count) return res.status(404).json({ error: 'Conversation not found' })
  return res.status(204).send()
})

router.get('/conversations/:id/messages', requireAuth, async (req, res) => {
  const conversation = await findOwnedConversation(req.params.id, req.user?.id)
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' })
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId: conversation.id, branchId: conversation.activeBranch },
    orderBy: { createdAt: 'asc' },
  })
  return res.json({ conversation, messages })
})

router.post('/conversations/:id/messages', requireAuth, assistantRateLimit, async (req, res) => {
  const parsed = messageSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', issues: parsed.error.flatten() })
  if (!env.ANTHROPIC_API_KEY) return res.status(400).json({ error: 'Anthropic API key not configured' })
  const userId = req.user?.id
  const conversation = await findOwnedConversation(req.params.id, userId)
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' })

  try {
    const history = await prisma.chatMessage.findMany({
      where: { conversationId: conversation.id, branchId: conversation.activeBranch, status: 'complete' },
      orderBy: { createdAt: 'asc' },
      take: 20,
    })
    const userMessage = await prisma.chatMessage.create({
      data: { conversationId: conversation.id, branchId: conversation.activeBranch, role: 'user', content: parsed.data.content },
    })
    const result = await runAssistant({
      userId,
      question: parsed.data.content,
      history: history.map((message) => ({ role: message.role, content: message.content })),
      context: await buildAssistantContext(userId),
      apiKey: env.ANTHROPIC_API_KEY,
      courseId: conversation.courseId,
    })
    const assistantMessage = await prisma.chatMessage.create({
      data: { conversationId: conversation.id, branchId: conversation.activeBranch, role: 'assistant', content: result.answer, actions: result.actionsPerformed, sources: result.sources },
    })
    const title = history.length === 0
      ? await generateConversationTitle({ apiKey: env.ANTHROPIC_API_KEY, message: parsed.data.content }).catch(() => 'New chat')
      : conversation.title
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { title, updatedAt: new Date() },
      include: { course: { select: { id: true, name: true, courseCode: true } } },
    })
    return res.status(201).json({ conversation: updatedConversation, userMessage, assistantMessage, ...result })
  } catch (error) {
    const status = error.status ?? error.statusCode ?? 500
    if (status === 429) return res.status(429).json({ error: 'The AI service rate limit was reached. Please wait a moment and try again.' })
    return res.status(500).json({ error: 'Anthropic assistant request failed', detail: error.message })
  }
})

router.post('/messages/:id/branch', requireAuth, assistantRateLimit, async (req, res) => {
  const parsed = messageSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', issues: parsed.error.flatten() })
  if (!env.ANTHROPIC_API_KEY) return res.status(400).json({ error: 'Anthropic API key not configured' })
  const userId = req.user?.id
  const originalMessage = await prisma.chatMessage.findFirst({
    where: { id: req.params.id, role: 'user', conversation: { userId } },
    include: { conversation: true },
  })
  if (!originalMessage) return res.status(404).json({ error: 'User message not found' })

  try {
    const prefix = await prisma.chatMessage.findMany({
      where: { conversationId: originalMessage.conversationId, branchId: originalMessage.branchId, createdAt: { lt: originalMessage.createdAt }, status: 'complete' },
      orderBy: { createdAt: 'asc' },
    })
    const branchId = randomUUID()
    const userMessage = await prisma.$transaction(async (tx) => {
      if (prefix.length) {
        await tx.chatMessage.createMany({
          data: prefix.map((message) => ({
            conversationId: originalMessage.conversationId,
            branchId,
            role: message.role,
            content: message.content,
            sources: message.sources ?? undefined,
            actions: message.actions ?? undefined,
            status: message.status,
            createdAt: message.createdAt,
          })),
        })
      }
      await tx.conversation.update({ where: { id: originalMessage.conversationId }, data: { activeBranch: branchId } })
      return tx.chatMessage.create({
        data: { conversationId: originalMessage.conversationId, parentMessageId: originalMessage.id, branchId, role: 'user', content: parsed.data.content },
      })
    })
    const result = await runAssistant({
      userId,
      question: parsed.data.content,
      history: prefix.map((message) => ({ role: message.role, content: message.content })).slice(-20),
      context: await buildAssistantContext(userId),
      apiKey: env.ANTHROPIC_API_KEY,
      courseId: originalMessage.conversation.courseId,
    })
    const assistantMessage = await prisma.chatMessage.create({
      data: { conversationId: originalMessage.conversationId, branchId, role: 'assistant', content: result.answer, actions: result.actionsPerformed, sources: result.sources },
    })
    const conversation = await prisma.conversation.update({
      where: { id: originalMessage.conversationId },
      data: { updatedAt: new Date() },
      include: { course: { select: { id: true, name: true, courseCode: true } } },
    })
    return res.status(201).json({ conversation, userMessage, assistantMessage, ...result })
  } catch (error) {
    const status = error.status ?? error.statusCode ?? 500
    if (status === 429) return res.status(429).json({ error: 'The AI service rate limit was reached. Please wait a moment and try again.' })
    return res.status(500).json({ error: 'Anthropic assistant request failed', detail: error.message })
  }
})

router.post('/messages/:id/regenerate', requireAuth, assistantRateLimit, async (req, res) => {
  if (!env.ANTHROPIC_API_KEY) return res.status(400).json({ error: 'Anthropic API key not configured' })
  const userId = req.user?.id
  const originalMessage = await prisma.chatMessage.findFirst({
    where: { id: req.params.id, role: 'assistant', conversation: { userId } },
    include: { conversation: true },
  })
  if (!originalMessage) return res.status(404).json({ error: 'Assistant message not found' })

  try {
    const prefix = await prisma.chatMessage.findMany({
      where: { conversationId: originalMessage.conversationId, branchId: originalMessage.branchId, createdAt: { lt: originalMessage.createdAt }, status: 'complete' },
      orderBy: { createdAt: 'asc' },
    })
    const question = [...prefix].reverse().find((message) => message.role === 'user')
    if (!question) return res.status(400).json({ error: 'No user message is available to regenerate from' })
    const branchId = randomUUID()
    await prisma.$transaction(async (tx) => {
      await tx.chatMessage.createMany({
        data: prefix.map((message) => ({
          conversationId: originalMessage.conversationId,
          branchId,
          role: message.role,
          content: message.content,
          sources: message.sources ?? undefined,
          actions: message.actions ?? undefined,
          status: message.status,
          createdAt: message.createdAt,
        })),
      })
      await tx.conversation.update({ where: { id: originalMessage.conversationId }, data: { activeBranch: branchId } })
    })
    const result = await runAssistant({
      userId,
      question: question.content,
      history: prefix.slice(0, -1).map((message) => ({ role: message.role, content: message.content })).slice(-20),
      context: await buildAssistantContext(userId),
      apiKey: env.ANTHROPIC_API_KEY,
      courseId: originalMessage.conversation.courseId,
    })
    const assistantMessage = await prisma.chatMessage.create({
      data: { conversationId: originalMessage.conversationId, branchId, role: 'assistant', content: result.answer, actions: result.actionsPerformed, sources: result.sources },
    })
    const conversation = await prisma.conversation.update({
      where: { id: originalMessage.conversationId },
      data: { updatedAt: new Date() },
      include: { course: { select: { id: true, name: true, courseCode: true } } },
    })
    return res.status(201).json({ conversation, assistantMessage, ...result })
  } catch (error) {
    const status = error.status ?? error.statusCode ?? 500
    if (status === 429) return res.status(429).json({ error: 'The AI service rate limit was reached. Please wait a moment and try again.' })
    return res.status(500).json({ error: 'Anthropic assistant request failed', detail: error.message })
  }
})

router.post('/ask', requireAuth, assistantRateLimit, async (req, res) => {
  const parsed = askSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', issues: parsed.error.flatten() })
  if (!env.ANTHROPIC_API_KEY) return res.status(400).json({ error: 'Anthropic API key not configured' })

  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Not authenticated' })

  try {
    return res.json(await runAssistant({ userId, question: parsed.data.question, history: (parsed.data.history ?? []).slice(-20), context: await buildAssistantContext(userId), apiKey: env.ANTHROPIC_API_KEY }))
  } catch (error) {
    const status = error.status ?? error.statusCode ?? 500
    if (status === 429) {
      return res.status(429).json({ error: 'The AI service rate limit was reached. Please wait a moment and try again.' })
    }
    return res.status(500).json({ error: 'Anthropic assistant request failed', detail: error.message })
  }
})

export default router
