import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { classApi, eventApi, planApi, taskApi } from '../api/client'
import { formatTimeUntil } from '../utils/time'

const dayOptions = [
  { value: '0', label: 'Mon' },
  { value: '1', label: 'Tue' },
  { value: '2', label: 'Wed' },
  { value: '3', label: 'Thu' },
  { value: '4', label: 'Fri' },
  { value: '5', label: 'Sat' },
  { value: '6', label: 'Sun' },
]

const defaultClass = {
  title: '',
  day: '0',
  start: '09:00',
  end: '10:00',
  location: '',
}

const defaultEvent = {
  title: '',
  type: 'exam',
  start: '',
  end: '',
  notes: '',
}

const defaultTask = {
  title: '',
  deadline: '',
  remainingHours: '',
  priority: '3',
  difficulty: 'medium',
}

const scheduleStartMinutes = 8 * 60
const scheduleEndMinutes = 23 * 60 + 59
const scheduleHours = Array.from({ length: 16 }, (_value, index) => 8 + index)

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

function formatHour(hour) {
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display} ${suffix}`
}

function formatDay(day) {
  return dayOptions.find((option) => option.value === String(day))?.label ?? `Day ${day}`
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(':').map((part) => Number(part))
  return hours * 60 + minutes
}

export function PlanPage() {
  const queryClient = useQueryClient()
  const weekStart = useMemo(() => startOfWeekISO(), [])
  const [classForm, setClassForm] = useState(defaultClass)
  const [eventForm, setEventForm] = useState(defaultEvent)
  const [taskForm, setTaskForm] = useState(defaultTask)

  const tasksQuery = useQuery({ queryKey: ['tasks'], queryFn: taskApi.list })
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: classApi.list })
  const eventsQuery = useQuery({ queryKey: ['events'], queryFn: eventApi.list })
  const blocksQuery = useQuery({
    queryKey: ['plan-blocks', weekStart],
    queryFn: () => planApi.blocks(weekStart),
  })

  const tasks = tasksQuery.data?.tasks ?? []
  const classes = classesQuery.data?.classes ?? []
  const events = eventsQuery.data?.events ?? []
  const blocks = blocksQuery.data?.blocks ?? []

  const generateMutation = useMutation({
    mutationFn: () =>
      planApi.generate(weekStart, {
        tasks,
        fixedEvents: events,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan-blocks', weekStart] }),
  })

  const classMutation = useMutation({
    mutationFn: (payload) => classApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      setClassForm(defaultClass)
    },
  })

  const classDelete = useMutation({
    mutationFn: (id) => classApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['classes'] }),
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

  const taskMutation = useMutation({
    mutationFn: (payload) => taskApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setTaskForm(defaultTask)
    },
  })

  const taskUpdate = useMutation({
    mutationFn: ({ id, payload }) => taskApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['stats-overview'] })
      queryClient.invalidateQueries({ queryKey: ['stats-weekly'] })
    },
  })

  const taskDelete = useMutation({
    mutationFn: (id) => taskApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const unscheduled = generateMutation.data?.unscheduledTasks ?? []

  function handleClassSubmit(event) {
    event.preventDefault()
    classMutation.mutate({
      title: classForm.title.trim(),
      day: Number(classForm.day),
      start: classForm.start,
      end: classForm.end,
      location: classForm.location.trim() || null,
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

  function handleTaskSubmit(event) {
    event.preventDefault()
    taskMutation.mutate({
      title: taskForm.title.trim(),
      deadline: taskForm.deadline || null,
      remainingHours: taskForm.remainingHours ? Number(taskForm.remainingHours) : 0,
      priority: Number(taskForm.priority),
      difficulty: taskForm.difficulty,
    })
  }

  function classBlockStyle(classItem) {
    const start = timeToMinutes(classItem.start)
    const end = timeToMinutes(classItem.end)
    const clampedStart = Math.max(scheduleStartMinutes, start)
    const clampedEnd = Math.min(scheduleEndMinutes, end)
    if (clampedEnd <= scheduleStartMinutes || clampedStart >= scheduleEndMinutes) {
      return null
    }

    const top = ((clampedStart - scheduleStartMinutes) / 60) * 48
    const height = Math.max(24, ((clampedEnd - clampedStart) / 60) * 48)
    return { top: `${top}px`, height: `${height}px` }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="label">Plan</p>
          <h2>Schedule builder</h2>
          <p className="muted">Add tasks, weekly classes, and exams before generating a plan.</p>
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
              Add tasks and classes, then generate your weekly plan.
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
      </div>

      <section className="panel timetable-panel">
        <div className="section-head">
          <div>
            <p className="label">Weekly timetable</p>
            <h3>Mon → Sun</h3>
            <p className="muted">Schedule window: 08:00 to 23:59.</p>
          </div>
          <span className="pill pill-quiet">{classes.length} classes</span>
        </div>
        {classesQuery.isLoading ? (
          <p className="muted">Loading classes...</p>
        ) : (
          <div className="schedule">
            <div className="schedule-header">
              <div className="schedule-time-label">Time</div>
              {dayOptions.map((day) => (
                <div key={day.value} className="schedule-day-label">
                  {day.label}
                </div>
              ))}
            </div>
            <div className="schedule-body">
              <div className="schedule-times">
                {scheduleHours.map((hour) => (
                  <div key={hour} className="schedule-time">
                    {formatHour(hour)}
                  </div>
                ))}
              </div>
              <div className="schedule-days">
                {dayOptions.map((day) => {
                  const dayClasses = classes.filter(
                    (classItem) => String(classItem.day) === day.value,
                  )
                  return (
                    <div key={day.value} className="schedule-day">
                      {scheduleHours.map((hour) => (
                        <div key={hour} className="schedule-slot" />
                      ))}
                      {dayClasses.map((classItem) => {
                        const style = classBlockStyle(classItem)
                        if (!style) return null
                        return (
                          <div key={classItem.id} className="schedule-block" style={style}>
                            <div className="schedule-block-title">{classItem.title}</div>
                            <div className="schedule-block-time">
                              {classItem.start} - {classItem.end}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
        {classes.length === 0 && !classesQuery.isLoading ? (
          <div className="empty-state">
            <strong>No weekly classes yet</strong>
            Add recurring classes so they appear every week.
          </div>
        ) : null}
      </section>

      <div className="grid">
        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">Weekly classes</p>
              <h3>Add recurring sessions</h3>
            </div>
            <span className="pill pill-quiet">{classes.length} classes</span>
          </div>
          <form className="form-grid" onSubmit={handleClassSubmit}>
            <label className="form-field">
              <span>Class name</span>
              <input
                value={classForm.title}
                onChange={(event) => setClassForm({ ...classForm, title: event.target.value })}
                placeholder="Linear Algebra"
                required
              />
            </label>
            <div className="form-row">
              <label className="form-field">
                <span>Day</span>
                <select
                  value={classForm.day}
                  onChange={(event) =>
                    setClassForm({ ...classForm, day: event.target.value })
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
                  value={classForm.start}
                  onChange={(event) =>
                    setClassForm({ ...classForm, start: event.target.value })
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span>End</span>
                <input
                  type="time"
                  value={classForm.end}
                  onChange={(event) =>
                    setClassForm({ ...classForm, end: event.target.value })
                  }
                  required
                />
              </label>
            </div>
            <label className="form-field">
              <span>Location</span>
              <input
                value={classForm.location}
                onChange={(event) =>
                  setClassForm({ ...classForm, location: event.target.value })
                }
                placeholder="Room 204"
              />
            </label>
            <button type="submit" className="ghost small" disabled={classMutation.isPending}>
              {classMutation.isPending ? 'Saving...' : 'Add class'}
            </button>
          </form>
          {classMutation.error ? (
            <p className="pill pill-warn">
              {classMutation.error.message || 'Unable to save class'}
            </p>
          ) : null}
          {classes.length === 0 && !classesQuery.isLoading ? (
            <div className="empty-state">
              <strong>No weekly classes yet</strong>
              Add a recurring class to populate the timetable.
            </div>
          ) : null}
          {classes.length > 0 ? (
            <div className="list-stack">
              {classes.map((classItem) => (
                <div className="list-card" key={classItem.id}>
                  <div>
                    <p className="session-title">{classItem.title}</p>
                    <p className="muted">
                      {formatDay(classItem.day)} · {classItem.start} - {classItem.end}
                      {classItem.location ? ` · ${classItem.location}` : ''}
                    </p>
                  </div>
                  <button
                    className="ghost small"
                    type="button"
                    onClick={() => classDelete.mutate(classItem.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">Exams & assignments</p>
              <h3>Deadlines to avoid</h3>
            </div>
            <span className="pill pill-quiet">{events.length + tasks.length} items</span>
          </div>
          <div className="form-section">
            <p className="label">Exam or fixed event</p>
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
                {eventMutation.isPending ? 'Saving...' : 'Add exam'}
              </button>
            </form>
            {eventMutation.error ? (
              <p className="pill pill-warn">
                {eventMutation.error.message || 'Unable to save event'}
              </p>
            ) : null}
            {eventsQuery.isLoading ? (
              <p className="muted">Loading exams...</p>
            ) : events.length === 0 ? (
              <div className="empty-state">
                <strong>No exams yet</strong>
                Add exams so the planner avoids them.
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
          </div>

          <div className="form-section">
            <p className="label">Assignment</p>
            <form className="form-grid" onSubmit={handleTaskSubmit}>
              <label className="form-field">
                <span>Title</span>
                <input
                  value={taskForm.title}
                  onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })}
                  placeholder="Problem set 4"
                  required
                />
              </label>
              <div className="form-row">
                <label className="form-field">
                  <span>Deadline</span>
                  <input
                    type="datetime-local"
                    value={taskForm.deadline}
                    onChange={(event) => setTaskForm({ ...taskForm, deadline: event.target.value })}
                  />
                </label>
                <label className="form-field">
                  <span>Estimated hours</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={taskForm.remainingHours}
                    onChange={(event) => setTaskForm({ ...taskForm, remainingHours: event.target.value })}
                  />
                </label>
              <label className="form-field">
                <span>Priority</span>
                <select
                  value={taskForm.priority}
                  onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value })}
                >
                  <option value="1">1 - Low</option>
                  <option value="2">2</option>
                  <option value="3">3 - Medium</option>
                  <option value="4">4</option>
                  <option value="5">5 - High</option>
                </select>
              </label>
              <label className="form-field">
                <span>Difficulty</span>
                <select
                  value={taskForm.difficulty}
                  onChange={(event) => setTaskForm({ ...taskForm, difficulty: event.target.value })}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
            </div>
              <button type="submit" className="ghost small" disabled={taskMutation.isPending}>
                {taskMutation.isPending ? 'Saving...' : 'Add assignment'}
              </button>
            </form>
            {taskMutation.error ? (
              <p className="pill pill-warn">
                {taskMutation.error.message || 'Unable to save assignment'}
              </p>
            ) : null}
            {tasksQuery.isLoading ? (
              <p className="muted">Loading assignments...</p>
            ) : tasks.length === 0 ? (
              <div className="empty-state">
                <strong>No assignments yet</strong>
                Add assignments so they appear in your plan.
              </div>
            ) : (
              <div className="list-stack">
                {tasks.map((task) => (
                  <div className="list-card" key={task.id}>
                    <div>
                      <p className="session-title">{task.title}</p>
                      <p className="muted">
                        {formatTimeUntil(task.deadline)}
                        {` · Est. ${task.remainingHours}h · Priority ${task.priority}`}
                        {` · ${task.difficulty ?? 'medium'} difficulty`}
                      </p>
                    </div>
                    <div className="streak-row">
                      <button
                        className="primary small"
                        type="button"
                        onClick={() =>
                          taskUpdate.mutate({ id: task.id, payload: { status: 'completed' } })
                        }
                        disabled={taskUpdate.isPending}
                      >
                        Done
                      </button>
                      <button
                        className="ghost small"
                        type="button"
                        onClick={() => taskDelete.mutate(task.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Link className="ghost small" to="/app/tasks">
            Manage all tasks
          </Link>
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
