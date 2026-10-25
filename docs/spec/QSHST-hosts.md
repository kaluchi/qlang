# QSHST · Hosts and their boundary

What a host hands the language and what the language leaves to it: the
sources and the primitives a host hands, the doors a value enters by, the
notebook a query runs in, the verbs of a host for the streams of its
process, and the tokens the core hands its painters. The cases of
`core/test/conformance/QSHST/` and the tests of the core's host hold its
sections; the command line is [QSCLI], and the language server and the
editor [QSLSP].

## source

A host is a tool that hands the language its sources and receives its
answers: the core is the host of the language's own sources, and the
command line, the language server and the site are hosts, so a verb of
the core and a verb of another host answer alike, as a verb written in
the language and a primitive do [QSNAM#owner]. A host
hands each source as `{ uri, source, primitives }`: the source declares
its nouns into the root as a cell [QSNAM#root], and `primitives` hands a
primitive, a JavaScript function, under each address the source declares
with `::builtin{}`, the descriptor of a recipe or a constructor a host
answers by a primitive: for the recipe of a verb, under its address
beneath a label, a function of the values of its inputs, the subject
first and the inputs in their order, a primitive of the core marking the
inputs it runs as code, each handed to it as code closed at the call; and
for the constructor of a kind, under the address of its label, a
function of the payload that answers the value the tag is laid over or
refuses the payload. The root
refuses, as it is declared, a `::builtin{}` its host handed no primitive
for, `::builtin/PrimitiveNotHandedError`, a primitive handed for a name
its source declares otherwise, `::builtin/PrimitiveNamesNoBuiltinError`,
and a source whose run answers an error or declares again a name the
root holds, `::builtin/RootSourceNotDeclaredError`. The root writes into
the descriptor of each primitive it takes the address it takes it under,
`:of`, the tag of the verb or of the kind, `::builtin{:of ::number/add}`,
while the source writes `::builtin{}` and the axis `source` reads it so. A
primitive runs within the function or the kind its host handed it with,
and within one equal to it by the one order, a function or a kind read
back from its print among them, where the root it runs in holds that
function or that kind at the address its descriptor names, on a subject
the label it was handed under serves, beside the label of the name that
calls it: a name that holds the value another name took first runs the
primitive of that name, a primitive handed for it refused so, its
`:sharedWith` naming that name, and a function of its own over the same
`::builtin{}` runs nothing. The modules of the runtime register the
core's primitives in its table, which the bootstrap seals, an address
that is no string
refused as `::builtin/AddressKindNotTakenError`, two under one address as
`::builtin/AddressRegisteredTwiceError` and one after the seal as
`::builtin/TableSealedError`. A
`::builtin{}` that runs no primitive so runs nothing: as the recipe of a
function, one a reader writes or puts into a function of its own and one
read back where the root holds another at its address, its call by its
name, its address or `apply` is refused as `::fn/RecipeMissingError`, its
`:of` naming the address the descriptor names; as a step of a recipe's
quote, the verb answers it; and as the constructor of a kind, the kind
lays its tag over the payload as it is. A host's verb refuses a call by a refusal declared
at its site by its address through `./errors`, a value of none of the
kinds its holder takes refused by the holder's role with those kinds as
`:expected`, which `kindsExpected` of the root makes, and paged under its
noun in the host's source, a refusal of the subject its call was served thrown
through `refusingTheSubject`, which holds the kind of that value alone,
and a refusal of a part of it through `refusingAPart` with the segments
of the part's path, which the frame of the step names [QSERR#site],
[QSERR#trace]; a failure of the host's own world is the error
value `makeErrorValue` makes of a tag and a map of its facts, and a host
lays a tag over its answer through the language, by the kind its verb
`returns`.

Each source is the source of one noun, its page first and what is
declared under it after, so a kind lives whole in the source of its
noun, and a kind with no verb of its own has a source of its page and
its laws; the source `qlang` holds the topic of the language. A host's
source declares its own noun and its verbs under the labels of their
subjects. A source is code as written: the text a host hands, the step
that declared a binding, its `:source`, and every declaration under an
address, which the axis `source` reads, null for a binding no
declaration wrote, a node a chain lays among them. Where a text came from
is its `:origin`, a keyword naming the source, the cell or the verb that
read it: a binding holds the source or the cell it was read from, a cell
the notebook numbers among them, `:cell-1`, and a declaration of code
assembled from data, which no text wrote, `:quote`; a failure to parse and a
refusal of the root the source a host named or the verb that read the
text, a cell the notebook numbers naming none; the root records the `uri`
a host hands as that origin. The
core is a host of its own sources, listed once in `LANGUAGE_SOURCES`, and
hands beside each the primitives of its verbs and of the constructor of
each kind whose chain ends in `impl ::builtin{}`, under the address of
the kind's label, `number`. The runtime, the evaluator
with its table of primitives and the values it reads, `::fn`, `::kind`
and `::builtin{}`, whose pages the catalog holds, runs a primitive, and
a failure inside one is `::call/HostFailureError` [QSERR#site]. A
primitive that reads the state of its call, `doc`, `env`, `get`, `apply`
and their kin, takes it after the values of its inputs, and every other
takes the values alone; a host marks its own so by `readingState`, the
mark the root of the package hands it, while the marks of the inputs a
primitive runs as code stay the core's, so a host's primitive takes a
quote as the data it is. A call waits on an answer that has a `then`, a
host's thenable and its promise of another realm among them. The engine
a host runs on bounds the length of a vector and runs a regex alike on
every platform. A host's setting is the first value of its pipe, the
subject its query starts from, the command line's what standard input
lifts to, or the noun of the language [QSCLI#stdin].

The sources of the language are read where `core/package.json` maps
them, by the road each platform asks for: the files on Node, read by the
loader of `core/host/`; `fetch` in a browser that maps `#qlang/<name>`
in its import map; and the locator a bundle hands `langRuntime`, as the
site's does; the root reads each whole as it boots. A host decodes the
bytes of a text it reads, a source or standard input, as UTF-8 by
`TextDecoder`, the decode the text of a response runs: a byte order mark
at the head of the text drops, one inside it stays the character U+FEFF,
and a byte no character reads is U+FFFD, so a text reads alike on every
host and no mark a host read reaches the core; the bundle of the site reads
its sources by the loader `text` of esbuild, which drops the mark alike.
A string that holds the mark holds the character, which the grammar reads
as no whitespace. The language server
reads the file of each source where the package exports it,
`@kaluchi/qlang-core/lib/<uri>.qlang`, resolved from its own dependency,
and the editor's extension imports the core by its name, a dependency of
its package. The refusals of the boot stand under `::builtin` and name
no platform: `::builtin/SourceLoadError` holds `:origin`, the source, as
`::builtin/BootstrapSourceMissingError` names it, `:sourceLocation`,
where the platform looked for it, and `:cause`, the host's account of
the failure.

```qlang
> ::vec | binding | get /origin
:qlang/vec

> get [~(~((:x 1 | env | get /x | get /origin)) | first)] | tag ::quote | apply it
:quote

> ::vec/count | source | toString | contains "::builtin{}"
true

> ::number | binding | get /value | get /1
::builtin{:of ::number}

> ::vec/count | binding | get /value | :f it | print | parse | open | :g it | get [~(eq f) ~([1 2] | apply g) ~({:a 1} | apply (::fn | impl (f | get /1)) [] !| get [~(tag) /of])]
[true 2 [::fn/RecipeMissingError ::vec/count]]

> :B |~~ B. ~~| (::kind | impl ::builtin{}) | ::B[1]
::B[1]

> get [~({:a 1} | apply (::vec/first | binding | get /value) [] !| tag) ~(:any/v (::fn | impl ::builtin{}) | 5 | v !| tag)]
[::fn/call/SubjectNotVecError ::fn/RecipeMissingError]

> get [~("add (" | parse !| get /origin) ~(::builtin | manifest | has ::builtin/PrimitiveNotHandedError)]
[:string/parse true]
```

```sh
$ node --input-type=module -e "const { createNotebook, readingState } = await import('./core/src/index.mjs'); const s = await createNotebook({ sources: [{ uri: 'probe', source: ':any/named (::fn | returns |~~ N. ~~| ::boolean | impl ::builtin{})', primitives: { 'any/named': readingState((subject, state) => state.scope.has('x')) } }] }); console.log((await s.evalCell(':x 1 | named')).result)"
true
```

## door

A value enters the language from a host only as a value of the
language, which two doors hold, each by one scan of the value at any
depth, a container met twice in one value scanned once. The answer of a
primitive a host hands beside its source, and the facts of a refusal it
throws, are held where the call takes them: an answer that is or holds a
function, an object of JavaScript, a map whose key is no string, a
failure whose facts are no map, a value under a tag that is no tag, a
container that holds itself, a hole of a vector or a number past the
finite doubles fails the call as `::call/HostFailureError`, its
`:message` naming the verb and the path where that value stands in its
answer; a value the call handed in passes back as it is, unscanned, and
the primitives of the core are never scanned. A
value JavaScript leaves undefined is null wherever the language reads
it. The subject a host hands a cell and the values of the scope it hands
a notebook or `evalQuery` are held where the core takes them, by the same
scan: a value of no kind there is a defect of the host, raised past the
fail track as `::builtin/ForeignValueError`, whose `:actualValue` names
the value as JavaScript holds it, its type and its name or its maker,
`"function hello"`, `"number Infinity"`, or what makes a container of no
kind, `"a map whose key number 1 is no string"`; the printer, the codec
of JSON and every read of the kind of a value, `tag` and the one order
among them, raise the same defect for a value of no kind no door met.
The doors hold the shape of a value, and `fromPlain` is the road a host
builds a lawful answer by from data it holds parsed.

```sh
$ node --input-type=module -e "const { createNotebook } = await import('./core/src/index.mjs'); const s = await createNotebook({ sources: [{ uri: 'probe', source: ':any/obj (::fn | returns |~~ O. ~~| ::any | impl ::builtin{})', primitives: { 'any/obj': () => ({ a: 1 }) } }] }); const e = await s.evalCell('obj !| tag | toString'); console.log(e.result, 'scope' in s, 'scopeAfterCell' in e)"
call/HostFailureError true true
$ node --input-type=module -e "const { createNotebook } = await import('./core/src/index.mjs'); const s = await createNotebook(); const e = await s.evalCell('tag', { initialPipeValue: function hello() {} }); console.log(e.defect.address, e.defect.facts.actualValue)"
builtin/ForeignValueError function hello
```

## notebook

A query runs as a cell of a notebook. A scope is the names a step reads
over the root, and the interface of the package names it so: a notebook
keeps the scope its cells write, `createNotebook({ scope })` and
`notebook.scope`, and the entry of a cell is
`{ source, uri, result, defect, scopeAfterCell }`, its `result` the
answer, a failure to parse among the failures, and its `defect` a defect
raised past the fail track, null where none was; `evalQuery(source,
scope?)` answers the value one cell of a notebook over the scope answers,
booting the root where none is handed, a declaration it makes naming its
origin as every cell's does, `:cell-1`, and raises a defect to its
caller; and `langRuntime` answers the scope of the root. A host puts its
names into the scope by its sources alone, and a reader by a declaration.

The REPL of the site keeps one notebook across its cells, a name one cell
declares staying for the cells after it, and its playground runs the cells
of one run in one notebook, each printing its answer within the budget of
every answer [QSPRN#budget], a failure as its alert under the line that
says it was raised [QSERR#print], and showing a defect as `qlang:` and its
message.

```sh
$ node --input-type=module -e "const { createNotebook, evalQuery } = await import('./core/src/index.mjs'); const s = await createNotebook(); const e = await s.evalCell('add ('); console.log(Object.keys(e).join(' '), e.result.tag.name, e.defect, (await evalQuery(':x 1 | env | get /x | get /origin')).name)"
source uri result defect scopeAfterCell quote/ParseError null cell-1
```

## effect

A query reads, and writes only by a host's verbs for the streams of its
process, each an explicit step performed when it runs: the command
line's `in` reads standard input when it is called, the empty string in
the REPL, whose prompt holds it, `out` writes a string as a line of
standard output and `err` as a line of standard error, each whole, and
`tap` writes `[tap <label>]` and its subject on standard error halfway
through a query as a host prints an answer, the print a kind declares
among it, within the budget of every answer and past it as the refusal
instead, whose reads continue the query from the subject at the
`tap`; the query goes on with the subject as it came, and `err print`
writes a look whole. What changes the world
is a verb of its host, addressing the same names the queries read, and
its result a noun that queries read. A verb of a host has one output, a
value under its tag, and the kinds of its refusals; what it answers is
the data its inputs chose, filtered for the question. A tag may describe
an effect a host is to perform, and such a value is performed by an
explicit step at the boundary; a host that wants the provenance of a
value seen tags the value. A constructor is pure, and reading or
constructing a literal performs nothing. The forks of a sequence run in
its order, so a verb of a host with an effect meets the elements in their
order, and a host whose verb is better served by calls at once takes the
whole vector and bounds its own calls.

```qlang
> :any/quiet ~(out) | 1
1
```

```sh
$ qlang ':Box |~~ B ~~| | :Box/print ~("box") | [::Box#1] | tap :x | count' < /dev/null 2>&1
[tap x] [box]
1

$ qlang '5000 | range | tap :big | count' < /dev/null 2>&1 | grep -o -E '^\[tap big\] \|~\| raised, and no !\| caught it|::elision\{:size [0-9]+ :read ~\(drop [0-9]+\)\}|^5000$'
[tap big] |~| raised, and no !| caught it
::elision{:size 4921 :read ~(drop 79)}
5000
```

The words of the streams of a process, `in`, `out`, `err` and `tap`, are
the command line's, beside `table`, and a host that runs as a command takes
them with their source from `./cli-sources` of the command line's package.

## tokens

The core's `tokenize`, of `./highlight`, the door of the core that loads
its parser and the parts it keeps and no runtime, names each token of a source by
what it writes in the language, one sense to a kind: a literal by the
kind of its value, `null`, `boolean`, `number`, `string`, `regex`,
`keyword`, `tag` and `path`; `quote` the `~(` and `)` of a quote and the
`~` of its short form, what it holds painted as the code it is; `vec`,
`set`, `map` and `error` the brackets of a container and of an error
literal; `doc` the prose of a doc, its quotes, the code its spans
between backquotes hold and the tags written before a quote of it
painted as they are; `comment`; `declaration` the name a declaration
writes; `verb` the name of a call that names a word of the root, by its
last name or its address, read by the name alone, and `name` any other;
`group` the parentheses of a group; `fail` the combinator `!|`;
`punctuation` the rest a gap holds; `whitespace`; and `unparsed` the
source past where its parse stopped. Each host coats those kinds its own
way: the command line by a colour [QSCLI#colour], the language server by
a type of semantic token [QSLSP#server], the extension of the editor by
a class of highlight.js [QSLSP#extension], and the site by a class named
for the kind, the examples of its pages split into a prompt and its
query, the lines that continue it and an answer, each query painted with
the context of its lines.
