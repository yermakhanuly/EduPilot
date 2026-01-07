import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

const cookieBase = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.COOKIE_SECURE,
  domain: env.COOKIE_DOMAIN,
  path: '/',
}

export function issueTokens(res, user) {
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' },
  )
  const refreshToken = jwt.sign(
    { userId: user.id },
    env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' },
  )

  res.cookie('accessToken', accessToken, {
    ...cookieBase,
    maxAge: 15 * 60 * 1000,
  })
  res.cookie('refreshToken', refreshToken, {
    ...cookieBase,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })

  return { accessToken, refreshToken }
}

export function clearAuthCookies(res) {
  res.clearCookie('accessToken', cookieBase)
  res.clearCookie('refreshToken', cookieBase)
}

export function requireAuth(req, res, next) {
  const accessToken = req.cookies?.accessToken
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const payload = jwt.verify(accessToken, env.JWT_ACCESS_SECRET)

    req.user = {
      id: payload.userId,
      email: payload.email,
    }

    return next()
  } catch (error) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
}
