import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../api/client'

export function ProgressPage() {
  const { data: weekly } = useQuery({
    queryKey: ['stats-weekly'],
    queryFn: statsApi.weekly,
  })
  const { data: overview } = useQuery({
    queryKey: ['stats-overview'],
    queryFn: statsApi.overview,
  })

  const summary = weekly?.summary ?? { totalXp: 0, totalMinutes: 0 }
  const level = overview?.level
  const progressPercent = Math.round((level?.progressToNext ?? 0) * 100)

  const stats = [
    { label: 'XP this week', value: `${summary.totalXp} XP`, detail: 'Weekly total' },
    { label: 'Focused minutes', value: `${summary.totalMinutes} min`, detail: 'Last 7 days' },
    { label: 'Streak', value: `${overview?.stats?.streak ?? 0} days`, detail: 'Keep Strict Mode' },
    { label: 'Level', value: `Level ${level?.level ?? 1}`, detail: 'Next reward soon' },
  ]

  return (
    <div className="page">
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
            {stats.map((stat) => (
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
            <span className="pill pill-accent">Level {level?.level ?? 1}</span>
          </div>
          <div className="progress large">
            <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
            <span className="progress-value">{progressPercent}%</span>
          </div>
          <div className="streak-row">
            <div className="pill pill-quiet">Weekly XP {summary.totalXp}</div>
            <div className="pill pill-quiet">Total XP {overview?.stats?.totalXp ?? 0}</div>
            <div className="pill pill-quiet">Streak {overview?.stats?.streak ?? 0} days</div>
          </div>
        </section>
      </div>
    </div>
  )
}
