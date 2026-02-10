import { useMutation } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { assistantApi } from '../api/client'

const CHAT_STORAGE_KEY = 'edupilot_assistant_history'

export function AssistantPage() {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const mutation = useMutation({
    mutationFn: (payload) => assistantApi.ask(payload),
  })
  const canSend = question.trim().length > 0 && !mutation.isPending

  const latestMessages = useMemo(() => messages.slice(-12), [messages])

  useEffect(() => {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY)
    if (!stored) return
    try {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        setMessages(parsed.filter((item) => item?.role && item?.content))
      }
    } catch (error) {
      console.warn('Unable to load assistant history', error)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages))
  }, [messages])

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = question.trim()
    if (!trimmed) return
    const trimmedHistory = messages.slice(-11)
    const nextMessages = [...trimmedHistory, { role: 'user', content: trimmed }]
    setMessages(nextMessages)
    setQuestion('')
    mutation.mutate(
      { question: trimmed, history: nextMessages.map(({ role, content }) => ({ role, content })) },
      {
        onSuccess: (data) => {
          if (data?.answer) {
            setMessages((current) => [...current, { role: 'assistant', content: data.answer }])
          }
        },
      },
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="label">AI helper</p>
          <h2>Ask EduPilot</h2>
          <p className="muted">
            Uses your tasks, weekly classes, and exams to answer questions about your plan.
          </p>
        </div>
        <span className="pill pill-accent">OpenAI</span>
      </div>

      <section className="panel wide">
        <div className="assistant-chat">
          <div className="assistant-stream">
            {latestMessages.length === 0 ? (
              <div className="assistant-empty">
                <p className="muted">No messages yet. Ask your first question to start the chat.</p>
              </div>
            ) : (
              latestMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`assistant-bubble ${message.role === 'user' ? 'user' : 'assistant'}`}
                >
                  <p className="assistant-text">{message.content}</p>
                </div>
              ))
            )}
            {mutation.isPending ? (
              <div className="assistant-bubble assistant">
                <p className="assistant-text muted">Thinking…</p>
              </div>
            ) : null}
          </div>
          <form className="assistant-input" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>Your question</span>
              <textarea
                rows={3}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="When should I study for my calculus exam next week?"
                required
              />
            </label>
            <button type="submit" className="primary" disabled={!canSend}>
              {mutation.isPending ? 'Thinking...' : 'Send'}
            </button>
          </form>
        </div>

        {mutation.error ? (
          <p className="pill pill-warn">
            {mutation.error.message || 'Unable to reach the AI helper.'}
          </p>
        ) : null}
      </section>
    </div>
  )
}
