import { prisma } from '../config/prisma.js'
import { defaultCanvasRange, importCanvasData } from './canvas.js'

let isSyncing = false

export async function syncAllCanvasAccounts() {
  if (isSyncing) {
    return { skipped: true }
  }

  isSyncing = true

  try {
    const integrations = await prisma.integrationCanvas.findMany({
      where: { tokenEncrypted: { not: null } },
      select: { userId: true },
    })

    const range = defaultCanvasRange()
    let success = 0
    let failure = 0

    for (const integration of integrations) {
      try {
        await importCanvasData(integration.userId, range)
        success += 1
      } catch (error) {
        failure += 1
        console.error(`Canvas auto-sync failed for user ${integration.userId}:`, error)
      }
    }

    return { users: integrations.length, success, failure }
  } finally {
    isSyncing = false
  }
}

export function scheduleCanvasSync({ intervalMinutes, initialDelayMs = 15000 } = {}) {
  if (!intervalMinutes || intervalMinutes <= 0) {
    return () => {}
  }

  const intervalMs = intervalMinutes * 60 * 1000

  const run = async () => {
    const result = await syncAllCanvasAccounts()
    if (result?.skipped) return
    console.log(
      `Canvas auto-sync done. users=${result.users ?? 0} success=${result.success ?? 0} failure=${result.failure ?? 0}`,
    )
  }

  const initialTimer = setTimeout(run, initialDelayMs)
  const intervalTimer = setInterval(run, intervalMs)

  return () => {
    clearTimeout(initialTimer)
    clearInterval(intervalTimer)
  }
}
