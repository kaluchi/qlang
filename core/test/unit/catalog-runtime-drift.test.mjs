// Catalog vs runtime drift guard — derives every test call directly
// from the manifest entry, so the catalog is the single source of
// truth. No hand-written FORMS table parallel to catalog; if a
// future operand declares a `:modifier` type this file has not seen
// yet, the test surfaces it as MISSING TYPE SAMPLE and forces the
// new sample to land alongside.

import { describe, it, expect } from 'vitest';
import { createSession } from '../../src/session.mjs';
import { isErrorValue } from '../../src/types.mjs';

// Sample values per advertised type — one entry per :subject and
// :modifier keyword the catalog uses. Each value must round-trip
// through the qlang parser so the test plugs it directly into the
// generated call source. `any` and pipeline-typed slots receive a
// trivial filler whose only requirement is parsing.
const TYPE_SAMPLE = {
  vec:              '[1 2]',
  set:              '#[1 2]',
  map:              '{:a 1}',
  string:           '"hello"',
  keyword:          ':foo',
  tagKeyword:       '::Foo',
  number:           '42',
  integer:          '3',
  boolean:          'true',
  null:             'null',
  quote:            '~{42}',
  any:              '0',
  pipeline:         '0',
  predicateLambda:  'isNumber',
  keyLambda:        '/',
  comparatorLambda: 'asc(/)',
  reducerLambda:    'add',
  taggedInstance:   '::Foo[42]'
};

async function evalQuery(session, query) {
  const { result, error } = await session.evalCell(query);
  if (error) throw error;
  return result;
}

function isSubjectError(value) {
  if (!isErrorValue(value)) return false;
  const tag = value.tag.name;
  return /SubjectNot.*Error$/.test(tag) || tag.endsWith('SubjectShapeError');
}

function isArityError(value) {
  return isErrorValue(value) && value.tag.name === 'Rule10ArityOverflowError';
}

// Builds a call snippet for one (operand, arity) pair, sourcing
// every captured-slot type from the manifest's `:modifiers` list
// and looking up the sample via TYPE_SAMPLE. Returns null when the
// modifiers list refers to a type sample we have not defined yet —
// the caller surfaces that as a failing test so the sample table
// is forced to stay in sync with the catalog.
function buildCallSnippet(name, arity, modifiers) {
  if (arity === 0) return '| ' + name;
  const args = [];
  for (let i = 0; i < arity; i++) {
    const ty = modifiers && modifiers[i] ? modifiers[i].name : 'any';
    const sample = TYPE_SAMPLE[ty];
    if (sample === undefined) return { missingType: ty };
    args.push(sample);
  }
  return '| ' + name + '(' + args.join(', ') + ')';
}

// Variadic upper-bound sentinel coming from the manifest. The
// `:unbounded` keyword's `.name` is the literal we match against.
function isUnboundedUpper(upper) {
  return upper && typeof upper === 'object' && upper.name === 'unbounded';
}

describe('catalog vs runtime drift — derived from manifest', async () => {
  const session = await createSession();
  const manifest = await evalQuery(session, 'manifest');

  describe('every advertised :modifier type has a TYPE_SAMPLE entry', () => {
    const declaredTypes = new Set();
    for (const entry of manifest) {
      const mods = entry.get('modifiers');
      if (Array.isArray(mods)) {
        for (const t of mods) if (t && t.name) declaredTypes.add(t.name);
      }
      const subj = entry.get('subject');
      if (Array.isArray(subj)) {
        for (const t of subj) if (t && t.name) declaredTypes.add(t.name);
      } else if (subj && subj.name) {
        declaredTypes.add(subj.name);
      }
    }

    for (const type of [...declaredTypes].sort()) {
      it(`:${type} sample is defined`, () => {
        expect(TYPE_SAMPLE[type],
          `:${type} is referenced in the manifest but missing from TYPE_SAMPLE — add a parseable sample value`
        ).toBeDefined();
      });
    }
  });

  describe('polymorphic :subject — every advertised type is accepted by at least one overload arity', () => {
    const polymorphic = manifest.filter(m => {
      const subj = m.get('subject');
      return Array.isArray(subj) && subj.length > 1;
    });

    for (const entry of polymorphic) {
      const name = entry.get('name');
      const subjectTypes = entry.get('subject').map(k => k.name);
      const captured = entry.get('captured');
      const modifiers = entry.get('modifiers') || [];
      const lo = captured[0];
      const hi = isUnboundedUpper(captured[1]) ? lo + modifiers.length : captured[1];

      describe(name, () => {
        for (const ty of subjectTypes) {
          if (ty === 'any') continue;
          it(`accepts :${ty} subject through arities [${lo}..${hi}]`, async () => {
            const subjectSample = TYPE_SAMPLE[ty];
            expect(subjectSample, `TYPE_SAMPLE missing :${ty}`).toBeDefined();
            let anyOk = false;
            const attempts = [];
            for (let a = lo; a <= hi; a++) {
              const snippet = buildCallSnippet(name, a, modifiers);
              if (snippet && snippet.missingType) {
                expect.fail(`:${snippet.missingType} sample missing — referenced by ${name} captured slot`);
              }
              const query = subjectSample + ' ' + snippet;
              const value = await evalQuery(session, query);
              attempts.push({ arity: a, query, isSubjectError: isSubjectError(value) });
              if (!isSubjectError(value)) { anyOk = true; break; }
            }
            expect(anyOk,
              `${name} declared :subject :${ty} but every arity in [${lo}..${hi}] fired a subject-type error\n  attempts: ` +
              attempts.map(a => `arity=${a.arity} query=${JSON.stringify(a.query)}`).join('\n            ')
            ).toBe(true);
          });
        }
      });
    }
  });

  describe('variadic :captured [min :unbounded] — JS dispatch honours the upper bound', () => {
    const variadic = manifest.filter(m => {
      const cap = m.get('captured');
      return Array.isArray(cap) && isUnboundedUpper(cap[1]);
    });

    expect(variadic.length,
      'expected at least one :unbounded operand on the manifest'
    ).toBeGreaterThan(0);

    for (const entry of variadic) {
      const name = entry.get('name');
      const cap = entry.get('captured');
      const lower = cap[0];

      it(`${name} :captured [${lower} :unbounded] accepts arity well past any hard-coded JS cap`, async () => {
        const ARGS = 32;
        const args = Array.from({ length: ARGS }, () => 'null').join(', ');
        const value = await evalQuery(session, `42 | ${name}(${args})`);
        expect(isArityError(value),
          `${name} declared :captured [${lower} :unbounded] but raised Rule10ArityOverflowError at ${ARGS} captured args`
        ).toBe(false);
      });
    }
  });
});
