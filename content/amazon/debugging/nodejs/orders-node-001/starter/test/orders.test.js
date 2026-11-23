const { test, beforeEach, after, before } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const store = require('../src/services/store');

let server;
let base;

before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/orders`;
});
after(() => server.close());
beforeEach(() => store.reset());

const post = (path, body) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });

const order = (extra = {}) => post('', { customerId: 'c1', items: [{ sku: 'BOOK-1', quantity: 1 }], ...extra });

test('prices an order with a coupon (cents, rounded half up)', async () => {
  const res = await post('', { customerId: 'c1', items: [{ sku: 'BOOK-1', quantity: 1 }, { sku: 'CABLE-1', quantity: 1 }], couponCode: 'SAVE10' });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.subtotal, 3398);
  assert.equal(body.discount, 340);
  assert.equal(body.total, 3058);
  assert.equal(body.status, 'pending');
});

test('rejects unknown coupon codes', async () => {
  const res = await order({ couponCode: 'FREEBIES' });
  assert.equal(res.status, 400);
});

test('rejects zero quantity', async () => {
  const res = await post('', { customerId: 'c1', items: [{ sku: 'MUG-1', quantity: 0 }] });
  assert.equal(res.status, 400);
});

test('lists orders with 1-based pagination', async () => {
  for (let i = 0; i < 3; i++) await order();
  const res = await fetch(`${base}?page=1&pageSize=2`);
  const body = await res.json();
  assert.deepEqual(body.items.map((o) => o.id), ['1', '2']);
  assert.equal(body.total, 3);
  const page2 = await (await fetch(`${base}?page=2&pageSize=2`)).json();
  assert.deepEqual(page2.items.map((o) => o.id), ['3']);
});

test('cannot cancel a shipped order', async () => {
  const { id } = await (await order()).json();
  await post(`/${id}/ship`);
  const res = await post(`/${id}/cancel`);
  assert.equal(res.status, 409);
});

test('cancelling an unknown order returns 404', async () => {
  const res = await post('/999/cancel');
  assert.equal(res.status, 404);
});

test('cancels a pending order', async () => {
  const { id } = await (await order()).json();
  const res = await post(`/${id}/cancel`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'cancelled');
});
