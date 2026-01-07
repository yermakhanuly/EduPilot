import { createBrowserRouter, createRoutesFromElements, Navigate, Route } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { PublicLayout } from './layouts/PublicLayout'
import { StrictLayout } from './layouts/StrictLayout'
import { CanvasIntegrationPage } from './pages/CanvasIntegrationPage'
import { DashboardPage } from './pages/DashboardPage'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { PlanPage } from './pages/PlanPage'
import { ProgressPage } from './pages/ProgressPage'
import { RewardsPage } from './pages/RewardsPage'
import { AssistantPage } from './pages/AssistantPage'
import { SettingsPage } from './pages/SettingsPage'
import { SignupPage } from './pages/SignupPage'
import { StrictModePage } from './pages/StrictModePage'
import { TasksPage } from './pages/TasksPage'

export const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="plan" element={<PlanPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="rewards" element={<RewardsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="integrations/canvas" element={<CanvasIntegrationPage />} />
      </Route>

      <Route path="/app/strict" element={<StrictLayout />}>
        <Route index element={<StrictModePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </>,
  ),
)
