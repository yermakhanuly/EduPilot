const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
const authSkipRefresh = new Set(['/auth/login', '/auth/signup', '/auth/refresh'])

async function rawRequest(path, options) {
  const isFormData = options?.body instanceof FormData
  return fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: isFormData ? options?.headers : { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  })
}

async function request(path, options, retryAuth = true) {
  const response = await rawRequest(path, options)

  if (response.status === 401 && retryAuth && !authSkipRefresh.has(path)) {
    const refreshResponse = await rawRequest('/auth/refresh', { method: 'POST' })
    if (refreshResponse.ok) {
      return request(path, options, false)
    }
  }

  if (!response.ok) {
    const body = await response.text()
    let message = body
    try {
      const parsed = JSON.parse(body)
      message = parsed.error || parsed.detail || body
    } catch {
      // Keep plain-text error responses readable.
    }
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  if (response.status === 204) return null
  return await response.json()
}

export async function streamRequest(path, options, callbacks = {}) {
  const { onStatus, onDelta, onDone, onError, signal } = callbacks
  const isFormData = options?.body instanceof FormData
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      Accept: 'text/event-stream, application/json',
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options?.headers ?? {}),
    },
    signal,
    ...options,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    let message = body
    try {
      const parsed = JSON.parse(body)
      message = parsed.error || parsed.detail || body
    } catch {
      // Keep plain-text error responses readable.
    }
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  if (!response.body) {
    const data = await response.json()
    if (onDone) onDone(data)
    return data
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        const trimmed = part.trim()
        if (!trimmed.startsWith('data:')) continue
        const rawData = trimmed.slice(5).trim()
        if (!rawData) continue
        try {
          const event = JSON.parse(rawData)
          if (event.type === 'status' && onStatus) onStatus(event.message)
          else if (event.type === 'delta' && onDelta) onDelta(event.text)
          else if (event.type === 'done' && onDone) onDone(event)
          else if (event.type === 'error' && onError) onError(new Error(event.error))
        } catch (e) {
          console.error('Failed to parse SSE event:', e, rawData)
        }
      }
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      return
    }
    if (onError) onError(error)
    else throw error
  }
}

export const authApi = {
  async signup(payload) {
    return request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  async login(payload) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  async logout() {
    return request('/auth/logout', { method: 'POST' })
  },
  async me() {
    return request('/auth/me')
  },
}

export const knowledgeApi = {
  async list() {
    return request('/knowledge/documents')
  },
  async courses() {
    return request('/knowledge/courses')
  },
  async createCourse(payload) {
    return request('/knowledge/courses', { method: 'POST', body: JSON.stringify(payload) })
  },
  async upload(file, courseId) {
    const body = new FormData()
    body.append('file', file)
    if (courseId) body.append('courseId', courseId)
    return request('/knowledge/documents', { method: 'POST', body })
  },
  async remove(id) {
    return request(`/knowledge/documents/${id}`, { method: 'DELETE' })
  },
  async retryFailed() {
    return request('/knowledge/retry-failed', { method: 'POST' })
  },
}

export const planApi = {
  async generate(weekStart, payload) {
    return request('/plan/generate?weekStart=' + weekStart, {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
      }),
    })
  },
  async blocks(weekStart) {
    return request('/plan/blocks?weekStart=' + weekStart)
  },
}

export const canvasApi = {
  connect(payload) {
    return request('/canvas/connect', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  sync() {
    return request('/canvas/sync', {
      method: 'POST',
    })
  },
  knowledgeSync() {
    return request('/canvas/knowledge-sync', {
      method: 'POST',
    })
  },
  getCourses() {
    return request('/canvas/courses')
  },
}

export const taskApi = {
  list() {
    return request('/tasks')
  },
  create(payload) {
    return request('/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  update(id, payload) {
    return request(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },
  remove(id) {
    return request(`/tasks/${id}`, {
      method: 'DELETE',
    })
  },
}

export const classApi = {
  list() {
    return request('/classes')
  },
  create(payload) {
    return request('/classes', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  remove(id) {
    return request(`/classes/${id}`, {
      method: 'DELETE',
    })
  },
}

export const eventApi = {
  list() {
    return request('/events')
  },
  create(payload) {
    return request('/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  remove(id) {
    return request(`/events/${id}`, {
      method: 'DELETE',
    })
  },
}

export const statsApi = {
  overview() {
    return request('/stats/overview')
  },
  weekly() {
    return request('/stats/weekly')
  },
  leaderboard(limit) {
    const query = Number.isFinite(limit) ? `?limit=${limit}` : ''
    return request(`/stats/leaderboard${query}`)
  },
}

export const sessionsApi = {
  start(payload) {
    return request('/sessions/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  finish(payload) {
    return request('/sessions/finish', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}

export const rewardsApi = {
  list() {
    return request('/rewards')
  },
}

export const assistantApi = {
  courses() {
    return request('/assistant/courses')
  },
  ask(payload) {
    return request('/assistant/ask', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  listConversations(search = '') {
    const query = search ? `?search=${encodeURIComponent(search)}` : ''
    return request(`/assistant/conversations${query}`)
  },
  createConversation(payload = {}) {
    return request('/assistant/conversations', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  updateConversation(id, payload) {
    return request(`/assistant/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },
  removeConversation(id) {
    return request(`/assistant/conversations/${id}`, { method: 'DELETE' })
  },
  messages(id) {
    return request(`/assistant/conversations/${id}/messages`)
  },
  sendMessage(id, content) {
    return request(`/assistant/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
  },
  sendMessageStream(id, content, callbacks) {
    return streamRequest(`/assistant/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }, callbacks)
  },
  branchMessage(id, content) {
    return request(`/assistant/messages/${id}/branch`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
  },
  branchMessageStream(id, content, callbacks) {
    return streamRequest(`/assistant/messages/${id}/branch`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }, callbacks)
  },
  regenerateMessage(id) {
    return request(`/assistant/messages/${id}/regenerate`, { method: 'POST' })
  },
  regenerateMessageStream(id, callbacks) {
    return streamRequest(`/assistant/messages/${id}/regenerate`, { method: 'POST' }, callbacks)
  },
  askStream(payload, callbacks) {
    return streamRequest('/assistant/ask', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, callbacks)
  },
}
