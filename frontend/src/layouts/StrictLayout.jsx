import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useStrictStore } from '../store/strictStore'
import { usePageTitle } from '../hooks/usePageTitle'

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export function StrictLayout() {
  usePageTitle()
  const navigate = useNavigate()
  const { active, mode, endsAt, exit } = useStrictStore()
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const remaining = endsAt ? Math.max(0, endsAt - now) : 0

  return (
    <div className="strict-shell">
      <div className="strict-header">
        <div>
          <p className="label">Strict Mode</p>
          <h2>{mode === 'break' ? 'Break' : 'Focus sprint'}</h2>
          <p className="muted">Navigation hidden, XP rewards tied to focus.</p>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="ghost"
            onClick={() => {
              exit()
              navigate('/app/dashboard')
            }}
          >
            Exit Strict Mode
          </button>
        </div>
      </div>
      <div className="strict-content">
        <div className="timer-card">
          <p className="label">{mode === 'break' ? 'Break timer' : 'Focus timer'}</p>
          <div className="timer-dial large">{active ? formatTime(remaining) : '00:00'}</div>
          <p className="muted">{active ? 'Stay locked to keep streak' : 'Start a sprint to earn XP'}</p>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
