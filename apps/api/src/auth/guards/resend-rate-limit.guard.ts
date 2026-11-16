import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';

// Request-level protection, independent of account existence or delivery status.
// Expired entries are pruned and capacity is bounded. Per-account serialization
// remains in PostgreSQL, so multiple API instances cannot bypass that cooldown.
export const RESEND_REQUEST_LIMIT = 30;
export const RESEND_REQUEST_WINDOW_MS = 60_000;

@Injectable()
export class ResendRateLimitGuard implements CanActivate {
  private readonly requests = new Map<string, { count: number; until: number }>();

  canActivate(context: ExecutionContext): boolean {
    const now = Date.now();
    for (const [key, entry] of this.requests) {
      if (entry.until <= now) this.requests.delete(key);
    }
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const key = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    let entry = this.requests.get(key);
    if (!entry && this.requests.size < 10_000) {
      entry = { count: 0, until: now + RESEND_REQUEST_WINDOW_MS };
      this.requests.set(key, entry);
    }
    if (!entry || entry.count >= RESEND_REQUEST_LIMIT) {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Retry-After', Math.ceil(((entry?.until ?? now + RESEND_REQUEST_WINDOW_MS) - now) / 1000));
      throw new HttpException('Too many requests. Please try again shortly.', HttpStatus.TOO_MANY_REQUESTS);
    }
    entry.count++;
    return true;
  }
}
