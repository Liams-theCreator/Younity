import { jwtSettings } from './jwt.js';
import type { ConfigService } from '@nestjs/config';

function config(ttl: unknown, secret: unknown = 'unit-test-secret') {
  return { get: (key: string) => key === 'JWT_SECRET' ? secret : ttl } as Pick<ConfigService, 'get'>;
}

describe('JWT runtime configuration', () => {
  it('interprets environment TTL text as seconds rather than milliseconds', () => {
    expect(jwtSettings(config('900'))).toEqual({ secret: 'unit-test-secret', ttl: 900 });
    expect(jwtSettings(config(undefined)).ttl).toBe(900);
  });
  it.each(['', '0', '-1', '1.5', 'bad', Number.POSITIVE_INFINITY])('rejects invalid TTL %s', (ttl) => {
    expect(() => jwtSettings(config(ttl))).toThrow('JWT_TTL_SECONDS');
  });
  it.each([undefined, '', 'REPLACE_WITH_JWT_SECRET'])('rejects missing/placeholder secrets', (secret) => {
    const settings = { get: (key: string) => key === 'JWT_SECRET' ? secret : '900' } as Pick<ConfigService, 'get'>;
    expect(() => jwtSettings(settings)).toThrow('JWT_SECRET');
  });
});
