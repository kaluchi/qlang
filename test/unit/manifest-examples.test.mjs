// Regression catcher for manifest.qlang examples.
//
// Every operand in manifest.qlang carries an :examples Vec whose
// entries are `{:doc :snippet :expected?}` Maps. runExamples walks
// these entries in two modes:
//
//   Assertion mode — when the entry carries :expected, runExamples
//   evalQuery's both the snippet and the expected, deepEqual-compares
//   the two values, and sets :ok true iff they match.
//
//   Demo mode — when :expected is absent, runExamples only
//   parse-verifies the snippet; it is :ok true iff the grammar
//   accepts the text. Demo mode covers examples whose snippets
//   reference caller-supplied bindings that are not installed in
//   runExamples's isolated env.
//
// These tests do two things the conformance suite cannot do on its
// own: they walk every manifest binding (not only handpicked
// individual operands), and they surface each failing operand by
// name in the assertion message rather than reducing the result to
// a single boolean.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { keyword, isErrorValue } from '../../src/types.mjs';

const OK_KW       = keyword('ok');
const SNIPPET_KW  = keyword('snippet');
const EXPECTED_KW = keyword('expected');
const ERROR_KW    = keyword('error');
const ACTUAL_KW   = keyword('actual');

// Collect failing {operand, snippet, expected, error} rows by
// calling runExamples on each binding in the manifest and
// inspecting the result Maps one entry at a time.
function walkManifestExamples() {
  const failures = [];
  const bindingNames = evalQuery('manifest * /name');
  for (const name of bindingNames) {
    const results = evalQuery(`reify(:${name}) | runExamples`);
    if (!Array.isArray(results)) continue;
    for (const result of results) {
      if (result.get(OK_KW) === true) continue;
      failures.push({
        operand:  name,
        snippet:  result.get(SNIPPET_KW),
        expected: result.get(EXPECTED_KW),
        actual:   result.get(ACTUAL_KW),
        error:    result.get(ERROR_KW)
      });
    }
  }
  return failures;
}

describe('manifest catalog self-test via runExamples', () => {
  it('every assertion-mode example matches its :expected literal', () => {
    const failures = walkManifestExamples();
    const assertionFailures = failures.filter(f => typeof f.expected === 'string');
    if (assertionFailures.length > 0) {
      const report = assertionFailures
        .map(f => `[${f.operand}] ${f.snippet} (expected ${f.expected}) => ${f.error ?? JSON.stringify(f.actual)}`)
        .join('\n');
      throw new Error(`${assertionFailures.length} manifest assertion-mode example(s) failed:\n${report}`);
    }
  });

  it('every demo-mode example parses as valid qlang', () => {
    const failures = walkManifestExamples();
    const parseFailures = failures.filter(f => typeof f.expected !== 'string');
    if (parseFailures.length > 0) {
      const report = parseFailures
        .map(f => `[${f.operand}] ${f.snippet} => ${f.error}`)
        .join('\n');
      throw new Error(`${parseFailures.length} manifest demo-mode example(s) failed to parse:\n${report}`);
    }
  });

  it('manifest-wide /ok distribution is {true}', () => {
    // Top-level sanity: evaluate the homoiconic self-test query
    // from the runExamples operand's documentation and confirm the
    // distinct set of :ok values is exactly `[true]`. This is the
    // same shape the review recommends for catching future drift
    // at the single-query level, independent of the per-operand
    // breakdown above.
    const result = evalQuery('manifest * (runExamples * /ok) | flat | distinct');
    expect(isErrorValue(result)).toBe(false);
    expect(result).toEqual([true]);
  });
});
