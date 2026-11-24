import AuthProvider from './auth/AuthProvider'
import AuthRoutes from './auth/AuthRoutes'
import LogoutButton from './components/LogoutButton'
import OrganizationStatusPage from './pages/OrganizationStatusPage'
import type { ApplicationReviewService } from './admin/model'
import { adminReviewService } from './admin/service'
import { unavailableEventServices, type EventServices } from './events/model'

export default function App({ reviewService = adminReviewService, eventServices = unavailableEventServices }: { reviewService?: ApplicationReviewService; eventServices?: EventServices } = {}) {
  return (
    <AuthProvider>
      <LogoutButton />

      <AuthRoutes
        reviewService={reviewService}
        eventServices={eventServices}
        pendingPage={<OrganizationStatusPage />}
      />
    </AuthProvider>
  )
}
