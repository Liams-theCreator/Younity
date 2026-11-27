import type { ReactNode } from 'react'
import type { OrganizationStatus } from '../auth/model'
import AuthPageLayout from './AuthPageLayout'
import layoutStyles from './AuthPageLayout.module.css'
import ReferenceIcon from './ReferenceIcon'
import styles from './OrganizerStatusLayout.module.css'

const decisions = {
  PENDING: {
    title: 'Institutional Dossier Submitted',
    badge: 'En Examen Académique',
    bannerIcon: 'hourglass_top',
    status: 'Status: Queued',
    statusIcon: 'schedule',
    stage: 'Stage 2 in progress',
    reviewIcon: 'sync',
    review: 'Liaison officers are verifying your academic affiliation and authorization to represent your institution.',
    tone: styles.pending,
  },
  APPROVED: {
    title: 'Institutional Dossier: Application Approved',
    badge: 'Dossier Validé',
    bannerIcon: 'verified',
    status: 'Status: Approved & Active',
    statusIcon: '',
    stage: 'Stage 3 concluded • 100% verified',
    reviewIcon: 'check',
    review: 'Liaison officers concluded their review. Your institutional credentials and authorization were confirmed.',
    tone: styles.approved,
  },
  NEEDS_CHANGES: {
    title: 'Institutional Dossier: Changes Requested',
    badge: 'Modifications Requises',
    bannerIcon: 'warning',
    status: 'Status: Action Required',
    statusIcon: 'edit_note',
    stage: 'Stage 2 • Action required',
    reviewIcon: 'priority_high',
    review: 'Update your saved application and resubmit it to continue the review.',
    tone: styles.changes,
  },
  REJECTED: {
    title: 'Institutional Dossier: Application Not Approved',
    badge: 'Dossier Non Validé',
    bannerIcon: 'cancel',
    status: 'Status: Application Declined',
    statusIcon: 'error',
    stage: 'Stage 2 concluded',
    reviewIcon: 'close',
    review: 'Liaison officers concluded their review. The application is closed and event publishing remains restricted.',
    tone: styles.rejected,
  },
} satisfies Record<OrganizationStatus, Record<string, string>>

export default function OrganizerStatusLayout({
  status,
  applicationId,
  email,
  reviewerNote,
  children,
}: {
  status: OrganizationStatus
  applicationId?: string
  email?: string
  reviewerNote?: string | null
  children: ReactNode
}) {
  const decision = decisions[status]
  const approved = status === 'APPROVED'
  const pending = status === 'PENDING'
  const longNote = reviewerNote && reviewerNote.length > 200

  return (
    <AuthPageLayout variant={pending ? 'organizerPending' : 'organizerStatus'}>
      <div className={styles.frame}>
        <section className={`${layoutStyles.card} ${styles.card} ${decision.tone}`} aria-labelledby="organizer-status-title">
          <h1 id="organizer-status-title" className={styles.title}>{decision.title}</h1>

          <div className={styles.notice}>
            <div className={styles.noticeMain}>
              <span className={styles.noticeIcon}><ReferenceIcon name={decision.bannerIcon} /></span>
              <div className={styles.identity}>
                <strong className={styles.badge}>{decision.badge}</strong>
                {applicationId && <span className={styles.applicationId}>ID: {applicationId}</span>}
              </div>
            </div>
            <span className={styles.statusBadge}>
              {decision.statusIcon ? <ReferenceIcon name={decision.statusIcon} /> : <span className={styles.statusDot} />}
              <span>{decision.status}</span>
            </span>
          </div>

          <section aria-labelledby="validation-pipeline-title">
            <div className={styles.pipelineHeader}>
              <h2 id="validation-pipeline-title" className={styles.sectionTitle}>
                <ReferenceIcon name="verified_user" /> Validation Pipeline
              </h2>
              <p className={styles.stage}>{decision.stage}</p>
            </div>

            <ol className={styles.pipeline} role="list">
              <li>
                <span className={`${styles.stepMarker} ${styles.completed}`}><ReferenceIcon name="check" /></span>
                <div className={styles.stepCard}>
                  <h3>Institutional Dossier Uploaded</h3>
                  <p>Faculty credentials, departmental affiliation, and authorization records received.</p>
                </div>
              </li>

              <li className={styles.reviewStep} aria-current={pending || status === 'NEEDS_CHANGES' ? 'step' : undefined}>
                <span className={styles.stepMarker}><ReferenceIcon name={decision.reviewIcon} /></span>
                <div className={styles.stepCard}>
                  <h3>Credential &amp; Mandate Review</h3>
                  <p>{decision.review}</p>

                  {email && <p className={styles.email}><ReferenceIcon name="mail" /><span>Account email: <strong>{email}</strong></span></p>}

                  {reviewerNote && (
                    <div className={styles.feedback}>
                      <h4>Reviewer Feedback</h4>
                      <p>{longNote ? `${reviewerNote.slice(0, 200)}…` : reviewerNote}</p>
                      {longNote && (
                        <details>
                          <summary>Read full feedback</summary>
                          <p>{reviewerNote}</p>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </li>

              <li className={approved ? styles.activeStep : styles.lockedStep}>
                <span className={styles.stepMarker}><ReferenceIcon name={approved ? 'rocket_launch' : 'lock'} /></span>
                <div className={styles.stepCard}>
                  <div className={styles.stepHeading}>
                    <h3>{approved ? 'Event Management Console Activated' : 'Event Management Console'}</h3>
                    {pending && <span>Stage 3</span>}
                  </div>
                  <p>{approved
                    ? 'You can now access your organizer dashboard and publish campus events.'
                    : 'Access to event publishing requires an approved institutional organizer dossier.'}
                  </p>
                </div>
              </li>
            </ol>
          </section>

          {pending && (
            <p className={styles.updateNote}>
              <ReferenceIcon name="info" /> This page checks for updates while it is visible.
            </p>
          )}

          <footer className={styles.footer}>{children}</footer>
        </section>
      </div>
    </AuthPageLayout>
  )
}
