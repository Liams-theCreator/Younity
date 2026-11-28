import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { EventIcon } from './EventUi'
import { formatLabels, type CategoryOption, type EventValues } from './model'
import { safeImageUrl } from './validation'
import styles from './reference-event.module.css'

function Cover({ url, alt }: { url: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <img
      src={url && !failed ? url : '/images/campus-gathering.webp'}
      alt={url && !failed ? alt : 'Example event cover'}
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
    />
  )
}
export function ReferenceCover({ value, alt }: { value: string; alt: string }) {
  const url = safeImageUrl(value)
  return <Cover key={url} url={url} alt={alt} />
}
export default function ReferencePreview({
  values,
  categories,
}: {
  values: EventValues
  categories: CategoryOption[]
}) {
  const { user } = useAuth()
  const date = values.startDate ? new Date(values.startDate) : null
  const end = values.endDate ? new Date(values.endDate) : null
  const valid = date && Number.isFinite(date.getTime())
  const endValid = end && Number.isFinite(end.getTime()) && valid && end > date
  const category = categories.find((option) => option.id === values.categoryIds[0])?.label
  return (
    <aside className={styles.preview} aria-label="Event preview">
      <div className={styles.previewTop}>
        <span>
          <i aria-hidden="true" />
          Live preview · Attendee view
        </span>
        <EventIcon name="visibility" />
      </div>
      <div className={styles.previewMedia}>
        <ReferenceCover value={values.imageUrl} alt="Event banner preview" />
        {category && <span className={styles.previewCategory}>{category}</span>}
        <span className={styles.previewMode}>
          {values.registrationMode === 'EXTERNAL'
            ? 'External registration'
            : values.registrationMode === 'AUTOMATIC'
              ? 'Younity RSVP'
              : 'Event preview'}
        </span>
      </div>
      <div className={styles.previewBody}>
        <p className={styles.previewDate}>
          <EventIcon name="event" />
          {valid ? (
            <span>
              {date
                .toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })
                .toUpperCase()}{' '}
              · {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              {endValid &&
                ` – ${end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
            </span>
          ) : (
            'Choose an event schedule'
          )}
        </p>
        <h2>{values.title.trim() || 'Your event title'}</h2>
        <p className={styles.previewOrganizer}>
          <EventIcon name="verified" />
          {user?.email}
        </p>
        <div className={styles.previewPills}>
          <span>
            <EventIcon name="pin_drop" />
            {values.format ? formatLabels[values.format] : 'Choose a format'}
            {values.format !== 'ONLINE' && values.location ? ` · ${values.location}` : ''}
            {values.room ? ` · ${values.room}` : ''}
          </span>
          {values.campus && <span>{values.campus}</span>}
        </div>
        <div className={styles.capacityPreview}>
          <div>
            <span>
              <EventIcon name="confirmation_number" />
              Event capacity
            </span>
            <strong>{values.capacity || 'Not set'}</strong>
          </div>
          <div className={styles.capacityTrack} aria-hidden="true" />
          <p>Preview only · Attendance is not shown</p>
        </div>
        <button type="button" className={styles.primary} disabled>
          RSVP to Event
          <EventIcon name="arrow_forward" />
        </button>
      </div>
      <div className={styles.previewFooter}>
        {values.imageUrl ? 'Your event, as students will see it.' : 'Example artwork · Add a banner to make it yours.'}
      </div>
    </aside>
  )
}
