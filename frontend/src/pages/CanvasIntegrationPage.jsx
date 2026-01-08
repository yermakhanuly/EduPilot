import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { canvasApi } from '../api/client'

export function CanvasIntegrationPage() {
  const [form, setForm] = useState({
    baseUrl: 'https://school.instructure.com',
    token: '',
  })

  const connectMutation = useMutation({
    mutationFn: () => canvasApi.connect(form),
  })

  const syncMutation = useMutation({
    mutationFn: () => canvasApi.sync(),
  })

  function onSubmit(event) {
    event.preventDefault()
    connectMutation.mutate()
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="label">Integrations</p>
          <h2>Canvas access token</h2>
          <p className="muted">
            We store your token encrypted to auto-sync Canvas updates. You can also sync manually.
          </p>
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
            <div className="streak-row">
              <button className="ghost small" onClick={onSubmit} disabled={connectMutation.isPending}>
                {connectMutation.isPending ? 'Importing...' : 'Connect & import'}
              </button>
              <button
                className="ghost small"
                type="button"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? 'Syncing...' : 'Sync now'}
              </button>
            </div>
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
            <button type="submit" className="primary" disabled={connectMutation.isPending}>
              Save token
            </button>
            {connectMutation.data ? (
              <div className="list-stack">
                <p className="pill pill-accent">
                  Connected as {JSON.stringify(connectMutation.data.profile ?? 'user')}
                </p>
                <p className="pill pill-quiet">
                  Imported {connectMutation.data.imported?.classes ?? 0} classes, {connectMutation.data.imported?.events ?? 0} events, {connectMutation.data.imported?.tasks ?? 0} assignments.
                </p>
              </div>
            ) : null}
            {syncMutation.data ? (
              <p className="pill pill-quiet">
                Synced {syncMutation.data.imported?.classes ?? 0} classes, {syncMutation.data.imported?.events ?? 0} events, {syncMutation.data.imported?.tasks ?? 0} assignments.
              </p>
            ) : null}
            {connectMutation.error ? (
              <p className="pill pill-warn">
                {connectMutation.error.message || 'Unable to connect to Canvas'}
              </p>
            ) : null}
            {syncMutation.error ? (
              <p className="pill pill-warn">
                {syncMutation.error.message || 'Unable to sync Canvas data'}
              </p>
            ) : null}
          </form>
        </section>
      </div>
    </div>
  )
}
