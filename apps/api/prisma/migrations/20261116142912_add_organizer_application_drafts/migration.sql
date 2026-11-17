-- CreateTable
CREATE TABLE "organizer_application_drafts" (
    "owner_id" UUID NOT NULL,
    "organization_name" VARCHAR(255),
    "type" "OrganizationType",
    "representative_full_name" VARCHAR(255),
    "academic_position" VARCHAR(255),
    "phone_number" VARCHAR(255),
    "proof_url" VARCHAR(512),
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "organizer_application_drafts_pkey" PRIMARY KEY ("owner_id")
);

-- AddForeignKey
ALTER TABLE "organizer_application_drafts" ADD CONSTRAINT "organizer_application_drafts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
