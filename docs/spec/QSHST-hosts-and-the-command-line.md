# QSHST · Hosts and the command line

What a host hands the language and what the language leaves to it, and
how the command line reads a query and writes its answer. The tests of
`cli/` and `lsp/` and the unit tests of the core's host hold its
sections.

## source

What a host loads and what a source declares are two things, and the
language knows only the second. A host hands its sources, each
`{ uri, source, impls }`: the source declares its nouns into the root
as a cell [QSNAM#root], and `impls` binds, for each address the source
declares with the recipe `::builtin{}`, a plain function over the values
its inputs checked, the subject first and the inputs in their order.
The root refuses, as it is declared, a `::builtin{}` the host handed
nothing for and an implementation handed for a name the source declares
as no word. The core is such a host of its own sources, listed once in
`LANGUAGE_SOURCES`, each read whole when the runtime starts. The kernel
is the evaluator with its table of primitives and the shapes it reads,
`::fn`, `::kind` and `::builtin{}`, which the catalog documents rather
than defines. A primitive that reads the scope of its call, `doc`,
`env`, `get`, `apply` and their kin, takes the state of the call after
the values of its inputs were checked; every other primitive is a plain
function. A host's setting is the first value of its pipe and nothing
else in the environment.

```qlang
> ::vec/count | source | parse | contains "::builtin{}"
true
```

## effect

A query reads, and writes only by a host's words for the streams of its
process, each an explicit step performed when it runs: the command
line's `in` reads standard input, `out` writes a string as a line of
standard output, `err` as a line of standard error, and `tap` shows a
value on standard error halfway through a query. What changes the world
stays a command of its host, and its result a noun that queries read.
A tag may describe an effect a host is to perform, and such a value is
performed only by an explicit step at the boundary; a constructor is
pure, and reading or constructing a literal performs nothing. The forks
of a sequence run in its order, so a word of a host with an effect meets
the elements in their order.

```qlang
> :any/quiet ~(out) | 1
1
```

## answer

The command line writes every answer as the language prints it,
whatever its input was, a string as its text, and whole: a budget is
asked for, `| elide N` in the query or `--budget=N` before it, which
prints every answer within N characters. A failure is an answer: it goes
to standard output with the exit code 0, as its alert, its tag and its
facts with the data it carries cut to what places the failure, and the
prose of its refusal's page below it as line comments. Standard error
and a nonzero code stay for what is no answer: a defect raised past the
fail track and a call with no query. A reader who wants JSON converts
the answer in the query, `| json`. An argument after the query is
refused with a usage line that names where the flags stand. `-i` opens
the REPL, a query after it its first cell.

```qlang
> {:a 1} | json
"{\"a\":1}"
```

## input

The command line starts from standard input when the query reads its
subject and the input carries bytes, read as the values its JSON writes
under `--json` or as text, and otherwise from `::qlang`, the noun of the
language. A query whose first step that declares nothing is a literal
runs at once; one that reads its subject reads standard input to its
end, waiting on a slow producer as every reader of a pipe does.

## shell

Under MSYS, the shell beneath Git Bash, a query that begins with a drive
and a slash and with the root of the shell arrived as a path the shell
made of a query that began with `/`, and is read from the slash after
that root. A query the command line cannot read back and that fails
gets a line on standard error that names the two ways around it, a read
begun with its word and `MSYS_NO_PATHCONV=1`.

## repl

The REPL runs a cell at a time in one session, each cell a scope of its
own [QSNAM#scope], and prints each answer, a failure as its alert. Its
line editor reads a chunk of one character, or one that begins with an
escape, as keys and any other chunk as text: a paste a host hands over
in several chunks is gathered and lands at the cursor as one, waiting
for a submit, and Alt+Enter, in both its spellings, submits. Its colour
is a layer over the core's tokens.

## tools

`cli/src/bin.mjs` is the one file of the command line that touches the
process. The language server runs over stdio and answers
goto-definition by the reach of a bare name [QSNAM#reach]; the extension
of the editor launches it. The site is built by Astro and paints its
examples from what the core's parser reads.
