import { XMLParser } from 'fast-xml-parser';
import type { TestCaseResult } from '@oa-lab/shared';

const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Parse JUnit XML (pytest, jest-junit, maven surefire) into a flat list of test results. */
export function parseJUnit(xml: string): TestCaseResult[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const doc = parser.parse(xml);
  // node:test emits <testcase> directly under <testsuites>; treat the root as a suite too.
  const suites = doc.testsuites ? [doc.testsuites] : arr(doc.testsuite);
  const out: TestCaseResult[] = [];
  const visit = (suite: any) => {
    for (const tc of arr<any>(suite.testcase)) {
      const name = [tc['@_classname'], tc['@_name']].filter(Boolean).join('::');
      const failure = tc.failure ?? tc.error;
      const msg = (f: any) => (typeof f === 'string' ? f : [f?.['@_message'], f?.['#text']].filter(Boolean).join('\n'));
      let status: TestCaseResult['status'] = 'passed';
      if (tc.skipped !== undefined) status = 'skipped';
      if (tc.error !== undefined) status = 'error';
      if (tc.failure !== undefined) status = 'failed';
      out.push({
        name,
        status,
        durationMs: tc['@_time'] ? Math.round(parseFloat(tc['@_time']) * 1000) : undefined,
        message: failure !== undefined ? msg(arr(failure)[0]).slice(0, 4000) : undefined,
      });
    }
    for (const child of arr<any>(suite.testsuite)) visit(child);
  };
  suites.forEach(visit);
  return out;
}

/** Parse `jest --json` output. */
export function parseJestJson(json: string): TestCaseResult[] {
  const doc = JSON.parse(json);
  const out: TestCaseResult[] = [];
  for (const file of doc.testResults ?? []) {
    const rel = String(file.name ?? '').split(/[\\/]/).slice(-2).join('/');
    for (const a of file.assertionResults ?? []) {
      out.push({
        name: [rel, ...(a.ancestorTitles ?? []), a.title].filter(Boolean).join(' › '),
        status: a.status === 'passed' ? 'passed' : a.status === 'failed' ? 'failed' : 'skipped',
        durationMs: a.duration ?? undefined,
        message: a.failureMessages?.length ? stripAnsi(a.failureMessages.join('\n')).slice(0, 4000) : undefined,
      });
    }
    if ((file.assertionResults ?? []).length === 0 && file.status === 'failed') {
      out.push({ name: rel, status: 'error', message: stripAnsi(file.message ?? 'Test suite failed to run').slice(0, 4000) });
    }
  }
  return out;
}

export function stripAnsi(s: string) {
  return s.replace(/\u001b\[[0-9;]*m/g, '');
}
