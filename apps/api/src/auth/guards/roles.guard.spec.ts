import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { UserRole } from '../../generated/prisma/enums.js';

function permits(role: UserRole, user: unknown) {
  const reflector = { getAllAndOverride: () => [role] } as unknown as Reflector;
  const context = {
    getHandler: () => () => {}, getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return new RolesGuard(reflector).canActivate(context);
}
function organizer(status: string, verificationStatus: string) {
  return { role: 'ORGANIZER', status, ownedOrganizations: [{ id: 'org', verificationStatus }] };
}

describe('role and organizer approval enforcement', () => {
  it.each(['PENDING', 'NEEDS_CHANGES', 'REJECTED'])('blocks organizer-only access for %s organizations', (status) => {
    expect(permits(UserRole.ORGANIZER, organizer('ACTIVE', status))).toBe(false);
  });
  it('requires both active account and approved organization', () => {
    expect(permits(UserRole.ORGANIZER, organizer('PENDING', 'APPROVED'))).toBe(false);
    expect(permits(UserRole.ORGANIZER, organizer('ACTIVE', 'APPROVED'))).toBe(true);
  });
  it('preserves attendee access for pending organizers', () => {
    expect(permits(UserRole.STUDENT, organizer('PENDING', 'PENDING'))).toBe(true);
  });
  it('blocks suspended and incomplete organization contexts', () => {
    expect(permits(UserRole.ORGANIZER, organizer('SUSPENDED', 'APPROVED'))).toBe(false);
    expect(permits(UserRole.ORGANIZER, { role: 'ORGANIZER', status: 'ACTIVE', ownedOrganizations: [] })).toBe(false);
  });
  it('keeps active student/admin access restricted to their roles', () => {
    const student = { role: 'STUDENT', status: 'ACTIVE', ownedOrganizations: [] };
    expect(permits(UserRole.STUDENT, student)).toBe(true);
    expect(permits(UserRole.ORGANIZER, student)).toBe(false);
    expect(permits(UserRole.ADMIN, { role: 'ADMIN', status: 'ACTIVE', ownedOrganizations: [] })).toBe(true);
  });
})
