// Tests for the qlang catalog under lib/qlang/ — the source
// `langRuntime` parses at bootstrap.
//
// The catalog lives across `lib/qlang/core.qlang` (orchestrator that
// pulls in every family through `use(...)`), `lib/qlang/operand/<family>.qlang`
// (per-family operand + per-site error-tag declarations), plus
// `lib/qlang/runtime-invariants.qlang` (shared / runtime tag-bindings)
// and `lib/qlang/tag.qlang` (value-class constructors ::verb /
// ::quote / ::set, the kinds of the core, the tags of a quote's
// steps). Each operand is a `BindStep` whose body is a
// descriptor Map carrying :kind ::builtin, a :impl
// `:qlang/prim/*` keyword pointing into PRIMITIVE_REGISTRY, plus
// authored metadata (category / subject / returns / modifiers /
// throws) and doc-comment-prefix-attached `.docs`. `langRuntime()`
// evaluates the chain once at startup, resolves every `:impl
// :qlang/prim/<name>` handle through the JS-side registry bound at
// module load onto the descriptor's `BUILTIN_IMPL_SLOT` JS-header
// slot, and seals the registry. This is the single source
// of truth for the bound env.
//
// (The descriptor Map's identity rides on the JS-header
// `TAG_HEADER_SYMBOL` slot — stamped to `::builtin` by the
// `::builtin{…}` tag-literal constructor in `runtime/tagged.mjs`
// — not on a `:kind` Map field; the descriptor body carries only
// `:impl` plus authored metadata.)
//
// Contract pinned here:
//
//   1. The root entry `#qlang/core` parses to a Pipeline AST
//      without errors.
//   2. Evaluating the catalog through the locator produces a
//      non-empty Map — one entry per built-in operand.
//   3. Every operand entry is itself a Map with the `::builtin`
//      identity on its JS-header slot and a `:impl` keyword
//      prefixed `qlang/prim/`.
//   4. Every :impl keyword resolves to a real primitive in
//      the live PRIMITIVE_REGISTRY (populated by runtime/*.mjs
//      module-load side effects) and the resolved callable rides
//      the descriptor's `BUILTIN_IMPL_SLOT` slot.
//   5. Doc-comment prefixes have folded into `.docs` Vecs on each
//      `BindStep`'s AST node attached by grammar's `DocPrefix` /
//      `DocAttachedSequence` rules and reachable through the
//      axis-operand `:name | docs` (one Doc-value per attached
//      prefix).

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.mjs';
import { keyword, isKeyword, isQMap, isVec, makeTagKeyword, builtinImplOf, bindingValueOf, TAG_HEADER_SYMBOL, BUILTIN_TAG } from '../../src/types.mjs';
import { isModuleNamespaceKey, RUNTIME_LOCATOR_KEY } from '../../src/env-keys.mjs';
import { PRIMITIVE_REGISTRY } from '../../src/primitives.mjs';
import { platformLocator } from '../../src/runtime/bootstrap.mjs';

// Evaluate the catalog through a real `langRuntime()` — the chain
// of `use(...)` calls in `core.qlang` plus every family's BindSteps
// lands the record of every descriptor Map in env. Reading the
// resolved env returns the catalog as a Map keyed by operand name.
// Reserved housekeeping keys (`qlang/namespace/<ns>`,
// `qlang/locator`, anything without a `::builtin` header on its
// descriptor Map) are filtered so the returned Map carries only
// operand descriptors — the surface the rest of this suite
// asserts against.
async function evalCore() {
  const { langRuntime } = await import('../../src/runtime/index.mjs');
  const { isTagBindingName } = await import('../../src/env-keys.mjs');
  const fullEnv = await langRuntime();
  const catalog = new Map();
  for (const [k, record] of fullEnv) {
    const v = bindingValueOf(record);
    if (isModuleNamespaceKey(k)) continue;
    if (k === RUNTIME_LOCATOR_KEY) continue;
    if (isTagBindingName(k)) continue;       // skip ::Tag declarations
    if (!isQMap(v)) continue;
    if (v[TAG_HEADER_SYMBOL]?.name !== 'builtin') continue;
    catalog.set(k, v);
  }
  return catalog;
}

// Force runtime/*.mjs import so PRIMITIVE_REGISTRY gets populated
// before we cross-check :impl handles.
async function primeRegistry() {
  await import('../../src/runtime/index.mjs');
}

describe('lib/qlang/core.qlang — shape and content', () => {
  it('parses without errors', async () => {
    const rootResult = await platformLocator('qlang/core');
    const ast = parse(rootResult.source, { uri: 'qlang/core' });
    expect(ast).toBeDefined();
    expect(ast.type).toBeDefined();
  });

  it('evaluates to a Map', async () => {
    const coreEnv = await evalCore();
    expect(isQMap(coreEnv)).toBe(true);
  });

  it('every entry has a unique keyword identifier and non-empty name', async () => {
    // Size is not pinned to a literal — the catalog grows as the
    // language gains operands, and hard-coding the count here would
    // force a churn-commit on every addition. What IS invariant: the
    // evaluated env is a non-empty Map whose keys are all keywords
    // with non-empty names, and keys are unique by Map contract.
    const coreEnv = await evalCore();
    expect(coreEnv.size).toBeGreaterThan(0);
    for (const entryKey of coreEnv.keys()) {
      expect(typeof entryKey === "string").toBe(true);
      expect(entryKey.length).toBeGreaterThan(0);
    }
  });

  it('every entry value is a Map with ::builtin identity on the JS-header tag slot', async () => {
    // The catalog descriptor carries its identity on the
    // JS-header TAG_HEADER_SYMBOL slot. `evalCore` already
    // filters by that slot; this test pins the invariant
    // explicitly per entry so a single drifted descriptor
    // (catalog authoring bug, host integration that bypasses
    // `::builtin{…}`) surfaces with its env key in the failure
    // message.
    const coreEnv = await evalCore();
    for (const [entryKey, entryVal] of coreEnv) {
      expect(isQMap(entryVal), `entry :${entryKey} value is not a Map`).toBe(true);
      expect(entryVal[TAG_HEADER_SYMBOL], `entry :${entryKey} missing ::builtin JS-header tag`)
        .toBe(BUILTIN_TAG);
    }
  });

  it('every entry keeps its :impl handle keyword and carries the resolved callable on the JS-header slot', async () => {
    // langRuntime() runs the resolution pass over every builtin
    // descriptor before returning: the callable lands on the
    // `BUILTIN_IMPL_SLOT` JS-header slot while `:impl` keeps the
    // author's `:qlang/prim/<name>` handle keyword, so the data
    // plane a query projects stays qlang-only. The naming
    // convention — callable's .name matches the operand name —
    // keeps the dispatch target identifiable.
    const coreEnv = await evalCore();

    for (const [entryKey, entryVal] of coreEnv) {
      const implHandle = entryVal.get('impl');
      expect(isKeyword(implHandle), `entry :${entryKey} :impl is not a handle keyword`).toBe(true);
      expect(implHandle.name, `entry :${entryKey} :impl handle names another primitive`)
        .toBe(`qlang/prim/${entryKey}`);
      const callable = builtinImplOf(entryVal);
      expect(callable, `entry :${entryKey} carries no callable on BUILTIN_IMPL_SLOT`).toBeDefined();
      expect(callable.name, `entry :${entryKey} callable has a mismatched name`)
        .toBe(entryKey);
    }
  });

});

describe('lib/qlang/core.qlang — handoff into PRIMITIVE_REGISTRY', () => {
  it('every catalog operand has a backing primitive in PRIMITIVE_REGISTRY', async () => {
    await primeRegistry();
    const coreEnv = await evalCore();

    for (const entryKey of coreEnv.keys()) {
      expect(PRIMITIVE_REGISTRY.has(`qlang/prim/${entryKey}`),
        `entry :${entryKey} has no backing primitive at qlang/prim/${entryKey}`
      ).toBe(true);
    }
  });

  it('spot-check — :add is a verb that resides on ::number [D72]', async () => {
    const { langRuntime } = await import('../../src/runtime/index.mjs');
    const { isVerb, residenceOfVerb } = await import('../../src/types.mjs');
    const resolved = await langRuntime();
    const addVerb = bindingValueOf(resolved.get('add'));
    expect(isVerb(addVerb)).toBe(true);
    expect(residenceOfVerb(addVerb)).toBe('number');
  });

  it('spot-check — ::vec/filter takes its predicate in a slot of code [D72]', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('::vec/filter | spec | /predicate')).toEqual(makeTagKeyword('quote'));
  });

  it('spot-check — :env reflective operand lands with :category :reflective', async () => {
    const { langRuntime } = await import('../../src/runtime/index.mjs');
    const resolved = await langRuntime();
    const envDescriptor = bindingValueOf(resolved.get('env'));
    expect(envDescriptor.get('category')).toEqual(keyword('reflective'));
    const envImpl = builtinImplOf(envDescriptor);
    expect(envImpl.name).toBe('env');
  });
});

describe('lib/qlang/core.qlang — doc-prefix reachable through `:tag | docs` axis', () => {
  it('every cataloged binding has at least one Doc-value on the axis', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const coreEnv = await evalCore();
    for (const entryKey of coreEnv.keys()) {
      // Skip section-divider plain comments / non-binding env entries.
      if (!isQMap(coreEnv.get(entryKey))) continue;
      // A keyword names a binding of the scope, so the verb is read by
      // the first address its refusal hands on [D62].
      const docs = await evalQuery(`:"${entryKey}" | docs !| /addresses | first | docs`);
      expect(docs.length, `entry :${entryKey} has no docs reachable via axis`).toBeGreaterThan(0);
      for (const doc of docs) {
        expect(typeof doc.content).toBe('string');
      }
    }
  });

  it('spot-check — ::vec/count docs mention polymorphic and container kinds', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const docs = await evalQuery('::any/count | docs');
    const joined = docs.map(d => d.content).join(' ');
    expect(joined).toContain('number of elements');
    expect(joined).toContain('vector');
  });

  it('spot-check — ::vec/filter docs describe the predicate semantics', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const docs = await evalQuery('::any/filter | docs');
    const joined = docs.map(d => d.content).join(' ');
    expect(joined).toContain('predicate');
    expect(joined).toContain('boolean');
  });
});

describe('bare-name operand dispatch — uniform Rule 10 path', () => {
  // Bare operand identifier (no captured args) fires the operand
  // against the current pipeValue regardless of arity. Non-nullary
  // operands without captured args hit Rule 10's arity check and
  // surface a per-site arityError; nullary operands fire because
  // bare application IS their valid call shape. The introspection
  // surface for "what does this operand do" is `:name | source` /
  // `:name | docs` / `:name | examples`, not a bare-name descriptor
  // shortcut.

  it('bare `count` fires against the inbound Vec', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('[1 2 3] | count')).toBe(3);
  });

  it('bare `sort` fires the nullary overload branch', async () => {
    // sort is overloaded at 0 or 1 captured args. overloadedOp
    // emits captured [0, 1], so the nullary form sorts naturally.
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('[3 1 2] | sort')).toEqual([1, 2, 3]);
  });

  it('bare `mul` on a number leaves its slot empty and is refused by its name', async () => {
    // The head of `mul` declares one slot, which a call without a
    // modifier leaves empty [D68], [D72].
    const { evalQuery } = await import('../../src/eval.mjs');
    const { isErrorValue } = await import('../../src/types.mjs');
    const evalResult = await evalQuery('5 | mul');
    expect(isErrorValue(evalResult)).toBe(true);
    expect(evalResult.tag.name).toBe('VerbSlotMissingError');
  });
});

describe('format.toPlain refuses a raw function value — round-trip invariant', () => {
  // Function values have no grammatical literal: emitting any string
  // for one would falsely round-trip through parse / eval into a
  // different value-class. toPlain shares this round-trip discipline
  // with printValue and raises FunctionValueLeakedToPrintError when a
  // function surfaces — the leak surface (typically a JS-level
  // caller piping a raw makeFn product through toPlain instead of
  // wrapping it in a descriptor Map) gets named at the boundary.

  it('toPlain on a raw function value throws FunctionValueLeakedToPrintError', async () => {
    const { toPlain } = await import('../../src/runtime/format.mjs');
    const { makeFn } = await import('../../src/rule10.mjs');
    const { FunctionValueLeakedToPrintError } = await import('../../src/types.mjs');
    const fn = makeFn('exoticFn', 1, (state) => state, { captured: [0, 0] });
    expect(() => toPlain(fn)).toThrow(FunctionValueLeakedToPrintError);
  });
});

describe('lib/qlang/core.qlang — namespace sizes', () => {
  // The drift guard in `error-tag-catalog-drift.test.mjs` pairs each
  // throw site with its tag and each tag with its throw site, but the
  // six tags minted outside a per-site factory (`::Error`,
  // `::ParseError`, and the four value-class constructors) pass both
  // axes whether or not they exist — axis 1 never names them and
  // axis 2 skips a name the environment does not bind. These pins fail
  // on a silent catalog shrink; per §8a of the review rules a tally
  // belongs in test code, which CI re-verifies, and never in prose.
  it('the tag namespace holds every declared tag-binding', async () => {
    const { langRuntime } = await import('../../src/runtime/index.mjs');
    const { catalogEntriesOf } = await import('../helpers/catalog-entries.mjs');
    expect(catalogEntriesOf(await langRuntime(), { tags: true }).length).toBe(205);
  });

  it('the value namespace holds every declared operand', async () => {
    const { langRuntime } = await import('../../src/runtime/index.mjs');
    const { catalogEntriesOf } = await import('../helpers/catalog-entries.mjs');
    expect(catalogEntriesOf(await langRuntime(), { tags: false }).length).toBe(39);
  });
});

describe('lib/qlang/core.qlang — data-level projections across the full catalog', () => {
  it('groupBy category — full catalog is addressable as data', async () => {
    // A miniature exercise of the self-describing nature: run a
    // qlang query against the catalog itself to count operands per
    // category, iterating the evaluated Map directly — the reading
    // `::qlang | manifest * manifest | flat * (spec | /category)`
    // gives at the qlang level, verb by address.
    const coreEnv = await evalCore();
    const categories = new Map();
    for (const [, entryVal] of coreEnv) {
      const cat = entryVal.get('category');
      categories.set(cat.name, (categories.get(cat.name) ?? 0) + 1);
    }
    expect(categories.get('control')).toBe(3);
    expect(categories.get('mapOp')).toBe(3);  // keys + vals + has
    expect(categories.get('setOp')).toBe(3);  // union + minus + inter (Vec→Set converter lives on `distinct`)
    expect(categories.get('string')).toBe(8);
    expect(categories.get('predicate')).toBe(4);  // not + eq + and + or
    expect(categories.get('typeClassifier')).toBe(1);  // type — every value-class question is `type | eq(:kind)`
    expect(categories.get('typeConversion')).toBe(4);  // keyword + payload + tag + within
    expect(categories.get('format')).toBe(2);  // json + parseJson, the JSON codec both ways
    expect(categories.get('reflective')).toBe(4);   // env use manifest runExamples
    expect(categories.get('codeAsData')).toBe(2); // parse apply
    expect(categories.get('axis')).toBe(4);         // source docs examples spec
    expect(categories.get('error')).toBe(1);        // error
    const sum = [...categories.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(coreEnv.size);
  });
});

describe('parse / apply — the codeAsData ring closer', () => {
  // The `parse` operand reads a source string into the quote of its
  // steps and prints a quote back; `apply(/)` runs the quote against
  // the subject. Together they round-trip
  // source text → data → pipeValue without leaving the language,
  // and ground the programmatic-query-construction surface.

  it('parse reads a scalar literal into the quote of that one step', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('"42" | parse');
    expect(isVec(evalResult)).toBe(true);
    expect([...evalResult]).toEqual([42]);
  });

  it('parse reads an OperandCall into a ::call step with :name / :args', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const callStep = (await evalQuery('"add 1 2" | parse'))[0];
    expect(isQMap(callStep)).toBe(true);
    expect(callStep[TAG_HEADER_SYMBOL].name).toBe('call');
    expect(callStep.get('name')).toEqual(keyword('add'));
    expect(callStep.get('args')).toHaveLength(2);
  });

  it('parse errors on non-string subject', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('42 | parse !| type');
    expect(evalResult).toEqual(makeTagKeyword('ParseSubjectNotStringOrQuoteError'));
  });

  it('apply runs a quote assembled from its steps', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('[42 ::call{:name :add :args [1]}] | tag ::quote | apply /');
    expect(evalResult).toBe(43);
  });

  it('apply refuses code that is not a Quote', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('"not-a-quote" | apply / !| type');
    expect(evalResult).toEqual(makeTagKeyword('ApplyCodeNotQuoteError'));
  });

  it('round-trip — "source" | parse | apply(/) is equivalent to evaluating the source', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('"42" | parse | apply /')).toBe(42);
    expect(await evalQuery('"10 | add 3" | parse | apply /')).toBe(13);
    expect(await evalQuery('"[1 2 3] | filter ~(gt 1) | count" | parse | apply /')).toBe(2);
  });

  it('round-trip preserves projections and Map literals', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('"{:a 1 :b 2} | /a" | parse | apply /')).toBe(1);
  });

  it('error values round-trip through parse | apply(/)', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('"!{:kind :oops} !| /kind" | parse | apply /');
    expect(evalResult).toEqual(keyword('oops'));
  });

  it('parse errors on malformed source lift to fail-track', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('"this is not qlang [" | parse !| type | spec | /category');
    expect(evalResult).toEqual(keyword('parseError'));
  });
});
