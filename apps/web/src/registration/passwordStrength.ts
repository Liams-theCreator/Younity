export function passwordChecks(password: string) {
  return [
    { label: '8+ characters', met: Array.from(password).length >= 8 },
    { label: 'At least 1 number', met: /[0-9]/.test(password) },
    { label: 'Special symbol', met: /[^\p{L}\p{N}\s]/u.test(password) },
    { label: '1 uppercase letter', met: /\p{Lu}/u.test(password) },
  ]
}

export function meetsMinimumPasswordStrength(password: string) {
  return passwordChecks(password).every((check) => check.met)
}
