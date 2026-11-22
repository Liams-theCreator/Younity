import type { ReactNode } from 'react'
import type { OrganizationStatus } from '../auth/model'
import AuthPageLayout from './AuthPageLayout'
import layoutStyles from './AuthPageLayout.module.css'
import ReferenceIcon from './ReferenceIcon'
import styles from './OrganizerStatusLayout.module.css'

const decisions = {
  PENDING: { label: 'Status: Queued', review: 'In progress', icon: 'schedule', tone: styles.pending },
  APPROVED: { label: 'Status: Approved & Active', review: 'Approved', icon: 'verified', tone: styles.approved },
  NEEDS_CHANGES: { label: 'Status: Action Required', review: 'Changes requested', icon: 'edit_note', tone: styles.pending },
  REJECTED: { label: 'Status: Application Declined', review: 'Not approved', icon: 'cancel', tone: styles.rejected },
}

export default function OrganizerStatusLayout({
  status,
  applicationId,
  eyebrow,
  title,
  description,
  feedback,
  children,
}: {
  status: OrganizationStatus
  applicationId?: string
  eyebrow: string
  title: string
  description: string
  feedback?: ReactNode
  children: ReactNode
}) {
  const decision = decisions[status]
  const approved = status === 'APPROVED'

  return (
    <AuthPageLayout variant="organizer">
      <section className={`${layoutStyles.card} ${styles.card} ${decision.tone}`} aria-labelledby="organizer-status-title">
        <header>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 id="organizer-status-title" className={layoutStyles.title}>{title}</h1>
          <p className={layoutStyles.subtitle}>{description}</p>
        </header>

        <div className={styles.notice}>
          <span className={styles.noticeIcon}><ReferenceIcon name={decision.icon} /></span>
          <div>
            <strong>{decision.label}</strong>
            {applicationId && <p className={styles.applicationId}>ID: {applicationId}</p>}
          </div>
        </div>

        <div className={styles.review}>
          <section aria-labelledby="validation-pipeline-title">
            <h2 id="validation-pipeline-title" className={styles.sectionTitle}>
              <ReferenceIcon name="verified_user" /> Validation Pipeline
            </h2>
            <ol className={styles.pipeline}>
              <li>
                <span className={styles.completed}><ReferenceIcon name="check" /></span>
                <div><strong>Institutional Dossier</strong><p>Initial submission</p></div>
              </li>
              <li>
                <span className={styles.decision}><ReferenceIcon name={decision.icon} /></span>
                <div><strong>Credential &amp; Mandate Review</strong><p>{decision.review}</p></div>
              </li>
              <li>
                <span className={approved ? styles.completed : styles.locked}>
                  <ReferenceIcon name={approved ? 'rocket_launch' : 'lock'} />
                </span>
                <div><strong>Event Management Console</strong><p>{approved ? 'Access available' : 'Access restricted'}</p></div>
              </li>
            </ol>
          </section>

          {feedback && (
            <aside className={styles.feedback} aria-labelledby="reviewer-feedback-title">
              <h2 id="reviewer-feedback-title" className={styles.sectionTitle}>
                <ReferenceIcon name="rate_review" /> Reviewer Feedback
              </h2>
              {feedback}
            </aside>
          )}
        </div>

        <div className={styles.footer}>{children}</div>
      </section>
    </AuthPageLayout>
  )
}
