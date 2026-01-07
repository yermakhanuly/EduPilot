import 'dotenv/config'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import authRouter from './routes/auth.js'
import availabilityRouter from './routes/availability.js'
import assistantRouter from './routes/assistant.js'
import canvasRouter from './routes/canvas.js'
import planRouter from './routes/plan.js'
import rewardsRouter from './routes/rewards.js'
import sessionsRouter from './routes/sessions.js'
import statsRouter from './routes/stats.js'
import tasksRouter from './routes/tasks.js'
import eventsRouter from './routes/events.js'
import { requireAuth } from './middleware/requireAuth.js'

const app = express()

app.use(
  cors({
    origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    credentials: true,
  }),
)
app.use(express.json())
app.use(cookieParser())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: 'EduPilot API' })
})

app.use('/auth', authRouter)
app.use('/tasks', tasksRouter)
app.use('/availability', availabilityRouter)
app.use('/events', eventsRouter)
app.use('/plan', planRouter)
app.use('/sessions', sessionsRouter)
app.use('/stats', statsRouter)
app.use('/rewards', rewardsRouter)
app.use('/assistant', assistantRouter)
app.use('/canvas', requireAuth, canvasRouter)

app.use((err, _req, res, _next) => {
  // Minimal centralized error handler for unhandled exceptions
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(env.PORT, () => {
  console.log(`EduPilot API listening on port ${env.PORT}`)
})
