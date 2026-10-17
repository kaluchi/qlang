# @kaluchi/qlang-core

Expression language for transforming immutable values through
pipelines. Domain-agnostic. Pure. Composable.

```qlang
> [1 2 3 4 5] | filter ~(gt 3) | count
2

> :number/double ~(mul 2) | [10 20 30] | map ~double
[20 40 60]

> "10 | add 3" | parse | apply it
13
```

The language documents itself: every name has a page, a doc whose
laws run. `::qlang | doc` opens the first page, `env | keys` lists the
names a query declared, `kinds` the labels the scope reads,
`::vec | manifest` the nodes under one, `::vec/sort | manifest` the
nodes under the `sort` of vectors, its inputs, its answer and its
refusals, and `::vec/sort | doc` the page of a name. The command line,
`@kaluchi/qlang-cli`, runs a query from the shell.

## Embedding

A host keeps a session, whose cells share the names they declare. The
host's sources declare the root beside the language's, each run as a
cell before the first one a reader writes:

```js
import { createSession, printValue } from '@kaluchi/qlang-core';

const session = await createSession({
  sources: [{
    uri: 'my/tools',
    source: ':string/fetch ::builtin{}',
    impls: { 'string/fetch': async (url) => fetchText(url) }
  }]
});

const cell = await session.evalCell('"https://example.org" | fetch');
cell.error;               // a ParseError when the source does not parse, else null
printValue(cell.result);  // the answer as its literal; a failure is an error value
```

- `createSession({ env?, sources? })` answers a session: `evalCell(source,
  { initialPipeValue?, uri? })` evaluates one cell and answers
  `{ source, uri, ast, result, error, envAfterCell }`; `bind(name, value)`
  installs a value under a name; `env` is the current scope.
- A source is `{ uri, source, impls? }`: its declarations stand in the
  root, a verb declared under the label of its subject whose recipe is
  `::builtin{}`, `:string/fetch`, the inputs its function takes nodes
  under it, and each implementation is a plain function over the
  subject and the values of its inputs in the order `takes` names them;
  the constructor of a kind whose chain ends in `impl ::builtin{}` is
  handed under the address of its node, `<label>/construct`, a function
  of the payload that answers the value its tag is laid over or refuses
  the payload. A source that declares a name the root holds is refused.
- `evalQuery(source)` evaluates one query in a fresh runtime.
- `printValue(value)` writes the literal of a value, which `evalQuery`
  reads back; the literal is the one lossless form. `caretOf(answer)`
  answers, for a refusal of a text, the line its `:source` holds and a
  caret under the column its `:location` names, the two line comments a
  host that prints for a person's eye writes below the refusal, and null
  for any other answer. `toPlain` and
  `fromPlain` cross the JSON boundary, losing the kinds JSON has no form
  for.
- `parse(source)` answers the syntax tree; `tokenize(source, names)` the
  tokens a highlighter paints.

## Running

```
npm install
npm test
npm run test:coverage
```

The thresholds of coverage are pinned in `core/vitest.config.mjs`.
