import { create } from 'zustand'

const SETTINGS_KEY = 'edupilot-strict-settings'
const DEFAULT_FOCUS = 45
const DEFAULT_BREAK = 10

const clampMinutes = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, 5), 240)
}

const getInitialSettings = () => {
  if (typeof window === 'undefined') {
    return { focusMinutes: DEFAULT_FOCUS, breakMinutes: DEFAULT_BREAK }
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) {
      return { focusMinutes: DEFAULT_FOCUS, breakMinutes: DEFAULT_BREAK }
    }
    const parsed = JSON.parse(raw)
    return {
      focusMinutes: clampMinutes(parsed?.focusMinutes, DEFAULT_FOCUS),
      breakMinutes: clampMinutes(parsed?.breakMinutes, DEFAULT_BREAK),
    }
  } catch {
    return { focusMinutes: DEFAULT_FOCUS, breakMinutes: DEFAULT_BREAK }
  }
}

const persistSettings = (focusMinutes, breakMinutes) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ focusMinutes, breakMinutes }),
    )
  } catch {
    // Ignore storage failures
  }
}

const initial = getInitialSettings()

export const useStrictStore = create((set) => ({
  active: false,
  mode: 'focus',
  endsAt: undefined,
  focusMinutes: initial.focusMinutes,
  breakMinutes: initial.breakMinutes,
  setFocusMinutes: (value) =>
    set((state) => {
      const focusMinutes = clampMinutes(value, state.focusMinutes)
      persistSettings(focusMinutes, state.breakMinutes)
      return { focusMinutes }
    }),
  setBreakMinutes: (value) =>
    set((state) => {
      const breakMinutes = clampMinutes(value, state.breakMinutes)
      persistSettings(state.focusMinutes, breakMinutes)
      return { breakMinutes }
    }),
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
