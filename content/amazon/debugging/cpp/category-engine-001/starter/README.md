# category-engine

Batch service behind the storefront's **category browse** pages. Given the
category taxonomy, the product catalog and a batch of browse requests, it
produces the ranked product list for every request and writes all of them to
`results.json`.

The service was written by a previous team member and is now owned by you.
Production reports say browse pages are showing the wrong products, wrong
counts and sometimes nothing at all. **Your task is to debug the service so
that its output matches the specification below.**

---

## Assessment brief

* Time box: 60–90 minutes.
* Fix the existing code. Do not rewrite the service from scratch; keep the
  module layout and the public interfaces in `include/` unless a change is
  needed for correctness.
* The program must keep building with the command below and must not crash on
  the provided inputs.
* Your output on `data/` will be checked against a hidden expected
  `results.json`. A small visible sample is in `tests/fixtures/mini/` (see
  `tests/test_cases.md`).
* Be ready to explain each defect you found, its symptom and why your fix is
  correct.

---

## Specification

For **every** request line in `requests.jsonl`, in file order:

1. **Scope.** Find all products in the requested category **and all of its
   descendant categories, at any depth**.
2. **Region.** Keep only products whose `region` is an **exact,
   case-sensitive** match for the request's `region` (`"IN"` ≠ `"in"`).
3. **Ranking.** Sort by `popularity` **descending**.
4. **Ties.** Break popularity ties by `product_id` **ascending**.
5. **matched_count.** The number of products that matched steps 1–2,
   computed **before** the result limit is applied.
6. **Limit.** Return at most `max_results` products. `max_results` is
   optional; when it is absent or `null` the default is **5**. A value of
   `0` is valid and means "return no products" (the count is still
   reported).
7. **Order.** Output contains exactly one result per request line, in the
   same order as the input. `query_id` values are not guaranteed to be
   unique (clients retry), and each line still gets its own result entry.
8. **Unknown category.** If the requested `category_id` is not defined in
   `categories.json`, the result has `matched_count: 0` and an empty
   `products` array, even if some products reference that id.

`products` is always a JSON array, possibly empty.

---

## Input formats

### `categories.json`

A single JSON document:

```json
{
  "taxonomy_version": "2024.11-r3",
  "categories": [
    { "id": 1,  "name": "Electronics", "parent_id": null },
    { "id": 10, "name": "Computers",   "parent_id": 1 },
    { "id": 2,  "name": "Home & Kitchen" }
  ]
}
```

* `id`: positive integer, unique.
* `parent_id`: integer id of the parent category. A top-level category has
  `parent_id: null`, or omits the field entirely.
* Entries are **not** guaranteed to be in any particular order: a child may
  appear before its parent.
* The taxonomy is a tree of arbitrary depth.
* `name` is informational only.

### `products.jsonl`

One JSON object per line:

```json
{"product_id": 4021, "name": "Viper 15 Gaming Laptop", "category_id": 1000, "region": "IN", "popularity": 92}
```

* `product_id`: integer, unique.
* `category_id`: integer. A product may reference a category id that does
  not exist in the taxonomy (stale catalog data).
* `region`: string, case-sensitive.
* `popularity`: JSON number, **integer or decimal** (e.g. `88.7`).
* Blank lines may appear anywhere in the file and must be ignored.

### `requests.jsonl`

One JSON object per line:

```json
{"query_id": "q1", "category_id": 10, "region": "IN", "max_results": 5}
```

* `max_results`: optional non-negative integer; absent or `null` → 5.
* Blank lines must be ignored.

---

## Output format

`results.json`:

```json
{
  "results": [
    {
      "query_id": "q1",
      "category_id": 10,
      "region": "IN",
      "matched_count": 11,
      "products": [
        { "product_id": 4044, "name": "Blizzard Cooling Pad", "popularity": 95.0 }
      ]
    }
  ]
}
```

JSON key order and integer-vs-decimal number formatting (`80` vs `80.0`) do
not matter; values do.

---

## Architecture

```
            ┌──────────────┐
 data/ ───▶ │  parser.cpp  │  JSON / JSONL ──▶ Category, Product, BrowseRequest
            └──────┬───────┘
                   │
       ┌───────────┴────────────┐
       ▼                        ▼
┌──────────────────┐   ┌──────────────────┐
│ CategoryService  │   │  ProductService  │
│ taxonomy index,  │   │ catalog + per-   │
│ descendant walk  │   │ category index,  │
└────────┬─────────┘   │ region filter,   │
         │             │ ranking          │
         │             └────────┬─────────┘
         └──────────┬───────────┘
                    ▼
            ┌───────────────┐        ┌──────────────────┐
            │ BrowseEngine  │ ─────▶ │ result_writer    │ ──▶ results.json
            │ per-request   │        │ JSON serialiser  │
            │ orchestration │        └──────────────────┘
            └───────────────┘
```

| File | Responsibility |
|------|----------------|
| `include/category.h` | `Category` model and taxonomy constants |
| `include/product.h` | `Product` model, region availability check |
| `include/request.h` | `BrowseRequest` model, default limit |
| `include/string_utils.h` | Small string helpers |
| `include/parser.h`, `src/parser.cpp` | Loading and validating the three input files |
| `include/category_service.h`, `src/category_service.cpp` | Taxonomy index: id lookup, parent → children map, descendant traversal |
| `include/product_service.h`, `src/product_service.cpp` | Catalog storage, per-category index, candidate collection, ranking |
| `include/browse_engine.h`, `src/browse_engine.cpp` | Runs each request through scope → filter → rank → limit |
| `include/result_writer.h`, `src/result_writer.cpp` | Serialises results to JSON |
| `src/main.cpp` | CLI entry point, wiring, logging |
| `third_party/nlohmann/json.hpp` | Vendored nlohmann/json 3.11.3 (single header) |

Malformed records are reported on **stderr** with a `[warn]` prefix and
skipped. A summary line with load counts is printed at startup.

---

## Build

Requirements: a C++17 compiler (GCC ≥ 9, Clang ≥ 10, MSVC 2019+) and
CMake ≥ 3.14. nlohmann/json is vendored, so no network access is needed. If
an installed `nlohmann_json` package is found, it is used instead.

```bash
cmake -S . -B build
cmake --build build -j
```

Optional sanitizer build (GCC/Clang):

```bash
cmake -S . -B build-asan -DCATEGORY_ENGINE_SANITIZE=ON
cmake --build build-asan -j
```

## Run

From the repository root:

```bash
./build/category_engine                       # reads ./data, writes ./results.json
./build/category_engine --data data --out results.json
./build/category_engine --data tests/fixtures/mini --out mini_results.json
```

On Windows with a multi-config generator the binary is at
`build\Debug\category_engine.exe`.
