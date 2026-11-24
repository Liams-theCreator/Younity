import type { ReactNode } from 'react'
import organizerMark from '../assets/younity-organizer-mark.png'
import ReferenceIcon from './ReferenceIcon'
import styles from './AuthPageLayout.module.css'

const organizerIntroduction = 'Empowering university departments, research centers, and verified institutional leaders across Morocco to publish accredited summits, hackathons, and symposiums.'
const authIntroduction = 'Bringing students, universities, and campus events together across Morocco.'

export default function AuthPageLayout({
  variant,
  children,
}: {
  variant?: 'login' | 'organizerStatus' | 'organizerPending'
  children: ReactNode
}) {
  const statusPage = variant === 'organizerStatus' || variant === 'organizerPending'
  const variantClass = variant === 'organizerPending'
    ? `${styles.organizerStatus} ${styles.organizerPending}`
    : variant ? styles[variant] : ''

  return (
    <main className={`${styles.layout} ${variantClass}`}>
      <aside className={statusPage ? styles.hero : `${styles.hero} ${styles.authHero}`} aria-label="About Younity">
        <p className={styles.brand}>
          <span className={styles.mark}>
            {statusPage ? <img src={organizerMark} width={30} height={30} alt="" /> : <ReferenceIcon name="school" />}
          </span>
          {statusPage ? <span>younity<span className={styles.brandDot}>.</span></span> : 'Younity'}
        </p>
        <div className={styles.heroCopy}>
          <p className={styles.heroTitle}>Connecting University Ambition with Civic Impact.</p>
          <p className={styles.introduction}>{statusPage ? organizerIntroduction : authIntroduction}</p>
        </div>
      </aside>
      <div className={styles.content}>{children}</div>
    </main>
  )
}
