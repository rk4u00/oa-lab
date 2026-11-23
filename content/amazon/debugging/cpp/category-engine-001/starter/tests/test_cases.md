# Test cases

## How the submission is evaluated

1. The project is built with `cmake -S . -B build && cmake --build build`.
2. `./build/category_engine --data data --out results.json` is executed.
3. `results.json` is compared **semantically** with a hidden expected file:
   * the number and order of entries in `results` must match the request
     lines exactly;
   * for each entry, `query_id`, `category_id`, `region`, `matched_count`
     and the ordered list of `products` (`product_id`, `name`,
     `popularity`) must match;
   * key order and number formatting (`80` vs `80.0`) are ignored.
4. The process must exit with status 0 and must not crash on any input.

The hidden suite has one test per line of `data/requests.jsonl`
(19 tests). Each test passes or fails on its own.

## Visible sample: `tests/fixtures/mini/`

A tiny dataset with its expected output, so you can check the output format
and basic behaviour.

```
tests/fixtures/mini/
├── categories.json
├── products.jsonl
├── requests.jsonl
└── expected_results.json
```

Run it with:

```bash
./build/category_engine --data tests/fixtures/mini --out mini_results.json
```

Then compare `mini_results.json` with `tests/fixtures/mini/expected_results.json`.
Passing the sample is necessary, but **not sufficient**: the hidden tests
cover far more of the specification than the sample does.

## Writing your own checks

Before you change code, work out the expected result for a few requests by
hand from `data/`. Draw the category tree from `categories.json` first; most
requests only make sense with the tree in front of you.
