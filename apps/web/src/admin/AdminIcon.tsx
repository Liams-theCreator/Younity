import styles from './review.module.css'

export default function AdminIcon({ name }: { name: string }) {
  return <span className={styles.icon} aria-hidden="true">{name}</span>
}
