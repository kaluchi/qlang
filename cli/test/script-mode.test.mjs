// script-mode symmetric-encoding coverage. `liftStdinToPipeValue`
// resolves the `auto` / `json` / `raw` flag into a concrete initial
// pipeValue plus the format label the renderer uses to encode the
// success value back.

import { describe, it, expect } from 'vitest';
import { langRuntime, evalQuery } from '@kaluchi/qlang-core';
import {
  DEFAULT_SUBJECT,
  liftStdinToPipeValue,
  encodeSuccessValueForFormat
} from '../src/script-mode.mjs';


describe('liftStdinToPipeValue — auto detection', () => {
  it('starts from the default subject when stdin carries no bytes, in every mode', () => {
    for (const inputFormat of ['auto', 'json', 'raw']) {
      expect(liftStdinToPipeValue('', inputFormat)).toEqual({ pipeValue: DEFAULT_SUBJECT, resolvedFormat: 'raw' });
    }
    expect(DEFAULT_SUBJECT.name).toBe('qlang');
  });

  it('parses JSON stdin into qlang shape when auto succeeds', () => {
    const lifted = liftStdinToPipeValue('{"a": 1}', 'auto');
    expect(lifted.resolvedFormat).toBe('json');
    expect(lifted.pipeValue.get('a')).toBe(1);
  });

  it('falls back to raw String when stdin is not valid JSON', () => {
    const lifted = liftStdinToPipeValue('plain text', 'auto');
    expect(lifted).toEqual({ pipeValue: 'plain text', resolvedFormat: 'raw' });
  });
});

describe('liftStdinToPipeValue — explicit formats', () => {
  it('parses strictly under --json', () => {
    const lifted = liftStdinToPipeValue('[1, 2, 3]', 'json');
    expect(lifted.resolvedFormat).toBe('json');
    expect(lifted.pipeValue).toEqual([1, 2, 3]);
  });

  it('surfaces parseError on malformed --json input', () => {
    const lifted = liftStdinToPipeValue('not-json', 'json');
    expect(lifted.resolvedFormat).toBe('json');
    expect(lifted.parseError).toBeInstanceOf(Error);
    expect(lifted.parseError.message).toMatch(/JSON/);
  });

  it('skips parsing entirely under --raw', () => {
    const lifted = liftStdinToPipeValue('{"a":1}', 'raw');
    expect(lifted).toEqual({ pipeValue: '{"a":1}', resolvedFormat: 'raw' });
  });
});

describe('encodeSuccessValueForFormat', () => {
  it('encodes a qlang Map as pretty JSON under json format', async () => {
    const value = new Map([
      ['a', 1],
      ['b', 2]
    ]);
    const text = await encodeSuccessValueForFormat(value, 'json');
    expect(text).toBe('{\n  "a": 1,\n  "b": 2\n}');
  });

  it('encodes a String as a JSON string literal under json format', async () => {
    expect(await encodeSuccessValueForFormat('hi', 'json')).toBe('"hi"');
  });

  it('passes a String through raw under raw format (no quotes)', async () => {
    expect(await encodeSuccessValueForFormat('hi', 'raw')).toBe('hi');
  });

  it('prints a non-String composite under raw format', async () => {
    const value = new Map([['k', 1]]);
    expect(await encodeSuccessValueForFormat(value, 'raw', await langRuntime())).toBe('{:k 1}');
  });
});

// Under JSON, the channel a JSON input chose, an answer holding a value
// JSON has no form for is refused by an error naming its path and kind
// [D103].
describe('encodeSuccessValueForFormat — what the JSON channel refuses', () => {
  const refusalOf = async query => JSON.parse(await encodeSuccessValueForFormat(await evalQuery(query), 'json')).$error;

  it('refuses a quote, naming its place and its kind', async () => {
    const refusal = await refusalOf('[1 ~(add 1)]');
    expect(refusal.$tag).toBe('AnswerNotJsonError');
    expect(refusal.descriptor.path).toEqual([1]);
    expect(refusal.descriptor.actualType).toBe('::quote');
  });

  it('refuses a set, a keyword and a tagged value by the path of map keys and indices', async () => {
    expect((await refusalOf('#[1 2]')).descriptor).toMatchObject({ path: [], actualType: '::set' });
    expect((await refusalOf('{:a [{:b :k}]}')).descriptor).toMatchObject({ path: ['a', 0, 'b'], actualType: '::keyword' });
    expect((await refusalOf('::Box {} | {:a ::Box{:k 1}}')).descriptor).toMatchObject({ path: ['a'], actualType: '::Box' });
  });

  it('answers an error a container holds as that error', async () => {
    expect((await refusalOf('[1 ("x" | add 1)]')).$tag).toBe('AddLeftNotNumberError');
  });

  it('keeps the form of an answer that is itself an error', async () => {
    expect((await refusalOf('"x" | add 1')).$tag).toBe('AddLeftNotNumberError');
  });

  it('writes JSON values as they are', async () => {
    const text = await encodeSuccessValueForFormat(await evalQuery('{:a [1 "x" null true {:b 2.5}]}'), 'json');
    expect(JSON.parse(text)).toEqual({ a: [1, 'x', null, true, { b: 2.5 }] });
  });
});

