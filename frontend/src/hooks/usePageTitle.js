import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const baseTitle = 'EduPilot'
const titleMap = {
  '/': baseTitle,
  '/login': 'Login',
  '/signup': 'Sign Up',
  '/app/dashboard': 'Dashboard',
  '/app/plan': 'Plan',
  '/app/tasks': 'Tasks',
  '/app/assistant': 'Assistant',
  '/app/progress': 'Progress',
  '/app/rewards': 'Rewards',
  '/app/settings': 'Settings',
  '/app/integrations/canvas': 'Canvas',
  '/app/strict': 'Strict Mode',
}

function buildTitle(pathname) {
  const page = titleMap[pathname]
  if (!page || page === baseTitle) {
    return baseTitle
  }
  return `${page} · ${baseTitle}`
}

export function usePageTitle() {
  const location = useLocation()

  useEffect(() => {
    document.title = buildTitle(location.pathname)
  }, [location.pathname])
}
