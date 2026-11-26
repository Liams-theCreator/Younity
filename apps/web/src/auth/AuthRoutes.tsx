import type { ReactNode } from 'react'
import {
  Link,
  Navigate,
  Route,
  Routes,
} from 'react-router'
import LoginPage from '../pages/LoginPage'
import StudentDashboardPage from '../pages/StudentDashboardPage'
import StudentPreferencesPage from '../pages/StudentPreferencesPage'
import OrganizerDashboardPage from '../pages/OrganizerDashboardPage'
import StudentRegisterPage from '../pages/StudentRegisterPage'
import OrganizerRegisterPage from '../pages/OrganizerRegisterPage'
import OrganizationStatusPage from '../pages/OrganizationStatusPage'
import ProtectedRoute from './ProtectedRoute'
import EmailVerificationPage from '../pages/EmailVerificationPage'
import OrganizerDraftPage from '../pages/OrganizerDraftPage'
import OrganizerApprovalPage, {
  EventsPortalPage,
} from '../pages/OrganizerApprovalPage'
import { useAuth } from './useAuth'
import AdminApplicationsPage from '../admin/AdminApplicationsPage'
import AdminApplicationDetailPage from '../admin/AdminApplicationDetailPage'
import type { ApplicationReviewService } from '../admin/model'
import { unavailableEventServices, type EventServices } from '../events/model'
import EventCreationPage from '../events/EventCreationPage'
import OrganizerEventsPage from '../events/OrganizerEventsPage'
import OrganizerBookingsPage from '../events/OrganizerBookingsPage'

type AuthRoutesProps = {
  pendingPage: ReactNode
  reviewService?: ApplicationReviewService
  eventServices?: EventServices
}

export default function AuthRoutes({
  pendingPage,
  reviewService,
  eventServices = unavailableEventServices,
}: AuthRoutesProps) {
  const { destination } = useAuth()

  return (
    <Routes>
      <Route path="/organizer/events" element={<ProtectedRoute destination="/organizer/dashboard" renderRedirect={to => <Navigate to={to} replace />}><OrganizerEventsPage service={eventServices} /></ProtectedRoute>} />
      <Route path="/organizer/events/new" element={<ProtectedRoute destination="/organizer/dashboard" renderRedirect={to => <Navigate to={to} replace />}><EventCreationPage service={eventServices} /></ProtectedRoute>} />
      <Route path="/organizer/events/:eventId/edit" element={<ProtectedRoute destination="/organizer/dashboard" renderRedirect={to => <Navigate to={to} replace />}><EventCreationPage service={eventServices} /></ProtectedRoute>} />
      <Route path="/organizer/bookings" element={<ProtectedRoute destination="/organizer/dashboard" renderRedirect={to => <Navigate to={to} replace />}><OrganizerBookingsPage service={eventServices} /></ProtectedRoute>} />
      <Route
        path="/admin/applications"
        element={
          <ProtectedRoute
            destination="/admin/applications"
            renderRedirect={(to) => <Navigate to={to} replace />}
          >
            <AdminApplicationsPage service={reviewService} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/applications/:applicationId"
        element={
          <ProtectedRoute
            destination="/admin/applications"
            renderRedirect={(to) => <Navigate to={to} replace />}
          >
            <AdminApplicationDetailPage service={reviewService} />
          </ProtectedRoute>
        }
      />

      <Route path="/events" element={<EventsPortalPage />} />
      <Route
        path="/organizer/approved"
        element={<OrganizerApprovalPage />}
      />
      <Route
        path="/organizer/application"
        element={<OrganizerDraftPage />}
      />
      <Route
        path="/verify-email"
        element={<EmailVerificationPage />}
      />
      <Route
        path="/"
        element={<Navigate to="/login" replace />}
      />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/register"
        element={<Navigate to="/login" replace />}
      />
      <Route
        path="/register/student"
        element={<StudentRegisterPage signInPath="/login" />}
      />
      <Route
        path="/register/organizer"
        element={<OrganizerRegisterPage signInPath="/login" />}
      />

      <Route
        path="/student/preferences"
        element={
          <ProtectedRoute
            destination={
              destination === '/student/preferences'
                ? '/student/preferences'
                : '/student/dashboard'
            }
            renderRedirect={(to) => <Navigate to={to} replace />}
          >
            <StudentPreferencesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student/dashboard"
        element={
          <ProtectedRoute
            destination="/student/dashboard"
            renderRedirect={(to) => <Navigate to={to} replace />}
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
            renderRedirect={(to) => <Navigate to={to} replace />}
          >
            <OrganizerDashboardPage service={eventServices} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/organizer/pending"
        element={
          <ProtectedRoute
            destination="/organizer/pending"
            renderRedirect={(to) => <Navigate to={to} replace />}
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
            renderRedirect={(to) => <Navigate to={to} replace />}
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
            <Link to="/login">Go to sign in</Link>
          </main>
        }
      />
    </Routes>
  )
}