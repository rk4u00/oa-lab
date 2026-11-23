let orders = [];
let nextId = 1;

function create(order) {
  const saved = { id: String(nextId++), status: 'pending', createdAt: new Date().toISOString(), ...order };
  orders.push(saved);
  return saved;
}

function get(id) {
  return orders.find((o) => o.id === id);
}

function list(page, pageSize) {
  const start = page * pageSize;
  return { items: orders.slice(start, start + pageSize), page, pageSize, total: orders.length };
}

function update(id, patch) {
  const o = get(id);
  Object.assign(o, patch);
  return o;
}

function reset() {
  orders = [];
  nextId = 1;
}

module.exports = { create, get, list, update, reset };
