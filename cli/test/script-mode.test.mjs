// script-mode symmetric-encoding coverage. `liftStdinToPipeValue`
// resolves the `auto` / `json` / `raw` flag into a concrete initial
// pipeValue plus the format label the renderer uses to encode the
// success value back.

import { describe, it, expect } from 'vitest';
import {
  liftStdinToPipeValue,
  encodeSuccessValueForFormat
} from '../src/script-mode.mjs';
import { keyword } from '@kaluchi/qlang-core';

describe('liftStdinToPipeValue — auto detection', () => {
  it('returns an empty raw String when stdin is empty', () => {
    const lifted = liftStdinToPipeValue('', 'auto');
    expect(lifted).toEqual({ pipeValue: '', resolvedFormat: 'raw' });
  });

  it('parses JSON stdin into qlang shape when auto succeeds', () => {
    const lifted = liftStdinToPipeValue('{"a": 1}', 'auto');
    expect(lifted.resolvedFormat).toBe('json');
    expect(lifted.pipeValue.get(keyword('a'))).toBe(1);
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
  it('encodes a qlang Map as pretty JSON under json format', () => {
    const value = new Map([
      [keyword('a'), 1],
      [keyword('b'), 2]
    ]);
    const text = encodeSuccessValueForFormat(value, 'json');
    expect(text).toBe('{\n  "a": 1,\n  "b": 2\n}');
  });

  it('encodes a String as a JSON string literal under json format', () => {
    expect(encodeSuccessValueForFormat('hi', 'json')).toBe('"hi"');
  });

  it('passes a String through raw under raw format (no quotes)', () => {
    expect(encodeSuccessValueForFormat('hi', 'raw')).toBe('hi');
  });

  it('falls back to printValue for a non-String composite under raw format', () => {
    const value = new Map([[keyword('k'), 1]]);
    expect(encodeSuccessValueForFormat(value, 'raw')).toBe('{:k 1}');
  });
});
