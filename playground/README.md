# @kaluchi/qlang-playground

qplay — a demo command-line app for playing with
[qlang](https://github.com/kaluchi/qlang) and checking that its core
answers: vanilla qlang-core + qlang-stdio, queried from the shell or in
its REPL; the smallest host that embeds the language.

## Install

```
npm install -g @kaluchi/qlang-playground
```

Provides the binary `qplay`.

## Usage

`qplay -h` prints the page of the playground, what
`qplay '::host | doc'` answers: its flags, how it reads stdin and the
codes it exits with.

A query runs on what stdin holds, JSON as values and any other text as
a string, and its answer is printed as the language prints it, a
string as its text, so a query that ends in `| json` writes JSON. Every
answer prints within one budget of characters, and one past it as
`::qlang/AnswerBeyondBudgetError` with its excerpt and the cell that
keeps it, which `::cell"…" | answer` reads back in a later query;
`| print | stdio/out` and `| json | stdio/out` write the whole. A query that reads no
subject, `[1 2 3] | sum`, reads no stdin, and one headed by `::stdio | in`
reads the text as it came.

```
curl -s api/users | qplay 'get /data | map /name'
qplay 'get /users | filter /active | json' < data.json
printf hi         | qplay '::stdio | in | append " world"'
qplay '[1 2 3] | filter (gt 1) | count'
qplay -i '::qlang | doc :pipeline'
```

The language documents itself: `qplay '::qlang | doc'` reads the
language, `qplay '::stdio | doc'` the streams the playground installs,
`in`, `out`, `err`, `tap` and `table` among them, and `qplay -h` the
playground.

A value one query hands another over a pipe keeps its kinds as its
literal:

```
qplay '#[:admin :user] | print | stdio/out' | qplay '::stdio | in | parse | answer | count'
2
```

## REPL

`qplay -i` opens a notebook whose cells share the names they declare;
a query after `-i` runs as its first cell. `.help` lists the meta
commands and the keys of the editor. `::stdio | in` answers the empty
string inside the REPL, since the prompt reads stdin.
