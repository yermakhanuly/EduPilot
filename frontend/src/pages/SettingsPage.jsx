import { useAuthStore } from '../store/authStore'

export function SettingsPage() {
  const user = useAuthStore((state) => state.user)
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
    </div>
  )
}
