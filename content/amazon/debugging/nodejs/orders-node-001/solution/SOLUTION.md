# Reference solution (hidden from candidates)

Seeded bugs:
1. `quantity < 0` lets zero-quantity lines through (should be `< 1`).
2. Unknown coupons are silently ignored instead of returning 400.
3. `percentOff` is a string and the discount uses `Math.floor` (should be numeric, rounded half up → `Math.round`).
4. `store.list` treats `page` as 0-based; the API is 1-based.
5. `/cancel` crashes (500) on unknown ids and allows cancelling non-pending orders other than `shipped`.

Verify: `patch -p1 < ../solution/solution.patch` inside the starter.
