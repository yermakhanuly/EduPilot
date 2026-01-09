import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { planApi, rewardsApi, sessionsApi } from '../api/client'
import { useStrictStore } from '../store/strictStore'

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function startOfWeekISO() {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = (day + 6) % 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - diffToMonday)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().split('T')[0]
}

export function StrictModePage() {
  const { active, mode, endsAt, start, beginBreak, focusMinutes, breakMinutes, setFocusMinutes, setBreakMinutes } =
    useStrictStore()
  const queryClient = useQueryClient()
  const [now, setNow] = useState(Date.now())
  const [sessionId, setSessionId] = useState(null)
  const [finishRequested, setFinishRequested] = useState(false)
  const weekStart = useMemo(() => startOfWeekISO(), [])

  const { data: blocksData } = useQuery({
    queryKey: ['plan-blocks', weekStart],
    queryFn: () => planApi.blocks(weekStart),
  })
  const { data: rewardsData } = useQuery({
    queryKey: ['rewards'],
    queryFn: rewardsApi.list,
  })

  const blocks = blocksData?.blocks ?? []
  const rewards = rewardsData?.rewards ?? []

  const startMutation = useMutation({
    mutationFn: (payload) => sessionsApi.start(payload),
    onSuccess: (data) => {
      setSessionId(data?.session?.id ?? null)
    },
  })

  const finishMutation = useMutation({
    mutationFn: (payload) => sessionsApi.finish(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stats-overview'] })
      queryClient.invalidateQueries({ queryKey: ['stats-weekly'] })
      queryClient.invalidateQueries({ queryKey: ['rewards'] })
    },
  })

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const remaining = endsAt ? Math.max(0, endsAt - now) : 0

  useEffect(() => {
    if (!active || mode !== 'focus' || !sessionId) return
    if (remaining > 0 || finishRequested) return
    setFinishRequested(true)
    finishMutation.mutate(
      {
        sessionId,
        focusedMinutes: focusMinutes,
        completed: true,
        strictMode: true,
      },
      {
        onSettled: () => {
          setSessionId(null)
          setFinishRequested(false)
        },
      },
    )
  }, [active, mode, sessionId, remaining, finishRequested, focusMinutes, finishMutation])

  return (
    <div className="panel wide strict-panel">
      <div className="section-head">
        <div>
          <p className="label">Session</p>
          <h3>Study mode</h3>
          <p className="muted">Timer, focus, and XP earn loop.</p>
        </div>
        <div className="streak-row">
          <button
            className="primary"
            onClick={() => {
              start(focusMinutes)
              setFinishRequested(false)
              startMutation.mutate({ mode: 'focus' })
            }}
            disabled={startMutation.isPending}
          >
            Start {focusMinutes}m focus
          </button>
          <button
            className="ghost"
            onClick={() => {
              if (sessionId && active && mode === 'focus') {
                const elapsedMinutes = Math.max(
                  0,
                  Math.round((focusMinutes * 60 * 1000 - remaining) / 60000),
                )
                finishMutation.mutate({
                  sessionId,
                  focusedMinutes: elapsedMinutes,
                  completed: false,
                  strictMode: true,
                })
                setSessionId(null)
                setFinishRequested(false)
              }
              beginBreak(breakMinutes)
            }}
            disabled={finishMutation.isPending}
          >
            {breakMinutes}m break
          </button>
        </div>
      </div>
      <div className="form-row strict-settings">
        <label className="form-field">
          <span>Focus minutes</span>
          <input
            type="number"
            min="5"
            max="240"
            value={focusMinutes}
            onChange={(event) => setFocusMinutes(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Break minutes</span>
          <input
            type="number"
            min="5"
            max="240"
            value={breakMinutes}
            onChange={(event) => setBreakMinutes(event.target.value)}
          />
        </label>
      </div>
      <div className="timer strict">
        <div className="timer-dial large">{active ? formatTime(remaining) : '00:00'}</div>
        <div className="streak-row">
          <span className="pill pill-accent">{mode === 'break' ? 'Break' : 'Focus'} active</span>
          <span className="pill pill-quiet">Apps blocked</span>
          <span className="pill pill-quiet">Streak protected</span>
        </div>
      </div>
      <div className="grid">
        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">Upcoming</p>
              <h3>Focus queue</h3>
            </div>
            <span className="pill pill-quiet">Strict aligned</span>
          </div>
          {blocks.length === 0 ? (
            <div className="empty-state">
              <strong>No scheduled blocks</strong>
              Generate a plan to populate your Strict Mode queue.
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
                      <p className="muted">{session.status}</p>
                    </div>
                  </div>
                <div className="session-info">
                  <span className="pill pill-accent">{session.source}</span>
                  <span className="pill pill-quiet">Focus {focusMinutes}m cadence</span>
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
              <h3>Earn next</h3>
            </div>
            <span className="pill pill-quiet">Stay locked</span>
          </div>
          {rewards.length === 0 ? (
            <div className="empty-state">
              <strong>No rewards unlocked</strong>
              Complete focus sessions to earn XP rewards.
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
      </div>
    </div>
  )
}
