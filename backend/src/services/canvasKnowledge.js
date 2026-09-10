import { prisma } from '../config/prisma.js'
import {
  fetchCanvasAnnouncements,
  fetchCanvasBinary,
  fetchCanvasModules,
  fetchCanvasFrontPage,
  fetchCanvasPage,
  fetchCanvasPaged,
  fetchCanvasResource,
} from './canvas.js'
import { documentChecksum, ingestDocument } from './documentIngestion.js'
import { deleteChunksForDocument } from './vectorStore.js'

async function upsertCourse(userId, course) {
  return prisma.course.upsert({
    where: { userId_canvasCourseId: { userId, canvasCourseId: String(course.id) } },
    update: { name: course.name ?? `Canvas course ${course.id}`, courseCode: course.course_code ?? null },
    create: {
      userId,
      canvasCourseId: String(course.id),
      name: course.name ?? `Canvas course ${course.id}`,
      courseCode: course.course_code ?? null,
    },
  })
}

export async function indexSource({ userId, courseId, sourceType, sourceId, title, mimeType, filename, buffer }) {
  const checksum = documentChecksum(buffer)
  const existing = await prisma.knowledgeDocument.findFirst({
    where: { userId, sourceType, sourceId },
  })
  if (existing?.checksum === checksum && existing.status === 'ready') return false

  const document = existing
    ? await prisma.knowledgeDocument.update({
        where: { id: existing.id },
        data: { courseId, title, mimeType, checksum, status: 'processing', errorMessage: null },
      })
    : await prisma.knowledgeDocument.create({
        data: { userId, courseId, sourceType, sourceId, title, mimeType, checksum, status: 'processing' },
      })

  try {
    if (existing) await deleteChunksForDocument(document.id, userId)
    await ingestDocument({ documentId: document.id, userId, title, filename, mimeType, buffer, courseId, sourceType })
    return true
  } catch (error) {
    await prisma.knowledgeDocument.update({
      where: { id: document.id },
      data: { status: 'failed', errorMessage: error.message },
    })
    console.error(`Canvas knowledge source failed: ${sourceType} "${title}": ${error.message}`)
    return false
  }
}

async function getModuleItems(userId, courseId, module) {
  if (Array.isArray(module.items)) return module.items
  return fetchCanvasPaged(userId, `/api/v1/courses/${courseId}/modules/${module.id}/items?per_page=100`)
}

export async function syncCanvasKnowledge(userId) {
  const courses = (await fetchCanvasPaged(userId, '/api/v1/courses?enrollment_state=active&per_page=100'))
    .filter((course) => course.id && course.name)
  let indexed = 0
  let skipped = 0

  for (const canvasCourse of courses) {
    const course = await upsertCourse(userId, canvasCourse)
    const frontPage = await fetchCanvasFrontPage(userId, canvasCourse.id).catch(() => null)
    if (frontPage?.body && frontPage.published !== false && !frontPage.locked_for_user) {
      const changed = await indexSource({
        userId,
        courseId: course.id,
        sourceType: 'canvas_front_page',
        sourceId: `${canvasCourse.id}:${frontPage.page_id}`,
        title: frontPage.title ?? `${canvasCourse.name} front page`,
        mimeType: 'text/html',
        filename: `${frontPage.url ?? frontPage.page_id}.html`,
        buffer: Buffer.from(frontPage.body, 'utf8'),
      })
      changed ? indexed += 1 : skipped += 1
    }
    const modules = await fetchCanvasModules(userId, canvasCourse.id)
    for (const module of modules) {
      const items = await getModuleItems(userId, canvasCourse.id, module)
      for (const item of items) {
        if (item.locked_for_user || item.published === false) continue
        if (item.type === 'File' && item.content_id) {
          const file = await fetchCanvasResource(userId, `/api/v1/courses/${canvasCourse.id}/files/${item.content_id}`)
          if (!file?.url || file.locked_for_user || file.hidden_for_user) continue
          const buffer = await fetchCanvasBinary(userId, file.url)
          const changed = await indexSource({
            userId,
            courseId: course.id,
            sourceType: 'canvas_file',
            sourceId: `${canvasCourse.id}:${file.id}`,
            title: file.display_name ?? item.title,
            mimeType: file['content-type'] ?? 'application/octet-stream',
            filename: file.filename ?? file.display_name ?? `${file.id}.txt`,
            buffer,
          })
          changed ? indexed += 1 : skipped += 1
        }
        if (item.type === 'Page' && item.page_url) {
          const page = await fetchCanvasPage(userId, canvasCourse.id, item.page_url)
          if (!page?.body || page.published === false || page.locked_for_user) continue
          const changed = await indexSource({
            userId,
            courseId: course.id,
            sourceType: 'canvas_page',
            sourceId: `${canvasCourse.id}:${page.page_id}`,
            title: page.title ?? item.title,
            mimeType: 'text/html',
            filename: `${page.url ?? page.page_id}.html`,
            buffer: Buffer.from(page.body, 'utf8'),
          })
          changed ? indexed += 1 : skipped += 1
        }
      }
    }

    const announcements = await fetchCanvasAnnouncements(userId, [canvasCourse.id])
    for (const announcement of announcements) {
      if (!announcement.message) continue
      const changed = await indexSource({
        userId,
        courseId: course.id,
        sourceType: 'canvas_announcement',
        sourceId: `${canvasCourse.id}:${announcement.id}`,
        title: announcement.title ?? 'Canvas announcement',
        mimeType: 'text/html',
        filename: `${announcement.id}.html`,
        buffer: Buffer.from(announcement.message, 'utf8'),
      })
      changed ? indexed += 1 : skipped += 1
    }
  }

  return { courses: courses.length, indexed, skipped }
}
