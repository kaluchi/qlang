# Query Language Specification

Expression language for transforming immutable values through
pipelines. Domain-agnostic — defines values, combinators, and the
pipeline step types. A domain extends it by merging a runtime Map
of functions into the evaluation environment via `use`.

A query is a pure function of state. State is a pair
`(pipeValue, env)` threaded through pipeline steps: `pipeValue` is
the current value flowing through, `env` is the environment Map
containing all bindings in scope (built-in operands,
domain functions, user `let` and `as` bindings). Identifier lookup
reads from `env`; `as` and `let` write to `env`; `use` merges a
Map into `env`.

For the full formal evaluation model, see
[qlang-internals.md](qlang-internals.md). For the catalog
of built-in operands, see
[qlang-operands.md](qlang-operands.md).

## Values

Five types. Immutable. Arbitrarily nestable.

### Scalar

Atomic values.

| Literal | Examples |
|---|---|
| string | `"hello"`, `""` |
| number | `42`, `3.14`, `-1` |
| boolean | `true`, `false` |
| nil | `nil` |
| keyword | `:name`, `:status`, `:"foo bar"`, `:"123"`, `:""` |

Keywords are symbolic identifiers, self-evaluating:
`:name` always equals `:name`. Primary use — Map keys.

A keyword has three surface forms:

- `:ident` — bare form, identifier restricted to `[@_a-zA-Z][a-zA-Z0-9_-]*`.
- `:ident/ident/...` — namespaced form, slash-separated identifiers
  parsed as a single keyword. `:qlang/error` interns as
  `keyword("qlang/error")`. Used for module namespace identifiers
  and hierarchical grouping.
- `:"any string"` — quoted form, lifts the identifier restriction so any
  string is admissible: leading digits (`:"123"`), embedded spaces
  (`:"foo bar"`), sigils (`:"$ref"`), and the empty string (`:""`).
  The full string-literal escape set (`\n`, `\t`, `\r`, `\"`, `\\`)
  is honoured inside the quotes.

All forms intern to the same value: `:"name"` is identical to
`:name`. The quoted form completes the JSON interop guarantee — every
JSON object key has a qlang literal representation, so any JSON value
can round-trip through Vec/Map/keyword/scalar primitives losslessly.

### Vec

Ordered, indexed, finite sequence of values.
Each element is a sub-pipeline evaluated against the current
`pipeValue`. For literals, `pipeValue` is irrelevant — the literal
self-evaluates.

```qlang
> [1 2 3]
[1 2 3]

> ["a" "b" "c"]
["a" "b" "c"]

> [[1 2] [3 4]]
[[1 2] [3 4]]

> [{:x 1} {:x 2}]
[{:x 1} {:x 2}]

> []
[]
```

Not type-constrained: `[1 "two" nil {:x 3}]` is valid.

When a Vec literal is used as a pipeline step, each element
expression runs against the current `pipeValue` — this is fan-out:

```qlang
> 10 | [add(1), mul(2), sub(3)]
[11 20 7]

> {:name "alice" :age 30} | [/name, /age]
["alice" 30]
```

Literals ignore input, projections/operands consume it.
Both are the same construct — no separate "branch" syntax.

### Map

Key-value associations. Insertion-ordered. Keys are keywords.
Each value is a sub-pipeline evaluated against the current
`pipeValue`. For literals, `pipeValue` is irrelevant — same as Vec.

```qlang
> {:name "alice" :age 30}
{:name "alice" :age 30}

> {:point {:x 0 :y 0} :items [1 2 3]}
{:point {:x 0 :y 0} :items [1 2 3]}

> {}
{}
```

Every entry is an explicit key-value pair. No shorthand.

Duplicate keys — last wins: `{:a 1 :a 2}` → `{:a 2}`.

When used after `|`, value expressions receive the current
`pipeValue` — this is reshape:

```qlang
> {:name "alice" :age 30 :x 5} | {:name /name :doubled /x | mul(2)}
{:name "alice" :doubled 10}
```

### Set

Unordered collection of unique values. Literal `#{}`.

```qlang
> #{:name :age :id}
#{:name :age :id}

> #{1 2 3 2 1}
#{1 2 3}

> #{}
#{}
```

Primary use — key sets (record shape), membership tests.

```qlang
> {:name "alice" :age 30} | keys
#{:name :age}

> #{:a :b :c} | has(:b)
true
```

Elements of a Set literal are sub-pipelines evaluated against the
current `pipeValue` — same as Vec:

```qlang
> {:name "alice" :age 30} | #{/name, /age}
#{"alice" 30}

|~| equivalent via | vals | set
> {:name "alice" :age 30} | vals | set
#{"alice" 30}
```

### Error

Error value — the fifth type. Literal `!{}`. Same entry syntax as
Map (keyword keys, pipeline values), but wraps the result as an
opaque error value that rides the fail-track.

```qlang
> !{:kind :oops :message "boom"}
!{:kind :oops :message "boom"}

> !{}
!{}
```

qlang has two execution tracks — **success-track** and **fail-track**
— and the combinator at each call site decides which track fires
its step. `|`, `*`, and `>>` are success-track combinators; on an
error pipeValue they **deflect**, appending the upcoming step's
AST node to the error's `:trail` Vec and letting the error flow
downstream unchanged. `!|` is the fail-track combinator; on an
error pipeValue it **fires**, exposing the error's *materialized
descriptor* (the descriptor Map with `:trail` combined from any
existing entries plus the deflections recorded since the last
materialization) to its step. On a success pipeValue `!|` deflects
as identity pass-through.

```qlang
> !{:kind :oops} | count | add(1) !| /trail
["count" "add(1)"]
```

The `error` operand lifts a Map into an error value — `map | error`
bare form or `error(map)` full form. The `isError` operand is a
plain predicate over pipeValue; because `|` deflects errors before
it could fire, `isError` is used primarily at raw first-step
positions inside predicate lambdas of higher-order operands.

```qlang
> error({:kind :oops}) !| /kind
:oops

> 42 | isError
false

> [!{:kind :oops}] * isError | first
true
```

Runtime type errors, arity errors, and other recoverable failures
lift automatically into error values with structured descriptors:

```qlang
> "hello" | add(1) !| /thrown
:AddLeftNotNumber

> "hello" | add(1) !| /origin
:qlang/eval
```

## Expressions

Evaluation is **eager** and left-to-right. Each step fully
computes before the next begins. No lazy sequences, no
deferred evaluation. A Vec is always fully materialized.

### Truthiness

`nil` and `false` are falsy. Everything else is truthy —
including `0`, `""`, `[]`, `{}`, `#{}`.

```qlang
> [0 "" nil false true 1 "a"] | filter(not)
[nil false]
```

### Pipeline

`|` — the sole application operator. Applies the right side
to the left side's result. Left-to-right evaluation.
Nothing executes without `|` (or `*`, `>>`).

```qlang
> [5 3 1 4 2] | sort
[1 2 3 4 5]

> [1 2 3 4 5] | count
5

> {:name "alice" :age 30} | /name
"alice"

> [1 2 3 4 5] | filter(gt(3)) | count
2
```

### Projection

`/key` — extract value from Map. Missing key → nil.

```qlang
> {:name "alice" :age 30} | /name
"alice"

> {:name "alice"} | /missing
nil
```

Each segment can be either a bare ident (`/name`) or a quoted-string
form (`/"any text"`). The quoted form admits arbitrary JSON keys —
embedded spaces, leading digits, sigils, and the empty string — so
any JSON value reachable by JSONPath is reachable by qlang projection.

```qlang
> {:"foo bar" 42} | /"foo bar"
42

> {:"$ref" "x"} | /"$ref"
"x"

> {:"a.b" {:"$ref" 99}} | /"a.b"/"$ref"
99
```

Both forms can be mixed inside a single projection chain:
`/outer/"inner key"/age`.

A third form, keyword projection, prefixes a segment with `:` to
project by a namespaced keyword. The `:` signals that subsequent
`/` separators are part of the name, not new segments. A new
segment starts at the next `/:` or when the projection ends.

```qlang
> {:"foo bar" 42} | /"foo bar"
42

> {:qlang/error 42} | /:qlang/error
42

> {:qlang/error {:retry 42}} | /:qlang/error/:retry
42
```

- `/name` — bare segment, projects by keyword `:name`
- `/:name` — keyword segment, same result (`:` redundant for simple names)
- `/:qlang/error` — keyword segment, projects by namespaced keyword `:qlang/error`
- `/qlang/error` — two bare segments: `/qlang` then `/error` (nested projection)

Nested: `/a/b` desugars to `/a | /b`.

```qlang
> {:geo {:lat 51.5 :lon -0.1}} | /geo/lat
51.5

|~| equivalent:
> {:geo {:lat 51.5 :lon -0.1}} | /geo | /lat
51.5

> {:a {:b {:c 42}}} | /a/b/c
42
```

### Distribute

`*` — map expression over each Vec element.

```qlang
> [1 2 3] * add(10)
[11 12 13]

> [{:name "a" :x 1} {:name "b" :x 2}] * /name
["a" "b"]

> [{:name "a" :x 1} {:name "b" :x 2}] * /x
[1 2]
```

`|` applies to the whole. `*` applies to each:

```qlang
> [1 2 3] | count
3

> [1 2 3] * add(1)
[2 3 4]
```

### Reshape

`{:key expr}` — construct Map from current value.
Every entry is explicit: key and value expression.

```qlang
> {:name "a" :x 3} | {:name /name :doubled /x | mul(2)}
{:name "a" :doubled 6}
```

After `*` — reshape each Vec element:

```qlang
> [{:name "a" :x 3} {:name "b" :x 7}]
  * {:name /name :doubled /x | mul(2)}
[{:name "a" :doubled 6} {:name "b" :doubled 14}]
```

### Set operations

`union`, `minus`, `inter` — polymorphic operands on `Vec`.
Input is a Vec of Sets or Maps. Left-fold.

**Set × Set:**

```qlang
> [#{:a :b :c}, #{:b :d}] | union  → #{:a :b :c :d}
> [#{:a :b :c}, #{:b :d}] | minus  → #{:a :c}
> [#{:a :b :c}, #{:b :d}] | inter  → #{:b}
```

**Map × Map:**

```qlang
> [{:name "a" :age 20}, {:score 100}] | union
{:name "a" :age 20 :score 100}

> [{:a 1 :b 2 :c 3}, {:b 99 :d 5}] | minus
{:a 1 :c 3}
|~| removes keys present in second map; values of second ignored

> [{:a 1 :b 2 :c 3}, {:b 99 :d 5}] | inter
{:b 2}
|~| keeps keys present in both; values from first map
```

**Map × Set** — field operations (Set = which keys):

```qlang
> [{:name "a" :age 20 :tmp 1}, #{:tmp}] | minus
{:name "a" :age 20}

> [{:name "a" :age 20 :tmp 1}, #{:name :age}] | inter
{:name "a" :age 20}
```

Fan-out with `as` for enrichment:

```qlang
|~| as r captures the current value, passes it forward
|~| [r, {...}] builds Vec from captured value + computed delta
|~| union merges them

record | as(:r) | [r, {:adult /age | gt(18)}] | union
record | as(:r) | [r, #{:tmp}] | minus
record | as(:r) | [r, #{:name :age}] | inter
```

See [Value binding](#value-binding) for full `as` semantics.

### Merge

`>>` — flatten one nesting level, then apply next step.

```qlang
> [1 2 3 4 5] | [filter(gt(3)), filter(lt(2))] >> count
3

> [[1 2] [3] [4 5]] >> count
5

> [[3 1] [2 4]] >> sort
[1 2 3 4]
```

`>>` = `| flat |`. Sugar for merge-then-proceed.

### Value binding

`as(:name)` — pipeline operand that captures the current value
under a keyword name. The value passes through unchanged; the
name becomes available to all subsequent steps (see scoping
rules below).

```qlang
order | normalize | as(:cleanOrder) | computeTax | as(:taxedOrder) | shipQuote | finalize
|~| after normalize → cleanOrder = the cleaned order map
|~| after computeTax → taxedOrder = the taxed map
```

`cleanOrder` and `taxedOrder` are frozen snapshots. All values are
immutable — a captured binding is safe to reference at any later
point in the same scope.

Multiple `as` calls can appear in sequence, binding either the same
value under different names or different values at different
stages:

```qlang
purchase | normalize | as(:initial) | applyDiscounts | as(:discounted) | [initial, discounted]
|~| initial    = the normalized purchase
|~| discounted = the same purchase after discounts applied
```

```qlang
> {:name "a" :age 20 :tmp 1}
  | as(:r) | [r, #{:tmp}] | minus
{:name "a" :age 20}

> {:name "a" :age 20}
  | as(:r) | [r, {:adult /age | gt(18)}] | union
{:name "a" :age 20 :adult true}
```

Multi-step references:

```qlang
> [{:name "a" :age 25} 
   {:name "b" :age 15} 
   {:name "c" :age 30}]
  | as(:people)
  | filter(/age | gte(18))
  | as(:adults)
  | {:total people | count
     :adult adults | count}
{:total 3 :adult 2}
```

Difference from `let`:
- `let(:name, expr)` — captures the **expression** as a conduit.
  Each reference evaluates `expr` in a lexically-scoped fork.
- `as(:name)` — captures the **value** of `pipeValue` at the point
  where the operand executes. Frozen — same value every reference.

Both mechanisms write to the same `env[:name]` slot, so the usual
last-write-wins rule applies. In typical query order — runtime
loaded first, then user `let`, then `as` captures during pipeline
execution — this manifests as `as` > `let` > built-in.

Scoping rules:

All seven rules below follow from a single principle: **nested
expressions `(...)`, `[...]`, `{...}`, `#{...}` open a fork** — a
sub-pipeline that starts with a copy of the outer state. When the
fork closes, its final `pipeValue` propagates out but its env
changes are discarded. See the
[model's Fork section](qlang-internals.md#fork) for details.

1. **Lexical, left-to-right.** `as name` is visible in all
   subsequent steps of the same pipeline, and in any nested
   expression evaluated by those steps.

2. **Nested pipelines inherit outer bindings.** Inside `()`,
   `[]`, `{}`, `#{}`, all `as`-bindings from the enclosing
   scope are visible.

   ```qlang
   employees | as(:roster) * {:name /name :teamSize roster | count}
   |~| roster captured before the distribute;
   |~| inside each iteration's reshape, roster is visible
   |~| (every element receives the same :teamSize)
   ```

3. **Nested pipelines do not leak outward.** A binding created
   inside `(...)`, `[...]`, `{...}`, `#{...}` is local to that
   inner scope and invisible after it closes.

   ```qlang
   candidates | filter(/peerRating | as(:peerScore) | /selfRating | gte(peerScore))
   |~| peerScore is local to the filter predicate;
   |~| it is not visible after filter(...) returns
   ```

4. **Each distribute iteration is its own scope.** In `xs * body`,
   each element's body gets a fresh scope. Bindings created in
   one iteration are invisible in others. Outer bindings from
   before the `*` are still visible in every iteration.

5. **Sibling expressions are independent.** In `{:a e1 :b e2}`,
   bindings from `e1` are NOT visible in `e2`. Same for Vec
   elements `[a, b, c]` and Set elements `#{a, b, c}` — each
   entry is its own sub-pipeline, parallel not sequential.

6. **Shadowing.** A later `as name` in the same scope replaces
   the earlier one for subsequent uses.

7. **Resolution order**: last-write-wins in `env`. Under typical
   pipeline order (runtime loaded first, then user `let`, then
   `as` captures during execution), this manifests as
   `as` > `let` > built-in.

### Binding and application

Two operations in the language. Nothing else.

**`()`** — binding. Takes a function and arguments, returns
a new function with those arguments fixed. Never executes.
Never produces a final value. Only constructs a function.

**`|`** — application. Takes a value and a function, applies
the function to the value. The only operator that executes.

(`*` and `>>` are also application — `*` applies per element,
`>>` flattens then applies. Same mechanism, different strategy.)

```qlang
gt              |~| function, two inputs needed: (value, threshold)
                |~| subject at position 1, modifier at position 2
gt(10)          |~| binding: fix threshold=10 (trailing)
                |~| → new function awaiting value (from pipeValue)
                |~| nothing executed

filter          |~| function, two inputs needed: (vec, predicate)
                |~| subject at position 1, modifier at position 2
filter(gt(10))  |~| binding: fix predicate (trailing)
                |~| → new function awaiting vec (from pipeValue)
                |~| still nothing executed

[1 2 3 4 5] | filter(gt(10))
             ^
             application — executes now
             result: [...]
```

Zero-arg functions need no binding — already complete:

```qlang
count           |~| function, one input needed: (vec)
[1 2 3] | count |~| application: 3
                |~| no () — count is already complete

sort            |~| function, one input: (vec), natural order
sort(/name)     |~| binding: fix key → new function (vec)
                |~| sort without () = complete
                |~| sort with () = new function via binding
```

Expressions inside `()` are **captured, not evaluated**.
When the bound function is applied via `|`, the argument
evaluates against the current `pipeValue`:

```qlang
filter(/age | gt(18))
       ^^^^^^^^^^^^^
       captured pipeline:
       /age | gt(18) = project :age, then apply gt(18)
       result: a predicate function
       filter captures it → new function, waiting for |

> [{:name "a" :age 25} {:name "b" :age 15} {:name "c" :age 30}]
  | filter(/age | gt(18))
[{:name "a" :age 25} {:name "c" :age 30}]
```

Arity determines whether `pipeValue` fills a position:

```qlang
100 | mul(2)            |~| partial: 1 of 2 args captured
                        |~| pipeValue = first arg (100)
                        |~| captured = second arg (2)
                        |~| result: 200

mul(/price, /qty)       |~| full: 2 of 2 args captured
                        |~| pipeValue = context for resolving args
                        |~| /price → 100, /qty → 3
                        |~| result: 300
```

Partial application: `pipeValue` fills the first position.
Captured args evaluate against the same `pipeValue`.
If the `pipeValue` type doesn't match the operand's expectation
→ type error:

```qlang
[1 2 3] | add(1)        |~| partial: Vec fills first arg
                        |~| add expects number → type error
                        |~| fix: use * for element-wise

> [1 2 3] * add(1)
[2 3 4]
```

Full application in reshape (cross-field operations):

```qlang
> [{:name "a" :price 100 :qty 3}
   {:name "b" :price 50 :qty 10}]
  * {:name /name :total mul(/price, /qty)}
[{:name "a" :total 300} {:name "b" :total 500}]
```

## Operands

Built-in functions. Zero-arg — complete, used bare. With args —
require `()` binding before `|` can apply.

The full catalog of built-in operands (signatures, behavior,
examples, error conditions) lives in
[qlang-operands.md](qlang-operands.md). The runtime
document is the reference for "what can I do with a value of type
X" — this section only establishes that the language has such a
catalog and that it is composable via the pipeline rules described
above.

The full catalog of 67 operands with signatures, examples, and
error conditions lives in
[qlang-operands.md](qlang-operands.md#summary-unique-operand-names-by-category).

All operand signatures follow the **subject-first convention**:
position 1 is the data being operated on (filled by the pipeline in
partial application), positions 2..n are modifiers (filled by
captured arguments).

## Conduits — named pipeline fragments

`let name = expr` and `let name(p1, ..., pN) = expr` — pipeline
steps that write a **conduit** into `env`. A conduit is a named,
lexically-scoped pipeline fragment with zero or more parameters.
`pipeValue` is unchanged by the declaration itself.

The two forms are a single mechanism with different arity:

- `let double = mul(2)` — zero-arity conduit, no parameters.
- `let surround(pfx, sfx) = (prepend(pfx) | append(sfx))` —
  two-arity conduit, two parameters.
- `let f() = body` — equivalent to `let f = body` (principle of
  least astonishment: empty parens = no params).

Multi-step bodies must be wrapped in parentheses so the `|` inside
does not bleed into the outer pipeline.

### Invocation

A conduit is invoked like any operand: `value | double`,
`"world" | surround("[", "]")`. At the call site:

1. Captured-arg expressions become lazy lambdas (not eagerly fired).
2. Each lambda is wrapped in a **conduit-parameter** — a nullary
   function value that fires the lambda against whatever `pipeValue`
   exists at the lookup site inside the body.
3. The body runs in a fork with a **lexical env** (the env frozen at
   declaration time, plus the conduit-parameter bindings layered on
   top). Body's `let`/`as` writes are local to the fork.
4. The body's final `pipeValue` propagates out; the outer `env` is
   preserved unchanged.

### Lexical scope and fractal composition

Conduits use **lexical scope** — the body sees the env that existed
at declaration time (including itself for recursion via tie-the-knot),
not the caller's env. This is the foundation of **fractal
composition**: nested conduits compose predictably because each
level's scope is anchored at its own declaration point. Later
shadowing in the caller's scope does not affect a conduit's body.

```qlang
> let(:@topBy, [:keyFn, :n], sortWith(desc(keyFn)) | take(n))
  | let(:@topNByV, [:n], @topBy(/v, n))
  | let(:@top2ByV, @topNByV(2))
  | [{:v 10} {:v 30} {:v 20}] | @top2ByV * /v
[30 20]
```

Three levels of conduit, each building on the previous via
zero-arity conduit alias and parametric forwarding (re-declaration
with a subset of params). This is how partial application is
achieved — explicitly through composition, not through auto-curry.

### Higher-order parameters

Parameters are lazy: the captured-arg expression stays unevaluated
until the parameter name is looked up inside the body. This enables
higher-order composition — a parameter can be a pipeline fragment
that fires per-element inside `sortWith`, per-iteration inside
`filter`, per-pair inside `desc`/`asc`:

```qlang
> let(:@topBy, [:keyFn, :n], sortWith(desc(keyFn)) | take(n))
  | [{:score 1} {:score 3} {:score 2}] | @topBy(/score, 2) * /score
[3 2]
```

`keyFn` is not a frozen value — it is a conduit-parameter that
evaluates `/score` against each element when `desc` invokes it
per comparison pair.

### Examples

```qlang
> let(:double, mul(2))
  | [1 2 3] * double
[2 4 6]

> let(:@surround, [:pfx, :sfx], prepend(pfx) | append(sfx))
  | "world" | @surround("[", "]")
"[world]"

> [{:name "Alice" :age 25} {:name "Bob" :age 16} {:name "Carol" :age 40}]
  | let(:votingAge, filter(/age | gte(18)))
  | let(:nameAndAge, {:name /name :age /age})
  | votingAge * nameAndAge
[{:name "Alice" :age 25} {:name "Carol" :age 40}]
```

### Recursion via self-reference

```qlang
| let(:walk, {:label /label :children /children * walk})
| {:label "root" :children [
    {:label "a" :children []}
    {:label "b" :children [
      {:label "c" :children []}]}]}
| walk
```

Recursion works because the conduit's lexical env includes itself
(tie-the-knot at declaration time). Termination on finite trees
comes from `[] * walk → []` at leaves.

Recursive parametric conduits work the same way:

```qlang
| let(:@treeMap, [:fn], {:label (/label | fn) :children /children * @treeMap(fn)})
```

See [qlang-internals.md](qlang-internals.md#example-6-recursive-let)
for additional recursive patterns (aggregation, flattening,
transformation).

### Resolution order and shadowing

Resolution order: `let`-bindings shadow built-in operands, because
`let` writes to the same `env[:name]` as the built-ins — last write
wins. `let(:count, 5)` makes subsequent `count` references resolve
to `5`. Within that pipeline the built-in `count` is inaccessible
until a later step shadows `count` again.

## Runtime composition and bootstrap

The `env` is **one Map** containing everything in scope: built-in
operands, domain functions provided by the host, `let`-bindings,
and `as`-bindings. There is no separate "environment" abstraction
distinct from the operand table — the language runtime, domain
runtime, and user bindings are all fields of the same Map.

### Bootstrap

Conceptually, a query starts from `(pipeValue = langRuntime, env = {})`,
and the first step is an implicit `use` that installs the runtime:

```qlang
langRuntime | use
  | domainRuntime | use
  | replEnv | use
  | <query body>
```

In practice, the host provides the initial state with the language
runtime already merged into `env`, so the explicit prefix is
omitted. Both variants deliver control to the query body with the
same `env`. See the
[model](qlang-internals.md#bootstrap) for details.

### Runtime composition

Additional runtimes are loaded anywhere in a query by merging a
Map into `env`:

```qlang
|~| import host-provided stats library
statsLibrary | use | data | mean

|~| import constants and use them
{:pi 3.14159 :e 2.71828} | use | [pi, e]
```

`use` takes a Map as its subject and adds each `:key value` as a
binding. Conflicts resolve by "incoming wins" — later writes
override earlier ones. This is how domain runtimes stack on top of
the language runtime, and how users extend the namespace mid-query
with constants or host-provided functions.

For in-query **function** extension, use `let`. The body of a `let`
is a single Primary (literal, projection, operand call, paren-group,
or compound literal) — multi-step bodies must be wrapped in
parentheses so the `|` inside does not bleed into the outer
pipeline:

```qlang
| let(:double, mul(2))
| let(:isSenior, /age | gt(65))
| employees * {:doubledAge /age | double :senior isSenior}
```

`use` imports pre-built Maps whose values are the bindings you want.
It cannot be used to install new functions defined in-query, because
Map literal values evaluate their expressions eagerly rather than
producing function objects. Use `let` for that case.

### Identifier conventions

Identifiers may start with `@`, `_`, or a letter. The language gives
no special meaning to `@` or `_`. Domain authors commonly use `@` as
a prefix for names that come from their runtime (e.g., `@callers`,
`@resolve`), and `_` for private internal bindings, but this is
pure convention — `@callers` and `callers` are resolved identically,
and either may be shadowed by an `as` or `let` binding.

### Three name mechanisms

- `let(:name, expr)` — lexically-scoped conduit. Body evaluates in a
  fork anchored to the declaration-time env via envRef tie-the-knot.
- `as(:name)` — eager snapshot of the current `pipeValue`. Frozen —
  the same value every reference.
- `use` — merges a Map into `env`, installing each of its keys as a
  binding simultaneously.

Resolution order is simply "last write wins in `env`". Under typical
query structure this gives `as` > `let` > built-in, because bindings
are written to `env` in that temporal order.

## Comments

Comments are **first-class pipeline steps with identity semantics**:
they appear in the AST as dedicated node types (`LinePlainComment`,
`BlockPlainComment`, `LineDocComment`, `BlockDocComment`), consume the
state pair unchanged (`(pipeValue, env) → (pipeValue, env)`), and
participate in the pipeline metamodel the same way any other step does.
There is no separate lexical-skip category — every comment is visible
to the evaluator, to reflection, and to source-manipulation tooling.
Plain forms (line and block) evaluate as standalone identity steps;
doc forms (line and block) are consumed by the parser as a `docs` Vec
metadata prefix on the immediately following binding step, and their
AST nodes are folded into that binding node at parse time.

Four forms cover two orthogonal axes: **line vs block** (content
terminator) and **plain vs doc** (whether the comment attaches as
metadata to the following binding):

| Form          | Role                                                      |
|---------------|-----------------------------------------------------------|
| `\|~\|`        | line plain — content to newline, pure identity            |
| `\|~ ... ~\|`  | block plain — content to `~\|`, multi-line, pure identity |
| `\|~~\|`       | line doc — content to newline, attaches to next step      |
| `\|~~ ... ~~\|`| block doc — content to `~~\|`, multi-line, attaches       |

All four share the same character family `|~` as the opening
declarator. Doubling the tilde promotes plain to doc. The line form
is the **overlap-compressed** form of the corresponding block form:
`|~|` is `|~` + `~|` sharing the middle `~`; `|~~|` is `|~~` + `~~|`
sharing the middle `~~`. Uncompressing expands the line form into
its block counterpart with content in the middle.

### Combinator absorption

Comment tokens absorb adjacent pipeline combinators into their own
delimiters, so comments read cleanly inside an otherwise dense
pipeline without requiring explicit `|` around them. All four forms
behave uniformly: the combinator position immediately before the
comment and the combinator position immediately after it are both
implicit.

- **Block forms** (`|~ ~|`, `|~~ ~~|`) absorb the leading combinator
  through the `|` in the opener and the trailing combinator through
  the `|` in the closer.
- **Line forms** (`|~|`, `|~~|`) absorb the leading combinator
  through the `|` at the start of the token; the trailing combinator
  position is implicit across the newline, so the next step can
  follow directly without any prefix `|`.

At the start of a query, the leading `|` of a comment token is
virtual (no predecessor to connect to).

### Attach-to-next (doc comments)

Doc comments (`|~~|`, `|~~ ~~|`) attach as metadata to the
**immediately following binding step** — that is, the next `let` or
`as`. Doc comments followed by a non-binding step (a bare literal,
operand call, projection, or compound literal) are rejected at parse
time: the retrieval path goes through the binding's name, so docs on
unnamed values have nowhere to live.

Multiple doc comments before the same binding, in any mix of line
and block forms, with any whitespace between them, **accumulate** into
a `docs` field on the binding node. Each comment token produces **one
entry** in the `docs` Vec in the order it appears.

**Plain comments interleaved among the docs do not break the
attachment.** A `|~ ... ~|` or `|~|` between two doc comments (or
between docs and the binding itself) remains a standalone identity
PipeStep in the pipeline, but the docs around it still collect
into the binding's `docs` Vec:

```qlang
|~~| First remark.
|~ formatting separator ~|
|~~| Second remark.
let(:foo, ...)
```

The binding's `docs` Vec holds two entries (`" First remark."`,
`" Second remark."`). The plain block comment appears in the AST
as an identity step immediately before the bound `let`.

The accumulation rule is: *one doc token, one entry*. There is no
concatenation of adjacent line docs — a block doc with internal
newlines becomes one multi-line entry, while two adjacent `|~~|`
lines become two separate entries.

```qlang
|~~| First remark.
|~~| Second remark.
|~~ Block-form remark
    with internal newlines. ~~|
let(:foo, ...)
```

The `let foo` binding's `docs` field holds three entries: two single-
line strings and one multi-line string.

### Retrieval via reify

A binding's docs are retrievable through the reflective `reify`
operand (see [runtime reference](qlang-operands.md#reify)).
`reify` builds a descriptor Map from a function value or conduit;
the descriptor's `:docs` field is a Vec of the accumulated comment
contents in declaration order.

```qlang
env | /foo | reify | /docs
→ ["First remark." "Second remark." "Block-form remark\n    with internal newlines."]
```

### Enrichment via shadowing

Docs are frozen into the conduit at `let` evaluation. To add or remove
remarks after the fact, redeclare the binding with a different set
of doc comments — shadowing writes a new conduit to the same `env[:name]`
slot, and subsequent lookups see the new `docs` Vec. This is the
pipeline-first analogue of "editing": rebind instead of mutate.

### Plain block comments mid-pipeline

Plain block comments (`|~ ... ~|`) are standalone identity PipeSteps.
They are useful for mid-query rationale that is not attached to any
binding:

```qlang
orders | @find | @members
  | filter(/kind | eq(:method))
  | filter(@callers | empty)
  |~ Why @overriddenBy empty as a separate check: Eclipse
     SearchEngine does not count override calls as @callers, and a
     method with empty @callers can still be invoked via polymorphism. ~|
  filter(@overriddenBy | empty)
```

The leading `|` of `|~` is the combinator from the previous filter;
the trailing `|` of `~|` is the combinator to the next filter. Neither
side needs an explicit `|`.

## Evaluation rules

Evaluation threads a **state pair** `(pipeValue, env)` through each
pipeline step. `pipeValue` is the current value flowing through; `env`
is the environment Map (bindings and built-ins). Every step is a pure
function `(pipeValue, env) → (pipeValue', env')`. For the full formal
model — including fork semantics, bootstrap, and Rule 10 details —
see [qlang-internals.md](qlang-internals.md).

Seven step types:

| # | Form | Effect on `(pipeValue, env)` |
|---|---|---|
| 1 | literal (Scalar, Vec, Map, Set, Error) | → `(lit, env)`. Compound literals (`[a,b]`, `{:k v}`, `#{a,b}`, `!{:k v}`) fork per element/entry and evaluate each as a sub-pipeline against the outer state. `!{...}` produces an error value. |
| 2 | `/key` projection | → `(pipeValue[:key], env)`. `nil` if missing. **Type error** if `pipeValue` is not a Map. Nested `/a/b` = `/a \| /b`. |
| 3 | identifier `name` or `name(arg₁..argₖ)` | → lookup `env[:name]`. If function, apply via Rule 10 (see below). If non-function value, replace `pipeValue`. If absent, unresolved-identifier error. Reflective operands `use`, `env`, `reify`, `manifest` resolve through this same path and may read or write the full state. Control-flow operands `if`, `when`, `unless`, `coalesce`, `firstTruthy` also resolve here, evaluating their captured branches lazily so only the selected branch executes. |
| 4 | `as name` | → `(pipeValue, env[:name := Snapshot(pipeValue, docs)])`. Identity on the value; names the current snapshot. Any doc comments immediately preceding the `as` attach to the snapshot. |
| 5 | `let name = expr` / `let name(params) = expr` | → `(pipeValue, env[:name := Conduit(expr, params, envRef, docs)])`. Writes a lexically-scoped conduit. When `name` is later looked up, the conduit's body is evaluated in a fork with the declaration-time env (lexical scope via envRef tie-the-knot) plus conduit-parameter proxies for each captured arg. Recursion works via self-reference in the tied env. Any doc comments immediately preceding the `let` attach to the conduit. |
| 6 | comment (`\|~\|`, `\|~ ~\|`, `\|~~\|`, `\|~~ ~~\|`) | → `(pipeValue, env)`. Pure identity. Plain forms are standalone PipeSteps; doc forms attach as `docs` metadata to the immediately following binding step (`let` or `as`), accumulating as a Vec across multiple doc comments before the same binding. Doc comments must be followed by an OperandCall; preceding any other Primary form, the doc comment fails to match and the grammar falls through to non-doc alternatives. |

Combinators thread state between steps:

| Combinator | Effect |
|---|---|
| `a \| b` | eval `a`, pipe resulting `(pipeValue, env)` into `b` |
| `a * b` | eval `a` (must be Vec). For each element, fork to `(element, env)`, run `b`, collect inner `pipeValue'`. Result is Vec of collected values; outer `env` preserved. |
| `a >> b` | eval `a`, flatten one level, pipe into `b`. Equivalent to `a \| flat \| b`. |

**Fork** opens on entry to `(...)`, `[...]`, `{...}`, `#{...}`.
Inner sub-pipeline starts with a copy of outer `(pipeValue, env)`.
When it finishes, the inner `pipeValue'` becomes the result, but
the inner `env'` is discarded. This one rule produces the seven
scoping rules listed in the Value binding section.

### Rule 10 — operand application

For `op(arg₁..argₖ)` where `op` resolves to a function of arity `n`:

- **Partial** (`k < n`): captured args fill positions `(n-k+1)..n`
  (the trailing slots). `pipeValue` fills positions `1..(n-k)`
  (the leading slots). Captured args are expressions evaluated
  against `pipeValue`.
- **Full** (`k = n`): captured args fill all positions `1..n` in
  order. `pipeValue` becomes the **context** for resolving them;
  no position is filled by `pipeValue`.

All operand signatures follow subject-first: position 1 is the data
(filled by the pipeline in partial form), positions 2..n are
modifiers (filled by captured args).

### Precedence

`|`, `*`, `>>` — left-associative, equal precedence:

```qlang
a | b * c | d >> e = ((((a | b) * c) | d) >> e)
```

`()` scopes sub-expressions:

```qlang
filter(/age | gt(18))
|~| /age | gt(18) is a complete sub-pipeline inside ()
```

### Error conditions

| Condition | Error |
|---|---|
| `/key` on non-Map (Scalar, Vec, Set, nil, function) | type error |
| `* expr` on non-Vec | type error |
| `>> expr` on non-Vec | type error |
| `use` on non-Map | type error |
| Identifier `name` not in `env` | unresolved identifier |
| Captured args applied to a non-function value | type error |
| Too many captured args for operand arity | arity error |
| `union`/`minus`/`inter` on incompatible types | type error |
| `div(0)` | division by zero |
| `sort` on Vec with non-comparable elements | type error |
| `let(:cleanName, …@effectful…)` | effect laundering |
| Identifier resolved to effectful function via clean name | effect laundering |

### Fail-track dispatch

All recoverable runtime failures (type errors, arity errors,
division by zero, unresolved identifiers, effect laundering) lift
into **error values** instead of throwing exceptions. An error
value is the fifth value type, displayed as `!{...}`.

Track dispatch is owned by the combinators:

- **`|`, `*`, `>>`** — success-track combinators. On an error
  `pipeValue` they **deflect**: the upcoming step's AST node is
  appended to the error's trail linked list and the error flows
  downstream unchanged.
- **`!|`** — the fail-track combinator. On an error `pipeValue` it
  **fires**, invoking its step against the error's *materialized
  descriptor* (the descriptor Map with `:trail` combined from any
  existing entries plus the deflections recorded since the last
  materialization). On a success `pipeValue` it deflects as
  identity pass-through.

Every error value carries `:trail` in its descriptor by invariant —
`makeErrorValue` enforces the field at construction time, so hot-
path readers under `!|` read it without defensive fallbacks.

```qlang
> "hello" | add(1) | mul(2) | sub(3) !| /trail
["mul(2)" "sub(3)"]
```

Error descriptor fields for runtime errors:

| Field | Type | Content |
|---|---|---|
| `:origin` | keyword | `:qlang/eval` for runtime, `:host` for foreign, `:user` for user-created |
| `:kind` | keyword | Error category: `:type-error`, `:arity-error`, `:division-by-zero`, `:unresolved-identifier`, `:effect-laundering` |
| `:thrown` | keyword | Per-site class name: `:AddLeftNotNumber`, `:FilterSubjectNotVec`, etc. |
| `:message` | string | Human-readable description |
| `:trail` | Vec | Steps deflected by `\|`, `*`, `>>`; combined with new deflections at each `!\|` materialization |

Additional context fields vary by error site (`:operand`,
`:expectedType`, `:actualType`, `:position`, `:index`, etc.).

Trail continuity across re-lift: when a step under `!|` returns a
Map and a later `| error` re-wraps it, the new error's descriptor
carries the `:trail` Vec the step handed back. Subsequent
deflections accumulate into a fresh `_trailHead` linked list, and
the next `!|` combines both sources again. This is the mechanism
behind MDC-style context enrichment: a fail-track section like
`!| union({:request @requestId}) | error` adds fields to the
descriptor and re-lifts without losing the trail.

## Effect markers

Side-effectful host operands carry the `@` prefix in qlang source.
The convention is enforced one-directionally:

```qlang
let(:foo, @callers)          |~| ERROR: effectful body, clean name
let(:@impl, @callers)        |~| OK
let(:@safe, count)           |~| OK (over-approximation, harmless)
let(:foo, count)             |~| OK (pure body, clean name)
```

A `let` binding whose body references any `@`-prefixed identifier
must itself be `@`-prefixed, so the effect propagates through every
alias and downstream code receives a syntactic signal that forcing
the binding can trigger I/O.

The check enforces propagation at two layers, both reading the
structured `.effectful` boolean computed once by `classifyEffect`:

1. **Eval time** (`src/runtime/intro.mjs::letOperand`).
   When the `let` operand executes, it checks the body AST via
   `findFirstEffectfulIdentifier`: if the binding name is clean but
   the body contains an effectful OperandCall or Projection segment,
   the operand throws `EffectLaunderingAtLetParse` carrying the
   source location of the offending identifier. Both direct calls
   (`@callers`) and projection-based extraction (`env | /@callers`)
   are caught.

2. **Runtime call site** (`src/eval.mjs::evalOperandCall`). When an
   identifier resolves through env to a function value, the call-site
   safety net checks: if the function value carries `.effectful = true`
   but the lookup name does not classify as effectful, the call is
   refused with `EffectLaunderingAtCall`. This catches every
   laundering path the AST scan cannot see — installation through
   `use`, capture through `as`, or programmatic injection via the
   embedding host — because every effectful invocation ultimately
   funnels through identifier lookup.

`as` is exempt from the effect invariant: `@callers | as(:result)`
captures the *call result* (a frozen value), not the function value
itself. The effect already fired by the time `as` runs, so the
snapshot is pure data that downstream pipelines can reference under
any name without re-triggering the host call.

The runtime safety net does still fire on `as` snapshots that wrap
a function value (e.g. `(env | /@callers) | as(:snap) | snap`),
because in that path the captured value is the function reference
and `snap` would invoke it on lookup.

## Lexical structure

### Tokens

| Token | Pattern | Examples |
|---|---|---|
| String | `"` chars `"` | `"hello"`, `""` |
| Number | `-`? digits (`.` digits)? | `42`, `-3.14` |
| Boolean | `true` \| `false` | |
| Nil | `nil` | |
| Keyword | `:` (ident \| namespaced \| quoted-string) | `:name`, `:qlang/error`, `:"foo bar"` |
| Ident | (alpha \| `@` \| `_`) (alnum \| `-` \| `_`)* | `count`, `my-fn`, `@callers`, `_private` |
| Projection | `/` keyseg (`/` keyseg)* | `/name`, `/a/b/c`, `/"foo bar"`, `/"a.b"/"$ref"` |
| KeySeg | quoted-string \| ident | `name`, `"foo bar"` |
| Pipe | `\|` | |
| Star | `*` | |
| Merge | `>>` | |
| LParen | `(` | |
| RParen | `)` | |
| LBrace | `{` | |
| RBrace | `}` | |
| HashBrace | `#{` | |
| BangBrace | `!{` | |
| LBracket | `[` | |
| RBracket | `]` | |
| LinePlainComment | `\|~\|` chars until newline | `\|~\| short note` |
| BlockPlainComment | `\|~` chars (not containing `~\|`) `~\|` | `\|~ rationale ~\|` |
| LineDocComment | `\|~~\|` chars until newline | `\|~~\| doc for next step` |
| BlockDocComment | `\|~~` chars (not containing `~~\|`) `~~\|` | `\|~~ multi-line\n    doc ~~\|` |

Whitespace separates tokens. `,` is optional separator
(whitespace-equivalent, aids readability).

PEG ordered choice disambiguates overlapping comment prefixes:
longer forms match first (`|~~|` before `|~|`, `|~~` before `|~`,
`~~|` before `~|`). A block comment's content cannot contain its
own closer (`~|` for plain, `~~|` for doc) without prematurely
terminating — use the alternate form if you need the other closer
sequence literally in your prose.

### Grammar

```
Query         ← Pipeline

Pipeline      ← DocAttached (Combinator DocAttached / PlainComment)*
DocAttached   ← DocComment* OperandCall / DocComment* RawStep
RawStep       ← Primary
Combinator    ← '|' / '*' / '>>'

PlainComment  ← LinePlainComment / BlockPlainComment
DocComment    ← LineDocComment / BlockDocComment

LinePlainComment  ← '|~|'  [^\n]*
BlockPlainComment ← '|~'   (!'~|' .)*  '~|'
LineDocComment    ← '|~~|' [^\n]*
BlockDocComment   ← '|~~'  (!'~~|' .)* '~~|'

Primary       ← '(' Pipeline ')' / Error / Map / Set / Vec
               / Operand / Projection / Scalar

Error         ← '!{' '}' / '!{' MapBody '}'
Map           ← '{' '}' / '{' MapBody '}'
MapBody       ← MapEntry (','? MapEntry)*
MapEntry      ← Keyword Pipeline

Set           ← '#{' (Pipeline (','? Pipeline)*)? '}'

Vec           ← '[' (Pipeline (','? Pipeline)*)? ']'

Operand       ← Ident ('(' (Pipeline (','? Pipeline)*)? ')')?

Projection    ← '/' KeySeg ('/' KeySeg)*
KeySeg        ← ':' NamespacedName / ':' Ident
               / QuotedKeywordName / Ident

Scalar        ← String / Number / Boolean / Nil / Keyword
Keyword           ← ':' QuotedKeywordName / ':' NamespacedName / ':' Ident
NamespacedName    ← Ident ('/' Ident)+
QuotedKeywordName ← '"' DoubleStringChar* '"'
Ident             ← [@_a-zA-Z] [a-zA-Z0-9_-]*
```

Comment productions are matched before bare combinators in the
ordered-choice sequence, so `|~|`, `|~~|`, `|~`, and `|~~` are
recognized as comment tokens rather than as `|` + following
expression. The leading `|` in each comment token serves
double duty: it absorbs the pipeline combinator that would
otherwise have preceded the next step.

Disambiguation:
- `!{` → Error (same entry syntax as Map)
- `{` `}` → empty Map
- `{` `:` → Map (every entry is `:key expr` pair, no shorthand)
- `#{` → Set
- `[` → Vec (elements evaluated against current `pipeValue`)
- `/:` → keyword projection segment (namespaced key)
- `/ident` → bare projection segment

### Reserved words

```
true false nil
```

`let` and `as` are ordinary identifiers bound to operands in
`langRuntime`. They can be shadowed like any other name.
All other identifiers are resolved at evaluation time against
the current `env`.

## REPL session

Complete examples demonstrating composition. The `|~|` lines
are qlang plain comments labelling the technique each example
demonstrates. The `>` prefix marks a REPL prompt and is not
query syntax.

```qlang
|~| construction
> {:name "alice" :scores [85 92 78 95]}
{:name "alice" :scores [85 92 78 95]}

|~| projection + operand
> {:name "alice" :scores [85 92 78 95]} | /scores | count
4

|~| filter + count
> [10 25 3 47 8 31] | filter(gt(20)) | count
3

|~| distribute + reshape
> [{:first "a" :last "x" :score 85}
   {:first "b" :last "y" :score 92}
   {:first "c" :last "z" :score 78}]
  * {:first /first :score /score}
[{:first "a" :score 85} {:first "b" :score 92} {:first "c" :score 78}]

|~| binary arithmetic in reshape
> [{:name "a" :price 100 :qty 3}
   {:name "b" :price 50 :qty 10}]
  * {:name /name :total mul(/price, /qty)}
[{:name "a" :total 300} {:name "b" :total 500}]

|~| filter with composed predicate
> [{:name "a" :age 25 :active true}
   {:name "b" :age 15 :active true}
   {:name "c" :age 30 :active false}]
  | filter(and(/active, /age | gt(18)))
[{:name "a" :age 25 :active true}]

|~| fan-out + merge
> [1 2 3 4 5 6 7 8 9 10]
  | [filter(gt(7)), filter(lt(3))] >> sort
[1 2 8 9 10]

|~| nested projection
> {:config {:db {:host "localhost" :port 5432}}}
  | /config/db/port
5432

|~| pipeline as predicate inside filter
> [{:name "server-1" :cpu 45}
   {:name "server-2" :cpu 92}
   {:name "server-3" :cpu 12}]
  | filter(/cpu | gt(80))
  * /name
["server-2"]

|~| enrich via bound union
> {:name "a" :age 20} | union({:adult /age | gt(18)})
{:name "a" :age 20 :adult true}

|~| drop fields via bound minus
> {:name "a" :age 20 :tmp 1} | minus(#{:tmp})
{:name "a" :age 20}

|~| select fields via bound inter
> {:name "a" :age 20 :tmp 1} | inter(#{:name :age})
{:name "a" :age 20}

|~| enrich each element in distribute
> [{:name "a" :score 85} {:name "b" :score 92}]
  * union({:grade /score | gte(90)})
[{:name "a" :score 85 :grade false} {:name "b" :score 92 :grade true}]

|~| value binding: reference earlier pipeline stage
> {:name "a" :age 20}
  | as(:r)
  | /age | add(10) | as(:future_age)
  | [r, {:future_age future_age}] | union
{:name "a" :age 20 :future_age 30}

|~| wrap-with-original: keep full element alongside computed fields
> [{:id 1 :name "a"} {:id 2 :name "b"}]
  * (as(:r) | {:key /id :record r})
[{:key 1 :record {:id 1 :name "a"}}
 {:key 2 :record {:id 2 :name "b"}}]

|~| multi-stage bindings: capture different pipeline stages
> [85 92 47 78 68 95 52]
  | as(:allScores)
  | filter(gte(70))
  | as(:passingScores)
  | [allScores | count, passingScores | count]
[7 4]

|~| let + recursion: rename :label → :value throughout a tree
> {:label "root" :children [
    {:label "a" :children [
      {:label "a1" :children []}]}
    {:label "b" :children []}]}
  | let(:renameLabel, {:value /label
                       :children /children * renameLabel})
  | renameLabel
```

Result:
```qlang
{:value "root" :children [
  {:value "a" :children [
    {:value "a1" :children []}]}
  {:value "b" :children []}]}
```

The `renameLabel` conduit maps each `:label` to a new `:value` field
and recursively transforms children. Recursion terminates at leaves
because `[] * renameLabel = []` without invoking the conduit.

## Embedding API

This section documents the public surface a host application uses
to embed qlang. The reference implementation under `qlang/src/`
exposes everything from the package root and through subpath
imports; see [qlang-operands.md](qlang-operands.md#tooling-primitives)
for the per-module breakdown.

### Sessions

A `Session` is a persistent `(env, cellHistory)` pair that threads
across multiple `evalCell` invocations. Each cell sees the bindings
written by previous cells, mirroring the REPL/notebook execution
model.

```js
import { createSession } from '@kaluchi/qlang';

const session = createSession();

session.evalCell('let(:double, mul(2))');
session.evalCell('5 | double');
// → { source: '5 | double', uri: 'cell-2', ast: ..., result: 10,
//     error: null, envAfterCell: <Map> }
```

Session methods:

| Method | Returns | Behavior |
|---|---|---|
| `evalCell(source, opts?)` | cell entry | Parse and evaluate one cell. `opts.uri` defaults to `cell-N`. The returned entry is also pushed onto `session.cellHistory`. |
| `bind(name, value)` | undefined | Install a binding directly into env (no parse). Used by `deserializeSession` and by host integrations injecting effectful operands. |
| `takeSnapshot()` | `{ env, cellHistoryLength }` | Cheap save for restore. |
| `restoreSnapshot(snap)` | undefined | Rewind env and cell history. |

Properties:

- `session.env` — current env (read-only Map view).
- `session.cellHistory` — array of cell entries in execution order.

A new session is seeded with a fresh `langRuntime()`. To inject
host operands (e.g. the Eclipse plugin's `@callers`, `@refs`,
`@hierarchy`), the host calls `session.bind(name, fn)` for each
operand at session construction.

### Save and restore

`serializeSession(session)` produces a JSON-serializable payload
capturing user-defined bindings (those not in `langRuntime`) plus
the source of every cell ever executed. The payload's `schemaVersion`
field guards against forward-incompatible deserialization.

```js
import { serializeSession, deserializeSession } from '@kaluchi/qlang';

const payload = serializeSession(session);
const json = JSON.stringify(payload);

// later, possibly in another process or browser tab:
const restored = deserializeSession(JSON.parse(json));
restored.evalCell('5 | double'); // → 10, double is reconstructed from stored source
```

Bindings serialize as one of:

- `{ kind: 'conduit', name, params, source, docs }` — `let`
  bindings (conduits), with the body source captured from the
  parser-attached `.text` field and the parameter name list.
- `{ kind: 'snapshot', name, value, docs }` — `as` bindings, with
  the captured value encoded via the tagged-JSON form.
- `{ kind: 'value', name, value }` — raw values bound via
  `session.bind`, encoded via the tagged-JSON form.

Built-in function values are not serialized; the host re-installs
them by re-creating a fresh `langRuntime()`-seeded session and
re-binding any host operands. Cell history is restored without
re-evaluation — entries carry only `source` and `uri`. A notebook
layer that wants the original AST or result can call
`session.evalCell(cell.source)` to re-run.

### Module resolution

A host that ships a library of `.qlang` modules (operand packages,
domain vocabularies) uses the `@kaluchi/qlang/host/module-resolver`
subpath to load them into a session.

#### Filesystem-to-namespace convention

The path of a `.qlang` file relative to the library root determines
its namespace keyword. The `.qlang` extension is stripped and path
separators become `/`:

```
lib/qlang/error.qlang          → keyword :qlang/error
lib/qlang/error/guards.qlang   → keyword :qlang/error/guards
lib/domain/tax.qlang           → keyword :domain/tax
```

A module's source is pure qlang — only `let` declarations. The env
delta produced by evaluating the module (bindings not present in the
base env before evaluation) is its export surface.

#### API

```js
import { discoverModules, resolveModules, installModules }
  from '@kaluchi/qlang/host/module-resolver';
import { createSession } from '@kaluchi/qlang';

// Resolve all modules in lib/ in discovery order.
const catalog = resolveModules('./lib');

// Install into a session: each namespace keyword → module env Map.
const session = createSession();
installModules(session, catalog);

// Now user code can import namespaces:
// use(:qlang/error) | let(:guard, ...)
```

- **`discoverModules(libDir)`** — scans `libDir` recursively for
  `.qlang` files and returns a `Map<namespaceName, filePath>` (names
  are strings such as `"qlang/error"`, not keywords).

- **`resolveModules(libDir, opts?)`** — discovers, evaluates, and
  returns a `Map<keyword, Map>` catalog. Each module is evaluated
  in its own env snapshot built from `baseEnv` plus all previously
  resolved modules, so earlier modules are visible to later ones.
  Options:
  - `opts.baseEnv` — initial env (default: `langRuntime()`).
  - `opts.dependencies` — `Map<namespaceName, string[]>` for explicit
    topological ordering. When omitted, modules are evaluated in
    filesystem discovery order.

- **`installModules(session, catalog)`** — iterates the catalog and
  calls `session.bind(nsKeyword.name, moduleEnv)` for each entry.
  After installation, `use(:ns-keyword)` merges the module's exports
  into the query env.

#### Dependency ordering

When modules depend on each other, pass a `dependencies` map:

```js
const catalog = resolveModules('./lib', {
  dependencies: new Map([
    ['qlang/error/guards', ['qlang/error']],  // guards depends on error
    ['domain/tax',         ['qlang/error']]
  ])
});
```

`resolveModules` topologically sorts the dependency graph and
evaluates in an order where each module's dependencies are resolved
before it.

### Tagged-JSON value codec

`toTaggedJSON(value)` and `fromTaggedJSON(json)` are the canonical
encoder/decoder pair between qlang runtime values and a JSON form
that survives `JSON.stringify` round-trips. The same wire format
is used by the conformance test runner, by the session serializer,
and by any host that ships qlang values across a JSON boundary.

| qlang value | tagged JSON form |
|---|---|
| number / string / boolean | itself |
| nil | `null` |
| Vec | JSON array of recursively-encoded elements |
| keyword | `{ "$keyword": "name" }` |
| Map | `{ "$map": [[k, v], ...] }` (entries pairs, recursively encoded) |
| Set | `{ "$set": [v1, v2, ...] }` |

Example:

```js
import { toTaggedJSON, fromTaggedJSON, evalQuery } from '@kaluchi/qlang';

const value = evalQuery('{:name "alice" :tags #{:admin :ops}}');
const wire = JSON.stringify(toTaggedJSON(value));
// '{"$map":[[{"$keyword":"name"},"alice"],[{"$keyword":"tags"},{"$set":[{"$keyword":"admin"},{"$keyword":"ops"}]}]]}'

const restored = fromTaggedJSON(JSON.parse(wire));
// equivalent Map with the same keyword identity (interned)
```

`toTaggedJSON` throws `TaggedJSONUnencodableValueError` for function
values, conduits, and snapshots — these require the higher-level
session serializer to reconstruct from source on restore.
`fromTaggedJSON` throws `MalformedTaggedJSONError` on unrecognized
tagged objects.

### AST traversal primitives

Embedders building editors, refactoring tools, language servers, or
notebooks consume the AST traversal surface from
[`walk.mjs`](qlang-operands.md#walkmjs--ast-traversal-primitives).
The contract: every parser-produced AST node carries `.location`,
`.text`, `.id`, `.parent`, and (where the surface form admits a
marker) `.effectful`. The root additionally carries `.source`,
`.uri`, `.parseId`, `.parsedAt`, `.schemaVersion`. See the runtime
reference for the per-function contract of `walkAst`,
`astChildrenOf`, `findAstNodeAtOffset`, `findIdentifierOccurrences`,
`bindingNamesVisibleAt`, `astNodeSpan`, `astNodeContainsOffset`,
and `triviaBetweenAstNodes`.
