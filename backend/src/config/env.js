import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string(),
  JWT_ACCESS_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z
    .union([z.boolean(), z.string()])
    .transform((value) => value === true || value === 'true')
    .default('false'),
  ENCRYPTION_KEY: z.string().min(32),
  OPENAI_API_KEY: z.string().optional(),
  CANVAS_WEBHOOK_SECRET: z.string().optional(),
  CANVAS_SYNC_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(60),
})

export const env = envSchema.parse(process.env)
