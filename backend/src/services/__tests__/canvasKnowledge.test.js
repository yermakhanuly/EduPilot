import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = {
  knowledgeDocument: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}

vi.mock('../../config/prisma.js', () => ({ prisma }))
vi.mock('../documentIngestion.js', () => ({
  documentChecksum: vi.fn(() => 'checksum'),
  ingestDocument: vi.fn(async () => { throw new Error('embedding unavailable') }),
}))
vi.mock('../vectorStore.js', () => ({ deleteChunksForDocument: vi.fn() }))
vi.mock('../canvas.js', () => ({}))

const { indexSource } = await import('../canvasKnowledge.js')

describe('Canvas knowledge source indexing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.knowledgeDocument.findFirst.mockResolvedValue(null)
    prisma.knowledgeDocument.create.mockResolvedValue({ id: 'document-1' })
    prisma.knowledgeDocument.update.mockResolvedValue({ id: 'document-1' })
  })

  it('marks an ingestion failure and lets the sync continue', async () => {
    const result = await indexSource({
      userId: 'user-1',
      courseId: 'course-1',
      sourceType: 'canvas_front_page',
      sourceId: 'course-1:page-1',
      title: 'Course Information',
      mimeType: 'text/html',
      filename: 'course-information.html',
      buffer: Buffer.from('content'),
    })

    expect(result).toBe(false)
    expect(prisma.knowledgeDocument.update).toHaveBeenLastCalledWith({
      where: { id: 'document-1' },
      data: { status: 'failed', errorMessage: 'embedding unavailable' },
    })
  })
})