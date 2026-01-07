const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

async function request(path, options) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  return await response.json()
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

export const availabilityApi = {
  list() {
    return request('/availability')
  },
  create(payload) {
    return request('/availability', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  remove(id) {
    return request(`/availability/${id}`, {
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
}

export const rewardsApi = {
  list() {
    return request('/rewards')
  },
}

export const assistantApi = {
  ask(question) {
    return request('/assistant/ask', {
      method: 'POST',
      body: JSON.stringify({ question }),
    })
  },
}
