// Conformance test runner.
//
// Each JSONL line has two qlang expressions: query (arbitrary) and
// expect (must be a pure literal — no calls, no pipelines — or the print
// of a failure, its error at rest raised, `!{…} | raise` [QSWRK#cases]).
// Both are eval'd, results compared via deepEqual.
//
// Every file is a section of a chapter, and a case that names a record
// opens with a record in force, `{"decision":"Dnn",…}` [QSWRK#cases],
// and a requirement the tree does not meet yet is a target,
// `"target": true`, which answers its present, `"now"`, an error by its tag
// and any other value as its literal: a target that answers as expected
// fails until the branch that met it drops the mark, and one that answers
// neither fails until a reader tells a repair from a broken case
// [QSWRK#target]. The requirements agree with each other in the one
// form a runner can see: no two cases hold one query to different answers.

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { evalQuery } from '../../src/session.mjs';
import { parse } from '../../src/parse.mjs';
import { walkAst } from '../../src/walk.mjs';
import { deepEqual } from '../../src/equality.mjs';
import { isErrorValue, isTag } from '../../src/types.mjs';
import { expectedValueOf, raisedLiteralOf } from '../helpers/expected-value.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const conformanceDir = join(here, '..', 'conformance');
const files = readdirSync(conformanceDir, { recursive: true })
  .filter(f => f.endsWith('.jsonl'))
  .map(f => f.split(/[\\/]/).join('/'))
  .sort();

// assertLiteralAst refuses an expectation that holds a call outside a
// quote, a failure's print, `!{…} | raise`, read by the literal it raises;
// a path is a value [QSPTH#value], and a quote literal is a literal
// whatever steps it holds.
function assertLiteralAst(parsed, testName) {
  const ast = raisedLiteralOf(parsed) ?? parsed;
  walkAst(ast, (node) => {
    if (node.type === 'QuoteLit') return false;
    if (node.type === 'Call') {
      throw new Error(
        `expect in "${testName}" contains Call "${node.name}" — ` +
        `expected values must be pure literals, not computations`
      );
    }
  });
}

async function answersAsPresent(queryResult, now) {
  const present = await expectedValueOf(now);
  if (isErrorValue(queryResult) && isTag(present)) return queryResult.tag.name === present.name;
  return deepEqual(queryResult, present);
}

// The chapter of the specification a file stands under, `QSNAM` for
// `QSNAM/scope.jsonl`, or null for a file outside the chapters.
const chapterOf = file => /^(QS[A-Z]{3})\//.exec(file)?.[1] ?? null;

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
      const answers = await Promise.all(sameQuery.map(test => expectedValueOf(test.expect)));
      if (answers.some(answer => !deepEqual(answer, answers[0]))) {
        contradictions.push(`${query}: ${sameQuery.map(test => `${test.file}#${test.name}`).join(', ')}`);
      }
    }
    expect(contradictions).toEqual([]);
  });

  // A case is gated by its section, the file it stands in, and names a
  // record only while the record's change is in transit over it, the record
  // opening the case [QSWRK#cases].
  it('opens a case that names a record with the one record in force, whose record stands in the root of the records [QSWRK#cases]', () => {
    const decisionsDir = join(here, '..', '..', '..', 'docs', 'journal');
    const ungated = allCases.filter(({ file: _file, ...test }) => test.decision !== undefined
      && (typeof test.decision !== 'string' || Object.keys(test)[0] !== 'decision' || !existsSync(join(decisionsDir, `${test.decision}.md`))))
      .map(test => `${test.file}#${test.name}: ${JSON.stringify(test.decision ?? null)}`);
    expect(ungated).toEqual([]);
  });

  it('stands each file as a section of a chapter of the specification [QSWRK#cases]', () => {
    const specDir = join(here, '..', '..', '..', 'docs', 'spec');
    const homeless = files.filter(file => {
      const [chapter, section] = [chapterOf(file), file.split('/').pop().replace(/\.jsonl$/, '')];
      const spec = chapter !== null && existsSync(specDir) ? readdirSync(specDir).find(name => name.startsWith(`${chapter}-`)) : undefined;
      return spec === undefined || !readFileSync(join(specDir, spec), 'utf8').split(/\r?\n/).includes(`## ${section}`);
    });
    expect(homeless).toEqual([]);
  });
});

for (const { file, cases } of casesByFile) {
  describe(`conformance: ${file}`, () => {
    for (const test of cases) {
      it(test.target === true ? `target: ${test.name}` : test.name, async () => {
        const expectedAst = parse(test.expect);
        assertLiteralAst(expectedAst, test.name);

        const queryResult = await evalQuery(test.query);
        const expectedValue = await expectedValueOf(test.expect);
        const answersAsExpected = deepEqual(queryResult, expectedValue);
        if (test.target === true) {
          expect(test.decision, `${test.name}: a target names the decision that left it`).toBeDefined();
          expect(answersAsExpected, `${test.name}: the tree meets this target of ${test.decision}; drop its "target" mark`).toBe(false);
          expect(test.now, `${test.name}: a target records the answer the tree gives today as "now"`).toBeDefined();
          assertLiteralAst(parse(test.now), test.name);
          expect(await answersAsPresent(queryResult, test.now),
            `${test.name}: the target answers neither its goal nor its present "now"; tell whether a repair moved it or the case broke, then rewrite "now" or the case`).toBe(true);
        } else {
          expect(answersAsExpected, `${test.name}: result !== expected`).toBe(true);
        }
      });
    }
  });
}
