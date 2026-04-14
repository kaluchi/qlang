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
qlang <query>           evaluate a qlang query and print the result
qlang -h | --help       show the help banner
qlang -V | --version    show the package version
```

The query string is the first positional argument; quote it so the
shell does not split on whitespace or pipe characters.

## Examples

```
qlang '[1 2 3] | filter(gt(1)) | count'
2

qlang '"hello" | append(" world")'
"hello world"

qlang '{:a 1 :b 2 :c 3} | keys'
#{:a :b :c}
```

## Exit codes

- `0` — query evaluated and produced a success-track value
- `1` — query produced a fail-track error value, or parse / setup
  threw a JS error
- `2` — usage error (missing or malformed argv)

## Status

Skeleton release. The orchestrator is in place; future commits add
the `@in` / `@out` operand contract for stdin / stdout, format
operands (`json`, `tjson`, NDJSON, template), readline REPL, named
sessions, module discovery, and named arguments.

See [docs/qlang-spec.md](../docs/qlang-spec.md) for the language
reference.
