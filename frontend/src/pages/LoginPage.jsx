import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api/client'
import { useAuthStore } from '../store/authStore'

export function LoginPage() {
  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)
  const [form, setForm] = useState({ email: '', password: '' })
  const mutation = useMutation({
    mutationFn: () => authApi.login(form),
    onSuccess: (data) => {
      setUser(data.user)
      navigate('/app/dashboard')
    },
  })

  function handleSubmit(event) {
    event.preventDefault()
    mutation.mutate()
  }

  return (
    <div className="auth-shell">
      <div className="panel wide">
        <div className="section-head">
          <div>
            <p className="label">Welcome back</p>
            <h3>Login</h3>
            <p className="muted">Secure cookies + JWT keep your session safe.</p>
          </div>
          <Link to="/signup" className="ghost">
            Need an account?
          </Link>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Email</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <button type="submit" className="primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Logging in...' : 'Login'}
          </button>
          {mutation.error ? (
            <p className="pill pill-warn">{mutation.error.message || 'Login failed'}</p>
          ) : null}
        </form>
      </div>
    </div>
  )
}
