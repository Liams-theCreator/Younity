import AuthProvider from './auth/AuthProvider'
import AuthRoutes from './auth/AuthRoutes'
import LogoutButton from './components/LogoutButton'
import OrganizationStatusPage from './pages/OrganizationStatusPage'

export default function App() {
  return (
    <AuthProvider>
      <LogoutButton />

      <AuthRoutes
        pendingPage={<OrganizationStatusPage />}
      />
    </AuthProvider>
  )
}