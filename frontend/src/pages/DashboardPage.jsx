import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { planApi, statsApi } from '../api/client'

function startOfWeekISO() {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = (day + 6) % 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - diffToMonday)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().split('T')[0]
}

function formatDeadline(task) {
  if (!task?.deadline) return 'No deadlines yet'
  return new Date(task.deadline).toLocaleString()
}

export function DashboardPage() {
  const weekStart = useMemo(() => startOfWeekISO(), [])
  const { data: overview } = useQuery({
    queryKey: ['stats-overview'],
    queryFn: statsApi.overview,
  })
  const { data: blocksData } = useQuery({
    queryKey: ['plan-blocks', weekStart],
    queryFn: () => planApi.blocks(weekStart),
  })

  const tasks = overview?.spotlightTasks ?? []
  const stats = overview?.stats
  const level = overview?.level
  const blocks = blocksData?.blocks ?? []
  const nextDeadline = tasks.find((task) => task.deadline) ?? tasks[0]
  const progressPercent = Math.round((level?.progressToNext ?? 0) * 100)

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-top">
          <div>
            <p className="eyebrow">AI aligned · Strict Mode ready</p>
            <h1>Dashboard</h1>
            <p className="lede">
              Personalized study tracker. Add your tasks and availability to build your plan.
            </p>
          </div>
          <div className="hero-actions">
            <Link className="primary" to="/app/strict">
              Start focus sprint
            </Link>
            <Link className="ghost" to="/app/assistant">
              Ask the AI helper
            </Link>
          </div>
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <p className="label">Next deadline</p>
            <div className="stat-value">{nextDeadline ? nextDeadline.title : 'No tasks yet'}</div>
            <span className="pill pill-warn">{formatDeadline(nextDeadline)}</span>
          </div>
          <div className="stat-card">
            <p className="label">XP this week</p>
            <div className="stat-value">{stats?.weeklyXp ?? 0} XP</div>
            <span className="pill pill-accent">Total {stats?.totalXp ?? 0} XP</span>
          </div>
          <div className="stat-card">
            <p className="label">Strict Mode</p>
            <div className="stat-value">45m / 10m cadence</div>
            <span className="pill pill-quiet">distractions blocked</span>
          </div>
          <div className="stat-card">
            <p className="label">Streak</p>
            <div className="stat-value">Day {stats?.streak ?? 0}</div>
            <span className="pill pill-accent">Level {level?.level ?? 1}</span>
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
            <span className="pill">{blocks.length} blocks booked</span>
          </div>
          {blocks.length === 0 ? (
            <div className="empty-state">
              <strong>No study blocks yet</strong>
              Generate a plan after adding tasks and availability.
            </div>
          ) : (
            <div className="session-list">
              {blocks.map((session) => (
                <div className="session-card" key={session.id}>
                  <div className="session-meta">
                    <div className="time">
                      {new Date(session.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div>
                      <p className="session-title">{session.title}</p>
                      <p className="muted">{new Date(session.start).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="session-info">
                    <span className="pill pill-quiet">{session.status}</span>
                    <span className="pill pill-accent">{session.source}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">Coaching</p>
              <h3>AI insights</h3>
            </div>
            <span className="pill">Live</span>
          </div>
          <div className="empty-state">
            <strong>No AI insights yet</strong>
            Ask the AI helper to get recommendations based on your data.
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">Progression</p>
              <h3>Level & XP</h3>
            </div>
            <span className="pill pill-accent">Level {level?.level ?? 1}</span>
          </div>
          <div className="xp-row">
            <div>
              <p className="session-title">Current progress</p>
              <p className="muted">
                Next level at {level?.nextThreshold ?? 500} XP.
              </p>
            </div>
            <div className="xp-target">{progressPercent}%</div>
          </div>
          <div className="progress large">
            <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
            <span className="progress-value">{progressPercent}%</span>
          </div>
          <div className="streak-row">
            <div className="pill pill-quiet">Streak {stats?.streak ?? 0} days</div>
            <div className="pill pill-quiet">Weekly XP {stats?.weeklyXp ?? 0}</div>
          </div>
        </section>

        <section className="panel wide">
          <div className="section-head">
            <div>
              <p className="label">Active quests</p>
              <h3>Deadlines & tasks</h3>
            </div>
            <Link className="ghost small" to="/app/tasks">
              Add task
            </Link>
          </div>
          {tasks.length === 0 ? (
            <div className="empty-state">
              <strong>No tasks yet</strong>
              Add assignments and exams to personalize your dashboard.
            </div>
          ) : (
            <div className="quest-list">
              {tasks.map((quest) => (
                <div className="quest-card" key={quest.id}>
                  <div>
                    <p className="session-title">{quest.title}</p>
                    <p className="muted">{quest.status}</p>
                    <span className="pill pill-accent">Priority {quest.priority}</span>
                  </div>
                  <div className="quest-meta">
                    <span className="pill pill-quiet">
                      {quest.deadline ? new Date(quest.deadline).toLocaleString() : 'No deadline'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">Rewards</p>
              <h3>Win conditions</h3>
            </div>
            <span className="pill pill-accent">Stay in flow</span>
          </div>
          <div className="empty-state">
            <strong>No rewards yet</strong>
            Complete focus sessions to unlock rewards.
          </div>
        </section>
      </main>
    </div>
  )
}
