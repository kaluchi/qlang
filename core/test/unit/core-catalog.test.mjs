// The catalog the language declares its root by [D153], each source the
// page of one noun and what is declared under it [D189]: `lib/qlang.qlang`
// the topic of the language, and each source under `lib/qlang/` a kind.
// `langRuntime()` runs them once at startup and seals the registry of
// primitives the verbs name.

import { describe, it, expect } from 'vitest';
import { nodeOf } from '../../src/runtime/nouns.mjs';
import { parse } from '../../src/parse.mjs';
import { keyword, isQMap, isVec, makeSet, makeTag, bindingValueOf, TAG_HEADER_SYMBOL } from '../../src/types.mjs';
import { platformLocator, LANGUAGE_SOURCES } from '../../src/runtime/bootstrap.mjs';
import { evalQuery } from '../../src/eval.mjs';

describe('the sources of the language', () => {
  it('each parses without errors', async () => {
    for (const uri of LANGUAGE_SOURCES) {
      const ast = parse((await platformLocator(uri)).source, { uri });
      expect(ast.type, uri).toBeDefined();
    }
  });
});

describe('the verbs of the language reach their primitives', () => {

  it('spot-check — :add is a name under ::number a primitive answers [D164]', async () => {
    const { langRuntime } = await import('../../src/runtime/index.mjs');
    const { isBuiltinDescriptor, isHostDeclared } = await import('../../src/types.mjs');
    const resolved = await langRuntime();
    const add = bindingValueOf(nodeOf(resolved, 'number/add'));
    expect(isBuiltinDescriptor(add)).toBe(true);
    expect(isHostDeclared(add)).toBe(true);
  });

  it('spot-check — filter takes its predicate as a part whose law asks for a quote, on each kind that answers it [D169]', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('::set/filter | manifest')).toEqual(makeSet([makeTag('set/filter/ConditionNotBooleanError'), makeTag('set/filter/answer'), makeTag('set/filter/predicate')]));
    expect(await evalQuery('::set/filter/predicate/NotQuoteError | binding | /value | print')).toBe('::holds~(is ::quote)');
  });
});

describe('the pages of the language read through `doc`', () => {

  it('spot-check — ::vec/count docs mention polymorphic and container kinds', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const { docText } = await import('../../src/quote.mjs');
    const joined = docText(await evalQuery('::vec/count | doc'));
    expect(joined).toContain('number of elements');
  });

  it('spot-check — ::vec/filter docs describe the predicate semantics', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const { docText } = await import('../../src/quote.mjs');
    const joined = docText(await evalQuery('::vec/filter | doc'));
    expect(joined).toContain('predicate');
    expect(joined).toContain('true');
  });
});

describe('bare-name verb call', () => {
  // A word called by its bare name, with no modifiers, runs on the
  // value in the pipe; a part it reads that the call leaves out is
  // refused under the part. What a word does is read by `:name |
  // source`, `:name | doc` and `:name | laws`, not by a bare name.

  it('bare `count` fires against the inbound Vec', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('[1 2 3] | count')).toBe(3);
  });

  it('bare `sort` sorts in the one order, its key left out', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('[3 1 2] | sort')).toEqual([1, 2, 3]);
  });

  it('bare `mul` on a number gives no multiplier and is refused under the part', async () => {
    // The part `multiplier` reads the first place of the args, which
    // a call without a modifier leaves empty [D166].
    const { evalQuery } = await import('../../src/eval.mjs');
    const { isErrorValue } = await import('../../src/types.mjs');
    const evalResult = await evalQuery('5 | mul');
    expect(isErrorValue(evalResult)).toBe(true);
    expect(evalResult.tag.name).toBe('number/mul/multiplier/NotGivenError');
  });
});

describe('the root of the language', () => {
  // The drift guard in `error-tag-catalog-drift.test.mjs` pairs each
  // throw site with its kind and each kind with its throw site, but a
  // kind minted outside a per-site factory passes both whether or not it
  // exists. This pin fails on a silent shrink of the root's nouns; a
  // tally belongs in test code, which CI re-verifies, and never in prose.
  it('the root holds the kinds of the language and its topic', async () => {
    expect(await evalQuery('[(kinds | has ::number) (::qlang | doc | type)]')).toEqual(await evalQuery('[true ::doc]'));
  });

  it('no kind of the root is left a descriptor [D113]', async () => {
    expect(await evalQuery('kinds | map ~(binding | /value | type) | has ::builtin')).toBe(false);
  });
});

describe('parse / apply — code read, printed and run', () => {
  // `parse` reads a source string into the quote of its
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

  it('parse reads a call into a ::call step with :name / :modifiers', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const callStep = (await evalQuery('"add 1 2" | parse'))[0];
    expect(isQMap(callStep)).toBe(true);
    expect(callStep[TAG_HEADER_SYMBOL].name).toBe('call');
    expect(callStep.get('name')).toEqual(keyword('add'));
    expect(callStep.get('modifiers')).toHaveLength(2);
  });

  it('parse errors on non-string subject', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('42 | parse !| type');
    expect(evalResult).toEqual(makeTag('call/KindAnswersNoVerbError'));
  });

  it('apply runs a quote assembled from its steps', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('[42 ::call{:name :add :modifiers [1]}] | tag ::quote | apply /');
    expect(evalResult).toBe(43);
  });

  it('apply refuses code that is not a Quote', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('"not-a-quote" | apply / !| type');
    expect(evalResult).toEqual(makeTag('any/apply/code/NotQuoteError'));
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
    const evalResult = await evalQuery('"this is not qlang [" | parse !| type');
    expect(evalResult).toEqual(makeTag('quote/ParseError'));
  });
});
