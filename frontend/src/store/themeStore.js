import { create } from 'zustand'

const THEME_KEY = 'edupilot-theme'
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'

const normalizeTheme = (value) => (value === 'light' ? 'light' : 'dark')

const getInitialTheme = () => {
  if (!isBrowser) {
    return 'dark'
  }

  const stored = window.localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches
  return prefersLight ? 'light' : 'dark'
}

const applyTheme = (theme) => {
  if (!isBrowser) return
  const normalized = normalizeTheme(theme)
  document.documentElement.dataset.theme = normalized
  try {
    window.localStorage.setItem(THEME_KEY, normalized)
  } catch {
    // Ignore storage errors (private mode, blocked storage, etc.)
  }
}

const initialTheme = getInitialTheme()
applyTheme(initialTheme)

export const useThemeStore = create((set, get) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    const next = normalizeTheme(theme)
    applyTheme(next)
    set({ theme: next })
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    set({ theme: next })
  },
}))
