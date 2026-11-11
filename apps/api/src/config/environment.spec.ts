import { validateEnvironment } from './environment.js';

const valid = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/younity',
  FRONTEND_ORIGIN: 'https://localhost:8443',
};

describe('environment validation', () => {
  it('accepts the local HTTPS verification origin', () => {
    expect(() => validateEnvironment(valid)).not.toThrow();
  });
  it.each([undefined, '', '   '])('requires FRONTEND_ORIGIN (%s)', (origin) => {
    expect(() => validateEnvironment({ ...valid, FRONTEND_ORIGIN: origin })).toThrow('FRONTEND_ORIGIN is required');
  });
  it.each(['bad', 'localhost:8443', 'ftp://localhost', 'https://localhost/path', 'https://localhost/', 'https://user:secret@localhost', 'https://localhost?x=1', 'https://localhost#fragment', ' https://localhost'])('rejects malformed FRONTEND_ORIGIN (%s)', (origin) => {
    expect(() => validateEnvironment({ ...valid, FRONTEND_ORIGIN: origin })).toThrow('FRONTEND_ORIGIN');
  });
  it('provides development defaults', () => {
    expect(validateEnvironment(valid)).toMatchObject({
      port: 3000,
      nodeEnv: 'development',
    });
  });
  it.each(['0', '65536', '3.5', 'abc', ''])(
    'rejects invalid port %s',
    (port) => {
      expect(() => validateEnvironment({ ...valid, PORT: port })).toThrow(
        'PORT',
      );
    },
  );
  it.each([
    undefined,
    'invalid',
    'https://localhost/db',
    'postgresql://localhost/',
  ])('rejects invalid database URLs', (url) => {
    expect(() => validateEnvironment({ DATABASE_URL: url })).toThrow(
      'DATABASE_URL',
    );
  });
  it('does not leak database credentials in errors', () => {
    expect(() =>
      validateEnvironment({ DATABASE_URL: 'secret-password' }),
    ).toThrow(/^DATABASE_URL must/);
  });
  it('requires explicit production origins', () => {
    expect(() =>
      validateEnvironment({ ...valid, NODE_ENV: 'production' }),
    ).toThrow('CORS_ORIGINS');
  });
  it.each([
    '*',
    'https://example.com/path',
    'https://example.com,',
    'https://user:password@example.com',
  ])('rejects invalid origins', (origin) => {
    expect(() =>
      validateEnvironment({ ...valid, CORS_ORIGINS: origin }),
    ).toThrow('CORS_ORIGINS');
  });
  it('accepts explicit production origins', () => {
    expect(
      validateEnvironment({
        ...valid,
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://example.com',
      }).corsOrigins,
    ).toEqual(['https://example.com']);
  });
  it('rejects an unknown environment', () => {
    expect(() =>
      validateEnvironment({ ...valid, NODE_ENV: 'invalid' }),
    ).toThrow('NODE_ENV');
  });
});
