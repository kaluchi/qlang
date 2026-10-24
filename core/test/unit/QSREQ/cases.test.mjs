// [QSREQ#target]

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { evalQuery } from '../../../src/notebook.mjs';
import { parseSource } from '../../../src/parse.mjs';
import { partOf, forEachPart } from '../../../src/parsed-parts.mjs';
import { isCallStep } from '../../../src/steps.mjs';
import { compareValues } from '../../../src/ordering.mjs';
import { isErrorValue, isQuote, isTag } from '../../../src/types.mjs';
import { expectedValueOf, raisedLiteralOf } from '../../helpers/expected-value.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const conformanceDir = join(here, '..', '..', 'conformance');
const files = readdirSync(conformanceDir, { recursive: true })
  .filter(f => f.endsWith('.jsonl'))
  .map(f => f.split(/[\\/]/).join('/'))
  .sort();

// [QSPTH#value]
function assertLiteral(quote, testName) {
  forEachPart(raisedLiteralOf(quote) ?? partOf(quote), ({ value, content }) => {
    if (isQuote(value) && content !== undefined) return false;
    if (isCallStep(value)) {
      throw new Error(
        `expect in "${testName}" contains the call of "${value.get('name').name}" — ` +
        `expected values must be pure literals, not computations`
      );
    }
  });
}

async function answersAsPresent(queryResult, now) {
  const present = await expectedValueOf(now);
  if (isErrorValue(queryResult) && isTag(present)) return queryResult.tag.name === present.name;
  return compareValues(queryResult, present) === 0;
}

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
      if (answers.some(answer => compareValues(answer, answers[0]) !== 0)) {
        contradictions.push(`${query}: ${sameQuery.map(test => `${test.file}#${test.name}`).join(', ')}`);
      }
    }
    expect(contradictions).toEqual([]);
  });

  it('opens a case that names a record with the one record in force, whose record stands in the root of the records', () => {
    const decisionsDir = join(here, '..', '..', '..', '..', 'docs', 'journal');
    const ungated = allCases.filter(({ file: _file, ...test }) => test.decision !== undefined
      && (typeof test.decision !== 'string' || Object.keys(test)[0] !== 'decision' || !existsSync(join(decisionsDir, `${test.decision}.md`))))
      .map(test => `${test.file}#${test.name}: ${JSON.stringify(test.decision ?? null)}`);
    expect(ungated).toEqual([]);
  });

  it('names each case by the rule it shows, in four words at least', () => {
    const terse = allCases.filter(test => test.name.split('-').length < 4).map(test => `${test.file}#${test.name}`);
    expect(terse).toEqual([]);
  });

  it('stands each file as a section of a chapter of the specification', () => {
    const specDir = join(here, '..', '..', '..', '..', 'docs', 'spec');
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
      it(`${test.target === true ? 'target: ' : ''}${test.name}`, async () => {
        assertLiteral(parseSource(test.expect), test.name);

        const queryResult = await evalQuery(test.query);
        const expectedValue = await expectedValueOf(test.expect);
        const answersAsExpected = compareValues(queryResult, expectedValue) === 0;
        if (test.target === true) {
          expect(test.decision, `${test.name}: a target names the decision that left it`).toBeDefined();
          expect(answersAsExpected, `${test.name}: the tree meets this target of ${test.decision}; drop its "target" mark`).toBe(false);
          expect(test.now, `${test.name}: a target records the answer the tree gives today as "now"`).toBeDefined();
          assertLiteral(parseSource(test.now), test.name);
          expect(await answersAsPresent(queryResult, test.now),
            `${test.name}: the target answers neither its goal nor its present "now"; tell whether a repair moved it or the case broke, then rewrite "now" or the case`).toBe(true);
        } else {
          expect(answersAsExpected, `${test.name}: result !== expected`).toBe(true);
        }
      });
    }
  });
}
