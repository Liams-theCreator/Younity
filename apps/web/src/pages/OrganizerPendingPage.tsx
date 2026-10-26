import { Link } from 'react-router'
import OrganizerPendingStatus from '../components/OrganizerPendingStatus'
import { RegistrationLayout } from '../components/RegistrationForm'

export default function OrganizerPendingPage() {
  // AUTH-04 development preview; real application data is not connected yet.
  if (import.meta.env.DEV) {
    return <OrganizerPendingStatus />
  }

  return (
    <RegistrationLayout
      variant="pending"
      title="Application status unavailable"
      introduction="Application status is not connected yet. No submission can be confirmed here."
    >
      <Link
        className="secondary"
        to="/register/organizer"
      >
        Back to organizer registration
      </Link>
    </RegistrationLayout>
  )
}
