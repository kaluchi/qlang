# QSHST · Hosts and the command line

What a host hands the language and what the language leaves to it, and
how the command line reads a query and writes its answer. The cases of
`core/test/conformance/QSHST/`, the tests of `cli/` and `lsp/` and the
unit tests of the core's host hold its sections.

## source

A host is a tool that hands the language its sources and receives its
answers: the core is the host of the language's own sources, and the
command line, the language server and the site are hosts, so a verb of
the core and a verb of another host answer alike, as a verb written in
the language and a primitive do [QSNAM#owner]. A host
hands each source as `{ uri, source, primitives }`: the source declares
its nouns into the root as a cell [QSNAM#root], and `primitives` hands a
primitive, a JavaScript function, under each address the source declares
as `::builtin{}` under a label, the descriptor of a recipe or a
constructor a host answers by a primitive: for the recipe of a verb a
function of the values of its inputs, the subject first and the inputs
in their order, a primitive naming the inputs it runs as code, each
handed to it as code closed at the call; and for the constructor of a
kind, its node `<label>/construct`, a function of the payload that
answers the value the tag is laid over or refuses the payload. The root
refuses, as it is declared, a `::builtin{}` its host handed no primitive
for, `::builtin/PrimitiveNotHandedError`, a primitive handed for a name
its source declares otherwise, `::builtin/PrimitiveNamesNoBuiltinError`,
and a source whose run answers an error or declares again a name the
root holds, `::builtin/RootSourceNotDeclaredError`. A name that holds the
`::builtin{}` another name took first runs the primitive of that name,
and a primitive handed for it is refused so, its `:sharedWith` naming
that name. The modules of the runtime register the core's primitives in
its table, an address that is no string refused as
`::builtin/AddressNotStringError` and two under one address as
`::builtin/AddressRegisteredTwiceError`. A
`::builtin{}` a reader writes is the value it is: as the recipe of a
function under a label, the address answers the function as a value, and
its bare name reaches no verb; as a step of a recipe's quote, the verb
answers it; and as the constructor of a kind, the kind lays its tag over
the payload as it is. A host makes an error of a tag by
`makeErrorValue`.

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
the session numbers among them, `:cell-1`, and a failure to parse and a
refusal of the root the source a host named or the verb that read the
text, a cell the session numbers naming none; the root records the `uri`
a host hands as that origin. The
core is a host of its own sources, listed once in `LANGUAGE_SOURCES`, and
hands beside each the primitives of its verbs and of the constructor of
each kind whose chain ends in `impl ::builtin{}`, under the address of
the constructor's node, `::number/construct`. The runtime, the evaluator
with its table of primitives and the values it reads, `::fn`, `::kind`
and `::builtin{}`, whose pages the catalog holds, runs a primitive, and
a failure inside one is `::call/HostFailureError` [QSERR#site]. A
primitive that reads the state of its call, `doc`, `env`, `get`, `apply`
and their kin, takes it after the values of its inputs, and every other
takes the values alone. A call waits on an answer that has a `then`, a
host's thenable and its promise of another realm among them. The engine
a host runs on bounds the length of a vector and runs a regex alike on
every platform. A host's setting is the first value of its pipe, the
subject its query starts from, the command line's the noun of the
language where standard input gives it no text [QSHST#stdin].

The sources of the language are read where `core/package.json` maps
them, by the road each platform asks for: the files on Node, read by the
loader of `core/host/`; `fetch` in a browser that maps `#qlang/<name>`
in its import map; and the locator a bundle hands `langRuntime`, as the
site's does; the root reads each whole as it boots. The language server
reads the file of each source where the package exports it,
`@kaluchi/qlang-core/lib/<uri>.qlang`, resolved from its own dependency,
and the editor's extension imports the core by its name, a dependency of
its package. The refusals of the boot stand under `::builtin` and name
no platform: `::builtin/SourceLoadError` holds `:origin`, the source, as
`::builtin/BootstrapSourceMissingError` names it, `:sourceLocation`,
where the platform looked for it, and `:cause`, the host's account of
the failure.

A value enters the language from a host only as a value of the
language, which two doors hold, each by one walk of the value at any
depth, a container met twice in one value walked once. The answer of a
primitive a host hands beside its source, and the facts of a refusal it
throws, are held where the call takes them: an answer that is or holds a
function, an object of JavaScript, a map whose key is no string, a
failure whose facts are no map, a value under a tag that is no tag, a
container that holds itself, a hole of a vector or a number past the
finite doubles fails the call as `::call/HostFailureError`, its
`:message` naming the verb and the path where that value stands in its
answer; a value the call handed in passes back as it is, unwalked, and
the
primitives of the core are never walked, whatever function runs them. A
value JavaScript leaves undefined is null wherever the language reads
it. The subject a host hands a cell and the values of the scope it hands
a session or `evalQuery` are held where the core takes them, by the same
walk: a value of no kind there is a defect of the host, raised past the
fail track as `::builtin/ForeignValueError`, whose `:actualValue` names
the value as JavaScript holds it, its type and its name or its maker,
`"function hello"`, `"number Infinity"`, or what makes a container of no
kind, `"a map whose key number 1 is no string"`; the printer, the codec
of JSON and every read of the kind of a value, `type` and the one order
among them, raise the same defect for a value of no kind no door met.
The doors hold the shape of a value, and `fromPlain` is the road a host
builds a lawful answer by from data it holds parsed.

A query runs as a cell of a session. A scope is the names a step reads
over the root, and the interface of the package names it so: a session
keeps the scope its cells write, `createSession({ scope })` and
`session.scope`, and the entry of a cell is
`{ source, uri, result, defect, scopeAfterCell }`, its `result` the
answer, a failure to parse among the failures, and its `defect` a defect
raised past the fail track, null where none was; `evalQuery(source,
scope?)` answers the value one cell of a session over the scope answers,
booting the root where none is handed, a declaration it makes naming its
origin as every cell's does, `:cell-1`, and raises a defect to its
caller; and `langRuntime` answers the scope of the root. A host puts its
names into the scope by its sources alone, and a reader by a declaration.

```qlang
> ::vec | binding | get /origin
:qlang/vec

> ::vec/count | source | toString | contains "::builtin{}"
true

> ::number/construct | binding | get /value
::builtin{}

> :B |~~ B. ~~| (::kind | impl ::builtin{}) | ::B[1]
::B[1]

> get [~("add (" | parse !| get /origin) ~(::builtin | manifest | has ::builtin/PrimitiveNotHandedError)]
[:string/parse true]
```

```sh
$ node --input-type=module -e "const { createSession } = await import('./core/src/index.mjs'); const s = await createSession({ sources: [{ uri: 'probe', source: ':any/obj (::fn | returns |~~ O. ~~| ::any | impl ::builtin{})', primitives: { 'any/obj': () => ({ a: 1 }) } }] }); const e = await s.evalCell('obj !| type | toString'); console.log(e.result, 'scope' in s, 'scopeAfterCell' in e)"
call/HostFailureError true true
$ node --input-type=module -e "const { createSession } = await import('./core/src/index.mjs'); const s = await createSession(); const e = await s.evalCell('type', { initialPipeValue: function hello() {} }); console.log(e.defect.address, e.defect.facts.actualValue)"
builtin/ForeignValueError function hello
$ node --input-type=module -e "const { createSession, evalQuery } = await import('./core/src/index.mjs'); const s = await createSession(); const e = await s.evalCell('add ('); console.log(Object.keys(e).join(' '), e.result.tag.name, e.defect, (await evalQuery(':x 1 | env | get /x | get /origin')).name)"
source uri result defect scopeAfterCell quote/ParseError null cell-1
```

## effect

A query reads, and writes only by a host's verbs for the streams of its
process, each an explicit step performed when it runs: the command
line's `in` reads standard input when it is called, the empty string in
the REPL, whose prompt holds it, `out` writes a string as a line of
standard output, `err` as a line of standard error, and `tap` shows a
value on standard error halfway through a query. What changes the world
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

## answer

The command line writes every answer as the language prints it,
whatever data standard input held, a string as its text, and whole: a
budget is asked for, `| elide N` in the query or `--budget=N` before it,
a whole count of characters above zero on either road: the step `elide`
cuts the value the query answers, which a failure passes by, and the
flag prints every answer as `elide` cuts it, a failure's alert among
them [QSPRN#elide], a part giving way where its elision prints shorter. A
reader who wants JSON converts the answer in the query, `| json`. A
query that wrote to standard output by `out` holds the channel: its
answer and its failure stay unwritten, and the code is the one its
answer exits with. `-i` or `--repl` opens the REPL, a query after it its
first cell, and `-h` or `--help` and `-V` or `--version` print the usage
and the version.

A failure is an answer, written to standard output with the exit code 0,
so calls run side by side never stop each other; `--fail` before the
query gives it the code 1, for a script that tests the code, the failure
written as without the flag and one a query that wrote by `out` left
unwritten among them, while a failure caught is a value and every value
exits with 0. A failure is written as its alert: its tag and its facts
in the order the catalog declares them, the subject of the first frame
of its trace, where it arose, and every other fact cut to an excerpt of
three hundred characters, a string past the excerpt giving way whole
with its `:head`, and the subject of each later frame giving way to an
elision where the elision prints shorter, each subject measured on the
one line its frame prints on, every frame keeping its steps and its
place; each elision's `:read` continues the query beneath `!|`. Below
the alert stands the prose of its refusal's page as line comments, the
repair it tells, a refusal with no page of its own reading the page of
what refused; an error of the kind of errors, which no site refused, and
one whose tag no declaration names are written without prose, and the
REPL prints its cells without it. A query that does not parse answers
`::quote/ParseError`, the line the reading stopped in and a caret under
the place its `:location` names drawn below the alert [QSERR#print], and
a text of standard input that does not read as the JSON it is taken for
answers as `parseJson` refuses it [QSHST#stdin].

Standard error and a nonzero code are for what is no answer: a defect
raised past the fail track is written as `qlang:` and its message with
the code 1; a call with no query, an argument after the query, a
`--budget` that is no positive count and a `--color` other than `auto`,
`always` and `never` are refused with a usage line and the code 2; any
other argument before the query, but for the flags above, is read as the
query. The note on a query the shell made a path of goes to standard
error beside the answer.

```sh
$ qlang '{:a 1} | json' < /dev/null
{"a":1}

$ qlang --fail '"x" | add 1' > /dev/null || echo failed
failed

$ qlang '"x" | add 1' > /dev/null && echo answered
answered
```

## stdin

A query starts from its subject, the value it is given, which the
command line reads from standard input where the query reads its subject
and standard input holds bytes, and which is otherwise `::qlang`, the
noun of the language. The command line reads the text as JSON and, where
the text is no JSON, as the string it is, a JSON text that holds a
number past the doubles answering as `parseJson` refuses it; `--json`
reads it as JSON alone, refused as `parseJson` refuses it, and `--raw`
as text alone. A query reads its subject unless its first step that
declares nothing is a literal, or a group whose code reads none, and no
declaration before that step has a body that reads the subject; a query
of declarations alone reads it. A query that reads its
subject reads standard input to its end, waiting on a slow producer, and
`< /dev/null` ends the wait; a terminal gives no text.

```sh
$ echo '{"a": [1, 2]}' | qlang 'get /a | count'
2

$ echo 'not json' | qlang 'type'
::string

$ echo '[1, 2]' | qlang --raw 'type'
::string

$ qlang 'eq ::qlang' < /dev/null
true

$ printf '[1e400]' | qlang 'count' | grep -o '::string/parseJson/NumberNotFiniteError'
::string/parseJson/NumberNotFiniteError

$ printf 'x' | qlang --json 'count' | grep -o '::string/parseJson/TextNotJsonError'
::string/parseJson/TextNotJsonError
```

## shell

Under MSYS, the shell beneath Git Bash, which `MSYSTEM` names, the shell
writes a query that begins with `/` and a first segment of two letters
or more as a path under its root, the nearest directory that holds
`usr/bin/msys-2.0.dll`, and one whose first segment is a single letter
as a drive. The command line reads a query written under the root from
the slash after that root, the initial query of the REPL alike. A query
it cannot read back and that fails gets a line on standard error naming
the two ways around it, a read begun with its verb and
`MSYS_NO_PATHCONV=1`. The reading is the command line's, at the boundary
where the shell hands its arguments.

## repl

The REPL runs a cell at a time in one session, each cell a scope of its
own [QSNAM#scope], and prints each answer as its literal, a string among
them, and a failure as its alert, painted whether or not standard output
is a terminal; a defect raised past the fail track, as a cell ran or as
its answer printed, it writes on standard error as `qlang:` and its
message, and runs the next cell. The colour of script mode follows
`--color`, `NO_COLOR` and `FORCE_COLOR`. Its line editor reads a chunk of one character, or
one that begins with an escape, as keys, and any other chunk as text. A
paste the terminal hands over in several chunks is gathered and lands at
the cursor as one, its bracket markers taken out, its line breaks kept and
the trailing ones dropped, waiting for a submit; a bracketed paste is
read to its end marker. Enter submits, Alt+Enter submits a paste in both
its spellings, ESC then CR and ESC then LF, an Escape alone does nothing,
an escape before `[` opens a sequence however its chunks split it, and
Alt with an arrow reads as the arrow. Its colour is a layer over the
tokens of the core's `tokenize` [QSHST#tools], a colour to each kind and
a token inside a quote in italics.

## tools

`cli/src/bin.mjs` is the one file of the command line that touches the
process. The core's `tokenize`, of `./highlight`, the door of the core
that loads its parser and its walks and no runtime, names each token of a
source by what it writes in the language, one sense to a kind: a literal
by the kind of its value, `null`, `boolean`, `number`, `string`,
`regex`, `keyword`, `tag` and `path`; `quote` the `~(` and `)` of a quote
and the `~` of its short form, what it holds painted as the code it is;
`vec`, `set`, `map` and `error` the brackets of a container and of an
error literal; `doc` the prose of a doc, its quotes, the code its spans
between backquotes hold and the tags written before a quote of it
painted as they are; `comment`; `declaration` the name a declaration
writes; `verb` the name of a call that names a word of the root, by its
last name or its address, read by the name alone, and `name` any other;
`group` the parentheses
of a group; `fail` the combinator `!|`; `punctuation` the rest a gap
holds; `whitespace`; and `unparsed` the source past where its parse
stopped. The REPL, the site, the language server and the extension of the
editor coat those kinds each its own way, the site by a class named for
the kind, the REPL by a colour and the server by a type of semantic
token; the extension, which launches the language server of the
checkout, paints a block of qlang in a preview of markdown by them and
selects a word by the letters of a name [QSNAM#letters].

The language server runs over stdio and reads the language from the core:
the walks of the parts, the kinds of a value, the tokens of `tokenize`,
the pages by `doc | prose`, and the grammar, which reads the steps before
the cursor, a step the server writes at the cursor and drops before the
steps run, and what stands as whitespace there, a comment among it; the
characters it asks a completion and the help of a signature at are its
own. The names the server
reaches at a place, which its hover, its goto-definition and its completion
read, are the declarations visible there across the groups and the quotes
around it [QSNAM#scope], and inside the body of a verb, of the declarations
outside it, the verbs, the nodes and the labels of the pipelines that hold
the verb wherever they stand, the verb itself among them, and no value a
reader named there: a reading of the text alone, which reaches a node
declared after the last call of the verb, where the language refuses the
name, and misses one declared in a group around a call [QSNAM#verb]. A name
the document declares nowhere goes to the catalog by the reach of a bare
name [QSNAM#reach]. A
verb of the root shows the inputs of its function and the prose of its
page, `doc | prose`, and a reader's name the prose of the docs of its
declaration.

After a step the server offers the verbs that serve the value the step
answers as far as it knows the value: the value of a literal, which it runs
alone over the root, and after a call the kinds of the answer as the
evaluator lays it, the walk of the subject through the verb's own label and
the kind `::tagged` of the value it reached, where `returns` names that
label and the walk reached it, the kinds beneath it, which the answer laid
back may change, and the noun a tag name names left out, with the other
kinds `returns` names beside them, and elsewhere the kinds `returns` names;
the walk of a tag name passes the noun it names, whose verbs serve it only
where their `on` names `::tag` [QSDSP#tagname], and where the server knows
no kind it offers every name:

```qlang
> get [~(::Box[1 2] | within ~(get /0) | payload | type) ~(::Box[1 2] | payload | type)]
[::number ::vec]
```

A fold ends on the line where its last part ends, a doc's where its text
ends, and the server names a declaration by its role, a verb, a value a
reader named or a label, read from the form its source writes, a body that
opens with `::kind` a label and a body that runs on the values of its label
a verb, and no document run to name them, so a kind built elsewhere and
bound by name is a kind to the runtime and a value to the tools:

```qlang
> :K (::kind | wraps |~~ x ~~| ::map) | :Box |~~ A box. ~~| K | get [~(::Box{:a 1} | type) ~(::Box#5 !| type) ~(kinds | has ::Box)]
[::Box ::Box/PayloadKindNotTakenError true]
```

```sh
$ git grep -c -F "triggerCharacters: [" -- lsp/src/server.mjs
lsp/src/server.mjs:2
```

The site is built by Astro; its
REPL keeps one session across its cells, a name one cell declares staying
for the cells after it, and its playground runs the cells of one run in
one session, each showing a defect as `qlang:` and its message. The words
of the streams of a process, `in`, `out`, `err` and `tap`, are the
command line's, beside `table`, and a host that runs as a command takes
them with their source from `./cli-sources` of the command line's
package.
