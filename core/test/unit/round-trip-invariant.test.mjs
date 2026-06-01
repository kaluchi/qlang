// Round-trip invariant pin
// (qlang-spec.md § "Round-trip invariant"):
//
//     eval(parse(printValue(V)))  deepEqual  V
//
// for every value V that can land in pipeValue. Each value-class
// gets a representative suite of literal sources; the property
// the test enforces is `eval(parse(printValue(eval(parse(src)))))
// deepEqual eval(parse(src))` — i.e. the canonical printer's
// output, fed back through parser + evaluator, recovers the same
// pipeValue. Idempotent printer, lossless parser, deterministic
// evaluator.

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.mjs';
import { evalAst } from '../../src/eval.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { makeState } from '../../src/state.mjs';
import { printValue } from '../../src/runtime/format.mjs';
import { deepEqual } from '../../src/equality.mjs';

let runtimeEnv;
async function evalSource(source) {
  if (!runtimeEnv) runtimeEnv = await langRuntime();
  const ast = parse(source, { uri: 'round-trip' });
  const state = makeState(null, new Map(runtimeEnv));
  const result = await evalAst(ast, state);
  return result.pipeValue;
}

async function pinRoundTrip(source) {
  const initial = await evalSource(source);
  const printed = printValue(initial);
  const reparsed = await evalSource(printed);
  expect(deepEqual(reparsed, initial),
    `round-trip drift on \`${source}\` — printed as \`${printed}\``).toBe(true);
}

// pinPrintIdempotent — weaker invariant for value-classes whose
// identity carries internal AST / envRef holders (Conduit). The
// rendered form stabilises across round-trip even when the value
// objects themselves are not deepEqual:
//
//     printValue(eval(parse(printValue(V))))  ≡  printValue(V)
//
// Used for Conduit and any TaggedInstance whose payload includes a
// freshly-parsed AST node (each parse builds fresh node objects
// with distinct `.id` / `.parent` decoration, so `deepEqual` over
// the body would surface phantom drift).
async function pinPrintIdempotent(source) {
  const v1 = await evalSource(source);
  const printed1 = printValue(v1);
  const v2 = await evalSource(printed1);
  const printed2 = printValue(v2);
  expect(printed2,
    `printValue idempotency drift on \`${source}\``).toBe(printed1);
}

// ── Atomic value-classes ──────────────────────────────────────

describe('round-trip invariant — atomics', () => {
  for (const src of [
    '42', '-3.14', '0', '1e10', '2.5e-3',
    '"hello"', '""', '"line one\\nline two"', '"quote: \\""',
    'true', 'false', 'null',
    ':name', ':qlang/error', ':qlang/error/guards', ':"foo bar"',
    ':"$ref"', ':""', ':@callers', ':_private', ':данные'
  ]) {
    it(`atomic literal: ${src}`, () => pinRoundTrip(src));
  }
});

// ── Vec ───────────────────────────────────────────────────────

describe('round-trip invariant — Vec', () => {
  for (const src of [
    '[]',
    '[1 2 3]',
    '[1 "two" null :keyword true]',
    '[[1 2] [3 4]]',
    '[1, 2, 3]',                               // JSON-Array form
    '[{:name "a"} {:name "b"}]'
  ]) {
    it(`vec literal: ${src}`, () => pinRoundTrip(src));
  }
});

// ── Map ───────────────────────────────────────────────────────

describe('round-trip invariant — Map', () => {
  for (const src of [
    '{}',
    '{:k 1}',
    '{:name "alice" :age 30}',
    '{:point {:x 0 :y 0} :tags [1 2 3]}',
    '{:domain/user "alice" :domain/role :admin}',
    '{:"foo bar" 1 :"$ref" "x"}',
    '{"name": "alice", "age": 30}',            // JSON-Object form
    '{:nested {:a {:b {:c 42}}}}'
  ]) {
    it(`map literal: ${src}`, () => pinRoundTrip(src));
  }
});

// ── Set ───────────────────────────────────────────────────────

describe('round-trip invariant — Set', () => {
  for (const src of [
    '#[]',
    '#[:a :b :c]',
    '#[1 2 3]',
    '#[:name :age :id]',
    // Composite-element dedup at construction — `#[[1 2] [1 2]]`
    // collapses to a Set of size 1 because two structurally-equal
    // Vec literals are the same Set member.
    '#[[1 2] [1 2]]',
    '#[[1 2] [3 4]]',
    '#[{:a 1} {:a 1}]',
    '#[{:a 1} {:b 2}]',
    '#[[1 2] [1 2] [3 4]]'
  ]) {
    it(`set literal: ${src}`, () => pinRoundTrip(src));
  }
});

// ── Error / TaggedLit-headed Error (named) ────────────────────

describe('round-trip invariant — Error', () => {
  for (const src of [
    '!{}',
    '!{:kind :oops}',
    '!{:kind :oops :message "boom"}',
    '!{:kind :oops :context {:request "r-1"}}',
    '::TagBindingHasNoConstructorError!{:tag :Foo :payloadType :number}',
    '::AddLeftNotNumberError!{:operand :add :position 1 :expectedType :number :actualType :string}'
  ]) {
    it(`error literal: ${src}`, () => pinRoundTrip(src));
  }
});

// ── Quote ─────────────────────────────────────────────────────

describe('round-trip invariant — Quote', () => {
  for (const src of [
    '~{42}',
    '~{count}',
    '~{[1 2 3] | filter(gt(1)) | count}',
    '~{| count}',                              // pipeline-suffix form
    '~{* mul(2)}',
    '~{>> sort}',
    '~{!| /trail}',
    '~{"text with spaces"}'
  ]) {
    it(`quote literal: ${src}`, () => pinRoundTrip(src));
  }
});

// ── Doc ───────────────────────────────────────────────────────

describe('round-trip invariant — Doc', () => {
  for (const src of [
    '|~~ short doc ~~|',
    '|~~ multi-line\n    doc text\n    over rows ~~|',
    '|~~~~|'                                    // empty
  ]) {
    it(`doc literal: ${src}`, () => pinRoundTrip(src));
  }
});

// ── TaggedInstance — user-defined ::tag instance ─────────────

describe('round-trip invariant — TaggedInstance constructors lifting to plain shapes', () => {
  // ::qlang and ::json constructors lift the payload into a plain
  // Map / JsonObject value with no AST/envRef internals — strict
  // deepEqual round-trip applies.
  for (const src of [
    '::qlang{"k": "v"}',
    '::json{:k "v"}'
  ]) {
    it(`constructor literal: ${src}`, () => pinRoundTrip(src));
  }
});

// ── TaggedInstance — default constructor accepts every Primary ─
//
// `::Tag<payload>` for a tag declared with an identity-only Map
// body (no `:impl` slot) routes through `evalTaggedLit`'s
// default branch. Every payload shape the grammar's `Primary`
// rule accepts is covered here — payload starts with a bracket
// character (Vec / JsonArray / Map / JsonObject / Set / Quote /
// Doc / Error literal) or wraps a non-bracket value through
// ParenGroup (Scalar / Keyword / TagKeyword / nested TaggedLit /
// BareTypeKeyword). The printed value re-parses as the same
// TaggedLit AST and re-evaluates to a deepEqual value.

describe('round-trip invariant — TaggedLit payload covering every Primary form', () => {
  const TAG_DECL = '::Tag1 {} | ::Inner {}';

  for (const tail of [
    // VecLit payload (whitespace-separated)
    '::Tag1[]',
    '::Tag1[1 2 3]',
    '::Tag1[:a "b" 42]',
    '::Tag1[[1 2] [3 4]]',

    // JsonArrayLit payload (comma-separated)
    '::Tag1[1, 2, 3]',

    // MapLit payload (qlang form)
    '::Tag1{:k 1}',
    '::Tag1{:k 1 :nested {:inner 42}}',

    // JsonObjectLit payload
    '::Tag1{"k": 1}',

    // SetLit payload
    '::Tag1#[1 2 3]',
    '::Tag1#[:a :b]',

    // QuoteLit payload
    '::Tag1~{count}',
    '::Tag1~{| count}',

    // DocLit payload
    '::Tag1|~~ short doc ~~|',

    // StringLit payload — `"` opens unambiguously, no wrap needed
    '::Tag1"hello"',
    '::Tag1""',

    // Keyword payload — `:` opens unambiguously
    '::Tag1:foo',
    '::Tag1:qlang/error',

    // TagKeyword payload (BareTypeKeyword) — `::` opens unambiguously
    '::Tag1::Inner',

    // Nested TaggedLit — `::` opens; payload absorbs the inner literal
    '::Tag1::Inner[1 2]',

    // Projection payload — `/` opens unambiguously
    '::Tag1/key',

    // ParenGroup wraps only the identifier-tail scalars (Number /
    // Boolean / Null), which would otherwise fuse into the tag's
    // identifier tail under the atomic `"::" TagName Primary` rule.
    '::Tag1(42)',
    '::Tag1(-3.14)',
    '::Tag1(true)',
    '::Tag1(false)',
    '::Tag1(null)'
  ]) {
    const src = `${TAG_DECL} | ${tail}`;
    it(`payload form: ${tail}`, async () => {
      const initial = await evalSource(src);
      const printed = printValue(initial);
      // Grammar (peggy) must accept the print form as a TaggedLit
      // Primary — re-parse under the same decl context, re-eval,
      // recover deepEqual to the original.
      const reparsed = await evalSource(`${TAG_DECL} | ${printed}`);
      expect(deepEqual(reparsed, initial),
        `round-trip drift on \`${tail}\` — printed as \`${printed}\``).toBe(true);
    });
  }
});

// ── ErrorValue — `::Tag!{…}` literal route ───────────────────

describe('round-trip invariant — named-error literal self-evaluation', () => {
  // `::Tag!{…}` with ErrorLit payload lands as an ErrorValue.
  // `printErrorValue` folds the header tag back into the head; the
  // resulting `::Tag!{…}` form re-parses as a TaggedLit whose
  // payload is an ErrorLit and recovers the same descriptor.
  const TAG_DECL = '::ErrTag {}';

  for (const tail of [
    '::ErrTag!{}',
    '::ErrTag!{:k 1}',
    '::ErrTag!{:k 1 :nested {:inner 42}}'
  ]) {
    const src = `${TAG_DECL} | ${tail}`;
    it(`named-error literal: ${tail}`, async () => {
      const initial = await evalSource(src);
      const printed = printValue(initial);
      const reparsed = await evalSource(`${TAG_DECL} | ${printed}`);
      expect(deepEqual(reparsed, initial),
        `named-error round-trip drift on \`${tail}\` — printed as \`${printed}\``).toBe(true);
    });
  }
});

// ── Conduit — printValue-idempotency tier ────────────────────

describe('round-trip invariant — Conduit (printValue idempotency)', () => {
  // Conduit values carry a parsed body AST plus a lexical envRef
  // holder; both differ by reference between independent mints, so
  // strict deepEqual would surface phantom drift. The rendered
  // `::conduit[…]` form, however, stabilises — round-trip through
  // parse + eval reproduces the exact same source slice.
  for (const src of [
    '::conduit[[] ~{count}]',
    '::conduit[[:x] ~{mul(x, 2)}]',
    '::conduit[:walk [] ~{count}]',
    '::conduit[[:pfx :sfx] ~{prepend(pfx) | append(sfx)}]'
  ]) {
    it(`conduit literal: ${src}`, () => pinPrintIdempotent(src));
  }
});

// ── Cross-type composition ───────────────────────────────────

describe('round-trip invariant — nested composites', () => {
  for (const src of [
    '[{:k [1 2]} {:k [3 4]}]',
    '{:list [1 2 3] :set #[:a :b] :inner {:x 1}}',
    '#[[1 2] [3 4]]',
    '[:a !{:kind :oops} :c]',
    '{:err !{:kind :timeout} :ok 42}',
    '~{[1 2 3] | filter(gt(1))}'
  ]) {
    it(`nested literal: ${src}`, () => pinRoundTrip(src));
  }
});

// ── BareTypeKeyword identity ─────────────────────────────────

describe('round-trip invariant — BareTypeKeyword', () => {
  for (const src of [
    '::conduit',
    '::qlang',
    '::json'
  ]) {
    it(`bare type-keyword: ${src}`, () => pinRoundTrip(src));
  }
});

// ── env-as-Map — `env` operand output parses back ────────────

describe('env output is parseable', () => {
  // The `env` operand exposes the full runtime env as a Map. Every
  // entry — operand descriptor, tag-binding, module-AST Quote,
  // namespace cache, host-bound function (`:qlang/locator`), user
  // `as` snapshots, user BindStep conduits — must render through a
  // path the parser accepts on the way back. A leak (raw JS
  // function source landing in the output) breaks REPL `env`
  // display and every downstream `env | …` pipeline that hands
  // the output to a tool expecting qlang syntax.

  it('printValue(env) parses without errors', async () => {
    const env = await evalSource('env');
    const printed = printValue(env);
    expect(() => parse(printed, { uri: 'env-round-trip' })).not.toThrow();
  });

  it('printValue(env) emits no raw JS function source', async () => {
    const env = await evalSource('env');
    const printed = printValue(env);
    // The literal leak pattern this test guards against — undici's
    // async-function source landing in the output as `async
    // function platformLocator(...) { ... }`.
    expect(printed).not.toMatch(/async function\b/);
    expect(printed).not.toMatch(/=>\s*\{/);
  });

  it('host-bound raw JS function in env renders as a parseable host-marker string', async () => {
    // The locator slot is the live example; this test generalises
    // to any embedder-installed function value under `session.bind`.
    const env = new Map(await langRuntime());
    env.set('myHostFn', async function helloFn() { return 42; });
    const printed = printValue(env);
    expect(printed).toContain('"<host-fn helloFn>"');
    expect(() => parse(printed, { uri: 'host-fn-round-trip' })).not.toThrow();
  });

  it('env | json produces valid JSON (TagKeyword + host function paths)', async () => {
    // The `json` operand is `JSON.stringify(toPlain(subject))`. The
    // env Map contains TagKeyword values (in every `:throws` Vec)
    // and a host-bound function (`:qlang/locator`). The toPlain
    // handlers route them to `"::Name"` and `"<host-fn name>"`
    // strings — `JSON.parse` of the output must succeed and the
    // locator value lands as the host-marker string.
    const jsonText = await evalSource('env | json');
    const parsed = JSON.parse(jsonText);
    expect(parsed['qlang/locator']).toMatch(/^<host-fn [A-Za-z]+>$/);
    expect(parsed['use'].throws[0]).toMatch(/^::[A-Z]/);
  });
});

// ── toPlain unencodable shapes ───────────────────────────────

describe('toPlain refuses unencodable values', async () => {
  const { toPlain, ToPlainUnencodableValueError } = await import('../../src/runtime/format.mjs');

  it('throws ToPlainUnencodableValueError on a raw foreign object', () => {
    // A JS Date isn't a qlang value-class and isn't a function —
    // the lossy plain-JSON encoder refuses rather than silently
    // emitting `"[object Date]"`.
    expect(() => toPlain(new Date())).toThrow(ToPlainUnencodableValueError);
  });

  it('error context carries the offending value\'s typeof for diagnosis', () => {
    try { toPlain(Symbol('s')); }
    catch (e) {
      expect(e.context.actualType).toBe('symbol');
      return;
    }
    throw new Error('expected toPlain to throw');
  });
});

describe('descriptor Maps in pipeValue round-trip through render', async () => {
  // A builtin descriptor Map carries `:impl` as the post-bootstrap-
  // resolved function value. Render paths (printValue, toPlain) project
  // that single slot back to its authoring keyword form — `:qlang/prim/<name>` —
  // so the Map's literal stays round-trip-able through parse → MapLit →
  // eval. Strict round-trip identity for the value-class shape, with
  // dispatchability reconstituted at host bootstrap time.

  it('json on a raw descriptor Map renders :impl as the :qlang/prim/<name> keyword', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const jsonOutput = await evalQuery('env | /count | json');
    expect(typeof jsonOutput).toBe('string');
    expect(jsonOutput).toContain('"impl":":qlang/prim/count"');
  });

  it('manifest descriptor renders cleanly — :impl is stripped at enumeration time', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const jsonOutput = await evalQuery('manifest | filter(/name | eq("count")) | first | json');
    expect(typeof jsonOutput).toBe('string');
    expect(jsonOutput).toContain('"kind":"::builtin"');
  });

  it('direct projection at :impl strips the descriptor wrapping — the bare function-value reaches render and the invariant fires', async () => {
    // `env | /count | /:impl` deliberately reaches past the
    // Map projection to the raw function-value (note the namespaced
    // keyword segment `/:impl` — without the colon, the
    // slash splits into two bare segments). The Map-handler
    // substitution does not fire — the function is the pipeValue
    // itself, not an entry of a Map being rendered.
    const { evalQuery } = await import('../../src/eval.mjs');
    const { FunctionValueLeakedToPrintError } = await import('../../src/types.mjs');
    await expect(evalQuery('env | /count | /:impl | json'))
      .rejects.toThrow(FunctionValueLeakedToPrintError);
  });
});
