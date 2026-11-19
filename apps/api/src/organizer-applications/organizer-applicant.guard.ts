import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { UserRole, UserStatus } from '../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

@Injectable()
export class OrganizerApplicantGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<{
			user?: AuthenticatedUser;
		}>();

		const user = request.user;
		if (!user) throw new UnauthorizedException();
		return user.role === UserRole.ORGANIZER && user.status !== UserStatus.SUSPENDED;

	}
}
