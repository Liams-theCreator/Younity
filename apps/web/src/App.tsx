import AuthProvider from './auth/AuthProvider'
import AuthRoutes from './auth/AuthRoutes'
import LogoutButton from './components/LogoutButton'
import OrganizationStatusPage from './pages/OrganizationStatusPage'
import type { ApplicationReviewService } from './admin/model'

export default function App({ reviewService }: { reviewService?: ApplicationReviewService } = {}) {
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
