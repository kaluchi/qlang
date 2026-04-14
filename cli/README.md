# @kaluchi/qlang-cli

Command-line interface for the [qlang](https://github.com/kaluchi/qlang)
pipeline query language.

## Install

```
npm install -g @kaluchi/qlang-cli
```

Provides two binaries — `qlang` (the canonical name) and `ql` (a
short alias).

## Usage

```
qlang <query>           evaluate a qlang query and print whatever
                        the query routes through `@out`
qlang -h | --help       show the help banner
qlang -V | --version    show the package version
```

The query string is the first positional argument; quote it so the
shell does not split on whitespace or pipe characters.

## Pre-bound I/O and format operands

Every query runs in a session with these operands bound into env —
no `use(...)` ceremony.

### Effectful

| Operand | Contract |
|---|---|
| `@in`  | nullary producer; returns the entire stdin payload as a String |
| `@out` | bare form: subject must be String → writes `subject + '\n'` to stdout, identity on pipeValue |
| `@out(renderer)` | runs `renderer` against pipeValue; result must be String → writes to stdout, identity on original pipeValue |
| `@err` | same shape as `@out`, writes to stderr |
| `@err(renderer)` | same shape as `@out(renderer)`, writes to stderr |
| `@tap(:label)` | identity on `(pipeValue, env)`; mirrors `printValue(pipeValue)` to stderr with `[tap label] ` prefix |

### Pure

| Operand | Contract |
|---|---|
| `pretty` | any subject → String, the canonical qlang-literal display form |

The format family will grow with `tjson`, `ndjson`, `template(:str)`,
`raw` as concrete user demands surface.

## Output is explicit

A query without `@out` produces no stdout — the CLI does not
auto-print the final pipeValue. Either route through `@out`:

```
qlang '[1 2 3] | count | pretty | @out'
3

qlang '"hello" | append(" world") | @out'
hello world
```

…or write nothing to stdout if the side-effects are diagnostic only:

```
qlang '@in | parse | eval | /users | @tap(:loaded) | filter(/active) | count | pretty | @out' < users.json
```

## Exit codes

| Code | Meaning |
|---|---|
| `0` | query evaluated and reached a success-track value |
| `1` | host-level JS throw (parse failure, primitive missing, …) — message written to stderr; **or** an unhandled fail-track error value reached the end (silent: route diagnostics yourself with `!| @err(pretty)`) |
| `2` | usage error (missing or malformed argv) |

## Examples

```
qlang '[1 2 3] | filter(gt(1)) | count | pretty | @out'
2

qlang '"hello" | append(" world") | @out'
hello world

qlang '@in | parse | eval | /glossary/title | @out' \
  < glossary.json
example glossary

qlang '@in | parse | eval | /users
       | filter(/active) * /name
       | pretty | @out' < users.json
["alice" "carol"]

qlang '[1 2 3] | @tap(:before) | filter(gt(1)) | @tap(:after) | count | pretty | @out'
[tap before] [1 2 3]
[tap after] [2 3]
2
```

## Status

I/O surface (`@in`, `@out`, `@err`, `@tap`) plus the `pretty` format
operand are in place. Follow-up commits add the rest of the format
family (`tjson`, `ndjson`, `template`, `raw`), parsers (`@parseJson`,
`@parseTjson` — `parse | eval` is the current stand-in for the JSON
example above), the readline REPL, named sessions, module discovery,
and named arguments.

See [docs/qlang-spec.md](../docs/qlang-spec.md) for the language
reference.
