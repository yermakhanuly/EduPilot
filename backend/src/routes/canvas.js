import crypto from 'crypto'
import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  fetchCanvasCourses,
  fetchCanvasWeek,
  defaultCanvasRange,
  importCanvasData,
  saveCanvasCredentials,
  saveCanvasProfile,
  testCanvasConnection,
} from '../services/canvas.js'

const router = Router()

const connectSchema = z.object({
  baseUrl: z.string().url(),
  token: z.string().min(10),
})

router.post('/connect', requireAuth, async (req, res) => {
  const parsed = connectSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.flatten() })
  }

  if (!req.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const { baseUrl, token } = parsed.data
    await saveCanvasCredentials(req.user.id, baseUrl, token)
    const profile = await testCanvasConnection(req.user.id)
    await saveCanvasProfile(req.user.id, profile)
    const range = defaultCanvasRange()
    const imported = await importCanvasData(req.user.id, range)
    return res.json({ success: true, profile, imported, tokenStored: true })
  } catch (error) {
    return res.status(502).json({
      error: 'Unable to reach Canvas with provided token',
      detail: error.message,
    })
  }
})

router.post('/sync', requireAuth, async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const range = defaultCanvasRange()
    const imported = await importCanvasData(req.user.id, range)
    return res.json({ success: true, imported })
  } catch (error) {
    return res.status(502).json({
      error: 'Canvas sync failed',
      detail: error.message,
    })
  }
})

router.get('/courses', requireAuth, async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const courses = await fetchCanvasCourses(req.user.id)
    return res.json({ courses })
  } catch (error) {
    return res.status(502).json({
      error: 'Canvas request failed',
      detail: error.message,
    })
  }
})

router.get('/week', requireAuth, async (req, res) => {
  const start = req.query.start?.toString()
  const end = req.query.end?.toString()

  if (!start || !end) {
    return res.status(400).json({ error: 'start and end query params are required' })
  }

  if (!req.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const events = await fetchCanvasWeek(req.user.id, start, end)
    return res.json({ events })
  } catch (error) {
    return res.status(502).json({
      error: 'Canvas request failed',
      detail: error.message,
    })
  }
})

function extractCanvasUserId(payload) {
  if (!payload) return null
  const body = typeof payload.body === 'string' ? safeJson(payload.body) : payload.body
  const candidates = [
    payload.user_id,
    payload.canvas_user_id,
    payload.actor_id,
    body?.user_id,
    body?.canvas_user_id,
    body?.actor_id,
    body?.assignment?.user_id,
    body?.submission?.user_id,
  ]
  const match = candidates.find((value) => value !== undefined && value !== null)
  return match ? String(match) : null
}

function safeJson(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function verifyCanvasSignature(req) {
  if (!env.CANVAS_WEBHOOK_SECRET) return true
  const header =
    req.get('X-Canvas-Signature') ||
    req.get('X-Canvas-Signature-256') ||
    req.get('X-Canvas-Hmac-SHA256')
  if (!header) return false
  const signature = header.replace(/^sha256=/i, '').trim()
  const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? ''), 'utf8')
  const hmacHex = crypto.createHmac('sha256', env.CANVAS_WEBHOOK_SECRET).update(rawBody).digest('hex')
  const hmacBase64 = crypto
    .createHmac('sha256', env.CANVAS_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('base64')
  if (signature.length === hmacHex.length) {
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hmacHex))
    } catch {
      return false
    }
  }
  if (signature.length === hmacBase64.length) {
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hmacBase64))
    } catch {
      return false
    }
  }
  return false
}

router.post('/webhook', async (req, res) => {
  if (!verifyCanvasSignature(req)) {
    return res.status(401).json({ error: 'Invalid Canvas webhook signature' })
  }

  const canvasUserId = extractCanvasUserId(req.body)
  if (!canvasUserId) {
    return res.status(202).json({ ignored: true, reason: 'Canvas user id not found' })
  }

  const integration = await prisma.integrationCanvas.findFirst({
    where: { canvasUserId },
  })

  if (!integration) {
    return res.status(202).json({ ignored: true, reason: 'No user linked to Canvas ID' })
  }

  try {
    const range = defaultCanvasRange()
    const imported = await importCanvasData(integration.userId, range)
    return res.json({ success: true, imported })
  } catch (error) {
    return res.status(502).json({
      error: 'Canvas webhook sync failed',
      detail: error.message,
    })
  }
})

export default router
