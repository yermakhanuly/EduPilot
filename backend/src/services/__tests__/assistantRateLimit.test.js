import { afterEach, describe, expect, it } from 'vitest'
import { createAssistantRateLimiter, resetAssistantRateLimiter } from '../../middleware/assistantRateLimit.js'

function response() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    set(name, value) { this.headers[name] = value; return this },
    status(value) { this.statusCode = value; return this },
    json(value) { this.body = value; return this },
  }
}

describe('assistant rate limiter', () => {
  afterEach(() => resetAssistantRateLimiter())

  it('limits requests per authenticated user and exposes retry headers', () => {
    const limiter = createAssistantRateLimiter({ limit: 2, windowMs: 60_000 })
    const request = { user: { id: 'user-1' }, ip: '127.0.0.1' }
    const first = response()
    const second = response()
    const third = response()

    limiter(request, first, () => {})
    limiter(request, second, () => {})
    limiter(request, third, () => {})

    expect(first.headers['X-RateLimit-Remaining']).toBe('1')
    expect(second.headers['X-RateLimit-Remaining']).toBe('0')
    expect(third.statusCode).toBe(429)
    expect(third.headers['Retry-After']).toBeDefined()
  })
})