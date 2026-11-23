# Task 2 — Loan Application

> **Examate · Amazon SDE OA — AI-assisted repository debugging practice**
> Stack: Python 3.11+ · Django 5 · pytest  |  Time: **60 min**  |  Level: Medium (Amazon level)
> Same task, same bugs, also available in `../springboot/`. Pick ONE stack, like in the real OA.

This is a practice rebuild of a task that Amazon candidates reported in 2026. Amazon's own repository code has never been
published, so the code here is ours; the scenario, rules and bug types follow the reports cited below.

## Where this question comes from

**Evidence: strong.** Reported Amazon SWE OA repo task (Screna, Jun 2026; also summarised on 1Point3Acres): a
loan-application repo whose prompt lists three issues — users can't create a loan, can't view their existing loans, and can
fund a loan without enough balance. Candidates report that after fixing those three, **5 of 6 tests passed; the last failure
was repaying a loan with insufficient balance, which the prompt never mentions.**
*Our additions:* the peer-to-peer flow details (statuses, transfers, status codes).

## Background

A peer-to-peer lending app: a borrower requests a loan, another user funds it, the borrower repays it.

**Known issues (from the bug tracker):**
1. Users cannot create a loan.
2. Users cannot view their existing loans.
3. Users with insufficient balance can still fund a loan.

*The test suite may check things this list does not mention.*

## API contract

Every request sends `X-User-Id: <id>`. Missing/unknown → **401**. Money is returned as a string with 2 decimals, e.g. `"500.00"`.

| Endpoint | Behaviour |
|---|---|
| `POST /api/loans` `{"amount": "500"}` | Creates a loan for the caller (borrower), status `REQUESTED` → **201** with the loan (including its `id`). Amount must be a number **greater than 0**, else **400**. |
| `GET /api/loans` | `{"loans": [...]}` — loans where the caller is the **borrower**, oldest first. |
| `POST /api/loans/{id}/fund` | Caller becomes the lender. Loan must be `REQUESTED` (else **409**). Can't fund your own loan (**400**). Lender balance < amount → **400** `"Insufficient balance"`, nothing changes. Otherwise lender balance −amount, borrower balance +amount, status `FUNDED` → **200**. |
| `POST /api/loans/{id}/repay` | Only the borrower (**403** otherwise). Loan must be `FUNDED` (else **409**). Borrower balance < amount → **400** `"Insufficient balance"`. Otherwise borrower −amount, lender +amount, status `REPAID` → **200**. |
| unknown loan id | **404** |

Loan response: `{"id", "borrowerId", "lenderId", "amount", "status"}`.

## Project layout

```
loans/
  models.py     User, Loan
  services.py   create / list / fund / repay   <- start here
  views.py      HTTP layer
  common.py     helpers (no bugs)
tests/          DO NOT EDIT
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

At the start you should see **6 failed, 2 passed**. Goal: all tests green.

## Rules (same as the real OA)

1. **Do not edit the tests.** Fix the application code.
2. AI assistant = **helper, not solver**. Ask it to explain errors and code; don't paste the repo and ask it to "fix everything".
3. Smallest correct change. Don't change endpoints, parameters or response shapes.
4. Your trainer has **hidden tests** for every rule in this README — passing the visible tests is not the finish line.
5. Time limit: **60 minutes**.
