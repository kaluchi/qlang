// Conformance test runner.
//
// Each JSONL line has two qlang expressions: query (arbitrary) and
// expect (must be a pure literal — no operand calls, no pipelines).
// Both are eval'd, results compared via deepEqual.
//
// The expect-is-literal guard catches test authoring mistakes where
// the expected side accidentally computes instead of declaring a
// static value.
//
// A case may name the decision that left it as a requirement,
// `"decision": "D14"` or a vector of them, and a requirement the tree
// does not meet yet is a target, `"target": true`, which must answer
// otherwise; a target that answers as expected fails until the branch
// that met it drops the mark [D58]. The requirements agree with each
// other in the one form a runner can see: no two cases hold one query
// to different answers, and every decision a case names has its record.

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

// assertLiteralAst — walks the AST and rejects any node that performs
// computation (OperandCall, Projection, ParenGroup with pipeline ops).
// Pipeline is allowed only as a container for compound literals
// (the parser wraps multi-step bodies in Pipeline nodes), and a quote
// literal is a literal whatever steps it holds.
function assertLiteralAst(ast, testName) {
  walkAst(ast, (node) => {
    if (node.type === 'QuoteLit') return false;
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

const casesByFile = files.map(file => ({
  file,
  cases: readFileSync(join(conformanceDir, file), 'utf8')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('//'))
    .map(line => JSON.parse(line)),
}));

describe('conformance: the requirements agree', () => {
  const allCases = casesByFile.flatMap(({ file, cases }) => cases.map(test => ({ file, ...test })));

  it('holds no query to two answers', async () => {
    const contradictions = [];
    for (const [query, sameQuery] of Map.groupBy(allCases, test => test.query)) {
      if (sameQuery.length < 2) continue;
      const answers = await Promise.all(sameQuery.map(test => evalQuery(test.expect)));
      if (answers.some(answer => !deepEqual(answer, answers[0]))) {
        contradictions.push(`${query}: ${sameQuery.map(test => `${test.file}#${test.name}`).join(', ')}`);
      }
    }
    expect(contradictions).toEqual([]);
  });

  it('names only decisions that have their record', () => {
    const decisionsDir = join(here, '..', '..', '..', 'docs', 'decisions');
    const unrecorded = allCases.flatMap(test => [test.decision ?? []].flat()
      .filter(decision => !existsSync(join(decisionsDir, `${decision}.md`)))
      .map(decision => `${test.file}#${test.name}: ${decision}`));
    expect(unrecorded).toEqual([]);
  });
});

for (const { file, cases } of casesByFile) {
  describe(`conformance: ${file}`, () => {
    for (const test of cases) {
      it(test.target === true ? `target: ${test.name}` : test.name, async () => {
        const expectedAst = parse(test.expect);
        assertLiteralAst(expectedAst, test.name);

        const queryResult = await evalQuery(test.query);
        const expectedValue = await evalQuery(test.expect);
        const answersAsExpected = deepEqual(queryResult, expectedValue);
        if (test.target === true) {
          expect(test.decision, `${test.name}: a target names the decision that left it`).toBeDefined();
          expect(answersAsExpected, `${test.name}: the tree meets this target of ${test.decision}; drop its "target" mark`).toBe(false);
        } else {
          expect(answersAsExpected, `${test.name}: result !== expected`).toBe(true);
        }
      });
    }
  });
}
