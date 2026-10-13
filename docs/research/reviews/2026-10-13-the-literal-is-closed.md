## qlang review: the-literal-is-closed (master...1fc93994)

**Verdict**: REQUEST CHANGES

**Gates**: `npm run ci` on 9433c3df, the repairs of findings one to six in it: exit 1, the coverage of the core under its threshold in `core/src/eval.mjs` and `core/src/runtime/path.mjs`, whose lines led to findings eight and nine; on 104405d6, their repairs in it: exit 0. The sister project's suite runs green against 104405d6.

The range holds the reading of the sixth outside audit and its script
(2fd247ec), the records D278 and D279 (cdd34539), the targets of D279
(168b5c47), and the closed literal itself (1fc93994). I read the touched
sources whole: `core/src/grammar.peggy`, `core/src/eval.mjs`,
`core/src/runtime/path.mjs`, `core/src/runtime/kind.mjs`,
`core/src/runtime/print-value.mjs`, `core/src/quote.mjs`,
`core/src/primitives.mjs`, `core/src/walk.mjs`, the pages of `::qlang`,
`::construct` and `::kind`, and the records D266, D277, D278 and D279
with the records D279 prunes.

### Findings (9)

1. **The tests follow what they test** (blocker): a literal still
   computes in the code of a doc.
   - `core/src/grammar.peggy`, `refuseComputedParts`: the refusal returns
     where `docQuoteDepth > 0`, so the vector of a snippet keeps its
     group: `|~~ ::snippet~([(1 | add 1)]) ~~| | snippets` answers
     `[::snippet~([(1 | add 1)])]`, and
     `:s (|~~ ::snippet~([(1 | add 1)] | count) ~~| | snippets | first) | 0 | apply s`
     answers `1`, the group run.
   - Repair: a predicate on each rule of a container that lets the
     literal match in a doc only where no part computes, so a doc's
     code that writes one reads as prose, as `::snippet~(::T(5))` does;
     a case of D279 that a snippet with a group is no snippet.

2. **One fact, one spelling** (blocker): the payloads a tag takes are
   spelled twice.
   - `core/src/grammar.peggy`: `TAGGED_SCALARS` and `SIGNED_LITERALS`
     list the alternatives of the rules `TaggedScalar` and
     `TaggedPayload` again, for the refusal of parentheses after a tag.
   - `core/src/runtime/print-value.mjs`: `SCALAR_OF_NO_SIGN_RE`,
     `/^[\w/-]/`, copies that rule as a pattern over the text of a
     print.
   - Repair: the refusals of parentheses after a tag match the rules
     themselves, `"(" _ TaggedScalar _ ")"` and
     `"(" _ TaggedPayload _ ")"`; the printer writes `#` by the kind of
     the payload, a number, a boolean, null or a path.

3. **Prose names the invariant** (major): the evaluator says a part of a
   literal is a word forked against the subject.
   - `core/src/eval.mjs`: the comments of `fork`, `evalVecLit` and
     `wordAnswer`, and the fork each part runs in, tell a part of a
     literal as a word that reads the subject; a part is a literal,
     which reads no name and no subject.
   - Repair: read each part without a fork, and name the helpers by
     the part, `partValues`, `partAnswer`, `answerOfPart`.

4. **Words carry paradigms** (major): scalar names a value where the
   rule of `#` is said of a literal.
   - The message of the parser, "a scalar touches its tag by `#`", the
     record D279, the pages of `::construct` and of the values, the law
     `ReadBackDiffersError/writesAScalarPayloadByAHash` and three cases
     of D279 say scalar. A string and a keyword are atoms as a number is
     [D42] and touch a tag by their own signs; what takes `#` is a
     literal whose first character would continue the tag's name.
   - Repair: name the four, a number, a boolean, null and a path, and
     say the rule of the literal's first character.

5. **The language describes itself** (major): the pages of `::qlang`
   state what the tree no longer does.
   - The law `:qlang/groupsAPipelineInALiteral` says "A pipeline inside
     a literal stands in parentheses" over a query of a template;
     `reshapesByALiteral` and `reshapesEachElement` give the template's
     work to the literal; the eleventh section of the first page and
     the chapter of errors say a literal whose part fails, and the law
     `:qlang/pipeline/seesNothingOfASibling` one part of a literal.
   - Repair: the first page and the chapters of values, of the pipeline
     and of errors tell the literal closed, its tag and its `#`, the
     constructor that attaches or refuses and the template of `get`,
     each statement by a law.

6. **Prose names the invariant** (minor): `core/src/eval.mjs`,
   `quotesClosedIn`, keeps "a set's elements … in the order written";
   a set holds its elements in the one order.
   - Repair: in its order.

7. **The sign of the diff** (minor): the core sources grow by the
   template of `get`, its quotes closed at the call by `runsWithin`
   and read one after another, and by the refusals of the grammar; the
   model is D279's, and the branch names no deletion it makes room
   for.
   - Repair: name it. The mark `writtenHere` of a template and the
     closing of a quote a template holds as data wait on the question
     of where a held quote reads its names [D278].

8. **The language describes itself** (blocker): a template lays a tag
   over a payload its constructor never checked.
   - `core/src/runtime/path.mjs`, `readShape`: a vector or a map under
     a tag is read and the tag laid back by `makeTaggedInstance`, so
     `{:a 1} | get ::Box{:w /a}` answers `::Box{:w 1}`, a value under
     `::Box` its constructor never saw, while D279 says the constructor
     attaches the tag or refuses the payload. The gate's coverage named
     the lines no case reached.
   - Repair: read a container under a tag as a write of a path reads
     it and lay it back under its tags through their constructors,
     `relaid` [D250], a quote and a doc answered as they are, the rule
     of what a template enters spelled once for the reading and the
     closing of its quotes; cases of D279 for a container under a tag
     and for a constructor that refuses the payload read.

9. **One fact, one spelling** (minor): `core/src/eval.mjs`,
   `underKind`, reads the answer of a kind's check for an error, which
   no check of a host answers, each refusing by a throw; the gate's
   coverage named the branch no case reaches.
   - Repair: delete the branch.

### Where I found nothing

The template of `get` reads its paths and runs its quotes in the order
written, the first failure the answer, `query` reading the paths
softly; a set template answers a set. A kind takes no recipe but the
host's check, refused as `::kind/impl/recipe/NotBuiltinError`. The
records D279 takes from are pruned, each naming it, and D266 is
replaced. The host boundary holds: no `node:` import under
`core/src/`. The sister project's suite runs green on its migration,
6a2603f.

[D42]: ../../decisions/D42.md
[D250]: ../../decisions/D250.md
[D278]: ../../decisions/D278.md
