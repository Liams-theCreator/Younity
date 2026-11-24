import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { EventIcon } from './EventUi'
import { dayKey, scheduleDuration } from './schedule'
import styles from './reference-event.module.css'

export type SchedulePickerHandle = { focus: (field: 'startDate' | 'endDate') => void }
function parseDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  return dayKey(date) === value ? date : null
}
function moveDay(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}
function moveMonth(date: Date, months: number) {
  const next = new Date(date)
  const day = next.getDate()
  next.setDate(1)
  next.setMonth(next.getMonth() + months)
  next.setDate(Math.min(day, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()))
  return next
}
function source(start: string, end: string) {
  return {
    day: start.split('T')[0] ?? '',
    endDay: end.split('T')[0] ?? '',
    start: start.split('T')[1]?.slice(0, 5) ?? '',
    end: end.split('T')[1]?.slice(0, 5) ?? '',
  }
}
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const presets = ['Today', 'Tomorrow', 'This Friday', 'Next Week', 'Next Month']
const SchedulePicker = forwardRef<
  SchedulePickerHandle,
  {
    start: string
    end: string
    disabled: boolean
    errors?: { startDate?: string; endDate?: string }
    onApply: (start: string, end: string) => void
    onEditingChange: (dirty: boolean) => void
  }
>(function SchedulePicker({ start, end, disabled, errors, onApply, onEditingChange }, ref) {
  const [today] = useState(() => new Date())
  const [stage, setStage] = useState(() => source(start, end))
  const [open, setOpen] = useState(true)
  const [focused, setFocused] = useState(() => parseDay(start.split('T')[0]) ?? today)
  const [preset, setPreset] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [customStart, setCustomStart] = useState(false)
  const [customEnd, setCustomEnd] = useState(false)
  const [focusTick, bumpFocus] = useReducer((value: number) => value + 1, 0)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const focusRequest = useRef<string | null>(null)
  useImperativeHandle(ref, () => ({
    focus(field) {
      setOpen(true)
      focusRequest.current = field === 'startDate' ? 'event-startDate' : 'event-endDate'
      bumpFocus()
    },
  }))
  useEffect(() => {
    if (open && focusRequest.current) {
      root.current
        ?.querySelector<HTMLElement>(
          focusRequest.current.startsWith('event-')
            ? `#${focusRequest.current}`
            : `[data-day="${focusRequest.current}"]`,
        )
        ?.focus()
      focusRequest.current = null
    }
  }, [open, focused, focusTick])
  const currentStart = stage.day && stage.start ? `${stage.day}T${stage.start}` : ''
  const currentEnd =
    (stage.endDay || stage.day) && stage.end ? `${stage.endDay || stage.day}T${stage.end}` : ''
  const duration = scheduleDuration(currentStart, currentEnd)
  const appliedDuration = scheduleDuration(start, end)
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const first = new Date(focused.getFullYear(), focused.getMonth(), 1, 12)
  const offset = (first.getDay() + 6) % 7
  const firstCell = moveDay(first, -offset)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const rows = Math.ceil((offset + last) / 7)
  function update(next: typeof stage) {
    setStage(next)
    setError('')
    const original = source(start, end)
    onEditingChange(JSON.stringify(next) !== JSON.stringify(original))
  }
  function selectDay(date: Date) {
    const day = dayKey(date)
    update({
      ...stage,
      day,
      endDay: !stage.endDay || stage.endDay === stage.day ? day : stage.endDay,
    })
    setFocused(date)
    setPreset(null)
  }
  function choosePreset(label: string) {
    let date = today
    if (label === 'Tomorrow') date = moveDay(today, 1)
    if (label === 'This Friday') date = moveDay(today, (5 - today.getDay() + 7) % 7)
    if (label === 'Next Week') date = moveDay(today, 7)
    if (label === 'Next Month') date = moveMonth(today, 1)
    selectDay(date)
    setPreset(label)
  }
  function cancel() {
    setStage(source(start, end))
    setOpen(false)
    setError('')
    onEditingChange(false)
    trigger.current?.focus()
  }
  function toggle() {
    if (open) {
      cancel()
      return
    }
    setStage(source(start, end))
    setFocused(parseDay(start.split('T')[0]) ?? today)
    setError('')
    setOpen(true)
  }
  function apply() {
    if (
      !parseDay(stage.day) ||
      !parseDay(stage.endDay || stage.day) ||
      !/^\d{2}:\d{2}$/.test(stage.start) ||
      !/^\d{2}:\d{2}$/.test(stage.end)
    ) {
      setError('Choose a date, start time and end time.')
      return
    }
    if (!duration) {
      setError('The end must be after the start.')
      return
    }
    onApply(currentStart, currentEnd)
    onEditingChange(false)
    setOpen(false)
    setError('')
    trigger.current?.focus()
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, date: Date) {
    let next: Date | undefined
    const day = (date.getDay() + 6) % 7
    switch (event.key) {
      case 'ArrowLeft':
        next = moveDay(date, -1)
        break
      case 'ArrowRight':
        next = moveDay(date, 1)
        break
      case 'ArrowUp':
        next = moveDay(date, -7)
        break
      case 'ArrowDown':
        next = moveDay(date, 7)
        break
      case 'Home':
        next = moveDay(date, -day)
        break
      case 'End':
        next = moveDay(date, 6 - day)
        break
      case 'PageUp':
        next = moveMonth(date, event.shiftKey ? -12 : -1)
        break
      case 'PageDown':
        next = moveMonth(date, event.shiftKey ? 12 : 1)
        break
    }
    if (next) {
      event.preventDefault()
      setFocused(next)
      focusRequest.current = dayKey(next)
      bumpFocus()
    }
  }
  function timeControl(kind: 'start' | 'end') {
    const custom = kind === 'start' ? customStart : customEnd
    const options = Array.from(
      { length: 48 },
      (_, index) => `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`,
    )
    if (stage[kind] && !options.includes(stage[kind])) options.push(stage[kind])
    options.sort()
    return (
      <div className={styles.timeField}>
        <label htmlFor={kind === 'start' ? 'event-startDate' : 'event-endDate'}>
          <span>{kind === 'start' ? 'Start Time' : 'End Time'}</span>
        </label>
        <div className={styles.inputShell}>
          <EventIcon name={kind === 'start' ? 'play_circle' : 'stop_circle'} />
          {custom ? (
            <input
              id={kind === 'start' ? 'event-startDate' : 'event-endDate'}
              type="time"
              value={stage[kind]}
              required
              disabled={disabled}
              aria-label={kind === 'start' ? 'Start date & time' : 'End date & time'}
              aria-invalid={Boolean(errors?.[kind === 'start' ? 'startDate' : 'endDate'])}
              aria-describedby={
                errors?.[kind === 'start' ? 'startDate' : 'endDate']
                  ? `event-${kind === 'start' ? 'startDate' : 'endDate'}-error`
                  : undefined
              }
              onChange={(event) => update({ ...stage, [kind]: event.target.value })}
            />
          ) : (
            <select
              id={kind === 'start' ? 'event-startDate' : 'event-endDate'}
              value={stage[kind]}
              required
              disabled={disabled}
              aria-label={kind === 'start' ? 'Start date & time' : 'End date & time'}
              aria-invalid={Boolean(errors?.[kind === 'start' ? 'startDate' : 'endDate'])}
              aria-describedby={
                errors?.[kind === 'start' ? 'startDate' : 'endDate']
                  ? `event-${kind === 'start' ? 'startDate' : 'endDate'}-error`
                  : undefined
              }
              onChange={(event) => {
                if (event.target.value === 'custom') {
                  if (kind === 'start') setCustomStart(true)
                  else setCustomEnd(true)
                  focusRequest.current = kind === 'start' ? 'event-startDate' : 'event-endDate'
                  bumpFocus()
                } else update({ ...stage, [kind]: event.target.value })
              }}
            >
              <option value="">Choose time</option>
              {options.map((time) => (
                <option key={time}>{time}</option>
              ))}
              <option value="custom">Custom time…</option>
            </select>
          )}
        </div>
      </div>
    )
  }
  const selectedDate = parseDay(stage.day)
  const appliedDate = parseDay(start.split('T')[0])
  return (
    <div
      ref={root}
      className={styles.schedule}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          event.stopPropagation()
          cancel()
        }
      }}
    >
      <div className={styles.scheduleLabel}>
        <label htmlFor="event-schedule-trigger">
          Event Schedule &amp; Timing <span className={styles.required}>*</span>
        </label>
        <span>
          <EventIcon name="schedule" />
          {zone}
        </span>
      </div>
      <button
        ref={trigger}
        type="button"
        id="event-schedule-trigger"
        className={styles.scheduleTrigger}
        aria-expanded={open}
        aria-controls="event-schedule-panel"
        disabled={disabled}
        onClick={toggle}
      >
        <span>
          <span className={styles.dateSummary}>
            <EventIcon name="calendar_month" />
            {appliedDate
              ? appliedDate.toLocaleDateString('en-GB', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Choose an event date'}
          </span>
          <span className={styles.timeSummary}>
            <EventIcon name="schedule" />
            {start && end
              ? `${start.split('T')[1]?.slice(0, 5)} – ${end.split('T')[1]?.slice(0, 5)}`
              : 'Set start and end times'}
          </span>
          {appliedDuration && (
            <span className={styles.durationBadge}>{appliedDuration} duration</span>
          )}
        </span>
        <span className={styles.changeSchedule}>
          Change
          <EventIcon name={open ? 'expand_less' : 'expand_more'} />
        </span>
      </button>
      {open && (
        <section
          id="event-schedule-panel"
          className={styles.schedulePanel}
          aria-label="Schedule picker"
        >
          <div className={styles.presets}>
            <span>Presets</span>
            <div>
              {presets.map((label) => (
                <button
                  type="button"
                  key={label}
                  aria-pressed={preset === label}
                  disabled={disabled}
                  onClick={() => choosePreset(label)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.scheduleGrid}>
            <div className={styles.calendar}>
              <div className={styles.monthHeading}>
                <strong aria-live="polite">
                  {focused.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </strong>
                <div>
                  <button
                    type="button"
                    aria-label="Previous calendar month"
                    disabled={disabled}
                    onClick={() => setFocused(moveMonth(focused, -1))}
                  >
                    <EventIcon name="chevron_left" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next calendar month"
                    disabled={disabled}
                    onClick={() => setFocused(moveMonth(focused, 1))}
                  >
                    <EventIcon name="chevron_right" />
                  </button>
                </div>
              </div>
              <table
                role="grid"
                className={styles.calendarGrid}
                aria-label={focused.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              >
                <thead>
                  <tr>
                    {weekdays.map((day) => (
                      <th key={day} scope="col" aria-label={day}>
                        {day.slice(0, 2)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: rows }, (_, week) => (
                    <tr key={week}>
                      {Array.from({ length: 7 }, (_, day) => {
                        const date = moveDay(firstCell, week * 7 + day)
                        const key = dayKey(date)
                        return (
                          <td key={key} role="gridcell" aria-selected={key === stage.day}>
                            <button
                              type="button"
                              disabled={disabled}
                              data-day={key}
                              data-selected={key === stage.day}
                              data-other-month={date.getMonth() !== focused.getMonth()}
                              aria-label={date.toLocaleDateString('en-GB', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })}
                              aria-current={key === dayKey(today) ? 'date' : undefined}
                              tabIndex={key === dayKey(focused) ? 0 : -1}
                              onKeyDown={(event) => navigate(event, date)}
                              onClick={() => selectDay(date)}
                            >
                              {date.getDate()}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.timeRange}>
              {timeControl('start')}
              {timeControl('end')}
              <label className={styles.endDay}>
                End date
                <input
                  type="date"
                  aria-label="Event end date"
                  value={stage.endDay || stage.day}
                  min={stage.day || undefined}
                  disabled={disabled}
                  onChange={(event) => update({ ...stage, endDay: event.target.value })}
                />
              </label>
              <div className={styles.duration}>
                <span>
                  <EventIcon name="timelapse" />
                  Calculated Duration:
                </span>
                <strong>{duration ?? '—'}</strong>
              </div>
              <p className={styles.timezoneNote}>
                <EventIcon name="public" />
                Timezone: {zone}
              </p>
            </div>
          </div>
          {error && (
            <p className={styles.fieldError} role="alert">
              {error}
            </p>
          )}
          <div className={styles.scheduleFooter}>
            <span>
              {selectedDate
                ? `Selected: ${selectedDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })} · ${stage.start || '—'} – ${stage.end || '—'}`
                : 'Select a date and time'}
            </span>
            <div>
              <button type="button" disabled={disabled} onClick={cancel}>
                Cancel
              </button>
              <button type="button" className={styles.primary} disabled={disabled} onClick={apply}>
                <EventIcon name="done" />
                Apply Schedule
              </button>
            </div>
          </div>
        </section>
      )}
      <p className={styles.hint}>Apply your schedule to confirm the event date and times.</p>
      {errors?.startDate && (
        <p id="event-startDate-error" className={styles.fieldError}>
          {errors.startDate}
        </p>
      )}
      {errors?.endDate && (
        <p id="event-endDate-error" className={styles.fieldError}>
          {errors.endDate}
        </p>
      )}
    </div>
  )
})
export default SchedulePicker
