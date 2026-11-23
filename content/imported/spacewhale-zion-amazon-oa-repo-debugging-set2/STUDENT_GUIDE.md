# Student Guide — Amazon OA Repository Debugging (Set 2: Django + Spring Boot)

**Examate · SOFTOMATIC** — Amazon SDE prep

---

## 1. What you're preparing for

Amazon's SDE / intern OA (2026) usually has **one DSA question (~40 min) + one AI-assisted repository task (~60 min)**, then
the Work Simulation and the Work Style survey. In the repo task you get:

- a small web app (backend + sometimes a React/Angular frontend) with **bugs**
- a README that lists **some** of the broken behaviours (not always all of them)
- a test suite — your score is **how many tests pass** (candidates report "4/6", "6/6")
- a built-in AI assistant that **explains and hints but won't write the fix for you** (some candidates say it can only see the file you have open)
- a stack you choose up front — **Django, Spring Boot or Node/MERN** — and **you can't switch after starting**

What candidates say about the bugs: shallow and typical — a missing `save()`, a missing existence check, a wrong status code,
`<` vs `<=`, a filter on the wrong field, a missing state update. Six bugs in 60 minutes is a normal load. One candidate's six
bugs were 4 in the controller, 1 in routes, 1 in middleware. Some bugs are **not in the prompt** and only the tests reveal them.

---

## 2. Today's four tasks (each in BOTH stacks — pick one)

| # | Task | Based on (reported) | Level | Start |
|---|---|---|---|---|
| 1 | MovieDB Watchlist + Rate Limiting | Spring Boot intern OA, Sep 2026 | Amazon level | 6 failing / 8 |
| 2 | Loan Application | SWE OA, Jun 2026 (3 listed bugs + 1 hidden) | Amazon level | 6 failing / 8 |
| 3 | Movie Search — five rules | Spring Boot OA, Sep–Oct 2026 | Above Amazon level | 6 failing / 8 |
| 4 | Review Content Moderation | OA report, 2026 | Above Amazon level | 5 failing / 8 |

Each folder's `README.md` is the problem statement. **Read it fully before touching code.**

**Which stack should I choose?** The one you can read fastest *without docs*. Candidates who chose a framework they didn't use
daily said they lost most of the hour to the framework. Comfortable with Python → Django. Comfortable with Java → Spring Boot.

---

## 3. Setup (do it BEFORE class)

**Django:** Python 3.11+, then in the task's `django/` folder:
```bash
python -m venv .venv
# Windows: .venv\Scripts\activate      Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
pytest
```

**Spring Boot:** JDK 17+ and Maven 3.9+ (or IntelliJ IDEA Community). In the task's `springboot/` folder:
```bash
mvn test
```
First run downloads libraries (~2 min, needs internet). If you see `Tests run: 8, Failures: 6` you're ready.

---

## 4. Read a codebase in 5 minutes

**Django request path:** `urls.py` → `views.py` → `services.py` → `models.py`

**Spring Boot request path:** `@RestController` (controller) → `@Service` (service) → `JpaRepository` (repository) → `@Entity` (model)

### Spring Boot in 10 lines
| You see | It means |
|---|---|
| `@RestController` + `@RequestMapping("/api/loans")` | this class handles URLs starting `/api/loans` |
| `@GetMapping`, `@PostMapping("/{id}/fund")` | which method handles which URL + HTTP verb |
| `@PathVariable Long id` / `@RequestBody Map body` / `@RequestHeader("X-User-Id")` | read from URL / JSON body / header |
| `ResponseEntity.status(HttpStatus.CREATED).body(x)` | send status 201 with JSON x |
| `interface LoanRepository extends JpaRepository<Loan, Long>` | database access — Spring writes the code for you |
| `findByBorrowerIdOrderByIdAsc(id)` | the **method name is the query**: WHERE borrower.id = ? ORDER BY id |
| `repository.save(obj)` | INSERT or UPDATE. **If nobody calls save, nothing reaches the database.** |
| `@Transactional` | all DB work in this method succeeds or fails together |
| `throw new ApiException(HttpStatus.NOT_FOUND, "...")` | becomes a JSON error with that status (see `GlobalExceptionHandler`) |

### Django in 10 lines
| You see | It means |
|---|---|
| `Model.objects.filter(a=x)` | WHERE a = x |
| `filter(user=user, movie=movie).exists()` | "is there such a row?" |
| `Model(...)` | a Python object — **not saved** |
| `Model.objects.create(...)` / `obj.save()` | written to the database |
| `save(update_fields=["a"])` | saves **only** field `a`; other changes are lost |
| `raise ApiError(404, "...")` | becomes a JSON error with that status |

### Reading test failures
- **pytest:** `assert 0 == 1` + the test name → read that test function, it tells you the expected behaviour.
- **JUnit/MockMvc:** `Status expected:<403> but was:<201>` or `JSON path "$.error" expected:<...> but was:<...>`.
  Scroll **up** to the first `FAILED`/`[ERROR]` line, not the long stack trace at the bottom.

---

## 5. The method (use it every time)

| Minutes | Step |
|---|---|
| 0–5 | **Orient:** read README + bug list, skim folders, run all tests, write down the failing test names. |
| 5–15 | **Reproduce:** pick ONE failing test, read it, note expected vs actual. |
| 15–50 | **Fix loop:** trace the request (controller/view → service → repository/model) → find the line → smallest fix → run that test → run ALL tests. Repeat. |
| 50–60 | **Final pass:** re-read README rules (hidden tests check them), run everything, remove debug prints, submit. |

Rules of thumb:
- **One test can hide two bugs.** If it still fails after your fix, read the new error — it's usually a different line.
- **Fixing one bug can reveal another** (e.g. search returns nothing until matching is fixed, *then* ordering shows up wrong).
- **Stuck 10 minutes on one test? Skip it.** Every other passing test still counts.
- Never "fix" the frontend only — tests hit the API.

---

## 6. Using the AI assistant like a pro

Good prompts (short, specific, you stay in control):
```
Test addMovieIsSavedToWatchlist expects the movie in GET /api/watchlist but the list is empty.
Here is the add method. Which line should persist the entry? Explain in 2 lines, don't rewrite the file.
```
```
In Spring Data JPA, if I change a field on an entity I got from findById() outside a transaction,
is it saved automatically?
```
```
pytest says: assert 'FUNDED' == 'REPAID'. Here is repay_loan(). What state update is missing?
```
```
This comparison: count > THRESHOLD. The rule says "flag after 3 strikes". Is this off by one?
```

Bad prompts: "fix all bugs", pasting the whole repo, accepting a change that edits a test, accepting a big refactor.

---

## 7. Practice plan

| When | What |
|---|---|
| Today in class | Task 1 (with trainer), then Task 2 solo, **60-min timer** |
| Day 2 | Task 3 (hard), 60 min |
| Day 3 | Task 4 (hard), 60 min |
| Day 4 | Redo your worst task in the **other** stack, 45 min |

Restart a task from scratch: `git checkout .` (if you cloned) or re-extract the zip.

**Self-score after each attempt:** tests passed __/8 · minutes used __ · did I edit a test? (must be NO) · which bug took longest and why?

---

## 8. Bug patterns to memorise (all appear in this set)

1. Object built but never saved (`Model(...)` / `new Entity(...)` without `save`)
2. Delete call missing
3. Missing existence check → wrong status (200 instead of 404)
4. Missing duplicate check (should be 400/409)
5. Off-by-one: `>` vs `>=`, `<` vs `<=`
6. Check uses the wrong object (borrower's balance instead of lender's)
7. A changed object never saved (detached entity / missing field in `update_fields`)
8. Missing state transition (status never set to REPAID)
9. Wrong boolean: `and` vs `or`, `&&` vs `||`
10. Only the first item checked instead of all (`stars[0]`)
11. Filter applied in one branch only (published check skipped for some fields)
12. Missing normalisation (query not lower-cased)
13. Missing tie-breaker in sorting
14. Save happens **before** validation (bad data written, then 403)
15. Wrong status code (400 instead of 403)

All the best — go crack it. 🚀
