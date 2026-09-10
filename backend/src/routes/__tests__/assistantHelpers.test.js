import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = {
  conversation: { findFirst: vi.fn() },
  course: { findFirst: vi.fn() },
  task: { findMany: vi.fn() },
  weeklyClass: { findMany: vi.fn() },
  fixedEvent: { findMany: vi.fn() },
  userStats: { findUnique: vi.fn() },
  studyBlock: { findMany: vi.fn() },
}

vi.mock('../../config/prisma.js', () => ({ prisma }))

const { formatClasses, findOwnedConversation, validateCourse, buildAssistantContext } = await import('../assistant.js')

describe('assistant route helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('formats weekly classes into a concise summary string', () => {
    const classes = [
      { day: 0, start: '09:00', end: '11:00', title: 'Calculus' },
      { day: 2, start: '14:00', end: '16:00', title: 'Finance' },
    ]
    expect(formatClasses(classes)).toBe('Mon 09:00-11:00 Calculus, Wed 14:00-16:00 Finance')
    expect(formatClasses([])).toBe('No weekly classes set.')
  })

  it('queries conversation by id and owner userId', async () => {
    prisma.conversation.findFirst.mockResolvedValue({ id: 'c1', userId: 'u1', title: 'Test' })
    const conv = await findOwnedConversation('c1', 'u1')
    expect(conv?.id).toBe('c1')
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'c1', userId: 'u1' },
      include: { course: { select: { id: true, name: true, courseCode: true } } },
    })
  })

  it('validates course ownership for a given user', async () => {
    prisma.course.findFirst.mockResolvedValue({ id: 'course-1', userId: 'u1' })
    const valid = await validateCourse('course-1', 'u1')
    expect(valid?.id).toBe('course-1')
    expect(prisma.course.findFirst).toHaveBeenCalledWith({ where: { id: 'course-1', userId: 'u1' } })
  })

  it('builds context containing tasks, classes, events, stats, and study blocks', async () => {
    prisma.task.findMany.mockResolvedValue([{ id: 't1', title: 'Task 1', deadline: new Date(), remainingHours: 2, priority: 1, status: 'pending' }])
    prisma.weeklyClass.findMany.mockResolvedValue([{ id: 'cls1', title: 'Math', day: 0, start: '09:00', end: '11:00', location: 'Hall A' }])
    prisma.fixedEvent.findMany.mockResolvedValue([])
    prisma.userStats.findUnique.mockResolvedValue({ totalXp: 100, weeklyXp: 50, streak: 3, level: 2 })
    prisma.studyBlock.findMany.mockResolvedValue([])

    const context = await buildAssistantContext('u1')
    expect(context.tasks.length).toBe(1)
    expect(context.weeklyClasses.length).toBe(1)
    expect(context.stats.totalXp).toBe(100)
  })
})
