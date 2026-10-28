import assert from 'node:assert/strict';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const base = new URL(process.env.AUTH_TEST_BASE_URL ?? 'https://localhost:8443');
assert.equal(base.protocol, 'https:');
assert.equal(base.hostname, 'localhost', 'Run against an isolated localhost test stack');
const ca = readFileSync(process.env.AUTH_TEST_CA_FILE);
const password = 'Verify-auth04-password-2026!';

function send(path, { method = 'GET', body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) };
    const request = https.request(new URL(path, base), { method, headers, ca, family: 4 }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => {
        let data;
        try { data = JSON.parse(text); } catch { data = null; }
        resolve({ status: response.statusCode, headers: response.headers, data, text });
      });
    });
    request.on('error', reject);
    request.setTimeout(10000, () => request.destroy(new Error('HTTPS test timed out')));
    request.end(body ? JSON.stringify(body) : undefined);
  });
}
function check(label) { console.log(`PASS ${label}`); }
async function signIn(email) {
  const response = await send('/api/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(response.status, 200, 'login succeeds');
  const cookie = response.headers['set-cookie']?.find((value) => value.startsWith('access_token='));
  assert.ok(cookie, 'login sets access_token');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=Lax/i);
  const sessionCookie = cookie.split(';')[0];
  const token = sessionCookie.slice('access_token='.length);
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  assert.equal(claims.exp - claims.iat, Number(process.env.JWT_TTL_SECONDS ?? 900), 'JWT lifetime is in seconds');
  return sessionCookie;
}

assert.equal((await send('/api/health')).status, 200);
assert.equal((await send('/api/auth/me')).status, 401);
check('HTTPS health and anonymous-session rejection');
const home = await send('/');
assert.equal(home.status, 200);
assert.match(home.text, /<title>Younity<\/title>/);
for (const asset of home.text.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)) {
  assert.equal((await send(asset[1])).status, 200);
}
check('production HTML and bundled assets are served over HTTPS');

const student = {
  firstName: 'Sara', lastName: 'Verification', email: `auth04-student-${randomUUID()}@example.test`,
  password, university: 'Verification Institute', interests: ['AI_DATA', 'ROBOTICS_IOT'],
  academicField: 'COMPUTER_SCIENCE', studyLevel: 'MASTER', opportunityFormat: 'HYBRID',
};
assert.equal((await send('/api/auth/register/student', { method: 'POST', body: { ...student, password: 'short' } })).status, 400);
const createdStudent = await send('/api/auth/register/student', { method: 'POST', body: student });
assert.equal(createdStudent.status, 201);
assert.deepEqual(createdStudent.data.studentProfile.interests, student.interests);
assert.equal(createdStudent.data.email, student.email);
assert.equal(createdStudent.data.passwordHash, undefined);
assert.equal((await send('/api/auth/register/student', { method: 'POST', body: student })).status, 409);
assert.equal((await send('/api/auth/login', { method: 'POST', body: { email: student.email, password: 'incorrect' } })).status, 401);
const studentCookie = await signIn(student.email);
const studentSession = await send('/api/auth/me', { cookie: studentCookie });
assert.equal(studentSession.status, 200);
assert.equal(studentSession.data.role, 'STUDENT');
assert.equal(studentSession.data.status, 'ACTIVE');
assert.equal(studentSession.data.organization, null);
assert.equal((await send('/api/auth/organizer-check', { cookie: studentCookie })).status, 403);
check('student registration, preference persistence, duplicate-email validation, login and role protection');

const organizer = {
  firstName: 'Sara', lastName: 'Verification', email: `auth04-organizer-${randomUUID()}@example.test`,
  password, organizationName: 'AUTH-04 verification club', type: 'STUDENT_CLUB',
  representativeFullName: 'Sara Verification', academicPosition: 'Coordinator', phoneNumber: '+212612345678',
};
const createdOrganizer = await send('/api/auth/register/organizer', { method: 'POST', body: organizer });
assert.equal(createdOrganizer.status, 201);
assert.equal(createdOrganizer.data.status, 'PENDING');
const organizerCookie = await signIn(organizer.email);
const pendingSession = await send('/api/auth/me', { cookie: organizerCookie });
assert.equal(pendingSession.status, 200);
assert.equal(pendingSession.data.role, 'ORGANIZER');
assert.equal(pendingSession.data.status, 'PENDING');
assert.equal(pendingSession.data.organization.verificationStatus, 'PENDING');
assert.equal((await send('/api/auth/organizer-check', { cookie: organizerCookie })).status, 403, 'pending organizers cannot use approved-organizer APIs');
check('organizer creation, cookie login, verified pending session and approval enforcement');

if (process.env.AUTH_TEST_DATABASE_URL) {
  const database = new URL(process.env.AUTH_TEST_DATABASE_URL);
  assert.ok(database.pathname.endsWith('_test'), 'Use a dedicated test database');
  assert.ok(['127.0.0.1', 'localhost'].includes(database.hostname));
  const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
  const { Client } = require('pg');
  const client = new Client({ connectionString: database.toString() });
  await client.connect();
  try {
    await client.query("UPDATE organizations SET verification_status = 'APPROVED' WHERE owner_id = $1", [pendingSession.data.id]);
    await client.query("UPDATE users SET status = 'ACTIVE' WHERE id = $1", [pendingSession.data.id]);
    const approved = await send('/api/auth/me', { cookie: organizerCookie });
    assert.equal(approved.data.status, 'ACTIVE');
    assert.equal(approved.data.organization.verificationStatus, 'APPROVED');
    assert.equal((await send('/api/auth/organizer-check', { cookie: organizerCookie })).status, 200);
    await client.query("UPDATE users SET status = 'SUSPENDED' WHERE id = $1", [studentSession.data.id]);
    assert.equal((await send('/api/auth/me', { cookie: studentCookie })).status, 403);
    await client.query("UPDATE users SET status = 'ACTIVE' WHERE id = $1", [studentSession.data.id]);
    check('approval refresh grants organizer access; suspension rejects existing sessions');
  } finally {
    await client.end();
  }
}

if (process.env.JWT_SECRET) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: studentSession.data.id, iat: now - 120, exp: now - 60 })).toString('base64url');
  const signature = createHmac('sha256', process.env.JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  assert.equal((await send('/api/auth/me', { cookie: `access_token=${header}.${payload}.${signature}` })).status, 401);
  check('expired session rejected by the real JWT strategy');
}
for (const cookie of [studentCookie, organizerCookie]) {
  const logout = await send('/api/auth/logout', { method: 'POST', cookie });
  assert.equal(logout.status, 204);
  assert.ok(logout.headers['set-cookie']?.some((value) => value.startsWith('access_token=;')), 'logout clears the browser cookie');
  assert.equal((await send('/api/auth/me')).status, 401);
}
check('logout clears browser session cookies and anonymous requests are rejected');
console.log('HTTPS registration/authentication smoke checks passed. This is an HTTP test, not a browser layout/console audit.');
