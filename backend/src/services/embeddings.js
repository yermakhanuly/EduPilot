import { GoogleGenAI } from '@google/genai'
import { env } from '../config/env.js'

let client

function getClient() {
  if (!env.GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured')
  }
  client ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
  return client
}

async function embed(texts, taskType) {
  const response = await getClient().models.embedContent({
    model: env.GEMINI_EMBEDDING_MODEL,
    contents: texts,
    config: {
      taskType,
      outputDimensionality: env.GEMINI_EMBEDDING_DIMENSIONS,
    },
  })

  const embeddings = response.embeddings?.map((item) => item.values)
  if (!embeddings || embeddings.length !== texts.length || embeddings.some((item) => !item?.length)) {
    throw new Error('Gemini returned an invalid embedding response')
  }
  return embeddings
}

export function embedDocuments(texts) {
  return embed(texts, 'RETRIEVAL_DOCUMENT')
}

export async function embedQuery(text) {
  const [embedding] = await embed([text], 'RETRIEVAL_QUERY')
  return embedding
}
