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

A host keeps a notebook, whose cells share the names they declare. The
host's sources declare the root beside the language's, each run as a
cell before the first one a reader writes:

```js
import { createNotebook, boundAnswer, printAnswer } from '@kaluchi/qlang-core';

const notebook = await createNotebook({
  sources: [{
    uri: 'my/tools',
    source: ':string/fetch ::builtin{}',
    primitives: { 'string/fetch': async (url) => fetchText(url) }
  }]
});

const cell = await notebook.evalCell('"https://example.org" | fetch');
const shown = await boundAnswer(cell.result, cell.scopeAfterCell);
await printAnswer(shown, cell.scopeAfterCell);  // the answer as a host prints it, within the budget
cell.defect;              // what was raised past the fail track, else null
```

- `createNotebook({ scope?, sources? })` answers a notebook: `evalCell(source,
  { initialPipeValue?, uri? })` evaluates one cell and answers
  `{ source, uri, result, defect, scopeAfterCell }`, `result` the answer,
  a failure to parse among the failures, and `defect` a defect raised past
  the fail track, null where none was; `scope` is the scope its cells
  write, and a host puts its names into it by its sources alone.
- A source is `{ uri, source, primitives? }`: its declarations stand in
  the root, a verb declared under the label of its subject whose recipe
  is `::builtin{}`, `:string/fetch`, the inputs its function takes nodes
  under it, and each primitive takes the values alone, the subject and
  the values of its inputs in the order `takes` names them, but one
  marked by `readingState(primitive)`, which takes the state of its call
  after them, its `scope` the names the query reads; the
  constructor of a kind whose chain ends in `impl ::builtin{}` is handed
  under the address of its label, `Box`, a function of the payload that
  answers the value its tag is laid over or refuses the payload. A source
  that declares a name the root holds is refused.
- A primitive runs within the function or the kind it was handed with,
  on a subject the label it was handed under serves, and answers a value
  of the language, held to its kinds at any depth: an answer that is or
  holds a function,
  an object of JavaScript, a map whose key is no string, a failure whose
  facts are no map, a value under a tag that is no tag, a container that
  holds itself or a number past the finite doubles fails the call as
  `::call/HostFailureError`, and `fromPlain` builds a value from data the
  host holds parsed. The core takes the subject of a cell and what the
  names of the scope `createNotebook({ scope })` and `evalQuery(source,
  scope)` are handed hold by the same walk, and a value of no kind there
  is a defect of the host, `::builtin/ForeignValueError`, raised past the
  fail track: a cell holds it as its `defect`, and the others throw it.
- A host's verb refuses a call by a refusal declared at its site by its
  address, `declareRefusal('any/out/SubjectKindNotTakenError')` from
  `@kaluchi/qlang-core/errors`, a refusal of a kind named by the role of
  the value it refuses with the kinds it takes as the fact `:expected`,
  `kindsExpected('string')`, and paged under its noun in the host's
  source, a refusal of the subject its call was served thrown through
  `refusingTheSubject`, which holds the kind of that subject alone, and a
  refusal of a part of it through `refusingAPart` with the segments of the
  part's path, which the frame of the step names; a failure of the host's
  own world is an error value,
  `makeErrorValue(makeTag('Late'), facts)`, its facts a map, a keyword
  made by `makeKeyword`; and `tagOf` answers the kind of a value, the tag
  `tag` answers.
- `evalQuery(source, scope?)` answers the value one cell of a notebook over
  the scope it is handed answers, by default over the scope of the root
  `langRuntime()` answers, a defect raised to its caller; a declaration
  it makes names its origin as every cell's does, `:cell-1`.
- `boundAnswer(answer, scope, written?, keep?)` answers what a host prints
  for an answer within `ANSWER_BUDGET` characters of its print or of the
  text `written` the host writes for it: the answer that fits as it is,
  one past the budget as `::qlang/AnswerBeyondBudgetError`, the answer shown
  as its `::excerpt` beside the `::cell` that `keep`, where the host hands
  one, answers for it, and a failure as its alert, each fact whole within
  three hundred characters and past them as its excerpt; `printAnswer(
  value, scope)` writes a value as the language prints it, the print a
  kind declares among it and a failure under the line that says it was
  raised. `printValue(value)` writes the literal of a value, which
  `evalQuery` reads back; the literal is the one lossless form. A refusal
  of a text holds its caret beneath its line, `:marker` under `:source`,
  so a host prints it as any failure. `toPlain` and
  `fromPlain` cross the JSON boundary, losing the kinds JSON has no form
  for.
- `parseSource(source)` answers the quote of the steps the text writes, the
  records of its steps and its literals, and `partOf(quote)` the parts it
  read, each with its span, which the walks of the tools read;
  `tokenize(source, verbNames)` answers the tokens a highlighter paints,
  each named by what it writes in the language, the call of a word of the
  root told by the names `verbNames` answers, from
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
