import { tool, createAgent } from 'langchain'
import { ChatGroq } from '@langchain/groq'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { generatePlan } from './planner.js'

function getMondayOfCurrentWeek() {
  const date = new Date()
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function createAssistantTools(userId, actionsPerformed, clientActions, invalidateQueries) {
  const record = (type, summary, query) => {
    actionsPerformed.push({ type, summary })
    if (query) invalidateQueries.add(query)
  }

  return [
    tool(async ({ title, day, start, end, location }) => {
      const created = await prisma.weeklyClass.create({
        data: { userId, title, day, start, end, location: location ?? null, source: 'manual' },
      })
      record('add_class', `Added class "${title}"`, 'classes')
      return `Class "${title}" added (id: ${created.id})`
    }, {
      name: 'add_class',
      description: 'Add a recurring weekly class to the user schedule. Day is 0=Monday through 6=Sunday and times use HH:MM.',
      schema: z.object({ title: z.string().min(1), day: z.number().int().min(0).max(6), start: z.string(), end: z.string(), location: z.string().optional() }),
    }),
    tool(async ({ classId }) => {
      await prisma.weeklyClass.deleteMany({ where: { id: classId, userId } })
      record('remove_class', 'Removed class', 'classes')
      return 'Class removed.'
    }, {
      name: 'remove_class',
      description: 'Remove a recurring weekly class by its ID from the user context.',
      schema: z.object({ classId: z.string().min(1) }),
    }),
    tool(async ({ title, description, deadline, difficulty, priority, remainingHours }) => {
      const created = await prisma.task.create({
        data: {
          userId, title, description: description ?? null, deadline: deadline ? new Date(deadline) : null,
          difficulty: difficulty ?? 'medium', priority: priority ?? 3, remainingHours: remainingHours ?? 1,
          status: 'pending', source: 'manual',
        },
      })
      record('add_task', `Added task "${title}"`, 'tasks')
      return `Task "${title}" added (id: ${created.id})`
    }, {
      name: 'add_task',
      description: 'Add a new task or assignment for the user.',
      schema: z.object({ title: z.string().min(1), description: z.string().optional(), deadline: z.string().optional(), difficulty: z.enum(['easy', 'medium', 'hard']).optional(), priority: z.number().int().min(1).max(5).optional(), remainingHours: z.number().min(0).optional() }),
    }),
    tool(async ({ taskId }) => {
      await prisma.task.deleteMany({ where: { id: taskId, userId } })
      record('remove_task', 'Removed task', 'tasks')
      return 'Task removed.'
    }, {
      name: 'remove_task',
      description: 'Remove a task by its ID from the user context.',
      schema: z.object({ taskId: z.string().min(1) }),
    }),
    tool(async ({ title, type, start, end, notes }) => {
      const created = await prisma.fixedEvent.create({
        data: { userId, title, type, start: new Date(start), end: new Date(end), notes: notes ?? null, source: 'manual' },
      })
      record('add_event', `Added event "${title}"`, 'events')
      return `Event "${title}" added (id: ${created.id})`
    }, {
      name: 'add_event',
      description: 'Add a fixed one-time event such as an exam. Start and end are ISO datetimes.',
      schema: z.object({ title: z.string().min(1), type: z.enum(['exam', 'appointment', 'other']), start: z.string(), end: z.string(), notes: z.string().optional() }),
    }),
    tool(async ({ eventId }) => {
      await prisma.fixedEvent.deleteMany({ where: { id: eventId, userId } })
      record('remove_event', 'Removed event', 'events')
      return 'Event removed.'
    }, {
      name: 'remove_event',
      description: 'Remove a fixed event by its ID from the user context.',
      schema: z.object({ eventId: z.string().min(1) }),
    }),
    tool(async ({ weekStart }) => {
      const weekStartDate = weekStart ? new Date(weekStart) : getMondayOfCurrentWeek()
      weekStartDate.setHours(0, 0, 0, 0)
      const weekStartStr = weekStartDate.toISOString().split('T')[0]
      const [tasks, classes, events] = await Promise.all([
        prisma.task.findMany({ where: { userId, status: { not: 'completed' }, OR: [{ deadline: null }, { deadline: { gte: new Date() } }] } }),
        prisma.weeklyClass.findMany({ where: { userId } }),
        prisma.fixedEvent.findMany({ where: { userId, end: { gte: new Date() } } }),
      ])
      const classEvents = classes.map((item) => {
        const [startHour, startMinute] = item.start.split(':').map(Number)
        const [endHour, endMinute] = item.end.split(':').map(Number)
        const dayDate = new Date(weekStartDate)
        dayDate.setDate(dayDate.getDate() + item.day)
        const start = new Date(dayDate)
        start.setHours(startHour, startMinute, 0, 0)
        const end = new Date(dayDate)
        end.setHours(endHour, endMinute, 0, 0)
        return { title: item.title, start: start.toISOString(), end: end.toISOString() }
      })
      const plan = generatePlan({
        weekStart: weekStartStr,
        tasks: tasks.filter((item) => item.remainingHours > 0).map((item) => ({ id: item.id, title: item.title, deadline: item.deadline?.toISOString() ?? null, remainingHours: item.remainingHours, priority: item.priority })),
        fixedEvents: [...events.map((item) => ({ title: item.title, start: item.start.toISOString(), end: item.end.toISOString() })), ...classEvents],
        availabilityRules: Array.from({ length: 7 }, (_, day) => ({ day, start: '08:00', end: '23:59' })),
      })
      const endDate = new Date(weekStartDate)
      endDate.setDate(endDate.getDate() + 7)
      await prisma.studyBlock.deleteMany({ where: { userId, start: { gte: weekStartDate }, end: { lte: endDate } } })
      if (plan.blocks.length) {
        await prisma.studyBlock.createMany({ data: plan.blocks.map((block) => ({ userId, taskId: block.taskId ?? null, start: block.start, end: block.end, source: block.source })) })
      }
      record('generate_plan', `Generated plan (${plan.blocks.length} blocks)`, 'plan-blocks')
      return `Plan generated: ${plan.blocks.length} study blocks for week of ${weekStartStr}`
    }, {
      name: 'generate_plan',
      description: 'Generate or regenerate the weekly study plan. Optionally provide the Monday date as YYYY-MM-DD.',
      schema: z.object({ weekStart: z.string().optional() }),
    }),
    tool(async ({ theme }) => {
      clientActions.push({ type: 'set_theme', value: theme })
      record('set_theme', `Switched to ${theme} theme`)
      return `Theme set to ${theme}.`
    }, {
      name: 'set_theme',
      description: 'Switch the app colour theme.',
      schema: z.object({ theme: z.enum(['light', 'dark']) }),
    }),
    tool(async ({ to }) => {
      clientActions.push({ type: 'navigate', to })
      record('navigate', `Navigated to ${to}`)
      return `Navigating to ${to}.`
    }, {
      name: 'navigate',
      description: 'Navigate the user to a different page in the app.',
      schema: z.object({ to: z.enum(['/app/dashboard', '/app/plan', '/app/tasks', '/app/progress', '/app/rewards', '/app/settings', '/app/integrations/canvas']) }),
    }),
  ]
}

export async function runAssistant({ userId, question, history, context, apiKey }) {
  const actionsPerformed = []
  const clientActions = []
  const invalidateQueries = new Set()
  const model = new ChatGroq({ apiKey, model: 'qwen/qwen3.6-27b', temperature: 0.2, maxTokens: 600, maxRetries: 2 })
  const tools = createAssistantTools(userId, actionsPerformed, clientActions, invalidateQueries)
  const agent = createAgent({
    model,
    tools,
    systemPrompt: `You are EduPilot, an AI study coach that can take real actions inside the app. Use tools immediately for requested changes. Never claim you cannot perform an available action. After tools, briefly confirm what you did. Day numbers are 0=Monday through 6=Sunday. Make reasonable assumptions for missing details and mention them. Keep replies concise. Current user data:\n${JSON.stringify(context, null, 2)}`,
  })
  const result = await agent.invoke({ messages: [...history, { role: 'user', content: question }] })
  const lastMessage = result.messages?.[result.messages.length - 1]
  const answer = typeof lastMessage?.content === 'string' ? lastMessage.content.trim() : ''
  return { answer: answer || actionsPerformed.map((action) => action.summary).join('. ') || 'No response generated.', actionsPerformed, clientActions, invalidateQueries: [...invalidateQueries] }
}
