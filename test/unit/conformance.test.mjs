// Conformance test runner.
//
// Reads every test/conformance/*.jsonl file, parses each line as
// a test case, runs the query through evalQuery, and compares
// the result against the expected value (or expected error type).
//
// JSON serialization tags for qlang values:
//   { "$keyword": "name" }       — interned keyword
//   { "$map": [[k, v], ...] }    — JS Map with keyword/scalar keys
//   { "$set": [v1, v2, ...] }    — JS Set
//
// Plain JSON values map directly:
//   number → number
//   string → string
//   boolean → boolean
//   null → nil
//   array → Vec

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { evalQuery } from '../../src/eval.mjs';
import { keyword } from '../../src/types.mjs';
import { QlangError } from '../../src/errors.mjs';
import { ParseError } from '../../src/parse.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const conformanceDir = join(here, '..', 'conformance');
const files = readdirSync(conformanceDir).filter(f => f.endsWith('.jsonl')).sort();

// hydrate(jsonValue) — convert tagged JSON values into qlang
// runtime values (Map, Set, keyword instances).
function hydrate(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(hydrate);
  if ('$keyword' in value) return keyword(value.$keyword);
  if ('$map' in value) {
    const m = new Map();
    for (const [k, v] of value.$map) m.set(hydrate(k), hydrate(v));
    return m;
  }
  if ('$set' in value) {
    const s = new Set();
    for (const v of value.$set) s.add(hydrate(v));
    return s;
  }
  // Plain object — not expected in tests, but pass through.
  return value;
}

// deepEqual(a, b) — structural equality across qlang values.
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  if (a instanceof Map) {
    if (!(b instanceof Map) || a.size !== b.size) return false;
    for (const [k, v] of a) {
      if (!b.has(k) || !deepEqual(v, b.get(k))) return false;
    }
    return true;
  }
  if (a instanceof Set) {
    if (!(b instanceof Set) || a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }
  if (typeof a === 'object' && 'type' in a && a.type === 'keyword') {
    return b !== null && typeof b === 'object' && b.type === 'keyword' && a.name === b.name;
  }
  return false;
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
        if (test.error) {
          let thrown;
          try {
            evalQuery(test.query);
          } catch (e) {
            thrown = e;
          }
          expect(thrown, `expected ${test.error}, got nothing`).toBeDefined();
          if (test.error === 'parse-error') {
            expect(thrown).toBeInstanceOf(ParseError);
          } else {
            expect(thrown).toBeInstanceOf(QlangError);
            expect(thrown.kind).toBe(test.error);
          }
        } else {
          const result = evalQuery(test.query);
          const expected = hydrate(test.expect);
          // Always use vitest's diff-friendly assertion.
          expect(result).toEqual(expected);
        }
      });
    }
  });
}
