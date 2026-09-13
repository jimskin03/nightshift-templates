import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../cafe/auth-adapter.js', import.meta.url), 'utf8');
const context = { window: {}, console };
vm.runInNewContext(source, context);
const calls = [];
const responses = [
  { status: 200, ok: true, json: async () => ({ id: 'user-1', email: 'owner@example.test' }) },
  { status: 200, ok: true, json: async () => ([{ id: 'site-1', name: 'Kopi Lane', draft_data: { brandName: 'Kopi Lane' } }]) },
  { status: 200, ok: true, json: async () => ([{ id: 'site-1', remaining_today: 4 }]) },
  { status: 200, ok: true, json: async () => ([{ id: 'site-1', draft_data: { brandName: 'Updated' } }]) },
  { status: 200, ok: true, json: async () => ([{ id: 'site-1', status: 'published' }]) }
];
const adapter = context.window.NightshiftAuthAdapter.create({ fetchImpl: async (url, options) => { calls.push({ url, options }); return responses.shift(); } });
assert.equal((await adapter.getSessionUser()).id, 'user-1');
assert.equal((await adapter.listSites())[0].id, 'site-1');
assert.equal(await adapter.remainingCreationsToday(), 4);
assert.equal((await adapter.save('site-1', { brandName: 'Updated' })).id, 'site-1');
assert.equal((await adapter.publish('site-1')).status, 'published');
assert.equal(calls.every(call => call.options.credentials === 'omit'), true);
assert.equal(calls[1].url.includes('/rest/v1/sites?select='), true);
assert.equal(calls[0].options.headers['Accept-Profile'], undefined);
assert.equal(calls[0].options.headers['Content-Profile'], undefined);
assert.equal(calls[1].options.headers['Accept-Profile'], 'nightshift');
assert.equal(calls[1].options.headers['Content-Profile'], undefined);
assert.equal(calls[2].options.headers['Accept-Profile'], 'nightshift');
assert.equal(calls[2].options.headers['Content-Profile'], 'nightshift');
assert.equal(calls[3].options.headers['Accept-Profile'], 'nightshift');
assert.equal(calls[3].options.headers['Content-Profile'], 'nightshift');
assert.equal(calls[4].options.headers['Accept-Profile'], 'nightshift');
assert.equal(calls[4].options.headers['Content-Profile'], 'nightshift');
assert.equal(JSON.parse(calls[3].options.body).draft_data.brandName, 'Updated');
assert.equal(JSON.parse(calls[4].options.body).p_site_id, 'site-1');
console.log('authenticated adapter lifecycle checks passed');
