const express = require('express');
const store = require('../services/store');
const { priceOrder } = require('../services/pricing');
const { HttpError } = require('../services/errors');

const router = express.Router();

router.post('/', (req, res) => {
  const { customerId, items, couponCode } = req.body || {};
  if (!customerId) throw new HttpError(400, 'customerId is required');
  const priced = priceOrder(items, couponCode);
  res.status(201).json(store.create({ customerId, couponCode: couponCode || null, ...priced }));
});

router.get('/', (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  res.json(store.list(page, pageSize));
});

router.get('/:id', (req, res) => {
  const order = store.get(req.params.id);
  if (!order) throw new HttpError(404, 'order not found');
  res.json(order);
});

router.post('/:id/cancel', (req, res) => {
  const order = store.get(req.params.id);
  if (order.status === 'shipped') throw new HttpError(409, 'order already shipped');
  res.json(store.update(order.id, { status: 'cancelled' }));
});

// Test/ops helper: mark an order as shipped.
router.post('/:id/ship', (req, res) => {
  const order = store.get(req.params.id);
  if (!order) throw new HttpError(404, 'order not found');
  res.json(store.update(order.id, { status: 'shipped' }));
});

module.exports = router;
