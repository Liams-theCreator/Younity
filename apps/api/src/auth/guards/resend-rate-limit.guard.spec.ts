import type { ExecutionContext } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResendRateLimitGuard, RESEND_REQUEST_LIMIT, RESEND_REQUEST_WINDOW_MS } from './resend-rate-limit.guard.js';

describe('ResendRateLimitGuard', () => {
  afterEach(() => vi.useRealTimers());
  it('limits requests per client and resets after the window', () => {
    vi.useFakeTimers();
    const guard = new ResendRateLimitGuard();
    const response = { setHeader: vi.fn() };
    const context = (ip: string) => ({ switchToHttp: () => ({ getRequest: () => ({ ip }), getResponse: () => response }) }) as unknown as ExecutionContext;
    for (let i = 0; i < RESEND_REQUEST_LIMIT; i++) expect(guard.canActivate(context('192.0.2.1'))).toBe(true);
    expect(() => guard.canActivate(context('192.0.2.1'))).toThrow('Too many requests');
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', 60);
    expect(guard.canActivate(context('192.0.2.2'))).toBe(true);
    vi.advanceTimersByTime(RESEND_REQUEST_WINDOW_MS);
    expect(guard.canActivate(context('192.0.2.1'))).toBe(true);
  });
});
