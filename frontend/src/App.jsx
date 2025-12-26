import { Link, NavLink, Route, Routes } from 'react-router-dom'
import './App.css'

const navLinks = [
  { to: '/', label: 'Landing', description: 'Orientation & route map' },
  { to: '/dashboard', label: 'Dashboard', description: 'Today’s plan + XP + streak' },
  { to: '/plan', label: 'Plan', description: 'Schedule builder (AI adjustments)' },
  { to: '/tasks', label: 'Tasks', description: 'Assignments & deadlines' },
  { to: '/session', label: 'Session', description: 'Study mode timer + focus' },
  { to: '/progress', label: 'Progress', description: 'Analytics' },
  { to: '/rewards', label: 'Rewards', description: 'Store · badges · levels' },
  { to: '/strict', label: 'Strict', description: 'Strict Mode settings' },
  { to: '/settings', label: 'Settings', description: 'Account & preferences' },
]

const sessions = [
  {
    time: '08:00',
    title: 'Deep Focus · Calculus',
    detail: 'Chapters 4-5 + spaced repetition cards',
    duration: '50m',
    progress: 72,
    xp: 180,
  },
  {
    time: '10:00',
    title: 'Project Sprint · Algorithms',
    detail: 'Pseudocode + dry runs for graph traversal',
    duration: '45m',
    progress: 38,
    xp: 95,
  },
  {
    time: '14:00',
    title: 'Review · Chemistry Lab',
    detail: 'Prep reagents list + safety notes',
    duration: '35m',
    progress: 20,
    xp: 60,
  },
]

const quests = [
  {
    name: 'Draft research outline',
    course: 'Physics',
    due: 'Today · 6:00 PM',
    status: 'on-track',
    progress: 65,
    impact: 'High impact',
  },
  {
    name: 'Flashcard refresh',
    course: 'Biology',
    due: 'Tomorrow · 9:00 AM',
    status: 'recovery',
    progress: 35,
    impact: 'Recovery needed',
  },
  {
    name: 'Problem set 6',
    course: 'Linear Algebra',
    due: 'Fri · 4:00 PM',
    status: 'locked',
    progress: 0,
    impact: 'Locked in Strict Mode',
  },
]

const insights = [
  {
    title: 'Shift heavy work earlier',
    detail: 'AI recommends swapping Chem review to 09:00 while willpower is high.',
    tag: 'Schedule tweak',
  },
  {
    title: 'Micro-reward unlocked',
    detail: 'Earn a 7m break after next 45m sprint if you stay in Strict Mode.',
    tag: 'Motivation',
  },
  {
    title: 'Confidence check',
    detail: 'Quizzes trending +12% accuracy; keep repetition intervals at 1.5x.',
    tag: 'Progress',
  },
]

const rewards = [
  {
    label: 'Aviator Level 7',
    detail: 'Next perk: Calm playlist + focus wallpaper at Level 8',
  },
  {
    label: 'Streak · 12 days',
    detail: 'Strict Mode kept for 9/12 days. Missed Wed; auto-recovery today.',
  },
  {
    label: 'Energy check',
    detail: 'Hydration + quick stretch queued after current block.',
  },
]

const strictRules = [
  'Strict Mode locks social + gaming apps for 45m sprints',
  'Breaks capped at 10m with audible return cue',
  'Notifications only from calendar + study timer',
  'XP penalty if tab-switching exceeds 3 in 2 minutes',
]

const analytics = [
  { label: 'XP today', value: '+335 XP', detail: '+18% vs average' },
  { label: 'Focus accuracy', value: '88%', detail: '+6% vs last week' },
  { label: 'Streak', value: '12 days', detail: 'Keep Strict to extend' },
]

const storeItems = [
  { title: 'Deep Work skin', cost: '450 XP', tag: 'Theme' },
  { title: 'Calm playlist', cost: '300 XP', tag: 'Reward' },
  { title: 'Focus badge pack', cost: '520 XP', tag: 'Badge' },
]

const levelProgress = 68

function LandingPage() {
  return (
    <>
      <header className="hero landing">
        <div className="eyebrow">Route map · AI aligned</div>
        <div className="hero-top landing-top">
          <div>
            <h1>EduPilot</h1>
            <p className="lede">
              Every major view is mapped: hop from dashboard to plan, tasks, session,
              progress, rewards, strict, or settings without losing focus.
            </p>
            <div className="cta-row">
              <Link to="/dashboard" className="primary">
                Open dashboard
              </Link>
              <Link to="/plan" className="ghost">
                Build today&apos;s plan
              </Link>
            </div>
          </div>
          <div className="landing-card">
            <p className="label">Live status</p>
            <div className="stat-value">+335 XP today</div>
            <p className="muted">3 / 5 sprints booked · Strict Mode on</p>
            <div className="streak-row">
              <span className="pill pill-quiet">Streak 12 days</span>
              <span className="pill pill-accent">Level 7 · {levelProgress}%</span>
            </div>
          </div>
        </div>
        <div className="stat-grid">
          {analytics.map((stat) => (
            <div className="stat-card" key={stat.label}>
              <p className="label">{stat.label}</p>
              <div className="stat-value">{stat.value}</div>
              <span className="pill pill-quiet">{stat.detail}</span>
            </div>
          ))}
        </div>
      </header>

      <main className="grid">
        <section className="panel wide">
          <div className="section-head">
            <div>
              <p className="label">Routes</p>
              <h3>Pick your track</h3>
            </div>
            <span className="pill">Click through to any page</span>
          </div>
          <div className="route-grid">
            {navLinks
              .filter((link) => link.to !== '/')
              .map((link) => (
                <Link to={link.to} className="route-card" key={link.to}>
                  <div className="route-top">
                    <span className="pill pill-quiet">{link.to}</span>
                    <span className="pill pill-accent">{link.label}</span>
                  </div>
                  <p className="session-title">{link.description}</p>
                  <p className="muted">Optimized for this workflow.</p>
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
            {insights.map((tip) => (
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
            <span className="pill pill-quiet">Applies across routes</span>
          </div>
          <ul className="rule-list">
            {strictRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>
      </main>
    </>
  )
}

function DashboardPage() {
  return (
    <>
      <header className="hero">
        <div className="eyebrow">AI-aligned · Strict Mode on</div>
        <div className="hero-top">
          <div>
            <h1>EduPilot</h1>
            <p className="lede">
              Gamified study tracker that plans, tracks, and boosts every session with
              XP, levels, and AI scheduling.
            </p>
          </div>
          <div className="hero-actions">
            <button className="primary">Start focus sprint</button>
            <button className="ghost">Shuffle schedule with AI</button>
          </div>
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <p className="label">Next deadline</p>
            <div className="stat-value">Chemistry lab · 6h away</div>
            <span className="pill pill-warn">on deck</span>
          </div>
          <div className="stat-card">
            <p className="label">XP today</p>
            <div className="stat-value">+335 XP</div>
            <span className="pill pill-accent">+18% vs avg</span>
          </div>
          <div className="stat-card">
            <p className="label">Strict Mode</p>
            <div className="stat-value">45m / 10m cadence</div>
            <span className="pill pill-quiet">distractions blocked</span>
          </div>
          <div className="stat-card">
            <p className="label">Streak</p>
            <div className="stat-value">Day 12</div>
            <span className="pill pill-accent">+2 vs last week</span>
          </div>
        </div>
      </header>

      <main className="grid">
        <section className="panel wide">
          <div className="section-head">
            <div>
              <p className="label">Today&apos;s flight plan</p>
              <h3>Focus runway</h3>
            </div>
            <span className="pill">3 / 5 sprints booked</span>
          </div>
          <div className="session-list">
            {sessions.map((session) => (
              <div className="session-card" key={session.title}>
                <div className="session-meta">
                  <div className="time">{session.time}</div>
                  <div>
                    <p className="session-title">{session.title}</p>
                    <p className="muted">{session.detail}</p>
                  </div>
                </div>
                <div className="session-info">
                  <span className="pill pill-quiet">{session.duration}</span>
                  <span className="pill pill-accent">+{session.xp} XP</span>
                </div>
                <div className="progress">
                  <div
                    className="progress-bar"
                    style={{ width: `${session.progress}%` }}
                  />
                  <span className="progress-value">{session.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">Distraction shield</p>
              <h3>Strict Mode</h3>
            </div>
            <span className="pill pill-accent">Active</span>
          </div>
          <div className="strict-card">
            <div>
              <p className="session-title">Focus window · 45m</p>
              <p className="muted">Breaks limited to 10m, high-noise apps blocked.</p>
            </div>
            <div className="toggle">
              <div className="toggle-knob" />
              <span>Lock in</span>
            </div>
          </div>
          <ul className="rule-list">
            {strictRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">Progression</p>
              <h3>Level & XP</h3>
            </div>
            <span className="pill pill-accent">+180 XP today</span>
          </div>
          <div className="xp-row">
            <div>
              <p className="session-title">Aviator · Level 7</p>
              <p className="muted">Keep streak for bonus loot in 2 sessions.</p>
            </div>
            <div className="xp-target">Next level: 1,020 XP</div>
          </div>
          <div className="progress large">
            <div className="progress-bar" style={{ width: `${levelProgress}%` }} />
            <span className="progress-value">{levelProgress}%</span>
          </div>
          <div className="streak-row">
            <div className="pill pill-quiet">Streak 12 days</div>
            <div className="pill pill-quiet">Focus accuracy 88%</div>
            <div className="pill pill-quiet">Break compliance 91%</div>
          </div>
        </section>

        <section className="panel wide">
          <div className="section-head">
            <div>
              <p className="label">Active quests</p>
              <h3>Deadlines & tasks</h3>
            </div>
            <button className="ghost small">Add task</button>
          </div>
          <div className="quest-list">
            {quests.map((quest) => (
              <div className="quest-card" key={quest.name}>
                <div>
                  <p className="session-title">{quest.name}</p>
                  <p className="muted">{quest.course}</p>
                  <span
                    className={`pill pill-status pill-${quest.status}`}
                  >
                    {quest.impact}
                  </span>
                </div>
                <div className="quest-meta">
                  <span className="pill pill-quiet">{quest.due}</span>
                  <div className="progress mini">
                    <div
                      className="progress-bar"
                      style={{ width: `${quest.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">Coaching</p>
              <h3>AI insights</h3>
            </div>
            <span className="pill">Live</span>
          </div>
          <div className="insight-list">
            {insights.map((tip) => (
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
              <p className="label">Rewards</p>
              <h3>Win conditions</h3>
            </div>
            <span className="pill pill-accent">Stay in flow</span>
          </div>
          <div className="reward-list">
            {rewards.map((reward) => (
              <div className="reward-card" key={reward.label}>
                <p className="session-title">{reward.label}</p>
                <p className="muted">{reward.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  )
}

function PlanPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="label">Plan</p>
          <h2>Schedule builder</h2>
          <p className="muted">AI adjustments live here. Pull any block into focus.</p>
        </div>
        <span className="pill pill-accent">Adaptive</span>
      </div>
      <div className="grid">
        <section className="panel wide">
          <div className="section-head">
            <div>
              <p className="label">Timeline</p>
              <h3>Today</h3>
            </div>
            <button className="ghost small">Shuffle with AI</button>
          </div>
          <div className="session-list">
            {sessions.map((session) => (
              <div className="session-card" key={session.title}>
                <div className="session-meta">
                  <div className="time">{session.time}</div>
                  <div>
                    <p className="session-title">{session.title}</p>
                    <p className="muted">{session.detail}</p>
                  </div>
                </div>
                <div className="session-info">
                  <span className="pill pill-quiet">{session.duration}</span>
                  <span className="pill pill-accent">+{session.xp} XP</span>
                </div>
                <div className="progress">
                  <div
                    className="progress-bar"
                    style={{ width: `${session.progress}%` }}
                  />
                  <span className="progress-value">{session.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">AI adjustments</p>
              <h3>Live suggestions</h3>
            </div>
            <span className="pill pill-quiet">Auto-applies</span>
          </div>
          <div className="insight-list">
            {insights.map((tip) => (
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
              <p className="label">Constraints</p>
              <h3>Strict guardrails</h3>
            </div>
            <span className="pill pill-accent">Strict</span>
          </div>
          <ul className="rule-list">
            {strictRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}

function TasksPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="label">Tasks</p>
          <h2>Assignments & deadlines</h2>
          <p className="muted">Keep the runway clear with on-track vs recovery states.</p>
        </div>
        <button className="ghost small">Add task</button>
      </div>
      <div className="grid">
        <section className="panel wide">
          <div className="section-head">
            <div>
              <p className="label">Active</p>
              <h3>Quest board</h3>
            </div>
            <span className="pill pill-quiet">Synced with schedule</span>
          </div>
          <div className="quest-list">
            {quests.map((quest) => (
              <div className="quest-card" key={quest.name}>
                <div>
                  <p className="session-title">{quest.name}</p>
                  <p className="muted">{quest.course}</p>
                  <span
                    className={`pill pill-status pill-${quest.status}`}
                  >
                    {quest.impact}
                  </span>
                </div>
                <div className="quest-meta">
                  <span className="pill pill-quiet">{quest.due}</span>
                  <div className="progress mini">
                    <div
                      className="progress-bar"
                      style={{ width: `${quest.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">Quick checklist</p>
              <h3>Focus queue</h3>
            </div>
            <span className="pill pill-accent">Strict Mode aware</span>
          </div>
          <ul className="checklist">
            {quests.map((quest) => (
              <li key={quest.name}>
                <div className="check-left">
                  <span className="checkbox" />
                  <div>
                    <p className="session-title">{quest.name}</p>
                    <p className="muted">{quest.course}</p>
                  </div>
                </div>
                <span className="pill pill-quiet">{quest.due}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}

function SessionPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="label">Session</p>
          <h2>Study mode</h2>
          <p className="muted">Timer, focus, and XP earn loop.</p>
        </div>
        <span className="pill pill-accent">Strict Mode on</span>
      </div>
      <div className="grid">
        <section className="panel wide">
          <div className="section-head">
            <div>
              <p className="label">Active sprint</p>
              <h3>Deep Focus</h3>
            </div>
            <button className="ghost small">End early</button>
          </div>
          <div className="timer">
            <div className="timer-dial">45:00</div>
            <div className="streak-row">
              <span className="pill pill-accent">+180 XP projected</span>
              <span className="pill pill-quiet">Break in 10m</span>
              <span className="pill pill-quiet">Apps blocked</span>
            </div>
          </div>
          <div className="session-list">
            {sessions.map((session) => (
              <div className="session-card" key={session.title}>
                <div className="session-meta">
                  <div className="time">{session.time}</div>
                  <div>
                    <p className="session-title">{session.title}</p>
                    <p className="muted">{session.detail}</p>
                  </div>
                </div>
                <div className="session-info">
                  <span className="pill pill-quiet">{session.duration}</span>
                  <span className="pill pill-accent">+{session.xp} XP</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">Rewards</p>
              <h3>Earn next</h3>
            </div>
            <span className="pill pill-quiet">Stay locked</span>
          </div>
          <div className="reward-list">
            {rewards.map((reward) => (
              <div className="reward-card" key={reward.label}>
                <p className="session-title">{reward.label}</p>
                <p className="muted">{reward.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}

function ProgressPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="label">Progress</p>
          <h2>Analytics</h2>
          <p className="muted">XP, streak, and compliance trends.</p>
        </div>
        <span className="pill pill-accent">Updated hourly</span>
      </div>
      <div className="grid">
        <section className="panel wide">
          <div className="section-head">
            <div>
              <p className="label">Metrics</p>
              <h3>What&apos;s moving</h3>
            </div>
            <span className="pill pill-quiet">AI summarizes</span>
          </div>
          <div className="analytic-grid">
            {analytics.map((stat) => (
              <div className="stat-card" key={stat.label}>
                <p className="label">{stat.label}</p>
                <div className="stat-value">{stat.value}</div>
                <p className="muted">{stat.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">XP track</p>
              <h3>Level curve</h3>
            </div>
            <span className="pill pill-accent">Level 7</span>
          </div>
          <div className="progress large">
            <div className="progress-bar" style={{ width: `${levelProgress}%` }} />
            <span className="progress-value">{levelProgress}%</span>
          </div>
          <div className="streak-row">
            <div className="pill pill-quiet">Focus accuracy 88%</div>
            <div className="pill pill-quiet">Break compliance 91%</div>
            <div className="pill pill-quiet">On-time starts 82%</div>
          </div>
        </section>
      </div>
    </>
  )
}

function RewardsPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="label">Rewards</p>
          <h2>Store & badges</h2>
          <p className="muted">Spend XP on perks and cosmetics.</p>
        </div>
        <span className="pill pill-accent">Streak protected</span>
      </div>
      <div className="grid">
        <section className="panel wide">
          <div className="section-head">
            <div>
              <p className="label">Unlocked</p>
              <h3>Current perks</h3>
            </div>
            <span className="pill pill-quiet">Auto-granted</span>
          </div>
          <div className="reward-list">
            {rewards.map((reward) => (
              <div className="reward-card" key={reward.label}>
                <p className="session-title">{reward.label}</p>
                <p className="muted">{reward.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">Store</p>
              <h3>Spend XP</h3>
            </div>
            <span className="pill pill-accent">Live</span>
          </div>
          <div className="store-grid">
            {storeItems.map((item) => (
              <div className="store-card" key={item.title}>
                <p className="session-title">{item.title}</p>
                <p className="muted">{item.tag}</p>
                <span className="pill pill-quiet">{item.cost}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}

function StrictPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="label">Strict</p>
          <h2>Strict Mode settings</h2>
          <p className="muted">Toggles apply to session, plan, and tasks.</p>
        </div>
        <span className="pill pill-accent">Locked</span>
      </div>
      <div className="grid">
        <section className="panel wide">
          <div className="section-head">
            <div>
              <p className="label">Controls</p>
              <h3>Distraction shield</h3>
            </div>
            <div className="toggle">
              <div className="toggle-knob" />
              <span>Strict on</span>
            </div>
          </div>
          <ul className="rule-list">
            {strictRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">Penalties</p>
              <h3>XP & streak</h3>
            </div>
            <span className="pill pill-quiet">Auto-enforced</span>
          </div>
          <div className="reward-list">
            <div className="reward-card">
              <p className="session-title">Tab switches</p>
              <p className="muted">-10 XP if more than 3 switches in 2 minutes.</p>
            </div>
            <div className="reward-card">
              <p className="session-title">Break overruns</p>
              <p className="muted">Streak pause if breaks exceed 10m twice.</p>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}

function SettingsPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="label">Settings</p>
          <h2>Account & preferences</h2>
          <p className="muted">Adjust notifications, integrations, and AI flavor.</p>
        </div>
        <span className="pill pill-quiet">Profile · EDU-4412</span>
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
    </>
  )
}

function App() {
  return (
    <div className="app-shell">
      <div className="aurora aurora-1" />
      <div className="aurora aurora-2" />
      <div className="app-chrome">
        <div className="brand">
          <div className="brand-mark" />
          <span>EduPilot</span>
        </div>
        <nav className="nav-links">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              end={link.to === '/'}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <Link to="/session" className="primary nav-primary">
          Start focus
        </Link>
      </div>

      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/session" element={<SessionPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/rewards" element={<RewardsPage />} />
        <Route path="/strict" element={<StrictPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </div>
  )
}

export default App
