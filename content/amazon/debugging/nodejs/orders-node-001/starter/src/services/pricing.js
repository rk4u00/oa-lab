const { CATALOG, COUPONS } = require('../catalog');
const { HttpError } = require('./errors');

function priceOrder(items, couponCode) {
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'items must be a non-empty array');

  let subtotal = 0;
  const lines = items.map(({ sku, quantity }) => {
    const product = CATALOG[sku];
    if (!product) throw new HttpError(400, `unknown sku ${sku}`);
    if (!Number.isInteger(quantity) || quantity < 0) throw new HttpError(400, 'quantity must be >= 1');
    const lineTotal = product.unitPrice * quantity;
    subtotal += lineTotal;
    return { sku, quantity, unitPrice: product.unitPrice, lineTotal };
  });

  let discount = 0;
  if (couponCode) {
    const coupon = COUPONS[couponCode];
    if (coupon) discount = Math.floor(subtotal * coupon.percentOff / 100);
  }

  return { lines, subtotal, discount, total: subtotal - discount };
}

module.exports = { priceOrder };
