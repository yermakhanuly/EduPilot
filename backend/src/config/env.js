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
  ANTHROPIC_API_KEY: z.string().optional(),
  ASSISTANT_RATE_LIMIT: z.coerce.number().int().positive().default(20),
  ASSISTANT_RATE_WINDOW_MINUTES: z.coerce.number().int().positive().default(1),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_EMBEDDING_MODEL: z.string().default('gemini-embedding-001'),
  GEMINI_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(768),
  CHROMA_URL: z.string().url().default('http://localhost:8000'),
  DOCUMENT_MAX_SIZE_MB: z.coerce.number().positive().default(10),
  CANVAS_WEBHOOK_SECRET: z.string().optional(),
  CANVAS_SYNC_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(60),
  CANVAS_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  CANVAS_REQUEST_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
})

export const env = envSchema.parse(process.env)
