import { useRef, useState, type FormEvent } from 'react'
import { decisionLabels, type DecisionInput, type DecisionRule, type ReviewDecision } from './model'
import styles from './review.module.css'

type Props = {
  allowedDecisions: ReviewDecision[]
  rules: Record<ReviewDecision, DecisionRule>
  pending: boolean
  onSubmit: (input: DecisionInput) => Promise<void>
}

export default function DecisionForm({ allowedDecisions, rules, pending, onSubmit }: Props) {
  const [decision, setDecision] = useState<ReviewDecision | ''>('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const reasonRef = useRef<HTMLTextAreaElement>(null)
  const choiceRef = useRef<HTMLInputElement>(null)
  const locked = useRef(false)
  const rule = decision ? rules[decision] : null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || locked.current) return
    if (!decision || !allowedDecisions.includes(decision)) {
      setError('Choose a decision.')
      choiceRef.current?.focus()
      return
    }
    const selectedRule = rules[decision]
    if (selectedRule.reasonRequired && !reason.trim()) {
      setError('Enter a decision reason.')
      reasonRef.current?.focus()
      return
    }
    if (selectedRule.reasonMaxLength !== undefined && reason.length > selectedRule.reasonMaxLength) {
      setError(`Use at most ${selectedRule.reasonMaxLength} characters for the reason.`)
      reasonRef.current?.focus()
      return
    }
    locked.current = true
    setError(null)
    try {
      await onSubmit({ decision, reason: reason.trim() })
    } finally {
      locked.current = false
    }
  }

  if (!allowedDecisions.length) {
    return <p>This application has no available review actions.</p>
  }

  return (
    <form aria-label="Application decision" onSubmit={(event) => { void submit(event) }} noValidate aria-busy={pending}>
      <fieldset disabled={pending} aria-describedby={error ? 'decision-error' : undefined}>
        <legend>Choose a decision</legend>
        <div className={styles.choices}>
          {allowedDecisions.map((value, index) => (
            <label key={value}>
              <input
                ref={index === 0 ? choiceRef : undefined}
                type="radio"
                name="decision"
                value={value}
                checked={decision === value}
                onChange={() => { setDecision(value); setError(null) }}
              />
              {decisionLabels[value]}
            </label>
          ))}
        </div>
        <label htmlFor="decision-reason">Decision reason{rule ? rule.reasonRequired ? ' (required)' : ' (optional)' : ''}</label>
        <textarea
          id="decision-reason"
          ref={reasonRef}
          rows={5}
          value={reason}
          required={rule?.reasonRequired}
          aria-invalid={error !== null && decision !== '' ? true : undefined}
          aria-describedby={error ? 'decision-error' : 'decision-help'}
          onChange={(event) => { setReason(event.target.value); setError(null) }}
        />
        <p id="decision-help">Review the submitted information before confirming your decision.</p>
        {error && <p id="decision-error" role="alert">{error}</p>}
        <button type="submit" className={styles.primary} disabled={pending}>
          {pending ? 'Submitting decision…' : decision ? `Confirm: ${decisionLabels[decision]}` : 'Confirm decision'}
        </button>
      </fieldset>
    </form>
  )
}
