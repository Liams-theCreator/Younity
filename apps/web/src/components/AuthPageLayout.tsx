import type { ReactNode } from 'react'
import ReferenceIcon from './ReferenceIcon'
import styles from './AuthPageLayout.module.css'

const introductions = {
  login: 'Connecting student innovators, faculty directors, and collegiate summits across the Kingdom.',
  student: 'Connecting collegiate hackathons, verified faculty research circles, and student clubs across Morocco’s leading engineering and civic institutions.',
  organizer: 'Empowering university departments, research centers, and verified institutional leaders across Morocco to publish accredited summits, hackathons, and symposiums.',
}

export default function AuthPageLayout({
  variant,
  children,
}: {
  variant: keyof typeof introductions
  children: ReactNode
}) {
  return (
    <main className={`${styles.layout} ${styles[variant]}`}>
      <aside className={styles.hero} aria-label="About Younity">
        <p className={styles.brand}>
          <span className={styles.mark}><ReferenceIcon name="school" /></span>
          Younity
        </p>
        <div className={styles.heroCopy}>
          <p className={styles.heroTitle}>
            {variant === 'organizer' ? 'Connecting University Ambition with Civic Impact.' : (
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
