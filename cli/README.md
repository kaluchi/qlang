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
qlang -i | --repl       open an interactive REPL with output
                        syntax highlighting; bindings (let, as)
                        persist across cells in the same session
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

### Pure formatters (value → String)

| Operand | Contract |
|---|---|
| `pretty` | any subject → String, the canonical qlang-literal display form |
| `tjson` | any subject → String, tagged-JSON wire form (round-trippable through `parseTjson`) |
| `template("…")` | any subject → String. `{{.}}` substitutes the whole subject; `{{key}}` projects from a Map; `{{a/b/c}}` chains projections. String values embed raw, others render via printValue, missing fields render as `null` |

`json` (plain JSON via `JSON.stringify`) lives in core and is
already in scope; no need to bind it.

NDJSON does not need a dedicated operand — the composition
`vec * json | join("\n")` produces the same byte sequence
transparently.

### Pure parsers (String → value)

| Operand | Contract |
|---|---|
| `parseJson` | String → qlang value. Object keys become keywords, arrays become Vecs. Bridge to external JSON sources (curl, kubectl, gh, jq) |
| `parseTjson` | String → qlang value via core's `fromTaggedJSON`. Round-trippable with `tjson | @out` for chaining qlang processes over a Unix pipe |

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

qlang '@in | parseJson | /users
       | filter(/active) * /name
       | pretty | @out' < users.json
["alice" "carol"]

qlang '[1 2 3] | @tap(:before) | filter(gt(1)) | @tap(:after) | count | pretty | @out'
[tap before] [1 2 3]
[tap after] [2 3]
2

# Chain two qlang processes losslessly through tagged-JSON
qlang '#{:admin :user} | tjson | @out' \
  | qlang '@in | parseTjson | count | pretty | @out'
2

# Per-element template into stdout
qlang '@in | parseJson * template("{{name}}: {{score}}") | join("\n") | @out' \
  < scores.json
alice: 85
bob: 42

# NDJSON via composition (no dedicated operand needed)
qlang '@in | parseJson * json | join("\n") | @out' < users.json
{"name":"alice"}
{"name":"bob"}
```

## REPL

```
$ qlang -i
qlang> [1 2 3] | filter(gt(1)) | count
2
qlang> "hello" | append(" world")
"hello world"
qlang> let(:double, mul(2))
…  (let returns its incoming pipeValue — the env Map by default)
qlang> 21 | double
42
qlang> .help
Meta commands:
  .help    list meta commands
  .exit    close the REPL (Ctrl+D works too)
qlang> .exit
```

Output AND input are highlighted via the same AST-tokenizer the
docs site uses, painted with terminal ANSI escapes. Live raw-mode
editor under the hood: every keystroke redraws the current line
in colour, plus standard cursor motion (Left / Right / Home / End,
Ctrl+A / Ctrl+E), Backspace / Delete-forward, and Ctrl+C / Ctrl+D.

Multi-line text pasted from the clipboard arrives as ONE cell —
bracketed paste mode is enabled on start, the terminal wraps a
paste in `\x1b[200~ … \x1b[201~`, and the editor commits the
enclosed content (newlines and all) as a single submitted line.
Pasting a multi-line JSON object followed by `| /key` lands as
one query, not N parse failures.

When stdin is a pipe (script use), the editor falls back to
line-buffered mode — no raw mode, no live highlighting overlay,
the result is still highlighted on stdout.

`@in` resolves to the empty String inside the REPL — interactive
stdin is consumed by the prompt itself, so reading "stdin" from
inside a cell would deadlock against the line reader. `@out` /
`@err` / `@tap` keep their normal contracts; their side-effects
appear before the auto-printed result line.

## Status

I/O surface (`@in`, `@out`, `@err`, `@tap`), pure formatters
(`pretty`, `tjson`, `template`), parsers (`parseJson`, `parseTjson`),
and the interactive REPL — with raw-mode line editor, live
input/output syntax highlighting, and bracketed-paste handling
for multi-line clipboard content — are in place. Follow-up
commits add projection-aware tab completion, in-memory then
persistent history, named sessions, module discovery, and named
arguments.

See [docs/qlang-spec.md](../docs/qlang-spec.md) for the language
reference.
