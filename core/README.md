# @kaluchi/qlang-core

Expression language for transforming immutable values through
pipelines. Domain-agnostic. Pure. Composable.

```qlang
> [1 2 3 4 5] | filter ~(gt 3) | count
2

> :double ::verb~(mul 2) | [10 20 30] * double
[20 40 60]

> "10 | add 3" | parse | apply /
13
```

The language documents itself: every name has a page, a doc whose
laws run. `::qlang | doc` opens the root page, `::qlang | manifest`
lists the kinds, `::vec | spec | /verbs` the verbs of one, and
`::vec/sort | doc` the page of a verb. The command line,
`@kaluchi/qlang-cli`, runs a query from the shell.

## Embedding

A host keeps a session, whose cells share the names they declare:

```js
import { createSession, printValue } from '@kaluchi/qlang-core';

const session = await createSession({
  locator: async (namespaceName) => namespaceName === 'my/tools'
    ? { source: ':@fetch ::verb~(:url ::string | ::builtin{:impl :my/tools/@fetch})',
        impls: { '@fetch': async (subject, url) => fetchText(url) } }
    : null
});

const cell = await session.evalCell('use :my/tools | @fetch "https://example.org"');
cell.error;               // a ParseError when the source does not parse, else null
printValue(cell.result);  // the answer as its literal; a failure is an error value
```

- `createSession({ env?, locator? })` answers a session: `evalCell(source,
  { initialPipeValue?, uri? })` evaluates one cell and answers
  `{ source, uri, ast, result, error, envAfterCell }`; `bind(name, value)`
  installs a value under a name; `env` is the current scope.
- A locator answers a module as `{ source, impls }`: the source declares
  its verbs with their heads, and each implementation is a plain function
  over the values the head checked, the subject first and the slots in
  their order. `use :ns` asks the locator once per namespace.
- `evalQuery(source)` evaluates one query in a fresh runtime.
- `printValue(value)` writes the literal of a value, which `evalQuery`
  reads back; the literal is the one lossless form. `toPlain` and
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

Coverage thresholds: lines = 100%, functions = 100%, branches = 100%.
