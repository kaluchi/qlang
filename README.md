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
  parse.mjs           — peggy-generated parser entrypoint
  grammar.peggy       — PEG grammar source (compiled at build time)
  ast.mjs             — AST node constructors and shape declarations
  eval.mjs            — pipeline evaluator: threads (pipeValue, env)
  state.mjs           — (pipeValue, env) state pair helpers
  fork.mjs            — fork semantics for nested expressions
  rule10.mjs          — partial/full operand application
  steps/
    literal.mjs       — Step 1: literals (Scalar, Vec, Map, Set)
    projection.mjs    — Step 2: /key
    lookup.mjs        — Step 3: identifier lookup + apply
    asbind.mjs        — Step 4: as name
    letbind.mjs       — Step 5: let name = expr (lazy thunk)
    use.mjs           — Step 6: use (env merge)
  combinators/
    pipe.mjs          — | sequential threading
    distribute.mjs    — * per-element fork + collect
    merge.mjs         — >> flatten then apply
  runtime/
    index.mjs         — assembles langRuntime Map
    vec.mjs           — Vec operands
    map.mjs           — Map operands
    set.mjs           — Set operands
    setops.mjs        — union/minus/inter polymorphic
    arith.mjs         — add/sub/mul/div
    string.mjs        — prepend/append
    bool.mjs          — not
    predicates.mjs    — eq/gt/lt/gte/lte/and/or
    format.mjs        — json/table
    intro.mjs         — env (pseudo-operand)
test/
  unit/               — per-module micro-tests
  conformance/        — JSONL conformance suite
```

## Design

Every function in `src/` is a **pure micro-function**: small, single
purpose, exhaustively tested. The evaluator is a state monad in
disguise — `evalStep(step, state) → state`. No mutable globals, no
host coupling.

## Running

```
npm install
npm test
npm run test:coverage
```
