import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import ReferenceIcon from './ReferenceIcon'
import styles from './ScrollHeader.module.css'

type Props = {
  destination: string | null
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
            <Link to={destination} className={styles.accountItem} onClick={() => setOpen(false)}>
              <ReferenceIcon name="person" /> Your account
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
