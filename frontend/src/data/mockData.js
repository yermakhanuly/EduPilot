export const demoTasks = [
  {
    id: 't1',
    title: 'Draft research outline',
    course: 'Physics',
    due: 'Today · 6:00 PM',
    priority: 'high',
    status: 'in-progress',
    remainingHours: 2.5,
  },
  {
    id: 't2',
    title: 'Flashcard refresh',
    course: 'Biology',
    due: 'Tomorrow · 9:00 AM',
    priority: 'medium',
    status: 'pending',
    remainingHours: 1,
  },
  {
    id: 't3',
    title: 'Problem set 6',
    course: 'Linear Algebra',
    due: 'Fri · 4:00 PM',
    priority: 'high',
    status: 'pending',
    remainingHours: 3,
  },
]

export const demoBlocks = [
  {
    id: 'b1',
    taskId: 't1',
    title: 'Deep Focus · Calculus',
    start: '2025-01-06T08:00:00.000Z',
    end: '2025-01-06T08:50:00.000Z',
    status: 'scheduled',
    xp: 140,
  },
  {
    id: 'b2',
    taskId: 't2',
    title: 'Project Sprint · Algorithms',
    start: '2025-01-06T10:00:00.000Z',
    end: '2025-01-06T10:50:00.000Z',
    status: 'scheduled',
    xp: 120,
  },
  {
    id: 'b3',
    taskId: 't3',
    title: 'Review · Chemistry Lab',
    start: '2025-01-06T14:00:00.000Z',
    end: '2025-01-06T14:45:00.000Z',
    status: 'scheduled',
    xp: 110,
  },
]

export const demoRewards = [
  { id: 'r1', label: 'Aviator Level 7', detail: 'Next perk: calm playlist + focus wallpaper' },
  { id: 'r2', label: 'Streak · 12 days', detail: 'Strict Mode kept for 9/12 days' },
  { id: 'r3', label: 'Energy check', detail: 'Hydration + quick stretch queued' },
]

export const insightCards = [
  {
    title: 'Shift heavy work earlier',
    detail: 'Swap Chem review to 09:00 while willpower is high.',
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
