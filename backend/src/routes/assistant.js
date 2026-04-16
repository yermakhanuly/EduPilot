import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { generatePlan } from '../services/planner.js'

const router = Router()

const askSchema = z.object({
  question: z.string().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1),
      }),
    )
    .max(50)
    .optional(),
})

function formatClasses(classes) {
  if (!classes.length) return 'No weekly classes set.'
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return classes
    .map((c) => `${dayNames[c.day]} ${c.start}-${c.end} ${c.title}`)
    .join(', ')
}

function getMondayOfCurrentWeek() {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_class',
      description: 'Add a recurring weekly class to the user schedule.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Class name' },
          day: { type: 'integer', description: '0=Monday … 6=Sunday' },
          start: { type: 'string', description: 'Start time HH:MM' },
          end: { type: 'string', description: 'End time HH:MM' },
          location: { type: 'string', description: 'Optional location' },
        },
        required: ['title', 'day', 'start', 'end'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_class',
      description: 'Remove a recurring weekly class by its ID.',
      parameters: {
        type: 'object',
        properties: {
          classId: { type: 'string', description: 'The id of the class to remove (from context)' },
        },
        required: ['classId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_task',
      description: 'Add a new task or assignment.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          deadline: { type: 'string', description: 'ISO 8601 datetime, e.g. 2025-05-01T23:59:00Z' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          priority: { type: 'integer', description: '1 (low) to 5 (high)', minimum: 1, maximum: 5 },
          remainingHours: { type: 'number', description: 'Estimated hours remaining' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_task',
      description: 'Remove a task by its ID.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'The id of the task to remove (from context)' },
        },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_event',
      description: 'Add a fixed one-time event such as an exam.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          type: { type: 'string', enum: ['exam', 'appointment', 'other'] },
          start: { type: 'string', description: 'ISO 8601 datetime' },
          end: { type: 'string', description: 'ISO 8601 datetime' },
          notes: { type: 'string' },
        },
        required: ['title', 'type', 'start', 'end'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_event',
      description: 'Remove a fixed event by its ID.',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'The id of the event to remove (from context)' },
        },
        required: ['eventId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_plan',
      description: 'Generate or regenerate the weekly study plan.',
      parameters: {
        type: 'object',
        properties: {
          weekStart: {
            type: 'string',
            description:
              'ISO date for the Monday of the week to plan (e.g. 2025-04-14). Omit to use the current week.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_theme',
      description: 'Switch the app colour theme.',
      parameters: {
        type: 'object',
        properties: {
          theme: { type: 'string', enum: ['light', 'dark'] },
        },
        required: ['theme'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigate',
      description: 'Navigate the user to a different page in the app.',
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            enum: [
              '/app/dashboard',
              '/app/plan',
              '/app/tasks',
              '/app/progress',
              '/app/rewards',
              '/app/settings',
              '/app/integrations/canvas',
            ],
          },
        },
        required: ['to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_reply',
      description: 'Send a plain text reply to the user when no other action is needed.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'The reply text to show the user.' },
        },
        required: ['message'],
      },
    },
  },
]

async function callOpenAI(messages, tools, toolChoice = 'auto') {
  const body = {
    model: 'gpt-4o',
    temperature: 0.2,
    max_tokens: 600,
    messages,
  }
  if (tools) {
    body.tools = tools
    body.tool_choice = toolChoice
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI error: ${text}`)
  }
  return response.json()
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

  const [tasks, classes, events, stats, blocks] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        status: { not: 'completed' },
        OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
      },
      orderBy: { deadline: 'asc' },
    }),
    prisma.weeklyClass.findMany({ where: { userId }, orderBy: [{ day: 'asc' }, { start: 'asc' }] }),
    prisma.fixedEvent.findMany({ where: { userId, end: { gte: new Date() } }, orderBy: { start: 'asc' } }),
    prisma.userStats.findUnique({ where: { userId } }),
    prisma.studyBlock.findMany({
      where: { userId, start: { gte: new Date() } },
      orderBy: { start: 'asc' },
      take: 12,
      include: { task: { select: { title: true } } },
    }),
  ])

  const context = {
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      deadline: t.deadline?.toISOString() ?? null,
      remainingHours: t.remainingHours,
      priority: t.priority,
      status: t.status,
    })),
    weeklyClasses: classes.map((c) => ({
      id: c.id,
      title: c.title,
      day: c.day,
      start: c.start,
      end: c.end,
      location: c.location ?? null,
    })),
    weeklyClassSummary: formatClasses(classes),
    fixedEvents: events.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      start: e.start.toISOString(),
      end: e.end.toISOString(),
    })),
    stats: stats
      ? { totalXp: stats.totalXp, weeklyXp: stats.weeklyXp, streak: stats.streak, level: stats.level }
      : null,
    upcomingBlocks: blocks.map((b) => ({
      title: b.task?.title ?? 'Focus block',
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      status: b.status,
    })),
  }

  const history = (parsed.data.history ?? []).slice(-20)
  const conversation = history.map((m) => ({ role: m.role, content: m.content }))

  const now = new Date()
  const currentDateStr = now.toISOString().split('T')[0] // e.g. "2026-04-16"
  const currentYear = now.getFullYear()

  const systemMessages = [
    {
      role: 'system',
      content: `You are EduPilot, an AI study coach that can take real actions inside the app.

Today's date is ${currentDateStr} (year ${currentYear}).

CRITICAL RULES — follow these without exception:
1. You MUST always call a tool. Never reply with plain text alone.
2. For action requests (add/remove a class, task, or event; generate a plan; switch theme; navigate): call the appropriate action tool.
3. For informational or conversational replies where no action is needed: call send_reply with your message.
4. NEVER say "I can't directly", "I'm not able to", or "please go to the settings". You have the tools — USE them.
5. After performing an action, also call send_reply with a brief confirmation (e.g. "Added 'Math' task with a Friday deadline.").
6. For adding a class: day numbers are 0=Monday … 6=Sunday. Times must be "HH:MM" (e.g. "09:00").
7. If a request is ambiguous (e.g. missing a time), make a reasonable assumption and mention it in your send_reply confirmation.
8. When a user mentions a date without a year (e.g. "May 15", "next Friday", "June 3rd"), always assume the current year (${currentYear}) unless it would be in the past, in which case use the next year (${currentYear + 1}).`,
    },
    {
      role: 'system',
      content: `Current user data (use IDs when removing items):\n${JSON.stringify(context, null, 2)}`,
    },
  ]

  const messages = [
    ...systemMessages,
    ...conversation,
    { role: 'user', content: parsed.data.question },
  ]

  let firstData
  try {
    firstData = await callOpenAI(messages, AGENT_TOOLS, 'required')
  } catch (error) {
    return res.status(500).json({ error: 'OpenAI request failed', detail: error.message })
  }

  const firstChoice = firstData.choices?.[0]
  const assistantMessage = firstChoice?.message

  // No tool calls — should not happen with tool_choice: required, but handle gracefully
  if (!assistantMessage?.tool_calls?.length) {
    return res.json({
      answer: assistantMessage?.content?.trim() || 'No response generated.',
      actionsPerformed: [],
      clientActions: [],
      invalidateQueries: [],
    })
  }

  // Execute tool calls
  const actionsPerformed = []
  const clientActions = []
  const invalidateQueries = new Set()
  const toolResultMessages = []
  let sendReplyText = null

  for (const toolCall of assistantMessage.tool_calls) {
    const { name, arguments: argsStr } = toolCall.function
    let args
    try {
      args = JSON.parse(argsStr)
    } catch {
      args = {}
    }

    let result = 'Done.'

    if (name === 'add_class') {
      const created = await prisma.weeklyClass.create({
        data: {
          userId,
          title: args.title,
          day: args.day,
          start: args.start,
          end: args.end,
          location: args.location ?? null,
          source: 'manual',
        },
      })
      result = `Class "${args.title}" added (id: ${created.id})`
      actionsPerformed.push({ type: 'add_class', summary: `Added class "${args.title}"` })
      invalidateQueries.add('classes')

    } else if (name === 'remove_class') {
      await prisma.weeklyClass.deleteMany({ where: { id: args.classId, userId } })
      result = `Class removed`
      actionsPerformed.push({ type: 'remove_class', summary: 'Removed class' })
      invalidateQueries.add('classes')

    } else if (name === 'add_task') {
      const created = await prisma.task.create({
        data: {
          userId,
          title: args.title,
          description: args.description ?? null,
          deadline: args.deadline ? new Date(args.deadline) : null,
          difficulty: args.difficulty ?? 'medium',
          priority: args.priority ?? 3,
          remainingHours: args.remainingHours ?? 1,
          status: 'pending',
          source: 'manual',
        },
      })
      result = `Task "${args.title}" added (id: ${created.id})`
      actionsPerformed.push({ type: 'add_task', summary: `Added task "${args.title}"` })
      invalidateQueries.add('tasks')
      invalidateQueries.add('stats-overview')
      invalidateQueries.add('stats-weekly')

    } else if (name === 'remove_task') {
      await prisma.task.deleteMany({ where: { id: args.taskId, userId } })
      result = `Task removed`
      actionsPerformed.push({ type: 'remove_task', summary: 'Removed task' })
      invalidateQueries.add('tasks')
      invalidateQueries.add('stats-overview')
      invalidateQueries.add('stats-weekly')

    } else if (name === 'add_event') {
      const created = await prisma.fixedEvent.create({
        data: {
          userId,
          title: args.title,
          type: args.type,
          start: new Date(args.start),
          end: new Date(args.end),
          notes: args.notes ?? null,
          source: 'manual',
        },
      })
      result = `Event "${args.title}" added (id: ${created.id})`
      actionsPerformed.push({ type: 'add_event', summary: `Added event "${args.title}"` })
      invalidateQueries.add('events')
      invalidateQueries.add('stats-overview')

    } else if (name === 'remove_event') {
      await prisma.fixedEvent.deleteMany({ where: { id: args.eventId, userId } })
      result = `Event removed`
      actionsPerformed.push({ type: 'remove_event', summary: 'Removed event' })
      invalidateQueries.add('events')
      invalidateQueries.add('stats-overview')

    } else if (name === 'generate_plan') {
      const weekStartDate = args.weekStart
        ? new Date(args.weekStart)
        : getMondayOfCurrentWeek()
      weekStartDate.setHours(0, 0, 0, 0)
      const weekStartStr = weekStartDate.toISOString().split('T')[0]

      const [planTasks, planClasses, planEvents] = await Promise.all([
        prisma.task.findMany({
          where: {
            userId,
            status: { not: 'completed' },
            OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
          },
        }),
        prisma.weeklyClass.findMany({ where: { userId }, orderBy: [{ day: 'asc' }, { start: 'asc' }] }),
        prisma.fixedEvent.findMany({ where: { userId, end: { gte: new Date() } } }),
      ])

      const classEvents = planClasses.map((c) => {
        const [sh, sm] = c.start.split(':').map(Number)
        const [eh, em] = c.end.split(':').map(Number)
        const dayDate = new Date(weekStartDate)
        dayDate.setDate(dayDate.getDate() + c.day)
        const start = new Date(dayDate)
        start.setHours(sh, sm, 0, 0)
        const end = new Date(dayDate)
        end.setHours(eh, em, 0, 0)
        return { title: c.title, start: start.toISOString(), end: end.toISOString() }
      })

      const normalizedTasks = planTasks
        .filter((t) => t.remainingHours > 0)
        .map((t) => ({
          id: t.id,
          title: t.title,
          deadline: t.deadline?.toISOString() ?? null,
          remainingHours: t.remainingHours,
          priority: t.priority,
        }))

      const plan = generatePlan({
        weekStart: weekStartStr,
        tasks: normalizedTasks,
        fixedEvents: [
          ...planEvents.map((e) => ({
            title: e.title,
            start: e.start.toISOString(),
            end: e.end.toISOString(),
          })),
          ...classEvents,
        ],
        availabilityRules: Array.from({ length: 7 }, (_, day) => ({
          day,
          start: '08:00',
          end: '23:59',
        })),
      })

      const endDate = new Date(weekStartDate)
      endDate.setDate(endDate.getDate() + 7)

      await prisma.studyBlock.deleteMany({
        where: { userId, start: { gte: weekStartDate }, end: { lte: endDate } },
      })
      if (plan.blocks.length > 0) {
        await prisma.studyBlock.createMany({
          data: plan.blocks.map((b) => ({
            userId,
            taskId: b.taskId ?? null,
            start: b.start,
            end: b.end,
            source: b.source,
          })),
        })
      }

      result = `Plan generated: ${plan.blocks.length} study blocks for week of ${weekStartStr}`
      actionsPerformed.push({ type: 'generate_plan', summary: `Generated plan (${plan.blocks.length} blocks)` })
      invalidateQueries.add('plan-blocks')

    } else if (name === 'set_theme') {
      clientActions.push({ type: 'set_theme', value: args.theme })
      result = `Theme set to ${args.theme}`
      actionsPerformed.push({ type: 'set_theme', summary: `Switched to ${args.theme} theme` })

    } else if (name === 'navigate') {
      clientActions.push({ type: 'navigate', to: args.to })
      result = `Navigating to ${args.to}`
      actionsPerformed.push({ type: 'navigate', summary: `Navigated to ${args.to}` })

    } else if (name === 'send_reply') {
      sendReplyText = args.message ?? ''
      result = 'Reply sent.'
    }

    toolResultMessages.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: result,
    })
  }

  // Use send_reply text if the model provided one, otherwise fall back to action summaries
  let finalAnswer = sendReplyText || actionsPerformed.map((a) => a.summary).join('. ') || 'Done.'

  return res.json({
    answer: finalAnswer,
    actionsPerformed,
    clientActions,
    invalidateQueries: [...invalidateQueries],
  })
})

export default router
