import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../cafe/auth-adapter.js', import.meta.url), 'utf8');
const context = { window: {}, console };
vm.runInNewContext(source, context);

let request;
const adapter = context.window.NightshiftAuthAdapter.create({
  fetchImpl: async (url, options) => {
    request = { url, options };
    return { status: 200, ok: true, json: async () => ({ id: 'user-1', email: 'owner@example.test' }) };
  }
});
assert.equal((await adapter.getSessionUser()).id, 'user-1');
assert.equal(request.options.credentials, 'include');
assert.equal(request.options.headers.apikey, 'sb_publishable_ys0Cl98LLqAdNEiNY1fMg_lddIzr6F');
for (const method of ['load', 'save', 'publish']) {
  await assert.rejects(() => adapter[method]({}), error => error.code === 'BACKEND_NOT_APPLIED');
}
console.log('auth adapter runtime checks passed');
