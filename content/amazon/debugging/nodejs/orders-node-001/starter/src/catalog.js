// Prices in cents.
const CATALOG = {
  'BOOK-1': { name: 'Systems Design Handbook', unitPrice: 2499 },
  'MUG-1': { name: 'Peculiar Mug', unitPrice: 1250 },
  'CABLE-1': { name: 'USB-C Cable', unitPrice: 899 },
};

const COUPONS = {
  SAVE10: { percentOff: '10' },
};

module.exports = { CATALOG, COUPONS };
