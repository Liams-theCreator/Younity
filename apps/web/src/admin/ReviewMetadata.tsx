import { statusLabels, type ApplicationSummary } from './model'
import styles from './review.module.css'
import AdminIcon from './AdminIcon'

export function ReviewStatus({ status }: { status: ApplicationSummary['status'] }) {
  const icons = { PENDING: 'schedule', APPROVED: 'check_circle', NEEDS_CHANGES: 'edit_note', REJECTED: 'cancel' }
  return <span className={styles.badge} data-status={status}><AdminIcon name={icons[status]} /><span>{statusLabels[status]}</span></span>
}

export function ReviewDate({ value }: { value: string }) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return <span>Date unavailable</span>
  return <time dateTime={value}>{date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</time>
}
