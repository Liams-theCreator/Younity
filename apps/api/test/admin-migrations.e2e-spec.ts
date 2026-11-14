import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';

const before = [
  '20261013000000_initial_foundation',
  '20261026120143_student_profile_interests_array',
  '20261107181501_add_email_verification_tokens',
];
const added = [
  '20261114200000_admin_decisions',
  '20261114201000_application_revisions',
];

describe('S2-09 forward migrations', () => {
  it.each([false, true])(
    'preserves data when migrating populated=%s isolated schema',
    async (populated) => {
      const url = process.env.TEST_DATABASE_URL;
      if (!url || !new URL(url).pathname.endsWith('_test'))
        throw new Error('Dedicated TEST_DATABASE_URL ending in _test required');
      const client = new Client({ connectionString: url });
      await client.connect();
      await client.query('BEGIN');
      try {
        const schema = `migration_${randomUUID().replaceAll('-', '')}`;
        await client.query(`CREATE SCHEMA "${schema}"`);
        await client.query(`SET LOCAL search_path TO "${schema}"`);
        for (const name of before)
          await client.query(
            await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'),
          );
        const owner = randomUUID(),
          org = randomUUID(),
          application = randomUUID();
        if (populated) {
          await client.query(
            `INSERT INTO users (id, last_name, first_name, email, password_hash, role, status, updated_at)
          VALUES ($1, 'Test', 'Migration', 'migration@example.invalid', 'unused', 'ORGANIZER', 'PENDING', now())`,
            [owner],
          );
          await client.query(
            `INSERT INTO organizations (id, owner_id, org_name, type, "representative_FullName", academic_position, phone_number, verification_status, updated_at)
          VALUES ($1, $2, 'Migration fixture', 'STUDENT_CLUB', 'Test', 'Student', '000', 'PENDING', now())`,
            [org, owner],
          );
          await client.query(
            `INSERT INTO organization_applications (id, organization_id, submitted_by_id, status)
          VALUES ($1, $2, $3, 'PENDING')`,
            [application, org, owner],
          );
        }
        for (const name of added)
          await client.query(
            await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'),
          );
        const result = await client.query(
          'SELECT id, revision, status FROM organization_applications',
        );
        expect(result.rows).toEqual(
          populated
            ? [{ id: application, revision: 1, status: 'PENDING' }]
            : [],
        );
        expect(
          (await client.query('SELECT * FROM application_decisions')).rows,
        ).toEqual([]);
        expect(
          (await client.query('SELECT * FROM decision_emails')).rows,
        ).toEqual([]);
        if (populated) {
          await client.query('SAVEPOINT invalid_revision');
          await expect(
            client.query(
              'UPDATE organization_applications SET revision = 0 WHERE id = $1',
              [application],
            ),
          ).rejects.toMatchObject({ code: '23514' });
          await client.query('ROLLBACK TO SAVEPOINT invalid_revision');
          await client.query('SAVEPOINT invalid_fk');
          await expect(
            client.query(
              `INSERT INTO application_decisions (id, application_id, admin_id, old_status, new_status, reason, revision)
          VALUES ($1, $2, $3, 'PENDING', 'APPROVED', 'ok', 1)`,
              [randomUUID(), randomUUID(), owner],
            ),
          ).rejects.toMatchObject({ code: '23503' });
          await client.query('ROLLBACK TO SAVEPOINT invalid_fk');
        }
      } finally {
        // Includes schema and fixtures: no changes to existing test data.
        await client.query('ROLLBACK');
        await client.end();
      }
    },
  );
});
