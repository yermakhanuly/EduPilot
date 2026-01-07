import { prisma } from '../config/prisma.js'
import { decrypt, encrypt } from '../utils/crypto.js'

async function getCredentials(userId) {
  const integration = await prisma.integrationCanvas.findUnique({ where: { userId } })
  if (!integration) {
    throw new Error('Canvas not connected')
  }

  return {
    baseUrl: integration.canvasBaseUrl.replace(/\/$/, ''),
    token: decrypt(integration.tokenEncrypted),
  }
}

export async function saveCanvasCredentials(userId, baseUrl, token) {
  const tokenEncrypted = encrypt(token)
  await prisma.integrationCanvas.upsert({
    where: { userId },
    update: { tokenEncrypted, canvasBaseUrl: baseUrl },
    create: { userId, tokenEncrypted, canvasBaseUrl: baseUrl },
  })
}

export async function fetchCanvasResource(userId, path) {
  const { baseUrl, token } = await getCredentials(userId)
  const url = `${baseUrl}${path}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(
      `Canvas responded with ${response.status} ${response.statusText}: ${text || 'No body'}`,
    )
  }

  return await response.json()
}

export async function testCanvasConnection(userId) {
  const profile = await fetchCanvasResource(userId, '/api/v1/users/self/profile')
  return profile
}

export async function fetchCanvasCourses(userId) {
  return fetchCanvasResource(userId, '/api/v1/courses?enrollment_state=active')
}

export async function fetchCanvasWeek(userId, start, end) {
  const params = new URLSearchParams({
    start_date: start,
    end_date: end,
  })
  return fetchCanvasResource(userId, `/api/v1/planner/items?${params.toString()}`)
}
