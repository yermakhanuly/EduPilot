import { Link, Outlet } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'
import { useThemeStore } from '../store/themeStore'

export function PublicLayout() {
  usePageTitle()
  const toggleTheme = useThemeStore((state) => state.toggleTheme)
  return (
    <div className="public-shell">
      <header className="public-nav">
        <Link to="/" className="brand">
          EduPilot
        </Link>
        <div className="nav-actions">
          <button className="ghost" type="button" onClick={toggleTheme} aria-label="Toggle theme">☼</button>
          <Link to="/login" className="ghost">Log in</Link>
          <Link to="/signup" className="primary">
            Get started
          </Link>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
