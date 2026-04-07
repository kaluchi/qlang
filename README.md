# @kaluchi/qlang

Reference implementation of the jdtbridge query expression language.

This is a **standalone Node.js module** independent of the rest of
the jdtbridge codebase. It implements the language defined in:

- [`docs/jdt-query-lang-spec.md`](../docs/jdt-query-lang-spec.md)
  — user-facing reference (syntax, grammar, value types,
  combinators).
- [`docs/jdt-query-lang-model.md`](../docs/jdt-query-lang-model.md)
  — formal evaluation model `(pipeValue, env)` with six step types
  and a fork rule.
- [`docs/jdt-query-lang-runtime.md`](../docs/jdt-query-lang-runtime.md)
  — built-in operand catalog (the initial `langRuntime` Map).

## Status

Alpha. The language model is stable; this implementation is the
first executable rendering. No host integration with the JDT
bridge yet — that comes after the conformance tests are green.

## Architecture

```
src/
  index.mjs              — public API: parse, evalQuery, langRuntime
  grammar.peggy          — PEG grammar source
  grammar.generated.mjs  — peggy-compiled parser (generated, gitignored)
  parse.mjs              — wrapper around the generated parser, ParseError
  state.mjs              — (pipeValue, env) state pair, env helpers
  types.mjs              — value type predicates, keyword interning,
                           makeThunk, isFunctionValue
  errors.mjs             — typed error hierarchy (QlangTypeError,
                           ArityError, Unresolved, DivisionByZero)
  equality.mjs           — deepEqual — shared by predicates and
                           conformance runner
  fork.mjs               — fork semantics for nested expressions
  rule10.mjs             — operand application protocol (lambda-based)
  eval.mjs               — dispatcher: one lookup-table per node
                           type and per combinator
  runtime/
    index.mjs            — assembles langRuntime Map (keyword-keyed)
    dispatch.mjs         — valueOp / higherOrderOp / nullaryOp /
                           overloadedOp helpers
    guards.mjs           — ensureVec/ensureMap/ensureNumber/...
    vec.mjs              — Vec reducers + transformers + sort
    map.mjs              — keys, vals, has (polymorphic)
    set.mjs              — set (Vec → Set)
    setops.mjs           — union, minus, inter (bound form)
    arith.mjs            — add, sub, mul, div
    string.mjs           — prepend, append
    predicates.mjs       — eq, gt, lt, gte, lte, and, or, not
    format.mjs           — json, table
    intro.mjs            — env (pseudo-operand)
test/
  unit/                  — parse, eval-smoke, edge-cases, index,
                           conformance
  conformance/           — JSONL conformance suite, 15 files by
                           category
```

The evaluator (`eval.mjs`) is a single dispatcher over AST node
types and combinators, each routed via a lookup table to a small
per-case handler. Splitting handlers into per-step files would
add import noise without separating concerns — they share the
state-pair convention and the dispatch table. The runtime is split
per category because each category has its own type guards and
error phrasing.

## Design

Every function in `src/` is a **pure micro-function**: small,
single purpose, exhaustively tested. The evaluator is a state monad
in disguise — every step is `(state) → state`. No mutable globals,
no host coupling.

## Running

```
npm install
npm test
npm run test:coverage
```
