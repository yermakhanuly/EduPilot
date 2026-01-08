import { prisma } from '../config/prisma.js'
import { decrypt, encrypt } from '../utils/crypto.js'

async function getCredentials(userId) {
  const integration = await prisma.integrationCanvas.findUnique({ where: { userId } })
  if (!integration) {
    throw new Error('Canvas not connected')
  }

  if (!integration.tokenEncrypted) {
    throw new Error('Canvas token not stored. Please reconnect.')
  }

  return {
    baseUrl: integration.canvasBaseUrl.replace(/\/$/, ''),
    token: decrypt(integration.tokenEncrypted),
  }
}

export async function saveCanvasCredentials(userId, baseUrl, token) {
  const tokenEncrypted = encrypt(token)
  await prisma.integrationCanvas.upsert({
    where: { userId },
    update: { tokenEncrypted, canvasBaseUrl: baseUrl },
    create: { userId, tokenEncrypted, canvasBaseUrl: baseUrl },
  })
}

export async function clearCanvasToken(userId) {
  await prisma.integrationCanvas.updateMany({
    where: { userId },
    data: { tokenEncrypted: null },
  })
}

export async function saveCanvasProfile(userId, profile) {
  if (!profile) return
  await prisma.integrationCanvas.updateMany({
    where: { userId },
    data: {
      canvasUserId: profile.id ? String(profile.id) : null,
      canvasBaseUrl: profile.base_url ?? undefined,
    },
  })
}

export async function fetchCanvasResource(userId, path) {
  const { baseUrl, token } = await getCredentials(userId)
  const url = `${baseUrl}${path}`

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(
      `Canvas responded with ${response.status} ${response.statusText}: ${text || 'No body'}`,
    )
  }

  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`Canvas returned invalid JSON: ${error.message}`)
  }
}

export async function testCanvasConnection(userId) {
  const profile = await fetchCanvasResource(userId, '/api/v1/users/self/profile')
  return profile
}

export async function fetchCanvasCourses(userId) {
  return fetchCanvasResource(userId, '/api/v1/courses?enrollment_state=active')
}

export async function fetchCanvasWeek(userId, start, end) {
  const params = new URLSearchParams({
    start_date: start,
    end_date: end,
  })
  return fetchCanvasResource(userId, `/api/v1/planner/items?${params.toString()}`)
}

function toTimeString(date) {
  return date.toISOString().slice(11, 16)
}

function toDayIndex(date) {
  const jsDay = date.getDay()
  return (jsDay + 6) % 7
}

function buildWeeklyClass(event) {
  if (!event?.start) return null
  const start = new Date(event.start)
  const end = event.end ? new Date(event.end) : new Date(start.getTime() + 60 * 60 * 1000)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return {
    title: event.title ?? 'Canvas class',
    day: toDayIndex(start),
    start: toTimeString(start),
    end: toTimeString(end),
    location: event.location ?? null,
  }
}

function isWeeklyRecurring(rule) {
  if (!rule) return false
  return typeof rule === 'string' && rule.toUpperCase().includes('WEEKLY')
}

function mapPlannerItem(item) {
  const plannable = item?.plannable ?? {}
  const type = item?.plannable_type ?? plannable?.plannable_type ?? ''
  const externalId = String(item?.plannable_id ?? plannable?.id ?? '')
  const contextName = item?.context_name ?? plannable?.course_name ?? ''

  if (type === 'calendar_event') {
    return {
      type: 'event',
      externalId,
      title: plannable?.title ?? item?.title ?? 'Canvas event',
      start: plannable?.start_at ?? item?.plannable_date ?? null,
      end: plannable?.end_at ?? plannable?.start_at ?? item?.plannable_date ?? null,
      location: plannable?.location_name ?? null,
      rrule: plannable?.rrule ?? plannable?.recurrence_rule ?? null,
    }
  }

  const title =
    plannable?.name ??
    plannable?.title ??
    item?.plannable?.title ??
    item?.title ??
    'Canvas assignment'
  const due = plannable?.due_at ?? item?.plannable_date ?? null
  return {
    type: 'task',
    externalId,
    title: contextName ? `${contextName} · ${title}` : title,
    deadline: due,
  }
}

export async function importCanvasData(userId, { start, end }) {
  const plannerItems = await fetchCanvasWeek(userId, start, end)
  if (!Array.isArray(plannerItems)) {
    throw new Error('Canvas response did not return planner items')
  }

  const tasks = []
  const events = []
  const classes = []

  for (const item of plannerItems) {
    const mapped = mapPlannerItem(item)
    if (mapped.type === 'task') {
      if (!mapped.deadline) continue
      const deadlineDate = new Date(mapped.deadline)
      if (Number.isNaN(deadlineDate.getTime())) continue
      tasks.push({
        title: mapped.title,
        deadline: deadlineDate,
        remainingHours: 1,
        priority: 3,
        status: 'pending',
        source: 'canvas',
        externalId: mapped.externalId || null,
      })
      continue
    }

    const startAt = mapped.start ? new Date(mapped.start) : null
    const endAt = mapped.end ? new Date(mapped.end) : startAt ? new Date(startAt.getTime() + 60 * 60 * 1000) : null
    if (!startAt || !endAt || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      continue
    }

    if (isWeeklyRecurring(mapped.rrule)) {
      const weekly = buildWeeklyClass({
        title: mapped.title,
        start: mapped.start,
        end: mapped.end,
        location: mapped.location,
      })
      if (weekly) {
        classes.push({
          ...weekly,
          source: 'canvas',
          externalId: mapped.externalId || null,
        })
      }
    } else {
      events.push({
        title: mapped.title,
        type: 'exam',
        start: startAt,
        end: endAt,
        notes: mapped.location ? `Location: ${mapped.location}` : null,
        source: 'canvas',
        externalId: mapped.externalId || null,
      })
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.task.deleteMany({ where: { userId, source: 'canvas' } })
    await tx.fixedEvent.deleteMany({ where: { userId, source: 'canvas' } })
    await tx.weeklyClass.deleteMany({ where: { userId, source: 'canvas' } })

    if (tasks.length > 0) {
      await tx.task.createMany({
        data: tasks.map((task) => ({ ...task, userId })),
      })
    }

    if (events.length > 0) {
      await tx.fixedEvent.createMany({
        data: events.map((event) => ({ ...event, userId })),
      })
    }

    if (classes.length > 0) {
      await tx.weeklyClass.createMany({
        data: classes.map((entry) => ({ ...entry, userId })),
      })
    }

    await tx.integrationCanvas.updateMany({
      where: { userId },
      data: { lastImportedAt: new Date() },
    })

    return {
      tasks: tasks.length,
      events: events.length,
      classes: classes.length,
    }
  })

  return result
}

export function defaultCanvasRange(daysAhead = 30) {
  const start = new Date()
  start.setDate(start.getDate() - 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + daysAhead)
  end.setHours(23, 59, 59, 999)
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}
