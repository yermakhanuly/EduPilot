const windows = new Map()

export function createAssistantRateLimiter({ limit = 20, windowMs = 60_000 } = {}) {
  return (req, res, next) => {
    const key = req.user?.id ?? req.ip ?? 'anonymous'
    const now = Date.now()
    const startedAt = now
    if (typeof res.on === 'function') {
      res.on('finish', () => {
        console.info(JSON.stringify({
          event: 'assistant_request',
          requestId: req.id ?? null,
          userId: req.user?.id ?? null,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          latencyMs: Date.now() - startedAt,
        }))
      })
    }
    const current = windows.get(key)
    const entry = current && now - current.startedAt < windowMs
      ? current
      : { startedAt: now, count: 0 }

    entry.count += 1
    windows.set(key, entry)
    res.set('X-RateLimit-Limit', String(limit))
    res.set('X-RateLimit-Remaining', String(Math.max(0, limit - entry.count)))

    if (entry.count > limit) {
      const retryAfter = Math.ceil((windowMs - (now - entry.startedAt)) / 1000)
      res.set('Retry-After', String(retryAfter))
      return res.status(429).json({ error: 'Too many assistant requests. Please wait before trying again.' })
    }
    return next()
  }
}

export function resetAssistantRateLimiter() {
  windows.clear()
}