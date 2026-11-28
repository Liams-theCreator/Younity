import { useLocation, useMatch } from 'react-router'
import { useAuth } from '../auth/useAuth'
import AdminHeader from '../admin/AdminHeader'
import { OrganizerEventHeader } from '../events/EventUi'
import DiscoveryAccountNav from './DiscoveryAccountNav'

export default function LogoutButton() {
  const { status, destination, signOut } = useAuth()
  const { pathname } = useLocation()
  const eventsRoute = useMatch('/events/*')
  const adminRoute = useMatch('/admin/applications/*')
  const organizerEventsRoute = useMatch('/organizer/events/*')

  if (status !== 'authenticated') return null
  if (destination === '/organizer/dashboard' && (
    pathname === '/organizer/dashboard' || organizerEventsRoute || pathname === '/organizer/bookings'
  )) return <OrganizerEventHeader />
  if (adminRoute && destination === '/admin/applications') return <AdminHeader />
  if (!eventsRoute) return null

  return <DiscoveryAccountNav key={pathname} destination={destination} signOut={signOut} />
}
