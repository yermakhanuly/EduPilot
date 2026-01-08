import { Link, Outlet } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'

export function PublicLayout() {
  usePageTitle()
  return (
    <div className="public-shell">
      <header className="public-nav">
        <Link to="/" className="brand">
          <span className="brand-mark" />
          EduPilot
        </Link>
        <div className="nav-actions">
          <Link to="/login" className="ghost">
            Login
          </Link>
          <Link to="/signup" className="primary">
            Sign up
          </Link>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
