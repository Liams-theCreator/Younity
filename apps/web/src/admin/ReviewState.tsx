import { ReviewError } from './model'
import styles from './review.module.css'

export default function ReviewState({ error, retry }: { error: ReviewError; retry: () => void }) {
  return (
    <section className={styles.notice}>
      <p role="alert">{error.message}</p>
      {error.kind !== 'forbidden' && error.kind !== 'not-found' && (
        <button type="button" onClick={retry}>Try again</button>
      )}
    </section>
  )
}
