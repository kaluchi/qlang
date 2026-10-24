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
import { expectedValueOf, printedAnswerOf, writtenAnswerOf, writtenLiteralOf } from '../../helpers/expected-value.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const conformanceDir = join(here, '..', '..', 'conformance');
const files = readdirSync(conformanceDir, { recursive: true })
  .filter(f => f.endsWith('.jsonl'))
  .map(f => f.split(/[\\/]/).join('/'))
  .sort();

// [QSPTH#value]
function assertLiteral(source, testName) {
  forEachPart(partOf(parseSource(source)), ({ value, content }) => {
    if (isQuote(value) && content !== undefined) return false;
    if (isCallStep(value)) {
      throw new Error(
        `the answer "${testName}" writes holds the call of "${value.get('name').name}" — ` +
        `a case writes the print of its answer, a literal that computes nothing`
      );
    }
  });
}

async function answersAsPresent(answer, now) {
  const present = await evalQuery(now);
  if (isErrorValue(answer) && isTag(present)) return answer.tag.name === present.name;
  return printedAnswerOf(answer) === writtenAnswerOf({ expect: now });
}

async function answersAsWritten(answer, test) {
  return printedAnswerOf(answer) === writtenAnswerOf(test) && compareValues(answer, await expectedValueOf(test)) === 0;
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

  it('holds no query to two answers', () => {
    const contradictions = [];
    for (const [query, sameQuery] of Map.groupBy(allCases, test => test.query)) {
      if (new Set(sameQuery.map(writtenAnswerOf)).size > 1) {
        contradictions.push(`${query}: ${sameQuery.map(test => `${test.file}#${test.name}`).join(', ')}`);
      }
    }
    expect(contradictions).toEqual([]);
  });

  it('writes each answer once, under `expect` for a value and under `raises` for a failure', () => {
    const unwritten = allCases.filter(test => (test.expect === undefined) === (test.raises === undefined)).map(test => `${test.file}#${test.name}`);
    expect(unwritten).toEqual([]);
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
        assertLiteral(writtenLiteralOf(test), test.name);

        const answer = await evalQuery(test.query);
        const answeredAsWritten = await answersAsWritten(answer, test);
        if (test.target === true) {
          expect(test.decision, `${test.name}: a target names the decision that left it`).toBeDefined();
          expect(answeredAsWritten, `${test.name}: the tree meets this target of ${test.decision}; drop its "target" mark`).toBe(false);
          expect(test.now, `${test.name}: a target records the answer the tree gives today as "now"`).toBeDefined();
          assertLiteral(test.now, test.name);
          expect(await answersAsPresent(answer, test.now),
            `${test.name}: the target answers neither its goal nor its present "now"; tell whether a repair moved it or the case broke, then rewrite "now" or the case`).toBe(true);
        } else {
          expect(printedAnswerOf(answer), `${test.name}: the answer prints otherwise than the case writes it`).toBe(writtenAnswerOf(test));
          expect(answeredAsWritten, `${test.name}: the answer prints as the case writes it and is another value, a part its print drops`).toBe(true);
        }
      });
    }
  });
}
