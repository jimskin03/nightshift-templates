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
  { status: 200, ok: true, json: async () => ([{ id: 'site-1', status: 'published' }]) },
  { status: 204, ok: true, json: async () => null },
  { status: 200, ok: true, json: async () => ({ user: { id: 'user-2', email: 'new@example.test' }, session: null }) },
  { status: 200, ok: true, json: async () => ({ user: { id: 'user-2', email: 'new@example.test' }, session: { access_token: 'token', refresh_token: 'refresh', expires_at: 4102444800, user: { id: 'user-2', email: 'new@example.test' } } }) }
];
const adapter = context.window.NightshiftAuthAdapter.create({ fetchImpl: async (url, options) => { calls.push({ url, options }); return responses.shift(); } });
assert.equal((await adapter.getSessionUser()).id, 'user-1');
assert.equal((await adapter.listSites())[0].id, 'site-1');
assert.equal(await adapter.remainingCreationsToday(), 4);
assert.equal((await adapter.save('site-1', { brandName: 'Updated' })).id, 'site-1');
assert.equal((await adapter.publish('site-1')).status, 'published');
assert.equal(await adapter.deleteSite('site-1'), null);
assert.equal((await adapter.signUp('new@example.test', 'correct horse battery staple')).user.id, 'user-2');
assert.equal((await adapter.signIn('new@example.test', 'correct horse battery staple')).session.access_token, 'token');
assert.equal(calls.every(call => call.options.credentials === 'omit'), true);
const restRead = calls.find(call => call.url.includes('/rest/v1/sites?select='));
const quotaCall = calls.find(call => call.url.includes('/rpc/remaining_creations_today'));
const saveCall = calls.find(call => call.url.includes('/rest/v1/sites?id=') && call.options.method === 'PATCH');
const publishCall = calls.find(call => call.url.includes('/rpc/publish_site'));
const deleteCall = calls.find(call => call.url.includes('/rest/v1/sites?id=') && call.options.method === 'DELETE');
const signupCall = calls.find(call => call.url.endsWith('/auth/v1/signup'));
const signinCall = calls.find(call => call.url.includes('/auth/v1/token?grant_type=password'));
assert.equal(restRead.options.headers['Accept-Profile'], 'nightshift');
assert.equal(restRead.options.headers['Content-Profile'], 'nightshift');
assert.equal(quotaCall.options.headers['Content-Profile'], 'nightshift');
assert.equal(saveCall.options.headers['Content-Profile'], 'nightshift');
assert.equal(publishCall.options.headers['Content-Profile'], 'nightshift');
assert.equal(deleteCall.options.headers['Content-Profile'], 'nightshift');
assert.equal(JSON.parse(saveCall.options.body).draft_data.brandName, 'Updated');
assert.equal(JSON.parse(publishCall.options.body).p_site_id, 'site-1');
assert.equal(JSON.parse(signupCall.options.body).email, 'new@example.test');
assert.equal(JSON.parse(signinCall.options.body).email, 'new@example.test');
console.log('authenticated adapter lifecycle checks passed');
