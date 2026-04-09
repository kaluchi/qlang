# Query Language Model

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
  Any of Scalar, Vec, Map, Set, or a function (partial or complete).
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
none of the worked examples needs one. The combinators (`|`, `*`,
`>>`) and fork boundaries (`()`, `[]`, `{}`, `#{}`) transform the
pair implicitly — that transformation is the semantics of the
language, described in meta-notation for clarity, not reified as a
user-visible object.

## Step types

Six kinds of steps. Every syntactic form in the language reduces
to one of them. `use`, `env`, `reify`, and `manifest` are not step
types — they are ordinary identifiers (Step 3) that happen to
resolve to reflective built-ins in the language runtime.

### 1. Literal

A literal value: Scalar (`42`, `"hello"`, `nil`, `:keyword`), Vec,
Map, or Set.

    (pipeValue, env) → (evalLiteral, env)

For compound literals with expression elements (e.g., `[/name, /age]`,
`{:greeting /name}`, `#{/tag}`), each element or value is evaluated as
a sub-pipeline in a **fork** of `(pipeValue, env)` — see Fork below.

### 2. Projection — `/key`

    (pipeValue, env) → (pipeValue[:key], env)     pipeValue must be a Map

If `:key` is absent from the Map, the result is `nil`. If
`pipeValue` is not a Map (Scalar, Vec, Set, nil, or a function),
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
They differ only in what was written to `env[:name]`, never in
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

    env | keys         -- set of identifiers currently in scope
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

  - `:builtin` — a frozen function value from `langRuntime`. The
    descriptor copies `fn.meta` fields: `:name`, `:arity`,
    `:category`, `:subject`, `:modifiers`, `:returns`, `:docs`
    (Vec), `:examples`, `:throws`.
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

### `|` — sequential application

    (pipeValue, env) | nextStep
        ≡
    run nextStep starting from (pipeValue, env)

Left-to-right state threading.

### `*` — distribute

    (pipeValue, env) * body

Requires `pipeValue` to be a Vec. For each element `item`:

1. **Fork** to `(item, env)`
2. Run `body` as a sub-pipeline
3. Take the resulting `nextPipeValue` from the fork

Collect all results into a new Vec. Final state:
`(collectedVec, env)` with original `env` preserved. Each iteration's
modifications to `env` are discarded when its fork closes.

If `pipeValue` is not a Vec, the step raises a **type error**. The
empty Vec is a valid input: `[] * body → []` without invoking
`body`. This is what lets recursive definitions terminate over
finite data structures.

### `>>` — flatten then apply

    (pipeValue, env) >> nextStep
        ≡
    (flat(pipeValue), env) | nextStep

`pipeValue` must be a Vec. `flat` removes one level of nesting; it
is a no-op on flat Vecs (elements that are not themselves Vecs pass
through unchanged). If `pipeValue` is not a Vec, the step raises a
**type error**.

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

(A simpler host might choose `pipeValue = nil` instead of
`langRuntime`. This is NOT equivalent to the conceptual model for
queries whose first step is a function lookup, because Step 3 would
pass `nil` as the subject. Implementations should document which
variant they use; the reference evaluator uses `pipeValue =
langRuntime` to match the conceptual model exactly.)

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
| Scalar/Vec/Map/Set literal          | Step 1 — literal                      |
| `/key` projection (possibly nested) | Step 2 — projection                   |
| Identifier (any name, including `@`-prefixed) | Step 3 — env lookup         |
| `op(arg₁..argₖ)` operand call       | Step 3 — env lookup + Rule 10         |
| `as(:name)` operand call            | Step 3 — identifier lookup + snapshot capture |
| `let(:name, expr)` operand call     | Step 3 — identifier lookup + conduit construction |
| `\|~\|`, `\|~ ~\|`                   | Step 6 — plain comment (identity)     |
| `\|~~\|`, `\|~~ ~~\|`                | Step 6 — doc comment (identity + attach) |
| `use`, `env`, `reify`, `manifest`   | Step 3 — reflective built-in          |
| `\|`, `*`, `>>`                     | Combinators                           |
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
      * (as employee | {:key /id :record employee})

For element 1 = `{:id 1 :name "Alice"}`:

1. Fork with (element 1, outer `env`).
   `pipeValue = {:id 1 :name "Alice"}`.
2. `(as employee | {:key /id :record employee})` — paren fork.
   - `as employee` — `env[:employee] = {:id 1 :name "Alice"}`.
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
4. `as passingScores` — `env[:passingScores] = [85 92 78 95]`.
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

## Tooling primitives

Modules that the operand library never imports but that embedders
(editors, notebooks, REPLs, language servers) consume directly.
Re-exported from the package entry.

### `walk.mjs` — AST traversal primitives

Single source of truth for the qlang AST shape.

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
| nil | `null` |
| Vec | JSON array of recursively-encoded elements |
| keyword | `{ "$keyword": "name" }` |
| Map | `{ "$map": [[k, v], ...] }` (entry pairs, recursively encoded) |
| Set | `{ "$set": [v1, v2, ...] }` |

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
