import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJUnit } from './junit';

test('parses pytest junit output', () => {
  const xml = `<?xml version="1.0"?><testsuites><testsuite name="pytest" tests="3">
    <testcase classname="tests.test_a" name="test_ok" time="0.01"/>
    <testcase classname="tests.test_a" name="test_bad" time="0.02"><failure message="assert 1 == 2">trace</failure></testcase>
    <testcase classname="tests.test_a" name="test_skip"><skipped/></testcase>
  </testsuite></testsuites>`;
  const r = parseJUnit(xml);
  assert.equal(r.length, 3);
  assert.equal(r[0].status, 'passed');
  assert.equal(r[1].status, 'failed');
  assert.match(r[1].message!, /assert 1 == 2/);
  assert.equal(r[2].status, 'skipped');
});

test('parses node:test junit output (failure attribute + element)', () => {
  const xml = `<testsuites><testcase name="t1" time="0.1" classname="test" failure="boom"><failure type="x" message="boom">stack</failure></testcase><testcase name="t2" classname="test"/></testsuites>`;
  const r = parseJUnit(xml);
  assert.deepEqual(r.map((t) => t.status), ['failed', 'passed']);
});

import { parseJestJson } from './junit';
test('parses jest --json output', () => {
  const r = parseJestJson(JSON.stringify({ testResults: [{ name: '/w/tests/a.test.js', status: 'failed', assertionResults: [
    { title: 'works', ancestorTitles: ['cards'], status: 'passed', duration: 3 },
    { title: 'breaks', ancestorTitles: ['cards'], status: 'failed', failureMessages: ['\u001b[31mexpected\u001b[39m'] },
  ] }] }));
  assert.equal(r.length, 2);
  assert.equal(r[1].status, 'failed');
  assert.equal(r[1].message, 'expected');
  assert.equal(r[0].name, 'tests/a.test.js › cards › works');
});
