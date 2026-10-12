# Decisions

One file holds one decision: `Dnn.md` for a decision of the language and of
the work on it, `En.md` for one of the environment of the work that
`docs/qlang-entrypoint.md` designs. The root of this folder holds the
records in force. A record that a later one replaces whole keeps its text
and gains the line that names the record replacing it [D58], and moves to
`replaced/` once, by `node scripts/replaced-records.mjs`, which writes
every link to it again; nothing moves it after [D237]. A record on the
axis of an earlier one merges into it: the earliest, written anew,
holds what both decided, and the later gains the line `Merged into` it
and moves to `replaced/` by `node scripts/merge-records.mjs`, which
writes every citation of it in prose anew [D237]. One a later record
takes a part of is pruned of that part and names the record that took
it, so a record in force is true as a whole, and git keeps every text a
record had [D227].

An artifact names the decision it exists for, a module or a script at
its head, a case in its `decision`, and the scope of a record is every
place that marks it, which `node scripts/marks.mjs` answers [D237].

A record's first line names its domain, which says where its requirements
live. A decision of the language leaves them as conformance cases that name
it, and one that no case names is still being decided; a decision of a host
leaves them to the host's own tests; a rule of work leaves none and is held
by reading or by a sensor of the entrypoint. `node scripts/requirements.mjs`
computes from the cases where the work stands. A record that replaces
another in part is written together with what becomes of the cases of the
one it replaces: `node scripts/requirements.mjs D45` lists them, and the
same commit keeps, rewrites or drops each.

A branch that works targets leaves the records, the cases and the gates
as it found them and drops only the mark of a target it met [D59]; the
baseline's copy of `node scripts/gate-diff.mjs --task Dnn` names every
move a branch made on them.

Each record states the decision, its source, what it rests on where
that is not obvious, and the alternatives set aside with the reason.
A decision the maintainer took is sourced by the maintainer's words; a
decision the model took says so and names the request it answered. From
D155 on a record says it in a line of its own, `Decided by.`, and a
choice the maintainer made and the mechanics the model worked out
around it are two records; only the maintainer's words bind, and a
record the model decided is replaced by a better reading without
asking leave [D155].
Several decisions of 15 September were taken by the model at the
maintainer's request; the first version of this document records the
request, and the maintainer's words for it were not found when the
transcripts were searched on 23 September, so those records say only
that, and a record whose words a later search found quotes them. When
the model took the remaining open questions on 22
September, it was because the maintainer asked why those decisions
fell to the maintainer at all:
«давай по остатку, почему это мои решения? .. из чего мне выбирать?
можешь разобраться, а то я не понимаю.. что ты можешь предложить сам?»
(maintainer, 2026-09-22 04:37, session 0ea77851) and, later the same
day in another session, «почему все мое?» (2026-09-22 07:21, session
86982eb5).

[D58]: D58.md
[D59]: D59.md
[D155]: D155.md
[D227]: D227.md
[D237]: D237.md
