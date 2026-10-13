import ReferenceIcon from './ReferenceIcon'
export default function PasswordFeedback({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters', met: Array.from(password).length >= 8 },
    { label: 'At least 1 number', met: /[0-9]/.test(password) },
    { label: 'Special symbol', met: /[^\p{L}\p{N}\s]/u.test(password) },
    { label: '1 uppercase letter', met: /\p{Lu}/u.test(password) },
  ]
  const score = checks.filter((check) => check.met).length
  const feedback = !password
    ? 'Not entered'
    : ['No checks met', 'Low', 'Medium', 'Good', 'All checks met'][score]
  return (
    <section className="password-feedback" aria-label="Password guidance">
      <div className="password-feedback-header">
        <span>Security strength</span>
        <span className="password-feedback-value" role="status" aria-live="polite">
          {feedback}
        </span>
      </div>
      <div
        className="password-bars"
        role="progressbar"
        aria-label="Suggested password checks met"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={score}
        aria-valuetext={`${score} of 4 suggested checks met`}
      >
        {checks.map((check, index) => (
          <span key={check.label} className={index < score ? 'is-filled' : ''} />
        ))}
      </div>
      <ul className="password-checks">
        {checks.map((check) => (
          <li key={check.label} className={check.met ? 'is-met' : ''}>
            <ReferenceIcon name={check.met ? 'check' : 'radio_button_unchecked'} />
            <span className="sr-only">{check.met ? 'Met: ' : 'Not yet met: '}</span>
            {check.label}
          </li>
        ))}
      </ul>
      <p className="password-guidance-note" id="password-guidance-note">
        Suggested checks only. This feedback does not guarantee password security.
      </p>
    </section>
  )
}
