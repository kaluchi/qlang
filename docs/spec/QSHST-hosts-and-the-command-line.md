# QSHST · Hosts and the command line

What a host hands the language and what the language leaves to it, and
how the command line reads a query and writes its answer. The cases of
`core/test/conformance/QSHST/`, the tests of `cli/` and `lsp/` and the
unit tests of the core's host hold its sections.

## source

A host hands its sources, of which the language reads what each
declares, each `{ uri, source, impls }`: the source declares its nouns
into the root as a cell [QSNAM#root], and `impls` binds an
implementation to each address the source declares as `::builtin{}`
under a label: to the recipe of a verb a plain function over the values
its inputs checked, the subject first and the inputs in their order, a
primitive naming the inputs it runs as code, each handed to it as code
closed at the call; and to the constructor of a kind, its node
`<label>/construct`, a function of the payload that answers the value
the tag is laid over or refuses the payload. The root refuses, as it is
declared, a `::builtin{}` the host handed nothing for and an
implementation handed for any name declared otherwise,
`::builtin/ImplementationNotHandedError` and
`::builtin/ImplementationNamesNoBuiltinError`, and a source whose run
answers an error or declares again a name the root holds as
`::builtin/RootSourceNotDeclaredError`. A `::builtin{}` a reader writes
is the value it is: as the recipe of a function under a label, the
address answers the function as a value, and its bare name reaches no
verb; as a step of a recipe's quote, the verb answers it; and as the
constructor of a kind, the kind lays its tag over the payload as it is.
A host makes an error of a tag by `makeErrorValue`.

Each source is the source of one noun, its page first and what is
declared under it after, so a kind lives whole in the source of its
noun, and a kind with no verb of its own has a source of its page and
its laws; the source `qlang` holds the topic of the language. A host's
source declares its own noun and its verbs under the labels of their
subjects, and a binding's `:origin` names the source or the cell that
declared it. The core is a host of its own sources, listed once in
`LANGUAGE_SOURCES`, each read whole when the runtime starts, and hands
beside each the implementations of its verbs and of the constructor of
each kind whose chain ends in `impl ::builtin{}`, under the address of
the constructor's node, `::number/construct`. The kernel is the
evaluator with its table of primitives and the shapes it reads, `::fn`,
`::kind` and `::builtin{}`, whose pages the catalog holds. A primitive
that reads the scope of its call, `doc`, `env`, `get`, `apply` and their
kin, takes the state of the call after the values of its inputs were
checked; every other primitive is a plain function. A call waits on an
answer that has a `then`, a host's thenable and its promise of another
realm among them. A host's setting is the first value of its pipe, the
subject its query starts from, the command line's the noun of the
language where standard input gives it no text [QSHST#stdin].

```qlang
> ::vec | binding | get /origin
:qlang/vec

> ::vec/count | source | parse | contains "::builtin{}"
true

> ::number/construct | binding | get /value
::builtin{}

> :B |~~ B. ~~| (::kind | impl ::builtin{}) | ::B[1]
::B[1]
```

## effect

A query reads, and writes only by a host's verbs for the streams of its
process, each an explicit step performed when it runs: the command
line's `in` reads standard input when it is called, the empty string in
the REPL, whose prompt holds it, `out` writes a string as a line of
standard output, `err` as a line of standard error, and `tap` shows a
value on standard error halfway through a query. What changes the world
is a verb of a host, a step performed when it runs, and no value
performs anything: reading or constructing a literal performs nothing,
and neither does the constructor of a kind of the core. The forks of a
sequence run in its order, so a verb of a host with an effect meets the
elements in their order, and a host whose verb is better served by calls
at once takes the whole vector and bounds its own calls.

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
them [QSPRN#elide], a part giving way where its marker prints shorter. A
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
of its trail, where it arose, and every other fact cut to an excerpt of
three hundred characters, a string past the excerpt giving way whole
with its `:head`, and the subject of each later frame giving way to an
`::elision` marker where the marker prints shorter, each subject
measured on the one line its frame prints on, every frame keeping its
steps and its place; each marker's `:read` continues the query beneath
`!|`. Below the alert stands the prose of its refusal's page as line
comments, the repair it tells, a refusal with no page of its own reading
the page of what refused; an error of the kind of errors, which no site
refused, and one whose tag no declaration names are written without
prose, and the REPL prints its cells without it. A query that does not
parse answers `::quote/ParseError`, and a text of standard input that
does not read as the JSON it is taken for answers as `parseJson` refuses
it [QSHST#stdin].

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
of declarations alone reads it, and a node of the query the reading does
not name counts as one that reads its subject. A query that reads its
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
is a terminal; the colour of script mode follows `--color`, `NO_COLOR`
and `FORCE_COLOR`. Its line editor reads a chunk of one character, or
one that begins with an escape, as keys, and any other chunk as text. A
paste a host hands over in several chunks is gathered and lands at the
cursor as one, its bracket markers taken out, its line breaks kept and
the trailing ones dropped, waiting for a submit; a bracketed paste is
read to its end marker. Enter submits, Alt+Enter submits a paste in both
its spellings, ESC then CR and ESC then LF, an Escape alone does nothing,
an escape before `[` opens a sequence however its chunks split it, and
Alt with an arrow reads as the arrow. Its colour is a layer over the
core's tokens, where the name of a call that reaches a verb of the
language is a `word`, and a keyword or a reader's name a `name`.

## tools

`cli/src/bin.mjs` is the one file of the command line that touches the
process. The language server runs over stdio, answers goto-definition
by the reach of a bare name [QSNAM#reach] and shows a verb with the
inputs of its function and its page; the extension of the editor
launches it. The site is built by Astro and paints its examples from
what the core's parser reads.
