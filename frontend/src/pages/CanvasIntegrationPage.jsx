import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { canvasApi } from '../api/client'

export function CanvasIntegrationPage() {
  const [form, setForm] = useState({
    baseUrl: 'https://school.instructure.com',
    token: '',
  })

  const mutation = useMutation({
    mutationFn: () => canvasApi.connect(form),
  })

  function onSubmit(event) {
    event.preventDefault()
    mutation.mutate()
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="label">Integrations</p>
          <h2>Canvas access token</h2>
          <p className="muted">Store a personal access token server-side (encrypted).</p>
        </div>
        <span className="pill pill-accent">Manual token</span>
      </div>

      <div className="grid">
        <section className="panel wide">
          <div className="section-head">
            <div>
              <p className="label">Connection</p>
              <h3>Canvas settings</h3>
            </div>
            <button className="ghost small" onClick={onSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? 'Testing...' : 'Test connection'}
            </button>
          </div>
          <form className="form-grid" onSubmit={onSubmit}>
            <label className="form-field">
              <span>Canvas base URL</span>
              <input
                type="url"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="https://school.instructure.com"
                required
              />
            </label>
            <label className="form-field">
              <span>Personal access token</span>
              <input
                type="password"
                value={form.token}
                onChange={(e) => setForm({ ...form, token: e.target.value })}
                placeholder="Canvas token"
                required
              />
            </label>
            <button type="submit" className="primary" disabled={mutation.isPending}>
              Save & test
            </button>
            {mutation.data ? (
              <p className="pill pill-accent">Connected as {JSON.stringify(mutation.data.profile ?? 'user')}</p>
            ) : null}
            {mutation.error ? (
              <p className="pill pill-warn">
                {mutation.error.message || 'Unable to connect to Canvas'}
              </p>
            ) : null}
          </form>
        </section>
      </div>
    </div>
  )
}
