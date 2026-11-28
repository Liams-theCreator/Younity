import { useCallback } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { getEvent, getMyBooking } from './discovery.service'
import { eventDate, formatLabels } from './discovery.model'
import { useResource } from './useResource'
import styles from './discovery.module.css'

function BookingStatus({ eventId }: { eventId: string }) {
  const { requestProtected, user } = useAuth()
  const load = useCallback((signal: AbortSignal) => getMyBooking(eventId, signal, requestProtected), [eventId, requestProtected])
  const result = useResource(`${user?.id}:${eventId}`, load)
  return <section className={styles.card} aria-label="Your booking">
    <h2>Your booking</h2>
    {result.state === 'loading' && <p role="status">Checking your booking…</p>}
    {result.state === 'error' && <div role="alert"><p>{result.error.message}</p><button type="button" onClick={result.retry}>Retry booking status</button></div>}
    {result.state === 'ready' && <p role="status">{result.data === null ? 'You have no booking for this event.' : result.data.status === 'CONFIRMED' ? 'Your place is confirmed.' : 'Your booking is cancelled.'}</p>}
  </section>
}

export default function EventDetailPage() {
  const { eventId = '' } = useParams()
  const auth = useAuth()
  const load = useCallback((signal: AbortSignal) => getEvent(eventId, signal), [eventId])
  const result = useResource(eventId, load)
  const eligible = auth.status === 'authenticated' && auth.user.role === 'STUDENT' &&
    auth.user.userStatus === 'ACTIVE' && auth.user.onboarding?.complete === true

  return <main className={styles.page}>
    <Link to="/events">Back to events</Link>
    {result.state === 'loading' && <p role="status">Loading event…</p>}
    {result.state === 'error' && <section role="alert"><h1>{result.error.kind === 'not-found' ? 'Event unavailable' : 'Could not load event'}</h1><p>{result.error.message}</p>{result.error.kind !== 'not-found' && <button type="button" onClick={result.retry}>Retry event</button>}</section>}
    {result.state === 'ready' && <>
      <article className={styles.card}>
        <p className={styles.tag}>{formatLabels[result.data.format]}</p>
        <h1>{result.data.title}</h1>
        <p>Organized by {result.data.organization.name}</p>
        <p className={styles.description}>{result.data.description}</p>
        <dl className={styles.facts}>
          <div><dt>Starts</dt><dd><time dateTime={result.data.startDate}>{eventDate(result.data.startDate)}</time></dd></div>
          <div><dt>Ends</dt><dd><time dateTime={result.data.endDate}>{eventDate(result.data.endDate)}</time></dd></div>
          <div><dt>Location</dt><dd>{result.data.location ?? (result.data.format === 'ONLINE' ? 'Online event' : 'Location to be announced')}</dd></div>
          <div><dt>Categories</dt><dd>{result.data.categories.map(c => c.name).join(' · ')}</dd></div>
          <div><dt>Registration</dt><dd>{result.data.registrationMode === 'AUTOMATIC' ? 'Through Younity' : 'External registration'}</dd></div>
          {result.data.registrationDeadline && <div><dt>Registration deadline</dt><dd>{eventDate(result.data.registrationDeadline)}</dd></div>}
          <div><dt>Availability</dt><dd>{result.data.availability === 'FULL' ? 'Full' : result.data.availability === 'CLOSED' ? 'Registration closed' : 'Registration open'}</dd></div>
        </dl>
      </article>
      {result.data.registrationMode === 'EXTERNAL' ? <section className={styles.card}>
        <h2>Register with the organizer</h2><p>Confirmation and joining instructions are handled by the external organizer. Opening this link does not reserve a place through Younity.</p>
        <a href={result.data.externalRegistrationUrl!} target="_blank" rel="noopener noreferrer">Open external registration (new tab)</a>
      </section> : <>
        {auth.status === 'loading' && <p role="status">Checking your account…</p>}
        {result.data.availability !== 'CLOSED' && (auth.status === 'anonymous' || auth.status === 'error') && <section className={styles.card}><p>Sign in with a student account to register through Younity.</p><Link to="/login">Sign in</Link>{' · '}<Link to="/register/student">Create student account</Link></section>}
        {result.data.availability !== 'CLOSED' && auth.status === 'authenticated' && !eligible && <section className={styles.card}>{auth.user.role !== 'STUDENT'
          ? <p>Only student accounts can reserve places through Younity.</p>
          : <><p>Complete student onboarding before registering.</p><Link to={auth.destination ?? '/login'}>Continue onboarding</Link></>}</section>}
        {eligible && <BookingStatus key={`${auth.user?.id}:${eventId}`} eventId={eventId} />}
      </>}
    </>}
  </main>
}
