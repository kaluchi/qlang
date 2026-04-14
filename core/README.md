# @kaluchi/qlang

Expression language for transforming immutable values through
pipelines. Domain-agnostic. Pure. Composable.

```qlang
> [1 2 3 4 5] | filter(gt(3)) | count
2

> let(:double, mul(2)) | [10 20 30] * double
[20 40 60]

> let(:@surround, [:pfx, :sfx], prepend(pfx) | append(sfx))
  | "world" | @surround("[", "]")
"[world]"

|~| code-as-data ring — source → AST-Map → pipeValue
> "10 | add(3)" | parse | eval
13

|~| bare operand → its descriptor as data
> mul | /category
:arith
```

## Documentation

| File | Audience | Answers |
|---|---|---|
| [`docs/qlang-spec.md`](docs/qlang-spec.md) | query authors | Values, pipeline operators, conduits, scoping, grammar |
| [`docs/qlang-operands.md`](docs/qlang-operands.md) | query authors | Full catalog of 69 built-in operands with signatures and examples |
| [`docs/qlang-internals.md`](docs/qlang-internals.md) | evaluator / embedder implementors | Formal `(pipeValue, env)` model, AST traversal, session lifecycle, codec |

Dependency: **spec** is self-contained for writing queries. **operands**
is the reference lookup alongside spec. **internals** assumes familiarity
with spec and is needed only for building evaluators or embedding qlang.

## Running

```
npm install
npm test
npm run test:coverage
```

Coverage thresholds: lines = 100%, functions = 100%, branches = 100%.
