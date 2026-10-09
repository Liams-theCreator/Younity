export function validateEnvironment(
	config: Record<string, unknown>,
) : Record<string, unknown> {
	const secret = config.JWT_SECRET;
	const rawLifetime = config.JWT_TTL_SECONDS;
	
	if (typeof secret !== 'string' || secret.trim() === '')
		throw new Error('JWT_SECRET is required');
	if (typeof rawLifetime !== 'string' || rawLifetime.trim() === '')
		throw new Error('JWT_TTL_SECONDS is required');
	const lifetime = Number(rawLifetime);
	if (!Number.isSafeInteger(lifetime) || lifetime <= 0)
		throw new Error('JWT_TTL_SECONDS must be a positive integer');

	return {
		...config,
		JWT_TTL_SECONDS: lifetime,
	};
}
