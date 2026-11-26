import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { EventUiError, type EventServices } from './model'
import { useEventResource } from './useEventResource'
import { EventIcon } from './EventUi'
import styles from './simple-events.module.css'

const statuses = ['CONFIRMED', 'CANCELLED'] as const
function dateText(value: string | null | undefined) {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-GB') : '—'
}
export default function OrganizerBookingsPage({ service }: { service: EventServices }) {
  const { requestProtected } = useAuth()
  const [status, setStatus] = useState<'CONFIRMED' | 'CANCELLED'>('CONFIRMED')
  const [page, setPage] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const title = useRef<HTMLHeadingElement>(null)
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!service.bookings) throw new EventUiError('unavailable')
      return service.bookings({ status, page }, { request: requestProtected, signal })
    },
    [service, status, page, requestProtected],
  )
  const resource = useEventResource(load)
  useEffect(() => {
    title.current?.focus()
  }, [])
  const matchingStatus = resource.data?.items.filter((item) => item.status === status)
  const term = query.trim().toLocaleLowerCase()
  const items =
    matchingStatus?.filter((item) =>
      [item.eventTitle, item.participantName, item.email, item.ticketCode ?? ''].some((text) =>
        text.toLocaleLowerCase().includes(term),
      ),
    ) ?? []
  function changeStatus(value: typeof status) {
    setStatus(value)
    setPage(null)
    setQuery('')
  }
  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = 1 - index
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = 1
    else return
    event.preventDefault()
    changeStatus(statuses[next])
    tabs.current[next]?.focus()
  }
  return (
    <div className={styles.workspace}>
    <main className={styles.page}>
      <header className={styles.headingRow}>
        <div>
          <h1 ref={title} tabIndex={-1}>
            Bookings
          </h1>
          <p className={styles.introduction}>
            The people behind every gathering. Keep track of who’s coming.
          </p>
        </div>
      </header>
      <section className={styles.card} aria-label="Event bookings">
        <div className={styles.toolbar}>
          <h2>Guest list</h2>
          <button type="button" disabled={resource.loading} onClick={resource.reload}>
            <EventIcon name="refresh" />
            Refresh bookings
          </button>
        </div>
        <div role="tablist" aria-label="Booking status" className={styles.tabs}>
          {statuses.map((value, index) => (
            <button
              key={value}
              ref={(element) => {
                tabs.current[index] = element
              }}
              type="button"
              role="tab"
              id={`bookings-${value.toLowerCase()}`}
              aria-controls="bookings-panel"
              aria-selected={status === value}
              tabIndex={status === value ? 0 : -1}
              onClick={() => changeStatus(value)}
              onKeyDown={(event) => moveTab(event, index)}
            >
              {value === 'CONFIRMED' ? 'Confirmed' : 'Cancelled'}
              {status === value && matchingStatus && (
                <span
                  title="Bookings on this page"
                  aria-label={`${matchingStatus.length} on this page`}
                >
                  {' '}
                  ({matchingStatus.length})
                </span>
              )}
            </button>
          ))}
        </div>
        <section
          id="bookings-panel"
          role="tabpanel"
          aria-labelledby={`bookings-${status.toLowerCase()}`}
          aria-busy={resource.loading}
          tabIndex={0}
        >
          <label className={styles.search}>
            <span className={styles.srOnly}>Search this page</span>
            <EventIcon name="search" />
            <input
              type="search"
              placeholder="Search name, email, event or ticket…"
              value={query}
              disabled={!resource.data}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {resource.loading && (
            <div className={styles.loading} role="status">
              <p>Loading bookings…</p>
              <div aria-hidden="true" />
              <div aria-hidden="true" />
              <div aria-hidden="true" />
            </div>
          )}
          {resource.error && (
            <div className={styles.errorNotice}>
              <EventIcon name={resource.error.kind === 'forbidden' ? 'lock' : 'cloud_off'} />
              <h2>
                {resource.error.kind === 'forbidden' ? 'Access restricted' : 'Bookings unavailable'}
              </h2>
              <p role="alert">{resource.error.message}</p>
              {resource.error.kind !== 'forbidden' && resource.error.kind !== 'not-found' && (
                <button type="button" onClick={resource.reload}>
                  Retry
                </button>
              )}
            </div>
          )}
          {resource.data && (
            <>
              {items.length === 0 ? (
                <div className={styles.empty}>
                  <EventIcon name={term ? 'search_off' : 'confirmation_number'} />
                  <h2>{term ? 'No matching bookings' : `No ${status.toLowerCase()} bookings.`}</h2>
                  <p>
                    {term
                      ? 'Try a different name, email, event or ticket.'
                      : status === 'CONFIRMED'
                        ? 'Confirmed attendees will appear here when bookings arrive.'
                        : 'Cancelled bookings will appear here with any available cancellation details.'}
                  </p>
                  {term && (
                    <button type="button" onClick={() => setQuery('')}>
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className={styles.tableScroll}
                  role="region"
                  aria-label="Booking table"
                  tabIndex={0}
                >
                  <table className={styles.table}>
                    <caption className={styles.srOnly}>
                      {status === 'CONFIRMED' ? 'Confirmed' : 'Cancelled'} event bookings
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Attendee</th>
                        <th scope="col">Email</th>
                        <th scope="col">Event</th>
                        <th scope="col">Ticket</th>
                        <th scope="col">Booked</th>
                        {status === 'CANCELLED' && <th scope="col">Cancelled</th>}
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id}>
                          <th scope="row">
                            <span className={styles.attendee}>
                              <span className={styles.attendeeAvatar} aria-hidden="true">
                                {item.participantName.trim().slice(0, 1).toLocaleUpperCase() || '?'}
                              </span>
                              {item.participantName}
                            </span>
                          </th>
                          <td data-label="Email">{item.email}</td>
                          <td data-label="Event">{item.eventTitle}</td>
                          <td data-label="Ticket">
                            <code>{item.ticketCode || '—'}</code>
                          </td>
                          <td data-label="Booked">
                            {Number.isFinite(Date.parse(item.registeredAt)) ? (
                              <time dateTime={item.registeredAt}>
                                {dateText(item.registeredAt)}
                              </time>
                            ) : (
                              'Booking time unavailable'
                            )}
                          </td>
                          {status === 'CANCELLED' && (
                            <td data-label="Cancelled">
                              {item.cancelledAt && Number.isFinite(Date.parse(item.cancelledAt)) ? (
                                <time dateTime={item.cancelledAt}>
                                  {dateText(item.cancelledAt)}
                                </time>
                              ) : (
                                '—'
                              )}
                              {item.cancellationReason && (
                                <p className={styles.cancellationReason}>
                                  {item.cancellationReason}
                                </p>
                              )}
                            </td>
                          )}
                          <td data-label="Status">
                            <span className={styles.bookingBadge} data-status={item.status}>
                              {item.status === 'CONFIRMED' ? 'Confirmed' : 'Cancelled'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <nav className={styles.pagination} aria-label="Booking pages">
                <span>{items.length} shown · Search and count apply to this page</span>
                <div>
                  <button
                    type="button"
                    disabled={resource.data.previousPage === null}
                    onClick={() => {
                      setPage(resource.data!.previousPage)
                      title.current?.focus()
                    }}
                  >
                    Previous page
                  </button>
                  <span>{resource.data.label}</span>
                  <button
                    type="button"
                    disabled={resource.data.nextPage === null}
                    onClick={() => {
                      setPage(resource.data!.nextPage)
                      title.current?.focus()
                    }}
                  >
                    Next page
                  </button>
                </div>
              </nav>
            </>
          )}
        </section>
      </section>
    </main>
    </div>
  )
}
