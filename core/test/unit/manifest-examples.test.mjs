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
import { isErrorValue, isQSet } from '../../src/types.mjs';
import { printValue } from '../../src/runtime/format.mjs';
import { printQuoteSource } from '../../src/quote.mjs';

const OK_KW      = 'ok';
const SNIPPET_KW = 'snippet';
const ERROR_KW   = 'error';
const ACTUAL_KW  = 'actual';

function safeprint(v) {
  try { return printValue(v); }
  catch { return JSON.stringify(v); }
}

async function walkManifestExamples() {
  const failures = [];
  // Value-namespace bindings — operands, conduits, etc.
  const bindingNames = await evalQuery('manifest * /name');
  for (const name of bindingNames) {
    const exampleResults = await evalQuery(`:"${name}" | runExamples`);
    if (!Array.isArray(exampleResults)) continue;
    for (const exampleResult of exampleResults) {
      if (exampleResult.get(OK_KW) === true) continue;
      const snippet = exampleResult.get(SNIPPET_KW);
      failures.push({
        operand: name,
        snippet: printQuoteSource(snippet),
        actual:  exampleResult.get(ACTUAL_KW),
        error:   exampleResult.get(ERROR_KW),
        printed: safeprint(exampleResult.get(ACTUAL_KW))
      });
    }
  }
  // Tag-namespace bindings — error tags carry repro Quotes
  // with F.compact shape-spec (`!| [type /field ...] | eq([...])`)
  // injected from doc-prefix; runExamples evaluates each to true.
  // Tag-namespace lookup needs the `::` prefix preserved on the
  // Keyword subject so runExamples walks the tag's BindStep
  // through `findBindingStepAcrossModules`. The bare `manifest(:tag)
  // * /name` yields strings like `"::AddLeftNotNumberError"` — the
  // `:"…"` keyword-literal form lifts each name back to a Keyword
  // that carries the prefix through axis lookup.
  const tagNames = await evalQuery('manifest :tag * /name');
  for (const name of tagNames) {
    const exampleResults = await evalQuery(`:"${name}" | runExamples`);
    if (!Array.isArray(exampleResults)) continue;
    for (const exampleResult of exampleResults) {
      if (exampleResult.get(OK_KW) === true) continue;
      const snippet = exampleResult.get(SNIPPET_KW);
      failures.push({
        operand: name,
        snippet: printQuoteSource(snippet),
        actual:  exampleResult.get(ACTUAL_KW),
        error:   exampleResult.get(ERROR_KW),
        printed: safeprint(exampleResult.get(ACTUAL_KW))
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
        .map(f => `[${f.operand}] ~(${f.snippet})\n  => ${f.printed}${f.error ? '\n  error: ' + f.error : ''}`)
        .join('\n');
      throw new Error(`${failures.length} manifest example(s) failed:\n${report}`);
    }
  }, 30000);

  it('every example reads back as the steps it prints as', async () => {
    // `parse` prints a quote and reads text back; an example that
    // printed as text reading back as other steps would be a printer
    // that loses code.
    const unequal = await evalQuery(
      '[(manifest * /name), (manifest :tag * /name)] | flat * (keyword | examples) | flat'
      + ' | filter ~(as :example | parse | parse | eq example | not)');
    expect(unequal).toEqual([]);
  }, 30000);

  it('manifest-wide /ok distribution is {true}', async () => {
    // Top-level sanity: evaluate the homoiconic self-test query
    // from the runExamples operand's documentation and confirm the
    // distinct set of :ok values is exactly `[true]`.
    const distinctOkValues = await evalQuery('manifest * (runExamples * /ok) | flat | distinct');
    expect(isErrorValue(distinctOkValues)).toBe(false);
    expect(isQSet(distinctOkValues)).toBe(true);
    expect([...distinctOkValues]).toEqual([true]);
  }, 30000);
});
