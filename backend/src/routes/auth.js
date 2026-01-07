import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { clearAuthCookies, issueTokens, requireAuth } from '../middleware/requireAuth.js'

const router = Router()

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

router.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', issues: parsed.error.flatten() })
  }

  const { email, password, name } = parsed.data
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      stats: { create: {} },
    },
  })

  issueTokens(res, { id: user.id, email: user.email })

  return res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  })
})

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', issues: parsed.error.flatten() })
  }

  const { email, password } = parsed.data
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash)
  if (!passwordValid) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  issueTokens(res, { id: user.id, email: user.email })

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  })
})

router.post('/logout', (_req, res) => {
  clearAuthCookies(res)
  return res.json({ success: true })
})

router.get('/me', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      stats: true,
    },
  })

  if (!user) {
    clearAuthCookies(res)
    return res.status(401).json({ error: 'Not authenticated' })
  }

  return res.json({ user })
})

export default router
