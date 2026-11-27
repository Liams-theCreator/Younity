CREATE TABLE "organizer_proofs" (
    "id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "media_type" VARCHAR(40) NOT NULL,
    "data" BYTEA NOT NULL,
    "organization_id" UUID,
    "draft_owner_id" UUID,

    CONSTRAINT "organizer_proofs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "organizer_proofs_one_owner" CHECK (num_nonnulls("organization_id", "draft_owner_id") = 1)
);

CREATE UNIQUE INDEX "organizer_proofs_organization_id_key" ON "organizer_proofs"("organization_id");
CREATE UNIQUE INDEX "organizer_proofs_draft_owner_id_key" ON "organizer_proofs"("draft_owner_id");

ALTER TABLE "organizer_proofs" ADD CONSTRAINT "organizer_proofs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organizer_proofs" ADD CONSTRAINT "organizer_proofs_draft_owner_id_fkey" FOREIGN KEY ("draft_owner_id") REFERENCES "organizer_application_drafts"("owner_id") ON DELETE CASCADE ON UPDATE CASCADE;
