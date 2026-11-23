# Task 4 — Review Content Moderation

> **Examate · Amazon SDE OA — AI-assisted repository debugging practice**
> Stack: Python 3.11+ · Django 5 · pytest  |  Time: **60 min**  |  Level: Hard (above Amazon level)
> Same task, same bugs, also available in `../springboot/`. Pick ONE stack, like in the real OA.

This is a practice rebuild of a task that Amazon candidates reported in 2026. Amazon's own repository code has never been
published, so the code here is ours; the scenario, rules and bug types follow the reports cited below.

## Where this question comes from

**Evidence: strong for the spec.** Reported Amazon OA repo task (1Point3Acres, 2026): content moderation on reviews. Both
add and edit had to use an existing bad-content checker, answer 403 rather than 201 on a violation, increase and persist the
user's violation count, flag the user after 3 strikes, keep blocking flagged users, and record the violated words.
*Our additions:* the banned-word list, endpoints and JSON shapes.

## Background

Users review movies. A bad-content checker already exists and is correct. Moderators report:

- "Abusive reviews are getting published."
- "Users with three strikes are still posting."
- "Strike counts seem to reset."

*Other failures may exist — the tests are the specification.*

## Rules

Every request sends `X-User-Id: <id>`. Missing/unknown → **401**.

| Endpoint | Behaviour |
|---|---|
| `POST /api/movies/{movieId}/reviews` `{"text", "rating"}` | **201** with the review. Unknown movie → **404**. Empty text or rating not an integer 1–5 → **400**. |
| `PUT /api/reviews/{reviewId}` `{"text", "rating"}` | Edit your own review → **200**. Someone else's / unknown → **404**. |

**Moderation applies to both add and edit:**
- Text is checked with the existing checker (`find_violations` / `ContentChecker.findViolations`).
- On a violation: respond **403** `{"error": "Review contains inappropriate content", "violatedWords": [...]}` (unique, sorted),
  **nothing is saved/changed** in the review, the user's `violation_count` goes up by 1 and **is persisted**, and a
  `ModerationEvent` row records the violated words (comma-separated, sorted).
- At **3** violations the user becomes **flagged** (`is_flagged` / `flagged` = true).
- A flagged user gets **403** on every add/edit, **even with clean text**.

## Project layout

```
reviews/
  services.py         add / edit / moderate   <- start here
  content_checker.py  existing bad-content checker (correct - no bugs)
  models.py           User, Movie, Review, ModerationEvent
  views.py            HTTP layer
tests/                DO NOT EDIT
```

## Setup & run (Django)

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate      Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
pytest                      # run all tests
pytest -k rate              # run tests whose name contains "rate"
```
Needs Python 3.11+.

At the start you should see **5 failed, 3 passed**. Goal: all tests green.

## Rules (same as the real OA)

1. **Do not edit the tests.** Fix the application code.
2. AI assistant = **helper, not solver**. Ask it to explain errors and code; don't paste the repo and ask it to "fix everything".
3. Smallest correct change. Don't change endpoints, parameters or response shapes.
4. Your trainer has **hidden tests** for every rule in this README — passing the visible tests is not the finish line.
5. Time limit: **60 minutes**.
