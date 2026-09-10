import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = {
  conversation: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  chatMessage: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
  course: { findFirst: vi.fn() },
  $transaction: vi.fn((cb) => typeof cb === 'function' ? cb(prisma) : Promise.all(cb)),
}

vi.mock('../../config/prisma.js', () => ({ prisma }))
vi.mock('../../services/assistantAgent.js', () => ({
  runAssistant: vi.fn().mockResolvedValue({ answer: 'Mocked answer', actionsPerformed: [], sources: [] }),
  generateConversationTitle: vi.fn().mockResolvedValue('Mocked Title'),
}))

const { findOwnedConversation, validateCourse } = await import('../assistant.js')

describe('assistant routes authorization & ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prevents user A from accessing conversation owned by user B', async () => {
    prisma.conversation.findFirst.mockResolvedValue(null)
    const result = await findOwnedConversation('conv-user-b', 'user-a')
    expect(result).toBeNull()
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'conv-user-b', userId: 'user-a' },
      include: { course: { select: { id: true, name: true, courseCode: true } } },
    })
  })

  it('allows user to access their own conversation', async () => {
    const mockConv = { id: 'conv-user-a', userId: 'user-a', title: 'My Chat' }
    prisma.conversation.findFirst.mockResolvedValue(mockConv)
    const result = await findOwnedConversation('conv-user-a', 'user-a')
    expect(result).toEqual(mockConv)
  })

  it('rejects cross-user course assignment', async () => {
    prisma.course.findFirst.mockResolvedValue(null)
    const valid = await validateCourse('course-user-b', 'user-a')
    expect(valid).toBeNull()
  })
})
