import { ReviewError } from './model'
import styles from './review.module.css'
import AdminIcon from './AdminIcon'

export default function ReviewState({ error, retry }: { error: ReviewError; retry: () => void }) {
  return (
    <section className={styles.errorState}>
      <span className={styles.errorIcon}><AdminIcon name={error.kind === 'forbidden' ? 'lock' : error.kind === 'not-found' ? 'search_off' : 'cloud_off'} /></span>
      <h2>{error.kind === 'forbidden' ? 'Access restricted' : error.kind === 'not-found' ? 'Application not found' : 'Unable to load applications'}</h2>
      <p role="alert">{error.message}</p>
      {error.kind !== 'forbidden' && error.kind !== 'not-found' && (
        <button type="button" className={styles.primary} onClick={retry}><AdminIcon name="refresh" />Try again</button>
      )}
    </section>
  )
}
