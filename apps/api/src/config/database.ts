// Database tools should not depend on HTTP server configuration.
export function validateDatabaseUrl(value: string | undefined): string {
  try {
    const url = new URL(value ?? '');
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      url.pathname.length <= 1
    ) {
      throw new Error();
    }
  } catch {
    throw new Error(
      'DATABASE_URL must be a PostgreSQL URL with a host and database name',
    );
  }
  return value!;
}
