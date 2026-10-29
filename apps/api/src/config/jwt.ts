import type { ConfigService } from '@nestjs/config';

export function jwtSettings(config: Pick<ConfigService, 'get'>) {
  const secret = config.get<unknown>('JWT_SECRET');
  const rawTtl = config.get<unknown>('JWT_TTL_SECONDS') ?? 900;
  const ttl = typeof rawTtl === 'number' ? rawTtl : typeof rawTtl === 'string' && /^\d+$/.test(rawTtl) ? Number(rawTtl) : NaN;
  if (typeof secret !== 'string' || !secret.trim() || secret.includes('REPLACE_WITH')) {
    throw new Error('Set JWT_SECRET to a generated secret');
  }
  if (!Number.isSafeInteger(ttl) || ttl <= 0) {
    throw new Error('JWT_TTL_SECONDS must be a positive integer number of seconds');
  }
  return { secret, ttl };
}
