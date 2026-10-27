import { SetMetadata } from '@nestjs/common';
import type { UserRole as Role } from '../../generated/prisma/enums.js';

export const ROLES_KEY = 'auth:roles';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
