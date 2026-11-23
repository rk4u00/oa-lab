#!/usr/bin/env python3
"""OA Lab grader for output-comparison challenges.

Runs the candidate's binary on one or more datasets, compares its results.json with the expected
file entry by entry, and writes one JUnit test case per request line.

  grade.py --binary "build/category_engine" \
           --suite  "sample:tests/fixtures/mini:tests/fixtures/mini/expected_results.json" \
           --smoke  "data" \
           --suite  "hidden:data:.oa/hidden/data/expected_results.json:hidden" \
           --junit  .oa/results.xml

Hidden suites never print expected values: only which field is wrong.
"""
import argparse
import json
import math
import os
import shlex
import subprocess
import sys
import time
from xml.sax.saxutils import escape, quoteattr

TIMEOUT = 30


def run(binary, data_dir, out):
    if os.path.exists(out):
        os.remove(out)
    cmd = shlex.split(binary) + ["--data", data_dir, "--out", out]
    t = time.time()
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT)
        return p.returncode, p.stdout, p.stderr, time.time() - t
    except subprocess.TimeoutExpired:
        return "timeout", "", f"Timed out after {TIMEOUT}s", time.time() - t
    except FileNotFoundError:
        return "missing", "", f"Binary not found: {cmd[0]} (did the build succeed?)", 0.0


def exit_problem(code):
    if code == 0:
        return None
    if code == "timeout":
        return f"the program did not finish within {TIMEOUT}s"
    if code == "missing":
        return "the program binary was not found (build failed?)"
    if isinstance(code, int) and code < 0:
        return f"the program crashed (signal {-code})"
    return f"the program exited with status {code}"


def load_output(out):
    with open(out, encoding="utf-8") as f:
        doc = json.load(f)
    res = doc.get("results") if isinstance(doc, dict) else None
    if not isinstance(res, list):
        raise ValueError('top-level "results" array is missing')
    return res


def num_eq(a, b):
    try:
        return math.isclose(float(a), float(b), rel_tol=1e-9, abs_tol=1e-9)
    except (TypeError, ValueError):
        return False


def describe_products(ps):
    return ", ".join(f'{p.get("product_id")}({p.get("popularity")})' for p in ps) or "(none)"


def compare(exp, act, hidden):
    """Return None if equal, else a failure message."""
    if act is None:
        return "no result entry for this request line (missing or out of order)"
    problems = []
    for key in ("query_id", "category_id", "region"):
        if act.get(key) != exp.get(key):
            problems.append(f"{key} is wrong" if hidden else f"{key}: expected {exp.get(key)!r}, got {act.get(key)!r}")
    if act.get("matched_count") != exp.get("matched_count"):
        problems.append("matched_count is wrong" if hidden else f"matched_count: expected {exp.get('matched_count')}, got {act.get('matched_count')}")
    ap, ep = act.get("products"), exp.get("products", [])
    if not isinstance(ap, list):
        problems.append('"products" must always be a JSON array')
    else:
        same = len(ap) == len(ep) and all(
            isinstance(a, dict) and a.get("product_id") == e["product_id"] and a.get("name") == e["name"] and num_eq(a.get("popularity"), e["popularity"])
            for a, e in zip(ap, ep)
        )
        if not same:
            if hidden:
                if len(ap) != len(ep):
                    problems.append("wrong number of products returned")
                else:
                    problems.append("products differ (selection, order or fields)")
            else:
                problems.append(f"products:\n    expected: {describe_products(ep)}\n    got:      {describe_products(ap)}")
    return "\n".join(problems) if problems else None


def grade_suite(name, binary, data_dir, expected_path, hidden, workdir):
    cases = []
    with open(expected_path, encoding="utf-8") as f:
        expected = json.load(f)["results"]
    out = os.path.join(workdir, f"out-{name}.json")
    code, so, se, dt = run(binary, data_dir, out)
    problem = exit_problem(code)
    try:
        actual = load_output(out) if os.path.exists(out) else None
        parse_err = None if actual is not None else "results file was not written"
    except Exception as e:  # noqa: BLE001
        actual, parse_err = None, f"results file is not valid JSON: {e}"
    for i, exp in enumerate(expected):
        label = f"{name} › line {i + 1} · {exp['query_id']} (category {exp['category_id']}, {exp['region']})"
        if problem or parse_err:
            tail = "" if hidden else ("\n" + se.strip()[-1500:] if se.strip() else "")
            cases.append((label, "error", f"{problem or parse_err}{tail}", dt / max(1, len(expected))))
            continue
        msg = compare(exp, actual[i] if i < len(actual) else None, hidden)
        cases.append((label, "failed" if msg else "passed", msg, dt / max(1, len(expected))))
    if actual is not None and len(actual) > len(expected) and not (problem or parse_err):
        cases.append((f"{name} › result count", "failed", f"expected {len(expected)} result entries, got {len(actual)}", 0.0))
    return cases


def smoke(name, binary, data_dir, workdir):
    out = os.path.join(workdir, f"out-smoke-{name.replace('/', '_')}.json")
    code, so, se, dt = run(binary, data_dir, out)
    label = f"run on {data_dir}/ › exits 0 and writes one result per request"
    problem = exit_problem(code)
    if problem:
        return [(label, "error", f"{problem}\n{se.strip()[-1500:]}", dt)]
    try:
        actual = load_output(out)
    except Exception as e:  # noqa: BLE001
        return [(label, "failed", f"results file invalid: {e}", dt)]
    with open(os.path.join(data_dir, "requests.jsonl"), encoding="utf-8") as f:
        n = sum(1 for line in f if line.strip())
    if len(actual) != n:
        return [(label, "failed", f"expected {n} result entries (one per request line), got {len(actual)}", dt)]
    bad = [i + 1 for i, r in enumerate(actual) if not isinstance(r.get("products"), list)]
    if bad:
        return [(label, "failed", f'"products" is not an array for result(s) {bad}', dt)]
    return [(label, "passed", None, dt)]


def write_junit(path, cases):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    fails = sum(1 for c in cases if c[1] == "failed")
    errs = sum(1 for c in cases if c[1] == "error")
    with open(path, "w", encoding="utf-8") as f:
        f.write(f'<?xml version="1.0" encoding="utf-8"?>\n<testsuites><testsuite name="grader" tests="{len(cases)}" failures="{fails}" errors="{errs}">\n')
        for name, status, msg, dt in cases:
            f.write(f'  <testcase classname="output" name={quoteattr(name)} time="{dt:.3f}"')
            if status == "passed":
                f.write("/>\n")
            else:
                tag = "failure" if status == "failed" else "error"
                f.write(f'><{tag} message={quoteattr((msg or "").splitlines()[0])}>{escape(msg or "")}</{tag}></testcase>\n')
        f.write("</testsuite></testsuites>\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--binary", required=True)
    ap.add_argument("--suite", action="append", default=[], help="name:data_dir:expected.json[:hidden]")
    ap.add_argument("--smoke", action="append", default=[], help="data_dir")
    ap.add_argument("--junit", default=".oa/results.xml")
    a = ap.parse_args()
    workdir = os.path.dirname(a.junit) or "."
    os.makedirs(workdir, exist_ok=True)
    cases = []
    for s in a.smoke:
        cases += smoke(s, a.binary, s, workdir)
    for spec in a.suite:
        parts = spec.split(":")
        name, data_dir, exp = parts[0], parts[1], parts[2]
        cases += grade_suite(name, a.binary, data_dir, exp, len(parts) > 3 and parts[3] == "hidden", workdir)
    write_junit(a.junit, cases)
    passed = sum(1 for c in cases if c[1] == "passed")
    for name, status, msg, _ in cases:
        mark = {"passed": "PASS", "failed": "FAIL", "error": "ERR "}[status]
        print(f"[{mark}] {name}")
        if msg:
            print("       " + msg.replace("\n", "\n       "))
    print(f"\n{passed}/{len(cases)} passed")
    sys.exit(0 if passed == len(cases) else 1)


if __name__ == "__main__":
    main()
