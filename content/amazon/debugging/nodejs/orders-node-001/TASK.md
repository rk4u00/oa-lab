# Marketplace Orders API

The **Orders** service prices and tracks marketplace orders. After a recent refactor, QA filed these defects:

1. **Order totals are wrong** — `POST /api/orders`
   - Body: `{ "customerId": "c1", "items": [{ "sku": "BOOK-1", "quantity": 2 }], "couponCode"?: "SAVE10" }`
   - `subtotal` = Σ `unitPrice × quantity` using prices from the catalog.
   - Coupon `SAVE10` takes **10 %** off the subtotal. Unknown coupons → **400**.
   - All money values are returned in **cents** as integers (round half up at the end).
   - Unknown SKUs or `quantity < 1` → **400**. Success → **201**.

2. **Listing skips orders** — `GET /api/orders?page=1&pageSize=2`
   - Pages are **1-based**. Response: `{ items, page, pageSize, total }`, oldest order first.

3. **Cancellation rules** — `POST /api/orders/:id/cancel`
   - Only orders in status `pending` can be cancelled → **200** with status `cancelled`.
   - A `shipped` order returns **409**. An unknown id returns **404**.

## Rules
- Do **not** modify files under `test/`.
- Run the suite with `npm test` in the terminal or the **Run tests** button.
