# Qlang Query Language — Core Runtime Reference

This document catalogs the built-in operands of the query language.
Every entry lives as a field of the language runtime Map
(`langRuntime()` in the bootstrap), so identifier lookup resolves them
the same way as any other binding in `env`. See
[qlang-internals.md](qlang-internals.md) for the
evaluation model and [qlang-spec.md](qlang-spec.md)
for the language syntax.

**Host-bound operands.** The `@kaluchi/qlang-cli` workspace binds
a fixed set of host operands on top of `langRuntime()` — effectful
I/O (`@in`, `@out`, `@err`, `@tap`), value formatters (`pretty`,
`tjson`, `template`), and the tagged-JSON parser `parseTjson`. These
are host-scope additions; their contracts
live in [`cli/README.md`](../cli/README.md). Another host (a
browser playground, a server-side evaluator) is free to bind a
different operand set — every binding uses the same
dispatch wrappers from `@kaluchi/qlang-core/dispatch` and the same
per-site error factories from `@kaluchi/qlang-core/operand-errors`
and `@kaluchi/qlang-core/errors`.

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
with its polymorphism siblings, so the keywords below form part of the
doc surface and the runtime catalog alike. A verb on its noun carries
no category: the noun groups it, `::vec | spec | /verbs` listing the
verbs of vectors [D72].

| `:category` keyword | Meaning |
|---|---|
| `:reflective` | Operand that reads or writes the evaluator state pair (env / use / manifest / runExamples). The declarative binding form `:name body` parses as a BindStep (a grammar production with its own dispatch path). |
| `:axis` | Declarative-metadata reader from binding name to source AST (source / docs / examples). |

## Container reducers — `(Vec / Set / Map) → Scalar`

### `count`

- **Arity** 1. **Subject** one of `Vec` / `Set` / `Map`.
  Polymorphic — `count` reads the cardinality of any container.
- Returns the number of elements (Vec length, Set size, Map entry
  count).
- **Examples**: `[1 2 3 4 5] | count` → `5`; `#[:a :b :c] | count` →
  `3`; `{:x 1 :y 2} | count` → `2`; `[] | count` → `0`.
- **Errors**: a subject of another kind → the contract's `VerbWithoutBodyError` with `:addresses`.

### `empty`

- **Arity** 1. **Subject** one of `Vec` / `Set` / `Map`.
  Polymorphic — empty-check is container-shape-independent.
- Returns `true` if the container holds zero items, `false`
  otherwise.
- **Examples**: `[] | empty` → `true`; `#[] | empty` → `true`;
  `{} | empty` → `true`; `[1] | empty` → `false`.
- **Errors**: a subject of another kind → the contract's `VerbWithoutBodyError` with `:addresses`.

## Value reducers — `(Vec / Set / Map) → Scalar`

A map's elements are its values, so the reducers read them.

### `sum`

- **Arity** 1. **Subject** one of `Vec` / `Set` / `Map`. Polymorphic —
  `sum` is commutative, so the result is shape-independent.
- Returns the numeric sum of elements. Empty container yields
  `0`. Every element must be a number.
- **Examples**: `[1 2 3 4] | sum` → `10`; `#[1 2 3] | sum` → `6`;
  `{:a 10 :b 20} | sum` → `30`.
- **Errors**: a subject of another kind → the contract's `VerbWithoutBodyError` with `:addresses`;
  element not a number → `SumElementNotNumberError`; running total
  outside the finite-double domain → `SumResultNotFiniteError`, whose
  `:index` names the element the total crossed at. The total is read
  at every element in the subject's order, so a subject whose partial
  sums leave the domain lifts while its mathematical total sits
  inside it — `[1e308 1e308 -1e308] | sum` lifts at element 1,
  `[1e308 -1e308 1e308] | sum` answers `1e308`. `reduce 0 ~(add)`
  folds through the same readings and lifts at the same element.

### `reduce seed ~(reducer)`

- **Arity** 3 (2 captured). **Subject** one of `Vec` / `Set` / `Map`. The
  universal left-fold (catamorphism) — threads an accumulator across
  the elements in the subject's order, a Set's the one order, and
  collapses them to a single value.
- `seed` is the initial accumulator (returned as-is for an empty
  subject). The reducer is applied as `reducer accumulator element`:
  a **binary operand** (`add` / `mul` / `union` / …) folds via its
  bound form (`acc | add element`), or a **verb**, the accumulator
  its subject and the element its first slot, for custom logic. A
  reducer error short-circuits the fold.
- **Examples**: `[1 2 3 4 5] | reduce 0 ~(add)` → `15`;
  `[1 2 3 4 5] | reduce 1 ~(mul)` → `120`;
  `["a" "b" "c"] | reduce "" ~(append)` → `"abc"`;
  `[#[1] #[2 3]] | reduce #[] ~(union)` → `#[1 2 3]`;
  `:max2 ::verb~(:x ::number | if (gt x) ~(/) ~(x)) | [3 1 4 1 5] | reduce 0 ~max2` → `5`.
  `sum` / `count` / `max` and structure-builders all factor through it.
- **Errors**: a subject of another kind → the contract's `VerbWithoutBodyError` with `:addresses`;
  reducer not a binary operand or a verb →
  `ReduceReducerNotBinaryError`.

### `min`, `max`

- **Arity** 1. **Subject** one of `Vec` / `Set` / `Map`.
- Returns the first (or last) element in the one order of values,
  the order `sort` answers. Empty container yields `null`.
- **Examples**: `[3 1 4 1 5] | min` → `1`; `#[3 1 4] | max` → `4`;
  `[:y :a :m] | min` → `:a`; `[3 "a" null] | min` → `null`;
  `[3 "a" null] | max` → `"a"`; `{:a 3 :b 1} | min` → `1`.
- **Errors**: a subject of another kind → the contract's `VerbWithoutBodyError` with `:addresses`.

## Ordered-sequence reducers — `Vec / Set / Map → Any`

Polymorphic across Vec, Set and Map subjects, a map's elements being
its values in the order of its entries. A Set is the vector in the
one order without duplicates, so first / last / at read its least
element, its greatest and its n-th in that order.

### `first`

- **Arity** 1. **Subject** `vec`, `set` or `map`.
- Returns the first element (the least on a Set, the first value on
  a Map), or `null` if the container is empty.
- **Example**: `[10 20 30] | first` → `10`; `#[:c :a :b] | first` →
  `:a`; `{:a 1 :b 2} | first` → `1`; `[] | first` → `null`.
- **Errors**: a subject of another kind → the contract's `VerbWithoutBodyError` with `:addresses`.

### `last`

- **Arity** 1. **Subject** `vec`, `set` or `map`.
- Returns the last element (the greatest on a Set, the last value on a
  Map), or `null` if the container is empty.
- **Example**: `[10 20 30] | last` → `30`; `#[:c :a :b] | last` →
  `:c`; `{:a 1 :b 2} | last` → `2`; `[] | last` → `null`.
- **Errors**: a subject of another kind → the contract's `VerbWithoutBodyError` with `:addresses`.

### `at n`

- **Arity** 2. **Subject** `vec`, `set`, or `map`. **Modifier**
  integer index (Vec/Set) or string key (Map).
- **Vec / Set subject**: returns the element at position `n`, a Set
  indexing in its one order. Accepts negative indices — `at -1` is
  the last element. Out-of-range returns `null`.
- **Map subject**: returns the value at string key `n`, or `null` on
  miss. Dynamic string-key projection — equivalent to `/key` when the
  key is known statically.
- **Example**: `[10 20 30] | at 1` → `20`; `#[:a :b :c] | at -1` →
  `:c`; `{:x 1} | at "x"` → `1`; `{:x 1} | at "z"` → `null`.
- **Errors**: a subject of another kind → the contract's `VerbWithoutBodyError` with `:addresses`; non-integer index on Vec/Set →
  `AtIndexNotIntegerError`; a key on a Map that is neither a keyword
  nor a string → `AtKeyNotKeywordOrStringError`, the refusal of
  `::map/at` [D73].
- **See also**: bare-form projection `/n` on a Vec (e.g.
  `/items/0/name`) — same indexed-access semantics without the
  operand-call wrapper, polymorphic over Map (keyword lookup) and
  Vec (integer index) so mixed JSON paths like `/users/-1/email`
  descend through nested containers uniformly.

## Container selectors — polymorphic over `Vec` / `Set` / `Map`

`filter`, `every`, and `any` run their predicate on each element of a
container, a map's value being its element, and `filter` keeps the
keys of the entries it keeps. The predicate is code run against each
element as its subject: a quote, `filter ~(gt 1)`, the quote of a
verb's mention, `filter ~positive`, or a verb handed in its place.
The joint test of a key with its value reads the keys:

```qlang
> {:apple 1 :banana 2 :avocado 3} | inter (keys | filter ~(keyword | startsWith "a"))
{:apple 1 :avocado 3}
```

### `filter ~(pred)`

- **Arity** 2. **Subject** one of `Vec` / `Set` / `Map`,
  **modifier** `pred` (a predicate quote or a verb).
- Keeps items whose predicate answers `true`, collecting
  into a new container of the same shape. Vec and Set iterate
  per element in their order; on a Map the predicate
  sees each value and the entries kept keep their keys. Empty
  subject returns an empty container of the same kind.
- **Examples**:
  - `[1 2 3 4 5] | filter ~(gt 2)` → `[3 4 5]`.
  - `[{:age 25} {:age 15}] | filter ~(/age | gte 18)` → `[{:age 25}]`.
  - `[1 -2 3] | :positive ::verb~(gt 0) | filter ~positive` → `[1 3]` — a declared verb, the element its subject.
  - `#[1 2 3 4 5] | filter ~(gt 2)` → `#[3 4 5]`.
  - `{:a 1 :b 2 :c 3} | filter ~(gt 1)` → `{:b 2 :c 3}` — 0-arity pred, value axis.
  - `{:a 1 :b -2 :c 3} | :positive ::verb~(gt 0) | filter ~positive` → `{:a 1 :c 3}` — a declared verb, the value its subject.
  - `{} | filter ~(gt 0)` → `{}` — empty subject returns empty Map.
- **Errors**: a subject of another kind → the contract's `VerbWithoutBodyError` with `:addresses`.

### `every ~(pred)`

- **Arity** 2. **Subject** one of `Vec` / `Set` / `Map`,
  **modifier** `pred`.
- Returns `true` iff every item of the container satisfies the
  predicate. Short-circuits on the first `false`. Vacuously
  true for empty containers. The predicate sees each element, a
  map's value among them, as `filter`'s does.
- **Examples**:
  - `[2 4 6] | every ~(gt 0)` → `true`.
  - `[1 2 3] | every ~(gt 2)` → `false`.
  - `[2 4 6] | :positive ::verb~(gt 0) | every ~positive` → `true` — a declared verb.
  - `[] | every ~(gt 0)` → `true`.
  - `#[2 4 6] | every ~(gt 0)` → `true`.
  - `{:a 1 :b 2 :c 3} | every ~(gt 0)` → `true` — 0-arity, value axis.
  - `{:a 1 :b -2 :c 3} | every ~(gt 0)` → `false`.
- **Errors**: a subject of another kind → the contract's `VerbWithoutBodyError` with `:addresses`.

### `any ~(pred)`

- **Arity** 2. **Subject** one of `Vec` / `Set` / `Map`,
  **modifier** `pred`.
- Returns `true` iff at least one item of the container satisfies
  the predicate. Short-circuits on the first `true`.
  Vacuously false for empty containers. The predicate sees each
  element as `filter`'s does.
- **Examples**:
  - `[1 2 3] | any ~(gt 2)` → `true`.
  - `[1 2 3] | any ~(gt 99)` → `false`.
  - `[1 2 3] | :big ::verb~(gt 2) | any ~big` → `true` — a declared verb.
  - `[] | any ~(gt 0)` → `false`.
  - `#[1 2 3] | any ~(gt 2)` → `true`.
  - `{:a -1 :b 0 :c 2} | any ~(gt 0)` → `true` — 0-arity, value axis.
- **Errors**: a subject of another kind → the contract's `VerbWithoutBodyError` with `:addresses`.

## Ordered-sequence transformers — `Vec / Set → Vec / Set` / `Vec / Set → Map`

Shape-preserving on Vec/Set: a Vec subject returns a Vec, a Set
subject a Set, minted again by its constructor, except that `sort`
and `reverse` impose an order and answer a Vec for a Set, whose own
order is fixed. `sort`, `take`, `drop` and `reverse` also take a
Map, ordering and cutting its entries by their values and keeping the
keys.

### `groupBy ~(keyFn)`

- **Arity** 2. **Subject** `vec` or `set`, **modifier** `keyFn` (key
  pipeline returning a keyword).
- Partitions a sequence into a Map keyed by the result of `keyFn`
  applied to each element. Preserves first-occurrence order for the
  Map entry sequence; each bucket is a Vec for Vec subject, a Set
  for Set subject — the bucket inherits the subject's uniqueness
  invariant.
- **Example**: `[{:dept :eng :name "a"} {:dept :sales :name "b"} {:dept :eng :name "c"}] | groupBy ~(/dept) | /eng * /name` → `["a" "c"]`.
- **Errors**: a subject of another kind → the contract's `VerbWithoutBodyError` with `:addresses`;
  key not a keyword → `GroupByKeyNotKeywordError`.

### `indexBy ~(keyFn)`

- **Arity** 2. **Subject** `vec` or `set`, **modifier** `keyFn` (key
  pipeline returning a keyword).
- Collapses a sequence into a Map keyed by the result of `keyFn`. On
  collision, the last element wins.
- **Example**: `[{:id :a :name "alice"} {:id :b :name "bob"}] | indexBy ~(/id) | /a/name` → `"alice"`.
- **Errors**: a subject of another kind → the contract's `VerbWithoutBodyError` with `:addresses`;
  key not a keyword → `IndexByKeyNotKeywordError`.

### `sort`

- **Arity** 1. **Subject** `vec`, `set` or `map`.
- Returns a new Vec in the one order of values, a Map with its
  entries sorted by their values. Values order first by kind: null, boolean, number,
  string, keyword, tag name, vector, set, map, quote, doc, error and
  elision, then every other tag by its name. Within a kind numbers
  order by value, strings by their code units, keywords and tag
  names by their names, vectors element by element, a set as its
  vector, maps by their keys and then their values, and a tagged
  value by its payload.
- **Examples**: `[3 1 4 1 5] | sort` → `[1 1 3 4 5]`;
  `[3 null "x" 1] | sort` → `[null 1 3 "x"]`;
  `#[3 1 2] | sort` → `[1 2 3]`;
  `[[2 1] [1 2] [1]] | sort` → `[[1] [1 2] [2 1]]`;
  `[::B :b ::A :a] | sort` → `[:a :b ::A ::B]`;
  `{:a 3 :b 1 :c 2} | sort | vals` → `[1 2 3]`.
- **Errors**: a subject of another kind → the contract's `VerbWithoutBodyError` with `:addresses`.

### `sort ~(key)`

- **Arity** 2. **Subject** `vec`, `set` or `map`, **modifier** `key`
  (a quote).
- Returns a new Vec ordered by the value `key` answers for each
  element, in the one order, a Map with its entries so ordered by
  their values; elements whose
  keys are equal keep their subject order. A vector serves as a
  compound key, and the descending order is the sort reversed.
- **Examples**:
  - `[{:age 30} {:age 20}] | sort ~(/age)` → `[{:age 20} {:age 30}]`.
  - `[{:a 1 :b 2} {:a 1 :b 1} {:a 0 :b 9}] | sort ~([/a /b])` → `[{:a 0 :b 9} {:a 1 :b 1} {:a 1 :b 2}]`.
  - `[3 null 1] | sort ~([(eq null) /])` → `[1 3 null]`, the nulls last.
  - `[{:k 1} {:k 3} {:k 2}] | sort ~(/k) | reverse` → `[{:k 3} {:k 2} {:k 1}]`.
- **Errors**: a subject of another kind → the contract's `VerbWithoutBodyError` with `:addresses`;
  key not a quote → `SortKeyNotQuoteError`.

### `take n`

- **Arity** 2. **Subject** `vec`, `set` or `map`, **modifier** `n`
  (whole-number count).
- Returns the first `n` elements in the subject's order, a Set's
  least among them. If `n` exceeds
  length, returns the whole sequence; a negative `n` clamps to 0
  (takes nothing). Same shape as subject.
- **Example**: `[1 2 3 4 5] | take 3` → `[1 2 3]`;
  `#[:a :b :c :d] | take 2` → `#[:a :b]`;
  `{:a 1 :b 2 :c 3} | take 2` → `{:a 1 :b 2}`.
- **Errors**: a subject of another kind → the contract's `VerbWithoutBodyError` with `:addresses`;
  non-integer count → `TakeCountNotIntegerError`.

### `drop n`

- **Arity** 2. **Subject** `vec`, `set` or `map`, **modifier** `n`
  (whole-number count).
- Returns the sequence with the first `n` elements removed. If `n`
  exceeds length, returns the empty sequence; a negative `n` clamps to
  0 (drops nothing). Same shape as subject.
- **Example**: `[1 2 3 4 5] | drop 2` → `[3 4 5]`;
  `#[:a :b :c :d] | drop 2` → `#[:c :d]`;
  `{:a 1 :b 2 :c 3} | drop 2` → `{:c 3}`.
- **Errors**: a subject of another kind → the contract's `VerbWithoutBodyError` with `:addresses`;
  non-integer count → `DropCountNotIntegerError`.

### `distinct`

- **Arity** 1. **Subject** `vec` or `set`.
- **Returns** a `Set` — the constructor of the Set, which `#[…]` and
  `::set[…]` share. Lifts the uniqueness invariant onto the type
  plane: downstream operands receive a value that announces «no
  duplicates» through its kind, freeing the author from defensive
  `… | distinct` chains before subsequent steps. A Set subject
  passes through as it is.
- Duplication is decided by structural equality (the same axiom that
  drives `eq`) — two Map / Vec / Set values with identical content
  collapse even when they are distinct JS objects. A recursive walk
  that reaches the same logical node via multiple paths (diamond
  hierarchies, fan-in references) therefore yields a clean Set
  without a separate key-projection step.
- The elements come in the one order of values; the order of first
  occurrence does not survive.
- **Examples**:
  - `[1 2 1 3 2] | distinct` → `#[1 2 3]`.
  - `[2 1 2] | distinct | payload` → `[1 2]`.
  - `[{:id 1} {:id 2} {:id 1}] | distinct` → `#[{:id 1} {:id 2}]`.
  - `#[1 2 3] | distinct` → `#[1 2 3]` (identity on Set).

### `reverse`

- **Arity** 1. **Subject** `vec`, `set` or `map`.
- Returns the sequence in reverse order: a Vec for a Vec or a Set,
  whose own order is fixed, and a Map with its entries reversed.
- **Example**: `[1 2 3] | reverse` → `[3 2 1]`;
  `#[:a :b :c] | reverse` → `[:c :b :a]`;
  `{:a 1 :b 2} | reverse | vals` → `[2 1]`.

### `flat`

- **Arity** 1. **Subject** `vec` or `set`.
- Flattens one level of nesting. Elements that are Vecs or Sets are
  spliced in; other elements pass through unchanged. Same shape as
  subject: over a Set the result is minted as a Set again, so a Set
  of Sets flattens into their union.
- **Example**: `[[1 2] [3] [4 5]] | flat` → `[1 2 3 4 5]`;
  `#[#[1 2] #[2 3]] | flat` → `#[1 2 3]`.
- **Errors**: a subject of another kind → the contract's `VerbWithoutBodyError` with `:addresses`.

## Map operations

`keys`, `vals` and `has` reside on `::map`, and `has` on `::set`
as well, under one contract on `::qlang/any` [D72], [D74]; a subject
of another kind → the contract's `VerbWithoutBodyError` with
`:addresses`.

### `keys`

- **Arity** 1. **Subject** `map`.
- Returns the Set of keys (keywords), sorted.
- **Example**: `{:name "Alice" :age 30} | keys` → `#[:age :name]`.

### `vals`

- **Arity** 1. **Subject** `map`.
- Returns a Vec of values, in insertion order.
- **Example**: `{:name "Alice" :age 30} | vals` → `["Alice" 30]`.

### `has key`

- **Arity** 2. **Subject** `map`, **modifier** `key` (a keyword or a
  string, both naming the key as the map stores it).
- Returns `true` if the Map contains the key, `false` otherwise.
- **Example**: `{:name "Alice"} | has :name` → `true`;
  `{:name "Alice"} | has :age` → `false`.
- **Errors**: a key of another kind → `HasKeyNotKeywordOrStringError`.

## Set operations

### `has element`

- **Arity** 2. **Subject** `set`, **modifier** `element`, any value.
- Returns `true` if the value is a member of the Set, found by a
  binary search in the one order.
- **Example**: `#[:a :b :c] | has :b` → `true`.

`count` and `empty` on a Set and on a Map reside on each kind under
one contract on `::qlang/any` [D72], one doc entry here.

## Set operations of sets, maps and vectors — `union`, `minus`, `inter`

Each of the three resides on `::set`, `::map` and `::vec` under one
contract on `::qlang/any` [D72], [D74]. On a set and on a map the other
operand is the slot; on a vector the subject is the vector of operands
the verb folds, and so is a set whose other operand is left out. Two
Sets combine by a merge of their elements in the one order. Three call
shapes are supported:

### Bound form — one captured arg

- **Arity** 2. **Subject** `left`, a set or a map, **modifier** `right`.
- Applied under Rule 10 partial: `left | union right` evaluates
  `right` as a sub-expression against `left` as context.
- **Examples**:
  - Enrich a Map: `{:name "a" :age 20} | union {:adult (/age | gt 18)}`
    → `{:name "a" :age 20 :adult true}`.
  - Drop fields: `{:name "a" :age 20 :tmp 1} | minus #[:tmp]`
    → `{:name "a" :age 20}`.
  - Select fields: `{:name "a" :age 20 :tmp 1} | inter #[:name :age]`
    → `{:name "a" :age 20}`; a vector of keys selects the same,
    `{:name "a" :age 20 :tmp 1} | inter [:name :age]`.
  - Override: `{:name "a" :age 20} | union {:age (/age | add 1)}`
    → `{:name "a" :age 21}`.

### Bare form — zero captured args

- **Arity** 1. **Subject** `vec` — a non-empty Vec of operands, or a
  set of them.
- Left-fold: `[a b c] | union` = `(a ∪ b) ∪ c`. Same for `minus`
  and `inter`.
- **Examples**:
  - `[#[:a :b :c] #[:b :d]] | union` → `#[:a :b :c :d]`.
  - `[#[:a :b :c] #[:b :d]] | minus` → `#[:a :c]`.
  - `[#[:a :b :c] #[:b :d]] | inter` → `#[:b]`.
  - `[{:name "a"} {:score 100}] | union`
    → `{:name "a" :score 100}`.
  - `#[#[1] #[2]] | union` → `#[1 2]`.
- **Errors**: empty Vec → `UnionBareEmptyError` / `MinusBareEmptyError` / `InterBareEmptyError`.

### Full form — two captured args

- **Arity** 2 full application. Both slots captured; `pipeValue`
  becomes the context for resolving them.
- **Example**:
  - `{:p {:a 1} :q {:b 2}} | union /p /q` →
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

**Errors**: another operand of a kind the slot does not declare → `VerbSlotNotOfKindsError`; a pair of kinds apart inside a fold, and a vector beside another operand, a vector being no set for the algebra [D16] → `UnionPairIncompatibleError` / `MinusPairIncompatibleError` / `InterPairIncompatibleError`.

## Arithmetic — `Scalar → Scalar`

The arithmetic verbs reside on `::number`, declared in
`lib/qlang/number.qlang` [D72]: the head of each checks its subject
and its slot before the primitive runs, raising the verb's own
`…LeftNotNumberError` / `…RightNotNumberError`, and `::number/add |
spec` answers the head. Every arithmetic operand answers a finite
double or lifts: a result that leaves the range fires the operand's
own `…ResultNotFiniteError` carrying both finite operands under
`:leftValue` / `:rightValue`. See [number](qlang-spec.md#number)
for the rule and the two other seams that enforce it.

### `add n` / `add a b`

- **Arity** 2. **Subject** `a`, **modifier** `b`, the slot `:addend`.
- Unary partial form: `a | add b` = `a + b`.
- Full form: `add a b` — both captured, `pipeValue` is context.
- **Example**: `10 | add 3` → `13`; `{:x 10 :y 3} | add /x /y` → `13`.
- **Errors**: result past the finite double range → `AddResultNotFiniteError`.

### `sub n` / `sub a b`

- **Arity** 2. Non-commutative: `a - b` (position 1 minuend).
- **Errors**: result past the finite double range → `SubResultNotFiniteError`.
- **Example**: `10 | sub 3` → `7`; `{:x 10 :y 3} | sub /x /y` → `7`.

### `mul n` / `mul a b`

- **Arity** 2. Commutative.
- **Errors**: result past the finite double range → `MulResultNotFiniteError`.
- **Example**: `10 | mul 3` → `30`; `{:x 5 :y 4} | mul /x /y` → `20`.

### `div n` / `div a b`

- **Arity** 2. Non-commutative: `a / b` (position 1 dividend).
- **Example**: `10 | div 2` → `5`; `{:x 20 :y 4} | div /x /y` → `5`.
- **Errors**: divisor = 0 → `DivisionByZeroError`; result past the finite double range → `DivResultNotFiniteError`.

## String

The verbs of strings reside on `::string`, `join` on `::vec`, and
`prepend` and `append` on both under one contract on `::qlang/any`
[D72], [D75]. A subject of another kind is refused by the verb's head
at the subject, or, for `prepend` and `append`, by the contract's
`VerbWithoutBodyError` with `:addresses`.

### `prepend x`

- **Arity** 2. **Subject** `string` or `vec`, **modifier** `x`.
- A string takes `x`, a string, as its prefix; a vector takes `x`, any
  value, as its first element. The subject keeps its kind and the tags
  over it, a set staying a set through its constructor.
- **Examples**: `"world" | prepend "hello "` → `"hello world"`;
  `[2 3] | prepend 1` → `[1 2 3]`.
- **Errors**: a prefix of another kind before a string → `PrependPrefixNotStringError`.

### `append x`

- **Arity** 2. **Subject** `string` or `vec`, **modifier** `x`.
- A string takes `x`, a string, as its suffix; a vector takes `x`, any
  value, as its last element, so `[1] | append [2 3]` → `[1 [2 3]]` and
  vectors join through `flat`. The subject keeps its kind and the tags
  over it, so `#[1 2] | append 1` → `#[1 2]`.
- **Examples**: `"hello" | append " world"` → `"hello world"`;
  `[1 2] | append 3` → `[1 2 3]`.
- **Errors**: a suffix of another kind after a string → `AppendSuffixNotStringError`.

### `split separator`

- **Arity** 2. **Subject** `string`, **modifier** `separator` (string).
- Returns a Vec of substrings obtained by splitting the subject
  on every occurrence of `separator`.
- **Examples**:
  - `"a,b,c" | split ","` → `["a" "b" "c"]`.
  - `"line1\nline2\nline3" | split "\n"` → `["line1" "line2" "line3"]`.
  - `"" | split ","` → `[""]`.
- **Errors**: subject not a string → `SplitSubjectNotStringError`; separator not a
  string → `SplitSeparatorNotStringError`.

### `lines`

- **Arity** 1. **Subject** `string`.
- Returns the lines of the text as a Vec of strings. A `\n` ends a
  line and a `\r` before it belongs to the ending; a newline at the
  end closes the last line rather than opening an empty one, so a
  text reads alike with and without it, and the empty text has no
  lines. Where `split "\n"` answers `[""]` for the empty text and a
  trailing `""` after a final newline, `lines` answers the lines a
  text file holds.
- **Examples**:
  - `"north\nsouth" | lines` → `["north" "south"]`.
  - `"one\r\ntwo\n" | lines` → `["one" "two"]`.
  - `"" | lines` → `[]`.
- **Errors**: subject not a string → `LinesSubjectNotStringError`.

### `join separator`

- **Arity** 2. **Subject** `vec` of strings, **modifier** `separator` (string).
- Returns a single string: all elements of the subject Vec joined
  with `separator` between consecutive elements.
- **Examples**:
  - `["a" "b" "c"] | join ","` → `"a,b,c"`.
  - `["x" "y"] | join ""` → `"xy"`.
  - `[] | join ","` → `""`.
- **Errors**: subject not a Vec → `JoinSubjectNotVecError`; any element not a
  string → `JoinElementNotStringError`; separator not a string → `JoinSeparatorNotStringError`.

`split` and `join` are inverses: `"a,b,c" | split "," | join ","`
round-trips to `"a,b,c"`.

### `contains needle`

- **Arity** 2. **Subject** `string`, **modifier** `needle` (string).
- Returns `true` if the subject contains `needle` as a substring.
  Empty needle is always contained. Case-sensitive.
- **Examples**:
  - `"hello world" | contains "world"` → `true`.
  - `"hello" | contains "xyz"` → `false`.
- **Errors**: subject not a string → `ContainsSubjectNotStringError`; needle not a string → `ContainsNeedleNotStringError`.

### `startsWith prefix`

- **Arity** 2. **Subject** `string`, **modifier** `prefix` (string).
- Returns `true` if the subject begins with `prefix`.
  Empty prefix is always a prefix. Case-sensitive.
- **Examples**:
  - `"hello world" | startsWith "hello"` → `true`.
  - `"hello" | startsWith "world"` → `false`.
- **Errors**: subject not a string → `StartsWithSubjectNotStringError`; prefix not a string → `StartsWithPrefixNotStringError`.

### `endsWith suffix`

- **Arity** 2. **Subject** `string`, **modifier** `suffix` (string).
- Returns `true` if the subject ends with `suffix`.
  Empty suffix is always a suffix. Case-sensitive.
- **Examples**:
  - `"hello world" | endsWith "world"` → `true`.
  - `"hello" | endsWith "xyz"` → `false`.
- **Errors**: subject not a string → `EndsWithSubjectNotStringError`; suffix not a string → `EndsWithSuffixNotStringError`.

## Boolean

`not`, `and` and `or` reside on `::boolean`, and `eq`, `type` and
`json` on `::qlang/any` [D72], [D76].

### `not`

- **Arity** 1. **Subject** a boolean.
- Returns the negation of the subject; null is tested with `eq null`.
- **Example**: `true | not` → `false`; `null | eq null` → `true`.
- **Errors**: subject not a boolean → `NotSubjectNotBooleanError`.

## Predicates

### `eq value`

- **Arity** 2. Returns `true` if subject equals the captured value
  by structural equality.
- **Example**: `42 | eq 42` → `true`; `{:a 1} | eq {:a 1}` → `true`.

### `gt n`, `lt n`

- **Arity** 2. Subject-first: `a | gt b` = `a > b`, in the one order
  of `sort` / `min` / `max`. Each resides on the kind it compares,
  Number, String, Keyword (lexicographic by `.name`) and TagKeyword,
  whose head takes a value of the same kind, `:than` [D65], [D72]; a
  subject of any other kind reaches the contract on `::qlang/any` and
  is refused with the addresses of the residences.
- **Example**: `10 | gt 5` → `true`; `:b | gt :a` → `true`;
  `::B | lt ::C` → `true`.

### `gte n`, `lte n`

- **Arity** 2. Subject-first: `a | gte b` = `a ≥ b`. Same comparability
  rule as `gt` / `lt`.
- **Example**: `10 | gte 10` → `true`; `:a | lte :a` → `true`.

### `and a b`

- **Arity** 2. Returns `true` if both `a` and `b` are `true`, each
  answering a boolean: bound, `a | and b`, or in full form inside
  predicates, `filter ~(and /active (/age | gt 18))`, whose first
  condition is the subject of `and`.
- **Example**: `filter ~(and /active (/age | gt 18))` keeps active
  adults.
- **Errors**: a condition not a boolean → `AndLeftNotBooleanError` /
  `AndRightNotBooleanError`.

### `or a b`

- **Arity** 2. Returns `true` if either `a` or `b` is `true`, each
  answering a boolean.
- **Example**: `filter ~(or /vip (/score | gt 95))` keeps VIPs or
  high-scorers.
- **Errors**: a condition not a boolean → `OrLeftNotBooleanError` /
  `OrRightNotBooleanError`.

## Type classifiers

Asking what a value is means composing `type` with `eq`. `type`
answers exactly one kind per value, so `| type | eq ::string`
is the classification, and it reads the same inside a predicate:
`filter ~(type | eq ::string)` over a Vec of mixed kinds, or over a
Map where the value's kind is the predicate axis.

### `type`

- **Arity** 1. **Subject** any value.
- Returns the kind of the value, a tag: its outermost tag, or for a
  value without a tag of its own the kind of the core its literal
  implies — `::null`, `::boolean`, `::number`, `::string`,
  `::keyword`, `::tag` for a tag name, `::vec`, `::map`, `::set`,
  `::quote`, `::doc`. The kinds of the core are named under the
  prefix `qlang/` and written short, `::qlang/number` reading as
  `::number`, and `type | docs` reads the kind's page. Tagged values
  (verb, binding record, TaggedInstance, materialized error,
  catalog builtin descriptor) produce their tag (`::verb`,
  `::binding`, `::Foo`, `::builtin`); error values produce the
  per-site `::Tag` —
  `::AddLeftNotNumberError`, `::ParseError`, and the kind of errors
  `::error` for user `!{}` without an explicit `:kind ::Foo` lift.
- **Examples**:
  - `42 | type` → `::number`.
  - `"hello" | type` → `::string`.
  - `:foo | type` → `::keyword`.
  - `[1 2] | type` → `::vec`.
  - `{:a 1} | type` → `::map`.
  - `::verb~(mul 2) | type` → `::verb`.
  - `!{} !| type` → `::error`.
  - `!{:kind ::Oops} !| type` → `::Oops`.

JSON syntax reads into the same Map and Vec, so `{"a": 1} | type` →
`::map` and `[1, 2] | type` → `::vec`. Identity rides the value's
JS-header slot, so a Map carrying a `:kind` field
answers `::map`; `::Foo{…}` is the form that stamps the header.

## Type Conversion

`keyword` resides on `::string` and `::keyword` under one contract on
`::qlang/any`, and `payload` and `within` on `::tagged`, the kind of
every value under a tag [D72], [D78]; `tag` is a descriptor still.

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
- **Errors**: a subject of another kind → the contract's
  `VerbWithoutBodyError` with `:addresses`.

### `payload`

- **Arity** 1. **Subject** TaggedInstance.
- Strips the identity tag and returns the underlying value:
  - **Composite-shape TaggedInstance** (tagged Vec / Set / Map —
    identity overlay on the payload's JS-header slot) → a fresh
    clone of the payload without the header.
  - **Wrap-object shape** (opaque frozen `{type, tag, payload}`
    object, the constructor's branch for scalar / Keyword / Quote
    / Doc / Error / already-tagged payloads
    that cannot carry the header themselves) → the `.payload`
    value directly.
- Inverse of `tag ::Foo` mint. The dedicated extractor sidesteps
  the `/payload` Map-field projection — wrap-object shapes are
  opaque to `/key` projection, so the wrapping shape never leaks
  through to user code.
- **Examples**:
  - `::Box[1 2 3] | payload` → `[1 2 3]` (fresh Array sans header).
  - `::User{:name "alice"} | payload` → `{:name "alice"}` (fresh Map sans header).
  - `::Count(42) | payload` → `42` (wrapped value).
  - `42 | tag ::Box | payload | eq 42` → `true` (round-trip).
- **Errors**: non-TaggedInstance subject →
  `PayloadSubjectNotTaggedInstanceError`.

### `tag`

- **Arity** 2. Three call shapes form the symmetric assemble-side
  partner for the `[type, payload]` split:
  - **bare** `[tag, value] | tag` — subject is a 2-element Vec
    `[tagKeyword, value]` (exactly the shape `[type payload]`
    projects from any tagged value). Round-trip pair:
    `tagged | [type payload] | tag` recovers an observationally-
    equivalent TaggedInstance.
  - **bound** `value | tag ::Foo` — subject becomes the wrapped
    value, captured TagKeyword becomes the identity tag.
  - **full** `tag value-expr tag-expr` — both args captured,
    pipeValue is context. Compact pair-Vec reordering:
    `pair | tag /1 /0` rebuilds from a `[value, tag]`-order Vec
    without an intermediate binding.
- A composite TaggedInstance subject (bound form) clones-and-
  rebrands the underlying composite; an opaque-wrap subject
  re-wraps into a nested layer. To replace identity rather than
  nest, route through `tagged | payload | tag ::Other`.
- **Examples**:
  - `42 | tag ::Box | payload | eq 42` → `true`.
  - `[1 2 3] | tag ::Triple | type` → `::Triple`.
  - `::Box {} | ::Box[1 2 3] | [type payload] | tag | eq ::Box[1 2 3]` → `true` — split/assemble round-trip.
  - `1 | add "1" !| [type payload] | tag | error !| type` → `::AddRightNotNumberError` — short rebuild of a fail-track error from its `[tag, descriptor]` projection.
- **Errors**: captured arg / first Vec element not a TagKeyword →
  `TagModifierNotTagKeywordError`; bare-form subject not a 2-element
  Vec → `TagBareSubjectShapeError`.

### `within`

- **Arity** 2. **Subject** TaggedInstance. **Modifier** a Quote.
- An edit under one tag: runs the quote against the payload as
  `apply` runs it, a fork whose declarations stay inside, and mints
  the answer back under the subject's tag, whose constructor runs
  once, at the rewrap. The steps between may break the tag's
  invariant, since an invariant holds of the result. An error the
  edit answers passes as it is; a deeper stack of tags is reached by
  nesting `within`.
- **Examples**:
  - `#[1 2] | within ~([/0 /0 /1])` → `#[1 2]` — the set's
    constructor normalizes the vector the edit answers.
  - `::Box {} | ::Box[1 2] | within ~(reverse)` → `::Box[2 1]`.
  - `::Box {} | ::Box#[3 1] | within ~(within ~([/1 /0 2]))` →
    `::Box#[1 2 3]` — two layers, one `within` each.
- **Errors**: subject not a TaggedInstance →
  `WithinSubjectNotTaggedInstanceError`; captured arg not a Quote →
  `WithinCodeNotQuoteError`; an answer the tag's constructor refuses
  → that constructor's own refusal.

## Formatting

### `json`

- **Arity** 1. **Subject** any value.
- Returns a JSON string representation of the subject; a keyword
  writes as its bare name, a key and a value alike.
- **Examples**: `{:a 1 :b [2 3]} | json` → `"{\"a\":1,\"b\":[2,3]}"`;
  `{:k :v} | json` → `"{\"k\":\"v\"}"`.

### `parseJson`

- **Arity** 1. **Subject** a string of plain JSON; the verb resides on
  `::string` [D76].
- Returns the qlang value the JSON spells, the reverse of `json`:
  object keys become keywords, arrays become Vecs, scalars pass
  through.
- **Examples**: `"{\"a\":1}" | parseJson` → `{:a 1}`;
  `"[1,2,3]" | parseJson` → `[1 2 3]`.
- **Errors**: a subject other than a string →
  `ParseJsonSubjectNotStringError`; text that is no JSON →
  `ParseJsonInvalidJsonError`; a number past the finite double range
  → `FromPlainNumberNotFiniteError`.

## Control flow

`if`, `coalesce` and `cond` reside on `::qlang/any` [D72], [D77]; a
branch, an alternative and a clause is a quote, and a value of the rest
of `coalesce` or `cond` that is no quote is refused with
`VerbCodeNotQuoteError`, which names the slot and the value's `:index`.

### `if cond ~(then) ~(else)`

- **Arity** 4. **Subject** any value (the current `pipeValue`),
  **modifiers** three captured sub-pipelines.
- The `cond` sub-pipeline is evaluated against `pipeValue` and
  answers a boolean. On `true` the `then` sub-pipeline is evaluated
  against the same `pipeValue` and its result becomes the new
  `pipeValue`; on `false` the `else` branch runs the same way. A
  one-sided conditional leaves `pipeValue` as it is on the other
  side through the empty quote, `if (gt 0) ~(add 100) ~()`.
- All three arguments are captured sub-pipelines, so **only the
  selected branch executes**. The other branch is parsed but never
  evaluated, allowing patterns like `if empty ~("<empty>") ~(first)`
  where `first` would otherwise raise on an empty Vec.
- **Examples**:
  - `score | if (gte 60) ~("pass") ~("fail")` → string label.
  - `employee | if /active ~(/salary | mul 1.1) ~(/salary)` →
    boosted or original salary.
  - `list | if empty ~("<empty>") ~(first)` → safe head with fallback.
- **Errors**: a condition not a boolean → `IfConditionNotBooleanError`;
  errors raised inside the selected branch propagate.

### `coalesce ~(alt) …`

- **Arity** variadic (1+). **Subject** `pipeValue`, **modifiers**
  one or more alternative sub-pipelines.
- Evaluates each alternative against `pipeValue` in order and
  returns the first one that produces a non-`null` result. If all
  alternatives produce `null`, the result is `null`.
- **Skipping rule**: only `null` and an error value count as
  missing. Defined values (`false`, `0`, `""`, `[]`, `{}`, `#[]`)
  flow through as valid alternative results. Matches SQL
  `COALESCE` and JavaScript `??` semantics.
- **Short-circuits**: alternatives after the first non-null match
  are not evaluated.
- **Examples**:
  - `person | coalesce ~(/preferredName) ~(/firstName) ~("Anonymous")` →
    first available name with default fallback.
  - `config | coalesce ~(/userOverride) ~(/projectDefault) ~(/globalDefault)`
    → cascading defaults.
  - `lookup | coalesce ~(/cached) ~(/computed)` → prefer cache.
- **Errors**: zero captured args → `CoalesceNoAlternativesError`.

### `cond ~(p1) ~(b1) ~(p2) ~(b2) … ~(default)?`

- **Arity** variadic (2+). **Subject** any value, **modifiers**
  alternating (predicate, branch) sub-pipeline pairs, plus an
  optional trailing default sub-pipeline.
- Multi-way dispatch. Walks captured args in pairs: for each
  `(pK, bK)`, evaluates `pK` against `pipeValue`, which answers a
  boolean; on `true` evaluates `bK` and returns its result. Short-circuits on first
  match. If captured-arg count is odd, the trailing arg is the
  default. If even and no match, returns `null`.
- Replaces nested-if chains with a flat catalog.
- **Examples**:
  - `score | cond ~(gte 90) ~("A") ~(gte 80) ~("B") ~(gte 70) ~("C") ~("F")`.
  - `value | cond ~(eq 0) ~("zero") ~(eq 1) ~("one") ~("many")`.
- **Errors**: fewer than 2 captured args → `CondNoBranchesError`; a
  predicate not answering a boolean → `CondConditionNotBooleanError`.

## Reflective built-ins

`env`, `use`, `manifest` and `runExamples` are
**reflective operands**: they read or write the full evaluator
state pair. All of them are ordinary entries in `langRuntime()`,
look up like any other identifier, and can be shadowed by a
`:name body` BindStep. Their distinguishing feature
is internal — the impl receives `(state, lambdas)` directly and
threads the full state through, in contrast with pure operands
that take `(pipeValue, args)`.

The declarative binding form `:name body`
is also covered in this section because it shares the same env-
writing semantics — it is a grammar production (a BindStep) with
its own eval handler in `eval.mjs`.

### `env`

- **Arity** 1. **Subject** irrelevant — `env` ignores its
  pipeline input and reads the evaluator state instead.
- Replaces `pipeValue` with the bindings the scope holds as a Map
  value: the names the query, the session and a module's `use` wrote.
  The verbs and the nouns of the core and of the hosts stay with their
  providers, listed from `::qlang | manifest`.
- **Examples**:
  - `env | keys` → a Set of the names the scope holds.
  - `env | has :count` → `false` (count lives on the kinds it serves).
  - `env | /taxRate` → the record of a user binding, `::binding`
    with its `:name :docs :value :source :module`.
- Inside a fork, returns the fork's current `env` (including any
  fork-local BindStep declaration visible at the point of lookup).
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
  - Shadow a built-in: `:use ::verb~(mul 2) | 5 | use` → `10`
    (the user's BindStep shadows the reflective `use`).
- Inside a fork (paren-group, compound literal, distribute
  iteration), the merged bindings evaporate when the fork closes,
  matching the documented fork rule — only the final `pipeValue`
  of the sub-pipeline escapes.
- **Errors**: subject not a Map → `UseSubjectNotMapError`.

### `manifest`

- **Arity** 1. **Subject** a noun, a tag name in the subject position.
- Answers the set of what lies below the noun in the tree of names, the
  nouns under its path and the addresses of the verbs that live on it:
  `::qlang | manifest` the nouns of the core and of the hosts a session
  loaded, the kinds of values among them and the refusals apart, `::shop
  | manifest` the nouns under `::shop/`, and `::number | manifest` the
  verbs of numbers. A tag the session declares is its own and stays
  out, and a refusal is reached from the place it guards,
  `::number/add | spec | /throws`. For what one binding does reach for
  the axis trio (`::vec/count | source` / `| docs` / `| examples`).
- **Examples**:
  - `::qlang | manifest | filter ~(eq ::number) | count` → `1`.
  - `::number | manifest | has ::number/add` → `true`.
  - `::qlang | manifest * manifest | flat` → every verb of the core by
    its address.
- **Errors**: a subject other than a tag name →
  `ManifestSubjectNotTagError`.

### `runExamples`

- **Arity** 1. **Subject** Keyword (binding name) or tag name, the
  address of a verb among them.
- Reads the step that declares the name as `examples` does, and
  pulls every Quote segment from each attached doc-prefix through
  `parseDocSegments`. Each Quote evaluates one frame below the step,
  against the caller's env and a null pipeValue; an example passes
  when it answers `true`, and every other answer, an ErrorValue
  among them, counts as `:ok false`. Returns a Vec of
  `{:snippet :actual :error :ok}` Maps — one per Quote segment.
- **Example**: `::vec/count | runExamples | first | /ok` → `true`.
- **Errors**: subject neither Keyword nor tag name →
  `RunExamplesSubjectShapeError`; a name no step declares, a verb a
  provider keeps among them → `RunExamplesBindingNotFoundError`,
  whose `:addresses` holds the addresses where the verbs of that
  name live.

### `:name body` / `:name [:params] body` — BindStep

- **Form**: grammar production with its own dispatch path (the
  evaluator routes BindStep nodes through `evalBindStep`, separate
  from `langRuntime()` lookups). The parser reads `:name`-or-`::Tag`
  head plus an optional attached doc-prefix and an optional body,
  and emits a BindStep AST node
  (`core/src/grammar.peggy::BindStep`). Subject passes through
  unchanged — BindStep is transparent for pipeValue and writes
  only to env.
- Names the value of its body in `env`: the body is evaluated once,
  at declaration, against the current `pipeValue`, and the record of
  the binding, `::binding`, holds the value
  (`core/src/eval.mjs::evalBindStep`). A body `::verb~(…)` names a
  verb, which runs when the name is mentioned, its leading
  declarations the slots its modifiers fill.
- Doc-only form: a BindStep with attached docs and no body binds a
  Doc value under the name; an identifier lookup returns the
  Doc-value the record holds (`:guide | /content`).
- **Examples**:
  - `42 | :x / | add 1 | x` → `42`.
  - `:double ::verb~(mul 2) | 10 | double` → `20`.
  - `:@surround ::verb~(:pfx ::string | :sfx ::string | prepend pfx | append sfx) | "world" | @surround "[" "]"` → `"[world]"`.
- **Tag-binding form**: `::tag descriptor` installs the
  given descriptor Map under `::tag` for use as a TaggedLit
  constructor. The descriptor carries `:impl` — either a
  `:qlang/prim/<tag>` keyword (host-bound built-in constructor) or
  a Quote-value (qlang body that runs with the payload as its
  initial pipeValue); an identity-only tag omits `:impl`. Example:
  `::wrap {:impl ~(prepend "[" | append "]")} | ::wrap"x" | payload`
  → `"[x]"`.
- **Errors**: clean binding name carrying an effectful body →
  `EffectLaunderingAtBindStepParseError` (the only runtime throw inside
  `evalBindStep`). Name shape, params shape, body presence, and
  doc-prefix arity are all guaranteed by the grammar — no
  runtime check needed.

`parse` resides on `::string` and `::quote` under one contract on
`::qlang/any`, and `apply` on `::qlang/any` [D72], [D78].

### `parse`

- **Arity** 1. **Subject** `string` or `quote`.
- Flips a string and a quote, the way `keyword` flips a string and
  a keyword: a string reads as the **quote** of its steps, and a
  quote prints back as its text. A quote is a vector of steps under
  the `::quote` tag: a literal is its own step, a command is a
  `::call` record (`:name`, `:args` the quote of each argument),
  a projection a `::proj` record (`:path`), a declaration a
  `::bind` record, a constructor invocation a `::tagged` record,
  and the fail track, the distribute and the parentheses wrap the
  quote of their step as `::fail`, `::each` and `::group`. A
  comment leaves no step, and no step carries a position.
- The underlying peggy `ParseError` is caught in-operand and
  converted to an error value via `errorFromParse`, so malformed
  sources surface on the fail-track with `:kind ::ParseError`
  (the per-site tag identity; the `::ParseError` tag-binding's
  catalog body carries `:category :parseError` for the broad
  bucket — distinct from the `:foreignError` catalog category
  every host JS throw lands under).
- **Examples**:
  - `"42" | parse | first` → `42`.
  - `"add 1 2" | parse | first | /name` → `:add`.
  - `"add 1 2" | parse | first | /args | count` → `2`.
  - `~(add 1) | parse` → `"add 1"`.
  - `"this is not qlang [" | parse !| type` → `::ParseError`.
  - `"this is not qlang [" | parse !| type | spec | /category` → `:parseError`.
- **Errors**: a subject of another kind → the contract's `VerbWithoutBodyError` with `:addresses`.
  Malformed source → error value with `:kind ::ParseError`
  (not thrown; passes onto fail-track as `pipeValue`).

### `apply code`

- **Arity** 2 (1 captured). **Subject** any value. **Modifier** the
  code — the Quote the captured arg answers.
- Runs the code against the subject under the fork rule: BindStep /
  `use` writes inside the code stay inside it, and only its
  value comes out. The first step rides `|` against the subject
  unless the Quote carries a leading combinator (`~(* mul 2)` /
  `~(!| /trail)`), which routes it through that combinator, so a
  pipeline-suffix shape replays semantically. Code that is an error
  is that error, unchanged. The code runs one frame below the
  `apply` step, so a Quote that applies itself descends through the
  evaluation depth budget and lifts `EvaluationDepthExceededError`
  past `EVAL_DEPTH_LIMIT`.
- Pairs with `parse` to close the codeAsData ring:
  `"source" | parse | apply /` is equivalent to evaluating the
  source string directly, and the intermediate quote can be
  inspected, filtered, re-assembled, or handed around as
  ordinary qlang data.
- **Examples**:
  - `5 | apply ~(mul 2)` → `10`.
  - `[1 2 3] | apply ~(| count | add 1)` → `4`.
  - `"10 | add 3" | parse | apply /` → `13`.
  - `[42 ::call{:name :add :args [1]}] | tag ::quote | apply /` → `43`
    (a quote assembled from its steps).
  - `error !| /trail | :t / | start | apply t` — re-runs
    deflected steps against a fresh subject.
- **Errors**: code not a Quote → `ApplyCodeNotQuoteError`.
  Runtime errors inside the code lift through the normal fail-track
  just like any other qlang failure.

### `source`

- **Arity** 1. **Subject** any value. A Keyword (`:name`) or TagKeyword
  (`::Tag`) reads the binding it names; every other value reads the
  declaration of its kind, the kind `type` answers, so `5 | source`
  reads `::number` and `{:kind ::set} | source` reads `::map`.
- A tag name that no tag binds is the address of a verb from the root:
  `::vec/count | source` reads the verb `count` that lives on vectors, a
  verb being addressed through the noun it lives on, and an address reads
  what the verb's provider declared, whatever the scope binds under the name.
- Returns the `:source` of the binding's record, the quote of its
  declaring step, a BindStep, and null for a
  binding no step declared, a value `use` or a host bound. A record,
  the one `env | /name` answers, reads the binding it records.
- **Examples**:
  - `::vec/count | source | parse` → the `:count` declaration as text.
  - `::verb | source | parse` → the `::verb` tag-binding as text.
- **Errors**: the subject names no binding → `SourceBindingNotFoundError`.

### `docs`

- **Arity** 1. **Subject** any value. A Keyword (`:name`) or TagKeyword
  (`::Tag`) reads the binding it names; every other value reads the
  declaration of its kind, the kind `type` answers, so `5 | docs`
  reads `::number` and `{:kind ::set} | docs` reads `::map`.
- A tag name that no tag binds is the address of a verb from the root:
  `::vec/count | docs` reads the verb `count` that lives on vectors, a
  verb being addressed through the noun it lives on, and an address reads
  what the verb's provider declared, whatever the scope binds under the name.
- Returns the `:docs` of the binding's record, a Vec of Doc-values
  from its attached doc-prefix, one Doc per prefix entry, empty for a
  binding without a doc.
- **Examples**:
  - `::vec/count | docs` → Vec of Doc-values from the `count` catalog
    entry, read by its address.
  - `::verb | docs` → Vec of Doc-values from the `::verb` tag-binding.
  - `:count | docs !| /addresses` → `#[::map/count ::set/count
    ::vec/count]`: a keyword names a binding of its scope, and the
    refusal names where the verbs of the name live.
- **Errors**: the subject names no binding → `DocsBindingNotFoundError`,
  carrying `:addresses`.

### `examples`

- **Arity** 1. **Subject** any value. A Keyword (`:name`) or TagKeyword
  (`::Tag`) reads the binding it names; every other value reads the
  declaration of its kind, the kind `type` answers, so `5 | examples`
  reads `::number` and `{:kind ::set} | examples` reads `::map`.
- A tag name that no tag binds is the address of a verb from the root:
  `::vec/count | examples` reads the verb `count` that lives on vectors, a
  verb being addressed through the noun it lives on, and an address reads
  what the verb's provider declared, whatever the scope binds under the name.
- Returns a Vec of Quote-values extracted from the docs of the
  binding's record — every `~(…)` Quote segment in the doc-content
  stream is a candidate test case for `runExamples`.
- **Examples**:
  - `::vec/count | examples` → Vec of `~(…)` Quotes from the docs of
    `count` on vectors.
  - `::number/add | examples | count` → number of inline Quote examples
    on `add`.
- **Errors**: the subject names no binding → `ExamplesBindingNotFoundError`.

### `spec`

- **Arity** 1. **Subject** any value. A Keyword (`:name`) or TagKeyword
  (`::Tag`) reads the binding it names; every other value reads the
  declaration of its kind, the kind `type` answers, so `5 | spec`
  reads `::number` and `{:kind ::set} | spec` reads `::map`.
- A tag name that no tag binds is the address of a verb from the root:
  `::vec/count | spec` reads the verb `count` that lives on vectors, a
  verb being addressed through the noun it lives on, and an address reads
  what the verb's provider declared, whatever the scope binds under the name.
- Returns the value the binding's record holds, the declaration
  descriptor Map for a declared operand or tag. An operand answers with the `::builtin{…}` body its catalog entry
  declares, backfilled with `:captured` / `:effectful` from the
  resolved primitive; a value-class constructor with its `:impl`
  handle and `:throws`; an error tag with the structural facts its
  throw site records — `:category`, and for an operand slot check
  `:operand`, `:position` and `:expectedType`. The declaration of a
  provider's noun carries `:verbs`, the set of the addresses of the
  operands whose subject names it, `::number | spec | /verbs` holding
  `::number/add`, and the verbs of any value are listed under
  `::qlang/any`.
- The end of every error-diagnosis chain: an error reads the
  declaration of its tag, what the site that raised it declares about
  itself.
- **Examples**:
  - `"x" | add 1 !| spec | /operand` → `:add`.
  - `"x" | add 1 !| spec | /category` → `:typeError`.
  - `::number/add | spec | /throws` → the per-site error classes `add` raises.
  - `::verb | spec | /impl` → `:qlang/type/verb`.
  - `:double ::verb~(:by ::number | mul by) | :double | spec | payload | parse` → `":subject ::any | :by ::number"`.
- **Errors**: the subject names no binding → `SpecBindingNotFoundError`.

## Error operands

Error inspection and transformation ride through the `!|`
combinator (fail-apply), which owns the track-dispatch decision.
`!|` fires its step against a materialized error descriptor —
ordinary Map operations (`/key`, `has`, `keys`, `vals`, `union`,
`minus`, `inter`, `eq`, `filter` over `:trail`, etc.) apply
directly to the descriptor exactly as they would on any other
Map. The operand below is the entry of the fail-track: `error`
lifts a Map into it, and whether `pipeValue` already rides there
reads as `false !| true`, since the head `false` rides `|` and
deflects on an error that `!| true` then answers.

### `error`

- **Arity** 1. **Subject** `map` (the descriptor); the verb resides on
  `::map` [D76].
- Lifts a Map into an error value — the sole constructor for the
  5th type at the language level alongside the `!{…}` literal.
  Bare form `map | error` uses pipeValue as the descriptor; full
  form `error map` evaluates the captured Map against pipeValue
  as context. The resulting error rides the fail-track: `|` and
  `*` deflect it into the trail, `!|` fires its step against
  the materialized descriptor.
- Identity sources, in priority order: the source Map's
  `TAG_HEADER_SYMBOL` JS-header slot (the channel `!|`-
  materialization and `tag ::Foo` use); then a `:kind ::Tag`
  field if the header is absent (qlang-level rebrand); falling
  back to the kind of errors, `::error`. The first branch makes
  `error !| [type payload] | tag | error` recover the original
  per-site tag without a manual `:kind` field stamp.
- **Example**: `error {:kind :oops} !| /kind` → `:oops`.
- **Errors**: subject not a Map → `ErrorDescriptorNotMapError`.

Asking each element whether it is an error:

```qlang
> [!{:kind :oops} 42] * (false !| true)
[true false]
```

Removing an error from the success-track view of a container:

```qlang
> [1 "x" 3] * add 10 | filter ~(true !| false)
[11 13]
```

Filtering to a specific kind of error via leading fail-apply in
the predicate:

```qlang
> [1 "x" 3] * add 10 | filter ~(!| type | eq ::AddLeftNotNumberError)
[
  ::AddLeftNotNumberError!{
    :faultStep ~(add 10)
    :faultInput "x"
    :actualType ::string
  }
]
```

## Summary: unique operand names by `:category` keyword

`count`, `empty`, and `has` are polymorphic — one identifier
dispatches on subject type. `filter`, `every`, `any` are
polymorphic over Vec / Set / Map. `sort` is overloaded by arity —
same identifier, 0 or 1 captured arg. `use` is overloaded by arity
(bare merge, namespace import, selective import). Each name is listed
once; rows are keyed by the `:category` keyword each entry's
descriptor carries, which `spec | /category` reads off a verb's
address.

| `:category` keyword | Names (frequent → specialized) |
|---|---|
| `:comparator` | `asc`, `desc`, `nullsFirst`, `nullsLast` |
| `:typeConversion` | `tag` |
| `:reflective` | `env`, `use`, `manifest`, `runExamples` (plus the `:name body` BindStep grammar production) |
| `:axis` | `source`, `docs`, `examples` |

Each polymorphic / overloaded operand is one identifier in the
initial `langRuntime()` Map regardless of how many dispatch paths
it carries. The pair `parse` / `apply` closes the codeAsData
ring: a source string reads into a quote through `parse`, runs
through `apply /` to become a `pipeValue`, and the intermediate
quote is addressable as ordinary qlang data.

Tooling primitives (walk.mjs, session.mjs, codec.mjs, effect.mjs)
and the embedder API are documented in
[qlang-internals.md](qlang-internals.md).
