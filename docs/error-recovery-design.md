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

Error returned:

```
!{:kind :type-error
  :thrown :ProjectionSubjectNotMap
  :message "/node requires Map subject, got Null"
  :trail [{:text "/counters/instruction" ...}]}
```

What was missing from this error:
1. The step that PRODUCED the error (`/coverage/node`) — not in trail
2. The subject that was handed to it (`null`) — not in descriptor
3. What was available instead (the actual keys of the Map before
   `/coverage/node` tried to project `/node` from it)
4. The skipped intent (`/counters/instruction`) is in trail but with
   no recovery hint

The agent then tried `/coverage`, `/data`, `@node`, grep through
source files — 4 more calls before finding the right shape.

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
  :message  "/node requires Map subject, got Null"  -- human string
  :trail    [{AST-Map}, ...]      -- deflected steps AFTER the error
  ...context fields...}
```

### What trail contains (observed)

```qlang
"Foo" | @coverage | /coverage/node | @coverageCard | geo !| /trail * /text
-- trail = ["/coverage/node", "@coverageCard", "geo"]
```

Trail records every step that `|` DEFLECTED after the error. Each
entry is a full AST-Map with `:qlang/kind`, `:name`, `:args`,
`:text`, `:location`.

### Three information gaps

| Gap | Current state | Impact on recovery |
|---|---|---|
| Failed step | Only in `:message` as string fragment | Cannot `reify` it, cannot inspect its descriptor/docs/examples |
| Subject at failure | Not recorded | Cannot show "you had X, tried to do Y" |
| Combinator type | Not recorded in trail entries | Cannot distinguish deflected success-steps from deflected fail-handlers |

## Design directions to explore

### Direction 1: Enrich error descriptor

Add two fields to the error value that the evaluator produces:

- `:failedStep` — AST-Map of the step that produced the error
  (same shape as trail entries). Always small (~50 tokens).
- `:subject` — the pipeValue that was handed to the failed step.
  Immutable value, could be large. But this is a storage reference
  in the runtime — cost is zero until serialized. Presentation
  is the handler's responsibility:

```qlang
!| /subject | pretty        -- full dump
!| /subject | @overview     -- summary for large values
!| /subject | typeOf        -- just the type
!| /subject | keys          -- just the Map keys
```

Open questions:
- Should `:subject` always be captured, or opt-in?
- Should trail entries also carry `:combinator` (`:pipe`, `:distribute`, etc.)?
- Should `:failedStep` carry the reified descriptor of the operand
  that failed, or just the AST-Map (leaving reify to the handler)?

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

Key insight: the trail carries the INTENT (what the user wanted)
even though the pipeline failed. `@explainError` uses both the
error (what went wrong) and the intent (what was wanted) to
produce contextual recovery.

From speech act theory (Austin/Searle): the pipeline is the
locutionary act (what was said), the terminal conduit is the
illocutionary act (what was meant), `@explainError` reconstructs
the perlocutionary act (useful effect) from the preserved intent.

### Direction 3: Navigation hints in successful responses

HATEOAS principle: every response carries links to related
operations. In qlang, "links" are pipeline continuations:

```qlang
"Dog" | @coverage
-- current response: {:counters {:instruction {...} ...}}
-- proposed enrichment (only in card/verbose mode):
-- {:counters {...}
--  :_nav {:drill "@uncoveredLines"
--         :broaden "| @overview"
--         :method "\"Dog#name()\" | @coverage"}}
```

This is the `@coverageCard` vs `@coverage` duality: data axis
for pipeline chaining (composable, dry), card axis for terminal
presentation (rich, navigable).

Every host-bound axis could have a card adjoint:
- `@coverage` / `@coverageCard`
- `@members` / `@membersCard` (hypothetical)
- `@source` / `@sourceCard` (exists)
- `@callers` / `@callersCard` (hypothetical)

### Direction 4: Contextual hints in every response

Instead of enriching errors only, add a lightweight `:_hint` field
to every qlang response when the result is a host-bound axis output.
Cost: ~30-50 tokens per response. Benefit: agent never needs to
guess what to do next.

```qlang
"Dog" | @coverage
-- result includes:
-- {:_hint "drill: @uncoveredLines | @partialLines
--         method: \"Dog#method()\" | @coverage
--         card: @coverageCard"}
```

This is progressive disclosure via response shape — each response
reveals the NEXT level of capability without requiring documentation
lookup.

Counter-argument: pollutes pure data pipeline with presentation
metadata. Response: the `_` prefix convention (or a namespaced
`:qlang/hint`) signals "strip me before chaining". Or: hints only
appear in card-mode conduits, never in raw data axes.

## Design constraints from qlang-spec

- Values are immutable. Carrying `:subject` in error is safe.
- `reify(:name)` returns descriptor with `:docs`, `:examples`,
  `:source`. Available inside `!|` handlers.
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
