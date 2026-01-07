const MIN_BLOCK_MINUTES = 50
const BUFFER_MINUTES = 10

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function diffMinutes(start, end) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / (60 * 1000)))
}

function parseWeekStart(weekStart) {
  const parsed = new Date(weekStart)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid weekStart')
  }
  parsed.setHours(0, 0, 0, 0)
  return parsed
}

function dayWithTime(base, hours, minutes) {
  const result = new Date(base)
  result.setHours(hours, minutes, 0, 0)
  return result
}

function buildAvailabilityWindows(weekStart, rules) {
  const windows = []

  for (const rule of rules) {
    const [startHour, startMinute] = rule.start.split(':').map((value) => Number(value))
    const [endHour, endMinute] = rule.end.split(':').map((value) => Number(value))
    const day = new Date(weekStart)
    day.setDate(day.getDate() + rule.day)

    const start = dayWithTime(day, startHour, startMinute)
    const end = dayWithTime(day, endHour, endMinute)
    if (end > start) {
      windows.push({ start, end })
    }
  }

  return windows.sort((a, b) => a.start.getTime() - b.start.getTime())
}

function subtractFixedEvents(windows, events) {
  if (events.length === 0) return windows
  const fixed = events
    .map((event) => ({
      start: new Date(event.start),
      end: new Date(event.end),
    }))
    .filter((event) => event.end > event.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  const result = []

  for (const window of windows) {
    let segments = [{ start: window.start, end: window.end }]

    for (const event of fixed) {
      const nextSegments = []

      for (const segment of segments) {
        const overlaps =
          event.start < segment.end && event.end > segment.start && event.end > event.start

        if (!overlaps) {
          nextSegments.push(segment)
          continue
        }

        if (event.start > segment.start) {
          nextSegments.push({ start: segment.start, end: event.start })
        }

        if (event.end < segment.end) {
          nextSegments.push({ start: event.end, end: segment.end })
        }
      }

      segments = nextSegments
      if (segments.length === 0) break
    }

    result.push(...segments)
  }

  return result.filter((segment) => diffMinutes(segment.start, segment.end) >= 25)
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Number.POSITIVE_INFINITY
    const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Number.POSITIVE_INFINITY
    if (deadlineA !== deadlineB) return deadlineA - deadlineB
    return a.title.localeCompare(b.title)
  })
}

function allocateBlocks(
  tasks,
  windows,
  source, // "planner" | "reoptimize"
) {
  const slots = [...windows].sort((a, b) => a.start.getTime() - b.start.getTime())
  const blocks = []
  const unscheduledTasks = []

  for (const task of sortTasks(tasks)) {
    let remainingMinutes = Math.round(task.remainingHours * 60)
    let slotIndex = 0

    while (remainingMinutes > 0 && slotIndex < slots.length) {
      const slot = slots[slotIndex]
      const available = diffMinutes(slot.start, slot.end)
      if (available <= 0) {
        slotIndex += 1
        continue
      }

      const allocation = Math.min(MIN_BLOCK_MINUTES, remainingMinutes, available)
      const blockStart = slot.start
      const blockEnd = addMinutes(blockStart, allocation)

      blocks.push({
        taskId: task.id,
        title: task.title,
        start: blockStart,
        end: blockEnd,
        source,
      })

      remainingMinutes -= allocation
      const nextStart = addMinutes(blockEnd, BUFFER_MINUTES)
      if (nextStart < slot.end) {
        slots[slotIndex] = { start: nextStart, end: slot.end }
      } else {
        slotIndex += 1
      }
    }

    if (remainingMinutes > 0) {
      unscheduledTasks.push(task.title)
    }
  }

  const totalMinutes = blocks.reduce(
    (sum, block) => sum + diffMinutes(block.start, block.end),
    0,
  )

  return {
    blocks,
    unscheduledTasks,
    summary: {
      totalBlocks: blocks.length,
      totalMinutes,
    },
  }
}

export function generatePlan(params) {
  const weekStart = parseWeekStart(params.weekStart)
  const availability = buildAvailabilityWindows(weekStart, params.availabilityRules)
  const windows = subtractFixedEvents(availability, params.fixedEvents ?? [])

  return allocateBlocks(params.tasks, windows, 'planner')
}

export function reoptimizePlan(params) {
  // Increase priority for tasks that were missed to keep the ordering deterministic but fair.
  const boostedTasks = params.tasks.map((task) => ({
    ...task,
    priority: (params.missedTaskIds ?? []).includes(task.id ?? '') ? task.priority + 1 : task.priority,
  }))

  const weekStart = parseWeekStart(params.weekStart)
  const availability = buildAvailabilityWindows(weekStart, params.availabilityRules)
  const windows = subtractFixedEvents(availability, params.fixedEvents ?? [])

  return allocateBlocks(boostedTasks, windows, 'reoptimize')
}
