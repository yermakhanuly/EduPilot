import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../api/client'
import { useAuthStore } from '../store/authStore'

export function ProgressPage() {
  const user = useAuthStore((state) => state.user)
  const { data: weekly } = useQuery({
    queryKey: ['stats-weekly'],
    queryFn: statsApi.weekly,
  })
  const { data: overview } = useQuery({
    queryKey: ['stats-overview'],
    queryFn: statsApi.overview,
  })
  const { data: leaderboardData } = useQuery({
    queryKey: ['stats-leaderboard'],
    queryFn: () => statsApi.leaderboard(8),
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
  const leaderboard = leaderboardData?.leaderboard ?? []

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

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">Competition</p>
              <h3>Top XP pilots</h3>
            </div>
            <span className="pill pill-quiet">All users</span>
          </div>
          {leaderboard.length ? (
            <div className="list-stack">
              {leaderboard.map((entry) => {
                const isSelf = entry.userId === user?.id
                return (
                  <div
                    className={`list-card leaderboard-row${isSelf ? ' leaderboard-self' : ''}`}
                    key={entry.userId}
                  >
                    <div className="leaderboard-meta">
                      <span className="pill pill-quiet">#{entry.rank}</span>
                      <p className="session-title">{entry.name}</p>
                    </div>
                    <div className="leaderboard-xp">
                      <span className="pill pill-accent">{entry.totalXp} XP</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="empty-state">
              <strong>No leaderboard data yet</strong>
              Add study sessions to start competing.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
