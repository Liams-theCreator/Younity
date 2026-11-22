export const VERIFICATION_TTL_MINUTES = 10;
export const VERIFICATION_RECOVERY_AUDIENCE = 'email-verification-recovery';

export const VERIFICATION_RECOVERY_TTL_SECONDS = 24 * 60 * 60;
export const REGISTRATION_VERIFICATION_COOKIE = 'registration_verification';
export const registrationVerificationCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/api/email-verification/verify-email',
} as const;
