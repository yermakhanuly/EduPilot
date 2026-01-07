import { Link, Outlet } from 'react-router-dom'

export function PublicLayout() {
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
