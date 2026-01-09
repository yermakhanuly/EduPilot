import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { taskApi } from '../api/client'
import { formatTimeUntil } from '../utils/time'

const defaultForm = {
  title: '',
  description: '',
  deadline: '',
  remainingHours: '',
  priority: '3',
  difficulty: 'medium',
}

export function TasksPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(defaultForm)

  const { data, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: taskApi.list,
  })

  const tasks = data?.tasks ?? []

  const createMutation = useMutation({
    mutationFn: (payload) => taskApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setForm(defaultForm)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => taskApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['stats-overview'] })
      queryClient.invalidateQueries({ queryKey: ['stats-weekly'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => taskApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  function handleSubmit(event) {
    event.preventDefault()
    createMutation.mutate({
      title: form.title.trim(),
      description: form.description.trim() || null,
      deadline: form.deadline || null,
      remainingHours: form.remainingHours ? Number(form.remainingHours) : 0,
      priority: Number(form.priority),
      difficulty: form.difficulty,
    })
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="label">Tasks</p>
          <h2>Assignments & deadlines</h2>
          <p className="muted">Keep the runway clear with on-track vs recovery states.</p>
        </div>
        <button type="button" className="ghost small" onClick={() => setForm(defaultForm)}>
          Clear form
        </button>
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
          {isLoading ? (
            <p className="muted">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <div className="empty-state">
              <strong>No tasks yet</strong>
              Add assignments and deadlines to build your personalized schedule.
            </div>
          ) : (
            <div className="quest-list">
              {tasks.map((task) => (
                <div className="quest-card" key={task.id}>
                  <div>
                    <p className="session-title">{task.title}</p>
                    {task.description ? <p className="muted">{task.description}</p> : null}
                    <span className="pill pill-accent">Priority {task.priority}</span>
                    <span className="pill pill-quiet">
                      {task.difficulty ? `Difficulty ${task.difficulty}` : 'Difficulty medium'}
                    </span>
                  </div>
                  <div className="quest-meta">
                    <span className="pill pill-quiet">
                      {formatTimeUntil(task.deadline)}
                    </span>
                    <span className="pill pill-quiet">Est. {task.remainingHours}h</span>
                    <button
                      className="primary small"
                      type="button"
                      onClick={() => updateMutation.mutate({ id: task.id, payload: { status: 'completed' } })}
                      disabled={updateMutation.isPending}
                    >
                      Done
                    </button>
                    <button
                      className="ghost small"
                      type="button"
                      onClick={() => deleteMutation.mutate(task.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="label">Quick checklist</p>
              <h3>Add a task</h3>
            </div>
            <span className="pill pill-accent">Personalized</span>
          </div>
          <form className="form-grid" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>Title</span>
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Calculus problem set"
                required
              />
            </label>
            <label className="form-field">
              <span>Description</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Chapters 4-5, focus on integrals"
              />
            </label>
            <label className="form-field">
              <span>Deadline</span>
              <input
                type="datetime-local"
                value={form.deadline}
                onChange={(event) => setForm({ ...form, deadline: event.target.value })}
              />
            </label>
            <div className="form-row">
              <label className="form-field">
                <span>Estimated hours</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.remainingHours}
                  onChange={(event) => setForm({ ...form, remainingHours: event.target.value })}
                />
              </label>
              <label className="form-field">
                <span>Priority</span>
                <select
                  value={form.priority}
                  onChange={(event) => setForm({ ...form, priority: event.target.value })}
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
                  value={form.difficulty}
                  onChange={(event) => setForm({ ...form, difficulty: event.target.value })}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
            </div>
            <button type="submit" className="primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Save task'}
            </button>
            {createMutation.error ? (
              <p className="pill pill-warn">
                {createMutation.error.message || 'Could not save task'}
              </p>
            ) : null}
          </form>
        </section>
      </div>
    </div>
  )
}
