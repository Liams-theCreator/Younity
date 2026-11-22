import { useId, useState } from 'react'
import type { OrganizationStatus } from '../auth/model'
import styles from './OrganizerDecisionNotice.module.css'

export type OrganizerDecisionAction = {
  id: string
  label: string
  onClick: () => void
}

export type OrganizerDecisionNoticeProps = {
  status: OrganizationStatus
  explanation?: string | null
  /** Pass only actions permitted by the current application/session. */
  actions?: readonly OrganizerDecisionAction[]
  /** Temporarily disables permitted actions while the parent handles a request. */
  busy?: boolean
  busyLabel?: string
  headingLevel?: 1 | 2 | 3
}

const decisions: Record<OrganizationStatus, {
  label: string
  title: string
  description: string
}> = {
  PENDING: {
    label: 'Pending review',
    title: 'Organization verification pending',
    description: 'Your application is waiting for review. You can check its status again later.',
  },
  APPROVED: {
    label: 'Approved',
    title: 'Your organizer application is approved',
    description: 'You can now enter your organizer dashboard or explore campus events.',
  },
  NEEDS_CHANGES: {
    label: 'Changes requested',
    title: 'Your application needs changes',
    description: 'Update your saved application and resubmit it for review.',
  },
  REJECTED: {
    label: 'Rejected',
    title: 'Your application was not approved',
    description: 'This application is closed. Your organization cannot publish events.',
  },
}

function Explanation({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const textId = useId()
  const characters = Array.from(text)
  const long = characters.length > 200

  return (
    <div className={styles.feedback}>
      <p className={styles.feedbackLabel}>Reviewer feedback</p>
      <p id={textId} className={styles.feedbackText}>
        {long && !expanded ? `${characters.slice(0, 200).join('')}…` : text}
      </p>
      {long && (
        <button
          type="button"
          className={styles.expand}
          aria-expanded={expanded}
          aria-controls={textId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less feedback' : 'Read full feedback'}
        </button>
      )}
    </div>
  )
}

/** Presentation only: no session access, routing, fetching, or decision writes. */
export default function OrganizerDecisionNotice({
  status,
  explanation,
  actions = [],
  busy = false,
  busyLabel = 'Please wait…',
  headingLevel = 2,
}: OrganizerDecisionNoticeProps) {
  const titleId = useId()
  const Heading = headingLevel === 1 ? 'h1' : headingLevel === 3 ? 'h3' : 'h2'
  const decision = decisions[status]
  const feedback = explanation?.trim()

  return (
    <section className={styles.notice} data-decision={status} aria-labelledby={titleId}>
      <p className={styles.badge} role="status" aria-atomic="true">{decision.label}</p>
      <Heading id={titleId} className={styles.title}>{decision.title}</Heading>
      <p className={styles.description}>{decision.description}</p>

      {feedback && <Explanation key={`${status}:${feedback}`} text={feedback} />}

      {actions.length > 0 && (
        <div className={styles.actions} role="group" aria-label="Available actions" aria-busy={busy}>
          {actions.map((action) => (
            <button key={action.id} type="button" disabled={busy} onClick={action.onClick}>
              {action.label}
            </button>
          ))}
        </div>
      )}

      {busy && <p className={styles.progress} role="status">{busyLabel}</p>}
    </section>
  )
}
