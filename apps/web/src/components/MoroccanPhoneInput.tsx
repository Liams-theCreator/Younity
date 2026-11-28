import { moroccanDialCode, moroccanNationalNumber } from '../registration/moroccanPhone'
import styles from './MoroccanPhoneInput.module.css'

export default function MoroccanPhoneInput({ id, name, value, onChange, required, error }: {
  id: string
  name: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  error?: string
}) {
  const existingInternationalNumber = value.startsWith('+') && !value.startsWith(moroccanDialCode)

  return (
    <>
      <div className={styles.control}>
        <span id={`${id}-dial-code`} className={styles.prefix}>
          <span aria-hidden="true" className={styles.flag}>🇲🇦</span>
          <span className="sr-only">Morocco country code </span>{moroccanDialCode}
        </span>
        <input
          id={id}
          name={name}
          type="tel"
          autoComplete="tel-national"
          placeholder="6 12 34 56 78"
          maxLength={255}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : `${id}-dial-code${existingInternationalNumber ? ` ${id}-existing` : ''}`}
          value={existingInternationalNumber ? '' : moroccanNationalNumber(value)}
          onChange={(event) => {
            const number = moroccanNationalNumber(event.currentTarget.value)
            onChange(number ? `${moroccanDialCode}${number}` : '')
          }}
        />
      </div>
      {existingInternationalNumber && (
        <p className={styles.existing} id={`${id}-existing`}>
          Saved number {value}. Enter a Moroccan number to replace it.
        </p>
      )}
    </>
  )
}
