import type { ReactNode } from 'react'
import organizerMark from '../assets/younity-organizer-mark.png'
import ReferenceIcon from './ReferenceIcon'
import styles from './AuthPageLayout.module.css'

const organizerIntroduction = 'Empowering university departments, research centers, and verified institutional leaders across Morocco to publish accredited summits, hackathons, and symposiums.'

const introductions = {
  login: 'Connecting student innovators, faculty directors, and collegiate summits across the Kingdom.',
  student: 'Connecting collegiate hackathons, verified faculty research circles, and student clubs across Morocco’s leading engineering and civic institutions.',
  organizer: organizerIntroduction,
  organizerStatus: organizerIntroduction,
  organizerPending: organizerIntroduction,
}

export default function AuthPageLayout({
  variant,
  children,
}: {
  variant: keyof typeof introductions
  children: ReactNode
}) {
  const statusPage = variant === 'organizerStatus' || variant === 'organizerPending'
  const variantClass = variant === 'organizerPending'
    ? `${styles.organizerStatus} ${styles.organizerPending}`
    : styles[variant]

  return (
    <main className={`${styles.layout} ${variantClass}`}>
      <aside className={styles.hero} aria-label="About Younity">
        <p className={styles.brand}>
          <span className={styles.mark}>
            {statusPage ? <img src={organizerMark} width={30} height={30} alt="" /> : <ReferenceIcon name="school" />}
          </span>
          {statusPage ? <span>younity<span className={styles.brandDot}>.</span></span> : 'Younity'}
        </p>
        <div className={styles.heroCopy}>
          <p className={styles.heroTitle}>
            {variant === 'organizer' || statusPage ? 'Connecting University Ambition with Civic Impact.' : (
              <>Where Moroccan student ambitions <em>spark campus innovation</em> and leaders build the future together.</>
            )}
          </p>
          <p className={styles.introduction}>{introductions[variant]}</p>
        </div>
      </aside>
      <div className={styles.content}>{children}</div>
    </main>
  )
}
