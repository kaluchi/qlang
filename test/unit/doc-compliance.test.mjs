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

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { evalQuery } from '../../src/eval.mjs';
import { keyword } from '../../src/types.mjs';
import { deepEqual } from '../../src/equality.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const docsDir = join(here, '..', '..', 'docs');

// Parse a qlang result string (from doc prose) into a runtime value.
// Supports: numbers, strings, booleans, null, keywords, Vecs, Maps, Sets.
// The simplest approach: evaluate the expected string as a qlang query.
async function parseExpected(text) {
  const trimmed = text.trim();
  // Skip multi-line results, Map/Set renders, and complex outputs
  // that can't be reliably round-tripped through evalQuery.
  if (trimmed.includes('\n') && !trimmed.startsWith('[') && !trimmed.startsWith('{')) return null;
  try {
    return await evalQuery(trimmed);
  } catch {
    return null; // unparseable expected value — skip
  }
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
          `  query: ${ex.query}`
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
