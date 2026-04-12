# Qlang Query Language

Expression language for transforming immutable values through
pipelines. A query receives an initial value and threads it
through a sequence of steps; each step produces a new value. The
language is domain-agnostic — a host application provides
additional functions for its domain.

For the full formal evaluation model, see
[qlang-internals.md](qlang-internals.md). For the catalog of
built-in operands, see [qlang-operands.md](qlang-operands.md).

## Reading conventions

Examples in this document follow a REPL convention. A line that
begins with `>` is the input the user typed; the lines beneath
it (until the next blank line or the next `>`) are the result
the evaluator produced.

```qlang
> 42
42

> "hello"
"hello"
```

The `>` mark is purely typographical — it is not part of qlang
syntax and never appears in source code.

A token of the form `|~| ... |~|` (line) or `|~ ... ~|` (block)
is a **comment** — a pipeline step with identity semantics. The
evaluator passes a comment through unchanged, leaving both the
current value and the surrounding bindings exactly as they were.
Comments exist so prose can ride alongside the code:

```qlang
|~| line comments terminate at end of line |~|

|~ block comments may span as many lines as needed
   and terminate at the closing token ~|

> [1 2 3] |~| three-element Vec |~|
[1 2 3]
```

When a comment sits between two pipeline steps, the combinators
on either side are absorbed into the comment token, so no extra
punctuation is needed around it. Use comments freely throughout —
every snippet in this document is allowed to carry inline
annotations without disrupting the pipeline. The pipeline
combinator `|` itself is introduced in [Pipeline](#pipeline);
until then, comments stand alone next to single-step examples.

A second variety of comment, written `|~~| ... |` or
`|~~ ... ~~|`, attaches as metadata to the binding it precedes
rather than being pure identity. Doc comments are introduced
together with `let` and `as` in
[Names and modules](#names-and-modules).

---

## Atomic values

A qlang value is **immutable** and arbitrarily nestable. Once
constructed, a value's content is fixed: there is no in-place
mutation, no lazy evaluation, no deferred computation. A Vec is
always fully materialised; an operand always returns a complete
value before the next step begins.

The five atomic types are introduced first; the four composite
types layer on top of them.

### string

Double-quoted character sequences. The escape set is `\n`, `\t`,
`\r`, `\"`, `\\`.

```qlang
> "hello"
"hello"

> ""
""

> "line one\nline two"
"line one\nline two"
```

### number

Integer or decimal — both are the same numeric type. Negative
numbers carry a leading `-`.

```qlang
> 42
42

> 3.14
3.14

> -1
-1
```

### boolean

`true` or `false`. There is no implicit coercion of other types
to boolean: a value is either the literal `true`, the literal
`false`, or it is something else.

```qlang
> true
true

> false
false
```

### null

The absence of a value. Missing Map keys produce `null`. An
operand whose result is undefined returns `null`.

```qlang
> null
null
```

### keyword

The atomic type that holds the language together. A keyword is a
self-evaluating symbolic identifier — `:name` always equals
`:name`. Keywords serve as Map keys, as error field names, as
module namespace identifiers, and anywhere else a name needs to
be a first-class value rather than a string.

A keyword has three surface forms; all three intern into the same
value space, so `:foo` and `:"foo"` are the same keyword.

**Bare** — `:name`. The everyday form. Restricted to identifier
characters: `[@_a-zA-Z][a-zA-Z0-9_-]*`.

```qlang
> :name
:name

> :status
:status

> :user-id
:user-id
```

**Namespaced** — `:domain/user`, `:qlang/error`. Slash-separated
identifiers parsed as a single keyword. The namespace mechanism
prevents collision between different domains and libraries: the
`:error` keyword from the language runtime and the `:domain/error`
keyword from a host vocabulary are distinct values that never
shadow each other. Each segment follows the bare-identifier
restriction; nesting is allowed.

```qlang
> :domain/user
:domain/user

> :qlang/error
:qlang/error

> :qlang/error/guards
:qlang/error/guards
```

Namespaces are an architectural feature, not an edge case. Every
host module ships under its own namespace, and namespaced
keywords appear naturally in the examples that follow whenever
domain vocabulary is involved.

**Quoted** — `:"foo bar"`, `:"123"`, `:"$ref"`, `:""`. Lifts the
identifier restriction so any string is admissible as a keyword
name. The full string-escape set is honoured inside the quotes.

```qlang
> :"foo bar"
:"foo bar"

> :"123"
:"123"

> :"$ref"
:"$ref"

> :""
:""
```

The quoted form completes the JSON-interop guarantee: every JSON
object key has a qlang keyword literal representation, so any
JSON value round-trips through Vec / Map / keyword / scalar
primitives without loss. `:"name"` and `:name` denote the same
keyword — the bare form is shorthand for identifier-shaped names,
the quoted form is the general case.

---

## Composite values

Four composite types layer on top of the atomics. Each is a
distinct shape — ordered sequence (Vec), keyword-keyed
association (Map), unordered unique collection (Set), and
structured failure marker (Error). All four are immutable; an
operation that "modifies" a composite returns a new value rather
than mutating in place.

### Vec

Ordered, indexed, finite sequence of values. Elements may be of
any type and need not be uniform — heterogeneous Vecs are
ordinary.

```qlang
> [1 2 3]
[1 2 3]

> ["a" "b" "c"]
["a" "b" "c"]

> [[1 2] [3 4]]
[[1 2] [3 4]]

> [1 "two" null :keyword]
[1 "two" null :keyword]

> []
[]
```

### Map

Insertion-ordered associative container. Keys are keywords;
values may be of any qlang type. Every entry is an explicit
`:key value` pair — there is no shorthand and no implicit
key-from-variable-name binding.

```qlang
> {:name "alice" :age 30}
{:name "alice" :age 30}

> {:point {:x 0 :y 0} :tags [1 2 3]}
{:point {:x 0 :y 0} :tags [1 2 3]}

> {}
{}
```

Namespaced and quoted keywords are valid keys without ceremony,
and routinely appear in Maps that hold domain data or that need
to round-trip through JSON:

```qlang
> {:domain/user "alice" :domain/role :admin}
{:domain/user "alice" :domain/role :admin}

> {:"foo bar" 1 :"$ref" "x" :"a.b" 99}
{:"foo bar" 1 :"$ref" "x" :"a.b" 99}
```

JSON object syntax is also accepted — `"key": value` entries are
equivalent to `:"key" value` and are parsed into the same
keyword-keyed Map. This lets you paste raw JSON objects directly
into a query without editing:

```qlang
> {"name": "alice", "age": 30, "score": 9.5e1}
{:name "alice" :age 30 :score 95}

> {"user": {"id": 1, "active": true}} | /user/active
true
```

Both key styles may appear in the same literal:

```qlang
> {:source "manual", "auto": true}
{:source "manual" :auto true}
```

If the same key appears more than once in a literal, the last
binding wins:

```qlang
> {:a 1 :a 2}
{:a 2}
```

### Set

Unordered collection of unique values. Literal `#{}`.
Deduplication happens at construction; specifying the same value
twice has no effect.

```qlang
> #{:name :age :id}
#{:name :age :id}

> #{1 2 3 2 1}
#{1 2 3}

> #{}
#{}
```

Sets are most often used as key sets — the shape of a record —
or as membership tables.

### Error

The fourth composite — Error — is structurally similar to Map but
carries a special identity in the pipeline. Its literal is `!{}`
with the same `:key value` entry syntax as Map, and the result is
an **error value** rather than a plain Map.

```qlang
> !{:kind :oops :message "boom"}
!{:kind :oops :message "boom"}

> !{}
!{}
```

An error value wraps a **descriptor Map** — the content between
`!{` and `}`. Any qlang value may sit inside the descriptor,
including nested Maps, Vecs, and other error values.

Error values can live inside other containers exactly the same
way ordinary values do — they are values, not exceptions:

```qlang
> [1 !{:kind :oops} 3]
[1 !{:kind :oops} 3]

> {:result 42 :error !{:kind :timeout}}
{:result 42 :error !{:kind :timeout}}
```

Inside a container an error value is just data, indistinguishable
in handling from any other Map. What changes is the behaviour
when an error value reaches a pipeline step as the **current
value being processed** — at that point a separate dispatch
path called the **fail-track** takes over. Fail-track behaviour
is covered in [Error track](#error-track), once the combinators
that govern it are themselves on the page.

---

## Pipeline

The previous chapters showed values sitting on their own. Real
queries chain operations — take a value, transform it, transform
the result, and so on. The mechanism for chaining is the **pipeline
combinator**.

`|` is the pipeline combinator. It takes the value on its left,
hands it to the operation on its right, and the result becomes the
new value flowing through. The value being threaded along is called
**`pipeValue`** — every step receives the current `pipeValue` as
input and produces the next `pipeValue` as output.

```qlang
> [1 2 3] | count
3
```

`count` is an **operand** — a built-in function that takes a Vec
and returns its length. The full catalog of built-in operands lives
in [qlang-operands.md](qlang-operands.md); this chapter only
explains how operands hook into the pipeline.

```qlang
> [5 3 1 4 2] | sort
[1 2 3 4 5]

> {:name "alice" :age 30} | /name
"alice"

> [1 2 3 4 5] | filter(gt(3)) | count
2
```

Operands are referenced by name after `|`. Built-ins like `count`,
`sort`, and `filter` are always in scope at the top of a query;
later chapters show how to add more.

### Binding and application

Two of the examples above used `count` bare and `filter(gt(3))`
with arguments in parentheses. Two distinct operations explain the
difference.

**`()`** is **binding**. It takes a function and some arguments,
returns a new function with those arguments fixed. Binding never
runs anything — it only constructs a new function.

**`|`** is **application**. It takes a value and a function and
applies the function to the value. `|` is the only thing in the
language that actually executes a step.

```qlang
gt              |~| function: needs (value, threshold)
gt(10)          |~| binding: fix threshold = 10 → new function awaiting value
                |~| nothing executed yet

filter          |~| function: needs (vec, predicate)
filter(gt(10))  |~| binding: fix predicate → new function awaiting vec
                |~| still nothing executed

[1 2 3 4 5] | filter(gt(10))
             ^
             application — runs now
```

A zero-argument operand does not need binding; it is already
complete and can be applied immediately:

```qlang
count           |~| complete: needs only (vec)
[1 2 3] | count |~| application → 3

sort            |~| complete: (vec), natural order
sort(/name)     |~| binding: fix key → new function (vec)
```

Expressions inside `()` are **captured, not evaluated**. When the
bound function is later applied via `|`, each captured argument
evaluates against the current `pipeValue`:

```qlang
filter(/age | gt(18))
       ^^^^^^^^^^^^^
       captured pipeline — evaluates against each element when filter
       runs it, not when the binding is created

> [{:name "a" :age 25} {:name "b" :age 15} {:name "c" :age 30}]
  | filter(/age | gt(18))
[{:name "a" :age 25} {:name "c" :age 30}]
```

### Subject-first convention

All operand signatures follow the **subject-first convention**:
position 1 is the data being operated on, positions 2..n are the
modifiers.

When fewer arguments are captured than the operand expects, the
pipeline fills the missing leading slots — this is **partial
application**:

```qlang
100 | mul(2)            |~| pipeValue 100 fills position 1
                        |~| captured 2 fills position 2
                        |~| → 200
```

When all positions are captured, the pipeline fills no slot and
`pipeValue` becomes the **context** in which the captured arguments
are evaluated — this is **full application**:

```qlang
> {:price 100 :qty 3} | mul(/price, /qty)
300
|~| both args captured from pipeValue fields;
|~| pipeValue itself fills no position
```

### Truthiness

`null` and `false` are falsy. Every other value is truthy —
including `0`, `""`, `[]`, `{}`, `#{}`. Predicates such as
`filter`, `if`, `when`, and `not` honour this rule uniformly.

```qlang
> [0 "" null false true 1 "a"] | filter(not)
[null false]
```

### What a failure looks like

When an operand cannot run on the value it receives — when `add`
is asked for a number but the pipeline hands it a Vec, when `/key`
is applied to a non-Map, when `div` is asked to divide by zero —
the result is **an error value** of the `!{}` form introduced in
[Composite values](#composite-values). The error becomes the new
`pipeValue` and flows through the rest of the pipeline as data
rather than crashing the query.

```qlang
> [1 2 3] | add(1)
!{:kind :type-error :thrown :AddLeftNotNumber :origin :qlang/eval
  :operand "add" :position 1 :expectedType "number"
  :actualType "Vec" :trail []}
|~| add(1) was waiting for a number in position 1; the Vec triggered
|~| the per-site class :AddLeftNotNumber. The descriptor lays out
|~| the failure structure and the error becomes the new pipeValue.
```

The descriptor names the operand that failed (`:operand`), the
specific error class (`:thrown`), the broad category (`:kind`),
and any positional context. The empty `:trail []` is normal at
the moment of failure — `:trail` accumulates as the error then
flows through subsequent steps. From this point on every example
in this document may show an error output rather than a normal
one, and the descriptor shape is the same in every case: a
keyword-keyed Map you can read at a glance.

The full machinery for inspecting, recovering from, and routing
around errors — the deflect rule for `|`, the `!|` fail-track
combinator, the trail, the materialised descriptor — is covered
in [Error track](#error-track). For now it is enough to recognise
errors when they appear and read them as data.

### Combinator absorption — quick rule

A plain comment between two pipeline steps absorbs the combinators
on either side, so no extra `|` is needed around it:

```qlang
> [1 2 3 4 5]
  | filter(gt(2))
  |~| keep elements greater than 2 |~|
  count
3
```

The leading `|` of `|~` is the combinator from the previous step;
the trailing `|` of `~|` is the combinator to the next step. The
full rule, including doc comments and edge cases, lives alongside
`let` and `as` in
[Names and modules](#names-and-modules).

### Precedence

`|` is left-associative. The other combinators introduced in
later chapters (`*`, `>>`, `!|`) share the same precedence and
associativity, so a chain of mixed combinators reads strictly
left to right. `()` scopes a sub-expression into an isolated
sub-pipeline:

```qlang
filter(/age | gt(18))
|~| /age | gt(18) is a complete sub-pipeline inside ()
```

---

## Extract

Pipeline shows how a value flows through a single step. The next
question is how to take values apart — to read a field from a
Map, walk elements of a Vec, or flatten nested Vecs into a single
sequence. Three mechanisms cover all three needs.

### Projection — `/key`

Extract a value from a Map by keyword — the keyword-keyed Maps from
Part 1. Missing key → `null`:

```qlang
> {:name "alice" :age 30} | /name
"alice"

> {:name "alice"} | /missing
null
```

Nested chains: `/a/b` desugars to `/a | /b`.

```qlang
> {:geo {:lat 51.5 :lon -0.1}} | /geo/lat
51.5

> {:a {:b {:c 42}}} | /a/b/c
42
```

Key segments follow the same three forms as keyword literals:

- `/name` — bare segment, projects by keyword `:name`
- `/"any text"` — quoted segment, admits arbitrary JSON keys,
  including the edge cases covered in keyword: `:"foo bar"`, `:"$ref"`, `:""`
- `/:qlang/error` — keyword segment, projects by a namespaced keyword

The quoted segment:

```qlang
> {:"foo bar" 42} | /"foo bar"
42

> {:"$ref" "x"} | /"$ref"
"x"

> {:"a.b" {:"$ref" 99}} | /"a.b"/"$ref"
99
```

The keyword segment (`:` prefix signals the slash-separated chain
names a single namespaced keyword, not multiple bare segments):

```qlang
> {:qlang/error 42} | /:qlang/error
42

> {:qlang/error {:retry 42}} | /:qlang/error/:retry
42
```

- `/qlang/error` — two bare segments: project `:qlang` then `:error`
- `/:qlang/error` — one keyword segment: project namespaced `:qlang/error`

Both forms can be mixed in a single chain: `/outer/"inner key"/:qlang/ns`.

Type error: projection on a non-Map (Scalar, Vec, Set, null, function)
produces an Error value — see [Error track](#error-track).

### Distribute — `*`

Apply an expression to each element of a Vec.

```qlang
> [1 2 3] * add(10)
[11 12 13]

> [{:name "a" :x 1} {:name "b" :x 2}] * /name
["a" "b"]

> [{:name "a" :x 1} {:name "b" :x 2}] * /x
[1 2]
```

`|` applies to the whole Vec; `*` applies to each element:

```qlang
> [1 2 3] | count
3

> [1 2 3] * add(1)
[2 3 4]
```

This resolves the type error from Partial application: `[1 2 3] | add(1)`
failed because `add` expects a number in the first position. `*`
applies the step per element instead of to the Vec as a whole.

Type error: `*` on a non-Vec produces an Error value.

### Merge — `>>`

Flatten one nesting level, then apply next step. Equivalent to
`| flat |`.

```qlang
> [[1 2] [3] [4 5]] >> count
5

> [[3 1] [2 4]] >> sort
[1 2 3 4]
```

Type error: `>>` on a non-Vec produces an Error value.

## Construct

Extract is about taking values apart. Construct is about building
new ones. In [Composite values](#composite-values), `[1 2 3]` and
`{:name "alice"}` were static literals — you typed them and got
them back. After `|`, the same syntax becomes dynamic: each
element or value expression receives `pipeValue` as input. Same
syntax, new behaviour.

### Vec as step — fan-out

```qlang
> 10 | [add(1), mul(2), sub(3)]
[11 20 7]

> {:name "alice" :age 30} | [/name, /age]
["alice" 30]
```

Literals inside the Vec still ignore input; projections and operands
consume `pipeValue`. Both are the same construct — no separate
"branch" syntax.

A Vec expression produces a Vec of results. Combined with `>>` from
Extract (flatten one level, then apply), this merges the branches:

```qlang
> [1 2 3 4 5] | [filter(gt(3)), filter(lt(2))] >> count
3
|~| [filter(gt(3)), filter(lt(2))] builds [[4 5], [1]]
|~| >> flattens to [4 5 1], count → 3
```

### Map as step — reshape

```qlang
> {:name "alice" :age 30 :x 5} | {:name /name :doubled /x | mul(2)}
{:name "alice" :doubled 10}
```

After `*` — reshape each Vec element:

```qlang
> [{:name "a" :x 3} {:name "b" :x 7}]
  * {:name /name :doubled /x | mul(2)}
[{:name "a" :doubled 6} {:name "b" :doubled 14}]
```

Full application — both args captured from `pipeValue` fields —
works naturally inside a reshape, where `pipeValue` is the element
being reshaped:

```qlang
> [{:name "a" :price 100 :qty 3}
   {:name "b" :price 50 :qty 10}]
  * {:name /name :total mul(/price, /qty)}
[{:name "a" :total 300} {:name "b" :total 500}]
```

### Set as step

A Set literal after `|` collects values — each element expression
receives `pipeValue`:

```qlang
> {:name "alice" :age 30} | #{/name, /age}
#{"alice" 30}

|~| equivalent via operands
> {:name "alice" :age 30} | vals | set
#{"alice" 30}
```

### Set operations

`union`, `minus`, `inter` — polymorphic operands on `Vec` of Sets
or Maps. Left-fold.

**Set × Set:**

```qlang
> [#{:a :b :c}, #{:b :d}] | union
#{:a :b :c :d}

> [#{:a :b :c}, #{:b :d}] | minus
#{:a :c}

> [#{:a :b :c}, #{:b :d}] | inter
#{:b}
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

**Map × Set** — field operations (Set = which keys to keep or drop):

```qlang
> [{:name "a" :age 20 :tmp 1}, #{:tmp}] | minus
{:name "a" :age 20}

> [{:name "a" :age 20 :tmp 1}, #{:name :age}] | inter
{:name "a" :age 20}
```

Bound operand forms — single argument, no Vec wrapper needed:

```qlang
> {:name "a" :age 20} | union({:adult /age | gt(18)})
{:name "a" :age 20 :adult true}

> {:name "a" :age 20 :tmp 1} | minus(#{:tmp})
{:name "a" :age 20}

> {:name "a" :age 20 :tmp 1} | inter(#{:name :age})
{:name "a" :age 20}
```

## Names and modules

Construct built new values from `pipeValue`. But often the same
value needs to be referenced at several points in a pipeline —
before and after a transformation, or from multiple branches of
a reshape. That requires naming.

This chapter covers every mechanism for putting names into scope.
Three operands write into the binding scope: `as` snapshots a
value, `let` defines a reusable pipeline fragment (a **conduit**),
and `use` merges an entire Map of bindings — a constants table or
a host-provided module — into scope at once. Together they cover
the three things a real query needs to compose: a frozen value, a
reusable transformation, and a library import.

The binding scope itself is an ordinary Map: it holds the
built-in operands, any domain functions the host has installed,
and every binding written by `as`, `let`, or `use` so far.
Identifier lookup reads from this Map; `as`, `let`, and `use`
write into it. The Map has a name — `env` — which becomes
relevant when [Reflection](#reflection) introduces an operand
that returns it as a value.

### `as(:name)` — value snapshot

`as(:name)` captures `pipeValue` under a keyword name. The value
passes through unchanged; the name becomes available to all
subsequent steps in the same scope.

```qlang
order | normalize | as(:cleanOrder) | computeTax | as(:taxedOrder) | shipQuote | finalize
|~| after normalize → cleanOrder = the cleaned order map
|~| after computeTax → taxedOrder = the taxed map
```

`cleanOrder` and `taxedOrder` are frozen snapshots. All values are
immutable — a captured binding is safe to reference at any later
point.

Multiple `as` calls can appear in sequence, binding either the same
value under different names or different values at different stages:

```qlang
purchase | normalize | as(:initial) | applyDiscounts | as(:discounted) | [initial, discounted]
|~| initial    = the normalized purchase
|~| discounted = the same purchase after discounts applied
```

`as` combines naturally with the set operations from Construct.
Capture the record first, then build a Vec with the original and the
computed delta:

```qlang
> {:name "a" :age 20 :tmp 1}
  | as(:r) | [r, #{:tmp}] | minus
{:name "a" :age 20}

> {:name "a" :age 20}
  | as(:r) | [r, {:adult /age | gt(18)}] | union
{:name "a" :age 20 :adult true}

record | as(:r) | [r, {:adult /age | gt(18)}] | union
record | as(:r) | [r, #{:tmp}] | minus
record | as(:r) | [r, #{:name :age}] | inter
```

Multi-step reference — capture at one point, use at several later
points:

```qlang
> [{:name "a" :age 25}
   {:name "b" :age 15}
   {:name "c" :age 30}]
  | as(:people)
  | filter(/age | gte(18))
  | as(:adults)
  | {:total people | count :adult adults | count}
{:total 3 :adult 2}
```

### `let(:name, expr)` — named pipeline fragment

Where `as` captures a value, `let` captures a transformation — a
reusable pipeline fragment called a **conduit**. `pipeValue` is
unchanged by the declaration itself; the name goes into scope.

```qlang
> let(:double, mul(2))
  | [1 2 3] * double
[2 4 6]
```

The two forms are a single mechanism with different arity:

- `let(:double, mul(2))` — zero-arity conduit, no parameters.
- `let(:@surround, [:pfx, :sfx], prepend(pfx) | append(sfx))` —
  two-arity conduit, two parameters.
- `let(:f, [], body)` — equivalent to zero-arity (empty params list).

Multi-step bodies must be wrapped in parentheses so the `|` inside
does not bleed into the outer pipeline:

```qlang
| let(:isSenior, (/age | gt(65)))
|~| parens required: /age | gt(65) is the body pipeline
```

Difference from `as`:
- `let(:name, expr)` — captures the **expression**. Each reference
  evaluates `expr` in a lexically-scoped fork.
- `as(:name)` — captures the **value** of `pipeValue` at the point
  where the operand executes. Frozen — same value every reference.

Both mechanisms write to the same `env[:name]` slot, so the usual
last-write-wins rule applies.

#### Invocation

A conduit is invoked like any operand: `value | double`,
`"world" | @surround("[", "]")`. At the call site:

1. Captured-arg expressions become lazy lambdas (not eagerly fired).
2. Each lambda is wrapped in a conduit-parameter that fires against
   whatever `pipeValue` exists at the lookup site inside the body.
3. The body runs in a fork with a **lexical env** — the env frozen
   at declaration time, plus conduit-parameter bindings. Body's
   `let`/`as` writes are local to the fork.
4. The body's final `pipeValue` propagates out; the outer `env` is
   preserved unchanged.

#### Lexical scope and fractal composition

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
zero-arity alias and parametric forwarding. Partial application is
achieved explicitly through composition, not through auto-curry.

#### Higher-order parameters

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

`keyFn` is not a frozen value — it evaluates `/score` against each
element when `desc` invokes it per comparison pair.

#### Examples

```qlang
> let(:@surround, [:pfx, :sfx], prepend(pfx) | append(sfx))
  | "world" | @surround("[", "]")
"[world]"

> [{:name "Alice" :age 25} {:name "Bob" :age 16} {:name "Carol" :age 40}]
  | let(:votingAge, filter(/age | gte(18)))
  | let(:nameAndAge, {:name /name :age /age})
  | votingAge * nameAndAge
[{:name "Alice" :age 25} {:name "Carol" :age 40}]
```

#### Recursion via self-reference

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

### `use` — merge bindings into scope

`as` writes a single name; `let` writes a single conduit. `use`
is the bulk operator: it takes a Map and installs every
`:key value` entry in it as a binding all at once. The Map's
keys become the identifiers, the values become whatever is
bound.

```qlang
> {:pi 3.14159 :e 2.71828 :phi 1.61803}
  | use
  | [pi | mul(2), e | mul(3)]
[6.28318 8.15484]
```

The `pi` and `e` identifiers in the second step were not built-ins
and were not defined by `let` — they came into scope via the `use`
that merged the constants Map.

`use` has a single value-level rule: the subject must be a Map.
On conflict, the **incoming Map wins** — later writes override
earlier ones, so a constants table with `:pi 3.14` followed by
another with `:pi 3.14159` ends up with `pi → 3.14159`.

`use` is not an in-query function-definition mechanism. A Map
literal `{:double mul(2)}` does not produce
`{:double <function>}` — Map literal values are sub-pipelines
that evaluate eagerly against `pipeValue`, so `mul(2)` would
just multiply pipeValue by 2 and store the result. To define a
callable from inside a query, use `let`. To install one from
outside a query, install it as part of the host-provided env or
load it as a module through one of the namespaced forms below.

#### Loading modules — `use(:namespace)`

A host application that ships its own libraries installs each
one under a namespace keyword. The user calls `use` with the
namespace keyword as a captured argument, and the module's
exports merge into scope:

```qlang
use(:qlang/error)
|~| pulls the :qlang/error module's exports into scope
```

The namespace machinery has the same shape regardless of where
the module came from — built-in (`:qlang/error`), host-provided
(`:domain/tax`), or user-installed for the session
(`:my/helpers`). Module keywords are the namespaced keywords
introduced in [Atomic values](#atomic-values), and their nested
forms work too: `use(:qlang/error/guards)` loads a sub-module.

When several modules need to load together, `use` accepts three
captured-arg shapes:

```qlang
|~| Vec — ordered list, later entries override earlier conflicts
use([:qlang/error :domain/tax])

|~| Set — unordered, collisions raise an error so the host can
|~| disambiguate. Use Set when shadowing is NOT what you want.
use(#{:qlang/error :domain/tax})

|~| Two captured args — namespace plus selection filter.
|~| Only the named identifiers are imported; everything else
|~| stays out of scope.
use(:qlang/error, #{:guard :assert})
```

The host-side mechanism that installs module Maps into env under
their namespace keys lives in the
[Embedding API](#embedding-api).

#### Bootstrap

Conceptually, a query starts from
`(pipeValue = langRuntime, env = {})`, and the first step is an
implicit `use` that installs the language runtime:

```qlang
langRuntime | use
  | domainRuntime | use
  | replEnv | use
  | <query body>
```

In practice, the host provides the initial state with the
language runtime already merged into `env`, so the explicit
prefix is omitted. Both variants deliver control to the query
body with the same `env`. See the
[evaluation model](qlang-internals.md#bootstrap) for the formal
treatment.

### Scoping rules

All seven rules below follow from a single principle: **nested
expressions `(...)`, `[...]`, `{...}`, `#{...}` open a fork** — a
sub-pipeline that starts with a copy of the outer state. When the
fork closes, its final `pipeValue` propagates out but its env
changes are discarded. See the
[model's Fork section](qlang-internals.md#fork) for details.

1. **Lexical, left-to-right.** `as(:name)` is visible in all
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
   inside a nested expression is local to that inner scope and
   invisible after it closes.

   ```qlang
   candidates | filter(/peerRating | as(:peerScore) | /selfRating | gte(peerScore))
   |~| peerScore is local to the filter predicate
   ```

4. **Each distribute iteration is its own scope.** In `xs * body`,
   each element's body gets a fresh scope. Outer bindings from
   before the `*` are visible in every iteration.

5. **Sibling expressions are independent.** In `{:a e1 :b e2}`,
   bindings from `e1` are NOT visible in `e2`. Same for Vec
   elements `[a, b, c]` and Set elements `#{a, b, c}` — each
   entry is its own sub-pipeline, parallel not sequential.

6. **Shadowing.** A later `as(:name)` or `let(:name, ...)` in the same
   scope replaces the earlier one for subsequent uses.

7. **Resolution order**: last-write-wins in `env`. Under typical
   pipeline order (runtime loaded first, then user `let`, then
   `as` captures during execution), this manifests as
   `as` > `let` > built-in.

   `let(:count, 5)` makes subsequent `count` references resolve to
   `5`. Within that pipeline the built-in `count` is inaccessible
   until a later step shadows `count` again.

### Identifier conventions

Identifiers may start with `@`, `_`, or a letter. The language
gives no special meaning to `@` or `_`. Domain authors commonly use
`@` as a prefix for names that come from their runtime (e.g.,
`@callers`, `@resolve`), and `_` for private internal bindings, but
this is pure convention — `@callers` and `callers` are resolved
identically, and either may be shadowed by an `as` or `let` binding.

### Comments

Conduits defined with `let` naturally deserve documentation. In
qlang, comments serve that role — and they are more than lexer
tokens: they are first-class pipeline steps with identity semantics.
They appear in the AST, participate in the pipeline metamodel, and
are visible to reflection. Four forms cover two orthogonal axes:
**line vs block** (content terminator) and **plain vs doc** (whether
the comment attaches as metadata to the following binding):

| Form | Role |
|---|---|
| `\|~\|` | line plain — content to newline, pure identity |
| `\|~ ... ~\|` | block plain — content to `~\|`, multi-line, pure identity |
| `\|~~\|` | line doc — content to newline, attaches to next binding |
| `\|~~ ... ~~\|` | block doc — content to `~~\|`, multi-line, attaches |

All four share the `|~` character family as the opening declarator.
Doubling the tilde promotes plain to doc. The line form is the
overlap-compressed form of the corresponding block form: `|~|` is
`|~` + `~|` sharing the middle `~`; `|~~|` is `|~~` + `~~|`
sharing the middle `~~`. Uncompressing expands the line form into
its block counterpart with content in the middle.

#### Combinator absorption

Comment tokens absorb adjacent pipeline combinators into their own
delimiters, so comments read cleanly inside a dense pipeline without
requiring explicit `|` around them. All four forms behave uniformly:
the combinator position immediately before the comment and the
combinator position immediately after it are both implicit.

- **Block forms** (`|~ ~|`, `|~~ ~~|`) absorb the leading combinator
  through the `|` in the opener and the trailing combinator through
  the `|` in the closer.
- **Line forms** (`|~|`, `|~~|`) absorb the leading combinator
  through the `|` at the start of the token; the trailing combinator
  is implicit across the newline, so the next step can follow
  directly without any prefix `|`.

At the start of a query, the leading `|` of a comment token is
virtual (no predecessor to connect to).

```qlang
orders | @find | @members
  | filter(/kind | eq(:method))
  | filter(@callers | empty)
  |~ Why @overriddenBy empty as a separate check: Eclipse
     SearchEngine does not count override calls as @callers, and a
     method with empty @callers can still be invoked via polymorphism. ~|
  filter(@overriddenBy | empty)
```

The leading `|` of `|~` absorbs the combinator from the previous
filter; the trailing `|` of `~|` absorbs the combinator to the next
filter. Neither side needs an explicit `|`.

#### Attach-to-next — doc comments

Doc comments (`|~~|`, `|~~ ~~|`) attach as metadata to the
**immediately following binding step** — that is, the next `let` or
`as`. The retrieval path goes through the binding's name, so a doc
comment must be followed by a binding; preceding any other step, the
doc comment fails to parse.

```qlang
|~~| First remark.
|~ formatting separator ~|
|~~| Second remark.
let(:foo, ...)
```

The binding's `docs` Vec holds two entries (`" First remark."`,
`" Second remark."`). The plain block comment appears in the AST
as an identity step immediately before the bound `let`.

Multiple doc comments before the same binding accumulate into the
`docs` field on the binding node. One doc token, one entry — no
concatenation of adjacent line docs.

```qlang
|~~| First remark.
|~~| Second remark.
|~~ Block-form remark
    with internal newlines. ~~|
let(:foo, ...)
```

The `let(:foo, ...)` binding's `docs` field holds three entries:
two single-line strings and one multi-line string.

Plain comments interleaved among the docs do not break the
attachment — the docs around them still collect into the binding's
`docs` Vec.

A binding's docs are not lost in the AST — they end up on the
descriptor that [Reflection](#reflection) exposes through the
`reify` operand. The full example sits in the `reify` subsection;
here it is enough to know that docs are addressable.

#### Enrichment via shadowing

Docs are frozen into the conduit at `let` evaluation. To add or
remove remarks after the fact, redeclare the binding with a
different set of doc comments — shadowing writes a new conduit to
the same binding slot, and subsequent lookups see the new docs.
This is the pipeline-first analogue of "editing": rebind instead
of mutate.

## Error track

Every chapter so far has been success-track: each step received a
normal value and produced a normal value. Error track covers the
other side — what happens when a step fails, how the failure
propagates, and how to recover.

When a step produces a failure — a type mismatch in projection,
an arity error, a division by zero — the result is an error value
(the `!{}` type from Part 1). At that point, the success-track
combinators `|`, `*`, and `>>` switch behavior: instead of firing
the next step, they **deflect** — they record the upcoming step's
AST node onto the error's `:trail` Vec and let the error flow
through unchanged. The entire success-track pipeline after the
failure becomes a no-op; the error rides through to the end.

```qlang
> "hello" | add(1) | mul(2) | sub(3)
!{:kind :type-error ...}
|~| add(1) produces the error; mul(2) and sub(3) are deflected
```

The `!|` combinator is the **fail-track** counterpart. It fires its
step only when `pipeValue` is an error value, exposing the error's
*materialized descriptor* Map as the new `pipeValue`. On a non-error
`pipeValue`, `!|` is a pass-through.

```qlang
> "hello" | add(1) | mul(2) !| /kind
:type-error

> "hello" | add(1) | mul(2) !| /trail * /text
["mul(2)"]
|~| mul(2) was deflected; add(1) produced the error
```

### Descriptor and `:trail`

When `!|` fires, it materializes the error's descriptor — the
descriptor Map with `:trail` combined from any pre-existing entries
plus the deflections recorded since the last materialization.

Each entry in `:trail` is an **AST-Map** — the structured data-form
of the deflected step, carrying its `:qlang/kind` discriminator,
`:name`, `:args`, `:location`, and a `:text` field with the source
substring. Downstream code can filter, project, or re-eval trail
entries as ordinary qlang data; the `:text` projection is the
human-readable display form.

```qlang
> !{:kind :oops} | count | add(1) !| /trail * /text
["count" "add(1)"]

> !{:kind :oops} | count | add(1) !| /trail | first | /name
"count"
```

The `!{}` literal from Part 1 can seed an error directly — the
example above uses it to bypass the need for a failing step.

### `error` and `isError` operands

`error` lifts a Map into an error value — bare form (`map | error`)
or full form (`error(map)`):

```qlang
> error({:kind :oops}) !| /kind
:oops
```

`isError` is a plain predicate over `pipeValue`. Because `|`
deflects errors before it could fire `isError`, it is used primarily
at raw first-step positions inside predicate lambdas of higher-order
operands:

```qlang
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

### Error descriptor fields

| Field | Type | Content |
|---|---|---|
| `:origin` | keyword | `:qlang/eval` for runtime, `:host` for foreign, `:user` for user-created |
| `:kind` | keyword | `:type-error`, `:arity-error`, `:division-by-zero`, `:unresolved-identifier`, `:effect-laundering` |
| `:thrown` | keyword | Per-site class name: `:AddLeftNotNumber`, `:FilterSubjectNotVec`, etc. |
| `:message` | string | Human-readable description |
| `:trail` | Vec | AST-Maps for each step that a success-track combinator deflected |

Additional context fields vary by error site (`:operand`,
`:expectedType`, `:actualType`, `:position`, `:index`, etc.).

### Trail continuity across re-lift

When a step under `!|` returns a Map and a later `| error` re-wraps
it, the new error's descriptor carries the `:trail` Vec the step
handed back. Subsequent deflections accumulate into a fresh
`_trailHead` linked list, and the next `!|` combines both sources
again. This is the mechanism behind MDC-style context enrichment:

```qlang
!| union({:request @requestId}) | error
|~| adds fields to the descriptor and re-lifts without losing the trail
```

---

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

---

## Reflection

Pipeline through Names and modules showed how values
transform: operands run, the binding scope grows, the error track
surfaces structured failures. This chapter covers operations that
treat the binding scope itself as data — readable, writable,
enumerable — and that lift source text into the same data space
as ordinary values. The binding scope, at last, gets its
operand-level name: `env`.

Three mechanisms close the "everything is data" ring:

1. **Code is data** — `parse` lifts source text into an AST-Map;
   `eval` runs it. The intermediate Map is addressable by ordinary
   qlang projection.
2. **Runtime is data** — built-ins without arguments evaluate to
   their own descriptor Map (not an arity error). `manifest` gives
   the full env as a Vec of descriptors.
3. **Errors are data** — `!|` materializes the trail as a Vec of
   AST-Maps. Each deflected step is a structured Map, not a string.
   (Covered in [Error track](#error-track).)

All three use the same mechanism: Map + pipeline.

### `env` — read the current environment

The `env` operand returns the full current `env` Map as `pipeValue`.
Every binding — built-in operands, domain functions, `let`
conduits, `as` snapshots — is a field in this Map.

```qlang
env | /count                |~| the built-in count function
env | manifest | count      |~| how many bindings are in scope
```

### `reify` — get a binding's descriptor

`reify` builds a **descriptor Map** for a binding. The Map's
shape depends on what kind of binding it represents — built-in
operand, `let`-bound conduit, `as`-bound snapshot, or plain
value — but always carries enough metadata for tooling to render
it without consulting the JS implementation.

Two surface forms:

- **Value form** — `pipeValue | reify`. Reads the current
  pipeValue and builds its descriptor.
- **Named form** — `reify(:name)`. Looks up `:name` in the
  binding scope and builds a descriptor for whatever lives there,
  always stamping `:name` on the result.

**Builtin descriptor** — produced for any built-in operand
loaded by `langRuntime` from `lib/qlang/core.qlang`:

```
{:kind     :builtin
 :name     "count"
 :category :vec-reducer
 :subject  [:vec :set :map]
 :modifiers []
 :returns  :number
 :captured [0 0]
 :docs     ["Returns the number of elements. ..."]
 :examples [{:doc "Vec length" :snippet "[1 2 3] | count" :expected "3"}
            ...]
 :throws   [:CountSubjectNotContainer]
 :effectful false}
```

The `:captured` field is a 2-element Vec `[min, max]` describing
how many captured args the operand accepts; fixed-arity operands
have `min == max`, partial/full operands have `[n-1, n]`,
variadic operands use the `:unbounded` keyword as the upper
bound.

**Conduit descriptor** — produced for any `let`-bound binding:

```
{:kind   :conduit
 :name   "surround"
 :params ["pfx" "sfx"]
 :source "(prepend(pfx) | append(sfx))"
 :docs   ["Wraps a string between a prefix and suffix."]
 :effectful false
 :location {:start ... :end ...}}
```

The `:source` field carries the body's original source substring
verbatim from the parser, so `reify` reproduces what the user
typed and not a re-rendered AST.

**Snapshot descriptor** — produced for any `as`-bound binding:

```
{:kind  :snapshot
 :name  "captured"
 :value <the wrapped value>
 :type  :vec
 :docs  []
 :effectful false}
```

**Value descriptor** — produced for any other Map / Vec / Set /
scalar that does not carry the binding-kind discriminator:

```
{:kind  :value
 :name  null
 :value <the value>
 :type  :number}
```

Once a descriptor is in `pipeValue`, it is an ordinary Map and
every Map operand (`/key`, `has`, `keys`, `vals`, `union`,
`filter`, `eq`, ...) applies to it. This is how the doc comments
attached to a `let` in [Comments](#comments) become reachable:

```qlang
|~| reify(:foo) | /docs
|~| → ["First remark." "Second remark." "Block-form remark\n    with internal newlines."]
```

#### Bare-name introspection ergonomic

There is one extra rule that pairs with `reify`: if you type the
**bare name** of a built-in that takes at least one captured
argument, the lookup yields the **descriptor Map** for that
built-in instead of an arity error. The descriptor is the same
shape `reify` would have produced for the same name.

```qlang
> mul | /category
:arith

> reify(:filter) | /captured
[1 1]

> reify(:coalesce) | /captured
[1 :unbounded]
```

The first example shows the **bare-name shortcut**: `mul` is a
non-nullary operand (its minimum captured-arg count is 1), so a
bare `mul` lookup short-circuits into the descriptor instead of
firing as an arity error. The second and third examples take the
explicit `reify(:name)` route, which works regardless of arity
and is the right form when scripting catalog inspection.

Nullary operands (`count`, bare-form `sort`, `env`, `manifest`,
`runExamples`) still fire on bare lookup because their valid call
shape IS the bare form; only operands whose minimum captured
count is greater than zero short-circuit into the descriptor.

### `manifest` — list all bindings

`manifest` returns the full binding scope as a Vec of descriptors
— one per binding, sorted alphabetically by name. Each descriptor
has the same shape `reify(:name)` would produce for that binding.

```qlang
env | manifest | filter(/kind | eq(:builtin)) | count
|~| how many built-in operands are in scope

env | manifest | filter(/effectful) * /name
|~| names of all effectful operands in scope
```

### `runExamples` — execute a descriptor's `:examples`

Every built-in descriptor carries an `:examples` Vec listing
illustrative `> snippet → result` pairs. `runExamples` is the
self-test driver: given a descriptor as `pipeValue`, it parses
and evaluates each example, comparing actual against expected
where an `:expected` field is supplied.

```qlang
reify(:count) | runExamples
|~| → [{:snippet "[1 2 3] | count" :expected "3" :actual 3 :error null :ok true}
|~|    {:snippet "#{:a :b} | count" :expected "2" :actual 2 :error null :ok true}
|~|    ...]

env | manifest | filter(/kind | eq(:builtin))
              * runExamples
              >> /ok
              | distinct
|~| catalog-wide self-test: every example, every operand, one Vec
|~| of booleans showing whether the doc still matches the runtime
```

Examples that omit `:expected` (demo-mode entries that depend on
host-supplied bindings to make sense) are parse-checked but not
evaluated, and `runExamples` marks them `:ok true` if they at
least parse. Assertion-mode examples (with `:expected`) are fully
evaluated and compared via `deepEqual`.

### `parse` — source text → AST-Map

`parse` lifts a source string into an AST-Map. The intermediate Map
is ordinary qlang data — addressable by projection, filterable by
`filter`, passable to `eval`.

Every AST-Map carries a `:qlang/kind` discriminator naming its AST
node type (`:NumberLit`, `:StringLit`, `:Pipeline`, `:OperandCall`,
`:Projection`, `:Keyword`, `:VecLit`, `:MapLit`, `:ErrorLit`,
`:SetLit`, …) plus the type-specific payload fields described in
[qlang-operands.md](qlang-operands.md#parse).

```qlang
> "1 | add(1)" | parse | /:qlang/kind
:Pipeline

> "1 | add(1)" | parse | /steps | count
2

> "add(2, 3)" | parse | /name
"add"

> "add(2, 3)" | parse | /args | count
2
```

The AST-Map shape is the same shape used in `:trail` entries from
Error track — closing the code-is-data ring. Each trail entry was
an AST-Map of a deflected step; `parse` produces AST-Maps of any
source text by the same mechanism.

### `eval` — run code from data

`eval` takes an AST-Map from `pipeValue` and evaluates it against
the current state. It is a nullary operand — no captured arguments
— because the AST-Map is threaded through `pipeValue`, not passed
as a captured expression. Pair with `parse` to round-trip source
text through the data plane:

```qlang
> "42" | parse | eval
42

> "10 | add(5)" | parse | eval
15

> "[1 2 3] | filter(gt(1)) | count" | parse | eval
2
```

`parse` + `eval` together complete the homoiconic ring: qlang code
can be read, inspected, transformed, and re-executed as ordinary
data using the same pipeline idioms used for any other Map.

---

## Evaluation rules

Evaluation threads a **state pair** `(pipeValue, env)` through each
pipeline step. `pipeValue` is the current value flowing through;
`env` is the environment Map (bindings and built-ins). Every step
is a pure function `(pipeValue, env) → (pipeValue', env')`. For the
full formal model — including fork semantics, bootstrap, and Rule 10
details — see [qlang-internals.md](qlang-internals.md).

Six step types:

| # | Form | Effect on `(pipeValue, env)` |
|---|---|---|
| 1 | literal (string, number, boolean, null, keyword, Vec, Map, Set, Error) | → `(lit, env)`. Compound literals (`[a,b]`, `{:k v}`, `#{a,b}`, `!{:k v}`) fork per element/entry and evaluate each as a sub-pipeline against the outer state. `!{...}` produces an error value. |
| 2 | `/key` projection | → `(pipeValue[:key], env)`. `null` if missing. **Type error** if `pipeValue` is not a Map. Nested `/a/b` = `/a \| /b`. |
| 3 | identifier `name` or `name(arg₁..argₖ)` | → lookup `env[:name]`. If function, apply via Rule 10 (see below). If non-function value, replace `pipeValue`. If absent, unresolved-identifier error. Reflective operands `use`, `env`, `reify`, `manifest` resolve through this same path and may read or write the full state. Control-flow operands `if`, `when`, `unless`, `coalesce`, `firstTruthy` also resolve here, evaluating their captured branches lazily so only the selected branch executes. |
| 4 | `as(:name)` | → `(pipeValue, env[:name := Snapshot(pipeValue, docs)])`. Identity on the value; names the current snapshot. Any doc comments immediately preceding the `as` attach to the snapshot. |
| 5 | `let(:name, expr)` / `let(:name, [:p..], expr)` | → `(pipeValue, env[:name := Conduit(expr, params, envRef, docs)])`. Writes a lexically-scoped conduit. When `name` is later looked up, the conduit's body is evaluated in a fork with the declaration-time env (lexical scope via envRef tie-the-knot) plus conduit-parameter proxies for each captured arg. Recursion works via self-reference in the tied env. Any doc comments immediately preceding the `let` attach to the conduit. |
| 6 | comment (`\|~\|`, `\|~ ~\|`, `\|~~\|`, `\|~~ ~~\|`) | → `(pipeValue, env)`. Pure identity. Plain forms are standalone PipeSteps; doc forms attach as `docs` metadata to the immediately following binding step (`let` or `as`), accumulating as a Vec across multiple doc comments before the same binding. Doc comments must be followed by a binding step; preceding any other Primary form, the grammar falls through to non-doc alternatives. |

Combinators thread state between steps. `|`, `*`, and `>>` are
**success-track** combinators — they fire their step when `pipeValue`
is a non-error value, and **deflect** on an error (appending the
upcoming step's AST node to the error's `:trail` and letting the
error flow downstream unchanged). `!|` is the **fail-track**
combinator — it fires its step only when `pipeValue` is an error,
exposing the error's materialized descriptor Map to the step; on a
success `pipeValue` it deflects as identity pass-through.

| Combinator | Effect |
|---|---|
| `a \| b` | eval `a`, pipe resulting `(pipeValue, env)` into `b`. On error `pipeValue`, deflect: append `b`'s AST node to the trail and return the error unchanged. |
| `a !\| b` | eval `a`; if the resulting `pipeValue` is an error, combine the descriptor's `:trail` Vec with any new `_trailHead` deflections into a fresh materialized descriptor Map, then eval `b` against that Map as the new `pipeValue`. On a non-error `pipeValue`, pass through unchanged (identity). |
| `a * b` | eval `a` (must be Vec). For each element, fork to `(element, env)`, run `b`, collect inner `pipeValue'`. Result is Vec of collected values; outer `env` preserved. On error `pipeValue`, deflect. |
| `a >> b` | eval `a`, flatten one level, pipe into `b`. Equivalent to `a \| flat \| b`. On error `pipeValue`, deflect. |

**Fork** opens on entry to `(...)`, `[...]`, `{...}`, `#{...}`.
Inner sub-pipeline starts with a copy of outer `(pipeValue, env)`.
When it finishes, the inner `pipeValue'` becomes the result, but
the inner `env'` is discarded. This one rule produces the seven
scoping rules listed in [Scoping rules](#scoping-rules).

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

`|`, `!|`, `*`, `>>` — left-associative, equal precedence:

```qlang
a | b * c !| d >> e  =  ((((a | b) * c) !| d) >> e)
```

`()` scopes sub-expressions:

```qlang
filter(/age | gt(18))
|~| /age | gt(18) is a complete sub-pipeline inside ()
```

### Error conditions

| Condition | Error |
|---|---|
| `/key` on non-Map (Scalar, Vec, Set, null, function) | type error |
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

---

## Lexical structure

### Tokens

| Token | Pattern | Examples |
|---|---|---|
| String | `"` chars `"` | `"hello"`, `""` |
| Number | `-`? digits (`.` digits)? (`e`/`E` (`+`/`-`)? digits)? | `42`, `-3.14`, `1e10`, `2.5e-3` |
| Boolean | `true` \| `false` | |
| Null | `null` | |
| Keyword | `:` (ident \| namespaced \| quoted-string) | `:name`, `:qlang/error`, `:"foo bar"` |
| Ident | (alpha \| `@` \| `_`) (alnum \| `-` \| `_`)* | `count`, `my-fn`, `@callers`, `_private` |
| Projection | `/` keyseg (`/` keyseg)* | `/name`, `/a/b/c`, `/"foo bar"`, `/"a.b"/"$ref"` |
| KeySeg | quoted-string \| ident | `name`, `"foo bar"` |
| Pipe | `\|` | |
| FailApply | `!\|` | |
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

Pipeline      ← ('!|' _)? DocAttached (Combinator DocAttached / PlainComment)*
DocAttached   ← DocComment* OperandCall / DocComment* RawStep
RawStep       ← Primary
Combinator    ← '|' / '!|' / '*' / '>>'

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
MapEntry      ← String ':' Pipeline  (JSON-style string key, converted to keyword)
              / Keyword Pipeline      (qlang-style :key)

Set           ← '#{' (Pipeline (','? Pipeline)*)? '}'

Vec           ← '[' (Pipeline (','? Pipeline)*)? ']'

Operand       ← Ident ('(' (Pipeline (','? Pipeline)*)? ')')?

Projection    ← '/' KeySeg ('/' KeySeg)*
KeySeg        ← ':' NamespacedName / ':' Ident
               / QuotedKeywordName / Ident

Scalar        ← String / Number / Boolean / Null / Keyword
Keyword       ← ':' QuotedKeywordName / ':' NamespacedName / ':' KeywordName
KeySeg        in Projection also accepts ':' KeywordName so reserved words
              (:null, :true, :false, /null, /true, /false) are valid key paths
NamespacedName    ← Ident ('/' Ident)+
QuotedKeywordName ← '"' DoubleStringChar* '"'
KeywordName       ← [@_a-zA-Z] [a-zA-Z0-9_-]*  (Ident without !ReservedWord guard)
Ident             ← [@_a-zA-Z] [a-zA-Z0-9_-]*  (same shape, !ReservedWord guard)
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
- `{` `:` → Map (qlang-style `:key expr` entry)
- `{` `"` → Map (JSON-style `"key": expr` entry; string key converts to keyword)
- `#{` → Set
- `[` → Vec (elements evaluated against current `pipeValue`)
- `/:` → keyword projection segment (namespaced key)
- `/ident` or `/null` `/true` `/false` → bare projection segment

### Reserved words

```
true false null
```

`let` and `as` are ordinary identifiers bound to operands in
`langRuntime`. They can be shadowed like any other name.
All other identifiers are resolved at evaluation time against
the current `env`.

---

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

|~| JSON paste: copy raw JSON, pipe straight into qlang operations
> {"users": [
    {"name": "alice", "score": 8.5e1},
    {"name": "bob",   "score": 7.2e1},
    {"name": "carol", "score": 9.3e1}
  ]}
  | /users | filter(/score | gte(85)) * /name
["alice" "carol"]

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

---

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
| null | `null` |
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
