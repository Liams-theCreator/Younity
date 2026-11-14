// Match the API's email-verification/settings.ts contract. All browser callers
// share these values and the same email-only recovery context.
export const VERIFICATION_TTL_MINUTES = 10
const storageKey = 'younity.emailVerification'

export type VerificationContext = {
  flowId?: string
  recoveryToken?: string
  email: string
  resendAvailableAt: number
  deliveryFailed: boolean
}

export function rememberVerification(context: VerificationContext) {
  context = { ...context, flowId: context.flowId ?? crypto.randomUUID() }
  try { sessionStorage.setItem(storageKey, JSON.stringify(context)) } catch { /* Storage can be disabled. Router state still carries the email. */ }
  return context
}

export function resolveVerification(handoff?: VerificationContext): VerificationContext | null {
  const stored = readVerification()
  // Only reconcile updates from the same registration/recovery flow. A new
  // registration (even in the same tab) always owns its own handoff.
  return handoff ? stored?.flowId && stored.flowId === handoff.flowId ? stored : handoff : stored
}

export function readVerification(): VerificationContext | null {
  try {
    const context: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null')
    if (typeof context === 'object' && context !== null && 'email' in context && typeof context.email === 'string' &&
      'resendAvailableAt' in context && typeof context.resendAvailableAt === 'number' && Number.isFinite(context.resendAvailableAt) &&
      'deliveryFailed' in context && typeof context.deliveryFailed === 'boolean') return context as VerificationContext
  } catch { /* A fresh device or unavailable storage asks only for the email. */ }
  return null
}

export function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  return domain ? `${local.slice(0, 1)}***@${domain}` : 'your email address'
}
