# QSHST · Hosts and the command line

What a host hands the language and what the language leaves to it, and
how the command line reads a query and writes its answer. The cases of
`core/test/conformance/QSHST/`, the tests of `cli/` and `lsp/` and the
unit tests of the core's host hold its sections.

## source

What a host loads and what a source declares are two things, and the
language knows only the second. A host hands its sources, each
`{ uri, source, impls }`: the source declares its nouns into the root
as a cell [QSNAM#root], and `impls` binds, for each address the source
declares with the recipe `::builtin{}` under a label, a plain function
over the values its inputs checked, the subject first and the inputs in
their order; a primitive names the inputs it runs as code, each handed
to it as code closed at the call. The root refuses, as it is declared, a
`::builtin{}` the host handed nothing for and an implementation handed
for any name declared otherwise. A `::builtin{}` written in the recipe
of a word a reader declares is the value it is. A host makes an error
of a tag by `makeErrorValue`.

Each source is the source of one noun, its page first and what is
declared under it after, so a kind lives whole in the source of its
noun, and a kind with no word of its own has a source of its page and
its laws; the source `qlang` holds the topic of the language, and a
binding's `:origin` names the source of its noun. The core is a host of
its own sources, listed once in `LANGUAGE_SOURCES`, each read whole when
the runtime starts. The kernel is the evaluator with its table of
primitives and the shapes it reads, `::fn`, `::kind` and `::builtin{}`,
whose pages the catalog holds. A primitive that reads the scope of its
call, `doc`, `env`, `get`, `apply` and their kin, takes the state of the
call after the values of its inputs were checked; every other primitive
is a plain function. A call waits on an answer that has a `then`, a
host's thenable and its promise of another realm among them. A host's
setting is the first value of its pipe, and a host's command starts
from its own noun.

```qlang
> ::vec | binding | get /origin
:qlang/vec

> ::vec/count | source | parse | contains "::builtin{}"
true
```

## effect

A query reads, and writes only by a host's words for the streams of its
process, each an explicit step performed when it runs: the command
line's `in` reads standard input when it is called, `out` writes a
string as a line of standard output, `err` as a line of standard error,
and `tap` shows a value on standard error halfway through a query. What
changes the world is a command of its host, addressing the same names
the queries read, and its result a noun that queries read. A command
has one output, a value under its tag, and the kinds of its refusals;
what it answers is the data its input chose, filtered for the question.
A tag may describe an effect a host is to perform, and such a value is
performed by an explicit step at the boundary; a host that wants the
provenance of a value seen tags the value. A constructor is pure, and
reading or constructing a literal performs nothing. The forks of a
sequence run in its order, so a word of a host with an effect meets the
elements in their order, and a host whose word is better served by
calls at once takes the whole vector and bounds its own calls.

```qlang
> :any/quiet ~(out) | 1
1
```

## answer

The command line writes every answer as the language prints it,
whatever its input was, a string as its text, and whole: a budget is
asked for, `| elide N` in the query or `--budget=N` before it, which
prints every answer as `elide` cuts it [QSPRN#elide], a part giving way
where its marker prints shorter. A reader who wants JSON converts the
answer in the query, `| json`. `-i` opens the REPL, a query after it its
first cell.

A failure is an answer, written to standard output with the exit code 0
as its alert: its tag and its facts in the order the catalog declares
them, the subject where it arose and every other fact cut to an excerpt
of three hundred characters, a string past the excerpt giving way whole
with its `:head`, the subject of each later stop giving way to an
`::elision` marker where the marker prints shorter, and a value the
alert already shows giving way the second time; each marker's `:read`
continues the query beneath `!|`. Below the alert stands the prose of
its refusal's page as line comments, the repair it tells; a refusal with
no page is written without prose, and the REPL prints its cells without
it. A query that does not parse answers `::quote/ParseError`, and an
input that does not read answers as `parseJson` refuses it.

Standard error and a nonzero code are for what is no answer: a defect
raised past the fail track, a call with no query, and an argument after
the query, refused with a usage line that names where the flags stand,
with the code 2. The note on a query the shell made a path of goes to
standard error beside the answer.

```qlang
> {:a 1} | json
"{\"a\":1}"
```

## input

The command line starts from standard input when the query reads its
subject and the input carries bytes, and otherwise from `::qlang`, the
noun of the language. It reads the input as JSON and, where the text is
no JSON, as the string it is; `--json` reads it as JSON alone, refused
as `parseJson` refuses it, and `--raw` as text alone. A query whose
first step that declares nothing is a literal runs at once, and a node
of the query the reading does not name counts as one that reads its
subject. A query that reads its subject reads standard input to its
end, waiting on a slow producer as every reader of a pipe does, and
`< /dev/null` ends the wait.

## shell

Under MSYS, the shell beneath Git Bash, which `MSYSTEM` names, the shell
writes a query that begins with `/` and a first segment of two letters
or more as a path under its root, the nearest directory that holds
`usr/bin/msys-2.0.dll`, and one whose first segment is a single letter
as a drive. The command line reads a query written under the root from
the slash after that root, the initial query of the REPL alike. A query
it cannot read back and that fails gets a line on standard error naming
the two ways around it, a read begun with its word and
`MSYS_NO_PATHCONV=1`. The reading is the command line's, at the boundary
where the shell hands its arguments, and the core reads paths of the
language alone.

## repl

The REPL runs a cell at a time in one session, each cell a scope of its
own [QSNAM#scope], and prints each answer, a failure as its alert. Its
line editor reads a chunk of one character, or one that begins with an
escape, as keys, and any other chunk as text. A paste a host hands over
in several chunks is gathered and lands at the cursor as one, its
bracket markers taken out, its line breaks kept and the trailing ones
dropped, waiting for a submit; a bracketed paste is read to its end
marker. Enter submits, Alt+Enter submits a paste in both its spellings,
ESC then CR and ESC then LF, an Escape alone does nothing, an escape
before `[` opens a sequence however its chunks split it, and Alt with an
arrow reads as the arrow. Its colour is a layer over the core's tokens,
where the name of a call that reaches a word of the language is a
`word`, and a keyword or a reader's name a `name`.

## tools

`cli/src/bin.mjs` is the one file of the command line that touches the
process. The language server runs over stdio and answers
goto-definition by the reach of a bare name [QSNAM#reach]; the extension
of the editor launches it. The site is built by Astro and paints its
examples from what the core's parser reads.
