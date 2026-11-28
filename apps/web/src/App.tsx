import AuthProvider from './auth/AuthProvider'
import AuthRoutes from './auth/AuthRoutes'
import LogoutButton from './components/LogoutButton'
import OrganizationStatusPage from './pages/OrganizationStatusPage'
import type { ApplicationReviewService } from './admin/model'
import { adminReviewService } from './admin/service'
import type { EventServices } from './events/model'
import { organizerEventService } from './events/service'

export default function App({ reviewService = adminReviewService, eventServices = organizerEventService }: { reviewService?: ApplicationReviewService; eventServices?: EventServices } = {}) {
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
