-- Queue complete, verified registrations that predate automatic submission.
INSERT INTO "organization_applications" ("id", "organization_id", "submitted_by_id", "status")
SELECT gen_random_uuid(), organization."id", owner."id", 'PENDING'
FROM "organizations" AS organization
JOIN "users" AS owner ON owner."id" = organization."owner_id"
WHERE owner."role" = 'ORGANIZER'
  AND owner."status" IN ('ACTIVE', 'PENDING')
  AND owner."email_verified_at" IS NOT NULL
  AND organization."verification_status" = 'PENDING'
  AND btrim(organization."org_name") <> ''
  AND btrim(organization."representative_FullName") <> ''
  AND btrim(organization."academic_position") <> ''
  AND btrim(organization."phone_number") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "organizations" AS other
    WHERE other."owner_id" = owner."id" AND other."id" <> organization."id"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "organization_applications" AS application
    WHERE application."organization_id" = organization."id"
  );
