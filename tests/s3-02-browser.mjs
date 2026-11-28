// Real browser/API/PostgreSQL acceptance check. No route interception or API mocks.
// Setup and invocation are documented in docs/s3-02-verification.md.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.S302_PLAYWRIGHT_MODULE ?? 'playwright-core');
const { Client } = require('../apps/api/node_modules/pg');
const base = process.env.S302_BASE_URL ?? 'http://localhost:5174';
const databaseUrl = process.env.TEST_DATABASE_URL;
assert.equal(new URL(base).hostname, 'localhost');
assert.ok(databaseUrl && new URL(databaseUrl).pathname.endsWith('_browser_test'), 'Dedicated *_browser_test database required');
assert.ok(process.env.S302_PASSWORD, 'S302_PASSWORD required');
const output = path.resolve(process.env.S302_EVIDENCE_DIR ?? '.local/s3-02/browser');
await mkdir(output, { recursive: true });
const db = new Client({ connectionString: databaseUrl });
const lock = new Client({ connectionString: databaseUrl });
await db.connect();
await lock.connect();
const browser = await chromium.launch({ executablePath: process.env.S302_CHROMIUM ?? '/usr/bin/chromium', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'UTC' });
const page = await context.newPage();
page.setDefaultTimeout(10000);
const evidence = { base, database: new URL(databaseUrl).pathname.slice(1), browser: browser.version(), checks: [], writes: [], errors: [] };
const pendingResponses = [];
page.on('pageerror', error => evidence.errors.push(error.message));
page.on('response', response => {
  const req = response.request();
  if (new URL(req.url()).pathname.startsWith('/api/organizer-events') && ['POST', 'PATCH'].includes(req.method())) {
    pendingResponses.push((async () => evidence.writes.push({ method: req.method(), path: new URL(req.url()).pathname, body: req.postDataJSON(), status: response.status(), response: await response.json() }))());
  }
});
const check = (name, detail = {}) => { evidence.checks.push({ name, ...detail }); console.log(`PASS ${name} ${JSON.stringify(detail)}`); };
async function visible(text) { await page.getByText(text, { exact: true }).waitFor({ state: 'visible' }); }
async function form(title, category) {
  await page.goto(`${base}/organizer/events/new`);
  await page.getByLabel('Event Title', { exact: false }).fill(title);
  await page.getByLabel('Description', { exact: false }).fill('Real S3-02 browser acceptance fixture.');
  await page.getByRole('button', { name: 'Add Category', exact: true }).click();
  await page.getByRole('checkbox', { name: category.name, exact: true }).check();
  await page.getByRole('radio', { name: 'Online', exact: true }).check();
  await page.getByLabel('Online event link', { exact: false }).fill('https://example.test/s302-meeting');
  await page.getByRole('button', { name: 'Next Week', exact: true }).click();
  await page.getByLabel('Start date & time', { exact: true }).selectOption('10:00');
  await page.getByLabel('End date & time', { exact: true }).selectOption('12:00');
  await page.getByRole('button', { name: 'Apply Schedule', exact: true }).click();
  const deadline = new Date(); deadline.setUTCDate(deadline.getUTCDate() + 6); deadline.setUTCHours(9, 0, 0, 0);
  await page.getByLabel('Registration deadline', { exact: false }).fill(deadline.toISOString().slice(0, 16));
  await page.getByLabel('Capacity (Max attendees)', { exact: false }).fill('50');
}
const save = () => page.getByRole('button', { name: 'Save draft', exact: true });
const publish = () => page.getByRole('button', { name: 'Publish', exact: true });
async function keyboard(button) { await button.focus(); await page.keyboard.press('Enter'); }
async function writeResponse(action) {
  const result = page.waitForResponse(r => new URL(r.url()).pathname.startsWith('/api/organizer-events') && ['POST', 'PATCH'].includes(r.request().method()));
  await action();
  const response = await result;
  return { status: response.status(), body: await response.json() };
}
async function event(id) {
  return (await db.query('SELECT e.id, e.title, e.status, e.registration_mode, array_agg(ec.category_id ORDER BY ec.category_id) AS category_ids FROM events e JOIN event_categories ec ON ec.event_id=e.id WHERE e.id=$1 GROUP BY e.id', [id])).rows[0];
}
async function pendingWrite(button, actionName) {
  const before = (await db.query('SELECT count(*)::int AS count FROM events')).rows[0].count;
  await button.scrollIntoViewIfNeeded();
  const box = await button.boundingBox();
  await lock.query('BEGIN');
  await lock.query('LOCK TABLE events IN SHARE MODE');
  let result;
  try {
    const requested = page.waitForRequest(req => new URL(req.url()).pathname.startsWith('/api/organizer-events') && ['POST', 'PATCH'].includes(req.method()));
    const response = page.waitForResponse(r => new URL(r.url()).pathname.startsWith('/api/organizer-events') && ['POST', 'PATCH'].includes(r.request().method()), { timeout: 60000 });
    response.catch(() => {});
    await keyboard(button);
    await requested;
    for (let attempt = 0; attempt < 100; attempt++) {
      const waiting = (await db.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE '%events%'")).rows[0].count;
      if (waiting) break;
      assert.ok(attempt < 99, 'API write must actually wait on PostgreSQL lock');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const busyButtons = page.getByRole('button', { name: /Saving…|Publishing…|Save draft from action dock|Publish event from action dock/ });
    assert.ok(await busyButtons.count() >= 3);
    for (const busy of await busyButtons.all()) assert.equal(await busy.isDisabled(), true);
    // Real repeated mouse and keyboard activation attempts against disabled controls.
    if (box) for (let index = 0; index < 3; index++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    for (let index = 0; index < 3; index++) await page.keyboard.press('Enter');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM events')).rows[0].count, before);
    await lock.query('ROLLBACK');
    const received = await response;
    result = { status: received.status(), body: await received.json() };
    await Promise.all(pendingResponses);
    check(`${actionName}: genuine database-blocked pending controls`, { status: result.status });
  } finally { await lock.query('ROLLBACK'); }
  return result;
}
let removedCategory;
try {
  await page.goto(`${base}/login`);
  await page.getByLabel('Email Address', { exact: true }).fill(process.env.S302_EMAIL ?? 'organizer@younity.test');
  await page.getByLabel('Password', { exact: true }).fill(process.env.S302_PASSWORD);
  await page.getByRole('button', { name: 'Sign In to Younity', exact: true }).click();
  await page.waitForURL('**/organizer/dashboard');
  const session = await (await context.request.get(`${base}/api/auth/me`)).json();
  assert.equal(session.organization.verificationStatus, 'APPROVED');
  assert.equal(session.organization.approvalAcknowledged, true);
  check('Real login with approved organizer', { userId: session.id });
  const catalog = await (await context.request.get(`${base}/api/categories`)).json();
  const seeded = (await db.query('SELECT id, name, slug FROM categories ORDER BY name')).rows;
  assert.equal(seeded.length, 10);
  assert.deepEqual(catalog, { categories: seeded });
  evidence.categories = seeded;
  const category = seeded.find(c => c.slug === 'ai-data');
  const failureCategory = seeded.find(c => c.slug === 'fintech');
  const run = Date.now();
  await form(`S302 draft ${run}`, category);
  for (const item of seeded) assert.equal(await page.getByRole('checkbox', { name: item.name, exact: true }).count(), 1);
  check('React picker shows all ten actual seeded categories');
  await page.screenshot({ path: `${output}/desktop-form.png`, fullPage: true });
  const first = await pendingWrite(save(), 'Save draft');
  assert.equal(first.status, 201);
  await visible('Draft saved.');
  const id = first.body.id;
  assert.deepEqual(first.body.categoryIds, [category.id]);
  assert.equal(first.body.registrationMode, 'AUTOMATIC');
  assert.equal((await event(id)).status, 'DRAFT');
  assert.equal(evidence.writes.filter(w => w.method === 'POST' && w.path === '/api/organizer-events').length, 1);
  check('Keyboard save creates exactly one DRAFT with selected categoryIds', { id });
  await page.getByRole('link', { name: 'Open saved draft', exact: true }).click();
  await page.getByLabel('Event Title', { exact: false }).waitFor();
  assert.equal(await page.getByLabel('Event Title', { exact: false }).inputValue(), first.body.title);
  await page.getByRole('button', { name: 'Add Category', exact: true }).click();
  assert.equal(await page.getByRole('checkbox', { name: category.name, exact: true }).isChecked(), true);
  check('Reopen restores persisted title and category selection', { id });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  const editedTitle = `S302 draft edited ${run}`;
  await page.getByLabel('Event Title', { exact: false }).fill(editedTitle);
  assert.equal(await publish().isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Publish event from action dock' }).isDisabled(), true);
  await visible('Save your changes before publishing this draft.');
  check('Unsaved existing draft disables both Publish controls at 390px');
  const edit = await writeResponse(() => keyboard(page.getByRole('button', { name: 'Save draft from action dock' })));
  assert.equal(edit.status, 200);
  assert.equal(edit.body.id, id);
  await visible('Draft saved.');
  assert.equal((await event(id)).title, editedTitle);
  await page.screenshot({ path: `${output}/mobile-saved-draft.png`, fullPage: true });
  const published = await writeResponse(() => keyboard(page.getByRole('button', { name: 'Publish event from action dock' })));
  assert.equal(published.status, 200);
  await visible('Event published.');
  const row = await event(id);
  assert.equal(row.status, 'PUBLISHED');
  assert.deepEqual(row.category_ids, [category.id]);
  check('Mobile keyboard save PATCH and bodyless publish preserve event ID in PostgreSQL', row);
  await page.screenshot({ path: `${output}/mobile-published.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await form(`S302 direct ${run}`, category);
  const direct = await pendingWrite(publish(), 'Direct Publish');
  assert.equal(direct.status, 201);
  await visible('Event published.');
  assert.equal((await event(direct.body.id)).status, 'PUBLISHED');
  assert.equal(evidence.writes.filter(w => w.path === '/api/organizer-events/publish').length, 1);
  check('Keyboard direct publish creates exactly one PUBLISHED event', await event(direct.body.id));
  await page.setViewportSize({ width: 390, height: 844 });
  const failureTitle = `S302 retained failure ${run}`;
  await form(failureTitle, failureCategory);
  const retainedLabels = ['Event Title', 'Description', 'Online event link', 'Registration deadline', 'Capacity (Max attendees)'];
  const retainedValues = await Promise.all(retainedLabels.map(label => page.getByLabel(label, { exact: false }).inputValue()));
  removedCategory = (await db.query('DELETE FROM categories WHERE id=$1 RETURNING *', [failureCategory.id])).rows[0];
  for (const [intent, button] of [['save', page.getByRole('button', { name: 'Save draft from action dock' })], ['publish', page.getByRole('button', { name: 'Publish event from action dock' })]]) {
    const failed = await writeResponse(() => keyboard(button));
    assert.equal(failed.status, 400);
    await page.getByRole('alert').waitFor({ state: 'visible' });
    assert.equal(await page.getByLabel('Event Title', { exact: false }).inputValue(), failureTitle);
    assert.equal(await page.getByLabel('Description', { exact: false }).inputValue(), 'Real S3-02 browser acceptance fixture.');
    assert.equal(await page.getByRole('checkbox', { name: failureCategory.name, exact: true }).isChecked(), true);
    assert.deepEqual(await Promise.all(retainedLabels.map(label => page.getByLabel(label, { exact: false }).inputValue())), retainedValues);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM events WHERE title=$1', [failureTitle])).rows[0].count, 0);
    check(`Real backend ${intent} 400 displays feedback and preserves entered values`, { response: failed.body });
    await page.screenshot({ path: `${output}/mobile-failed-${intent}.png`, fullPage: true });
  }
  assert.deepEqual(evidence.errors, []);
  await Promise.all(pendingResponses);
  assert.equal(evidence.writes.length, 6, 'Four successful writes and two rejected writes; no duplicates');
  assert.deepEqual(evidence.writes[4].body, evidence.writes[5].body, 'Failed save and publish preserve the full form payload, including schedule');
  assert.equal((await db.query('SELECT count(*)::int AS count FROM events WHERE created_by_id=$1 AND title = ANY($2::text[])', [session.id, [editedTitle, `S302 direct ${run}`, failureTitle]])).rows[0].count, 2);
  check('Exactly two event rows; no duplicate writes or browser errors');
} catch (error) {
  evidence.failure = error.stack;
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  if (removedCategory) await db.query('INSERT INTO categories (id,name,slug,created_at) VALUES ($1,$2,$3,$4)', [removedCategory.id, removedCategory.name, removedCategory.slug, removedCategory.created_at]);
  await Promise.allSettled(pendingResponses);
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2));
  await lock.end(); await db.end(); await browser.close();
}
