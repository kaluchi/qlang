# @kaluchi/qlang-cli

Command-line interface for the [qlang](https://github.com/kaluchi/qlang)
pipeline query language.

## Install

```
npm install -g @kaluchi/qlang-cli
```

Provides two binaries — `qlang` and its short alias `ql`.

## Usage

```
qlang [--json | --raw] [--color=MODE] [--budget=N] <query>
qlang [--budget=N] -i | --repl [<query>]
qlang -h | --help
qlang -V | --version
```

A query runs on what stdin holds and its answer is written to stdout
in the form the input came in: JSON input is the subject as values and
the answer is written as JSON; text input is a string and the answer is
written as its print. `qlang -h` tells the flags.

```
curl -s api/users | qlang '/data * /name'
echo hi           | qlang --raw 'append " world"'
qlang '[1 2 3] | filter ~(gt 1) | count'
qlang -i '::qlang | doc | links * open'
```

The language documents itself: `qlang '::qlang | doc'` reads the
language, and `qlang '::cli | doc'` this command line, its verbs
`@in`, `@out`, `@err`, `@tap` and `table` among them.

A value one query hands another over a pipe keeps its kinds as its
literal:

```
qlang '#[:admin :user] | print | @out' | qlang --raw 'parse | open | count'
2
```

## Exit codes

| Code | Meaning |
|---|---|
| `0` | the query ran; an error it answers is written as its value |
| `1` | the query does not parse, or the input is not JSON under `--json` |
| `2` | usage error (missing or malformed argv) |

## REPL

`qlang -i` opens a session whose cells share the names they declare;
a query after `-i` runs as its first cell. `.help` lists the meta
commands and the keys of the editor. `@in` answers the empty string
inside the REPL, since the prompt reads stdin.
