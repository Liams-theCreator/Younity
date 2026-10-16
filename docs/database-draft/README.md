> Historical draft: implementation proceeded on 2026-10-13. See [the implemented foundation](../database-foundation.md) and `apps/api/prisma/schema.prisma` for current behavior.

# Database translation and setup draft

Review status: provisional. Based on the repository-root `db_diagram.sql`.
Nothing in this directory is loaded by the application or applied to a database.
The original SQL and the application's current Prisma schema are unchanged.

## Review artifacts

- `schema.prisma`: all 11 valid domain tables, all 12 supplied enums, a proposed missing registration enum, explicit join models, and the supplied indexes.
- This document: proposed migration/seed scripts, container startup ordering, seed scope, and verification steps. No migration has been generated or executed.

Prisma model/field names use PascalCase/camelCase. `@@map` and `@map` preserve table and column names, including `representative_FullName`. Native UUID, varchar lengths, text, and timestamp precision are preserved. `OpportunityFormat` maps to the SQL spelling `OppotunityFormat`; `ENVIRONMENT_ARGO` is preserved pending confirmation.

## Corrections and assumptions

1. The SQL references `RegistrationStatus` without defining it. The draft proposes `PENDING`, `CONFIRMED`, `REJECTED`, and `CANCELLED`, inferred from notification names. These values require confirmation; they are not supplied requirements.
2. The SQL makes `users.id` reference `student_profiles.user_id`. This would require every user, including organizers and admins, to have a student profile. The draft reverses the foreign key: a profile belongs to one user, and a user may have one profile.
3. `student_profiles_student_profiles` appears to be an accidental diagram self-join. Its foreign keys target non-unique enum columns and use unquoted enum type names that do not match the quoted PostgreSQL types. The draft omits this table.
4. `StudentProfile.interests` remains a single optional `Interests` value, and `StudentInterest` separately links users to categories, matching the source. Decide whether both representations are intended, whether interests should be multiple selections, and which representation personalization uses.
5. UUID primary keys receive Prisma `uuid()` defaults. Creation, submission, and registration timestamps default to `now()`. Update timestamps use `@updatedAt`. These are convenience proposals absent from the original SQL. UUID and updated-at behavior is managed by Prisma; raw SQL writers must supply those values.
6. Status fields, `isRead`, role, format, and registration mode have no guessed defaults. Required values must be supplied explicitly.
7. Foreign-key delete/update behavior is explicitly `NoAction`, matching PostgreSQL's source defaults. No cascade deletion policy is invented. This includes optional references: deleting a reviewer or related event requires an explicit policy or cleanup.
8. Prisma-generated foreign keys do not reproduce the SQL's `DEFERRABLE INITIALLY IMMEDIATE` declaration. If transactions must defer constraints, add and test the required clauses in the real migration SQL.
9. Timestamps remain `timestamp(6)` without timezone, as supplied. Agree on UTC handling or change to `timestamptz` before the first migration.
10. Student-role, organizer-role, reviewer permissions, event dates/capacity, mode-dependent registration links, and notification read-state consistency are not enforced by these relations. Plan application validation and any agreed database CHECK constraints separately. Email uniqueness currently follows PostgreSQL's case-sensitive string comparison; agree on normalization before signup implementation.

## Proposed database setup

After review, translate the accepted draft into `apps/api/prisma/schema.prisma`. Keep the application's existing client generator output (`../src/generated/prisma`), rather than copying the draft's isolated `./generated` output. Keep `prisma7.config.ts` as the CLI configuration.

Add these API scripts during implementation:

```json
{
  "prisma:validate": "prisma validate --config ./prisma7.config.ts",
  "db:migrate:dev": "prisma migrate dev --config ./prisma7.config.ts",
  "db:migrate:deploy": "prisma migrate deploy --config ./prisma7.config.ts",
  "db:seed": "prisma db seed --config ./prisma7.config.ts",
  "db:status": "prisma migrate status --config ./prisma7.config.ts"
}
```

Configure `migrations.seed` in `prisma7.config.ts` once the seed runner is chosen (for example `tsx prisma/seed.ts`, with `tsx` added as a development dependency). Prisma 7 migration commands do not implicitly generate the client or run seeds. Keep the existing explicit generation and prebuild hook.

Development workflow, after the accepted schema and scripts exist:

1. Start PostgreSQL with `docker compose up -d --wait db`.
2. For host-side Prisma commands, select `.nvmrc`, install API dependencies, and configure `apps/api/.env` with the same credentials as the root `.env`, using `127.0.0.1:5432`. The root Compose URL uses `db:5432` inside containers; do not pass that hostname to host-side commands.
3. From `apps/api`, run `npm run db:migrate:dev -- --name initial_foundation`. Review and commit the generated migration and `migration_lock.toml`. Use an isolated local database: `migrate dev` uses a shadow database and can propose a reset when history differs.
4. Run `npm run prisma:generate`, `npm run db:seed`, and `npm run db:status` explicitly.
5. Integrate `migrate deploy` into Compose startup before the API starts, using a one-shot migration service that waits for a healthy database. Have the API depend on its successful completion. Do not run `migrate dev` or an automatic database reset in `run.sh`.
6. Keep seeding explicit or behind a documented development option. Ordinary startup must not insert demo accounts or overwrite real data.

## Proposed seed scope

Use idempotent category upserts keyed by stable unique slugs. Category names/slugs should be agreed with the product team; the `Interests` enum suggests possible categories but does not define their mapping. No default administrator password should be committed.

If demo data is requested, use a separate development seed for student/organizer accounts, a profile, organization/application, event, category links, follows, registrations, and notifications. Supply passwords through explicit local environment variables and hash them with the authentication team's agreed algorithm. Use stable identifiers and do not overwrite existing passwords or approved records on reruns. This draft includes no credential-bearing seeds.

## Verification before integration

- Validate and generate the accepted schema; lint, build, and run API unit tests.
- Apply committed migrations with `migrate deploy` to a fresh isolated PostgreSQL database; check migration status.
- Run the seed twice and verify unchanged counts and unique constraints.
- Verify user creation without a profile, optional reviewer references, profile ownership, join composite keys, duplicate registration rejection, and declared deletion behavior.
- Run database integration/end-to-end tests using a separate test database.
- Check a clean Compose startup with migrations finishing before the API, HTTPS access, frontend API requests, and restart persistence.
- CI should start PostgreSQL and supply separate test credentials before migrations, seeds, and database-dependent tests. Avoid a production database in CI.

## Questions to settle

- Are the proposed registration status values correct?
- Should interests be one enum value, an enum array, category relations, or a combination?
- Is the final self-join table accidental, and is reversing the profile foreign key intended?
- Should enum spelling be corrected in PostgreSQL before the first migration?
- Which timestamp convention, lifecycle defaults, deletion policies, and initial categories are agreed?
- Does the foundation task cover every table, or only users/profiles/organizations initially?

## Draft validation commands

From the repository root, with API dependencies installed:

```bash
./apps/api/node_modules/.bin/prisma validate --schema docs/database-draft/schema.prisma
./apps/api/node_modules/.bin/prisma migrate diff --from-empty --to-schema docs/database-draft/schema.prisma --script --output docs/database-draft/initial-migration.sql
```

Validation passed. The migration-diff command exited successfully without producing SQL in this environment, including outside the sandbox. No empty migration artifact is retained; generate and inspect the DDL when preparing the real migration. These commands do not connect to PostgreSQL.
