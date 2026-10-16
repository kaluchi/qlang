// script-mode coverage. `liftStdinToPipeValue` resolves the `auto` /
// `json` / `raw` flag into the query's first value, and `answerText`
// writes the answer as the language prints it, whatever the input was
// [QSHST#answer].

import { describe, it, expect } from 'vitest';
import { langRuntime, evalQuery } from '@kaluchi/qlang-core';
import {
  DEFAULT_SUBJECT,
  liftStdinToPipeValue,
  answerText
} from '../src/script-mode.mjs';


describe('liftStdinToPipeValue — auto detection', () => {
  it('starts from the default subject when stdin carries no bytes, in every mode', () => {
    for (const inputFormat of ['auto', 'json', 'raw']) {
      expect(liftStdinToPipeValue('', inputFormat)).toEqual({ pipeValue: DEFAULT_SUBJECT });
    }
    expect(DEFAULT_SUBJECT.name).toBe('qlang');
  });

  it('parses JSON stdin into qlang shape when auto succeeds', () => {
    expect(liftStdinToPipeValue('{"a": 1}', 'auto').pipeValue.get('a')).toBe(1);
  });

  it('keeps the keys of a JSON stdin in the order the text writes them, as a literal does', () => {
    expect([...liftStdinToPipeValue('{"b": 1, "2": 2, "a": 3}', 'auto').pipeValue.keys()]).toEqual(['b', '2', 'a']);
  });

  it('falls back to raw String when stdin is not valid JSON', () => {
    expect(liftStdinToPipeValue('plain text', 'auto')).toEqual({ pipeValue: 'plain text' });
  });
});

describe('liftStdinToPipeValue — explicit formats', () => {
  it('parses strictly under --json', () => {
    expect(liftStdinToPipeValue('[1, 2, 3]', 'json').pipeValue).toEqual([1, 2, 3]);
  });

  it('surfaces parseError on malformed --json input', () => {
    const lifted = liftStdinToPipeValue('not-json', 'json');
    expect(lifted.parseError).toBeInstanceOf(Error);
    expect(lifted.parseError.message).toMatch(/JSON/);
  });

  it('skips parsing entirely under --raw', () => {
    expect(liftStdinToPipeValue('{"a":1}', 'raw')).toEqual({ pipeValue: '{"a":1}' });
  });
});

// The answer is written as the language prints it whatever the input was,
// a string as its text, so a query converts it where a reader wants
// another format [QSHST#answer].
describe('answerText — the answer as the language prints it', () => {
  it('prints a keyword, a set, a tag and a quote as their literals', async () => {
    expect(await answerText(await evalQuery('[:v #[2 1] ::vec ~(add 1) "s"]'), await langRuntime()))
      .toBe('[:v #[1 2] ::vec ~(add 1) "s"]');
  });

  it('prints a map whose keys a JSON object gave as keywords', async () => {
    expect(await answerText(liftStdinToPipeValue('{"k": 1}', 'auto').pipeValue, await langRuntime())).toBe('{:k 1}');
  });

  it('writes a string as its text, so `| json` writes JSON text', async () => {
    expect(await answerText('hi', await langRuntime())).toBe('hi');
    expect(await answerText(await evalQuery('{:a [1 :k #[2]]} | json'), await langRuntime())).toBe('{"a":[1,"k",[2]]}');
  });

  it('writes a failure as its error at rest under the line that says it was raised, and `!| json` as JSON text [QSERR#rest]', async () => {
    const env = await langRuntime();
    expect(await answerText(await evalQuery('"x" | add 1'), env)).toMatch(/^\|~\| raised, and no !\| caught it\n::number\/add\/SubjectNotNumberError!\{[\s\S]*\}$/);
    expect(JSON.parse(await answerText(await evalQuery('"x" | add 1 !| json'), env)).$tag).toBe('number/add/SubjectNotNumberError');
  });
});


// An answer prints within the budget a caller asked for [QSHST#answer]; an
// error prints as its alert [QSHST#answer].
describe('answerText — the budget of the answer', () => {
  const budget = 200;
  const forty = Array.from({ length: 40 }, (_, index) => index + 1);

  it('prints a value past its budget with a marker that reads the rest', async () => {
    const text = await answerText(forty, await langRuntime(), 80);
    expect(text).toContain('::elision{');
    expect(text).toContain(':read ~(drop ');
  });

  it('cuts an error within the budget', async () => {
    const failing = await evalQuery(`[{:n 1 :text "${'x'.repeat(200)}"} {:n 2}] | filter ~(nope)`);
    expect(await answerText(failing, await langRuntime(), budget)).toContain(':read ~(!| get /trail/0/subject)');
  });

  it('writes the answer whole when no budget was asked for', async () => {
    const text = await answerText(forty, await langRuntime(), null);
    expect(text).not.toContain('::elision');
  });

  it('writes an error as its alert when no budget was asked for', async () => {
    const failing = await evalQuery(`[${forty.map(index => `{:n ${index}}`).join(' ')}] | filter ~(nope)`);
    expect(await answerText(failing, await langRuntime(), null)).toContain(':read ~(!| get /trail/1/subject)');
  });
});
