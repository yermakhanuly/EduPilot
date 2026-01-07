import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api/client'
import { useAuthStore } from '../store/authStore'

export function SignupPage() {
  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const mutation = useMutation({
    mutationFn: () => authApi.signup(form),
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
            <p className="label">Get started</p>
            <h3>Create your EduPilot account</h3>
            <p className="muted">We ship httpOnly cookies and JWT for the app session.</p>
          </div>
          <Link to="/login" className="ghost">
            Already have an account?
          </Link>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Name</span>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
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
            {mutation.isPending ? 'Creating...' : 'Create account'}
          </button>
          {mutation.error ? (
            <p className="pill pill-warn">
              {mutation.error.message || 'Could not create account'}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  )
}
