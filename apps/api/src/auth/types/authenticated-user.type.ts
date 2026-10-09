import type { OrganizerApprovalStatus, Role } from '../../generated/prisma/enums.js'
export type AuthenticatedUser = {
	id: number;
	email: string;
	role: Role;
	organizerApprovalStatus: OrganizerApprovalStatus;
};
