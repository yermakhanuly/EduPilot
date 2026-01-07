import { useQuery } from '@tanstack/react-query'
import { rewardsApi } from '../api/client'

const storeItems = [
  { title: 'Deep Work skin', cost: '450 XP', tag: 'Theme' },
  { title: 'Calm playlist', cost: '300 XP', tag: 'Reward' },
  { title: 'Focus badge pack', cost: '520 XP', tag: 'Badge' },
]

export function RewardsPage() {
  const { data } = useQuery({
    queryKey: ['rewards'],
    queryFn: rewardsApi.list,
  })

  const rewards = data?.rewards ?? []

  return (
    <div className="page">
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
          {rewards.length === 0 ? (
            <div className="empty-state">
              <strong>No rewards yet</strong>
              Complete focus sessions to unlock perks.
            </div>
          ) : (
            <div className="reward-list">
              {rewards.map((reward) => (
                <div className="reward-card" key={reward.id}>
                  <p className="session-title">{reward.label}</p>
                  <p className="muted">{reward.detail}</p>
                </div>
              ))}
            </div>
          )}
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
    </div>
  )
}
