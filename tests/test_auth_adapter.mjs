import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../shared/auth-adapter.js', import.meta.url), 'utf8');
const context = { window: {}, document: { cookie: '' }, console, Date };
vm.runInNewContext(source, context);
const calls = [];
const responses = [
  { status: 200, ok: true, json: async () => ({ id: 'user-1', email: 'owner@example.test' }) },
  { status: 200, ok: true, json: async () => ([{ id: 'site-1', name: 'Bloom', template_slug: 'florist' }]) },
  { status: 200, ok: true, json: async () => ([{ id: 'site-2', remaining_today: 3 }]) },
  { status: 200, ok: true, json: async () => ([{ id: 'site-1', draft_data: { brandName: 'Updated' } }]) },
  { status: 200, ok: true, json: async () => ([{ id: 'site-1', status: 'published' }]) },
  { status: 204, ok: true, json: async () => null }
];
const adapter = context.window.NightshiftAuthAdapter.create({ fetchImpl: async (url, options) => {
  calls.push({ url, options }); return responses.shift();
} });
assert.equal((await adapter.getSessionUser()).id, 'user-1');
assert.equal((await adapter.listSites())[0].template_slug, 'florist');
assert.equal((await adapter.create('fitness', 'Iron Lab'))[0].id, 'site-2');
assert.equal((await adapter.save('site-1', { brandName: 'Updated' })).id, 'site-1');
assert.equal((await adapter.publish('site-1')).status, 'published');
assert.equal(await adapter.deleteSite('site-1'), null);
const createCall = calls.find(call => call.url.includes('/rpc/create_site'));
assert.deepEqual(JSON.parse(createCall.options.body), { p_template_slug: 'fitness', p_site_name: 'Iron Lab' });
const listCall = calls.find(call => call.url.includes('/rest/v1/sites?select='));
assert.equal(listCall.url.includes('template_slug=eq.cafe'), false);
assert.equal(calls.every(call => call.options.credentials === 'omit'), true);
console.log('universal auth adapter lifecycle checks passed');
