import { create } from 'zustand'

export const useStrictStore = create((set) => ({
  active: false,
  mode: 'focus',
  endsAt: undefined,
  start: (durationMinutes) =>
    set({
      active: true,
      mode: 'focus',
      endsAt: Date.now() + durationMinutes * 60 * 1000,
    }),
  beginBreak: (durationMinutes) =>
    set({
      active: true,
      mode: 'break',
      endsAt: Date.now() + durationMinutes * 60 * 1000,
    }),
  exit: () =>
    set({
      active: false,
      endsAt: undefined,
    }),
}))
