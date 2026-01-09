import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../api/client'
import { useThemeStore } from '../store/themeStore'

export function SettingsPage() {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const theme = useThemeStore((state) => state.theme)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="label">Settings</p>
          <h2>Account & preferences</h2>
          <p className="muted">Adjust notifications, integrations, and AI flavor.</p>
        </div>
        <span className="pill pill-quiet">{user?.email ?? 'Profile incomplete'}</span>
      </div>
      <section className="panel wide">
        <div className="section-head">
          <div>
            <p className="label">Preferences</p>
            <h3>Control center</h3>
          </div>
          <button className="ghost small">Save</button>
        </div>
        <ul className="setting-list">
          <li>
            <div>
              <p className="session-title">Theme</p>
              <p className="muted">Switch between dark and light mode.</p>
            </div>
            <button
              type="button"
              className="theme-toggle"
              data-theme={theme}
              onClick={toggleTheme}
              aria-pressed={theme === 'light'}
            >
              <span className="theme-toggle-track">
                <span className="theme-toggle-thumb" />
              </span>
              <span>{theme === 'light' ? 'Light' : 'Dark'}</span>
            </button>
          </li>
          <li>
            <div>
              <p className="session-title">Notifications</p>
              <p className="muted">Only calendar + study timer alerts.</p>
            </div>
            <div className="toggle">
              <div className="toggle-knob" />
              <span>On</span>
            </div>
          </li>
          <li>
            <div>
              <p className="session-title">AI tone</p>
              <p className="muted">Direct & concise coaching.</p>
            </div>
            <span className="pill pill-accent">Focused</span>
          </li>
          <li>
            <div>
              <p className="session-title">Sync</p>
              <p className="muted">Calendar + task manager connected.</p>
            </div>
            <span className="pill pill-quiet">2 integrations</span>
          </li>
        </ul>
      </section>
      <section className="panel wide">
        <div className="section-head">
          <div>
            <p className="label">Account</p>
            <h3>Session</h3>
          </div>
          <button
            className="ghost small"
            type="button"
            onClick={async () => {
              try {
                await authApi.logout()
              } catch (error) {
                console.error('Logout failed', error)
              }
              logout()
              queryClient.clear()
              navigate('/login')
            }}
          >
            Log out
          </button>
        </div>
        <p className="muted">Logging out clears your session on this device.</p>
      </section>
    </div>
  )
}
