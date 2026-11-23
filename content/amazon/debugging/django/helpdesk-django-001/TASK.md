# HelpDesk Ticket Management

You have joined the team that owns **HelpDesk**, a small Django service that support agents use to track customer tickets.
Customers report that two flows are broken:

1. **Creating a ticket** — `POST /api/tickets/`
   - Requires a non-empty `title` and a `customer_email`. Missing fields must return **400** with an `errors` object.
   - `priority` is optional and must be one of `low`, `medium`, `high` (default `medium`). Anything else → **400**.
   - New tickets always start with status `open`. Successful creation returns **201** and the ticket JSON.

2. **Replying to a ticket** — `POST /api/tickets/<id>/replies/`
   - Body: `{ "author": "...", "message": "..." }`. A blank message → **400**.
   - Replying to a **closed** ticket must be rejected with **409**.
   - When an **agent** (author not equal to the ticket's `customer_email`) replies to an `open` ticket, its status becomes `in_progress`.
   - Returns **201** with the reply JSON; `GET /api/tickets/<id>/` lists replies oldest-first.

## Rules
- Do **not** modify anything under `tests/`.
- Run the suite with `pytest` in the terminal or the **Run tests** button.
- You may use an AI assistant if the assessment permits it — but understand every change you make.

## Hints
- Start with the failing tests, then trace the request through `urls.py` → `views.py` → `models.py`.
