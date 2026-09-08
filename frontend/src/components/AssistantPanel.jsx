import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { assistantApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'

const MAX_MESSAGES = 50
const CHAT_KEY = (userId) => `edupilot_chat_${userId}`

function normalizeMessages(messages) {
  return messages.filter((message, index) => {
    const previous = messages[index - 1]
    return message?.role && message?.content && (previous?.role !== message.role || previous?.content !== message.content)
  })
}

export function AssistantPanel() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const setTheme = useThemeStore((state) => state.setTheme)

  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const streamRef = useRef(null)

  const storageKey = user?.id ? CHAT_KEY(user.id) : null

  // Load history from localStorage when user is available
  useEffect(() => {
    if (!storageKey) return
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          queueMicrotask(() => setMessages(normalizeMessages(parsed)))
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [storageKey])

  // Persist messages to localStorage
  useEffect(() => {
    if (!storageKey) return
    localStorage.setItem(storageKey, JSON.stringify(messages))
  }, [messages, storageKey])

  // Scroll to bottom when messages change or panel opens
  useEffect(() => {
    if (open && streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight
    }
  }, [messages, open])

  const mutation = useMutation({
    mutationFn: (payload) => assistantApi.ask(payload),
    onSuccess: (data) => {
      if (data?.answer) {
        setMessages((prev) => {
          const next = [...prev, { role: 'assistant', content: data.answer }]
          return next.slice(-MAX_MESSAGES)
        })
      }

      // Handle client-side actions
      if (Array.isArray(data?.clientActions)) {
        for (const action of data.clientActions) {
          if (action.type === 'set_theme') {
            setTheme(action.value)
          } else if (action.type === 'navigate') {
            navigate(action.to)
            setOpen(false)
          }
        }
      }

      // Invalidate React Query caches so pages refresh
      if (Array.isArray(data?.invalidateQueries)) {
        for (const key of data.invalidateQueries) {
          queryClient.invalidateQueries({ queryKey: [key] })
        }
      }
    },
  })

  // Hide on settings page
  if (location.pathname === '/app/settings') return null

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || mutation.isPending) return

    const history = messages.slice(-20)
    setMessages((prev) => {
      const updated = normalizeMessages([...prev, { role: 'user', content: trimmed }])
      return updated.slice(-MAX_MESSAGES)
    })
    setInput('')

    mutation.mutate({
      question: trimmed,
      history: history.map(({ role, content }) => ({ role, content })),
    })
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit(event)
    }
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        className="assistant-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
        title="Ask EduPilot AI"
      >
        {open ? '✕' : '💬'}
      </button>

      {/* Chat Panel */}
      <div className={`assistant-panel${open ? ' open' : ''}`} role="dialog" aria-label="AI Assistant">
        <div className="assistant-panel-header">
          <div>
            <span className="label">AI Assistant</span>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>Ask EduPilot</p>
          </div>
          <span className="pill pill-accent" style={{ fontSize: 11 }}>Groq</span>
        </div>

        <div className="assistant-stream assistant-panel-stream" ref={streamRef}>
          {messages.length === 0 ? (
            <div className="assistant-empty">
              <p className="muted" style={{ fontSize: 13 }}>
                Ask me anything — I can add classes, tasks, events, generate your study plan, switch themes, and more.
              </p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={`${msg.role}-${i}`}
                className={`assistant-bubble ${msg.role === 'user' ? 'user' : 'assistant'}`}
              >
                <p className="assistant-text">{msg.content}</p>
              </div>
            ))
          )}
          {mutation.isPending && (
            <div className="assistant-bubble assistant">
              <p className="assistant-text muted">Thinking…</p>
            </div>
          )}
        </div>

        {mutation.error && (
          <p className="pill pill-warn" style={{ margin: '0 12px', fontSize: 12 }}>
            {mutation.error.message || 'Unable to reach the AI assistant.'}
          </p>
        )}

        <form className="assistant-panel-input" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a Math class on Monday at 9am…"
            disabled={mutation.isPending}
            autoComplete="off"
          />
          <button type="submit" className="primary small" disabled={!input.trim() || mutation.isPending}>
            ↑
          </button>
        </form>
      </div>
    </>
  )
}
