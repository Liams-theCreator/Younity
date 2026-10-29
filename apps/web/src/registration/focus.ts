import { studentAccountFields } from './model'
import type { FieldErrors } from './model'

export function focusFirstError(errors: FieldErrors) {
  const field = [...studentAccountFields, 'university' as const, 'customUniversity' as const, 'acceptedPolicies' as const].find(
    (key) => errors[key],
  )
  if (field) document.getElementById(field)?.focus()
}
