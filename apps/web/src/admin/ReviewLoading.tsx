import styles from './review.module.css'

export default function ReviewLoading({ detail = false }: { detail?: boolean }) {
  return (
    <div className={styles.loading}>
      <p role="status">{detail ? 'Loading application…' : 'Loading applications…'}</p>
      <div aria-hidden="true" className={styles.skeleton}>
        {[0, 1, 2, 3].map((row) => <div key={row}><span /><span /><span /></div>)}
      </div>
    </div>
  )
}
