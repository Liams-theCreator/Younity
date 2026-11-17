-- CreateTable
CREATE TABLE "application_decisions" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "old_status" "VerificationStatus" NOT NULL,
    "new_status" "VerificationStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_emails" (
    "id" UUID NOT NULL,
    "decision_id" UUID NOT NULL,
    "recipient" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "next_attempt_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claim_token" UUID,
    "claimed_until" TIMESTAMP(6),
    "sent_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "application_decisions_application_id_created_at_id_idx" ON "application_decisions"("application_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "application_decisions_admin_id_idx" ON "application_decisions"("admin_id");

-- CreateIndex
CREATE UNIQUE INDEX "decision_emails_decision_id_key" ON "decision_emails"("decision_id");

-- CreateIndex
CREATE INDEX "decision_emails_status_next_attempt_at_idx" ON "decision_emails"("status", "next_attempt_at");

-- AddForeignKey
ALTER TABLE "application_decisions" ADD CONSTRAINT "application_decisions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "organization_applications"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_decisions" ADD CONSTRAINT "application_decisions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_emails" ADD CONSTRAINT "decision_emails_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "application_decisions"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

