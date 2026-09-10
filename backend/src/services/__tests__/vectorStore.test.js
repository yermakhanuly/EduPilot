import { describe, expect, it, vi } from 'vitest'
import { buildKnowledgeWhere, searchChunks } from '../vectorStore.js'

vi.mock('chromadb', () => {
  return {
    ChromaClient: vi.fn().mockImplementation(() => ({
      getOrCreateCollection: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({
          documents: [['Doc 1', 'Doc 2']],
          metadatas: [[{ title: 'Doc 1' }, { title: 'Doc 2' }]],
          distances: [[0.2, 0.95]],
        }),
      }),
    })),
  }
})

describe('knowledge vector filters', () => {
  it('restricts retrieval to the selected course and user', () => {
    expect(buildKnowledgeWhere('user-1', 'course-1')).toEqual({ $and: [{ userId: 'user-1' }, { courseId: 'course-1' }] })
  })

  it('restricts unscoped retrieval to the authenticated user', () => {
    expect(buildKnowledgeWhere('user-1')).toEqual({ userId: 'user-1' })
  })

  it('filters out search results exceeding max distance threshold', async () => {
    const results = await searchChunks({ embedding: [0.1, 0.2], userId: 'user-1', maxDistance: 0.82 })
    expect(results.length).toBe(1)
    expect(results[0].text).toBe('Doc 1')
  })
})