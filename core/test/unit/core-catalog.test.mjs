// Tests for the qlang catalog under lib/qlang/ — the source
// `langRuntime` parses at bootstrap.
//
// The catalog lives in the modules `lib/qlang/core.qlang` lists, the
// kernel's `builtin.qlang` first, then the module of each kind, whole:
// its page, its constructor, the refusals of its place and its verbs
// [D112], [D114]. `langRuntime()` loads them once at startup and seals
// the registry of primitives the verbs name.
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
//      axis-operand `:name | doc` (the one page its attached
//      prefixes make).

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.mjs';
import { keyword, isQMap, isVec, makeTagKeyword, bindingValueOf, TAG_HEADER_SYMBOL } from '../../src/types.mjs';
import { platformLocator } from '../../src/runtime/bootstrap.mjs';

describe('lib/qlang/core.qlang — shape and content', () => {
  it('parses without errors', async () => {
    const rootResult = await platformLocator('qlang/core');
    const ast = parse(rootResult.source, { uri: 'qlang/core' });
    expect(ast).toBeDefined();
    expect(ast.type).toBeDefined();
  });

});

describe('lib/qlang/core.qlang — handoff into PRIMITIVE_REGISTRY', () => {

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
});

describe('lib/qlang/core.qlang — doc-prefix reachable through `:tag | doc` axis', () => {

  it('spot-check — ::vec/count docs mention polymorphic and container kinds', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const { docText } = await import('../../src/quote.mjs');
    const joined = docText(await evalQuery('::any/count | doc'));
    expect(joined).toContain('number of elements');
    expect(joined).toContain('vector');
  });

  it('spot-check — ::vec/filter docs describe the predicate semantics', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const { docText } = await import('../../src/quote.mjs');
    const joined = docText(await evalQuery('::any/filter | doc'));
    expect(joined).toContain('predicate');
    expect(joined).toContain('boolean');
  });
});

describe('bare-name verb call', () => {
  // Bare operand identifier (no captured args) fires the operand
  // against the current pipeValue regardless of arity. Non-nullary
  // operands without captured args hit Rule 10's arity check and
  // surface a per-site arityError; nullary operands fire because
  // bare application IS their valid call shape. The introspection
  // surface for "what does this operand do" is `:name | source` /
  // `:name | doc` / `:name | doc | laws`, not a bare-name descriptor
  // shortcut.

  it('bare `count` fires against the inbound Vec', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('[1 2 3] | count')).toBe(3);
  });

  it('bare `sort` sorts in the one order, its key left out', async () => {
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
    expect(catalogEntriesOf(await langRuntime(), { tags: true }).length).toBe(192);
  });

  it('no name of the value namespace is left a descriptor [D113]', async () => {
    const { langRuntime } = await import('../../src/runtime/index.mjs');
    const { catalogEntriesOf } = await import('../helpers/catalog-entries.mjs');
    expect(catalogEntriesOf(await langRuntime(), { tags: false }).length).toBe(0);
  });
});

describe('parse / apply — code read, printed and run', () => {
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
    expect(evalResult).toEqual(makeTagKeyword('VerbWithoutBodyError'));
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
