import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import {
  baselineRules,
  emptyEvent,
  EventUiError,
  formatLabels,
  type CategoryOption,
  type EventDraft,
  type EventField,
  type EventServices,
  type EventValues,
  type FieldErrors,
} from './model'
import { safeImageUrl, validateEvent } from './validation'
import { useEventResource } from './useEventResource'
import { EventIcon, EventState } from './EventUi'
import styles from './reference-event.module.css'
import SchedulePicker, { type SchedulePickerHandle } from './SchedulePicker'
import ReferencePreview, { ReferenceCover } from './ReferencePreview'

function Editor({
  service,
  initial,
  reload,
}: {
  service: EventServices
  initial?: EventDraft
  reload?: () => void
}) {
  const { requestProtected } = useAuth()
  const [values, setValues] = useState<EventValues>(() =>
    initial
      ? { ...initial.values, categoryIds: [...initial.values.categoryIds] }
      : { ...emptyEvent, categoryIds: [], registrationMode: service.registrationMode ?? '' },
  )
  const [id, setId] = useState(initial?.id)
  const [savedDraft, setSavedDraft] = useState<EventDraft | undefined>(() =>
    initial
      ? { ...initial, values: { ...initial.values, categoryIds: [...initial.values.categoryIds] } }
      : undefined,
  )
  const [errors, setErrors] = useState<FieldErrors>({})
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null)
  const [pending, setPending] = useState<'draft' | 'publish' | null>(null)
  const [locked, setLocked] = useState(false)
  const [denied, setDenied] = useState<EventUiError | null>(null)
  const [completed, setCompleted] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [schedulePending, setSchedulePending] = useState(false)
  const [resetNonce, setResetNonce] = useState(0)
  const [uploading, setUploading] = useState(false)
  const schedule = useRef<SchedulePickerHandle>(null)
  const uploadRequest = useRef<AbortController | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const request = useRef<AbortController | null>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const feedback = useRef<HTMLDivElement>(null)
  const rules = service.rules ?? {
    ...baselineRules,
    titleMaxLength: 100,
    descriptionMaxLength: 2000,
  }
  const loadCategories = useCallback(
    async (signal: AbortSignal) => {
      if (!service.categories) throw new EventUiError('unavailable')
      return service.categories({ request: requestProtected, signal })
    },
    [service, requestProtected],
  )
  const categories = useEventResource<CategoryOption[]>(loadCategories)
  useEffect(() => {
    title.current?.focus()
    return () => {
      request.current?.abort()
      uploadRequest.current?.abort()
    }
  }, [])
  useEffect(() => {
    if (notice) feedback.current?.focus()
  }, [notice])
  const busy = pending !== null || completed || uploading
  const availability =
    !service.saveDraft && !service.publish
      ? 'Saving and publishing are currently unavailable. Changes made here have not been saved.'
      : !service.publish
        ? 'Publishing is currently unavailable. You can still save a draft.'
        : 'Saving drafts is currently unavailable.'
  const fieldName = (field: EventField) => `event-${field}`
  function update<K extends EventField>(field: K, value: EventValues[K]) {
    setValues((current) => ({ ...current, [field]: value }))
    setDirty(true)
    if (notice && !locked) setNotice(null)
    setErrors((current) => ({
      ...current,
      [field]: undefined,
      ...(field === 'format' ? { location: undefined, onlineUrl: undefined } : {}),
      ...(field === 'registrationMode'
        ? { registrationDeadline: undefined, externalRegistrationUrl: undefined }
        : {}),
    }))
  }
  function validateField(field: EventField) {
    const result = validateEvent(values, 'publish', rules)
    setErrors((current) => ({
      ...current,
      [field]: result[field],
      ...(field === 'startDate' || field === 'endDate'
        ? { endDate: result.endDate, registrationDeadline: result.registrationDeadline }
        : {}),
    }))
  }
  async function perform(intent: 'draft' | 'publish') {
    if (
      request.current ||
      uploadRequest.current ||
      locked ||
      completed ||
      (intent === 'draft' ? !service.saveDraft : !service.publish)
    )
      return
    if (intent === 'publish' && (!values.registrationMode || (service.publishSavedOnly && id && dirty))) return
    if (schedulePending) {
      setNotice({ text: 'Apply or cancel your schedule changes before continuing.', error: true })
      return
    }
    const validation = validateEvent(values, intent, rules)
    setErrors(validation)
    if (Object.values(validation).some(Boolean)) {
      if (validation.categoryIds) setCategoriesOpen(true)
      setNotice({ text: 'Check the highlighted fields before continuing.', error: true })
      return
    }
    const controller = new AbortController()
    request.current = controller
    setPending(intent)
    setNotice(null)
    try {
      const input = {
        ...(id ? { id } : {}),
        values: { ...values, categoryIds: [...values.categoryIds] },
      }
      const context = { request: requestProtected, signal: controller.signal }
      if (intent === 'draft') {
        const saved = await service.saveDraft!(input, context)
        if (controller.signal.aborted) return
        if (
          !saved.id?.trim() ||
          (id && saved.id !== id) ||
          !Number.isFinite(Date.parse(saved.updatedAt))
        )
          throw new EventUiError('unavailable')
        setId(saved.id)
        setValues({ ...saved.values, categoryIds: [...saved.values.categoryIds] })
        setSavedDraft({
          ...saved,
          values: { ...saved.values, categoryIds: [...saved.values.categoryIds] },
        })
        setDirty(false)
        setResetNonce((value) => value + 1)
        setNotice({ text: 'Draft saved.', error: false })
      } else {
        const result = await service.publish!(input, context)
        if (controller.signal.aborted) return
        if (!result.message?.trim()) throw new EventUiError('unavailable')
        setCompleted(true)
        setNotice({ text: result.message, error: false })
      }
    } catch (cause) {
      if (controller.signal.aborted) return
      if (
        cause instanceof EventUiError &&
        (cause.kind === 'forbidden' || cause.kind === 'not-found')
      )
        setDenied(cause)
      else if (cause instanceof EventUiError && cause.kind === 'validation') {
        setErrors(cause.fields)
        if (cause.fields.categoryIds) setCategoriesOpen(true)
        setNotice({ text: cause.message, error: true })
      } else {
        setLocked(true)
        setNotice({
          text:
            cause instanceof EventUiError && cause.kind === 'conflict'
              ? cause.message
              : 'We could not confirm this action. Check your saved events before trying again. Your entered values are still here.',
          error: true,
        })
      }
    } finally {
      if (!controller.signal.aborted) {
        request.current = null
        setPending(null)
      }
    }
  }

  function focusField(field: EventField) {
    if (field === 'startDate' || field === 'endDate') {
      schedule.current?.focus(field)
      return
    }
    if (field === 'categoryIds') setCategoriesOpen(true)
    document.getElementById(fieldName(field))?.focus()
  }
  async function upload(file?: File) {
    if (!file || busy || locked || uploadRequest.current || !service.uploadBanner) return
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setNotice({ text: 'Choose a PNG, JPG or WebP image up to 5 MB.', error: true })
      return
    }
    const controller = new AbortController()
    uploadRequest.current = controller
    setUploading(true)
    try {
      const result = await service.uploadBanner(file, {
        request: requestProtected,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      if (!safeImageUrl(result.url)) throw new Error('Invalid image URL')
      update('imageUrl', result.url)
    } catch (cause) {
      if (controller.signal.aborted) return
      if (cause instanceof EventUiError && cause.kind === 'forbidden') setDenied(cause)
      else
        setNotice({
          text: 'The image upload could not be confirmed. Your event details are still here.',
          error: true,
        })
    } finally {
      if (!controller.signal.aborted) {
        uploadRequest.current = null
        setUploading(false)
        if (fileInput.current) fileInput.current.value = ''
      }
    }
  }
  function discard() {
    if (busy || locked) return
    if ((dirty || schedulePending) && !window.confirm('Discard your unsaved changes?')) return
    setValues(
      savedDraft
        ? { ...savedDraft.values, categoryIds: [...savedDraft.values.categoryIds] }
        : { ...emptyEvent, categoryIds: [], registrationMode: service.registrationMode ?? '' },
    )
    setErrors({})
    setNotice(null)
    setDirty(false)
    setSchedulePending(false)
    setResetNonce((value) => value + 1)
  }
  function field(
    field: Exclude<EventField, 'categoryIds' | 'format' | 'registrationMode' | 'description'>,
    label: string,
    options: {
      type?: string
      required?: boolean
      placeholder?: string
      icon?: string
      list?: string
      hint?: string
    } = {},
  ) {
    return (
      <div className={styles.field}>
        <label htmlFor={fieldName(field)}>
          <span>
            {label}
            {options.required && <span className={styles.required}> *</span>}
          </span>
          {field === 'title' && (
            <span className={styles.counter}>
              {Array.from(values.title).length} / {rules.titleMaxLength}
            </span>
          )}
        </label>
        <div className={options.icon ? styles.inputShell : undefined}>
          {options.icon && <EventIcon name={options.icon} />}
          <input
            id={fieldName(field)}
            name={field}
            aria-label={field === 'title' ? 'Event title' : undefined}
            value={values[field] ?? ''}
            type={options.type ?? 'text'}
            list={options.list}
            required={options.required}
            disabled={busy}
            placeholder={options.placeholder}
            min={field === 'capacity' ? 1 : undefined}
            aria-invalid={Boolean(errors[field])}
            aria-describedby={
              errors[field]
                ? `${fieldName(field)}-error`
                : options.hint
                  ? `${fieldName(field)}-hint`
                  : undefined
            }
            onChange={(event) => update(field, event.target.value)}
            onBlur={() => validateField(field)}
          />
        </div>
        {options.hint && (
          <p id={`${fieldName(field)}-hint`} className={styles.hint}>
            {options.hint}
          </p>
        )}
        {errors[field] && (
          <p id={`${fieldName(field)}-error`} className={styles.fieldError}>
            {errors[field]}
          </p>
        )}
      </div>
    )
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void perform('publish')
  }
  function actions(dock = false) {
    return (
      <>
        <button
          type="button"
          className={styles.saveButton}
          aria-label={dock ? 'Save draft from action dock' : undefined}
          disabled={busy || locked || schedulePending || !service.saveDraft}
          onClick={() => {
            void perform('draft')
          }}
        >
          {!dock && <EventIcon name="save" />}
          {pending === 'draft' ? 'Saving…' : 'Save draft'}
        </button>
        <button
          type="submit"
          form="create-event-form"
          aria-label={dock ? 'Publish event from action dock' : undefined}
          className={styles.primary}
          disabled={
            busy || locked || schedulePending || !service.publish || !values.registrationMode || Boolean(service.publishSavedOnly && id && dirty)
          }
        >
          {!dock && <EventIcon name="publish" />}
          {pending === 'publish' ? 'Publishing…' : dock ? 'Publish Event' : 'Publish'}
        </button>
      </>
    )
  }
  const accessError = denied ?? (categories.error?.kind === 'forbidden' ? categories.error : null)
  const selectedCategories =
    categories.data?.filter((option) => values.categoryIds.includes(option.id)) ?? []
  return (
    <div className={styles.workspace}>
      <main className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <Link className={styles.back} to="/organizer/events" aria-label="Back to my events">
              <EventIcon name="arrow_back" />
              My events
            </Link>
            <h1 ref={title} tabIndex={-1}>
              {id ? 'Edit Event' : 'Create Event'}
            </h1>
            <p className={styles.introduction}>Bring your campus together. Start with the details.</p>
          </div>
          {!accessError && (
            <div className={styles.actionRow} role="group" aria-label="Event actions">
              {actions()}
            </div>
          )}
        </header>
        {accessError ? (
          <EventState error={accessError} />
        ) : (
          <>
            {notice && (
              <div
                className={styles.notice}
                data-error={notice.error}
                ref={feedback}
                tabIndex={-1}
                role={notice.error ? 'alert' : 'status'}
              >
                <p>{notice.text}</p>
                {Object.values(errors).some(Boolean) && (
                  <ul>
                    {Object.entries(errors)
                      .filter(([, message]) => message)
                      .map(([key, message]) => (
                        <li key={key}>
                          {key === 'registrationMode' ? (
                            <span>{message}</span>
                          ) : (
                            <a
                              href={`#${fieldName(key as EventField)}`}
                              onClick={(event) => {
                                event.preventDefault()
                                focusField(key as EventField)
                              }}
                            >
                              {message}
                            </a>
                          )}
                        </li>
                      ))}
                  </ul>
                )}
                {savedDraft && !notice.error && !completed && (
                  <Link to={`/organizer/events/${encodeURIComponent(savedDraft.id)}/edit`}>Open saved draft</Link>
                )}
                {locked && (
                  <div className={styles.actionRow}>
                    {reload && (
                      <button type="button" onClick={reload}>
                        Reload saved draft
                      </button>
                    )}
                    <Link to="/organizer/events">Check saved events</Link>
                  </div>
                )}
              </div>
            )}
            <div className={styles.editorGrid}>
              <form
                id="create-event-form"
                className={styles.form}
                noValidate
                onSubmit={submit}
                aria-label="Event creation"
                aria-busy={pending !== null || uploading}
              >
                <section className={styles.card} aria-labelledby="event-details-heading">
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2 id="event-details-heading">Event Details</h2>
                      <p>
                        Give students a reason to be there.
                      </p>
                    </div>
                    <EventIcon name="info" />
                  </div>
                  {field('title', 'Event Title', {
                    required: true,
                    placeholder: 'Give your event a memorable name',
                  })}
                  <div className={styles.field}>
                    <label htmlFor="event-description">
                      Description <span className={styles.required}>*</span>
                    </label>
                    <textarea
                      id="event-description"
                      name="description"
                      rows={4}
                      value={values.description}
                      placeholder="Describe your event, agenda, speakers, prerequisites…"
                      required
                      disabled={busy}
                      aria-invalid={Boolean(errors.description)}
                      aria-describedby={errors.description ? 'event-description-error' : undefined}
                      onChange={(event) => update('description', event.target.value)}
                      onBlur={() => validateField('description')}
                    />
                    <div className={styles.descriptionHints}>
                      <span>
                        {Array.from(values.description).length}
                        {rules.descriptionMaxLength
                          ? ` / ${rules.descriptionMaxLength.toLocaleString('en-GB')}`
                          : ''}{' '}
                        characters
                      </span>
                    </div>
                    {errors.description && (
                      <p id="event-description-error" className={styles.fieldError}>
                        {errors.description}
                      </p>
                    )}
                  </div>
                  <fieldset
                    id="event-categoryIds"
                    className={styles.categories}
                    tabIndex={-1}
                    disabled={busy || categories.loading}
                    aria-describedby={errors.categoryIds ? 'event-categories-error' : undefined}
                  >
                    <legend>
                      Categories
                      {rules.categoryRequired && <span className={styles.required}> *</span>}
                    </legend>
                    <div className={styles.categoryPills}>
                      {selectedCategories.map((option) => (
                        <span key={option.id}>
                          {option.label}
                          <button
                            type="button"
                            aria-label={`Remove ${option.label}`}
                            onClick={() =>
                              update(
                                'categoryIds',
                                values.categoryIds.filter((id) => id !== option.id),
                              )
                            }
                          >
                            <EventIcon name="close" />
                          </button>
                        </span>
                      ))}
                      <button
                        type="button"
                        className={styles.addCategory}
                        disabled={!categories.data?.length}
                        aria-expanded={categoriesOpen}
                        onClick={() => setCategoriesOpen((value) => !value)}
                      >
                        <EventIcon name="add" />
                        Add Category
                      </button>
                      {!!categories.data?.length && (
                        <small className={styles.categorySuggestions}>
                          Suggested:{' '}
                          {categories.data
                            .filter((option) => !values.categoryIds.includes(option.id))
                            .slice(0, 3)
                            .map((option) => option.label)
                            .join(', ') || 'All categories selected'}
                        </small>
                      )}
                    </div>
                    {categories.loading ? (
                      <p className={styles.hint}>Loading categories…</p>
                    ) : categories.error ? (
                      <div className={styles.categoryError}>
                        <p className={styles.hint}>Categories are currently unavailable.</p>
                        {service.categories && (
                          <button type="button" onClick={categories.reload}>
                            Retry categories
                          </button>
                        )}
                      </div>
                    ) : categories.data?.length === 0 ? (
                      <p className={styles.hint}>No event categories available.</p>
                    ) : null}
                    {categoriesOpen && (
                      <div className={styles.categoryOptions}>
                        {categories.data?.map((option) => (
                          <label key={option.id}>
                            <input
                              type="checkbox"
                              checked={values.categoryIds.includes(option.id)}
                              onChange={(event) =>
                                update(
                                  'categoryIds',
                                  event.target.checked
                                    ? [...values.categoryIds, option.id]
                                    : values.categoryIds.filter((id) => id !== option.id),
                                )
                              }
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    )}
                    {errors.categoryIds && (
                      <p id="event-categories-error" className={styles.fieldError}>
                        {errors.categoryIds}
                      </p>
                    )}
                  </fieldset>
                </section>
                <section className={styles.card} aria-labelledby="event-format-heading">
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2 id="event-format-heading">Format &amp; Venue</h2>
                      <p>Choose a place, a format, and a time to meet.</p>
                    </div>
                  </div>
                  <fieldset
                    id="event-format"
                    tabIndex={-1}
                    disabled={busy}
                    aria-describedby={errors.format ? 'event-format-error' : undefined}
                  >
                    <legend>
                      Event Format <span className={styles.required}>*</span>
                    </legend>
                    <div className={styles.formatChoices}>
                      {(['IN_PERSON', 'ONLINE', 'HYBRID'] as const).map((format) => (
                        <label key={format}>
                          <input
                            type="radio"
                            name="format"
                            aria-label={formatLabels[format]}
                            checked={values.format === format}
                            onChange={() => update('format', format)}
                          />
                          <EventIcon
                            name={
                              format === 'IN_PERSON'
                                ? 'domain'
                                : format === 'ONLINE'
                                  ? 'videocam'
                                  : 'sync_alt'
                            }
                          />
                          <span>{formatLabels[format]}</span>
                          {values.format === format && <EventIcon name="check_circle" />}
                        </label>
                      ))}
                    </div>
                    {errors.format && (
                      <p id="event-format-error" className={styles.fieldError}>
                        {errors.format}
                      </p>
                    )}
                  </fieldset>
                  {values.format !== 'ONLINE' && (
                    <div className={styles.venueFields}>
                      <div className={styles.fieldRow}>
                        {field('location', 'Building / Venue Name', {
                          required: values.format === 'IN_PERSON' || values.format === 'HYBRID',
                          icon: 'location_on',
                          placeholder: 'Building or venue name',
                        })}
                        {service.venueDetails !== false && field('room', 'Room / Space', {
                          icon: 'meeting_room',
                          placeholder: 'Room or space',
                        })}
                      </div>
                      {service.venueDetails !== false && field('campus', 'Campus Location', {
                        icon: 'account_balance',
                        list: 'event-campus-options',
                        placeholder: 'Campus location',
                      })}
                      <datalist id="event-campus-options">
                        {service.campuses?.map((campus) => (
                          <option key={campus.id} value={campus.label} />
                        ))}
                      </datalist>
                    </div>
                  )}
                  <p className={styles.formatHint}>
                    <EventIcon name="info" />
                    Hosting online? Choose Online or Hybrid to add your meeting link.
                  </p>
                  {(values.format === 'ONLINE' || values.format === 'HYBRID') &&
                    field('onlineUrl', 'Online event link', {
                      type: 'url',
                      required: true,
                      icon: 'videocam',
                      placeholder: 'https://',
                    })}
                  <SchedulePicker
                    key={resetNonce}
                    ref={schedule}
                    start={values.startDate}
                    end={values.endDate}
                    disabled={busy}
                    errors={errors}
                    onEditingChange={setSchedulePending}
                    onApply={(start, end) => {
                      setValues((current) => ({ ...current, startDate: start, endDate: end }))
                      setDirty(true)
                      setErrors((current) => ({
                        ...current,
                        startDate: undefined,
                        endDate: undefined,
                      }))
                      if (!locked) setNotice(null)
                    }}
                  />
                </section>
                <section className={styles.card} aria-labelledby="event-registration-heading">
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2 id="event-registration-heading">Registration &amp; Ticketing</h2>
                      <p>Make room for your community and add the finishing touches.</p>
                    </div>
                  </div>
                  <div>
                    {field('capacity', 'Capacity (Max attendees)', {
                      type: 'number',
                      icon: 'group',
                      placeholder: 'e.g. 120',
                      hint: 'Set the maximum number of attendees.',
                    })}
                  </div>
                  {(values.registrationMode === 'AUTOMATIC' || (rules.draftCoreRequired && values.registrationDeadline)) &&
                    field(
                      'registrationDeadline',
                      `Registration deadline${values.registrationMode === 'AUTOMATIC' && rules.automaticDeadlineRequired ? '' : ' (optional)'}`,
                      {
                        type: 'datetime-local',
                        required: values.registrationMode === 'AUTOMATIC' && rules.automaticDeadlineRequired,
                        icon: 'schedule',
                      },
                    )}
                  {values.registrationMode === 'EXTERNAL' &&
                    field('externalRegistrationUrl', 'External registration link', {
                      type: 'url',
                      required: true,
                      icon: 'link',
                      placeholder: 'https://',
                    })}
                  <div className={styles.bannerField}>
                    <label>Event Banner Image</label>
                    <div
                      className={styles.bannerPanel}
                      onDragOver={(event) => {
                        if (service.uploadBanner) event.preventDefault()
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        void upload(event.dataTransfer.files[0])
                      }}
                    >
                      <div className={styles.bannerThumbnail}>
                        <ReferenceCover value={values.imageUrl} alt="Selected event banner" />
                        <span>{values.imageUrl ? 'Active image' : 'Example image'}</span>
                      </div>
                      <div className={styles.bannerCopy}>
                        <h3>
                          <EventIcon name="cloud_upload" />
                          Upload high-resolution header
                        </h3>
                        <p>
                          Drag and drop file here, or browse from local disk. PNG, JPG or WebP
                          (1200×630px recommended, max 5MB).
                        </p>
                        <input
                          ref={fileInput}
                          className={styles.srOnly}
                          type="file"
                          aria-label="Select event banner"
                          accept="image/png,image/jpeg,image/webp"
                          disabled={busy || locked || !service.uploadBanner}
                          onChange={(event) => {
                            void upload(event.target.files?.[0])
                          }}
                        />
                        <div className={styles.bannerActions}>
                          <button
                            type="button"
                            disabled={busy || locked || !service.uploadBanner}
                            onClick={() => fileInput.current?.click()}
                          >
                            <EventIcon name="file_upload" />
                            {uploading ? 'Uploading…' : 'Change photo'}
                          </button>
                          <button
                            type="button"
                            className={styles.remove}
                            disabled={busy || !values.imageUrl}
                            aria-label="Remove banner"
                            onClick={() => update('imageUrl', '')}
                          >
                            <EventIcon name="delete" />
                            Remove
                          </button>
                        </div>
                        {!service.uploadBanner && (
                          <p className={styles.hint}>
                            File upload is currently unavailable. You can use an image URL below.
                          </p>
                        )}
                      </div>
                    </div>
                    <details className={styles.imageUrl}>
                      <summary>Use image URL</summary>
                      {field('imageUrl', 'Event banner image URL (optional)', {
                        type: 'url',
                        placeholder: 'https://',
                        icon: 'link',
                      })}
                    </details>
                  </div>
                </section>
              </form>
              <ReferencePreview values={values} categories={categories.data ?? []} />
            </div>
            <aside className={styles.actionDock} aria-label="Action Dock">
              <div>
                <div className={styles.savedState}>
                  <span aria-hidden="true" data-saved={Boolean(savedDraft && !dirty)} />
                  {savedDraft
                    ? `Last saved ${new Date(savedDraft.updatedAt).toLocaleTimeString('en-GB')}${dirty ? ' · Unsaved changes' : ''}`
                    : dirty
                      ? 'Unsaved changes'
                      : 'Not saved yet'}
                  {(!service.saveDraft || !service.publish) && <p role="status">{availability}</p>}
                  {service.publish && !values.registrationMode && (
                    <p role="status">
                      Publishing is unavailable until the event integration supplies registration
                      settings.
                    </p>
                  )}
                  {service.publishSavedOnly && id && dirty && <p>Save your changes before publishing this draft.</p>}
                  {schedulePending && <p>Apply or cancel the schedule changes before saving.</p>}
                </div>
                <div className={styles.actionRow}>
                  <button
                    type="button"
                    className={styles.discard}
                    disabled={busy || locked}
                    onClick={discard}
                  >
                    Discard
                  </button>
                  {actions(true)}
                </div>
              </div>
            </aside>
          </>
        )}
      </main>
    </div>
  )
}

function SavedEditor({ id, service }: { id: string; service: EventServices }) {
  const { requestProtected } = useAuth()
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!service.draft) throw new EventUiError('unavailable')
      const snapshot = await service.draft(id, { request: requestProtected, signal })
      if (snapshot.id !== id) throw new EventUiError('unavailable')
      return snapshot
    },
    [id, service, requestProtected],
  )
  const resource = useEventResource(load)
  if (!resource.data)
    return (
      <div className={styles.workspace}>
      <main className={styles.page}>
        <section className={styles.card}>
          <Link to="/organizer/events">My events</Link>
          <EventState loading={resource.loading} error={resource.error} retry={resource.reload} />
        </section>
      </main>
      </div>
    )
  return (
    <Editor
      key={`${resource.data.id}:${resource.data.updatedAt}`}
      service={service}
      initial={resource.data}
      reload={resource.reload}
    />
  )
}
export default function EventCreationPage({ service }: { service: EventServices }) {
  const { eventId } = useParams()
  return eventId ? (
    <SavedEditor key={eventId} id={eventId} service={service} />
  ) : (
    <Editor service={service} />
  )
}
