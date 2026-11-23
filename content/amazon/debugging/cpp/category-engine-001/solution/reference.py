#!/usr/bin/env python3
"""Reference implementation of the category-engine specification (README.md).

Written independently of the C++ code, only from the spec, and used to generate the hidden
expected results for data/. Same CLI as the real binary: --data DIR --out FILE.
"""
import argparse
import json
import sys
from collections import defaultdict


def load_jsonl(path):
    out = []
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            if not line.strip():
                continue  # blank lines are ignored
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError as e:
                print(f"[warn] {path}:{n}: {e}", file=sys.stderr)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data")
    ap.add_argument("--out", default="results.json")
    a = ap.parse_args()

    cats = json.load(open(f"{a.data}/categories.json", encoding="utf-8"))["categories"]
    known = {c["id"] for c in cats}
    children = defaultdict(list)
    for c in cats:  # order independent; parent_id null or missing => top level
        if c.get("parent_id") is not None:
            children[c["parent_id"]].append(c["id"])

    def subtree(root):  # root + all descendants, any depth (iterative, cycle-safe)
        seen, stack = set(), [root]
        while stack:
            x = stack.pop()
            if x in seen:
                continue
            seen.add(x)
            stack.extend(children.get(x, []))
        return seen

    products = load_jsonl(f"{a.data}/products.jsonl")
    results = []
    for r in load_jsonl(f"{a.data}/requests.jsonl"):
        limit = r.get("max_results")
        limit = 5 if limit is None else int(limit)
        if r["category_id"] not in known:
            matched = []
        else:
            scope = subtree(r["category_id"])
            matched = [p for p in products if p["category_id"] in scope and p["region"] == r["region"]]
        matched.sort(key=lambda p: (-float(p["popularity"]), p["product_id"]))
        results.append({
            "query_id": r["query_id"],
            "category_id": r["category_id"],
            "region": r["region"],
            "matched_count": len(matched),
            "products": [{"product_id": p["product_id"], "name": p["name"], "popularity": float(p["popularity"])} for p in matched[: max(0, limit)]],
        })
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump({"results": results}, f, indent=2)
        f.write("\n")


if __name__ == "__main__":
    main()
