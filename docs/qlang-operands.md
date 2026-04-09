# Query Language — Core Runtime Reference

This document catalogs the built-in operands of the query language.
Every entry lives as a field of the language runtime Map
(`langRuntime` in the bootstrap), so identifier lookup resolves them
the same way as any other binding in `env`. See
[qlang-internals.md](qlang-internals.md) for the
evaluation model and [qlang-spec.md](qlang-spec.md)
for the language syntax.

## Convention

Each entry lists:

- **Name** — the identifier as it appears in a query.
- **Arity** — total number of positional arguments, including the
  subject. Rule 10 governs partial vs full application.
- **Subject** — the first argument, which is filled by pipeline
  input in partial application.
- **Behavior** — what the operand computes.
- **Examples** — at least one `> query → result` pair.
- **Errors** — type mismatches or runtime failures.

All signatures follow the **subject-first convention**: position 1
is the data being operated on (filled by the pipeline in partial
form), positions 2..n are modifiers (filled by captured args).

## Vec reducers — `Vec → Scalar`

### `count`

- **Arity** 1. **Subject** `vec`.
- Returns the number of elements.
- **Example**: `[1 2 3 4 5] | count` → `5`; `[] | count` → `0`.
- **Errors**: subject not a Vec → type error. (Also defined for
  Set and Map under their own sections.)

### `empty`

- **Arity** 1. **Subject** `vec`.
- Returns `true` if the Vec has zero elements, `false` otherwise.
- **Example**: `[] | empty` → `true`; `[1] | empty` → `false`.

### `first`

- **Arity** 1. **Subject** `vec`.
- Returns the first element, or `nil` if the Vec is empty.
- **Example**: `[10 20 30] | first` → `10`; `[] | first` → `nil`.

### `last`

- **Arity** 1. **Subject** `vec`.
- Returns the last element, or `nil` if the Vec is empty.
- **Example**: `[10 20 30] | last` → `30`; `[] | last` → `nil`.

### `sum`

- **Arity** 1. **Subject** `vec`.
- Returns the numeric sum of elements. Empty Vec yields `0`.
- **Example**: `[1 2 3 4] | sum` → `10`; `[] | sum` → `0`.
- **Errors**: any element not a number → type error.

### `min`, `max`

- **Arity** 1. **Subject** `vec`.
- Returns the minimum (or maximum) element under the natural
  ordering. Empty Vec yields `nil`.
- **Example**: `[3 1 4 1 5] | min` → `1`; `[3 1 4 1 5] | max` → `5`.
- **Errors**: elements not comparable → type error.

## Vec transformers — `Vec → Vec`

### `filter(pred)`

- **Arity** 2. **Subject** `vec`, **modifier** `pred` (a predicate
  pipeline).
- Keeps elements where the predicate evaluates truthy. The
  predicate is applied per element via sub-fork.
- **Examples**:
  - `[1 2 3 4 5] | filter(gt(2))` → `[3 4 5]`.
  - `[{:age 25} {:age 15}] | filter(/age | gte(18))` → `[{:age 25}]`.

### `sort`

- **Arity** 1. **Subject** `vec`.
- Returns a new Vec sorted in natural (ascending) order.
- **Example**: `[3 1 4 1 5] | sort` → `[1 1 3 4 5]`.
- **Errors**: elements not comparable → type error.

### `sort(key)`

- **Arity** 2. **Subject** `vec`, **modifier** `key` (a projection
  pipeline).
- Returns a new Vec sorted by the value returned by `key` for each
  element.
- **Example**: `[{:age 30} {:age 20}] | sort(/age)` → `[{:age 20} {:age 30}]`.

### `sortWith(cmp)`

- **Arity** 2. **Subject** `vec`, **modifier** `cmp` (a comparator
  sub-pipeline).
- Sorts using a custom comparator. The comparator receives a pair
  Map `{ :left a :right b }` for each comparison and must return a
  number: negative places `left` before `right`, positive places
  `right` before `left`, zero treats them as equal (preserving the
  order of equal elements per JS Array.sort stability).
- **Examples**:
  - `[3 1 2] | sortWith(sub(/left, /right))` → `[1 2 3]`.
  - `[3 1 2] | sortWith(sub(/right, /left))` → `[3 2 1]`.
  - `people | sortWith(asc(/age))` → people sorted youngest-first.
  - `events | sortWith([asc(/priority), desc(/timestamp)] | firstNonZero)`
    → events sorted by priority ascending, then timestamp descending
    as tie-breaker.
- **Errors**: subject not a Vec → type error; comparator returns
  non-number → type error.

### `asc(keyExpr)`

- **Arity** 2. **Subject** pair Map `{ :left x :right y }` (provided
  by `sortWith`), **modifier** `keyExpr` (any sub-pipeline).
- Builds an ascending comparator. Applied per-pair, projects the
  key from `/left` and `/right` via the captured sub-pipeline and
  compares them in natural ascending order. Returns -1, 0, or 1.
- The key sub-pipeline can be any expression — a bare projection
  (`/age`), a computed value (`mul(/price, /qty)`), a multi-step
  pipeline.
- **Examples**:
  - `sortWith(asc(/age))` → ascending by `:age`.
  - `sortWith(asc(mul(/price, /qty)))` → ascending by computed total.
  - `sortWith(asc(/profile/joined))` → ascending by nested field.
- **Errors**: pair subject not a Map → type error; left and right
  keys not comparable scalars of the same type → type error.

### `desc(keyExpr)`

- **Arity** 2. **Subject** pair Map, **modifier** key sub-pipeline.
- Same as `asc` but reversed: higher key values come first.
- **Examples**:
  - `sortWith(desc(/timestamp))` → most recent first.
  - `sortWith(desc(/score))` → highest score first.
- **Errors**: pair subject not a Map → type error; keys not
  comparable → type error.

### `firstNonZero`

- **Arity** 1. **Subject** Vec of numbers.
- Returns the first non-zero number in the Vec. If all elements
  are zero (or the Vec is empty), returns 0.
- The composition primitive for compound comparators in `sortWith`:
  pair with a Vec literal of comparators to express lexicographic
  ordering. Each comparator returns -1/0/1, and `firstNonZero`
  picks the first non-tie.
- **Examples**:
  - `[0 0 -1 0] | firstNonZero` → `-1`.
  - `[0 0 0] | firstNonZero` → `0`.
  - `sortWith([asc(/lastName), desc(/age)] | firstNonZero)` →
    sort by last name ascending, age descending as tie-breaker.
- **Errors**: subject not a Vec → type error; any element not a
  number → type error.

### `take(n)`

- **Arity** 2. **Subject** `vec`, **modifier** `n` (non-negative int).
- Returns the first `n` elements. If `n` exceeds length, returns the
  whole Vec.
- **Example**: `[1 2 3 4 5] | take(3)` → `[1 2 3]`.

### `drop(n)`

- **Arity** 2. **Subject** `vec`, **modifier** `n` (non-negative int).
- Returns the Vec with the first `n` elements removed. If `n`
  exceeds length, returns `[]`.
- **Example**: `[1 2 3 4 5] | drop(2)` → `[3 4 5]`.

### `distinct`

- **Arity** 1. **Subject** `vec`.
- Returns a new Vec with duplicate elements removed, preserving
  first-occurrence order.
- **Example**: `[1 2 1 3 2] | distinct` → `[1 2 3]`.

### `reverse`

- **Arity** 1. **Subject** `vec`.
- Returns the Vec in reverse order.
- **Example**: `[1 2 3] | reverse` → `[3 2 1]`.

### `flat`

- **Arity** 1. **Subject** `vec`.
- Flattens one level of nesting. Elements that are Vecs are
  spliced in; other elements pass through unchanged.
- **Example**: `[[1 2] [3] [4 5]] | flat` → `[1 2 3 4 5]`.
- **Errors**: subject not a Vec → type error.

### `set`

- **Arity** 1. **Subject** `vec`.
- Converts a Vec to a Set, removing duplicates.
- **Example**: `[1 2 1 3] | set` → `#{1 2 3}`.

## Map operations

### `keys`

- **Arity** 1. **Subject** `map`.
- Returns the Set of keys (keywords).
- **Example**: `{:name "Alice" :age 30} | keys` → `#{:name :age}`.

### `vals`

- **Arity** 1. **Subject** `map`.
- Returns a Vec of values, in insertion order.
- **Example**: `{:name "Alice" :age 30} | vals` → `["Alice" 30]`.

### `has(key)`

- **Arity** 2. **Subject** `map`, **modifier** `key` (a keyword).
- Returns `true` if the Map contains the key, `false` otherwise.
- **Example**: `{:name "Alice"} | has(:name)` → `true`;
  `{:name "Alice"} | has(:age)` → `false`.

## Set operations

### `has(value)`

- **Arity** 2. **Subject** `set`, **modifier** `value`.
- Returns `true` if the value is a member of the Set.
- **Example**: `#{:a :b :c} | has(:b)` → `true`.

### `count` (on Set)

- **Arity** 1. **Subject** `set`.
- Returns the number of members.
- **Example**: `#{:a :b :c} | count` → `3`.

### `empty` (on Set)

- **Arity** 1. **Subject** `set`.
- Returns `true` if the Set has zero members.
- **Example**: `#{} | empty` → `true`.

## Polymorphic set operations — `union`, `minus`, `inter`

These three operands are polymorphic across Set and Map
combinations and overloaded by captured-arg count. Three call
shapes are supported:

### Bound form — one captured arg

- **Arity** 2. **Subject** `left`, **modifier** `right`.
- Applied under Rule 10 partial: `left | union(right)` evaluates
  `right` as a sub-expression against `left` as context.
- **Examples**:
  - Enrich a Map: `{:name "a" :age 20} | union({:adult /age | gt(18)})`
    → `{:name "a" :age 20 :adult true}`.
  - Drop fields: `{:name "a" :age 20 :tmp 1} | minus(#{:tmp})`
    → `{:name "a" :age 20}`.
  - Select fields: `{:name "a" :age 20 :tmp 1} | inter(#{:name :age})`
    → `{:name "a" :age 20}`.
  - Override: `{:name "a" :age 20} | union({:age /age | add(1)})`
    → `{:name "a" :age 21}`.

### Bare form — zero captured args

- **Arity** 1. **Subject** `vec` — a non-empty Vec of operands.
- Left-fold: `[a, b, c] | union` = `(a ∪ b) ∪ c`. Same for `minus`
  and `inter`.
- **Examples**:
  - `[#{:a :b :c} #{:b :d}] | union` → `#{:a :b :c :d}`.
  - `[#{:a :b :c} #{:b :d}] | minus` → `#{:a :c}`.
  - `[#{:a :b :c} #{:b :d}] | inter` → `#{:b}`.
  - `[{:name "a"} {:score 100}] | union`
    → `{:name "a" :score 100}`.
- **Errors**: empty Vec → type error (no identity element).

### Full form — two captured args

- **Arity** 2 full application. Both slots captured; `pipeValue`
  becomes the context for resolving them.
- **Example**:
  - `{:p {:a 1} :q {:b 2}} | union(/p, /q)` →
    `{:a 1 :b 2}`.

### Type dispatch

| Operand | Set × Set   | Map × Map              | Map × Set   |
|---------|-------------|------------------------|-------------|
| `union` | S₁ ∪ S₂     | M₁ ∪ M₂ (last wins)    | —           |
| `minus` | S₁ ∖ S₂     | M₁ ∖ keys(M₂)          | M ∖ S       |
| `inter` | S₁ ∩ S₂     | M₁ ∩ keys(M₂)          | M ∩ S       |

`M × M` for `minus` removes keys present in `M₂` from `M₁` (values
of `M₂` are ignored). `M × M` for `inter` keeps keys present in both
and takes values from `M₁`.

**Errors**: incompatible types (e.g., Set and number) → type error.

## Arithmetic — `Scalar → Scalar`

### `add(n)` / `add(a, b)`

- **Arity** 2. **Subject** `a`, **modifier** `b`.
- Unary partial form: `a | add(b)` = `a + b`.
- Full form: `add(a, b)` — both captured, `pipeValue` is context.
- **Example**: `10 | add(3)` → `13`; `{:x 10 :y 3} | add(/x, /y)` → `13`.

### `sub(n)` / `sub(a, b)`

- **Arity** 2. Non-commutative: `a - b` (position 1 minuend).
- **Example**: `10 | sub(3)` → `7`; `{:x 10 :y 3} | sub(/x, /y)` → `7`.

### `mul(n)` / `mul(a, b)`

- **Arity** 2. Commutative.
- **Example**: `10 | mul(3)` → `30`; `{:x 5 :y 4} | mul(/x, /y)` → `20`.

### `div(n)` / `div(a, b)`

- **Arity** 2. Non-commutative: `a / b` (position 1 dividend).
- **Example**: `10 | div(2)` → `5`; `{:x 20 :y 4} | div(/x, /y)` → `5`.
- **Errors**: divisor = 0 → division-by-zero error.

## String

### `prepend(s)`

- **Arity** 2. **Subject** `string`, **modifier** `s`.
- Returns `s` concatenated in front of the subject.
- **Example**: `"world" | prepend("hello ")` → `"hello world"`.

### `append(s)`

- **Arity** 2. **Subject** `string`, **modifier** `s`.
- Returns the subject concatenated with `s` on the right.
- **Example**: `"hello" | append(" world")` → `"hello world"`.

### `split(separator)`

- **Arity** 2. **Subject** `string`, **modifier** `separator` (string).
- Returns a Vec of substrings obtained by splitting the subject
  on every occurrence of `separator`.
- **Examples**:
  - `"a,b,c" | split(",")` → `["a" "b" "c"]`.
  - `"line1\nline2\nline3" | split("\n")` → `["line1" "line2" "line3"]`.
  - `"" | split(",")` → `[""]`.
- **Errors**: subject not a string → type error; separator not a
  string → type error.

### `join(separator)`

- **Arity** 2. **Subject** `vec` of strings, **modifier** `separator` (string).
- Returns a single string: all elements of the subject Vec joined
  with `separator` between consecutive elements.
- **Examples**:
  - `["a" "b" "c"] | join(",")` → `"a,b,c"`.
  - `["x" "y"] | join("")` → `"xy"`.
  - `[] | join(",")` → `""`.
- **Errors**: subject not a Vec → type error; any element not a
  string → type error; separator not a string → type error.

`split` and `join` are inverses: `"a,b,c" | split(",") | join(",")`
round-trips to `"a,b,c"`.

## Boolean

### `not`

- **Arity** 1. **Subject** any value.
- Returns `true` if the subject is falsy (`nil` or `false`),
  `false` otherwise.
- **Example**: `nil | not` → `true`; `0 | not` → `false` (0 is truthy).

## Predicates

### `eq(value)`

- **Arity** 2. Returns `true` if subject equals the captured value
  by structural equality.
- **Example**: `42 | eq(42)` → `true`; `{:a 1} | eq({:a 1})` → `true`.

### `gt(n)`, `lt(n)`

- **Arity** 2. Subject-first: `a | gt(b)` = `a > b`.
- **Example**: `10 | gt(5)` → `true`; `10 | lt(5)` → `false`.

### `gte(n)`, `lte(n)`

- **Arity** 2. Subject-first: `a | gte(b)` = `a ≥ b`.
- **Example**: `10 | gte(10)` → `true`; `10 | lte(5)` → `false`.

### `and(a, b)`

- **Arity** 2. Returns `true` if both `a` and `b` are truthy. Used
  in full form inside predicates: `filter(and(/active, /age | gt(18)))`.
- **Example**: `filter(and(/active, /age | gt(18)))` keeps active
  adults.

### `or(a, b)`

- **Arity** 2. Returns `true` if either `a` or `b` is truthy.
- **Example**: `filter(or(/vip, /score | gt(95)))` keeps VIPs or
  high-scorers.

## Formatting

### `json`

- **Arity** 1. **Subject** any value.
- Returns a JSON string representation of the subject.
- **Example**: `{:a 1 :b [2 3]} | json` → `"{\"a\":1,\"b\":[2,3]}"`.

### `table`

- **Arity** 1. **Subject** a Vec of Maps.
- Returns a string with the Maps rendered as a tabular layout
  (columns derived from keys). Useful for human-readable output.
- **Errors**: subject not a Vec of Maps → type error.

## Control flow

### `if(cond, then, else)`

- **Arity** 4. **Subject** any value (the current `pipeValue`),
  **modifiers** three captured sub-pipelines.
- The `cond` sub-pipeline is evaluated against `pipeValue` and its
  result is checked for truthiness (per language rules: `nil` and
  `false` are falsy, everything else — including `0`, `""`, `[]`,
  `{}`, `#{}` — is truthy). If truthy, the `then` sub-pipeline is
  evaluated against the same `pipeValue` and its result becomes the
  new `pipeValue`. Otherwise the `else` branch runs the same way.
- All three arguments are captured sub-pipelines, so **only the
  selected branch executes**. The other branch is parsed but never
  evaluated, allowing patterns like `if(empty, "<empty>", first)`
  where `first` would otherwise raise on an empty Vec.
- **Examples**:
  - `score | if(gte(60), "pass", "fail")` → string label.
  - `employee | if(/active, /salary | mul(1.1), /salary)` →
    boosted or original salary.
  - `list | if(empty, "<empty>", first)` → safe head with fallback.
- **Errors**: none from `if` itself; errors raised inside the
  selected branch propagate.

### `when(cond, then)`

- **Arity** 3. **Subject** any value (`pipeValue`), **modifiers**
  two captured sub-pipelines.
- One-sided conditional with implicit identity on the false branch.
  If `cond` evaluated against `pipeValue` is truthy, `then` is run
  against `pipeValue` and its result becomes the new `pipeValue`.
  Otherwise `pipeValue` passes through unchanged.
- Both arguments are captured sub-pipelines, so `then` is only
  evaluated when the condition fires.
- **Examples**:
  - `employee | when(/active, /salary | mul(11) | div(10))` →
    boost active salaries by 10%, leave the rest as-is.
  - `list | when(empty, ["<empty>"])` → substitute marker only when
    the list is empty.
- **Errors**: none from `when` itself; errors raised inside the
  `then` branch propagate.

### `unless(cond, then)`

- **Arity** 3. Same shape as `when`. Inverse semantics: `then`
  runs when `cond` is **falsy**, otherwise `pipeValue` passes
  through unchanged.
- Equivalent to `when(cond | not, then)` but reads more naturally
  for guard-clause patterns where the action only fires when the
  condition fails.
- **Examples**:
  - `input | unless(empty, sort)` → sort only non-empty inputs.
  - `config | unless(/validated, validate)` → validate when not
    already validated.
- **Errors**: none from `unless` itself.

### `coalesce(...alts)`

- **Arity** variadic (1+). **Subject** `pipeValue`, **modifiers**
  one or more alternative sub-pipelines.
- Evaluates each alternative against `pipeValue` in order and
  returns the first one that produces a non-`nil` result. If all
  alternatives produce `nil`, the result is `nil`.
- **Falsy non-nil values** (`false`, `0`, `""`, `[]`, `{}`, `#{}`)
  are NOT skipped — only `nil`/`null`/`undefined` count as missing.
  This matches SQL `COALESCE` and JavaScript `??` semantics.
- **Short-circuits**: alternatives after the first non-nil match
  are not evaluated.
- **Examples**:
  - `person | coalesce(/preferredName, /firstName, "Anonymous")` →
    first available name with default fallback.
  - `config | coalesce(/userOverride, /projectDefault, /globalDefault)`
    → cascading defaults.
  - `lookup | coalesce(/cached, /computed)` → prefer cache.
- **Errors**: zero captured args → `CoalesceNoAlternatives`.

### `firstTruthy(...alts)`

- **Arity** variadic (1+). **Subject** `pipeValue`, **modifiers**
  one or more alternative sub-pipelines.
- Symmetric with `coalesce` but checks **truthiness** instead of
  nil-ness. Each alternative is evaluated against `pipeValue` in
  order; the first one that produces a truthy value becomes the
  new `pipeValue`. If all alternatives produce falsy values
  (`nil` or `false`), the result is `nil`.
- **Differs from `coalesce`** in that `false` is also skipped:
  `firstTruthy` treats `false` as "no value", `coalesce` treats
  it as a valid explicit setting. Note that `0`, `""`, `[]`, `{}`,
  `#{}` are truthy in qlang and therefore NOT skipped by either
  operand.
- **Short-circuits**: alternatives after the first truthy match
  are not evaluated.
- **Examples**:
  - `person | firstTruthy(/preferredName, /firstName, /lastName, "Anonymous")`
    → first non-empty name with default fallback.
  - `flag | firstTruthy(/userValue, /default, false)` → ignore
    explicit `false` user values, fall back to default.
- **Errors**: zero captured args → `FirstTruthyNoAlternatives`.

**Choosing between `coalesce` and `firstTruthy`:** use `coalesce`
for config cascading where `false` is a meaningful explicit
setting (user disabled feature, etc.); use `firstTruthy` for
display defaults where `false` is a sentinel meaning "no value".

## Reflective built-ins

`env`, `use`, `reify`, and `manifest` are **reflective operands**:
they read or write the full evaluator state rather than working
at the value level. All four are ordinary entries in `langRuntime`,
look up like any other identifier, and can be shadowed by `let`
or `as`. Their distinguishing feature is internal — the impl
receives `(state, lambdas)` directly instead of going through the
descend-compute-ascend pattern of pure operands.

### `env`

- **Arity** 1. **Subject** irrelevant — `env` ignores its
  pipeline input and reads the evaluator state instead.
- Replaces `pipeValue` with the current `env` as a Map value.
- **Examples**:
  - `env | keys` → a Set of all identifiers currently in scope.
  - `env | has(:count)` → `true` (count is a built-in).
  - `env | /taxRate` → the value of a user binding, or `nil`.
- Inside a fork, returns the fork's current `env` (including any
  fork-local `as` or `let` writes visible at the point of lookup).
- Captured arguments (`env(...)`) are an arity error.

### `use`

- **Arity** 1. **Subject** `map` — the Map whose entries become
  new bindings in `env`.
- Merges `pipeValue` (a Map) into `env`, returning a new state
  with the enlarged env; `pipeValue` is unchanged, so the merged
  Map can be inspected further or discarded by the next step.
  On conflict, the incoming Map wins.
- **Examples**:
  - Install constants: `{:pi 3.14159 :e 2.71828} | use | [pi, e]`
    → `[3.14159 2.71828]`.
  - Shadow a built-in: `let use = mul(2) | 5 | use` → `10`
    (the user's `let` shadows the reflective `use`).
- Inside a fork (paren-group, compound literal, distribute
  iteration), the merged bindings evaporate when the fork closes,
  matching the documented fork rule — only the final `pipeValue`
  of the sub-pipeline escapes.
- **Errors**: subject not a Map → type error. Captured arguments
  (`use(...)`) → arity error.

### `reify`

Overloaded by captured-arg count.

**Arity 1 (zero captured args) — value-level form.** Reads the
current `pipeValue` and produces a descriptor Map whose shape
depends on the value's provenance. Four descriptor kinds:

- **Builtin** — `pipeValue` is a frozen function value from
  `langRuntime`. Descriptor copies the function's registration
  metadata:
  ```
  {:kind     :builtin
   :name     "count"
   :category :vec-reducer
   :subject  "Vec, Set, or Map"
   :modifiers []
   :returns  "number"
   :captured [0 0]
   :docs     ["Returns the number of elements. Polymorphic over Vec, Set, Map."]
   :examples ["[1 2 3] | count → 3" "#{:a :b} | count → 2"]
   :throws   ["CountSubjectNotContainer"]}
  ```
  The `:captured` field is a 2-element Vec `[min, max]` describing
  the range of captured-arg counts the operand accepts. Fixed
  operands have `min == max` (e.g. `count` has `[0 0]`; `filter`
  has `[1 1]`). Partial/full-applicable operands have
  `[n-1, n]` (`add` has `[1 2]`). Overloaded operands span the
  Object keys of their impl dispatch table (`sort` has `[0 1]`).
  Variadic operands use the `:unbounded` keyword as the upper
  bound (`coalesce` has `[1 :unbounded]`). The field is always
  present.
- **Conduit** — `pipeValue` is a `let`-bound conduit (named
  pipeline fragment, zero or more parameters). Descriptor:
  ```
  {:kind   :conduit
   :name   "double"
   :params []
   :source "mul(2)"
   :docs   ["Удваивает число." "Impl note: реюз mul с partial-применением."]}
  ```
  Parametric conduits carry a non-empty `:params` Vec:
  ```
  {:kind   :conduit
   :name   "surround"
   :params ["pfx" "sfx"]
   :source "(prepend(pfx) | append(sfx))"
   :docs   []}
  ```
- **Snapshot** — `pipeValue` is an `as`-bound snapshot wrapper.
  Descriptor:
  ```
  {:kind :snapshot
   :name "captured"
   :value <snapshotted value>
   :type :vec
   :docs []}
  ```
- **Value** — any other Scalar, Vec, Map, or Set that is not a
  function or wrapper. Descriptor:
  ```
  {:kind :value
   :value <the value>
   :type :number}
  ```

**Arity 2 (one captured keyword) — named form.** `reify(:name)`
looks up `:name` in `env` and builds the descriptor for whatever
binding lives there, attaching a `:name` field in all cases
(including `:value` kind where the name would otherwise be
missing). This is the introspection-by-name path:

    reify(:count)    -- descriptor of the count builtin
    reify(:myVar)    -- descriptor of an as-binding
    reify(:double)   -- descriptor of a let-conduit

- **Errors**: more than one captured arg → arity error; the
  captured arg is not a keyword → type error; the name is not
  in `env` → unresolved-identifier error.

`reify` never mutates `env`.

### `manifest`

- **Arity** 1. **Subject** irrelevant — `manifest` ignores its
  pipeline input and iterates the current `env`.
- Returns a Vec of descriptors, one per binding in `env`, sorted
  alphabetically by binding name. Each descriptor has the same
  shape `reify(:name)` would produce for that binding.
- **Example**:
  ```
  env | manifest | filter(/kind | eq(:builtin)) | table
  ```
  Renders the full catalog of built-in operands as a tabular
  report grouped by category.
- Captured arguments (`manifest(...)`) → arity error.

## Summary: unique operand names by category

`count`, `empty`, and `has` are polymorphic — one identifier
dispatches on subject type. `sort` is overloaded by arity — same
identifier, 0 or 1 captured arg. `reify` is overloaded by arity
(value-level or named form). Each name is listed once.

| Category                | Names                                                 |
|-------------------------|-------------------------------------------------------|
| Vec reducers            | `count`, `empty`, `first`, `last`, `sum`, `min`, `max`, `firstNonZero` |
| Vec transformers        | `filter`, `sort`, `sortWith`, `take`, `drop`, `distinct`, `reverse`, `flat`, `set` |
| Comparator builders     | `asc`, `desc`                                          |
| Control flow            | `if`, `when`, `unless`, `coalesce`, `firstTruthy`      |
| Map operations          | `keys`, `vals`, `has` (polymorphic with Set)          |
| Polymorphic set ops     | `union`, `minus`, `inter`                             |
| Arithmetic              | `add`, `sub`, `mul`, `div`                            |
| String                  | `prepend`, `append`, `split`, `join`                  |
| Boolean                 | `not`                                                 |
| Predicates              | `eq`, `gt`, `lt`, `gte`, `lte`, `and`, `or`           |
| Formatting              | `json`, `table`                                       |
| Reflective              | `env`, `use`, `reify`, `manifest`                     |

**52 unique identifiers** in the initial `langRuntime` Map. Each
polymorphic / overloaded operand is one identifier regardless of
how many dispatch paths it carries.

## Tooling primitives

Beyond the operand catalog, the runtime ships a set of modules that
the operand library never imports but that embedders (editors,
notebooks, REPLs, language servers) consume directly. They live in
`qlang/src/` next to the evaluator and are re-exported from the
package entry.

### `walk.mjs` — AST traversal primitives

Single source of truth for the qlang AST shape. Every consumer that
needs to walk an AST imports from here instead of switching on
`node.type` itself.

- `astChildrenOf(node)` — yields the direct semantic children of an
  AST node. The only place in the runtime that knows the per-type
  child layout. When the grammar grows a new node type, only this
  function needs to learn about it.
- `walkAst(node, visit)` — pre-order recursive descent driven by
  `astChildrenOf`. The visitor may return `false` to skip a subtree.
- `assignAstNodeIds(root)` / `attachAstParents(root)` — post-parse
  decoration that gives every node a stable monotonic `.id` and a
  `.parent` pointer to its container.
- `findAstNodeAtOffset(ast, offset)` — narrowest-spanning AST node
  containing a UTF-16 source offset. Drives editor hover and
  goto-definition.
- `findIdentifierOccurrences(ast, name)` — every OperandCall,
  LetStep, AsStep, and Projection segment that names the given
  identifier. Drives find-references and rename refactoring.
- `bindingNamesVisibleAt(ast, offset)` — the lexical-scope-correct
  set of binding names visible at a cursor position. Honors
  fork-isolating ancestors (ParenGroup, VecLit, SetLit, MapLit,
  MapEntry) so a binding inside an inner ParenGroup is not visible
  after the group closes. Drives autocomplete.
- `astNodeSpan(node)` / `astNodeContainsOffset(node, offset)` —
  range arithmetic over node locations.
- `triviaBetweenAstNodes(nodeA, nodeB, ast)` — source slice between
  two adjacent nodes (whitespace, punctuation, plain comments).
  Lets a future formatter preserve original spacing without the
  grammar capturing trivia tokens.

### `session.mjs` — REPL / notebook session lifecycle

The persistent-state abstraction over `evalAst`. Owns an env and
threads it across multiple `evalCell` invocations so each cell sees
the bindings written by previous cells.

- `createSession(opts?)` — fresh session seeded with a `langRuntime`
  env (or a caller-provided env).
- `session.evalCell(source, opts?)` — parse and evaluate one cell.
  Returns `{ source, uri, ast, result, error, envAfterCell }`.
- `session.cellHistory` — read-only array of executed cells.
- `session.bind(name, value)` — install a binding directly into env
  (used by `deserializeSession` on restore).
- `session.takeSnapshot()` / `session.restoreSnapshot(snap)` —
  cheap save/restore of `(env, cellHistoryLength)` for "step back"
  features.
- `serializeSession(session)` — JSON-serializable payload of user
  bindings (thunks via stored body source, snapshots via tagged
  JSON, raw values via tagged JSON) plus cell history. Builtins
  are not serialized; they are reconstituted from `langRuntime` on
  restore.
- `deserializeSession(json)` — rebuilds a session from a serialized
  payload. Cell history is restored without re-evaluation.

### `codec.mjs` — tagged-JSON value codec

Single canonical encoder/decoder pair between qlang runtime values
(Vec, Map, Set, keyword, scalar) and a JSON form that survives
`JSON.stringify` round-trips. The same wire format is used by the
conformance test runner, by `serializeSession`/`deserializeSession`,
and by any embedder that needs to ship qlang values across a JSON
boundary (HTTP, postMessage, IndexedDB, files).

The format:

| qlang value | tagged JSON form |
|---|---|
| number / string / boolean | itself |
| nil | `null` |
| Vec | JSON array of recursively-encoded elements |
| keyword | `{ "$keyword": "name" }` |
| Map | `{ "$map": [[k, v], ...] }` (entries pairs, recursively encoded) |
| Set | `{ "$set": [v1, v2, ...] }` |

`toTaggedJSON(value)` throws `TaggedJSONUnencodableValueError` for
function values, thunks, and snapshots — these require the higher-
level session serializer to reconstruct from source on restore.
`fromTaggedJSON(json)` throws `MalformedTaggedJSONError` on
unrecognized tagged objects.

### `effect.mjs` and `effect-check.mjs` — @-effect markers

`effect.mjs` owns the convention for the `@`-prefix surface marker
on side-effectful identifiers and exposes:

- `EFFECT_MARKER_PREFIX` — the literal `'@'` character. The single
  place in the runtime that mentions it.
- `classifyEffect(name) → boolean` — true iff the name carries the
  marker. Called once per identifier at parse-time decoration and
  once per function/conduit/snapshot construction; the precomputed
  result is cached on the `.effectful` field of every relevant AST
  node and runtime value, so the hot path performs no substring
  inspection.

`effect-check.mjs` enforces the propagation invariant in two passes:

- `decorateAstWithEffectMarkers(ast)` — post-parse pass that stamps
  `.effectful` (boolean) on every OperandCall, LetStep, AsStep, and
  Projection node. Run automatically by `parse()`.
- `validateEffectMarkers(ast)` — walks every LetStep and rejects
  any non-effectful let whose body contains an effectful read site
  (an OperandCall or Projection segment with `.effectful = true`).
  Throws `EffectLaunderingAtLetParse` with the binding's source
  location and the offending identifier name.

The runtime call-site safety net lives in `eval.mjs::evalOperandCall`
and reads the same precomputed `.effectful` boolean: when an
identifier resolves through env to an effectful function value but
the lookup name does not classify as effectful, the call is refused
with `EffectLaunderingAtCall`. Together the two layers cover both
the static cases (parse-time AST scan) and the dynamic laundering
paths through `use` / `as` / programmatic `session.bind` injection.

See [qlang-spec.md](qlang-spec.md#effect-markers)
for the user-facing contract and the propagation rule.

### Public entry point — `src/index.mjs`

Embedders import the full surface from the package root:

```js
import {
  // parsing and evaluation
  parse, evalAst, evalQuery, langRuntime,
  // session lifecycle
  createSession, serializeSession, deserializeSession,
  // AST traversal
  walkAst, astChildrenOf, findAstNodeAtOffset,
  findIdentifierOccurrences, bindingNamesVisibleAt,
  astNodeSpan, astNodeContainsOffset, triviaBetweenAstNodes,
  // value codec
  toTaggedJSON, fromTaggedJSON,
  // error hierarchy (for instanceof checks)
  QlangError, QlangTypeError, ParseError,
  EffectLaunderingError,
  // effect-marker classification
  classifyEffect, EFFECT_MARKER_PREFIX
} from '@kaluchi/qlang';
```

Subpath imports (`@kaluchi/qlang/walk`, `@kaluchi/qlang/session`,
`@kaluchi/qlang/codec`, `@kaluchi/qlang/errors`) remain available
through the `package.json` exports map for tree-shaking-sensitive
bundles. The package declares `sideEffects: false` so a browser
bundler will drop unused subpaths.
