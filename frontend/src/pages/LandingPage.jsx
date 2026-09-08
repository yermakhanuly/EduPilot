import { Link } from 'react-router-dom'
import { insightCards } from '../data/mockData'

const routeLinks = [
  { to: '/login', label: 'Login', detail: 'Jump into your workspace.' },
  { to: '/signup', label: 'Sign up', detail: 'Create your pilot profile.' },
  { to: '/app/dashboard', label: 'Dashboard', detail: 'XP, streaks, and today’s blocks.' },
  { to: '/app/plan', label: 'Plan', detail: 'Deterministic scheduler with Strict guardrails.' },
  { to: '/app/tasks', label: 'Tasks', detail: 'Assignments with AI nudges.' },
  { to: '/app/strict', label: 'Strict Mode', detail: 'Minimal UI focus timer.' },
]

export function LandingPage() {
  return (
    <div className="app-shell">
      <div className="aurora aurora-1" />
      <div className="aurora aurora-2" />
      <header className="hero landing">
        <div className="hero-top landing-top">
          <div>
            <p className="eyebrow">Gamified study tracker</p>
            <h1>EduPilot</h1>
            <p className="lede">
              Plan, focus, and level up. Strict Mode keeps distractions out while the planner
              fills your week with deterministic slots.
            </p>
            <div className="cta-row">
              <Link to="/signup" className="primary">
                Create account
              </Link>
              <Link to="/app/dashboard" className="ghost">
                View dashboard
              </Link>
            </div>
          </div>
          <div className="landing-card">
            <p className="label">Live status</p>
            <div className="stat-value">+335 XP today</div>
            <p className="muted">3 / 5 sprints booked · Strict Mode on</p>
            <div className="streak-row">
              <span className="pill pill-quiet">Streak 12 days</span>
              <span className="pill pill-accent">Level 7 · 68%</span>
            </div>
          </div>
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <p className="label">Planner</p>
            <div className="stat-value">Deterministic</div>
            <span className="pill pill-quiet">Deadline + priority aware</span>
          </div>
          <div className="stat-card">
            <p className="label">Strict Mode</p>
            <div className="stat-value">45m / 10m</div>
            <span className="pill pill-accent">Blocks distractions</span>
          </div>
          <div className="stat-card">
            <p className="label">XP Loop</p>
            <div className="stat-value">+180 XP sprint</div>
            <span className="pill pill-quiet">Streak + completion bonus</span>
          </div>
        </div>
      </header>

      <main className="grid">
        <section className="panel wide">
          <div className="section-head">
            <div>
              <p className="label">Routes</p>
              <h3>Choose your path</h3>
            </div>
            <span className="pill">App + public</span>
          </div>
          <div className="route-grid">
            {routeLinks.map((link) => (
              <Link to={link.to} className="route-card" key={link.to}>
                <div className="route-top">
                  <span className="pill pill-quiet">{link.to}</span>
                  <span className="pill pill-accent">{link.label}</span>
                </div>
                <p className="session-title">{link.detail}</p>
                <p className="muted">Optimized for focus and XP.</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">Coaching</p>
              <h3>AI insights</h3>
            </div>
            <span className="pill pill-accent">Live</span>
          </div>
          <div className="insight-list">
            {insightCards.map((tip) => (
              <div className="insight-card" key={tip.title}>
                <span className="pill pill-quiet">{tip.tag}</span>
                <p className="session-title">{tip.title}</p>
                <p className="muted">{tip.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">Strict defaults</p>
              <h3>Guardrails</h3>
            </div>
            <span className="pill pill-quiet">Applies to all routes</span>
          </div>
          <ul className="rule-list">
            <li>Strict Mode locks social + gaming apps for 45m sprints</li>
            <li>Breaks capped at 10m with audible return cues</li>
            <li>Notifications only from calendar + study timer</li>
            <li>XP penalty if tab-switching exceeds 3 in 2 minutes</li>
          </ul>
        </section>
      </main>
    </div>
  )
}
