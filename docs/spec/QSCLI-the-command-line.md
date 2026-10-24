# QSCLI · The command line and its REPL

How the command line reads a query and writes its answer, and its REPL:
the host of the language in a shell, `cli/`. The tests of `cli/` hold its
sections; the sources, the doors and the notebook it runs a query in are
[QSHST].

## answer

The command line writes the answer of a query as the language prints it,
whatever data standard input held, a string as its text, within the
budget of every answer [QSPRN#budget] but in the REPL, which prints the
answer of a cell whole [QSCLI#repl]. No flag sets or cuts the budget: a
query cuts a value by `elide` [QSPRN#elide], and writes it whole through
the door it opens itself, `out` a text, `print | out` the literal of a
value and `json | out` its JSON. A reader who wants JSON converts the
answer in the query, `| json`. A query that wrote to standard output by
`out` holds the channel: its answer and its failure stay unwritten, no
refusal of its print is raised, and the code is the one its answer exits
with. `-i` or `--repl` opens the REPL, a query after it its first cell,
`-h` or `--help` prints the page of `::cli`, what `qlang '::cli | doc'`
answers, which tells the usage and names the budget by its refusal, and
`-V` or `--version` the version. `cli/src/bin.mjs` is the one file of
the command line that touches the process.

A failure is an answer, written to standard output with the exit code 0,
so calls run side by side never stop each other; `--fail` before the
query gives it the code 1, for a script that tests the code, the failure
written as without the flag, the refusal of an answer past the budget
and one a query that wrote by `out` left unwritten among them, while a
failure caught is a value and every value exits with 0. A failure is
written as its alert [QSERR#alert]. Below the alert stands the content of
its refusal's page as line comments, the repair it tells and its links
and snippets as the code they run, a refusal with no page of its own
reading the page of what refused; an error of the kind of errors, which
no site refused, and one whose tag no declaration names are written
without a page, and the REPL prints its cells without it. A query that
does not parse answers `::quote/ParseError`, the line
the reading stopped in, within an excerpt around the place its
`:location` names, and a caret under that place drawn below the alert
[QSERR#print], and a JSON text of standard input that `parseJson`
refuses is the failure the query starts from, which its steps pass by
[QSCLI#stdin].

Standard error and a nonzero code are for what is no answer: a defect
raised past the fail track is written as `qlang:` and its message with
the code 1; a call with no query, an argument after the query, an
argument before it that opens with two dashes and names no flag, since
no query opens so, and a `--color` other than `auto`, `always` and
`never` are refused with a usage line and the code 2; any
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

$ qlang '3000 | range | map ~(get {:id ~(it) :name "user"}) | json | out' < /dev/null | wc -c
76892

$ qlang --width=80 '1' < /dev/null 2>&1; echo "exit $?"
qlang: --width=80 is no flag of the command line, which `qlang --help` lists
exit 2

$ qlang -h < /dev/null | head -1
|~~ The command line runs a query on what a shell hands it and prints
```

## stdin

A query starts from its subject, the value it is given, which the
command line reads from standard input where the query reads its subject
and standard input holds bytes, and which is otherwise `::qlang`, the
noun of the language. The command line lifts the text by the verb
`parseJson`, run on it before the query: a JSON text lifts to its value,
a text that is no JSON to the string it is, and a JSON text `parseJson`
refuses, one that holds a number past the doubles, to the failure it
answers, which the steps of the query pass by and `!|` catches. A query
reads its subject unless its first step on the success track that
declares nothing is a literal, a group whose code reads none, or `in`,
the verb that reads standard input as it came, called by its address,
`any/in`, or by its name where no declaration before it declares a verb
of that name, and no declaration before that step has a body that reads
the subject; a query of declarations alone reads it. So `in | count`
counts the characters of any text, a JSON text among it, and
`in | parseJson` reads it as JSON alone. A query that reads its subject
reads standard input to its end, waiting on a slow producer, and
`< /dev/null` ends the wait; a terminal gives no text.

```sh
$ echo '{"a": [1, 2]}' | qlang 'get /a | count'
2

$ echo 'not json' | qlang 'type'
::string

$ echo '[1, 2]' | qlang 'in | type'
::string

$ qlang 'eq ::qlang' < /dev/null
true

$ printf '[1e400]' | qlang 'count' | grep -o '::string/parseJson/NumberNotFiniteError'
::string/parseJson/NumberNotFiniteError

$ printf '[1e400]' | qlang 'count !| get /trace/0/0'
[1e400]

$ printf '[1e400]' | qlang 'in | count'
7

$ printf '[1e400]' | qlang 'any/in | count'
7

$ printf '[1,2,3]' | qlang '!| in | count'
3

$ printf '[1,2,3]' | qlang ':vec/in ~(count) | in'
3

$ printf 'x' | qlang 'in | parseJson' | grep -o '::string/parseJson/TextNotJsonError'
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

The REPL runs a cell at a time in one notebook, each cell a scope of its
own [QSNAM#scope], its first the query `-i` is given, and prints the
answer of each cell whole, as its literal, a string among them and an
answer past the budget of every answer [QSPRN#budget] as well, and a
failure as its alert within that budget [QSERR#alert], without its page,
painted whether or not standard output is a terminal
[QSCLI#colour]; a cell that wrote by `out` holds the channel, no value of
its answer printed after it, while its failure prints; a defect raised
past the fail track, as a cell ran or as its answer printed, it writes on
standard error as `qlang:` and its message, and runs the next cell. It
reads its cells by its line editor [QSCLI#line-editor].

```sh
$ printf '5000 | range\n' | qlang -i | grep -o '4999' | wc -l
1

$ printf '"x" | add 1\n' | qlang -i | grep -c '|~|'
1
```

## colour

The command line paints what it writes by `--color`: `always` paints,
`never` writes plain, and `auto`, its default, paints where `FORCE_COLOR`
holds anything but `0`, writes plain where `NO_COLOR` holds anything but
the empty string, and paints otherwise where standard output is a
terminal; the REPL paints whether or not it is. Its colour is a layer over
the tokens of the core's `tokenize` [QSHST#tokens], a colour to each kind,
a verb of the root apart from a name and a token inside a quote in
italics, whitespace outside a quote and the source past the parse plain,
each escape closed by its reset.

```sh
$ qlang --color=always '1' < /dev/null | grep -c "$(printf '\033')"
1
$ qlang --color=never '1' < /dev/null | grep -c "$(printf '\033')" || echo plain
0
plain
```

## line-editor

The line editor of the REPL reads a chunk of one character, or one that
begins with an escape, as keys, and any other chunk as text. Enter submits
the cell, Ctrl+Enter writes a line break into it, and Alt+Enter submits a
paste in both its spellings, ESC then CR and ESC then LF; Backspace and
Delete erase the character before the cursor and the one under it, Left,
Right, Home and End move the cursor, Ctrl+A and Ctrl+E as Home and End,
and Up and Down move it between the rows of a cell of several lines,
keeping across a shorter row the column it was asked for, and past the
first row and the last walk the cells submitted before, each keeping the
edits made in it until a submit, an empty cell and one that repeats the
cell before it never stored. Ctrl+C clears the cell, Ctrl+D closes the
REPL on an empty cell and does nothing on another, and a character beyond
the basic plane moves and is erased as one. A paste the terminal hands
over in several chunks is gathered and lands at the cursor as one, its
bracket markers taken out, its line breaks kept and the trailing ones
dropped, waiting for a submit; a bracketed paste is read to its end
marker. An Escape alone does nothing, an escape before `[` opens a
sequence however its chunks split it, and Alt with an arrow reads as the
arrow.
