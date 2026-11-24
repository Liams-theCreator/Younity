import { baselineRules, type EventRules, type EventValues, type FieldErrors } from './model'
export function safeImageUrl(value: string) {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}
function timestamp(value: string) {
  return value ? new Date(value).getTime() : NaN
}
export function validateEvent(
  values: EventValues,
  intent: 'draft' | 'publish',
  rules: EventRules = baselineRules,
): FieldErrors {
  const errors: FieldErrors = {}
  if (values.format && !['IN_PERSON', 'ONLINE', 'HYBRID'].includes(values.format))
    errors.format = 'Choose a supported event format.'
  if (values.registrationMode && !['AUTOMATIC', 'EXTERNAL'].includes(values.registrationMode))
    errors.registrationMode = 'Choose a supported registration mode.'
  if (Array.from(values.title.trim()).length > rules.titleMaxLength)
    errors.title = `Use at most ${rules.titleMaxLength} characters.`
  if (
    rules.descriptionMaxLength !== undefined &&
    Array.from(values.description).length > rules.descriptionMaxLength
  )
    errors.description = `Use at most ${rules.descriptionMaxLength} characters.`
  for (const field of [
    'startDate',
    'endDate',
    ...(values.registrationMode === 'AUTOMATIC' ? (['registrationDeadline'] as const) : []),
  ] as const) {
    if (
      values[field] &&
      (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(values[field]) ||
        !Number.isFinite(timestamp(values[field])))
    )
      errors[field] = 'Enter a valid date and time.'
  }
  if (
    values.startDate &&
    values.endDate &&
    timestamp(values.endDate) <= timestamp(values.startDate)
  )
    errors.endDate = 'The end must be after the start.'
  if (
    values.registrationMode === 'AUTOMATIC' &&
    values.registrationDeadline &&
    values.startDate &&
    timestamp(values.registrationDeadline) > timestamp(values.startDate)
  )
    errors.registrationDeadline = 'The deadline must not be after the event starts.'
  if (
    values.capacity &&
    (!/^[1-9]\d*$/.test(values.capacity) || !Number.isSafeInteger(Number(values.capacity)))
  )
    errors.capacity = 'Enter a positive whole number, or leave capacity blank.'
  const urls = [
    'imageUrl',
    ...(values.format === 'ONLINE' || values.format === 'HYBRID' ? ['onlineUrl'] : []),
    ...(values.registrationMode === 'EXTERNAL' ? ['externalRegistrationUrl'] : []),
  ] as const
  for (const field of urls) {
    const key = field as 'imageUrl' | 'onlineUrl' | 'externalRegistrationUrl'
    if (values[key] && !safeImageUrl(values[key]))
      errors[key] = 'Enter a complete http:// or https:// link without credentials.'
  }
  if (intent === 'publish') {
    for (const field of [
      'title',
      'description',
      'format',
      'startDate',
      'endDate',
      'registrationMode',
    ] as const) {
      if (!values[field].trim()) errors[field] = 'Required before publishing.'
    }
    if (rules.categoryRequired && !values.categoryIds.length)
      errors.categoryIds = 'Choose at least one category.'
    if ((values.format === 'IN_PERSON' || values.format === 'HYBRID') && !values.location.trim())
      errors.location = 'Enter the event location.'
    if ((values.format === 'ONLINE' || values.format === 'HYBRID') && !values.onlineUrl.trim())
      errors.onlineUrl = 'Enter the online event link.'
    if (values.registrationMode === 'EXTERNAL' && !values.externalRegistrationUrl.trim())
      errors.externalRegistrationUrl = 'Enter the external registration link.'
    if (
      values.registrationMode === 'AUTOMATIC' &&
      rules.automaticDeadlineRequired &&
      !values.registrationDeadline
    )
      errors.registrationDeadline = 'Enter the registration deadline.'
  }
  return errors
}
