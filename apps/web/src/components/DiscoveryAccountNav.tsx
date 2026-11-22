import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { AuthDestination } from '../auth/getAuthDestination'
import ReferenceIcon from './ReferenceIcon'
import styles from './ScrollHeader.module.css'

const accountLabels: Record<AuthDestination, string> = {
  '/student/dashboard': 'Edit profile',
  '/student/preferences': 'Continue registration',
  '/organizer/application': 'Continue registration',
  '/organizer/pending': 'Application status',
  '/organizer/status': 'Application status',
  '/organizer/approved': 'Application decision',
  '/organizer/dashboard': 'Organizer dashboard',
  '/admin/applications': 'Application reviews',
}

type Props = {
  destination: AuthDestination | null
  signOut: () => Promise<void>
}

export default function DiscoveryAccountNav({ destination, signOut }: Props) {
  const [open, setOpen] = useState(false)
  const controls = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return

    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !controls.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  return (
    <nav
      className={`${styles.header} ${styles.floating}`}
      aria-label="Account"
    >
      <Link to="/events" className={styles.brand} onClick={() => setOpen(false)}>
        <ReferenceIcon name="school" /> Younity
      </Link>

      <div
        ref={controls}
        className={styles.controls}
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
        }}
        onKeyDown={event => {
          if (event.key === 'Escape' && open) {
            event.stopPropagation()
            setOpen(false)
            trigger.current?.focus()
          }
        }}
      >
        <button
          ref={trigger}
          type="button"
          className={styles.trigger}
          aria-label="Account menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen(previous => !previous)}
        >
          <span className={styles.avatar}><ReferenceIcon name="person" /></span>
          <span className={styles.chevron}><ReferenceIcon name="expand_more" /></span>
        </button>

        <div id={menuId} className={styles.dropdown} hidden={!open}>
          {destination && (
            <Link to={destination === '/student/dashboard' ? '/student/profile' : destination} className={styles.accountItem} onClick={() => setOpen(false)}>
              <ReferenceIcon name="person" /> {accountLabels[destination]}
            </Link>
          )}
          <button
            type="button"
            className={styles.accountItem}
            onClick={() => {
              setOpen(false)
              void signOut().catch(() => undefined)
            }}
          >
            <ReferenceIcon name="logout" /> Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}
