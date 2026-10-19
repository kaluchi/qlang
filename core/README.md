# @kaluchi/qlang-core

A pipeline query language over values: a query starts from a subject
and passes it through steps, each answering a new value.

```qlang
> [1 2 3 4 5] | filter ~(gt 3) | count
2

> :number/double ~(mul 2) | [10 20 30] | map ~double
[20 40 60]

> "10 | add 3" | parse | open
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
    primitives: { 'string/fetch': async (url) => fetchText(url) }
  }]
});

const cell = await session.evalCell('"https://example.org" | fetch');
printValue(cell.result);  // the answer as its literal; a failure, one to parse among them, is an error value
cell.defect;              // what was raised past the fail track, else null
```

- `createSession({ scope?, sources? })` answers a session: `evalCell(source,
  { initialPipeValue?, uri? })` evaluates one cell and answers
  `{ source, uri, result, defect, scopeAfterCell }`, `result` the answer,
  a failure to parse among the failures, and `defect` a defect raised past
  the fail track, null where none was; `scope` is the scope its cells
  write, and a host puts its names into it by its sources alone.
- A source is `{ uri, source, primitives? }`: its declarations stand in
  the root, a verb declared under the label of its subject whose recipe
  is `::builtin{}`, `:string/fetch`, the inputs its function takes nodes
  under it, and each primitive takes the values alone, the subject and
  the values of its inputs in the order `takes` names them; the
  constructor of a kind whose chain ends in `impl ::builtin{}` is handed
  under the address of its node, `<label>/construct`, a function of the
  payload that answers the value its tag is laid over or refuses the
  payload. A source that declares a name the root holds is refused.
- A primitive answers a value of the language, held to its kinds at any
  depth whatever function runs it: an answer that is or holds a function,
  an object of JavaScript, a map whose key is no string, a failure whose
  facts are no map, a value under a tag that is no tag, a container that
  holds itself or a number past the finite doubles fails the call as
  `::call/HostFailureError`, and `fromPlain` builds a value from data the
  host holds parsed. The core takes the subject of a cell and what the
  names of the scope `createSession({ scope })` and `evalQuery(source,
  scope)` are handed hold by the same walk, and a value of no kind there
  is a defect of the host, `::builtin/ForeignValueError`, raised past the
  fail track: a cell holds it as its `defect`, and the others throw it.
- `evalQuery(source, scope?)` answers the value one cell of a session over
  the scope it is handed answers, by default over the scope of the root
  `langRuntime()` answers, a defect raised to its caller; a declaration
  it makes names its origin as every cell's does, `:cell-1`.
- `printValue(value)` writes the literal of a value, which `evalQuery`
  reads back; the literal is the one lossless form. `caretOf(answer)`
  answers, for a refusal of a text, the line its `:source` holds and a
  caret under the column its `:location` names, the two line comments a
  host that prints for a person's eye writes below the refusal, and null
  for any other answer. `toPlain` and
  `fromPlain` cross the JSON boundary, losing the kinds JSON has no form
  for.
- `parse(source)` answers the quote of the steps the text writes, the
  records of its steps and its literals, and `partOf(quote)` the parts it
  read, each with its span, which the walks of the tools read;
  `tokenize(source, names)` answers the tokens a highlighter paints, from
  `@kaluchi/qlang-core/highlight`,
  the light door that loads the parser and its walks and no runtime. The
  doors of the package are its root, `./errors`, `./highlight` and the
  sources of its catalog.

## Running

```
npm install
npm test
npm run test:coverage
```

The thresholds of coverage are pinned in `core/vitest.config.mjs`.
