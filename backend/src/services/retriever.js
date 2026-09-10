import { embedQuery } from './embeddings.js'
import { searchChunks } from './vectorStore.js'

export async function searchCourseMaterials({ query, userId, courseId, limit = 6 }) {
  const embedding = await embedQuery(query)
  return searchChunks({ embedding, userId, courseId, limit })
}
