import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { availabilityApi, eventApi, planApi, taskApi } from '../api/client'

const dayOptions = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
]

const defaultAvailability = {
  day: '1',
  start: '08:00',
  end: '12:00',
}

const defaultEvent = {
  title: '',
  type: 'exam',
  start: '',
  end: '',
  notes: '',
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

function renderBlock(block) {
  return (
    <div className="session-card" key={block.id}>
      <div className="session-meta">
        <div className="time">
          {new Date(block.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div>
          <p className="session-title">{block.title}</p>
          <p className="muted">{new Date(block.start).toLocaleDateString()}</p>
        </div>
      </div>
      <div className="session-info">
        <span className="pill pill-quiet">{block.status}</span>
        <span className="pill pill-accent">{block.source}</span>
      </div>
    </div>
  )
}

function formatDay(day) {
  return dayOptions.find((option) => option.value === String(day))?.label ?? `Day ${day}`
}

export function PlanPage() {
  const queryClient = useQueryClient()
  const weekStart = useMemo(() => startOfWeekISO(), [])
  const [availabilityForm, setAvailabilityForm] = useState(defaultAvailability)
  const [eventForm, setEventForm] = useState(defaultEvent)

  const tasksQuery = useQuery({ queryKey: ['tasks'], queryFn: taskApi.list })
  const availabilityQuery = useQuery({ queryKey: ['availability'], queryFn: availabilityApi.list })
  const eventsQuery = useQuery({ queryKey: ['events'], queryFn: eventApi.list })
  const blocksQuery = useQuery({
    queryKey: ['plan-blocks', weekStart],
    queryFn: () => planApi.blocks(weekStart),
  })

  const tasks = tasksQuery.data?.tasks ?? []
  const rules = availabilityQuery.data?.rules ?? []
  const events = eventsQuery.data?.events ?? []
  const blocks = blocksQuery.data?.blocks ?? []

  const generateMutation = useMutation({
    mutationFn: () =>
      planApi.generate(weekStart, {
        tasks,
        availabilityRules: rules,
        fixedEvents: events,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan-blocks', weekStart] }),
  })

  const availabilityMutation = useMutation({
    mutationFn: (payload) => availabilityApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      setAvailabilityForm(defaultAvailability)
    },
  })

  const availabilityDelete = useMutation({
    mutationFn: (id) => availabilityApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['availability'] }),
  })

  const eventMutation = useMutation({
    mutationFn: (payload) => eventApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      setEventForm(defaultEvent)
    },
  })

  const eventDelete = useMutation({
    mutationFn: (id) => eventApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })

  const unscheduled = generateMutation.data?.unscheduledTasks ?? []

  function handleAvailabilitySubmit(event) {
    event.preventDefault()
    availabilityMutation.mutate({
      day: Number(availabilityForm.day),
      start: availabilityForm.start,
      end: availabilityForm.end,
    })
  }

  function handleEventSubmit(event) {
    event.preventDefault()
    eventMutation.mutate({
      title: eventForm.title.trim(),
      type: eventForm.type,
      start: eventForm.start,
      end: eventForm.end,
      notes: eventForm.notes.trim() || null,
    })
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="label">Plan</p>
          <h2>Schedule builder</h2>
          <p className="muted">Add tasks, availability, and exams before generating a plan.</p>
        </div>
        <button className="primary" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
          {generateMutation.isPending ? 'Generating...' : 'Generate plan'}
        </button>
      </div>
      <div className="grid">
        <section className="panel wide">
          <div className="section-head">
            <div>
              <p className="label">Timeline</p>
              <h3>Week of {weekStart}</h3>
            </div>
            <span className="pill pill-quiet">
              {blocks.length ? `${blocks.length} study blocks` : 'No plan yet'}
            </span>
          </div>
          {blocksQuery.isLoading ? (
            <p className="muted">Loading plan...</p>
          ) : blocks.length === 0 ? (
            <div className="empty-state">
              <strong>No study blocks scheduled</strong>
              Add tasks and availability, then generate your weekly plan.
            </div>
          ) : (
            <div className="session-list">{blocks.map(renderBlock)}</div>
          )}
          {unscheduled.length > 0 ? (
            <p className="pill pill-warn">Unscheduled: {unscheduled.join(', ')}</p>
          ) : null}
          {generateMutation.error ? (
            <p className="pill pill-warn">
              {generateMutation.error.message || 'Unable to generate plan'}
            </p>
          ) : null}
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">Tasks</p>
              <h3>Planner inputs</h3>
            </div>
            <Link className="ghost small" to="/app/tasks">
              Add tasks
            </Link>
          </div>
          {tasksQuery.isLoading ? (
            <p className="muted">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <div className="empty-state">
              <strong>No tasks added</strong>
              Add assignments with deadlines so the planner can schedule them.
            </div>
          ) : (
            <div className="quest-list">
              {tasks.map((task) => (
                <div className="quest-card" key={task.id}>
                  <div>
                    <p className="session-title">{task.title}</p>
                    <p className="muted">{task.description || 'No description yet'}</p>
                    <span className="pill pill-quiet">Priority {task.priority}</span>
                  </div>
                  <div className="quest-meta">
                    <span className="pill pill-quiet">
                      {task.deadline ? new Date(task.deadline).toLocaleString() : 'No deadline'}
                    </span>
                    <span className="pill pill-quiet">{task.remainingHours}h left</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">Availability</p>
              <h3>Weekly schedule</h3>
            </div>
            <span className="pill pill-quiet">{rules.length} rules</span>
          </div>
          <form className="form-grid" onSubmit={handleAvailabilitySubmit}>
            <div className="form-row">
              <label className="form-field">
                <span>Day</span>
                <select
                  value={availabilityForm.day}
                  onChange={(event) =>
                    setAvailabilityForm({ ...availabilityForm, day: event.target.value })
                  }
                >
                  {dayOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Start</span>
                <input
                  type="time"
                  value={availabilityForm.start}
                  onChange={(event) =>
                    setAvailabilityForm({ ...availabilityForm, start: event.target.value })
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span>End</span>
                <input
                  type="time"
                  value={availabilityForm.end}
                  onChange={(event) =>
                    setAvailabilityForm({ ...availabilityForm, end: event.target.value })
                  }
                  required
                />
              </label>
            </div>
            <button type="submit" className="ghost small" disabled={availabilityMutation.isPending}>
              {availabilityMutation.isPending ? 'Saving...' : 'Add availability'}
            </button>
          </form>
          {availabilityMutation.error ? (
            <p className="pill pill-warn">
              {availabilityMutation.error.message || 'Unable to save availability'}
            </p>
          ) : null}
          {availabilityQuery.isLoading ? (
            <p className="muted">Loading availability...</p>
          ) : rules.length === 0 ? (
            <div className="empty-state">
              <strong>No availability rules</strong>
              Add the time windows when you can study each week.
            </div>
          ) : (
            <div className="list-stack">
              {rules.map((rule) => (
                <div className="list-card" key={rule.id}>
                  <div>
                    <p className="session-title">{formatDay(rule.day)}</p>
                    <p className="muted">
                      {rule.start} - {rule.end}
                    </p>
                  </div>
                  <button
                    className="ghost small"
                    type="button"
                    onClick={() => availabilityDelete.mutate(rule.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">Exams & fixed events</p>
              <h3>Blocked time</h3>
            </div>
            <span className="pill pill-quiet">{events.length} events</span>
          </div>
          <form className="form-grid" onSubmit={handleEventSubmit}>
            <label className="form-field">
              <span>Title</span>
              <input
                value={eventForm.title}
                onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })}
                placeholder="Chemistry midterm"
                required
              />
            </label>
            <div className="form-row">
              <label className="form-field">
                <span>Type</span>
                <select
                  value={eventForm.type}
                  onChange={(event) => setEventForm({ ...eventForm, type: event.target.value })}
                >
                  <option value="exam">Exam</option>
                  <option value="class">Class</option>
                  <option value="meeting">Meeting</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="form-field">
                <span>Start</span>
                <input
                  type="datetime-local"
                  value={eventForm.start}
                  onChange={(event) => setEventForm({ ...eventForm, start: event.target.value })}
                  required
                />
              </label>
              <label className="form-field">
                <span>End</span>
                <input
                  type="datetime-local"
                  value={eventForm.end}
                  onChange={(event) => setEventForm({ ...eventForm, end: event.target.value })}
                  required
                />
              </label>
            </div>
            <label className="form-field">
              <span>Notes</span>
              <textarea
                value={eventForm.notes}
                onChange={(event) => setEventForm({ ...eventForm, notes: event.target.value })}
                placeholder="Closed-book, bring calculator"
              />
            </label>
            <button type="submit" className="ghost small" disabled={eventMutation.isPending}>
              {eventMutation.isPending ? 'Saving...' : 'Add event'}
            </button>
          </form>
          {eventMutation.error ? (
            <p className="pill pill-warn">
              {eventMutation.error.message || 'Unable to save event'}
            </p>
          ) : null}
          {eventsQuery.isLoading ? (
            <p className="muted">Loading events...</p>
          ) : events.length === 0 ? (
            <div className="empty-state">
              <strong>No fixed events</strong>
              Add exams and classes so the planner avoids them.
            </div>
          ) : (
            <div className="list-stack">
              {events.map((event) => (
                <div className="list-card" key={event.id}>
                  <div>
                    <p className="session-title">{event.title}</p>
                    <p className="muted">
                      {event.type} · {new Date(event.start).toLocaleString()} →{' '}
                      {new Date(event.end).toLocaleString()}
                    </p>
                  </div>
                  <button
                    className="ghost small"
                    type="button"
                    onClick={() => eventDelete.mutate(event.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">AI adjustments</p>
              <h3>Live suggestions</h3>
            </div>
            <Link className="ghost small" to="/app/assistant">
              Ask assistant
            </Link>
          </div>
          <div className="empty-state">
            <strong>No AI insights yet</strong>
            Ask the assistant to get scheduling recommendations based on your data.
          </div>
        </section>
      </div>
    </div>
  )
}
