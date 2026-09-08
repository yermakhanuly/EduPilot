import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  documentChecksum,
  ingestDocument,
  isSupportedDocument,
  maxDocumentBytes,
  removeDocument,
} from '../services/documentIngestion.js'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxDocumentBytes() },
})
const metadataSchema = z.object({ courseId: z.string().uuid().optional() })

router.get('/documents', requireAuth, async (req, res) => {
  const documents = await prisma.knowledgeDocument.findMany({
    where: { userId: req.user.id },
    orderBy: { updatedAt: 'desc' },
    include: { course: { select: { id: true, name: true, canvasCourseId: true } } },
  })
  return res.json({ documents })
})

router.post('/documents', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'A file is required' })
  if (!isSupportedDocument(req.file.originalname, req.file.mimetype)) {
    return res.status(415).json({ error: 'Supported formats are PDF, DOCX, PPTX, TXT, MD, and HTML' })
  }
  const parsed = metadataSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid metadata', issues: parsed.error.flatten() })

  const { courseId } = parsed.data
  if (courseId) {
    const course = await prisma.course.findFirst({ where: { id: courseId, userId: req.user.id } })
    if (!course) return res.status(404).json({ error: 'Course not found' })
  }

  const checksum = documentChecksum(req.file.buffer)
  const existing = await prisma.knowledgeDocument.findFirst({ where: { userId: req.user.id, checksum } })
  if (existing) return res.status(409).json({ error: 'This document is already indexed', document: existing })

  const document = await prisma.knowledgeDocument.create({
    data: {
      userId: req.user.id,
      courseId: courseId ?? null,
      sourceType: 'upload',
      title: req.file.originalname,
      mimeType: req.file.mimetype,
      checksum,
      status: 'processing',
    },
  })

  try {
    const result = await ingestDocument({
      documentId: document.id,
      userId: req.user.id,
      title: document.title,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      buffer: req.file.buffer,
      courseId,
    })
    return res.status(201).json({ document: { ...document, status: 'ready' }, ...result })
  } catch (error) {
    await prisma.knowledgeDocument.update({
      where: { id: document.id },
      data: { status: 'failed', errorMessage: error.message },
    })
    return res.status(422).json({ error: 'Document indexing failed', detail: error.message, documentId: document.id })
  }
})

router.delete('/documents/:id', requireAuth, async (req, res) => {
  const removed = await removeDocument(req.params.id, req.user.id)
  if (!removed) return res.status(404).json({ error: 'Document not found' })
  return res.status(204).send()
})

export default router
