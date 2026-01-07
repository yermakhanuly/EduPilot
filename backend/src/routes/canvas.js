import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  fetchCanvasCourses,
  fetchCanvasWeek,
  saveCanvasCredentials,
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

  const { baseUrl, token } = parsed.data
  await saveCanvasCredentials(req.user.id, baseUrl, token)

  try {
    const profile = await testCanvasConnection(req.user.id)
    return res.json({ success: true, profile })
  } catch (error) {
    return res.status(502).json({
      error: 'Unable to reach Canvas with provided token',
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

export default router
