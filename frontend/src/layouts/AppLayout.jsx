import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { usePageTitle } from '../hooks/usePageTitle'
import { useEffect, useMemo, useState } from 'react'

const navItems = [
  { to: '/app/dashboard', label: 'Dashboard' },
  { to: '/app/plan', label: 'Plan' },
  { to: '/app/tasks', label: 'Tasks' },
  { to: '/app/assistant', label: 'Assistant' },
  { to: '/app/progress', label: 'Progress' },
  { to: '/app/rewards', label: 'Rewards' },
  { to: '/app/settings', label: 'Settings' },
  { to: '/app/integrations/canvas', label: 'Canvas' },
]

export function AppLayout() {
  usePageTitle()
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const user = useAuthStore((state) => state.user)
  const { data } = useQuery({
    queryKey: ['stats-overview'],
    queryFn: statsApi.overview,
  })
  const streak = data?.stats?.streak ?? 0
  const level = data?.level?.level ?? 1
  const mobileNavItems = useMemo(
    () =>
      navItems.filter((item) =>
        ['/app/dashboard', '/app/plan', '/app/tasks', '/app/assistant', '/app/progress', '/app/settings'].includes(
          item.to,
        ),
      ),
    [],
  )

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  return (
    <div className="app-layout">
      {navOpen ? <button className="sidebar-backdrop" type="button" onClick={() => setNavOpen(false)} /> : null}
      <aside className={`sidebar${navOpen ? ' open' : ''}`}>
        <div className="brand">
          <span className="brand-mark" />
          <div>
            <div className="brand-name">EduPilot</div>
            <p className="muted">Study tracker</p>
          </div>
        </div>

        <nav className="side-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}
              end={item.to === '/app/dashboard'}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Link to="/app/strict" className="pill pill-accent block">
            Strict Mode
          </Link>
          <p className="muted small">Hides navigation and locks focus for a sprint.</p>
        </div>
      </aside>

      <div className="main-region">
        <header className="topbar">
          <button
            className="ghost small sidebar-toggle"
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
          >
            Menu
          </button>
          <div className="topbar-main">
            <p className="label">Welcome back</p>
            <h3 className="topbar-title">
              {user?.name ?? 'Pilot'}
              <span className="pill pill-quiet">Streak {streak} days</span>
              <span className="pill pill-accent">Level {level}</span>
            </h3>
          </div>
          <div className="topbar-actions">
            <Link to="/app/plan" className="ghost">
              Build plan
            </Link>
            <Link to="/app/strict" className="primary">
              Start focus
            </Link>
          </div>
        </header>
        <div className="content-shell">
          <Outlet />
        </div>
        <nav className="mobile-nav">
          {mobileNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `mobile-link${isActive ? ' active' : ''}`}
              end={item.to === '/app/dashboard'}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
