-- CreateEnum
CREATE TYPE "OrganizerApprovalStatus" AS ENUM ('PENDING', 'APPROVED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "organizerApprovalStatus" "OrganizerApprovalStatus" NOT NULL DEFAULT 'PENDING';
