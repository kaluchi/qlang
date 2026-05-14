// Regression catcher for core.qlang examples.
//
// Every operand in core.qlang carries a docs prefix whose Quote
// segments are executable test cases. runExamples evaluates each
// Quote in isolation and reports {:snippet :actual :ok :error}; a
// Quote whose eval result is truthy passes, otherwise it fails.
//
// This walks every manifest binding (not handpicked operands) and
// surfaces each failing operand by name in the assertion message
// instead of reducing the result to a single boolean.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue } from '../../src/types.mjs';

const OK_KW      = 'ok';
const SNIPPET_KW = 'snippet';
const ERROR_KW   = 'error';
const ACTUAL_KW  = 'actual';

async function walkManifestExamples() {
  const failures = [];
  // Value-namespace bindings — operands, conduits, etc.
  const bindingNames = await evalQuery('manifest * /name');
  for (const name of bindingNames) {
    const exampleResults = await evalQuery(`reify(:${name}) | runExamples`);
    if (!Array.isArray(exampleResults)) continue;
    for (const exampleResult of exampleResults) {
      if (exampleResult.get(OK_KW) === true) continue;
      failures.push({
        operand: name,
        snippet: exampleResult.get(SNIPPET_KW)?.source ?? exampleResult.get(SNIPPET_KW),
        actual:  exampleResult.get(ACTUAL_KW),
        error:   exampleResult.get(ERROR_KW)
      });
    }
  }
  // Tag-namespace bindings — error tags carry repro Quotes
  // (`<query> !| type | eq(::TagName)`) injected from
  // conformance JSONLs; runExamples evaluates each to true.
  const tagNames = await evalQuery('manifest(:tag) * /name');
  for (const name of tagNames) {
    const exampleResults = await evalQuery(`reify(:"${name}") | runExamples`);
    if (!Array.isArray(exampleResults)) continue;
    for (const exampleResult of exampleResults) {
      if (exampleResult.get(OK_KW) === true) continue;
      failures.push({
        operand: name,
        snippet: exampleResult.get(SNIPPET_KW)?.source ?? exampleResult.get(SNIPPET_KW),
        actual:  exampleResult.get(ACTUAL_KW),
        error:   exampleResult.get(ERROR_KW)
      });
    }
  }
  return failures;
}

describe('manifest catalog self-test via runExamples', () => {
  it('every Quote example evaluates truthy', async () => {
    const failures = await walkManifestExamples();
    if (failures.length > 0) {
      const report = failures
        .map(f => `[${f.operand}] ~{${f.snippet}} => ${f.error ?? JSON.stringify(f.actual)}`)
        .join('\n');
      throw new Error(`${failures.length} manifest example(s) failed:\n${report}`);
    }
  });

  it('manifest-wide /ok distribution is {true}', async () => {
    // Top-level sanity: evaluate the homoiconic self-test query
    // from the runExamples operand's documentation and confirm the
    // distinct set of :ok values is exactly `[true]`.
    const distinctOkValues = await evalQuery('manifest * (runExamples * /ok) | flat | distinct');
    expect(isErrorValue(distinctOkValues)).toBe(false);
    expect(distinctOkValues).toEqual([true]);
  });
});
