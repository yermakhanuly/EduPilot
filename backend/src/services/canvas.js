import { prisma } from '../config/prisma.js'
import { decrypt, encrypt } from '../utils/crypto.js'
import { env } from '../config/env.js'

const EXCLUDED_COURSE_NAMES = new Set([
  'cs announcement',
  'cs scholarship',
  'cs student exchange',
  '# it professional internship (pre-internship)',
  'it professional internship (pre-internship)',
  'safety training for ug students (cs)',
])

function isExcludedCourseName(name) {
  return EXCLUDED_COURSE_NAMES.has(name?.trim().toLowerCase())
}

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

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500
}

async function fetchCanvasWithRetry(url, options = {}) {
  let lastError
  for (let attempt = 0; attempt <= env.CANVAS_REQUEST_RETRIES; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), env.CANVAS_REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(url, { ...options, signal: controller.signal })
      if (!response.ok && isRetryableStatus(response.status) && attempt < env.CANVAS_REQUEST_RETRIES) {
        await response.body?.cancel()
        continue
      }
      return response
    } catch (error) {
      lastError = error.name === 'AbortError'
        ? new Error(`Canvas request timed out after ${env.CANVAS_REQUEST_TIMEOUT_MS}ms`)
        : error
      if (attempt >= env.CANVAS_REQUEST_RETRIES) throw lastError
    } finally {
      clearTimeout(timeout)
    }
  }
  throw lastError ?? new Error('Canvas request failed')
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
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`

  const response = await fetchCanvasWithRetry(url, {
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

function parseLinkHeader(header) {
  if (!header) return {}
  const links = {}
  const parts = header.split(',')
  for (const part of parts) {
    const section = part.split(';').map((item) => item.trim())
    if (section.length < 2) continue
    const urlPart = section[0].replace(/<(.*)>/, '$1')
    const relPart = section.find((item) => item.startsWith('rel='))
    if (!relPart) continue
    const rel = relPart.replace(/rel="?([^"]+)"?/, '$1')
    links[rel] = urlPart
  }
  return links
}

export async function fetchCanvasPaged(userId, path) {
  const { baseUrl, token } = await getCredentials(userId)
  const items = []
  let nextUrl = path.startsWith('http') ? path : `${baseUrl}${path}`

  while (nextUrl) {
    const response = await fetchCanvasWithRetry(nextUrl, {
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
    if (text) {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        items.push(...parsed)
      } else if (parsed) {
        items.push(parsed)
      }
    }

    const links = parseLinkHeader(response.headers.get('link'))
    nextUrl = links.next ?? null
  }

  return items
}

export async function fetchCanvasBinary(userId, path) {
  const { baseUrl, token } = await getCredentials(userId)
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`
  const response = await fetchCanvasWithRetry(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    throw new Error(`Canvas responded with ${response.status} ${response.statusText}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

export async function fetchCanvasAnnouncements(userId, courseIds) {
  const params = new URLSearchParams()
  courseIds.forEach((id) => params.append('context_codes[]', `course_${id}`))
  params.set('active_only', 'true')
  return fetchCanvasPaged(userId, `/api/v1/announcements?${params.toString()}`)
}

export async function fetchCanvasModules(userId, courseId) {
  return fetchCanvasPaged(userId, `/api/v1/courses/${courseId}/modules?include[]=items&per_page=100`)
}

export async function fetchCanvasPage(userId, courseId, pageUrl) {
  return fetchCanvasResource(userId, `/api/v1/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}`)
}

export async function fetchCanvasFrontPage(userId, courseId) {
  return fetchCanvasResource(userId, `/api/v1/courses/${courseId}/front_page`)
}

export async function testCanvasConnection(userId) {
  const profile = await fetchCanvasResource(userId, '/api/v1/users/self/profile')
  return profile
}

export async function fetchCanvasCourses(userId) {
  return fetchCanvasPaged(userId, '/api/v1/courses?enrollment_state=active&per_page=100')
}

export async function fetchCanvasAssignments(userId, courses) {
  const assignments = []
  for (const course of courses.filter((item) => !isExcludedCourseName(item.name))) {
    const courseAssignments = await fetchCanvasPaged(
      userId,
      `/api/v1/courses/${course.id}/assignments?per_page=100&order_by=due_at`,
    )
    for (const assignment of courseAssignments) {
      const due = assignment.due_at ?? assignment.all_dates?.[0]?.due_at ?? null
      assignments.push({
        type: 'task',
        externalId: assignment.id ? `assignment:${assignment.id}` : '',
        title: course.name ? `${course.name} · ${assignment.name}` : assignment.name,
        deadline: due,
      })
    }
  }
  return assignments
}

export async function fetchCanvasWeek(userId, start, end) {
  const params = new URLSearchParams({
    start_date: start,
    end_date: end,
    per_page: '100',
  })
  return fetchCanvasPaged(userId, `/api/v1/planner/items?${params.toString()}`)
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
  const rawExternalId = String(item?.plannable_id ?? plannable?.id ?? '')
  const externalId = type === 'assignment' ? `assignment:${rawExternalId}` : rawExternalId
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
    plannableType: type,
    externalId,
    title: contextName ? `${contextName} · ${title}` : title,
    deadline: due,
  }
}

export async function importCanvasData(userId, { start, end }) {
  const completedCanvasTasks = await prisma.task.findMany({
    where: {
      userId,
      source: 'canvas',
      status: 'completed',
      externalId: { not: null },
    },
    select: { externalId: true },
  })
  const completedExternalIds = new Set(
    completedCanvasTasks.map((task) => task.externalId).filter(Boolean),
  )

  const [courses, plannerItems] = await Promise.all([
    fetchCanvasCourses(userId),
    fetchCanvasWeek(userId, start, end),
  ])
  if (!Array.isArray(plannerItems)) {
    throw new Error('Canvas response did not return planner items')
  }

  const assignments = await fetchCanvasAssignments(userId, courses)

  const tasks = []
  const events = []
  const classes = []
  const now = new Date()

  const allowedCourseIds = new Set(
    courses.filter((course) => !isExcludedCourseName(course.name)).map((course) => String(course.id)),
  )
  const mappedItems = [
    ...assignments,
    ...plannerItems
      .filter((item) => {
        const courseName = item.context_name ?? item.plannable?.course_name
        const courseId = item.course_id ?? item.plannable?.course_id
        return !isExcludedCourseName(courseName) && (!courseId || allowedCourseIds.has(String(courseId)))
      })
      .map(mapPlannerItem)
      .filter((item) => item.type === 'event' || (item.plannableType === 'assignment' && item.deadline)),
  ]
  const seenTaskIds = new Set()

  for (const mapped of mappedItems) {
    if (mapped.type === 'task') {
      const deadlineDate = mapped.deadline ? new Date(mapped.deadline) : null
      if (deadlineDate && Number.isNaN(deadlineDate.getTime())) continue
      if (mapped.externalId && completedExternalIds.has(mapped.externalId)) continue
      if (mapped.externalId && seenTaskIds.has(mapped.externalId)) continue
      if (mapped.externalId) seenTaskIds.add(mapped.externalId)
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
    const endAt = mapped.end
      ? new Date(mapped.end)
      : startAt
        ? new Date(startAt.getTime() + 60 * 60 * 1000)
        : null
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
    } else if (endAt >= now) {
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
    await tx.task.deleteMany({
      where: {
        userId,
        source: 'canvas',
        status: { not: 'completed' },
      },
    })
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
