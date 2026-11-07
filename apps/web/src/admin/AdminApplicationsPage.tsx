import { useCallback, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ReviewError, statusLabels, type ApplicationReviewService } from './model'
import type { OrganizationStatus } from '../auth/model'
import AdminIcon from './AdminIcon'
import ReviewState from './ReviewState'
import ReviewLoading from './ReviewLoading'
import { ReviewDate, ReviewStatus } from './ReviewMetadata'
import { useReviewResource } from './useReviewResource'
import { exportApplicationPage } from './applicationCsv'
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
  const query = search.get('q') ?? ''
  const items = resource.status === 'ready' ? resource.data.items : null
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleItems = items?.filter((item) =>
    [item.orgName, item.representativeFullName, item.id].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)),
  ) ?? []
  const statuses: OrganizationStatus[] = ['PENDING', 'APPROVED', 'NEEDS_CHANGES', 'REJECTED']
  const metricIcons = { PENDING: 'hourglass_top', APPROVED: 'verified', NEEDS_CHANGES: 'edit_note', REJECTED: 'cancel' }

  useEffect(() => { title.current?.focus() }, [])

  function selectPage(value: string | null) {
    const next = new URLSearchParams(search)
    if (value === null) next.delete('page')
    else next.set('page', value)
    setSearch(next)
    title.current?.focus()
  }

  function selectStatus(value: string) {
    const next = new URLSearchParams(search)
    next.delete('page')
    if (value) next.set('status', value)
    else next.delete('status')
    setSearch(next)
  }

  function clearFilters() {
    const next = new URLSearchParams(search)
    for (const key of ['q', 'status', 'page']) next.delete(key)
    setSearch(next)
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Organizer applications</p>
          <h1 ref={title} tabIndex={-1}>Application reviews</h1>
          <p>Inspect organizer submissions, review their details, and record your decisions.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" onClick={reload} disabled={!service || resource.status === 'loading'}><AdminIcon name="refresh" />Refresh applications</button>
          <button type="button" className={styles.primary} disabled={visibleItems.length === 0} onClick={() => exportApplicationPage(visibleItems)}><AdminIcon name="file_download" />Export page</button>
        </div>
      </header>

      <section aria-label="Current page summary" className={styles.metrics}>
        <div className={styles.metric}>
          <div><span>On this page</span><span className={styles.metricIcon}><AdminIcon name="folder_open" /></span></div>
          <strong>{items ? items.length : '—'}</strong>
          <small>Applications in the current page</small>
        </div>
        {statuses.map((status) => (
          <div key={status} className={styles.metric} data-status={status}>
            <div><span>{statusLabels[status]}</span><span className={styles.metricIcon}><AdminIcon name={metricIcons[status]} /></span></div>
            <strong>{items ? items.filter((item) => item.status === status).length : '—'}</strong>
            <small>On this page</small>
          </div>
        ))}
      </section>

      <section aria-label="Applications" className={styles.queue}>
        <div className={styles.queueTop}>
          <nav aria-label="Application status filters" className={styles.statusTabs}>
            <button type="button" aria-pressed={selectedStatus === null} onClick={() => selectStatus('')}>All submissions</button>
            {service?.filters.map((filter) => <button type="button" key={filter.value} aria-pressed={selectedStatus === filter.value} onClick={() => selectStatus(filter.value)}>{filter.label}</button>)}
          </nav>
          <span className={styles.queueLabel}><AdminIcon name="table_rows" />Application queue</span>
        </div>
        <div className={styles.toolbar}>
          <div className={styles.searchField}>
            <AdminIcon name="search" />
            <label htmlFor="review-search" className={styles.srOnly}>Search this page</label>
            <input id="review-search" type="search" placeholder="Search organization, representative, or ID…" value={query} disabled={resource.status !== 'ready'} onChange={(event) => {
              const next = new URLSearchParams(search)
              if (event.target.value) next.set('q', event.target.value)
              else next.delete('q')
              setSearch(next, { replace: true })
            }} />
          </div>
          <div className={styles.filters}>
            {service && service.filters.length > 0 && (
              <>
                <label htmlFor="review-status" className={styles.srOnly}>Review status</label>
                <select id="review-status" value={selectedStatus ?? ''} onChange={(event) => selectStatus(event.target.value)}>
                  <option value="">All review statuses</option>
                  {service.filters.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
                </select>
              </>
            )}
            <button type="button" className={styles.reset} onClick={clearFilters} disabled={!query && !selectedStatus}><AdminIcon name="filter_alt_off" />Reset filters</button>
          </div>
        </div>
        <div className={styles.criteria}>
          <span>{selectedStatus ? statusLabels[selectedStatus] : 'All review statuses'}{query.trim() ? ` · Search: “${query.trim()}”` : ' · No search applied'}</span>
          <span>Search is limited to this page</span>
        </div>

        {resource.status === 'loading' && <ReviewLoading />}
        {resource.status === 'error' && <ReviewState error={resource.error} retry={reload} />}
        {resource.status === 'ready' && (
          <>
            {visibleItems.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}><AdminIcon name="manage_search" /></span>
                <h2>No applications to show</h2>
                <p role="status">No applications match this view.</p>
                <p>Try another review status or clear your search to see more applications.</p>
                {(query || selectedStatus) && <button className={styles.primary} type="button" onClick={clearFilters}><AdminIcon name="filter_alt_off" />Clear filters</button>}
              </div>
            ) : (
              <div className={styles.tableScroll} role="region" aria-label="Application table" tabIndex={0}>
                <table className={styles.table}>
                  <caption className={styles.srOnly}>Organizer applications available for review</caption>
                  <thead><tr><th scope="col">Organization / application</th><th scope="col">Submitted</th><th scope="col">Representative</th><th scope="col">Review status</th><th scope="col">Action</th></tr></thead>
                  <tbody>
                    {visibleItems.map((application) => {
                      const href = `/admin/applications/${encodeURIComponent(application.id)}${search.size ? `?${search}` : ''}`
                      return (
                        <tr key={application.id}>
                          <th scope="row"><div className={styles.identity}><span className={styles.organizationAvatar} aria-hidden="true">{application.orgName.slice(0, 2).toUpperCase()}</span><div><Link to={href}>{application.orgName}</Link><span className={styles.applicationId} title={application.id}>{application.id}</span></div></div></th>
                          <td><ReviewDate value={application.submittedAt} /></td>
                          <td>{application.representativeFullName}</td>
                          <td><ReviewStatus status={application.status} /></td>
                          <td><Link className={styles.reviewLink} to={href} aria-label={`Review application for ${application.orgName}`}>Review application<AdminIcon name="arrow_forward" /></Link></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <nav aria-label="Application pages" className={styles.pagination}>
              <span role={visibleItems.length > 0 ? 'status' : undefined}>{visibleItems.length} {visibleItems.length === 1 ? 'application' : 'applications'} shown on this page</span>
              <div>
                <button type="button" disabled={resource.data.previousPage === null} onClick={() => selectPage(resource.data.previousPage)}><AdminIcon name="chevron_left" />Previous page</button>
                <span className={styles.pageNumber}>{resource.data.pageLabel}</span>
                <button type="button" disabled={resource.data.nextPage === null} onClick={() => selectPage(resource.data.nextPage)}>Next page<AdminIcon name="chevron_right" /></button>
              </div>
            </nav>
          </>
        )}
      </section>
      <footer className={styles.footer}><strong>Younity</strong><span>Organizer application review</span><span><AdminIcon name="verified_user" />Administrator workspace</span></footer>
    </main>
  )
}
