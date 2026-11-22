import { useLocation, useMatch } from 'react-router'
import { useAuth } from '../auth/useAuth'
import AdminHeader from '../admin/AdminHeader'
import DiscoveryAccountNav from './DiscoveryAccountNav'

export default function LogoutButton() {
  const { status, destination, signOut } = useAuth()
  const { pathname } = useLocation()
  const eventsRoute = useMatch('/events/*')
  const adminRoute = useMatch('/admin/applications/*')

  if (status !== 'authenticated') return null
  if (adminRoute && destination === '/admin/applications') return <AdminHeader />
  if (!eventsRoute) return null

  return <DiscoveryAccountNav key={pathname} destination={destination} signOut={signOut} />
}
