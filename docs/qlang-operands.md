# Qlang Query Language — Core Runtime Reference

This document catalogs the built-in operands of the query language.
Every entry lives as a field of the language runtime Map
(`langRuntime` in the bootstrap), so identifier lookup resolves them
the same way as any other binding in `env`. See
[qlang-internals.md](qlang-internals.md) for the
evaluation model and [qlang-spec.md](qlang-spec.md)
for the language syntax.

**Host-bound operands.** The `@kaluchi/qlang-cli` workspace binds
a fixed set of host operands on top of `langRuntime` — effectful
I/O (`@in`, `@out`, `@err`, `@tap`), value formatters (`pretty`,
`tjson`, `template`), and String-to-value parsers (`parseJson`,
`parseTjson`). These are not part of the language core catalog;
their contracts live in [`cli/README.md`](../cli/README.md).
Another host (a browser playground, a server-side evaluator) is
free to bind a different operand set — every binding uses the same
dispatch wrappers from `@kaluchi/qlang-core/dispatch` and the same
per-site error factories from `@kaluchi/qlang-core/operand-errors`.

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

## Categories — the `:category` keyword partition

Every operand descriptor carries a `:category` keyword that groups it
with its polymorphism siblings. The taxonomy is first-class data —
`env | manifest | filter(/category | eq(:container-selector))` returns
the three polymorphic container selectors — so the keywords below are
part of the doc surface, not implementation lore.

| `:category` keyword | Meaning |
|---|---|
| `:container-reducer` | Reduce any Vec / Set / Map to a scalar. Polymorphic over all three container shapes; the result is order- and shape-independent. |
| `:container-selector` | Keep or test items of a Vec / Set / Map by a predicate; filter preserves the container shape, every / any reduce to boolean. |
| `:vec-reducer` | Reduce a Vec (sometimes Vec or Set — for commutative reductions) to a scalar. |
| `:vec-transformer` | Reshape or reorder a Vec, or lift a Vec into a Map/Set. |
| `:comparator` | Pair-Map comparator builder for sortWith. |
| `:control` | Control-flow operand (if / when / unless / coalesce / firstTruthy / cond). |
| `:map-op` | Map-only operand (keys / vals / has on Map). |
| `:set-op` | Set operation (set conversion plus the polymorphic union / minus / inter). |
| `:arith` | Binary numeric operand. |
| `:string` | String operand. |
| `:predicate` | Subject-first boolean operand or combinator. |
| `:type-classifier` | Nullary boolean predicate asking "is pipeValue of value-class X?". |
| `:format` | Value-to-string renderer. |
| `:reflective` | Operand that reads or writes the evaluator state pair (let / as / env / use / reify / manifest / runExamples / parse / eval). |
| `:error` | Error-value constructor (error) or predicate (isError). |

## Container reducers — `(Vec / Set / Map) → Scalar`

### `count`

- **Arity** 1. **Subject** one of `Vec` / `Set` / `Map`.
  Polymorphic — `count` reads the cardinality of any container.
- Returns the number of elements (Vec length, Set size, Map entry
  count).
- **Examples**: `[1 2 3 4 5] | count` → `5`; `#{:a :b :c} | count` →
  `3`; `{:x 1 :y 2} | count` → `2`; `[] | count` → `0`.
- **Errors**: subject not Vec/Set/Map → `CountSubjectNotContainer`.

### `empty`

- **Arity** 1. **Subject** one of `Vec` / `Set` / `Map`.
  Polymorphic — empty-check is container-shape-independent.
- Returns `true` if the container holds zero items, `false`
  otherwise.
- **Examples**: `[] | empty` → `true`; `#{} | empty` → `true`;
  `{} | empty` → `true`; `[1] | empty` → `false`.
- **Errors**: subject not Vec/Set/Map → `EmptySubjectNotContainer`.

## Vec-or-Set reducers — `(Vec / Set) → Scalar`

### `sum`

- **Arity** 1. **Subject** one of `Vec` / `Set`. Polymorphic —
  `sum` is commutative, so Set's unordered semantics do not
  affect the result.
- Returns the numeric sum of elements. Empty container yields
  `0`. Every element must be a number.
- **Examples**: `[1 2 3 4] | sum` → `10`; `#{1 2 3} | sum` → `6`;
  `{:a 10 :b 20} | vals | sum` → `30` (Map axis-pick via `vals`).
- **Errors**: subject not Vec/Set → `SumSubjectNotVecOrSet`;
  element not a number → `SumElementNotNumber`.

### `min`, `max`

- **Arity** 1. **Subject** one of `Vec` / `Set`. Polymorphic —
  `min` / `max` are order-independent.
- Returns the minimum (or maximum) element under the natural
  ordering. Empty container yields `null`.
- **Examples**: `[3 1 4 1 5] | min` → `1`; `#{3 1 4} | max` → `4`.
- **Errors**: subject not Vec/Set → `MinSubjectNotVecOrSet` /
  `MaxSubjectNotVecOrSet`; elements not comparable →
  `MinElementsNotComparable` / `MaxElementsNotComparable`.

## Vec reducers — `Vec → Any`

Vec-only because Set is declared unordered by spec
([qlang-spec.md § Set](qlang-spec.md)); operands that depend on a
well-defined element ordering live in this section.

### `first`

- **Arity** 1. **Subject** `vec`.
- Returns the first element, or `null` if the Vec is empty.
- **Example**: `[10 20 30] | first` → `10`; `[] | first` → `null`.
- **Errors**: subject not a Vec → `FirstSubjectNotVec`.

### `last`

- **Arity** 1. **Subject** `vec`.
- Returns the last element, or `null` if the Vec is empty.
- **Example**: `[10 20 30] | last` → `30`; `[] | last` → `null`.
- **Errors**: subject not a Vec → `LastSubjectNotVec`.

### `at(n)`

- **Arity** 2. **Subject** `vec`. **Modifier** integer index.
- Returns the element at position `n`. Accepts negative indices —
  `at(-1)` is the last element, `at(-2)` the second-last. Out-of-range
  indices return `null`, symmetric with the missing-key case on a
  projection. `last` is the idiomatic shorthand for `at(-1)`.
- **Example**: `[10 20 30] | at(1)` → `20`; `[10 20 30] | at(-1)` →
  `30`; `[10 20 30] | at(99)` → `null`.
- **Errors**: non-Vec subject → `AtSubjectNotVec`; non-integer index
  (including non-integer Numbers such as `0.5`) → `AtIndexNotInteger`.
- **See also**: bare-form projection `/n` on a Vec (e.g.
  `/items/0/name`) — same indexed-access semantics without the
  operand-call wrapper, polymorphic over Map (keyword lookup) and
  Vec (integer index) so mixed JSON paths like `/users/-1/email`
  descend through nested containers uniformly.

## Container selectors — polymorphic over `Vec` / `Set` / `Map`

`filter`, `every`, and `any` dispatch on container type and on the
predicate conduit's **parameter arity**. The arity ladder is the
same on every shape; what changes is which axis the language
offers to fill:

- **0-arity inline pipeline** (`filter(gt(1))`) or **0-arity named
  conduit** (`let(:big, gt(1)) | ... | filter(big)`) — per item
  with pipeValue = element on Vec/Set, value on Map. Covers the
  90% case.
- **1-arity conduit `[:x]`** — the element (Vec/Set) or value
  (Map) is bound as the single captured-arg inside the body.
  pipeValue mirrors the captured value, so `pipeValue` references
  inside the body stay aligned with the axis.
- **2-arity conduit `[:k :v]`** — Map-only. Per entry the body
  sees **`(key, value)`** as two captured-arg bindings and can
  correlate the two axes freely. On Vec or Set there is no second
  axis to fill; 2+ params raise per-operand
  `Filter/Every/AnyVecOrSetPredArityInvalid`.
- **3+-arity conduit** — per-operand arity-invalid class on both
  Vec/Set and Map (`*VecOrSetPredArityInvalid` /
  `*MapPredArityInvalid`). The language does not pair-encode keys
  and values into a single argument; higher arities have no
  meaning for entry iteration.

Compose both-axis predicates by naming the 2-arity conduit with
`let` inline in the pipeline, then reference it inside `filter` /
`every` / `any`:

```qlang
m
  | let(:@hot, [:k :v], and(k | eq(:x), v | gt(1)))
  | filter(@hot)
```

### `filter(pred)`

- **Arity** 2. **Subject** one of `Vec` / `Set` / `Map`,
  **modifier** `pred` (a predicate pipeline or a named conduit).
- Keeps items where the predicate evaluates truthy, collecting
  into a new container of the same shape. Vec and Set iterate
  per element (insertion order preserved); Map iterates per
  entry with the arity dispatch above. Empty subject returns an
  empty container of the same kind.
- **Examples**:
  - `[1 2 3 4 5] | filter(gt(2))` → `[3 4 5]`.
  - `[{:age 25} {:age 15}] | filter(/age | gte(18))` → `[{:age 25}]`.
  - `[1 -2 3] | let(:@pos, [:v], v | gt(0)) | filter(@pos)` → `[1 3]` — 1-arity conduit, element bound as captured-arg.
  - `#{1 2 3 4 5} | filter(gt(2))` → `#{3 4 5}`.
  - `{:a 1 :b 2 :c 3} | filter(gt(1))` → `{:b 2 :c 3}` — 0-arity pred, value axis.
  - `{:a 1 :b -2 :c 3} | let(:@pos, [:v], v | gt(0)) | filter(@pos)` → `{:a 1 :c 3}` — 1-arity conduit, value bound.
  - `{:apple 1 :banana 2 :avocado 3} | let(:@hot, [:k :v], and(k | eq(:avocado), v | gt(1))) | filter(@hot)` → `{:avocado 3}` — 2-arity conduit, both axes.
  - `{} | filter(gt(0))` → `{}` — empty subject returns empty Map.
- **Errors**: subject neither Vec nor Set nor Map →
  `FilterSubjectNotContainer`. Predicate conduit with 2+ params on
  Vec or Set (only one axis available) →
  `FilterVecOrSetPredArityInvalid`. Predicate conduit with 3+
  params on Map → `FilterMapPredArityInvalid`.

### `every(pred)`

- **Arity** 2. **Subject** one of `Vec` / `Set` / `Map`,
  **modifier** `pred`.
- Returns `true` iff every item of the container satisfies the
  predicate. Short-circuits on the first falsy result. Vacuously
  true for empty containers. Per-container item dispatch matches
  `filter`: 0-arity inline pipeline sees pipeValue = element
  (Vec/Set) or value (Map); 1-arity `[:x]` binds element / value
  as the captured-arg on all three shapes; 2-arity `[:k :v]` is
  Map-only.
- **Examples**:
  - `[2 4 6] | every(gt(0))` → `true`.
  - `[1 2 3] | every(gt(2))` → `false`.
  - `[2 4 6] | let(:@pos, [:v], v | gt(0)) | every(@pos)` → `true` — 1-arity conduit.
  - `[] | every(gt(0))` → `true`.
  - `#{2 4 6} | every(gt(0))` → `true`.
  - `{:a 1 :b 2 :c 3} | every(gt(0))` → `true` — 0-arity, value axis.
  - `{:a 1 :b -2 :c 3} | every(gt(0))` → `false`.
- **Errors**: subject not a container → `EverySubjectNotContainer`.
  Predicate conduit with 2+ params on Vec/Set →
  `EveryVecOrSetPredArityInvalid`. Predicate conduit with 3+
  params on Map → `EveryMapPredArityInvalid`.

### `any(pred)`

- **Arity** 2. **Subject** one of `Vec` / `Set` / `Map`,
  **modifier** `pred`.
- Returns `true` iff at least one item of the container satisfies
  the predicate. Short-circuits on the first truthy result.
  Vacuously false for empty containers. Same arity-dispatch rule
  as `filter` / `every`.
- **Examples**:
  - `[1 2 3] | any(gt(2))` → `true`.
  - `[1 2 3] | any(gt(99))` → `false`.
  - `[1 2 3] | let(:@big, [:v], v | gt(2)) | any(@big)` → `true` — 1-arity conduit.
  - `[] | any(gt(0))` → `false`.
  - `#{1 2 3} | any(gt(2))` → `true`.
  - `{:a -1 :b 0 :c 2} | any(gt(0))` → `true` — 0-arity, value axis.
  - `{:apple 1 :banana 2} | let(:@isApple, [:k :v], k | eq(:apple)) | any(@isApple)` → `true` — 2-arity conduit, key axis.
- **Errors**: subject not a container → `AnySubjectNotContainer`.
  Predicate conduit with 2+ params on Vec/Set →
  `AnyVecOrSetPredArityInvalid`. Predicate conduit with 3+ params
  on Map → `AnyMapPredArityInvalid`.

## Vec transformers — `Vec → Vec` / `Vec → Map`

### `groupBy(keyFn)`

- **Arity** 2. **Subject** `vec`, **modifier** `keyFn` (key pipeline
  returning a keyword).
- Partitions a Vec into a Map keyed by the result of `keyFn`
  applied to each element. Preserves first-occurrence order for
  both the Map entry sequence and each bucket's element list.
- **Example**: `[{:dept :eng :name "a"} {:dept :sales :name "b"} {:dept :eng :name "c"}] | groupBy(/dept) | /eng * /name` → `["a" "c"]`.
- **Errors**: subject not a Vec → type error; key not a keyword → type error.

### `indexBy(keyFn)`

- **Arity** 2. **Subject** `vec`, **modifier** `keyFn` (key pipeline
  returning a keyword).
- Collapses a Vec into a Map keyed by the result of `keyFn`. On
  collision, the last element wins.
- **Example**: `[{:id :a :name "alice"} {:id :b :name "bob"}] | indexBy(/id) | /a/name` → `"alice"`.
- **Errors**: subject not a Vec → type error; key not a keyword → type error.

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

### `nullsFirst(keyExpr)`

- **Arity** 2. **Subject** pair Map `{ :left x :right y }` (provided
  by `sortWith`), **modifier** `keyExpr` (any sub-pipeline).
- Ascending comparator that places null-keyed elements before all
  non-null elements. Non-null keys are sorted in ascending order.
  Use inside `sortWith` to handle data with missing values without
  tripping `AscKeysNotComparable`.
- **Examples**:
  - `sortWith(nullsFirst(/age))` → null ages before all others.
  - `[{:a 3} {:a null} {:a 1}] | sortWith(nullsFirst(/a)) * /a`
    → `[null 1 3]`.
- **Errors**: pair subject not a Map → type error.

### `nullsLast(keyExpr)`

- **Arity** 2. **Subject** pair Map `{ :left x :right y }` (provided
  by `sortWith`), **modifier** `keyExpr` (any sub-pipeline).
- Ascending comparator that places null-keyed elements after all
  non-null elements. Non-null keys are sorted in ascending order.
  Use inside `sortWith` to handle data with missing values without
  tripping `AscKeysNotComparable`.
- **Examples**:
  - `sortWith(nullsLast(/age))` → null ages after all others.
  - `[{:a 3} {:a null} {:a 1}] | sortWith(nullsLast(/a)) * /a`
    → `[1 3 null]`.
- **Errors**: pair subject not a Map → type error.

### `firstNonZero`

- **Arity** 1. **Subject** Vec of Numbers.
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

`count` and `empty` on a Set (and on a Map) dispatch through the
polymorphic `:container-reducer` entries above — one descriptor each
in the catalog, one doc entry here.

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

### `contains(needle)`

- **Arity** 2. **Subject** `string`, **modifier** `needle` (string).
- Returns `true` if the subject contains `needle` as a substring.
  Empty needle is always contained. Case-sensitive.
- **Examples**:
  - `"hello world" | contains("world")` → `true`.
  - `"hello" | contains("xyz")` → `false`.
- **Errors**: subject or needle not a string → type error.

### `startsWith(prefix)`

- **Arity** 2. **Subject** `string`, **modifier** `prefix` (string).
- Returns `true` if the subject begins with `prefix`.
  Empty prefix is always a prefix. Case-sensitive.
- **Examples**:
  - `"hello world" | startsWith("hello")` → `true`.
  - `"hello" | startsWith("world")` → `false`.
- **Errors**: subject or prefix not a string → type error.

### `endsWith(suffix)`

- **Arity** 2. **Subject** `string`, **modifier** `suffix` (string).
- Returns `true` if the subject ends with `suffix`.
  Empty suffix is always a suffix. Case-sensitive.
- **Examples**:
  - `"hello world" | endsWith("world")` → `true`.
  - `"hello" | endsWith("xyz")` → `false`.
- **Errors**: subject or suffix not a string → type error.

## Boolean

### `not`

- **Arity** 1. **Subject** any value.
- Returns `true` if the subject is falsy (`null` or `false`),
  `false` otherwise.
- **Example**: `null | not` → `true`; `0 | not` → `false` (0 is truthy).

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

## Type classifiers

Eight nullary predicates lift the `types.mjs` value-class
predicates to operand level. Primary use — inside `filter`,
`every`, `any` predicates over heterogeneous containers:
`filter(isString)` over a Vec of mixed types, or over a Map
where the value's type is the predicate axis
(`{:ID "SGML" :GlossDef {...}} | filter(isMap)` keeps only the
Map-valued entries). Without them the same classification lands
through `reify | /type | eq(:string)` — correct but it
constructs the full descriptor Map per item for a single bit of
information. Each classifier matches exactly one
`describeType(v)` label and never throws.

### `isString` · `isNumber` · `isVec` · `isMap` · `isSet` · `isKeyword` · `isBoolean` · `isNull`

- **Arity** 1. **Subject** any value.
- Returns `true` iff the subject is of the named value class,
  `false` otherwise. Every qlang value produces `true` from
  exactly one classifier. Boolean and null classification is
  strict: `0 | isBoolean` → `false`, `"" | isNull` → `false`.
  `isMap` reports `false` for conduit and snapshot descriptor
  Maps — they classify as `Conduit` / `Snapshot`, not `Map`.
- **Examples**:
  - `"hello" | isString` → `true`; `42 | isString` → `false`.
  - `42 | isNumber` → `true`; `3.14 | isNumber` → `true`;
    `"42" | isNumber` → `false`.
  - `[1 2] | isVec` → `true`; `#{1} | isVec` → `false`.
  - `{:a 1} | isMap` → `true`; `[] | isMap` → `false`.
  - `#{1 2} | isSet` → `true`; `[1 2] | isSet` → `false`.
  - `:name | isKeyword` → `true`; `:qlang/kind | isKeyword` → `true`.
  - `true | isBoolean` → `true`; `0 | isBoolean` → `false`.
  - `null | isNull` → `true`; `{} | /missing | isNull` → `true`.
- **Errors**: none — classification is total.

## Formatting

### `json`

- **Arity** 1. **Subject** any value.
- Returns a JSON string representation of the subject.
- **Example**: `{:a 1 :b [2 3]} | json` → `"{\"a\":1,\"b\":[2,3]}"`.

### `table`

- **Arity** 1. **Subject** a Vec of Maps.
- Returns a string with the Maps rendered as a tabular layout
  (columns derived from keys). Useful for human-readable output.
- **Cell rendering.** Scalar cells render bare: Strings without
  quotes, Numbers stringified, Keywords as `:name`, Booleans as
  `true`/`false`, `null` as an empty column. Composite cells
  (Vec, Map, Set, Error) render as **inline qlang literals** —
  `[1 2 3]`, `{:file "f.java" :line 12}`, `#{:a :b}`,
  `!{:kind :oops}` — so nested structure stays readable on one row.
  Reshape with `* {:col1 /a :col2 /b/c}` to lift sub-Map fields
  into columns before the table call.
- **Errors**: subject not a Vec of Maps → type error.

## Control flow

### `if(cond, then, else)`

- **Arity** 4. **Subject** any value (the current `pipeValue`),
  **modifiers** three captured sub-pipelines.
- The `cond` sub-pipeline is evaluated against `pipeValue` and its
  result is checked for truthiness (per language rules: `null` and
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
  returns the first one that produces a non-`null` result. If all
  alternatives produce `null`, the result is `null`.
- **Falsy non-null values** (`false`, `0`, `""`, `[]`, `{}`, `#{}`)
  are NOT skipped — only `null`/`undefined` count as missing.
  This matches SQL `COALESCE` and JavaScript `??` semantics.
- **Short-circuits**: alternatives after the first non-null match
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
  null-ness. Each alternative is evaluated against `pipeValue` in
  order; the first one that produces a truthy value becomes the
  new `pipeValue`. If all alternatives produce falsy values
  (`null` or `false`), the result is `null`.
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

### `cond(p1, b1, p2, b2, ..., default?)`

- **Arity** variadic (2+). **Subject** any value, **modifiers**
  alternating (predicate, branch) sub-pipeline pairs, plus an
  optional trailing default sub-pipeline.
- Multi-way dispatch. Walks captured args in pairs: for each
  `(pK, bK)`, evaluates `pK` against `pipeValue`; if truthy,
  evaluates `bK` and returns its result. Short-circuits on first
  match. If captured-arg count is odd, the trailing arg is the
  default. If even and no match, returns `null`.
- Replaces nested-if chains with a flat catalog.
- **Examples**:
  - `score | cond(gte(90), "A", gte(80), "B", gte(70), "C", "F")`.
  - `value | cond(eq(0), "zero", eq(1), "one", "many")`.
- **Errors**: fewer than 2 captured args → `CondNoBranches`.

## Reflective built-ins

`env`, `use`, `reify`, `manifest`, `runExamples`, `let`, and `as`
are **reflective operands**:
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
  - `env | keys` → a Set of all identifiers in scope.
  - `env | has(:count)` → `true` (count is a built-in).
  - `env | /taxRate` → the value of a user binding, or `null`.
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
  - Shadow a built-in: `let(:use, mul(2)) | 5 | use` → `10`
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

- **Builtin** — `pipeValue` is a descriptor Map loaded by
  `langRuntime()` from `lib/qlang/core.qlang`. Under the
  Variant-B runtime shape, every built-in binding in `env` IS a
  descriptor Map directly; `reify` substitutes the internal
  `:qlang/kind :builtin` / `:qlang/impl :qlang/prim/<name>`
  discriminator for a user-facing `:kind :builtin` (dropping
  the `:qlang/impl` handle), stamps `:captured` / `:effectful`
  from the primitive resolved through `PRIMITIVE_REGISTRY`,
  and adds `:name` when the caller used the named form
  `reify(:count)`:
  ```
  {:kind     :builtin
   :name     "count"
   :category :vec-reducer
   :subject  [:vec :set :map]
   :modifiers []
   :returns  :number
   :captured [0 0]
   :docs     ["Returns the number of elements. Polymorphic over Vec, Set, and Map."]
   :examples [{:doc "Vec length" :snippet "[1 2 3] | count" :expected "3"}
              {:doc "Set size"   :snippet "#{:a :b} | count" :expected "2"}]
   :throws   [:CountSubjectNotContainer]
   :effectful false}
  ```
  `:category` / `:subject` / `:returns` carry keywords (not
  strings) because the underlying `core.qlang` entries are
  authored as keywords; `:throws` is a Vec of keywords (not
  strings) matching the per-site error class names that
  downstream consumers filter on. The `:captured` field is a
  2-element Vec `[min, max]` describing the range of captured-
  arg counts the operand accepts. Fixed operands have
  `min == max` (e.g. `count` has `[0 0]`; `filter` has
  `[1 1]`). Partial/full-applicable operands have `[n-1, n]`
  (`add` has `[1 2]`). Overloaded operands span the Object
  keys of their impl dispatch table (`sort` has `[0 1]`).
  Variadic operands use the `:unbounded` keyword as the upper
  bound (`coalesce` has `[1 :unbounded]`). The field is always
  present.

  Under the Variant-B REPL ergonomic, a bare non-nullary
  operand lookup (`mul`, `filter`, `coalesce` — any operand
  whose `min > 0`) short-circuits through the same descriptor
  path: typing the bare name yields the Map above as the new
  `pipeValue` rather than firing an arity error. Nullary
  operands (`count`, `sort` bare form, `env`, etc.) still fire
  on bare lookup because their `min == 0` and bare application
  IS their valid call shape.
- **Conduit** — `pipeValue` is a `let`-bound conduit (named
  pipeline fragment, zero or more parameters). Descriptor:
  ```
  {:kind   :conduit
   :name   "double"
   :params []
   :source "mul(2)"
   :docs   ["Doubles a number." "Impl note: reuses mul with partial application."]}
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

### `runExamples`

- **Arity** 1. **Subject** descriptor Map (the output of `reify`).
- Parses and evaluates every entry of the descriptor's `:examples`
  Vec, comparing each result against the optional `→ expected`
  suffix. Returns a Vec of `{:query :expected :actual :error :ok}`
  Maps. Homoiconic catalog self-test — `manifest * runExamples >>
  /ok | distinct` exercises every documented example and reports
  whether it still matches its actual evaluation result.
- **Example**: `reify(:count) | runExamples | first | /ok` → `true`.
- **Errors**: subject not a descriptor Map → type error; no
  `:examples` field → type error.

### `let(:name, body)` / `let(:name, [:params], body)`

- **Arity** variadic (2 or 3 captured). **Subject** any (pipeValue
  passes through unchanged).
- Declares a conduit (named pipeline fragment) in `env`. Zero-arity
  form `let(:name, body)` binds a pipeline fragment. Parametric form
  `let(:name, [:params], body)` binds a fragment with named
  parameters for fractal composition.
- The body is stored as AST and evaluated in a lexically-scoped fork
  at each call site (envRef tie-the-knot for recursive self-binding).
  Parameters are lazy conduit-parameter proxies (nullary function
  values wrapping captured-arg lambdas).
- **Examples**:
  - `let(:double, mul(2)) | 10 | double` → `20`.
  - `let(:@surround, [:pfx, :sfx], prepend(pfx) | append(sfx)) | "world" | @surround("[", "]")` → `"[world]"`.
- **Errors**: name not a keyword → `LetNameNotKeyword`; params not
  a Vec of keywords → `LetParamsNotVecOfKeywords`; fewer than 2
  captured args → `LetBodyMissing`; clean name with effectful body
  → `EffectLaunderingAtLetParse`.

### `as(:name)`

- **Arity** 2 (1 captured). **Subject** any (the value to snapshot).
- Captures the current `pipeValue` as a frozen snapshot under the
  given keyword name. `pipeValue` passes through unchanged. The
  snapshot is retrievable by name through identifier lookup (auto-
  unwrapped to the raw value) or through `reify(:name)` for
  metadata inspection including docs.
- **Examples**:
  - `42 | as(:answer) | answer` → `42`.
  - `[1 2 3] | as(:nums) | nums | count` → `3`.
- **Errors**: name not a keyword → `AsNameNotKeyword`.

### `parse`

- **Arity** 1. **Subject** `string` — the source to parse.
- Reads the subject string into an **AST-Map** — the data-form
  representation of the program, produced by `walk.mjs::astNodeToMap`.
  Each AST node becomes a frozen Map carrying `:qlang/kind` (the
  AST type keyword: `:NumberLit`, `:OperandCall`, `:Projection`,
  `:Pipeline`, and so on), type-specific payload fields (`:value`,
  `:name`, `:args`, `:elements`, `:entries`, `:keys`, `:steps`,
  etc.), and the shared `:text` / `:location` metadata the parser
  stamps on every node. Nested nodes recurse into their own Maps.
- The underlying peggy `ParseError` is caught in-operand and
  converted to an error value via `errorFromParse`, so malformed
  sources surface on the fail-track with
  `:kind :parse-error` rather than the generic `:foreign-error`
  flavor evalNode would stamp for an unhandled foreign throw.
- **Examples**:
  - `"42" | parse | /:qlang/kind` → `:NumberLit`.
  - `"add(1, 2)" | parse | /name` → `"add"`.
  - `"add(1, 2)" | parse | /args | count` → `2`.
  - `"this is not qlang [" | parse !| /kind` → `:parse-error`.
- **Errors**: subject not a string → `ParseSubjectNotString`.
  Malformed source → error value with `:kind :parse-error`
  (not thrown; passes onto fail-track as `pipeValue`).

### `eval`

- **Arity** 1. **Subject** `map` — the AST-Map to evaluate.
- Unwraps an AST-Map through `walk.mjs::qlangMapToAst` and runs
  the reconstructed AST against the current state. The caller's
  `pipeValue` becomes the inner evaluation's `pipeValue`; the
  caller's `env` threads in unchanged. Any `let` / `as` / `use`
  writes the inner code performs propagate out the same way a
  paren-group's env writes would. The result is whatever
  `pipeValue` the inner code produces, ready to flow into the
  next pipeline step.
- Pairs with `parse` to close the code-as-data ring:
  `"source" | parse | eval` is equivalent to evaluating the
  source string directly, and the intermediate AST-Map can be
  inspected, filtered, re-assembled, or handed around as
  ordinary qlang data.
- **Examples**:
  - `"42" | parse | eval` → `42`.
  - `"10 | add(3)" | parse | eval` → `13`.
  - `"[1 2 3] | filter(gt(1)) | count" | parse | eval` → `2`.
  - `{:qlang/kind :NumberLit :value 42} | eval` → `42`
    (hand-assembled AST-Map bypasses the parser).
- **Errors**: subject not a Map → `EvalSubjectNotMap`.
  Runtime errors inside the inner evaluation lift through the
  normal fail-track just like any other qlang failure.

## Error operands

Error inspection and transformation are driven by the `!|`
combinator (fail-apply), not by operands. `!|` fires its step
against a materialized error descriptor — ordinary Map operations
(`/key`, `has`, `keys`, `vals`, `union`, `minus`, `inter`, `eq`,
`filter` over `:trail`, etc.) apply directly to the descriptor
without special error-handling support. The two operands below
exist as entry and exit points for the fail-track itself; they
compose naturally with `!|` and with every Map-oriented operand.

### `error`

- **Arity** 1. **Subject** `map` (the descriptor).
- Lifts a Map into an error value — the sole constructor for the
  5th type at the language level alongside the `!{…}` literal.
  Bare form `map | error` uses pipeValue as the descriptor; full
  form `error(map)` evaluates the captured Map against pipeValue
  as context. The resulting error rides the fail-track: `|`, `*`,
  and `>>` deflect it into the trail, `!|` fires its step against
  the materialized descriptor.
- **Example**: `error({:kind :oops}) !| /kind` → `:oops`.
- **Errors**: subject not a Map → `ErrorDescriptorNotMap`.

### `isError`

- **Arity** 1. **Subject** any value. Plain predicate — carries no
  dispatch flag.
- Returns `true` when pipeValue is an error value, `false`
  otherwise. Because `|` deflects errors before `isError` can
  fire, it is intended for raw first-step positions inside
  predicate lambdas (`filter(isError)`, `any(isError)`,
  `every(isError | not)`, `* isError`), where the per-element
  sub-pipeline's first step runs without combinator dispatch and
  therefore sees the per-element pipeValue directly.
- **Examples**:
  - `[!{:kind :oops}] * isError | first` → `true`.
  - `{:kind :oops} | isError` → `false`.
  - `42 | isError` → `false`.

Removing an error from the success-track view of a container:

```qlang
> [1 "x" 3] * add(10) | filter(isError | not)
[11 13]
```

Filtering to a specific kind of error via leading fail-apply in
the predicate:

```qlang
> [1 "x" 3] * add(10) | filter(!| /thrown | eq(:AddLeftNotNumber))
[!{:kind :type-error :thrown :AddLeftNotNumber :operand "add" :position 1 :expectedType "Number" :actualType "String" :trail []}]
```

## Summary: unique operand names by `:category` keyword

`count`, `empty`, and `has` are polymorphic — one identifier
dispatches on subject type. `filter`, `every`, `any` are
polymorphic over Vec / Set / Map. `sort` is overloaded by arity —
same identifier, 0 or 1 captured arg. `reify` is overloaded by
arity (value-level or named form). `use` is overloaded by arity
(bare merge, namespace import, selective import). Each name is
listed once; rows are keyed by the `:category` keyword each entry's
descriptor carries (the same keywords `env | manifest | /category |
distinct` enumerates).

| `:category` keyword | Names (frequent → specialized) |
|---|---|
| `:container-reducer` | `count`, `empty` (polymorphic over Vec / Set / Map) |
| `:container-selector` | `filter`, `every`, `any` (polymorphic over Vec / Set / Map) |
| `:vec-reducer` | `sum`, `min`, `max` (Vec / Set — commutative reductions), `first`, `last`, `at`, `firstNonZero` (Vec-only — order-dependent) |
| `:vec-transformer` | `sort`, `take`, `drop`, `distinct`, `reverse`, `flat`, `sortWith`, `groupBy`, `indexBy` |
| `:comparator` | `asc`, `desc`, `nullsFirst`, `nullsLast` |
| `:control` | `if`, `when`, `unless`, `coalesce`, `cond`, `firstTruthy` |
| `:map-op` | `keys`, `vals`, `has` (polymorphic with Set) |
| `:set-op` | `set`, `union`, `minus`, `inter` |
| `:arith` | `add`, `sub`, `mul`, `div` |
| `:string` | `split`, `join`, `contains`, `startsWith`, `endsWith`, `prepend`, `append` |
| `:predicate` | `not`, `eq`, `gt`, `lt`, `gte`, `lte`, `and`, `or` |
| `:type-classifier` | `isString`, `isNumber`, `isVec`, `isMap`, `isSet`, `isKeyword`, `isBoolean`, `isNull` |
| `:format` | `json`, `table` |
| `:error` | `error`, `isError` |
| `:reflective` | `let`, `as`, `env`, `use`, `reify`, `manifest`, `runExamples`, `parse`, `eval` |

Each polymorphic / overloaded operand is one identifier in the
initial `langRuntime` Map regardless of how many dispatch paths
it carries. The reflective pair `parse` /
`eval` closes the code-as-data ring: a source string lifts into an
AST-Map through `parse`, runs through `eval` to become a
`pipeValue`, and the intermediate Map is addressable as ordinary
qlang data.

Tooling primitives (walk.mjs, session.mjs, codec.mjs, effect.mjs)
and the embedder API are documented in
[qlang-internals.md](qlang-internals.md).
