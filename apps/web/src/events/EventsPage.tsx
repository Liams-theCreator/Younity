import { useCallback, useId, useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import ReferenceIcon from '../components/ReferenceIcon'
import scrollStyles from '../components/ScrollHeader.module.css'
import EventCard from './EventCard'
import EventFilters from './EventFilters'
import EventGridSkeleton from './EventGridSkeleton'
import { discoveryQuery, getCategories, getEvents } from './service'
import { useResource } from './useResource'
import styles from './events.module.css'

export default function EventsPage({ embedded = false }: { embedded?: boolean }) {
  const auth = useAuth()
  const [params, setParams] = useSearchParams()
  const filtersId = useId()
  const resultsId = useId()
  const resultsHeading = useRef<HTMLHeadingElement>(null)
  const requestQuery = discoveryQuery(params).toString()
  const identity = `${auth.status}:${auth.user?.id ?? ''}`
  const load = useCallback((signal: AbortSignal) => getEvents(requestQuery, signal), [requestQuery])
  const result = useResource(`${identity}:${requestQuery}`, load)
  const data = result.state === 'ready' ? result.data : null
  const catalog = useResource('event-categories', getCategories)
  const categoryOptions = catalog.state === 'ready' ? catalog.data : data?.categories ?? []
  const signedIn = auth.status === 'authenticated'
  const hasFloatingHeader = !embedded && signedIn && auth.destination !== '/admin/applications'
  const guest = auth.status === 'anonymous' || auth.status === 'error'
  const organizerDestination = signedIn && auth.user.role === 'ORGANIZER' ? auth.destination : null
  const organizerLink = guest ? '/register/organizer' : organizerDestination
  const Content = embedded ? 'section' : 'main'
  const Heading = embedded ? 'h2' : 'h1'

  const filters = new URLSearchParams(requestQuery)
  filters.delete('page')
  filters.delete('pageSize')
  const appliedSearch = filters.toString()

  function applyFilters(next: URLSearchParams) {
    setParams(next)
    resultsHeading.current?.focus({ preventScroll: true })
  }

  function goToPage(page: number) {
    const next = new URLSearchParams(appliedSearch)
    next.set('page', String(page))
    setParams(next)
    resultsHeading.current?.focus()
  }

  return (
    <div className={hasFloatingHeader ? `${styles.portal} ${scrollStyles.portalBehindPill}` : styles.portal}>
      {!embedded && !signedIn && (
        <header className={`${styles.portalHeader} ${scrollStyles.header}`}>
          <div className={styles.container}>
            <Link to="/events" className={styles.wordmark}>
              <ReferenceIcon name="school" /> Younity
            </Link>
            {guest && (
              <nav className={styles.headerLinks} aria-label="Account">
                <Link to="/login" className={styles.signIn}>Sign in</Link>
                <Link to="/register/student" className={styles.primaryButton}>Join as a student</Link>
              </nav>
            )}
          </div>
        </header>
      )}

      <Content className={embedded ? styles.embedded : undefined} aria-label="Event discovery">
        <header className={styles.hero}>
          <div className={styles.container}>
            <span className={styles.heroLabel}>Campus opportunities in Morocco</span>
            <Heading className={styles.heroTitle}>
              Discover <span>Hackathons</span>, <em>Workshops</em> &amp; Academic Events
            </Heading>
            <p>Explore campus events, inter-university competitions, and masterclasses.</p>
          </div>
        </header>

        <div className={`${styles.container} ${styles.filters}`}>
          <EventFilters
            key={appliedSearch}
            id={filtersId}
            search={appliedSearch}
            categories={categoryOptions}
            onApply={applyFilters}
          />
          {catalog.state === 'error' && !data && (
            <div className={styles.categoryNotice}>
              <p>Could not load categories.</p>
              <button type="button" className={styles.clearFilters} onClick={catalog.retry}>Retry categories</button>
            </div>
          )}
        </div>

        <section className={`${styles.container} ${styles.results}`} aria-labelledby={resultsId}>
          <div className={styles.resultsHeader}>
            <h2 id={resultsId} ref={resultsHeading} tabIndex={-1}>Campus events</h2>
            <p role="status">
              {result.state === 'loading' && <span className="sr-only">Loading events…</span>}
              {data && `${data.total} ${data.total === 1 ? 'event' : 'events'} found`}
            </p>
          </div>

          {result.state === 'loading' && <EventGridSkeleton />}

          {result.state === 'error' && (
            <div className={styles.resultState}>
              <p role="alert">Could not load events. Please try again.</p>
              <button type="button" className={styles.primaryButton} onClick={result.retry}>Retry events</button>
            </div>
          )}

          {data && (data.items.length === 0 ? (
            <div className={styles.resultState}>
              <ReferenceIcon name="event_busy" />
              <h3>No events found</h3>
              <p>Try different filters or clear them to explore more campus events.</p>
              <button type="reset" form={filtersId} className={styles.primaryButton}>Show all events</button>
            </div>
          ) : (
            <ul className={styles.eventGrid}>
              {data.items.map(event => <li key={event.id}><EventCard event={event} /></li>)}
            </ul>
          ))}

          {data && (data.page > 1 || data.total > data.pageSize) && (
            <nav aria-label="Event pages" className={styles.pagination}>
              <button type="button" disabled={data.page <= 1} onClick={() => goToPage(data.page - 1)}>Previous</button>
              <span>Page {data.page}</span>
              <button type="button" disabled={data.page * data.pageSize >= data.total} onClick={() => goToPage(data.page + 1)}>Next</button>
            </nav>
          )}
        </section>

        {!embedded && organizerLink && (
          <div className={styles.container}>
            <section className={styles.organizerCallout} aria-label="For organizers">
              <div>
                <p className={styles.organizerLabel}><ReferenceIcon name="school" /> For universities and organizers</p>
                <h2>Hosting an <span>inter-school challenge</span> or university hackathon?</h2>
                <p>Use an organizer account to publish events and help students discover them.</p>
              </div>
              <Link to={organizerLink} className={styles.primaryButton}>
                {guest ? 'Register as an organizer' : 'Go to organizer account'}
                <ReferenceIcon name="arrow_forward" />
              </Link>
            </section>
          </div>
        )}
      </Content>

      {!embedded && (
        <footer className={styles.portalFooter}>
          <div className={styles.container}>
            <div>
              <p className={styles.wordmark}>Younity <span>Morocco</span></p>
              <p>Campus opportunities across Morocco.</p>
            </div>
            <nav aria-label="Event portal footer" className={styles.footerLinks}>
              <a href={`#${resultsId}`}>Browse events</a>
              {organizerLink && <Link to={organizerLink}>For organizers</Link>}
            </nav>
          </div>
        </footer>
      )}
    </div>
  )
}
