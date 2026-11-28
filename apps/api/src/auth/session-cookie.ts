import type { Response } from 'express';

export function writeSessionCookie(response: Response, token: string, ttlSeconds: number) {
  response.cookie('access_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ttlSeconds * 1000,
  });
}
