import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { syncCanvasKnowledge } from '../services/canvasKnowledge.js'
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
const courseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  courseCode: z.string().trim().max(40).optional().nullable(),
})
const updateCourseSchema = courseSchema.partial()

router.get('/courses', requireAuth, async (req, res) => {
  const courses = await prisma.course.findMany({
    where: { userId: req.user.id },
    orderBy: [{ source: 'asc' }, { courseCode: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { documents: true } } },
  })
  return res.json({ courses })
})

router.post('/courses', requireAuth, async (req, res) => {
  const parsed = courseSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid course', issues: parsed.error.flatten() })
  const duplicate = await prisma.course.findFirst({
    where: { userId: req.user.id, name: { equals: parsed.data.name, mode: 'insensitive' } },
  })
  if (duplicate) return res.status(409).json({ error: 'A course with this name already exists' })
  const course = await prisma.course.create({
    data: { userId: req.user.id, name: parsed.data.name, courseCode: parsed.data.courseCode || null, source: 'manual' },
    include: { _count: { select: { documents: true } } },
  })
  return res.status(201).json({ course })
})

router.patch('/courses/:id', requireAuth, async (req, res) => {
  const parsed = updateCourseSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid course', issues: parsed.error.flatten() })
  const existing = await prisma.course.findFirst({ where: { id: req.params.id, userId: req.user.id } })
  if (!existing) return res.status(404).json({ error: 'Course not found' })
  if (parsed.data.name) {
    const duplicate = await prisma.course.findFirst({
      where: { userId: req.user.id, id: { not: existing.id }, name: { equals: parsed.data.name, mode: 'insensitive' } },
    })
    if (duplicate) return res.status(409).json({ error: 'A course with this name already exists' })
  }
  const course = await prisma.course.update({
    where: { id: existing.id },
    data: { ...parsed.data, courseCode: parsed.data.courseCode || null },
    include: { _count: { select: { documents: true } } },
  })
  return res.json({ course })
})

router.delete('/courses/:id', requireAuth, async (req, res) => {
  const existing = await prisma.course.findFirst({ where: { id: req.params.id, userId: req.user.id } })
  if (!existing) return res.status(404).json({ error: 'Course not found' })
  await prisma.$transaction([
    prisma.knowledgeDocument.updateMany({ where: { courseId: existing.id, userId: req.user.id }, data: { courseId: null } }),
    prisma.conversation.updateMany({ where: { courseId: existing.id, userId: req.user.id }, data: { courseId: null } }),
    prisma.course.delete({ where: { id: existing.id } }),
  ])
  return res.status(204).send()
})

router.get('/documents', requireAuth, async (req, res) => {
  const documents = await prisma.knowledgeDocument.findMany({
    where: { userId: req.user.id },
    orderBy: { updatedAt: 'desc' },
    include: { course: { select: { id: true, name: true, canvasCourseId: true } } },
  })
  return res.json({ documents })
})

router.post('/retry-failed', requireAuth, async (req, res) => {
  try {
    const result = await syncCanvasKnowledge(req.user.id)
    return res.json({ success: true, ...result })
  } catch (error) {
    return res.status(502).json({ error: 'Knowledge retry failed', detail: error.message })
  }
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
