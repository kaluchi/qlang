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
`parseTjson`). These are host-scope additions; their contracts
live in [`cli/README.md`](../cli/README.md). Another host (a
browser playground, a server-side evaluator) is free to bind a
different operand set — every binding uses the same
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
the three polymorphic container selectors — so the keywords below
form part of the doc surface and the runtime catalog alike.

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
| `:reflective` | Operand that reads or writes the evaluator state pair (as / env / use / manifest / runExamples). The declarative binding form `:name body` parses as a BindStep (a grammar production with its own dispatch path). |
| `:code-as-data` | Source-text ↔ AST-Map ↔ pipeValue ring closer (parse / eval / apply). |
| `:axis` | Declarative-metadata reader from binding name to source AST (source / docs / examples). |
| `:error` | Error-value constructor (error) or predicate (isError). |

## Container reducers — `(Vec / Set / Map) → Scalar`

### `count`

- **Arity** 1. **Subject** one of `Vec` / `Set` / `Map`.
  Polymorphic — `count` reads the cardinality of any container.
- Returns the number of elements (Vec length, Set size, Map entry
  count).
- **Examples**: `[1 2 3 4 5] | count` → `5`; `#{:a :b :c} | count` →
  `3`; `{:x 1 :y 2} | count` → `2`; `[] | count` → `0`.
- **Errors**: subject not Vec/Set/Map → `CountSubjectNotContainerError`.

### `empty`

- **Arity** 1. **Subject** one of `Vec` / `Set` / `Map`.
  Polymorphic — empty-check is container-shape-independent.
- Returns `true` if the container holds zero items, `false`
  otherwise.
- **Examples**: `[] | empty` → `true`; `#{} | empty` → `true`;
  `{} | empty` → `true`; `[1] | empty` → `false`.
- **Errors**: subject not Vec/Set/Map → `EmptySubjectNotContainerError`.

## Vec-or-Set reducers — `(Vec / Set) → Scalar`

### `sum`

- **Arity** 1. **Subject** one of `Vec` / `Set`. Polymorphic —
  `sum` is commutative, so Set's unordered semantics do not
  affect the result.
- Returns the numeric sum of elements. Empty container yields
  `0`. Every element must be a number.
- **Examples**: `[1 2 3 4] | sum` → `10`; `#{1 2 3} | sum` → `6`;
  `{:a 10 :b 20} | vals | sum` → `30` (Map axis-pick via `vals`).
- **Errors**: subject not Vec/Set → `SumSubjectNotVecOrSetError`;
  element not a number → `SumElementNotNumberError`.

### `min`, `max`

- **Arity** 1. **Subject** one of `Vec` / `Set`. Polymorphic —
  `min` / `max` are order-independent.
- Returns the minimum (or maximum) element under the natural
  ordering. Empty container yields `null`.
- **Examples**: `[3 1 4 1 5] | min` → `1`; `#{3 1 4} | max` → `4`.
- **Errors**: subject not Vec/Set → `MinSubjectNotVecOrSetError` /
  `MaxSubjectNotVecOrSetError`; elements not comparable →
  `MinElementsNotComparableError` / `MaxElementsNotComparableError`.

## Vec reducers — `Vec → Any`

Vec-only because Set is declared unordered by spec
([qlang-spec.md § Set](qlang-spec.md)); operands that depend on a
well-defined element ordering live in this section.

### `first`

- **Arity** 1. **Subject** `vec`.
- Returns the first element, or `null` if the Vec is empty.
- **Example**: `[10 20 30] | first` → `10`; `[] | first` → `null`.
- **Errors**: subject not a Vec → `FirstSubjectNotVecError`.

### `last`

- **Arity** 1. **Subject** `vec`.
- Returns the last element, or `null` if the Vec is empty.
- **Example**: `[10 20 30] | last` → `30`; `[] | last` → `null`.
- **Errors**: subject not a Vec → `LastSubjectNotVecError`.

### `at(n)`

- **Arity** 2. **Subject** `vec` or `map`. **Modifier** integer index
  (Vec) or string key (Map).
- **Vec subject**: returns the element at position `n`. Accepts
  negative indices — `at(-1)` is the last element, `at(-2)` the
  second-last. Out-of-range indices return `null`.
- **Map subject**: returns the value at string key `n`, or `null` on
  miss. This is dynamic string-key projection — equivalent to `/key`
  when the key is known statically.
- **Example**: `[10 20 30] | at(1)` → `20`; `[10 20 30] | at(-1)` →
  `30`; `{:x 1 :y 2} | at("x")` → `1`; `{:x 1} | at("z")` → `null`.
- **Errors**: non-Vec-or-Map subject → `AtSubjectNotVecOrMapError`;
  non-integer index on Vec → `AtIndexNotIntegerError`; non-string key on
  Map → `AtKeyNotStringError`.
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
  conduit** (`:big gt(1) | ... | filter(big)`) — per item
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
  `Filter/Every/AnyVecOrSetPredArityInvalidError`.
- **3+-arity conduit** — per-operand arity-invalid class on both
  Vec/Set and Map (`*VecOrSetPredArityInvalid` /
  `*MapPredArityInvalid`). Map iteration binds at most `(key,
  value)`; higher arities exceed the binding shape and raise the
  per-operand class.

Compose both-axis predicates by declaring the 2-arity conduit
through a BindStep inline in the pipeline, then reference it
inside `filter` / `every` / `any`:

```qlang
m
  | :@hot [:k :v] and(k | eq(:x), v | gt(1))
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
  - `[1 -2 3] | :@pos [:v] (v | gt(0)) | filter(@pos)` → `[1 3]` — 1-arity conduit, element bound as captured-arg.
  - `#{1 2 3 4 5} | filter(gt(2))` → `#{3 4 5}`.
  - `{:a 1 :b 2 :c 3} | filter(gt(1))` → `{:b 2 :c 3}` — 0-arity pred, value axis.
  - `{:a 1 :b -2 :c 3} | :@pos [:v] (v | gt(0)) | filter(@pos)` → `{:a 1 :c 3}` — 1-arity conduit, value bound.
  - `{:apple 1 :banana 2 :avocado 3} | :@hot [:k :v] and(k | eq(:avocado), v | gt(1)) | filter(@hot)` → `{:avocado 3}` — 2-arity conduit, both axes.
  - `{} | filter(gt(0))` → `{}` — empty subject returns empty Map.
- **Errors**: subject neither Vec nor Set nor Map →
  `FilterSubjectNotContainerError`. Predicate conduit with 2+ params on
  Vec or Set (only one axis available) →
  `FilterVecOrSetPredArityInvalidError`. Predicate conduit with 3+
  params on Map → `FilterMapPredArityInvalidError`.

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
  - `[2 4 6] | :@pos [:v] (v | gt(0)) | every(@pos)` → `true` — 1-arity conduit.
  - `[] | every(gt(0))` → `true`.
  - `#{2 4 6} | every(gt(0))` → `true`.
  - `{:a 1 :b 2 :c 3} | every(gt(0))` → `true` — 0-arity, value axis.
  - `{:a 1 :b -2 :c 3} | every(gt(0))` → `false`.
- **Errors**: subject not a container → `EverySubjectNotContainerError`.
  Predicate conduit with 2+ params on Vec/Set →
  `EveryVecOrSetPredArityInvalidError`. Predicate conduit with 3+
  params on Map → `EveryMapPredArityInvalidError`.

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
  - `[1 2 3] | :@big [:v] (v | gt(2)) | any(@big)` → `true` — 1-arity conduit.
  - `[] | any(gt(0))` → `false`.
  - `#{1 2 3} | any(gt(2))` → `true`.
  - `{:a -1 :b 0 :c 2} | any(gt(0))` → `true` — 0-arity, value axis.
  - `{:apple 1 :banana 2} | :@isApple [:k :v] (k | eq(:apple)) | any(@isApple)` → `true` — 2-arity conduit, key axis.
- **Errors**: subject not a container → `AnySubjectNotContainerError`.
  Predicate conduit with 2+ params on Vec/Set →
  `AnyVecOrSetPredArityInvalidError`. Predicate conduit with 3+ params
  on Map → `AnyMapPredArityInvalidError`.

## Vec transformers — `Vec → Vec` / `Vec → Map`

### `groupBy(keyFn)`

- **Arity** 2. **Subject** `vec`, **modifier** `keyFn` (key pipeline
  returning a keyword).
- Partitions a Vec into a Map keyed by the result of `keyFn`
  applied to each element. Preserves first-occurrence order for
  both the Map entry sequence and each bucket's element list.
- **Example**: `[{:dept :eng :name "a"} {:dept :sales :name "b"} {:dept :eng :name "c"}] | groupBy(/dept) | /eng * /name` → `["a" "c"]`.
- **Errors**: subject not a Vec → `GroupBySubjectNotVecError`; key not a keyword → `GroupByKeyNotKeywordError`.

### `indexBy(keyFn)`

- **Arity** 2. **Subject** `vec`, **modifier** `keyFn` (key pipeline
  returning a keyword).
- Collapses a Vec into a Map keyed by the result of `keyFn`. On
  collision, the last element wins.
- **Example**: `[{:id :a :name "alice"} {:id :b :name "bob"}] | indexBy(/id) | /a/name` → `"alice"`.
- **Errors**: subject not a Vec → `IndexBySubjectNotVecError`; key not a keyword → `IndexByKeyNotKeywordError`.

### `sort`

- **Arity** 1. **Subject** `vec`.
- Returns a new Vec sorted in natural (ascending) order.
- **Example**: `[3 1 4 1 5] | sort` → `[1 1 3 4 5]`.
- **Errors**: elements not comparable → `SortNaturalNotComparableError`.

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
- **Errors**: subject not a Vec → `SortWithSubjectNotVecError`; comparator returns
  non-number → `SortWithCmpResultNotNumberError`.

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
- **Errors**: pair subject not a Map → `AscPairNotMapError`; left and right
  keys not comparable scalars of the same type → `AscKeysNotComparableError`.

### `desc(keyExpr)`

- **Arity** 2. **Subject** pair Map, **modifier** key sub-pipeline.
- Same as `asc` but reversed: higher key values come first.
- **Examples**:
  - `sortWith(desc(/timestamp))` → most recent first.
  - `sortWith(desc(/score))` → highest score first.
- **Errors**: pair subject not a Map → `DescPairNotMapError`; keys not
  comparable → `DescKeysNotComparableError`.

### `nullsFirst(keyExpr)`

- **Arity** 2. **Subject** pair Map `{ :left x :right y }` (provided
  by `sortWith`), **modifier** `keyExpr` (any sub-pipeline).
- Ascending comparator that places null-keyed elements before all
  non-null elements. Non-null keys are sorted in ascending order.
  Use inside `sortWith` to handle data with missing values without
  tripping `AscKeysNotComparableError`.
- **Examples**:
  - `sortWith(nullsFirst(/age))` → null ages before all others.
  - `[{:a 3} {:a null} {:a 1}] | sortWith(nullsFirst(/a)) * /a`
    → `[null 1 3]`.
- **Errors**: pair subject not a Map → `NullsFirstPairNotMapError`.

### `nullsLast(keyExpr)`

- **Arity** 2. **Subject** pair Map `{ :left x :right y }` (provided
  by `sortWith`), **modifier** `keyExpr` (any sub-pipeline).
- Ascending comparator that places null-keyed elements after all
  non-null elements. Non-null keys are sorted in ascending order.
  Use inside `sortWith` to handle data with missing values without
  tripping `AscKeysNotComparableError`.
- **Examples**:
  - `sortWith(nullsLast(/age))` → null ages after all others.
  - `[{:a 3} {:a null} {:a 1}] | sortWith(nullsLast(/a)) * /a`
    → `[1 3 null]`.
- **Errors**: pair subject not a Map → `NullsLastPairNotMapError`.

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
- **Errors**: subject not a Vec → `FirstNonZeroSubjectNotVecError`; any element not a
  number → `FirstNonZeroElementNotNumberError`.

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
  first-occurrence order. Duplication is decided by structural
  equality — the same axiom that drives `eq`, so two Map / Vec /
  Set values with identical content collapse even when they are
  distinct JS objects. A recursive walk that reaches the same
  logical node via multiple paths (diamond hierarchies, fan-in
  references) therefore yields a clean set without a separate
  key-projection step.
- **Examples**:
  - `[1 2 1 3 2] | distinct` → `[1 2 3]`.
  - `[{:id 1} {:id 2} {:id 1}] | distinct` → `[{:id 1} {:id 2}]`.

### `reverse`

- **Arity** 1. **Subject** `vec`.
- Returns the Vec in reverse order.
- **Example**: `[1 2 3] | reverse` → `[3 2 1]`.

### `flat`

- **Arity** 1. **Subject** `vec`.
- Flattens one level of nesting. Elements that are Vecs are
  spliced in; other elements pass through unchanged.
- **Example**: `[[1 2] [3] [4 5]] | flat` → `[1 2 3 4 5]`.
- **Errors**: subject not a Vec → `FlatSubjectNotVecError`.

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
- Left-fold: `[a b c] | union` = `(a ∪ b) ∪ c`. Same for `minus`
  and `inter`.
- **Examples**:
  - `[#{:a :b :c} #{:b :d}] | union` → `#{:a :b :c :d}`.
  - `[#{:a :b :c} #{:b :d}] | minus` → `#{:a :c}`.
  - `[#{:a :b :c} #{:b :d}] | inter` → `#{:b}`.
  - `[{:name "a"} {:score 100}] | union`
    → `{:name "a" :score 100}`.
- **Errors**: empty Vec → `UnionBareSubjectNotVecError` / `MinusBareSubjectNotVecError` / `InterBareSubjectNotVecError`.

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

**Errors**: incompatible types (e.g., Set and number) → `UnionPairIncompatibleError` / `MinusPairIncompatibleError` / `InterPairIncompatibleError`.

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
- **Errors**: subject not a string → `SplitSubjectNotStringError`; separator not a
  string → `SplitSeparatorNotStringError`.

### `join(separator)`

- **Arity** 2. **Subject** `vec` of strings, **modifier** `separator` (string).
- Returns a single string: all elements of the subject Vec joined
  with `separator` between consecutive elements.
- **Examples**:
  - `["a" "b" "c"] | join(",")` → `"a,b,c"`.
  - `["x" "y"] | join("")` → `"xy"`.
  - `[] | join(",")` → `""`.
- **Errors**: subject not a Vec → `JoinSubjectNotVecError`; any element not a
  string → `JoinElementNotStringError`; separator not a string → `JoinSeparatorNotStringError`.

`split` and `join` are inverses: `"a,b,c" | split(",") | join(",")`
round-trips to `"a,b,c"`.

### `contains(needle)`

- **Arity** 2. **Subject** `string`, **modifier** `needle` (string).
- Returns `true` if the subject contains `needle` as a substring.
  Empty needle is always contained. Case-sensitive.
- **Examples**:
  - `"hello world" | contains("world")` → `true`.
  - `"hello" | contains("xyz")` → `false`.
- **Errors**: subject not a string → `ContainsSubjectNotStringError`; needle not a string → `ContainsNeedleNotStringError`.

### `startsWith(prefix)`

- **Arity** 2. **Subject** `string`, **modifier** `prefix` (string).
- Returns `true` if the subject begins with `prefix`.
  Empty prefix is always a prefix. Case-sensitive.
- **Examples**:
  - `"hello world" | startsWith("hello")` → `true`.
  - `"hello" | startsWith("world")` → `false`.
- **Errors**: subject not a string → `StartsWithSubjectNotStringError`; prefix not a string → `StartsWithPrefixNotStringError`.

### `endsWith(suffix)`

- **Arity** 2. **Subject** `string`, **modifier** `suffix` (string).
- Returns `true` if the subject ends with `suffix`.
  Empty suffix is always a suffix. Case-sensitive.
- **Examples**:
  - `"hello world" | endsWith("world")` → `true`.
  - `"hello" | endsWith("xyz")` → `false`.
- **Errors**: subject not a string → `EndsWithSubjectNotStringError`; suffix not a string → `EndsWithSuffixNotStringError`.

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

Twelve nullary predicates lift the `types.mjs` value-class
predicates to operand level. Primary use — inside `filter`,
`every`, `any` predicates over heterogeneous containers:
`filter(isString)` over a Vec of mixed types, or over a Map
where the value's type is the predicate axis
(`{:ID "SGML" :GlossDef {...}} | filter(isMap)` keeps only the
Map-valued entries). Without them the same classification lands
through `| type | eq(:string)` — also correct, but the dedicated
classifier reads as a single predicate at the call site. Each
classifier matches exactly one `describeType(v)` label and never
throws.

`isJsonObject` and `isJsonArray` discriminate the JSON-tagged
shapes (plain JS object / Array stamped with the `JSON_OBJECT_TAG`
/ `JSON_ARRAY_TAG` Symbol, produced by the host JSON-bridge and
by the `::json` constructor). They are runtime-distinct from
qlang Map and Vec — `isMap` and `isVec` return `false` on a JSON
shape, and vice versa.

### `isString` · `isNumber` · `isVec` · `isMap` · `isSet` · `isKeyword` · `isBoolean` · `isNull` · `isQuote` · `isDoc` · `isJsonObject` · `isJsonArray`

- **Arity** 1. **Subject** any value.
- Returns `true` iff the subject is of the named value class,
  `false` otherwise. Every qlang value produces `true` from
  exactly one classifier. Boolean and null classification is
  strict: `0 | isBoolean` → `false`, `"" | isNull` → `false`.
  `isMap` reports `false` for conduit and snapshot descriptor
  Maps — they classify as `Conduit` / `Snapshot` through the
  `:kind` discriminator.
  `isQuote` matches a frozen `~{…}`-delimited code-as-data
  fragment; `isDoc` matches a frozen content fragment
  (`|~~ ... ~~|` block-form or `|~~| ...` line-form literal).
- **Examples**:
  - `"hello" | isString` → `true`; `42 | isString` → `false`.
  - `42 | isNumber` → `true`; `3.14 | isNumber` → `true`;
    `"42" | isNumber` → `false`.
  - `[1 2] | isVec` → `true`; `#{1} | isVec` → `false`.
  - `{:a 1} | isMap` → `true`; `[] | isMap` → `false`.
  - `#{1 2} | isSet` → `true`; `[1 2] | isSet` → `false`.
  - `:name | isKeyword` → `true`; `:kind | isKeyword` → `true`.
  - `true | isBoolean` → `true`; `0 | isBoolean` → `false`.
  - `null | isNull` → `true`; `{} | /missing | isNull` → `true`.
  - `` `mul(2)` | isQuote `` → `true`; `"mul(2)" | isQuote` → `false`.
  - `|~~ note ~~| | isDoc` → `true`; `"note" | isDoc` → `false`.
  - `::json{:k 1} | isJsonObject` → `true`; `{:k 1} | isJsonObject` → `false`.
  - `::json[1 2 3] | isJsonArray` → `true`; `[1 2 3] | isJsonArray` → `false`.
- **Errors**: none — classification is total.

## Type Conversion

### `keyword`

- **Arity** 1. **Subject** `string` or `keyword`.
- String↔Keyword involution: given a string, returns the keyword with
  that name; given a keyword, returns its name as a string. Applying
  `keyword` twice returns the original value.
- **Examples**:
  - `"foo" | keyword` → `:foo`.
  - `:foo | keyword` → `"foo"`.
  - `"foo bar" | keyword` → `:"foo bar"`.
  - `"foo" | keyword | keyword` → `"foo"` (round-trip).
- **Errors**: non-String-or-Keyword subject →
  `KeywordSubjectNotStringOrKeywordError`.

## Formatting

### `json`

- **Arity** 1. **Subject** any value.
- Returns a JSON string representation of the subject.
- **Example**: `{:a 1 :b [2 3]} | json` → `"{\"a\":1,\"b\":[2 3]}"`.

### `qlang`

- **Arity** 1. **Subject** any value.
- Recursively converts JSON shape to qlang shape — `JsonObject`
  becomes a qlang `Map` (string keys preserved), `JsonArray`
  becomes a qlang `Vec`. Scalars and qlang-only values
  (`Keyword`, qlang `Map` / `Vec` / `Set`, `Error`, `Quote`,
  `Doc`, function values, tagged instances) pass through
  unchanged.
- **Idempotent.** Applying twice yields the same result as once
  — `value | qlang | qlang` ≡ `value | qlang`. The pipeline-time
  pendant of the `::qlang<payload>` TaggedLit constructor;
  reach for `qlang` when the JSON value arrives via `pipeValue`
  (CLI stdin parse, projection out of a JSON Object field) and
  needs to flow into qlang-shape operands like
  `union({:adult /age | gt(18)})`.
- **Examples**:
  - `::json{"a": 1} | qlang | isMap` → `true`.
  - `::json[1, 2] | qlang | isVec` → `true`.
  - `{:a 1} | qlang | isMap` → `true` (already qlang).
  - `42 | qlang | eq(42)` → `true` (scalar identity).

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
- **Errors**: subject not a Vec → `TableSubjectNotVecError`; row not a Map → `TableRowNotMapError`.

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
- **Skipping rule**: only `null` / `undefined` count as missing.
  Falsy-but-defined values (`false`, `0`, `""`, `[]`, `{}`, `#{}`)
  flow through as valid alternative results. Matches SQL
  `COALESCE` and JavaScript `??` semantics.
- **Short-circuits**: alternatives after the first non-null match
  are not evaluated.
- **Examples**:
  - `person | coalesce(/preferredName, /firstName, "Anonymous")` →
    first available name with default fallback.
  - `config | coalesce(/userOverride, /projectDefault, /globalDefault)`
    → cascading defaults.
  - `lookup | coalesce(/cached, /computed)` → prefer cache.
- **Errors**: zero captured args → `CoalesceNoAlternativesError`.

### `firstTruthy(...alts)`

- **Arity** variadic (1+). **Subject** `pipeValue`, **modifiers**
  one or more alternative sub-pipelines.
- Symmetric with `coalesce` but checks **truthiness** instead of
  null-ness. Each alternative is evaluated against `pipeValue` in
  order; the first one that produces a truthy value becomes the
  new `pipeValue`. If all alternatives produce falsy values
  (`null` or `false`), the result is `null`.
- **Truthiness contract**: `firstTruthy` skips `false` alongside
  `null` (treating both as "no value"); `coalesce` keeps `false`
  as a valid explicit setting. In qlang `0`, `""`, `[]`, `{}`,
  `#{}` are truthy values and flow through either operand
  unchanged.
- **Short-circuits**: alternatives after the first truthy match
  are not evaluated.
- **Examples**:
  - `person | firstTruthy(/preferredName, /firstName, /lastName, "Anonymous")`
    → first non-empty name with default fallback.
  - `flag | firstTruthy(/userValue, /default, false)` → ignore
    explicit `false` user values, fall back to default.
- **Errors**: zero captured args → `FirstTruthyNoAlternativesError`.

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
- **Errors**: fewer than 2 captured args → `CondNoBranchesError`.

## Reflective built-ins

`env`, `use`, `manifest`, `runExamples`, and `as` are
**reflective operands**: they read or write the full evaluator
state pair. All of them are ordinary entries in `langRuntime`,
look up like any other identifier, and can be shadowed by a
`:name body` BindStep or by `as`. Their distinguishing feature
is internal — the impl receives `(state, lambdas)` directly and
threads the full state through, in contrast with pure operands
that take `(pipeValue, args)`.

The declarative binding form `:name body` / `:name [:params] body`
is also covered in this section because it shares the same env-
writing semantics — it is a grammar production (a BindStep) with
its own eval handler in `eval.mjs`.

### `env`

- **Arity** 1. **Subject** irrelevant — `env` ignores its
  pipeline input and reads the evaluator state instead.
- Replaces `pipeValue` with the current `env` as a Map value.
- **Examples**:
  - `env | keys` → a Set of all identifiers in scope.
  - `env | has(:count)` → `true` (count is a built-in).
  - `env | /taxRate` → the value of a user binding, or `null`.
- Inside a fork, returns the fork's current `env` (including any
  fork-local `as` snapshot or BindStep declaration visible at the
  point of lookup).
- Captured arguments (`env(...)`) are an arity error.

### `use`

- **Arity** 1. **Subject** `map` — the Map whose entries become
  new bindings in `env`.
- Merges `pipeValue` (a Map) into `env`, returning a new state
  with the enlarged env; `pipeValue` is unchanged, so the merged
  Map can be inspected further or discarded by the next step.
  On conflict, the incoming Map wins.
- **Examples**:
  - Install constants: `{:pi 3.14159 :e 2.71828} | use | [pi e]`
    → `[3.14159 2.71828]`.
  - Shadow a built-in: `:use mul(2) | 5 | use` → `10`
    (the user's BindStep shadows the reflective `use`).
- Inside a fork (paren-group, compound literal, distribute
  iteration), the merged bindings evaporate when the fork closes,
  matching the documented fork rule — only the final `pipeValue`
  of the sub-pipeline escapes.
- **Errors**: subject not a Map → `UseSubjectNotMapError`.

### `manifest`

- **Arity** 1 or 2 (0 or 1 captured). **Subject** irrelevant —
  `manifest` ignores its pipeline input and iterates the current
  `env`.
- Returns a Vec of descriptors, one per binding in `env`, sorted
  alphabetically by binding name. The descriptor's `:kind` field
  distinguishes four provenances:
  - **Builtin** — env entry is a descriptor Map loaded by
    `langRuntime()` from one of the catalog family files under
    `lib/qlang/operand/`. The user-facing descriptor stamps
    `:kind ::builtin` (TagKeyword matching the env-side shape, so
    `manifest | first | type` and `env | /:name | type` both surface
    `::builtin`), drops the `:impl` handle (the dispatch-time
    primitive key is internal), and copies `:category` / `:subject`
    / `:modifiers` / `:returns` / `:throws` verbatim. The derived
    `:captured` / `:effectful` fields are stamped from the resolved
    primitive's `meta`:
    ```
    {:kind      ::builtin
     :name      "count"
     :category  :container-reducer
     :subject   [:vec :set :map]
     :modifiers []
     :returns   :number
     :captured  [0 0]
     :throws    [::CountSubjectNotContainerError]
     :effectful false}
    ```
    The `:captured` field is a 2-element Vec `[min max]`
    describing the range of captured-arg counts the operand
    accepts. Fixed operands have `min == max` (e.g. `count` has
    `[0 0]`; `filter` has `[1 1]`). Partial/full-applicable
    operands have `[n-1 n]` (`add` has `[1 2]`). Overloaded
    operands span the Object keys of their impl dispatch table
    (`sort` has `[0 1]`). Variadic operands use the `:unbounded`
    keyword as the upper bound (`coalesce` has `[1 :unbounded]`).
    `:throws` is a Vec of `::Tag` references — each entry is a
    navigable tag-binding, so `:foo | /throws | first | docs`
    resolves the canonical prose for that throw site.
  - **Conduit** — env entry is a BindStep-bound conduit (named
    pipeline fragment, zero or more parameters). Descriptor:
    ```
    {:kind      ::conduit
     :name      "surround"
     :params    ["pfx" "sfx"]
     :source    "(prepend(pfx) | append(sfx))"
     :effectful false
     :location  {:start ... :end ...}}
    ```
  - **Snapshot** — env entry is an `as`-bound snapshot wrapper.
    Descriptor:
    ```
    {:kind      ::snapshot
     :name      "captured"
     :value     <snapshotted value>
     :type      :vec
     :effectful false
     :location  {:start ... :end ...}}
    ```
  - **Value** — any other plain JS value (scalar, Vec, Map, Set,
    error value, function value, …). Descriptor: `:kind ::value`,
    `:name`, `:value`, `:type` (from `typeKeyword`).

  Per-binding source-level introspection goes through the axis
  trio (`:name | source` / `| docs` / `| examples`) — those read
  the catalog AST directly without staging the runtime descriptor
  Map. `manifest` is the enumeration surface; the axis trio is
  the navigation surface.
- **Namespace selector** (captured Keyword) picks which namespace
  to walk:
  - `manifest` / `manifest(:value)` — value-namespace bindings
    (operands, conduits, snapshots, `use`-installed values).
    Module-AST storage entries under `qlang/ast/<uri>` are filtered
    out. Tag-namespace `::Tag` declarations are filtered out.
  - `manifest(:tag)` — tag-namespace bindings (`::Tag` declarations
    from the operand catalog family files plus any in-query
    `::Tag {…}` BindSteps). Names render with the `::Tag` prefix
    so the descriptors compose with the tag-namespace axis trio
    (`::Tag | source` / `::Tag | docs` / `::Tag | examples`).
- **Examples**:
  - `env | manifest | filter(/kind | eq(::builtin)) | table` —
    full catalog of built-in operands as a tabular report grouped
    by category.
  - `manifest(:tag) | first | /name` — first registered `::Tag`
    binding, alphabetically.
- **Errors**: captured arg is not a Keyword →
  `ManifestNamespaceNotKeywordError`. Captured Keyword is neither
  `:value` nor `:tag` → `ManifestNamespaceUnknownError`. Two or
  more captured args → `Rule10ArityOverflowError`.

### `runExamples`

- **Arity** 1. **Subject** Keyword (binding name) or descriptor
  Map carrying a `:name` string.
- Walks the loaded modules' AST through `findBindingStepAcrossModules`
  to locate the binding's source. Pulls every Quote segment from
  each attached doc-prefix through `parseDocSegments`. For each
  Quote, evaluates the `:source` against an empty initial state;
  a result that is not `false`, `null`, or an ErrorValue counts
  as `:ok true`. Returns a Vec of `{:snippet :actual :error :ok}`
  Maps — one per Quote segment.
- Bindings without a source-located BindStep (host-installed
  bindings, runtime-seeded built-ins) return an empty Vec.
- **Example**: `:count | runExamples | first | /ok` → `true`.
- **Errors**: subject neither Keyword nor Map-with-`:name`-string
  → `RunExamplesSubjectShapeError`.

### `:name body` / `:name [:params] body` — BindStep

- **Form**: grammar production with its own dispatch path (the
  evaluator routes BindStep nodes through `evalBindStep`, separate
  from `langRuntime` lookups). The parser reads `:name`-or-`::Tag`
  head plus an optional attached doc-prefix, optional param Vec,
  and optional body, and emits a BindStep AST node
  (`core/src/grammar.peggy::BindStep`). Subject passes through
  unchanged — BindStep is transparent for pipeValue and writes
  only to env.
- Declares a conduit (named pipeline fragment) in `env`. Zero-arity
  form `:name body` binds a pipeline fragment. Parametric form
  `:name [:params] body` binds a fragment with named
  parameters for fractal composition.
- Purity-routed at eval time (`core/src/eval.mjs::evalBindStep`):
  pure-literal bodies snapshot at decl-time and land as plain
  values; impure or parametric bodies capture against a lexical
  envRef and land as conduits. Parameters become lazy conduit-
  parameter proxies (nullary function values wrapping
  captured-arg lambdas).
- Doc-only form: a BindStep with attached docs and no body
  installs a Doc-value snapshot under the name; an identifier
  lookup unwraps the snapshot and returns the Doc-value directly
  (`:guide | /content`).
- **Examples**:
  - `:double mul(2) | 10 | double` → `20`.
  - `:@surround [:pfx :sfx] (prepend(pfx) | append(sfx)) | "world" | @surround("[", "]")` → `"[world]"`.
- **Tag-binding form**: `::tag descriptor` installs the
  given descriptor Map under `::tag` for use as a TaggedLit
  constructor. The descriptor must carry `:kind :tag` plus
  `:impl` — either a `:qlang/prim/<tag>` keyword (host-bound
  built-in constructor) or a Quote-value (qlang body that runs
  with the payload as its initial pipeValue). Example:
  `::wrap {:kind :tag :impl `prepend("[") | append("]")`} | "x" | ::wrap "x"`
  → `"[x]"`.
- **Errors**: clean binding name carrying an effectful body →
  `EffectLaunderingAtBindStepParseError` (the only runtime throw inside
  `evalBindStep`). Name shape, params shape, body presence, and
  doc-prefix arity are all guaranteed by the grammar — no
  runtime check needed.

### `as(:name)`

- **Arity** 2 (1 captured). **Subject** any (the value to snapshot).
- Captures the current `pipeValue` as a frozen snapshot under the
  given keyword name. `pipeValue` passes through unchanged. The
  snapshot is retrievable by name through identifier lookup
  (auto-unwrapped to the raw value); for the binding's attached
  doc-prefix reach for the axis trio (`:name | source / docs /
  examples`).
- **Examples**:
  - `42 | as(:answer) | answer` → `42`.
  - `[1 2 3] | as(:nums) | nums | count` → `3`.
- **Errors**: name not a keyword → `AsNameNotKeywordError`.

### `parse`

- **Arity** 1. **Subject** `string` — the source to parse.
- Reads the subject string into an **AST-Map** — the data-form
  representation of the program, produced by `walk.mjs::astNodeToMap`.
  Each AST node becomes a frozen Map carrying `:kind` (the
  AST type keyword: `:NumberLit`, `:OperandCall`, `:Projection`,
  `:Pipeline`, and so on), type-specific payload fields (`:value`,
  `:name`, `:args`, `:elements`, `:entries`, `:keys`, `:steps`,
  etc.), and the shared `:text` / `:location` metadata the parser
  stamps on every node. Nested nodes recurse into their own Maps.
- The underlying peggy `ParseError` is caught in-operand and
  converted to an error value via `errorFromParse`, so malformed
  sources surface on the fail-track with `:kind ::ParseError`
  (the per-site tag identity; the `::ParseError` tag-binding's
  catalog body carries `:category :parse-error` for the broad
  bucket — distinct from the `:foreign-error` catalog category
  every host JS throw lands under).
- **Examples**:
  - `"42" | parse | /:kind` → `:NumberLit`.
  - `"add(1, 2)" | parse | /name` → `"add"`.
  - `"add(1, 2)" | parse | /args | count` → `2`.
  - `"this is not qlang [" | parse !| type` → `::ParseError`.
  - `"this is not qlang [" | parse !| type | spec | /category` → `:parse-error`.
- **Errors**: subject not a String or Quote → `ParseSubjectNotStringOrQuoteError`.
  Malformed source → error value with `:kind ::ParseError`
  (not thrown; passes onto fail-track as `pipeValue`).

### `eval`

- **Arity** 1. **Subject** `map` — the AST-Map to evaluate.
- Unwraps an AST-Map through `walk.mjs::qlangMapToAst` and runs
  the reconstructed AST against the current state. The caller's
  `pipeValue` becomes the inner evaluation's `pipeValue`; the
  caller's `env` threads in unchanged. Any BindStep / `as` / `use`
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
  - `{:kind :NumberLit :value 42} | eval` → `42`
    (hand-assembled AST-Map bypasses the parser).
- **Errors**: subject not a Map or Quote → `EvalSubjectNotMapOrQuoteError`.
  Runtime errors inside the inner evaluation lift through the
  normal fail-track just like any other qlang failure.

### `apply(subject)`

- **Arity** 2 (1 captured). **Subject** Quote-value or AST-Map
  sitting in `pipeValue`.
- Runs the Quote-or-Map body against the captured-arg `subject` as
  the initial `pipeValue`. A Quote's leading combinator (if any —
  `~{* mul(2)}` / `~{| count}` / `~{!| /trail}`) routes the first
  step through that combinator against the new subject, so a
  pipeline-suffix shape replays semantically.
- BindStep / `as` / `use` writes inside the applied body propagate
  outward, matching `eval` semantics.
- **Examples**:
  - `~{mul(2)} | apply(5)` → `10`.
  - `~{| count | add(1)} | apply([1 2 3])` → `4`.
  - `error !| /trail | apply(start)` — re-runs deflected steps
    against a fresh subject.
- **Errors**: pipeValue not a Map or Quote → `EvalSubjectNotMapOrQuoteError`.

### `source`

- **Arity** 1. **Subject** Keyword (`:name`) or TagKeyword (`::Tag`).
- Returns a Quote carrying the verbatim source text of the
  binding's declaring BindStep (or `as(:name)` OperandCall) found
  across loaded modules.
- **Examples**:
  - `:count | source | /source` → the `:count` BindStep source.
  - `::conduit | source | /source` → the `::conduit` tag-binding source.
- **Errors**: subject not a Keyword or TagKeyword →
  `SourceSubjectNotKeywordOrTagError`; no declaring step found →
  `AxisBindingNotFoundError`.

### `docs`

- **Arity** 1. **Subject** Keyword, TagKeyword, or tagged-instance Map.
- Returns a Vec of Doc-values from the binding's attached doc-prefix,
  one Doc per prefix entry.
- **Examples**:
  - `:count | docs` → Vec of Doc-values from the `:count` catalog entry.
  - `::conduit | docs` → Vec of Doc-values from the `::conduit` tag-binding.
- **Errors**: subject not a Keyword / TagKeyword →
  `DocsSubjectNotKeywordOrTagError`; no declaring step found →
  `AxisBindingNotFoundError`.

### `examples`

- **Arity** 1. **Subject** Keyword, TagKeyword, or tagged-instance Map.
- Returns a Vec of Quote-values extracted from the binding's
  doc-prefix — every `~{…}` Quote segment in the doc-content stream
  is a candidate test case for `runExamples`.
- **Examples**:
  - `:count | examples` → Vec of `~{…}` Quotes from the `:count` docs.
  - `:add | examples | count` → number of inline Quote examples on `:add`.
- **Errors**: subject not a Keyword / TagKeyword →
  `ExamplesSubjectNotKeywordOrTagError`; no declaring step found →
  `AxisBindingNotFoundError`.

### `type`

- **Arity** 1. **Subject** any value.
- Returns the Keyword or TagKeyword identity of the value's type.
  Scalars produce plain keywords (`:number`, `:string`, `:boolean`,
  `:null`); qlang value-classes produce their type keyword (`:vec`,
  `:map`, `:set`, `:keyword`, `:tag-keyword`, `:quote`, `:doc`,
  `:function`, `:json-object`, `:json-array`); tagged-instance Maps
  (conduit, snapshot, user `::Foo[…]`) produce their `:kind`
  TagKeyword (`::conduit`, `::snapshot`, `::Foo`); error values
  produce the `:kind` TagKeyword from their descriptor
  (`::AddLeftNotNumberError`, `::ParseError`, etc.).
- **Examples**:
  - `42 | type` → `:number`.
  - `"hello" | type` → `:string`.
  - `:foo | type` → `:keyword`.
  - `[1 2] | type` → `:vec`.
  - `{:a 1} | type` → `:map`.
  - `::conduit[[] ~{mul(2)}] | type` → `::conduit`.
  - `!{:kind :oops} | type` → `:error`.

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
- **Errors**: subject not a Map → `ErrorDescriptorNotMapError`.

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
> [1 "x" 3] * add(10) | filter(!| type | eq(::AddLeftNotNumberError))
[
  ::AddLeftNotNumberError!{
    :fault {:step ~{add(10)} :input "x"}
    :actualValue "x"
    :actualType :string
  }
]
```

## Summary: unique operand names by `:category` keyword

`count`, `empty`, and `has` are polymorphic — one identifier
dispatches on subject type. `filter`, `every`, `any` are
polymorphic over Vec / Set / Map. `sort` is overloaded by arity —
same identifier, 0 or 1 captured arg. `manifest` is overloaded by
arity (bare value-namespace enumeration or `manifest(:tag)` for
the tag-namespace). `use` is overloaded by arity (bare merge,
namespace import, selective import). Each name is listed once;
rows are keyed by the `:category` keyword each entry's descriptor
carries (the same keywords `env | manifest | /category | distinct`
enumerates).

| `:category` keyword | Names (frequent → specialized) |
|---|---|
| `:container-reducer` | `count`, `empty` (polymorphic over Vec / Set / Map) |
| `:container-selector` | `filter`, `every`, `any` (polymorphic over Vec / Set / Map) |
| `:vec-reducer` | `sum`, `min`, `max` (Vec / Set — commutative reductions), `first`, `last`, `firstNonZero` (Vec-only — order-dependent) |
| `:vec-transformer` | `sort`, `take`, `drop`, `distinct`, `reverse`, `flat`, `sortWith`, `groupBy`, `indexBy` |
| `:comparator` | `asc`, `desc`, `nullsFirst`, `nullsLast` |
| `:control` | `if`, `when`, `unless`, `coalesce`, `cond`, `firstTruthy` |
| `:map-op` | `keys`, `vals`, `has` (polymorphic with Set) |
| `:set-op` | `set`, `union`, `minus`, `inter` |
| `:arith` | `add`, `sub`, `mul`, `div` |
| `:string` | `split`, `join`, `contains`, `startsWith`, `endsWith`, `prepend`, `append` |
| `:predicate` | `not`, `eq`, `gt`, `lt`, `gte`, `lte`, `and`, `or` |
| `:type-classifier` | `isString`, `isNumber`, `isVec`, `isMap`, `isSet`, `isKeyword`, `isBoolean`, `isNull`, `isQuote`, `isDoc`, `isJsonObject`, `isJsonArray` |
| `:type-conversion` | `keyword` |
| `:indexed-access` | `at` |
| `:format` | `json`, `table` |
| `:error` | `error`, `isError` |
| `:reflective` | `as`, `env`, `use`, `manifest`, `runExamples` (plus the `:name body` BindStep grammar production) |
| `:code-as-data` | `parse`, `eval`, `apply` |
| `:axis` | `source`, `docs`, `examples` |

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
