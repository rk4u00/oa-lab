# Task 3 — Movie Search Against Five Search Rules

> **Examate · Amazon SDE OA — AI-assisted repository debugging practice**
> Stack: Python 3.11+ · Django 5 · pytest  |  Time: **60 min**  |  Level: Hard (above Amazon level)
> Same task, same bugs, also available in `../springboot/`. Pick ONE stack, like in the real OA.

This is a practice rebuild of a task that Amazon candidates reported in 2026. Amazon's own repository code has never been
published, so the code here is ours; the scenario, rules and bug types follow the reports cited below.

## Where this question comes from

**Evidence: strong for the rules, medium for the exact bugs.** Reported Amazon OA repo task (PracHub, Sep–Oct 2026, Spring
Boot; 1Point3Acres): a buggy movie-search backend whose logic is spread over several layers, which must follow five rules —
partial match, a choice of title / stars / all fields, case-insensitive matching, popularity ordering with further keys, and
published movies only. A Django movie search & filter variant (60 min) is also reported.
*Our additions:* the tie-break keys after popularity (rating, then title) — the report only says "and others".

## Background

Search returns wrong results. Product's five rules are below; the code is spread over several layers
(service → matchers → ordering). Make search obey all five rules.

## Endpoint

`GET /api/movies/search?q=<text>&field=<title|stars|all>` → `{"count": n, "results": [{"id","title","stars":[...],"popularity","rating"}]}`

## The five rules

1. **Partial match** — a movie matches if the text appears **anywhere** inside the searched field.
2. **Field choice** — `field=title` searches the title; `field=stars` searches **every** cast member; `field=all` (the default)
   matches if the title **or** any star matches. `field` is case-insensitive. Any other value → **400**.
3. **Case-insensitive** — upper/lower case never matters, for the query or the data. Leading/trailing spaces in `q` are ignored.
4. **Ordering** — popularity high→low; ties → rating high→low; still tied → title A→Z.
5. **Published only** — an unpublished movie is **never** returned, whatever the field.

A missing/blank `q` returns every published movie (sorted by rule 4).

## Project layout

```
search/
  service.py    ties the layers together   <- start here
  matchers.py   title / stars / all matching
  ordering.py   sort order
  text.py       normalize(), split_stars()  (no bugs)
  views.py      HTTP layer
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
