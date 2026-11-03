import { useCallback, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ReviewError, type ApplicationReviewService } from './model'
import ReviewState from './ReviewState'
import { ReviewDate, ReviewStatus } from './ReviewMetadata'
import { useReviewResource } from './useReviewResource'
import styles from './review.module.css'

export default function AdminApplicationsPage({ service }: { service?: ApplicationReviewService }) {
  const { requestProtected } = useAuth()
  const [search, setSearch] = useSearchParams()
  const selectedStatus = service?.filters.find((filter) => filter.value === search.get('status'))?.value ?? null
  const page = search.get('page')
  const title = useRef<HTMLHeadingElement>(null)
  const load = useCallback(async (signal: AbortSignal) => {
    if (!service) throw new ReviewError('unavailable')
    return service.list({ status: selectedStatus, page }, { signal, request: requestProtected })
  }, [service, selectedStatus, page, requestProtected])
  const { resource, reload } = useReviewResource(load)

  useEffect(() => { title.current?.focus() }, [])

  function selectPage(value: string | null) {
    const next = new URLSearchParams(search)
    if (value === null) next.delete('page')
    else next.set('page', value)
    setSearch(next)
    title.current?.focus()
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Administrator workspace</p>
          <h1 ref={title} tabIndex={-1}>Application reviews</h1>
          <p>Inspect organizer applications and record review decisions.</p>
        </div>
        {service && <button type="button" onClick={reload} disabled={resource.status === 'loading'}>Refresh applications</button>}
      </header>

      {service && service.filters.length > 0 && (
        <div className={styles.filters}>
          <label htmlFor="review-status">Review status</label>
          <select id="review-status" value={selectedStatus ?? ''} onChange={(event) => {
            const next = new URLSearchParams(search)
            next.delete('page')
            if (event.target.value) next.set('status', event.target.value)
            else next.delete('status')
            setSearch(next)
          }}>
            <option value="">All review statuses</option>
            {service.filters.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
          </select>
        </div>
      )}

      {resource.status === 'loading' && <p role="status">Loading applications…</p>}
      {resource.status === 'error' && <ReviewState error={resource.error} retry={reload} />}
      {resource.status === 'ready' && (
        <section aria-label="Applications" className={styles.panel}>
          <p role="status">{resource.data.items.length === 0 ? 'No applications match this view.' : `${resource.data.items.length} ${resource.data.items.length === 1 ? 'application' : 'applications'} on this page.`}</p>
          <ul className={styles.list}>
            {resource.data.items.map((application) => (
              <li key={application.id}>
                <div>
                  <h2><Link to={`/admin/applications/${encodeURIComponent(application.id)}${search.size ? `?${search}` : ''}`}>{application.orgName}</Link></h2>
                  <p>{application.representativeFullName}</p>
                  <p>Submitted <ReviewDate value={application.submittedAt} /></p>
                </div>
                <ReviewStatus status={application.status} />
              </li>
            ))}
          </ul>
          <nav aria-label="Application pages" className={styles.pagination}>
            <button type="button" disabled={resource.data.previousPage === null} onClick={() => selectPage(resource.data.previousPage)}>Previous page</button>
            <span>{resource.data.pageLabel}</span>
            <button type="button" disabled={resource.data.nextPage === null} onClick={() => selectPage(resource.data.nextPage)}>Next page</button>
          </nav>
        </section>
      )}
    </main>
  )
}
