// Doc-compliance test — extracts qlang REPL examples from markdown
// specification files, parses and evaluates each query, and compares
// the result against the documented expected value. Catches doc/code
// drift automatically: if a spec example stops matching the runtime,
// this test fails with the exact file, line, and divergent result.
//
// Two extraction patterns are supported:
//
//   1. Fenced-code REPL sessions (qlang-spec.md):
//      > query
//      expected result
//
//   2. Inline prose examples (qlang-operands.md):
//      `query` → `expected`
//
// Both planes run the same way: the expected side goes through the
// parser first, so a pair whose right half is prose drops out rather
// than failing.

import { describe, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { evalQuery } from '../../src/eval.mjs';
import { printValue } from '../../src/index.mjs';
import { parse } from '../../src/parse.mjs';
import { deepEqual } from '../../src/equality.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const docsDir = join(here, '..', '..', '..', 'docs');

// Lift a documented result into a runtime value by evaluating it as
// a qlang expression. The parser is the gate: prose trailing a REPL
// result drops out because it does not parse, while every documented
// value — the multi-line `::Tag!{…}` error renders and the
// pretty-printed Map / Vec / Set forms included — parses and is
// compared. `evalQuery` lifts a parse failure into a `::ParseError`
// value rather than throwing, so the gate reads `parse` directly.
function isParseableExpectation(text) {
  try {
    parse(text);
    return true;
  } catch {
    return false;
  }
}

async function parseExpected(text) {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  if (!isParseableExpectation(trimmed)) return null;
  return await evalQuery(trimmed);
}

// Extract REPL-session examples from fenced code blocks.
// Pattern: lines starting with `> ` inside ``` blocks, followed by
// expected output lines until the next `> ` or blank line.
function extractReplExamples(source, filePath) {
  const lines = source.split('\n');
  const examples = [];
  let inFence = false;
  let currentQuery = null;
  let currentExpectedLines = [];
  let queryLine = 0;

  function flush() {
    if (currentQuery !== null && currentExpectedLines.length > 0) {
      const expectedText = currentExpectedLines.join('\n').trim();
      if (expectedText.length > 0) {
        examples.push({
          query: currentQuery,
          expected: expectedText,
          file: filePath,
          line: queryLine
        });
      }
    }
    currentQuery = null;
    currentExpectedLines = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      if (inFence) {
        flush();
        inFence = false;
      } else {
        inFence = true;
      }
      continue;
    }
    if (!inFence) continue;

    if (line.startsWith('> ')) {
      flush();
      currentQuery = line.slice(2).trim();
      queryLine = i + 1;
    } else if (currentQuery !== null) {
      // Continuation lines (multi-line queries starting with spaces)
      // or expected result lines.
      if (line.startsWith('  ') && currentExpectedLines.length === 0) {
        // Multi-line query continuation
        currentQuery += '\n' + line.trim();
      } else if (line.trim() === '') {
        flush();
      } else {
        currentExpectedLines.push(line);
      }
    }
  }
  flush();
  return examples;
}

// Extract inline prose examples from the operand reference.
// Pattern: `query` → `expected`, both fenced in backticks on one
// line, the form every entry's **Example** bullet uses. A pair whose
// expected side is prose rather than a qlang expression drops out at
// the parse gate, the same way a REPL result's trailing prose does.
const INLINE_PAIR = /`([^`]+)`\s*\u2192\s*`([^`]+)`/g;

function extractInlineExamples(source, filePath) {
  const examples = [];
  const lines = source.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    for (const pair of lines[index].matchAll(INLINE_PAIR)) {
      examples.push({
        query: pair[1].trim(),
        expected: pair[2].trim(),
        file: filePath,
        line: index + 1
      });
    }
  }
  return examples;
}

// Run REPL examples from the spec doc.
const specPath = join(docsDir, 'qlang-spec.md');
const specSource = readFileSync(specPath, 'utf8');
const specExamples = extractReplExamples(specSource, 'qlang-spec.md');

describe('doc-compliance: qlang-spec.md REPL examples', () => {
  for (const ex of specExamples) {
    it(`line ${ex.line}: ${ex.query.substring(0, 60)}${ex.query.length > 60 ? '...' : ''}`, async () => {
      const expectedValue = await parseExpected(ex.expected);
      if (expectedValue === null) return; // skip unparseable expected values

      let queryResult;
      try {
        queryResult = await evalQuery(ex.query);
      } catch (thrownErr) {
        throw new Error(
          `Doc example at ${ex.file}:${ex.line} threw: ${thrownErr.message}\n` +
          `  query: ${ex.query}`,
          { cause: thrownErr }
        );
      }
      const match = deepEqual(queryResult, expectedValue);
      if (!match) {
        // Build a readable diff for the failure message
        const resultStr = JSON.stringify(queryResult, (_, v) =>
          v instanceof Map ? Object.fromEntries(v) :
          v instanceof Set ? [...v] : v
        );
        const expectedStr = JSON.stringify(expectedValue, (_, v) =>
          v instanceof Map ? Object.fromEntries(v) :
          v instanceof Set ? [...v] : v
        );
        throw new Error(
          `Doc example at ${ex.file}:${ex.line} diverged:\n` +
          `  query:    ${ex.query}\n` +
          `  expected: ${expectedStr}\n` +
          `  actual:   ${resultStr}`
        );
      }
    });
  }
});

const operandsPath = join(docsDir, 'qlang-operands.md');
const operandsSource = readFileSync(operandsPath, 'utf8');
const operandExamples = extractInlineExamples(operandsSource, 'qlang-operands.md');

describe('doc-compliance: qlang-operands.md inline examples', () => {
  for (const ex of operandExamples) {
    it(`line ${ex.line}: ${ex.query.substring(0, 60)}${ex.query.length > 60 ? '...' : ''}`, async () => {
      const expectedValue = await parseExpected(ex.expected);
      if (expectedValue === null) return; // expected side is prose

      let queryResult;
      try {
        queryResult = await evalQuery(ex.query);
      } catch (thrownErr) {
        throw new Error(
          `Doc example at ${ex.file}:${ex.line} threw: ${thrownErr.message}\n` +
          `  query: ${ex.query}`,
          { cause: thrownErr }
        );
      }
      if (!deepEqual(queryResult, expectedValue)) {
        throw new Error(
          `Doc example at ${ex.file}:${ex.line} diverged:\n` +
          `  query:    ${ex.query}\n` +
          `  expected: ${printValue(expectedValue)}\n` +
          `  actual:   ${printValue(queryResult)}`
        );
      }
    });
  }
});
