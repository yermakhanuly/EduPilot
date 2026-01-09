import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { authApi } from './api/client'
import { useAuthStore } from './store/authStore'
import { useThemeStore } from './store/themeStore'

function App() {
  useThemeStore((state) => state.theme)
  const setUser = useAuthStore((state) => state.setUser)

  useEffect(() => {
    let active = true
    authApi
      .me()
      .then((data) => {
        if (active) {
          setUser(data.user)
        }
      })
      .catch(() => {
        if (active) {
          setUser(undefined)
        }
      })

    return () => {
      active = false
    }
  }, [setUser])
  return <RouterProvider router={router} />
}

export default App
