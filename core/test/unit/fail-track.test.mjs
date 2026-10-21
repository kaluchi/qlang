// `raise`, and the catch, `!|`, which runs its step on the error at rest, a
// verb among them; the trace of the steps a failure skips, the print of the
// body of a declaration, and the refusals of the runtime, each under the
// address of its site [QSERR#catch], [QSERR#trace], [QSERR#site].

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/session.mjs';
import { isErrorValue, keyword, makeTag } from '../../src/types.mjs';
import { QlangError } from '../../src/errors.mjs';
import { catchOriginalError } from '../helpers/error-assertions.mjs';

// ── raise ──────────────────────────────────────────────

describe('raise', () => {
  it('[QSERR#catch] a failure in the pipe skips raise', async () => {
    const evalResult = await evalQuery('("not-a-number" | add 1) | raise !| type');
    expect(evalResult).toEqual(makeTag('number/add/SubjectNotNumberError'));
  });

  it('[QSERR#raise] an error literal under the address of a refusal, raised, keeps every fact it writes', async () => {
    const err = await evalQuery('::number/add/SubjectNotNumberError!{:custom "field" :note 42} | raise');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTag('number/add/SubjectNotNumberError'));
    expect(err.facts.get('custom')).toBe('field');
    expect(err.facts.get('note')).toBe(42);
  });

  it('[QSERR#raise] raise takes the tag the map carries and keeps every entry a fact', async () => {
    // A `:kind` entry names no tag [QSERR#rest]: the tag is the map's own.
    const result = await evalQuery(':MyTag |~~ MyTag. ~~| | ::MyTag{:kind ::Other :detail "x"} | raise');
    expect(result.tag.name).toBe('MyTag');
    expect(result.facts.get('kind')).toEqual(makeTag('Other'));
    expect(result.facts.get('detail')).toBe('x');
  });
});

// ── `!|` runs a verb ───────────────────────────────────────────

describe('`!|` runs a verb on the error at rest', () => {
  it('[QSERR#catch] a verb called by `!|` runs its steps on the error at rest', async () => {
    const evalResult = await evalQuery(':any/handler ~(get /kind) | !{:kind :oops} | raise !| handler');
    expect(evalResult).toEqual(keyword('oops'));
  });

  it('[QSERR#trace] the steps skipped past a comment run again by apply as the call after it', async () => {
    const evalResult = await evalQuery('!{:kind :oops} | raise |~| comment\n| count !| trace | last | skipped | :t it | 42 | apply t !| type');
    expect(evalResult).toEqual(makeTag('call/KindAnswersNoVerbError'));
  });
});

describe('source axis prints the declaration for rare forms of a body', () => {
  it('[QSSLF#axis] renders a call that gives no modifiers as the body of a declaration', async () => {
    expect(await evalQuery('[1 2] | :x count | ::x | source | toString')).toBe(':x count');
  });

  it('[QSSLF#axis] a line comment inside the body of a declaration leaves no step', async () => {
    const evalResult = await evalQuery(':x (42 |~| note\n) | ::x | source | toString');
    expect(evalResult).toBe(':x (42)');
  });

  it('[QSSLF#axis] renders an error literal as the body of a declaration', async () => {
    expect(await evalQuery(':x !{:a 1} | ::x | source | toString')).toBe(':x !{:a 1}');
  });

  it('[QSSLF#axis] renders a group that opens with `!|` as the body of a declaration', async () => {
    // The body of a declaration is a step, so a pipeline that opens with
    // `!|` is written as a group, which keeps its parentheses in print
    // [QSNAM#declare].
    expect(await evalQuery(':handler (!| get /kind) | ::handler | source | toString')).toBe(':handler (!| get /kind)');
  });
});

describe('the refusals of the runtime', () => {
  it('[QSERR#site] every refusal of the runtime is one kind of error, its message its address', async () => {
    const queries = [
      '42 | count',
      '[1 "two"] | sum',
      '42 | get /name',
      '42 | map ~(add 1)',
      '5 | :five it | five 42',
      '42 | reduce 0 ~(add)'
    ];
    for (const q of queries) {
      const caughtErr = await catchOriginalError(q);
      expect(caughtErr).toBeInstanceOf(QlangError);
      expect(caughtErr.message).toBe(`::${caughtErr.address}`);
    }
  });
});
