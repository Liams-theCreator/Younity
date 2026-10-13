import ReferenceIcon from './ReferenceIcon'

type SelectOption = { value: string; label: string }

export default function RegistrationSelect({
  id,
  label,
  placeholder,
  options,
  value,
  error,
  onChange,
}: {
  id: string
  label: string
  placeholder: string
  options: readonly SelectOption[]
  value: string
  error?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="form-field registration-select-field">
      <div className="field-label">
        <label htmlFor={id}>{label}</label>
        <span className="required-hint">Required</span>
      </div>
      <div className="reference-select">
        <select
          id={id}
          name={id}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ReferenceIcon name="arrow_drop_down" />
      </div>
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}
