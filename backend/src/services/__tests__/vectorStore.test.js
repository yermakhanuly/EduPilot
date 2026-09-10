import { describe, expect, it } from 'vitest'
import { buildKnowledgeWhere } from '../vectorStore.js'

describe('knowledge vector filters', () => {
  it('restricts retrieval to the selected course and user', () => {
    expect(buildKnowledgeWhere('user-1', 'course-1')).toEqual({ $and: [{ userId: 'user-1' }, { courseId: 'course-1' }] })
  })

  it('restricts unscoped retrieval to the authenticated user', () => {
    expect(buildKnowledgeWhere('user-1')).toEqual({ userId: 'user-1' })
  })
})