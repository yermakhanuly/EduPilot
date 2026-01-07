import { Router } from 'express'
import { prisma } from '../config/prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const rewards = await prisma.reward.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  return res.json({ rewards })
})

export default router
