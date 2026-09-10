import { describe, expect, it, vi } from 'vitest'

vi.mock('@langchain/anthropic', () => {
  return {
    ChatAnthropic: vi.fn().mockImplementation(() => ({
      invoke: vi.fn().mockResolvedValue({
        content: 'Finance Study Session Title',
        messages: [{ type: 'ai', content: 'Here is your study answer.' }],
      }),
    })),
  }
})

vi.mock('../planner.js', () => ({ generatePlan: vi.fn(() => ({ blocks: [], summary: { totalMinutes: 0 } })) }))
vi.mock('../retriever.js', () => ({ searchCourseMaterials: vi.fn(() => []) }))
vi.mock('../../config/prisma.js', () => ({
  prisma: {
    weeklyClass: { create: vi.fn(), deleteMany: vi.fn() },
    task: { create: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    fixedEvent: { create: vi.fn(), deleteMany: vi.fn() },
    studyBlock: { createMany: vi.fn(), deleteMany: vi.fn() },
    course: { findFirst: vi.fn() },
  },
}))

const { generateConversationTitle } = await import('../assistantAgent.js')

describe('assistantAgent', () => {
  it('generates clean conversation titles from initial user messages', async () => {
    const title = await generateConversationTitle({
      apiKey: 'test-key',
      message: 'When is my final exam in Introduction to Finance?',
    })
    expect(title).toBe('Finance Study Session Title')
  })
})
