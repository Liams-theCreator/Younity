import { useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { EventIcon, EventState } from '../events/EventUi'
import { EventUiError, formatLabels, type EventServices } from '../events/model'
import { useEventResource } from '../events/useEventResource'
import { safeImageUrl } from '../events/validation'
import styles from './OrganizerDashboardPage.module.css'

function dateText(value: string) {
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}
export default function OrganizerDashboardPage({ service }: { service: EventServices }) {
  const { user, requestProtected } = useAuth()
  const heading = useRef<HTMLHeadingElement>(null)
  const load = useCallback(async (signal: AbortSignal) => {
    if (!service.dashboard) throw new EventUiError('unavailable')
    return service.dashboard({ request: requestProtected, signal })
  }, [service, requestProtected])
  const resource = useEventResource(load)
  const data = resource.data
  useEffect(() => { heading.current?.focus() }, [])
  const metrics = [
    { label: 'Active events', value: data?.metrics.activeEvents, icon: 'event_available', detail: 'Upcoming and ongoing events' },
    { label: 'Confirmed bookings', value: data?.metrics.confirmedBookings, icon: 'how_to_reg', detail: 'Across your organization’s events' },
    { label: 'Capacity utilization', value: data?.metrics.capacityUtilization, icon: 'pie_chart', detail: 'Active events with a set capacity', percent: true },
    { label: 'Event drafts', value: data?.metrics.draftCount, icon: 'edit_note', detail: 'Saved and ready to continue' },
  ]
  return (
    <div className={styles.workspace}>
      <main className={styles.page}>
        <header className={styles.welcome}>
          <div>
            <span className={styles.verified}><EventIcon name="verified" />{data?.organizationName || 'Approved organization'}</span>
            <h1 ref={heading} tabIndex={-1}>Organizer dashboard</h1>
            <p>Welcome, <strong>{data?.organizerName || user?.email}</strong>. Plan your next student event and follow your community’s activity.</p>
          </div>
          <div className={styles.actions} aria-label="Dashboard actions">
            <Link className={styles.primary} to="/organizer/events/new"><EventIcon name="add" />Create event</Link>
            <Link to="/organizer/events"><EventIcon name="calendar_today" />My events</Link>
            <Link to="/organizer/bookings"><EventIcon name="group" />Bookings</Link>
          </div>
        </header>
        <section className={styles.metrics} aria-label="Organization overview" aria-busy={resource.loading}>
          {metrics.map(metric => (
            <article className={styles.metric} key={metric.label}>
              <div><h2>{metric.label}</h2><span className={styles.metricIcon}><EventIcon name={metric.icon} /></span></div>
              <strong className={styles.value}>{resource.loading ? '…' : metric.value == null ? '—' : `${metric.value.toLocaleString('en-GB')}${metric.percent ? '%' : ''}`}</strong>
              {metric.percent && metric.value != null && <div className={styles.meter} role="meter" aria-label="Capacity utilization" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, metric.value)} aria-valuetext={`${metric.value}%`}><i style={{ width: `${Math.min(100, metric.value)}%` }} /></div>}
              <p>{metric.detail}</p>
            </article>
          ))}
        </section>
        {(resource.loading || resource.error) && <section className={styles.panel}><EventState loading={resource.loading} error={resource.error} retry={resource.reload} unavailableTitle="Dashboard unavailable" /></section>}
        {data && (
          <div className={styles.columns}>
            <div className={styles.mainColumn}>
              <section className={styles.panel} aria-labelledby="upcoming-events">
                <div className={styles.sectionHeading}><h2 id="upcoming-events"><EventIcon name="calendar_month" />Upcoming events &amp; schedule</h2><Link to="/organizer/events">View events<EventIcon name="arrow_forward" /></Link></div>
                {data.upcomingEvents.length === 0 ? (
                  <div className={styles.empty}><EventIcon name="event_available" /><h3>Your next event starts here</h3><p>Upcoming published events will appear in your schedule.</p><Link to="/organizer/events/new">Create an event<EventIcon name="arrow_forward" /></Link></div>
                ) : (
                  <ul className={styles.eventList}>{data.upcomingEvents.map(event => {
                    const image = safeImageUrl(event.imageUrl || '')
                    return <li className={styles.eventCard} key={event.id}>
                      <div className={styles.eventImage}>{image ? <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.hidden = true }} /> : <EventIcon name="event" />}</div>
                      <div className={styles.eventBody}>
                        <span className={styles.format}>{formatLabels[event.format]}</span><h3>{event.title}</h3>
                        <p><EventIcon name="schedule" /><time dateTime={event.startDate}>{dateText(event.startDate)}</time></p>
                        {event.location && <p><EventIcon name="pin_drop" />{event.location}</p>}
                        <div className={styles.eventFooter}><span><strong>{event.confirmedCount}</strong> confirmed{event.capacity !== null ? ` / ${event.capacity} capacity` : ''}</span><Link to="/organizer/bookings">Bookings<EventIcon name="arrow_forward" /></Link></div>
                      </div>
                    </li>
                  })}</ul>
                )}
              </section>
              <section className={styles.panel} aria-labelledby="event-drafts">
                <div className={styles.sectionHeading}><h2 id="event-drafts"><EventIcon name="pending_actions" />Continue your drafts</h2><Link to="/organizer/events">All drafts<EventIcon name="arrow_forward" /></Link></div>
                {data.drafts.length === 0 ? <div className={styles.compactEmpty}><EventIcon name="edit_note" /><p>Your saved drafts will appear here.</p></div> : (
                  <ul className={styles.drafts}>{data.drafts.map(draft => <li key={draft.id}>
                    <span className={styles.draftIcon}><EventIcon name="edit_note" /></span><div><span className={styles.draftBadge}>Draft</span><h3>{draft.title.trim() || 'Untitled event'}</h3><p>Last saved <time dateTime={draft.updatedAt}>{dateText(draft.updatedAt)}</time></p></div>
                    <Link to={`/organizer/events/${encodeURIComponent(draft.id)}/edit`} aria-label={`Continue editing ${draft.title.trim() || 'Untitled event'}`}>Continue<EventIcon name="chevron_right" /></Link>
                  </li>)}</ul>
                )}
              </section>
            </div>
            <div className={styles.sideColumn}>
              <section className={styles.panel} aria-labelledby="recent-bookings">
                <div className={styles.sectionHeading}><h2 id="recent-bookings"><EventIcon name="notifications_active" />Recent booking activity</h2><button type="button" onClick={resource.reload} aria-label="Refresh dashboard"><EventIcon name="refresh" /></button></div>
                {data.recentBookings.length === 0 ? <div className={styles.compactEmpty}><EventIcon name="group" /><p>New bookings and cancellations will appear here.</p></div> : (
                  <ul className={styles.activity}>{data.recentBookings.map(booking => <li key={booking.id}>
                    <span className={styles.initial} aria-hidden="true">{booking.participantName.slice(0, 1).toLocaleUpperCase()}</span><div><strong>{booking.participantName}</strong><span className={styles.bookingStatus} data-status={booking.status}>{booking.status === 'CONFIRMED' ? 'Confirmed' : 'Cancelled'}</span><p>{booking.eventTitle}</p><time dateTime={booking.updatedAt}>{dateText(booking.updatedAt)}</time></div>
                  </li>)}</ul>
                )}
                <Link className={styles.panelLink} to="/organizer/bookings">View booking directory<EventIcon name="chevron_right" /></Link>
              </section>
              <section className={styles.panel} aria-labelledby="workspace-tools">
                <div className={styles.sectionHeading}><h2 id="workspace-tools"><EventIcon name="auto_stories" />Workspace tools</h2></div>
                <div className={styles.tools}>
                  <Link to="/organizer/events/new"><EventIcon name="add_circle" /><span><strong>Create an event</strong><small>Details, schedule and event picture</small></span><EventIcon name="arrow_forward" /></Link>
                  <Link to="/organizer/events"><EventIcon name="edit_calendar" /><span><strong>Manage your events</strong><small>Find drafts and continue editing</small></span><EventIcon name="arrow_forward" /></Link>
                  <Link to="/organizer/bookings"><EventIcon name="confirmation_number" /><span><strong>Review bookings</strong><small>Confirmed and cancelled attendees</small></span><EventIcon name="arrow_forward" /></Link>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
