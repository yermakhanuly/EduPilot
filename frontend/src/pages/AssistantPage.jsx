import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { assistantApi } from '../api/client'

export function AssistantPage() {
  const [question, setQuestion] = useState('')
  const mutation = useMutation({
    mutationFn: (prompt) => assistantApi.ask(prompt),
  })

  function handleSubmit(event) {
    event.preventDefault()
    if (!question.trim()) return
    mutation.mutate(question.trim())
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
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Your question</span>
            <textarea
              rows={4}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="When should I study for my calculus exam next week?"
              required
            />
          </label>
          <button type="submit" className="primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Thinking...' : 'Ask EduPilot'}
          </button>
        </form>

        {mutation.data?.answer ? (
          <div className="assistant-response">
            <p className="label">Response</p>
            <p className="assistant-text">{mutation.data.answer}</p>
          </div>
        ) : null}

        {mutation.error ? (
          <p className="pill pill-warn">
            {mutation.error.message || 'Unable to reach the AI helper.'}
          </p>
        ) : null}
      </section>
    </div>
  )
}
