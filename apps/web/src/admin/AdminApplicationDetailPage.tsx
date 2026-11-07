import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ReviewError, type ApplicationReviewService, type DecisionInput } from './model'
import { useReviewResource } from './useReviewResource'
import { ReviewDate, ReviewStatus } from './ReviewMetadata'
import ReviewState from './ReviewState'
import DecisionForm from './DecisionForm'
import AdminIcon from './AdminIcon'
import ReviewLoading from './ReviewLoading'
import styles from './review.module.css'

function proofLink(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

function ApplicationDetail({ id, service }: { id: string; service?: ApplicationReviewService }) {
  const { requestProtected } = useAuth()
  const { search } = useLocation()
  const title = useRef<HTMLHeadingElement>(null)
  const feedback = useRef<HTMLParagraphElement>(null)
  const decisionRequest = useRef<AbortController | null>(null)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null)
  const [denial, setDenial] = useState<ReviewError | null>(null)
  const load = useCallback(async (signal: AbortSignal) => {
    if (!service) throw new ReviewError('unavailable')
    return service.detail(id, { signal, request: requestProtected })
  }, [id, service, requestProtected])
  const { resource, reload } = useReviewResource(load)

  useEffect(() => {
    title.current?.focus()
    return () => decisionRequest.current?.abort()
  }, [])
  useEffect(() => { if (notice) feedback.current?.focus() }, [notice])

  async function decide(input: DecisionInput) {
    if (!service || resource.status !== 'ready' || decisionRequest.current) return
    const controller = new AbortController()
    decisionRequest.current = controller
    setPending(true)
    setNotice(null)
    try {
      await service.decide(resource.data, input, { signal: controller.signal, request: requestProtected })
      if (controller.signal.aborted) return
      setNotice({ text: 'Decision saved.', error: false })
      reload()
    } catch (cause) {
      if (controller.signal.aborted) return
      if (cause instanceof ReviewError && (cause.kind === 'forbidden' || cause.kind === 'not-found')) {
        setDenial(cause)
      } else {
        setNotice({
          text: cause instanceof ReviewError && (cause.kind === 'conflict' || cause.kind === 'validation')
            ? cause.message
            : 'We could not confirm the decision. Check the latest application state before trying again.',
          error: true,
        })
        // A failed response may follow a committed decision. Always obtain a
        // fresh snapshot before making any further action available.
        reload()
      }
    } finally {
      if (!controller.signal.aborted) {
        decisionRequest.current = null
        setPending(false)
      }
    }
  }

  const detail = resource.status === 'ready' ? resource.data : null
  const application = detail?.application
  const proof = proofLink(application?.proofUrl ?? null)

  return (
    <main className={`${styles.page} ${styles.detailPage}`}>
      <div className={styles.breadcrumb}><Link className={styles.back} to={`/admin/applications${search}`}><AdminIcon name="arrow_back" />Back to applications</Link><span>/</span><span>Application details</span></div>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Organizer verification</p>
          <h1 ref={title} tabIndex={-1}>Application review</h1>
          <p className={styles.detailId}>Application ID: {id}</p>
        </div>
        {service && !denial && <button type="button" disabled={pending || resource.status === 'loading'} onClick={() => { setNotice(null); reload() }}><AdminIcon name="refresh" />Refresh application</button>}
      </header>

      {notice && !denial && <p className={styles.notice} data-error={notice.error} ref={feedback} tabIndex={-1} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
      {denial ? <ReviewState error={denial} retry={reload} /> : (
        <>
          {resource.status === 'loading' && <div className={styles.panel}><ReviewLoading detail /></div>}
          {resource.status === 'error' && <ReviewState error={resource.error} retry={reload} />}
          {application && detail && service && (
            <div className={styles.detailGrid}>
              <section className={styles.applicationSections} aria-label="Submitted information">
                <div className={styles.panel}>
                  <div className={styles.organizationHeading}>
                    <span className={styles.detailAvatar} aria-hidden="true">{application.orgName.slice(0, 2).toUpperCase()}</span>
                    <div><p className={styles.eyebrow}>Organization application</p><h2>{application.orgName}</h2><ReviewStatus status={application.status} /></div>
                  </div>
                  <h3 className={styles.sectionTitle}><AdminIcon name="business" />Organization information</h3>
                  <dl className={styles.facts}>
                    <div><dt>Entity category</dt><dd>{application.type.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase())}</dd></div>
                    <div><dt>Representative</dt><dd>{application.representativeFullName}</dd></div>
                    <div><dt>Title / academic position</dt><dd>{application.academicPosition}</dd></div>
                    <div><dt>Contact phone</dt><dd>{application.phoneNumber}</dd></div>
                    <div><dt>Submitted by</dt><dd>{application.submittedBy.firstName} {application.submittedBy.lastName}</dd></div>
                    <div><dt>Contact email</dt><dd>{application.submittedBy.email}</dd></div>
                    <div><dt>Submitted</dt><dd><ReviewDate value={application.submittedAt} /></dd></div>
                  </dl>
                </div>
                <div className={styles.panel}>
                  <h3 className={styles.sectionTitle}><AdminIcon name="description" />Supporting document</h3>
                  {proof ? <a className={styles.documentLink} href={proof} target="_blank" rel="noopener noreferrer"><span className={styles.documentIcon}><AdminIcon name="article" /></span><span>Open supporting document (new tab)<small>Review the evidence submitted with this application</small></span><AdminIcon name="open_in_new" /></a> : <p className={styles.muted}>No supporting document available</p>}
                </div>
                <div className={styles.panel}>
                  <h3 className={styles.sectionTitle}><AdminIcon name="history" />Review history</h3>
                  <dl className={styles.facts}>
                    <div><dt>Reviewed</dt><dd>{application.reviewedAt ? <ReviewDate value={application.reviewedAt} /> : 'Not yet reviewed'}</dd></div>
                    <div className={styles.fullWidth}><dt>Decision reason</dt><dd className={styles.reason}>{application.reviewerNote || 'No decision reason recorded'}</dd></div>
                  </dl>
                </div>
              </section>
              <section className={`${styles.panel} ${styles.decisionPanel}`} aria-label="Review decision">
                <div className={styles.decisionHeading}><span className={styles.decisionIcon}><AdminIcon name="fact_check" /></span><div><h2>Review decision</h2><p>Evaluate this organizer application.</p></div></div>
                <DecisionForm allowedDecisions={detail.allowedDecisions} rules={service.decisionRules} pending={pending} onSubmit={decide} />
                <p className={styles.decisionNote}><AdminIcon name="info" />Check the submitted information and supporting document before confirming.</p>
              </section>
            </div>
          )}
        </>
      )}
    </main>
  )
}

export default function AdminApplicationDetailPage({ service }: { service?: ApplicationReviewService }) {
  const { applicationId = '' } = useParams()
  return <ApplicationDetail key={applicationId} id={applicationId} service={service} />
}
