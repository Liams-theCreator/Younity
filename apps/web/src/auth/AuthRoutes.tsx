import type { ReactNode } from 'react'
import {
  Link,
  Navigate,
  Route,
  Routes,
} from 'react-router'
import LoginPage from '../pages/LoginPage'
import StudentDashboardPage from '../pages/StudentDashboardPage'
import OrganizerDashboardPage from '../pages/OrganizerDashboardPage'
import StudentRegisterPage from '../pages/StudentRegisterPage'
import OrganizerRegisterPage from '../pages/OrganizerRegisterPage'
import OrganizationStatusPage from '../pages/OrganizationStatusPage'
import ProtectedRoute from './ProtectedRoute'

type AuthRoutesProps = {
  pendingPage: ReactNode
}

export default function AuthRoutes({
  pendingPage,
}: AuthRoutesProps) {
  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to="/login" replace />}
      />

      <Route
        path="/login"
        element={<LoginPage />}
      />

      <Route
        path="/register"
        element={<Navigate to="/login" replace />}
      />

      <Route
        path="/register/student"
        element={
          <StudentRegisterPage signInPath="/login" />
        }
      />

      <Route
        path="/register/organizer"
        element={
          <OrganizerRegisterPage signInPath="/login" />
        }
      />

      <Route
        path="/student/dashboard"
        element={
          <ProtectedRoute
            destination="/student/dashboard"
            renderRedirect={(to) => (
              <Navigate to={to} replace />
            )}
          >
            <StudentDashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/organizer/dashboard"
        element={
          <ProtectedRoute
            destination="/organizer/dashboard"
            renderRedirect={(to) => (
              <Navigate to={to} replace />
            )}
          >
            <OrganizerDashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/organizer/pending"
        element={
          <ProtectedRoute
            destination="/organizer/pending"
            renderRedirect={(to) => (
              <Navigate to={to} replace />
            )}
          >
            {pendingPage}
          </ProtectedRoute>
        }
      />

      <Route
        path="/organizer/status"
        element={
          <ProtectedRoute
            destination="/organizer/status"
            renderRedirect={(to) => (
              <Navigate to={to} replace />
            )}
          >
            <OrganizationStatusPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="*"
        element={
          <main>
            <h1>Page not found</h1>
            <Link to="/login">
              Go to sign in
            </Link>
          </main>
        }
      />
    </Routes>
  )
}