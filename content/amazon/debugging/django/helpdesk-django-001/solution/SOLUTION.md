# Reference solution (hidden from candidates)

Bugs seeded in the starter:

1. `Ticket.status` defaults to `in_progress` instead of `open` (models.py + migration default).
2. `tickets` view creates the ticket **before** checking validation errors, so invalid tickets are persisted.
3. `add_reply` changes `ticket.status` but never calls `ticket.save()`.
4. `ticket_replies` does not reject replies to closed tickets (expected 409).
5. `to_dict(include_replies=True)` orders replies newest-first (`-created_at`); should be `created_at`, `id`.

Apply `solution.patch` from inside the starter directory to verify: `patch -p1 < ../solution/solution.patch`.
