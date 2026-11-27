import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

@Injectable()
export class OptionalJwtGuard extends JwtAuthGuard {
  override handleRequest<TUser = AuthenticatedUser | undefined>(
    error: unknown,
    user: TUser | false,
  ): TUser {
    if (
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException
    ) {
      return undefined as TUser;
    }
    if (error) throw error;
    return (user || undefined) as TUser;
  }
}
