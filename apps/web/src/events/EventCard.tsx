import { useId } from 'react'
import { Link } from 'react-router'
import ReferenceIcon from '../components/ReferenceIcon'
import { formatLabels, type Availability, type EventFormat, type EventSummary } from './discovery.model'
import styles from './discovery.module.css'

const availabilityLabels: Record<Availability, string> = {
  OPEN: 'Registration open',
  FULL: 'Full',
  CLOSED: 'Registration closed',
}
const formatIcons: Record<EventFormat, string> = {
  IN_PERSON: 'apartment',
  ONLINE: 'computer',
  HYBRID: 'devices',
}
const dates = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

export default function EventCard({ event }: { event: EventSummary }) {
  const titleId = useId()

  return (
    <article className={styles.eventCard}>
      <Link
        className={styles.eventLink}
        to={`/events/${encodeURIComponent(event.id)}`}
        aria-labelledby={titleId}
      >
        <div className={styles.eventCover} data-format={event.format}>
          <ReferenceIcon name={formatIcons[event.format]} />
          <ul className={styles.categories} aria-label="Event categories">
            {event.categories.map(category => <li key={category.id}>{category.name}</li>)}
          </ul>
        </div>
        <div className={styles.cardBody}>
          <p className={styles.organizerName}>{event.organization.name}</p>
          <h3 id={titleId}>{event.title}</h3>
          <p>{event.location ?? (event.format === 'ONLINE' ? 'Online event' : 'Location to be announced')}</p>
          <div className={styles.eventMeta}>
            <span>
              <ReferenceIcon name="calendar_month" />
              {dates.formatRange(new Date(event.startDate), new Date(event.endDate))}
            </span>
            <span><ReferenceIcon name={formatIcons[event.format]} />{formatLabels[event.format]}</span>
          </div>
          <div className={styles.cardFooter}>
            <span className={styles.availability}>{availabilityLabels[event.availability]}</span>
            <span className={styles.primaryButton}>View event <ReferenceIcon name="arrow_forward" /></span>
          </div>
        </div>
      </Link>
    </article>
  )
}
