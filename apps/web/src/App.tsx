import AuthProvider from './auth/AuthProvider'
import AuthRoutes from './auth/AuthRoutes'
import LogoutButton from './components/LogoutButton'
import OrganizerPendingPage from './pages/OrganizerPendingPage'

export default function App() {
  return (
    <AuthProvider>
      <LogoutButton />

      <AuthRoutes
        pendingPage={<OrganizerPendingPage />}
      />
    </AuthProvider>
  )
}