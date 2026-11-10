import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

// Provision a new isolated database in the local Compose cluster. Never migrate
// or reset the developer database. Only remove the database created by this run.
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { parse } = require('dotenv');
const settings = parse(readFileSync(new URL('../.env', import.meta.url)));
const name = `email_verification_${randomUUID().replaceAll('-', '')}_test`;
const database = new URL(settings.API_DATABASE_URL);
database.hostname = '127.0.0.1';
database.port = '5432';
database.pathname = `/${name}`;
const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: database.href, TEST_DATABASE_URL: database.href, JWT_SECRET: settings.JWT_SECRET, JWT_TTL_SECONDS: '900', FRONTEND_ORIGIN: 'https://localhost:8443', EMAIL_VERIFICATION_SMTP_TEST: '1', SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', MAIL_FROM: 'Younity <no-reply@younity.test>' };

function run(command, args, cwd = root, commandEnv = process.env) {
  const result = spawnSync(command, args, { cwd, env: commandEnv, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
}
let created = false;
try {
  run('docker', ['compose', 'exec', '-T', 'db', 'sh', '-c', 'createdb -U "$POSTGRES_USER" "$1"', 'sh', name]);
  created = true;
  run('npm', ['run', 'db:setup'], `${root}apps/api`, env);
  run('npm', ['run', 'test:e2e', '--', '--maxWorkers=2'], `${root}apps/api`, env);
} finally {
  if (created) run('docker', ['compose', 'exec', '-T', 'db', 'sh', '-c', 'dropdb -U "$POSTGRES_USER" "$1"', 'sh', name]);
}
