import { statusLabels, type ApplicationSummary } from './model'
import styles from './review.module.css'

export function ReviewStatus({ status }: { status: ApplicationSummary['status'] }) {
  return <span className={styles.badge} data-status={status}>{statusLabels[status]}</span>
}

export function ReviewDate({ value }: { value: string }) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return <span>Date unavailable</span>
  return <time dateTime={value}>{date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</time>
}
