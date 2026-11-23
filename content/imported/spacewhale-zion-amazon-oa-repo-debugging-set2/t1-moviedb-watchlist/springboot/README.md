# Task 1 — MovieDB Watchlist + Rate Limiting

> **Examate · Amazon SDE OA — AI-assisted repository debugging practice**
> Stack: Java 17 · Spring Boot 3 · JPA/H2 · JUnit 5 + MockMvc  |  Time: **60 min**  |  Level: Medium (Amazon level)
> Same task, same bugs, also available in `../django/`. Pick ONE stack, like in the real OA.

This is a practice rebuild of a task that Amazon candidates reported in 2026. Amazon's own repository code has never been
published, so the code here is ours; the scenario, rules and bug types follow the reports cited below.

## Where this question comes from

**Evidence: strong.** Rebuilt from an Amazon SDE Intern OA report (LeetCode Discuss, Sep 2026, Spring Boot) of a MovieDB
app with a broken watchlist and rate limiting via a provided `RateLimitingUtil`, plus other 2026 MovieDB watchlist reports.
*Our additions:* the exact limit (5 operations / 60 s) and response wording beyond the quoted messages — the report gave no numbers.

## Background

Users keep a personal watchlist of movies. After last week's release, support tickets say:

- "I add a movie, it says success, but my watchlist is still empty."
- "Remove says success but the movie is still there."
- "Rate limiting doesn't seem to work the way the spec says."

*Not every failing test is described above — read the tests.*

## API contract (the app MUST behave like this)

Every request sends `X-User-Id: <id>`. Missing/unknown → **401**.

| Endpoint | Behaviour |
|---|---|
| `GET /api/watchlist` | `{"movies": [{"id", "title"}]}` — this user's movies, in the order added. |
| `POST /api/watchlist` body `{"movieId": 1}` | **201** `{"message": "Movie added to watchlist"}`. Unknown movie → **404** `"Movie not found"`. Already in this user's list → **400** `"Movie already in watchlist"`. |
| `DELETE /api/watchlist/{movieId}` | **200** `{"message": "Movie removed from watchlist"}`. Not in this user's list → **404** `"Movie not found in watchlist"`. |

**Rate limiting** (use the provided `RateLimitingUtil`): each user may make at most **5 successful add/remove operations in any
rolling 60-second window**. Add and remove share the same counter. Once a user has 5 in the window, the next add **or**
remove returns **429** `"Too many requests"` and changes nothing. Failed requests (404/400) do not count. Old operations
expire after 60 s. Limits are per user.

## Project layout

```
src/main/java/com/examate/watchlist/
  controller/WatchlistController.java   <- start here
  util/RateLimitingUtil.java
  repository/WatchlistRepository.java   (all needed methods exist; no bugs)
  model/  common/                       (no bugs)
src/test/java/...                       DO NOT EDIT
```

## Setup & run (Spring Boot)

```bash
mvn test                                        # run all tests
mvn test -Dtest=ClassName#methodName            # run one test
```
Needs **JDK 17+** and **Maven 3.9+** (or open the folder in IntelliJ IDEA and click the green ▶ next to a test).
First run downloads dependencies (needs internet, ~2 min).
Database is an in-memory H2 — nothing to install.

At the start you should see **6 failed, 2 passed**. Goal: all tests green.

## Rules (same as the real OA)

1. **Do not edit the tests.** Fix the application code.
2. AI assistant = **helper, not solver**. Ask it to explain errors and code; don't paste the repo and ask it to "fix everything".
3. Smallest correct change. Don't change endpoints, parameters or response shapes.
4. Your trainer has **hidden tests** for every rule in this README — passing the visible tests is not the finish line.
5. Time limit: **60 minutes**.
