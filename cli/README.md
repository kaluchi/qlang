# @kaluchi/qlang-cli

Command-line interface for the [qlang](https://github.com/kaluchi/qlang)
pipeline query language.

## Install

```
npm install -g @kaluchi/qlang-cli
```

Provides two binaries — `qlang` and its short alias `ql`.

## Usage

`qlang -h` prints the page of the command line, what
`qlang '::cli | doc'` answers: its flags, how it reads stdin and the
codes it exits with.

A query runs on what stdin holds, JSON as values and any other text as
a string, and its answer is printed as the language prints it, a
string as its text, so a query that ends in `| json` writes JSON. Every
answer prints within one budget of characters, and one past it as
`::qlang/AnswerBeyondBudgetError` with its head; `| print | out` and
`| json | out` write the whole. A query that reads no subject,
`[1 2 3] | sum`, reads no stdin, and one headed by `in` reads the text
as it came.

```
curl -s api/users | qlang 'get /data | map /name'
qlang 'get /users | filter /active | json' < data.json
printf hi         | qlang 'in | append " world"'
qlang '[1 2 3] | filter ~(gt 1) | count'
qlang -i '::qlang | doc :pipeline'
```

The language documents itself: `qlang '::qlang | doc'` reads the
language, and `qlang -h` this command line, its verbs `in`, `out`,
`err`, `tap` and `table` among them.

A value one query hands another over a pipe keeps its kinds as its
literal:

```
qlang '#[:admin :user] | print | out' | qlang 'in | parse | open | count'
2
```

## REPL

`qlang -i` opens a session whose cells share the names they declare;
a query after `-i` runs as its first cell. `.help` lists the meta
commands and the keys of the editor. `in` answers the empty string
inside the REPL, since the prompt reads stdin.
