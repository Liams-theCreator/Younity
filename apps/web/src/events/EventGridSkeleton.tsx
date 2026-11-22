import styles from './events.module.css'

const cardLayouts = ['block', 'hidden min-[600px]:block', 'hidden min-[1000px]:block']
const bar = 'rounded-full bg-[var(--border)]'

export default function EventGridSkeleton() {
  return (
    <ul aria-hidden="true" className={styles.eventGrid}>
      {cardLayouts.map(layout => (
        <li key={layout} className={layout}>
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
            <div className="motion-safe:animate-pulse">
              <div className="h-36 bg-[var(--panel)] min-[1000px]:h-[168px]" />
              <div className={styles.cardBody}>
                <div className={`${bar} h-3 w-1/3`} />
                <div className={`${bar} h-5 w-4/5`} />
                <div className={`${bar} h-4 w-1/2`} />
                <div className={`${bar} h-4 w-2/3`} />
                <div className={styles.cardFooter}>
                  <div className={`${bar} h-3 w-1/3`} />
                  <div className="h-11 w-1/3 rounded-xl bg-[var(--panel)]" />
                </div>
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
