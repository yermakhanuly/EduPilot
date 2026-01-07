import { describe, expect, it } from 'vitest'
import { generatePlan } from '../planner.js'

describe('planner', () => {
  it('allocates tasks deterministically by priority then deadline', () => {
    const plan = generatePlan({
      weekStart: '2025-01-06',
      tasks: [
        { id: 't1', title: 'Math review', deadline: '2025-01-10', remainingHours: 2, priority: 3 },
        { id: 't2', title: 'CS project', deadline: '2025-01-08', remainingHours: 1, priority: 5 },
        { id: 't3', title: 'History notes', deadline: '2025-01-09', remainingHours: 1.5, priority: 4 },
      ],
      availabilityRules: [
        { day: 0, start: '09:00', end: '12:00' },
        { day: 1, start: '09:00', end: '12:00' },
      ],
      fixedEvents: [],
    })

    expect(plan.blocks.length).toBeGreaterThan(0)
    expect(plan.blocks[0].taskId).toBe('t2')
    expect(plan.blocks[1].taskId).toBe('t3')
    expect(plan.summary.totalMinutes).toBeGreaterThan(0)
  })

  it('flags unscheduled tasks when availability is insufficient', () => {
    const plan = generatePlan({
      weekStart: '2025-01-06',
      tasks: [
        { id: 't1', title: 'Long task', deadline: '2025-01-07', remainingHours: 6, priority: 5 },
      ],
      availabilityRules: [{ day: 0, start: '09:00', end: '11:00' }],
      fixedEvents: [{ start: '2025-01-06T09:30:00.000Z', end: '2025-01-06T10:30:00.000Z' }],
    })

    expect(plan.blocks.length).toBeGreaterThan(0)
    expect(plan.unscheduledTasks).toContain('Long task')
  })
})
