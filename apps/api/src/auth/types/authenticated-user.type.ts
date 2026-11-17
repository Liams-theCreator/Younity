import type {
  UserRole,
  UserStatus,
  VerificationStatus,
} from '../../generated/prisma/enums.js';

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  ownedOrganizations: {
    id: string;
    verificationStatus: VerificationStatus;
  }[];
};
