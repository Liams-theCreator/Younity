import AuthProvider from './auth/AuthProvider'
import AuthRoutes from './auth/AuthRoutes'
import LogoutButton from './components/LogoutButton'
import OrganizationStatusPage from './pages/OrganizationStatusPage'
import type { ApplicationReviewService } from './admin/model'
import { adminReviewService } from './admin/service'

export default function App({ reviewService = adminReviewService }: { reviewService?: ApplicationReviewService } = {}) {
  return (
    <AuthProvider>
      <LogoutButton />

      <AuthRoutes
        reviewService={reviewService}
        pendingPage={<OrganizationStatusPage />}
      />
    </AuthProvider>
  )
}
