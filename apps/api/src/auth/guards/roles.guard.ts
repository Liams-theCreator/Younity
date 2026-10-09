import { Injectable, UnauthorizedException, } from '@nestjs/common';
import type {CanActivate, ExecutionContext, } from '@nestjs/common';
import { Reflector } from '@nestjs/core'; 
import { Role, OrganizerApprovalStatus } from '../../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../types/authenticated-user.type.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const requiredRoles = this.reflector.getAllAndOverride<Role[]>(
			ROLES_KEY,
			[
				context.getHandler(),
				context.getClass(),
			],
		);
		if (requiredRoles === undefined)
			return true;
		const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
		if (!request.user)
			throw new UnauthorizedException();
		const user = request.user;

		const effectiveRole = user.role === Role.ORGANIZER && user.organizerApprovalStatus !== OrganizerApprovalStatus.APPROVED ? Role.STUDENT : user.role;
		return requiredRoles.includes(effectiveRole);
	}
}

