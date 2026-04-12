# Qlang Query Language — Evaluation Model

Formal evaluation model for the query language. Defines the
state-transformer semantics in which environment, bindings, and
operands are all fields of a single Map, and every pipeline step
is a pure function over a state pair. The user-facing reference
([qlang-spec.md](qlang-spec.md)) and the operand
catalog ([qlang-operands.md](qlang-operands.md))
are layered on top of this model.

## Motivation

Names in scope come from several sources — built-in operands
(`count`, `filter`), domain functions (`@callers` and friends),
`let`-bindings, and `as`-bindings — and a naive treatment would
define each category separately with its own lookup rule. That
path is noisy and leaves gaps: a bare identifier could mean
"apply a function" or "reference a captured value" depending on
which category it came from, with no single rule to govern the
dispatch.

This model collapses all four categories into **one**: every
identifier is a field of the environment Map. Looking up a name
reads the field. What happens next — apply the function, or
replace the current value — depends on whether the field holds a
function or a plain value. The environment itself is a
first-class value that can be composed, inspected, and modified
by query code.

## State

The state of query evaluation is a pair `(pipeValue, env)`:

- **`pipeValue`** — the current value flowing through the pipeline.
  Any of Scalar, Vec, Map, Set, Error, or a function (partial or
  complete). When `pipeValue` is an error value, the combinator at
  each call site decides whether its step fires: `|`, `*`, `>>`
  are success-track combinators and deflect (appending the
  upcoming step's AST node to the error's trail); `!|` is the
  fail-track combinator and fires its step against the error's
  materialized descriptor. Track dispatch lives exclusively in
  `applyCombinator`; `evalNode` is a pure AST-node-type dispatcher.
- **`env`** — the environment, a Map from identifier names to values
  or functions. Contains the language runtime, domain runtime, user
  bindings from `let` and `as`, and anything else in scope.

Every pipeline step is a pure function
`(pipeValue, env) → (nextPipeValue, nextEnv)`.

There is no hidden global state. Threading `(pipeValue, env)` through
steps is the entire evaluation mechanism.

### The state pair is meta-notation, not a value type

`(pipeValue, env)` is notation used in this document to describe how
steps transform state. It is **not** a value type in the language —
the language has only Scalar, Vec, Map, Set. Users never construct,
destructure, or pass the pair as a single object.

Components of the pair are individually first-class, however:

- **`pipeValue`** is implicitly first-class — it is the current value,
  and any operation that reads or writes a value is acting on it.
  Capture it by name with `as(:name)` and it becomes referenceable
  like any other value.
- **`env`** is first-class through the `env` operand, which reads the
  environment into `pipeValue` as an ordinary Map. From that point
  it can be inspected with `keys`, `has`, `/key` projection, or any
  other Map operation, and written back with `use`.

There is no operation that exposes the pair as a single object, and
none of the worked examples needs one. The combinators (`|`, `!|`,
`*`, `>>`) and fork boundaries (`()`, `[]`, `{}`, `#{}`) transform
the pair implicitly — that transformation is the semantics of the
language, described in meta-notation for clarity, not reified as a
user-visible object.

## Step types

Seven kinds of steps. Every syntactic form in the language reduces
to one of them. `use`, `env`, `reify`, `manifest`, `error`, and
`isError` are not step types — they are ordinary identifiers
(Step 3) that happen to resolve to built-ins in the language runtime.

### 1. Literal

A literal value: Scalar (`42`, `"hello"`, `null`, `:keyword`), Vec,
Map, Set, or Error (`!{:kind :oops}`).

    (pipeValue, env) → (evalLiteral, env)

Error literals (`!{...}`) evaluate their entries the same way as Map
literals but wrap the result as an error value — the fifth type.
The error value rides the fail-track, deflected by `|`, `*`, `>>`
combinators and fired on by `!|` (see the fail-track dispatch
section below).

For compound literals with expression elements (e.g., `[/name, /age]`,
`{:greeting /name}`, `#{/tag}`), each element or value is evaluated as
a sub-pipeline in a **fork** of `(pipeValue, env)` — see Fork below.

### 2. Projection — `/key`

    (pipeValue, env) → (pipeValue[:key], env)     pipeValue must be a Map

If `:key` is absent from the Map, the result is `null`. If
`pipeValue` is not a Map (Scalar, Vec, Set, null, or a function),
the step raises a **type error**.

Nested `/team/lead/email` desugars to `/team | /lead | /email`.

### 3. Identifier lookup — `name` or `name(arg₁..argₖ)`

Any identifier in pipeline position: `count`, `filter`, `@callers`,
`use`, `env`, user bindings, anything. A bare identifier has zero
captured args; the surface syntax `name(arg₁, …, argₖ)` carries
`k` captured argument expressions that are threaded through to
Rule 10.

Let `resolved = env[:name]`:

- If `resolved` is a **function**: apply it via Rule 10. Every
  function value shares a uniform signature `(state, lambdas) →
  state`. Most built-ins are pure value transformers (they project
  `state.pipeValue`, compute a result, and ascend back into a new
  state), but the same interface also accommodates **reflective
  operands** (`use`, `env`, `reify`, `manifest`) that read or
  write the full state directly. The distinction is not visible
  at the call site: both kinds are invoked the same way.
- If `resolved` is a **non-function value** (Scalar/Vec/Map/Set):
  replace `pipeValue` with `resolved`. Captured args (if any) are
  an error — non-functions cannot be applied.
- If `:name` is not in `env`: unresolved identifier error.

`env` is unchanged by pure operands. Reflective operands may
change it — that is the whole point of keeping them in the same
namespace as ordinary lookups. They can be shadowed by `let` or
`as` like any other name.

This rule unifies built-in operands, domain functions, reflective
built-ins (`use`, `env`), `let` references, and `as` references.
They differ only in what is stored in `env[:name]`, never in
how lookup behaves.

### 4. Value binding — `as(:name)`

    (pipeValue, env) → (pipeValue, env[:name := Snapshot(pipeValue, docs)])

Identity on `pipeValue`; writes the current value into `env[:name]`
as a `Snapshot` wrapper carrying the captured value, the binding name,
and any doc-comment contents attached at parse time. A later bare
`name` lookup (Step 3) transparently unwraps the snapshot and returns
the raw captured value; a reflective `reify(:name)` lookup reads the
wrapper directly and exposes the `:name`, `:value`, and `:docs` fields
in the descriptor.

### 5. Conduit binding — `let(:name, expr)` / `let(:name, [:p1..:pN], expr)`

    (pipeValue, env) → (pipeValue, env[:name := Conduit(expr, params, envRef, docs)])

Identity on `pipeValue`; writes a **conduit** into `env`. A conduit
stores `expr` unevaluated, along with the binding name, an optional
parameter list, any doc-comment contents, and a **lexical scope
anchor** (`envRef`) that captures the declaration-time env including
the conduit itself (tie-the-knot for recursive self-binding).

When `name` is later looked up via Step 3:

1. Captured-arg expressions (one per parameter) become lazy lambdas.
2. Each lambda is wrapped in a conduit-parameter — a nullary function
   value that fires the lambda against the lookup-site `pipeValue`.
3. The body evaluates in a fork with `envRef.env` (the declaration-
   time env) plus the conduit-parameter proxies layered on top.
4. The fork's final `pipeValue` propagates out; the outer env is
   preserved.

This is **lexical scope** — the body sees the env frozen at
declaration time, not the caller's env:

- **Fractal composition.** Conduits built on other conduits are
  immune to shadowing at the call site. Library-defined conduits
  behave predictably regardless of caller context.
- **Laziness.** The body expression is evaluated only when
  referenced.
- **Recursion.** `envRef.env` includes `env[:name]` (the conduit
  itself), so self-reference resolves naturally via tie-the-knot.
- **Higher-order parameters.** Parameters are lazy — a captured-arg
  lambda fires per-element inside `sortWith`, per-iteration inside
  `filter`, per-pair inside `desc`/`asc`.

Zero-arity conduits (`let(:f, expr)`) and parametric conduits
(`let(:f, [:a, :b], expr)`) share the same mechanism.

### 6. Comment — `|~|`, `|~ ... ~|`, `|~~|`, `|~~ ... ~~|`

    (pipeValue, env) → (pipeValue, env)

Pure identity. A comment step consumes neither `pipeValue` nor
`env`; the state threads through unchanged. Comments appear in
the AST as first-class PipeSteps and are visible to reflection,
not lexically stripped before parsing.

Four surface forms, two orthogonal axes (line/block, plain/doc):

| Form            | Role                                                    |
|-----------------|---------------------------------------------------------|
| `\|~\|`          | line plain — identity, content to newline              |
| `\|~ ~\|`        | block plain — identity, content to `~\|`, multi-line   |
| `\|~~\|`         | line doc — identity + attach to next RawStep           |
| `\|~~ ~~\|`      | block doc — identity + attach to next RawStep          |

The two doc forms additionally carry **metadata attachment**: their
content is absorbed into the `docs` field of the immediately
following RawStep (`let`, `as`, or any Primary). Multiple doc
comments preceding the same RawStep accumulate into the `docs` Vec
in declaration order — one comment token per Vec entry, with no
concatenation of adjacent line docs.

A block doc with internal newlines produces **one** Vec entry (a
multi-line string). Two consecutive `|~~|` line docs produce
**two** separate Vec entries.

Comments absorb adjacent combinators into their own delimiters
uniformly across all four forms: the combinator position immediately
before the comment and the combinator position immediately after it
are both implicit, so a comment can sit between two pipeline steps
without any explicit `|` on either side.

- **Block forms** absorb through the `|` in the opener and the `|`
  in the closer.
- **Line forms** absorb the leading `|` through the opener; the
  trailing combinator position is implicit across the newline, so
  the next step follows directly.

At the start of a query, the leading `|` is virtual.

Since comments are identity steps with no effect on the state
pair, their evaluation semantics are trivial. The non-trivial
content — the metadata attachment for doc forms — is a parser-side
transformation: the parser folds `DocComment* RawStep` into a
single RawStep AST node with a `docs` Vec field, so the `let` and
`as` operand impls see the docs at construction time and fold them
into the conduit or snapshot wrapper.

## Reflective built-ins

`use`, `env`, `reify`, and `manifest` are reflective operands bound
in the language runtime. They are not separate step types — a
lookup of any of them goes through Step 3 exactly like `count` or
`filter`. Their distinguishing feature is the shape of their impl:
they receive and return the full `(pipeValue, env)` state, whereas
ordinary operands project `pipeValue`, compute a pure result, and
ascend back. The uniform operand interface hides that descent/ascent
inside the helpers, so the call site looks the same in every case.

### `use`

Arity 1. Merges the current `pipeValue` (a Map) into `env`:

    (pipeValue, env) → (pipeValue, env ∪ pipeValue)

On conflict, the incoming Map wins. `pipeValue` is unchanged, so
the merged Map can be inspected further or discarded by the next
step. If `pipeValue` is not a Map, `use` raises a type error.

Typical call pattern:

    | {:taxRate 0.07 :currency "USD"} | use | [taxRate, currency]

Inside a fork (paren-group, Vec/Map/Set literal, distribute
iteration), the merged bindings evaporate when the fork closes,
matching the documented fork rule — only the `pipeValue` result
of the sub-pipeline escapes.

### `env`

Arity 1. Replaces `pipeValue` with the current `env`:

    (pipeValue, env) → (env, env)

Enables introspection:

    env | keys         -- set of identifiers in scope
    env | has(:count)  -- is the built-in `count` bound?
    env | /count       -- read a specific binding

Inside a fork, `env` returns the fork's current env (with any
fork-local `as` or `let` writes still visible at the point of
lookup).

### `reify`

Overloaded by captured-arg count:

- **Arity 1, zero captured** — value-level. Reads the current
  `pipeValue` and produces a descriptor Map. The descriptor's
  `:kind` field distinguishes four provenances:

  - `:builtin` — `pipeValue` is a descriptor Map loaded by
    `langRuntime()` from `lib/qlang/core.qlang`. Under Variant-B,
    env stores every built-in as a Map directly; `reify`
    substitutes the internal `:qlang/kind :builtin` /
    `:qlang/impl :qlang/prim/<name>` discriminator for the
    user-facing `:kind :builtin`, drops the `:qlang/impl`
    handle (reify consumers want the descriptor, not the
    dispatch-time primitive key), and computes `:captured` /
    `:effectful` by resolving the primitive through
    `PRIMITIVE_REGISTRY`. All other fields (`:category`,
    `:subject`, `:modifiers`, `:returns`, `:docs`, `:examples`,
    `:throws`) pass through from the `core.qlang` entry
    verbatim.
  - `:conduit` — a `let`-bound conduit. Descriptor has `:kind :conduit`,
    `:name`, `:source` (textual form of the body expression),
    `:docs` (Vec from parser-attached doc comments).
  - `:snapshot` — an `as`-bound snapshot. Descriptor has `:kind
    :snapshot`, `:name`, `:value`, `:type`, `:docs` (Vec).
  - `:value` — any other scalar, Vec, Map, or Set. Descriptor has
    `:kind :value`, `:value`, `:type`.

      (pipeValue, env) → (descriptorMap, env)

- **Arity 2, one captured keyword** — `reify(:name)`. Looks up
  `:name` in `env` and builds the descriptor for whatever binding
  lives there, attaching a `:name` field to the result regardless
  of whether the binding is a function, conduit, snapshot, or bare
  value. This form is useful when the caller knows the name but
  does not want to route the binding through `pipeValue` first.

      (pipeValue, env) → (env[:name] descriptor with :name field, env)

`reify` never mutates `env` — it is read-only on the state pair.

### `manifest`

Arity 1. Ignores `pipeValue`; iterates over every binding in the
current `env`, building a reify-style descriptor for each, and
returns a Vec of descriptors sorted by binding name.

    (pipeValue, env) → (Vec<descriptor>, env)

Typical call pattern:

    env | manifest | filter(/kind | eq(:builtin)) | table

`manifest` is a convenience wrapper around `reify(:name)` applied
to every key in `env | keys`.

## Combinators

Four combinators thread state between steps. Three are on the
success-track (`|`, `*`, `>>`) and fire their step when
`pipeValue` is any non-error value; on an error `pipeValue` they
**deflect** — the step's AST node is appended to the error's
`_trailHead` linked list via `appendTrailNode` and the error
passes downstream unchanged. One is on the fail-track (`!|`) and
fires its step only when `pipeValue` is an error; on a success
`pipeValue` it deflects as identity pass-through.

### `|` — sequential application

    (pipeValue, env) | nextStep
        ≡
    run nextStep starting from (pipeValue, env)

Left-to-right state threading for success-track values.

**Deflection on error pipeValue.** When `pipeValue` is an error
value, `|` does not invoke `nextStep`. Instead it appends
`nextStep`'s AST node to the error's trail (via `appendTrailNode`)
and returns the error as the new `pipeValue`. Implementation:
`applySuccessTrack` in `eval.mjs`.

### `!|` — fail-apply

    (pipeValue, env) !| nextStep
        ≡
    if pipeValue is an error:
        run nextStep starting from (materializedDescriptor, env)
    else:
        (pipeValue, env) unchanged (identity pass-through)

Fail-track dispatch dual of `|`. When `pipeValue` is an error,
`applyFailTrack` combines the descriptor's existing `:trail` Vec
with any new entries walked out of `_trailHead`, rebuilds the
descriptor Map with the combined trail stamped onto `:trail`, and
evaluates `nextStep` against that Map as the new `pipeValue`. The
step sees the descriptor as an ordinary Map and may use any
Map-oriented operand (`/key`, `has`, `keys`, `vals`, `union`,
`filter` over `:trail`, etc.) without special error-handling
knowledge. Any result the step produces becomes the new
`pipeValue` — if the step produces a non-error value, the
pipeline is back on the success-track; if the step re-lifts via
`| error`, the pipeline stays on the fail-track with trail
continuity preserved by the `makeErrorValue` invariant.

On a non-error `pipeValue` the combinator is an identity.

The leading `!|` prefix on a Pipeline (`Pipeline.leadingFail`)
routes the pipeline's first step through `applyFailTrack` even
though no preceding step exists. Used inside predicate lambdas of
`filter(…)`, `when(…)`, `if(…)` and inside distribute element
bodies where the per-element `pipeValue` may be on either track.

### `*` — distribute

    (pipeValue, env) * body

For each element `item` of the `pipeValue` Vec:

1. **Fork** to `(item, env)`
2. Run `body` as a sub-pipeline
3. Take the resulting `nextPipeValue` from the fork

Collect all results into a new Vec. Final state:
`(collectedVec, env)` with original `env` preserved. Each iteration's
modifications to `env` are discarded when its fork closes.

The empty Vec is a valid input: `[] * body → []` without invoking
`body`. This is what lets recursive definitions terminate over
finite data structures.

**Deflection on error pipeValue.** When `pipeValue` is an error
value, `*` appends `body`'s AST node to the error's trail and
returns the error unchanged. No per-element fork happens. On any
other non-Vec `pipeValue` the step raises `DistributeSubjectNotVec`.

### `>>` — flatten then apply

    (pipeValue, env) >> nextStep
        ≡
    (flat(pipeValue), env) | nextStep

`pipeValue` must be a Vec. `flat` removes one level of nesting; it
is a no-op on flat Vecs (elements that are not themselves Vecs pass
through unchanged).

**Deflection on error pipeValue.** When `pipeValue` is an error
value, `>>` appends `nextStep`'s AST node to the error's trail and
returns the error unchanged. No flatten happens. On any other
non-Vec `pipeValue` the step raises `MergeSubjectNotVec`.

## Fork

Nested expressions `(...)`, `[...]`, `{...}`, `#{...}` each open a
**fork**: a sub-pipeline that starts with a copy of the outer state.

When the inner sub-pipeline finishes, its final `nextPipeValue`
becomes the result of the nested expression, but its final `nextEnv`
is **discarded** — outer execution resumes with the original `env`.

The fork rule, together with Map last-write-wins and `|`-based
state threading, produces the seven scoping rules listed in the
Spec's Value binding section. The numbering below matches those
canonical rules; four are **direct corollaries of the fork rule**:

2. **Nested inherits outer** — the fork starts with a copy of the
   outer `env`.
3. **Nested does not leak** — the fork's `nextEnv` is discarded.
4. **Distribute iteration is its own scope** — `*` creates a fork
   per element.
5. **Siblings are independent** — each element or entry of a compound
   literal is its own fork, starting from the same outer state.

Three come from the rest of the evaluation model:

1. **Lexical left-to-right** — from `|` combinator threading.
6. **Shadowing** — from Map last-write-wins on `env[:name]`.
7. **Resolution order** — `as` > `let` > built-in is just "whoever
   wrote last to `env[:name]`", which is a consequence of shadowing
   in the user's typical write order (built-ins loaded first, then
   user `let`, then `as` captures during query execution).

The four nesting rules collapse to: **nested expressions fork; forks
don't leak env changes outward**. The other three come from the
semantics of `|` and the Map datatype.

## Bootstrap

The host provides the initial state `(pipeValue, env)`. Two
equivalent presentations:

**Conceptual model.** The state machine starts from `(langRuntime, {})`:
`pipeValue` is the language runtime Map, `env` is empty. The first
step of any query is `use`, which installs the runtime:

    -- pure conceptual model — runs in host-wrapped context
    use                             -- (langRuntime, {}) → (langRuntime, langRuntime)
    | domainRuntime | use           -- add domain functions
    | replEnv | use                 -- add REPL-accumulated let-bindings
    | <query body>

**Practical model.** The host starts with `env = langRuntime` and
`pipeValue = langRuntime` — i.e., as if the implicit first `use` had
already run. This is observationally identical to the conceptual
model: both variants deliver control to `<query body>` with the same
`env` and the same `pipeValue`.

Most realistic queries begin with a literal (`[1 2 3] | ...`) or a
Map-literal (`{:k v} | use | ...`), both of which immediately
replace `pipeValue`. The initial value of `pipeValue` only matters
if the first step is a bare identifier lookup that happens to expect
a specific input type; in that case the query must explicitly
establish `pipeValue` before calling any such operand.

(A simpler host might choose `pipeValue = null` instead of
`langRuntime`. This is NOT equivalent to the conceptual model for
queries whose first step is a function lookup, because Step 3 would
pass `null` as the subject. Implementations should document which
variant they use; the reference evaluator uses `pipeValue =
langRuntime` to match the conceptual model exactly.)

### How `langRuntime` is assembled

The reference implementation assembles `langRuntime` from two
co-located sources:

- **`lib/qlang/core.qlang`** — the authored catalog. One outer
  Map literal whose 69 entries each bind a keyword identifier
  (`:count`, `:filter`, `:let`, `:parse`, …) to a descriptor
  Map carrying `:qlang/kind :builtin` plus a namespaced
  `:qlang/impl :qlang/prim/<name>` keyword that points into the
  primitive registry, plus the authored metadata (`:category`,
  `:subject`, `:modifiers`, `:returns`, `:examples`, `:throws`).
  Doc-comment prefixes on each MapEntry (`|~~ ... ~~| :count
  {...}`) fold into a `:docs` Vec on the entry's value Map at
  eval time via `grammar.peggy`'s `MapEntryDocPrefix` and
  `eval.mjs`'s `foldEntryDocs`.

- **`src/runtime/*.mjs`** — the JS impls. Each module registers
  its executable primitives into `PRIMITIVE_REGISTRY` at module-
  load time under their `:qlang/prim/<name>` keys. The dispatch
  wrappers in `src/runtime/dispatch.mjs` (`valueOp`,
  `higherOrderOp`, `nullaryOp`, `overloadedOp`, `stateOp`,
  `stateOpVariadic`, `higherOrderOpVariadic`) attach a tiny
  `meta` object carrying only the `captured` range — the rest
  of the metadata lives in `core.qlang` and is addressable by
  descriptor projection at `reify` / `manifest` time.

`langRuntime()` in `src/runtime/index.mjs` ties the two together
by parsing `core.qlang` once, evaluating it against an empty env
into a template Map, and returning a shallow copy on every call
so each session can write its own bindings without mutating the
template. The inner descriptor Maps are frozen and shared
between copies — safe because qlang values are immutable at the
language level.

Dispatch at an operand call site is straightforward under this
shape. `eval.mjs::evalOperandCall` looks up the identifier in
`env`; if the resolved value is a Map carrying `:qlang/kind
:builtin`, control flows through `applyBuiltinDescriptor` which
reads the `:qlang/impl` handle, resolves it through
`PRIMITIVE_REGISTRY.resolve` into the backing function value,
and invokes it via Rule 10 exactly as the legacy direct-function
path did. A bare non-nullary lookup (no captured args,
`impl.meta.captured[0] > 0`) short-circuits to return the
descriptor Map itself as `pipeValue` — the REPL ergonomic that
lets `mul` at the prompt yield mul's descriptor rather than
firing an arity error. Nullary operands (`count`, bare-form
`sort`, `env`, etc.) still fire on bare lookup because their
`captured[0]` is zero and bare application is their valid call
shape.

Additional runtimes and user libraries are loaded anywhere in a query
by providing a Map and applying `use`:

    {:double mul(2)
     :isSenior /age | gt(65)}
      | use
      | employees * {:doubledAge /age | double :senior isSenior}

After `use`, the keys of the Map become regular identifiers
indistinguishable from built-ins.

## Mapping syntactic forms to step types

| Syntactic form                      | Semantics                             |
|-------------------------------------|---------------------------------------|
| Scalar/Vec/Map/Set/Error literal    | Step 1 — literal                      |
| `/key` projection (possibly nested) | Step 2 — projection                   |
| Identifier (any name, including `@`-prefixed) | Step 3 — env lookup         |
| `op(arg₁..argₖ)` operand call       | Step 3 — env lookup + Rule 10         |
| `as(:name)` operand call            | Step 3 — identifier lookup + snapshot capture |
| `let(:name, expr)` operand call     | Step 3 — identifier lookup + conduit construction |
| `\|~\|`, `\|~ ~\|`                   | Step 6 — plain comment (identity)     |
| `\|~~\|`, `\|~~ ~~\|`                | Step 6 — doc comment (identity + attach) |
| `use`, `env`, `reify`, `manifest`   | Step 3 — reflective built-in          |
| `error`, `isError`                  | Step 3 — error built-in               |
| `\|`, `!\|`, `*`, `>>`              | Combinators                           |
| `(...)` grouping                    | Fork                                  |
| Vec / Map / Set entry evaluation    | Fork per entry                        |

Rule 10 (partial/full application) applies within Step 3 whenever
the looked-up value is a function.

## Worked examples

Eight examples traced through the model.

### Example 1 — basic pipeline

    > [1 2 3 4 5] | filter(gt(3)) | count
    2

Trace (reference host variant: `env = langRuntime`, `pipeValue = langRuntime`; the first step is a literal, so the initial `pipeValue` is immediately overwritten):

1. `[1 2 3 4 5]` — literal. `pipeValue = [1 2 3 4 5]`.
2. `filter(gt(3))` — lookup `filter` in `env` → binary function.
   1 arg captured (`gt(3)`). Rule 10 partial: captured fills position
   2, `pipeValue` fills position 1. `filter([1..5], gt(3))` → `[4 5]`.
   `pipeValue = [4 5]`.
3. `count` — lookup `count` → unary function, 0 captured.
   `pipeValue = 2`.

Final `pipeValue = 2`. ✓

### Example 2 — projection

    > {:name "Alice" :age 30} | /name
    "Alice"

1. Literal Map. `pipeValue = {:name "Alice" :age 30}`.
2. `/name` — projection. `pipeValue = "Alice"`.

### Example 3 — distribute + full application in reshape

    > [{:name "Alice" :price 100 :qty 3}]
      * {:name /name :total mul(/price, /qty)}

1. Literal Vec. `pipeValue = [{:name "Alice" :price 100 :qty 3}]`.
2. `*` distributes. Fork with the single element.
3. Inside element fork: `pipeValue = {:name "Alice" :price 100 :qty 3}`.
4. `{:name /name :total mul(/price, /qty)}` — Map literal. Each
   entry value is evaluated in its own sub-fork against `pipeValue`.
   - `:name /name` sub-fork: `/name` → `"Alice"`. Entry value `"Alice"`.
   - `:total mul(/price, /qty)` sub-fork: lookup `mul`, binary
     function, 2 args captured — **full application**. `pipeValue`
     becomes context. `/price` resolves against `pipeValue` → `100`.
     `/qty` → `3`. `mul(100, 3)` → `300`. Entry value `300`.
   - Collected: `{:name "Alice" :total 300}`.
5. Element fork returns that Map. Distribute collects into a Vec.

Final `pipeValue = [{:name "Alice" :total 300}]`.

### Example 4 — wrap-with-original

    > [{:id 1 :name "Alice"} {:id 2 :name "Bob"}]
      * (as(:employee) | {:key /id :record employee})

For element 1 = `{:id 1 :name "Alice"}`:

1. Fork with (element 1, outer `env`).
   `pipeValue = {:id 1 :name "Alice"}`.
2. `(as(:employee) | {:key /id :record employee})` — paren fork.
   - `as(:employee)` — `env[:employee] = {:id 1 :name "Alice"}`.
     `pipeValue` unchanged.
   - `{:key /id :record employee}` — Map literal.
     - `:key /id` sub-fork → `1`.
     - `:record employee` sub-fork → lookup `employee` in `env`,
       non-function value (a Map), replace `pipeValue` →
       `{:id 1 :name "Alice"}`.
   - Collected: `{:key 1 :record {:id 1 :name "Alice"}}`.
3. Paren fork's `env` (with `:employee`) is discarded.

Element 2 analogous. Final:

    [{:key 1 :record {:id 1 :name "Alice"}}
     {:key 2 :record {:id 2 :name "Bob"}}]

Each iteration gets its own fresh `employee` binding; it is not
visible outside the paren group. A non-function identifier lookup
replaces `pipeValue` — Step 3, second bullet.

### Example 5 — multi-stage bindings

    > [85 92 47 78 68 95 52]
      | as(:allScores)
      | filter(gte(70))
      | as(:passingScores)
      | [allScores | count, passingScores | count]
    [7 4]

1. `pipeValue = [85 92 47 78 68 95 52]`.
2. `as(:allScores)` — `env[:allScores] = [85 92 47 78 68 95 52]`.
3. `filter(gte(70))` — `pipeValue = [85 92 78 95]`.
4. `as(:passingScores)` — `env[:passingScores] = [85 92 78 95]`.
5. `[allScores | count, passingScores | count]` — Vec literal with
   two element sub-forks, each starting from the same outer state
   (`[85 92 78 95]`, `env` with both bindings).
   - Sub-fork 1 runs `allScores | count`:
     - `allScores` — lookup, non-function, replace `pipeValue` with
       `[85 92 47 78 68 95 52]`.
     - `count` — `pipeValue = 7`.
   - Sub-fork 2 runs `passingScores | count`:
     - `passingScores` — `pipeValue = [85 92 78 95]`.
     - `count` — `pipeValue = 4`.
   - Collected: `[7 4]`.

Final `pipeValue = [7 4]`. ✓

### Example 6 — recursive `let`

The language has no conditionals, so classic base-case recursion
(factorial, Fibonacci, `if n == 0 then 1 else ...`) cannot be
expressed directly. But recursion over **finite data structures** —
trees, nested Vecs, nested Maps — works naturally, because the
recursion bottoms out when `*` distributes over an empty collection:
`[] * anything` is `[]`, terminating the descent without invoking
the recursive step.

Three patterns demonstrated on a directory tree:

    {:label "root" :size 0 :children [
      {:label "README.md" :size 2048 :children []}
      {:label "src"       :size 0    :children [
        {:label "main.c" :size 512 :children []}
        {:label "util.c" :size 256 :children []}]}]}

#### 6a — tree aggregation: total size

Starting with the tree literal above as `pipeValue`:

    | let(:totalSize, add(/size, /children * totalSize | sum))
    | totalSize

For each node, compute `/size + sum of children's totalSize`.
This is a two-argument full application of `add`: both args are
captured, the current node is the context, and each captured arg
resolves against the node as a sub-pipeline.

Trace, assuming the tree literal already occupies `pipeValue`:

1. `let(:totalSize, <expr>)` — writes a conduit into `env[:totalSize]`.
   `pipeValue` (the tree root) unchanged.
2. `totalSize` — lookup `env[:totalSize]`, force the conduit. Evaluate
   `add(/size, /children * totalSize | sum)` with `pipeValue = root`
   as context.
   - arg1 `/size` sub-fork: `pipeValue = root`, `/size` → `0`.
   - arg2 `/children * totalSize | sum` sub-fork:
     - `/children` → `[README.md, src]`.
     - `* totalSize` — for each child, recurse with the child as
       `pipeValue`.
       - README.md: `add(2048, [] * totalSize | sum)` =
         `add(2048, 0)` = `2048`.
       - src: `add(0, [main.c, util.c] * totalSize | sum)` =
         `add(0, 768)` = `768`.
     - Collected: `[2048, 768]`.
     - `| sum` → `2816`.
3. `add(0, 2816)` → `2816`.

The pattern — `aggregator(/leafValue, /children * self | reducer)` —
generalizes to any aggregation: count nodes with `add(1, ...)`,
find max depth with `max(0, ... | max) | add(1)`, etc.

#### 6b — tree flattening: all file names in DFS order

Again starting with the tree literal above as `pipeValue`:

    | let(:allNames, [[/label], /children * allNames | flat] | flat)
    | allNames

(The outer parentheses are required because a `let` body is a
single Primary — multi-step bodies must be wrapped. See Spec §
"Named expressions" for the rule.)

For each node, produce `[own label]` concatenated with the flattened
concatenation of children's results. The outer Vec has two elements
(own label wrapped in a singleton Vec, and children's flat list),
and the outer `| flat` merges them into one list.

Trace, assuming the tree literal already occupies `pipeValue`:

1. `let(:allNames, <expr>)` — writes a conduit into `env[:allNames]`.
   `pipeValue` (the tree root) unchanged.
2. `allNames` — lookup, force conduit. Evaluate the conduit body
   `[[/label], /children * allNames | flat] | flat` with
   `pipeValue = root`:
   - Inner Vec literal `[[/label], /children * allNames | flat]`:
     - Element 1 `[/label]` — sub-fork with `pipeValue = root`.
       `/label` → `"root"`. Inner Vec → `["root"]`.
     - Element 2 `/children * allNames | flat`:
       - `/children` → `[README.md, src]`.
       - `* allNames` — for each child, recurse.
         - README.md (leaf) → `["README.md"]`.
         - src (internal) → recurses:
           - Elem 1: `["src"]`.
           - Elem 2: `[main.c, util.c] * allNames | flat` →
             `[["main.c"], ["util.c"]]` → flat → `["main.c", "util.c"]`.
           - Collected: `[["src"], ["main.c", "util.c"]]`.
           - `| flat` → `["src", "main.c", "util.c"]`.
       - Collected: `[["README.md"], ["src", "main.c", "util.c"]]`.
       - `| flat` → `["README.md", "src", "main.c", "util.c"]`.
     - Collected: `[["root"], ["README.md", "src", "main.c", "util.c"]]`.
   - Trailing `| flat` →
     `["root", "README.md", "src", "main.c", "util.c"]`.

A nested tree becomes a flat Vec in depth-first order. The pattern —
`[[own], /children * self | flat] | flat` — is the classical
tree-to-list conversion.

#### 6c — tree transformation: enrich each node with child count

Again starting with the tree literal above as `pipeValue`:

    | let(:withCounts, {:label /label
                         :count /children | count
                         :children /children * withCounts})
    | withCounts

Produces a tree with the same shape, where each node gains a
`:count` field holding its immediate child count. This is the
template form of recursive tree transformation: copy the structure,
add computed fields per node.

Trace:

1. `let(:withCounts, <expr>)` — writes conduit into `env[:withCounts]`.
2. `withCounts` — lookup, force conduit. Reshape each entry against
   `pipeValue = root`:
   - `:label /label` → `"root"`.
   - `:count /children | count` → `2`.
   - `:children /children * withCounts` → distribute over
     `[README.md, src]`, each child recursively transformed.
   - For the leaf README.md: `:count /children | count` → `0`,
     `:children /children * withCounts` → `[]`. Termination.

Result on the root:

    {:label "root" :count 2 :children [
      {:label "README.md" :count 0 :children []}
      {:label "src"       :count 2 :children [
        {:label "main.c" :count 0 :children []}
        {:label "util.c" :count 0 :children []}]}]}

Replace `:count /children | count` with any computed expression and
you get a different transformation: `:depth /children * withCounts | ...`,
`:hash /label | hash-string`, `:archived /mtime | lt(cutoff)`,
whatever. The shape is preserved; fields are added/rewritten per
node. This is the practical form of the "`walk` template".

In all three examples, recursion works because `env[:name]` is
written by the `let` step *before* any lookup of `name` occurs.
When the body of the conduit references itself, the name is already
resolvable. Termination is guaranteed whenever the tree is finite:
`[] * self` collapses to `[]` without invoking `self`.

### Example 7 — middle-of-query `use` (importing constants)

    > {:pi 3.14159 :e 2.71828 :goldenRatio 1.61803}
      | use
      | [pi | mul(2), e | mul(3)]
    [6.28318 8.15484]

1. Literal Map: `pipeValue = {:pi 3.14159 :e 2.71828 :goldenRatio 1.61803}`.
2. `use` — `pipeValue` is a Map, merge into `env`. Now `env[:pi]`,
   `env[:e]`, and `env[:goldenRatio]` are bound to their number
   values. `pipeValue` unchanged (still the Map).
3. `[pi | mul(2), e | mul(3)]` — Vec literal with two element
   sub-forks. Each sub-fork starts with `pipeValue` = the Map from
   step 2 (the outer state).
   - Sub-fork 1 runs `pi | mul(2)`:
     - `pi` — lookup `env[:pi]`, non-function value (number),
       replace `pipeValue` with `3.14159`.
     - `mul(2)` — lookup `mul`, binary function, 1 captured.
       Partial application: `mul(3.14159, 2) = 6.28318`.
   - Sub-fork 2 runs `e | mul(3)` → `8.15484`.
   - Collected: `[6.28318 8.15484]`.

The user extended the namespace in the middle of a query by merging
a Map of constants into `env`, then referenced those constants as
ordinary identifiers downstream.

**Note — `use` vs `let` for extension.** `use` imports a pre-built
Map whose values are already the bindings you want (typically
constants or host-provided native functions). It cannot be used to
define new *functions* from inside the query, because a Map literal
like `{:double mul(2)}` evaluates each value expression as a
sub-pipeline: `mul(2)` applies to the current `pipeValue` via
Rule 10 rather than producing a function object. For in-query
function extension use `let`:

    | let(:double, mul(2))
    | let(:isSenior, /age | gt(65))
    | employees * {:doubledAge /age | double :senior isSenior}

Each `let` writes a conduit that forces against `pipeValue` at
each reference site. `use` and `let` are complementary: `use` for
importing static data and host functions, `let` for derived
expressions within the query.

### Example 8 — env introspection

    > [1 2 3] | env | has(:count)
    true

1. `pipeValue = [1 2 3]`.
2. `env` — `pipeValue = env` (the current environment as a Map value).
3. `has(:count)` — lookup `has`, binary, 1 captured (`:count`).
   Partial: `has(env, :count) → true`. `pipeValue = true`.

A query can ask the language what names are available to it.

## Language scope boundaries

- **Thread safety.** The pure state-transformer model makes parallel
  query execution trivially safe as long as native functions in the
  runtime do not share host-side state.
- **Destructuring `as`.** Not part of the primitive set. `as(:name)`
  captures a single value.
- **Cycle detection.** The language assumes acyclic data. Cycle
  detection is the host's responsibility.
- **Identity operand.** There is no separate identity operand.
  `as(:cur)` followed by `cur` achieves the same effect.

## Source-location enrichment of runtime errors

Every step in the evaluator dispatches through a single
`evalNode(node, state)` entry point that wraps the per-type handler
in a try/catch. When a `QlangError` (or any subclass) escapes the
handler without a `.location` field already set, `evalNode` stamps
the offending AST node's `.location` onto the error before
re-throwing. The check uses `if (e instanceof QlangError && !e.location && node.location)` so
that deeper frames — closer to the actual throw site — win: an
inner `evalNode` invocation that already attached its own node's
location is not overwritten by the outer call as the error bubbles
up.

The result is that every runtime error escaping `evalQuery` carries
the source position of the most-specific failing node, which the
embedder can use to drive editor squiggles, hover-on-error
diagnostics, and Sentry breadcrumbs. The enrichment is transparent
to operand impls — they continue to throw per-site error classes
without any location-passing plumbing — and to the evaluation
semantics, which are unchanged.

The same `evalNode` chokepoint is also where the
`EffectLaunderingAtCall` runtime safety net for the `@`-effect-marker
invariant fires, inside the `evalOperandCall` branch immediately
after conduit-forcing and snapshot-unwrapping. See
[the spec's "Effect markers" section](qlang-spec.md#effect-markers)
for the user-facing contract and
[the runtime reference](qlang-operands.md#effectmjs-and-effect-checkmjs--effect-markers)
for the precomputed `.effectful` field that the safety net consults.

## Error values and fail-track dispatch

Error is the fifth value type. An error value wraps a descriptor
Map and rides the fail-track: the `|`, `*`, and `>>` combinators
deflect it, while `!|` fires its step against the materialized
descriptor.

### Error-to-value conversion

The `evalNode` try/catch block converts recoverable exceptions to
error values. Operand impls continue to throw per-site error
classes; the conversion is transparent to them. Two converters
(`error-convert.mjs`) handle qlang errors (full structured context
from per-site class properties) and foreign host errors (best-effort
field extraction from JS Error objects). `QlangInvariantError`
subclasses are never caught — they indicate runtime bugs, not data
errors.

### Combinator-level track dispatch

Track dispatch lives exclusively in `applyCombinator` (`eval.mjs`),
which routes to one of four combinator evaluators. `evalNode` is a
pure AST-node-type dispatcher with no track awareness.

- **`|`** — `applySuccessTrack(state, stepNode)`. If `pipeValue`
  is an error, appends `stepNode` to the error's `_trailHead`
  linked list and returns the error unchanged. Otherwise invokes
  `evalNode(stepNode, state)`.
- **`!|`** — `applyFailTrack(state, stepNode)`. If `pipeValue` is
  an error, materializes its descriptor (see below) and invokes
  `evalNode(stepNode, state-with-descriptor)`. On a success
  `pipeValue` it returns the state unchanged (identity
  pass-through).
- **`*`** — `distribute(state, bodyNode)`. Deflects on error into
  the trail like `|`; on a Vec, forks per element and runs the
  body against each; throws `DistributeSubjectNotVec` when
  `pipeValue` is neither a Vec nor an error.
- **`>>`** — `mergeFlat(state, nextNode)`. Deflects on error into
  the trail like `|`; on a Vec, flattens one level and invokes
  the next step against the flattened Vec.

The leading `!|` prefix of a Pipeline (`Pipeline.leadingFail`) is
handled in `evalPipeline` by routing the first step through
`applyCombinator('!|', state, step)` instead of the raw
`evalNode(step, state)` call that un-prefixed pipelines use. This
is how predicate lambdas inside `filter(…)` / `when(…)` / `if(…)`
opt into fail-apply for their first step.

### Trail and materialization

Each deflection appends an `{ entry, prev }` node to a lazy
linked list on the error value (`_trailHead`) via
`appendTrailNode`. Every `entry` is an **AST-Map** — the
structured data-form of the deflected step, produced at stamp
time by `walk.mjs::astNodeToMap` — not a raw source-text
string. The Map carries the deflected step's `:qlang/kind`
discriminator, type-specific payload (`:name`, `:args`,
`:keys`, `:elements`, `:entries`, …), and `:text` / `:location`
metadata, so downstream consumers can filter / project / re-eval
trail entries as ordinary qlang data:

    error !| /trail * /name                    -- operand names
    error !| /trail | last | /location         -- fail site
    error !| /trail | filter(/name | eq("filter"))   -- per-op
    error !| /trail * /text                    -- display form
    error !| /trail * eval                     -- replay as code

The trail is combined into a `:trail` Vec on the descriptor when
`!|` fires: `applyFailTrack` reads the descriptor's existing
`:trail` Vec (guaranteed by the `makeErrorValue` invariant),
walks `_trailHead` via `materializeTrail` to collect new
deflections since the last materialization, concatenates the two,
and stamps the combined Vec back onto a fresh descriptor Map
that is exposed to the step.

Trail continuity across re-lift: when a step running under `!|`
returns a Map and a later `| error` re-wraps it, the new error's
descriptor retains the `:trail` Vec the step handed back, and
subsequent deflections accumulate into a fresh `_trailHead`
linked list. The next `!|` combines both sources again —
continuous accumulation through any number of re-lift boundaries
without losing history. Explicit truncation is available via
`union({:trail []})` inside a fail-apply step before re-lift.

### Descriptor shape and invariant

`makeErrorValue` (in `types.mjs`) enforces a single invariant:
every error descriptor carries `:trail` as a Vec. Callers that
supply an explicit `:trail` in the input descriptor (user literal
`!{:trail [...]}`, codec replay via `fromTaggedJSON`) have their
value preserved; callers that omit it get an empty Vec inserted.
Hot-path readers under `!|` read `:trail` without defensive
fallbacks.

Error values produced by the runtime carry the following fields
in addition to the invariant `:trail`:

| Field | Type | Content |
|---|---|---|
| `:origin` | keyword | `:qlang/eval` or `:host` or `:user` |
| `:kind` | keyword | Error category |
| `:thrown` | keyword | Per-site class name |
| `:message` | string | Human-readable |
| `:trail` | Vec of AST-Maps | One frozen AST-Map per pipeline step that a success-track combinator deflected on this error, produced by `walk.mjs::astNodeToMap` at stamp time and readable through the `:name` / `:args` / `:location` / `:text` fields |

User-created error values (`!{...}` or `error(map)`) carry
whatever fields the author provides — no mandatory schema beyond
the `:trail` invariant. The runtime guarantees the other fields
only for its own errors.

## Tooling primitives

Modules that the operand library never imports but that embedders
(editors, notebooks, REPLs, language servers) consume directly.
Re-exported from the package entry.

### `walk.mjs` — AST traversal primitives and AST ↔ Map codec

Single source of truth for the qlang AST shape. Every module that
needs to read, decorate, query, or transform AST nodes imports
from here rather than duplicating a switch-on-`node.type` —
adding a new node type in `grammar.peggy` is a one-file edit
because `astChildrenOf` and the codec share the shape knowledge.

- `astChildrenOf(node)` — direct semantic children of an AST node.
- `walkAst(node, visit)` — pre-order recursive descent. Visitor
  returns `false` to skip a subtree.
- `assignAstNodeIds(root)` / `attachAstParents(root)` — post-parse
  decoration (monotonic `.id`, `.parent` pointer).
- `findAstNodeAtOffset(ast, offset)` — narrowest-spanning node at
  a UTF-16 offset. Drives editor hover and goto-definition.
- `findIdentifierOccurrences(ast, name)` — every OperandCall and
  Projection segment naming the given identifier, including
  `let(:name, ...)` and `as(:name)` declaration patterns.
- `bindingNamesVisibleAt(ast, offset)` — lexical-scope-correct set
  of binding names visible at a cursor position. Honors fork-
  isolating ancestors (ParenGroup, VecLit, SetLit, MapLit, MapEntry).
- `astNodeSpan(node)` / `astNodeContainsOffset(node, offset)` —
  range arithmetic over node locations.
- `triviaBetweenAstNodes(nodeA, nodeB, ast)` — source slice between
  two adjacent nodes (whitespace, punctuation, plain comments).
- `astNodeToMap(node)` — encodes a JS-object AST node into a
  frozen qlang-Map representation, stamping `:qlang/kind
  :<NodeType>` as the discriminator plus type-specific payload
  fields (`:value`, `:name`, `:args`, `:elements`, `:entries`,
  `:keys`, `:steps`, etc.) and the shared `:text` / `:location`
  metadata. Pipeline steps normalize into uniform `:PipelineStep`
  wrapper Maps so downstream walkers do not special-case the
  head. Consumers: `eval.mjs::applySuccessTrack` /
  `distribute` / `mergeFlat` stamp AST-Maps onto deflected
  `:trail` entries at fail-track dispatch time; the `parse`
  reflective operand lifts user source into this form.
- `qlangMapToAst(map)` — the inverse. Walks an AST-Map back into
  a JS-object AST node suitable for `evalAst`. Round-trip
  invariant: `qlangMapToAst(astNodeToMap(n))` is structurally
  equal to `n` for any AST produced by `parse()`, modulo the
  post-parse decoration (`.id`, `.parent`) and the root-level
  metadata (`.source`, `.uri`, `.parseId`, `.parsedAt`,
  `.schemaVersion`) that `parse.mjs` stamps after tree
  construction. Consumers: the `eval` reflective operand feeds
  an AST-Map through this converter and then into `evalAst`.

### `primitives.mjs` — the built-in primitive registry

Canonical bridge between `lib/qlang/core.qlang`-authored
descriptor Maps and the executable JS impls in `runtime/*.mjs`.
Lives at the `src/` root (not under `src/runtime/`) because both
the core evaluator (`src/eval.mjs::applyBuiltinDescriptor`) and
every runtime impl module consume it, and a `src/runtime/`
placement would force downward imports across the core/runtime
layering boundary.

- `createPrimitiveRegistry()` — factory producing an isolated
  registry instance with `.bind` / `.resolve` / `.has` / `.seal`
  methods plus `.isSealed` / `.size` accessors. Test code uses
  this for deterministic per-case state; embedders spawning
  sandboxed evaluation contexts can bind primitives into a
  restricted instance to narrow the reachable surface.
- `PRIMITIVE_REGISTRY` — the production singleton bound by every
  `runtime/*.mjs` module at import time under namespaced
  `:qlang/prim/<name>` keys (`add`, `filter`, `let`, `parse`,
  and so on — 69 total). `evalOperandCall` resolves an
  `:qlang/impl` handle through `PRIMITIVE_REGISTRY.resolve` at
  every built-in dispatch.

Per-site invariant errors cover the three bind-time failure
modes: `PrimitiveKeyNotKeyword` (non-keyword handle),
`PrimitiveKeyAlreadyBound` (duplicate registration from two
modules claiming the same name), `PrimitiveRegistrySealed`
(late registration after bootstrap closes the registry). The
sole dispatch-time data error is `PrimitiveKeyUnbound`, which
extends `QlangError` (not `QlangInvariantError`) so a
hand-crafted descriptor Map with a bad `:qlang/impl` handle
lifts to an error value on the fail-track rather than crashing
the evaluator.

### `session.mjs` — REPL / notebook session lifecycle

Persistent `(env, cellHistory)` pair across multiple `evalCell`
invocations.

- `createSession(opts?)` — fresh session seeded with `langRuntime`.
- `session.evalCell(source, opts?)` — parse + evaluate one cell.
- `session.cellHistory` — read-only array of executed cells.
- `session.bind(name, value)` — install a binding directly into env.
- `session.takeSnapshot()` / `session.restoreSnapshot(snap)` —
  cheap save/restore for "step back" features.
- `serializeSession(session)` — JSON-serializable payload of user
  bindings (conduits via stored body source, snapshots via tagged
  JSON, raw values via tagged JSON) plus cell history.
- `deserializeSession(json)` — rebuilds a session from a serialized
  payload. Cell history is restored without re-evaluation.

### `codec.mjs` — tagged-JSON value codec

Canonical encoder/decoder pair for qlang runtime values across
JSON boundaries (HTTP, postMessage, IndexedDB, files).

| qlang value | tagged JSON form |
|---|---|
| number / string / boolean | itself |
| null | `null` |
| Vec | JSON array of recursively-encoded elements |
| keyword | `{ "$keyword": "name" }` |
| Map | `{ "$map": [[k, v], ...] }` (entry pairs, recursively encoded) |
| Set | `{ "$set": [v1, v2, ...] }` |
| Error | `{ "$error": <recursively-encoded descriptor Map> }` |

`toTaggedJSON(value)` throws `TaggedJSONUnencodableValueError` for
function values, conduits, and snapshots.
`fromTaggedJSON(json)` throws `MalformedTaggedJSONError` on
unrecognized tagged objects.

### `effect.mjs` and `effect-check.mjs` — @-effect markers

`effect.mjs` owns the `@`-prefix surface convention:

- `EFFECT_MARKER_PREFIX` — the literal `'@'` character.
- `classifyEffect(name) → boolean` — true iff the name carries the
  marker. The precomputed result is cached on `.effectful` fields.

`effect-check.mjs` provides AST decoration:

- `decorateAstWithEffectMarkers(ast)` — stamps `.effectful` on every
  OperandCall and Projection node. Run automatically by `parse()`.
- `findFirstEffectfulIdentifier(node)` — returns the first effectful
  identifier in a subtree, used by the `let` operand for eval-time
  effect validation.

The runtime call-site safety net lives in `eval.mjs::evalOperandCall`:
when an identifier resolves to an effectful function value but the
lookup name is clean, the call is refused with `EffectLaunderingAtCall`.

### Public entry point — `src/index.mjs`

```js
import {
  parse, evalAst, evalQuery, langRuntime,
  createSession, serializeSession, deserializeSession,
  walkAst, astChildrenOf, findAstNodeAtOffset,
  findIdentifierOccurrences, bindingNamesVisibleAt,
  astNodeSpan, astNodeContainsOffset, triviaBetweenAstNodes,
  toTaggedJSON, fromTaggedJSON,
  QlangError, QlangTypeError, ParseError,
  EffectLaunderingError,
  classifyEffect, EFFECT_MARKER_PREFIX
} from '@kaluchi/qlang';
```
