// Conformance test runner.
//
// Each JSONL line has two qlang expressions: query (arbitrary) and
// expect (must be a pure literal — no operand calls, no pipelines).
// Both are eval'd, results compared via deepEqual.
//
// The expect-is-literal guard catches test authoring mistakes where
// the expected side accidentally computes instead of declaring a
// static value.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { evalQuery } from '../../src/eval.mjs';
import { parse } from '../../src/parse.mjs';
import { walkAst } from '../../src/walk.mjs';
import { deepEqual } from '../../src/equality.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const conformanceDir = join(here, '..', 'conformance');
const files = readdirSync(conformanceDir, { recursive: true })
  .filter(f => f.endsWith('.jsonl'))
  .map(f => f.split(/[\\/]/).join('/'))
  .sort();

// Literal AST node types — no computation, no env lookup, no side effects.
const LITERAL_TYPES = new Set([
  'NumberLit', 'StringLit', 'BooleanLit', 'NilLit', 'Keyword',
  'VecLit', 'MapLit', 'MapEntry', 'SetLit', 'ErrorLit', 'Pipeline'
]);

// assertLiteralAst — walks the AST and rejects any node that performs
// computation (OperandCall, Projection, ParenGroup with pipeline ops).
// Pipeline is allowed only as a container for compound literals
// (the parser wraps multi-step bodies in Pipeline nodes).
function assertLiteralAst(ast, testName) {
  walkAst(ast, (node) => {
    if (node.type === 'OperandCall') {
      throw new Error(
        `expect in "${testName}" contains OperandCall "${node.name}" — ` +
        `expected values must be pure literals, not computations`
      );
    }
    if (node.type === 'Projection') {
      throw new Error(
        `expect in "${testName}" contains Projection — ` +
        `expected values must be pure literals`
      );
    }
  });
}

for (const file of files) {
  const path = join(conformanceDir, file);
  const lines = readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('//'));

  describe(`conformance: ${file}`, () => {
    for (const line of lines) {
      const test = JSON.parse(line);
      it(test.name, () => {
        const expectedAst = parse(test.expect);
        assertLiteralAst(expectedAst, test.name);

        const result = evalQuery(test.query);
        const expected = evalQuery(test.expect);
        expect(deepEqual(result, expected), `${test.name}: result !== expected`).toBe(true);
      });
    }
  });
}
