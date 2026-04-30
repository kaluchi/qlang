# Error Recovery Design — Brainstorm Brief

## Context

Qlang is a pipeline query language for transforming immutable values.
It has a fail-track (`!|` combinator) that catches error values and
exposes their descriptor as a Map. The full language spec is in
`docs/qlang-spec.md`. The language is used as the query layer for
`jdt q` — a CLI that exposes Eclipse JDT semantic graph to LLM agents.

This document captures findings from a real agent work session and
proposes design directions for error recovery that makes agents
more effective. The goal is to brainstorm concrete implementation
options — not to decide yet.

## Problem: errors cause cascading agent failure

When an LLM agent builds a `jdt q` pipeline and gets an error, the
error response increases the agent's uncertainty instead of reducing
it. The agent retries 3-5 times with slight variations, each attempt
adding ~200 tokens of waste to context. Over a session, this
accumulated to ~26,000 tokens of parasitic context — 6x more than
contextual hints would have cost.

### Concrete example from the session

The agent wanted instruction coverage for a class. Correct pipeline:

```qlang
"Foo" | @coverage | /counters/instruction | /missedCount
```

What the agent tried first:

```qlang
"Foo" | @coverage | /coverage/node | /counters/instruction
```

Error now returns (after `:fault` + `:combinator` enrichment):

```
!{:kind :type-error
  :thrown :ProjectionSubjectNotMap
  :message "/node requires Map subject, got Null"
  :fault {:step {:qlang/kind :Projection :keys ["coverage" "node"]
                 :text "/coverage/node" ...}
          :input {:counters {:instruction {...}} ...}}
  :trail [{:text "/counters/instruction" :combinator :pipe ...}]}
```

What is now available:
1. `:fault/:step` — the step that produced the error, as AST-Map
2. `:fault/:input` — the pipeValue (`null` in this case), inspectable
3. `:trail` entries carry `:combinator` — which combinator deflected
4. Skipped intent is in trail — `@explainError` can `reify` it

What is still missing:
- Contextual recovery hints (available keys, "did you mean")
- `@explainError` conduit to turn `:fault` + `:trail` into guidance

The agent tried `/coverage`, `/data`, `@node` — 4 more calls.
With `:fault/:input | keys` the agent would see the actual Map
shape in 0 additional calls.

### Quantified cost

| Metric | Value |
|---|---|
| Total jdt q calls in session | ~85 |
| Calls that errored or returned unusable data | ~25 (29%) |
| Average recovery distance per error | 3 calls |
| Tokens wasted on retry chains | ~26,000 |
| Tokens a contextual hint would cost | ~4,000 (50 tok × 85 calls) |
| ROI of hints over retries | 6x |

## Current error descriptor shape

From `qlang-spec.md` § Error track:

```
!{:origin   :qlang/eval          -- who produced it
  :kind     :type-error           -- broad category
  :thrown   :ProjectionSubjectNotMap  -- per-site class
  :message  "/node requires Map subject, got Null"
  :fault    {:step {AST-Map}      -- the step that produced the error
             :input <pipeValue>}  -- what was handed to it
  :trail    [{AST-Map}, ...]      -- deflected steps AFTER the error
  }
```

### What trail contains (observed)

```qlang
"Foo" | @coverage | /coverage/node | @coverageCard | geo !| /trail * {:text /text :via /combinator}
-- [{:text "/coverage/node" :via :pipe}
--  {:text "@coverageCard"  :via :pipe}
--  {:text "geo"            :via :pipe}]
```

Trail records every step that a success-track combinator DEFLECTED
after the error. Each entry is a full AST-Map with `:qlang/kind`,
`:name`, `:args`, `:text`, `:location`, and `:combinator`
(`:pipe` / `:distribute` / `:merge`).

### Resolved gaps

| Gap | Before | After |
|---|---|---|
| Failed step | Only in `:message` as string | `:fault/:step` — full AST-Map, `reify`-able |
| Subject at failure | Not recorded | `:fault/:input` — the pipeValue handed to the failed step |
| Combinator type | Not recorded | `:combinator` keyword on every trail entry |

## Design directions to explore

### Direction 1: Enrich error descriptor

`:fault` Map on every error descriptor carries the failed step
and the pipeValue that was handed to it:

```qlang
!| /fault/input | pretty    -- full dump of what was handed in
!| /fault/input | typeOf    -- just the type
!| /fault/input | keys      -- Map keys (if it was a Map)
!| /fault/step/text          -- source text of the failed step
```

Trail entries carry `:combinator` (`:pipe` / `:distribute` /
`:merge`). REPL auto-materializes `_trailHead` into `:trail`
on display.

### Direction 2: Recovery-aware terminal conduits

The "card" pattern from `@sourceCard` — a terminal conduit that
produces a rich markdown presentation with navigation hints.
Applied to errors:

```qlang
"Dog" | @coverage | @coverageCard !| @explainError
```

Success path: `@coverageCard` renders rich card.
Failure path: `@explainError` reads trail, sees skipped
`@coverageCard`, does `reify(:@coverageCard)` to get its docs
and examples, produces recovery guidance.

The trail carries the INTENT (what the user wanted) even though
the pipeline failed. `@explainError` uses both the error (what
went wrong) and the intent (what was wanted) to produce
contextual recovery.

Every host-bound data axis has a card adjoint — data for pipeline
chaining, card for terminal presentation with affordances:
- `@source` / `@sourceCard` (exists)
- `@coverage` / `@coverageCard` (exists)
- `@members` / `@outlineCard` (hypothetical)

### Direction 3: Card conduits as progressive disclosure

Card conduits (`@sourceCard`, `@coverageCard`) already include
contextual navigation — callers, callees, related commands.
Extending this pattern to error recovery means `@explainError`
is itself a card conduit over the error descriptor + trail.

The card approach keeps data axes pure (composable, dry) while
card axes carry affordances (what to do next with THIS result).
No metadata pollution in data pipelines — cards are opt-in
terminal steps.

## Design constraints from qlang-spec

- Values are immutable. Carrying `:input` in `:fault` is safe.
- `reify(:name)` returns descriptor with `:docs`, `:examples`,
  `:source`. Available inside `!|` handlers — `@explainError` can
  introspect the skipped operands from trail.
- `eval` can re-run parsed AST-Maps. Trail entries ARE AST-Maps.
  A handler could theoretically re-try a failed step with different
  input.
- `env` operand returns the full binding scope. Available in `!|`
  handlers. No need to carry env in the error descriptor.
- Error values are first-class — they live in Vecs, Maps, anywhere.
  Enriching them doesn't break containment.
- `parse` + `eval` close the homoiconic ring. `reify` + `manifest`
  provide full introspection. The infrastructure for self-describing
  recovery is already in place.

## Success criteria

Whatever we implement should:

1. Reduce agent retry rate from ~29% to <10%
2. Cost less in context tokens than the retries it prevents (6x ROI minimum)
3. Not break pure data pipelines — enrichment is opt-in or in separate conduits
4. Be expressible in qlang's existing evaluation model (no new evaluation rules if possible)
5. Work for both jdt-specific axes AND generic qlang operands
