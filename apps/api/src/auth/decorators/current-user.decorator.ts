import { createParamDecorator, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../types/authenticated-user.type.js';

type RequestWithUser = Request & 
{
	user?: AuthenticatedUser;
};

export const CurrentUser = createParamDecorator(
	(_data: unknown, context: ExecutionContext): AuthenticatedUser => {
		const request = context.switchToHttp().getRequest<RequestWithUser>();
		if (!request.user)
			throw new UnauthorizedException();
		return (request.user);
	},
);

