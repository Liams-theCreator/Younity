import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { EventUiError, formatLabels, type DraftSummary, type EventServices } from './model'
import { safeImageUrl } from './validation'
import { useEventResource } from './useEventResource'
import { EventIcon } from './EventUi'
import styles from './events.module.css'

function dateValue(value: string | null) {
  const timestamp = value ? Date.parse(value) : NaN
  return Number.isFinite(timestamp) ? timestamp : null
}

function updateLabel(timestamp: number, now: number) {
  const seconds = Math.floor((now - timestamp) / 1000)
  if (seconds < 0)
    return new Date(timestamp).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  if (seconds < 60) return 'just now'
  const relative = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' })
  if (seconds < 3600) return relative.format(-Math.floor(seconds / 60), 'minute')
  if (seconds < 86400) return relative.format(-Math.floor(seconds / 3600), 'hour')
  return relative.format(-Math.floor(seconds / 86400), 'day')
}

function DraftsLoading() {
  return (
    <div role="status">
      <span className={styles.srOnly}>Loading…</span>
      <div className={styles.draftSkeletons} aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <div className={styles.draftSkeleton} key={row}>
            <div className={styles.skeletonArtwork} />
            <div className={styles.skeletonText}>
              <span />
              <span />
              <span />
            </div>
            <div className={styles.skeletonAction} />
          </div>
        ))}
      </div>
    </div>
  )
}

function DraftsError({ error, retry }: { error: EventUiError; retry: () => void }) {
  const restricted = error.kind === 'forbidden'
  const missing = error.kind === 'not-found'
  return (
    <div className={`${styles.card} ${styles.draftError}`}>
      <div className={styles.draftErrorMessage} data-restricted={restricted}>
        <EventIcon name={restricted ? 'lock' : 'cloud_off'} />
        <div>
          <h3>
            {restricted
              ? 'Access restricted'
              : missing
                ? 'Drafts unavailable'
                : 'Unable to load drafts'}
          </h3>
          <p role="alert">{error.message}</p>
        </div>
      </div>
      {!restricted && !missing && (
        <div className={styles.draftErrorActions}>
          <p>Your saved drafts could not be loaded.</p>
          <button type="button" onClick={retry}>
            <EventIcon name="refresh" />
            Retry connection
          </button>
        </div>
      )}
    </div>
  )
}

function DraftArtwork({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false)
  return url && !failed ? (
    <img
      src={url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className={styles.draftPlaceholder}>
      <EventIcon name="image" />
      <span>{failed ? 'Artwork unavailable' : 'No artwork'}</span>
    </div>
  )
}

function DraftCard({ draft }: { draft: DraftSummary }) {
  const [loadedAt] = useState(() => Date.now())
  const name = draft.title.trim() || 'Untitled event'
  const href = `/organizer/events/${encodeURIComponent(draft.id)}/edit`
  const image = safeImageUrl(draft.imageUrl ?? '')
  const start = dateValue(draft.startDate)
  const updated = dateValue(draft.updatedAt)
  return (
    <li className={styles.draftCard}>
      <div className={styles.draftArtwork}>
        <DraftArtwork key={image} url={image} />
      </div>
      <div className={styles.draftContent}>
        <div className={styles.draftMeta}>
          <span className={styles.draftBadge}>
            <EventIcon name="edit_note" />
            Draft
          </span>
          <span>
            {updated !== null ? (
              <>
                Updated{' '}
                <time
                  dateTime={draft.updatedAt}
                  title={new Date(updated).toLocaleString('en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                >
                  {updateLabel(updated, loadedAt)}
                </time>
              </>
            ) : (
              'Update time unavailable'
            )}
          </span>
        </div>
        <h3>
          <Link to={href}>{name}</Link>
        </h3>
        <div className={styles.draftDetails}>
          <span data-unset={start === null}>
            <EventIcon name={start === null ? 'schedule' : 'calendar_month'} />
            {start !== null ? (
              <>
                Tentative:{' '}
                <time dateTime={draft.startDate!}>
                  {new Date(start).toLocaleString('en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </time>
              </>
            ) : (
              'Date and time not set'
            )}
          </span>
          <span data-unset={!draft.format}>
            <EventIcon name={draft.format === 'ONLINE' ? 'videocam' : 'location_on'} />
            {draft.format ? formatLabels[draft.format] : 'Format not set'}
            {draft.format !== 'ONLINE' && draft.location?.trim()
              ? ` · ${draft.location.trim()}`
              : ''}
          </span>
        </div>
      </div>
      <Link
        className={`${styles.primaryLink} ${styles.continueLink}`}
        to={href}
        aria-label={`Continue editing ${name}`}
      >
        Continue editing
        <EventIcon name="arrow_forward" />
      </Link>
    </li>
  )
}

export default function OrganizerEventsPage({ service }: { service: EventServices }) {
  const { requestProtected } = useAuth()
  const title = useRef<HTMLHeadingElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('modified')
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!service.drafts) throw new EventUiError('unavailable')
      return service.drafts({ request: requestProtected, signal })
    },
    [service, requestProtected],
  )
  const resource = useEventResource(load)
  useEffect(() => {
    title.current?.focus()
  }, [])
  const term = query.trim().toLocaleLowerCase()
  const drafts = (resource.data ?? [])
    .filter((draft) =>
      [
        draft.title.trim() || 'Untitled event',
        draft.format ? formatLabels[draft.format] : '',
        draft.format !== 'ONLINE' ? draft.location : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
        .includes(term),
    )
    .sort((a, b) => {
      if (sort === 'title')
        return (a.title.trim() || 'Untitled event').localeCompare(
          b.title.trim() || 'Untitled event',
          'en',
          { sensitivity: 'base' },
        )
      const left = dateValue(sort === 'date' ? a.startDate : a.updatedAt)
      const right = dateValue(sort === 'date' ? b.startDate : b.updatedAt)
      if (left === null) return right === null ? 0 : 1
      if (right === null) return -1
      return sort === 'date' ? left - right : right - left
    })
  function clearSearch() {
    setQuery('')
    search.current?.focus()
  }
  return (
    <div className={styles.workspace}>
    <main className={`${styles.page} ${styles.draftsPage}`}>
      <header className={`${styles.pageHeader} ${styles.collectionHeader}`}>
        <div>
          <h1 ref={title} tabIndex={-1}>
            My Events
          </h1>
          <p>Good things start with a gathering. Pick up where you left off.</p>
        </div>
        <div className={styles.collectionAction}>
          <Link className={styles.primaryLink} to="/organizer/events/new">
            <EventIcon name="add" />
            Create event
          </Link>
        </div>
      </header>
      <section aria-labelledby="saved-drafts" aria-busy={resource.loading}>
        <h2 id="saved-drafts" className={styles.srOnly}>
          Saved drafts
        </h2>
        <div className={styles.draftsToolbar}>
          <div
            className={`${styles.tabs} ${styles.eventViews}`}
            role="group"
            aria-label="Event views"
            aria-describedby="event-views-note"
          >
            <button type="button" disabled>
              Published
            </button>
            <button type="button" aria-pressed="true">
              Drafts{' '}
              {resource.data && <span className={styles.draftCount}>{resource.data.length}</span>}
            </button>
            <button type="button" disabled>
              Past
            </button>
          </div>
          <div className={styles.draftFilters}>
            <label className={styles.searchField}>
              <span className={styles.srOnly}>Search saved drafts</span>
              <EventIcon name="search" />
              <input
                ref={search}
                type="search"
                placeholder="Search saved drafts…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                disabled={!resource.data?.length}
                aria-controls="draft-results"
              />
            </label>
            <label className={styles.draftSort}>
              <span className={styles.srOnly}>Sort drafts</span>
              <EventIcon name="sort" />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                disabled={!resource.data?.length}
                aria-controls="draft-results"
              >
                <option value="modified">Last modified</option>
                <option value="date">Event date</option>
                <option value="title">Title</option>
              </select>
            </label>
            <button
              type="button"
              aria-label="Refresh drafts"
              onClick={resource.reload}
              disabled={resource.loading}
              className={styles.refreshDrafts}
            >
              <EventIcon name="refresh" />
            </button>
          </div>
        </div>
        <p id="event-views-note" className={styles.viewNote}>
          Published and past events are not available yet.
        </p>
        <div id="draft-results">
          {resource.loading && <DraftsLoading />}
          {resource.error && <DraftsError error={resource.error} retry={resource.reload} />}
          {resource.data?.length === 0 && (
            <div className={`${styles.card} ${styles.draftEmpty}`}>
              <div className={styles.emptyIcon}>
                <EventIcon name="calendar_add_on" />
              </div>
              <h3>No drafts in progress</h3>
              <p>Your saved event drafts will appear here, ready for you to continue editing.</p>
              <Link className={styles.primaryLink} to="/organizer/events/new">
                <EventIcon name="add" />
                Create your first event
              </Link>
            </div>
          )}
          {resource.data && resource.data.length > 0 && (
            <>
              <p className={styles.srOnly} role="status">
                {drafts.length} {drafts.length === 1 ? 'draft' : 'drafts'}
                {term ? ' matching your search' : ' available'}.
              </p>
              {drafts.length ? (
                <ul className={styles.draftList}>
                  {drafts.map((draft) => (
                    <DraftCard key={draft.id} draft={draft} />
                  ))}
                </ul>
              ) : (
                <div className={`${styles.card} ${styles.draftEmpty}`}>
                  <div className={styles.emptyIcon}>
                    <EventIcon name="search_off" />
                  </div>
                  <h3>No matching drafts</h3>
                  <p>Try another title, format or location.</p>
                  <button type="button" onClick={clearSearch}>
                    Clear search
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
    </div>
  )
}
