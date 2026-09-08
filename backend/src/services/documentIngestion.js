import crypto from 'crypto'
import path from 'path'
import { PDFParse } from 'pdf-parse'
import { OfficeParser } from 'officeparser'
import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { embedDocuments } from './embeddings.js'
import { addChunks, deleteChunksForDocument } from './vectorStore.js'

function cleanText(value) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitIntoChunks(text, size = 3500, overlap = 400) {
  const chunks = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + size, text.length)
    const chunk = text.slice(start, end).trim()
    if (chunk) chunks.push(chunk)
    if (end === text.length) break
    start = end - overlap
  }
  return chunks
}

async function extractText(buffer, mimeType, filename) {
  const extension = path.extname(filename).toLowerCase()
  if (mimeType === 'application/pdf' || extension === '.pdf') {
    const parser = new PDFParse({ data: buffer })
    try {
      const result = await parser.getText()
      return result.text
    } finally {
      await parser.destroy()
    }
  }
  if (extension === '.docx' || extension === '.pptx') {
    const ast = await OfficeParser.parseOffice(buffer)
    return ast.toText()
  }
  if (mimeType.startsWith('text/') || /\.(txt|md|html?)$/i.test(filename)) {
    return buffer.toString('utf8')
  }
  throw new Error('Only PDF, DOCX, PPTX, and text documents are supported')
}

export function isSupportedDocument(filename, mimeType = '') {
  const extension = path.extname(filename).toLowerCase()
  return ['.pdf', '.docx', '.pptx', '.txt', '.md', '.html', '.htm'].includes(extension)
    || mimeType === 'application/pdf'
    || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
}

export async function ingestDocument({ documentId, userId, title, filename, mimeType, buffer, courseId, sourceType = 'upload' }) {
  const text = cleanText(await extractText(buffer, mimeType, filename))
  if (!text) throw new Error('The document does not contain extractable text')

  const chunks = splitIntoChunks(text)
  const embeddings = await embedDocuments(chunks)
  const records = chunks.map((chunk, index) => ({
    id: `${documentId}:${index}`,
    text: chunk,
    embedding: embeddings[index],
    metadata: {
      userId,
      courseId: courseId ?? '',
      documentId,
      sourceType,
      title,
      chunkIndex: index,
    },
  }))

  await addChunks(records)
  await prisma.knowledgeDocument.update({
    where: { id: documentId },
    data: { status: 'ready', errorMessage: null },
  })
  return { chunks: records.length }
}

export async function removeDocument(documentId, userId) {
  const document = await prisma.knowledgeDocument.findFirst({ where: { id: documentId, userId } })
  if (!document) return false
  await deleteChunksForDocument(documentId, userId)
  await prisma.knowledgeDocument.delete({ where: { id: documentId } })
  return true
}

export function documentChecksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export function maxDocumentBytes() {
  return env.DOCUMENT_MAX_SIZE_MB * 1024 * 1024
}
