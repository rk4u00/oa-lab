# Reference (hidden from candidates)

`reference.py` implements the specification from README.md independently of the C++ code.
It reproduces `tests/fixtures/mini/expected_results.json` exactly and was used to generate
`../hidden/data/expected_results.json` (the 19 graded results for `data/`):

```bash
python3 solution/reference.py --data starter/data --out hidden/data/expected_results.json
```

Defects visible from the grader on the original code include: records with `null` `parent_id` /
`max_results` rejected, loading stopping at a blank line, duplicate `query_id` lines collapsed,
wrong tie-break order, `products` serialised as `null` instead of `[]`, and descendant/region
handling issues — see the per-request failures.
