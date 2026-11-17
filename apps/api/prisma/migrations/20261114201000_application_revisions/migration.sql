-- AlterTable
ALTER TABLE "organization_applications" ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "application_decisions" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "application_decisions" ALTER COLUMN "revision" DROP DEFAULT;
ALTER TABLE "organization_applications" ADD CONSTRAINT "application_revision_positive" CHECK (revision >= 1);
ALTER TABLE "application_decisions" ADD CONSTRAINT "decision_valid_transition" CHECK (old_status = 'PENDING' AND new_status IN ('APPROVED', 'REJECTED', 'NEEDS_CHANGES') AND revision >= 1 AND char_length(btrim(reason)) BETWEEN 1 AND 100);
CREATE UNIQUE INDEX "application_decisions_application_revision_key" ON "application_decisions" (application_id, revision);
