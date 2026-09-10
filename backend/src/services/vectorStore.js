import { ChromaClient } from 'chromadb'
import { env } from '../config/env.js'

const collectionName = 'edupilot_knowledge'
let collectionPromise

const externalEmbeddingFunction = {
  generate: async () => {
    throw new Error('Embeddings must be supplied by the Gemini embedding service')
  },
}

async function getCollection() {
  collectionPromise ??= (async () => {
    const client = new ChromaClient({ path: env.CHROMA_URL })
    return client.getOrCreateCollection({
      name: collectionName,
      metadata: { 'hnsw:space': 'cosine' },
      embeddingFunction: externalEmbeddingFunction,
    })
  })()
  return collectionPromise
}

export function buildKnowledgeWhere(userId, courseId) {
  return courseId
    ? { $and: [{ userId }, { courseId }] }
    : { userId }
}

export async function addChunks(chunks) {
  if (!chunks.length) return
  const collection = await getCollection()
  await collection.upsert({
    ids: chunks.map((chunk) => chunk.id),
    documents: chunks.map((chunk) => chunk.text),
    embeddings: chunks.map((chunk) => chunk.embedding),
    metadatas: chunks.map((chunk) => chunk.metadata),
  })
}

export async function searchChunks({ embedding, userId, courseId, limit = 5, maxDistance = 0.82 }) {
  const collection = await getCollection()
  const result = await collection.query({
    queryEmbeddings: [embedding],
    nResults: limit,
    where: buildKnowledgeWhere(userId, courseId),
    include: ['documents', 'metadatas', 'distances'],
  })

  return (result.documents?.[0] ?? [])
    .map((text, index) => ({
      text,
      metadata: result.metadatas?.[0]?.[index] ?? {},
      distance: result.distances?.[0]?.[index] ?? null,
    }))
    .filter((item) => item.distance === null || item.distance <= maxDistance)
}

export async function deleteChunks(ids) {
  if (!ids.length) return
  const collection = await getCollection()
  await collection.delete({ ids })
}

export async function deleteChunksForDocument(documentId, userId) {
  const collection = await getCollection()
  await collection.delete({ where: { $and: [{ documentId }, { userId }] } })
}
