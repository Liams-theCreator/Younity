import { Injectable, UnauthorizedException, } from '@nestjs/common';
import type {CanActivate, ExecutionContext, } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, UserStatus, VerificationStatus } from '../../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../types/authenticated-user.type.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
			ROLES_KEY,
			[context.getHandler(), context.getClass()],
		);

		if (requiredRoles === undefined) {
			return true;
		}

		const request = context.switchToHttp().getRequest<{
			user?: AuthenticatedUser;
		}>();

		if (!request.user) {
			throw new UnauthorizedException();
		}

		const user = request.user;
    if (user.status === UserStatus.SUSPENDED) return false;
    if (user.role === UserRole.STUDENT && user.status !== UserStatus.ACTIVE) return false;
    const approvedOrganizer = user.status === UserStatus.ACTIVE &&
      user.ownedOrganizations.length === 1 &&
      user.ownedOrganizations[0]?.verificationStatus === VerificationStatus.APPROVED;
    const effectiveRole = user.role === UserRole.ORGANIZER && !approvedOrganizer
      ? UserRole.STUDENT : user.role;
    return requiredRoles.includes(effectiveRole);
	}
}
